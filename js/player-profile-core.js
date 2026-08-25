/* FPL Draft Challenge — signed-in verified player profile. */
(() => {
  "use strict";
  const cfg = window.FPL_LEADERBOARD_CONFIG;
  const authBridge = window.FPL_ACCOUNT_AUTH;
  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const CLIENT_KEY = "fpl-v5-leaderboard-client-id";
  const PROFILE_COLLAPSE_KEY = "fpl-player-profile-collapsed";
  if (!cfg?.enabled || !cfg?.playerProfile || !cfg?.functions?.profile || !authBridge || runtime.archiveMode) return;

  let loading = false;
  let lastPayload = null;
  let lastRefreshAt = 0;
  let queuedRefresh = 0;
  let profileCollapsed = false;
  try { profileCollapsed = localStorage.getItem(PROFILE_COLLAPSE_KEY) === "1"; } catch {}

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const functionUrl = () => `${String(cfg.supabaseUrl || "").replace(/\/$/,"")}/functions/v1/${encodeURIComponent(cfg.functions.profile)}`;
  const formatTime = value => {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2,"0")}`;
  };
  const formatDate = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return String(value || "Daily challenge");
    return new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", timeZone:"UTC" })
      .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)));
  };

  function addStyles() {
    if (document.getElementById("playerProfileStyles")) return;
    const style = document.createElement("style");
    style.id = "playerProfileStyles";
    style.textContent = `
      .player-profile{margin:22px 0;padding:18px;border:1px solid rgba(0,255,135,.14);border-radius:24px;background:linear-gradient(155deg,rgba(15,39,28,.98),rgba(7,22,15,.99));box-shadow:0 18px 50px rgba(0,0,0,.22)}
      .player-profile[hidden]{display:none!important}.player-profile-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;margin-bottom:15px}.player-profile.is-collapsed .player-profile-head{margin-bottom:0}.player-profile-head h2{margin:4px 0 4px;font-size:1.35rem;letter-spacing:-.035em}.player-profile-head p{margin:0;color:var(--muted);font-size:.72rem;line-height:1.5}.player-profile-head-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}.player-profile-sync{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding:7px 10px;border:1px solid rgba(0,255,135,.16);border-radius:999px;background:rgba(0,255,135,.055);color:var(--accent);font-size:.57rem;font-weight:950;text-transform:uppercase;letter-spacing:.07em}.player-profile-sync::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor}.player-profile-toggle{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:30px;padding:7px 10px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.035);color:#dcece3;font:inherit;font-size:.57rem;font-weight:900;text-transform:uppercase;letter-spacing:.055em;cursor:pointer}.player-profile-toggle:hover{background:rgba(255,255,255,.065)}.player-profile-toggle:focus-visible{outline:2px solid var(--accent);outline-offset:2px}.player-profile-toggle-icon{font-size:.72rem;line-height:1}.player-profile-body[hidden]{display:none!important}
      .player-profile-identity{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(290px,.85fr);gap:12px;margin-bottom:12px}.player-profile-card{border:1px solid rgba(255,255,255,.075);border-radius:18px;background:rgba(255,255,255,.025);padding:15px}.player-profile-name{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.player-profile-name strong{display:block;font-size:1.45rem;letter-spacing:-.04em}.player-profile-name span{display:block;margin-top:4px;color:var(--muted);font-size:.64rem}.player-profile-rank{text-align:right}.player-profile-rank span,.player-profile-rank strong{display:block}.player-profile-rank span{color:var(--muted);font-size:.55rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.player-profile-rank strong{margin-top:2px;color:var(--accent);font-size:1.8rem;letter-spacing:-.05em}
      .player-profile-primary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:14px}.player-profile-primary div,.player-profile-stat{padding:10px;border:1px solid rgba(255,255,255,.055);border-radius:13px;background:rgba(0,0,0,.12)}.player-profile-primary span,.player-profile-primary strong,.player-profile-stat span,.player-profile-stat strong{display:block}.player-profile-primary span,.player-profile-stat span{color:var(--muted);font-size:.54rem;font-weight:900;text-transform:uppercase;letter-spacing:.055em}.player-profile-primary strong{margin-top:4px;font-size:1rem}.player-profile-stat strong{margin-top:4px;font-size:.9rem}
      .player-profile-streak{display:flex;align-items:center;justify-content:space-between;gap:12px;height:100%;min-height:126px;background:radial-gradient(circle at 90% 15%,rgba(255,209,102,.11),transparent 11rem),rgba(255,255,255,.025)}.player-profile-streak-copy strong,.player-profile-streak-copy span{display:block}.player-profile-streak-copy strong{font-size:1.05rem}.player-profile-streak-copy span{margin-top:4px;color:var(--muted);font-size:.66rem;line-height:1.45}.player-profile-streak-number{min-width:94px;text-align:center}.player-profile-streak-number strong{display:block;color:#ffd166;font-size:2.6rem;line-height:1;letter-spacing:-.07em}.player-profile-streak-number span{display:block;margin-top:5px;color:var(--muted);font-size:.55rem;text-transform:uppercase;font-weight:900}
      .player-profile-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin:0 0 15px}.player-profile-stat{text-align:left}
      .player-profile-history{border:1px solid rgba(255,255,255,.07);border-radius:17px;overflow:hidden;background:rgba(0,0,0,.09)}.player-profile-history-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 13px;border-bottom:1px solid rgba(255,255,255,.065)}.player-profile-history-head strong{font-size:.78rem}.player-profile-history-head span{color:var(--muted);font-size:.6rem}.player-profile-history-list{display:grid}.player-profile-result{display:grid;grid-template-columns:72px minmax(150px,1.35fr) repeat(5,minmax(66px,.55fr));gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.05);font-size:.7rem}.player-profile-result:last-child{border-bottom:0}.player-profile-result:hover{background:rgba(255,255,255,.018)}.player-profile-result-date strong,.player-profile-result-date span,.player-profile-result-main strong,.player-profile-result-main span,.player-profile-result-metric strong,.player-profile-result-metric span{display:block}.player-profile-result-date strong{color:#dcece3;font-size:.7rem}.player-profile-result-date span{margin-top:2px;color:var(--muted);font-size:.55rem}.player-profile-result-main{min-width:0}.player-profile-result-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.72rem}.player-profile-result-main span{margin-top:2px;color:var(--muted);font-size:.56rem}.player-profile-result-metric strong{font-size:.72rem}.player-profile-result-metric span{margin-top:2px;color:var(--muted);font-size:.52rem;text-transform:uppercase;font-weight:850}.player-profile-result-metric.rank strong{color:var(--accent)}.player-profile-empty{padding:24px 16px;color:var(--muted);font-size:.72rem;line-height:1.5;text-align:center}.player-profile-error{padding:12px;border:1px solid rgba(255,85,119,.2);border-radius:13px;background:rgba(255,85,119,.06);color:#ffc0ce;font-size:.68rem;line-height:1.45}
      @media(max-width:900px){.player-profile-identity{grid-template-columns:1fr}.player-profile-stats{grid-template-columns:repeat(3,1fr)}.player-profile-result{grid-template-columns:65px minmax(140px,1fr) repeat(3,minmax(62px,.55fr))}.player-profile-result-metric.optional{display:none}}
      @media(max-width:620px){.player-profile{padding:14px;border-radius:20px}.player-profile-head{flex-direction:column}.player-profile-head-actions{width:100%;justify-content:space-between}.player-profile-sync{align-self:flex-start}.player-profile.is-collapsed .player-profile-head{flex-direction:row;align-items:center}.player-profile.is-collapsed .player-profile-head-copy .overview-kicker,.player-profile.is-collapsed .player-profile-head-copy p{display:none}.player-profile.is-collapsed .player-profile-head h2{margin:0}.player-profile.is-collapsed .player-profile-head-actions{width:auto}.player-profile.is-collapsed .player-profile-sync{display:none}.player-profile-primary{grid-template-columns:repeat(3,1fr)}.player-profile-stats{grid-template-columns:repeat(2,1fr)}.player-profile-result{grid-template-columns:58px minmax(105px,1fr) 52px 62px}.player-profile-result-metric.mobile-hide{display:none}.player-profile-result-main strong{font-size:.68rem}.player-profile-history{overflow-x:hidden}}
      @media(max-width:390px){.player-profile{padding:12px}.player-profile-name{align-items:flex-start}.player-profile-name strong{font-size:1.22rem}.player-profile-rank strong{font-size:1.5rem}.player-profile-primary{gap:5px}.player-profile-primary div,.player-profile-stat{padding:8px}.player-profile-streak{min-height:110px}.player-profile-streak-number{min-width:72px}.player-profile-streak-number strong{font-size:2.25rem}.player-profile-result{grid-template-columns:52px minmax(92px,1fr) 48px 56px;padding:9px 8px;gap:6px}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    let panel = document.getElementById("playerProfilePanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "playerProfilePanel";
    panel.className = "player-profile";
    panel.hidden = true;
    const leaderboard = document.getElementById("liveLeaderboardPanel");
    const localStats = document.getElementById("phase45ExtendedStats");
    if (leaderboard?.parentNode) leaderboard.parentNode.insertBefore(panel, leaderboard);
    else if (localStats?.parentNode) localStats.insertAdjacentElement("afterend", panel);
    else document.querySelector("main.app")?.appendChild(panel);
    return panel;
  }

  function toggleLocalStats(profileVisible) {
    const local = document.getElementById("phase45ExtendedStats");
    if (!local) return;
    if (profileVisible) {
      if (!local.dataset.profilePriorDisplay) local.dataset.profilePriorDisplay = local.style.display || "__empty__";
      local.style.display = "none";
    } else if (local.dataset.profilePriorDisplay) {
      local.style.display = local.dataset.profilePriorDisplay === "__empty__" ? "" : local.dataset.profilePriorDisplay;
      delete local.dataset.profilePriorDisplay;
    }
  }

  function setProfileCollapsed(panel, collapsed, persist = false) {
    profileCollapsed = Boolean(collapsed);
    panel.classList.toggle("is-collapsed", profileCollapsed);
    const body = panel.querySelector("#playerProfileBody");
    if (body) body.hidden = profileCollapsed;
    const toggle = panel.querySelector(".player-profile-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(!profileCollapsed));
      toggle.setAttribute("aria-label", profileCollapsed ? "Expand verified record" : "Collapse verified record");
      const label = toggle.querySelector(".player-profile-toggle-label");
      const icon = toggle.querySelector(".player-profile-toggle-icon");
      if (label) label.textContent = profileCollapsed ? "Show" : "Hide";
      if (icon) icon.textContent = profileCollapsed ? "▾" : "▴";
    }
    if (persist) {
      try { localStorage.setItem(PROFILE_COLLAPSE_KEY, profileCollapsed ? "1" : "0"); } catch {}
    }
  }

  async function api() {
    const response = await fetch(functionUrl(), {
      method: "POST",
      headers: { "Content-Type":"application/json", "apikey":cfg.publishableKey },
      body: JSON.stringify({ clientId: localStorage.getItem(CLIENT_KEY) || "", recentLimit: 12 }),
      cache: "no-store"
    });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Profile request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data || {};
  }

  function render(payload) {
    lastPayload = payload;
    const panel = mount();
    const profile = payload?.profile || {};
    const recent = Array.isArray(payload?.recent) ? payload.recent : [];
    addStyles();
    panel.hidden = false;
    toggleLocalStats(true);
    panel.innerHTML = `
      <div class="player-profile-head">
        <div class="player-profile-head-copy"><span class="overview-kicker">Synced player profile</span><h2>Your verified record</h2><p>Account-wide stats from verified Daily Challenge finishes across every linked device.</p></div>
        <div class="player-profile-head-actions">
          <span class="player-profile-sync">Account synced</span>
          <button type="button" class="player-profile-toggle" aria-expanded="${String(!profileCollapsed)}" aria-controls="playerProfileBody" aria-label="${profileCollapsed ? "Expand verified record" : "Collapse verified record"}"><span class="player-profile-toggle-label">${profileCollapsed ? "Show" : "Hide"}</span><span class="player-profile-toggle-icon" aria-hidden="true">${profileCollapsed ? "▾" : "▴"}</span></button>
        </div>
      </div>
      <div class="player-profile-body" id="playerProfileBody"${profileCollapsed ? " hidden" : ""}>
        <div class="player-profile-identity">
          <article class="player-profile-card">
            <div class="player-profile-name"><div><strong>${esc(profile.displayName || "Player")}</strong><span>${Number(profile.gamesPlayed)||0} verified ${Number(profile.gamesPlayed)===1?"game":"games"} · cross-device record</span></div><div class="player-profile-rank"><span>All-Time rank</span><strong>${Number(profile.allTimeRank)>0?`#${Number(profile.allTimeRank)}`:"–"}</strong></div></div>
            <div class="player-profile-primary">
              <div><span>All-Time score</span><strong>${Number(profile.allTimeScore||0).toFixed(1)}</strong></div>
              <div><span>Avg efficiency</span><strong>${Number(profile.averageEfficiency||0).toFixed(1)}%</strong></div>
              <div><span>Best daily rank</span><strong>${Number(profile.bestRank)>0?`#${Number(profile.bestRank)}`:"–"}</strong></div>
            </div>
          </article>
          <article class="player-profile-card player-profile-streak">
            <div class="player-profile-streak-copy"><strong>Daily streak</strong><span>${Number(profile.currentStreak)>0?"Your verified streak is still active.":"Complete today’s verified challenge to build your active streak."}<br>Longest streak: ${Number(profile.longestStreak)||0} ${Number(profile.longestStreak)===1?"day":"days"}.</span></div>
            <div class="player-profile-streak-number"><strong>${Number(profile.currentStreak)||0}</strong><span>current days</span></div>
          </article>
        </div>
        <div class="player-profile-stats">
          <div class="player-profile-stat"><span>Best score</span><strong>${Number(profile.bestScore||0).toLocaleString()}</strong></div>
          <div class="player-profile-stat"><span>Best efficiency</span><strong>${Number(profile.bestEfficiency||0).toFixed(1)}%</strong></div>
          <div class="player-profile-stat"><span>Fastest finish</span><strong>${formatTime(profile.fastestSeconds)}</strong></div>
          <div class="player-profile-stat"><span>Wins · podiums</span><strong>${Number(profile.wins)||0} · ${Number(profile.podiums)||0}</strong></div>
          <div class="player-profile-stat"><span>Perfect picks</span><strong>${Number(profile.perfectPromptPicks)||0}</strong></div>
          <div class="player-profile-stat"><span>Penalty-free</span><strong>${Number(profile.penaltyFreeGames)||0} / ${Number(profile.gamesPlayed)||0}</strong></div>
        </div>
        <section class="player-profile-history">
          <div class="player-profile-history-head"><strong>Recent verified challenges</strong><span>Newest first · synced across devices</span></div>
          <div class="player-profile-history-list">
            ${recent.length ? recent.map(row => `
              <article class="player-profile-result">
                <div class="player-profile-result-date"><strong>${esc(formatDate(row.releaseDate))}</strong><span>#${Number(row.challengeNumber)||"–"}</span></div>
                <div class="player-profile-result-main"><strong>${esc(String(row.title||"Daily Challenge").replace(/^\d{1,2}\s+\w+\s+\d{4}\s+·\s*/,""))}</strong><span>${Number(row.perfectPromptPicks)||0} best ${Number(row.perfectPromptPicks)===1?"pick":"picks"}${Number(row.penaltyPoints)?` · −${Number(row.penaltyPoints)} pen.`:" · clean"}</span></div>
                <div class="player-profile-result-metric rank"><strong>${Number(row.rank)>0?`#${Number(row.rank)}`:"–"}</strong><span>rank</span></div>
                <div class="player-profile-result-metric"><strong>${Number(row.finalScore||0).toLocaleString()}</strong><span>score</span></div>
                <div class="player-profile-result-metric mobile-hide"><strong>${Number(row.efficiency||0).toFixed(1)}%</strong><span>eff.</span></div>
                <div class="player-profile-result-metric optional mobile-hide"><strong>${formatTime(row.elapsedSeconds)}</strong><span>time</span></div>
                <div class="player-profile-result-metric optional mobile-hide"><strong>${Number(row.perfectScore||0).toLocaleString()}</strong><span>perfect</span></div>
              </article>`).join("") : `<div class="player-profile-empty">Your synced profile is ready. Complete a verified Daily Challenge while signed in and it will appear here automatically.</div>`}
          </div>
        </section>
      </div>`;
    const toggle = panel.querySelector(".player-profile-toggle");
    toggle?.addEventListener("click", () => setProfileCollapsed(panel, !profileCollapsed, true));
    setProfileCollapsed(panel, profileCollapsed);
  }

  function hideProfile() {
    const panel = document.getElementById("playerProfilePanel");
    if (panel) panel.hidden = true;
    toggleLocalStats(false);
  }

  async function refresh(force = false) {
    if (loading) return;
    if (!force && lastPayload && Date.now() - lastRefreshAt < 120000) return;
    loading = true;
    try {
      const token = await authBridge.getAccessToken();
      if (!token) { hideProfile(); return; }
      const panel = mount();
      panel.hidden = false;
      toggleLocalStats(true);
      if (!lastPayload) panel.innerHTML = `<div class="player-profile-empty">Loading your synced verified profile…</div>`;
      render(await api());
      lastRefreshAt = Date.now();
    } catch (error) {
      if (Number(error?.status) === 401) { hideProfile(); return; }
      const panel = mount();
      panel.hidden = false;
      toggleLocalStats(true);
      panel.innerHTML = `<div class="player-profile-error">${esc(error?.message || "Your synced profile is temporarily unavailable.")}</div>`;
    } finally { loading = false; }
  }

  function scheduleRefresh(delay = 0, force = false) {
    if (queuedRefresh) clearTimeout(queuedRefresh);
    queuedRefresh = setTimeout(() => { queuedRefresh = 0; refresh(force); }, delay);
  }

  window.FPL_PLAYER_PROFILE_REFRESH = () => refresh(true);
  window.addEventListener("fpl:account-auth-changed", () => { lastPayload = null; lastRefreshAt = 0; scheduleRefresh(80, true); });
  // Daily leaderboard refreshes happen frequently. Keep the synced profile fresh enough for
  // changing ranks without re-running its heavier verified-history query on every poll.
  window.addEventListener("fpl:leaderboard-updated", () => { if (lastPayload && Date.now() - lastRefreshAt >= 120000) scheduleRefresh(120); });
  window.addEventListener("fpl:challenge-completed", () => scheduleRefresh(700, true));

  if (!document.getElementById("playerProfilePanel")) {
    const initialObserver = new MutationObserver((_, observer) => {
      if (document.getElementById("liveLeaderboardPanel") || document.getElementById("phase45ExtendedStats")) {
        mount();
        observer.disconnect();
      }
    });
    initialObserver.observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(() => initialObserver.disconnect(), 8000);
  }
  refresh(true);
})();