import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/admin-daily-library-cutover-v1.js', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const families = [
  'season-stats', 'position-stat', 'exact-stats', 'combined-stats', 'club-stat',
  'league-position', 'promoted-clubs', 'relegated-clubs', 'champions', 'nationality',
  'career-longevity', 'club-count', 'manager', 'anti-meta', 'exclude-top-result',
  'value', 'minutes-role', 'composite-story'
];

const shards = families.map((family, index) => {
  const isExclude = family === 'exclude-top-result';
  return {
    family,
    path: `prompt-library-shards/${family}.json`,
    count: 1,
    records: [{
      schemaVersion: 1,
      id: `test-${family}`,
      label: isExclude ? 'Midfielder with at least 100 FPL points — excluding One Player' : index === 0 ? 'Player with at least 10 FPL points' : `${family} test prompt`,
      position: isExclude ? 'MID' : index === 0 ? 'ANY' : 'GK',
      family,
      conditions: isExclude ? [{ field:'points', operator:'gte', value:100 }, { field:'playerId', operator:'notEquals', value:'p1' }] : [{ field:'points', operator:'gte', value:10 }],
      variantGroup: `vg-${family}`,
      qualityStatus: 'pass',
      qualityScore: 90,
      difficulty: 'medium',
      qualityEvidence: { answerPlayers: 3, seasons: 2, clubs: 2, coverage: 100, variantGroupSize: 1 },
      tags: [`family:${family}`],
      enabled: true,
      source: 'prompt-promotion-v1'
    }]
  };
});

const payload = {
  manifest: { schemaVersion:2, version:'2.0.0', savedAt:new Date().toISOString(), promotionVersion:'1.0.0', promotionFingerprint:'promotion_test_18', total:18, families:18, variantGroups:18, qualityPass:18, qualityReview:0 },
  shards
};

const documentStub = { readyState:'complete', getElementById(){return null;}, addEventListener(){}, documentElement:{dataset:{}} };
const sandbox = { window:{}, document:documentStub, console, CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}, setTimeout, clearTimeout, Promise, Map, Set, Object, Array, Number, String, Date, JSON, Math };
sandbox.window = {
  document:documentStub,
  addEventListener(){},
  dispatchEvent(){return true;},
  FPL_PROMPT_LIBRARY_SHARDS_V1:{ ready:true, async buildRepositoryPackage(){return payload;}, render(){} },
  FPL_CAREER_EVOLUTION_CONTEXT:{ nationalityForPlayer(){return 'France';} }
};
sandbox.window.window = sandbox.window;

vm.runInNewContext(source, sandbox, { filename:'admin-daily-library-cutover-v1.js' });
await new Promise(resolve => setTimeout(resolve, 25));

const api = sandbox.window.FPL_DAILY_LIBRARY_CUTOVER_V1;
assert(api?.ready === true, 'Daily library cutover API did not initialise.');
assert(api.version === '1.1.0', 'Daily library cutover version mismatch.');
assert(api.expectedFamilies.length === 18, 'Daily library cutover must require all 18 curated families.');
assert(api.expectedFamilies.includes('exclude-top-result'), 'Exclude Top Result is missing from the Daily family boundary.');

const state = api.getState();
assert(state.ready === true, `Expected the 18-family fixture to certify: ${state.reason}`);
assert(state.total === 18, 'Certified compact record total is incorrect.');
assert(state.families === 18, 'Certified family count is incorrect.');
assert(state.invalid === 0 && state.duplicates === 0, 'Valid fixture produced structural errors.');
assert(state.familyIndex.find(item => item.family === 'season-stats')?.compatible?.MID === 1, 'ANY prompt compatibility was not indexed for MID.');
assert(state.familyIndex.find(item => item.family === 'exclude-top-result')?.compatible?.MID === 1, 'Exclude Top Result MID prompt was not indexed.');

const hydrated = api.materialiseRecord('test-season-stats', 'MID');
assert(hydrated?.id === 'test-season-stats__mid', 'ANY prompt did not receive a position-specific Daily ID.');
assert(hydrated?.position === 'MID', 'ANY prompt did not hydrate to the requested position.');
assert(hydrated?.label.startsWith('Midfielder'), 'ANY prompt wording was not adapted to its Daily position.');
assert(typeof hydrated?.test === 'function', 'Hydrated prompt has no executable test function.');
assert(hydrated.test({ points:20, _career:{playerId:'p2'} }) === true, 'Hydrated numeric condition did not pass a valid record.');
assert(hydrated.test({ points:5, _career:{playerId:'p2'} }) === false, 'Hydrated numeric condition accepted an invalid record.');
assert(hydrated.test.toString().includes('conditions.every'), 'Hydrated test function is not self-contained for challenge export.');

const excluded = api.materialiseRecord('test-exclude-top-result');
assert(excluded?.family === 'exclude-top-result', 'Exclude Top Result did not hydrate.');
assert(excluded.test({ points:120, _career:{playerId:'p2'} }) === true, 'Non-excluded qualifying player was rejected.');
assert(excluded.test({ points:120, _career:{playerId:'p1'} }) === false, 'Excluded top player was still accepted.');
assert(excluded.test({ points:90, _career:{playerId:'p2'} }) === false, 'Below-threshold player was accepted by exclusion prompt.');
assert(excluded.test.toString().includes('notEquals'), 'Hydrated exclusion test lost the notEquals rule.');

const nationalityTest = api.compileConditions([{ field:'nationality', operator:'eqText', value:'France' }]);
assert(nationalityTest({ _career:{playerId:1} }) === true, 'Hydrated nationality rule did not use career nationality context.');
assert(source.includes('state.recordsById'), 'Cutover boundary does not retain the compact certified index.');
assert(source.includes('materialiseFamily'), 'Lazy family materialisation API is missing.');
assert(source.includes('"playerId"'), 'Cutover boundary does not allow playerId conditions.');
assert(source.includes('"notEquals"'), 'Cutover boundary does not allow exclusion conditions.');
assert(!source.includes('historyPanel'), 'Retired visible History panel residue remains in the Daily cutover runtime.');
assert(!source.includes('window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL ='), 'Cutover boundary must not replace production authority itself.');
assert(!source.includes('window.FPL_DAILY_GENERATION_PROMPT_POOL ='), 'Cutover boundary must not silently activate Daily generation.');

console.log('Daily library cutover v1.1 smoke test passed: 18-family compact certification, playerId:notEquals exclusion execution, lazy hydration and production boundary preserved.');
