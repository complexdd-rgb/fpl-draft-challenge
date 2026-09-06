import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/admin-daily-library-cutover-v1.js', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const families = [
  'season-stats', 'position-stat', 'exact-stats', 'combined-stats', 'club-stat',
  'league-position', 'promoted-clubs', 'relegated-clubs', 'champions', 'nationality',
  'career-longevity', 'club-count', 'manager', 'anti-meta', 'value', 'minutes-role',
  'composite-story'
];

const shards = families.map((family, index) => ({
  family,
  path: `prompt-library-shards/${family}.json`,
  count: 1,
  records: [{
    schemaVersion: 1,
    id: `test-${family}`,
    label: index === 0 ? 'Player with at least 10 FPL points' : `${family} test prompt`,
    position: index === 0 ? 'ANY' : 'GK',
    family,
    conditions: [{ field: 'points', operator: 'gte', value: 10 }],
    variantGroup: `vg-${family}`,
    qualityStatus: 'pass',
    qualityScore: 90,
    difficulty: 'medium',
    qualityEvidence: { answerPlayers: 3, seasons: 2, clubs: 2, coverage: 100, variantGroupSize: 1 },
    tags: [`family:${family}`],
    enabled: true,
    source: 'prompt-promotion-v1'
  }]
}));

const payload = {
  manifest: {
    schemaVersion: 1,
    version: '1.1.0',
    savedAt: new Date().toISOString(),
    promotionVersion: '1.0.0',
    promotionFingerprint: 'promotion_test_17',
    total: 17,
    families: 17,
    variantGroups: 17,
    qualityPass: 17,
    qualityReview: 0
  },
  shards
};

const documentStub = {
  readyState: 'complete',
  getElementById() { return null; },
  addEventListener() {},
  documentElement: { dataset: {} }
};

const sandbox = {
  console,
  document: documentStub,
  CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  setTimeout,
  clearTimeout,
  Function,
  Promise,
  Map,
  Set,
  Object,
  Array,
  Number,
  String,
  Date,
  JSON,
  Math
};

sandbox.window = {
  document: documentStub,
  addEventListener() {},
  dispatchEvent() { return true; },
  FPL_PROMPT_LIBRARY_SHARDS_V1: {
    ready: true,
    async buildRepositoryPackage() { return payload; },
    render() {}
  },
  FPL_CAREER_EVOLUTION_CONTEXT: {
    nationalityForPlayer() { return 'France'; }
  }
};
sandbox.window.window = sandbox.window;

vm.runInNewContext(source, sandbox, { filename: 'admin-daily-library-cutover-v1.js' });
await new Promise(resolve => setTimeout(resolve, 25));

const api = sandbox.window.FPL_DAILY_LIBRARY_CUTOVER_V1;
assert(api?.ready === true, 'Daily library cutover API did not initialise.');
assert(api.version === '1.0.0', 'Daily library cutover version mismatch.');
assert(api.expectedFamilies.length === 17, 'Daily library cutover must require all 17 promoted families.');

const state = api.getState();
assert(state.ready === true, `Expected the 17-family fixture to certify: ${state.reason}`);
assert(state.total === 17, 'Certified compact record total is incorrect.');
assert(state.families === 17, 'Certified family count is incorrect.');
assert(state.invalid === 0 && state.duplicates === 0, 'Valid fixture produced structural errors.');
assert(state.familyIndex.find(item => item.family === 'season-stats')?.compatible?.MID === 1, 'ANY prompt compatibility was not indexed for MID.');

const hydrated = api.materialiseRecord('test-season-stats', 'MID');
assert(hydrated?.id === 'test-season-stats__mid', 'ANY prompt did not receive a position-specific Daily ID.');
assert(hydrated?.position === 'MID', 'ANY prompt did not hydrate to the requested position.');
assert(hydrated?.label.startsWith('Midfielder'), 'ANY prompt wording was not adapted to its Daily position.');
assert(typeof hydrated?.test === 'function', 'Hydrated prompt has no executable test function.');
assert(hydrated.test({ points: 20, _career: { playerId: 1 } }) === true, 'Hydrated numeric condition did not pass a valid record.');
assert(hydrated.test({ points: 5, _career: { playerId: 1 } }) === false, 'Hydrated numeric condition accepted an invalid record.');
assert(hydrated.test.toString().includes('conditions.every'), 'Hydrated test function is not self-contained for challenge export.');

const nationalityTest = api.compileConditions([{ field: 'nationality', operator: 'eqText', value: 'France' }]);
assert(nationalityTest({ _career: { playerId: 1 } }) === true, 'Hydrated nationality rule did not use career nationality context.');

assert(source.includes('state.recordsById'), 'Cutover boundary does not retain the compact certified index.');
assert(source.includes('materialiseFamily'), 'Lazy family materialisation API is missing.');
assert(source.includes('historyPanel'), 'Legacy History & cooldown panel retirement is missing.');
assert(!source.includes('window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL ='), 'Cutover boundary must not replace production authority yet.');
assert(!source.includes('window.FPL_DAILY_GENERATION_PROMPT_POOL ='), 'Cutover boundary must not silently activate Daily generation.');

console.log('Daily library cutover v1 smoke test passed: 17-family compact certification, lazy self-contained hydration, and production boundary preserved.');
