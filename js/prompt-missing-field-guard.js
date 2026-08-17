/* FPL Draft Challenge — prompt missing-field safety guard.
   Historical recovery rows may deliberately contain null/unknown values. JavaScript numeric
   comparisons coerce null to zero (for example null <= 4.5), so every prompt is wrapped to
   return false when a field that the prompt actually references is missing.

   This keeps partial historical player-seasons usable for unrelated prompts without allowing
   unknown values to qualify accidentally. False/0 remain valid known values. */
(() => {
  "use strict";

  const HELPER_FIELDS = Object.freeze({
    hasManager: ["managers"],
    isChampion: ["champions"],
    isTopFour: ["topFour"],
    isBottomHalf: ["bottomHalf"],
    isRelegated: ["relegated"],
    isPromoted: ["promoted"],
    ageBetween: ["ageAtSeasonStart"]
  });

  const DERIVED_FIELD_INPUTS = Object.freeze({
    goalInvolvements: ["goals", "assists"],
    outsideBigSix: ["club"],
    assistsMoreThanGoals: ["assists", "goals"],
    fullName: ["name"],
    firstName: ["name"],
    surname: ["name"],
    firstInitial: ["name"],
    surnameInitial: ["name"],
    fullNameLength: ["name"],
    firstNameLength: ["name"],
    surnameLength: ["name"],
    nameWordCount: ["name"],
    hyphenatedSurname: ["name"],
    sameInitials: ["name"],
    singleWordName: ["name"]
  });

  const dependenciesCache = new WeakMap();

  function addDependency(target, field) {
    const key = String(field || "").trim();
    if (!key) return;
    const inputs = DERIVED_FIELD_INPUTS[key];
    if (inputs) inputs.forEach(input => target.add(input));
    else target.add(key === "manager" ? "managers" : key);
  }

  function promptDependencies(prompt) {
    if (!prompt || typeof prompt !== "object") return [];
    if (dependenciesCache.has(prompt)) return dependenciesCache.get(prompt);

    const fields = new Set();
    const rule = prompt.studioRule;
    if (rule?.kind === "builder" && Array.isArray(rule.conditions)) {
      rule.conditions.forEach(condition => addDependency(fields, condition?.field));
    }

    const source = String(prompt.test || rule?.source || "");
    for (const match of source.matchAll(/\bp\.([A-Za-z_$][\w$]*)/g)) addDependency(fields, match[1]);
    for (const [helper, helperFields] of Object.entries(HELPER_FIELDS)) {
      if (source.includes(helper)) helperFields.forEach(field => addDependency(fields, field));
    }

    const resolved = [...fields];
    dependenciesCache.set(prompt, resolved);
    return resolved;
  }

  function hasKnownValue(record, field) {
    if (!record || typeof record !== "object") return false;
    const value = record[field];
    if (value === null || value === undefined) return false;
    if (typeof value === "number" && !Number.isFinite(value)) return false;
    return true;
  }

  function canEvaluatePrompt(prompt, record) {
    return promptDependencies(prompt).every(field => hasKnownValue(record, field));
  }

  function wrapPrompt(prompt) {
    if (!prompt || typeof prompt.test !== "function" || prompt._missingFieldGuarded === true) return prompt;
    const original = prompt.test;
    prompt.test = function guardedPromptTest(record) {
      if (!canEvaluatePrompt(prompt, record)) return false;
      try { return Boolean(original(record)); }
      catch (_) { return false; }
    };
    try {
      Object.defineProperty(prompt, "_missingFieldGuarded", { value: true, configurable: true });
      Object.defineProperty(prompt, "_unguardedTest", { value: original, configurable: true });
    } catch (_) {
      prompt._missingFieldGuarded = true;
    }
    return prompt;
  }

  function guardCollection(collection) {
    if (!Array.isArray(collection)) return 0;
    let wrapped = 0;
    for (const prompt of collection) {
      if (prompt?._missingFieldGuarded !== true && typeof prompt?.test === "function") {
        wrapPrompt(prompt);
        wrapped += 1;
      }
    }
    return wrapped;
  }

  function install() {
    let wrapped = 0;
    wrapped += guardCollection(window.FPL_PROMPT_LIBRARY);
    wrapped += guardCollection(window.FPL_DAILY_CHALLENGE?.prompts);
    return wrapped;
  }

  window.FPL_PROMPT_FIELD_GUARD = Object.freeze({
    install,
    wrapPrompt,
    guardCollection,
    canEvaluatePrompt,
    promptDependencies
  });

  install();
  window.addEventListener("fpl:prompt-tools-ready", install);
  window.addEventListener("fpl:challenge-loaded", install);
})();
