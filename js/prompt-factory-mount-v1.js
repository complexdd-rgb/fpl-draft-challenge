/* FPL Draft Challenge — Prompt Factory mount owner v1.0.0.
   Keeps one clean Factory mount attached when the native Prompt Studio workspace redraws. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_FACTORY_MOUNT_V1?.ready) return;
  let observer = null;
  let queued = false;

  function ensureMount() {
    const root = document.getElementById("promptStudioCleanRoot");
    if (!root) return false;
    let mount = document.getElementById("promptFactoryMount");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "promptFactoryMount";
      mount.dataset.promptFactoryMount = "v1";
      const roadmap = root.querySelector(".prompt-clean-roadmap");
      if (roadmap) root.insertBefore(mount, roadmap);
      else root.appendChild(mount);
    }
    window.FPL_PROMPT_FACTORY_V1?.render?.();
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
      if (!document.getElementById("promptFactoryMount")) queueEnsure();
    });
    observer.observe(workspace, { childList: true, subtree: true });
  }

  function install() {
    ensureMount();
    observe();
    requestAnimationFrame(ensureMount);
    setTimeout(ensureMount, 140);
    window.addEventListener("fpl:prompt-studio-clean-ready", queueEnsure);
  }

  window.FPL_PROMPT_FACTORY_MOUNT_V1 = Object.freeze({ ready: true, version: "1.0.0", ensureMount });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
