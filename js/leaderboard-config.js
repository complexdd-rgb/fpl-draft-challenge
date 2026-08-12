/* FPL Draft Challenge — Phase 5A.5 leaderboard configuration.
   Supabase browser connection configured for production.
   Only the browser-safe publishable key belongs here; never add secret/service-role keys. */
window.FPL_LEADERBOARD_CONFIG = Object.freeze({
  enabled: true,
  supabaseUrl: "https://sacfscnhvmfvbazbfgji.supabase.co",
  publishableKey: "sb_publishable_5ULcqgRQoeWai65gFKm-jA_ORhrSysW",
  functions: Object.freeze({
    start: "leaderboard-start",
    pick: "leaderboard-pick",
    finish: "leaderboard-finish",
    list: "leaderboard-list"
  }),
  topLimit: 20,
  displayNameMin: 2,
  displayNameMax: 20,
  refreshSeconds: 60,
  realtimeReady: true,
  teamSheets: true,
  mockMode: false
});

// Small compatibility cleanup while the large index.html shell is still bundled inline.
// This removes retired Phase 4.5 panels without disturbing the game engine.
if (!document.querySelector('script[data-ui-cleanup]')) {
  const cleanup = document.createElement("script");
  cleanup.src = new URL("js/ui-cleanup.js", document.baseURI).toString();
  cleanup.async = true;
  cleanup.dataset.uiCleanup = "1";
  document.head.appendChild(cleanup);
}

// Keep the team-sheet UI separate from the core leaderboard bridge so the verified
// submission path stays small and easy to audit. Dynamic loading also avoids touching
// the large index.html bundle just to add this enhancement.
if (window.FPL_LEADERBOARD_CONFIG.enabled && window.FPL_LEADERBOARD_CONFIG.teamSheets && !document.querySelector('script[data-leaderboard-team-view]')) {
  const teamView = document.createElement("script");
  teamView.src = new URL("js/leaderboard-team-view.js", document.baseURI).toString();
  teamView.async = true;
  teamView.dataset.leaderboardTeamView = "1";
  document.head.appendChild(teamView);
}
