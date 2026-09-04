import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const html = read('admin.html');
const stageOne = read('js/admin-stage-one.js');
const fragment = read('fragments/admin-prompt-workspace.html');
const redesign = read('js/prompt-studio-redesign.js');
const css = read('admin-prompt-studio-v2.css');
const manifest = JSON.parse(read('config/asset-manifest.json'));
const bootstrap = read('js/studio-bootstrap.js');
const adminCss = read('admin.css');

const requiredIds = [
  'libraryManagerPanel',
  'automaticPromptFactory',
  'promptQualityAnalyser',
  'promptEditor',
  'promptManagerList'
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

const promptStart = html.indexOf('<section class="studio-workspace" data-workspace="prompts" id="workspace-prompts"');
const validationStart = html.indexOf('<section class="studio-workspace" data-workspace="validation" id="workspace-validation"', promptStart + 1);
assert(promptStart >= 0 && validationStart > promptStart, 'Native Prompt/Validation workspace boundaries were not found.');
const promptWorkspace = html.slice(promptStart, validationStart);

assert(count(html, '<!-- STUDIO_NATIVE_PROMPT_WORKSPACE_START -->') === 1, 'Expected exactly one native Prompt Studio start marker.');
assert(count(html, '<!-- STUDIO_NATIVE_PROMPT_WORKSPACE_END -->') === 1, 'Expected exactly one native Prompt Studio end marker.');
assert(!legacyMain.includes('id="libraryManagerPanel"'), 'Legacy <main> still contains Prompt Library Manager.');
assert(promptWorkspace.includes('One library for live prompts, creation, quality control and promotion review.'), 'Native Prompt Studio heading copy was not updated.');
assert(!promptWorkspace.includes('id="databaseAuditorPanel"'), 'Database Auditor leaked into the Prompt Studio workspace.');

requiredIds.forEach(id => {
  const token = `id="${id}"`;
  assert(count(html, token) === 1, `Expected exactly one ${token} in admin.html.`);
  assert(promptWorkspace.includes(token), `${token} is not inside the native Prompt Studio workspace.`);
  assert(!legacyMain.includes(token), `${token} still exists in the legacy <main>.`);
  assert(fragment.includes(token), `${token} is missing from the canonical Prompt Studio fragment.`);
});

const redundantClassifier = 'if (/prompt library|prompt quality|prompt studio/.test(title)) return "prompts";';
assert(!stageOne.includes(redundantClassifier), 'Redundant Prompt Studio title classifier still exists in admin-stage-one.js.');
assert(stageOne.includes('return "challenge";'), 'Stage One fallback workspace classification was removed unexpectedly.');

assert(redesign.includes('data-prompt-view="library"'), 'Prompt redesign is missing Library navigation.');
assert(redesign.includes('data-prompt-view="create"'), 'Prompt redesign is missing Create navigation.');
assert(redesign.includes('data-prompt-view="quality"'), 'Prompt redesign is missing Quality navigation.');
assert(redesign.includes('data-prompt-view="review"'), 'Prompt redesign is missing Review navigation.');
assert(redesign.includes('Save generated prompts disabled for review'), 'Automatic prompt creation is not locked to disabled review candidates.');
assert(redesign.includes('Promotion gate passed'), 'Review workflow is missing the repository-promotion gate state.');
assert(css.includes('.prompt-studio-tabs'), 'Prompt Studio v2 CSS is missing the tab navigation rules.');
assert(css.includes('.prompt-review-card'), 'Prompt Studio v2 CSS is missing review cards.');
assert(adminCss.includes('admin-prompt-studio-v2.css?v=2.0.0'), 'admin.css is not loading Prompt Studio v2 styles.');

const redesignAsset = manifest.assets?.promptStudioRedesign;
assert(redesignAsset?.path === 'js/prompt-studio-redesign.js', 'Central manifest is missing promptStudioRedesign.');
assert(redesignAsset?.version === '2.0.0', 'Prompt Studio redesign must be cache-versioned at 2.0.0.');
assert(bootstrap.includes('ensurePromptRedesign'), 'Studio bootstrap does not own Prompt Studio redesign loading.');
assert(bootstrap.includes('promptStudioRedesign'), 'Studio bootstrap is not using the manifest-owned Prompt Studio redesign asset.');

const stageAsset = manifest.assets?.adminStageOne;
assert(stageAsset?.path === 'js/admin-stage-one.js', 'Central manifest no longer owns Admin Stage One.');
assert(Boolean(stageAsset?.version), 'Admin Stage One must keep a cache version.');
assert(html.includes(`${stageAsset.path}?v=${stageAsset.version}`), 'admin.html is not using the manifest-owned Admin Stage One cache version.');

console.log('Native Prompt Studio workspace verification passed.');
console.log(JSON.stringify({
  canonicalFragmentLines: fragment.split('\n').length,
  nativePromptTools: requiredIds.length,
  legacyPromptToolsRemaining: requiredIds.filter(id => legacyMain.includes(`id="${id}"`)).length,
  subviews: ['library','create','quality','review'],
  redundantClassifierRemoved: true
}, null, 2));
