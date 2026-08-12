/* FPL Draft Challenge — all-time leaderboard tab. */
(() => {
  "use strict";
  const cfg = window.FPL_LEADERBOARD_CONFIG;
  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  if (!cfg?.enabled || !cfg?.functions?.allTime || runtime.archiveMode) return;

  const CLIENT_KEY = "fpl-v5-leaderboard-client-id";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const functionUrl = name => `${String(cfg.supabaseUrl || "").replace(/\/$/,"")}/functions/v1/${encodeURIComponent(name)}`;
  let mode = "today";
  let todayStatus = "Verified daily leaderboard.";
  let loaded = false;
  let loading = false;

  async function api(body) {
    const response = await fetch(functionUrl(cfg.functions.allTime), {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": cfg.publishableKey },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data?.message || data?.error || `All-time leaderboard request failed (${response.status})`);
    return data || {};
  }

  function addStyles() {
    if (document.getElementById("leaderboardAllTimeStyles")) return;
    const style = document.createElement("style");
    style.id = "leaderboardAllTimeStyles";
    style.textContent = `
      .leaderboard-tabs{display:inline-flex;gap:6px;margin:14px 0 2px;padding:4px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
      .leaderboard-tab{border:0;border-radius:9px;background:transparent;color:var(--muted);padding:8px 13px;font:inherit;font-size:.69rem;font-weight:950;cursor:pointer}
      .leaderboard-tab[aria-selected="true"]{background:rgba(0,255,135,.11);color:var(--accent);box-shadow:inset 0 0 0 1px rgba(0,255,135,.17)}
      .leaderboard-alltime[hidden]{display:none!important}.leaderboard-alltime{margin-top:12px}
      .leaderboard-alltime-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px}.leaderboard-alltime-toolbar span{color:var(--muted);font-size:.7rem}.leaderboard-alltime-toolbar strong{color:#fff}
      .leaderboard-alltime-personal{margin:0 0 12px;padding:13px;border-radius:16px;background:linear-gradient(130deg,rgba(95,229,255,.08),rgba(0,255,135,.06));border:1px solid rgba(95,229,255,.18)}
      .leaderboard-alltime-personal[hidden]{display:none!important}.leaderboard-alltime-personal-grid{display:grid;grid-template-columns:auto repeat(5,minmax(0,1fr));gap:10px;align-items:center}.leaderboard-alltime-personal-grid>div span,.leaderboard-alltime-personal-grid>div strong{display:block}.leaderboard-alltime-personal-grid>div span{font-size:.56rem;color:var(--muted);text-transform:uppercase;font-weight:900;letter-spacing:.05em}.leaderboard-alltime-personal-grid>div strong{margin-top:3px;color:#fff;font-size:.88rem}.leaderboard-alltime-rank{min-width:70px;padding:10px;border-radius:14px;text-align:center;background:rgba(0,255,135,.08);border:1px solid rgba(0,255,135,.18)}.leaderboard-alltime-rank strong{font-size:1.3rem!important;color:var(--accent)!important}
      .leaderboard-alltime-note{margin:10px 2px 0;color:var(--muted);font-size:.64rem;line-height:1.5}.leaderboard-alltime-note strong{color:#dcece3}
      .leaderboard-alltime-error{padding:12px;border-radius:13px;background:rgba(255,85,119,.07);border:1px solid rgba(255,85,119,.2);color:#ffc0ce;font-size:.7rem}
      @media(max-width:760px){.leaderboard-alltime-personal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.leaderboard-alltime-rank{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function formatScore(value) { return (Number(value) || 0).toFixed(1); }
  function formatEfficiency(value) { return `${(Number(value) || 0).toFixed(1)}%`; }

  function renderViewer(viewer) {
    const host = document.getElementById("leaderboardAllTimePersonal");
    if (!host) return;
    if (!viewer) { host.hidden = true; host.innerHTML = ""; return; }
    host.hidden = false;
    host.innerHTML = `<div class="leaderboard-alltime-personal-grid">
      <div class="leaderboard-alltime-rank"><span>Your rank</span><strong>#${Number(viewer.rank)||0}</strong></div>
      <div><span>All-Time Score</span><strong>${formatScore(viewer.allTimeScore)}</strong></div>
      <div><span>Games</span><strong>${Number(viewer.gamesPlayed)||0}</strong></div>
      <div><span>Avg efficiency</span><strong>${formatEfficiency(viewer.averageEfficiency)}</strong></div>
      <div><span>Wins</span><strong>${Number(viewer.wins)||0}</strong></div>
      <div><span>Podiums</span><strong>${Number(viewer.podiums)||0}</strong></div>
    </div>`;
  }

  function renderRows(entries) {
    const body = document.getElementById("leaderboardAllTimeRows");
    if (!body) return;
    if (!entries.length) {
      body.innerHTML = `<tr><td colspan="7" class="leaderboard-empty">No verified all-time results yet.</td></tr>`;
      return;
    }
    body.innerHTML = entries.map(row => `<tr class="${row.isCurrentDevice ? "leaderboard-row-me" : ""}">
      <td>${Number(row.rank)||0}</td>
      <td>${esc(row.displayName || "Player")}${row.isCurrentDevice ? " · You" : ""}</td>
      <td><strong>${formatScore(row.allTimeScore)}</strong></td>
      <td>${Number(row.gamesPlayed)||0}</td>
      <td>${formatEfficiency(row.averageEfficiency)}</td>
      <td>${Number(row.wins)||0}</td>
      <td>${Number(row.podiums)||0}</td>
    </tr>`).join("");
  }

  async function loadAllTime(force = false) {
    if (loading || (loaded && !force)) return;
    loading = true;
    const count = document.getElementById("leaderboardAllTimeCount");
    const refresh = document.getElementById("leaderboardAllTimeRefresh");
    if (count) count.textContent = "Loading all-time standings…";
    if (refresh) refresh.disabled = true;
    try {
      const data = await api({
        clientId: localStorage.getItem(CLIENT_KEY) || "",
        limit: Number(cfg.allTimeLimit) || 50
      });
      renderRows(Array.isArray(data.entries) ? data.entries : []);
      renderViewer(data.viewer || null);
      if (count) count.innerHTML = `<strong>${Number(data.totalPlayers)||0}</strong> all-time players`;
      loaded = true;
    } catch (error) {
      const body = document.getElementById("leaderboardAllTimeRows");
      if (body) body.innerHTML = `<tr><td colspan="7"><div class="leaderboard-alltime-error">${esc(error?.message || "All-time leaderboard is unavailable.")}</div></td></tr>`;
      if (count) count.textContent = "All-time standings unavailable";
    } finally {
      loading = false;
      if (refresh) refresh.disabled = false;
    }
  }

  function toggleTodayNodes(panel, hidden) {
    const selectors = [
      ".leaderboard-toolbar", "#leaderboardSubmitCard", "#leaderboardMessage",
      "#leaderboardPersonal", "#leaderboardPodium", ".leaderboard-table-wrap",
      "#leaderboardRankingRules"
    ];
    selectors.forEach(selector => panel.querySelectorAll(selector).forEach(node => {
      node.style.display = hidden ? "none" : "";
    }));
  }

  function setMode(next) {
    const panel = document.getElementById("liveLeaderboardPanel");
    const section = document.getElementById("leaderboardAllTime");
    const title = panel?.querySelector(".leaderboard-head h2");
    const status = document.getElementById("leaderboardStatus");
    if (!panel || !section) return;
    mode = next;
    document.querySelectorAll(".leaderboard-tab").forEach(button => button.setAttribute("aria-selected", String(button.dataset.leaderboardTab === mode)));
    const allTime = mode === "alltime";
    toggleTodayNodes(panel, allTime);
    section.hidden = !allTime;
    if (allTime) {
      if (title) title.textContent = "All-Time Leaderboard";
      if (status) status.textContent = "Every verified daily challenge contributes to the overall standings.";
      loadAllTime();
    } else {
      if (title) title.textContent = "Today’s Top 20";
      if (status) status.textContent = todayStatus || "Verified daily leaderboard.";
      window.FPL_LEADERBOARD_REFRESH?.();
    }
  }

  function install() {
    const panel = document.getElementById("liveLeaderboardPanel");
    if (!panel || document.getElementById("leaderboardTabs")) return Boolean(panel);
    const head = panel.querySelector(".leaderboard-head");
    const status = document.getElementById("leaderboardStatus");
    if (!head) return false;
    addStyles();
    if (status?.textContent) todayStatus = status.textContent;

    const tabs = document.createElement("nav");
    tabs.id = "leaderboardTabs";
    tabs.className = "leaderboard-tabs";
    tabs.setAttribute("aria-label", "Leaderboard view");
    tabs.innerHTML = `<button class="leaderboard-tab" data-leaderboard-tab="today" aria-selected="true" type="button">Today</button><button class="leaderboard-tab" data-leaderboard-tab="alltime" aria-selected="false" type="button">All-Time</button>`;
    head.insertAdjacentElement("afterend", tabs);

    const section = document.createElement("section");
    section.id = "leaderboardAllTime";
    section.className = "leaderboard-alltime";
    section.hidden = true;
    section.innerHTML = `
      <div class="leaderboard-alltime-toolbar"><span id="leaderboardAllTimeCount">All-time standings</span><button class="leaderboard-refresh" id="leaderboardAllTimeRefresh" type="button">Refresh</button></div>
      <div class="leaderboard-alltime-personal" id="leaderboardAllTimePersonal" hidden></div>
      <div class="leaderboard-table-wrap"><table class="leaderboard-table"><thead><tr><th>#</th><th>Player</th><th>All-Time Score</th><th>Games</th><th>Avg Eff.</th><th>Wins</th><th>Podiums</th></tr></thead><tbody id="leaderboardAllTimeRows"><tr><td colspan="7" class="leaderboard-empty">Open All-Time to load standings.</td></tr></tbody></table></div>
      <p class="leaderboard-alltime-note"><strong>Scoring:</strong> each verified daily efficiency contributes up to 100 All-Time points. Ties go to higher average efficiency, then more wins, more podiums, then the earliest first verified entry. All-Time identity is currently tied to this browser/device until accounts are added.</p>`;
    tabs.insertAdjacentElement("afterend", section);

    tabs.addEventListener("click", event => {
      const button = event.target.closest("[data-leaderboard-tab]");
      if (button) setMode(button.dataset.leaderboardTab === "alltime" ? "alltime" : "today");
    });
    document.getElementById("leaderboardAllTimeRefresh")?.addEventListener("click", () => loadAllTime(true));

    if (status) new MutationObserver(() => { if (mode === "today") todayStatus = status.textContent || todayStatus; }).observe(status, { childList: true, subtree: true, characterData: true });
    new MutationObserver(() => { if (mode === "alltime") toggleTodayNodes(panel, true); }).observe(panel, { childList: true });
    return true;
  }

  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
