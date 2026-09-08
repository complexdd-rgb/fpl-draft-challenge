/* FPL Draft Challenge — live behavior bootstrap.
   Owns only the prompt-readiness guard and slot-level render optimisation. */
(() => {
  "use strict";

  const loadScript = (src, marker, { async = true } = {}) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = async;
    script.setAttribute(marker, "1");
    document.head.appendChild(script);
  };

  const api = {
    loadPromptMissingFieldGuard() {
      if (window.FPL_PROMPT_FIELD_GUARD) return;
      loadScript("js/prompt-missing-field-guard.js?v=1.0.0", "data-prompt-missing-field-guard", { async: false });
    },
    loadPerformanceLayer() {
      loadScript("js/season-select-performance.js", "data-season-select-performance");
    }
  };

  window.FPL_LIVE_UI_BOOTSTRAP = Object.freeze(api);

  const start = () => {
    api.loadPromptMissingFieldGuard();
    api.loadPerformanceLayer();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
