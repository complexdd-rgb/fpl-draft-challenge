import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  assert(first >= 0, `${label}: source token not found`);
  assert(source.indexOf(from, first + from.length) < 0, `${label}: source token is not unique`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function removeMarkedBlock(source, begin, end, label) {
  const start = source.indexOf(begin);
  const finish = source.indexOf(end, start + begin.length);
  assert(start >= 0 && finish >= 0, `${label}: markers not found`);
  return source.slice(0, start) + source.slice(finish + end.length).replace(/^\n{0,2}/, '\n\n');
}

function removeRegexOnce(source, regex, label) {
  const matches = [...source.matchAll(regex)];
  assert(matches.length === 1, `${label}: expected exactly one match, got ${matches.length}`);
  return source.replace(regex, '');
}

// 1) Resolve the two verified mononyms at the canonical player-data layer.
let players = read('players.js');
function markVerifiedMononym(names) {
  let hit = null;
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`"name"\\s*:\\s*"${escaped}"`, 'g');
    const matches = [...players.matchAll(regex)];
    if (matches.length) {
      assert(matches.length === 1 && !hit, `Expected one unique player match for ${names.join(' / ')}`);
      hit = { name, match: matches[0] };
    }
  }
  assert(hit, `Could not find verified mononym ${names.join(' / ')}`);
  const index = hit.match.index;
  const end = index + hit.match[0].length;
  const nearby = players.slice(end, end + 240);
  if (/^\s*,\s*"mononymVerified"\s*:\s*true/.test(nearby)) return;
  players = players.slice(0, end) + ',"mononymVerified":true' + players.slice(end);
}
markVerifiedMononym(['Doni']);
markVerifiedMononym(['Hilario', 'Hilário']);
write('players.js', players);

// 2) Remove the Historical Import Centre + Identity Consolidation from authored admin markup.
let admin = read('admin.html');
const importStartToken = '<section class="studio-section import-centre-section"';
const leaderboardStartToken = '<section class="panel" id="leaderboardBackendPanel"';
const importStart = admin.indexOf(importStartToken);
const leaderboardStart = admin.indexOf(leaderboardStartToken);
assert(importStart >= 0 && leaderboardStart > importStart, 'admin.html: import/identity block boundary not found');
admin = admin.slice(0, importStart) + admin.slice(leaderboardStart);
admin = removeRegexOnce(
  admin,
  /\n\s*<button class="studio-nav-button"[^>]*data-open-workspace="imports"[\s\S]*?<\/button>/g,
  'admin.html native Historical Imports nav button'
);
admin = removeRegexOnce(
  admin,
  /\n\s*<section class="studio-workspace" data-workspace="imports"[^>]*>[\s\S]*?<\/section>/g,
  'admin.html native Historical Imports workspace'
);
admin = replaceOnce(
  admin,
  '<h1>Build, test, analyse, publish, audit and expand the historical database safely</h1>',
  '<h1>Build, test, analyse, publish and audit safely</h1>',
  'admin hero title'
);
admin = replaceOnce(
  admin,
  '<p class="hero-copy">Generate and review the XI, create relational anti-meta prompts, analyse prompt quality, review the library, publish checked daily challenges, audit the player database and import verified historical seasons without touching the live game.</p>',
  '<p class="hero-copy">Generate and review the XI, create relational anti-meta prompts, analyse prompt quality, review the library, publish checked daily challenges and audit the player database without touching the live game.</p>',
  'admin hero copy'
);
admin = replaceOnce(admin, 'admin.css?v=16.2.1-pass30', 'admin.css?v=16.3.0-imports-retired', 'admin.css cache tag');
admin = replaceOnce(admin, 'js/admin-core.js?v=19.0.3-publish-copy', 'js/admin-core.js?v=19.1.0-imports-retired', 'admin-core cache tag');
write('admin.html', admin);

// 3) Retire both browser runtimes now that their UI is gone.
let core = read('js/admin-core.js');
core = removeMarkedBlock(core, '/* ===== BEGIN admin-phase10.js ===== */', '/* ===== END admin-phase10.js ===== */', 'admin phase 10 importer');
core = removeMarkedBlock(core, '/* ===== BEGIN admin-phase11.js ===== */', '/* ===== END admin-phase11.js ===== */', 'admin phase 11 identity consolidation');
write('js/admin-core.js', core);

// 4) Remove Stage One navigation/status ownership for the retired workspace.
let stage = read('js/admin-stage-one.js');
stage = removeRegexOnce(stage, /,?\n\s*\{\n\s*id: "imports",\n\s*label: "Historical Imports",\n\s*title: "Historical Imports",\n\s*icon: "↥",\n\s*description: "Import verified historical seasons and review identity matches safely\."\n\s*\}/g, 'Stage One imports definition');
stage = replaceOnce(stage, '    if (/historical database import|official fpl archive import|archive import|identity consolidation/.test(title)) return "imports";\n', '', 'Stage One imports classifier');
stage = removeRegexOnce(stage, /\n\s*<button class="dashboard-action-card" type="button" data-open-workspace="imports"[\s\S]*?<\/button>/g, 'Stage One imports dashboard card');
stage = replaceOnce(stage, '    if (!hasSavedPreference) values.push("identityConsolidationCentre");\n', '', 'Stage One identity collapse preference');
stage = replaceOnce(
  stage,
  '    if (copy) copy.textContent = "Create the daily challenge, manage prompts, audit the player database and import historical seasons from one focused workspace.";',
  '    if (copy) copy.textContent = "Create the daily challenge, manage prompts and audit the player database from one focused workspace.";',
  'Stage One hero copy'
);
stage = replaceOnce(stage, '    const importText = document.getElementById("importCentreStatus")?.textContent?.trim() || "Waiting for files";\n', '', 'Stage One import status source');
stage = replaceOnce(stage, '      database: effectiveBlockers > 0 ? String(effectiveBlockers) : auditHasRun ? "✓" : "!",\n      imports: /waiting/i.test(importText) ? "" : "•"\n', '      database: effectiveBlockers > 0 ? String(effectiveBlockers) : auditHasRun ? "✓" : "!"\n', 'Stage One imports badge');
stage = replaceOnce(stage, '    const importStatus = document.getElementById("dashboardImportStatus");\n', '', 'Stage One import dashboard status binding');
stage = replaceOnce(stage, '    if (importStatus) importStatus.textContent = importText;\n', '', 'Stage One import dashboard status update');
stage = replaceOnce(stage, '      "libraryStatus", "batchStatus", "importCentreStatus", "auditPlayerCount"\n', '      "libraryStatus", "batchStatus", "auditPlayerCount"\n', 'Stage One watched import status');
write('js/admin-stage-one.js', stage);

// 5) Remove dead CSS for both retired tools and bump the base stylesheet cache tag.
let baseCss = read('admin-base.css');
const cssStart = baseCss.indexOf('/* Historical database import centre */');
const cssEnd = baseCss.indexOf('/* Phase 13 — automatic prompt factory */', cssStart);
assert(cssStart >= 0 && cssEnd > cssStart, 'admin-base.css: import/identity CSS block boundary not found');
baseCss = baseCss.slice(0, cssStart) + baseCss.slice(cssEnd);
write('admin-base.css', baseCss);
let adminCss = read('admin.css');
adminCss = replaceOnce(adminCss, './admin-base.css?v=16.2.4', './admin-base.css?v=16.3.0', 'admin-base cache tag');
write('admin.css', adminCss);

// 6) Make the Prompt Studio roadmap truthful now that Builder and Quality are live.
let promptStudio = read('js/prompt-studio-clean-reset.js');
promptStudio = replaceOnce(promptStudio, '<strong>Prompt Builder</strong><small>Create prompts against one explicit schema.</small><em>Next</em>', '<strong>Prompt Builder</strong><small>Create prompts against one explicit schema.</small><em>Live</em>', 'Prompt Builder status');
promptStudio = replaceOnce(promptStudio, '<strong>Quality Analyser</strong><small>Test candidates before anything enters the canonical library.</small><em>Planned</em>', '<strong>Quality Analyser</strong><small>Test candidates before anything enters the canonical library.</small><em>Live</em>', 'Quality Analyser status');
promptStudio = replaceOnce(promptStudio, '<strong>Refinement Incubator</strong><small>Rebuild survivor generation without legacy packs.</small><em>Planned</em>', '<strong>Refinement Incubator</strong><small>Curate and compress the promoted candidate universe into a balanced survivor library.</small><em>Next</em>', 'Refinement Incubator status');
write('js/prompt-studio-clean-reset.js', promptStudio);

// 7) Bump only the two centrally-owned runtime assets changed in this pass.
const manifestPath = 'config/asset-manifest.json';
const manifest = JSON.parse(read(manifestPath));
assert(manifest.assets?.adminStageOne?.path === 'js/admin-stage-one.js', 'Central manifest no longer owns adminStageOne');
assert(manifest.assets?.promptStudioClean?.path === 'js/prompt-studio-clean-reset.js', 'Central manifest no longer owns promptStudioClean');
manifest.assets.adminStageOne.version = '1.6.0-imports-retired';
manifest.assets.promptStudioClean.version = '1.2.0-roadmap-truth';
write(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// 8) Update permanent clean-boundary assertions.
let cleanVerifier = read('scripts/verify-prompt-studio-clean-reset.mjs');
cleanVerifier = replaceOnce(
  cleanVerifier,
  'assert(admin.includes(\'data-open-workspace="imports"\'), \'Historical Imports navigation is missing from the active Studio shell.\');\nassert(admin.includes(\'data-workspace="imports"\'), \'Historical Imports workspace is missing from the active Studio shell.\');',
  'assert(!admin.includes(\'data-open-workspace="imports"\'), \'Retired Historical Imports navigation returned to the active Studio shell.\');\nassert(!admin.includes(\'data-workspace="imports"\'), \'Retired Historical Imports workspace returned to the active Studio shell.\');\nassert(!stageOne.includes(\'id: "imports"\'), \'Stage One still owns the retired Historical Imports workspace.\');',
  'clean verifier Historical Imports boundary'
);
write('scripts/verify-prompt-studio-clean-reset.mjs', cleanVerifier);

// 9) Add a permanent verifier for the UI retirement + mononym decisions.
write('scripts/verify-admin-ui-truth.mjs', `import fs from 'node:fs';\nimport vm from 'node:vm';\n\nconst read = path => fs.readFileSync(path, 'utf8');\nconst assert = (condition, message) => { if (!condition) throw new Error(message); };\n\nconst admin = read('admin.html');\nconst core = read('js/admin-core.js');\nconst stage = read('js/admin-stage-one.js');\nconst baseCss = read('admin-base.css');\nconst promptStudio = read('js/prompt-studio-clean-reset.js');\n\nfor (const token of ['importCentreHeading','identityConsolidationCentre','data-open-workspace="imports"','data-workspace="imports"']) {\n  assert(!admin.includes(token), \`Retired Historical Imports UI returned: \${token}\`);\n}\nfor (const token of ['BEGIN admin-phase10.js','BEGIN admin-phase11.js']) assert(!core.includes(token), \`Retired admin runtime returned: \${token}\`);\nassert(!stage.includes('id: "imports"'), 'Stage One still owns Historical Imports.');\nassert(!stage.includes('dashboardImportStatus'), 'Stage One still tracks Historical Imports status.');\nassert(!baseCss.includes('Historical database import centre'), 'Historical import CSS remains.');\nassert(!baseCss.includes('Player identity consolidation'), 'Identity consolidation CSS remains.');\nassert(promptStudio.includes('<strong>Prompt Builder</strong><small>Create prompts against one explicit schema.</small><em>Live</em>'), 'Prompt Builder roadmap status is not Live.');\nassert(promptStudio.includes('<strong>Quality Analyser</strong><small>Test candidates before anything enters the canonical library.</small><em>Live</em>'), 'Quality Analyser roadmap status is not Live.');\nassert(promptStudio.includes('<strong>Refinement Incubator</strong><small>Curate and compress the promoted candidate universe into a balanced survivor library.</small><em>Next</em>'), 'Refinement Incubator roadmap status is not Next.');\n\nconst sandbox = { window: {} };\nvm.runInNewContext(read('players.js'), sandbox, { filename: 'players.js', timeout: 10000 });\nconst players = Array.isArray(sandbox.window.FPL_PLAYERS) ? sandbox.window.FPL_PLAYERS : [];\nfor (const aliases of [['Doni'], ['Hilario', 'Hilário']]) {\n  const player = players.find(item => aliases.includes(item?.name));\n  assert(player, \`Verified mononym missing from players.js: \${aliases.join(' / ')}\`);\n  assert(player.mononymVerified === true, \`Verified mononym flag missing for \${player.name}\`);\n}\n\nconsole.log('Admin UI truth verified: Historical Imports retired, roadmap statuses current, Doni/Hilario verified mononyms.');\n`);

// 10) Update Studio regression to protect the new boundary permanently.
let regression = read('.github/workflows/studio-regression.yml');
regression = replaceOnce(
  regression,
  "          grep -q 'BEGIN admin-phase10.js' js/admin-core.js\n          grep -q 'BEGIN admin-phase11.js' js/admin-core.js\n          grep -q 'id=\"databaseAuditorPanel\"' admin.html\n          grep -q 'id=\"importCentreHeading\"' admin.html\n          grep -q 'id=\"identityConsolidationCentre\"' admin.html",
  "          ! grep -q 'BEGIN admin-phase10.js' js/admin-core.js\n          ! grep -q 'BEGIN admin-phase11.js' js/admin-core.js\n          grep -q 'id=\"databaseAuditorPanel\"' admin.html\n          ! grep -q 'id=\"importCentreHeading\"' admin.html\n          ! grep -q 'id=\"identityConsolidationCentre\"' admin.html\n          node scripts/verify-admin-ui-truth.mjs",
  'Studio regression importer boundary'
);
regression = replaceOnce(
  regression,
  "          grep -q 'id: \"imports\"' js/admin-stage-one.js\n          grep -q 'Player Database Auditor' js/admin-stage-one.js\n          grep -q 'Historical Database Import Centre' js/admin-stage-one.js",
  "          ! grep -q 'id: \"imports\"' js/admin-stage-one.js\n          grep -q 'Player Database Auditor' js/admin-stage-one.js\n          ! grep -q 'Historical Database Import Centre' js/admin-stage-one.js",
  'Studio regression Stage One imports boundary'
);
regression = replaceOnce(regression, "          const base = admin.indexOf('admin.css?v=16.2.1');", "          const base = admin.indexOf('admin.css?v=');", 'Studio regression admin.css version probe');
write('.github/workflows/studio-regression.yml', regression);

// 11) Update README architecture truth.
let readme = read('README.md');
readme = replaceOnce(
  readme,
  'The generic Historical Database Import Centre and Identity Consolidation tools are retained for verified season expansion. The one-off 2015/16 archive hotfix importer and the retired automatic database-repair workspaces have been removed from the active source.',
  'The browser Historical Imports and Identity Consolidation workspaces are retired from the active Studio. Historical season expansion continues through audited season-master data work and explicit import/build scripts, while the Player Database Auditor remains the read-only browser health check.',
  'README Historical Imports architecture note'
);
write('README.md', readme);

// Final local assertions before generated wiring/cache rebuilds run in CI.
for (const token of ['importCentreHeading','identityConsolidationCentre','data-open-workspace="imports"','data-workspace="imports"']) assert(!admin.includes(token), `admin.html still contains ${token}`);
assert(!core.includes('BEGIN admin-phase10.js') && !core.includes('BEGIN admin-phase11.js'), 'Retired importer runtimes remain in admin-core.js');
assert(!stage.includes('id: "imports"'), 'Stage One imports definition remains');
assert(!baseCss.includes('Historical database import centre') && !baseCss.includes('Player identity consolidation'), 'Retired import CSS remains');
console.log('Historical Imports retirement + mononym verification migration applied.');
