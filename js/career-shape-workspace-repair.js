/* FPL Career Shape workspace repair · v1.0.0
   Repairs only stale auto-generated Career Shape browser prompts after the restored
   Career Shape runtime has loaded. It does not clear the Studio workspace. */
(() => {
  "use strict";

  const STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const SESSION_KEY = "fplCareerShapeWorkspaceRepairV1";
  const MESSAGE_KEY = "fplCareerShapeWorkspaceRepairMessage";

  function players() {
    return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") {
        return {
          version: 1,
          overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
          customs: Array.isArray(parsed.customs) ? parsed.customs : [],
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
        };
      }
    } catch (_) {}
    return null;
  }

  function compile(prompt) {
    const source = String(prompt?.studioRule?.source || prompt?.testSource || "").trim();
    if (!source) return null;
    try { return Function(`"use strict"; return (${source});`)(); }
    catch (_) { return null; }
  }

  function validPlayerCount(prompt, test) {
    const ids = new Set();
    for (const player of players()) {
      for (const record of player.seasons || []) {
        if (Number(record.minutes) <= 0 || record.position !== prompt.position) continue;
        let passed = false;
        try { passed = Boolean(test(record)); } catch (_) {}
        if (passed) { ids.add(player.playerId); break; }
      }
    }
    return ids.size;
  }

  function cleanCalibrationTags(tags) {
    return (Array.isArray(tags) ? tags : []).filter(tag => {
      const value = String(tag || "");
      return value !== "career-shape-calibrated" && !value.startsWith("quality-");
    });
  }

  function repairStoredCustoms() {
    const state = loadState();
    if (!state) return { changed: false, removed: 0, cleaned: 0 };

    let removed = 0;
    let cleaned = 0;
    const next = [];

    for (const prompt of state.customs) {
      const id = String(prompt?.id || "");
      if (!id.startsWith("career_shape_auto_")) {
        next.push(prompt);
        continue;
      }

      const test = compile(prompt);
      const count = test ? validPlayerCount(prompt, test) : 0;
      if (!test || count === 0) {
        removed += 1;
        continue;
      }

      const tags = cleanCalibrationTags(prompt.tags);
      if (tags.length !== (Array.isArray(prompt.tags) ? prompt.tags.length : 0)) {
        prompt.tags = tags;
        cleaned += 1;
      }
      next.push(prompt);
    }

    const changed = removed > 0 || cleaned > 0;
    if (changed) {
      state.customs = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    return { changed, removed, cleaned };
  }

  function restoreRuntimePrompts() {
    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;
    const augment = window.FPL_CAREER_SHAPE_RULES?.augmentLibrary;
    if (!library || typeof augment !== "function") return 0;
    const before = library.length;
    augment(library);
    return Math.max(0, library.length - before);
  }

  function showMessage() {
    const message = sessionStorage.getItem(MESSAGE_KEY);
    if (!message) return;
    sessionStorage.removeItem(MESSAGE_KEY);
    const write = () => {
      const status = document.getElementById("promptFactoryStatus");
      if (status) status.textContent = message;
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", write, { once: true });
    else write();
  }

  function run() {
    const restored = restoreRuntimePrompts();
    const repaired = repairStoredCustoms();
    const alreadyReloaded = sessionStorage.getItem(SESSION_KEY) === "1";

    if ((restored > 0 || repaired.changed) && !alreadyReloaded) {
      sessionStorage.setItem(SESSION_KEY, "1");
      const parts = [];
      if (restored) parts.push(`${restored} Career Shape runtime prompt${restored === 1 ? "" : "s"} restored`);
      if (repaired.removed) parts.push(`${repaired.removed} broken auto-generated prompt${repaired.removed === 1 ? "" : "s"} removed`);
      if (repaired.cleaned) parts.push(`${repaired.cleaned} stale calibration tag set${repaired.cleaned === 1 ? "" : "s"} cleaned`);
      sessionStorage.setItem(MESSAGE_KEY, `${parts.join(" · ")}. Prompt Studio has been repaired safely.`);
      window.setTimeout(() => window.location.reload(), 120);
      return;
    }

    showMessage();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
})();
