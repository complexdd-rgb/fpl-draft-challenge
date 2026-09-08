import fs from 'node:fs';
import crypto from 'node:crypto';

const read = path => fs.readFileSync(path, 'utf8');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const manifestPath = 'prompt-library-curated-v1/manifest.json';
const freezePath = 'reports/prompt-curation-134765-survivor-v12-freeze-manifest.json';
const manifest = JSON.parse(read(manifestPath));
const freeze = JSON.parse(read(freezePath));

assert(manifest.kind === 'fpl-prompt-curated-library-selector-manifest', 'Curated selector manifest kind drifted.');
assert(manifest.packageVersion === '1.0.0', 'Curated selector package version drifted.');
assert(manifest.status === 'frozen-pre-cutover', 'Curated selector package is no longer pre-cutover.');
assert(manifest.sourcePromotionFingerprint === freeze.promotionFingerprint, 'Curated selector source fingerprint does not match the freeze.');
assert(manifest.sourcePrompts === freeze.sourcePrompts, 'Curated selector source total does not match the freeze.');
assert(manifest.selected === freeze.selected && manifest.selected === 4897, 'Curated selector survivor count drifted.');
assert(manifest.families === 17, 'Curated selector family count drifted.');
assert(manifest.survivorIdSha256 === freeze.survivorIdSha256, 'Curated selector survivor digest does not match the freeze.');
assert(manifest.authority?.dailyAuthorityChanged === false, 'Curated selector manifest incorrectly claims Daily authority.');
assert(manifest.authority?.productionCutoverApproved === false, 'Curated selector manifest incorrectly claims production cutover approval.');

const descriptors = manifest.familySelectors || [];
assert(descriptors.length === 17, 'Curated selector manifest does not list all 17 families.');
const ids = [];
const familyCounts = {};

for (const descriptor of descriptors) {
  const raw = read(descriptor.path);
  assert(sha256(raw) === descriptor.sha256, `Selector raw SHA-256 drifted for ${descriptor.family}.`);
  const selector = JSON.parse(raw);
  assert(selector.kind === 'fpl-prompt-curation-frozen-survivor-selector-family', `Selector kind drifted for ${descriptor.family}.`);
  assert(selector.promotionFingerprint === manifest.sourcePromotionFingerprint, `Selector fingerprint drifted for ${descriptor.family}.`);
  assert(selector.family === descriptor.family, `Selector family mismatch for ${descriptor.family}.`);
  const familyIds = [];
  for (const [position, suffixes] of Object.entries(selector.positions || {})) {
    assert(['any','gk','def','mid','fwd'].includes(position), `Unsupported selector position ${position} in ${descriptor.family}.`);
    assert(Array.isArray(suffixes), `Selector bucket ${descriptor.family}/${position} is not an array.`);
    for (const suffix of suffixes) {
      assert(String(suffix).trim(), `Blank selector suffix in ${descriptor.family}/${position}.`);
      familyIds.push(`factory_${descriptor.family.replaceAll('-', '_')}_${position}_${suffix}`);
    }
  }
  assert(familyIds.length === descriptor.count, `Selector count drifted for ${descriptor.family}.`);
  assert(new Set(familyIds).size === familyIds.length, `Selector duplicates found inside ${descriptor.family}.`);
  familyCounts[descriptor.family] = familyIds.length;
  ids.push(...familyIds);
}

assert(ids.length === 4897, `Curated selectors reconstruct ${ids.length} IDs instead of 4,897.`);
assert(new Set(ids).size === ids.length, 'Curated selectors contain duplicate full prompt IDs.');
assert(Object.keys(familyCounts).length === 17, 'Curated selector family reconstruction is incomplete.');
for (const [family, expected] of Object.entries(freeze.familyCounts || {})) {
  assert(familyCounts[family] === expected, `Curated selector family count mismatch for ${family}.`);
}
const idHash = sha256(`${[...ids].sort().join('\n')}\n`);
assert(idHash === freeze.survivorIdSha256, `Curated selector ID digest ${idHash} does not reproduce the frozen survivor digest.`);

console.log(`Curated selector package verified: ${ids.length.toLocaleString('en-GB')} exact frozen survivors across 17 families reproduce ${idHash}, and production authority remains unchanged.`);
