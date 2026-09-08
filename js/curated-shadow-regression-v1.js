/* FPL Draft Challenge — curated Daily shadow regression v1.0.0.
   Temporary pre-cutover harness. Reads the saved promoted snapshot, materialises the frozen
   4,897 survivors, re-evaluates them against players.js, and simulates the current 77-prompt
   weekly reservoir for every supported formation. It never writes Daily generation authority,
   publishing state, saved Prompt Library shards or Supabase. */
(() => {
  "use strict";

  const VERSION = "1.0.0";
  const EXPECTED_SOURCE = "shards_134765_1pkuiu3";
  const EXPECTED_SELECTED = 4897;
  const DAYS = 7;
  const WEEKLY = 77;
  const NATIONALITY_TARGET = 7;
  const MIN_ANSWERS = 6;
  const MAX_ANSWERS = 100;
  const MIN_ANTI_META_PER_DAY = 5;
  const POSITIONS = Object.freeze(["GK", "DEF", "MID", "FWD"]);
  const FORMATIONS = Object.freeze({
    "4-4-2": { GK:1, DEF:4, MID:4, FWD:2 },
    "4-3-3": { GK:1, DEF:4, MID:3, FWD:3 },
    "3-4-3": { GK:1, DEF:3, MID:4, FWD:3 },
    "3-5-2": { GK:1, DEF:3, MID:5, FWD:2 },
    "5-3-2": { GK:1, DEF:5, MID:3, FWD:2 },
    "5-4-1": { GK:1, DEF:5, MID:4, FWD:1 },
    "4-2-3-1": { GK:1, DEF:4, MID:5, FWD:1 }
  });
  const BIG_SIX = Object.freeze(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"]);
  const ANTI_META_FAMILIES = new Set([
    "club-stat", "league-position", "promoted-clubs", "relegated-clubs", "career-longevity",
    "club-count", "manager", "anti-meta", "value", "minutes-role", "composite-story"
  ]);

  const $ = id => document.getElementById(id);
  const out = $("shadowOutput");
  const runButton = $("runShadowRegression");
  const downloadButton = $("downloadShadowReport");
  let lastReport = null;

  const number = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  const slug = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  function canonicalCountry(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const aliases = {
      cote_d_ivoire:"Ivory Coast", ivory_coast:"Ivory Coast", korea_republic:"South Korea",
      republic_of_korea:"South Korea", south_korea:"South Korea", united_states:"USA",
      united_states_of_america:"USA", usa:"USA", republic_of_ireland:"Ireland",
      trinidad_tobago:"Trinidad and Tobago", bosnia_and_herzegovina:"Bosnia-Herzegovina",
      czechia:"Czech Republic", democratic_republic_of_the_congo:"DR Congo", congo_dr:"DR Congo"
    };
    return aliases[slug(raw)] || raw.replace(/\s+/g, " ");
  }

  function status(message, kind = "") {
    if (!out) return;
    out.textContent = message;
    out.dataset.kind = kind;
  }
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  function buildRows() {
    const rows = [];
    for (const player of window.FPL_PLAYERS || []) {
      const eligible = (player.seasons || []).filter(record => Number(record?.minutes) > 0);
      if (!eligible.length) continue;
      const careerSeasonCount = new Set(eligible.map(record => String(record.season || "")).filter(Boolean)).size;
      const careerClubCount = new Set(eligible.map(record => String(record.club || "")).filter(Boolean)).size;
      const nationality = canonicalCountry(player?.bio?.nationality);
      for (const record of eligible) rows.push({ player, record, careerSeasonCount, careerClubCount, nationality });
    }
    return {
      ANY:rows,
      GK:rows.filter(row => row.record?.position === "GK"),
      DEF:rows.filter(row => row.record?.position === "DEF"),
      MID:rows.filter(row => row.record?.position === "MID"),
      FWD:rows.filter(row => row.record?.position === "FWD")
    };
  }

  function fieldValue(row, field) {
    const record = row.record || {};
    if (field === "goalInvolvements") {
      const goals = number(record.goals), assists = number(record.assists);
      return goals == null || assists == null ? null : goals + assists;
    }
    if (field === "careerSeasonCount") return row.careerSeasonCount;
    if (field === "careerClubCount") return row.careerClubCount;
    if (field === "nationality") return row.nationality || null;
    if (field === "outsideBigSix") return record.club ? !BIG_SIX.includes(record.club) : null;
    if (field === "champions") return typeof record.champions === "boolean" ? record.champions : number(record.leaguePosition) === 1;
    if (field === "topFour") {
      if (typeof record.topFour === "boolean") return record.topFour;
      const finish = number(record.leaguePosition);
      return finish == null ? null : finish >= 1 && finish <= 4;
    }
    if (field === "bottomHalf") return typeof record.bottomHalf === "boolean" ? record.bottomHalf : null;
    if (field === "relegated") return typeof record.relegated === "boolean" ? record.relegated : null;
    if (field === "promoted") return typeof record.promoted === "boolean" ? record.promoted : null;
    if (field === "manager") return Array.isArray(record.managers) ? record.managers : [];
    return record[field] ?? null;
  }

  function known(row, condition) {
    const value = fieldValue(row, condition.field);
    if (condition.operator === "contains") return Array.isArray(value) ? value.length > 0 : Boolean(String(value || "").trim());
    if (["isTrue", "isFalse"].includes(condition.operator)) return typeof value === "boolean";
    if (condition.operator === "eqText") return Boolean(String(value || "").trim());
    return number(value) != null;
  }

  function matches(row, condition) {
    const actual = fieldValue(row, condition.field);
    if (condition.operator === "isTrue") return actual === true;
    if (condition.operator === "isFalse") return actual === false;
    if (condition.operator === "eqText") return String(actual || "").trim().toLowerCase() === String(condition.value || "").trim().toLowerCase();
    if (condition.operator === "contains") return Array.isArray(actual) && actual.some(item => String(item).trim().toLowerCase() === String(condition.value || "").trim().toLowerCase());
    const a = number(actual), wanted = number(condition.value);
    if (a == null || wanted == null) return false;
    if (condition.operator === "eq") return a === wanted;
    if (condition.operator === "gte") return a >= wanted;
    if (condition.operator === "lte") return a <= wanted;
    if (condition.operator === "gt") return a > wanted;
    if (condition.operator === "lt") return a < wanted;
    if (condition.operator === "between") { const upper = number(condition.value2); return upper != null && a >= wanted && a <= upper; }
    return false;
  }

  function evaluator(rowsByPosition) {
    const cache = new Map();
    return function evaluate(record, position = record.position) {
      const key = `${record.id}|${position}`;
      if (cache.has(key)) return cache.get(key);
      const best = new Map();
      for (const row of rowsByPosition[position] || []) {
        if (!(record.conditions || []).every(condition => known(row, condition) && matches(row, condition))) continue;
        const id = String(row.player?.playerId || "");
        if (!id) continue;
        const points = Number(row.record?.points || 0);
        const current = best.get(id);
        if (!current || points > current.points) best.set(id, { playerId:id, name:String(row.player?.name || id), points });
      }
      const matchesByPlayer = [...best.values()].sort((a,b) => b.points - a.points || a.name.localeCompare(b.name));
      const value = Object.freeze({ count:best.size, bestAnswer:matchesByPlayer[0] || null });
      cache.set(key, value);
      return value;
    };
  }

  function familyIndex(records) {
    const map = new Map();
    for (const record of records) {
      if (!map.has(record.family)) map.set(record.family, { family:record.family, total:0, byPosition:{ ANY:0,GK:0,DEF:0,MID:0,FWD:0 } });
      const row = map.get(record.family); row.total += 1; row.byPosition[record.position] += 1;
    }
    return [...map.values()].sort((a,b) => a.family.localeCompare(b.family));
  }

  function allocateFamilyTargets(index) {
    const rows = index.filter(row => row.total > 0);
    const targets = Object.fromEntries(rows.map(row => [row.family, 0]));
    if (!("nationality" in targets)) return null;
    targets.nationality = NATIONALITY_TARGET;
    const others = rows.filter(row => row.family !== "nationality");
    let remaining = WEEKLY - NATIONALITY_TARGET;
    for (const row of others) { targets[row.family] = 1; remaining -= 1; }
    if (remaining < 0) return null;
    const weightTotal = others.reduce((sum,row) => sum + row.total, 0);
    const remainders = []; let allocated = 0;
    for (const row of others) {
      const raw = weightTotal ? remaining * row.total / weightTotal : 0;
      const floor = Math.floor(raw); targets[row.family] += floor; allocated += floor;
      remainders.push({ family:row.family, remainder:raw-floor, weight:row.total });
    }
    const left = remaining - allocated;
    remainders.sort((a,b) => b.remainder-a.remainder || b.weight-a.weight || a.family.localeCompare(b.family));
    for (let i=0;i<left;i+=1) targets[remainders[i % remainders.length].family] += 1;
    return targets;
  }

  function recordQualityCompare(a,b) {
    const pa = a?.qualityStatus === "pass" ? 1 : 0, pb = b?.qualityStatus === "pass" ? 1 : 0;
    return pb-pa || Number(b?.qualityScore||0)-Number(a?.qualityScore||0) || String(a?.id||"").localeCompare(String(b?.id||""));
  }

  function interleaveSemanticGroups(records, semantic) {
    const sorted = [...records].sort(recordQualityCompare), groups = new Map();
    for (const record of sorted) {
      const key = semantic.recordGroupKey(record, record.position || "ANY");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    const queues = [...groups.values()], ordered=[];
    while (queues.some(queue => queue.length)) for (const queue of queues) if (queue.length) ordered.push(queue.shift());
    return ordered;
  }

  function assignAnyRecords(records, positionNeeds, offset=0) {
    const assigned = Object.fromEntries(POSITIONS.map(position => [position, []]));
    const loads = Object.fromEntries(POSITIONS.map(position => [position, 0]));
    for (const record of records) {
      if (POSITIONS.includes(record.position)) { assigned[record.position].push(record); continue; }
      if (record.position !== "ANY") continue;
      const order = [...POSITIONS].sort((a,b) => {
        const ar=loads[a]/Math.max(1,positionNeeds[a]), br=loads[b]/Math.max(1,positionNeeds[b]);
        return ar-br || ((POSITIONS.indexOf(a)-offset+POSITIONS.length)%POSITIONS.length)-((POSITIONS.indexOf(b)-offset+POSITIONS.length)%POSITIONS.length);
      });
      assigned[order[0]].push(record); loads[order[0]] += 1;
    }
    return assigned;
  }

  function solveFlow(families, targets, needs, pools) {
    const source=0, familyStart=1, positionStart=familyStart+families.length, sink=positionStart+POSITIONS.length;
    const graph=Array.from({length:sink+1},()=>[]), edges=new Map();
    function add(from,to,capacity){const f={to,rev:graph[to].length,capacity,original:capacity},r={to:from,rev:graph[from].length,capacity:0,original:0};graph[from].push(f);graph[to].push(r);return f;}
    families.forEach((f,i)=>add(source,familyStart+i,Number(targets[f]||0)));
    families.forEach((f,fi)=>POSITIONS.forEach((p,pi)=>edges.set(`${f}|${p}`,add(familyStart+fi,positionStart+pi,Math.min(Number(targets[f]||0),pools.get(f)?.[p]?.length||0)))));
    POSITIONS.forEach((p,i)=>add(positionStart+i,sink,Number(needs[p]||0)));
    let flow=0;
    while(true){const pn=new Int32Array(graph.length).fill(-1),pe=new Int32Array(graph.length).fill(-1),q=[source];pn[source]=source;for(let qi=0;qi<q.length&&pn[sink]===-1;qi+=1){const node=q[qi];for(let ei=0;ei<graph[node].length;ei+=1){const edge=graph[node][ei];if(edge.capacity<=0||pn[edge.to]!==-1)continue;pn[edge.to]=node;pe[edge.to]=ei;q.push(edge.to);if(edge.to===sink)break;}}if(pn[sink]===-1)break;let amount=Infinity;for(let node=sink;node!==source;node=pn[node])amount=Math.min(amount,graph[pn[node]][pe[node]].capacity);for(let node=sink;node!==source;node=pn[node]){const edge=graph[pn[node]][pe[node]];edge.capacity-=amount;graph[node][edge.rev].capacity+=amount;}flow+=amount;}
    if(flow!==WEEKLY)return null;
    const result=Object.fromEntries(families.map(f=>[f,Object.fromEntries(POSITIONS.map(p=>[p,0]))]));
    for(const f of families)for(const p of POSITIONS){const e=edges.get(`${f}|${p}`);result[f][p]=e?e.original-e.capacity:0;}
    return result;
  }

  function semanticPrompt(record, position, evaluation, semantic) {
    return { id:record.position === "ANY" ? `${record.id}__${position.toLowerCase()}` : record.id, sourcePromptId:record.id,
      position, family:record.family, label:record.label, variantGroup:record.variantGroup,
      semanticDiversity:semantic.fromRecord(record, position, record.label), bestAnswer:evaluation.bestAnswer };
  }

  function isAntiMeta(record) {
    if (ANTI_META_FAMILIES.has(record.family)) return true;
    return (record.conditions || []).some(condition => condition.operator === "lte" && ["points","goals","assists","goalInvolvements","startingPrice"].includes(condition.field));
  }

  async function buildReservoir(records, formation, evaluate, semantic) {
    const index = familyIndex(records), targets = allocateFamilyTargets(index);
    if (!targets || Object.values(targets).reduce((a,b)=>a+b,0)!==WEEKLY) throw new Error("Family targets do not sum to 77.");
    const needs = Object.fromEntries(POSITIONS.map(p => [p, Number(formation[p]||0)*DAYS]));
    const families = Object.keys(targets).filter(f => targets[f] > 0);
    const byFamily = new Map(families.map(f => [f, records.filter(record => record.family===f)]));
    const recordById = new Map(records.map(record => [record.id, record]));
    let best = null;
    for(let offset=0;offset<POSITIONS.length;offset+=1){
      const pools=new Map(); let checked=0;
      for(const family of families){
        const ordered=interleaveSemanticGroups(byFamily.get(family)||[],semantic), assigned=assignAnyRecords(ordered,needs,offset);
        const certified=Object.fromEntries(POSITIONS.map(p=>[p,[]]));
        for(const position of POSITIONS){
          const need=Math.min(targets[family],needs[position]), extra=Math.max(24,Math.ceil(need*3)), limit=Math.min(assigned[position].length,need+extra);
          for(const record of assigned[position]){
            if(certified[position].length>=limit)break;
            const ev=evaluate(record,position); checked+=1;
            const stored=Number(record.qualityEvidence?.answerPlayers||0);
            const consistent=record.position==="ANY" ? ev.count>0&&ev.count<=stored : ev.count===stored;
            if(consistent&&ev.count>=MIN_ANSWERS&&ev.count<=MAX_ANSWERS) certified[position].push({record,prompt:semanticPrompt(record,position,ev,semantic)});
          }
        }
        pools.set(family,certified);
      }
      const allocation=solveFlow(families,targets,needs,pools); if(!allocation)continue;
      const groups=[];
      for(const family of families)for(const position of POSITIONS){const required=allocation[family][position];if(!required)continue;const available=pools.get(family)?.[position]||[];const leaders=new Set(available.map(x=>x.prompt.bestAnswer?.playerId).filter(Boolean)).size;groups.push({family,position,required,available,leaderSlack:leaders-required});}
      groups.sort((a,b)=>a.leaderSlack-b.leaderSlack||a.available.length-b.available.length||a.family.localeCompare(b.family)||POSITIONS.indexOf(a.position)-POSITIONS.indexOf(b.position));
      const prompts=[], sourceIds=new Set(), semanticCounts=new Map(), leaderCounts=new Map(); let collision=false;
      for(const group of groups){let added=0;while(added<group.required){const choices=group.available.filter(c=>!sourceIds.has(c.record.id)&&semantic.canAddWeekly(c.prompt,semanticCounts,DAYS)).sort((a,b)=>{const al=a.prompt.bestAnswer?.playerId||"",bl=b.prompt.bestAnswer?.playerId||"";return Number(leaderCounts.get(al)||0)-Number(leaderCounts.get(bl)||0)||semantic.weeklyLoad(a.prompt,semanticCounts)-semantic.weeklyLoad(b.prompt,semanticCounts)||recordQualityCompare(a.record,b.record);});const c=choices[0];if(!c)break;prompts.push(c.prompt);sourceIds.add(c.record.id);semantic.commitWeekly(c.prompt,semanticCounts);const leader=c.prompt.bestAnswer?.playerId;if(leader)leaderCounts.set(leader,Number(leaderCounts.get(leader)||0)+1);added+=1;}if(added!==group.required){collision=true;break;}}
      if(collision||prompts.length!==WEEKLY||sourceIds.size!==WEEKLY)continue;
      const familyCounts={},positionCounts={};let nationality=0,antiMeta=0;
      for(const prompt of prompts){familyCounts[prompt.family]=(familyCounts[prompt.family]||0)+1;positionCounts[prompt.position]=(positionCounts[prompt.position]||0)+1;if(prompt.family==="nationality")nationality+=1;const record=recordById.get(prompt.sourcePromptId);if(record&&isAntiMeta(record))antiMeta+=1;}
      if(families.some(f=>familyCounts[f]!==targets[f])||POSITIONS.some(p=>positionCounts[p]!==needs[p])||nationality!==NATIONALITY_TARGET||antiMeta<MIN_ANTI_META_PER_DAY*DAYS)continue;
      const repeatSlots=[...leaderCounts.values()].reduce((sum,v)=>sum+Math.max(0,v-1),0);
      const candidate={prompts,targets,needs,checked,repeatSlots,uniqueLeaders:leaderCounts.size,antiMeta,nationality,semanticCounts,offset};
      if(!best||candidate.repeatSlots<best.repeatSlots||(candidate.repeatSlots===best.repeatSlots&&candidate.uniqueLeaders>best.uniqueLeaders))best=candidate;
      if(candidate.repeatSlots===0)break;
      await tick();
    }
    if(!best)throw new Error("Curated pool could not produce a 77-prompt shadow reservoir for this formation.");
    return best;
  }

  function layoutWeek(prompts, formation, semantic) {
    const keyFreq=new Map();for(const prompt of prompts)for(const key of semantic.hardKeys(prompt))keyFreq.set(key,Number(keyFreq.get(key)||0)+1);
    const ordered=[...prompts].sort((a,b)=>{const as=semantic.hardKeys(a).reduce((s,k)=>s+Number(keyFreq.get(k)||0),0),bs=semantic.hardKeys(b).reduce((s,k)=>s+Number(keyFreq.get(k)||0),0);return bs-as||semantic.hardKeys(b).length-semantic.hardKeys(a).length||String(a.id).localeCompare(String(b.id));});
    for(let attempt=0;attempt<128;attempt+=1){
      const days=Array.from({length:DAYS},()=>({prompts:[],keys:new Set(),counts:{GK:0,DEF:0,MID:0,FWD:0}}));let ok=true;
      const rotated=ordered.map((_,i)=>ordered[(i+attempt)%ordered.length]);
      for(const prompt of rotated){const keys=semantic.hardKeys(prompt);const options=days.map((day,index)=>({day,index,load:day.prompts.length})).filter(x=>x.day.counts[prompt.position]<formation[prompt.position]&&keys.every(k=>!x.day.keys.has(k))).sort((a,b)=>a.load-b.load||a.index-b.index);const chosen=options[0];if(!chosen){ok=false;break;}chosen.day.prompts.push(prompt);chosen.day.counts[prompt.position]+=1;for(const key of keys)chosen.day.keys.add(key);}
      if(ok&&days.every(day=>day.prompts.length===11&&POSITIONS.every(p=>day.counts[p]===formation[p])&&semantic.dayIssues(day.prompts).length===0))return {ok:true,attempt:attempt+1,days};
    }
    return {ok:false,attempt:128,days:[]};
  }

  async function runRegression() {
    runButton.disabled=true; downloadButton.disabled=true; lastReport=null;
    try {
      status("Reading the saved promoted snapshot and verifying the frozen selector package…");
      const curatedApi=window.FPL_PROMPT_CURATED_PACKAGE_V1, semantic=window.FPL_DAILY_SEMANTIC_DIVERSITY;
      if(!curatedApi?.ready)throw new Error("Curated package API did not load.");
      if(!semantic?.canAddWeekly)throw new Error("Daily semantic-diversity policy did not load.");
      const payload=await curatedApi.runSavedPackage();
      if(payload.source?.promotionFingerprint!==EXPECTED_SOURCE||payload.manifest?.total!==EXPECTED_SELECTED)throw new Error("Materialised curated package does not match the frozen source/count.");
      const records=payload.shards.flatMap(shard=>shard.records);
      const rowsByPosition=buildRows(), evaluate=evaluator(rowsByPosition);
      status(`Runtime-revalidating ${records.length.toLocaleString("en-GB")} frozen survivors against ${rowsByPosition.ANY.length.toLocaleString("en-GB")} positive-minute player-seasons…`);
      const mismatches=[];let index=0;
      for(const record of records){const ev=evaluate(record,record.position);const stored=Number(record.qualityEvidence?.answerPlayers||0);if(ev.count!==stored&&mismatches.length<25)mismatches.push({id:record.id,family:record.family,position:record.position,stored,recomputed:ev.count});index+=1;if(index%250===0){status(`Runtime-revalidating survivors · ${index.toLocaleString("en-GB")}/${records.length.toLocaleString("en-GB")}…`);await tick();}}
      if(mismatches.length)throw new Error(`${mismatches.length} runtime answer-count mismatch sample(s) found; first: ${mismatches[0].id} stored ${mismatches[0].stored}, recomputed ${mismatches[0].recomputed}.`);
      const formations=[];
      for(const [name,formation] of Object.entries(FORMATIONS)){status(`Shadow-building 77-prompt reservoir · ${name}…`);const reservoir=await buildReservoir(records,formation,evaluate,semantic);const layout=layoutWeek(reservoir.prompts,formation,semantic);if(!layout.ok)throw new Error(`${name} reservoir passed weekly selection but could not be laid out into seven clash-free 11-prompt days.`);formations.push({formation:name,pass:true,runtimeCandidatesChecked:reservoir.checked,offset:reservoir.offset,uniquePromptIds:new Set(reservoir.prompts.map(p=>p.sourcePromptId)).size,uniqueTopAnswerPlayers:reservoir.uniqueLeaders,topAnswerRepeatSlots:reservoir.repeatSlots,nationalityPrompts:reservoir.nationality,antiMetaPrompts:reservoir.antiMeta,layoutAttempts:layout.attempt,positionNeeds:reservoir.needs,familyTargets:reservoir.targets});await tick();}
      lastReport={schemaVersion:1,kind:"fpl-curated-daily-shadow-regression",version:VERSION,generatedAt:new Date().toISOString(),source:{promotionFingerprint:EXPECTED_SOURCE,sourcePrompts:134765,curatedPrompts:EXPECTED_SELECTED,survivorIdSha256:payload.freeze?.survivorIdSha256||""},population:{players:(window.FPL_PLAYERS||[]).length,positiveMinutePlayerSeasons:rowsByPosition.ANY.length},runtimeValidation:{promptsChecked:records.length,answerCountMismatches:0},settings:{days:DAYS,promptsPerDay:11,weeklyPrompts:WEEKLY,minAnswers:MIN_ANSWERS,maxAnswers:MAX_ANSWERS,nationalityWeeklyTarget:NATIONALITY_TARGET,minAntiMetaPerDay:MIN_ANTI_META_PER_DAY,semanticWeeklyCap:DAYS},formations,authority:{dailyAuthorityChanged:false,publishingCalled:false,savedShardsChanged:false,supabaseCalled:false},result:"PASS"};
      status(`PASS — ${records.length.toLocaleString("en-GB")} survivors runtime-revalidated and all ${formations.length} formations produced a unique, balanced, clash-free 77-prompt shadow week.`,"pass");downloadButton.disabled=false;window.dispatchEvent(new CustomEvent("fpl:curated-shadow-regression-pass",{detail:lastReport}));return lastReport;
    }catch(error){lastReport={schemaVersion:1,kind:"fpl-curated-daily-shadow-regression",version:VERSION,generatedAt:new Date().toISOString(),result:"FAIL",error:String(error?.message||error),authority:{dailyAuthorityChanged:false,publishingCalled:false,savedShardsChanged:false,supabaseCalled:false}};status(`FAIL — ${lastReport.error}`,"fail");downloadButton.disabled=false;throw error;}finally{runButton.disabled=false;}
  }

  function download(){if(!lastReport)return;const blob=new Blob([JSON.stringify(lastReport,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`fpl-curated-daily-shadow-regression-${lastReport.result.toLowerCase()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),0);}

  runButton?.addEventListener("click",()=>runRegression().catch(()=>{}));
  downloadButton?.addEventListener("click",download);
  window.FPL_CURATED_DAILY_SHADOW_REGRESSION=Object.freeze({version:VERSION,run:runRegression,getLastReport:()=>lastReport});
})();
