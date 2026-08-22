/* FPL Challenge Studio — Daily Challenge scheduler + quality-pool guard v1.1.0
   Keeps seven-day generation aligned with the live server schedule and locks every generated
   week to the current certified 4★+ prompt pool. */
(() => {
  "use strict";

  if (window.__FPL_DAILY_GENERATOR_GUARD_V1__) return;
  window.__FPL_DAILY_GENERATOR_GUARD_V1__ = true;

  const DAYS_IN_BATCH = 7;
  const LONDON_TIMEZONE = "Europe/London";
  const QUALITY_WAIT_MS = 15000;
  const core = window.FPL_STUDIO_API;
  const generateButton = document.getElementById("generateWeekBtn");
  const startDateInput = document.getElementById("batchStartDate");
  const firstNumberInput = document.getElementById("batchFirstNumber");
  const status = document.getElementById("batchStatus");
  const manifestChip = document.getElementById("batchManifestChip");

  if (!core || !generateButton || !startDateInput || !firstNumberInput) return;

  let qualityIds = null;
  let certifiedPoolSize = 0;
  let generationRunning = false;
  let guardChip = null;

  function setStatus(message, state = "neutral") {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function addDaysIso(value, amount) {
    if (!isIsoDate(value)) return "";
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
  }

  function londonToday() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function manifestRows() {
    const entries = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges)
      ? window.FPL_CHALLENGE_MANIFEST.challenges
      : [];
    return entries.map(entry => ({
      date: String(entry?.date || ""),
      number: Number(entry?.number) || 0,
      source: "manifest"
    })).filter(entry => isIsoDate(entry.date) && entry.number > 0);
  }

  function serverRows() {
    const rows = Array.isArray(window.FPL_STUDIO_SCHEDULE?.scheduled)
      ? window.FPL_STUDIO_SCHEDULE.scheduled
      : [];
    return rows.map(entry => ({
      date: String(entry?.release_date || entry?.releaseDate || ""),
      number: Number(entry?.challenge_number ?? entry?.challengeNumber) || 0,
      source: "server"
    })).filter(entry => isIsoDate(entry.date) && entry.number > 0);
  }

  function combinedSchedule() {
    const byDate = new Map();
    for (const row of manifestRows()) byDate.set(row.date, row);
    for (const row of serverRows()) byDate.set(row.date, row);
    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  function expectedNext() {
    const rows = combinedSchedule();
    if (!rows.length) return { date: addDaysIso(londonToday(), 1), number: 1, maxNumber: 0, consistent: true };
    const latest = rows[rows.length - 1];
    const maxNumber = rows.reduce((max, row) => Math.max(max, row.number), 0);
    return {
      date: addDaysIso(latest.date, 1),
      number: latest.number + 1,
      maxNumber,
      latest,
      consistent: latest.number === maxNumber
    };
  }

  function installGuardChip() {
    if (guardChip || document.getElementById("dailyGeneratorGuardChip")) {
      guardChip = document.getElementById("dailyGeneratorGuardChip");
      return;
    }
    guardChip = document.createElement("span");
    guardChip.id = "dailyGeneratorGuardChip";
    guardChip.className = "phase-chip";
    guardChip.textContent = "Quality pool finalising…";
    guardChip.style.marginLeft = "8px";
    if (manifestChip?.parentElement) manifestChip.insertAdjacentElement("afterend", guardChip);
    else status?.insertAdjacentElement("beforebegin", guardChip);
  }

  function updateGuardChip() {
    installGuardChip();
    if (!guardChip) return;
    const meta = window.FPL_FOUR_STAR_LIBRARY;
    const scheduleReady = window.FPL_STUDIO_SCHEDULE?.status === "ready";
    const next = scheduleReady ? expectedNext() : null;
    const qualityText = qualityIds instanceof Set && certifiedPoolSize > 0
      ? `${certifiedPoolSize.toLocaleString("en-GB")} certified prompts`
      : meta?.ready
        ? `${Number(meta.total || 0).toLocaleString("en-GB")} prompt pool syncing`
        : "quality pool finalising";
    const nextText = next?.date && next?.number ? `next #${next.number} · ${next.date}` : "live schedule pending";
    guardChip.textContent = `${qualityText} · ${nextText}`;
    guardChip.title = "Daily Challenge generation is locked to the current certified quality pool and a freshly loaded live Supabase schedule.";
  }

  function captureQualityPool() {
    const meta = window.FPL_FOUR_STAR_LIBRARY;
    const library = core.getPromptLibrary?.();
    if (!meta?.ready || !Array.isArray(library)) return false;

    const certifiedSize = Number(meta.total);
    if (!Number.isInteger(certifiedSize) || certifiedSize <= 0) return false;

    const ids = library.map(prompt => String(prompt?.id || "")).filter(Boolean);
    const uniqueIds = new Set(ids);
    if (ids.length !== library.length || ids.length !== certifiedSize || uniqueIds.size !== certifiedSize) return false;
    if (library.some(prompt => Number(prompt?.rating || 0) < 4)) return false;

    qualityIds = uniqueIds;
    certifiedPoolSize = certifiedSize;
    updateGuardChip();
    return true;
  }

  function qualityPoolDiagnostic() {
    const meta = window.FPL_FOUR_STAR_LIBRARY;
    const library = core.getPromptLibrary?.();
    const liveSize = Array.isArray(library) ? library.length : 0;
    const certifiedSize = Number(meta?.total) || 0;
    if (!meta?.ready) return `quality certification metadata is still pending; live library ${liveSize.toLocaleString("en-GB")}`;
    return `certified metadata ${certifiedSize.toLocaleString("en-GB")}; live library ${liveSize.toLocaleString("en-GB")}`;
  }

  async function waitForQualityPool() {
    if (captureQualityPool()) return true;
    setStatus("Synchronising the current certified 4★+ prompt pool before generation…", "working");
    return await new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        window.removeEventListener("fpl:four-star-library-ready", onReady);
        clearInterval(timer);
        clearTimeout(timeout);
        resolve(value);
      };
      const onReady = () => { if (captureQualityPool()) finish(true); };
      const timer = setInterval(() => { if (captureQualityPool()) finish(true); }, 250);
      const timeout = setTimeout(() => finish(false), QUALITY_WAIT_MS);
      window.addEventListener("fpl:four-star-library-ready", onReady);
    });
  }

  async function refreshServerSchedule() {
    const schedule = window.FPL_STUDIO_SCHEDULE;
    if (typeof schedule?.refresh !== "function") return false;
    try {
      await schedule.refresh();
      return schedule.status === "ready";
    } catch (_) {
      return false;
    }
  }

  async function waitForServerSchedule(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    setStatus("Refreshing the live Supabase schedule before generation…", "working");
    while (Date.now() < deadline) {
      const schedule = window.FPL_STUDIO_SCHEDULE;
      if (typeof schedule?.refresh === "function") {
        if (await refreshServerSchedule()) {
          updateGuardChip();
          return true;
        }
        if (schedule.status === "unavailable") return false;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  function syncInputsToSchedule(force = false) {
    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") {
      updateGuardChip();
      return false;
    }
    const next = expectedNext();
    if (!next.consistent) return false;
    const start = String(startDateInput.value || "");
    const number = Number(firstNumberInput.value) || 0;
    const stale = !isIsoDate(start)
      || start < next.date
      || number <= next.maxNumber;
    if (force || stale) {
      startDateInput.value = next.date;
      firstNumberInput.value = String(next.number);
    }
    updateGuardChip();
    return true;
  }

  function validateScheduleSelection() {
    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") {
      return { ok: false, reason: "The live Supabase schedule is not ready. Generation stays locked until the server schedule has been refreshed successfully." };
    }
    const next = expectedNext();
    if (!next.consistent) {
      return { ok: false, reason: `Challenge numbering is inconsistent: the latest dated challenge is #${next.latest?.number || "?"}, but #${next.maxNumber} is already reserved elsewhere. Resolve the schedule before generating.` };
    }

    const start = String(startDateInput.value || "");
    const first = Number(firstNumberInput.value) || 0;
    if (start !== next.date || first !== next.number) {
      startDateInput.value = next.date;
      firstNumberInput.value = String(next.number);
      updateGuardChip();
      return {
        ok: false,
        reason: `Schedule synced to the next unused slot: ${next.date}, Challenge #${next.number}. Press Generate week again to build #${next.number}–#${next.number + DAYS_IN_BATCH - 1}.`
      };
    }

    const dates = new Set(serverRows().map(row => row.date));
    const numbers = new Set(serverRows().map(row => row.number));
    for (let index = 0; index < DAYS_IN_BATCH; index += 1) {
      const date = addDaysIso(start, index);
      const number = first + index;
      if (dates.has(date) || numbers.has(number)) {
        return { ok: false, reason: `${date} / Challenge #${number} is already scheduled in Supabase. Remove that scheduled day or week before regenerating it.` };
      }
    }
    return { ok: true };
  }

  function lockLibraryToQualityPool() {
    if (!(qualityIds instanceof Set) || qualityIds.size <= 0 || qualityIds.size !== certifiedPoolSize) return null;
    const library = core.getPromptLibrary?.();
    if (!Array.isArray(library)) return null;
    const original = library.slice();
    const certified = original.filter(prompt => qualityIds.has(String(prompt?.id || "")));
    if (certified.length !== certifiedPoolSize) return null;
    library.splice(0, library.length, ...certified);
    core.invalidatePromptStats?.();
    return () => {
      library.splice(0, library.length, ...original);
      core.invalidatePromptStats?.();
    };
  }

  function certifyGeneratedResults() {
    const results = window.FPL_STUDIO_BATCH_CALENDAR?.getResults?.() || [];
    if (!Array.isArray(results) || results.length !== DAYS_IN_BATCH) return false;
    return results.every(result =>
      result?.status === "PASS"
      && Array.isArray(result.promptIds)
      && result.promptIds.length === 11
      && result.promptIds.every(id => qualityIds?.has(String(id)))
    );
  }

  async function guardedGenerate() {
    if (generationRunning) return;
    generationRunning = true;
    generateButton.disabled = true;
    let restoreLibrary = null;
    try {
      if (!await waitForQualityPool()) {
        setStatus(`Generation could not synchronise the certified 4★+ prompt pool within ${Math.round(QUALITY_WAIT_MS / 1000)} seconds (${qualityPoolDiagnostic()}). Reload Studio if the quality panel is still working, then try again.`, "fail");
        return;
      }

      if (!await waitForServerSchedule()) {
        setStatus("Generation is locked until the live Supabase schedule is available. Sign in on the live game if needed, then reload Studio before generating.", "fail");
        return;
      }

      const scheduleCheck = validateScheduleSelection();
      if (!scheduleCheck.ok) {
        setStatus(scheduleCheck.reason, "fail");
        return;
      }

      restoreLibrary = lockLibraryToQualityPool();
      if (!restoreLibrary) {
        setStatus(`Could not lock generation to the current ${certifiedPoolSize.toLocaleString("en-GB")} certified prompts. Reload Studio before generating a future week.`, "fail");
        return;
      }

      const generator = window.FPL_STUDIO_BATCH_CALENDAR?.generate;
      if (typeof generator !== "function") {
        setStatus("The seven-day generator is unavailable. Reload Studio and try again.", "fail");
        return;
      }

      await generator();
      if (!certifyGeneratedResults()) {
        window.FPL_STUDIO_BATCH_CALENDAR?.clear?.();
        setStatus(`Quality certification failed: every generated prompt must belong to the locked ${certifiedPoolSize.toLocaleString("en-GB")} prompt pool. The batch was cleared and cannot be published.`, "fail");
        return;
      }
      updateGuardChip();
    } catch (error) {
      console.error(error);
      setStatus(`Daily Challenge guard stopped generation: ${error instanceof Error ? error.message : String(error)}`, "fail");
    } finally {
      try { restoreLibrary?.(); } catch (_) {}
      generationRunning = false;
      generateButton.disabled = false;
    }
  }

  function onGenerateClick(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    guardedGenerate();
  }

  function onScheduleStatus() {
    if (!generationRunning && window.FPL_STUDIO_SCHEDULE?.status === "ready") syncInputsToSchedule(false);
    else updateGuardChip();
  }

  function onPromptLibraryChanged() {
    qualityIds = null;
    certifiedPoolSize = 0;
    captureQualityPool();
    updateGuardChip();
  }

  generateButton.addEventListener("click", onGenerateClick, true);
  window.addEventListener("fpl:four-star-library-ready", () => { captureQualityPool(); updateGuardChip(); });
  window.addEventListener("fpl:prompt-library-changed", onPromptLibraryChanged);
  window.addEventListener("fpl:schedule-status", onScheduleStatus);

  installGuardChip();
  captureQualityPool();
  updateGuardChip();
  setTimeout(() => {
    waitForServerSchedule().then(ready => { if (ready) syncInputsToSchedule(false); else updateGuardChip(); });
  }, 0);

  window.FPL_DAILY_GENERATOR_GUARD = Object.freeze({
    get expectedPoolSize() { return certifiedPoolSize || Number(window.FPL_FOUR_STAR_LIBRARY?.total) || 0; },
    qualityReady: () => qualityIds instanceof Set && certifiedPoolSize > 0 && qualityIds.size === certifiedPoolSize,
    scheduleReady: () => window.FPL_STUDIO_SCHEDULE?.status === "ready",
    getQualityPromptIds: () => qualityIds ? [...qualityIds] : [],
    getExpectedNext: () => ({ ...expectedNext() }),
    sync: () => syncInputsToSchedule(true),
    generate: guardedGenerate
  });
})();
