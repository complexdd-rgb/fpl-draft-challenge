/* FPL Challenge Studio — spoiler-safe schedule manager v1.0.1
   Lists future Supabase challenge batches using safe metadata only and allows an admin
   to remove a future day or week. Removal deactivates schedule/verifier rows but keeps
   any historical leaderboard attempts and entries intact. */
(() => {
  "use strict";

  if (window.__FPL_SCHEDULE_MANAGER_V1__) return;
  window.__FPL_SCHEDULE_MANAGER_V1__ = true;

  const cfg = window.FPL_LEADERBOARD_CONFIG;
  const authBridge = window.FPL_ACCOUNT_AUTH;
  if (!cfg?.dailyPublishing?.enabled) return;

  const endpoint = `${String(cfg.supabaseUrl || "").replace(/\/$/, "")}/functions/v1/${encodeURIComponent(cfg.dailyPublishing.function || "daily-challenge-publish")}`;
  let removing = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

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
    return new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", ...(withYear ? { year:"numeric" } : {}) }).format(date);
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
    return typeof authBridge?.getAccessToken === "function" ? await authBridge.getAccessToken() : "";
  }

  async function api(body) {
    const token = await accessToken();
    if (!token) throw new Error("Sign in on the live game first, then return to Studio.");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type":"application/json", "apikey":cfg.publishableKey, "Authorization":`Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data?.message || data?.error || `Schedule request failed (${response.status}).`);
    return data || {};
  }

  function installStyles() {
    if (document.getElementById("fpl-schedule-manager-css")) return;
    const style = document.createElement("style");
    style.id = "fpl-schedule-manager-css";
    style.textContent = `
      .schedule-manager{margin:14px 0 4px;border:1px solid rgba(98,201,255,.16);border-radius:17px;background:linear-gradient(145deg,rgba(9,29,21,.92),rgba(5,21,15,.96));overflow:hidden}
      .schedule-manager>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 15px;cursor:pointer;list-style:none}.schedule-manager>summary::-webkit-details-marker{display:none}
      .schedule-manager-head small,.schedule-manager-head strong{display:block}.schedule-manager-head small{color:#62c9ff;font-size:.64rem;font-weight:950;letter-spacing:.09em;text-transform:uppercase}.schedule-manager-head strong{margin-top:3px;color:#f4fff8;font-size:.95rem}
      .schedule-manager-chip{flex:0 0 auto;padding:5px 8px;border:1px solid rgba(57,232,143,.18);border-radius:999px;background:rgba(57,232,143,.06);color:#63eaa1;font-size:.62rem;font-weight:950;letter-spacing:.05em;text-transform:uppercase}
      .schedule-manager-body{padding:0 15px 15px}.schedule-manager-note{margin:0 0 11px;color:#8ea99a;font-size:.7rem;line-height:1.45}.schedule-manager-status{margin:0 0 10px;color:#9bb7a8;font-size:.72rem}
      .schedule-batch-list{display:grid;gap:9px}.schedule-batch{padding:12px;border:1px solid rgba(174,226,199,.11);border-radius:13px;background:rgba(0,0,0,.12)}
      .schedule-batch-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}.schedule-batch-head strong,.schedule-batch-head small{display:block}.schedule-batch-head strong{color:#f4fff8;font-size:.82rem}.schedule-batch-head small{margin-top:3px;color:#8ea99a;font-size:.66rem}.schedule-remove-button{min-height:34px;padding:7px 10px;border:1px solid rgba(255,127,153,.28);border-radius:10px;background:rgba(255,127,153,.07);color:#ff9aad;font-size:.68rem;font-weight:950;cursor:pointer}.schedule-remove-button:disabled{opacity:.45;cursor:not-allowed}
      .schedule-days{margin-top:9px;border-top:1px solid rgba(174,226,199,.08);padding-top:8px}.schedule-days summary{color:#9bb7a8;font-size:.66rem;font-weight:850;cursor:pointer}.schedule-day-list{display:grid;gap:5px;margin-top:7px}.schedule-day{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 8px;border:1px solid rgba(174,226,199,.08);border-radius:9px;background:rgba(255,255,255,.018)}.schedule-day span{color:#dcece3;font-size:.7rem}.schedule-day button{padding:5px 8px;border:1px solid rgba(255,127,153,.18);border-radius:8px;background:transparent;color:#eaa0af;font-size:.62rem;font-weight:900;cursor:pointer}
      .schedule-empty{padding:12px;border:1px dashed rgba(174,226,199,.12);border-radius:11px;color:#9bb7a8;font-size:.72rem;text-align:center}
      @media(max-width:430px){.schedule-manager>summary{padding:13px}.schedule-manager-body{padding:0 13px 13px}.schedule-batch-head{grid-template-columns:1fr}.schedule-remove-button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (document.getElementById("scheduleManagerPanel")) return true;
    const anchor = document.getElementById("spoilerPublishFlow") || document.getElementById("dailyPublishStatus") || document.getElementById("batchStatus");
    if (!anchor) return false;
    installStyles();
    const panel = document.createElement("details");
    panel.id = "scheduleManagerPanel";
    panel.className = "schedule-manager";
    panel.innerHTML = `
      <summary><span class="schedule-manager-head"><small>Schedule control</small><strong>Manage scheduled challenges</strong></span><span class="schedule-manager-chip">Future only</span></summary>
      <div class="schedule-manager-body">
        <p class="schedule-manager-note">Spoiler-safe: only dates and batch sizes are shown. Removing a challenge stops it going live but preserves any existing leaderboard history.</p>
        <p class="schedule-manager-status" data-schedule-manager-status>Loading future schedule…</p>
        <div class="schedule-batch-list" data-schedule-batch-list></div>
      </div>`;
    anchor.insertAdjacentElement("afterend", panel);
    panel.addEventListener("click", onClick);
    render(window.FPL_STUDIO_SCHEDULE);
    return true;
  }

  function render(apiState) {
    const panel = document.getElementById("scheduleManagerPanel");
    if (!panel) return;
    const status = panel.querySelector("[data-schedule-manager-status]");
    const list = panel.querySelector("[data-schedule-batch-list]");
    const state = apiState || window.FPL_STUDIO_SCHEDULE || {};
    const rows = Array.isArray(state.scheduled) ? state.scheduled : [];
    const today = String(state.today || londonToday());

    if (state.status === "loading") {
      status.textContent = "Loading future schedule…";
      list.innerHTML = "";
      return;
    }
    if (state.status === "unavailable") {
      status.textContent = state.error || "Schedule management is unavailable.";
      list.innerHTML = "";
      return;
    }

    const futureRows = rows.filter(row => String(row.release_date) > today);
    status.textContent = `${futureRows.length} future scheduled challenge${futureRows.length === 1 ? "" : "s"}.`;
    if (!futureRows.length) {
      list.innerHTML = '<div class="schedule-empty">No removable future challenges are scheduled.</div>';
      return;
    }

    const groups = groupBatches(futureRows);
    list.innerHTML = groups.map((items,index) => {
      const dates = items.map(item => String(item.release_date));
      const first = dates[0], last = dates[dates.length - 1];
      const range = first === last ? dateLabel(first,true) : `${dateLabel(first)} – ${dateLabel(last,true)}`;
      return `<article class="schedule-batch" data-schedule-batch="${index}">
        <div class="schedule-batch-head"><div><strong>${esc(range)}</strong><small>${items.length} scheduled challenge${items.length===1?"":"s"}</small></div><button type="button" class="schedule-remove-button" data-remove-week="${esc(dates.join(","))}" ${removing?"disabled":""}>Remove ${items.length===1?"challenge":"week"}</button></div>
        <details class="schedule-days"><summary>Manage individual days</summary><div class="schedule-day-list">${items.map(item => `<div class="schedule-day"><span>${esc(dateLabel(item.release_date,true))}</span><button type="button" data-remove-day="${esc(item.release_date)}" ${removing?"disabled":""}>Remove day</button></div>`).join("")}</div></details>
      </article>`;
    }).join("");
  }

  async function removeDates(dates) {
    if (removing || !dates.length) return;
    const today = londonToday();
    const ordered = dates.filter(date => String(date) > today).slice().sort();
    if (!ordered.length) return;
    const label = ordered.length === 1 ? dateLabel(ordered[0],true) : `${dateLabel(ordered[0])} – ${dateLabel(ordered[ordered.length-1],true)}`;
    const noun = ordered.length === 1 ? "challenge" : `${ordered.length} scheduled challenges`;
    if (!window.confirm(`Remove ${noun} for ${label}?\n\nThey will no longer go live automatically. Existing leaderboard history, if any, will be preserved.`)) return;

    removing = true;
    render(window.FPL_STUDIO_SCHEDULE);
    const status = document.querySelector("[data-schedule-manager-status]");
    if (status) status.textContent = `Removing ${noun}…`;
    try {
      const result = await api({ action:"remove", dates:ordered });
      if (status) status.textContent = `${Number(result.removed)||0} challenge${Number(result.removed)===1?"":"s"} removed from the future schedule.`;
      await window.FPL_STUDIO_SCHEDULE?.refresh?.();
    } catch (error) {
      if (status) status.textContent = error?.message || "The scheduled challenges could not be removed.";
    } finally {
      removing = false;
      render(window.FPL_STUDIO_SCHEDULE);
    }
  }

  function onClick(event) {
    const week = event.target.closest?.("[data-remove-week]");
    if (week) {
      const dates = String(week.dataset.removeWeek || "").split(",").filter(Boolean);
      removeDates(dates);
      return;
    }
    const day = event.target.closest?.("[data-remove-day]");
    if (day) removeDates([String(day.dataset.removeDay || "")].filter(Boolean));
  }

  function waitForUi() {
    if (install()) return;
    setTimeout(waitForUi, 180);
  }

  window.addEventListener("fpl:schedule-status", event => {
    if (!document.getElementById("scheduleManagerPanel")) install();
    const state = event?.detail ? { ...window.FPL_STUDIO_SCHEDULE, ...event.detail } : window.FPL_STUDIO_SCHEDULE;
    render(state);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitForUi, { once:true });
  else waitForUi();
})();
