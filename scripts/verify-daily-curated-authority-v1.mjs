import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const manifest = JSON.parse(read('prompt-library-curated-v2/manifest.json'));
const selectors = manifest.familySelectors.map(item => JSON.parse(read(item.path)));

function idsFor(selector) {
  const prefix = `factory_${String(selector.family).replaceAll('-', '_')}_`;
  return Object.entries(selector.positions || {}).flatMap(([position, suffixes]) => (suffixes || []).map(suffix => `${prefix}${position}_${suffix}`));
}

const allSelected = selectors.flatMap(idsFor).sort();
const legacyIds = selectors.filter(item => item.family !== 'exclude-top-result').flatMap(idsFor).sort();
const excludeSelector = selectors.find(item => item.family === 'exclude-top-result');
const excludeIds = excludeSelector ? idsFor(excludeSelector).sort() : [];
assert(allSelected.length === 4959 && new Set(allSelected).size === 4959, 'Fixture does not reconstruct 4,959 exact survivor IDs.');
assert(legacyIds.length === 4897, 'Legacy selector layer no longer contains 4,897 prompts.');
assert(excludeIds.length === 62, 'Exclude Top Result selector does not contain 62 prompts.');
const legacyDigest = sha(`${legacyIds.join('\n')}\n`);
const excludeDigest = sha(`${excludeIds.join('\n')}\n`);
const compositeDigest = sha(`legacy-v1:${legacyDigest}\nexclude-top-result:${excludeDigest}\n`);
assert(legacyDigest === '3d3b0776ca0df171f6017c8e436f167308c4bfdd4d0b74b4e57b6089edff972d', 'Legacy selector digest drifted.');
assert(excludeDigest === 'ebeb29a15d4fde2c229399dd1c03ec8c862c344995d4da76efba4897e5b57709', 'Exclude Top Result selector digest drifted.');
assert(compositeDigest === 'b40b313aac5d540302e601c88bf9f42e7aa846f7b5042d65a3689826e8465d07', 'Curated v2 composite digest drifted.');
assert(manifest.selectionCompositeSha256 === compositeDigest, 'Manifest composite digest does not match selectors.');
assert(manifest.sourcePromotionFingerprint === 'shards_144252_h2yx4a' && manifest.sourcePrompts === 144252, 'Curated v2 source provenance drifted.');
assert(manifest.sourceVariantGroups === 2753 && manifest.families === 18 && manifest.selectedVariantGroups === 1330, 'Curated v2 source/family counts drifted.');

const groups = Array.from({ length:1330 }, (_, index) => `vg_${index}`);
let groupIndex = 0;
const sourceShards = selectors.map(selector => {
  const records = [];
  for (const [bucket, suffixes] of Object.entries(selector.positions || {})) {
    const position = bucket === 'any' ? 'ANY' : bucket.toUpperCase();
    const prefix = `factory_${selector.family.replaceAll('-', '_')}_${bucket}_`;
    for (const suffix of suffixes || []) {
      const isExclude = selector.family === 'exclude-top-result';
      records.push({
        schemaVersion:1,
        id:`${prefix}${suffix}`,
        label:isExclude ? `Synthetic ${selector.family} — excluding One Player` : `Synthetic ${selector.family} ${suffix}`,
        family:selector.family,
        position,
        conditions:isExclude ? [{ field:'points', operator:'gte', value:10 }, { field:'playerId', operator:'notEquals', value:'p1' }] : [{ field:'points', operator:'gte', value:10 }],
        variantGroup:groups[groupIndex++ % groups.length],
        qualityStatus:'pass', qualityScore:90, qualityEvidence:{ answerPlayers:20 }, enabled:true
      });
    }
  }
  return { family:selector.family, count:records.length, records };
});
const sourcePackage = {
  schemaVersion:1,
  kind:'fpl-prompt-library-family-shards',
  manifest:{ schemaVersion:1, version:'1.1.0', savedAt:'2026-09-15T08:17:28.473Z', promotionVersion:'1.0.0', promotionFingerprint:'shards_144252_h2yx4a', total:144252, families:18, variantGroups:2753, qualityPass:144252, qualityReview:0 },
  shards:sourceShards
};

const listeners = new Map();
const window = {
  FPL_PROMPT_LIBRARY_SHARDS_V1:Object.freeze({ ready:true, buildRepositoryPackage:async () => sourcePackage, getSavedManifest:() => ({ ...sourcePackage.manifest }), render() {} }),
  addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
  dispatchEvent(event) { for (const handler of [...(listeners.get(event?.type) || [])]) handler(event); }
};
window.window = window;
const fetch = async input => {
  const url = new URL(String(input));
  const path = url.pathname.replace(/^\//, '');
  if (!fs.existsSync(path)) return { ok:false, status:404, text:async () => '' };
  return { ok:true, status:200, text:async () => read(path) };
};
const sandbox = { window, globalThis:null, document:{baseURI:'https://example.invalid/'}, console, fetch, crypto:crypto.webcrypto, TextEncoder, URL, CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('js/admin-daily-curated-authority-v1.js'), sandbox, { filename:'js/admin-daily-curated-authority-v1.js', timeout:30000 });

const authority = window.FPL_DAILY_CURATED_AUTHORITY_V1;
assert(authority?.ready === true, 'Curated Daily authority API did not initialise.');
assert(authority.version === '2.0.0', 'Curated Daily authority version drifted.');
assert(authority.expectedSelected === 4959 && authority.expectedFamilies === 18, 'Curated Daily authority counts drifted.');
assert(authority.selectionCompositeSha256 === compositeDigest, 'Curated Daily authority composite digest drifted.');

const facade = window.FPL_PROMPT_LIBRARY_SHARDS_V1;
assert(typeof facade.buildSourceRepositoryPackage === 'function', 'Curated authority did not preserve the promoted source builder.');
const sourceAgain = await facade.buildSourceRepositoryPackage();
assert(sourceAgain.manifest.total === 144252 && sourceAgain.manifest.families === 18, 'Source builder no longer exposes the approved 18-family promoted source.');
const curated = await facade.buildRepositoryPackage();
assert(curated.kind === 'fpl-prompt-library-family-shards', 'Daily facade no longer exposes a family-shard package.');
assert(curated.manifest.total === 4959 && curated.manifest.families === 18 && curated.manifest.variantGroups === 1330, 'Daily curated package counts drifted.');
assert(curated.manifest.qualityPass === 4959 && curated.manifest.qualityReview === 0, 'Daily curated package quality totals drifted.');
assert(curated.authority?.dailyAuthorityChanged === true && curated.authority?.productionCutoverApproved === true && curated.authority?.shadowRegressionPassed === true, 'Curated package lost production authority markers.');
assert(curated.authority?.authority === 'frozen-curated-4959-v2', 'Curated package authority label drifted.');
const curatedIds = curated.shards.flatMap(shard => shard.records.map(record => record.id));
assert(curatedIds.length === 4959 && new Set(curatedIds).size === 4959, 'Curated Daily facade does not contain 4,959 unique IDs.');
assert(curated.shards.find(shard => shard.family === 'exclude-top-result')?.records.length === 62, 'Curated Daily facade lost Exclude Top Result survivors.');
assert(facade.getSavedManifest().total === 144252, 'Saved-source manifest should remain the promoted 144,252 provenance snapshot.');

const config = JSON.parse(read('config/asset-manifest.json'));
assert(config.assets?.adminDailyCuratedAuthorityV1?.path === 'js/admin-daily-curated-authority-v1.js', 'Central asset manifest does not own the curated Daily authority module.');
const bootstrap = read('js/studio-bootstrap.js');
assert(bootstrap.indexOf('loadAsset("adminDailyCuratedAuthorityV1"') >= 0 && bootstrap.indexOf('loadAsset("adminDailyLibraryCutoverV1"') > bootstrap.indexOf('loadAsset("adminDailyCuratedAuthorityV1"'), 'Studio bootstrap does not preserve authority-before-cutover order.');
const authoritySource = read('js/admin-daily-curated-authority-v1.js');
for (const forbidden of ['FPL_DAILY_GENERATION_PROMPT_POOL =', 'FPL_DAILY_GENERATION_FAMILY_PLAN =', 'persistSnapshot(', 'saveCurrentPromotion(', 'supabase.functions']) assert(!authoritySource.includes(forbidden), `Curated authority contains forbidden direct generation/persistence path: ${forbidden}`);
for (const token of [
  'const CACHE_DB = "fpl-daily-curated-authority-v2";',
  'async function readCachedPackage()',
  'async function writeCachedPackage(payload)',
  'function cachedPackageProblem(payload, definition)',
  'const cached = await readCachedPackage();',
  'if (cached && !cachedPackageProblem(cached, definition))',
  'await writeCachedPackage(payload);',
  'cache: "hit"',
  'cache: "rebuilt"'
]) assert(authoritySource.includes(token), `Curated authority cache path is missing: ${token}`);

console.log('Curated Daily authority v2 verified: legacy 4,897 selectors remain intact, 62 Exclude Top Result prompts extend Daily to 4,959 prompts / 18 families, and the 144,252 promoted source remains provenance.');
