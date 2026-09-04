/* FPL Challenge Studio — Refinement Survivor Pack v1.0.0
   Replaces two held 3★ Quality Enforcement v2 parents with variants proven by the
   deterministic Incubator trial and a full-library quality/overlap recheck. */
(() => {
  "use strict";

  if (window.FPL_REFINEMENT_SURVIVOR_PACK_V1?.ready) return;

  const VERSION = "1.0.0";
  const PARENT_IDS = Object.freeze([
    "quality_v2_mid_price_6_gi_15",
    "quality_v3_fwd_manager_david_moyes_p55"
  ]);
  const DEFINITIONS = Object.freeze([
    Object.freeze({
      id: "refinement_survivor_v1_mid_price_6_5_gi_15",
      family: "refinement-survivor-v1:budget-goal-involvements",
      position: "MID",
      label: "Midfielder who started at £6.5m or less with 15+ goal involvements",
      fail: "That midfielder must start at £6.5m or less and record at least 15 combined goals and assists in the qualifying season.",
      difficulty: "easy",
      tags: ["refinement-survivor", "survivor-of:quality_v2_mid_price_6_gi_15", "quality-pack", "quality-pack-v2", "checked", "anti-meta", "midfielder", "budget", "starting-price", "goal-involvements"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      requiredFields: ["startingPrice", "goals", "assists", "minutes"],
      studioRule: { kind: "builder", join: "all", conditions: [
        { field: "startingPrice", operator: "lte", value: 6.5, value2: 0 },
        { field: "goalInvolvements", operator: "gte", value: 15, value2: 0 },
        { field: "minutes", operator: "gt", value: 0, value2: 0 }
      ] },
      testSource: "p => ((Number.isFinite(p.startingPrice) && p.startingPrice <= 6.5) && (Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 15) && (Number.isFinite(p.minutes) && p.minutes > 0))"
    }),
    Object.freeze({
      id: "refinement_survivor_v1_fwd_manager_david_moyes_p75",
      family: "refinement-survivor-v1:manager-points",
      position: "FWD",
      label: "Forward managed by David Moyes who scored 75+ FPL points",
      fail: "That forward season must have been managed by David Moyes and score at least 75 FPL points.",
      difficulty: "medium",
      tags: ["refinement-survivor", "survivor-of:quality_v3_fwd_manager_david_moyes_p55", "quality-pack", "quality-pack-v3", "checked", "anti-meta", "manager", "points"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      requiredFields: ["managers", "points", "minutes"],
      studioRule: { kind: "source", source: "p => (Array.isArray(p.managers) && p.managers.some(value => String(value || \"\").trim().toLowerCase() === \"david moyes\") && Number.isFinite(Number(p.points)) && Number(p.points) >= 75 && Number(p.minutes) > 0)" },
      testSource: "p => (Array.isArray(p.managers) && p.managers.some(value => String(value || \"\").trim().toLowerCase() === \"david moyes\") && Number.isFinite(Number(p.points)) && Number(p.points) >= 75 && Number(p.minutes) > 0)"
    })
  ]);

  function compile(source) {
    try {
      const fn = Function(`"use strict"; return (${source});`)();
      return typeof fn === "function" ? fn : null;
    } catch (_) { return null; }
  }

  function library() {
    const api = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null);
  }

  function install() {
    const items = library();
    if (!items || !window.FPL_APPROVED_PROMPT_BASELINE?.ready) return false;

    const survivorIds = new Set(DEFINITIONS.map(definition => definition.id));
    const parentIds = new Set(PARENT_IDS);
    let removedParents = 0;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const id = String(items[index]?.id || "");
      if (!parentIds.has(id) && !survivorIds.has(id)) continue;
      if (parentIds.has(id)) removedParents += 1;
      items.splice(index, 1);
    }

    const added = [];
    for (const definition of DEFINITIONS) {
      const test = compile(definition.testSource);
      if (!test) throw new Error(`Could not compile refinement survivor ${definition.id}.`);
      const prompt = {
        ...definition,
        tags: [...definition.tags],
        requiredFields: [...definition.requiredFields],
        studioRule: JSON.parse(JSON.stringify(definition.studioRule)),
        test,
        _studioBuiltIn: false,
        _studioCustom: true
      };
      items.push(prompt);
      added.push(prompt.id);
    }

    window.FPL_STUDIO_API?.invalidatePromptStats?.();
    const parentsPresentAfter = items.filter(prompt => parentIds.has(String(prompt?.id || ""))).length;
    window.FPL_REFINEMENT_SURVIVOR_PACK_V1 = Object.freeze({
      ready: true,
      version: VERSION,
      parentIds: PARENT_IDS,
      ids: Object.freeze([...added]),
      removedParents,
      parentsPresentAfter,
      added: added.length
    });
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", { detail: { source: "refinement-survivors-v1", removedParents, added: added.length } }));
    window.dispatchEvent(new CustomEvent("fpl:refinement-survivor-pack-ready", { detail: window.FPL_REFINEMENT_SURVIVOR_PACK_V1 }));
    return true;
  }

  let attempts = 0;
  function retry() {
    if (install()) return;
    attempts += 1;
    if (attempts < 100) setTimeout(retry, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
  window.addEventListener("fpl:approved-prompt-baseline-ready", retry);
  window.addEventListener("fpl:prompt-tools-ready", retry);
})();
