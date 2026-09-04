import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const redesign = read('js/prompt-studio-redesign.js');
const canonical = read('js/prompt-library-canonical-state.js');
const html = read('admin.html');
const fragment = read('fragments/admin-prompt-workspace.html');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const view of ['library', 'create', 'quality', 'review']) {
  assert(redesign.includes(`data-prompt-view=\"${view}\"`), `Prompt Studio redesign is missing the ${view} view.`);
}

assert(redesign.includes('Save generated prompts disabled for review'), 'Automatic Prompt Factory can no longer be proven review-first.');
assert(redesign.includes('enabled.checked = false'), 'Create flow does not explicitly force new prompt drafts disabled.');
assert(redesign.includes('Promotion gate passed'), 'Review queue has lost the promotion-gate state.');
assert(!redesign.includes('prompt.enabled = true'), 'Redesign controller must never directly promote a prompt to enabled.');
assert(redesign.includes('values.length === current.total'), 'Review queue no longer proves analyser evidence belongs to the current canonical library.');
assert(redesign.includes('Quality evidence is shown only after a current full-library analysis.'), 'Review queue no longer explains stale analyser evidence.');
assert(canonical.includes('Only repository-certified prompts can be enabled; promote it first or delete it.'), 'Canonical state no longer blocks non-production manual enablement.');
assert(canonical.includes('EXPECTED_PRODUCTION = 851'), 'Canonical production count changed unexpectedly.');
assert(html.includes('<!-- STUDIO_NATIVE_PROMPT_WORKSPACE_START -->'), 'Prompt Studio is not authored in the native workspace.');
assert(fragment.includes('id="factoryEnablePrompts"'), 'Automatic factory control IDs changed during native migration.');
assert(fragment.includes('id="promptEditorEnabled"'), 'Manual editor enabled control ID changed during native migration.');
assert(fragment.includes('id="runPromptQualityBtn"'), 'Quality analyser controls changed during native migration.');

console.log('Prompt Studio v2 policy verification passed: four focused views, review-first creation, current quality evidence and repository-only promotion remain enforced.');
