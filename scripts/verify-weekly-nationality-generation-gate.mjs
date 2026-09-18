import fs from 'node:fs';

const admin = fs.readFileSync('admin.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('config/asset-manifest.json', 'utf8'));
const guard = fs.readFileSync('js/admin-daily-generator-guard.js', 'utf8');
const batchAsset = manifest.assets?.adminBatchCalendar;
const guardAsset = manifest.assets?.adminDailyGeneratorGuard;
if (!batchAsset?.path || !batchAsset?.version || !guardAsset?.path || !guardAsset?.version) {
  throw new Error('Central manifest is missing Daily generator ownership.');
}

const enrichmentIndex = admin.indexOf('nationality-enrichment.js?v=');
const batchIndex = admin.indexOf(`${batchAsset.path}?v=${batchAsset.version}`);
const guardIndex = admin.indexOf(`${guardAsset.path}?v=${guardAsset.version}`);
if (enrichmentIndex < 0 || batchIndex <= enrichmentIndex || guardIndex <= batchIndex) {
  throw new Error('Nationality context, batch calendar and Generator v3 are not ordered safely.');
}
if (!admin.includes('<button id="generateWeekBtn" class="button primary" type="button" disabled aria-busy="true">')) {
  throw new Error('Seven-day Generate button is not fail-closed in admin.html.');
}
for (const retired of [
  'js/admin-weekly-nationality-readiness-gate.js',
  'js/admin-weekly-nationality-quota-guard.js',
  'data-nationality-context-prompt-pack-v1'
]) {
  if (admin.includes(retired)) throw new Error(`Legacy nationality generation wiring remains in admin.html: ${retired}`);
}
for (const token of [
  'function syncGenerationAvailability()',
  'Boolean(cutoverState()?.ready)',
  'window.FPL_STUDIO_SCHEDULE?.status === "ready"',
  'generateButton.disabled = generationRunning || !ready',
  'const NATIONALITY_WEEKLY_TARGET = DAYS_IN_BATCH;',
  'familyOf(candidate) === "nationality"',
  'syncGenerationAvailability();'
]) {
  if (!guard.includes(token)) throw new Error(`Generator v3 readiness/nationality ownership is missing: ${token}`);
}
if (guard.includes('FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1')) {
  throw new Error('Generator v3 still depends on the retired staging nationality prompt pack.');
}

console.log(`Generator readiness verified: the curated cutover + live schedule own the fail-closed Generate button, while nationality coverage comes from the frozen authority. ${batchAsset.path}@${batchAsset.version}`);
