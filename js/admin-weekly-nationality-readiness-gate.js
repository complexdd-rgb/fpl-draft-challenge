/* FPL Challenge Studio — block seven-day generation until nationality context prompts are installed. */
(() => {
  "use strict";

  const VERSION = "1.0.0";
  const POLL_MS = 100;
  const MAX_ATTEMPTS = 120;
  const button = document.querySelector("#generateWeekBtn");
  const status = document.querySelector("#batchStatus");
  if (!button) return;

  let attempts = 0;
  let timer = null;
  let unlocked = false;

  const packReady = () => window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1?.ready === true;

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
    unlocked = true;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.dataset.nationalityReady = "true";
    if (status?.dataset?.nationalityGate === "waiting") {
      delete status.dataset.nationalityGate;
      setStatus("Nationality prompt pack ready. Seven-day generation is unlocked.", "neutral");
    }
    cleanup();
    return true;
  };

  function check() {
    if (unlocked || unlock()) return;
    attempts += 1;
    if (attempts >= MAX_ATTEMPTS) {
      cleanup();
      button.disabled = true;
      button.setAttribute("aria-busy", "false");
      button.dataset.nationalityReady = "false";
      setStatus("Nationality prompt pack did not finish loading. Reload Studio before generating the seven-day calendar.", "fail");
      return;
    }
    timer = setTimeout(check, POLL_MS);
  }

  // Fail closed: admin.html also renders this control disabled so there is no clickable
  // window before JavaScript starts. Only the pack's durable ready flag unlocks generation.
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.dataset.nationalityReady = "false";

  if (!packReady()) {
    if (status) status.dataset.nationalityGate = "waiting";
    setStatus("Loading nationality prompt pack… Seven-day generation will unlock when it is ready.", "working");
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
