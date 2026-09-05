/* FPL Challenge Studio — single runtime bootstrap owner v2.0.0.
   Prompt Studio has been reset. This bootstrap intentionally loads one clean Prompt Studio
   controller and no legacy prompt packs, V2/V3/V4 workspaces, refinement loaders or fallbacks. */
(() => {
  "use strict";

  if (window.__FPL_STUDIO_BOOTSTRAP_V2__) {
    window.FPL_STUDIO_BOOTSTRAP?.start?.();
    return;
  }
  window.__FPL_STUDIO_BOOTSTRAP_V2__ = true;

  const manifest = window.FPL_ASSET_MANIFEST;
  const runtimeIsStudio = () => Boolean(window.FPL_IS_STUDIO || document.querySelector("main.studio-shell"));
  const url = (key, fallback) => manifest?.url?.(key) || fallback;
  let started = false;
  let promptStudioStarted = false;
  let publishingStarted = false;

  function findExisting(src, marker) {
    if (marker) {
      const marked = document.querySelector(`script[${marker}]`);
      if (marked) return marked;
    }
    const base = String(src || "").split("?")[0];
    if (!base) return null;
    return [...document.scripts].find(script => script.src && script.src.includes(base)) || null;
  }

  function loadScript(src, marker, { async = false } = {}, done = null) {
    const existing = findExisting(src, marker);
    if (existing) {
      if (done) {
        if (existing.dataset.loaded === "true") queueMicrotask(done);
        else existing.addEventListener("load", done, { once: true });
      }
      return existing;
    }

    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = async;
    if (marker) script.setAttribute(marker, "1");
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      done?.();
    }, { once: true });
    script.addEventListener("error", () => {
      console.error(`Studio bootstrap could not load ${src}.`);
      window.dispatchEvent(new CustomEvent("fpl:studio-bootstrap-load-error", { detail: { src } }));
    }, { once: true });
    document.head.appendChild(script);
    return script;
  }

  function loadAsset(key, marker, options, done) {
    const entry = manifest?.get?.(key);
    const fallback = entry?.path || key;
    return loadScript(url(key, fallback), marker, options, done);
  }

  function ensurePromptStudio() {
    if (promptStudioStarted) return;
    promptStudioStarted = true;
    loadAsset(
      "promptStudioClean",
      "data-prompt-studio-clean",
      { async: false }
    );
  }

  function ensurePublishing() {
    if (publishingStarted) return;
    const config = window.FPL_LEADERBOARD_CONFIG;
    if (!config?.dailyPublishing?.enabled || !document.getElementById("downloadWeekBtn")) return;
    publishingStarted = true;
    loadAsset("adminDailyPublish", "data-admin-daily-publish", { async: true });
  }

  function start() {
    if (!runtimeIsStudio()) return;
    if (started) {
      ensurePromptStudio();
      ensurePublishing();
      return;
    }

    started = true;
    document.documentElement.dataset.studioBootstrap = "loading";
    document.documentElement.dataset.promptStudioArchitecture = "clean-v1";

    ensurePromptStudio();
    ensurePublishing();

    window.addEventListener("fpl:leaderboard-config-ready", ensurePublishing);
    document.documentElement.dataset.studioBootstrap = "ready";
    window.dispatchEvent(new CustomEvent("fpl:studio-bootstrap-ready", {
      detail: { version: "2.0.0", promptStudio: "clean-v1" }
    }));
  }

  window.FPL_STUDIO_BOOTSTRAP = Object.freeze({
    version: "2.0.0",
    start,
    loadScript,
    loadAsset,
    ensurePromptStudio,
    ensurePublishing
  });

  start();
})();
