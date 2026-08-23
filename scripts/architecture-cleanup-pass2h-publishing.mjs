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
assert((admin.match(/id="publishingPanel"/g) || []).length === 1, "Expected one retired Publishing Centre");
assert((admin.match(/id="publishingStatus"/g) || []).length === 1, "Expected one retired Publishing status card");
assert((admin.match(/id="repairStatusTop"/g) || []).length === 1, "Expected one orphaned Repair status card");
assert(admin.includes('<script src="js/admin-core.js?v=19.0.0"></script>'), "admin-core load marker changed unexpectedly");
assert(admin.includes('id="importCentreHeading"'), "Generic importer missing before Publishing cleanup");
assert(admin.includes('id="identityConsolidationCentre"'), "Identity Consolidation missing before Publishing cleanup");

admin = removeElement(admin, 'id="repairStatusTop"', "article");
admin = removeElement(admin, 'id="publishingStatus"', "article");
admin = removeElement(admin, 'id="publishingPanel"', "section");
admin = admin.replace(
  '  <script src="js/admin-core.js?v=19.0.0"></script>',
  '  <script src="js/studio-zip.js?v=1.0.0"></script>\n  <script src="js/admin-core.js?v=19.0.0"></script>'
);
assert(!admin.includes('id="publishingPanel"'), "Retired Publishing Centre remains");
assert(!admin.includes('id="publishingStatus"'), "Retired Publishing status card remains");
assert(!admin.includes('id="repairStatusTop"'), "Orphaned Repair status card remains");
assert(!admin.includes("studio-retired-tool"), "Retired Studio markup remains in admin.html");
assert(admin.includes('src="js/studio-zip.js?v=1.0.0"'), "Shared ZIP utility was not loaded");
assert(admin.includes('id="importCentreHeading"'), "Generic importer was accidentally removed");
assert(admin.includes('id="identityConsolidationCentre"'), "Identity Consolidation was accidentally removed");
write("admin.html", admin);

let core = read("js/admin-core.js");
for (const phase of [3, 6, 7, 10, 11]) {
  assert(core.includes(`BEGIN admin-phase${phase}.js`), `Expected Phase ${phase} before Publishing cleanup`);
}
core = removePhase(core, 6);
core = core.replaceAll("FPL_STUDIO_PHASE6", "FPL_STUDIO_ZIP");
assert(!core.includes("BEGIN admin-phase6.js") && !core.includes("END admin-phase6.js"), "Retired Phase 6 bundle remains");
assert(!core.includes("FPL_STUDIO_PHASE6"), "Legacy Phase 6 API reference remains in admin-core.js");
for (const phase of [3, 7, 10, 11]) {
  assert(core.includes(`BEGIN admin-phase${phase}.js`), `Protected Phase ${phase} was accidentally removed`);
}
write("js/admin-core.js", core);

let batch = read("js/admin-batch-calendar.js");
assert(batch.includes("FPL_STUDIO_PHASE6?.buildZipBlob"), "Batch ZIP dependency changed unexpectedly");
batch = batch.replaceAll("FPL_STUDIO_PHASE6", "FPL_STUDIO_ZIP");
assert(batch.includes("FPL_STUDIO_ZIP?.buildZipBlob"), "Batch generator was not moved to shared ZIP utility");
write("js/admin-batch-calendar.js", batch);

let dailyPublish = read("js/admin-daily-publish.js");
assert(dailyPublish.includes("window.FPL_STUDIO_PHASE6"), "Direct publisher Phase 6 dependency changed unexpectedly");
dailyPublish = dailyPublish.replaceAll("FPL_STUDIO_PHASE6", "FPL_STUDIO_ZIP");
dailyPublish = dailyPublish.replaceAll("originalPhase6", "originalZipApi");
assert(dailyPublish.includes("window.FPL_STUDIO_ZIP"), "Direct publisher was not moved to shared ZIP utility");
assert(!dailyPublish.includes("FPL_STUDIO_PHASE6") && !dailyPublish.includes("originalPhase6"), "Legacy Phase 6 naming remains in direct publisher");
write("js/admin-daily-publish.js", dailyPublish);

const zipUtility = read("js/studio-zip.js");
assert(zipUtility.includes("window.FPL_STUDIO_ZIP = Object.freeze({ buildZipBlob });"), "Shared ZIP utility export is missing");

console.log("Architecture Cleanup Pass 2H Publishing migration complete.");
