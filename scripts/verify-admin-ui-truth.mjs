import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const admin = read('admin.html');
const core = read('js/admin-core.js');
const stage = read('js/admin-stage-one.js');
const baseCss = read('admin-base.css');
const promptStudio = read('js/prompt-studio-clean-reset.js');

for (const token of ['importCentreHeading','identityConsolidationCentre','data-open-workspace="imports"','data-workspace="imports"']) {
  assert(!admin.includes(token), `Retired Historical Imports UI returned: ${token}`);
}
for (const token of ['BEGIN admin-phase10.js','BEGIN admin-phase11.js']) assert(!core.includes(token), `Retired admin runtime returned: ${token}`);
assert(!stage.includes('id: "imports"'), 'Stage One still owns Historical Imports.');
assert(!stage.includes('dashboardImportStatus'), 'Stage One still tracks Historical Imports status.');
assert(!baseCss.includes('Historical database import centre'), 'Historical import CSS remains.');
assert(!baseCss.includes('Player identity consolidation'), 'Identity consolidation CSS remains.');

assert(promptStudio.includes('<strong>Prompt Builder</strong><small>Create candidates and future families against the current player schema.</small><em>Live</em>'), 'Prompt Builder permanent workflow status is not Live.');
assert(promptStudio.includes('<strong>Quality Analyser</strong><small>Reject duplicates and weak candidates before promotion.</small><em>Live</em>'), 'Quality Analyser permanent workflow status is not Live.');
assert(promptStudio.includes('<strong>Promotion + source archive</strong><small>Persist approved candidates without changing Daily authority.</small><em>Live</em>'), 'Promotion/source archive workflow status is not Live.');
assert(promptStudio.includes('<strong>Curated Daily authority</strong><small>${DAILY_CURATED_COUNT.toLocaleString("en-GB")} frozen survivors currently power generation.</small><em>Live</em>'), 'Curated Daily authority workflow status is not Live.');
assert(promptStudio.includes('New-family safety boundary'), 'Prompt Studio no longer explains the future-family safety boundary.');
assert(!promptStudio.includes('<strong>Refinement Incubator</strong>'), 'Completed Refinement Incubator still appears in Prompt Studio.');
assert(!promptStudio.includes('Full-library evidence layer'), 'Completed evidence layer still appears in Prompt Studio.');
assert(!promptStudio.includes('Full-library survivor builder'), 'Completed survivor builder still appears in Prompt Studio.');

const sandbox = { window: { addEventListener: () => {} } };
vm.runInNewContext(read('players.js'), sandbox, { filename: 'players.js', timeout: 10000 });
const players = Array.isArray(sandbox.window.FPL_PLAYERS) ? sandbox.window.FPL_PLAYERS : [];
for (const aliases of [['Doni'], ['Hilario', 'Hilário']]) {
  const player = players.find(item => aliases.includes(item?.name));
  assert(player, `Verified mononym missing from players.js: ${aliases.join(' / ')}`);
  assert(player.mononymVerified === true, `Verified mononym flag missing for ${player.name}`);
}

console.log('Admin UI truth verified: retired imports stay removed, Prompt Studio exposes only the permanent future-family workflow, the frozen 4,897 Daily authority remains visible, and Doni/Hilario remain verified mononyms.');
