/* FPL Challenge Studio — single runtime bootstrap owner v1.5.0.
   Owns Studio-only feature loading. Specialist modules remain separate, but no longer
   discover and start overlapping loader chains independently. */
(() => {
  "use strict";

  if (window.__FPL_STUDIO_BOOTSTRAP_V1__) {
    window.FPL_STUDIO_BOOTSTRAP?.start?.();
    return;
  }
  window.__FPL_STUDIO_BOOTSTRAP_V1__ = true;

  const manifest = window.FPL_ASSET_MANIFEST;
  const runtimeIsStudio = () => Boolean(window.FPL_IS_STUDIO || document.querySelector("main.studio-shell"));
  const url = (key, fallback) => manifest?.url?.(key) || fallback;
  let started = false;
  let certificationStarted = false;
  let promptLoaderStarted = false;
  let promptRedesignStarted = false;
  let promptV3Started = false;
  let refinementStarted = false;
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

  function ensurePromptRedesign() {
    if (promptRedesignStarted) return;
    promptRedesignStarted = true;
    loadAsset("promptStudioRedesign", "data-prompt-studio-redesign", { async: false });
  }

  function ensurePromptV3() {
    if (promptV3Started) return;
    promptV3Started = true;
    loadAsset("promptFamilyRegistryV3", "data-prompt-family-registry-v3", { async: false }, () => {
      loadAsset("promptStudioV3", "data-prompt-studio-v3", { async: false }, () => {
        loadAsset("promptStudioV3RuleTester", "data-prompt-studio-v3-rule-tester", { async: false }, () => {
          loadAsset("promptStudioV3QualityAdvisor", "data-prompt-studio-v3-quality-advisor", { async: false }, () => {
            loadAsset("promptStudioV3CandidateGenerator", "data-prompt-studio-v3-candidate-generator", { async: false });
          });
        });
      });
    });
  }

  function ensurePromptLoader() {
    if (promptLoaderStarted) return;
    promptLoaderStarted = true;
    loadAsset("promptStudioLoader", "data-prompt-studio-loader", { async: false });
  }

  function ensureCertificationLayer() {
    if (certificationStarted) return;
    certificationStarted = true;

    loadAsset("promptLibraryLegacyAdditions", "data-prompt-library-legacy-additions", { async: false }, () => {
      loadAsset("careerShapeValidationBridge", "data-career-shape-validation-bridge", { async: false }, () => {
        loadAsset("promptEraRangeWording", "data-prompt-era-range-wording", { async: false }, () => {
          loadAsset("adminStudioFinish", "data-admin-studio-finish", { async: true });
          loadAsset("careerOverlapWording", "data-career-overlap-wording", { async: true });
        });
      });
    });
  }

  function ensureRefinementIncubator() {
    if (refinementStarted) return;
    refinementStarted = true;
    // Legacy production quality/refinement remains isolated from the clean-room V3 library.
    // V3 never consumes automatic rescue, rating, deletion or promotion decisions.
    loadAsset("promptRefinementIncubator", "data-prompt-refinement-incubator", { async: false });
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
      ensurePromptRedesign();
      ensurePromptV3();
      ensurePublishing();
      return;
    }
    started = true;
    document.documentElement.dataset.studioBootstrap = "loading";

    ensurePromptRedesign();
    ensurePromptV3();
    ensurePromptLoader();
    ensureCertificationLayer();
    ensureRefinementIncubator();
    ensurePublishing();

    window.addEventListener("fpl:leaderboard-config-ready", ensurePublishing);
    document.documentElement.dataset.studioBootstrap = "ready";
    window.dispatchEvent(new CustomEvent("fpl:studio-bootstrap-ready"));
  }

  window.FPL_STUDIO_BOOTSTRAP = Object.freeze({
    version: "1.5.0",
    start,
    loadScript,
    loadAsset,
    ensurePromptRedesign,
    ensurePromptV3,
    ensurePromptLoader,
    ensureCertificationLayer,
    ensureRefinementIncubator,
    ensurePublishing
  });

  start();
})();
