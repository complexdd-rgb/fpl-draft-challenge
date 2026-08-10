/* FPL Draft Challenge — Phase 5A.5 leaderboard configuration.
   Keep enabled:false until the Supabase project and Edge Functions are deployed.
   Only the browser-safe publishable key belongs here. */
window.FPL_LEADERBOARD_CONFIG = Object.freeze({
  enabled: false,
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  publishableKey: "sb_publishable_REPLACE_ME",
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
