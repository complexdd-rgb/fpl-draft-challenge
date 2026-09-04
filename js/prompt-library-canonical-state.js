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
  let lastLibraryChangeKey = "";
  let repaintTimer = 0;

  function library() {
    const api = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(api)
      ? api
      : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function productionState() {
    return window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.getState?.() || null;
  }

  function productionIds() {
    const state = productionState();
    return state?.ready && Array.isArray(state.ids) ? new Set(state.ids.map(String)) : new Set();
  }

  function markPrompt(prompt, production) {
    try { prompt._productionEligible = production; } catch (_) {}
  }

  function census(items, ids) {
    const enabled = items.filter(prompt => prompt?.enabled !== false).length;
    const production = items.filter(prompt => ids.has(String(prompt?.id || ""))).length;
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

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node && node.textContent !== value) node.textContent = value;
  }

  function paintTopStatus(result) {
    const target = document.getElementById("libraryStatus");
    if (!target || !result?.ready) return;
    target.textContent = `${result.enabled.toLocaleString("en-GB")} enabled · ${result.total.toLocaleString("en-GB")} total · ${result.disabled.toLocaleString("en-GB")} disabled`;
    target.title = "Enabled means eligible for production Daily Challenge use. Every other working prompt stays disabled until it is promoted or deleted.";
  }

  function paintManager(result) {
    if (!result?.ready) return;
    setText("managerLibraryCount", result.total.toLocaleString("en-GB"));
    setText("managerEnabledCount", result.enabled.toLocaleString("en-GB"));
    setText("managerDisabledCount", result.disabled.toLocaleString("en-GB"));
    setText("managerCustomCount", result.production.toLocaleString("en-GB"));

    const fourth = document.getElementById("managerCustomCount")?.closest("article")?.querySelector("span");
    if (fourth && fourth.textContent !== "Production certified") fourth.textContent = "Production certified";

    const statusFilter = document.getElementById("promptManagerStatusFilter");
    if (statusFilter) {
      const custom = statusFilter.querySelector('option[value="custom"]');
      const builtIn = statusFilter.querySelector('option[value="built-in"]');
      if (custom) custom.textContent = "Rule-built / Studio-created";
      if (builtIn) builtIn.textContent = "Static repository prompts";
    }
  }

  function analysedCount() {
    const summary = document.getElementById("promptQualitySummary");
    if (!summary || summary.classList.contains("hidden")) return null;
    const first = summary.querySelector("article strong");
    if (!first) return null;
    const value = Number(String(first.textContent || "").replace(/[^0-9]/g, ""));
    return Number.isFinite(value) ? value : null;
  }

  function qualityRunning() {
    const run = document.getElementById("runPromptQualityBtn");
    const progress = document.getElementById("qualityProgressWrap");
    return Boolean(run?.disabled && progress && !progress.classList.contains("hidden"));
  }

  function markQualityStale(result) {
    if (!result?.ready || qualityRunning()) return;
    const summary = document.getElementById("promptQualitySummary");
    const controls = document.getElementById("promptQualityFilters");
    const list = document.getElementById("promptQualityList");
    const listSummary = document.getElementById("promptQualityListSummary");
    const count = analysedCount();
    if (count === null || count === result.total) return;

    summary?.classList.add("hidden");
    controls?.classList.add("hidden");
    if (list) list.innerHTML = "";
    if (listSummary) listSummary.textContent = "Quality report is stale — rerun required";
    for (const id of ["applyQualityRatingsBtn", "disableQualityPromptsBtn", "deleteQualityPromptsBtn", "downloadQualityJsonBtn", "downloadQualityCsvBtn"]) {
      const button = document.getElementById(id);
      if (button) button.disabled = true;
    }
    const status = document.getElementById("promptQualityStatus");
    if (status) status.textContent = `Library changed: ${result.total.toLocaleString("en-GB")} total · ${result.enabled.toLocaleString("en-GB")} enabled · ${result.disabled.toLocaleString("en-GB")} disabled. The previous quality report is stale; run full quality analysis again.`;
  }

  function paintQualityScope(result) {
    if (!result?.ready) return;
    const scope = document.getElementById("qualityScope");
    if (scope) {
      scope.value = "all";
      scope.disabled = true;
      const all = scope.querySelector('option[value="all"]');
      if (all) all.textContent = "All prompts (canonical library)";
      scope.title = "Quality analysis always uses the full canonical working library so every Studio count refers to the same prompt population.";
    }
    markQualityStale(result);
  }

  function paint(result) {
    paintTopStatus(result);
    paintManager(result);
    paintQualityScope(result);
  }

  function dispatchLibraryChange(result, newlyDisabled) {
    const key = `${result.total}:${result.enabled}:${result.disabled}:${newlyDisabled}`;
    if (key === lastLibraryChangeKey) return;
    lastLibraryChangeKey = key;
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", {
        detail: {
          source: "canonical-prompt-state",
          disabled: newlyDisabled,
          total: result.total,
          enabled: result.enabled,
          production: result.production
        }
      }));
    }, 0);
  }

  function reconcile({ announce = true } = {}) {
    if (reconciling) return window.FPL_PROMPT_LIBRARY_CENSUS || null;
    const state = productionState();
    if (!state?.ready || state.total !== EXPECTED_PRODUCTION || !Array.isArray(state.ids)) return null;

    reconciling = true;
    try {
      const items = library();
      const ids = new Set(state.ids.map(String));
      let newlyDisabled = 0;

      for (const prompt of items) {
        const id = String(prompt?.id || "");
        const production = ids.has(id);
        markPrompt(prompt, production);
        if (!production && prompt?.enabled !== false) {
          try {
            prompt.enabled = false;
            newlyDisabled += 1;
          } catch (_) {}
        }
      }

      const result = census(items, ids);
      window.FPL_PROMPT_LIBRARY_CENSUS = result;
      paint(result);

      const censusKey = `${result.total}:${result.enabled}:${result.disabled}:${result.production}`;
      const censusChanged = censusKey !== lastCensusKey;
      if (censusChanged) {
        lastCensusKey = censusKey;
        window.dispatchEvent(new CustomEvent("fpl:canonical-prompt-library-state", { detail: result }));
      }

      if (newlyDisabled) window.FPL_STUDIO_API?.invalidatePromptStats?.();
      if (censusChanged || newlyDisabled) dispatchLibraryChange(result, newlyDisabled);

      if (announce && result.ready) {
        const search = document.getElementById("promptManagerSearch");
        if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return result;
    } finally {
      reconciling = false;
    }
  }

  function scheduleReconcile(delay = 0) {
    clearTimeout(repaintTimer);
    repaintTimer = setTimeout(() => reconcile(), delay);
  }

  function blockWorkingOnlyEnable(event) {
    const button = event.target.closest?.('#promptManagerList button[data-action="toggle"]');
    if (!button) return false;
    const prompt = library().find(item => String(item?.id || "") === String(button.dataset.id || ""));
    if (!prompt || prompt.enabled !== false) return false;
    const ids = productionIds();
    if (ids.has(String(prompt.id))) return false;

    event.preventDefault();
    event.stopImmediatePropagation();
    const status = document.getElementById("managerStatus");
    if (status) status.textContent = `${prompt.label} remains disabled. Only repository-certified prompts can be enabled; promote it first or delete it.`;
    return true;
  }

  function installInteractionGuard() {
    document.addEventListener("click", event => {
      if (blockWorkingOnlyEnable(event)) return;
      if (event.target.closest?.("#savePromptBtn,#duplicatePromptBtn,#addPromptBatchBtn,#promptManagerList button[data-action]")) {
        scheduleReconcile(80);
      }
    }, true);
  }

  function installDomObserver() {
    const root = document.body;
    if (!root || root.dataset.canonicalPromptObserver === "true") return;
    root.dataset.canonicalPromptObserver = "true";
    const observer = new MutationObserver(() => {
      const result = window.FPL_PROMPT_LIBRARY_CENSUS;
      if (!result?.ready) return;
      clearTimeout(repaintTimer);
      repaintTimer = setTimeout(() => paint(result), 30);
    });
    observer.observe(root, { childList:true, subtree:true });
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
  events.forEach(name => window.addEventListener(name, () => scheduleReconcile(0)));

  installInteractionGuard();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      installDomObserver();
      scheduleReconcile(0);
    }, { once:true });
  } else {
    installDomObserver();
    scheduleReconcile(0);
  }

  // Several prompt packs initialise asynchronously. Short repeat checks make the census converge
  // even if an older pack forgets to dispatch a library-change event.
  [250, 750, 1500, 3000, 5000].forEach(delay => setTimeout(() => reconcile({ announce:false }), delay));
})();
