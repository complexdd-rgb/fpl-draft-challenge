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

assert(promptStudio.includes('<strong>Prompt Builder</strong><small>Create prompts against one explicit schema.</small><em>Live</em>'), 'Prompt Builder roadmap status is not Live.');
assert(promptStudio.includes('<strong>Quality Analyser</strong><small>Test candidates before they are promoted.</small><em>Live</em>'), 'Quality Analyser roadmap status is not Live.');
assert(promptStudio.includes('<strong>Curated Library</strong><small>4,897 frozen survivors across all 17 families now power Daily generation.</small><em>Live</em>'), 'Curated Library roadmap status is not Live.');
assert(promptStudio.includes('<strong>Daily Challenge redesign</strong><small>Rework the player-facing Daily Challenge experience now that prompt authority is stable.</small><em>Next</em>'), 'Daily Challenge redesign is not the next roadmap item.');
assert(!promptStudio.includes('<strong>Refinement Incubator</strong>'), 'Completed Refinement Incubator still appears in the visible Prompt Studio roadmap.');

const sandbox = { window: { addEventListener: () => {} } };
vm.runInNewContext(read('players.js'), sandbox, { filename: 'players.js', timeout: 10000 });
const players = Array.isArray(sandbox.window.FPL_PLAYERS) ? sandbox.window.FPL_PLAYERS : [];
for (const aliases of [['Doni'], ['Hilario', 'Hilário']]) {
  const player = players.find(item => aliases.includes(item?.name));
  assert(player, `Verified mononym missing from players.js: ${aliases.join(' / ')}`);
  assert(player.mononymVerified === true, `Verified mononym flag missing for ${player.name}`);
}

console.log('Admin UI truth verified: retired imports stay removed, Prompt Studio shows the frozen curated library as Live, Daily redesign is Next, and Doni/Hilario remain verified mononyms.');
