/* FPL Daily Challenge 4.0 — inline visual enhancements */
(() => {
  "use strict";

  const currentChallenge = Array.isArray(window.FPL_CHALLENGES)
    ? window.FPL_CHALLENGES[window.FPL_CHALLENGES.length - 1]
    : null;

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
    <span class="v4-badge">Challenge #${Number(currentChallenge.number) || "–"}</span>
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
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const seconds = Math.max(0, Math.floor((next - now) / 1000));
    const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const remainder = String(seconds % 60).padStart(2, "0");
    const element = document.getElementById("nextChallengeCountdown");
    if (element) element.textContent = `Next challenge ${hours}:${minutes}:${remainder}`;
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
