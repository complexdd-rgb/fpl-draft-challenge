import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-promotion-v1.js', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const makeCandidate = (id, family, status, group, score = 70) => ({
  id,
  label: `${id} label`,
  family,
  position: 'MID',
  conditions: [{ field:'startingPrice', operator:'lte', value:id.endsWith('a') ? 5 : 5.5 }],
  evidence: { answerPlayers:10, seasons:5, clubs:6, coverage:95, difficulty:'medium' },
  __meta: { status, variantGroup:group, variantGroupSize:2, score, reasons:[] }
});

const a = makeCandidate('brazil_price_a', 'nationality', 'pass', 'vg_mid_brazil_price');
const b = makeCandidate('brazil_price_b', 'nationality', 'review', 'vg_mid_brazil_price', 42);
const c = makeCandidate('value_pass', 'value', 'pass', 'vg_mid_value');
const d = makeCandidate('value_reject', 'value', 'rejected', 'vg_mid_value_bad', 0);

let results = {
  nationality: { survivors:2, criteria:{ minPlayers:2, maxPlayers:150, minCoverage:35 }, survivorCandidates:[a,b] },
  value: { survivors:2, criteria:{ minPlayers:2, maxPlayers:150, minCoverage:35 }, survivorCandidates:[c,d] }
};

const library = [];
const documentStub = {
  readyState:'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  createElement() { return { dataset:{}, set rel(value) {}, set href(value) {} }; },
  head:{ appendChild() {} },
  documentElement:{ dataset:{} }
};

const sandbox = {
  window: {
    FPL_PROMPT_LIBRARY:library,
    FPL_PROMPT_FACTORY_V1: {
      ready:true,
      version:'1.0.0',
      families:[
        { id:'nationality', label:'Nationality' },
        { id:'value', label:'Value' }
      ],
      getResults:() => results
    },
    FPL_PROMPT_QUALITY_ANALYSER_V1: {
      ready:true,
      version:'1.0.0',
      getSummary:() => ({ analysed:4, pass:2, review:1, rejected:1, variantGroups:3, families:2, analysedAt:'2026-09-05T21:00:00.000Z' }),
      getMeta:candidate => candidate.__meta ? { ...candidate.__meta, reasons:[] } : null
    },
    FPL_PROMPT_STUDIO_CLEAN:{ renderLibraryBrowser() {} },
    dispatchEvent() { return true; },
    addEventListener() {}
  },
  document:documentStub,
  console,
  CustomEvent:class CustomEvent { constructor(type, options={}) { this.type=type; this.detail=options.detail; } },
  MutationObserver:class MutationObserver { observe() {} },
  requestAnimationFrame() {},
  setTimeout() {},
  queueMicrotask
};
sandbox.window.window = sandbox.window;
sandbox.window.document = documentStub;

vm.runInNewContext(source, sandbox, { filename:'prompt-promotion-v1.js' });
const promotion = sandbox.window.FPL_PROMPT_PROMOTION_V1;
assert(promotion?.ready === true, 'Promotion API did not initialise.');
assert(promotion.version === '1.0.0', 'Promotion version mismatch.');

const audit = promotion.audit({ force:true });
assert(audit.currentMatch === true, 'Promotion did not verify matching Factory/Quality candidate identity.');
assert(audit.currentFactory === 4, `Expected 4 Factory survivors, got ${audit.currentFactory}.`);
assert(audit.currentAnalysed === 4, `Expected 4 current analysed survivors, got ${audit.currentAnalysed}.`);
assert(audit.pass === 2 && audit.review === 1 && audit.rejected === 1, 'Promotion family/status totals are wrong.');
assert(audit.promotable === 3, 'Promotion maximum-library total should include Pass + Review.');
const shareTotal = audit.families.reduce((sum, row) => sum + row.share, 0);
assert(Math.abs(shareTotal - 100) < 0.001, `Family shares should sum to 100%, got ${shareTotal}.`);

const promoted = promotion.promote();
assert(promoted?.total === 3, 'Promotion should install 3 kept prompts.');
assert(library.length === 3, `Canonical session library should contain 3 prompts, got ${library.length}.`);
assert(library.some(item => item.qualityStatus === 'review'), 'Review · kept candidate was not promoted under maximum-library policy.');
assert(!library.some(item => item.id === 'value_reject'), 'Rejected candidate entered the canonical library.');
assert(library.filter(item => item.variantGroup === 'vg_mid_brazil_price').length === 2, 'Close variants did not preserve their shared variant group.');
assert(library.every(item => item.source === 'prompt-promotion-v1' && item.enabled === true), 'Promoted records are missing canonical promotion metadata.');

// Prove stale-run protection even when counts and IDs happen to look the same: new Factory objects
// have no Quality Analyser WeakMap/meta evidence and therefore must fail the identity reconciliation.
results = {
  nationality: { survivors:2, criteria:{ minPlayers:2, maxPlayers:150, minCoverage:35 }, survivorCandidates:[{...a},{...b}] },
  value: { survivors:2, criteria:{ minPlayers:2, maxPlayers:150, minCoverage:35 }, survivorCandidates:[{...c},{...d}] }
};
for (const result of Object.values(results)) for (const candidate of result.survivorCandidates) delete candidate.__meta;
const staleAudit = promotion.audit({ force:true });
assert(staleAudit.currentFactory === 4, 'Stale-run test should preserve the same Factory count.');
assert(staleAudit.currentMatch === false, 'Promotion failed to block a rerun with new candidate identity but the same counts.');
assert(staleAudit.currentAnalysed === 0, 'New Factory candidate objects should have no current Quality evidence.');

console.log('Prompt Promotion v1 behavioural smoke test passed: source identity reconciliation, family shares, Pass+Review promotion and stale-run blocking verified.');
