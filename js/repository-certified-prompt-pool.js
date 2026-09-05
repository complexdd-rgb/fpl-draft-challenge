/* FPL Challenge Studio — clean repository prompt pool v2.0.0.
   The previous certified prompt population has been retired with the Prompt Studio reset.
   Production membership starts at zero and grows only through the new clean library. */
(() => {
  "use strict";

  if (window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.version === "2.0.0") return;

  const VERSION = "2.0.0";

  function liveLibrary() {
    const clean = window.FPL_PROMPT_STUDIO_CLEAN?.getLibrary?.();
    if (Array.isArray(clean)) return clean;
    const apiLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(apiLibrary)
      ? apiLibrary
      : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function getState() {
    const library = liveLibrary();
    return Object.freeze({
      ready: true,
      version: VERSION,
      expected: 0,
      total: 0,
      actual: library.length,
      browserTotal: library.length,
      browserCustom: 0,
      ignoredBrowserPrompts: library.length,
      prompts: Object.freeze([]),
      ids: Object.freeze([]),
      reason: "Prompt Studio clean reset is active. No prompts are certified for production yet."
    });
  }

  function snapshot() {
    return Object.freeze([]);
  }

  function paint() {
    const target = document.getElementById("libraryStatus");
    if (target) {
      target.textContent = "0 certified · clean reset";
      target.title = "The old certified prompt pool has been retired. New prompts must enter through the clean Prompt Studio rebuild.";
    }
    return getState();
  }

  window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL = Object.freeze({
    ready: true,
    version: VERSION,
    expectedTotal: 0,
    baseCount: 0,
    getState,
    snapshot,
    refresh: paint
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint, { once: true });
  else paint();
})();
