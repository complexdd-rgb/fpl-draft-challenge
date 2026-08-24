/* FPL Draft Challenge — player-facing optional feature loader. */
(() => {
  "use strict";
  const config = window.FPL_LEADERBOARD_CONFIG;
  if (!config || window.FPL_IS_STUDIO) return;

  const loadModule = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = true;
    script.setAttribute(marker, "1");
    document.head.appendChild(script);
  };

  // Core live presentation compatibility entrypoint; active presentation startup lives in live-ui-bootstrap.js.
  loadModule("js/ui-cleanup.js", "data-ui-cleanup");

  // Results are deferred until there is something to show.
  const loadResultsV2 = () => {
    if (!config.resultsV2) return;
    loadModule("js/results-v2.js", "data-results-v2");
    loadModule("js/results-polish-v3.js", "data-results-polish-v3");
  };
  const scheduleResultsV2 = () => {
    requestAnimationFrame(() => {
      if (typeof requestIdleCallback === "function") requestIdleCallback(loadResultsV2, { timeout: 1200 });
      else setTimeout(loadResultsV2, 120);
    });
  };
  const results = document.getElementById("results");
  if (results && !results.classList.contains("hidden")) scheduleResultsV2();
  else window.addEventListener("fpl:challenge-completed", scheduleResultsV2, { once: true });
  window.FPL_LOAD_RESULTS_V2 = loadResultsV2;

  // Leaderboard extras load only when the leaderboard becomes visible.
  let leaderboardExtrasLoaded = false;
  const loadLeaderboardExtras = () => {
    if (leaderboardExtrasLoaded) return;
    leaderboardExtrasLoaded = true;
    if (config.enabled && config.teamSheets) loadModule("js/leaderboard-team-view.js", "data-leaderboard-team-view");
    if (config.enabled && config.rankingRules) loadModule("js/leaderboard-ranking-rules.js", "data-leaderboard-ranking-rules");
    if (config.enabled && config.allTimeLeaderboard) loadModule("js/leaderboard-all-time.js", "data-leaderboard-all-time");
    if (config.enabled && config.playerProfile && config.accounts?.enabled) loadModule("js/player-profile.js", "data-player-profile");
  };
  window.FPL_LOAD_LEADERBOARD_EXTRAS = loadLeaderboardExtras;

  // The feature loader itself is asynchronous. If the leaderboard activated before this
  // script finished loading, its one-shot visibility event has already fired. Catch up from
  // the client's durable active flag so team sheets and the other deferred extras still load.
  if (window.FPL_LEADERBOARD_ACTIVE) loadLeaderboardExtras();
  else window.addEventListener("fpl:leaderboard-visible", loadLeaderboardExtras, { once: true });
})();
