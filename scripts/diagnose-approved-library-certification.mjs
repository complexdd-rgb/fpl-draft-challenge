import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const run = path => vm.runInThisContext(read(path), { filename: path });

globalThis.window = {
  location: { pathname: "/admin.html" },
  setTimeout,
  clearTimeout,
  addEventListener() {},
  dispatchEvent() {},
  requestAnimationFrame(callback) { return setTimeout(callback, 0); }
};
window.window = window;

globalThis.document = {
  readyState: "loading",
  baseURI: "https://example.invalid/admin.html",
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  addEventListener() {},
  createElement() { return { classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, addEventListener() {}, style: {}, dataset: {} }; },
  head: { appendChild() {} },
  documentElement: { dataset: {} },
  write() {}
};

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
globalThis.Event = class Event { constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); } };

run("players.js");
run("js/career-context.js");
run("js/career-shape-rules.js");
run("prompt-library.js");
run("js/validation-engine.js");
run("js/certification-approved-null-policy.js");
document.readyState = "complete";
run("js/career-shape-validation-bridge.js");
run("js/prompt-library-legacy-additions-20260814.js");

// Reproduce the approved-library path used by Career Overlap Wording before the
// four-star analyser performs any additional cached rejection pass.
run("js/prompt-quality-pack-v1.js");
run("js/prompt-quality-pack-v2.js");
run("js/prompt-quality-pack-v3.js");
for (let index = 1; index <= 8; index += 1) run(`js/prompt-approved-ids-20260814-${index}.js`);
run("js/prompt-approved-disabled-20260814.js");
run("js/prompt-approved-baseline.js");

if (!window.FPL_APPROVED_PROMPT_BASELINE?.ready) {
  throw new Error("Approved prompt baseline did not initialise in the headless Studio harness.");
}

const engine = window.ValidationEngine;
const prompts = engine.getPromptLibrary().filter(prompt => prompt?.enabled !== false);
console.log(`Approved Studio library: ${prompts.length.toLocaleString("en-GB")} enabled prompts (${engine.getPromptLibrary().length.toLocaleString("en-GB")} total).`);
console.log(`Baseline metadata: ${JSON.stringify(window.FPL_APPROVED_PROMPT_BASELINE)}`);

const targetSeasons = ["2022/23", "2021/22", "2019/20", "2018/19", "2017/18", "2015/16", "2014/15", "2013/14", "2012/13"];
let failedSeasons = 0;

for (const season of targetSeasons) {
  const result = engine.certifySeason(season);
  const critical = (result?.tests || []).filter(test => test.severity === "critical" && !test.passed);
  const warningCount = (result?.warnings || []).reduce((sum, warning) => sum + Number(warning.count || 0), 0);
  console.log(`\n${season} — ${result?.status || "ERROR"} — ${Number(result?.promptSummary?.evaluations || 0).toLocaleString("en-GB")} evaluations — ${warningCount} warnings`);
  for (const test of critical) {
    console.log(`  FAIL ${test.id}: ${test.label}`);
    console.log(`       actual: ${test.actual}`);
    for (const detail of (test.details || []).slice(0, 12)) console.log(`       - ${detail}`);
  }
  if (!result?.ok || critical.length) failedSeasons += 1;
}

console.log(`\nApproved-library failure summary: ${failedSeasons}/${targetSeasons.length} target seasons failed.`);
// Diagnostic only: keep the workflow green so the log remains available even when the
// browser-reproduced approved library exposes failures we are investigating.
