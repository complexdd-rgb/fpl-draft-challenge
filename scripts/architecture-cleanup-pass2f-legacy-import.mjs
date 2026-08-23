import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function elementRange(source, marker, tagName) {
  const markerIndex = source.indexOf(marker);
  assert(markerIndex >= 0, `Missing marker: ${marker}`);
  const tagStart = source.lastIndexOf(`<${tagName}`, markerIndex);
  assert(tagStart >= 0, `Could not find <${tagName}> start for ${marker}`);
  const lineStart = source.lastIndexOf("\n", tagStart) + 1;
  const start = /^\s*$/.test(source.slice(lineStart, tagStart)) ? lineStart : tagStart;
  const token = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  token.lastIndex = tagStart;
  let depth = 0;
  let match;
  while ((match = token.exec(source))) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      let end = token.lastIndex;
      if (source[end] === "\r" && source[end + 1] === "\n") end += 2;
      else if (source[end] === "\n") end += 1;
      return { start, end };
    }
  }
  throw new Error(`Could not balance <${tagName}> for ${marker}`);
}

let admin = read("admin.html");
assert((admin.match(/id="legacyImportCentre"/g) || []).length === 1, "Expected exactly one retired 2015/16 legacy import centre");
assert((admin.match(/id="importCentreHeading"/g) || []).length === 1, "Generic Historical Database Import Centre is missing");
assert((admin.match(/id="identityConsolidationCentre"/g) || []).length === 1, "Identity Consolidation Centre is missing");
const legacy = elementRange(admin, 'id="legacyImportCentre"', "section");
admin = admin.slice(0, legacy.start) + admin.slice(legacy.end);
const historyLoadPattern = /^\s*<script\s+src="data\/fpl-history-2015-16\.js[^\n]*<\/script>\s*$/gm;
const historyLoads = admin.match(historyLoadPattern) || [];
assert(historyLoads.length === 1, `Expected one fpl-history-2015-16.js load, found ${historyLoads.length}`);
admin = admin.replace(historyLoadPattern, "");
assert(!admin.includes('id="legacyImportCentre"'), "Retired 2015/16 legacy import centre remains");
assert(!admin.includes("fpl-history-2015-16.js"), "Retired 2015/16 history stub is still loaded");
assert(admin.includes('id="importCentreHeading"'), "Generic Historical Database Import Centre was accidentally removed");
assert(admin.includes('id="identityConsolidationCentre"'), "Identity Consolidation Centre was accidentally removed");
write("admin.html", admin);

let importer = read("js/admin-import-tools-base.js");
const beginNeedle = "BEGIN admin-phase12.js";
const endNeedle = "END admin-phase12.js";
assert((importer.match(/BEGIN admin-phase12\.js/g) || []).length === 1, "Expected one Phase 12 begin marker");
assert((importer.match(/END admin-phase12\.js/g) || []).length === 1, "Expected one Phase 12 end marker");
const beginIndex = importer.indexOf(beginNeedle);
const endIndex = importer.indexOf(endNeedle, beginIndex);
const start = importer.lastIndexOf("\n", beginIndex) + 1;
let end = importer.indexOf("\n", endIndex);
if (end < 0) end = importer.length;
else end += 1;
importer = importer.slice(0, start) + importer.slice(end).replace(/^\n+/, "");
assert(!importer.includes(beginNeedle) && !importer.includes(endNeedle), "Retired Phase 12 importer bundle remains");
assert(importer.includes("BEGIN admin-phase15.js"), "Following active importer bundle was accidentally removed");
write("js/admin-import-tools-base.js", importer);

assert(fs.existsSync("data/fpl-history-2015-16.js"), "Retired 2015/16 history stub was already missing unexpectedly");
fs.rmSync("data/fpl-history-2015-16.js");

let readme = read("README.md");
readme = readme.replace(
  "Historical import and automatic database-repair workspaces are retired from the active Studio workflow. Their legacy code remains temporarily in the repository while the Studio bundles are being modularised and cleaned up.",
  "The generic Historical Database Import Centre and Identity Consolidation tools are retained for verified season expansion. The one-off 2015/16 archive hotfix importer is retired and has been removed; older automatic database-repair workspaces remain outside the active Studio workflow while cleanup continues."
);
write("README.md", readme);

console.log("Architecture Cleanup Pass 2F legacy 2015/16 importer migration complete.");
