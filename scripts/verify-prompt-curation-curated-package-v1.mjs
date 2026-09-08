import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-curation-curated-package-v1.js', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const sandbox = { window:{}, console, setTimeout, clearTimeout, TextEncoder, URL, Blob };
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename:'prompt-curation-curated-package-v1.js' });
const api = sandbox.window.FPL_PROMPT_CURATED_PACKAGE_V1;
assert(api?.ready === true, 'Curated Package API did not initialise.');
assert(api.version === '1.0.0', 'Curated Package version drifted.');
assert(api.expectedSourceFingerprint === 'shards_134765_1pkuiu3', 'Curated Package source fingerprint drifted.');
assert(api.expectedSelected === 4897, 'Curated Package frozen count drifted.');

const manifest = JSON.parse(fs.readFileSync('prompt-library-curated-v1/manifest.json', 'utf8'));
const selectors = manifest.familySelectors.map(item => JSON.parse(fs.readFileSync(item.path, 'utf8')));
const selectedIds = selectors.flatMap(api.selectorIds);
assert(selectedIds.length === 4897 && new Set(selectedIds).size === 4897, 'Curated Package API does not reconstruct the frozen selector IDs uniquely.');

const groupNames = Array.from({ length:1307 }, (_, index) => `vg_${index}`);
let groupIndex = 0;
const shardByFamily = new Map();
for (const selector of selectors) {
  const records = api.selectorIds(selector).map(id => ({
    schemaVersion:1,
    id,
    label:`Synthetic ${id}`,
    family:selector.family,
    position:id.match(/_(any|gk|def|mid|fwd)_/)?.[1]?.toUpperCase().replace('ANY','ANY') || 'ANY',
    conditions:[{ field:'points', operator:'gte', value:10 }],
    variantGroup:groupNames[groupIndex++ % groupNames.length],
    qualityStatus:'pass',
    qualityScore:90,
    difficulty:'medium',
    qualityEvidence:{ answerPlayers:20 },
    enabled:true
  }));
  shardByFamily.set(selector.family, { family:selector.family, count:records.length, records });
}
const sourcePackage = {
  kind:'fpl-prompt-library-family-shards',
  manifest:{ promotionFingerprint:'shards_134765_1pkuiu3', total:134765, families:17 },
  shards:[...shardByFamily.values()]
};

const payload = api.buildPackageFromData(sourcePackage, manifest, selectors);
assert(payload.kind === 'fpl-prompt-curated-library-package', 'Curated Package kind drifted.');
assert(payload.manifest.total === 4897, 'Curated Package total drifted.');
assert(payload.manifest.families === 17, 'Curated Package family count drifted.');
assert(payload.manifest.variantGroups === 1307, 'Curated Package selected variant-group count drifted.');
assert(payload.manifest.qualityPass === 4897 && payload.manifest.qualityReview === 0, 'Curated Package quality counts drifted.');
assert(payload.authority?.dailyAuthorityChanged === false, 'Curated Package incorrectly claims Daily authority.');
assert(payload.authority?.productionCutoverApproved === false, 'Curated Package incorrectly claims production cutover.');

let blocked = false;
try {
  api.buildPackageFromData({
    ...sourcePackage,
    manifest:{ ...sourcePackage.manifest, promotionFingerprint:'wrong_snapshot' }
  }, manifest, selectors);
} catch (error) {
  blocked = /fingerprint/i.test(String(error?.message || error));
}
assert(blocked, 'Curated Package did not block a source fingerprint mismatch.');

const missingSource = {
  ...sourcePackage,
  shards:sourcePackage.shards.map((shard, index) => index === 0 ? { ...shard, records:shard.records.slice(1) } : shard)
};
blocked = false;
try {
  api.buildPackageFromData(missingSource, manifest, selectors);
} catch (error) {
  blocked = /missing/i.test(String(error?.message || error));
}
assert(blocked, 'Curated Package did not block a missing frozen survivor.');

assert(!source.includes('FPL_DAILY_GENERATION_PROMPT_POOL ='), 'Curated Package must not write the Daily generation pool.');
assert(!source.includes('FPL_DAILY_GENERATION_FAMILY_PLAN ='), 'Curated Package must not write the Daily family plan.');
assert(!source.includes('persistSnapshot('), 'Curated Package must not replace durable saved Prompt Library shards.');
assert(source.includes('does not alter saved shards, Daily generation, publishing or certification authority'), 'Curated Package read-only boundary wording is missing.');

console.log('Curated Package v1 verified: exact frozen selectors materialise 4,897 clean records, fingerprint/missing-ID blockers work, and saved/Daily authority remains untouched.');
