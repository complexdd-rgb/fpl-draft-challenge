import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const replaceOnce = (source, from, to, label) => {
  const first = source.indexOf(from);
  assert(first >= 0, `Missing ${label}`);
  assert(source.indexOf(from, first + from.length) < 0, `${label} is not unique`);
  return source.slice(0, first) + to + source.slice(first + from.length);
};

let js = read("js/admin-stage-one.js");
assert(js.includes('if (element.dataset.studioRetired === "true") return "retired";'), "Retired-element classifier is missing unexpectedly");
assert(js.includes('/player database auditor|database repair|automatic repair|database health/'), "Retired repair classification keywords are missing unexpectedly");
assert(js.includes('/challenge settings|review the generated xi|test mode|download-ready challenge|challenge history|publishing centre|daily challenge/'), "Retired Publishing Centre classification keyword is missing unexpectedly");
assert(js.includes('const repairBlocked = parseNumber(document.getElementById("repairBlockedCount")?.textContent);'), "Retired repair blocker lookup is missing unexpectedly");
assert(js.includes('const effectiveBlockers = Math.max(critical, repairBlocked);'), "Retired repair blocker aggregation is missing unexpectedly");
assert(js.includes('"auditStatusTop", "auditCriticalCount", "auditInfoCount", "repairBlockedCount",'), "Retired repair blocker observer is missing unexpectedly");

js = replaceOnce(js, '    if (element.dataset.studioRetired === "true") return "retired";\n', "", "retired-element classifier");
js = replaceOnce(js, '/player database auditor|database repair|automatic repair|database health/', '/player database auditor|database health/', "retired repair classification keywords");
js = replaceOnce(js, '/challenge settings|review the generated xi|test mode|download-ready challenge|challenge history|publishing centre|daily challenge/', '/challenge settings|review the generated xi|test mode|download-ready challenge|challenge history|daily challenge/', "retired publishing classification keyword");
js = replaceOnce(js, '    const repairBlocked = parseNumber(document.getElementById("repairBlockedCount")?.textContent);\n', "", "retired repair blocker lookup");
js = replaceOnce(js, '    const effectiveBlockers = Math.max(critical, repairBlocked);', '    const effectiveBlockers = critical;', "retired repair blocker aggregation");
js = replaceOnce(js, '      "auditStatusTop", "auditCriticalCount", "auditInfoCount", "repairBlockedCount",\n', '      "auditStatusTop", "auditCriticalCount", "auditInfoCount",\n', "retired repair blocker observer");
js = js.replace("Start with a fresh read-only scan so the studio can guide the repair work safely.", "Start with a fresh read-only scan so the studio can guide database research safely.");

assert(!js.includes("studioRetired"), "Stage One still contains retired-element compatibility logic");
assert(!js.includes("repairBlockedCount"), "Stage One still reads or observes the removed repair blocker element");
assert(!js.includes("database repair|automatic repair"), "Stage One still classifies retired repair tools");
assert(!js.includes("publishing centre|daily challenge"), "Stage One still classifies the retired Publishing Centre");
assert(js.includes('id: "imports"'), "Historical Imports workspace was accidentally removed");
assert(js.includes("Player Database Auditor"), "Active database-auditor routing was accidentally removed");
write("js/admin-stage-one.js", js);

let css = read("admin-stage-one.css");
const retiredCss = '.studio-retired-tool {\n  display: none !important;\n}\n\n';
css = replaceOnce(css, retiredCss, "", "retired Studio hide rule");
assert(!css.includes("studio-retired-tool"), "Retired Studio hide rule remains");
write("admin-stage-one.css", css);

console.log("Architecture Cleanup Pass 2N removed the final Stage One retired-workspace compatibility residue.");
