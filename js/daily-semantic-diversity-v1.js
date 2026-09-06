/* FPL Challenge Studio — Daily semantic diversity policy v1.0.0.
   Normalises threshold variants into shared concepts so the weekly reservoir and each
   generated day can prevent near-duplicate prompts from clustering together. */
(() => {
  "use strict";

  if (window.FPL_DAILY_SEMANTIC_DIVERSITY?.version === "1.0.0") return;

  const VERSION = "1.0.0";
  const DEFAULT_WEEKLY_CAP = 7;
  const ENTITY_FIELDS = new Set(["manager", "club", "nationality", "teammate"]);
  const RARE_FIELDS = new Set(["bonus"]);
  const POSITION_WORDS = /\b(goalkeeper|keeper|defender|midfielder|forward|player)\b/gi;

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
    return values.length ? Math.max(...values) * 100 + values.reduce((sum, value) => sum + value, 0) : 0;
  }

  function commitWeekly(prompt, counts) {
    const map = counts instanceof Map ? counts : new Map();
    for (const key of weeklyKeys(prompt)) map.set(key, Number(map.get(key) || 0) + 1);
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
    weeklyCap: DEFAULT_WEEKLY_CAP,
    fromRecord,
    fromPrompt,
    hardKeys,
    sharedHardKeys,
    dayClash,
    dayIssues,
    filterDayCompatible,
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
