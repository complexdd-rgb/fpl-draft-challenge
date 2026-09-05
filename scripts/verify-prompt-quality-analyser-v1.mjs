import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-quality-analyser-v1.js', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const evidence = overrides => ({
  answerPlayers: 20,
  answerRecords: 35,
  seasons: 10,
  clubs: 10,
  nationalities: 4,
  knownRows: 500,
  eligibleRows: 500,
  coverage: 100,
  playable: true,
  survivor: true,
  difficulty: 'medium',
  score: 100,
  ...overrides
});

const brazilFive = {
  id: 'brazil_mid_price_5_points_100', family: 'nationality', position: 'MID',
  label: 'Midfielder with Brazil nationality and starting price £5.0m or less and at least 100 FPL points',
  conditions: [
    { field:'nationality', operator:'eqText', value:'Brazil' },
    { field:'startingPrice', operator:'lte', value:5 },
    { field:'points', operator:'gte', value:100 }
  ],
  evidence: evidence()
};

const brazilFiveFive = {
  id: 'brazil_mid_price_5_5_points_110', family: 'nationality', position: 'MID',
  label: 'Midfielder with Brazil nationality and starting price £5.5m or less and at least 110 FPL points',
  conditions: [
    { field:'nationality', operator:'eqText', value:'Brazil' },
    { field:'startingPrice', operator:'lte', value:5.5 },
    { field:'points', operator:'gte', value:110 }
  ],
  evidence: evidence({ answerPlayers:18 })
};

const exactDuplicate = {
  ...brazilFive,
  id: 'duplicate_elsewhere',
  family: 'value',
  label: brazilFive.label,
  conditions: brazilFive.conditions.map(item => ({ ...item })),
  evidence: evidence()
};

const thinButValid = {
  id: 'thin_valid_goals', family: 'season-stats', position: 'ANY',
  label: 'Player with at least 19 goals',
  conditions: [{ field:'goals', operator:'gte', value:19 }],
  evidence: evidence({ answerPlayers:2, answerRecords:2, seasons:1, clubs:1, nationalities:2, knownRows:35, eligibleRows:100, coverage:35 })
};

const results = {
  nationality: { survivors:2, survivorCandidates:[brazilFive, brazilFiveFive] },
  value: { survivors:1, survivorCandidates:[exactDuplicate] },
  'season-stats': { survivors:1, survivorCandidates:[thinButValid] }
};
const families = [
  { id:'nationality', label:'Nationality' },
  { id:'value', label:'Value' },
  { id:'season-stats', label:'Season stats' }
];
const canonical = [];
const documentStub = {
  readyState:'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  head:{ appendChild() {} },
  documentElement:{ dataset:{} }
};
const sandbox = {
  window: {
    FPL_PROMPT_LIBRARY:canonical,
    FPL_PROMPT_FACTORY_V1:{ ready:true, version:'1.0.0', families, getResults:() => results }
  },
  document:documentStub,
  console,
  CustomEvent:class CustomEvent { constructor(type, options={}) { this.type=type; this.detail=options.detail; } },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  queueMicrotask
};
sandbox.window.window = sandbox.window;
sandbox.window.document = documentStub;
sandbox.window.dispatchEvent = () => true;

vm.runInNewContext(source, sandbox, { filename:'prompt-quality-analyser-v1.js' });
const analyser = sandbox.window.FPL_PROMPT_QUALITY_ANALYSER_V1;
assert(analyser?.ready === true, 'Quality Analyser API did not initialise.');
assert(analyser.version === '1.0.0', 'Quality Analyser version mismatch.');

await analyser.analyseAll();
const summary = analyser.getSummary();
assert(summary.analysed === 4, `Expected 4 analysed candidates, found ${summary.analysed}.`);
assert(summary.pass === 2, `Expected both close Brazil price variants to pass, found ${summary.pass} passes.`);
assert(summary.review === 1, `Expected one thin-but-valid candidate to be retained for review, found ${summary.review}.`);
assert(summary.rejected === 1, `Expected only the exact duplicate to be rejected, found ${summary.rejected}.`);

const passes = analyser.getQualityCandidates();
assert(passes.length === 2, 'Automatic-pass pool should contain both close threshold variants.');
assert(passes.every(item => item.id !== exactDuplicate.id), 'Exact duplicate leaked into the pass pool.');
assert(passes[0].variantGroup === passes[1].variantGroup, 'Close £5.0m / £5.5m variants were not tagged into the same variant group.');
assert(passes[0].id !== passes[1].id, 'Close variants were incorrectly collapsed into one prompt.');

const retained = analyser.getQualityCandidates({ includeReview:true });
assert(retained.length === 3, 'Review candidate was not retained alongside automatic passes.');
assert(retained.some(item => item.id === thinButValid.id && item.qualityStatus === 'review'), 'Thin-but-valid prompt was not preserved in Review.');
assert(canonical.length === 0, 'Quality Analyser mutated the canonical prompt library.');

console.log(`Prompt Quality Analyser behavioural smoke test passed: ${summary.pass} close variants passed, ${summary.review} retained for review, ${summary.rejected} exact duplicate rejected, ${summary.variantGroups} variant groups.`);
