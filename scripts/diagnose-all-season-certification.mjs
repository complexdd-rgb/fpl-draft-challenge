import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const run = path => vm.runInThisContext(read(path), { filename: path });

// Minimal browser-shaped environment for the same synchronous Studio modules used by
// the in-page Regression Suite. DOM-only UI hooks are intentionally inert.
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
globalThis.Event = class Event { constructor(type) { this.type = type; } };

// Reproduce the effective Studio certification load order. career-context normally
// document.writes career-shape-rules while admin.html is parsing, so load it explicitly.
run("players.js");
run("js/career-context.js");
run("js/career-shape-rules.js");
run("prompt-library.js");
run("js/validation-engine.js");
run("js/certification-approved-null-policy.js");

document.readyState = "complete";
run("js/career-shape-validation-bridge.js");
run("js/prompt-library-legacy-additions-20260814.js");

const engine = window.ValidationEngine;
if (!engine?.certifySeason || !engine?.getAllSeasonLabels) {
  throw new Error("Validation Engine did not initialise in the headless Studio harness.");
}

const seasons = engine.getAllSeasonLabels();
let failedSeasons = 0;

for (const season of seasons) {
  const result = engine.certifySeason(season);
  if (!result?.ok) {
    failedSeasons += 1;
    console.log(`\n${season} — ERROR: ${result?.error || "certification did not return a result"}`);
    continue;
  }

  const critical = (result.tests || []).filter(test => test.severity === "critical" && !test.passed);
  const warningCount = (result.warnings || []).reduce((sum, warning) => sum + Number(warning.count || 0), 0);
  const summary = result.promptSummary || {};
  console.log(`\n${season} — ${result.status} — ${Number(summary.evaluations || 0).toLocaleString("en-GB")} evaluations — ${warningCount} warnings`);

  if (critical.length) {
    failedSeasons += 1;
    for (const test of critical) {
      console.log(`  FAIL ${test.id}: ${test.label}`);
      console.log(`       actual: ${test.actual}`);
      for (const detail of (test.details || []).slice(0, 8)) console.log(`       - ${detail}`);
    }
  }
}

console.log(`\nCertification summary: ${seasons.length - failedSeasons}/${seasons.length} certified; ${failedSeasons} failed.`);
if (failedSeasons) process.exitCode = 1;
