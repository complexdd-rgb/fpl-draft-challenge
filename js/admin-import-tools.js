/* FPL Challenge Studio — bootstrap entrypoint v24.0.0.
   There is deliberately no Prompt Studio fallback path. A bootstrap failure is surfaced as
   an error rather than silently resurrecting an older Prompt Studio build. */
(() => {
  "use strict";

  const BOOTSTRAP_URL = "js/studio-bootstrap.js?v=2.0.0-clean-reset";

  const startBootstrap = () => {
    if (window.FPL_STUDIO_BOOTSTRAP?.start) {
      window.FPL_STUDIO_BOOTSTRAP.start();
      return;
    }

    const existing = document.querySelector("script[data-studio-bootstrap]");
    if (existing) {
      existing.addEventListener("load", () => window.FPL_STUDIO_BOOTSTRAP?.start?.(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = new URL(BOOTSTRAP_URL, document.baseURI).toString();
    script.async = false;
    script.dataset.studioBootstrap = "1";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      window.FPL_STUDIO_BOOTSTRAP?.start?.();
    }, { once: true });
    script.addEventListener("error", () => {
      document.documentElement.dataset.studioBootstrap = "error";
      console.error("FPL Challenge Studio bootstrap failed. Legacy Prompt Studio fallback is disabled by design.");
      window.dispatchEvent(new CustomEvent("fpl:studio-bootstrap-load-error", {
        detail: { src: BOOTSTRAP_URL, fallbackDisabled: true }
      }));
    }, { once: true });
    document.head.appendChild(script);
  };

  startBootstrap();
})();
