import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, content) => fs.writeFileSync(path, content);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function elementBounds(source, needle) {
  const needleIndex = source.indexOf(needle);
  if (needleIndex < 0) return null;
  const start = source.lastIndexOf("<", needleIndex);
  assert(start >= 0, `Could not find element start for ${needle}`);
  const open = source.slice(start).match(/^<([A-Za-z][A-Za-z0-9:-]*)\b/);
  assert(open, `Could not identify element tag for ${needle}`);
  const tag = open[1];
  const token = new RegExp(`<${tag}\\b|<\\/${tag}>`, "gi");
  token.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = token.exec(source))) {
    if (match[0][1] === "/") depth -= 1;
    else depth += 1;
    if (depth === 0) return { start, end: token.lastIndex, tag };
  }
  throw new Error(`Could not find closing </${tag}> for ${needle}`);
}

function extractElement(source, needle) {
  const bounds = elementBounds(source, needle);
  assert(bounds, `Missing expected element ${needle}`);
  return source.slice(bounds.start, bounds.end);
}

function removeElement(source, needle, required = true) {
  const bounds = elementBounds(source, needle);
  if (!bounds) {
    if (required) throw new Error(`Missing expected element ${needle}`);
    return source;
  }
  return source.slice(0, bounds.start) + source.slice(bounds.end).replace(/^\s*\n?/, "\n");
}

function removeAllElements(source, needle) {
  let count = 0;
  while (source.includes(needle)) {
    source = removeElement(source, needle, true);
    count += 1;
  }
  return { source, count };
}

function functionBounds(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return null;
  const brace = source.indexOf("{", start);
  assert(brace >= 0, `Missing opening brace for ${name}`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: i + 1 };
    }
  }
  throw new Error(`Could not find closing brace for ${name}`);
}

function replaceFunction(source, name, replacement) {
  const bounds = functionBounds(source, name);
  assert(bounds, `Missing expected function ${name}`);
  return source.slice(0, bounds.start) + replacement + source.slice(bounds.end);
}

// Public page: remove the retired explainer and the retired Live XI/Achievements panel,
// while keeping the useful local-record stats panel in the Phase 4.5 shell.
let index = read("index.html");
index = removeElement(index, 'aria-label="How this challenge works"');
const statsPanel = extractElement(index, 'id="phase45ExtendedStats"');
const livePanel = elementBounds(index, 'id="liveXiPanel"');
assert(livePanel, "Missing retired Live XI panel");
index = index.slice(0, livePanel.start) + statsPanel + index.slice(livePanel.end);
write("index.html", index);

// Give Up layer: the public explainer no longer exists in source, so remove its runtime deletion shim.
let gameplay = read("js/game-roadmap-phase1.js");
gameplay = gameplay.replace(
  "/* FPL Draft Challenge — gameplay roadmap phase 1.\n   Adds Give Up (0-point completed prompts) and removes the legacy public selection explainer. */",
  "/* FPL Draft Challenge — gameplay Give Up layer.\n   Adds zero-point completed prompts without changing core scoring rules. */"
);
const removeLegacyBounds = functionBounds(gameplay, "removeLegacySelectionPanel");
if (removeLegacyBounds) gameplay = gameplay.slice(0, removeLegacyBounds.start) + gameplay.slice(removeLegacyBounds.end);
gameplay = gameplay.replace(/\n?\s*removeLegacySelectionPanel\(\);/g, "");
write("js/game-roadmap-phase1.js", gameplay);

// Live UI bootstrap: the retired panels are now absent from source, so keep only active enhancement loading.
let cleanup = read("js/ui-cleanup.js");
cleanup = cleanup.replace(
  "/* FPL Draft Challenge — temporary UI retirements for low-value Phase 4.5 panels. */",
  "/* FPL Draft Challenge — live-page enhancement bootstrap. */"
);
cleanup = replaceFunction(cleanup, "retireLowValuePanels", `function initialiseLiveEnhancements() {\n    loadPromptMissingFieldGuard();\n    loadSeasonSelectPerformance();\n    loadAutocompleteLayer();\n    loadVisualOverhaul();\n    loadVisualFinishing();\n  }`);
cleanup = cleanup.replaceAll("retireLowValuePanels", "initialiseLiveEnhancements");
write("js/ui-cleanup.js", cleanup);

// Studio: remove all links/cards for Historical Imports plus the retired workspace itself and stub load.
let admin = read("admin.html");
const importLaunchers = removeAllElements(admin, 'data-open-workspace="imports"');
admin = importLaunchers.source;
assert(importLaunchers.count >= 1, "No Historical Imports launchers were removed");
admin = removeElement(admin, 'data-workspace="imports"');
admin = admin.replace(/^\s*<script src="data\/fpl-history-2015-16\.js[^\n]*<\/script>\s*$/m, "");
write("admin.html", admin);

// Remove the retired Phase 12 importer from the active lazy-loaded prompt-tools bundle.
let promptTools = read("js/admin-import-tools-base.js");
const beforePromptTools = promptTools.length;
promptTools = promptTools.replace(/\/\* ===== BEGIN admin-phase12\.js ===== \*\/[\s\S]*?\/\* ===== END admin-phase12\.js ===== \*\/\s*/, "");
assert(promptTools.length < beforePromptTools, "Retired admin-phase12 importer was not removed");
assert(promptTools.includes("/* ===== BEGIN admin-phase15.js ===== */"), "Active admin-phase15 bundle content was lost");
write("js/admin-import-tools-base.js", promptTools);

// The CSS only existed to hide the retired workspace; remove the import now the markup is gone.
let adminCss = read("admin.css");
adminCss = adminCss.replace(/^@import url\("\.\/admin-retired-workspaces\.css[^\n]*\n/m, "");
write("admin.css", adminCss);

// Remove retired compatibility files.
for (const path of ["admin-retired-workspaces.css", "data/fpl-history-2015-16.js"]) {
  if (fs.existsSync(path)) fs.rmSync(path);
}

// Keep the README accurate without doing the wider documentation reset yet.
let readme = read("README.md");
readme = readme.replace(
  "Historical import and automatic database-repair workspaces are retired from the active Studio workflow. Their legacy code remains temporarily in the repository while the Studio bundles are being modularised and cleaned up.",
  "Historical import and automatic database-repair workspaces are retired from the active Studio workflow. The one-off Historical Imports workspace and its 2015/16 compatibility bundle have now been removed from the active repository."
);
write("README.md", readme);

// Pass-1 invariants.
const finalIndex = read("index.html");
assert(!finalIndex.includes("Today’s selection challenge"), "Legacy selection challenge copy remains");
assert(!finalIndex.includes('id="liveXiPanel"'), "Live XI panel remains");
assert(!finalIndex.includes('id="phase45Achievements"'), "Achievements panel remains");
assert(finalIndex.includes('id="phase45ExtendedStats"'), "Local record panel was accidentally removed");
const finalAdmin = read("admin.html");
assert(!finalAdmin.includes('data-workspace="imports"'), "Historical Imports workspace remains");
assert(!finalAdmin.includes('data-open-workspace="imports"'), "Historical Imports launcher remains");
assert(!finalAdmin.includes("fpl-history-2015-16.js"), "Retired history stub is still loaded");
assert(!read("js/admin-import-tools-base.js").includes("BEGIN admin-phase12.js"), "Retired importer bundle remains");
assert(!read("js/game-roadmap-phase1.js").includes("removeLegacySelectionPanel"), "Legacy public-panel deletion shim remains");
assert(!fs.existsSync("admin-retired-workspaces.css"), "Retired workspace CSS still exists");
assert(!fs.existsSync("data/fpl-history-2015-16.js"), "Retired history stub still exists");
assert(fs.existsSync("js/admin-batch-calendar.js"), "Canonical batch calendar is missing");

console.log("Repository Cleanup Pass 1 source cleanup complete.");
