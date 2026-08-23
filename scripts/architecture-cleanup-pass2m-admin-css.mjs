import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const source = read("admin.html");
const output = "admin-live-tools.css";
assert(!fs.existsSync(output), `${output} already exists unexpectedly`);
const openMarker = '<style id="fpl-score-visual-upgrade-css">';
const open = source.indexOf(openMarker);
assert(open >= 0, "Inline Studio visual-tools style block is missing");
assert(source.indexOf(openMarker, open + openMarker.length) < 0, "Inline Studio visual-tools style block is not unique");
const contentStart = open + openMarker.length;
const close = source.indexOf("</style>", contentStart);
assert(close > contentStart, "Could not find closing style tag");
const css = source.slice(contentStart, close);
assert(css.includes("FPL STUDIO PERFECT-SCORE LIMIT + PICK EFFICIENCY v1"), "Perfect-score CSS marker is missing");
assert(css.includes("Phase 2 — seven-day calendar generator"), "Batch-calendar CSS marker is missing");
assert(css.includes(".perfect-score-limit"), "Perfect-score selector is missing");
assert(css.includes(".batch-planner"), "Batch planner selector is missing");

const bodyStart = source.indexOf("<body>");
assert(bodyStart > close, "admin.html body boundary is invalid");
const bodyBefore = source.slice(bodyStart);
const replacement = '<link rel="stylesheet" href="admin-live-tools.css?v=1.0.0">';
const updated = source.slice(0, open) + replacement + source.slice(close + "</style>".length);
const updatedBody = updated.slice(updated.indexOf("<body>"));
assert(updatedBody === bodyBefore, "Studio body changed during CSS extraction");
assert(!updated.includes(openMarker), "Inline Studio visual-tools style remains");
assert((updated.match(/admin-live-tools\.css\?v=1\.0\.0/g) || []).length === 1, "Expected exactly one admin-live-tools.css load");
const stageCss = updated.indexOf("admin-stage-one.css?v=1.0.0");
const liveCss = updated.indexOf("admin-live-tools.css?v=1.0.0");
assert(stageCss >= 0 && liveCss > stageCss && liveCss < updated.indexOf("</head>"), "Studio stylesheet order changed");
write(output, css);
write("admin.html", updated);
console.log(`Architecture Cleanup Pass 2M extracted ${css.length.toLocaleString()} Studio CSS characters without changing the body.`);
