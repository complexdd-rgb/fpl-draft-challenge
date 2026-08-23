
/* FPL Daily Challenge 4.3 — inline visual enhancements */
(() => {
  "use strict";

  const currentChallenge = window.FPL_DAILY_CHALLENGE || null;

  if (!currentChallenge) return;

  const hero = document.querySelector(".hero");
  const status = hero?.querySelector(".status");
  if (!hero || !status) return;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

  const meta = document.createElement("div");
  meta.className = "v4-meta";
  meta.innerHTML = `
    <span class="v4-badge difficulty">${escapeHtml(currentChallenge.difficulty || currentChallenge.dateLabel || "Daily Challenge")}</span>
    <span class="v4-badge">${escapeHtml(challengeDateLabel(currentChallenge.releaseDate))}</span>
    <span class="v4-badge countdown" id="nextChallengeCountdown">Next challenge 00:00:00</span>
  `;
  status.before(meta);

  const shell = document.createElement("div");
  shell.className = "v4-progress-shell";
  shell.setAttribute("role", "progressbar");
  shell.setAttribute("aria-label", "Completed prompts");
  shell.setAttribute("aria-valuemin", "0");
  shell.setAttribute("aria-valuemax", String(currentChallenge.prompts.length));
  shell.innerHTML = '<div class="v4-progress-bar" id="v4ProgressBar"></div>';
  status.after(shell);

  function updateProgressBar() {
    const count = document.querySelectorAll(".slot.valid").length;
    const total = currentChallenge.prompts.length || 11;
    const percentage = Math.max(0, Math.min(100, (count / total) * 100));
    const bar = document.getElementById("v4ProgressBar");
    if (bar) bar.style.width = `${percentage}%`;
    shell.setAttribute("aria-valuenow", String(count));
  }

  function updateCountdown() {
    const element = document.getElementById("nextChallengeCountdown");
    if (!element) return;
    const runtime = window.FPL_CHALLENGE_RUNTIME || {};
    const dailyTime = window.FPL_DAILY_TIME || {};
    if (runtime.archiveMode) {
      element.textContent = "Archive practice";
      return;
    }
    if (runtime.nextScheduledDate && typeof dailyTime.millisecondsUntilUkDate === "function" && typeof dailyTime.formatCountdown === "function") {
      const remaining = dailyTime.millisecondsUntilUkDate(runtime.nextScheduledDate);
      element.textContent = remaining <= 0
        ? "New challenge ready"
        : `Next challenge ${dailyTime.formatCountdown(remaining)}`;
      return;
    }
    element.textContent = "Next challenge not scheduled";
  }

  function decorateSlots() {
    document.querySelectorAll(".slot").forEach((slot, index) => {
      slot.style.animationDelay = `${Math.min(index * 35, 280)}ms`;
    });
  }

  const grid = document.getElementById("grid");
  if (grid) {
    new MutationObserver(() => {
      updateProgressBar();
      decorateSlots();
    }).observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  updateProgressBar();
  decorateSlots();
  updateCountdown();
  setInterval(updateCountdown, 1000);
})();

