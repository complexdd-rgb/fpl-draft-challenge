import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const manifest = JSON.parse(read('config/asset-manifest.json'));
const generatedManifest = read('js/asset-manifest.js');
const bootstrap = read('js/studio-bootstrap.js');
const promptStudio = read('js/prompt-studio-clean-reset.js');
const shards = read('js/prompt-library-shards-v1.js');
const authority = read('js/admin-daily-curated-authority-v1.js');
const cutover = read('js/admin-daily-library-cutover-v1.js');
const legacySelectorManifest = JSON.parse(read('prompt-library-curated-v1/manifest.json'));
const activeSelectorManifest = JSON.parse(read('prompt-library-curated-v2/manifest.json'));
const promptLibrary = read('prompt-library.js')
  .replace(/^\uFEFF/, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

// The prompt-v2 architecture identity stays fixed while runtime asset versions may advance for safe generator hotfixes.
assert(manifest.manifestVersion === '4.0.0-prompts-v2', 'Central manifest is not on the 18-family prompt-v2 boundary.');
assert(manifest.assets?.assetManifestRuntime?.version === '4.0.8-flexible-family-allocation', 'Asset manifest runtime cache tag is stale.');
assert(manifest.assets?.studioBootstrap?.version === '3.0.0-post-curation', 'Studio bootstrap cache tag is stale.');
assert(manifest.assets?.promptStudioClean?.version === '1.3.0-permanent-workflow', 'Prompt Studio permanent workflow cache tag is stale.');
assert(manifest.assets?.adminDailyCuratedAuthorityV1?.version === '2.0.0', 'Curated Daily authority cache tag is stale.');
assert(manifest.assets?.adminDailyLibraryCutoverV1?.version === '1.1.0-exclude-top-result', 'Daily cutover cache tag is stale.');

for (const key of [
  'promptStudioClean', 'promptFactoryMountV1', 'promptFactoryV1',
  'promptQualityAnalyserMountV1', 'promptQualityAnalyserV1', 'promptPromotionV1',
  'promptLibraryShardsV1', 'promptLibraryShardsBridgeV1',
  'adminDailyCuratedAuthorityV1', 'adminDailyLibraryCutoverV1'
]) assert(manifest.assets?.[key], `Permanent Prompt Studio asset is missing: ${key}`);

for (const key of [
  'promptCurationEvidenceV1', 'promptCurationSurvivorBuilderV1', 'promptCurationReviewExportV1',
  'promptRefinementIncubator', 'promptRefinementSurvivors', 'promptFourStarEnforcer',
  'promptStudioV3', 'promptStudioV4Simple', 'promptStudioLoader'
]) assert(!manifest.assets?.[key], `Retired Prompt Studio asset returned to the manifest: ${key}`);

const retiredFiles = [
  'js/prompt-curation-evidence-v1.js',
  'js/prompt-curation-survivor-builder-v1.js',
  'js/prompt-curation-review-export-v1.js',
  'js/prompt-curation-curated-package-v1.js',
  'js/curated-shadow-regression-v1.js',
  'curated-shadow-regression.html',
  'js/prompt-refinement-incubator.js',
  'js/prompt-refinement-survivors-v1.js',
  'js/prompt-four-star-enforcer.js',
  'js/prompt-quality-baseline-finalizer.js',
  'scripts/audit-prompt-curation-v1.mjs',
  'scripts/verify-prompt-curation-v1.mjs',
  'scripts/verify-prompt-curation-freeze-v12.mjs',
  'scripts/audit-refinement-incubator.mjs',
  'scripts/promote-refinement-survivors.mjs',
  'scripts/refinement-survivor-appendix.inc.mjs',
  'scripts/trial-refinement-survivors.mjs',
  'scripts/verify-refinement-survivors.mjs',
  '.github/workflows/prompt-curation.yml',
  '.github/workflows/refinement-incubator-audit.yml'
];
for (const path of retiredFiles) assert(!fs.existsSync(path), `Retired Prompt Studio/Phase 1 file still exists: ${path}`);

for (const token of ['ensurePromptStudio', 'ensurePromptFactory', 'ensureQualityAnalyser', 'ensurePromotion', 'ensureLibraryShards', 'ensureDailyCutover']) {
  assert(bootstrap.includes(token), `Permanent Studio bootstrap is missing ${token}.`);
}
for (const retired of ['ensureCurationEvidence', 'ensureCurationSurvivorBuilder', 'ensureCurationReview', 'ensureRefinementIncubator']) {
  assert(!bootstrap.includes(retired), `Retired Prompt Studio loader remains: ${retired}.`);
}
assert(bootstrap.includes('adminDailyCuratedAuthorityV1'), 'Bootstrap no longer loads curated Daily authority before cutover.');
assert(bootstrap.includes('clean-v1-factory-quality-promotion-source-shards-curated-daily-authority-daily-cutover'), 'Permanent architecture marker drifted.');

assert(generatedManifest.includes('4.0.0-prompts-v2'), 'Generated manifest is not on the 18-family prompt-v2 boundary.');
assert(generatedManifest.includes('1.3.0-permanent-workflow'), 'Generated manifest is missing the permanent Prompt Studio cache tag.');
assert(generatedManifest.includes('2.0.0'), 'Generated manifest is missing the curated authority v2 cache tag.');
assert(!generatedManifest.includes('promptCurationEvidenceV1'), 'Generated manifest still advertises curation evidence.');
assert(!generatedManifest.includes('promptCurationSurvivorBuilderV1'), 'Generated manifest still advertises survivor builder.');
assert(!generatedManifest.includes('promptCurationReviewExportV1'), 'Generated manifest still advertises review export.');

assert(promptStudio.includes('Prompt Studio permanent runtime v1.3.0'), 'Prompt Studio permanent runtime header is missing.');
assert(promptStudio.includes('New-family safety boundary'), 'Prompt Studio no longer explains the future-family safety boundary.');
assert(promptStudio.includes('Promotion + source archive'), 'Prompt Studio no longer exposes the maintained promotion/source step.');
assert(promptStudio.includes('4,897') || promptStudio.includes('4897') || promptStudio.includes('4,959') || promptStudio.includes('4959'), 'Prompt Studio no longer surfaces the curated Daily boundary count.');
assert(!promptStudio.includes('Refinement Incubator'), 'Completed Refinement Incubator remains visible in Prompt Studio.');
assert(!promptStudio.includes('Generate & download paired 144'), 'Phase 1 review UI remains visible in Prompt Studio.');
assert(!promptStudio.includes('Full-library evidence layer'), 'Phase 1 evidence UI remains visible in Prompt Studio.');
assert(!promptStudio.includes('Full-library survivor builder'), 'Phase 1 survivor UI remains visible in Prompt Studio.');

assert(fs.existsSync('PROMPT_FAMILY_ONBOARDING.md'), 'Permanent future-family onboarding contract is missing.');
const onboarding = read('PROMPT_FAMILY_ONBOARDING.md');
for (const token of ['Prompt Builder / Factory', 'Quality Analyser', 'Promotion + source archive', 'versioned curated selector package', 'Shadow-test a real week before cutover']) {
  assert(onboarding.includes(token), `Future-family onboarding contract is missing: ${token}`);
}

assert(promptLibrary === 'window.FPL_PROMPT_LIBRARY = [];', 'prompt-library.js must remain an empty staging initializer.');
assert(shards.includes('window.indexedDB.open'), 'Promoted source shards no longer use durable IndexedDB storage.');

// Preserve the original Phase 1 freeze exactly as immutable provenance.
assert(legacySelectorManifest.kind === 'fpl-prompt-curated-library-selector-manifest', 'Legacy curated selector manifest kind drifted.');
assert(legacySelectorManifest.selected === 4897, 'Legacy curated selector count drifted.');
assert(legacySelectorManifest.families === 17, 'Legacy curated selector family count drifted.');
assert(legacySelectorManifest.survivorIdSha256 === '3d3b0776ca0df171f6017c8e436f167308c4bfdd4d0b74b4e57b6089edff972d', 'Legacy curated survivor digest drifted.');

// The active authority is the deliberate v2 extension of that frozen provenance.
assert(activeSelectorManifest.kind === 'fpl-prompt-curated-library-selector-manifest', 'Active curated selector manifest kind drifted.');
assert(activeSelectorManifest.packageVersion === '2.0.0', 'Active curated selector package version drifted.');
assert(activeSelectorManifest.selected === 4959, 'Active curated selector count drifted.');
assert(activeSelectorManifest.families === 18, 'Active curated selector family count drifted.');
assert(activeSelectorManifest.selectedVariantGroups === 1330, 'Active curated selector variant-group count drifted.');
assert(activeSelectorManifest.legacyFreeze?.selected === 4897 && activeSelectorManifest.legacyFreeze?.families === 17, 'Active v2 manifest no longer pins the legacy freeze.');
assert(activeSelectorManifest.additions?.some(item => item.family === 'exclude-top-result' && item.selected === 62), 'Active v2 manifest lost the 62 Exclude Top Result survivors.');

assert(authority.includes('FPL_DAILY_CURATED_AUTHORITY_V1'), 'Curated Daily authority runtime is missing.');
assert(authority.includes('const VERSION = "2.0.0"'), 'Curated Daily authority runtime is not v2.');
assert(authority.includes('EXPECTED_SELECTED = 4959'), 'Curated Daily authority no longer pins 4,959 prompts.');
assert(authority.includes('EXPECTED_FAMILIES = 18'), 'Curated Daily authority no longer pins 18 families.');
assert(cutover.includes('EXPECTED_FAMILIES'), 'Daily cutover no longer validates the family boundary.');
assert(cutover.includes('"exclude-top-result"'), 'Daily cutover no longer recognises Exclude Top Result.');
assert(cutover.includes('"notEquals"'), 'Daily cutover no longer recognises exclusion conditions.');

console.log('Permanent Prompt Studio boundary verified: Builder/Quality/Promotion remain permanent, the original 4,897/17 freeze is preserved as provenance, and the reviewed 4,959/18 v2 package is the active Daily authority.');
