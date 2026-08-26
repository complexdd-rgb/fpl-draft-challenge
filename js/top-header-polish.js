/* FPL Draft Challenge — simplified professional challenge header. Presentation only. */
(() => {
  "use strict";

  const challenge = window.FPL_DAILY_CHALLENGE || null;
  if (!challenge) return;
  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const dailyTime = window.FPL_DAILY_TIME || {};
  const HISTORY_KEY = "fpl-v4-local-history";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const dayNumber = value => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    return m ? Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000) : null;
  };
  const loadHistory = () => {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(value) ? value.filter(item => item && item.completed === true && item.official !== false) : [];
    } catch { return []; }
  };
  const currentStreak = () => {
    const days = [...new Set(loadHistory().map(item => dayNumber(item.challengeDate)).filter(Number.isFinite))].sort((a, b) => a - b);
    if (!days.length) return 0;
    let run = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (days[i] - days[i - 1] === 1) run++;
      else break;
    }
    return run;
  };
  const challengeDateLabel = value => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!m) return String(value || "Daily Challenge");
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)));
  };
  const challengeDisplayTitle = () => {
    const raw = String(challenge.title || "Daily Challenge").trim();
    const date = challengeDateLabel(challenge.releaseDate).trim();
    if (!date || !raw.toLocaleLowerCase().startsWith(date.toLocaleLowerCase())) return raw;
    const cleaned = raw.slice(date.length).replace(/^[\s·|–—:;-]+/, "").trim();
    return cleaned || raw;
  };
  const nextChallengeText = () => {
    if (runtime.archiveMode) return "Practice mode";
    if (!runtime.nextScheduledDate || typeof dailyTime.millisecondsUntilUkDate !== "function" || typeof dailyTime.formatCountdown !== "function") return "Not scheduled";
    const remaining = dailyTime.millisecondsUntilUkDate(runtime.nextScheduledDate);
    return remaining <= 0 ? "Ready" : dailyTime.formatCountdown(remaining);
  };

  function addStyles() {
    if (document.getElementById("topHeaderPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "topHeaderPolishStyles";
    style.textContent = `
      body.fpl-visual-overhaul-body .vo-brandbar{justify-content:flex-start;margin-bottom:9px}
      body.fpl-visual-overhaul-body .vo-brandmeta{display:none!important}
      body.fpl-visual-overhaul-body .hero{padding:21px 24px 18px!important}
      body.fpl-visual-overhaul-body .hero > .eyebrow,
      body.fpl-visual-overhaul-body .hero > #title,
      body.fpl-visual-overhaul-body .hero > p,
      body.fpl-visual-overhaul-body .hero > .v4-meta,
      body.fpl-visual-overhaul-body .hero > .status,
      body.fpl-visual-overhaul-body .hero > .v4-progress-shell{display:none!important}
      body.fpl-visual-overhaul-body #phase45Shell{display:none!important}

      .top-challenge-header{position:relative;z-index:1;display:grid;gap:14px}
      .top-challenge-kicker{display:flex;align-items:center;gap:8px;color:var(--vo-accent,#00ff87);font-size:.61rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
      .top-challenge-kicker::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 14px currentColor}
      .top-challenge-brand{margin:0;color:#fff;font-size:clamp(1.7rem,4vw,2.65rem);line-height:1;letter-spacing:-.045em;font-weight:950}
      .top-challenge-title{margin:6px 0 0;max-width:900px;color:#f6fff9;font-size:clamp(1.2rem,3vw,1.8rem);line-height:1.15;letter-spacing:-.035em;font-weight:850;text-wrap:balance}
      .top-challenge-tags{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px}
      .top-challenge-tag{display:inline-flex;align-items:center;min-height:29px;padding:5px 9px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.035);color:#dbece2;font-size:.61rem;font-weight:900;letter-spacing:.025em}
      .top-challenge-tag.primary{border-color:rgba(0,255,135,.2);background:rgba(0,255,135,.08);color:var(--vo-accent,#00ff87)}

      .top-challenge-stats{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(150px,.7fr) minmax(190px,.9fr);gap:9px;padding-top:0}
      .top-challenge-stat{min-width:0;padding:10px 12px;border:1px solid rgba(255,255,255,.085);border-radius:14px;background:rgba(0,0,0,.13)}
      .top-challenge-stat span{display:block;color:#8fa99a;font-size:.55rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}
      .top-challenge-stat strong{display:block;margin-top:4px;color:#f7fff9;font-size:.82rem;line-height:1.35;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .top-challenge-stat.database #dbStatus{display:block!important;margin-top:4px!important;padding:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;min-height:0!important;color:#dff7e8!important;font-size:.82rem!important;font-weight:850!important;line-height:1.35!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #topHeaderCountdown{font-variant-numeric:tabular-nums;color:var(--vo-cyan,#5fe5ff)}

      body.fpl-visual-overhaul-body .section-heading{align-items:flex-start!important;justify-content:flex-start!important;flex-direction:column!important;gap:3px!important;margin-bottom:9px!important}
      body.fpl-visual-overhaul-body .section-heading p{margin:0!important;text-align:left!important;max-width:560px}

      @media(max-width:700px){
        body.fpl-visual-overhaul-body .hero{padding:18px 15px 15px!important}
        .top-challenge-header{gap:13px}
        .top-challenge-stats{grid-template-columns:1fr 1fr}
        .top-challenge-stat.database{grid-column:1/-1}
        .top-challenge-stat{padding:10px}
        .top-challenge-stat strong,.top-challenge-stat.database #dbStatus{font-size:.76rem!important}
      }
      @media(max-width:430px){
        .top-challenge-brand{font-size:1.55rem}
        .top-challenge-title{font-size:1.08rem}
        .top-challenge-stats{grid-template-columns:1fr 1fr;gap:7px}
        .top-challenge-stat{padding:9px}
        .top-challenge-stat span{font-size:.51rem}
        .top-challenge-stat strong,.top-challenge-stat.database #dbStatus{font-size:.7rem!important}
      }
    `;
    document.head.appendChild(style);
  }

  function install() {
    const hero = document.querySelector("main.app > .hero") || document.querySelector(".hero");
    const dbStatus = document.getElementById("dbStatus");
    if (!hero || !dbStatus) return false;
    addStyles();

    let shell = document.getElementById("topChallengeHeader");
    if (!shell) {
      shell = document.createElement("section");
      shell.id = "topChallengeHeader";
      shell.className = "top-challenge-header";
      shell.innerHTML = `
        <div>
          <div class="top-challenge-kicker">${esc(runtime.archiveMode ? "Archive historical XI challenge" : "Daily historical XI challenge")}</div>
          <h1 class="top-challenge-brand">FPL Daily Challenge</h1>
          <div class="top-challenge-title">${esc(challengeDateLabel(challenge.releaseDate))} · ${esc(challengeDisplayTitle())}</div>
          <div class="top-challenge-tags">
            <span class="top-challenge-tag primary">${esc(challenge.difficulty || "Daily")}</span>
            <span class="top-challenge-tag">${esc(challenge.formation || "4-4-2")}</span>
          </div>
        </div>
        <div class="top-challenge-stats">
          <div class="top-challenge-stat database"><span>Database</span><strong id="topHeaderDatabaseSlot"></strong></div>
          <div class="top-challenge-stat"><span>Streak</span><strong id="topHeaderStreak"></strong></div>
          <div class="top-challenge-stat"><span>Next challenge</span><strong id="topHeaderCountdown"></strong></div>
        </div>`;
      hero.appendChild(shell);
    }

    const databaseSlot = document.getElementById("topHeaderDatabaseSlot");
    if (databaseSlot && !dbStatus.closest(".top-challenge-stat.database")) databaseSlot.replaceWith(dbStatus);

    const streakValue = currentStreak();
    const streakEl = document.getElementById("topHeaderStreak");
    if (streakEl) streakEl.textContent = `${streakValue} day${streakValue === 1 ? "" : "s"}`;
    const countdown = document.getElementById("topHeaderCountdown");
    if (countdown) countdown.textContent = nextChallengeText();

    return true;
  }

  function updateCountdown() {
    const countdown = document.getElementById("topHeaderCountdown");
    if (countdown) countdown.textContent = nextChallengeText();
  }

  if (!install()) {
    const observer = new MutationObserver(() => {
      if (install()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  setInterval(() => { if (document.visibilityState === "visible") updateCountdown(); }, 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") updateCountdown(); });
  window.addEventListener("fpl:challenge-completed", () => requestAnimationFrame(install));
})();
