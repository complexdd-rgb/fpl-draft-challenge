(() => {
  "use strict";

  const challenge = window.FPL_DAILY_CHALLENGE || null;
  if (!challenge) return;

  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const dailyTime = window.FPL_DAILY_TIME || {};
  const historyStore = "fpl-v4-local-history";
  const q = selector => document.querySelector(selector);
  const qa = selector => [...document.querySelectorAll(selector)];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));

  const loadHistory = () => {
    try {
      const value = JSON.parse(localStorage.getItem(historyStore) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const officialHistory = () => loadHistory().filter(item => item && item.completed === true && item.official !== false);
  const dayNumber = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    return match ? Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000) : null;
  };
  const streak = items => {
    const days = [...new Set(items.map(item => dayNumber(item.challengeDate)).filter(Number.isFinite))].sort((a,b) => a-b);
    if (!days.length) return 0;
    let run = 1;
    for (let index = days.length - 1; index > 0; index--) {
      if (days[index] - days[index - 1] === 1) run++;
      else break;
    }
    return run;
  };
  const best = values => values.length ? Math.max(...values) : 0;
  const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

  function challengeDateLabel(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return String(value || "Daily Challenge");
    return new Intl.DateTimeFormat("en-GB", {
      day:"numeric",
      month:"long",
      year:"numeric",
      timeZone:"UTC"
    }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)));
  }

  function nextChallengeText() {
    if (runtime.archiveMode) return "Practice mode";
    if (!runtime.nextScheduledDate || typeof dailyTime.millisecondsUntilUkDate !== "function" || typeof dailyTime.formatCountdown !== "function") {
      return "Not scheduled";
    }
    const remain = dailyTime.millisecondsUntilUkDate(runtime.nextScheduledDate);
    return remain > 0 ? dailyTime.formatCountdown(remain) : "Ready";
  }

  function promptSlot(prompt) {
    return document.getElementById(`slot-${prompt.id}`);
  }

  function promptNodeState(prompt, nextSlot) {
    const slot = promptSlot(prompt);
    if (!slot) return { state:"open", name:"Open" };
    if (slot.classList.contains("given-up")) return { state:"given-up", name:"Give up" };
    if (slot.classList.contains("valid")) {
      const selected = slot.querySelector(".confirmed-player strong")?.textContent?.trim();
      return { state:"locked", name:selected || "Locked" };
    }
    return { state:slot === nextSlot ? "next" : "open", name:slot === nextSlot ? "Next pick" : "Open" };
  }

  function renderFormationPitch(nextSlot) {
    const rows = ["FWD", "MID", "DEF", "GK"];
    return rows.map(position => {
      const prompts = challenge.prompts
        .map((prompt, index) => ({ prompt, index }))
        .filter(item => item.prompt.position === position);
      if (!prompts.length) return "";
      const nodes = prompts.map(({prompt, index}) => {
        const {state, name} = promptNodeState(prompt, nextSlot);
        return `<button class="daily-lineup-node is-${state}" type="button" data-prompt-jump="${esc(prompt.id)}" title="${esc(`${index + 1}. ${prompt.label}`)}">
          <span class="daily-shirt" aria-hidden="true">${index + 1}</span>
          <strong>${esc(name)}</strong>
          <small>${esc(position)}</small>
        </button>`;
      }).join("");
      return `<div class="daily-lineup-row daily-lineup-${position.toLowerCase()}" data-count="${prompts.length}">${nodes}</div>`;
    }).join("");
  }

  function markNextSlot(nextSlot) {
    qa(".slot.daily-next-slot").forEach(slot => {
      if (slot !== nextSlot) slot.classList.remove("daily-next-slot");
    });
    if (nextSlot && !nextSlot.classList.contains("daily-next-slot")) nextSlot.classList.add("daily-next-slot");
  }

  function bindFormationNavigation(mount) {
    mount.querySelectorAll("[data-prompt-jump]").forEach(button => button.addEventListener("click", () => {
      const slot = document.getElementById(`slot-${button.dataset.promptJump}`);
      if (!slot) return;
      slot.scrollIntoView({behavior:"smooth", block:"center"});
      setTimeout(() => slot.querySelector(".player-search")?.focus(), 320);
    }));
  }

  function renderHero() {
    const mount = document.getElementById("phase45Hero");
    if (!mount) return;

    const history = officialHistory();
    const currentStreak = streak(history);
    const pageTitle = challenge.title || "FPL Daily Challenge";
    const validCount = qa(".slot.valid").length;
    const total = Array.isArray(challenge.prompts) && challenge.prompts.length ? challenge.prompts.length : 11;
    const nextSlot = q(".slot:not(.valid)");
    const progressPercent = total ? Math.min(100, (validCount / total) * 100) : 0;
    const title = document.getElementById("title");

    if (title) title.textContent = `FPL Daily Challenge · ${pageTitle}`;
    document.title = `${pageTitle} · FPL Draft Challenge`;
    markNextSlot(nextSlot);

    mount.innerHTML = `<article class="daily-match-card">
      <div class="daily-match-head">
        <div class="daily-match-copy">
          <span class="daily-match-kicker">${esc(runtime.archiveMode ? "Archive practice" : "Today’s challenge")} · ${esc(challengeDateLabel(challenge.releaseDate))}</span>
          <h2>${esc(pageTitle)}</h2>
          <p>Eleven clues. Eleven unique player-seasons. Build the strongest XI you can.</p>
        </div>
        <div class="daily-match-badges" aria-label="Challenge details">
          <span class="daily-badge difficulty">${esc(challenge.difficulty || "Daily")}</span>
          <span class="daily-badge">${esc(challenge.formation || "4-4-2")}</span>
          <span class="daily-badge">🔥 ${currentStreak} day${currentStreak === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div class="daily-match-scorebar">
        <div><span>XI locked</span><strong>${validCount}/${total}</strong></div>
        <div><span>Next challenge</span><strong id="phase45HeroCountdown">${esc(nextChallengeText())}</strong></div>
        <div class="daily-scorebar-track" role="progressbar" aria-label="Draft progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${validCount}"><span style="width:${progressPercent.toFixed(1)}%"></span></div>
      </div>

      <div class="daily-lineup-pitch" aria-label="Current ${esc(challenge.formation || "4-4-2")} formation">
        <span class="daily-pitch-halfway" aria-hidden="true"></span>
        <span class="daily-pitch-circle" aria-hidden="true"></span>
        ${renderFormationPitch(nextSlot)}
      </div>
      <p class="daily-pitch-help">Tap a shirt to jump straight to that clue.</p>
    </article>`;

    bindFormationNavigation(mount);
  }

  function renderExtendedStats() {
    const mount = document.getElementById("historyGridExtended");
    if (!mount) return;
    const history = officialHistory();
    const scores = history.map(item => Number(item.finalScore)).filter(Number.isFinite);
    const efficiencies = history.map(item => Number(item.efficiency)).filter(Number.isFinite);
    const penalties = history.map(item => Number(item.penalties)).filter(Number.isFinite);
    const exactMatches = history.map(item => Number(item.exactPerfectXiMatches)).filter(Number.isFinite);
    const perfectPickRate = history.length
      ? history.reduce((sum, item) => sum + (Number(item.perfectPromptPicks) || 0), 0) / (history.length * 11) * 100
      : 0;

    mount.innerHTML = `<div class="history-chip"><span>Games played</span><strong>${history.length.toLocaleString()}</strong></div>
      <div class="history-chip"><span>Current streak</span><strong>${streak(history)} day${streak(history) === 1 ? "" : "s"}</strong></div>
      <div class="history-chip"><span>Best score</span><strong>${best(scores).toLocaleString()}</strong></div>
      <div class="history-chip"><span>Best efficiency</span><strong>${efficiencies.length ? `${best(efficiencies).toFixed(1)}%` : "0%"}</strong></div>
      <div class="history-chip"><span>Average efficiency</span><strong>${history.length ? `${average(efficiencies).toFixed(1)}%` : "0%"}</strong></div>
      <div class="history-chip"><span>Average penalties</span><strong>${history.length ? average(penalties).toFixed(1) : "0.0"}</strong></div>
      <div class="history-chip"><span>Perfect-pick rate</span><strong>${history.length ? `${perfectPickRate.toFixed(1)}%` : "0%"}</strong></div>
      <div class="history-chip"><span>Exact XI matches</span><strong>${best(exactMatches).toLocaleString()}</strong></div>`;
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
    const rows = [];
    for (let index = 0; index < grid.length; index += 4) rows.push(grid.slice(index, index + 4).join(""));
    return `FPL Draft Challenge · ${challengeDateLabel(challenge.releaseDate)}\n${challenge.title}\n${runtime.archiveMode ? "Archive practice\n" : ""}${rows.join("\n")}\n\nScore: ${score} / ${challenge.perfectScore}\nEfficiency: ${efficiency} · Grade ${grade}\nTime: ${time} · Penalties: ${penalties}\n\nCan you beat my historical XI?`;
  }

  const shareBtn = document.getElementById("shareResult");
  const copyStatus = document.getElementById("copyStatus");
  if (shareBtn) shareBtn.addEventListener("click", async () => {
    const text = buildShareText();
    try {
      if (navigator.share) {
        await navigator.share({title:challenge.title || "FPL Draft Challenge", text, url:location.href});
        if (copyStatus) copyStatus.textContent = "Result shared.";
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        if (copyStatus) copyStatus.textContent = "Share text copied.";
      } else if (copyStatus) {
        copyStatus.textContent = text;
      }
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
    target?.scrollIntoView({behavior:"smooth", block:"start"});
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

  function updateCountdown() {
    const countdown = document.getElementById("phase45HeroCountdown");
    if (countdown) countdown.textContent = nextChallengeText();
  }

  const refresh = () => {
    renderHero();
    renderExtendedStats();
    updateContextAction();
    updateCountdown();
  };

  let refreshQueued = false;
  const scheduleRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  };

  const grid = document.getElementById("grid");
  const results = document.getElementById("results");
  if (grid) {
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(grid, {childList:true, subtree:true, attributes:true, attributeFilter:["class"]});
    if (results) observer.observe(results, {childList:true, subtree:true, attributes:true, attributeFilter:["class", "style"]});
  }

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=formation-1").catch(() => {});
  refresh();
  setInterval(() => {
    if (document.visibilityState === "visible") updateCountdown();
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateCountdown();
  });
})();
