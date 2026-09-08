import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-curation-evidence-v1.js', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sandbox = { window: {}, console, setTimeout, clearTimeout };
vm.runInNewContext(source, sandbox, { filename: 'prompt-curation-evidence-v1.js' });
const api = sandbox.window.FPL_PROMPT_CURATION_EVIDENCE_V1;
assert(api?.ready === true, 'Evidence API did not initialise.');
assert(api.version === '1.0.0', 'Evidence version mismatch.');

const players = [
  { playerId:'p1', bio:{ nationality:'England' }, seasons:[{ season:'2024/25', club:'A', position:'MID', minutes:2000, points:100, goals:10, assists:5 }] },
  { playerId:'p2', bio:{ nationality:'England' }, seasons:[{ season:'2024/25', club:'A', position:'MID', minutes:1500, points:90, goals:10, assists:2 }] },
  { playerId:'p3', bio:{ nationality:'Brazil' }, seasons:[{ season:'2024/25', club:'B', position:'MID', minutes:1800, points:70, goals:5, assists:5 }] },
  { playerId:'p4', bio:{ nationality:'France' }, seasons:[{ season:'2024/25', club:'C', position:'FWD', minutes:2200, points:150, goals:15, assists:4 }] },
  { playerId:'p5', bio:{ nationality:'Ireland' }, seasons:[
    { season:'2023/24', club:'D', position:'MID', minutes:1300, points:100, goals:0, assists:0 },
    { season:'2024/25', club:'D', position:'MID', minutes:1200, points:20, goals:10, assists:0 }
  ] }
];

const make = (id, group, conditions, answers) => ({
  id, family:'combined-stats', variantGroup:group, position:'MID', conditions,
  qualityEvidence:{ answerPlayers:answers }
});
const records = [
  make('a','vg1',[{field:'points',operator:'gte',value:80},{field:'goals',operator:'gte',value:10}],2),
  make('b','vg1',[{field:'points',operator:'gte',value:90},{field:'goals',operator:'gte',value:10}],2),
  make('c','vg1',[{field:'points',operator:'gte',value:95},{field:'goals',operator:'gte',value:10}],1),
  make('d','vg2',[{field:'points',operator:'gte',value:80},{field:'assists',operator:'gte',value:5}],1),
  make('e','vg3',[{field:'minutes',operator:'gte',value:500},{field:'goals',operator:'gte',value:10}],3)
];
const payload = {
  kind:'fpl-prompt-library-family-shards',
  manifest:{ total:records.length, families:1, variantGroups:3, promotionFingerprint:'fixture', savedAt:'2026-09-08T00:00:00Z' },
  shards:[{ family:'combined-stats', count:records.length, records }]
};

const output = await api.analysePackage(payload, { players, yieldEveryGroups:0 });
assert(output.kind === 'fpl-prompt-curation-evidence', 'Wrong evidence package kind.');
assert(output.source.total === 5 && output.source.variantGroups === 3, 'Source summary mismatch.');
assert(output.population.positiveMinuteRows === 6 && output.population.players === 5, 'Population summary mismatch.');
assert(output.summary.storedAnswerCountMismatches === 0, 'Stored answer counts should reconcile.');
assert(output.summary.promptsWithDecorativeCondition === 1, 'Exactly one fixture should contain a decorative condition.');
const byId = new Map(output.evidenceShards.flatMap(shard => shard.records).map(item => [item.id, item]));
assert(byId.get('a').answerPlayers === 2, 'Prompt a answer count is wrong.');
assert(byId.get('a').conditionMarginality[0].withoutConditionPlayers === 3, 'Removing points from prompt a should add p5 via a different season.');
assert(byId.get('a').conditionMarginality[0].addedPlayers === 1, 'Prompt a points condition marginality is wrong.');
assert(byId.get('a').conditionMarginality[1].addedPlayers === 1, 'Prompt a goals condition marginality is wrong.');
assert(byId.get('a').exactEquivalentClassSize === 2 && byId.get('b').exactEquivalentClassSize === 2, 'Prompts a and b should be exact-equivalent within vg1.');
assert(byId.get('a').axisNeighbor?.id === 'b' && byId.get('a').axisNeighbor?.jaccard === 1, 'Prompt a should identify b as an identical nearest axis sibling.');
assert(byId.get('e').decorativeConditionCount === 1, 'Prompt e should expose one decorative condition.');
assert(byId.get('e').conditionMarginality[0].decorative === true, 'The minutes condition in prompt e should be decorative.');
assert(!source.includes('FPL_DAILY_GENERATION_PROMPT_POOL ='), 'Evidence engine must not write the Daily prompt pool.');
assert(!source.includes('FPL_DAILY_GENERATION_FAMILY_PLAN ='), 'Evidence engine must not write the Daily family plan.');
assert(source.includes('buildRepositoryPackage'), 'Evidence engine should read the durable saved shard package.');
console.log('Prompt curation evidence v1 verified: same-record answers, marginality, exact equivalence and axis-neighbour Jaccard all pass.');
