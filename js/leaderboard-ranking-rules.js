/* FPL Draft Challenge — visible leaderboard ranking policy. */
(() => {
  "use strict";

  function installRankingRules() {
    const panel = document.getElementById("liveLeaderboardPanel");
    if (!panel || document.getElementById("leaderboardRankingRules")) return Boolean(panel);

    const tableWrap = panel.querySelector(".leaderboard-table-wrap");
    if (!tableWrap) return false;

    if (!document.getElementById("leaderboardRankingRulesStyles")) {
      const style = document.createElement("style");
      style.id = "leaderboardRankingRulesStyles";
      style.textContent = `
        .leaderboard-ranking-rules{margin:10px 2px 0;color:var(--muted);font-size:.66rem;line-height:1.45}
        .leaderboard-ranking-rules strong{color:#dcece3}
      `;
      document.head.appendChild(style);
    }

    const note = document.createElement("p");
    note.id = "leaderboardRankingRules";
    note.className = "leaderboard-ranking-rules";
    note.innerHTML = "<strong>Ranking:</strong> highest verified score first. Ties are decided by fastest completion time, then earliest verified submission.";
    tableWrap.insertAdjacentElement("afterend", note);
    return true;
  }

  if (!installRankingRules()) {
    const observer = new MutationObserver(() => {
      if (installRankingRules()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
