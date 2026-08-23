import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function extractInlineScript(source, marker, outputPath, scriptSrc) {
  assert(!fs.existsSync(outputPath), `${outputPath} already exists unexpectedly`);
  const markerIndex = source.indexOf(marker);
  assert(markerIndex >= 0, `Missing inline script marker: ${marker}`);
  assert(source.indexOf(marker, markerIndex + marker.length) < 0, `Marker is not unique: ${marker}`);
  const scriptStart = source.lastIndexOf("<script", markerIndex);
  assert(scriptStart >= 0, `Could not find script start for ${marker}`);
  const openEnd = source.indexOf(">", scriptStart) + 1;
  assert(openEnd > scriptStart, `Could not find script opening tag end for ${marker}`);
  const openingTag = source.slice(scriptStart, openEnd);
  assert(/^<script\s*>$/i.test(openingTag), `Expected an inline <script> for ${marker}, found ${openingTag}`);
  const scriptEnd = source.indexOf("</script>", markerIndex);
  assert(scriptEnd > markerIndex, `Could not find script end for ${marker}`);
  const content = source.slice(openEnd, scriptEnd);
  assert(content.includes(marker), `Extracted script lost marker ${marker}`);
  write(outputPath, content);
  const replacement = `<script src="${scriptSrc}"></script>`;
  return source.slice(0, scriptStart) + replacement + source.slice(scriptEnd + "</script>".length);
}

let source = read("index.html");
const phaseComment = "<!-- Phase 1: load the challenge calendar, then synchronously load the challenge selected for the current UK date. -->";
const engineMarker = "/* Core FPL Daily Challenge game engine. */";
const phaseIndex = source.indexOf(phaseComment);
const engineIndex = source.indexOf(engineMarker);
assert(phaseIndex >= 0 && engineIndex > phaseIndex, "Live bootstrap/game-engine boundary is invalid");
const prefixBefore = source.slice(0, phaseIndex);
const engineBefore = source.slice(engineIndex);

source = extractInlineScript(
  source,
  "document.write('<script src=\"challenges/manifest.js?v='",
  "js/challenge-manifest-bootstrap.js",
  "js/challenge-manifest-bootstrap.js?v=1.0.0"
);
source = extractInlineScript(
  source,
  "if (!window.FPL_DAILY_CHALLENGE)",
  "js/challenge-legacy-fallback.js",
  "js/challenge-legacy-fallback.js?v=1.0.0"
);
source = extractInlineScript(
  source,
  "/* Shared prompt helper functions. */",
  "js/prompt-helpers.js",
  "js/prompt-helpers.js?v=1.0.0"
);

const updatedPhaseIndex = source.indexOf(phaseComment);
const updatedEngineIndex = source.indexOf(engineMarker);
assert(updatedPhaseIndex >= 0 && source.slice(0, updatedPhaseIndex) === prefixBefore, "Player markup changed before the live bootstrap");
assert(updatedEngineIndex >= 0 && source.slice(updatedEngineIndex) === engineBefore, "Core game engine or later scripts changed during bootstrap extraction");

const order = [
  "js/challenge-manifest-bootstrap.js?v=1.0.0",
  "js/daily-challenge-loader.js?v=1.0.0",
  "js/challenge-legacy-fallback.js?v=1.0.0",
  "js/challenge-archive.js?v=2.0.0",
  "js/prompt-helpers.js?v=1.0.0",
  "players-live.js?v=1.0.0",
  "js/career-context.js?v=1.4.0"
].map(item => source.indexOf(item));
assert(order.every(index => index >= 0), "One or more live bootstrap dependencies are missing after extraction");
assert(order.every((index, position) => position === 0 || index > order[position - 1]), "Live bootstrap load order changed");
assert(!source.includes("<script>\ndocument.write('<script src=\"challenges/manifest.js"), "Manifest bootstrap remains inline");
assert(!source.includes("<script>\nif (!window.FPL_DAILY_CHALLENGE)"), "Legacy challenge fallback remains inline");
assert(!source.includes("<script>\n/* Shared prompt helper functions. */"), "Prompt helpers remain inline");

write("index.html", source);
console.log("Architecture Cleanup Pass 2J extracted manifest bootstrap, legacy fallback and prompt helpers without changing the game engine.");
