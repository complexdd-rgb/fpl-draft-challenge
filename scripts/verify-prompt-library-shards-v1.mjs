import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-library-shards-v1.js', 'utf8');
const bridge = fs.readFileSync('js/prompt-library-shards-promotion-bridge-v1.js', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const documentStub = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  documentElement: { dataset:{} }
};

const sandbox = {
  window: { FPL_PROMPT_LIBRARY:[] },
  document: documentStub,
  console,
  queueMicrotask,
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  MutationObserver: class MutationObserver { observe() {} },
  Blob: class Blob {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} }
};
sandbox.window.window = sandbox.window;
sandbox.window.document = documentStub;
sandbox.window.addEventListener = () => {};
sandbox.window.dispatchEvent = () => true;

vm.runInNewContext(source, sandbox, { filename:'prompt-library-shards-v1.js' });
const shards = sandbox.window.FPL_PROMPT_LIBRARY_SHARDS_V1;
assert(shards?.ready === true, 'Prompt Library Shards API did not initialise.');
assert(shards.version === '1.0.0', 'Prompt Library Shards version mismatch.');

const records = [
  { id:'value_brazil_5_0', family:'value', position:'MID', variantGroup:'vg_mid_price_brazil', qualityStatus:'pass' },
  { id:'value_brazil_5_5', family:'value', position:'MID', variantGroup:'vg_mid_price_brazil', qualityStatus:'review' },
  { id:'nation_france_def', family:'nationality', position:'DEF', variantGroup:'vg_def_france', qualityStatus:'pass' }
];
const snapshot = shards.createSnapshot(records, { version:'1.0.0', fingerprint:'promotion_test' });
assert(snapshot.manifest.total === 3, 'Snapshot total is incorrect.');
assert(snapshot.manifest.families === 2, 'Snapshot family count is incorrect.');
assert(snapshot.manifest.variantGroups === 2, 'Snapshot variant-group count is incorrect.');
assert(snapshot.manifest.qualityPass === 2, 'Snapshot pass count is incorrect.');
assert(snapshot.manifest.qualityReview === 1, 'Snapshot review count is incorrect.');
assert(snapshot.manifest.promotionFingerprint === 'promotion_test', 'Promotion fingerprint was not preserved.');

const valueShard = snapshot.shards.find(item => item.family === 'value');
assert(valueShard?.count === 2, 'Value shard did not preserve both close variants.');
assert(valueShard.records.some(item => item.id === 'value_brazil_5_0'), '£5.0m-style variant was lost.');
assert(valueShard.records.some(item => item.id === 'value_brazil_5_5'), '£5.5m-style variant was lost.');
assert(valueShard.path === 'prompt-library-shards/value.json', 'Value repository shard path is wrong.');
assert(snapshot.shards.find(item => item.family === 'nationality')?.path === 'prompt-library-shards/nationality.json', 'Nationality repository shard path is wrong.');

assert(source.includes('window.indexedDB.open'), 'Shard persistence does not use IndexedDB.');
assert(source.includes('fpl:prompt-library-shards-restored'), 'Shard restore event is missing.');
assert(source.includes('buildRepositoryPackage'), 'Repository package builder is missing.');
assert(!source.includes('localStorage.setItem'), '100k+ shard persistence must not use localStorage.');
assert(bridge.includes('fpl:prompt-library-changed'), 'Promotion bridge does not listen to canonical-library changes.');
assert(bridge.includes('prompt-promotion-v1'), 'Promotion bridge does not restrict auto-save to verified Promotion output.');

console.log('Prompt Library Shards v1 smoke test passed: close variants preserved, two family shards built, IndexedDB boundary present.');
