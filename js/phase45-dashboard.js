(() => {
  "use strict";
  const challenge = window.FPL_DAILY_CHALLENGE || null;
  if (!challenge) return;
  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const dailyTime = window.FPL_DAILY_TIME || {};
  const historyStore = "fpl-v4-local-history";
  const qa = sel => [...document.querySelectorAll(sel)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const loadHistory = () => { try { const value = JSON.parse(localStorage.getItem(historyStore) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
  const officialHistory = () => loadHistory().filter(item => item && item.completed === true && item.official !== false);
  const dayNumber = value => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||"")); return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2])-1, Number(m[3])) / 86400000) : null; };
  const streak = items => { const days = [...new Set(items.map(item => dayNumber(item.challengeDate)).filter(Number.isFinite))].sort((a,b)=>a-b); if (!days.length) return 0; let run = 1; for (let i = days.length - 1; i > 0; i--) { if (days[i] - days[i-1] === 1) run++; else break; } return run; };
  const best = arr => arr.length ? Math.max(...arr) : 0;
  const average = arr => arr.length ? arr.reduce((sum, value) => sum + value, 0) / arr.length : 0;

  function challengeDateLabel(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!m) return String(value || "Daily Challenge");
    return new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"long", year:"numeric", timeZone:"UTC" })
      .format(new Date(Date.UTC(Number(m[1]), Number(m[2])-1, Number(m[3]), 12)));
  }

  function nextChallengeText() {
    if (runtime.archiveMode) return "Practice mode";
    if (!runtime.nextScheduledDate || typeof dailyTime.millisecondsUntilUkDate !== "function" || typeof dailyTime.formatCountdown !== "function") return "Not scheduled";
    const remain = dailyTime.millisecondsUntilUkDate(runtime.nextScheduledDate);
    return remain > 0 ? dailyTime.formatCountdown(remain) : "Ready";
  }

  function renderHero() {
    const mount = document.getElementById("phase45Hero");
    if (!mount) return;
    const history = officialHistory();
    const currentStreak = streak(history);
    const pageTitle = challenge.title || "FPL Daily Challenge";
    const title = document.getElementById("title");
    if (title) title.textContent = `FPL Daily Challenge · ${pageTitle}`;
    document.title = `${pageTitle} · FPL Draft Challenge`;
    mount.innerHTML = `<article class="phase45-dashboard player-ui-compact-dashboard"><span class="phase45-kicker">${esc(runtime.archiveMode ? "Archive practice" : "Today’s challenge")} · ${esc(challenge.difficulty || challenge.dateLabel || "Daily game")}</span><h2>${esc(pageTitle)}</h2><div class="phase45-metrics"><div class="phase45-metric"><span>Date</span><strong>${esc(challengeDateLabel(challenge.releaseDate))}</strong></div><div class="phase45-metric"><span>Formation</span><strong>${esc(challenge.formation || "4-4-2")}</strong></div><div class="phase45-metric"><span>Streak</span><strong>${currentStreak} day${currentStreak === 1 ? "" : "s"}</strong></div><div class="phase45-metric"><span>Next challenge</span><strong id="phase45HeroCountdown">${esc(nextChallengeText())}</strong></div></div></article>`;
  }

  function renderExtendedStats() {
    const mount = document.getElementById("historyGridExtended");
    if (!mount) return;
    const history = officialHistory();
    const scores = history.map(item => Number(item.finalScore)).filter(Number.isFinite);
    const efficiencies = history.map(item => Number(item.efficiency)).filter(Number.isFinite);
    const penalties = history.map(item => Number(item.penalties)).filter(Number.isFinite);
    const exactMatches = history.map(item => Number(item.exactPerfectXiMatches)).filter(Number.isFinite);
    const perfectPickRate = history.length ? history.reduce((sum, item) => sum + (Number(item.perfectPromptPicks) || 0), 0) / (history.length * 11) * 100 : 0;
    mount.innerHTML = `<div class="history-chip"><span>Games played</span><strong>${history.length.toLocaleString()}</strong></div><div class="history-chip"><span>Current streak</span><strong>${streak(history)} day${streak(history) === 1 ? "" : "s"}</strong></div><div class="history-chip"><span>Best score</span><strong>${best(scores).toLocaleString()}</strong></div><div class="history-chip"><span>Best efficiency</span><strong>${efficiencies.length ? `${best(efficiencies).toFixed(1)}%` : "0%"}</strong></div><div class="history-chip"><span>Average efficiency</span><strong>${history.length ? `${average(efficiencies).toFixed(1)}%` : "0%"}</strong></div><div class="history-chip"><span>Average penalties</span><strong>${history.length ? average(penalties).toFixed(1) : "0.0"}</strong></div><div class="history-chip"><span>Perfect-pick rate</span><strong>${history.length ? `${perfectPickRate.toFixed(1)}%` : "0%"}</strong></div><div class="history-chip"><span>Exact XI matches</span><strong>${best(exactMatches).toLocaleString()}</strong></div>`;
  }

  function buildShareText() {
    const score = document.getElementById("finalScore")?.textContent || "0";
    const efficiency = document.getElementById("efficiency")?.textContent || "0%";
    const time = document.getElementById("timeTaken")?.textContent || "0:00";
    const penalties = document.getElementById("penaltyPoints")?.textContent || "0";
    const grade = document.getElementById("grade")?.textContent || "–";
    const grid = qa(".slot.valid.compact-confirmed").map(slot => {
      const percent = Number((slot.querySelector(".compact-efficiency strong")?.textContent || "0").replace(/[^\d.]/g, ""));
      if (percent >= 99.95) return "🟨";
      if (percent >= 90) return "🟩";
      if (percent >= 75) return "🟦";
      return "🟥";
    });
    const rows=[];
    for (let i=0;i<grid.length;i+=4) rows.push(grid.slice(i,i+4).join(""));
    return `FPL Draft Challenge · ${challengeDateLabel(challenge.releaseDate)}\n${challenge.title}\n${runtime.archiveMode ? "Archive practice\n" : ""}${rows.join("\n")}\n\nScore: ${score} / ${challenge.perfectScore}\nEfficiency: ${efficiency} · Grade ${grade}\nTime: ${time} · Penalties: ${penalties}\n\nCan you beat my historical XI?`;
  }

  const shareBtn = document.getElementById("shareResult");
  const copyStatus = document.getElementById("copyStatus");
  if (shareBtn) shareBtn.addEventListener("click", async () => {
    const text = buildShareText();
    try {
      if (navigator.share) {
        await navigator.share({ title: challenge.title || "FPL Draft Challenge", text, url: location.href });
        if (copyStatus) copyStatus.textContent = "Result shared.";
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        if (copyStatus) copyStatus.textContent = "Share text copied.";
      } else if (copyStatus) copyStatus.textContent = text;
    } catch (error) {
      if (!(error && error.name === "AbortError") && copyStatus) copyStatus.textContent = "Sharing was not available.";
    }
  });

  function jumpTarget(target) {
    if (target === "top") return document.querySelector("main") || document.body;
    if (target === "archive") return document.querySelector(".challenge-calendar-nav") || document.getElementById("phase45Shell");
    if (target === "stats") {
      const stats = document.getElementById("phase45ExtendedStats");
      if (stats?.tagName === "DETAILS") stats.open = true;
      return stats || document.querySelector(".history");
    }
    if (target === "results") return document.getElementById("results") || document.getElementById("reveal");
    if (target === "next") return document.querySelector(".slot:not(.valid)") || document.getElementById("reveal") || document.getElementById("grid");
    return null;
  }

  qa("#phase45BottomNav [data-jump]").forEach(button => button.addEventListener("click", () => {
    const target = jumpTarget(button.dataset.jump);
    target?.scrollIntoView({ behavior:"smooth", block:"start" });
    if (button.dataset.jump === "next") setTimeout(() => target?.querySelector?.(".player-search")?.focus(), 300);
  }));

  function updateContextAction() {
    const button = document.getElementById("phase45ContextAction");
    const results = document.getElementById("results");
    if (!button) return;
    const complete = Boolean(results && !results.classList.contains("hidden"));
    button.dataset.jump = complete ? "results" : "next";
    button.innerHTML = complete ? "<span>🏆</span>Results" : "<span>➡️</span>Next pick";
  }

  const updatePhase45Countdown = () => {
    const countdown = document.getElementById("phase45HeroCountdown");
    if (countdown) countdown.textContent = nextChallengeText();
  };

  const refresh = () => { renderHero(); renderExtendedStats(); updateContextAction(); updatePhase45Countdown(); };
  let phase45RefreshQueued = false;
  const schedulePhase45Refresh = () => {
    if (phase45RefreshQueued) return;
    phase45RefreshQueued = true;
    requestAnimationFrame(() => { phase45RefreshQueued = false; refresh(); });
  };
  const grid = document.getElementById("grid");
  const results = document.getElementById("results");
  if (grid) {
    const observer = new MutationObserver(schedulePhase45Refresh);
    observer.observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    if (results) observer.observe(results,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=formation-1").catch(() => {});
  refresh();
  setInterval(() => { if (document.visibilityState === "visible") updatePhase45Countdown(); }, 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") updatePhase45Countdown(); });
})();
