import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function removeElement(source, marker, tagName) {
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
      return source.slice(0, start) + source.slice(end);
    }
  }
  throw new Error(`Could not balance <${tagName}> for ${marker}`);
}

function removePhase(source, phase) {
  const begin = `BEGIN admin-phase${phase}.js`;
  const end = `END admin-phase${phase}.js`;
  assert((source.match(new RegExp(`BEGIN admin-phase${phase}\\.js`, "g")) || []).length === 1, `Expected one Phase ${phase} begin marker`);
  assert((source.match(new RegExp(`END admin-phase${phase}\\.js`, "g")) || []).length === 1, `Expected one Phase ${phase} end marker`);
  const beginIndex = source.indexOf(begin);
  const endIndex = source.indexOf(end, beginIndex);
  const start = source.lastIndexOf("\n", beginIndex) + 1;
  let finish = source.indexOf("\n", endIndex);
  if (finish < 0) finish = source.length;
  else finish += 1;
  return source.slice(0, start) + source.slice(finish).replace(/^\n+/, "");
}

let admin = read("admin.html");
assert((admin.match(/data-studio-retired="true"/g) || []).length === 3, "Expected three retired Studio panels before Pass 2G");
assert((admin.match(/id="publishingPanel"/g) || []).length === 1, "Retired Publishing Centre is missing");
assert((admin.match(/id="databaseRepairPanel"/g) || []).length === 1, "Expected one retired Database Repair Centre");
assert((admin.match(/id="autoRepairHeading"/g) || []).length === 1, "Expected one retired Automatic Repair Engine");
assert((admin.match(/id="databaseAuditorPanel"/g) || []).length === 1, "Active Player Database Auditor is missing");
assert((admin.match(/id="importCentreHeading"/g) || []).length === 1, "Generic Historical Database Import Centre is missing");
assert((admin.match(/id="identityConsolidationCentre"/g) || []).length === 1, "Identity Consolidation Centre is missing");

admin = removeElement(admin, 'id="databaseRepairPanel"', "section");
admin = removeElement(admin, 'id="autoRepairHeading"', "section");

assert(!admin.includes('id="databaseRepairPanel"'), "Retired Database Repair Centre remains");
assert(!admin.includes('id="autoRepairHeading"'), "Retired Automatic Repair Engine remains");
assert((admin.match(/data-studio-retired="true"/g) || []).length === 1, "Unexpected retired Studio panel count after repair cleanup");
assert(admin.includes('id="publishingPanel"'), "Retired Publishing Centre was accidentally removed");
assert(admin.includes('id="databaseAuditorPanel"'), "Active Player Database Auditor was accidentally removed");
assert(admin.includes('id="importCentreHeading"'), "Generic Historical Database Import Centre was accidentally removed");
assert(admin.includes('id="identityConsolidationCentre"'), "Identity Consolidation Centre was accidentally removed");
write("admin.html", admin);

let core = read("js/admin-core.js");
for (const phase of [7, 8, 9, 10, 11]) {
  assert(core.includes(`BEGIN admin-phase${phase}.js`), `Expected Phase ${phase} before cleanup`);
}
core = removePhase(core, 8);
core = removePhase(core, 9);
assert(!core.includes("BEGIN admin-phase8.js") && !core.includes("END admin-phase8.js"), "Retired Phase 8 repair bundle remains");
assert(!core.includes("BEGIN admin-phase9.js") && !core.includes("END admin-phase9.js"), "Retired Phase 9 auto-repair bundle remains");
for (const phase of [7, 10, 11]) {
  assert(core.includes(`BEGIN admin-phase${phase}.js`), `Protected Phase ${phase} was accidentally removed`);
}
write("js/admin-core.js", core);

let readme = read("README.md");
readme = readme.replace(
  "The generic Historical Database Import Centre and Identity Consolidation tools are retained for verified season expansion. The one-off 2015/16 archive hotfix importer is retired and has been removed; older automatic database-repair workspaces remain outside the active Studio workflow while cleanup continues.",
  "The generic Historical Database Import Centre and Identity Consolidation tools are retained for verified season expansion. The one-off 2015/16 archive hotfix importer and the retired automatic database-repair workspaces have been removed from the active source."
);
write("README.md", readme);

console.log("Architecture Cleanup Pass 2G retired repair UI and bundles migration complete.");
