import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const indexPath = "index.html";
const enginePath = "js/game-engine.js";
const engineMarker = "/* Core FPL Daily Challenge game engine. */";
const nextMarker = "/* FPL Daily Challenge 4.3 — inline visual enhancements */";

assert(!fs.existsSync(enginePath), `${enginePath} already exists unexpectedly`);
const source = read(indexPath);
const markerIndex = source.indexOf(engineMarker);
const nextMarkerIndex = source.indexOf(nextMarker);
assert(markerIndex >= 0, "Core game engine marker is missing");
assert(nextMarkerIndex > markerIndex, "Visual-enhancement boundary is missing or out of order");
assert(source.indexOf(engineMarker, markerIndex + engineMarker.length) < 0, "Core game engine marker is not unique");

const scriptStart = source.lastIndexOf("<script", markerIndex);
const openEnd = source.indexOf(">", scriptStart) + 1;
const openingTag = source.slice(scriptStart, openEnd);
assert(/^<script\s*>$/i.test(openingTag), `Expected inline game engine script, found ${openingTag}`);
const scriptEnd = source.indexOf("</script>", markerIndex);
assert(scriptEnd > markerIndex && scriptEnd < nextMarkerIndex, "Could not isolate the core game engine script");

const engine = source.slice(openEnd, scriptEnd);
assert(engine.includes(engineMarker), "Extracted engine lost its marker");
assert(engine.includes("const INVALID_PENALTY = 10;"), "Penalty rule marker is missing from the engine");
assert(engine.includes("const qualifiesForAnswer=record=>"), "Zero-minute eligibility rule marker is missing from the engine");
assert(engine.includes("function calculatePerfectXI()"), "Perfect-XI calculator is missing from the engine");
assert(engine.includes("function reveal(restoring=false)"), "Reveal flow is missing from the engine");
assert(engine.includes("if(completedRecord){renderCompletedResult(completedRecord,true);}"), "Completed-result restore flow is missing from the engine");
assert(engine.trim().length > 20000, "Core game engine is unexpectedly small");

const prefixBefore = source.slice(0, scriptStart);
const tailBefore = source.slice(scriptEnd + "</script>".length);
const replacement = '<script src="js/game-engine.js?v=1.0.0"></script>';
const updated = prefixBefore + replacement + tailBefore;

assert(updated.slice(0, updated.indexOf(replacement)) === prefixBefore, "Content before the game engine changed");
const updatedNextMarkerIndex = updated.indexOf(nextMarker);
assert(updatedNextMarkerIndex >= 0, "Visual enhancement marker disappeared");
const originalTailFromNextMarker = source.slice(nextMarkerIndex);
assert(updated.slice(updatedNextMarkerIndex) === originalTailFromNextMarker, "Visual enhancements or later scripts changed during engine extraction");
assert((updated.match(/js\/game-engine\.js\?v=1\.0\.0/g) || []).length === 1, "Expected exactly one game-engine.js load");
assert(!updated.includes(`<script>\n${engineMarker}`), "Core game engine remains inline");

const careerIndex = updated.indexOf("js/career-context.js?v=1.4.0");
const engineLoadIndex = updated.indexOf("js/game-engine.js?v=1.0.0");
const visualIndex = updated.indexOf(nextMarker);
assert(careerIndex >= 0 && engineLoadIndex > careerIndex && visualIndex > engineLoadIndex, "Core game engine load order changed");

write(enginePath, engine);
write(indexPath, updated);
console.log(`Architecture Cleanup Pass 2K extracted ${engine.length.toLocaleString()} game-engine characters without changing later presentation scripts.`);
