/* FPL Draft Challenge — Prompt Quality Analyser mount owner v1.0.0.
   Keeps one analyser mount attached below Prompt Factory when Prompt Studio redraws. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_QUALITY_ANALYSER_MOUNT_V1?.ready) return;
  let observer = null;
  let queued = false;

  function ensureMount() {
    const root = document.getElementById("promptStudioCleanRoot");
    if (!root) return false;
    let mount = document.getElementById("promptQualityMount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "promptQualityMount";
      mount.dataset.promptQualityMount = "v1";
      const factoryMount = document.getElementById("promptFactoryMount");
      const roadmap = root.querySelector(".prompt-clean-roadmap");
      if (factoryMount?.parentNode === root) factoryMount.insertAdjacentElement("afterend", mount);
      else if (roadmap) root.insertBefore(mount, roadmap);
      else root.appendChild(mount);
    }
    window.FPL_PROMPT_QUALITY_ANALYSER_V1?.render?.();
    return true;
  }

  function queueEnsure() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      ensureMount();
    });
  }

  function observe() {
    const workspace = document.getElementById("workspace-prompts") || document.querySelector('[data-workspace="prompts"]');
    if (!workspace || observer) return;
    observer = new MutationObserver(() => {
      if (!document.getElementById("promptQualityMount")) queueEnsure();
    });
    observer.observe(workspace, { childList: true, subtree: true });
  }

  function install() {
    ensureMount();
    observe();
    requestAnimationFrame(ensureMount);
    setTimeout(ensureMount, 160);
    window.addEventListener("fpl:prompt-studio-clean-ready", queueEnsure);
    window.addEventListener("fpl:prompt-factory-ready", queueEnsure);
  }

  window.FPL_PROMPT_QUALITY_ANALYSER_MOUNT_V1 = Object.freeze({ ready: true, version: "1.0.0", ensureMount });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
