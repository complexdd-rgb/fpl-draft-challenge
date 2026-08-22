/* FPL Challenge Studio — admin-only feature loader. */
(() => {
  "use strict";
  const config = window.FPL_LEADERBOARD_CONFIG;
  if (!config || !window.FPL_IS_STUDIO) return;

  const loadModule = (src, marker, { async = true } = {}) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = async;
    script.setAttribute(marker, "1");
    document.head.appendChild(script);
  };

  // Two older prompt-tool modules still register initialisers against window.load.
  // Replay one load event when their lazy bundle arrives after the real load event.
  const latePromptObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLScriptElement) || !/\/js\/admin-import-tools-base\.js(?:\?|$)/.test(node.src)) continue;
        latePromptObserver.disconnect();
        node.addEventListener("load", () => {
          if (document.readyState === "complete") queueMicrotask(() => window.dispatchEvent(new Event("load")));
        }, { once: true });
        return;
      }
    }
  });
  latePromptObserver.observe(document.head, { childList: true });

  // Preserve the five approved Studio-export prompts until they are promoted into the
  // canonical prompt library during the later prompt-library consolidation pass.
  loadModule("js/prompt-library-legacy-additions-20260814.js", "data-prompt-library-legacy-additions", { async: false });

  if (config.dailyPublishing?.enabled && document.getElementById("downloadWeekBtn")) {
    loadModule("js/admin-daily-publish.js", "data-admin-daily-publish");
  }

  loadModule("js/admin-studio-finish.js?v=1.0.0", "data-admin-studio-finish");
  loadModule("js/career-overlap-wording.js?v=1.0.0", "data-career-overlap-wording");
})();
