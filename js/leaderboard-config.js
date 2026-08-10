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
  mockMode: false
});
