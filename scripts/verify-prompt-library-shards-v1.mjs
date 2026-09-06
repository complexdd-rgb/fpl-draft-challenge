import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-library-shards-v1.js', 'utf8');
const bridge = fs.readFileSync('js/prompt-library-shards-promotion-bridge-v1.js', 'utf8');
const css = fs.readFileSync('admin-prompt-library-shards-v1.css', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(!fs.existsSync('js/prompt-library-shards-v1-1.js'), 'Duplicate Prompt Library Shards runtime must not exist.');

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
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
  Intl,
  Date
};
sandbox.window.window = sandbox.window;
sandbox.window.document = documentStub;
sandbox.window.addEventListener = () => {};
sandbox.window.dispatchEvent = () => true;

vm.runInNewContext(source, sandbox, { filename:'prompt-library-shards-v1.js' });
const shards = sandbox.window.FPL_PROMPT_LIBRARY_SHARDS_V1;
assert(shards?.ready === true, 'Prompt Library Shards API did not initialise.');
assert(shards.version === '1.1.0', 'Prompt Library Shards version mismatch.');

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
assert(source.includes('getAll()'), 'Hardened shard restore does not queue family reads in one transaction.');
assert(source.includes('fpl:prompt-library-shards-restored'), 'Shard restore event is missing.');
assert(source.includes('buildRepositoryPackage'), 'Repository package builder is missing.');
assert(!source.includes('localStorage.setItem'), '100k+ shard persistence must not use localStorage.');
assert(bridge.includes('fpl:prompt-library-changed'), 'Promotion bridge does not listen to canonical-library changes.');
assert(bridge.includes('prompt-promotion-v1'), 'Promotion bridge does not restrict auto-save to verified Promotion output.');

assert(source.includes('promptLibraryDailyBalanceMount'), 'Daily Challenge saved-library balance mount is missing.');
assert(source.includes('17-family balance and rotation coverage'), 'Daily Challenge family-balance heading is missing.');
assert(source.includes('WEEKLY_PROMPT_SLOTS = 77'), 'Daily family share planning is not based on the seven-day 77-slot week.');
assert(source.includes('Future published schedule'), 'Daily view is missing spoiler-safe future schedule context.');
assert(source.includes('promptIds') && source.includes('FPL_CHALLENGE_MANIFEST'), 'Known used coverage is not grounded in challenge history.');
assert(source.includes('future Supabase prompt IDs and family details are deliberately not included'), 'Future scheduled prompts are not explicitly protected from the usage view.');
assert(!source.includes('FPL_DAILY_GENERATION_PROMPT_POOL ='), 'Shard storage must not itself take over Daily generation authority.');

assert(css.includes('Active saved promoted library'), 'Daily balance display does not show the saved library as the active Daily source.');
assert(css.includes('77-prompt reservoir is structurally and runtime verified'), 'Daily balance display does not explain the runtime verification boundary.');
assert(css.includes('SOURCE ACTIVE'), 'Daily balance display is missing the active-source chip.');

console.log('Prompt Library Shards v1.1.0 smoke test passed: durable shards plus Daily 17-family balance are present, with active generation authority explicitly delegated to the runtime-certified 77-prompt guard.');
