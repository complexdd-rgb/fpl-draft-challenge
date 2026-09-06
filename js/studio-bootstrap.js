/* FPL Challenge Studio — single runtime bootstrap owner v2.6.0.
   Prompt Studio uses one clean controller, Prompt Factory, Quality Analyser, Promotion layer,
   durable family-shard storage, Daily cutover, publishing and the centrally owned schedule manager.
   No legacy Prompt Studio fallback chain is loaded. */
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
  let promptFactoryStarted = false;
  let qualityAnalyserStarted = false;
  let promotionStarted = false;
  let libraryShardsStarted = false;
  let dailyCutoverStarted = false;
  let publishingStarted = false;
  let scheduleManagerStarted = false;

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

  function ensureDailyCutover() {
    if (dailyCutoverStarted) return;
    dailyCutoverStarted = true;
    loadAsset("adminDailyLibraryCutoverV1", "data-admin-daily-library-cutover-v1", { async: false });
  }

  function ensureLibraryShards() {
    if (libraryShardsStarted) {
      ensureDailyCutover();
      return;
    }
    libraryShardsStarted = true;
    loadAsset("promptLibraryShardsV1", "data-prompt-library-shards-v1", { async: false }, () => {
      loadAsset("promptLibraryShardsBridgeV1", "data-prompt-library-shards-bridge-v1", { async: false }, ensureDailyCutover);
    });
  }

  function ensurePromotion() {
    if (promotionStarted) {
      ensureLibraryShards();
      return;
    }
    promotionStarted = true;
    loadAsset("promptPromotionV1", "data-prompt-promotion-v1", { async: false }, ensureLibraryShards);
  }

  function ensureQualityAnalyser() {
    if (qualityAnalyserStarted) {
      ensurePromotion();
      return;
    }
    qualityAnalyserStarted = true;
    loadAsset("promptQualityAnalyserMountV1", "data-prompt-quality-mount-v1", { async: false }, () => {
      loadAsset("promptQualityAnalyserV1", "data-prompt-quality-analyser-v1", { async: false }, ensurePromotion);
    });
  }

  function ensurePromptFactory() {
    if (promptFactoryStarted) {
      ensureQualityAnalyser();
      return;
    }
    promptFactoryStarted = true;
    loadAsset("promptFactoryMountV1", "data-prompt-factory-mount-v1", { async: false }, () => {
      loadAsset("promptFactoryV1", "data-prompt-factory-v1", { async: false }, ensureQualityAnalyser);
    });
  }

  function ensurePromptStudio() {
    if (promptStudioStarted) {
      ensurePromptFactory();
      return;
    }
    promptStudioStarted = true;
    loadAsset(
      "promptStudioClean",
      "data-prompt-studio-clean",
      { async: false },
      ensurePromptFactory
    );
  }

  function ensureScheduleManager() {
    if (scheduleManagerStarted) {
      window.FPL_STUDIO_SCHEDULE_MANAGER?.render?.(window.FPL_STUDIO_SCHEDULE);
      return;
    }
    const config = window.FPL_LEADERBOARD_CONFIG;
    if (!config?.dailyPublishing?.enabled || !document.getElementById("batchPlanner")) return;
    scheduleManagerStarted = true;
    loadAsset("adminScheduleManagerV2", "data-admin-schedule-manager-v2", { async: true });
  }

  function ensurePublishing() {
    if (publishingStarted) {
      ensureScheduleManager();
      return;
    }
    const config = window.FPL_LEADERBOARD_CONFIG;
    if (!config?.dailyPublishing?.enabled || !document.getElementById("downloadWeekBtn")) return;
    publishingStarted = true;
    loadAsset("adminDailyPublish", "data-admin-daily-publish", { async: true }, ensureScheduleManager);
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
    document.documentElement.dataset.promptStudioArchitecture = "clean-v1-factory-quality-promotion-shards-daily-cutover-schedule-v2";

    ensurePromptStudio();
    ensurePublishing();

    window.addEventListener("fpl:leaderboard-config-ready", ensurePublishing);
    document.documentElement.dataset.studioBootstrap = "ready";
    window.dispatchEvent(new CustomEvent("fpl:studio-bootstrap-ready", {
      detail: {
        version: "2.6.0",
        promptStudio: "clean-v1",
        promptFactory: "v1",
        qualityAnalyser: "v1",
        promotion: "v1",
        libraryShards: "v1",
        dailyLibraryCutover: "v1",
        scheduleManager: "v2"
      }
    }));
  }

  window.FPL_STUDIO_BOOTSTRAP = Object.freeze({
    version: "2.6.0",
    start,
    loadScript,
    loadAsset,
    ensurePromptStudio,
    ensurePromptFactory,
    ensureQualityAnalyser,
    ensurePromotion,
    ensureLibraryShards,
    ensureDailyCutover,
    ensurePublishing,
    ensureScheduleManager
  });

  start();
})();
