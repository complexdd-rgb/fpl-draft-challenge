/* FPL Challenge Studio — Daily saved-library cutover boundary v1.0.0.
   Validates the promoted family-shard snapshot and provides lazy, deterministic prompt
   rehydration for Daily Challenge. It does not make this pool production-authoritative. */
(() => {
  "use strict";

  if (window.FPL_DAILY_LIBRARY_CUTOVER_V1?.ready) return;

  const VERSION = "1.0.0";
  const EXPECTED_FAMILIES = Object.freeze([
    "season-stats",
    "position-stat",
    "exact-stats",
    "combined-stats",
    "club-stat",
    "league-position",
    "promoted-clubs",
    "relegated-clubs",
    "champions",
    "nationality",
    "career-longevity",
    "club-count",
    "manager",
    "anti-meta",
    "value",
    "minutes-role",
    "composite-story"
  ]);
  const POSITION_ORDER = Object.freeze(["GK", "DEF", "MID", "FWD"]);
  const VALID_POSITIONS = new Set(["ANY", ...POSITION_ORDER]);
  const VALID_FIELDS = new Set([
    "points", "goals", "assists", "goalInvolvements", "cleanSheets", "bonus", "saves",
    "minutes", "startingPrice", "ageAtSeasonStart", "yellowCards", "redCards",
    "goalsConceded", "leaguePosition", "careerSeasonCount", "careerClubCount", "club",
    "manager", "nationality", "outsideBigSix", "champions", "topFour", "bottomHalf",
    "relegated", "promoted"
  ]);
  const VALID_OPERATORS = new Set(["eq", "gte", "lte", "gt", "lt", "between", "eqText", "contains", "isTrue", "isFalse"]);
  const BIG_SIX = Object.freeze(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"]);
  const POSITION_LABELS = Object.freeze({ GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" });
  const YIELD_EVERY = 4000;

  const state = {
    status: "waiting",
    ready: false,
    running: false,
    reason: "Waiting for the saved promoted Prompt Library snapshot.",
    manifest: null,
    total: 0,
    familyCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
    invalidSamples: [],
    recordsById: new Map(),
    byFamily: new Map(),
    indexedAt: null
  };

  const cloneCondition = condition => ({
    field: String(condition?.field || ""),
    operator: String(condition?.operator || ""),
    ...(condition?.value !== undefined ? { value: condition.value } : {}),
    ...(condition?.value2 !== undefined ? { value2: condition.value2 } : {})
  });

  function lightweightManifest(manifest) {
    if (!manifest) return null;
    return {
      schemaVersion: Number(manifest.schemaVersion || 0),
      version: String(manifest.version || ""),
      savedAt: String(manifest.savedAt || ""),
      promotionVersion: String(manifest.promotionVersion || ""),
      promotionFingerprint: String(manifest.promotionFingerprint || ""),
      total: Number(manifest.total || 0),
      families: Number(manifest.families || 0),
      variantGroups: Number(manifest.variantGroups || 0),
      qualityPass: Number(manifest.qualityPass || 0),
      qualityReview: Number(manifest.qualityReview || 0)
    };
  }

  function recordProblem(record, expectedFamily) {
    if (!record || typeof record !== "object") return "record is not an object";
    if (!String(record.id || "").trim()) return "missing prompt ID";
    if (!String(record.label || "").trim()) return "missing prompt label";
    if (String(record.family || "") !== expectedFamily) return "family does not match its shard";
    if (!EXPECTED_FAMILIES.includes(String(record.family || ""))) return "unknown prompt family";
    if (!VALID_POSITIONS.has(String(record.position || ""))) return "invalid position";
    if (!Array.isArray(record.conditions) || !record.conditions.length) return "conditions are missing";
    if (!record.conditions.every(condition => VALID_FIELDS.has(String(condition?.field || "")))) return "unsupported condition field";
    if (!record.conditions.every(condition => VALID_OPERATORS.has(String(condition?.operator || "")))) return "unsupported condition operator";
    if (!record.conditions.every(condition => condition.operator !== "between" || condition.value2 !== undefined)) return "between condition is missing its upper value";
    if (!["pass", "review"].includes(String(record.qualityStatus || ""))) return "prompt did not pass Promotion quality status";
    if (record.enabled === false) return "prompt is disabled";
    if (!Number.isFinite(Number(record.qualityEvidence?.answerPlayers)) || Number(record.qualityEvidence.answerPlayers) < 2) return "stored quality evidence has fewer than two answer players";
    return "";
  }

  function yieldUi() {
    return new Promise(resolve => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(() => resolve(), { timeout: 60 });
      else setTimeout(resolve, 0);
    });
  }

  function setFailure(reason) {
    state.status = "blocked";
    state.ready = false;
    state.reason = String(reason || "Saved Prompt Library certification failed.");
    state.indexedAt = new Date().toISOString();
    dispatchState();
    return false;
  }

  function dispatchState() {
    window.dispatchEvent(new CustomEvent("fpl:daily-library-cutover-state", { detail: getState() }));
    window.FPL_PROMPT_LIBRARY_SHARDS_V1?.render?.();
  }

  async function refresh() {
    if (state.running) return getState();
    const shards = window.FPL_PROMPT_LIBRARY_SHARDS_V1;
    if (!shards?.ready || typeof shards.buildRepositoryPackage !== "function") {
      state.status = "waiting";
      state.ready = false;
      state.reason = "Waiting for Prompt Library shard storage.";
      dispatchState();
      return getState();
    }

    state.running = true;
    state.status = "indexing";
    state.ready = false;
    state.reason = "Validating the saved promoted library for Daily Challenge use.";
    state.invalidCount = 0;
    state.duplicateCount = 0;
    state.invalidSamples = [];
    state.recordsById = new Map();
    state.byFamily = new Map(EXPECTED_FAMILIES.map(family => [family, []]));
    dispatchState();

    try {
      const payload = await shards.buildRepositoryPackage();
      const manifest = payload?.manifest;
      const packageShards = Array.isArray(payload?.shards) ? payload.shards : [];
      if (!manifest || !packageShards.length) return setFailure("No saved promoted Prompt Library snapshot is available.");
      if (Number(manifest.families || 0) !== EXPECTED_FAMILIES.length) {
        return setFailure(`Expected ${EXPECTED_FAMILIES.length} promoted families, found ${Number(manifest.families || 0)}.`);
      }

      const shardNames = new Set(packageShards.map(shard => String(shard?.family || "")));
      const missingFamilies = EXPECTED_FAMILIES.filter(family => !shardNames.has(family));
      if (missingFamilies.length) return setFailure(`Saved library is missing families: ${missingFamilies.join(", ")}.`);

      let visited = 0;
      for (const shard of packageShards) {
        const family = String(shard?.family || "");
        const records = Array.isArray(shard?.records) ? shard.records : [];
        for (const raw of records) {
          visited += 1;
          const problem = recordProblem(raw, family);
          const id = String(raw?.id || "").trim();
          if (problem) {
            state.invalidCount += 1;
            if (state.invalidSamples.length < 12) state.invalidSamples.push({ id, family, reason: problem });
          } else if (state.recordsById.has(id)) {
            state.duplicateCount += 1;
            if (state.invalidSamples.length < 12) state.invalidSamples.push({ id, family, reason: "duplicate prompt ID" });
          } else {
            const record = Object.freeze({
              ...raw,
              id,
              family,
              position: String(raw.position),
              conditions: Object.freeze(raw.conditions.map(condition => Object.freeze(cloneCondition(condition))))
            });
            state.recordsById.set(id, record);
            state.byFamily.get(family)?.push(record);
          }
          if (visited % YIELD_EVERY === 0) await yieldUi();
        }
      }

      const total = state.recordsById.size;
      if (visited !== Number(manifest.total || 0)) return setFailure(`Saved manifest expected ${Number(manifest.total || 0).toLocaleString("en-GB")} records but ${visited.toLocaleString("en-GB")} were inspected.`);
      if (state.invalidCount || state.duplicateCount) {
        return setFailure(`${state.invalidCount.toLocaleString("en-GB")} invalid and ${state.duplicateCount.toLocaleString("en-GB")} duplicate promoted records must be resolved before cutover.`);
      }
      if (total !== Number(manifest.total || 0)) return setFailure("The indexed promoted-library total does not match its saved manifest.");

      state.manifest = lightweightManifest(manifest);
      state.total = total;
      state.familyCount = EXPECTED_FAMILIES.length;
      state.status = "ready";
      state.ready = true;
      state.reason = "Saved promoted library passed the Daily structural certification boundary. Generation authority has not switched yet.";
      state.indexedAt = new Date().toISOString();
      dispatchState();
      window.dispatchEvent(new CustomEvent("fpl:daily-library-cutover-ready", { detail: getState() }));
      return getState();
    } catch (error) {
      setFailure(error?.message || error);
      return getState();
    } finally {
      state.running = false;
    }
  }

  function familyIndex() {
    return EXPECTED_FAMILIES.map(family => {
      const records = state.byFamily.get(family) || [];
      const byPosition = { ANY: 0, GK: 0, DEF: 0, MID: 0, FWD: 0 };
      for (const record of records) byPosition[record.position] = (byPosition[record.position] || 0) + 1;
      return {
        family,
        total: records.length,
        byPosition,
        compatible: Object.fromEntries(POSITION_ORDER.map(position => [position, byPosition[position] + byPosition.ANY]))
      };
    });
  }

  function conditionSource(conditions) {
    return JSON.stringify(conditions.map(cloneCondition));
  }

  function buildTestSource(conditions) {
    const encoded = conditionSource(conditions);
    const bigSix = JSON.stringify(BIG_SIX);
    return `p => {\n` +
      `  const conditions = ${encoded};\n` +
      `  const number = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;\n` +
      `  const text = value => String(value ?? "").trim().toLowerCase();\n` +
      `  const fieldValue = field => {\n` +
      `    if (field === "goalInvolvements") { const goals = number(p?.goals), assists = number(p?.assists); return goals == null || assists == null ? null : goals + assists; }\n` +
      `    if (field === "careerSeasonCount") return number(p?._career?.seasonCount);\n` +
      `    if (field === "careerClubCount") return number(p?._career?.clubCount);\n` +
      `    if (field === "nationality") return String(window.FPL_CAREER_EVOLUTION_CONTEXT?.nationalityForPlayer?.(p?._career?.playerId ?? p?.playerId) || "").trim();\n` +
      `    if (field === "outsideBigSix") return p?.club ? !${bigSix}.includes(String(p.club)) : null;\n` +
      `    if (field === "champions") return typeof p?.champions === "boolean" ? p.champions : (number(p?.leaguePosition) == null ? null : number(p.leaguePosition) === 1);\n` +
      `    if (field === "topFour") { const finish = number(p?.leaguePosition); return typeof p?.topFour === "boolean" ? p.topFour : (finish == null ? null : finish >= 1 && finish <= 4); }\n` +
      `    if (["bottomHalf","relegated","promoted"].includes(field)) return typeof p?.[field] === "boolean" ? p[field] : null;\n` +
      `    if (field === "manager") return Array.isArray(p?.managers) ? p.managers : [];\n` +
      `    return p?.[field] ?? null;\n` +
      `  };\n` +
      `  return conditions.every(condition => {\n` +
      `    const actual = fieldValue(condition.field);\n` +
      `    if (condition.operator === "isTrue") return actual === true;\n` +
      `    if (condition.operator === "isFalse") return actual === false;\n` +
      `    if (condition.operator === "eqText") return text(actual) !== "" && text(actual) === text(condition.value);\n` +
      `    if (condition.operator === "contains") return Array.isArray(actual) && actual.some(item => text(item) === text(condition.value));\n` +
      `    const actualNumber = number(actual), wanted = number(condition.value);\n` +
      `    if (actualNumber == null || wanted == null) return false;\n` +
      `    if (condition.operator === "eq") return actualNumber === wanted;\n` +
      `    if (condition.operator === "gte") return actualNumber >= wanted;\n` +
      `    if (condition.operator === "lte") return actualNumber <= wanted;\n` +
      `    if (condition.operator === "gt") return actualNumber > wanted;\n` +
      `    if (condition.operator === "lt") return actualNumber < wanted;\n` +
      `    if (condition.operator === "between") { const upper = number(condition.value2); return upper != null && actualNumber >= wanted && actualNumber <= upper; }\n` +
      `    return false;\n` +
      `  });\n` +
      `}`;
  }

  function compileConditions(conditions) {
    const source = buildTestSource(conditions);
    const test = Function(`"use strict"; return (${source});`)();
    Object.defineProperty(test, "__fplDailyCutoverSource", { value: source });
    return test;
  }

  function compatiblePosition(record, requestedPosition) {
    const requested = String(requestedPosition || "");
    if (!POSITION_ORDER.includes(requested)) return null;
    if (record.position === "ANY") return requested;
    return record.position === requested ? requested : null;
  }

  function materialisedLabel(record, position) {
    const label = String(record.label || "Untitled prompt");
    if (record.position !== "ANY" || !/^Player\b/.test(label)) return label;
    return label.replace(/^Player\b/, POSITION_LABELS[position] || "Player");
  }

  function materialiseRecord(recordOrId, requestedPosition = null) {
    if (!state.ready) return null;
    const record = typeof recordOrId === "string" ? state.recordsById.get(recordOrId) : recordOrId;
    if (!record) return null;
    const position = record.position === "ANY" ? compatiblePosition(record, requestedPosition) : record.position;
    if (!position || !POSITION_ORDER.includes(position)) return null;
    const id = record.position === "ANY" ? `${record.id}__${position.toLowerCase()}` : record.id;
    return {
      id,
      sourcePromptId: record.id,
      position,
      label: materialisedLabel(record, position),
      fail: "That player-season does not meet the prompt.",
      family: record.family,
      conditions: record.conditions.map(cloneCondition),
      variantGroup: String(record.variantGroup || ""),
      qualityStatus: record.qualityStatus,
      qualityScore: Number(record.qualityScore || 0),
      qualityEvidence: record.qualityEvidence ? { ...record.qualityEvidence } : null,
      difficulty: String(record.difficulty || "medium"),
      rating: record.qualityStatus === "pass" ? 5 : 4,
      cooldown: 7,
      tags: [...new Set([...(Array.isArray(record.tags) ? record.tags : []), `family:${record.family}`, "daily-cutover-v1"])],
      enabled: true,
      source: "daily-library-cutover-v1",
      test: compileConditions(record.conditions)
    };
  }

  function materialiseFamily(family, position, { limit = 500, offset = 0, excludeSourceIds = [] } = {}) {
    if (!state.ready || !EXPECTED_FAMILIES.includes(String(family || "")) || !POSITION_ORDER.includes(String(position || ""))) return [];
    const excluded = new Set((excludeSourceIds || []).map(String));
    const source = state.byFamily.get(String(family)) || [];
    const compatible = source.filter(record => !excluded.has(record.id) && compatiblePosition(record, position));
    const start = Math.max(0, Number(offset) || 0);
    const take = Math.max(0, Math.min(5000, Number(limit) || 0));
    return compatible.slice(start, start + take).map(record => materialiseRecord(record, position)).filter(Boolean);
  }

  function getState() {
    return Object.freeze({
      version: VERSION,
      status: state.status,
      ready: state.ready,
      running: state.running,
      reason: state.reason,
      total: state.total,
      families: state.familyCount,
      invalid: state.invalidCount,
      duplicates: state.duplicateCount,
      invalidSamples: state.invalidSamples.map(item => ({ ...item })),
      manifest: state.manifest ? { ...state.manifest } : null,
      familyIndex: familyIndex(),
      indexedAt: state.indexedAt
    });
  }

  function retireLegacyHistoryPanel() {
    const panel = document.getElementById("historyPanel");
    if (!panel) return;
    panel.hidden = true;
    panel.setAttribute("aria-hidden", "true");
    const remove = () => {
      if (panel.isConnected) panel.remove();
      document.documentElement.dataset.dailyHistoryPanel = "retired";
    };
    if (document.readyState === "complete") setTimeout(remove, 0);
    else window.addEventListener("load", () => setTimeout(remove, 0), { once: true });
  }

  function initialise() {
    retireLegacyHistoryPanel();
    refresh();
    window.addEventListener("fpl:prompt-library-shards-saved", refresh);
    window.addEventListener("fpl:prompt-library-shards-restored", refresh);
    window.addEventListener("fpl:prompt-library-shards-cleared", refresh);
  }

  window.FPL_DAILY_LIBRARY_CUTOVER_V1 = Object.freeze({
    ready: true,
    version: VERSION,
    expectedFamilies: EXPECTED_FAMILIES,
    positions: POSITION_ORDER,
    refresh,
    getState,
    getCompactRecord: id => {
      const record = state.recordsById.get(String(id || ""));
      return record ? { ...record, conditions: record.conditions.map(cloneCondition) } : null;
    },
    buildTestSource,
    compileConditions,
    materialiseRecord,
    materialiseFamily
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialise, { once: true });
  else initialise();
})();
