import fs from 'node:fs';
import path from 'node:path';

const FAMILIES = ['season-stats','position-stat','exact-stats','combined-stats','club-stat','league-position','promoted-clubs','relegated-clubs','champions','nationality','career-longevity','club-count','manager','anti-meta','value','minutes-role','composite-story'];
const TARGETS = {
  'season-stats':185, champions:200, 'promoted-clubs':225, 'relegated-clubs':225, 'club-count':250,
  'anti-meta':300, 'exact-stats':300, 'position-stat':325, 'league-position':325, 'career-longevity':350,
  value:400, 'club-stat':400, nationality:400, manager:400, 'minutes-role':400, 'composite-story':450, 'combined-stats':450
};
const DECISIONS = ['CERTIFY','RESCUE','REJECT'];
const ANSWER_BANDS = ['2','3-5','6-15','16-40','41-80','81-150','151+'];
const SIZE_BANDS = [['1',1,1],['2',2,2],['3',3,3],['4-5',4,5],['6-10',6,10],['11-20',11,20],['21-50',21,50],['51-100',51,100],['101-250',101,250],['251+',251,Infinity]];
const n = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const round = (v,d=2) => Math.round(v * 10 ** d) / 10 ** d;
const pct = (v,t) => t ? v/t*100 : 0;
const countBy = (items, key, seed=[]) => {
  const out = Object.fromEntries(seed.map(v => [v,0]));
  for (const item of items) { const k = key(item); out[k] = (out[k] || 0) + 1; }
  return out;
};
const quantile = (a,q) => {
  if (!a.length) return 0;
  const x=(a.length-1)*q, i=Math.floor(x), r=x-i;
  return a[i+1] == null ? a[i] : a[i] + r*(a[i+1]-a[i]);
};
const answerBand = value => value <= 2 ? '2' : value <= 5 ? '3-5' : value <= 15 ? '6-15' : value <= 40 ? '16-40' : value <= 80 ? '41-80' : value <= 150 ? '81-150' : '151+';
const sizeBand = value => SIZE_BANDS.find(([,lo,hi]) => value >= lo && value <= hi)?.[0] || 'unknown';
const groupOf = record => String(record?.variantGroup || '').trim() || `missing:${record?.family}:${record?.position}:${JSON.stringify(record?.conditions || [])}`;

function args(argv) {
  const out={input:'',outDir:'reports',prefix:'prompt-curation-v1',quiet:false};
  for(let i=2;i<argv.length;i+=1){
    if(argv[i]==='--out-dir') out.outDir=argv[++i]||out.outDir;
    else if(argv[i]==='--prefix') out.prefix=argv[++i]||out.prefix;
    else if(argv[i]==='--quiet') out.quiet=true;
    else if(!out.input) out.input=argv[i];
    else throw new Error(`Unexpected argument: ${argv[i]}`);
  }
  if(!out.input) throw new Error('Usage: node scripts/audit-prompt-curation-v1.mjs <export.json> [--out-dir reports] [--prefix prompt-curation-v1]');
  return out;
}

function load(file){
  const p=JSON.parse(fs.readFileSync(file,'utf8'));
  if(p?.kind!=='fpl-prompt-library-family-shards'||!p.manifest||!Array.isArray(p.shards)) throw new Error('Input is not an FPL prompt-library family-shard export.');
  return p;
}

function inspect(payload){
  const errors=[], ids=new Set(), groups=new Map(), byFamily=new Map(FAMILIES.map(f=>[f,[]]));
  const shardFamilies=payload.shards.map(s=>String(s?.family||''));
  const missing=FAMILIES.filter(f=>!shardFamilies.includes(f)), extra=shardFamilies.filter(f=>!FAMILIES.includes(f));
  if(missing.length) errors.push(`Missing families: ${missing.join(', ')}`);
  if(extra.length) errors.push(`Unexpected families: ${extra.join(', ')}`);
  if(new Set(shardFamilies).size!==shardFamilies.length) errors.push('Duplicate family shards found.');
  const manifestCounts=new Map((payload.manifest.familyShards||[]).map(x=>[String(x?.family||''),n(x?.count,-1)]));
  let pass=0,review=0,total=0,duplicates=0;
  for(const shard of payload.shards){
    const family=String(shard?.family||''), records=Array.isArray(shard?.records)?shard.records:[];
    if(n(shard?.count,-1)!==records.length) errors.push(`Shard ${family} count ${shard?.count} does not match ${records.length} records.`);
    if(manifestCounts.has(family)&&manifestCounts.get(family)!==records.length) errors.push(`Manifest family shard ${family} count mismatch.`);
    total+=records.length;
    for(const raw of records){
      const record={...raw,family}, id=String(record?.id||'').trim(), group=groupOf(record);
      if(!id) errors.push(`Record in ${family} is missing ID.`); else if(ids.has(id)) duplicates+=1; else ids.add(id);
      if(String(raw?.family||'')!==family) errors.push(`Record ${id||'(missing id)'} has wrong family.`);
      if(!groups.has(group)) groups.set(group,[]); groups.get(group).push(record);
      byFamily.get(family)?.push(record);
      if(record.qualityStatus==='pass') pass+=1; else if(record.qualityStatus==='review') review+=1;
    }
  }
  if(duplicates) errors.push(`${duplicates} duplicate prompt IDs found.`);
  if(n(payload.manifest.total)!==total) errors.push(`Manifest total ${payload.manifest.total} does not match ${total}.`);
  if(n(payload.manifest.families)!==FAMILIES.length) errors.push(`Manifest family count is ${payload.manifest.families}; expected ${FAMILIES.length}.`);
  if(n(payload.manifest.variantGroups)!==groups.size) errors.push(`Manifest variant-group count ${payload.manifest.variantGroups} does not match ${groups.size}.`);
  if(n(payload.manifest.qualityPass)!==pass) errors.push(`Manifest pass count ${payload.manifest.qualityPass} does not match ${pass}.`);
  if(n(payload.manifest.qualityReview)!==review) errors.push(`Manifest review count ${payload.manifest.qualityReview} does not match ${review}.`);
  for(const [group,records] of groups){
    const stored=new Set(records.map(r=>n(r?.qualityEvidence?.variantGroupSize,-1)).filter(v=>v>=0));
    if(stored.size && (stored.size!==1 || !stored.has(records.length))) errors.push(`Variant group ${group} stores size(s) ${[...stored].join(', ')} but contains ${records.length} records.`);
  }
  if(errors.length) throw new Error(`Curation audit input failed validation:\n- ${errors.join('\n- ')}`);
  return {records:[...byFamily.values()].flat(),byFamily,groups};
}

function score(record){
  const e=record?.qualityEvidence||{}, answers=n(e.answerPlayers);
  const answerUtility=answers>=6&&answers<=80?12:answers>=3&&answers<=150?7:2;
  return n(record?.qualityScore)*10+n(e.coverage)+Math.min(20,n(e.seasons))+Math.min(20,n(e.clubs))+answerUtility;
}
const compare=(a,b)=>score(b)-score(a)||String(a?.id||'').localeCompare(String(b?.id||''));
function distance(anchor,candidate){
  const a=n(anchor?.qualityEvidence?.answerPlayers), b=n(candidate?.qualityEvidence?.answerPlayers);
  return (answerBand(a)!==answerBand(b)?3:0)+(String(anchor?.difficulty||'')!==String(candidate?.difficulty||'')?2:0)+(a&&Math.abs(a-b)>=Math.max(3,Math.ceil(a*.2))?2:0)+(Math.abs(n(anchor?.qualityScore)-n(candidate?.qualityScore))>=10?1:0);
}

function familyMetric(family,records){
  const local=new Map(); for(const r of records){const g=groupOf(r);if(!local.has(g))local.set(g,[]);local.get(g).push(r);}
  const sizes=[...local.values()].map(x=>x.length).sort((a,b)=>a-b);
  return {
    family,prompts:records.length,target:TARGETS[family],targetCompressionPct:round(100-pct(Math.min(records.length,TARGETS[family]),records.length)),
    variantGroups:local.size,promptsPerGroup:round(records.length/Math.max(1,local.size)),groupMedian:round(quantile(sizes,.5),1),groupP90:round(quantile(sizes,.9),1),groupMax:sizes.at(-1)||0,
    positions:countBy(records,r=>String(r?.position||'OTHER'),['ANY','GK','DEF','MID','FWD','OTHER']),
    difficulties:countBy(records,r=>['easy','medium','hard'].includes(String(r?.difficulty||'').toLowerCase())?String(r.difficulty).toLowerCase():'unknown',['easy','medium','hard','unknown']),
    answerBands:countBy(records,r=>answerBand(n(r?.qualityEvidence?.answerPlayers)),ANSWER_BANDS)
  };
}

function quotas(family,extras,smallIndex){
  if(extras.has(family)) return {CERTIFY:3,RESCUE:3,REJECT:3};
  const missing=DECISIONS[smallIndex%3]; return Object.fromEntries(DECISIONS.map(d=>[d,d===missing?2:3]));
}
function annotated(records,groups){
  return records.map(record=>{const group=groupOf(record),members=[...(groups.get(group)||[record])].sort(compare),rank=members.findIndex(x=>x.id===record.id),anchor=members[0];return{record,group,members,rank,distance:rank>0?distance(anchor,record):0};});
}
function pool(decision,items){
  const preferred=items.filter(x=>decision==='CERTIFY'?x.rank===0&&n(x.record?.qualityScore)>=65&&n(x.record?.qualityEvidence?.answerPlayers)>=3:decision==='RESCUE'?x.rank>0&&x.rank<=2&&n(x.record?.qualityScore)>=45&&x.distance>=2:x.rank>=2&&(x.members.length>=6||x.distance<=2));
  const fallback=items.filter(x=>decision==='CERTIFY'?x.rank===0:decision==='RESCUE'?x.rank>0:x.rank>=1).filter(x=>!preferred.includes(x));
  return [...preferred,...fallback].sort((a,b)=>decision==='CERTIFY'?compare(a.record,b.record)||b.members.length-a.members.length:decision==='RESCUE'?b.distance-a.distance||compare(a.record,b.record):b.members.length-a.members.length||a.distance-b.distance||compare(a.record,b.record));
}
function reviewBatch(index,familyRows){
  const extras=new Set([...familyRows].sort((a,b)=>b.prompts-a.prompts||a.family.localeCompare(b.family)).slice(0,8).map(x=>x.family));
  const small=FAMILIES.filter(f=>!extras.has(f)), selected=new Set(), rows=[], familyQuotas={};
  for(const family of FAMILIES){
    const q=quotas(family,extras,small.indexOf(family)); familyQuotas[family]=q; const items=annotated(index.byFamily.get(family)||[],index.groups);
    for(const decision of DECISIONS){let need=q[decision];for(const x of pool(decision,items)){if(!need)break;const id=String(x.record?.id||'');if(!id||selected.has(id))continue;selected.add(id);rows.push({reviewIndex:0,proposedDecision:decision,family,id,label:String(x.record?.label||''),position:String(x.record?.position||''),difficulty:String(x.record?.difficulty||'unknown'),qualityScore:n(x.record?.qualityScore),answerPlayers:n(x.record?.qualityEvidence?.answerPlayers),seasons:n(x.record?.qualityEvidence?.seasons),clubs:n(x.record?.qualityEvidence?.clubs),coverage:n(x.record?.qualityEvidence?.coverage),variantGroup:x.group,variantGroupSize:x.members.length,siblingRank:x.rank+1,materialDistance:x.distance,conditions:x.record?.conditions||[],rationale:decision==='CERTIFY'?`Group anchor; strongest representative for this variant group.`:decision==='RESCUE'?`Sibling adds material answer-pool/difficulty contrast (distance ${x.distance}).`:`Threshold sibling ${x.rank+1}/${x.members.length}; review for redundant numeric variation.`});need-=1;}if(need)throw new Error(`Could not fill ${decision} quota for ${family}; ${need} slots remain.`);}
  }
  rows.sort((a,b)=>a.family.localeCompare(b.family)||DECISIONS.indexOf(a.proposedDecision)-DECISIONS.indexOf(b.proposedDecision)||a.id.localeCompare(b.id));rows.forEach((r,i)=>r.reviewIndex=i+1);
  const decisionCounts=countBy(rows,r=>r.proposedDecision,DECISIONS);if(rows.length!==144||DECISIONS.some(d=>decisionCounts[d]!==48))throw new Error(`Review batch invariant failed: ${rows.length} / ${JSON.stringify(decisionCounts)}.`);
  return {records:rows,familyQuotas,extraFamilies:[...extras],decisionCounts};
}

function audit(payload,file){
  const index=inspect(payload); for(const members of index.groups.values()) members.sort(compare);
  const families=FAMILIES.map(f=>familyMetric(f,index.byFamily.get(f)||[])), sizes=[...index.groups.values()].map(x=>x.length).sort((a,b)=>a-b), buckets=Object.fromEntries(SIZE_BANDS.map(([k])=>[k,0]));for(const s of sizes)buckets[sizeBand(s)]+=1;
  const totalTarget=Object.values(TARGETS).reduce((a,b)=>a+b,0), top=[...families].sort((a,b)=>b.prompts-a.prompts).map(x=>({family:x.family,prompts:x.prompts,sharePct:round(pct(x.prompts,index.records.length))})), batch=reviewBatch(index,families);
  return {schemaVersion:1,auditVersion:'1.1.0',generatedAt:new Date().toISOString(),source:{file:path.basename(file),promotionFingerprint:String(payload.manifest.promotionFingerprint||''),total:n(payload.manifest.total),families:n(payload.manifest.families),variantGroups:n(payload.manifest.variantGroups),qualityPass:n(payload.manifest.qualityPass),qualityReview:n(payload.manifest.qualityReview),savedAt:String(payload.manifest.savedAt||'')},policy:{survivorTargets:TARGETS,survivorTargetTotal:totalTarget,defaultVariantGroupTarget:2,hardVariantGroupCap:3,reviewBatchSize:144,reviewDecisionTargets:{CERTIFY:48,RESCUE:48,REJECT:48}},concentration:{topFamilies:top,topFiveSharePct:round(pct(top.slice(0,5).reduce((s,x)=>s+x.prompts,0),index.records.length)),topSixSharePct:round(pct(top.slice(0,6).reduce((s,x)=>s+x.prompts,0),index.records.length))},compression:{sourcePrompts:index.records.length,variantGroups:index.groups.size,averagePromptsPerGroup:round(index.records.length/Math.max(1,index.groups.size)),medianGroupSize:round(quantile(sizes,.5),1),p90GroupSize:round(quantile(sizes,.9),1),p95GroupSize:round(quantile(sizes,.95),1),p99GroupSize:round(quantile(sizes,.99),1),maxGroupSize:sizes.at(-1)||0,groupBuckets:buckets,capOne:index.groups.size,capTwo:sizes.reduce((s,x)=>s+Math.min(2,x),0),capThree:sizes.reduce((s,x)=>s+Math.min(3,x),0),survivorTarget:totalTarget,survivorTargetPerGroup:round(totalTarget/Math.max(1,index.groups.size)),survivorCompressionPct:round(100-pct(totalTarget,index.records.length))},families,reviewBatch:batch};
}
function md(a){
  const lines=['# Prompt curation Phase 1 audit','',`Generated: ${a.generatedAt}`,'',`- Source prompts: **${a.source.total.toLocaleString('en-GB')}**`,`- Variant groups: **${a.compression.variantGroups.toLocaleString('en-GB')}**`,`- Average prompts/group: **${a.compression.averagePromptsPerGroup}**`,`- Top-five family share: **${a.concentration.topFiveSharePct}%**`,`- Survivor target: **${a.policy.survivorTargetTotal.toLocaleString('en-GB')}** (${a.compression.survivorCompressionPct}% compression)`,'','## Variant groups','',`- Median: ${a.compression.medianGroupSize}`,`- P90 / P95 / P99: ${a.compression.p90GroupSize} / ${a.compression.p95GroupSize} / ${a.compression.p99GroupSize}`,`- Maximum: ${a.compression.maxGroupSize}`,`- Cap 1 / 2 / 3: ${a.compression.capOne.toLocaleString('en-GB')} / ${a.compression.capTwo.toLocaleString('en-GB')} / ${a.compression.capThree.toLocaleString('en-GB')}`,'','## Family targets','','| Family | Source | Groups | Avg/group | Target |','|---|---:|---:|---:|---:|'];for(const r of [...a.families].sort((x,y)=>y.prompts-x.prompts))lines.push(`| ${r.family} | ${r.prompts.toLocaleString('en-GB')} | ${r.variantGroups.toLocaleString('en-GB')} | ${r.promptsPerGroup} | ${r.target.toLocaleString('en-GB')} |`);return `${lines.join('\n')}\n`;
}

const cli=args(process.argv), payload=load(cli.input), result=audit(payload,cli.input);fs.mkdirSync(cli.outDir,{recursive:true});
const base=path.join(cli.outDir,cli.prefix);fs.writeFileSync(`${base}-audit.json`,`${JSON.stringify(result,null,2)}\n`);fs.writeFileSync(`${base}-audit.md`,md(result));fs.writeFileSync(`${base}-review-batch.json`,`${JSON.stringify({schemaVersion:1,auditVersion:result.auditVersion,generatedAt:result.generatedAt,source:result.source,decisionTargets:result.policy.reviewDecisionTargets,familyQuotas:result.reviewBatch.familyQuotas,records:result.reviewBatch.records},null,2)}\n`);
if(!cli.quiet){console.log(`Prompt curation audit complete: ${result.source.total.toLocaleString('en-GB')} prompts / ${result.compression.variantGroups.toLocaleString('en-GB')} groups.`);console.log(`Survivor target: ${result.policy.survivorTargetTotal.toLocaleString('en-GB')} (${result.compression.survivorCompressionPct}% compression).`);console.log(`Review batch: ${result.reviewBatch.records.length} prompts (${JSON.stringify(result.reviewBatch.decisionCounts)}).`);}
