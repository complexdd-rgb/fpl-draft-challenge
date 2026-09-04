import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, before, after) => {
  if (before === after) return false;
  fs.writeFileSync(path, after);
  console.log(`Updated ${path}`);
  return true;
};
const replaceOnce = (source, from, to, label) => {
  if (source.includes(to)) return source;
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one source marker, found ${count}.`);
  return source.replace(from, to);
};

const manifest = JSON.parse(read('config/asset-manifest.json'));
const stageAsset = manifest.assets?.adminStageOne;
if (!stageAsset?.path) throw new Error('Central asset manifest is missing adminStageOne.');
const stageUrl = stageAsset.version ? `${stageAsset.path}?v=${stageAsset.version}` : stageAsset.path;

const VALIDATION_PANEL_START = '<section class="panel validation-lab-panel" id="validationLabPanel"';
const VALIDATION_MARKER_START = '<!-- STUDIO_NATIVE_VALIDATION_PANEL_START -->';
const VALIDATION_MARKER_END = '<!-- STUDIO_NATIVE_VALIDATION_PANEL_END -->';

function dedent(block) {
  const lines = String(block || '').replace(/^\n+|\n+$/g, '').split('\n');
  const indents = lines.filter(line => line.trim()).map(line => line.match(/^\s*/)?.[0].length || 0);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map(line => line.slice(Math.min(min, line.length))).join('\n');
}

function indent(block, spaces) {
  const prefix = ' '.repeat(spaces);
  return dedent(block).split('\n').map(line => line ? prefix + line : '').join('\n');
}

function extractValidationPanel(html) {
  const markerPattern = new RegExp(`${VALIDATION_MARKER_START}\\n([\\s\\S]*?)\\n\\s*${VALIDATION_MARKER_END}`);
  const marked = html.match(markerPattern);
  if (marked) return dedent(marked[1]);

  const mainClose = html.indexOf('\n  </main>');
  const start = html.indexOf(VALIDATION_PANEL_START);
  if (mainClose < 0 || start < 0 || start > mainClose) {
    throw new Error('Could not locate the legacy Validation Lab panel before </main>.');
  }
  if (html.indexOf(VALIDATION_PANEL_START, start + 1) >= 0) {
    throw new Error('Validation Lab panel appears more than once before native migration.');
  }

  const closing = '\n    </section>';
  const endStart = html.lastIndexOf(closing, mainClose);
  if (endStart < start) throw new Error('Could not locate the Validation Lab panel closing section.');
  return dedent(html.slice(start, endStart + closing.length));
}

function removeLegacyValidationPanel(html) {
  const mainClose = html.indexOf('\n  </main>');
  const start = html.indexOf(VALIDATION_PANEL_START);
  if (mainClose < 0 || start < 0 || start > mainClose) return html;

  const closing = '\n    </section>';
  const endStart = html.lastIndexOf(closing, mainClose);
  if (endStart < start) throw new Error('Could not remove the legacy Validation Lab panel safely.');
  const end = endStart + closing.length;

  let removalStart = start;
  while (removalStart > 0 && html[removalStart - 1] === ' ') removalStart -= 1;
  if (removalStart > 0 && html[removalStart - 1] === '\n') removalStart -= 1;

  let removalEnd = end;
  while (html[removalEnd] === '\n') removalEnd += 1;
  return html.slice(0, removalStart) + '\n' + html.slice(removalEnd);
}

const sourceHtml = read('admin.html');
const validationPanel = extractValidationPanel(sourceHtml);
const validationPanelMarkup = `${' '.repeat(12)}${VALIDATION_MARKER_START}\n${indent(validationPanel, 12)}\n${' '.repeat(12)}${VALIDATION_MARKER_END}`;

const nativeTemplate = `  <!-- STUDIO_NATIVE_WORKSPACE_TEMPLATE_START -->
  <template id="studioNativeWorkspaceTemplate">
    <div class="studio-stage-one-layout" data-native-studio-layout="true">
      <aside class="studio-sidebar" aria-label="Studio navigation">
        <div class="studio-sidebar-head">
          <div class="studio-mark" aria-hidden="true">FPL</div>
          <div>
            <strong>Challenge Studio</strong>
            <span>Admin tools</span>
          </div>
          <button class="studio-sidebar-close" type="button" aria-label="Close navigation">×</button>
        </div>
        <nav class="studio-navigation">
          <button class="studio-nav-button" type="button" data-open-workspace="dashboard" aria-controls="workspace-dashboard">
            <span class="studio-nav-icon" aria-hidden="true">⌂</span><span class="studio-nav-copy"><strong>Overview</strong><small>Status and next action</small></span><span class="studio-nav-badge" data-workspace-badge="dashboard" aria-hidden="true"></span>
          </button>
          <button class="studio-nav-button" type="button" data-open-workspace="challenge" aria-controls="workspace-challenge">
            <span class="studio-nav-icon" aria-hidden="true">XI</span><span class="studio-nav-copy"><strong>Daily Challenge</strong><small>Create, review, test and download the next seven-day FPL challenge calendar.</small></span><span class="studio-nav-badge" data-workspace-badge="challenge" aria-hidden="true"></span>
          </button>
          <button class="studio-nav-button" type="button" data-open-workspace="prompts" aria-controls="workspace-prompts">
            <span class="studio-nav-icon" aria-hidden="true">P</span><span class="studio-nav-copy"><strong>Prompt Studio</strong><small>Manage, create and quality-check the prompt library.</small></span><span class="studio-nav-badge" data-workspace-badge="prompts" aria-hidden="true"></span>
          </button>
          <button class="studio-nav-button" type="button" data-open-workspace="validation" aria-controls="workspace-validation">
            <span class="studio-nav-icon" aria-hidden="true">V</span><span class="studio-nav-copy"><strong>Validation Lab</strong><small>Inspect players, trace prompt rules and certify historical seasons.</small></span><span class="studio-nav-badge" data-workspace-badge="validation" aria-hidden="true"></span>
          </button>
          <button class="studio-nav-button" type="button" data-open-workspace="database" aria-controls="workspace-database">
            <span class="studio-nav-icon" aria-hidden="true">DB</span><span class="studio-nav-copy"><strong>Database Health</strong><small>Run the read-only database audit and review anything that still needs research.</small></span><span class="studio-nav-badge" data-workspace-badge="database" aria-hidden="true"></span>
          </button>
          <button class="studio-nav-button" type="button" data-open-workspace="leaderboard" aria-controls="workspace-leaderboard">
            <span class="studio-nav-icon" aria-hidden="true">#</span><span class="studio-nav-copy"><strong>Leaderboard</strong><small>Check Supabase configuration, deployment readiness and backend health.</small></span><span class="studio-nav-badge" data-workspace-badge="leaderboard" aria-hidden="true"></span>
          </button>
          <button class="studio-nav-button" type="button" data-open-workspace="imports" aria-controls="workspace-imports">
            <span class="studio-nav-icon" aria-hidden="true">↥</span><span class="studio-nav-copy"><strong>Historical Imports</strong><small>Import verified historical seasons and review identity matches safely.</small></span><span class="studio-nav-badge" data-workspace-badge="imports" aria-hidden="true"></span>
          </button>
        </nav>
        <div class="studio-sidebar-footer">
          <span>Safety-first tools</span>
          <strong>Read-only inspection and prompt diagnosis</strong>
          <a href="./">Open live game</a>
        </div>
      </aside>

      <div class="studio-main-column">
        <header class="studio-topbar">
          <button class="studio-menu-button" type="button" aria-label="Open studio navigation" aria-expanded="false"><span></span><span></span><span></span></button>
          <div class="studio-topbar-title"><span>Workspace</span><strong id="activeWorkspaceTitle">Studio overview</strong></div>
          <div class="studio-topbar-status" aria-label="Current studio status">
            <span class="topbar-pill" id="stageOneBlockerPill">Audit not run</span>
            <span class="topbar-pill muted" id="stageOnePromptPill">Prompts loading</span>
          </div>
        </header>

        <div class="studio-workspace-host">
          <section class="studio-workspace" data-workspace="dashboard" id="workspace-dashboard" aria-label="Studio overview"></section>
          <section class="studio-workspace" data-workspace="challenge" id="workspace-challenge" hidden aria-hidden="true" aria-labelledby="workspace-challenge-title">
            <header class="workspace-heading"><div><p class="eyebrow">FPL Challenge Studio</p><h1 id="workspace-challenge-title">Daily Challenge</h1><p>Create, review, test and download the next seven-day FPL challenge calendar.</p></div><a class="workspace-live-link" href="./">Open live game</a></header>
          </section>
          <section class="studio-workspace" data-workspace="prompts" id="workspace-prompts" hidden aria-hidden="true" aria-labelledby="workspace-prompts-title">
            <header class="workspace-heading"><div><p class="eyebrow">FPL Challenge Studio</p><h1 id="workspace-prompts-title">Prompt Studio</h1><p>Manage, create and quality-check the prompt library.</p></div><a class="workspace-live-link" href="./">Open live game</a></header>
          </section>
          <section class="studio-workspace" data-workspace="validation" id="workspace-validation" hidden aria-hidden="true" aria-labelledby="workspace-validation-title">
            <header class="workspace-heading"><div><p class="eyebrow">FPL Challenge Studio</p><h1 id="workspace-validation-title">Validation Lab</h1><p>Inspect players, trace prompt rules and certify historical seasons.</p></div><a class="workspace-live-link" href="./">Open live game</a></header>
${validationPanelMarkup}
          </section>
          <section class="studio-workspace" data-workspace="database" id="workspace-database" hidden aria-hidden="true" aria-labelledby="workspace-database-title">
            <header class="workspace-heading"><div><p class="eyebrow">FPL Challenge Studio</p><h1 id="workspace-database-title">Database Health</h1><p>Run the read-only database audit and review anything that still needs research.</p></div><a class="workspace-live-link" href="./">Open live game</a></header>
          </section>
          <section class="studio-workspace" data-workspace="leaderboard" id="workspace-leaderboard" hidden aria-hidden="true" aria-labelledby="workspace-leaderboard-title">
            <header class="workspace-heading"><div><p class="eyebrow">FPL Challenge Studio</p><h1 id="workspace-leaderboard-title">Leaderboard</h1><p>Check Supabase configuration, deployment readiness and backend health.</p></div><a class="workspace-live-link" href="./">Open live game</a></header>
          </section>
          <section class="studio-workspace" data-workspace="imports" id="workspace-imports" hidden aria-hidden="true" aria-labelledby="workspace-imports-title">
            <header class="workspace-heading"><div><p class="eyebrow">FPL Challenge Studio</p><h1 id="workspace-imports-title">Historical Imports</h1><p>Import verified historical seasons and review identity matches safely.</p></div><a class="workspace-live-link" href="./">Open live game</a></header>
          </section>
        </div>
      </div>
    </div>
  </template>
  <!-- STUDIO_NATIVE_WORKSPACE_TEMPLATE_END -->`;

{
  const path = 'admin.html';
  const before = sourceHtml;
  let after = removeLegacyValidationPanel(before);

  const stagePattern = /  <script src="js\/admin-stage-one\.js(?:\?v=[^"]+)?"><\/script>/;
  const desiredStageTag = `  <script src="${stageUrl}"></script>`;
  if (!stagePattern.test(after)) throw new Error('Stage One script tag was not found in admin.html.');
  after = after.replace(stagePattern, desiredStageTag);

  const blockPattern = /  <!-- STUDIO_NATIVE_WORKSPACE_TEMPLATE_START -->[\s\S]*?  <!-- STUDIO_NATIVE_WORKSPACE_TEMPLATE_END -->/;
  if (blockPattern.test(after)) after = after.replace(blockPattern, nativeTemplate);
  else after = after.replace(desiredStageTag, `${nativeTemplate}\n\n${desiredStageTag}`);

  write(path, before, after);
}

{
  const path = 'js/admin-stage-one.js';
  const before = read(path);
  let after = before;

  const oldSetup = `    const sidebar = createSidebar();\n    const mainColumn = document.createElement("div");\n    mainColumn.className = "studio-main-column";\n    const topbar = createTopbar();\n    const workspaceHost = document.createElement("div");\n    workspaceHost.className = "studio-workspace-host";`;
  const newSetup = `    // The current Stage One shell is authored in admin.html. Clone that native markup\n    // when available; the JS constructors remain only as a cache-safe fallback.\n    const nativeTemplate = document.getElementById("studioNativeWorkspaceTemplate");\n    const nativeLayout = nativeTemplate?.content?.querySelector(".studio-stage-one-layout")?.cloneNode(true) || null;\n    const sidebar = nativeLayout?.querySelector(".studio-sidebar") || createSidebar();\n    const mainColumn = nativeLayout?.querySelector(".studio-main-column") || document.createElement("div");\n    mainColumn.classList.add("studio-main-column");\n    const topbar = nativeLayout?.querySelector(".studio-topbar") || createTopbar();\n    const workspaceHost = nativeLayout?.querySelector(".studio-workspace-host") || document.createElement("div");\n    workspaceHost.classList.add("studio-workspace-host");`;
  after = replaceOnce(after, oldSetup, newSetup, 'native Stage One shell setup');

  const oldWorkspaceLoop = `    const workspaces = new Map();\n    workspaceDefinitions.forEach(definition => {\n      const workspace = createWorkspace(definition);\n      workspace.id = \`workspace-\${definition.id}\`;\n      workspaces.set(definition.id, workspace);\n      workspaceHost.appendChild(workspace);\n    });`;
  const newWorkspaceLoop = `    const workspaces = new Map();\n    workspaceDefinitions.forEach(definition => {\n      let workspace = nativeLayout?.querySelector(\`[data-workspace=\"\${definition.id}\"]\`) || null;\n      if (!workspace) workspace = createWorkspace(definition);\n      workspace.id = \`workspace-\${definition.id}\`;\n      workspaces.set(definition.id, workspace);\n      if (workspace.parentElement !== workspaceHost) workspaceHost.appendChild(workspace);\n    });`;
  after = replaceOnce(after, oldWorkspaceLoop, newWorkspaceLoop, 'native workspace reuse');

  const oldLayout = `    const layout = document.createElement("div");\n    layout.className = "studio-stage-one-layout";\n    mainColumn.append(topbar, workspaceHost);\n    layout.append(sidebar, mainColumn);\n    shell.appendChild(layout);`;
  const newLayout = `    const layout = nativeLayout || document.createElement("div");\n    layout.classList.add("studio-stage-one-layout");\n    if (!nativeLayout) {\n      mainColumn.append(topbar, workspaceHost);\n      layout.append(sidebar, mainColumn);\n    }\n    shell.appendChild(layout);`;
  after = replaceOnce(after, oldLayout, newLayout, 'native layout activation');

  const legacyMoveMarker = `    shell.appendChild(layout);\n\n    originalChildren.forEach(element => {`;
  const nativePanelLabelling = `    shell.appendChild(layout);\n\n    // Panels authored directly inside native workspaces never pass through originalChildren.\n    // Apply the same shared panel metadata/collapse behaviour before legacy panels are moved.\n    workspaces.forEach((workspace, workspaceId) => {\n      [...workspace.children].forEach(element => {\n        if (element.matches(".workspace-heading, .studio-hero, .safety-banner, .status-grid")) return;\n        if (!element.classList.contains("stage-one-tool-panel")) labelToolPanel(element, workspaceId);\n      });\n    });\n\n    originalChildren.forEach(element => {`;
  after = replaceOnce(after, legacyMoveMarker, nativePanelLabelling, 'native workspace panel labelling');

  write(path, before, after);
}

execFileSync(process.execPath, ['--check', 'js/admin-stage-one.js'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-native-studio-shell.mjs'], { stdio: 'inherit' });
if (fs.existsSync('scripts/verify-native-validation-workspace.mjs')) {
  execFileSync(process.execPath, ['scripts/verify-native-validation-workspace.mjs'], { stdio: 'inherit' });
}
