import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const run = path => vm.runInThisContext(read(path), { filename: path });

const listeners = new Map();
const addWindowListener = (type, handler) => {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(handler);
};

function element(value = "") {
  const handlers = new Map();
  return {
    value,
    checked: true,
    disabled: false,
    hidden: false,
    textContent: "",
    innerHTML: "",
    dataset: {},
    style: {},
    children: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(handler);
    },
    dispatch(type) { for (const handler of handlers.get(type) || []) handler({ target: this }); },
    setAttribute() {},
    removeAttribute() {},
    append() {},
    appendChild() {},
    remove() {},
    click() {}
  };
}

const elements = {
  batchStartDate: element("2026-09-03"),
  batchFirstNumber: element("60"),
  generateWeekBtn: element(),
  downloadWeekBtn: element(),
  clearWeekBtn: element(),
  batchStatus: element(),
  batchReview: element(),
  batchManifestChip: element(),
  challengeName: element("The Generated Mix"),
  difficultyTarget: element("mixed"),
  minAnswers: element("6"),
  maxAnswers: element("100"),
  minAntiMeta: element("5"),
  cooldownChallenges: element("7"),
  avoidRecent: element(),
  maxPerfectScore: element("0"),
  batchFormation: element("4-4-2"),
  batchThemePreset: element("generated-mix"),
  challengeNumber: element("60"),
  releaseDate: element("2026-09-03")
};
elements.avoidRecent.checked = true;

const documentStub = {
  readyState: "complete",
  baseURI: "file:///admin.html",
  querySelector(selector) {
    if (selector.startsWith("#")) return elements[selector.slice(1)] || null;
    return null;
  },
  querySelectorAll() { return []; },
  getElementById(id) { return elements[id] || null; },
  addEventListener() {},
  createElement() { return element(); },
  head: { appendChild() {} },
  body: { append() {}, appendChild() {} },
  documentElement: { dataset: {} }
};

globalThis.document = documentStub;
globalThis.window = {
  location: { pathname: "/admin.html", protocol: "file:" },
  setTimeout,
  clearTimeout,
  addEventListener: addWindowListener,
  removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
  dispatchEvent(event) { for (const handler of [...(listeners.get(event?.type) || [])]) handler(event); },
  requestAnimationFrame(callback) { return setTimeout(callback, 0); }
};
window.window = window;
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
globalThis.Event = class Event { constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); } };

run("players.js");
run("js/career-context.js");
run("js/career-shape-rules.js");
run("prompt-library.js");
run("js/validation-engine.js");
run("js/certification-approved-null-policy.js");
run("js/career-shape-validation-bridge.js");
run("js/prompt-library-legacy-additions-20260814.js");
run("js/prompt-era-range-wording.js");
run("js/prompt-quality-pack-v1.js");
run("js/prompt-quality-pack-v2.js");
run("js/prompt-quality-pack-v3.js");
for (let index = 1; index <= 8; index += 1) run(`js/prompt-approved-ids-20260814-${index}.js`);
run("js/prompt-approved-disabled-20260814.js");
run("js/prompt-approved-baseline.js");

const library = window.ValidationEngine.getPromptLibrary();
const records = [];
for (const player of window.FPL_PLAYERS || []) {
  for (const season of player.seasons || []) {
    records.push({ ...season, playerId: player.playerId, playerName: player.name });
  }
}
const statsCache = new Map();
const seasonSortValue = value => Number(String(value || "").slice(0, 4)) || 0;
function getPromptStats(prompt) {
  if (statsCache.has(prompt.id)) return statsCache.get(prompt.id);
  const matches = [];
  for (const record of records) {
    if (record.position !== prompt.position || Number(record?.minutes) <= 0) continue;
    try { if (prompt.test(record)) matches.push(record); } catch (_) {}
  }
  const bestByPlayer = new Map();
  for (const match of matches) {
    const previous = bestByPlayer.get(match.playerId);
    if (!previous || Number(match.points) > Number(previous.points) || (Number(match.points) === Number(previous.points) && seasonSortValue(match.season) > seasonSortValue(previous.season))) {
      bestByPlayer.set(match.playerId, match);
    }
  }
  const allBestAnswers = [...bestByPlayer.values()].sort((a, b) => Number(b.points || 0) - Number(a.points || 0) || String(a.playerName).localeCompare(String(b.playerName)));
  const stats = { playerCount: bestByPlayer.size, seasonCount: matches.length, bestByPlayer, bestAnswer: allBestAnswers[0] || null, topAnswers: allBestAnswers.slice(0, 5) };
  statsCache.set(prompt.id, stats);
  return stats;
}
window.FPL_STUDIO_API = {
  getPromptLibrary: () => library,
  getPromptStats,
  invalidatePromptStats() { statsCache.clear(); }
};

run("nationality-enrichment.js");
run("js/prompt-nationality-context-pack-v1.js");
await new Promise(resolve => setTimeout(resolve, 20));

run("js/admin-import-tools-base.js");
const qualityResults = await window.FPL_PROMPT_QUALITY_ENGINE.analyseLibrary(library.filter(prompt => prompt?.enabled !== false), window.FPL_PLAYERS);
const qualityById = new Map(qualityResults.map(item => [String(item?.id || ""), item]));
const certified = library.filter(prompt => prompt?.enabled !== false && Number(qualityById.get(String(prompt.id))?.suggestedRating || 0) >= 4);
library.splice(0, library.length, ...certified);
statsCache.clear();
window.FPL_DAILY_GENERATION_PROMPT_POOL = Object.freeze(certified.slice());
window.FPL_FOUR_STAR_LIBRARY = Object.freeze({ ready: true, total: certified.length, minimumRating: 4 });

run("challenges/manifest.js");
window.FPL_STUDIO_PHASE3 = Object.freeze({
  getCooldownPromptIds: () => new Set(),
  getHistory: () => [],
  recordBatchChallenges() {}
});

// Deterministic random stream so CI reproduces the same candidate search every run.
let seed = 0x5e9f2026;
const nativeRandom = Math.random;
Math.random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

try {
  run("js/admin-batch-calendar.js");
  await window.FPL_STUDIO_BATCH_CALENDAR.generate();
} finally {
  Math.random = nativeRandom;
}

const results = window.FPL_STUDIO_BATCH_CALENDAR.getResults();
console.log(`Headless weekly generator produced ${results.length}/7 result rows from ${certified.length} certified prompts.`);
for (const result of results) {
  console.log(JSON.stringify({ date: result.date, status: result.status, promptCount: result.promptIds?.length || 0, promptMix: result.promptMix, issues: result.issues || [] }));
}
console.log(`Generator status line: ${elements.batchStatus.textContent}`);

if (results.length !== 7 || results.some(result => result.status !== "PASS")) {
  const last = results[results.length - 1];
  throw new Error(`Weekly headless reproduction failed on ${last?.date || "before day 1"}: ${(last?.issues || [elements.batchStatus.textContent || last?.status || "unknown failure"])[0]}`);
}
console.log("Headless weekly 4-4-2 generation passed all seven days.");
