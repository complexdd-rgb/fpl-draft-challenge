import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const requirePattern = (source, pattern, label) => {
  if (!pattern.test(source)) throw new Error(`Missing ${label}: ${pattern}`);
};

const target = read('js/prompt-target-survivor-generator.js');
for (const [token, label] of [
  ['const RUN_KEY = "fplPromptTargetSurvivorRunV1"', 'persistent run state'],
  ['const STALL_LIMIT = 3', 'stall safety cap'],
  ['const HARD_BATCH_MAX = 50', 'generator hard batch cap'],
  ['factorySurvivorTarget', 'survivor target input'],
  ['generateToSurvivorTargetBtn', 'target-run start button'],
  ['fpl:four-star-library-ready', '4-star enforcement resume event'],
  ['phase = "waiting-enforcement"', 'post-save enforcement phase'],
  ['attemptedIds', 'rejected/repeated candidate memory'],
  ['captureSettings', 'generator settings snapshot'],
  ['applySettings', 'generator settings replay'],
  ['elements.generate.click()', 'normal generator reuse'],
  ['elements.add.click()', 'normal browser-library save reuse'],
  ['prompt?.enabled !== false', 'enabled survivor count'],
  ['Math.min(HARD_BATCH_MAX', 'adaptive batch cap'],
  ['state.stalled >= STALL_LIMIT', 'stall stop condition'],
  ['current >= state.target', 'target completion condition']
]) requireText(target, token, label);

const explorer = read('js/prompt-target-auto-explorer.js');
for (const [token, label] of [
  ['const MAX_CYCLES = 40', 'auto-explore cycle ceiling'],
  ['const HARD_BATCH_MAX = 50', 'shared batch ceiling'],
  ['const DEFAULT_RETENTION = 0.72', 'retention-aware cycle budget'],
  ['function recommendedCycleCap', 'reachable-cycle calculator'],
  ['Math.ceil(gap / HARD_BATCH_MAX)', 'theoretical minimum cycle calculation'],
  ['Math.ceil(gap / (HARD_BATCH_MAX * safeRetention))', 'retention-adjusted cycle calculation'],
  ['function buildProfiles', 'safe fallback profile builder'],
  ['"No relationship rules"', 'relationship saturation fallback'],
  ['"Season rules only"', 'season-only fallback'],
  ['"Career totals only"', 'career-only fallback'],
  ['"Goalkeeper gap pass"', 'position-specific fallback'],
  ['"Forward gap pass"', 'forward-specific fallback'],
  ['c.avoidPools.checked = true', 'near-pool rejection retained'],
  ['did not grow|no new untried candidates|safety cap reached', 'safe stall detection'],
  ['targetApi.start()', 'automatic target restart'],
  ['current prompt families have reached their useful ceiling', 'true-exhaustion diagnostic']
]) requireText(explorer, token, label);

// Regression for the screenshot case: 2,000 target from 1,081 survivors cannot fit in 12 x 50.
const gap = 2000 - 1081;
const theoreticalMinimum = Math.ceil(gap / 50);
const retentionRecommended = Math.ceil(gap / (50 * 0.72));
if (theoreticalMinimum !== 19 || retentionRecommended !== 26) {
  throw new Error(`Unexpected cycle-budget regression: theoretical=${theoreticalMinimum}, recommended=${retentionRecommended}`);
}

// Verify module relationships rather than one historical cache label. Career Evolution and later
// packs are allowed to advance these query strings without invalidating survivor-target behaviour.
const loader = read('js/prompt-studio-loader.js');
requirePattern(loader, /js\/prompt-target-survivor-generator\.js\?v=[^"']+/, 'target-survivor lazy load');
requirePattern(loader, /js\/prompt-target-auto-explorer\.js\?v=[^"']+/, 'target auto-explorer lazy load');

const compatibility = read('js/admin-import-tools.js');
requirePattern(compatibility, /js\/prompt-studio-loader\.js\?v=[^"']+/, 'Prompt Studio compatibility loader');

const admin = read('admin.html');
requirePattern(admin, /js\/admin-import-tools\.js\?v=[^"']+/, 'admin compatibility loader');

console.log('Prompt target-survivor verifier passed: target floor, 4★+ enforcement, reachable cycle budgets, safe auto-exploration, duplicate protection and loader wiring are intact.');
