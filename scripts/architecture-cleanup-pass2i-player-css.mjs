import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const path = "index.html";
const output = "player-game.css";
const source = read(path);
const headEnd = source.indexOf("</head>");
const bodyStart = source.indexOf("<body>");
assert(headEnd >= 0 && bodyStart > headEnd, "index.html head/body boundary is invalid");

const head = source.slice(0, headEnd);
const styleOpenMatches = head.match(/<style(?:\s[^>]*)?>/gi) || [];
const styleCloseMatches = head.match(/<\/style>/gi) || [];
assert(styleOpenMatches.length === 1, `Expected exactly one head <style> block, found ${styleOpenMatches.length}`);
assert(styleCloseMatches.length === 1, `Expected exactly one head </style> block, found ${styleCloseMatches.length}`);
assert(!fs.existsSync(output), `${output} already exists unexpectedly`);

const open = head.search(/<style(?:\s[^>]*)?>/i);
const openEnd = source.indexOf(">", open) + 1;
const close = source.indexOf("</style>", openEnd);
assert(open >= 0 && openEnd > open && close > openEnd && close < headEnd, "Could not locate the player stylesheet block safely");

const css = source.slice(openEnd, close);
assert(css.includes("/* Core player-facing game styles extracted from index.html. */"), "Core player-game CSS marker is missing");
assert(css.includes(".phase45-shell"), "Phase 4.5 player CSS marker is missing");
assert(css.includes(".slot"), "Draft-slot CSS marker is missing");
assert(css.trim().length > 10000, "Player stylesheet is unexpectedly small");

const bodyBefore = source.slice(bodyStart);
const replacement = '<link rel="stylesheet" href="player-game.css?v=1.0.0">';
const updated = source.slice(0, open) + replacement + source.slice(close + "</style>".length);
const updatedBodyStart = updated.indexOf("<body>");
assert(updatedBodyStart >= 0, "Updated index.html lost its body");
assert(updated.slice(updatedBodyStart) === bodyBefore, "Player markup or scripts changed during CSS extraction");
assert(!(updated.slice(0, updated.indexOf("</head>")).match(/<style(?:\s[^>]*)?>/gi) || []).length, "Inline head stylesheet remains after extraction");
assert((updated.match(/player-game\.css\?v=1\.0\.0/g) || []).length === 1, "Expected exactly one player-game.css load");

write(output, css);
write(path, updated);

console.log(`Architecture Cleanup Pass 2I extracted ${css.length.toLocaleString()} CSS characters without changing the body.`);
