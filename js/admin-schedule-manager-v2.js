/* FPL Challenge Studio — centrally owned published schedule manager v2.0.0.
   Removes future published days/weeks through the authenticated Daily publishing Edge Function.
   Auth is resolved at action time so asynchronous account/session initialisation cannot stale the manager. */
(() => {
  "use strict";

  const VERSION = "2.0.0";
  if (window.__FPL_SCHEDULE_MANAGER_V2__) {
    window.FPL_STUDIO_SCHEDULE_MANAGER?.render?.(window.FPL_STUDIO_SCHEDULE);
    return;
  }
  window.__FPL_SCHEDULE_MANAGER_V2__ = true;
  // Prevent the retired compatibility loader from installing another manager after v2.
  window.__FPL_SCHEDULE_MANAGER_V1__ = true;

  let removing = false;
  let installed = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);

  function config() {
    return window.FPL_LEADERBOARD_CONFIG || null;
  }

  function endpoint() {
    const cfg = config();
    if (!cfg?.dailyPublishing?.enabled) return "";
    const functionName = cfg.dailyPublishing.function || "daily-challenge-publish";
    return `${String(cfg.supabaseUrl || "").replace(/\/$/, "")}/functions/v1/${encodeURIComponent(functionName)}`;
  }

  function londonToday() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function dateLabel(value, withYear = false) {
    const date = new Date(`${String(value)}T12:00:00Z`);
    if (!Number.isFinite(date.getTime())) return String(value || "");
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short", day: "numeric", month: "short", ...(withYear ? { year:"numeric" } : {})
    }).format(date);
  }

  function groupBatches(rows) {
    const groups = new Map();
    for (const row of rows) {
      const key = String(row?.published_at || "unknown");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return [...groups.values()]
      .map(items => items.slice().sort((a,b) => String(a.release_date).localeCompare(String(b.release_date))))
      .sort((a,b) => String(a[0]?.release_date || "").localeCompare(String(b[0]?.release_date || "")));
  }

  async function accessToken() {
    // Resolve dynamically. The account bridge/session is initialised asynchronously on Studio.
    const bridge = window.FPL_ACCOUNT_AUTH;
    if (typeof bridge?.getAccessToken !== "function") return "";
    return await bridge.getAccessToken();
  }

  async function api(body) {
    const cfg = config();
    const url = endpoint();
    if (!cfg?.publishableKey || !url) throw new Error("Daily schedule publishing is not configured.");
    const token = await accessToken();
    if (!token) throw new Error("Your Studio session is not signed in. Open the live game, sign in, then return here and try again.");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "apikey":cfg.publishableKey,
        "Authorization":`Bearer ${token}`
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data?.message || data?.error || `Schedule request failed (${response.status}).`);
    return data || {};
  }

  function installStyles() {
    if (document.getElementById("fpl-schedule-manager-v2-css")) return;
    const style = document.createElement("style");
    style.id = "fpl-schedule-manager-v2-css";
    style.textContent = `
      .schedule-manager{margin:12px 0 4px;border:1px solid rgba(98,201,255,.18);border-radius:16px;background:linear-gradient(145deg,rgba(9,29,21,.94),rgba(5,21,15,.97));overflow:hidden}
      .schedule-manager>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 15px;cursor:pointer;list-style:none}.schedule-manager>summary::-webkit-details-marker{display:none}
      .schedule-manager-head{min-width:0}.schedule-manager-head small,.schedule-manager-head strong,.schedule-manager-head span{display:block}.schedule-manager-head small{color:#62c9ff;font-size:.62rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.schedule-manager-head strong{margin-top:3px;color:#f4fff8;font-size:.96rem}.schedule-manager-head span{margin-top:3px;color:#839e90;font-size:.65rem}
      .schedule-manager-chip{flex:0 0 auto;padding:6px 9px;border:1px solid rgba(255,193,92,.2);border-radius:999px;background:rgba(255,193,92,.055);color:#e7c777;font-size:.61rem;font-weight:950;letter-spacing:.05em;text-transform:uppercase}
      .schedule-manager-body{padding:0 15px 15px}.schedule-manager-note{margin:0 0 11px;padding:9px 10px;border:1px solid rgba(57,232,143,.1);border-radius:10px;background:rgba(57,232,143,.035);color:#91ad9e;font-size:.68rem;line-height:1.45}.schedule-manager-note strong{color:#bce9cf}.schedule-manager-status{margin:0 0 10px;color:#9bb7a8;font-size:.71rem}
      .schedule-batch-list{display:grid;gap:9px}.schedule-batch{padding:12px;border:1px solid rgba(174,226,199,.11);border-radius:13px;background:rgba(0,0,0,.12)}
      .schedule-batch-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.schedule-batch-head strong,.schedule-batch-head small{display:block}.schedule-batch-head strong{color:#f4fff8;font-size:.82rem}.schedule-batch-head small{margin-top:3px;color:#8ea99a;font-size:.65rem}
      .schedule-remove-button{min-height:35px;padding:7px 10px;border:1px solid rgba(255,127,153,.3);border-radius:10px;background:rgba(255,127,153,.075);color:#ff9aad;font-size:.67rem;font-weight:950;cursor:pointer}.schedule-remove-button:hover:not(:disabled){background:rgba(255,127,153,.13)}.schedule-remove-button:disabled{opacity:.45;cursor:not-allowed}
      .schedule-days{margin-top:9px;border-top:1px solid rgba(174,226,199,.08);padding-top:8px}.schedule-days summary{color:#9bb7a8;font-size:.65rem;font-weight:850;cursor:pointer}.schedule-day-list{display:grid;gap:5px;margin-top:7px}.schedule-day{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 8px;border:1px solid rgba(174,226,199,.08);border-radius:9px;background:rgba(255,255,255,.018)}.schedule-day span{color:#dcece3;font-size:.69rem}.schedule-day button{padding:5px 8px;border:1px solid rgba(255,127,153,.18);border-radius:8px;background:transparent;color:#eaa0af;font-size:.61rem;font-weight:900;cursor:pointer}.schedule-day button:disabled{opacity:.45;cursor:not-allowed}
      .schedule-empty{padding:12px;border:1px dashed rgba(174,226,199,.12);border-radius:11px;color:#9bb7a8;font-size:.71rem;text-align:center}
      @media(max-width:430px){.schedule-manager>summary{align-items:flex-start;padding:13px}.schedule-manager-body{padding:0 13px 13px}.schedule-manager-chip{font-size:.55rem}.schedule-batch-head{grid-template-columns:1fr}.schedule-remove-button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function panelMarkup() {
    return `
      <summary>
        <span class="schedule-manager-head">
          <small>Published schedule</small>
          <strong>Manage published days and weeks</strong>
          <span>Remove future scheduled challenges without deleting leaderboard history.</span>
        </span>
        <span class="schedule-manager-chip" data-schedule-manager-chip>Day / week controls</span>
      </summary>
      <div class="schedule-manager-body">
        <p class="schedule-manager-note"><strong>Safe removal:</strong> only future dates can be removed. Today and past challenges stay protected, and existing leaderboard attempts are retained.</p>
        <p class="schedule-manager-status" data-schedule-manager-status>Loading published schedule…</p>
        <div class="schedule-batch-list" data-schedule-batch-list></div>
      </div>`;
  }

  function install() {
    const cfg = config();
    if (!cfg?.dailyPublishing?.enabled) return false;
    const anchor = document.getElementById("spoilerPublishFlow") || document.getElementById("dailyPublishStatus") || document.getElementById("batchStatus");
    if (!anchor) return false;

    installStyles();
    const existing = document.getElementById("scheduleManagerPanel");
    if (existing?.dataset.scheduleManagerVersion === VERSION) {
      installed = true;
      return true;
    }
    existing?.remove();

    const panel = document.createElement("details");
    panel.id = "scheduleManagerPanel";
    panel.className = "schedule-manager";
    panel.dataset.scheduleManagerVersion = VERSION;
    panel.innerHTML = panelMarkup();
    anchor.insertAdjacentElement("afterend", panel);
    panel.addEventListener("click", onClick);
    installed = true;
    render(window.FPL_STUDIO_SCHEDULE);
    return true;
  }

  function render(apiState) {
    const panel = document.getElementById("scheduleManagerPanel");
    if (!panel || panel.dataset.scheduleManagerVersion !== VERSION) {
      if (!install()) return;
    }
    const current = document.getElementById("scheduleManagerPanel");
    if (!current) return;
    const status = current.querySelector("[data-schedule-manager-status]");
    const list = current.querySelector("[data-schedule-batch-list]");
    const chip = current.querySelector("[data-schedule-manager-chip]");
    const state = apiState || window.FPL_STUDIO_SCHEDULE || {};
    const rows = Array.isArray(state.scheduled) ? state.scheduled : [];
    const today = String(state.today || londonToday());

    if (state.status === "loading") {
      if (status) status.textContent = "Loading published schedule…";
      if (chip) chip.textContent = "Loading…";
      if (list) list.innerHTML = "";
      return;
    }
    if (state.status === "unavailable") {
      if (status) status.textContent = state.error || "Schedule management is unavailable.";
      if (chip) chip.textContent = "Unavailable";
      if (list) list.innerHTML = "";
      return;
    }

    const futureRows = rows.filter(row => String(row.release_date) > today);
    const groups = groupBatches(futureRows);
    if (status) status.textContent = `${futureRows.length} removable future challenge${futureRows.length === 1 ? "" : "s"} across ${groups.length} published batch${groups.length === 1 ? "" : "es"}.`;
    if (chip) chip.textContent = futureRows.length ? `${futureRows.length} future` : "Nothing removable";

    if (!futureRows.length) {
      if (list) list.innerHTML = '<div class="schedule-empty">No future published challenges are available to remove.</div>';
      return;
    }

    if (list) list.innerHTML = groups.map((items,index) => {
      const dates = items.map(item => String(item.release_date));
      const first = dates[0];
      const last = dates[dates.length - 1];
      const range = first === last ? dateLabel(first,true) : `${dateLabel(first)} – ${dateLabel(last,true)}`;
      const batchAction = items.length === 1 ? "Remove challenge" : items.length === 7 ? "Remove whole week" : `Remove all ${items.length} days`;
      return `<article class="schedule-batch" data-schedule-batch="${index}">
        <div class="schedule-batch-head">
          <div><strong>${esc(range)}</strong><small>${items.length} future published challenge${items.length===1?"":"s"}</small></div>
          <button type="button" class="schedule-remove-button" data-remove-week="${esc(dates.join(","))}" ${removing?"disabled":""}>${esc(batchAction)}</button>
        </div>
        <details class="schedule-days">
          <summary>Remove an individual day</summary>
          <div class="schedule-day-list">${items.map(item => `<div class="schedule-day"><span>${esc(dateLabel(item.release_date,true))}</span><button type="button" data-remove-day="${esc(item.release_date)}" ${removing?"disabled":""}>Remove day</button></div>`).join("")}</div>
        </details>
      </article>`;
    }).join("");
  }

  async function removeDates(dates) {
    if (removing || !Array.isArray(dates) || !dates.length) return;
    const today = londonToday();
    const ordered = [...new Set(dates.map(String))].filter(date => date > today).sort();
    if (!ordered.length) throw new Error("Only future UK challenge dates can be removed.");

    const label = ordered.length === 1
      ? dateLabel(ordered[0],true)
      : `${dateLabel(ordered[0])} – ${dateLabel(ordered[ordered.length - 1],true)}`;
    const noun = ordered.length === 1 ? "this published challenge" : ordered.length === 7 ? "this whole published week" : `these ${ordered.length} published challenges`;
    if (!window.confirm(`Remove ${noun} (${label})?\n\nThe selected future date${ordered.length === 1 ? "" : "s"} will no longer go live automatically. Existing leaderboard history, if any, will be preserved.`)) return;

    removing = true;
    render(window.FPL_STUDIO_SCHEDULE);
    const status = document.querySelector("#scheduleManagerPanel [data-schedule-manager-status]");
    if (status) status.textContent = `Removing ${ordered.length === 1 ? "published day" : "published dates"}…`;

    try {
      const result = await api({ action:"remove", dates:ordered });
      const count = Number(result.removed) || 0;
      if (!count) throw new Error("Supabase accepted the request but no active future challenge rows were removed. Refresh the schedule and try again.");
      if (status) status.textContent = `${count} future challenge${count === 1 ? "" : "s"} removed. Leaderboard history was preserved.`;
      if (typeof window.FPL_STUDIO_SCHEDULE?.refresh === "function") await window.FPL_STUDIO_SCHEDULE.refresh();
      else render(window.FPL_STUDIO_SCHEDULE);
      window.dispatchEvent(new CustomEvent("fpl:schedule-remove-success", { detail:{ dates:ordered, removed:count } }));
      return count;
    } catch (error) {
      console.error("Daily schedule removal failed", error);
      if (status) status.textContent = error?.message || "The published challenges could not be removed.";
      window.dispatchEvent(new CustomEvent("fpl:schedule-remove-error", { detail:{ dates:ordered, message:error?.message || String(error) } }));
      throw error;
    } finally {
      removing = false;
      render(window.FPL_STUDIO_SCHEDULE);
    }
  }

  function onClick(event) {
    const week = event.target.closest?.("[data-remove-week]");
    if (week) {
      removeDates(String(week.dataset.removeWeek || "").split(",").filter(Boolean)).catch(() => {});
      return;
    }
    const day = event.target.closest?.("[data-remove-day]");
    if (day) removeDates([String(day.dataset.removeDay || "")].filter(Boolean)).catch(() => {});
  }

  function waitForUi() {
    if (install()) return;
    setTimeout(waitForUi, 180);
  }

  window.addEventListener("fpl:schedule-status", event => {
    if (!installed || document.getElementById("scheduleManagerPanel")?.dataset.scheduleManagerVersion !== VERSION) install();
    const state = event?.detail ? { ...window.FPL_STUDIO_SCHEDULE, ...event.detail } : window.FPL_STUDIO_SCHEDULE;
    render(state);
  });

  window.FPL_STUDIO_SCHEDULE_MANAGER = Object.freeze({
    version: VERSION,
    render,
    removeDates,
    api
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForUi, { once:true });
  else waitForUi();
})();
