import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function elementRange(source, marker, tagName) {
  const markerIndex = source.indexOf(marker);
  assert(markerIndex >= 0, `Missing marker: ${marker}`);
  const start = source.lastIndexOf(`<${tagName}`, markerIndex);
  assert(start >= 0, `Could not find <${tagName}> start for ${marker}`);
  const token = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  token.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = token.exec(source))) {
    if (match[0].startsWith(`</`)) depth -= 1;
    else depth += 1;
    if (depth === 0) return { start, end: token.lastIndex, text: source.slice(start, token.lastIndex) };
  }
  throw new Error(`Could not balance <${tagName}> for ${marker}`);
}

let index = read("index.html");
assert((index.match(/class="challenge-overview"/g) || []).length === 1, "Expected exactly one retired challenge overview");
assert((index.match(/id="liveXiPanel"/g) || []).length === 1, "Expected exactly one retired Live XI panel");
assert((index.match(/id="phase45Achievements"/g) || []).length === 1, "Expected exactly one retired achievements panel");
assert((index.match(/id="phase45ExtendedStats"/g) || []).length === 1, "Expected exactly one local-record panel");

const overview = elementRange(index, 'class="challenge-overview"', "section");
index = index.slice(0, overview.start) + index.slice(overview.end);

const extendedStats = elementRange(index, 'id="phase45ExtendedStats"', "section").text;
const liveXi = elementRange(index, 'id="liveXiPanel"', "section");
index = index.slice(0, liveXi.start) + extendedStats + index.slice(liveXi.end);

const livePitchBlock = /\n  function renderLivePitch\(\) \{[\s\S]*?\n  \}\n\n  function renderExtendedStats/;
assert(livePitchBlock.test(index), "Could not locate retired renderLivePitch block");
index = index.replace(livePitchBlock, "\n\n  function renderExtendedStats");

const achievementsBlock = /\n  function renderAchievements\(\) \{[\s\S]*?\n\n  function buildShareText/;
assert(achievementsBlock.test(index), "Could not locate retired renderAchievements block");
index = index.replace(achievementsBlock, "\n\n  function buildShareText");

const oldRefresh = 'const refresh = () => { renderHero(); renderLivePitch(); renderExtendedStats(); renderAchievements(); updatePhase45Countdown(); };';
assert(index.includes(oldRefresh), "Could not locate Phase 4.5 refresh chain");
index = index.replace(oldRefresh, 'const refresh = () => { renderHero(); renderExtendedStats(); updatePhase45Countdown(); };');

assert(!index.includes('class="challenge-overview"'), "Retired challenge overview remains");
assert(!index.includes('id="liveXiPanel"'), "Retired Live XI panel remains");
assert(!index.includes('id="phase45Achievements"'), "Retired achievements panel remains");
assert(index.includes('id="phase45ExtendedStats"'), "Local-record panel was lost");
assert(!index.includes("renderLivePitch"), "Retired live-pitch renderer remains");
assert(!index.includes("renderAchievements"), "Retired achievements renderer remains");
write("index.html", index);

let giveUp = read("js/give-up-gameplay.js");
const legacySelectionFunction = /\n  function removeLegacySelectionPanel\(\) \{\n    document\.querySelector\("\.challenge-overview"\)\?\.remove\(\);\n  \}\n/;
assert(legacySelectionFunction.test(giveUp), "Could not locate legacy selection-panel deletion shim");
giveUp = giveUp.replace(legacySelectionFunction, "\n");
assert(giveUp.includes("  removeLegacySelectionPanel();"), "Could not locate selection-panel shim call");
giveUp = giveUp.replace("  removeLegacySelectionPanel();\n", "");
assert(!giveUp.includes("removeLegacySelectionPanel"), "Selection-panel deletion shim remains in Give Up gameplay");
write("js/give-up-gameplay.js", giveUp);

let bootstrap = read("js/live-ui-bootstrap.js");
assert(bootstrap.includes("window.FPL_LIVE_UI_BOOTSTRAP = Object.freeze(api);"), "Live UI bootstrap export changed unexpectedly");
bootstrap = bootstrap.replace(
  "  window.FPL_LIVE_UI_BOOTSTRAP = Object.freeze(api);\n})();",
  `  window.FPL_LIVE_UI_BOOTSTRAP = Object.freeze(api);\n\n  const start = () => {\n    api.loadPromptMissingFieldGuard();\n    api.loadPresentationLayers();\n  };\n\n  if (document.readyState === \"loading\") document.addEventListener(\"DOMContentLoaded\", start, { once: true });\n  else start();\n})();`
);
assert(bootstrap.includes("const start = () =>"), "Active live presentation startup was not moved into bootstrap");
write("js/live-ui-bootstrap.js", bootstrap);

let cleanup = read("js/ui-cleanup.js");
assert(cleanup.includes('load("js/retired-panel-compat.js", "data-retired-panel-compat")'), "Retired panel compatibility loader was not found");
cleanup = cleanup.replace(
  '  load("js/live-ui-bootstrap.js", "data-live-ui-bootstrap", () => {\n    load("js/retired-panel-compat.js", "data-retired-panel-compat");\n  });',
  '  load("js/live-ui-bootstrap.js", "data-live-ui-bootstrap");'
);
cleanup = cleanup.replace(
  "/* FPL Draft Challenge — legacy live-UI entrypoint.\n   Kept temporarily so older loaders can keep requesting ui-cleanup.js while the\n   responsibilities live in explicitly named modules. */",
  "/* FPL Draft Challenge — live UI compatibility entrypoint.\n   Older loaders may still request ui-cleanup.js; active presentation startup now lives in live-ui-bootstrap.js. */"
);
assert(!cleanup.includes("retired-panel-compat"), "Retired panel loader remains in UI entrypoint");
write("js/ui-cleanup.js", cleanup);

fs.rmSync("js/retired-panel-compat.js");

let featureLoader = read("js/live-feature-loader.js");
featureLoader = featureLoader.replace(
  "  // Core live presentation compatibility entrypoint. The entrypoint itself now delegates\n  // to explicitly named presentation and retired-panel modules.",
  "  // Core live presentation compatibility entrypoint; active presentation startup lives in live-ui-bootstrap.js."
);
write("js/live-feature-loader.js", featureLoader);

console.log("Architecture Cleanup Pass 2E public UI migration complete.");
