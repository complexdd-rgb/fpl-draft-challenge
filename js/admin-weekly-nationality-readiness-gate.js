/* FPL Challenge Studio — block seven-day generation until nationality context prompts are installed. */
(() => {
  "use strict";

  const VERSION = "1.0.2";
  const POLL_MS = 100;
  const MAX_ATTEMPTS = 120;
  const MIN_READY_PROMPTS = 4;
  const REQUIRED_POSITIONS = ["DEF", "MID", "FWD"];
  const button = document.querySelector("#generateWeekBtn");
  const status = document.querySelector("#batchStatus");
  if (!button) return;

  let attempts = 0;
  let timer = null;
  let unlocked = false;

  const packReady = () => {
    const pack = window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1;
    const positions = Array.isArray(pack?.positions) ? pack.positions : [];
    return pack?.ready === true
      && Number(pack?.availableCount || 0) >= MIN_READY_PROMPTS
      && REQUIRED_POSITIONS.every(position => positions.includes(position));
  };

  const setStatus = (message, state = "neutral") => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  };

  const cleanup = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    window.removeEventListener("fpl:prompt-library-changed", check);
    window.removeEventListener("fpl:prompt-tools-ready", check);
    window.removeEventListener("fpl:prompt-field-readiness-ready", check);
  };

  const unlock = () => {
    if (!packReady()) return false;
    const pack = window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1;
    unlocked = true;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.dataset.nationalityReady = "true";
    if (status?.dataset?.nationalityGate === "waiting") {
      delete status.dataset.nationalityGate;
      setStatus(`Nationality prompt pack ready (${Number(pack.availableCount)} prompts). Seven-day generation is unlocked.`, "neutral");
    }
    cleanup();
    return true;
  };

  function check() {
    if (unlocked || unlock()) return;
    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      const pack = window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1;
      cleanup();
      button.disabled = true;
      button.setAttribute("aria-busy", "false");
      button.dataset.nationalityReady = "false";
      const available = Number(pack?.availableCount || 0);
      setStatus(`Nationality prompt pack is incomplete (${available} usable prompts). Reload Studio before generating the seven-day calendar.`, "fail");
      return;
    }
    timer = setTimeout(check, POLL_MS);
  }

  // Fail closed: admin.html also renders this control disabled so there is no clickable
  // window before JavaScript starts. Only a pack with real usable nationality prompts unlocks generation.
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.dataset.nationalityReady = "false";

  if (!packReady()) {
    if (status) status.dataset.nationalityGate = "waiting";
    setStatus("Loading nationality prompt pack… Seven-day generation will unlock when usable prompts are installed.", "working");
    window.addEventListener("fpl:prompt-library-changed", check);
    window.addEventListener("fpl:prompt-tools-ready", check);
    window.addEventListener("fpl:prompt-field-readiness-ready", check);
    check();
  } else {
    unlock();
  }

  window.FPL_WEEKLY_NATIONALITY_READINESS_GATE = Object.freeze({
    ready: packReady,
    version: VERSION
  });
})();
