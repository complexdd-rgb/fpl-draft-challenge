/* FPL Challenge Studio — target-survivor prompt generator v1.0.0
   Repeats the main Auto Prompt Generator until a user-selected number of enabled prompts
   survive the certified 4★+ enforcement pass. The run persists safely across the reload
   performed by the browser-library save step. */
(() => {
  "use strict";

  if (window.__FPL_PROMPT_TARGET_SURVIVOR_GENERATOR_V1__) return;
  window.__FPL_PROMPT_TARGET_SURVIVOR_GENERATOR_V1__ = true;

  const VERSION = "1.0.0";
  const RUN_KEY = "fplPromptTargetSurvivorRunV1";
  const DEFAULT_TARGET = 1200;
  const DEFAULT_MAX_CYCLES = 12;
  const STALL_LIMIT = 3;
  const POLL_MS = 150;
  const GENERATION_TIMEOUT_MS = 30000;
  const HARD_BATCH_MAX = 50;

  let installed = false;
  let busy = false;
  let awaitingReload = false;

  function library() {
    const apiLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(apiLibrary)
      ? apiLibrary
      : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function countEnabledSurvivors() {
    return library().filter(prompt => prompt?.enabled !== false).length;
  }

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(RUN_KEY) || "null");
      return value && value.version === 1 ? value : null;
    } catch (_) { return null; }
  }

  function writeState(state) {
    try { localStorage.setItem(RUN_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function clearState() {
    try { localStorage.removeItem(RUN_KEY); } catch (_) {}
  }

  function clamp(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
  }

  function suggestedTarget(current) {
    if (current < DEFAULT_TARGET) return DEFAULT_TARGET;
    return Math.ceil((current + 1) / 100) * 100;
  }

  function nextBatchSize(gap, retention = 0.72) {
    const safeGap = Math.max(1, Number(gap) || 1);
    const safeRetention = Math.max(0.25, Math.min(0.95, Number(retention) || 0.72));
    return Math.min(HARD_BATCH_MAX, Math.max(1, Math.ceil(safeGap / safeRetention)));
  }

  function fourStarReady() {
    return window.FPL_FOUR_STAR_LIBRARY?.ready === true;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function generatorElements() {
    return {
      panel: el("automaticPromptFactory"),
      count: el("factoryPromptCount"),
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
      enable: el("factoryEnablePrompts"),
      includeQualityFamilies: el("factoryIncludeQualityFamilies"),
      includeNationalityFamily: el("factoryIncludeNationalityFamily"),
      generate: el("generatePromptBatchBtn"),
      add: el("addPromptBatchBtn"),
      preview: el("promptFactoryPreview")
    };
  }

  function captureSettings(elements) {
    return {
      position: elements.position?.value || "balanced",
      difficulty: elements.difficulty?.value || "balanced",
      minimum: elements.minimum?.value || "6",
      maximum: elements.maximum?.value || "100",
      cooldown: elements.cooldown?.value || "10",
      seasonMode: elements.seasonMode?.value || "mix",
      careerMode: elements.careerMode?.value || "mix",
      relationship: elements.relationship?.value || "mix",
      exclusion: elements.exclusion?.value || "mix",
      includeNames: elements.includeNames?.checked !== false,
      avoidPools: elements.avoidPools?.checked !== false,
      includeQualityFamilies: elements.includeQualityFamilies?.checked !== false,
      includeNationalityFamily: elements.includeNationalityFamily?.checked !== false
    };
  }

  function applySettings(elements, settings = {}) {
    if (elements.position && settings.position != null) elements.position.value = settings.position;
    if (elements.difficulty && settings.difficulty != null) elements.difficulty.value = settings.difficulty;
    if (elements.minimum && settings.minimum != null) elements.minimum.value = settings.minimum;
    if (elements.maximum && settings.maximum != null) elements.maximum.value = settings.maximum;
    if (elements.cooldown && settings.cooldown != null) elements.cooldown.value = settings.cooldown;
    if (elements.seasonMode && settings.seasonMode != null) elements.seasonMode.value = settings.seasonMode;
    if (elements.careerMode && settings.careerMode != null) elements.careerMode.value = settings.careerMode;
    if (elements.relationship && settings.relationship != null) elements.relationship.value = settings.relationship;
    if (elements.exclusion && settings.exclusion != null) elements.exclusion.value = settings.exclusion;
    if (elements.includeNames && settings.includeNames != null) elements.includeNames.checked = Boolean(settings.includeNames);
    if (elements.avoidPools && settings.avoidPools != null) elements.avoidPools.checked = Boolean(settings.avoidPools);
    if (elements.includeQualityFamilies && settings.includeQualityFamilies != null) elements.includeQualityFamilies.checked = Boolean(settings.includeQualityFamilies);
    if (elements.includeNationalityFamily && settings.includeNationalityFamily != null) elements.includeNationalityFamily.checked = Boolean(settings.includeNationalityFamily);
    if (elements.enable) elements.enable.checked = true;
  }

  function controlElements() {
    return {
      target: el("factorySurvivorTarget"),
      maxCycles: el("factorySurvivorMaxCycles"),
      start: el("generateToSurvivorTargetBtn"),
      stop: el("stopSurvivorTargetBtn"),
      status: el("promptSurvivorTargetStatus")
    };
  }

  function setControlStatus(message, state = "ready") {
    const status = el("promptSurvivorTargetStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function updateControlButtons() {
    const controls = controlElements();
    const state = readState();
    const running = Boolean(state && ["ready", "generating", "waiting-enforcement"].includes(state.phase));
    if (controls.start) controls.start.disabled = running || busy;
    if (controls.stop) controls.stop.disabled = !running;
  }

  function paintSummary() {
    const current = countEnabledSurvivors();
    const state = readState();
    const controls = controlElements();
    if (controls.target && !state) controls.target.value = suggestedTarget(current);

    if (!state) {
      setControlStatus(`${current.toLocaleString("en-GB")} enabled prompts currently survive the 4★+ library floor. Choose a target above this total.`);
      updateControlButtons();
      return;
    }

    if (state.phase === "complete") {
      setControlStatus(`Target reached: ${current.toLocaleString("en-GB")} enabled 4★+ prompts survive (target ${Number(state.target).toLocaleString("en-GB")}).`, "success");
    } else if (state.phase === "stopped") {
      setControlStatus(state.message || `Stopped safely at ${current.toLocaleString("en-GB")} surviving prompts.`, "fail");
    } else if (state.phase === "waiting-enforcement") {
      setControlStatus(`Cycle ${state.cycle}/${state.maxCycles}: waiting for the 4★+ enforcement pass after adding ${state.pendingAdded || 0} candidates…`, "working");
    } else if (state.phase === "generating") {
      setControlStatus(`Cycle ${state.cycle}/${state.maxCycles}: generating another checked batch toward ${Number(state.target).toLocaleString("en-GB")} surviving prompts…`, "working");
    } else {
      const remaining = Math.max(0, Number(state.target) - current);
      setControlStatus(`Target run ready: ${current.toLocaleString("en-GB")} / ${Number(state.target).toLocaleString("en-GB")} survive · ${remaining.toLocaleString("en-GB")} still needed.`, "working");
    }
    updateControlButtons();
  }

  function stopRun(message) {
    const state = readState();
    if (!state) return;
    state.phase = "stopped";
    state.message = String(message || "Target run stopped.");
    state.finishedAt = new Date().toISOString();
    writeState(state);
    busy = false;
    paintSummary();
  }

  function completeRun(state, current) {
    state.phase = "complete";
    state.finishedAt = new Date().toISOString();
    state.finalCount = current;
    writeState(state);
    busy = false;
    paintSummary();
  }

  function startRun() {
    const elements = generatorElements();
    const controls = controlElements();
    if (!elements.panel || !elements.generate || !elements.add || !elements.preview) return;
    if (!fourStarReady()) {
      setControlStatus("Waiting for the current 4★+ library enforcement to finish before starting the target run…", "working");
      return;
    }

    const current = countEnabledSurvivors();
    const target = clamp(controls.target?.value, current + 1, 5000, suggestedTarget(current));
    const maxCycles = clamp(controls.maxCycles?.value, 1, 40, DEFAULT_MAX_CYCLES);
    if (target <= current) {
      setControlStatus(`The library already has ${current.toLocaleString("en-GB")} surviving prompts. Choose a target above that total.`);
      return;
    }

    const state = {
      version: 1,
      phase: "ready",
      target,
      maxCycles,
      cycle: 0,
      stalled: 0,
      lastCount: current,
      beforeCount: current,
      pendingAdded: 0,
      retention: 0.72,
      attemptedIds: [],
      settings: captureSettings(elements),
      startedAt: new Date().toISOString()
    };
    if (elements.enable) elements.enable.checked = true;
    writeState(state);
    paintSummary();
    void resumeRun();
  }

  function cancelRun() {
    const state = readState();
    if (!state) return;
    state.phase = "stopped";
    state.message = `Stopped by user at ${countEnabledSurvivors().toLocaleString("en-GB")} surviving prompts.`;
    state.finishedAt = new Date().toISOString();
    writeState(state);
    busy = false;
    paintSummary();
  }

  function resetCompletedRun() {
    const state = readState();
    if (!state || !["complete", "stopped"].includes(state.phase)) return;
    clearState();
    paintSummary();
  }

  function waitFor(predicate, timeout = GENERATION_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        try {
          const value = predicate();
          if (value) return resolve(value);
        } catch (_) {}
        if (Date.now() - started >= timeout) return reject(new Error("Timed out waiting for the Auto Prompt Generator."));
        setTimeout(tick, POLL_MS);
      };
      tick();
    });
  }

  function previewSelections(elements) {
    const attempted = new Set((readState()?.attemptedIds || []).map(String));
    const freshIds = [];
    const cards = [...elements.preview.querySelectorAll(".factory-prompt-card")];
    for (const card of cards) {
      const checkbox = card.querySelector("[data-factory-select]");
      if (!checkbox) continue;
      const id = String(card.querySelector(".factory-prompt-main p")?.textContent || "").trim();
      if (!id || attempted.has(id)) {
        checkbox.checked = false;
        continue;
      }
      checkbox.checked = true;
      freshIds.push(id);
    }
    return freshIds;
  }

  async function generateOneCycle(state) {
    const elements = generatorElements();
    if (!elements.generate || !elements.add || !elements.preview || !elements.count) {
      stopRun("Target run stopped because the main Auto Prompt Generator controls are unavailable.");
      return;
    }

    const current = countEnabledSurvivors();
    if (current >= state.target) {
      completeRun(state, current);
      return;
    }
    if (state.cycle >= state.maxCycles) {
      stopRun(`Safety cap reached after ${state.maxCycles} cycles with ${current.toLocaleString("en-GB")} surviving prompts. Increase the cycle cap or change the generator settings to continue.`);
      return;
    }

    applySettings(elements, state.settings);
    const gap = state.target - current;
    const batchSize = nextBatchSize(gap, state.retention);
    elements.count.value = String(batchSize);

    state.cycle += 1;
    state.beforeCount = current;
    state.pendingAdded = 0;
    state.phase = "generating";
    writeState(state);
    paintSummary();

    elements.generate.click();
    try {
      await waitFor(() => !elements.generate.disabled && elements.preview.querySelectorAll("[data-factory-select]").length > 0);
    } catch (error) {
      stopRun(`Target run stopped safely: ${String(error.message || error)}`);
      return;
    }

    const freshIds = previewSelections(elements);
    if (!freshIds.length) {
      state.stalled += 1;
      state.phase = "ready";
      writeState(state);
      if (state.stalled >= STALL_LIMIT) {
        stopRun(`No new untried candidates were available for ${STALL_LIMIT} consecutive cycles. Change the generator mix or answer-range settings before continuing.`);
        return;
      }
      setControlStatus(`Cycle ${state.cycle}/${state.maxCycles} found no new untried candidates. Trying another shuffled batch…`, "working");
      setTimeout(() => { busy = false; void resumeRun(); }, 250);
      return;
    }

    const attempted = new Set((state.attemptedIds || []).map(String));
    for (const id of freshIds) attempted.add(id);
    state.attemptedIds = [...attempted].slice(-5000);
    state.pendingAdded = freshIds.length;
    state.phase = "waiting-enforcement";
    writeState(state);

    // Reuse the normal save path. It persists the selected candidates and reloads Studio;
    // this module resumes after the certified 4★+ enforcer finishes on the new page.
    awaitingReload = true;
    elements.add.disabled = false;
    elements.add.click();
  }

  async function resumeRun() {
    if (awaitingReload || busy) return;
    const state = readState();
    if (!state || ["complete", "stopped"].includes(state.phase)) {
      paintSummary();
      return;
    }
    if (!fourStarReady()) {
      setControlStatus("Waiting for the 4★+ enforcement pass before continuing the target run…", "working");
      updateControlButtons();
      return;
    }

    busy = true;
    try {
      const current = countEnabledSurvivors();
      if (state.phase === "waiting-enforcement") {
        const growth = current - Number(state.beforeCount || 0);
        if (state.pendingAdded > 0 && growth > 0) {
          const observed = Math.max(0.05, Math.min(1, growth / state.pendingAdded));
          state.retention = Math.max(0.25, Math.min(0.95, (Number(state.retention || 0.72) * 0.65) + (observed * 0.35)));
        }
        state.stalled = growth > 0 ? 0 : Number(state.stalled || 0) + 1;
        state.lastCount = current;
        state.pendingAdded = 0;
        state.phase = "ready";
        writeState(state);

        if (current >= state.target) {
          completeRun(state, current);
          return;
        }
        if (state.stalled >= STALL_LIMIT) {
          stopRun(`The 4★+ library did not grow for ${STALL_LIMIT} consecutive cycles and remains at ${current.toLocaleString("en-GB")} prompts. Change the generator settings before continuing.`);
          return;
        }
      } else if (state.phase === "generating") {
        state.phase = "ready";
        writeState(state);
      }

      await generateOneCycle(state);
    } finally {
      if (!awaitingReload && document.visibilityState !== "hidden") busy = false;
      updateControlButtons();
    }
  }

  function install() {
    if (installed) return;
    const elements = generatorElements();
    if (!elements.panel || !elements.generate) return;
    installed = true;

    if (!el("promptSurvivorTargetControl")) {
      const section = document.createElement("section");
      section.id = "promptSurvivorTargetControl";
      section.className = "prompt-survivor-target-control";
      const current = countEnabledSurvivors();
      section.innerHTML = `
        <div class="prompt-survivor-target-copy">
          <small>TARGET AFTER 4★+ ENFORCEMENT</small>
          <strong>Generate until the surviving library reaches a target</strong>
          <p>Repeats the current Auto Prompt Generator settings, saves each checked batch through the normal browser-library path, waits for the 4★+ analyser, then continues until at least the chosen number of enabled prompts survive. It may finish a few prompts above the target.</p>
        </div>
        <div class="prompt-survivor-target-fields">
          <label>Surviving prompt target<input id="factorySurvivorTarget" type="number" min="1" max="5000" step="25" value="${suggestedTarget(current)}"></label>
          <label>Safety cap (cycles)<input id="factorySurvivorMaxCycles" type="number" min="1" max="40" step="1" value="${DEFAULT_MAX_CYCLES}"></label>
        </div>
        <div class="prompt-survivor-target-actions">
          <button id="generateToSurvivorTargetBtn" class="button primary" type="button">Generate until target survives</button>
          <button id="stopSurvivorTargetBtn" class="button secondary" type="button" disabled>Stop target run</button>
        </div>
        <p id="promptSurvivorTargetStatus" class="action-status" role="status"></p>`;
      const actionRow = elements.generate.parentElement;
      if (actionRow?.parentElement === elements.panel) elements.panel.insertBefore(section, actionRow);
      else elements.panel.appendChild(section);

      const style = document.createElement("style");
      style.id = "promptSurvivorTargetStyles";
      style.textContent = `.prompt-survivor-target-control{margin:14px 0;padding:13px;border:1px solid rgba(99,234,161,.22);border-radius:14px;background:rgba(99,234,161,.045)}.prompt-survivor-target-copy{display:grid;gap:3px}.prompt-survivor-target-copy small{color:#63eaa1;font-size:.62rem;font-weight:950;letter-spacing:.08em}.prompt-survivor-target-copy strong{color:#f4fff8;font-size:.9rem}.prompt-survivor-target-copy p{margin:4px 0 0;color:#9bb7a8;font-size:.7rem;line-height:1.45}.prompt-survivor-target-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.7fr);gap:9px;margin-top:11px}.prompt-survivor-target-fields label{display:grid;gap:5px;color:#a8c8b6;font-size:.68rem;font-weight:800}.prompt-survivor-target-fields input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid rgba(174,226,199,.15);border-radius:9px;background:#07170f;color:#f4fff8}.prompt-survivor-target-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}#promptSurvivorTargetStatus{margin:9px 0 0}#promptSurvivorTargetStatus[data-state="working"]{color:#a9c8d8}#promptSurvivorTargetStatus[data-state="success"]{color:#63eaa1}#promptSurvivorTargetStatus[data-state="fail"]{color:#f0a9b0}@media(max-width:600px){.prompt-survivor-target-fields{grid-template-columns:1fr}.prompt-survivor-target-actions{display:grid;grid-template-columns:1fr}}`;
      document.head.appendChild(style);
    }

    const controls = controlElements();
    controls.start?.addEventListener("click", () => {
      const previous = readState();
      if (previous && ["complete", "stopped"].includes(previous.phase)) clearState();
      startRun();
    });
    controls.stop?.addEventListener("click", cancelRun);
    controls.target?.addEventListener("change", () => {
      const state = readState();
      if (state && ["complete", "stopped"].includes(state.phase)) resetCompletedRun();
    });

    paintSummary();
    void resumeRun();
  }

  function retryInstall() {
    install();
    if (!installed) setTimeout(retryInstall, 150);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retryInstall, { once: true });
  else retryInstall();
  window.addEventListener("fpl:prompt-tools-ready", retryInstall);
  window.addEventListener("fpl:four-star-library-ready", () => {
    paintSummary();
    void resumeRun();
  });
  window.addEventListener("fpl:prompt-library-changed", paintSummary);

  window.FPL_PROMPT_TARGET_SURVIVOR_GENERATOR = Object.freeze({
    version: VERSION,
    countEnabledSurvivors,
    nextBatchSize,
    readState,
    start: startRun,
    stop: cancelRun
  });
})();
