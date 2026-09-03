/* FPL Challenge Studio — prompt target auto explorer v1.0.0
   Keeps the 4★+ survivor target moving by switching between safe generator mixes when
   the user's original recipe stops producing new certified prompts. It never widens
   the 6–100-style answer range chosen by the user and keeps near-pool rejection on for
   fallback exploration profiles. */
(() => {
  "use strict";

  if (window.__FPL_PROMPT_TARGET_AUTO_EXPLORER_V1__) return;
  window.__FPL_PROMPT_TARGET_AUTO_EXPLORER_V1__ = true;

  const VERSION = "1.0.0";
  const EXPLORE_KEY = "fplPromptTargetAutoExploreV1";
  const MAX_CYCLES = 40;
  const HARD_BATCH_MAX = 50;
  const DEFAULT_RETENTION = 0.72;
  const POLL_MS = 350;

  let installed = false;
  let handling = false;

  const el = id => document.getElementById(id);

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch (_) { return null; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function api() {
    return window.FPL_PROMPT_TARGET_SURVIVOR_GENERATOR || null;
  }

  function survivorCount() {
    const value = Number(api()?.countEnabledSurvivors?.());
    return Number.isFinite(value) ? value : 0;
  }

  function controls() {
    return {
      target: el("factorySurvivorTarget"),
      maxCycles: el("factorySurvivorMaxCycles"),
      start: el("generateToSurvivorTargetBtn"),
      stop: el("stopSurvivorTargetBtn"),
      status: el("promptSurvivorTargetStatus"),
      position: el("factoryPositionMix"),
      difficulty: el("factoryDifficultyMix"),
      minimum: el("factoryMinPlayers"),
      maximum: el("factoryMaxPlayers"),
      cooldown: el("factoryCooldown"),
      seasonMode: el("factorySeasonMode"),
      careerMode: el("factoryCareerMode"),
      relationship: el("factoryRelationshipMode"),
      exclusion: el("factoryExclusionMode"),
      includeNames: el("factoryIncludeNameRules"),
      avoidPools: el("factoryAvoidSimilarPools"),
      includeQualityFamilies: el("factoryIncludeQualityFamilies"),
      includeNationalityFamily: el("factoryIncludeNationalityFamily")
    };
  }

  function captureSettings(c = controls()) {
    return {
      position: c.position?.value || "balanced",
      difficulty: c.difficulty?.value || "balanced",
      minimum: c.minimum?.value || "6",
      maximum: c.maximum?.value || "100",
      cooldown: c.cooldown?.value || "10",
      seasonMode: c.seasonMode?.value || "mix",
      careerMode: c.careerMode?.value || "mix",
      relationship: c.relationship?.value || "mix",
      exclusion: c.exclusion?.value || "mix",
      includeNames: c.includeNames?.checked !== false,
      avoidPools: c.avoidPools?.checked !== false,
      includeQualityFamilies: c.includeQualityFamilies?.checked !== false,
      includeNationalityFamily: c.includeNationalityFamily?.checked !== false
    };
  }

  function applySettings(settings, c = controls()) {
    if (c.position && settings.position != null) c.position.value = settings.position;
    if (c.difficulty && settings.difficulty != null) c.difficulty.value = settings.difficulty;
    if (c.minimum && settings.minimum != null) c.minimum.value = settings.minimum;
    if (c.maximum && settings.maximum != null) c.maximum.value = settings.maximum;
    if (c.cooldown && settings.cooldown != null) c.cooldown.value = settings.cooldown;
    if (c.seasonMode && settings.seasonMode != null) c.seasonMode.value = settings.seasonMode;
    if (c.careerMode && settings.careerMode != null) c.careerMode.value = settings.careerMode;
    if (c.relationship && settings.relationship != null) c.relationship.value = settings.relationship;
    if (c.exclusion && settings.exclusion != null) c.exclusion.value = settings.exclusion;
    if (c.includeNames && settings.includeNames != null) c.includeNames.checked = Boolean(settings.includeNames);
    if (c.avoidPools) c.avoidPools.checked = true;
    if (c.includeQualityFamilies && settings.includeQualityFamilies != null) c.includeQualityFamilies.checked = Boolean(settings.includeQualityFamilies);
    if (c.includeNationalityFamily && settings.includeNationalityFamily != null) c.includeNationalityFamily.checked = Boolean(settings.includeNationalityFamily);
  }

  function recommendedCycleCap(target, current, retention = DEFAULT_RETENTION) {
    const gap = Math.max(0, Number(target) - Number(current));
    if (!gap) return 1;
    const safeRetention = Math.max(0.25, Math.min(1, Number(retention) || DEFAULT_RETENTION));
    const theoretical = Math.ceil(gap / HARD_BATCH_MAX);
    const recommended = Math.ceil(gap / (HARD_BATCH_MAX * safeRetention));
    return Math.min(MAX_CYCLES, Math.max(1, theoretical, recommended));
  }

  function ensureCycleBudget(target, current) {
    const c = controls();
    const selected = Math.max(1, Math.min(MAX_CYCLES, Math.round(Number(c.maxCycles?.value) || 12)));
    const recommended = recommendedCycleCap(target, current);
    const next = Math.min(MAX_CYCLES, Math.max(selected, recommended));
    if (c.maxCycles) c.maxCycles.value = String(next);
    return { selected, recommended, next, raised: next > selected };
  }

  function profileSignature(settings) {
    return JSON.stringify([
      settings.position, settings.difficulty, settings.seasonMode, settings.careerMode,
      settings.relationship, settings.exclusion, Boolean(settings.includeNames),
      Boolean(settings.avoidPools), Boolean(settings.includeQualityFamilies),
      Boolean(settings.includeNationalityFamily), settings.minimum, settings.maximum
    ]);
  }

  function buildProfiles(baseSettings) {
    const base = { ...baseSettings };
    const safe = { ...base, avoidPools: true };
    const candidates = [
      ["No relationship rules", { ...safe, relationship: "none" }],
      ["Easy · no relationships", { ...safe, relationship: "none", difficulty: "easy" }],
      ["Medium · no relationships", { ...safe, relationship: "none", difficulty: "medium" }],
      ["Hard · no relationships", { ...safe, relationship: "none", difficulty: "hard" }],
      ["Season rules only", { ...safe, seasonMode: "only", careerMode: "none", relationship: "none" }],
      ["Career totals only", { ...safe, seasonMode: "none", careerMode: "only", relationship: "none" }],
      ["Exclude the top answer", { ...safe, relationship: "none", exclusion: "top1" }],
      ["Exclude the top two answers", { ...safe, relationship: "none", exclusion: "top2" }],
      ["Core + curated families", { ...safe, seasonMode: "none", careerMode: "none", relationship: "none", includeNames: false }],
      ["Goalkeeper gap pass", { ...safe, position: "GK", difficulty: "balanced", relationship: "none" }],
      ["Defender gap pass", { ...safe, position: "DEF", difficulty: "balanced", relationship: "none" }],
      ["Midfielder gap pass", { ...safe, position: "MID", difficulty: "balanced", relationship: "none" }],
      ["Forward gap pass", { ...safe, position: "FWD", difficulty: "balanced", relationship: "none" }]
    ];

    const seen = new Set([profileSignature(base)]);
    const profiles = [];
    for (const [label, settings] of candidates) {
      const signature = profileSignature(settings);
      if (seen.has(signature)) continue;
      seen.add(signature);
      profiles.push({ label, settings });
    }
    return profiles;
  }

  function explorerState() {
    const value = readJson(EXPLORE_KEY);
    return value && value.version === 1 ? value : null;
  }

  function saveExplorer(state) {
    writeJson(EXPLORE_KEY, state);
  }

  function ensureExplorerStatus() {
    const main = el("promptSurvivorTargetStatus");
    if (!main) return null;
    let node = el("promptTargetAutoExploreStatus");
    if (!node) {
      node = document.createElement("p");
      node.id = "promptTargetAutoExploreStatus";
      node.className = "action-status";
      node.style.marginTop = "4px";
      node.style.color = "#9bb7a8";
      main.insertAdjacentElement("afterend", node);
    }
    return node;
  }

  function paintExplorer() {
    const node = ensureExplorerStatus();
    if (!node) return;
    const state = explorerState();
    if (!state) {
      node.textContent = "Auto-explore is ready: if the selected mix stalls, Studio will try other quality-safe mixes before giving up.";
      return;
    }
    if (state.finalMessage) {
      node.textContent = state.finalMessage;
      node.style.color = state.completed ? "#63eaa1" : "#f0b6a4";
      return;
    }
    if (!state.active) {
      node.textContent = "Auto-explore is paused.";
      return;
    }
    if (Number(state.profileIndex) >= 0) {
      node.textContent = `Auto-explore strategy ${Number(state.profileIndex) + 1}: ${state.profileLabel}. Quality floor and near-pool rejection stay enforced.`;
    } else if (state.capRaised) {
      node.textContent = `Auto-explore armed. The cycle cap was raised from ${state.originalCap} to ${state.effectiveCap} so target ${Number(state.target).toLocaleString("en-GB")} is mathematically reachable at the current batch limit.`;
    } else {
      node.textContent = "Auto-explore armed: using your selected generator mix first, then safe alternatives only if growth stalls.";
    }
  }

  function beginExplorer() {
    const c = controls();
    const current = survivorCount();
    const target = Math.max(current + 1, Math.round(Number(c.target?.value) || current + 1));
    const budget = ensureCycleBudget(target, current);
    const state = {
      version: 1,
      active: true,
      completed: false,
      target,
      baseSettings: captureSettings(c),
      profileIndex: -1,
      profileLabel: "Selected generator mix",
      profileSwitches: 0,
      lastHandledStop: "",
      originalCap: budget.selected,
      effectiveCap: budget.next,
      capRaised: budget.raised,
      startedAt: new Date().toISOString(),
      finalMessage: ""
    };
    saveExplorer(state);
    paintExplorer();
  }

  function finishExplorer(message, completed = false) {
    const state = explorerState();
    if (!state) return;
    state.active = false;
    state.completed = Boolean(completed);
    state.finalMessage = String(message || "");
    state.finishedAt = new Date().toISOString();
    saveExplorer(state);
    paintExplorer();
  }

  function advanceProfile(state) {
    const profiles = buildProfiles(state.baseSettings || captureSettings());
    const nextIndex = Number(state.profileIndex ?? -1) + 1;
    const current = survivorCount();
    if (nextIndex >= profiles.length) {
      finishExplorer(`Safe generator exploration is exhausted at ${current.toLocaleString("en-GB")} surviving prompts. The current prompt families have reached their useful ceiling under the 4★+ rules; add new prompt families before pushing the target higher.`, false);
      const status = el("promptSurvivorTargetStatus");
      if (status) status.textContent = `Target paused at ${current.toLocaleString("en-GB")}: all ${profiles.length} safe fallback mixes were exhausted without reaching ${Number(state.target).toLocaleString("en-GB")}.`;
      return;
    }

    const profile = profiles[nextIndex];
    const c = controls();
    applySettings(profile.settings, c);
    if (c.target) c.target.value = String(state.target);
    const budget = ensureCycleBudget(state.target, current);

    state.profileIndex = nextIndex;
    state.profileLabel = profile.label;
    state.profileSwitches = Number(state.profileSwitches || 0) + 1;
    state.lastHandledStop = "";
    state.effectiveCap = budget.next;
    state.capRaised = state.capRaised || budget.raised;
    saveExplorer(state);
    paintExplorer();

    const targetApi = api();
    if (!targetApi?.start) {
      finishExplorer("Auto-explore stopped because the target-survivor controller is unavailable.", false);
      return;
    }
    window.setTimeout(() => targetApi.start(), 180);
  }

  function monitor() {
    if (handling) return;
    const state = explorerState();
    if (!state?.active) {
      paintExplorer();
      return;
    }

    const targetApi = api();
    if (!targetApi?.readState) return;
    const current = survivorCount();
    if (current >= Number(state.target)) {
      finishExplorer(`Target reached: ${current.toLocaleString("en-GB")} enabled prompts survive the 4★+ floor.`, true);
      return;
    }

    const run = targetApi.readState();
    if (!run) return;
    if (run.phase === "complete") {
      finishExplorer(`Target reached: ${current.toLocaleString("en-GB")} enabled prompts survive the 4★+ floor.`, true);
      return;
    }
    if (run.phase !== "stopped") return;

    const message = String(run.message || "");
    const fingerprint = `${run.finishedAt || ""}|${message}`;
    if (state.lastHandledStop === fingerprint) return;
    state.lastHandledStop = fingerprint;
    saveExplorer(state);

    if (/stopped by user/i.test(message)) {
      finishExplorer("Auto-explore stopped by user.", false);
      return;
    }

    const safeToExplore = /did not grow|no new untried candidates|safety cap reached/i.test(message);
    if (!safeToExplore) {
      finishExplorer(`Auto-explore paused because the target run hit a technical stop: ${message || "unknown error"}`, false);
      return;
    }

    handling = true;
    try { advanceProfile(state); }
    finally { window.setTimeout(() => { handling = false; }, 300); }
  }

  function install() {
    if (installed) return;
    const c = controls();
    if (!c.start || !c.stop || !c.target || !api()) return;
    installed = true;

    // Capture phase runs before the target controller's normal click handler, so an
    // impossible 12-cycle/large-target combination is corrected before startRun reads it.
    c.start.addEventListener("click", beginExplorer, true);
    c.stop.addEventListener("click", () => finishExplorer("Auto-explore stopped by user.", false), true);
    c.target.addEventListener("change", () => {
      const state = explorerState();
      if (state?.active) finishExplorer("Auto-explore paused because the survivor target was changed.", false);
    });

    paintExplorer();
    monitor();
    window.setInterval(monitor, POLL_MS);
    window.addEventListener("fpl:four-star-library-ready", monitor);
    window.addEventListener("fpl:prompt-library-changed", monitor);
  }

  function retryInstall() {
    install();
    if (!installed) window.setTimeout(retryInstall, 150);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retryInstall, { once: true });
  else retryInstall();
  window.addEventListener("fpl:prompt-tools-ready", retryInstall);

  window.FPL_PROMPT_TARGET_AUTO_EXPLORER = Object.freeze({
    version: VERSION,
    recommendedCycleCap,
    buildProfiles,
    captureSettings,
    explorerState,
    monitor
  });
})();