/* FPL Challenge Studio — publish a validated seven-day package directly to Supabase. */
(() => {
  "use strict";

  const cfg = window.FPL_LEADERBOARD_CONFIG;
  const authBridge = window.FPL_ACCOUNT_AUTH;
  const downloadButton = document.getElementById("downloadWeekBtn");
  if (!cfg?.dailyPublishing?.enabled || !downloadButton) return;

  const functionName = cfg.dailyPublishing.function || "daily-challenge-publish";
  const endpoint = `${String(cfg.supabaseUrl || "").replace(/\/$/, "")}/functions/v1/${encodeURIComponent(functionName)}`;
  let publishing = false;

  const scheduleApi = window.FPL_STUDIO_SCHEDULE = window.FPL_STUDIO_SCHEDULE || {
    status: "loading",
    scheduled: [],
    lastDate: "",
    error: "",
    refreshedAt: "",
    refresh: null
  };
  scheduleApi.refresh = refreshScheduleStatus;

  function emitScheduleStatus() {
    window.dispatchEvent(new CustomEvent("fpl:schedule-status", {
      detail: {
        status: scheduleApi.status,
        scheduled: Array.isArray(scheduleApi.scheduled) ? scheduleApi.scheduled.slice() : [],
        lastDate: scheduleApi.lastDate || "",
        error: scheduleApi.error || "",
        refreshedAt: scheduleApi.refreshedAt || "",
        refresh: scheduleApi.refresh
      }
    }));
  }

  function installUi() {
    if (document.getElementById("publishWeekSupabaseBtn")) return;
    const button = document.createElement("button");
    button.id = "publishWeekSupabaseBtn";
    button.className = "button secondary";
    button.type = "button";
    button.textContent = "Publish week to Supabase";
    button.disabled = true;
    downloadButton.insertAdjacentElement("afterend", button);

    const status = document.createElement("p");
    status.id = "dailyPublishStatus";
    status.className = "action-status";
    status.setAttribute("role", "status");
    status.textContent = "Generate and validate a seven-day batch to unlock direct publishing.";
    const batchStatus = document.getElementById("batchStatus");
    if (batchStatus) batchStatus.insertAdjacentElement("afterend", status);
    else button.parentElement?.insertAdjacentElement("afterend", status);

    button.addEventListener("click", publishCurrentBatch);
    const sync = () => {
      button.disabled = publishing || downloadButton.disabled;
      if (!publishing && downloadButton.disabled && /ready to publish|published|scheduled/i.test(status.textContent || "")) {
        status.textContent = "Generate and validate a seven-day batch to unlock direct publishing.";
      }
    };
    new MutationObserver(sync).observe(downloadButton, { attributes: true, attributeFilter: ["disabled"] });
    sync();
    refreshScheduleStatus();
  }

  function setStatus(message, type = "neutral") {
    const status = document.getElementById("dailyPublishStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = type;
  }

  async function accessToken() {
    return typeof authBridge?.getAccessToken === "function" ? await authBridge.getAccessToken() : "";
  }

  async function api(body) {
    const token = await accessToken();
    if (!token) throw new Error("Sign in to sync on the live game first, then return to Studio to publish.");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": cfg.publishableKey,
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data?.message || data?.error || `Publishing request failed (${response.status}).`);
    return data || {};
  }

  async function refreshScheduleStatus() {
    scheduleApi.status = "loading";
    scheduleApi.error = "";
    emitScheduleStatus();
    try {
      const data = await api({ action: "status" });
      const scheduled = Array.isArray(data.scheduled) ? data.scheduled : [];
      const last = scheduled.length ? String(scheduled[scheduled.length - 1]?.release_date || "") : "";
      scheduleApi.status = "ready";
      scheduleApi.scheduled = scheduled;
      scheduleApi.lastDate = last;
      scheduleApi.refreshedAt = new Date().toISOString();
      scheduleApi.error = "";
      emitScheduleStatus();
      if (!scheduled.length) {
        setStatus("Supabase publishing is ready. No server-scheduled challenge dates yet.", "ready");
        return;
      }
      setStatus(`${scheduled.length} Supabase challenge${scheduled.length === 1 ? "" : "s"} scheduled · coverage through ${last}.`, "ready");
    } catch (error) {
      scheduleApi.status = "unavailable";
      scheduleApi.scheduled = [];
      scheduleApi.lastDate = "";
      scheduleApi.refreshedAt = new Date().toISOString();
      scheduleApi.error = error?.message || "Supabase publishing status is unavailable.";
      emitScheduleStatus();
      setStatus(scheduleApi.error, "neutral");
    }
  }

  function captureGeneratedPackage() {
    if (downloadButton.disabled) throw new Error("Generate a seven-day batch and wait for all seven challenges to pass first.");
    const originalPhase6 = window.FPL_STUDIO_PHASE6;
    const originalBuilder = originalPhase6?.buildZipBlob;
    if (typeof originalBuilder !== "function") throw new Error("Studio ZIP support is unavailable. Reload the admin page and try again.");

    let captured = null;
    const wrapper = files => {
      captured = Array.isArray(files) ? files.map(file => ({ name: String(file?.name || ""), content: file?.content })) : null;
      return originalBuilder.call(originalPhase6, files);
    };

    let restore = null;
    try {
      try {
        originalPhase6.buildZipBlob = wrapper;
        if (originalPhase6.buildZipBlob !== wrapper) throw new Error("Builder is read-only.");
        restore = () => { try { originalPhase6.buildZipBlob = originalBuilder; } catch {} };
      } catch {
        const replacement = { ...originalPhase6, buildZipBlob: wrapper };
        window.FPL_STUDIO_PHASE6 = replacement;
        if (window.FPL_STUDIO_PHASE6 !== replacement) throw new Error("Studio package capture is unavailable.");
        restore = () => { try { window.FPL_STUDIO_PHASE6 = originalPhase6; } catch {} };
      }

      // Reuse Studio's existing locked download path. This both captures the exact validated
      // package and leaves the normal ZIP on the device as a publishing backup.
      downloadButton.click();
    } finally {
      restore?.();
    }

    if (!captured?.length) throw new Error("Studio could not capture the validated calendar package. Reload the page and generate the week again.");
    return captured;
  }

  function textContent(file) {
    if (typeof file?.content === "string") return file.content;
    if (file?.content instanceof Uint8Array) return new TextDecoder().decode(file.content);
    return String(file?.content ?? "");
  }

  function parseManifest(source) {
    const sandbox = Object.create(null);
    const manifest = new Function("window", `"use strict";\n${source}\nreturn window.FPL_CHALLENGE_MANIFEST || null;`)(sandbox);
    if (!manifest || !Array.isArray(manifest.challenges)) throw new Error("The generated package does not contain a valid challenge manifest.");
    return manifest;
  }

  function buildPublishPayload(files) {
    const manifestFile = files.find(file => file.name === "UPLOAD/challenges/manifest.js");
    if (!manifestFile) throw new Error("The generated package is missing manifest.js.");
    const manifest = parseManifest(textContent(manifestFile));
    const manifestByDate = new Map(manifest.challenges.map(entry => [String(entry?.date || ""), entry]));

    const challengeFiles = files
      .map(file => ({ file, match: /^UPLOAD\/challenges\/(\d{4}-\d{2}-\d{2})\.js$/.exec(file.name) }))
      .filter(item => item.match)
      .sort((left, right) => left.match[1].localeCompare(right.match[1]));
    if (!challengeFiles.length) throw new Error("The generated package contains no dated challenge files.");

    const verifierByDate = new Map();
    for (const file of files) {
      const match = /^BACKEND\/verifiers\/(\d{4}-\d{2}-\d{2})\.json$/.exec(file.name);
      if (!match) continue;
      try { verifierByDate.set(match[1], JSON.parse(textContent(file))); }
      catch { throw new Error(`The private verifier for ${match[1]} is invalid.`); }
    }

    return challengeFiles.map(({ file, match }) => {
      const date = match[1];
      const entry = manifestByDate.get(date);
      const verifier = verifierByDate.get(date);
      if (!entry || !verifier) throw new Error(`The generated package is incomplete for ${date}.`);
      return {
        releaseDate: date,
        challengeId: String(entry.id || ""),
        challengeNumber: Number(entry.number) || 0,
        title: String(entry.title || ""),
        difficulty: String(entry.difficulty || "Mixed"),
        formation: String(entry.formation || "4-4-2"),
        theme: String(entry.theme || "Generated Mix"),
        perfectScore: Number(entry.perfectScore) || 0,
        sourceJs: textContent(file),
        manifestEntry: entry,
        verifier
      };
    });
  }

  async function publishCurrentBatch() {
    if (publishing) return;
    const button = document.getElementById("publishWeekSupabaseBtn");
    publishing = true;
    if (button) { button.disabled = true; button.textContent = "Publishing…"; }
    setStatus("Capturing the validated Studio package… a backup ZIP will also download.", "working");

    try {
      const files = captureGeneratedPackage();
      const challenges = buildPublishPayload(files);
      setStatus(`Publishing ${challenges.length} validated challenge${challenges.length === 1 ? "" : "s"} and private verifiers to Supabase…`, "working");
      const result = await api({ action: "publish", challenges });
      setStatus(`${Number(result.published) || challenges.length} challenge${challenges.length === 1 ? "" : "s"} scheduled successfully · ${result.firstDate} to ${result.lastDate}. Midnight rollover is automatic.`, "published");
      await refreshScheduleStatus();
    } catch (error) {
      console.error(error);
      setStatus(error?.message || "The challenge week could not be published.", "error");
    } finally {
      publishing = false;
      if (button) { button.textContent = "Publish week to Supabase"; button.disabled = downloadButton.disabled; }
    }
  }

  installUi();
})();
