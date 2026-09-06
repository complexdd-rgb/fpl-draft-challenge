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
const scheduleManager = read('js/admin-schedule-manager-v2.js');
const semanticDiversity = read('js/daily-semantic-diversity-v1.js');
const batchCalendar = read('js/admin-batch-calendar.js');
const shards = read('js/prompt-library-shards-v1.js');
const shardCss = read('admin-prompt-library-shards-v1.css');
const promptLibrary = read('prompt-library.js')
  .replace(/^\uFEFF/, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

assert(manifest.manifestVersion === '3.0.1-nationality-rotation', 'Central manifest is not on the schedule-manager v2 boundary.');
assert(manifest.assets?.assetManifestRuntime?.version === '3.0.1-nationality-rotation', 'Asset-manifest runtime cache version is stale.');
assert(manifest.assets?.studioBootstrap?.path === 'js/studio-bootstrap.js', 'Central manifest no longer owns the clean Studio bootstrap.');
assert(manifest.assets?.studioBootstrap?.version === '2.6.0-schedule-manager', 'Studio bootstrap cache version does not include schedule manager v2.');
assert(manifest.assets?.promptStudioClean?.path === 'js/prompt-studio-clean-reset.js', 'Clean Prompt Studio controller is missing from the central manifest.');
assert(manifest.assets?.promptFactoryV1?.path === 'js/prompt-factory-v1.js', 'Prompt Factory v1 is missing from the central manifest.');
assert(manifest.assets?.promptQualityAnalyserV1?.path === 'js/prompt-quality-analyser-v1.js', 'Prompt Quality Analyser v1 is missing from the central manifest.');
assert(manifest.assets?.promptPromotionV1?.path === 'js/prompt-promotion-v1.js', 'Prompt Promotion v1 is missing from the central manifest.');
assert(manifest.assets?.promptLibraryShardsV1?.path === 'js/prompt-library-shards-v1.js', 'Durable Prompt Library shards are missing from the central manifest.');
assert(manifest.assets?.promptLibraryShardsCssV1?.version === '1.2.0-daily-authority', 'Daily saved-library authority display cache tag is stale.');
assert(manifest.assets?.adminDailyLibraryCutoverV1?.path === 'js/admin-daily-library-cutover-v1.js', 'Daily saved-library cutover boundary is missing from the central manifest.');
assert(manifest.assets?.adminDailyGeneratorGuard?.path === 'js/admin-daily-generator-guard.js', 'Daily generation guard is missing from the central manifest.');
assert(manifest.assets?.adminDailyGeneratorGuard?.version === '2.3.0-reservoir-authority', 'Daily generation guard cache version is not on saved-library v2.');
assert(manifest.assets?.dailySemanticDiversityV1?.path === 'js/daily-semantic-diversity-v1.js', 'Daily semantic-diversity policy is missing from the central manifest.');
assert(manifest.assets?.adminBatchCalendar?.version === '3.3.0-nationality-rotation', 'Batch calendar date-identity cache version is stale.');
assert(manifest.assets?.adminDailyPublish?.version === '1.1.0-date-identity', 'Daily publishing date-identity cache version is stale.');
assert(manifest.assets?.adminScheduleManagerV2?.path === 'js/admin-schedule-manager-v2.js', 'Schedule manager v2 is missing from the central manifest.');
assert(manifest.assets?.adminScheduleManagerV2?.version === '2.0.0', 'Schedule manager v2 cache version is stale.');
assert(manifest.assets?.adminImportTools?.version === '24.6.0-schedule-manager', 'Admin entrypoint cache version does not force the new bootstrap.');
assert(manifest.assets?.repositoryCertifiedPromptPool?.version === '2.0.0-clean-reset', 'Repository prompt pool is not on the clean zero boundary.');

assert(generatedManifest.includes('3.0.1-nationality-rotation'), 'Generated asset manifest was not refreshed to the schedule-manager v2 boundary.');
assert(generatedManifest.includes('"dailySemanticDiversityV1"'), 'Generated asset manifest does not expose the Daily semantic-diversity policy.');
assert(generatedManifest.includes('"adminScheduleManagerV2"'), 'Generated asset manifest does not expose schedule manager v2.');
assert(generatedManifest.includes('"version": "1.2.0-daily-authority"'), 'Generated asset manifest did not retain the Daily authority CSS cache tag.');
assert(generatedManifest.includes('"adminDailyLibraryCutoverV1"'), 'Generated asset manifest does not expose the Daily cutover module.');
assert(generatedManifest.includes('"adminDailyGeneratorGuard"'), 'Generated asset manifest does not expose the Daily generation guard.');

for (const token of ['ensurePromptStudio', 'ensurePromptFactory', 'ensureQualityAnalyser', 'ensurePromotion', 'ensureLibraryShards', 'ensureDailyCutover', 'ensurePublishing', 'ensureScheduleManager']) {
  assert(bootstrap.includes(token), `Clean Studio bootstrap is missing ${token}.`);
}
for (const retired of ['ensurePromptRedesign', 'ensurePromptV3', 'ensurePromptLoader', 'ensureCertificationLayer', 'ensureRefinementIncubator']) {
  assert(!bootstrap.includes(retired), `Clean Studio bootstrap still contains retired owner ${retired}.`);
}
assert(bootstrap.includes('adminScheduleManagerV2'), 'Clean Studio bootstrap does not load the centrally owned schedule manager v2.');
assert(entrypoint.includes('js/studio-bootstrap.js?v=2.6.0-schedule-manager'), 'Admin entrypoint does not force the schedule-manager v2 bootstrap.');
assert(entrypoint.includes('fallback is disabled by design'), 'Admin entrypoint does not fail closed when the clean bootstrap cannot load.');
assert(!entrypoint.includes('loadLegacyPromptPath'), 'Admin entrypoint can still resurrect the retired Prompt Studio loader path.');
assert(promptLibrary === 'window.FPL_PROMPT_LIBRARY = [];', 'prompt-library.js must remain the empty repository initializer; the durable promoted library belongs to family shards.');

assert(scheduleManager.includes('centrally owned published schedule manager v2.0.0'), 'Schedule manager v2 header/version is missing.');
assert(scheduleManager.includes('const bridge = window.FPL_ACCOUNT_AUTH;'), 'Schedule manager v2 does not resolve auth dynamically at action time.');
assert(scheduleManager.includes('window.__FPL_SCHEDULE_MANAGER_V1__ = true;'), 'Schedule manager v2 does not block the retired compatibility manager from installing after it.');
assert(scheduleManager.includes('action:"remove"'), 'Schedule manager v2 no longer calls the server remove action.');
assert(scheduleManager.includes('fpl:schedule-remove-success'), 'Schedule manager v2 is missing success telemetry.');
assert(scheduleManager.includes('fpl:schedule-remove-error'), 'Schedule manager v2 is missing failure telemetry.');
assert(!scheduleManager.includes('const authBridge = window.FPL_ACCOUNT_AUTH;'), 'Schedule manager v2 still captures a stale auth bridge at module load.');

assert(repositoryPool.includes('expectedTotal: 0'), 'Repository-certified prompt pool is not intentionally pinned to zero after the clean reset.');
assert(!repositoryPool.includes('851'), 'Repository-certified prompt pool still contains the retired 851-prompt population.');
assert(cutover.includes('EXPECTED_FAMILIES'), 'Daily cutover no longer validates the saved 17-family boundary.');
assert(cutover.includes('materialiseRecord'), 'Daily cutover no longer exposes lazy prompt hydration.');
assert(shards.includes('fplPromptLibraryShardsV1'), 'Durable Prompt Library shard storage is missing.');
assert(shards.includes('window.indexedDB.open'), 'Durable Prompt Library shards no longer use IndexedDB.');
assert(shardCss.includes('Active saved promoted library'), 'Daily library balance still displays the retired cutover-pending authority wording.');
assert(shardCss.includes('77-prompt reservoir is structurally and runtime verified'), 'Daily library balance does not explain the runtime-certified weekly reservoir.');

for (const token of [
  'saved-library generation guard v2.3.0',
  'ensureSemanticDiversity()',
  'semanticWeeklyCap: DAYS_IN_BATCH',
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
assert(semanticDiversity.includes('entity:manager:'), 'Semantic policy is missing manager-entity isolation.');
assert(semanticDiversity.includes('rare:bonus'), 'Semantic policy is missing bonus-point isolation.');
assert(batchCalendar.includes('semantic.missingRequiredKeys'), 'Batch calendar is missing semantic look-ahead pressure.');
assert(batchCalendar.includes('semantic.dayClash'), 'Batch calendar is missing the hard same-day semantic guard.');

console.log('Prompt Studio clean boundary verified with centrally owned Daily schedule manager v2 and active 17-family generation cutover.');
