import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const html = read('admin.html');
const stageOne = read('js/admin-stage-one.js');
const fragment = read('fragments/admin-daily-workspace.html');
const manifest = JSON.parse(read('config/asset-manifest.json'));

const requiredIds = [
  'batchPlanner',
  'draftPanel',
  'testPanel',
  'codePanel'
];

function count(source, token) {
  return source.split(token).length - 1;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const mainStart = html.indexOf('<main class="studio-shell">');
const mainEnd = html.indexOf('\n  </main>', mainStart);
assert(mainStart >= 0 && mainEnd > mainStart, 'Legacy Studio <main> boundaries were not found.');
const legacyMain = html.slice(mainStart, mainEnd);

const challengeStart = html.indexOf('<section class="studio-workspace" data-workspace="challenge" id="workspace-challenge"');
const promptStart = html.indexOf('<section class="studio-workspace" data-workspace="prompts" id="workspace-prompts"', challengeStart + 1);
const validationStart = html.indexOf('<section class="studio-workspace" data-workspace="validation" id="workspace-validation"', promptStart + 1);
assert(challengeStart >= 0 && promptStart > challengeStart, 'Native Daily/Prompt workspace boundaries were not found.');
const challengeWorkspace = html.slice(challengeStart, promptStart);
const promptWorkspace = validationStart > promptStart ? html.slice(promptStart, validationStart) : '';

assert(count(html, '<!-- STUDIO_NATIVE_DAILY_WORKSPACE_START -->') === 1, 'Expected exactly one native Daily workspace start marker.');
assert(count(html, '<!-- STUDIO_NATIVE_DAILY_WORKSPACE_END -->') === 1, 'Expected exactly one native Daily workspace end marker.');
assert(challengeWorkspace.includes('<h2>Challenge settings</h2>'), 'Challenge settings are not authored inside the native Daily workspace.');
assert(!legacyMain.includes('<h2>Challenge settings</h2>'), 'Legacy <main> still contains Challenge settings.');
assert(!challengeWorkspace.includes('id="libraryManagerPanel"'), 'Prompt Library Manager leaked into the Daily workspace.');
if (html.includes('<!-- STUDIO_NATIVE_PROMPT_WORKSPACE_START -->')) {
  assert(promptWorkspace.includes('id="libraryManagerPanel"'), 'Prompt Library Manager is not inside the native Prompt Studio workspace.');
  assert(!legacyMain.includes('id="libraryManagerPanel"'), 'Legacy <main> still contains Prompt Library Manager after native migration.');
}

requiredIds.forEach(id => {
  const token = `id="${id}"`;
  assert(count(html, token) === 1, `Expected exactly one ${token} in admin.html.`);
  assert(challengeWorkspace.includes(token), `${token} is not inside the native Daily workspace.`);
  assert(!legacyMain.includes(token), `${token} still exists in the legacy <main>.`);
  assert(fragment.includes(token), `${token} is missing from the canonical Daily fragment.`);
});

assert(!fragment.includes('id="historyPanel"'), 'The retired visible Challenge history and cooldown panel still exists in the canonical fragment.');
assert(!challengeWorkspace.includes('id="historyPanel"'), 'The retired visible Challenge history and cooldown panel still exists in admin.html.');
assert(fragment.includes('id="dailyHistoryCompatibility" hidden'), 'Hidden history compatibility controls are missing while the legacy controller still records rotation data.');
assert(challengeWorkspace.includes('id="dailyHistoryCompatibility" hidden'), 'Generated Daily workspace is missing the hidden history compatibility controls.');
for (const id of ['cooldownSummary', 'recordHistoryBtn', 'downloadHistoryBtn', 'downloadHistoryMarkdownBtn', 'historyActionStatus', 'historyList']) {
  assert(fragment.includes(`id="${id}"`), `Hidden compatibility control ${id} is missing from the canonical Daily fragment.`);
}

assert(fragment.includes('id="generateWeekBtn"'), 'Seven-day generator control is missing from the canonical Daily fragment.');
assert(fragment.includes('id="downloadWeekBtn"'), 'Seven-day ZIP control is missing from the canonical Daily fragment.');
assert(fragment.includes('id="batchStatus"'), 'Seven-day generator status is missing from the canonical Daily fragment.');
assert(fragment.includes('id="maxPerfectScore"'), 'Maximum perfect score control is missing from the canonical Daily fragment.');

const redundantClassifier = 'if (/challenge settings|review the generated xi|test mode|download-ready challenge|challenge history|daily challenge/.test(title)) return "challenge";';
assert(!stageOne.includes(redundantClassifier), 'Redundant Daily title classifier still exists in admin-stage-one.js.');
assert(stageOne.includes('return "challenge";'), 'Stage One fallback workspace classification was removed unexpectedly.');

const stageAsset = manifest.assets?.adminStageOne;
assert(stageAsset?.path === 'js/admin-stage-one.js', 'Central manifest no longer owns Admin Stage One.');
assert(Boolean(stageAsset.version), 'Admin Stage One must keep a cache version.');
assert(html.includes(`${stageAsset.path}?v=${stageAsset.version}`), 'admin.html is not using the manifest-owned Admin Stage One cache version.');

assert(count(html, 'js/admin-batch-calendar.js') === 1, 'admin-batch-calendar.js should still load exactly once.');
assert(count(html, 'js/admin-daily-generator-guard.js') === 1, 'admin-daily-generator-guard.js should still load exactly once.');

console.log('Native Daily workspace verification passed.');
console.log(JSON.stringify({
  canonicalFragmentLines: fragment.split('\n').length,
  nativeDailyPanels: requiredIds.length,
  visibleHistoryPanelRetired: true,
  hiddenHistoryCompatibility: true,
  legacyDailyPanelsRemaining: requiredIds.filter(id => legacyMain.includes(`id="${id}"`)).length,
  redundantClassifierRemoved: true
}, null, 2));
