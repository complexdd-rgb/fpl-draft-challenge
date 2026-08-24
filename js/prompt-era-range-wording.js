/* FPL Challenge Studio — Quality Pack V3 era-range wording normaliser v1.0.0
   Keeps the story-led era prompts, but expresses their season window in the exact
   between-X-and-Y form understood by the shared Rule Tester/certification parser. */
(() => {
  "use strict";

  const MARK = "__fplEraRangeWordingPush";
  const ID_PATTERN = /^quality_v3_(?:gk|def|mid|fwd)_era_(\d{4})_(\d{4})_/i;

  function seasonLabel(startYear) {
    const year = Number(startYear);
    return Number.isFinite(year) ? `${year}/${String(year + 1).slice(-2)}` : "";
  }

  function rewritePrompt(prompt) {
    if (!prompt || typeof prompt !== "object") return prompt;
    const match = String(prompt.id || "").match(ID_PATTERN);
    if (!match) return prompt;

    const start = seasonLabel(match[1]);
    const end = seasonLabel(match[2]);
    if (!start || !end) return prompt;

    const label = String(prompt.label || "");
    const fail = String(prompt.fail || "");
    const nextLabel = label.replace(/\bfrom the\s+.+?\s+era\b/i, `between ${start} and ${end} seasons`);
    const nextFail = fail.replace(/\bin the\s+.+?\s+era\b/i, `between the ${start} and ${end} seasons`);

    try {
      if (nextLabel !== label) prompt.label = nextLabel;
      if (nextFail !== fail) prompt.fail = nextFail;
    } catch (_) {}
    return prompt;
  }

  function patchLibrary(library) {
    if (!Array.isArray(library)) return;
    library.forEach(rewritePrompt);
    const currentPush = library.push;
    if (currentPush?.[MARK]) return;

    const wrappedPush = function (...items) {
      items.forEach(rewritePrompt);
      return currentPush.apply(this, items);
    };
    try { Object.defineProperty(wrappedPush, MARK, { value: true }); } catch (_) { wrappedPush[MARK] = true; }
    try { library.push = wrappedPush; } catch (_) {}
  }

  patchLibrary(window.FPL_PROMPT_LIBRARY);
  window.addEventListener("fpl:prompt-library-changed", () => patchLibrary(window.FPL_PROMPT_LIBRARY));
  window.addEventListener("fpl:prompt-tools-ready", () => patchLibrary(window.FPL_PROMPT_LIBRARY));

  window.FPL_ERA_RANGE_WORDING = Object.freeze({
    version: "1.0.0",
    rewritePrompt,
    patchLibrary
  });
})();