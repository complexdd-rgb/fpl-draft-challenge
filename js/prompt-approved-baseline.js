/* FPL Challenge Studio — approved prompt baseline v1.0.3
   Applies the user's 14 Aug 2026 Prompt Studio cleanup without replacing prompt objects.
   Existing baseline prompts must be on the approved list and rated 4★ or 5★.
   Prompts that were disabled in the approved export are now deleted from the effective
   Studio library rather than kept as dormant entries. */
(() => {
  "use strict";

  const EXPECTED_APPROVED_SOURCE = 937;
  const EXPECTED_DISABLED_SOURCE = 34;
  let attempts = 0;

  function apply() {
    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;
    const approvedIds = Array.isArray(window.FPL_APPROVED_PROMPT_IDS_20260814) ? window.FPL_APPROVED_PROMPT_IDS_20260814 : [];
    const disabledIds = Array.isArray(window.FPL_APPROVED_PROMPT_DISABLED_IDS_20260814) ? window.FPL_APPROVED_PROMPT_DISABLED_IDS_20260814 : [];
    if (!library || approvedIds.length !== EXPECTED_APPROVED_SOURCE || disabledIds.length !== EXPECTED_DISABLED_SOURCE) return false;
    if (!window.FPL_QUALITY_PROMPT_PACK_V1?.ready || !window.FPL_QUALITY_PROMPT_PACK_V2?.ready || !window.FPL_QUALITY_PROMPT_PACK_V3?.ready) return false;

    const approved = new Set(approvedIds.map(String));
    const disabled = new Set(disabledIds.map(String));
    let removed = 0;
    let removedDisabled = 0;

    for (let index = library.length - 1; index >= 0; index -= 1) {
      const prompt = library[index];
      const id = String(prompt?.id || "");
      const rating = Number(prompt?.rating) || 0;
      const newCustom = prompt?._studioCustom === true && prompt?._studioBuiltIn !== true;
      const approvedButDisabled = approved.has(id) && disabled.has(id);
      if (rating < 4 || approvedButDisabled || (!approved.has(id) && !newCustom)) {
        library.splice(index, 1);
        removed += 1;
        if (approvedButDisabled) removedDisabled += 1;
      }
    }

    // V3 originally withheld two 4★ prompts under the former 5★-only pack rule.
    // The project-wide minimum is now 4★, so those are part of the approved baseline.
    for (const prompt of library) {
      if (!(prompt.tags || []).includes("quality-withheld") || Number(prompt.rating) < 4) continue;
      prompt.enabled = true;
      prompt.tags = [...new Set((prompt.tags || []).filter(tag => tag !== "quality-withheld").concat(["approved-4-plus"]))];
    }

    if (Array.isArray(window.FPL_RECENT_PROMPT_IDS)) {
      const liveIds = new Set(library.map(prompt => String(prompt?.id || "")));
      window.FPL_RECENT_PROMPT_IDS = window.FPL_RECENT_PROMPT_IDS.filter(id => liveIds.has(String(id)));
    }

    window.FPL_STUDIO_API?.invalidatePromptStats?.();
    const fourStar = library.filter(prompt => Number(prompt.rating) === 4).length;
    const fiveStar = library.filter(prompt => Number(prompt.rating) === 5).length;
    const baselinePresent = library.filter(prompt => approved.has(String(prompt?.id || ""))).length;
    const disabledCount = library.filter(prompt => prompt.enabled === false).length;
    const activeExpected = EXPECTED_APPROVED_SOURCE - disabled.size;

    window.FPL_APPROVED_PROMPT_BASELINE = Object.freeze({
      ready: true,
      version: "1.0.3",
      sourceApprovedExpected: EXPECTED_APPROVED_SOURCE,
      approvedExpected: activeExpected,
      approvedPresent: baselinePresent,
      total: library.length,
      removed,
      removedDisabled,
      disabledDeleted: disabled.size,
      minimumRating: 4,
      fourStar,
      fiveStar,
      disabled: disabledCount
    });

    window.dispatchEvent(new CustomEvent("fpl:approved-prompt-baseline-ready", { detail: window.FPL_APPROVED_PROMPT_BASELINE }));
    setTimeout(() => {
      const search = document.getElementById("promptManagerSearch");
      if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
      window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", { detail: window.FPL_APPROVED_PROMPT_BASELINE }));
    }, 0);
    return true;
  }

  function retry() {
    if (apply()) return;
    attempts += 1;
    if (attempts < 80) setTimeout(retry, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
  window.addEventListener("fpl:prompt-tools-ready", retry);
})();
