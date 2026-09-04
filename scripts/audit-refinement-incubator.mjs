import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const run = path => vm.runInThisContext(read(path), { filename: path });
const outDir = new URL("../reports/", import.meta.url);
fs.mkdirSync(outDir, { recursive: true });

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
    id: "", hidden: true, value: "", checked: true, textContent: "", innerHTML: "", dataset: {}, style: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, appendChild() {}, prepend() {}, insertBefore() {}, insertAdjacentElement() {},
    setAttribute() {}, getAttribute() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }, remove() {}
  };
}

globalThis.window = {
  location: { pathname: "/admin.html", protocol: "https:", reload() {} },
  setTimeout, clearTimeout,
  addEventListener: addListener,
  removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
  dispatchEvent: dispatch,
  requestAnimationFrame(callback) { return setTimeout(callback, 0); }
};
window.window = window;

globalThis.document = {
  readyState: "loading",
  baseURI: "https://example.invalid/admin.html",
  querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, addEventListener() {},
  createElement() { return nodeStub(); }, createTreeWalker() { return { nextNode() { return null; } }; },
  head: { appendChild() {} }, documentElement: { dataset: {} }, body: { append() {}, appendChild() {} }, write() {}
};

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(String(key)) ? storage.get(String(key)) : null; },
  setItem(key, value) { storage.set(String(key), String(value)); },
  removeItem(key) { storage.delete(String(key)); }
};
globalThis.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
globalThis.Event = class Event { constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); } };
globalThis.Node = { TEXT_NODE: 3 };
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.MutationObserver = class MutationObserver { constructor() {} observe() {} disconnect() {} };
globalThis.confirm = () => true;

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

if (!window.FPL_APPROVED_PROMPT_BASELINE?.ready) throw new Error("Approved prompt baseline did not initialise.");

const library = window.ValidationEngine.getPromptLibrary();
const statsCache = new Map();
function getPromptStats(prompt) {
  if (statsCache.has(prompt.id)) return statsCache.get(prompt.id);
  const bestByPlayer = new Map();
  for (const player of window.FPL_PLAYERS || []) {
    for (const season of player.seasons || []) {
      if (season?.position !== prompt.position || Number(season?.minutes) <= 0) continue;
      const record = Object.assign(Object.create(season), { playerId: player.playerId, playerName: player.name, name: player.name });
      let valid = false;
      try { valid = Boolean(prompt.test(record)); } catch (_) {}
      if (!valid) continue;
      const candidate = { ...record, playerId: player.playerId, playerName: player.name, name: player.name, points: Number(record.points) || 0 };
      const current = bestByPlayer.get(player.playerId);
      if (!current || candidate.points > current.points) bestByPlayer.set(player.playerId, candidate);
    }
  }
  const matches = [...bestByPlayer.values()].sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
  const value = { playerCount: bestByPlayer.size, bestByPlayer, bestAnswer: matches[0] || null, matches };
  statsCache.set(prompt.id, value);
  return value;
}
window.FPL_STUDIO_API = { getPromptLibrary: () => library, getPromptStats, invalidatePromptStats() { statsCache.clear(); } };

// The nationality context pack is loaded before Prompt Studio in the browser, then re-runs after
// the approved baseline removes non-approved generated material. Reproduce the stable post-baseline state.
run("nationality-enrichment.js");
run("js/prompt-nationality-context-pack-v1.js");
await new Promise(resolve => setTimeout(resolve, 25));
dispatch(new CustomEvent("fpl:prompt-tools-ready"));
await new Promise(resolve => setTimeout(resolve, 25));

run("js/admin-import-tools-base.js");
const engine = window.FPL_PROMPT_QUALITY_ENGINE;
if (typeof engine?.analyseLibrary !== "function") throw new Error("Prompt quality engine did not initialise.");

const source = library.filter(prompt => prompt?.enabled !== false);
console.log(`Analysing ${source.length.toLocaleString("en-GB")} enabled Studio prompts…`);
const results = await engine.analyseLibrary(source, window.FPL_PLAYERS, {
  progress(current, total) {
    if (current === total || current % 200 === 0) console.log(`Quality analysis ${current}/${total}`);
  }
});

const HARD_ISSUES = new Set(["broken-rule", "no-answers", "runtime-error", "invalid-rule"]);
const RANGES = Object.freeze({
  GK: { narrow: 5, idealLow: 8, idealHigh: 35, broad: 70 },
  DEF: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
  MID: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
  FWD: { narrow: 6, idealLow: 12, idealHigh: 60, broad: 110 }
});
const FIELD_STEPS = Object.freeze({
  points: 10, minutes: 250, goals: 1, assists: 1, goalInvolvements: 2, cleanSheets: 2,
  bonus: 5, saves: 10, goalsConceded: 5, yellowCards: 1, redCards: 1,
  startingPrice: 0.5, finalPrice: 0.5, leaguePosition: 1, ageAtSeasonStart: 1,
  careerSeasonCount: 1, careerClubCount: 1, fullNameLength: 1, firstNameLength: 1,
  surnameLength: 1, nameWordCount: 1,
  maxPointsGain: 10, maxGoalsGain: 1, maxMinutesGain: 250, maxClubSwitchPointsGain: 10,
  maxClubSwitchGoalsGain: 1, maxConsecutive2000Minutes: 1, maxConsecutive100Points: 1,
  maxConsecutiveScoringSeasons: 1, maxConsecutive8Goals: 1, tableBandCount: 1,
  maxClubsWithSameManager: 1
});
const NUMBER_FIELDS = new Set([
  "points", "minutes", "goals", "assists", "goalInvolvements", "cleanSheets", "bonus", "saves", "goalsConceded",
  "yellowCards", "redCards", "startingPrice", "finalPrice", "leaguePosition", "ageAtSeasonStart", "careerSeasonCount",
  "careerClubCount", "fullNameLength", "firstNameLength", "surnameLength", "nameWordCount"
]);
const SOURCE_FIELDS = Object.freeze(Object.keys(FIELD_STEPS).sort((a, b) => b.length - a.length));
const SOURCE_FIELD_PRIORITY = Object.freeze({
  points: 0, goals: 0, assists: 0, goalInvolvements: 0, cleanSheets: 0, bonus: 0, saves: 0,
  goalsConceded: 0, startingPrice: 0, finalPrice: 0, yellowCards: 0, redCards: 0,
  maxPointsGain: 1, maxGoalsGain: 1, maxClubSwitchPointsGain: 1, maxClubSwitchGoalsGain: 1,
  maxConsecutive2000Minutes: 1, maxConsecutive100Points: 1, maxConsecutiveScoringSeasons: 1,
  maxConsecutive8Goals: 1, tableBandCount: 1, maxClubsWithSameManager: 1, maxMinutesGain: 1,
  careerSeasonCount: 2, careerClubCount: 2, ageAtSeasonStart: 2, fullNameLength: 2,
  firstNameLength: 2, surnameLength: 2, nameWordCount: 2, leaguePosition: 3, minutes: 5
});

const tagsOf = prompt => Array.isArray(prompt?.tags) ? prompt.tags.map(tag => String(tag).toLowerCase()) : [];
function issueCodes(result) {
  return (Array.isArray(result?.issues) ? result.issues : []).map(issue => typeof issue === "string" ? issue : String(issue?.code || issue?.type || issue?.id || issue?.issue || "")).filter(Boolean);
}
function overlapValue(result) {
  const values = [result?.overlap?.max, result?.maxOverlap, result?.overlapMax, result?.highestOverlap].map(Number).filter(Number.isFinite);
  return values.length ? Math.max(...values) : 0;
}
function familyBonus(prompt) {
  const tags = new Set(tagsOf(prompt));
  let bonus = 0;
  if (tags.has("career-evolution")) bonus += 6;
  if (tags.has("nationality")) bonus += 4;
  if (tags.has("manager") || tags.has("manager-journey")) bonus += 4;
  if (tags.has("career-shape")) bonus += 3;
  if (tags.has("career-total") || tags.has("career-seasons")) bonus += 2;
  if (tags.has("season-rule")) bonus += 2;
  if (tags.has("anti-meta")) bonus += 2;
  if (tags.has("position-journey") || tags.has("club-status-journey")) bonus += 2;
  return Math.min(8, bonus);
}
function decision(prompt, result) {
  const rawRating = Number(result?.suggestedRating || 0);
  const rawScoreValue = Number(result?.score);
  const rawScore = Number.isFinite(rawScoreValue) ? rawScoreValue : rawRating === 5 ? 85 : rawRating === 4 ? 72 : rawRating === 3 ? 58 : 0;
  const playerCount = Math.max(0, Number(result?.playerCount || 0));
  const overlap = overlapValue(result);
  const issues = issueCodes(result);
  const quality = String(result?.quality || "").toLowerCase();
  const errorCount = Math.max(0, Number(result?.errorCount || 0));
  const hardReject = errorCount > 0 || playerCount < 3 || quality === "broken" || quality === "poor" || overlap >= 0.97 || issues.some(issue => HARD_ISSUES.has(issue));
  const bonus = hardReject ? 0 : familyBonus(prompt);
  const adjustedScore = Math.min(100, rawScore + bonus);
  if (hardReject) return { state: "rejected", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues };
  if (rawRating >= 4) return { state: "certified", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues };
  if (rawRating === 3 && rawScore >= 66 && adjustedScore >= 72 && overlap < 0.94) return { state: "rescued", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues };
  if (rawRating === 3 && rawScore >= 58) return { state: "incubator", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues };
  return { state: "rejected", rawRating, rawScore, adjustedScore, bonus, playerCount, overlap, issues };
}
function sourceMetricPriority(field, operator, value) {
  let priority = Number(SOURCE_FIELD_PRIORITY[field] ?? 2);
  if (field === "minutes" && [">", ">="].includes(operator) && Number(value) <= 0) priority += 100;
  return priority;
}

function sourceMetricMatch(sourceText) {
  const matches = [];
  for (const field of SOURCE_FIELDS) {
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`((?:Number\\()?p\\.(?:_careerEvolution\\?\\.)?${escaped}(?:\\))?\\s*)(>=|<=|>|<)\\s*(-?\\d+(?:\\.\\d+)?)`);
    const match = pattern.exec(sourceText);
    if (!match) continue;
    matches.push({
      field, pattern, match, sourceIndex: Number(match.index) || 0,
      priority: sourceMetricPriority(field, match[2], Number(match[3]))
    });
  }
  matches.sort((a, b) => a.priority - b.priority || a.sourceIndex - b.sourceIndex || a.field.localeCompare(b.field));
  return matches[0] || null;
}
function answerBand(position, count) {
  const range = RANGES[position] || RANGES.MID;
  if (count < 3) return "invalid";
  if (count < range.narrow) return "very-narrow";
  if (count < range.idealLow) return "narrow";
  if (count <= range.idealHigh) return "ideal";
  if (count <= range.broad) return "broad";
  return "very-broad";
}
function overlapBand(value) {
  if (value >= 0.97) return "hard-reject";
  if (value >= 0.94) return "too-high-for-rescue";
  if (value >= 0.85) return "high";
  if (value >= 0.7) return "moderate";
  return "low";
}
function tunability(prompt, d) {
  const rule = prompt?.studioRule;
  if (rule?.kind === "builder" && Array.isArray(rule.conditions)) {
    const condition = rule.conditions.find(item => NUMBER_FIELDS.has(item?.field) && ["gte", "lte", "gt", "lt", "eq", "between"].includes(item?.operator));
    if (condition) return { type: "builder-threshold", field: condition.field, operator: condition.operator, value: condition.value, plannedVariants: 3 };
  }
  const sourceText = String(prompt?.testSource || prompt?.studioRule?.source || "").trim();
  const metric = sourceMetricMatch(sourceText);
  if (metric) return { type: "source-threshold", ...metric, plannedVariants: 3 };
  const range = RANGES[prompt?.position] || RANGES.MID;
  if (sourceText && d.playerCount > range.idealHigh) return { type: "minutes-wrapper", field: "minutes", operator: ">=", value: null, plannedVariants: 3 };
  return { type: "no-safe-threshold", field: null, operator: null, value: null, plannedVariants: 0 };
}
function dominantFamily(prompt) {
  const tags = tagsOf(prompt);
  for (const tag of ["career-evolution", "nationality", "manager-journey", "manager", "career-shape", "career-total", "career-seasons", "season-rule", "anti-meta", "position-journey", "club-status-journey"]) {
    if (tags.includes(tag)) return tag;
  }
  return String(prompt?.family || tags[0] || "other").toLowerCase();
}
function countBy(items, getter) {
  const output = {};
  for (const item of items) {
    const key = String(getter(item) ?? "unknown");
    output[key] = (output[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(output).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

const resultById = new Map(results.map(result => [String(result?.id || ""), result]));
const rows = source.map(prompt => {
  const result = resultById.get(String(prompt?.id || ""));
  const d = decision(prompt, result);
  const tune = tunability(prompt, d);
  const rescueRawGap = Math.max(0, 66 - d.rawScore);
  const rescueAdjustedGap = Math.max(0, 72 - d.adjustedScore);
  const rescueOverlapBlocked = d.overlap >= 0.94;
  const nearRescue = d.state === "incubator" && rescueRawGap <= 4 && rescueAdjustedGap <= 4 && !rescueOverlapBlocked;
  return {
    id: String(prompt?.id || ""), position: String(prompt?.position || ""), label: String(prompt?.label || ""),
    family: String(prompt?.family || ""), dominantFamily: dominantFamily(prompt), tags: tagsOf(prompt),
    state: d.state, rawRating: d.rawRating, rawScore: d.rawScore, adjustedScore: d.adjustedScore, familyBonus: d.bonus,
    playerCount: d.playerCount, answerBand: answerBand(prompt?.position, d.playerCount), overlap: d.overlap, overlapBand: overlapBand(d.overlap),
    issues: d.issues, tunability: tune.type, tunableField: tune.field, tunableOperator: tune.operator, tunableValue: tune.value,
    plannedVariants: tune.plannedVariants, nearRescue, rescueRawGap, rescueAdjustedGap, rescueOverlapBlocked
  };
});

const incubator = rows.filter(row => row.state === "incubator");
const decisionCounts = countBy(rows, row => row.state);
const referenceCount = 144;
const audit = {
  generatedAt: new Date().toISOString(),
  source: {
    enabledPrompts: source.length,
    players: (window.FPL_PLAYERS || []).length,
    approvedBaseline: window.FPL_APPROVED_PROMPT_BASELINE,
    nationalityPack: window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1 || null
  },
  reference: { previousIncubatorCount: referenceCount, currentIncubatorCount: incubator.length, delta: incubator.length - referenceCount },
  decisions: decisionCounts,
  incubator: {
    total: incubator.length,
    byPosition: countBy(incubator, row => row.position),
    byFamily: countBy(incubator, row => row.dominantFamily),
    byTunability: countBy(incubator, row => row.tunability),
    byAnswerBand: countBy(incubator, row => row.answerBand),
    byOverlapBand: countBy(incubator, row => row.overlapBand),
    nearRescue: incubator.filter(row => row.nearRescue).length,
    safelyTunable: incubator.filter(row => row.tunability !== "no-safe-threshold").length,
    structurallyStuck: incubator.filter(row => row.tunability === "no-safe-threshold").length,
    plannedVariantCount: incubator.reduce((sum, row) => sum + row.plannedVariants, 0)
  },
  items: incubator.sort((a, b) => {
    const tuneA = a.tunability === "no-safe-threshold" ? 1 : 0;
    const tuneB = b.tunability === "no-safe-threshold" ? 1 : 0;
    return Number(b.nearRescue) - Number(a.nearRescue) || tuneA - tuneB || b.adjustedScore - a.adjustedScore || a.overlap - b.overlap || a.id.localeCompare(b.id);
  })
};

const jsonPath = new URL("refinement-incubator-audit.json", outDir);
fs.writeFileSync(jsonPath, JSON.stringify(audit, null, 2) + "\n");

const csvEscape = value => {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csvColumns = ["id","position","label","dominantFamily","rawScore","adjustedScore","familyBonus","playerCount","answerBand","overlap","overlapBand","tunability","tunableField","tunableOperator","tunableValue","plannedVariants","nearRescue","rescueRawGap","rescueAdjustedGap","rescueOverlapBlocked","issues","tags"];
const csv = [csvColumns.join(","), ...audit.items.map(row => csvColumns.map(column => csvEscape(row[column])).join(","))].join("\n") + "\n";
fs.writeFileSync(new URL("refinement-incubator-audit.csv", outDir), csv);

const top = audit.items.slice(0, 30);
const stuck = audit.items.filter(row => row.tunability === "no-safe-threshold");
const near = audit.items.filter(row => row.nearRescue);
const formatCounts = object => Object.entries(object).map(([key, value]) => `- ${key}: ${value}`).join("\n") || "- none";
const md = `# Refinement Incubator audit\n\nGenerated: ${audit.generatedAt}\n\n## Headline\n\n- Enabled Studio prompts analysed: **${source.length}**\n- Certified: **${decisionCounts.certified || 0}**\n- Family/diversity rescued: **${decisionCounts.rescued || 0}**\n- Incubated promising 3★: **${incubator.length}**\n- Hard/weak rejected: **${decisionCounts.rejected || 0}**\n- Previous working reference: **${referenceCount} incubated**\n- Delta from reference: **${audit.reference.delta >= 0 ? "+" : ""}${audit.reference.delta}**\n\n## Refinement readiness\n\n- Safely tunable by the current Incubator strategy: **${audit.incubator.safelyTunable}**\n- Structurally stuck with no safe threshold detected: **${audit.incubator.structurallyStuck}**\n- Near the existing family/diversity rescue line: **${audit.incubator.nearRescue}**\n- Controlled variants the current strategy would plan: **${audit.incubator.plannedVariantCount}**\n\n### By position\n${formatCounts(audit.incubator.byPosition)}\n\n### By dominant family\n${formatCounts(audit.incubator.byFamily)}\n\n### By tunability\n${formatCounts(audit.incubator.byTunability)}\n\n### By answer-pool band\n${formatCounts(audit.incubator.byAnswerBand)}\n\n### By overlap band\n${formatCounts(audit.incubator.byOverlapBand)}\n\n## Highest-priority parents\n\n| ID | Pos | Score | Adj | Answers | Overlap | Family | Tune route | Near rescue |\n|---|---:|---:|---:|---:|---:|---|---|---|\n${top.map(row => `| ${row.id} | ${row.position} | ${row.rawScore} | ${row.adjustedScore} | ${row.playerCount} | ${row.overlap.toFixed(3)} | ${row.dominantFamily} | ${row.tunability}${row.tunableField ? `:${row.tunableField}` : ""} | ${row.nearRescue ? "yes" : ""} |`).join("\n")}\n\n## Near-rescue parents\n\n${near.length ? near.map(row => `- **${row.id}** (${row.position}) — raw ${row.rawScore}, adjusted ${row.adjustedScore}, answers ${row.playerCount}, overlap ${row.overlap.toFixed(3)}, ${row.tunability}.`).join("\n") : "None under the current near-rescue definition."}\n\n## Structurally stuck parents\n\nThese prompts meet the 3★ Incubator floor but the current safe threshold strategy cannot create a controlled variant. They are the main candidates for a second refinement strategy rather than repeated threshold mutation.\n\n${stuck.length ? stuck.map(row => `- **${row.id}** (${row.position}) — ${row.label} — raw ${row.rawScore}, answers ${row.playerCount}, overlap ${row.overlap.toFixed(3)}, family ${row.dominantFamily}.`).join("\n") : "None."}\n\n## Method\n\nThis report rebuilds the current approved Studio prompt library from repository sources, reinstalls the nationality context pack in its stable post-baseline state, runs the same Prompt Quality Analyser used by Quality Enforcement v2, applies the same v2 decision thresholds, and then classifies held 3★ prompts using the current Refinement Incubator's threshold-detection rules. It does not read browser localStorage or mutate the live prompt library.\n`;
fs.writeFileSync(new URL("refinement-incubator-audit.md", outDir), md);

console.log(`Quality decisions: ${JSON.stringify(decisionCounts)}`);
console.log(`Incubator cohort: ${incubator.length} (previous reference ${referenceCount}; delta ${audit.reference.delta >= 0 ? "+" : ""}${audit.reference.delta}).`);
console.log(`Safely tunable: ${audit.incubator.safelyTunable}; structurally stuck: ${audit.incubator.structurallyStuck}; near rescue: ${audit.incubator.nearRescue}.`);
console.log(`Planned controlled variants: ${audit.incubator.plannedVariantCount}.`);
console.log("Wrote reports/refinement-incubator-audit.{json,csv,md}");
