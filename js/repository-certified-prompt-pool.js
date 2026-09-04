/* FPL Challenge Studio — repository-owned certified prompt pool v1.1.0
   Separates the production/certification prompt set from browser-local Prompt Manager state.
   The browser may keep thousands of experimental/custom prompts, but only repository-owned
   approved/quality/survivor/nationality prompts are eligible for certification or generation. */
(() => {
  "use strict";

  if (window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.version === "1.1.0") return;

  const VERSION = "1.1.0";
  const EXPECTED_TOTAL = 851;
  const MANAGER_KEY = "fplChallengeStudioPromptManagerV1";
  const QUALITY_TAGS = new Set(["quality-pack-v1", "quality-pack-v2", "quality-pack-v3"]);

  // Capture the repository prompt-library.js population before admin-core applies browser-local
  // overrides/customs/deletions. Runtime packs loaded later are admitted only through their own
  // repository-owned metadata.
  const baseSnapshot = Object.freeze((Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []).map(prompt => Object.freeze({
    id: String(prompt?.id || ""),
    rating: Number(prompt?.rating || 0),
    enabled: prompt?.enabled !== false,
    quality: Array.isArray(prompt?.tags) && prompt.tags.some(tag => QUALITY_TAGS.has(String(tag)))
  })).filter(item => item.id));
  const baseIds = new Set(baseSnapshot.map(item => item.id));
  const baseQualityFourPlusIds = new Set(baseSnapshot.filter(item => item.quality && item.rating >= 4 && item.enabled).map(item => item.id));

  function liveLibrary() {
    const apiLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(apiLibrary)
      ? apiLibrary
      : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function managerState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MANAGER_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return { customs:[], overrides:{}, deletedIds:[] };
      return {
        customs: Array.isArray(parsed.customs) ? parsed.customs : [],
        overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
        deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
      };
    } catch (_) {
      return { customs:[], overrides:{}, deletedIds:[] };
    }
  }

  function touchedIds(state) {
    return new Set([
      ...state.customs.map(item => String(item?.id || "")).filter(Boolean),
      ...Object.keys(state.overrides || {}).map(String),
      ...state.deletedIds.map(String)
    ]);
  }

  function dependencies() {
    return {
      approvedIds: Array.isArray(window.FPL_APPROVED_PROMPT_IDS_20260814) ? window.FPL_APPROVED_PROMPT_IDS_20260814 : null,
      disabledIds: Array.isArray(window.FPL_APPROVED_PROMPT_DISABLED_IDS_20260814) ? window.FPL_APPROVED_PROMPT_DISABLED_IDS_20260814 : null,
      approvedBaseline: window.FPL_APPROVED_PROMPT_BASELINE,
      qualityV1: window.FPL_QUALITY_PROMPT_PACK_V1,
      qualityV2: window.FPL_QUALITY_PROMPT_PACK_V2,
      qualityV3: window.FPL_QUALITY_PROMPT_PACK_V3,
      qualityBaseline: window.FPL_QUALITY_PROMPT_BASELINE,
      survivors: window.FPL_REFINEMENT_SURVIVOR_PACK_V1,
      nationality: window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1
    };
  }

  function notReady(reason, library, extra = {}) {
    return Object.freeze({
      ready: false,
      version: VERSION,
      expected: EXPECTED_TOTAL,
      total: 0,
      actual: Array.isArray(library) ? library.length : 0,
      browserTotal: Array.isArray(library) ? library.length : 0,
      browserCustom: managerState().customs.length,
      ignoredBrowserPrompts: Math.max(0, (Array.isArray(library) ? library.length : 0) - EXPECTED_TOTAL),
      prompts: Object.freeze([]),
      ids: Object.freeze([]),
      reason: String(reason || "Repository certified prompt pool is not ready."),
      ...extra
    });
  }

  function getState() {
    const library = liveLibrary();
    const deps = dependencies();
    if (!deps.approvedIds || !deps.disabledIds || !deps.approvedBaseline?.ready) {
      return notReady("Approved repository prompt baseline is still loading.", library);
    }
    if (!deps.qualityV1?.ready || !deps.qualityV2?.ready || !deps.qualityV3?.ready || !deps.qualityBaseline?.ready) {
      return notReady("Repository quality prompt packs are still loading.", library);
    }
    if (!deps.survivors?.ready) return notReady("Refinement survivor pack is still loading.", library);
    if (!deps.nationality?.ready) return notReady("Nationality context prompt pack is still loading.", library);

    const disabled = new Set(deps.disabledIds.map(String));
    const approved = new Set(deps.approvedIds.map(String));
    const weakParents = new Set((deps.survivors.parentIds || []).map(String));
    const candidateIds = new Set();

    // Static repository prompt-library.js prompts are eligible only if they are on the approved
    // repository list. This deliberately ignores unrelated browser custom prompts.
    for (const id of baseIds) {
      if (approved.has(id) && !disabled.has(id)) candidateIds.add(id);
    }

    // Preserve repository-owned quality prompts that are not part of the older approved-id export.
    // Only IDs that existed in prompt-library.js before browser state, or were actually installed by
    // the repository pack scripts during this page load, are eligible.
    const packInstalled = new Set([
      ...(deps.qualityV1.ids || []),
      ...(deps.qualityV2.ids || []),
      ...(deps.qualityV3.ids || []),
      ...(deps.survivors.ids || [])
    ].map(String));
    const qualityAllowedOrigins = new Set([...baseIds, ...packInstalled]);
    for (const id of deps.qualityBaseline.ids || []) {
      const value = String(id || "");
      if (qualityAllowedOrigins.has(value)) candidateIds.add(value);
    }
    for (const id of baseQualityFourPlusIds) candidateIds.add(id);
    for (const id of deps.survivors.ids || []) candidateIds.add(String(id));
    for (const id of deps.nationality.ids || []) candidateIds.add(String(id));

    for (const id of weakParents) candidateIds.delete(id);
    for (const id of disabled) candidateIds.delete(id);

    const state = managerState();
    const touched = touchedIds(state);
    const certifiedTouched = [...candidateIds].filter(id => touched.has(id));
    if (certifiedTouched.length) {
      return notReady(
        `Browser-local Prompt Manager changes touch ${certifiedTouched.length.toLocaleString("en-GB")} repository-certified prompt(s). Export or reset those edits before production certification/generation.`,
        library,
        { conflicts: Object.freeze(certifiedTouched.slice(0, 20)) }
      );
    }

    const byId = new Map();
    const counts = new Map();
    for (const prompt of library) {
      const id = String(prompt?.id || "");
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
      if (!byId.has(id)) byId.set(id, prompt);
    }

    const ids = [...candidateIds].sort();
    const missing = ids.filter(id => !byId.has(id));
    const duplicates = ids.filter(id => Number(counts.get(id) || 0) !== 1);
    const prompts = ids.map(id => byId.get(id)).filter(Boolean);
    const invalid = prompts.filter(prompt => prompt?.enabled === false || Number(prompt?.rating || 0) < 4 || typeof prompt?.test !== "function").map(prompt => String(prompt?.id || ""));

    if (ids.length !== EXPECTED_TOTAL) {
      return notReady(
        `Repository-certified prompt membership resolved to ${ids.length.toLocaleString("en-GB")} prompts; expected ${EXPECTED_TOTAL.toLocaleString("en-GB")}. Browser-local extras are ignored rather than promoted.`,
        library,
        { resolved: ids.length, missing: Object.freeze(missing.slice(0, 20)) }
      );
    }
    if (missing.length || duplicates.length || invalid.length || prompts.length !== EXPECTED_TOTAL) {
      return notReady(
        `Repository-certified prompt definitions are incomplete or modified (${missing.length} missing · ${duplicates.length} duplicate · ${invalid.length} invalid).`,
        library,
        {
          missing: Object.freeze(missing.slice(0, 20)),
          duplicates: Object.freeze(duplicates.slice(0, 20)),
          invalid: Object.freeze(invalid.slice(0, 20))
        }
      );
    }

    return Object.freeze({
      ready: true,
      version: VERSION,
      expected: EXPECTED_TOTAL,
      total: EXPECTED_TOTAL,
      actual: library.length,
      browserTotal: library.length,
      browserCustom: state.customs.length,
      ignoredBrowserPrompts: Math.max(0, library.length - EXPECTED_TOTAL),
      prompts: Object.freeze(prompts.slice()),
      ids: Object.freeze(ids),
      reason: `${EXPECTED_TOTAL.toLocaleString("en-GB")} repository-certified prompts ready; ${Math.max(0, library.length - EXPECTED_TOTAL).toLocaleString("en-GB")} browser-only prompt(s) ignored.`
    });
  }

  function snapshot() {
    const state = getState();
    return state.ready ? Object.freeze(state.prompts.slice()) : null;
  }

  let lastReadyKey = "";
  function paint() {
    const status = getState();
    const target = document.getElementById("libraryStatus");
    const census = window.FPL_PROMPT_LIBRARY_CENSUS;
    if (target && status.ready && census?.ready) {
      target.textContent = `${census.enabled.toLocaleString("en-GB")} enabled · ${census.total.toLocaleString("en-GB")} total · ${census.disabled.toLocaleString("en-GB")} disabled`;
      target.title = "Enabled means eligible for production Daily Challenge use. Every other working prompt stays disabled until it is promoted or deleted.";
    } else if (target && status.ready) {
      const browserEnabled = liveLibrary().filter(prompt => prompt?.enabled !== false).length;
      target.textContent = `${status.total.toLocaleString("en-GB")} certified live · ${browserEnabled.toLocaleString("en-GB")} browser-enabled · ${status.browserCustom.toLocaleString("en-GB")} local custom`;
      target.title = "Production certification and Daily generation use the repository-certified pool only. Browser-local custom prompts remain available in Prompt Studio but are not promoted automatically.";
    }
    if (status.ready) {
      const key = `${status.total}:${status.ids[0] || ""}:${status.ids.at(-1) || ""}`;
      if (key !== lastReadyKey) {
        lastReadyKey = key;
        window.dispatchEvent(new CustomEvent("fpl:repository-certified-prompt-pool-ready", { detail: status }));
      }
    }
    return status;
  }

  function loadCanonicalPromptState() {
    if (window.FPL_PROMPT_LIBRARY_CANONICAL_STATE?.ready) return;
    if (document.querySelector('script[data-canonical-prompt-library-state]')) return;
    const script = document.createElement("script");
    script.src = window.FPL_ASSET_MANIFEST?.url?.("promptLibraryCanonicalState") || "js/prompt-library-canonical-state.js?v=1.0.0";
    script.async = false;
    script.dataset.canonicalPromptLibraryState = "1";
    document.head.appendChild(script);
  }

  const api = Object.freeze({
    ready: true,
    version: VERSION,
    expectedTotal: EXPECTED_TOTAL,
    baseCount: baseSnapshot.length,
    getState,
    snapshot,
    refresh: paint
  });
  window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL = api;
  loadCanonicalPromptState();

  const events = [
    "fpl:approved-prompt-baseline-ready",
    "fpl:quality-prompt-baseline-ready",
    "fpl:refinement-survivor-pack-ready",
    "fpl:prompt-tools-ready",
    "fpl:prompt-library-changed"
  ];
  events.forEach(name => window.addEventListener(name, () => setTimeout(paint, 0)));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(paint, 0), { once:true });
  else setTimeout(paint, 0);
  setTimeout(paint, 250);
  setTimeout(paint, 1000);
})();
