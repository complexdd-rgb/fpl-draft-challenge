/* FPL Challenge Studio — canonical Prompt Studio library state v1.0.0
   Keeps Prompt Studio working material visible, but only repository-certified prompts enabled.
   Every other loaded prompt remains available for review as disabled until it is promoted or deleted. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_LIBRARY_CANONICAL_STATE?.version === "1.0.0") return;

  const VERSION = "1.0.0";
  const EXPECTED_PRODUCTION = 851;
  let reconciling = false;
  let lastCensusKey = "";
  let lastDisabledKey = "";

  function library() {
    const api = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(api)
      ? api
      : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function productionState() {
    return window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.getState?.() || null;
  }

  function markPrompt(prompt, production) {
    try { prompt._productionEligible = production; } catch (_) {}
  }

  function census(items, productionIds) {
    const enabled = items.filter(prompt => prompt?.enabled !== false).length;
    const production = items.filter(prompt => productionIds.has(String(prompt?.id || ""))).length;
    return Object.freeze({
      ready: production === EXPECTED_PRODUCTION,
      version: VERSION,
      total: items.length,
      enabled,
      disabled: Math.max(0, items.length - enabled),
      production,
      workingOnly: Math.max(0, items.length - production)
    });
  }

  function paint(censusState) {
    const target = document.getElementById("libraryStatus");
    if (target && censusState?.ready) {
      target.textContent = `${censusState.enabled.toLocaleString("en-GB")} enabled · ${censusState.total.toLocaleString("en-GB")} total · ${censusState.disabled.toLocaleString("en-GB")} disabled`;
      target.title = "Enabled means eligible for production Daily Challenge use. Working prompts that are not repository-certified stay disabled until promoted or deleted.";
    }
  }

  function reconcile({ announce = true } = {}) {
    if (reconciling) return window.FPL_PROMPT_LIBRARY_CENSUS || null;
    const state = productionState();
    if (!state?.ready || state.total !== EXPECTED_PRODUCTION || !Array.isArray(state.ids)) return null;

    reconciling = true;
    try {
      const items = library();
      const productionIds = new Set(state.ids.map(String));
      let newlyDisabled = 0;

      for (const prompt of items) {
        const id = String(prompt?.id || "");
        const production = productionIds.has(id);
        markPrompt(prompt, production);
        if (!production && prompt?.enabled !== false) {
          try {
            prompt.enabled = false;
            newlyDisabled += 1;
          } catch (_) {}
        }
      }

      const result = census(items, productionIds);
      window.FPL_PROMPT_LIBRARY_CENSUS = result;
      paint(result);

      const censusKey = `${result.total}:${result.enabled}:${result.disabled}:${result.production}`;
      if (censusKey !== lastCensusKey) {
        lastCensusKey = censusKey;
        window.dispatchEvent(new CustomEvent("fpl:canonical-prompt-library-state", { detail: result }));
      }

      if (newlyDisabled) {
        window.FPL_STUDIO_API?.invalidatePromptStats?.();
        const disabledKey = `${newlyDisabled}:${result.total}:${result.enabled}`;
        if (disabledKey !== lastDisabledKey) {
          lastDisabledKey = disabledKey;
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", {
              detail: { source: "canonical-prompt-state", disabled: newlyDisabled, total: result.total, enabled: result.enabled }
            }));
          }, 0);
        }
      }

      if (announce && result.ready) {
        const search = document.getElementById("promptManagerSearch");
        if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return result;
    } finally {
      reconciling = false;
    }
  }

  const api = Object.freeze({
    ready: true,
    version: VERSION,
    expectedProduction: EXPECTED_PRODUCTION,
    reconcile,
    getCensus: () => window.FPL_PROMPT_LIBRARY_CENSUS || reconcile({ announce:false })
  });
  window.FPL_PROMPT_LIBRARY_CANONICAL_STATE = api;

  const events = [
    "fpl:repository-certified-prompt-pool-ready",
    "fpl:prompt-library-changed",
    "fpl:prompt-tools-ready",
    "fpl:quality-prompt-baseline-ready",
    "fpl:refinement-survivor-pack-ready",
    "fpl:prompt-field-readiness-ready"
  ];
  events.forEach(name => window.addEventListener(name, () => setTimeout(() => reconcile(), 0)));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(() => reconcile(), 0), { once:true });
  } else {
    setTimeout(() => reconcile(), 0);
  }

  // Several prompt packs initialise asynchronously. Short repeat checks make the census converge
  // even if an older pack forgets to dispatch a library-change event.
  [250, 750, 1500, 3000, 5000].forEach(delay => setTimeout(() => reconcile({ announce:false }), delay));
})();
