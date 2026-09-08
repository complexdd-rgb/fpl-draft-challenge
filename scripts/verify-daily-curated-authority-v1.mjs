import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const manifest = JSON.parse(read('prompt-library-curated-v1/manifest.json'));
const selectors = manifest.familySelectors.map(item => JSON.parse(read(item.path)));

function idsFor(selector) {
  const prefix = `factory_${String(selector.family).replaceAll('-', '_')}_`;
  return Object.entries(selector.positions || {}).flatMap(([position, suffixes]) =>
    (suffixes || []).map(suffix => `${prefix}${position}_${suffix}`)
  );
}

const allSelected = selectors.flatMap(idsFor);
assert(allSelected.length === 4897 && new Set(allSelected).size === 4897, 'Fixture does not reconstruct 4,897 exact survivor IDs.');

const groups = Array.from({ length:1307 }, (_, index) => `vg_${index}`);
let groupIndex = 0;
const sourceShards = selectors.map(selector => {
  const records = [];
  for (const [bucket, suffixes] of Object.entries(selector.positions || {})) {
    const position = bucket === 'any' ? 'ANY' : bucket.toUpperCase();
    const prefix = `factory_${selector.family.replaceAll('-', '_')}_${bucket}_`;
    for (const suffix of suffixes || []) {
      records.push({
        schemaVersion:1,
        id:`${prefix}${suffix}`,
        label:`Synthetic ${selector.family} ${suffix}`,
        family:selector.family,
        position,
        conditions:[{ field:'points', operator:'gte', value:10 }],
        variantGroup:groups[groupIndex++ % groups.length],
        qualityStatus:'pass',
        qualityScore:90,
        qualityEvidence:{ answerPlayers:20 },
        enabled:true
      });
    }
  }
  return { family:selector.family, count:records.length, records };
});
const sourcePackage = {
  kind:'fpl-prompt-library-family-shards',
  manifest:{
    schemaVersion:1,
    version:'1.0.0',
    savedAt:'2026-09-08T00:00:00.000Z',
    promotionVersion:'1.0.0',
    promotionFingerprint:'shards_134765_1pkuiu3',
    total:134765,
    families:17,
    variantGroups:2684,
    qualityPass:134765,
    qualityReview:0
  },
  shards:sourceShards
};

const listeners = new Map();
const window = {
  FPL_PROMPT_LIBRARY_SHARDS_V1:Object.freeze({
    ready:true,
    buildRepositoryPackage:async () => sourcePackage,
    getSavedManifest:() => ({ ...sourcePackage.manifest }),
    render() {}
  }),
  addEventListener(type, handler) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(handler);
  },
  dispatchEvent(event) {
    for (const handler of [...(listeners.get(event?.type) || [])]) handler(event);
  }
};
window.window = window;

const fetch = async input => {
  const url = new URL(String(input));
  const path = url.pathname.replace(/^\//, '');
  if (!fs.existsSync(path)) return { ok:false, status:404, text:async () => '' };
  return { ok:true, status:200, text:async () => read(path) };
};

const sandbox = {
  window,
  globalThis:null,
  document:{ baseURI:'https://example.invalid/' },
  console,
  fetch,
  crypto:crypto.webcrypto,
  TextEncoder,
  URL,
  CustomEvent:class CustomEvent { constructor(type, init={}) { this.type=type; this.detail=init.detail; } }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/admin-daily-curated-authority-v1.js'), sandbox, { filename:'js/admin-daily-curated-authority-v1.js', timeout:30000 });

const authority = window.FPL_DAILY_CURATED_AUTHORITY_V1;
assert(authority?.ready === true, 'Curated Daily authority API did not initialise.');
assert(authority.version === '1.0.0', 'Curated Daily authority version drifted.');
assert(authority.expectedSelected === 4897, 'Curated Daily authority survivor count drifted.');
assert(authority.survivorIdSha256 === '3d3b0776ca0df171f6017c8e436f167308c4bfdd4d0b74b4e57b6089edff972d', 'Curated Daily authority digest drifted.');

const facade = window.FPL_PROMPT_LIBRARY_SHARDS_V1;
assert(typeof facade.buildSourceRepositoryPackage === 'function', 'Curated authority did not preserve the immutable source builder.');
const sourceAgain = await facade.buildSourceRepositoryPackage();
assert(sourceAgain.manifest.total === 134765, 'Source builder no longer exposes the immutable 134,765 source package.');

const curated = await facade.buildRepositoryPackage();
assert(curated.kind === 'fpl-prompt-library-family-shards', 'Daily facade no longer exposes a family-shard package.');
assert(curated.manifest.total === 4897, 'Daily facade does not expose exactly 4,897 curated prompts.');
assert(curated.manifest.families === 17, 'Daily curated package lost a family.');
assert(curated.manifest.variantGroups === 1307, 'Daily curated package variant-group count drifted.');
assert(curated.manifest.qualityPass === 4897 && curated.manifest.qualityReview === 0, 'Daily curated package quality totals drifted.');
assert(curated.authority?.dailyAuthorityChanged === true, 'Curated package does not explicitly claim Daily authority after cutover.');
assert(curated.authority?.productionCutoverApproved === true, 'Curated package does not explicitly record cutover approval.');
assert(curated.authority?.shadowRegressionPassed === true, 'Curated package lost the shadow-regression approval marker.');
const curatedIds = curated.shards.flatMap(shard => shard.records.map(record => record.id));
assert(curatedIds.length === 4897 && new Set(curatedIds).size === 4897, 'Curated Daily facade does not contain 4,897 unique IDs.');
assert(curatedIds.every(id => allSelected.includes(id)), 'Curated Daily facade contains an ID outside the frozen selector set.');
assert(facade.getSavedManifest().total === 134765, 'Saved-source manifest should remain the 134,765 provenance snapshot.');

const config = JSON.parse(read('config/asset-manifest.json'));
assert(config.assets?.adminDailyCuratedAuthorityV1?.path === 'js/admin-daily-curated-authority-v1.js', 'Central asset manifest does not own the curated Daily authority module.');
const runtimeManifest = read('js/asset-manifest.js');
assert(runtimeManifest.includes('"adminDailyCuratedAuthorityV1"'), 'Runtime asset manifest does not expose the curated Daily authority module.');
const bootstrap = read('js/studio-bootstrap.js');
const authorityIndex = bootstrap.indexOf('loadAsset("adminDailyCuratedAuthorityV1"');
const cutoverIndex = bootstrap.indexOf('loadAsset("adminDailyLibraryCutoverV1"');
assert(authorityIndex >= 0 && cutoverIndex > authorityIndex, 'Studio bootstrap does not load curated authority before the existing Daily cutover boundary.');

const authoritySource = read('js/admin-daily-curated-authority-v1.js');
for (const forbidden of ['FPL_DAILY_GENERATION_PROMPT_POOL =', 'FPL_DAILY_GENERATION_FAMILY_PLAN =', 'persistSnapshot(', 'saveCurrentPromotion(', 'supabase.functions']) {
  assert(!authoritySource.includes(forbidden), `Curated authority contains forbidden direct generation/persistence path: ${forbidden}`);
}

console.log('Curated Daily authority verified: 134,765 source remains intact, exact frozen 4,897 survivors become the Daily repository package, and bootstrap installs authority before cutover.');
