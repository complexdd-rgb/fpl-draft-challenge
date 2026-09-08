import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const shadow = read('js/curated-shadow-regression-v1.js');
const html = read('curated-shadow-regression.html');
const manifest = JSON.parse(read('prompt-library-curated-v1/manifest.json'));

for (const token of [
  'EXPECTED_SOURCE = "shards_134765_1pkuiu3"',
  'EXPECTED_SELECTED = 4897',
  'const WEEKLY = 77',
  'const NATIONALITY_TARGET = 7',
  'const MIN_ANSWERS = 6',
  'const MAX_ANSWERS = 100',
  'const MIN_ANTI_META_PER_DAY = 5',
  '"4-4-2"', '"4-3-3"', '"3-4-3"', '"3-5-2"', '"5-3-2"', '"5-4-1"', '"4-2-3-1"',
  'curatedApi.runSavedPackage()',
  'ev.count!==stored',
  'buildReservoir(records,formation,evaluate,semantic)',
  'layoutWeek(reservoir.prompts,formation,semantic)',
  'semantic.canAddWeekly',
  'semantic.dayIssues',
  'answerCountMismatches:0',
  'dailyAuthorityChanged:false',
  'publishingCalled:false',
  'savedShardsChanged:false',
  'supabaseCalled:false'
]) assert(shadow.includes(token), `Curated shadow harness is missing required invariant: ${token}`);

for (const forbidden of [
  'FPL_DAILY_GENERATION_PROMPT_POOL =',
  'FPL_DAILY_GENERATION_FAMILY_PLAN =',
  'persistSnapshot(',
  'saveCurrentPromotion(',
  'supabase.functions',
  'daily-challenge-publish'
]) assert(!shadow.includes(forbidden), `Curated shadow harness contains a forbidden authority/write path: ${forbidden}`);

for (const token of [
  '<script src="players.js"></script>',
  'js/prompt-library-shards-v1.js?v=1.1.0',
  'js/prompt-curation-curated-package-v1.js?v=1.0.0',
  'js/daily-semantic-diversity-v1.js?v=1.0.0',
  'js/curated-shadow-regression-v1.js?v=1.0.0',
  'Run full shadow regression',
  'does not publish, alter saved shards, change Daily generation authority or call Supabase'
]) assert(html.includes(token), `Curated shadow page is missing required token: ${token}`);
assert(!html.includes('admin-daily-publish.js'), 'Shadow page must not load Daily publishing.');
assert(!html.includes('leaderboard-config.js'), 'Shadow page must not load leaderboard/Supabase configuration.');
assert(!html.includes('admin-daily-generator-guard.js'), 'Shadow page must not install the production generator guard.');

assert(manifest.selected === 4897 && manifest.families === 17, 'Curated selector manifest no longer describes 4,897 survivors / 17 families.');
const familyRows = [];
for (const descriptor of manifest.familySelectors || []) {
  const selector = JSON.parse(read(descriptor.path));
  const counts = { ANY:0, GK:0, DEF:0, MID:0, FWD:0 };
  for (const [bucket, ids] of Object.entries(selector.positions || {})) {
    const position = bucket === 'any' ? 'ANY' : bucket.toUpperCase();
    counts[position] = Array.isArray(ids) ? ids.length : 0;
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  assert(total === descriptor.count, `Selector position buckets do not reconcile for ${descriptor.family}.`);
  familyRows.push({ family:descriptor.family, total, counts });
}

function allocateFamilyTargets(rows) {
  const targets = Object.fromEntries(rows.map(row => [row.family, 0]));
  targets.nationality = 7;
  const others = rows.filter(row => row.family !== 'nationality');
  let remaining = 77 - 7;
  for (const row of others) { targets[row.family] = 1; remaining -= 1; }
  const weightTotal = others.reduce((sum,row) => sum + row.total, 0);
  const remainders=[]; let allocated=0;
  for (const row of others) {
    const raw = remaining * row.total / weightTotal;
    const floor = Math.floor(raw); targets[row.family] += floor; allocated += floor;
    remainders.push({ family:row.family, remainder:raw-floor, weight:row.total });
  }
  remainders.sort((a,b)=>b.remainder-a.remainder||b.weight-a.weight||a.family.localeCompare(b.family));
  for (let i=0;i<remaining-allocated;i+=1) targets[remainders[i % remainders.length].family] += 1;
  return targets;
}

function flowCapacity(targets, needs) {
  const families=familyRows.map(row=>row.family), positions=['GK','DEF','MID','FWD'];
  const source=0,fStart=1,pStart=fStart+families.length,sink=pStart+positions.length;
  const graph=Array.from({length:sink+1},()=>[]);
  function add(u,v,c){const f={to:v,rev:graph[v].length,cap:c},r={to:u,rev:graph[u].length,cap:0};graph[u].push(f);graph[v].push(r);}
  families.forEach((family,i)=>add(source,fStart+i,targets[family]||0));
  families.forEach((family,fi)=>{const row=familyRows.find(item=>item.family===family);for(let pi=0;pi<positions.length;pi+=1){const pos=positions[pi];const compatible=(row.counts[pos]||0)+(row.counts.ANY||0);add(fStart+fi,pStart+pi,Math.min(targets[family]||0,compatible));}});
  positions.forEach((pos,i)=>add(pStart+i,sink,needs[pos]||0));
  let flow=0;
  while(true){const parent=Array(graph.length).fill(null),edgeIndex=Array(graph.length).fill(-1),queue=[source];parent[source]=source;for(let qi=0;qi<queue.length&&parent[sink]==null;qi+=1){const u=queue[qi];for(let ei=0;ei<graph[u].length;ei+=1){const e=graph[u][ei];if(e.cap<=0||parent[e.to]!=null)continue;parent[e.to]=u;edgeIndex[e.to]=ei;queue.push(e.to);if(e.to===sink)break;}}if(parent[sink]==null)break;let amount=Infinity;for(let v=sink;v!==source;v=parent[v])amount=Math.min(amount,graph[parent[v]][edgeIndex[v]].cap);for(let v=sink;v!==source;v=parent[v]){const e=graph[parent[v]][edgeIndex[v]];e.cap-=amount;graph[v][e.rev].cap+=amount;}flow+=amount;}
  return flow;
}

const targets = allocateFamilyTargets(familyRows);
assert(Object.values(targets).reduce((sum,value)=>sum+value,0) === 77, 'Curated family allocation no longer sums to 77.');
assert(targets.nationality === 7, 'Curated shadow structural allocation lost the nationality target.');
const formations = {
  '4-4-2':{GK:7,DEF:28,MID:28,FWD:14}, '4-3-3':{GK:7,DEF:28,MID:21,FWD:21},
  '3-4-3':{GK:7,DEF:21,MID:28,FWD:21}, '3-5-2':{GK:7,DEF:21,MID:35,FWD:14},
  '5-3-2':{GK:7,DEF:35,MID:21,FWD:14}, '5-4-1':{GK:7,DEF:35,MID:28,FWD:7},
  '4-2-3-1':{GK:7,DEF:28,MID:35,FWD:7}
};
for (const [name, needs] of Object.entries(formations)) {
  assert(flowCapacity(targets, needs) === 77, `Curated selector structure cannot fill the ${name} weekly formation flow.`);
}

console.log('Curated Daily shadow harness verified: exact 4,897 selector structure can fill all seven formations, runtime evaluator/reservoir/day-layout checks are present, and no Daily/publish/Supabase authority path is loaded.');
