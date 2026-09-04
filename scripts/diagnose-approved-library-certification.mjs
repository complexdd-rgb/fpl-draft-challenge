import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const run = path => vm.runInThisContext(read(path), { filename: path });

const listeners = new Map();
const addListener = (type, handler) => {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(handler);
};
const dispatch = event => {
  for (const handler of [...(listeners.get(event?.type) || [])]) handler(event);
};

globalThis.window = {
  location: { pathname: "/admin.html" },
  setTimeout,
  clearTimeout,
  addEventListener: addListener,
  removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
  dispatchEvent: dispatch,
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
run("js/prompt-era-range-wording.js");

// Reproduce the repository-owned approved 4★+ path used by the browser before
// Quality Enforcement v2 publishes its final readiness signal. The durable survivor
// pack replaces its two held parent prompts without changing the approved population.
run("js/prompt-quality-pack-v1.js");
run("js/prompt-quality-pack-v2.js");
run("js/prompt-quality-pack-v3.js");
for (let index = 1; index <= 8; index += 1) run(`js/prompt-approved-ids-20260814-${index}.js`);
run("js/prompt-approved-disabled-20260814.js");
run("js/prompt-approved-baseline.js");
run("js/prompt-refinement-survivors-v1.js");

if (!window.FPL_APPROVED_PROMPT_BASELINE?.ready) {
  throw new Error("Approved prompt baseline did not initialise in the headless Studio harness.");
}
if (!window.FPL_REFINEMENT_SURVIVOR_PACK_V1?.ready) {
  throw new Error("Durable refinement survivor pack did not initialise in the headless Studio harness.");
}

const engine = window.ValidationEngine;
const library = engine.getPromptLibrary();
window.FPL_STUDIO_API = {
  getPromptLibrary: () => library,
  invalidatePromptStats() {}
};

// The real Studio restores its deterministic nationality-context prompts after the
// approved baseline has removed transient/non-approved material. Reproduce that
// post-baseline state so CI certifies the same effective library as the browser.
run("nationality-enrichment.js");
run("js/prompt-nationality-context-pack-v1.js");
await new Promise(resolve => setTimeout(resolve, 25));
dispatch(new CustomEvent("fpl:prompt-tools-ready"));
await new Promise(resolve => setTimeout(resolve, 25));

if (!window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1?.ready) {
  throw new Error("Nationality context prompt pack did not initialise in the headless Studio harness.");
}

const prompts = library.filter(prompt => prompt?.enabled !== false);
const ids = prompts.map(prompt => String(prompt?.id || "")).filter(Boolean);
const uniqueIds = new Set(ids);
const belowFloor = prompts.filter(prompt => Number(prompt?.rating || 0) < 4);
if (ids.length !== prompts.length || uniqueIds.size !== prompts.length) {
  throw new Error(`Approved Studio library has missing or duplicate prompt IDs: ${ids.length}/${prompts.length} populated, ${uniqueIds.size} unique.`);
}
if (belowFloor.length) {
  throw new Error(`Approved Studio library contains ${belowFloor.length} prompt(s) below the 4★ floor.`);
}
if (window.FPL_REFINEMENT_SURVIVOR_PACK_V1.parentsPresentAfter !== 0) {
  throw new Error("A weak Refinement Incubator parent survived the durable survivor promotion.");
}
if (prompts.length !== 851 || library.length !== 851) {
  throw new Error(`Certified-library parity failed: expected 851 prompts, found ${prompts.length} enabled / ${library.length} total.`);
}

console.log(`Approved Studio library: ${prompts.length.toLocaleString("en-GB")} enabled 4★+ prompts (${library.length.toLocaleString("en-GB")} total).`);
console.log(`Baseline metadata: ${JSON.stringify(window.FPL_APPROVED_PROMPT_BASELINE)}`);
console.log(`Survivor metadata: ${JSON.stringify(window.FPL_REFINEMENT_SURVIVOR_PACK_V1)}`);
console.log(`Nationality context metadata: ${JSON.stringify(window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1)}`);

const targetSeasons = engine.getAllSeasonLabels();
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

console.log(`\nCertified-library summary: ${targetSeasons.length - failedSeasons}/${targetSeasons.length} certified; ${failedSeasons} failed.`);
if (failedSeasons) process.exitCode = 1;