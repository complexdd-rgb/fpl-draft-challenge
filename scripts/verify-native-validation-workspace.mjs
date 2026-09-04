import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const count = (source, token) => source.split(token).length - 1;
const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
};

const html = read('admin.html');
const stage = read('js/admin-stage-one.js');

const templateStart = html.indexOf('<!-- STUDIO_NATIVE_WORKSPACE_TEMPLATE_START -->');
const templateEnd = html.indexOf('<!-- STUDIO_NATIVE_WORKSPACE_TEMPLATE_END -->');
const mainClose = html.indexOf('</main>');
const validationWorkspace = html.indexOf('id="workspace-validation"');
const validationPanel = html.indexOf('id="validationLabPanel"');
const validationMarker = html.indexOf('<!-- STUDIO_NATIVE_VALIDATION_PANEL_START -->');

if (count(html, 'id="validationLabPanel"') !== 1) {
  throw new Error('Validation Lab panel must exist exactly once after native migration.');
}
if (!(mainClose >= 0 && templateStart > mainClose && validationWorkspace > templateStart && validationPanel > validationWorkspace && validationPanel < templateEnd)) {
  throw new Error('Validation Lab panel must live inside the native Validation workspace template and outside the legacy <main> panel sequence.');
}
if (!(validationMarker > validationWorkspace && validationMarker < validationPanel)) {
  throw new Error('Native Validation Lab migration marker is missing or misplaced.');
}

for (const id of [
  'validationPlayerSearch',
  'validationSeasonSelect',
  'validationInspectBtn',
  'validationPromptSelect',
  'validationEvaluateBtn',
  'validationExplorerPromptSelect',
  'validationExploreBtn',
  'validationHealthSeason',
  'validationHealthBtn',
  'validationCertifyBtn'
]) {
  if (count(html, `id="${id}"`) !== 1) throw new Error(`Validation Lab control ${id} must remain unique after migration.`);
}

requireText(stage, 'Panels authored directly inside native workspaces never pass through originalChildren.', 'native panel labelling contract');
requireText(stage, 'workspaces.forEach((workspace, workspaceId) => {', 'native workspace panel labelling loop');
requireText(stage, 'if (!element.classList.contains("stage-one-tool-panel")) labelToolPanel(element, workspaceId);', 'native panel shared behaviour');

const stageIndex = html.indexOf('js/admin-stage-one.js?v=');
const validationScriptIndex = html.indexOf('js/validation-lab.js?v=');
if (!(stageIndex > templateEnd && validationScriptIndex > stageIndex)) {
  throw new Error('Stage One must activate the native Validation markup before validation-lab.js binds its controls.');
}

console.log('Native Validation Lab workspace verified: one authored panel, no legacy re-parent source, stable control IDs, and shared Stage One behaviour preserved.');
