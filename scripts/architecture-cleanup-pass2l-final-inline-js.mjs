import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function inlineScripts(source) {
  const matches = [];
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(source))) matches.push({ full: match[0], content: match[1], index: match.index, end: pattern.lastIndex });
  return matches;
}

function replaceInlineByMarker(source, marker, outputPath, src) {
  assert(!fs.existsSync(outputPath), `${outputPath} already exists unexpectedly`);
  const candidates = inlineScripts(source).filter(item => item.content.includes(marker));
  assert(candidates.length === 1, `Expected one inline script containing ${marker}, found ${candidates.length}`);
  const item = candidates[0];
  write(outputPath, item.content);
  return source.slice(0, item.index) + `<script src="${src}"></script>` + source.slice(item.end);
}

let source = read("index.html");
const originalInline = inlineScripts(source);
assert(originalInline.length === 2, `Expected exactly two remaining inline scripts, found ${originalInline.length}`);
assert(originalInline.some(item => item.content.includes("/* FPL Daily Challenge 4.3 — inline visual enhancements */")), "Visual-enhancement inline script is missing");
assert(originalInline.some(item => item.content.includes('const historyStore = "fpl-v4-local-history";')), "Phase 4.5 dashboard inline script is missing");

const enginePath = read("js/game-engine.js");
const staticMarker = '<div class="phase45-bottom-nav" id="phase45BottomNav"';
const staticStart = source.indexOf(staticMarker);
assert(staticStart >= 0, "Phase 4.5 static navigation markup is missing");
const secondInline = originalInline.find(item => item.content.includes('const historyStore = "fpl-v4-local-history";'));
assert(secondInline && secondInline.index > staticStart, "Phase 4.5 dashboard script must follow its static markup");
const staticBetweenBefore = source.slice(source.indexOf(staticMarker), secondInline.index);

source = replaceInlineByMarker(
  source,
  "/* FPL Daily Challenge 4.3 — inline visual enhancements */",
  "js/live-visual-enhancements.js",
  "js/live-visual-enhancements.js?v=1.0.0"
);
source = replaceInlineByMarker(
  source,
  'const historyStore = "fpl-v4-local-history";',
  "js/phase45-dashboard.js",
  "js/phase45-dashboard.js?v=1.0.0"
);

assert(inlineScripts(source).length === 0, "Inline scripts remain after Pass 2L extraction");
assert(read("js/game-engine.js") === enginePath, "Core game engine changed during presentation extraction");
const dashboardLoad = source.indexOf('js/phase45-dashboard.js?v=1.0.0');
const staticStartAfter = source.indexOf(staticMarker);
assert(staticStartAfter >= 0 && dashboardLoad > staticStartAfter, "Phase 4.5 dashboard no longer loads after its static markup");
const staticBetweenAfter = source.slice(staticStartAfter, source.lastIndexOf('<script src="js/phase45-dashboard.js?v=1.0.0"></script>', dashboardLoad) >= 0 ? source.lastIndexOf('<script src="js/phase45-dashboard.js?v=1.0.0"></script>', dashboardLoad) : dashboardLoad);
assert(staticBetweenAfter === staticBetweenBefore, "Phase 4.5 static nav/completion markup changed during extraction");

const orderNames = [
  "js/game-engine.js?v=1.0.0",
  "js/live-visual-enhancements.js?v=1.0.0",
  "phase45BottomNav",
  "completionMoment",
  "js/phase45-dashboard.js?v=1.0.0",
  "js/leaderboard-config.js?v=5.0.0",
  "js/leaderboard-client.js?v=5.0.0",
  "js/phase45-polish.js?v=2.0.0"
];
const order = orderNames.map(item => source.indexOf(item));
assert(order.every(index => index >= 0), "One or more final live-page dependencies are missing");
assert(order.every((index, i) => i === 0 || index > order[i - 1]), "Final live-page load/markup order changed");

write("index.html", source);
console.log("Architecture Cleanup Pass 2L externalized the final two presentation scripts; index.html now has zero inline scripts.");
