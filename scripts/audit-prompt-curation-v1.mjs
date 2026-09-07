import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_FAMILIES = Object.freeze([
  'season-stats','position-stat','exact-stats','combined-stats','club-stat','league-position',
  'promoted-clubs','relegated-clubs','champions','nationality','career-longevity','club-count',
  'manager','anti-meta','value','minutes-role','composite-story'
]);

const SURVIVOR_TARGETS = Object.freeze({
  'season-stats':185,
  champions:200,
  'promoted-clubs':225,
  'relegated-clubs':225,
  'club-count':250,
  'anti-meta':300,
  'exact-stats':300,
  'position-stat':325,
  'league-position':325,
  'career-longevity':350,
  value:400,
  'club-stat':400,
  nationality:400,
  manager:400,
  'minutes-role':400,
  'composite-story':450,
  'combined-stats':450
});

const DECISIONS = Object.freeze(['CERTIFY','RESCUE','REJECT']);
const POSITION_ORDER = Object.freeze(['ANY','GK','DEF','MID','FWD']);
const DIFFICULTY_ORDER = Object.freeze(['easy','medium','hard','unknown']);
const GROUP_BUCKETS = Object.freeze([
  ['1', 1, 1], ['2', 2, 2], ['3', 3, 3], ['4-5', 4, 5], ['6-10', 6, 10],
  ['11-20', 11, 20], ['21-50', 21, 50], ['51-100', 51, 100],
  ['101-250', 101, 250], ['251+', 251, Number.POSITIVE_INFINITY]
]);

function parseArgs(argv) {
  const args = { input:'', outDir:'reports', prefix:'prompt-curation-v1', quiet:false };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--out-dir') args.outDir = argv[++index] || args.outDir;
    else if (token === '--prefix') args.prefix = argv[++index] || args.prefix;
    else if (token === '--quiet') args.quiet = true;
    else if (!args.input) args.input = token;
    else throw new Error(`Unexpected argument: ${token}`);
  }
  if (!args.input) throw new Error('Usage: node scripts/audit-prompt-curation-v1.mjs <export.json> [--out-dir reports] [--prefix prompt-curation-v1]');
  return args;
}

function readPackage(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!payload || payload.kind !== 'fpl-prompt-library-family-shards') {
    throw new Error('Input is not an FPL prompt-library family-shard export.');
  }
  if (!payload.manifest || !Array.isArray(payload.shards)) throw new Error('Export is missing manifest or shards.');
  return payload;
}

function canonicalFamily(value) { return String(value || '').trim(); }
function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function pct(value, total) { return total ? value / total * 100 : 0; }
function round(value, digits = 2) { const scale = 10 ** digits; return Math.round(value * scale) / scale; }
function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}
function counter(values, allowed = null) {
  const out = Object.fromEntries((allowed || []).map(value => [value, 0]));
  for (const value of values) out[value] = (out[value] || 0) + 1;
  return out;
}
function answerBand(count) {
  if (count <= 2) return '2';
  if (count <= 5) return '3-5';
  if (count <= 15) return '6-15';
  if (count <= 40) return '16-40';
  if (count <= 80) return '41-80';
  return '81-150';
}
function groupBand(size) {
  return GROUP_BUCKETS.find(([, low, high]) => size >= low && size <= high)?.[0] || 'unknown';
}
function stableConditionKey(record) {
  return JSON.stringify((record?.conditions || []).map(condition => ({
    field:String(condition?.field || ''), operator:String(condition?.operator || ''),
    value:condition?.value, value2:condition?.value2
  })).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
function fallbackGroup(record) {
  return `missing:${record?.position || 'ANY'}:${stableConditionKey(record)}`;
}
function recordGroup(record) { return String(record?.variantGroup || '').trim() || fallbackGroup(record); }
function groupRankScore(record) {
  const evidence = record?.qualityEvidence || {};
  const answers = number(evidence.answerPlayers);
  const answerUtility = answers >= 6 && answers <= 80 ? 12 : answers >= 3 && answers <= 150 ? 7 : 2;
  return number(record?.qualityScore) * 10 + number(evidence.coverage) + Math.min(20, number(evidence.seasons)) + Math.min(20, number(evidence.clubs)) + answerUtility;
}
function compareRecords(a, b) {
  return groupRankScore(b) - groupRankScore(a)
    || number(b?.qualityEvidence?.coverage) - number(a?.qualityEvidence?.coverage)
    || number(b?.qualityEvidence?.seasons) - number(a?.qualityEvidence?.seasons)
    || number(b?.qualityEvidence?.clubs) - number(a?.qualityEvidence?.clubs)
    || String(a?.id || '').localeCompare(String(b?.id || ''));
}
function materialDistance(anchor, candidate) {
  if (!anchor || !candidate) return 0;
  const a = number(anchor?.qualityEvidence?.answerPlayers);
  const b = number(candidate?.qualityEvidence?.answerPlayers);
  let score = 0;
  if (answerBand(a) !== answerBand(b)) score += 3;
  if (String(anchor?.difficulty || '') !== String(candidate?.difficulty || '')) score += 2;
  if (a && Math.abs(a - b) >= Math.max(3, Math.ceil(a * 0.2))) score += 2;
  if (Math.abs(number(anchor?.qualityScore) - number(candidate?.qualityScore)) >= 10) score += 1;
  return score;
}

function validate(payload) {
  const errors = [];
  const manifest = payload.manifest || {};
  const shards = payload.shards || [];
  const families = shards.map(shard => canonicalFamily(shard?.family));
  const missing = EXPECTED_FAMILIES.filter(family => !families.includes(family));
  const unexpected = families.filter(family => !EXPECTED_FAMILIES.includes(family));
  if (missing.length) errors.push(`Missing families: ${missing.join(', ')}`);
  if (unexpected.length) errors.push(`Unexpected families: ${unexpected.join(', ')}`);
  if (new Set(families).size !== families.length) errors.push('Duplicate family shards found.');
  const inspected = shards.reduce((sum, shard) => sum + (Array.isArray(shard?.records) ? shard.records.length : 0), 0);
  if (number(manifest.total) !== inspected) errors.push(`Manifest total ${manifest.total} does not match ${inspected} inspected records.`);
  if (number(manifest.families) !== EXPECTED_FAMILIES.length) errors.push(`Manifest family count is ${manifest.families}; expected ${EXPECTED_FAMILIES.length}.`);
  const ids = new Set();
  const variantGroups = new Set();
  let duplicates = 0;
  let pass = 0;
  let review = 0;
  for (const shard of shards) for (const record of shard.records || []) {
    const id = String(record?.id || '').trim();
    if (!id) errors.push(`Record in ${shard.family} is missing ID.`);
    else if (ids.has(id)) duplicates += 1;
    else ids.add(id);
    if (canonicalFamily(record?.family) !== canonicalFamily(shard?.family)) errors.push(`Record ${id || '(missing id)'} has wrong family.`);
    variantGroups.add(recordGroup(record));
    if (record?.qualityStatus === 'pass') pass += 1;
    else if (record?.qualityStatus === 'review') review += 1;
  }
  if (duplicates) errors.push(`${duplicates} duplicate prompt IDs found.`);
  if (number(manifest.variantGroups) !== variantGroups.size) errors.push(`Manifest variant-group count ${manifest.variantGroups} does not match ${variantGroups.size} observed groups.`);
  if (number(manifest.qualityPass) !== pass) errors.push(`Manifest pass count ${manifest.qualityPass} does not match ${pass} observed pass records.`);
  if (number(manifest.qualityReview) !== review) errors.push(`Manifest review count ${manifest.qualityReview} does not match ${review} observed review records.`);
  if (errors.length) throw new Error(`Curation audit input failed validation:\n- ${errors.join('\n- ')}`);
}

function buildIndex(payload) {
  const records = [];
  const byFamily = new Map(EXPECTED_FAMILIES.map(family => [family, []]));
  const groups = new Map();
  for (const shard of payload.shards) {
    const family = canonicalFamily(shard.family);
    for (const raw of shard.records || []) {
      const record = { ...raw, family };
      records.push(record);
      byFamily.get(family)?.push(record);
      const group = recordGroup(record);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(record);
    }
  }
  for (const list of groups.values()) list.sort(compareRecords);
  return { records, byFamily, groups };
}

function familyMetrics(family, records) {
  const localGroups = new Map();
  for (const record of records) {
    const group = recordGroup(record);
    if (!localGroups.has(group)) localGroups.set(group, []);
    localGroups.get(group).push(record);
  }
  const sizes = [...localGroups.values()].map(group => group.length).sort((a,b) => a-b);
  return {
    family,
    prompts: records.length,
    target: SURVIVOR_TARGETS[family],
    targetCompressionPct: round(100 - pct(Math.min(records.length, SURVIVOR_TARGETS[family]), records.length), 2),
    variantGroups: localGroups.size,
    promptsPerGroup: round(records.length / Math.max(1, localGroups.size), 2),
    groupMedian: round(quantile(sizes, .5), 1),
    groupP90: round(quantile(sizes, .9), 1),
    groupMax: sizes.at(-1) || 0,
    positions: counter(records.map(record => POSITION_ORDER.includes(String(record?.position)) ? String(record.position) : 'OTHER'), [...POSITION_ORDER, 'OTHER']),
    difficulties: counter(records.map(record => DIFFICULTY_ORDER.includes(String(record?.difficulty).toLowerCase()) ? String(record.difficulty).toLowerCase() : 'unknown'), DIFFICULTY_ORDER),
    answerBands: counter(records.map(record => answerBand(number(record?.qualityEvidence?.answerPlayers))), ['2','3-5','6-15','16-40','41-80','81-150'])
  };
}

function decisionQuota(family, extraFamilies, smallIndex) {
  if (extraFamilies.has(family)) return { CERTIFY:3, RESCUE:3, REJECT:3 };
  const missing = DECISIONS[smallIndex % DECISIONS.length];
  return Object.fromEntries(DECISIONS.map(decision => [decision, decision === missing ? 2 : 3]));
}

function annotateGroups(familyRecords, globalGroups) {
  const out = [];
  for (const record of familyRecords) {
    const group = recordGroup(record);
    const members = globalGroups.get(group) || [record];
    const rank = members.findIndex(item => String(item.id) === String(record.id));
    const anchor = members[0];
    out.push({ record, group, members, rank, anchor, distance: rank > 0 ? materialDistance(anchor, record) : 0 });
  }
  return out;
}

function candidatePool(decision, annotated) {
  const predicates = {
    CERTIFY: item => item.rank === 0 && number(item.record?.qualityScore) >= 65 && number(item.record?.qualityEvidence?.answerPlayers) >= 3,
    RESCUE: item => item.rank > 0 && item.rank <= 2 && number(item.record?.qualityScore) >= 45 && item.distance >= 2,
    REJECT: item => item.rank >= 2 && (item.members.length >= 6 || item.distance <= 2)
  };
  const preferred = annotated.filter(predicates[decision]);
  const fallback = annotated.filter(item => decision === 'CERTIFY' ? item.rank === 0 : decision === 'RESCUE' ? item.rank > 0 : item.rank >= 1);
  const pool = [...preferred, ...fallback.filter(item => !preferred.includes(item))];
  pool.sort((a,b) => {
    if (decision === 'CERTIFY') return compareRecords(a.record, b.record) || b.members.length - a.members.length;
    if (decision === 'RESCUE') return b.distance - a.distance || compareRecords(a.record, b.record);
    return b.members.length - a.members.length || a.distance - b.distance || compareRecords(a.record, b.record);
  });
  return pool;
}

function batchReason(decision, item) {
  const answers = number(item.record?.qualityEvidence?.answerPlayers);
  if (decision === 'CERTIFY') return `Group anchor; quality ${number(item.record?.qualityScore)}; ${answers} answer players; strongest representative for this variant group.`;
  if (decision === 'RESCUE') return `Non-anchor sibling with material-distance score ${item.distance}; review whether its answer-pool/difficulty contrast earns a second survivor.`;
  return `Threshold sibling rank ${item.rank + 1} of ${item.members.length}; review for redundant numeric variation rather than structural quality failure.`;
}

function buildReviewBatch(index, familyRows) {
  const volumes = [...familyRows].sort((a,b) => b.prompts - a.prompts || a.family.localeCompare(b.family));
  const extraFamilies = new Set(volumes.slice(0, 8).map(row => row.family));
  const smallFamilies = EXPECTED_FAMILIES.filter(family => !extraFamilies.has(family));
  const selectedIds = new Set();
  const batch = [];
  const familyQuotas = {};

  for (const family of EXPECTED_FAMILIES) {
    const quota = decisionQuota(family, extraFamilies, smallFamilies.indexOf(family));
    familyQuotas[family] = quota;
    const annotated = annotateGroups(index.byFamily.get(family) || [], index.groups);
    for (const decision of DECISIONS) {
      let needed = quota[decision];
      for (const item of candidatePool(decision, annotated)) {
        if (!needed) break;
        const id = String(item.record?.id || '');
        if (!id || selectedIds.has(id)) continue;
        selectedIds.add(id);
        batch.push({
          reviewIndex: batch.length + 1,
          proposedDecision: decision,
          family,
          id,
          label:String(item.record?.label || ''),
          position:String(item.record?.position || ''),
          difficulty:String(item.record?.difficulty || 'unknown'),
          qualityScore:number(item.record?.qualityScore),
          answerPlayers:number(item.record?.qualityEvidence?.answerPlayers),
          seasons:number(item.record?.qualityEvidence?.seasons),
          clubs:number(item.record?.qualityEvidence?.clubs),
          coverage:number(item.record?.qualityEvidence?.coverage),
          variantGroup:item.group,
          variantGroupSize:item.members.length,
          siblingRank:item.rank + 1,
          materialDistance:item.distance,
          conditions:item.record?.conditions || [],
          rationale:batchReason(decision, item)
        });
        needed -= 1;
      }
      if (needed) throw new Error(`Could not fill ${decision} quota for ${family}; ${needed} slots remain.`);
    }
  }

  batch.sort((a,b) => a.family.localeCompare(b.family) || DECISIONS.indexOf(a.proposedDecision) - DECISIONS.indexOf(b.proposedDecision) || a.id.localeCompare(b.id));
  batch.forEach((row, indexValue) => { row.reviewIndex = indexValue + 1; });
  const decisionCounts = counter(batch.map(row => row.proposedDecision), DECISIONS);
  if (batch.length !== 144 || DECISIONS.some(decision => decisionCounts[decision] !== 48)) {
    throw new Error(`Review batch invariant failed: ${batch.length} rows / ${JSON.stringify(decisionCounts)}.`);
  }
  return { batch, familyQuotas, extraFamilies:[...extraFamilies], decisionCounts };
}

function buildAudit(payload) {
  validate(payload);
  const index = buildIndex(payload);
  const manifest = payload.manifest;
  const familyRows = EXPECTED_FAMILIES.map(family => familyMetrics(family, index.byFamily.get(family) || []));
  const groupSizes = [...index.groups.values()].map(records => records.length).sort((a,b) => a-b);
  const groupBuckets = Object.fromEntries(GROUP_BUCKETS.map(([label]) => [label, 0]));
  for (const size of groupSizes) groupBuckets[groupBand(size)] += 1;
  const totalTarget = Object.values(SURVIVOR_TARGETS).reduce((sum,value) => sum + value,0);
  const review = buildReviewBatch(index, familyRows);
  const topFamilies = [...familyRows].sort((a,b) => b.prompts - a.prompts).map(row => ({ family:row.family, prompts:row.prompts, sharePct:round(pct(row.prompts,index.records.length),2) }));
  const compression = {
    sourcePrompts:index.records.length,
    variantGroups:index.groups.size,
    averagePromptsPerGroup:round(index.records.length / Math.max(1,index.groups.size),2),
    medianGroupSize:round(quantile(groupSizes,.5),1),
    p90GroupSize:round(quantile(groupSizes,.9),1),
    p95GroupSize:round(quantile(groupSizes,.95),1),
    p99GroupSize:round(quantile(groupSizes,.99),1),
    maxGroupSize:groupSizes.at(-1) || 0,
    groupBuckets,
    capOne:index.groups.size,
    capTwo:groupSizes.reduce((sum,size) => sum + Math.min(2,size),0),
    capThree:groupSizes.reduce((sum,size) => sum + Math.min(3,size),0),
    survivorTarget:totalTarget,
    survivorTargetPerGroup:round(totalTarget / Math.max(1,index.groups.size),2),
    survivorCompressionPct:round(100 - pct(totalTarget,index.records.length),2)
  };
  return {
    schemaVersion:1,
    auditVersion:'1.0.0',
    generatedAt:new Date().toISOString(),
    source:{
      file:path.basename(payload.__sourceFile || ''),
      promotionFingerprint:String(manifest.promotionFingerprint || ''),
      total:number(manifest.total), families:number(manifest.families), variantGroups:number(manifest.variantGroups),
      qualityPass:number(manifest.qualityPass), qualityReview:number(manifest.qualityReview), savedAt:String(manifest.savedAt || '')
    },
    policy:{
      survivorTargets:SURVIVOR_TARGETS,
      survivorTargetTotal:totalTarget,
      defaultVariantGroupTarget:2,
      hardVariantGroupCap:3,
      reviewBatchSize:144,
      reviewDecisionTargets:{ CERTIFY:48, RESCUE:48, REJECT:48 }
    },
    concentration:{ topFamilies, topFiveSharePct:round(topFamilies.slice(0,5).reduce((sum,row)=>sum+row.prompts,0)/index.records.length*100,2), topSixSharePct:round(topFamilies.slice(0,6).reduce((sum,row)=>sum+row.prompts,0)/index.records.length*100,2) },
    compression,
    families:familyRows,
    reviewBatch:{ familyQuotas:review.familyQuotas, extraFamilies:review.extraFamilies, decisionCounts:review.decisionCounts, records:review.batch }
  };
}

function markdown(audit) {
  const lines = [];
  lines.push('# Prompt curation Phase 1 audit','',`Generated: ${audit.generatedAt}`,'');
  lines.push('## Headline','',
    `- Source prompts: **${audit.source.total.toLocaleString('en-GB')}**`,
    `- Families: **${audit.source.families}**`,
    `- Variant groups: **${audit.compression.variantGroups.toLocaleString('en-GB')}**`,
    `- Average prompts per group: **${audit.compression.averagePromptsPerGroup}**`,
    `- Top-five family share: **${audit.concentration.topFiveSharePct}%**`,
    `- Top-six family share: **${audit.concentration.topSixSharePct}%**`,
    `- Proposed survivor target: **${audit.policy.survivorTargetTotal.toLocaleString('en-GB')}** (${audit.compression.survivorCompressionPct}% compression)`,
    `- Review batch: **144** = 48 CERTIFY / 48 RESCUE / 48 REJECT`,'');
  lines.push('## Variant-group compression','',
    `- Median group: ${audit.compression.medianGroupSize}`,
    `- P90: ${audit.compression.p90GroupSize}`,
    `- P95: ${audit.compression.p95GroupSize}`,
    `- P99: ${audit.compression.p99GroupSize}`,
    `- Largest group: ${audit.compression.maxGroupSize}`,
    `- One survivor/group simulation: ${audit.compression.capOne.toLocaleString('en-GB')}`,
    `- Two survivors/group cap: ${audit.compression.capTwo.toLocaleString('en-GB')}`,
    `- Three survivors/group cap: ${audit.compression.capThree.toLocaleString('en-GB')}`,'');
  lines.push('## Family targets','', '| Family | Source | Share | Groups | Avg/group | Target | Compression |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const row of [...audit.families].sort((a,b)=>b.prompts-a.prompts)) {
    lines.push(`| ${row.family} | ${row.prompts.toLocaleString('en-GB')} | ${round(row.prompts/audit.source.total*100,2)}% | ${row.variantGroups.toLocaleString('en-GB')} | ${row.promptsPerGroup} | ${row.target.toLocaleString('en-GB')} | ${row.targetCompressionPct}% |`);
  }
  lines.push('', '## Permanent decision semantics','',
    '- **CERTIFY**: the strongest representative of a genuinely useful variant group; promotion quality pass alone is not enough.',
    '- **RESCUE**: a second/exceptional third sibling only when it creates material answer-pool, difficulty, position or family diversity.',
    '- **REJECT**: structurally valid but redundant threshold siblings, exact duplicates, or low-value variants that add volume without new gameplay.',
    '- Default survivor target is **2 per variant group** with a **hard cap of 3**. One is preferred where siblings are functionally interchangeable.',
    '- Source exports are immutable provenance. Curation emits decisions/survivor IDs; it does not rewrite Prompt Factory, Quality, Promotion or Daily generation architecture.','');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const payload = readPackage(args.input);
  payload.__sourceFile = args.input;
  const audit = buildAudit(payload);
  fs.mkdirSync(args.outDir, { recursive:true });
  const jsonPath = path.join(args.outDir, `${args.prefix}-audit.json`);
  const mdPath = path.join(args.outDir, `${args.prefix}-audit.md`);
  const batchPath = path.join(args.outDir, `${args.prefix}-review-batch.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(audit,null,2)}\n`);
  fs.writeFileSync(mdPath, markdown(audit));
  fs.writeFileSync(batchPath, `${JSON.stringify({
    schemaVersion:1, auditVersion:audit.auditVersion, generatedAt:audit.generatedAt, source:audit.source,
    decisionTargets:audit.policy.reviewDecisionTargets, familyQuotas:audit.reviewBatch.familyQuotas,
    records:audit.reviewBatch.records
  },null,2)}\n`);
  if (!args.quiet) {
    console.log(`Prompt curation audit complete: ${audit.source.total.toLocaleString('en-GB')} prompts / ${audit.compression.variantGroups.toLocaleString('en-GB')} groups.`);
    console.log(`Survivor target: ${audit.policy.survivorTargetTotal.toLocaleString('en-GB')} (${audit.compression.survivorCompressionPct}% compression).`);
    console.log(`Review batch: ${audit.reviewBatch.records.length} prompts (${JSON.stringify(audit.reviewBatch.decisionCounts)}).`);
    console.log(`Wrote ${jsonPath}, ${mdPath}, ${batchPath}`);
  }
}

main();
