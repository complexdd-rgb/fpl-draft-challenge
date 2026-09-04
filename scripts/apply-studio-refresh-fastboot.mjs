import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, before, after) => {
  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('Updated ' + path);
  }
};
const replaceOnce = (source, from, to, label) => {
  if (source.includes(to)) return source;
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(label + ': expected one source marker, found ' + count + '.');
  return source.replace(from, to);
};
const manifest = fs.existsSync('config/asset-manifest.json')
  ? JSON.parse(read('config/asset-manifest.json'))
  : null;
const stageAsset = manifest?.assets?.adminStageOne;
const stageUrl = stageAsset?.path
  ? (stageAsset.version ? `${stageAsset.path}?v=${stageAsset.version}` : stageAsset.path)
  : 'js/admin-stage-one.js?v=1.1.0-fastboot';

{
  const path = 'admin.html';
  const source = read(path);
  let updated = source;
  updated = replaceOnce(updated, '<html lang="en">', '<html lang="en" class="studio-preboot">', 'Studio preboot html class');

  const desiredTag = `  <script src="${stageUrl}"></script>\n`;
  const stagePattern = /  <script src="js\/admin-stage-one\.js(?:\?v=[^"]+)?"><\/script>\n/g;
  const matches = updated.match(stagePattern) || [];
  if (matches.length > 1) throw new Error(`early Stage One script: expected at most one tag, found ${matches.length}.`);
  if (matches.length === 1) updated = updated.replace(stagePattern, desiredTag);
  else updated = replaceOnce(updated, '  </main>\n\n', '  </main>\n\n' + desiredTag + '\n', 'early Stage One script');
  write(path, source, updated);
}

{
  const path = 'admin-stage-one.css';
  const source = read(path);
  const marker = '/* FPL Challenge Studio — Stage One visual and navigation cleanup */';
  const preboot = `/* Studio refresh fast boot: never paint the retired long-form layout. */\nhtml.studio-preboot body {\n  min-height: 100vh;\n  background: #06110d;\n}\n\nhtml.studio-preboot .studio-shell {\n  visibility: hidden;\n}\n\nhtml.studio-preboot body::before {\n  content: "Loading FPL Challenge Studio…";\n  position: fixed;\n  inset: 0;\n  z-index: 9999;\n  display: grid;\n  place-items: center;\n  padding: 24px;\n  background: #06110d;\n  color: #9bb7a8;\n  font: 800 .82rem/1.4 system-ui, sans-serif;\n  letter-spacing: .02em;\n}\n`;
  const updated = source.includes('Studio refresh fast boot: never paint')
    ? source
    : source.replace(marker, marker + '\n\n' + preboot);
  write(path, source, updated);
}

{
  const path = 'js/admin-stage-one.js';
  const source = read(path);
  let updated = source;

  updated = replaceOnce(
    updated,
    '  const COLLAPSE_KEY = "fpl-studio-stage-one-collapsed";',
    '  const COLLAPSE_KEY = "fpl-studio-stage-one-collapsed";\n  const SCROLL_KEY = "fpl-studio-stage-one-scroll-v1";',
    'Stage One scroll key'
  );

  const helperMarker = '  function updateHero() {';
  const helpers = `  function readScrollState() {\n    try {\n      const value = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "null");\n      return value && typeof value.workspace === "string" && Number.isFinite(Number(value.y)) ? value : null;\n    } catch (_) { return null; }\n  }\n\n  function activeWorkspaceId() {\n    return document.querySelector('.studio-workspace:not([hidden])')?.dataset.workspace || "";\n  }\n\n  function saveScrollState() {\n    const workspace = activeWorkspaceId();\n    if (!workspace) return;\n    try {\n      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ workspace, y: Math.max(0, Math.round(window.scrollY || 0)) }));\n    } catch (_) {}\n  }\n\n  function restoreScrollState(workspaceId) {\n    const state = readScrollState();\n    if (!state || state.workspace !== workspaceId) return;\n    const restore = () => window.scrollTo({ top: Math.max(0, Number(state.y) || 0), behavior: "auto" });\n    requestAnimationFrame(() => requestAnimationFrame(restore));\n  }\n\n` + helperMarker;
  updated = replaceOnce(updated, helperMarker, helpers, 'Stage One scroll helpers');

  const initialMarker = '    activateWorkspace(initialWorkspace, "", true);';
  const initialReplacement = `    activateWorkspace(initialWorkspace, "", true);\n    restoreScrollState(initialWorkspace);\n    window.addEventListener("pagehide", saveScrollState);\n    if (initialWorkspace === "prompts") {\n      window.addEventListener("fpl:prompt-tools-ready", () => restoreScrollState("prompts"), { once: true });\n    }\n    document.documentElement.classList.remove("studio-preboot");\n    document.documentElement.dataset.studioStageReady = "true";`;
  updated = replaceOnce(updated, initialMarker, initialReplacement, 'Stage One initial workspace restore');

  const oldBoot = `  if (document.readyState === "loading") {\n    document.addEventListener("DOMContentLoaded", initialise, { once: true });\n  } else {\n    initialise();\n  }`;
  const newBoot = `  // admin-stage-one.js is loaded immediately after </main>, so the complete Studio markup\n  // already exists even while document.readyState is still "loading". Build the modern\n  // workspace immediately instead of waiting for every heavy script and DOMContentLoaded.\n  if (document.querySelector("main.studio-shell")) {\n    initialise();\n  } else if (document.readyState === "loading") {\n    document.addEventListener("DOMContentLoaded", initialise, { once: true });\n  } else {\n    initialise();\n  }`;
  updated = replaceOnce(updated, oldBoot, newBoot, 'Stage One immediate boot');
  write(path, source, updated);
}

execFileSync(process.execPath, ['--check', 'js/admin-stage-one.js'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-studio-refresh-fastboot.mjs'], { stdio: 'inherit' });
