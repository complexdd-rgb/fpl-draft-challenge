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

function nodeStub() {
  return {
    id: "",
    hidden: true,
    value: "",
    checked: true,
    textContent: "",
    innerHTML: "",
    dataset: {},
    style: {},
    children: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    appendChild() {},
    prepend() {},
    insertBefore() {},
    insertAdjacentElement() {},
    setAttribute() {},
    getAttribute() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    remove() {}
  };
}

globalThis.window = {
  location: { pathname: "/admin.html", protocol: "https:" },
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
  createElement() { return nodeStub(); },
  createTreeWalker() { return { nextNode() { return null; } }; },
  head: { appendChild() {} },
  documentElement: { dataset: {} },
  body: { append() {} },
  write() {}
};

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
globalThis.Event = class Event { constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); } };
globalThis.Node = { TEXT_NODE: 3 };
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.MutationObserver = class MutationObserver { constructor() {} observe() {} disconnect() {} };
globalThis.confirm = () => true;

globalThis.navigator = { clipboard: { writeText: async () => {} } };

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
run("js/prompt-quality-pack-v1.js");
run("js/prompt-quality-pack-v2.js");
run("js/prompt-quality-pack-v3.js");
for (let index = 1; index <= 8; index += 1) run(`js/prompt-approved-ids-20260814-${index}.js`);
run("js/prompt-approved-disabled-20260814.js");
run("js/prompt-approved-baseline.js");

if (!window.FPL_APPROVED_PROMPT_BASELINE?.ready) throw new Error("Approved baseline did not initialise.");

const library = window.ValidationEngine.getPromptLibrary();
const statsCache = new Map();
function getPromptStats(prompt) {
  if (statsCache.has(prompt.id)) return statsCache.get(prompt.id);
  const bestByPlayer = new Map();
  for (const player of window.FPL_PLAYERS || []) {
    for (const season of player.seasons || []) {
      if (season?.position !== prompt.position || Number(season?.minutes) <= 0) continue;
      const record = Object.assign(Object.create(season), {
        playerId: player.playerId,
        playerName: player.name,
        name: player.name
      });
      let valid = false;
      try { valid = Boolean(prompt.test(record)); } catch (_) {}
      if (!valid) continue;
      const candidate = {
        ...record,
        playerId: player.playerId,
        playerName: player.name,
        name: player.name,
        points: Number(record.points) || 0
      };
      const current = bestByPlayer.get(player.playerId);
      if (!current || candidate.points > current.points) bestByPlayer.set(player.playerId, candidate);
    }
  }
  const matches = [...bestByPlayer.values()];
  matches.sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  const value = { playerCount: bestByPlayer.size, bestByPlayer, bestAnswer: matches[0] || null, matches };
  statsCache.set(prompt.id, value);
  return value;
}
window.FPL_STUDIO_API = {
  getPromptLibrary: () => library,
  getPromptStats,
  invalidatePromptStats() { statsCache.clear(); }
};

// Studio loads these directly before the weekly generator.
run("nationality-enrichment.js");
run("js/prompt-nationality-context-pack-v1.js");
await new Promise(resolve => setTimeout(resolve, 20));

const isNationality = prompt => {
  const family = String(prompt?.family || "").toLowerCase();
  const tags = Array.isArray(prompt?.tags) ? prompt.tags.map(tag => String(tag).toLowerCase()) : [];
  return family.includes("nationality") || tags.some(tag => tag === "nationality" || tag.startsWith("country-"));
};

const beforeQuality = library.filter(prompt => prompt?.enabled !== false);
const beforeNationality = beforeQuality.filter(isNationality);
console.log(`Before 4-star analysis: ${beforeQuality.length} enabled prompts; ${beforeNationality.length} nationality prompts.`);
console.log(`Nationality pack: ${JSON.stringify(window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1 || null)}`);

// admin-import-tools-base owns the exact Quality Analyser engine used by the four-star enforcer.
run("js/admin-import-tools-base.js");
const engine = window.FPL_PROMPT_QUALITY_ENGINE;
if (typeof engine?.analyseLibrary !== "function") throw new Error("Prompt quality engine did not initialise.");

const results = await engine.analyseLibrary(beforeQuality, window.FPL_PLAYERS, {
  progress(current, total) {
    if (current === total || current % 200 === 0) console.log(`Quality analysis ${current}/${total}`);
  }
});
const resultById = new Map(results.map(item => [String(item?.id || ""), item]));
const certified = beforeQuality.filter(prompt => Number(resultById.get(String(prompt.id))?.suggestedRating || 0) >= 4);
const certifiedNationality = certified.filter(isNationality);
const byPosition = Object.fromEntries(["GK", "DEF", "MID", "FWD"].map(position => [position, certifiedNationality.filter(prompt => prompt.position === position).length]));

console.log(`Certified 4-star pool: ${certified.length} prompts.`);
console.log(`Certified nationality prompts: ${certifiedNationality.length}; by position ${JSON.stringify(byPosition)}.`);
for (const prompt of beforeNationality) {
  const result = resultById.get(String(prompt.id));
  console.log(`NATIONALITY ${prompt.position} ${prompt.id} -> ${Number(result?.suggestedRating || 0)} star; answers=${Number(result?.answerCount || result?.playerCount || getPromptStats(prompt).playerCount)}`);
}

if (!certifiedNationality.length) {
  console.error("DIAGNOSIS: the certified pool contains zero nationality prompts, so the hard one-nationality-per-day generator cannot build day 1.");
  process.exitCode = 2;
} else if (!["DEF", "MID", "FWD"].every(position => byPosition[position] > 0)) {
  console.error("DIAGNOSIS: certified nationality coverage is missing one or more required outfield positions.");
  process.exitCode = 3;
} else {
  console.log("Certified nationality coverage is sufficient for the hard weekly quota.");
}
