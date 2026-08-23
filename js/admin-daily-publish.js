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

  function installWorkflowStyles() {
    if (document.getElementById("fpl-spoiler-safe-publish-css")) return;
    const style = document.createElement("style");
    style.id = "fpl-spoiler-safe-publish-css";
    style.textContent = `
      .spoiler-publish-flow{margin:14px 0 4px;padding:15px;border:1px solid rgba(57,232,143,.18);border-radius:17px;background:linear-gradient(145deg,rgba(12,34,24,.88),rgba(6,23,16,.94))}
      .spoiler-publish-flow-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
      .spoiler-publish-flow-head span,.spoiler-publish-flow-head strong{display:block}
      .spoiler-publish-flow-head span{color:#9bb7a8;font-size:.66rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}
      .spoiler-publish-flow-head strong{margin-top:3px;color:#f4fff8;font-size:.96rem}
      .spoiler-publish-badge{flex:0 0 auto!important;margin:0!important;padding:5px 8px;border:1px solid rgba(98,201,255,.2);border-radius:999px;background:rgba(98,201,255,.08);color:#62c9ff!important;font-size:.62rem!important;letter-spacing:.08em!important}
      .spoiler-publish-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      .spoiler-publish-step{display:grid;grid-template-columns:30px minmax(0,1fr);gap:9px;align-items:center;min-width:0;padding:10px;border:1px solid rgba(174,226,199,.1);border-radius:13px;background:rgba(0,0,0,.13)}
      .spoiler-publish-step-index{display:grid;place-items:center;width:30px;height:30px;border:1px solid rgba(174,226,199,.15);border-radius:10px;background:rgba(255,255,255,.035);color:#9bb7a8;font-size:.7rem;font-weight:1000}
      .spoiler-publish-step strong,.spoiler-publish-step small,.spoiler-publish-step em{display:block;min-width:0}
      .spoiler-publish-step strong{color:#dcece3;font-size:.76rem;line-height:1.15}
      .spoiler-publish-step small{margin-top:3px;overflow:hidden;color:#809b8c;font-size:.64rem;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}
      .spoiler-publish-step em{grid-column:1/-1;margin-top:1px;color:#809b8c;font-size:.62rem;font-style:normal;font-weight:950;letter-spacing:.06em;text-transform:uppercase}
      .spoiler-publish-step[data-state="done"]{border-color:rgba(57,232,143,.23);background:rgba(57,232,143,.055)}
      .spoiler-publish-step[data-state="done"] .spoiler-publish-step-index{border-color:rgba(57,232,143,.28);background:rgba(57,232,143,.12);color:#39e88f}
      .spoiler-publish-step[data-state="done"] em{color:#62eaa3}
      .spoiler-publish-step[data-state="ready"],.spoiler-publish-step[data-state="active"]{border-color:rgba(98,201,255,.25);background:rgba(98,201,255,.06)}
      .spoiler-publish-step[data-state="ready"] .spoiler-publish-step-index,.spoiler-publish-step[data-state="active"] .spoiler-publish-step-index{border-color:rgba(98,201,255,.28);background:rgba(98,201,255,.1);color:#62c9ff}
      .spoiler-publish-step[data-state="ready"] em,.spoiler-publish-step[data-state="active"] em{color:#62c9ff}
      .spoiler-publish-note{margin:11px 1px 0;color:#809b8c;font-size:.68rem;line-height:1.4}
      @media(max-width:720px){.spoiler-publish-steps{grid-template-columns:1fr 1fr}.spoiler-publish-step{padding:9px}}
      @media(max-width:390px){.spoiler-publish-flow{padding:13px}.spoiler-publish-step{grid-template-columns:26px minmax(0,1fr);gap:7px}.spoiler-publish-step-index{width:26px;height:26px}}
    `;
    document.head.appendChild(style);
  }

  function installWorkflow(status) {
    if (document.getElementById("spoilerPublishFlow")) return;
    const flow = document.createElement("section");
    flow.id = "spoilerPublishFlow";
    flow.className = "spoiler-publish-flow";
    flow.setAttribute("aria-label", "Spoiler-safe publishing workflow");
    flow.innerHTML = `
      <div class="spoiler-publish-flow-head">
        <div><span>Publishing workflow</span><strong>Spoiler-safe challenge status</strong></div>
        <span class="spoiler-publish-badge">No spoilers</span>
      </div>
      <div class="spoiler-publish-steps">
        <article class="spoiler-publish-step" data-publish-step="generate" data-state="active">
          <span class="spoiler-publish-step-index">1</span><div><strong>Generate</strong><small>Build 7 days</small></div><em>Waiting</em>
        </article>
        <article class="spoiler-publish-step" data-publish-step="validate" data-state="locked">
          <span class="spoiler-publish-step-index">2</span><div><strong>Validate</strong><small>All 7 pass</small></div><em>Locked</em>
        </article>
        <article class="spoiler-publish-step" data-publish-step="publish" data-state="locked">
          <span class="spoiler-publish-step-index">3</span><div><strong>Publish</strong><small>Send schedule</small></div><em>Locked</em>
        </article>
        <article class="spoiler-publish-step" data-publish-step="rollover" data-state="locked">
          <span class="spoiler-publish-step-index">4</span><div><strong>Midnight</strong><small>Automatic switch</small></div><em>After publish</em>
        </article>
      </div>
      <p class="spoiler-publish-note">Only safe admin metadata is shown here — no prompt wording, player names, answers or perfect XI.</p>
    `;
    status.insertAdjacentElement("afterend", flow);
    updateWorkflow();
  }

  function setWorkflowStep(name, state, label) {
    const step = document.querySelector(`[data-publish-step="${name}"]`);
    if (!step) return;
    step.dataset.state = state;
    const text = step.querySelector("em");
    if (text) text.textContent = label;
  }

  function updateWorkflow() {
    const status = document.getElementById("dailyPublishStatus");
    const batchReady = !downloadButton.disabled;
    const statusState = status?.dataset.state || "";
    const published = statusState === "published";

    setWorkflowStep("generate", batchReady ? "done" : "active", batchReady ? "Complete" : "Waiting");
    setWorkflowStep("validate", batchReady ? "done" : "locked", batchReady ? "7 / 7 passed" : "Locked");

    if (publishing) setWorkflowStep("publish", "active", "Publishing");
    else if (published) setWorkflowStep("publish", "done", "Scheduled");
    else if (batchReady) setWorkflowStep("publish", "ready", "Ready");
    else setWorkflowStep("publish", "locked", "Locked");

    setWorkflowStep("rollover", published ? "done" : "locked", published ? "Automatic" : "After publish");
  }

  function installUi() {
    if (document.getElementById("publishWeekSupabaseBtn")) return;
    installWorkflowStyles();

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

    installWorkflow(status);
    button.addEventListener("click", publishCurrentBatch);
    const sync = () => {
      button.disabled = publishing || downloadButton.disabled;
      if (!publishing && downloadButton.disabled && /ready to publish|published|scheduled/i.test(status.textContent || "")) {
        status.textContent = "Generate and validate a seven-day batch to unlock direct publishing.";
        status.dataset.state = "neutral";
      }
      updateWorkflow();
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
    updateWorkflow();
  }

  function setPublishedBatchMessage(challengeCount) {
    const batchStatus = document.getElementById("batchStatus");
    if (!batchStatus) return;
    const count = Number(challengeCount) || 7;
    batchStatus.textContent = `Backup ZIP downloaded automatically. ${count} challenge${count === 1 ? "" : "s"} scheduled successfully in Supabase.`;
    batchStatus.dataset.state = "pass";
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
      setStatus(`${scheduled.length} Supabase challenge${scheduled.length === 1 ? "" : "s"} scheduled · coverage through ${last}. Midnight rollover is automatic.`, "published");
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
    const originalZipApi = window.FPL_STUDIO_ZIP;
    const originalBuilder = originalZipApi?.buildZipBlob;
    if (typeof originalBuilder !== "function") throw new Error("Studio ZIP support is unavailable. Reload the admin page and try again.");

    let captured = null;
    const wrapper = files => {
      captured = Array.isArray(files) ? files.map(file => ({ name: String(file?.name || ""), content: file?.content })) : null;
      return originalBuilder.call(originalZipApi, files);
    };

    let restore = null;
    try {
      try {
        originalZipApi.buildZipBlob = wrapper;
        if (originalZipApi.buildZipBlob !== wrapper) throw new Error("Builder is read-only.");
        restore = () => { try { originalZipApi.buildZipBlob = originalBuilder; } catch {} };
      } catch {
        const replacement = { ...originalZipApi, buildZipBlob: wrapper };
        window.FPL_STUDIO_ZIP = replacement;
        if (window.FPL_STUDIO_ZIP !== replacement) throw new Error("Studio package capture is unavailable.");
        restore = () => { try { window.FPL_STUDIO_ZIP = originalZipApi; } catch {} };
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
      await refreshScheduleStatus();
      setPublishedBatchMessage(Number(result.published) || challenges.length);
      setStatus(`${Number(result.published) || challenges.length} challenge${challenges.length === 1 ? "" : "s"} scheduled successfully · ${result.firstDate} to ${result.lastDate}. Midnight rollover is automatic.`, "published");
    } catch (error) {
      console.error(error);
      setStatus(error?.message || "The challenge week could not be published.", "error");
    } finally {
      publishing = false;
      if (button) { button.textContent = "Publish week to Supabase"; button.disabled = downloadButton.disabled; }
      updateWorkflow();
    }
  }

  installUi();
})();
