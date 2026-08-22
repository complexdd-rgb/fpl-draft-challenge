import fs from "node:fs";

const htmlPath = "admin.html";
const importToolsPath = "js/admin-import-tools-base.js";
const historyStubPath = "data/fpl-history-2015-16.js";

let html = fs.readFileSync(htmlPath, "utf8");
let importTools = fs.readFileSync(importToolsPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function removeBalancedSection(text, uniqueStart) {
  assert(count(text, uniqueStart) === 1, `Legacy section start must occur exactly once`);
  const start = text.indexOf(uniqueStart);
  const tokenPattern = /<section\b[^>]*>|<\/section\s*>/gi;
  tokenPattern.lastIndex = start;
  let depth = 0;
  let sawStart = false;
  let match;
  while ((match = tokenPattern.exec(text))) {
    const token = match[0];
    if (!sawStart) {
      assert(match.index === start, "Legacy import section token did not start at the expected location");
      sawStart = true;
    }
    if (/^<section\b/i.test(token)) depth += 1;
    else depth -= 1;
    if (sawStart && depth === 0) {
      const before = text.slice(0, start).replace(/[ \t]+$/g, "");
      const after = text.slice(tokenPattern.lastIndex).replace(/^\s*\n/, "\n");
      return `${before}${after}`;
    }
  }
  throw new Error("Could not find the balanced end of the legacy import section");
}

const legacySectionStart = '<section class="panel legacy-import-centre studio-retired-tool" id="legacyImportCentre"';
html = removeBalancedSection(html, legacySectionStart);

const historyScript = '  <script src="data/fpl-history-2015-16.js?v=12.0.0"></script>\n';
assert(count(html, historyScript) === 1, "Legacy 2015/16 history script reference must occur exactly once");
html = html.replace(historyScript, "");

const phase12Begin = "/* ===== BEGIN admin-phase12.js ===== */";
const phase12End = "/* ===== END admin-phase12.js ===== */";
assert(count(importTools, phase12Begin) === 1, "Phase 12 begin marker must occur exactly once");
assert(count(importTools, phase12End) === 1, "Phase 12 end marker must occur exactly once");
const phase12Start = importTools.indexOf(phase12Begin);
const phase12EndIndex = importTools.indexOf(phase12End, phase12Start) + phase12End.length;
assert(phase12EndIndex > phase12Start, "Phase 12 marker order is invalid");
importTools = `${importTools.slice(0, phase12Start)}${importTools.slice(phase12EndIndex)}`.replace(/^\s*\n/, "");

assert(fs.existsSync(historyStubPath), "Legacy 2015/16 history compatibility stub is missing unexpectedly");
fs.unlinkSync(historyStubPath);

assert(!html.includes("legacyImportCentre"), "Legacy import centre remains in admin.html");
assert(!html.includes("legacyArchiveInput"), "Legacy archive input remains in admin.html");
assert(!html.includes("fpl-history-2015-16.js"), "Legacy history script reference remains in admin.html");
assert(html.includes('id="importCentreHeading"'), "Generic Historical Database Import Centre must remain");
assert(!importTools.includes(phase12Begin) && !importTools.includes(phase12End), "Phase 12 importer markers remain");
assert(!importTools.includes("FPL_2015_16_HISTORY"), "Legacy 2015/16 history dependency remains in import tools");
assert(importTools.includes("/* ===== BEGIN admin-phase15.js ===== */"), "Active Phase 15 import tooling must remain");

fs.writeFileSync(htmlPath, html, "utf8");
fs.writeFileSync(importToolsPath, `${importTools.trimEnd()}\n`, "utf8");
console.log("Retired 2015/16 archive importer removed; generic historical import centre preserved.");
