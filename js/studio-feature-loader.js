/* FPL Challenge Studio — admin-only non-critical feature loader. */
(() => {
  "use strict";
  const config = window.FPL_LEADERBOARD_CONFIG;
  if (!config || !window.FPL_IS_STUDIO) return;

  const loadModule = (src, marker, { async = true } = {}, done = null) => {
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) {
      if (done) {
        if (existing.dataset.loaded === "true") queueMicrotask(done);
        else existing.addEventListener("load", done, { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = async;
    script.setAttribute(marker, "1");
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      done?.();
    }, { once: true });
    document.head.appendChild(script);
  };

  const loadCertificationLayer = () => {
    // The all-season regression panel must not capture ValidationEngine until the
    // Career Shape agreement bridge is installed. admin-import-tools also requests
    // this bridge, so this safely waits on that existing request when it is already
    // in flight instead of racing the finishing layer against it.
    loadModule("js/career-shape-validation-bridge.js?v=1.0.0", "data-career-shape-validation-bridge", { async: false }, () => {
      loadModule("js/admin-studio-finish.js?v=1.0.1", "data-admin-studio-finish");
      loadModule("js/career-overlap-wording.js?v=1.0.0", "data-career-overlap-wording");
    });
  };

  // Preserve the five approved Studio-export prompts until they are promoted into the
  // canonical prompt library during the later prompt-library consolidation pass. The
  // finishing/certification layer is chained after this load so its fingerprint and
  // regression run see the final Studio prompt set from the first click.
  loadModule("js/prompt-library-legacy-additions-20260814.js", "data-prompt-library-legacy-additions", { async: false }, loadCertificationLayer);

  if (config.dailyPublishing?.enabled && document.getElementById("downloadWeekBtn")) {
    loadModule("js/admin-daily-publish.js", "data-admin-daily-publish");
  }
})();