/* FPL Draft Challenge — live presentation bootstrap.
   Owns optional player-facing presentation/performance layers. */
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

    loadPresentationLayers() {
      loadScript("js/season-select-performance.js", "data-season-select-performance");
      loadScript("js/autocomplete-layer.js", "data-autocomplete-layer");
      loadScript("js/visual-overhaul.js", "data-visual-overhaul");
      loadScript("js/visual-finishing.js", "data-visual-finishing");
    }
  };

  window.FPL_LIVE_UI_BOOTSTRAP = Object.freeze(api);
})();
