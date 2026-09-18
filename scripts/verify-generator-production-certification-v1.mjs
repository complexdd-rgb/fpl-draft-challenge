import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const runner = read("js/admin-generator-production-certification-v1.js");
const admin = read("admin.html");
const guard = read("js/admin-daily-generator-guard.js");
const manifest = JSON.parse(read("config/asset-manifest.json"));

for (const token of [
  'Generator v3.2 production certification runner v1.0.0',
  'const FORMATION_ORDER = Object.freeze(["4-4-2", "4-3-3", "3-4-3", "3-5-2", "5-3-2", "5-4-1", "4-2-3-1"])',
  'await guard.generate();',
  'batch.clear?.(false);',
  'uniqueIds.size !== WEEKLY_PROMPTS',
  'result.promptMix?.nationality',
  'Number(plan?.nationalityCount || 0) !== DAYS',
  'result.antiMetaCount',
  'representedFamilies !== 18',
  'excludeTopResultTarget',
  'sameDayRepeatPrompts',
  'spacingViolationCount',
  'hardCapBreachCount',
  'maxAppearanceDays',
  'getLastFamilyPlan',
  'getLastTiming',
  'getTopAnswerDayAudit',
  'fpl-generator-v3-production-certification',
  'fpl:generator-production-certification-complete',
  'Download certification JSON',
  'This does not publish or alter the Supabase schedule.',
  'event.target instanceof Element ? event.target.closest("#publishWeekSupabaseBtn") : null',
  'event.stopImmediatePropagation();',
  'Publishing is locked while the read-only production certification sweep is running.'
]) {
  assert(runner.includes(token), `Production certification runner is missing: ${token}`);
}

for (const forbidden of [
  'action: "publish"',
  "action: 'publish'",
  'publishCurrentBatch(',
  'daily-challenge-publish',
  '.click(); // publish',
  'FPL_STUDIO_SCHEDULE.scheduled =',
  'localStorage.setItem('
]) {
  assert(!runner.includes(forbidden), `Production certification runner contains a forbidden mutation/publish path: ${forbidden}`);
}

const guardIndex = admin.indexOf('js/admin-daily-generator-guard.js');
const certIndex = admin.indexOf('js/admin-generator-production-certification-v1.js');
const bootstrapIndex = admin.indexOf('js/studio-bootstrap.js');
assert(guardIndex >= 0 && certIndex > guardIndex, 'Production certification runner must load after the Daily generator guard.');
assert(bootstrapIndex < 0 || certIndex < bootstrapIndex, 'Production certification runner should bind before Studio bootstrap can rewrite workspace state.');

const asset = manifest.assets?.adminGeneratorProductionCertificationV1;
assert(asset?.path === 'js/admin-generator-production-certification-v1.js', 'Central asset manifest is missing the production certification runner.');
assert(asset?.version === '1.0.0', 'Production certification runner version drifted.');
assert(manifest.assets?.adminDailyGeneratorGuard?.version === '3.2.1-exact-nationality', 'Production certification must remain pinned to Generator v3.2.1.');
assert(guard.includes('familyOf(candidate) === "nationality" && state.nationalityCount >= NATIONALITY_WEEKLY_TARGET'), 'Generator can still admit nationality prompts after the exact weekly quota is filled.');
assert(guard.includes('state.nationalityCount !== NATIONALITY_WEEKLY_TARGET'), 'Generator does not defensively require exactly seven nationality prompts before accepting a reservoir.');

console.log("Generator v3.2.1 production certification runner boundary verified.");
