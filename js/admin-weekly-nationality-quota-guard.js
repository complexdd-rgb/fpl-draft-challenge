/* FPL Challenge Studio — hard post-generation nationality quota guard. */
(() => {
  "use strict";

  const VERSION = "1.0.0";
  const DAYS_IN_BATCH = 7;
  const REQUIRED_NATIONALITY_PER_DAY = 1;
  const generateButton = document.querySelector("#generateWeekBtn");
  const downloadButton = document.querySelector("#downloadWeekBtn");
  const status = document.querySelector("#batchStatus");
  if (!generateButton || !downloadButton) return;

  let checkTimer = null;
  let attempts = 0;

  const results = () => {
    const value = window.FPL_STUDIO_BATCH_CALENDAR?.getResults?.();
    return Array.isArray(value) ? value : [];
  };

  const invalidDays = rows => rows.filter(row => {
    if (row?.status !== "PASS") return false;
    return Number(row?.promptMixTarget?.nationality) !== REQUIRED_NATIONALITY_PER_DAY
      || Number(row?.promptMix?.nationality) !== REQUIRED_NATIONALITY_PER_DAY;
  });

  const setFailure = rows => {
    downloadButton.disabled = true;
    downloadButton.dataset.nationalityQuotaReady = "false";
    if (status) {
      const dates = rows.map(row => row?.releaseDate || row?.date).filter(Boolean).join(", ");
      status.dataset.state = "fail";
      status.textContent = `Seven-day calendar blocked: nationality quota failed${dates ? ` on ${dates}` : ""}. Each day must contain exactly one nationality prompt.`;
    }
  };

  const certify = () => {
    const rows = results();
    if (rows.length !== DAYS_IN_BATCH || rows.some(row => row?.status !== "PASS")) return false;
    const failures = invalidDays(rows);
    if (failures.length) {
      setFailure(failures);
      return false;
    }
    downloadButton.dataset.nationalityQuotaReady = "true";
    return true;
  };

  const monitor = () => {
    if (checkTimer !== null) clearTimeout(checkTimer);
    attempts = 0;
    const tick = () => {
      attempts += 1;
      const rows = results();
      if (rows.length === DAYS_IN_BATCH || rows.some(row => row?.status === "FAIL")) {
        certify();
        checkTimer = null;
        return;
      }
      if (attempts < 600) checkTimer = setTimeout(tick, 100);
      else checkTimer = null;
    };
    checkTimer = setTimeout(tick, 0);
  };

  generateButton.addEventListener("click", monitor, true);
  downloadButton.addEventListener("click", event => {
    if (certify()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const rows = results();
    const failures = invalidDays(rows);
    if (failures.length) setFailure(failures);
    else if (status) {
      status.dataset.state = "fail";
      status.textContent = "Seven-day calendar is not certified for download yet.";
    }
  }, true);

  const baseApi = window.FPL_STUDIO_BATCH_CALENDAR;
  if (baseApi && typeof baseApi === "object") {
    window.FPL_WEEKLY_NATIONALITY_QUOTA_GUARD = Object.freeze({
      version: VERSION,
      requiredPerDay: REQUIRED_NATIONALITY_PER_DAY,
      certify,
      invalidDays: () => invalidDays(results()).map(row => row?.releaseDate || row?.date || "unknown")
    });
  }
})();
