/* FPL Challenge Studio — Prompt Studio lazy loader.
   Heavy prompt-generation and quality modules load only when Prompt Studio is opened. */
(() => {
  "use strict";
  const WORKSPACE_KEY = "fpl-studio-stage-one-workspace";
  let started = false;

  const load = (src, done) => {
    const existing = [...document.scripts].find(script => script.src && script.src.includes(src.split("?")[0]));
    if (existing) {
      if (done) {
        if (existing.dataset.loaded === "true") done();
        else existing.addEventListener("load", done, { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; }, { once: true });
    if (done) script.addEventListener("load", done, { once: true });
    document.head.appendChild(script);
  };

  function loadPromptTools() {
    if (started) return;
    started = true;
    document.documentElement.dataset.promptToolsLoading = "true";

    load("js/admin-import-tools-base.js?v=16.1.0-familymix", () => {
      load("js/prompt-target-survivor-generator.js?v=1.0.0", () => {
        load("js/prompt-target-auto-explorer.js?v=1.0.0");
      });
      const afterRules = () => {
        load("js/career-shape-studio.js?v=1.0.0", () => {
          load("js/career-shape-workspace-repair.js?v=1.0.0", () => {
            load("js/career-shape-unified-generator.js?v=1.0.0", () => {
              load("js/career-shape-future-quality-guard.js?v=1.0.0", () => {
                load("js/career-shape-unified-fixes.js?v=1.0.1", () => {
                  document.documentElement.dataset.promptToolsLoading = "false";
                  document.documentElement.dataset.promptToolsReady = "true";
                  window.dispatchEvent(new CustomEvent("fpl:prompt-tools-ready"));
                });
              });
            });
          });
        });
      };

      if (window.FPL_CAREER_SHAPE_RULES) afterRules();
      else load("js/career-shape-rules.js?v=1.1.2-repair", afterRules);
    });
  }

  function promptWorkspaceIsActive() {
    const workspace = document.querySelector('[data-workspace="prompts"]');
    if (workspace && workspace.hidden === false) return true;
    try { return localStorage.getItem(WORKSPACE_KEY) === "prompts"; }
    catch (_) { return false; }
  }

  document.addEventListener("click", event => {
    if (event.target.closest?.('[data-open-workspace="prompts"]')) loadPromptTools();
  }, true);

  const checkInitialWorkspace = () => {
    if (promptWorkspaceIsActive()) loadPromptTools();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(checkInitialWorkspace), { once: true });
  } else {
    requestAnimationFrame(checkInitialWorkspace);
  }

  window.FPL_STUDIO_LOAD_PROMPT_TOOLS = loadPromptTools;
})();
