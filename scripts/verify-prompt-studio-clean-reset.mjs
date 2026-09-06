import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const manifest = JSON.parse(read('config/asset-manifest.json'));
const generatedManifest = read('js/asset-manifest.js');
const bootstrap = read('js/studio-bootstrap.js');
const entrypoint = read('js/admin-import-tools.js');
const repositoryPool = read('js/repository-certified-prompt-pool.js');
const cutover = read('js/admin-daily-library-cutover-v1.js');
const dailyGuard = read('js/admin-daily-generator-guard.js');
const shards = read('js/prompt-library-shards-v1.js');
const promptLibrary = read('prompt-library.js')
  .replace(/^\uFEFF/, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

assert(manifest.manifestVersion === '2.7.0-daily-generation-cutover', 'Central manifest is not on the Daily saved-library generation cutover boundary.');
assert(manifest.assets?.studioBootstrap?.path === 'js/studio-bootstrap.js', 'Central manifest no longer owns the clean Studio bootstrap.');
assert(manifest.assets?.promptStudioClean?.path === 'js/prompt-studio-clean-reset.js', 'Clean Prompt Studio controller is missing from the central manifest.');
assert(manifest.assets?.promptFactoryV1?.path === 'js/prompt-factory-v1.js', 'Prompt Factory v1 is missing from the central manifest.');
assert(manifest.assets?.promptQualityAnalyserV1?.path === 'js/prompt-quality-analyser-v1.js', 'Prompt Quality Analyser v1 is missing from the central manifest.');
assert(manifest.assets?.promptPromotionV1?.path === 'js/prompt-promotion-v1.js', 'Prompt Promotion v1 is missing from the central manifest.');
assert(manifest.assets?.promptLibraryShardsV1?.path === 'js/prompt-library-shards-v1.js', 'Durable Prompt Library shards are missing from the central manifest.');
assert(manifest.assets?.adminDailyLibraryCutoverV1?.path === 'js/admin-daily-library-cutover-v1.js', 'Daily saved-library cutover boundary is missing from the central manifest.');
assert(manifest.assets?.adminDailyGeneratorGuard?.path === 'js/admin-daily-generator-guard.js', 'Daily generation guard is missing from the central manifest.');
assert(manifest.assets?.adminDailyGeneratorGuard?.version === '2.0.0-saved-library-cycle', 'Daily generation guard cache version is not on saved-library v2.');
assert(manifest.assets?.repositoryCertifiedPromptPool?.version === '2.0.0-clean-reset', 'Repository prompt pool is not on the clean zero boundary.');

assert(generatedManifest.includes('2.7.0-daily-generation-cutover'), 'Generated asset manifest was not refreshed to the Daily cutover boundary.');
assert(generatedManifest.includes('"adminDailyLibraryCutoverV1"'), 'Generated asset manifest does not expose the Daily cutover module.');
assert(generatedManifest.includes('"adminDailyGeneratorGuard"'), 'Generated asset manifest does not expose the Daily generation guard.');

for (const token of ['ensurePromptStudio', 'ensurePromptFactory', 'ensureQualityAnalyser', 'ensurePromotion', 'ensureLibraryShards', 'ensureDailyCutover']) {
  assert(bootstrap.includes(token), `Clean Studio bootstrap is missing ${token}.`);
}
for (const retired of ['ensurePromptRedesign', 'ensurePromptV3', 'ensurePromptLoader', 'ensureCertificationLayer', 'ensureRefinementIncubator']) {
  assert(!bootstrap.includes(retired), `Clean Studio bootstrap still contains retired owner ${retired}.`);
}
assert(entrypoint.includes('fallback is disabled by design'), 'Admin entrypoint does not fail closed when the clean bootstrap cannot load.');
assert(!entrypoint.includes('loadLegacyPromptPath'), 'Admin entrypoint can still resurrect the retired Prompt Studio loader path.');
assert(promptLibrary === 'window.FPL_PROMPT_LIBRARY = [];', 'prompt-library.js must remain the empty repository initializer; the durable promoted library belongs to family shards.');

assert(repositoryPool.includes('expectedTotal: 0'), 'Repository-certified prompt pool is not intentionally pinned to zero after the clean reset.');
assert(!repositoryPool.includes('851'), 'Repository-certified prompt pool still contains the retired 851-prompt population.');
assert(cutover.includes('EXPECTED_FAMILIES'), 'Daily cutover no longer validates the saved 17-family boundary.');
assert(cutover.includes('materialiseRecord'), 'Daily cutover no longer exposes lazy prompt hydration.');
assert(shards.includes('fplPromptLibraryShardsV1'), 'Durable Prompt Library shard storage is missing.');
assert(shards.includes('window.indexedDB.open'), 'Durable Prompt Library shards no longer use IndexedDB.');

for (const token of [
  'saved-library generation guard v2.0.0',
  'const WEEKLY_PROMPTS = DAYS_IN_BATCH * PROMPTS_PER_DAY;',
  'const NATIONALITY_WEEKLY_TARGET = DAYS_IN_BATCH;',
  'async function buildCertifiedReservoir()',
  'window.FPL_DAILY_GENERATION_PROMPT_POOL = prompts;',
  'window.FPL_DAILY_GENERATION_FAMILY_PLAN = reservoir.plan;',
  'fpl:daily-saved-library-week-certified'
]) {
  assert(dailyGuard.includes(token), `Daily saved-library generation boundary is missing: ${token}`);
}
assert(!dailyGuard.includes('state.total !== 851'), 'Daily generation guard still depends on the retired 851-prompt pool.');

console.log('Prompt Studio clean boundary verified through the active 17-family Daily saved-library generation cutover; repository production pool remains intentionally zero.');
