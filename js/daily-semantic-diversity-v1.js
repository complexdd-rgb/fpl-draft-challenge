/* FPL Challenge Studio — Daily semantic diversity policy v1 API / policy revision 1.1.0.
   Normalises threshold variants into shared concepts so the weekly reservoir and each
   generated day can prevent near-duplicate prompts from clustering together.
   Revision 1.1.0 also adds soft whole-week pressure against repeatedly surfacing the same
   highest-scoring and top-three answer players, including recent-week carry-over pressure. */
(() => {
  "use strict";

  if (window.FPL_DAILY_SEMANTIC_DIVERSITY?.version === "1.0.0") return;

  // Keep the public API major/minor version stable because the existing generator guard
  // deliberately checks for v1.0.0. policyRevision is the cache-busted behaviour revision.
  const VERSION = "1.0.0";
  const POLICY_REVISION = "1.1.0";
  const DEFAULT_WEEKLY_CAP = 7;
  const ANSWER_POOL_SIZE = 3;
  const RECENT_ANSWER_DAYS = 7;
  const CURRENT_LEADER_WEIGHT = 1200;
  const CURRENT_TOP3_WEIGHT = 180;
  const RECENT_LEADER_WEIGHT = 900;
  const RECENT_TOP3_WEIGHT = 130;
  const ENTITY_FIELDS = new Set(["manager", "club", "nationality", "teammate"]);
  const RARE_FIELDS = new Set(["bonus"]);
  const POSITION_WORDS = /\b(goalkeeper|keeper|defender|midfielder|forward|player)\b/gi;
  const topAnswerProfileCache = new Map();
  let recentAnswerCacheKey = "";
  let recentAnswerCache = null;

  const clean = value => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  const keyText = value => clean(value).replace(/\s+/g, "-");

  function scalarValue(condition) {
    if (condition == null || typeof condition !== "object") return "";
    if (condition.value != null && typeof condition.value !== "object") return condition.value;
    if (condition.values != null && !Array.isArray(condition.values) && typeof condition.values !== "object") return condition.values;
    if (Array.isArray(condition.value)) return condition.value.join("|");
    if (Array.isArray(condition.values)) return condition.values.join("|");
    if (condition.min != null || condition.max != null) return `${condition.min ?? ""}|${condition.max ?? ""}`;
    return "";
  }

  function conditionToken(condition) {
    const field = String(condition?.field || "").trim();
    if (!field) return "";
    const operator = keyText(condition?.operator || "eq") || "eq";
    const raw = scalarValue(condition);
    const numeric = typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw)));
    if (ENTITY_FIELDS.has(field)) return `${field}:${operator}:${keyText(raw) || "unknown"}`;
    if (typeof raw === "boolean") return `${field}:${operator}:${raw ? "true" : "false"}`;
    if (!numeric && raw !== "") return `${field}:${operator}:${keyText(raw)}`;
    return `${field}:${operator}`;
  }

  function fallbackLabelConcept(label, family = "") {
    let value = clean(String(label || "").replace(POSITION_WORDS, " "));
    value = value
      .replace(/\b\d{4}\s*\d{2}\b/g, " season ")
      .replace(/\b\d+(?:\.\d+)?\b/g, " n ")
      .replace(/\b(at least|at most|exactly|more than|fewer than|less than|over|under|between)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `${keyText(family || "other")}|${keyText(value || "other")}`;
  }

  function managerFromLabel(label) {
    const text = String(label || "");
    const match = /managed by\s+(.+?)(?=\s+(?:and|with|who|having|scoring|recording)\b|[,.;]|$)/i.exec(text);
    return match?.[1] ? keyText(match[1]) : "";
  }

  function fromRecord(record, position = "ANY", label = "") {
    const family = String(record?.family || "other");
    const conditions = Array.isArray(record?.conditions) ? record.conditions : [];
    const tokens = conditions.map(conditionToken).filter(Boolean).sort();
    const entityKeys = [];
    const rareKeys = [];

    for (const condition of conditions) {
      const field = String(condition?.field || "");
      if (ENTITY_FIELDS.has(field)) {
        const value = keyText(scalarValue(condition));
        if (value) entityKeys.push(`${field}:${value}`);
      }
      if (RARE_FIELDS.has(field)) rareKeys.push(field);
    }

    const concept = `${keyText(family)}|${tokens.join("|") || fallbackLabelConcept(label, family)}`;
    return Object.freeze({
      version: VERSION,
      sourceId: String(record?.id || ""),
      position: String(position || record?.position || "ANY"),
      family,
      variantGroup: String(record?.variantGroup || ""),
      concept,
      entityKeys: Object.freeze([...new Set(entityKeys)].sort()),
      rareKeys: Object.freeze([...new Set(rareKeys)].sort())
    });
  }

  function fromPrompt(prompt) {
    if (prompt?.semanticDiversity?.version === VERSION) return prompt.semanticDiversity;
    const label = String(prompt?.label || "");
    const family = String(prompt?.family || "other");
    const entityKeys = [];
    const manager = managerFromLabel(label);
    if (manager) entityKeys.push(`manager:${manager}`);
    const rareKeys = /\bbonus\s+points?\b/i.test(label) || (prompt?.tags || []).includes("bonus") ? ["bonus"] : [];
    return Object.freeze({
      version: VERSION,
      sourceId: String(prompt?.sourcePromptId || prompt?.id || ""),
      position: String(prompt?.position || "ANY"),
      family,
      variantGroup: String(prompt?.variantGroup || ""),
      concept: fallbackLabelConcept(label, family),
      entityKeys: Object.freeze(entityKeys),
      rareKeys: Object.freeze(rareKeys)
    });
  }

  function hardKeys(prompt) {
    const descriptor = fromPrompt(prompt);
    const keys = new Set();
    for (const entity of descriptor.entityKeys || []) keys.add(`entity:${entity}`);
    for (const rare of descriptor.rareKeys || []) keys.add(`rare:${rare}`);
    if (descriptor.concept) keys.add(`concept:${descriptor.concept}`);
    return [...keys];
  }

  function hardKeySet(prompt) {
    return new Set(hardKeys(prompt));
  }

  function sharedHardKeys(left, right) {
    const a = hardKeySet(left);
    const b = hardKeySet(right);
    return [...a].filter(key => b.has(key));
  }

  function dayClash(left, right) {
    return sharedHardKeys(left, right).length > 0;
  }

  function filterDayCompatible(options, draft) {
    if (!draft?.length) return [...(options || [])];
    return (options || []).filter(prompt => !draft.some(existing => dayClash(prompt, existing)));
  }

  function describeKey(key) {
    const value = String(key || "");
    if (value === "rare:bonus") return "bonus-points concept";
    if (value.startsWith("entity:manager:")) return `manager ${value.slice("entity:manager:".length).replace(/-/g, " ")}`;
    if (value.startsWith("entity:")) return value.slice(7).replace(/[:_-]+/g, " ");
    if (value.startsWith("concept:")) return "near-identical rule concept";
    return value.replace(/[:_-]+/g, " ");
  }

  function dayIssues(prompts) {
    const values = prompts || [];
    const issues = [];
    const seen = new Set();
    for (let left = 0; left < values.length; left += 1) {
      for (let right = left + 1; right < values.length; right += 1) {
        for (const key of sharedHardKeys(values[left], values[right])) {
          if (seen.has(key)) continue;
          seen.add(key);
          issues.push({
            key,
            description: describeKey(key),
            leftId: String(values[left]?.id || ""),
            rightId: String(values[right]?.id || ""),
            message: `Same-day semantic clash: ${describeKey(key)} appears in both ${values[left]?.id || "one prompt"} and ${values[right]?.id || "another prompt"}.`
          });
        }
      }
    }
    return issues;
  }

  function promptStats(prompt) {
    try {
      return window.FPL_STUDIO_API?.getPromptStats?.(prompt) || null;
    } catch (_) {
      return null;
    }
  }

  function topAnswerProfile(prompt) {
    const cacheKey = String(prompt?.id || prompt?.sourcePromptId || "");
    if (cacheKey && topAnswerProfileCache.has(cacheKey)) return topAnswerProfileCache.get(cacheKey);

    const stats = promptStats(prompt);
    const values = typeof stats?.bestByPlayer?.values === "function" ? [...stats.bestByPlayer.values()] : [];
    if (!values.length && stats?.bestAnswer) values.push(stats.bestAnswer);
    const seen = new Set();
    const ordered = values
      .filter(Boolean)
      .sort((left, right) => Number(right?.points || 0) - Number(left?.points || 0)
        || String(left?.playerName || left?.name || "").localeCompare(String(right?.playerName || right?.name || ""))
        || String(left?.playerId || "").localeCompare(String(right?.playerId || "")))
      .filter(record => {
        const playerId = String(record?.playerId || "");
        if (!playerId || seen.has(playerId)) return false;
        seen.add(playerId);
        return true;
      })
      .slice(0, ANSWER_POOL_SIZE)
      .map(record => Object.freeze({
        playerId: String(record?.playerId || ""),
        playerName: String(record?.playerName || record?.name || record?.playerId || ""),
        points: Number(record?.points || 0)
      }));

    const profile = Object.freeze({
      leaderId: ordered[0]?.playerId || "",
      leaderName: ordered[0]?.playerName || "",
      top3Ids: Object.freeze(ordered.map(record => record.playerId)),
      records: Object.freeze(ordered)
    });
    if (cacheKey) topAnswerProfileCache.set(cacheKey, profile);
    return profile;
  }

  function answerPressureKeys(prompt) {
    const profile = topAnswerProfile(prompt);
    const keys = [];
    if (profile.leaderId) keys.push(`answer:leader:${profile.leaderId}`);
    for (const playerId of profile.top3Ids) keys.push(`answer:top3:${playerId}`);
    return keys;
  }

  function sourceIdFromPromptId(value) {
    return String(value || "").replace(/__(?:gk|def|mid|fwd)$/i, "");
  }

  function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function addDaysIso(value, amount) {
    if (!isIsoDate(value)) return "";
    const [year, month, day] = String(value).split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
  }

  function generationStartDate() {
    const value = typeof document !== "undefined" ? document.querySelector?.("#batchStartDate")?.value : "";
    return isIsoDate(value) ? String(value) : "";
  }

  function promptIndex() {
    const library = window.FPL_STUDIO_API?.getPromptLibrary?.()
      || (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
    const index = new Map();
    for (const prompt of library || []) {
      const id = String(prompt?.id || "");
      const sourceId = sourceIdFromPromptId(prompt?.sourcePromptId || id);
      if (id && !index.has(id)) index.set(id, prompt);
      if (sourceId && !index.has(sourceId)) index.set(sourceId, prompt);
    }
    return { index, size: Array.isArray(library) ? library.length : 0 };
  }

  function recentScheduleEntries() {
    const values = [];
    for (const entry of window.FPL_CHALLENGE_MANIFEST?.challenges || []) {
      values.push({ date: String(entry?.date || ""), promptIds: entry?.promptIds || [] });
    }
    for (const row of window.FPL_STUDIO_SCHEDULE?.scheduled || []) {
      const stored = row?.manifest_entry && typeof row.manifest_entry === "object" ? row.manifest_entry : {};
      values.push({ date: String(row?.release_date || row?.releaseDate || ""), promptIds: stored?.promptIds || [] });
    }
    for (const entry of window.FPL_STUDIO_PHASE3?.getHistory?.() || []) {
      values.push({ date: String(entry?.releaseDate || entry?.date || ""), promptIds: entry?.promptIds || [] });
    }
    return values.filter(entry => isIsoDate(entry.date) && Array.isArray(entry.promptIds) && entry.promptIds.length);
  }

  function recentAnswerCounts() {
    const start = generationStartDate();
    if (!start) return { leaders: new Map(), top3: new Map(), days: 0 };
    const { index, size } = promptIndex();
    const entries = recentScheduleEntries();
    const key = `${start}|${size}|${entries.length}|${entries.map(entry => `${entry.date}:${entry.promptIds.length}`).join(",")}`;
    if (key === recentAnswerCacheKey && recentAnswerCache) return recentAnswerCache;

    const cutoff = addDaysIso(start, -RECENT_ANSWER_DAYS);
    const byDate = new Map();
    for (const entry of entries) {
      if (entry.date >= start || entry.date < cutoff) continue;
      const day = byDate.get(entry.date) || { leaders: new Set(), top3: new Set() };
      for (const rawId of entry.promptIds) {
        const id = String(rawId || "");
        const prompt = index.get(id) || index.get(sourceIdFromPromptId(id));
        if (!prompt) continue;
        const profile = topAnswerProfile(prompt);
        if (profile.leaderId) day.leaders.add(profile.leaderId);
        for (const playerId of profile.top3Ids) day.top3.add(playerId);
      }
      byDate.set(entry.date, day);
    }

    const leaders = new Map();
    const top3 = new Map();
    for (const day of byDate.values()) {
      for (const playerId of day.leaders) leaders.set(playerId, Number(leaders.get(playerId) || 0) + 1);
      for (const playerId of day.top3) top3.set(playerId, Number(top3.get(playerId) || 0) + 1);
    }
    recentAnswerCacheKey = key;
    recentAnswerCache = { leaders, top3, days: byDate.size };
    return recentAnswerCache;
  }

  function recentAnswerLoad(prompt) {
    const profile = topAnswerProfile(prompt);
    if (!profile.leaderId && !profile.top3Ids.length) return 0;
    const recent = recentAnswerCounts();
    const leaderLoad = profile.leaderId ? Number(recent.leaders.get(profile.leaderId) || 0) * RECENT_LEADER_WEIGHT : 0;
    const top3Load = profile.top3Ids.reduce((sum, playerId) => sum + Number(recent.top3.get(playerId) || 0), 0) * RECENT_TOP3_WEIGHT;
    return leaderLoad + top3Load;
  }

  function weeklyKeys(prompt) {
    return hardKeys(prompt);
  }

  function canAddWeekly(prompt, counts, cap = DEFAULT_WEEKLY_CAP) {
    const map = counts instanceof Map ? counts : new Map();
    return weeklyKeys(prompt).every(key => Number(map.get(key) || 0) < cap);
  }

  function weeklyLoad(prompt, counts) {
    const map = counts instanceof Map ? counts : new Map();
    const values = weeklyKeys(prompt).map(key => Number(map.get(key) || 0));
    const semanticLoad = values.length ? Math.max(...values) * 100 + values.reduce((sum, value) => sum + value, 0) : 0;
    const profile = topAnswerProfile(prompt);
    const leaderLoad = profile.leaderId ? Number(map.get(`answer:leader:${profile.leaderId}`) || 0) * CURRENT_LEADER_WEIGHT : 0;
    const top3Load = profile.top3Ids.reduce((sum, playerId) => sum + Number(map.get(`answer:top3:${playerId}`) || 0), 0) * CURRENT_TOP3_WEIGHT;
    return semanticLoad + leaderLoad + top3Load + recentAnswerLoad(prompt);
  }

  function commitWeekly(prompt, counts) {
    const map = counts instanceof Map ? counts : new Map();
    for (const key of weeklyKeys(prompt)) map.set(key, Number(map.get(key) || 0) + 1);
    for (const key of answerPressureKeys(prompt)) map.set(key, Number(map.get(key) || 0) + 1);
    return map;
  }

  function remainingPressure(prompts, remainingDays) {
    const counts = new Map();
    for (const prompt of prompts || []) {
      for (const key of weeklyKeys(prompt)) counts.set(key, Number(counts.get(key) || 0) + 1);
    }
    const required = new Set();
    const impossible = new Set();
    for (const [key, count] of counts) {
      if (count > remainingDays) impossible.add(key);
      else if (count === remainingDays) required.add(key);
    }
    return Object.freeze({ counts, required, impossible, remainingDays });
  }

  function hasKey(prompt, key) {
    return hardKeySet(prompt).has(String(key));
  }

  function missingRequiredKeys(draft, required) {
    const requiredSet = required instanceof Set ? required : new Set(required || []);
    if (!requiredSet.size) return [];
    const present = new Set((draft || []).flatMap(hardKeys));
    return [...requiredSet].filter(key => !present.has(key));
  }

  function recordGroupKey(record, position = "ANY") {
    const descriptor = fromRecord(record, position, record?.label || "");
    if (descriptor.entityKeys.length) return `entity:${descriptor.entityKeys[0]}`;
    if (descriptor.rareKeys.length) return `rare:${descriptor.rareKeys[0]}`;
    if (descriptor.variantGroup) return `variant:${keyText(descriptor.variantGroup)}`;
    return `concept:${descriptor.concept}`;
  }

  window.FPL_DAILY_SEMANTIC_DIVERSITY = Object.freeze({
    version: VERSION,
    policyRevision: POLICY_REVISION,
    weeklyCap: DEFAULT_WEEKLY_CAP,
    answerPoolSize: ANSWER_POOL_SIZE,
    recentAnswerDays: RECENT_ANSWER_DAYS,
    fromRecord,
    fromPrompt,
    hardKeys,
    sharedHardKeys,
    dayClash,
    dayIssues,
    filterDayCompatible,
    topAnswerProfile,
    answerPressureKeys,
    recentAnswerLoad,
    weeklyKeys,
    canAddWeekly,
    weeklyLoad,
    commitWeekly,
    remainingPressure,
    hasKey,
    missingRequiredKeys,
    recordGroupKey,
    describeKey
  });
})();
