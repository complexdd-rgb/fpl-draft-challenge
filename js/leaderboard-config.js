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
    list: "leaderboard-list",
    allTime: "leaderboard-all-time"
  }),
  topLimit: 20,
  allTimeLimit: 50,
  displayNameMin: 2,
  displayNameMax: 20,
  refreshSeconds: 60,
  realtimeReady: true,
  teamSheets: true,
  rankingRules: true,
  allTimeLeaderboard: true,
  accounts: Object.freeze({
    enabled: true,
    provider: "email-magic-link",
    redirectUrl: "https://complexdd-rgb.github.io/fpl-draft-challenge/"
  }),
  mockMode: false
});

// When accounts are enabled, install this tiny bridge synchronously before the static
// leaderboard client runs. It adds the user's Supabase access token only to our own
// leaderboard Edge Function calls; Auth/CDN/other fetches are untouched.
if (window.FPL_LEADERBOARD_CONFIG.enabled && window.FPL_LEADERBOARD_CONFIG.accounts?.enabled && !window.FPL_ACCOUNT_AUTH) {
  let ready = false;
  let session = null;
  let resolveReady;
  const readyPromise = new Promise(resolve => { resolveReady = resolve; });
  window.FPL_ACCOUNT_AUTH = {
    client: null,
    _setSession(nextSession) { session = nextSession || null; },
    _markReady() { if (!ready) { ready = true; resolveReady?.(); } },
    async getAccessToken() {
      if (!ready) await Promise.race([readyPromise, new Promise(resolve => setTimeout(resolve, 1500))]);
      return session?.access_token || "";
    }
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = undefined) => {
    let url = "";
    try { url = input instanceof Request ? input.url : String(input); } catch {}
    const functionPrefix = `${String(window.FPL_LEADERBOARD_CONFIG.supabaseUrl).replace(/\/$/, "")}/functions/v1/leaderboard-`;
    if (!url.startsWith(functionPrefix)) return nativeFetch(input, init);

    const token = await window.FPL_ACCOUNT_AUTH.getAccessToken();
    if (!token) return nativeFetch(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    headers.set("Authorization", `Bearer ${token}`);
    return nativeFetch(input, { ...(init || {}), headers });
  };

  const account = document.createElement("script");
  account.src = new URL("js/leaderboard-account.js", document.baseURI).toString();
  account.async = true;
  account.dataset.leaderboardAccount = "1";
  account.onerror = () => window.FPL_ACCOUNT_AUTH?._markReady?.();
  document.head.appendChild(account);
}

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

// Keep the ranking policy visible beside the live table so tie-breaks are clear to
// players and stay aligned with the server ordering.
if (window.FPL_LEADERBOARD_CONFIG.enabled && window.FPL_LEADERBOARD_CONFIG.rankingRules && !document.querySelector('script[data-leaderboard-ranking-rules]')) {
  const rankingRules = document.createElement("script");
  rankingRules.src = new URL("js/leaderboard-ranking-rules.js", document.baseURI).toString();
  rankingRules.async = true;
  rankingRules.dataset.leaderboardRankingRules = "1";
  document.head.appendChild(rankingRules);
}

// The all-time standings are loaded separately so the daily leaderboard bridge stays
// focused on today's verified challenge and its team-sheet privacy rules.
if (window.FPL_LEADERBOARD_CONFIG.enabled && window.FPL_LEADERBOARD_CONFIG.allTimeLeaderboard && !document.querySelector('script[data-leaderboard-all-time]')) {
  const allTime = document.createElement("script");
  allTime.src = new URL("js/leaderboard-all-time.js", document.baseURI).toString();
  allTime.async = true;
  allTime.dataset.leaderboardAllTime = "1";
  document.head.appendChild(allTime);
}

// Keep the All-Time helper copy aligned with the optional account launch without
// coupling the leaderboard module to Auth internals.
if (window.FPL_LEADERBOARD_CONFIG.accounts?.enabled) {
  const updateAccountCopy = () => {
    const note = document.querySelector(".leaderboard-alltime-note");
    if (!note) return false;
    note.innerHTML = "<strong>Scoring:</strong> each verified daily efficiency contributes up to 100 All-Time points. Ties go to higher average efficiency, then more wins, more podiums, then the earliest first verified entry. Sign in to sync your verified All-Time record across devices; guest play remains device-based.";
    return true;
  };
  if (!updateAccountCopy()) {
    const observer = new MutationObserver(() => {
      if (updateAccountCopy()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}
