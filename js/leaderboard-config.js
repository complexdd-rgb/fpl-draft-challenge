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
    allTime: "leaderboard-all-time",
    profile: "leaderboard-profile"
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
  playerProfile: true,
  resultsV2: true,
  accounts: Object.freeze({
    enabled: true,
    provider: "email-magic-link",
    redirectUrl: "https://complexdd-rgb.github.io/fpl-draft-challenge/"
  }),
  dailyPublishing: Object.freeze({
    enabled: true,
    function: "daily-challenge-publish"
  }),
  mockMode: false
});

const FPL_IS_STUDIO = /\/admin(?:\.html)?$/i.test(window.location.pathname)
  || Boolean(document.querySelector("main.studio-shell"));

// Two legacy prompt-tool modules still register their initialisers against window.load.
// When their bundle is lazy-loaded after the real load event, replay one load event after
// that bundle arrives. Existing once:true listeners have already been removed, so this
// wakes only the newly-added Prompt Studio listeners without re-running the live app.
if (FPL_IS_STUDIO) {
  const latePromptObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLScriptElement) || !/\/js\/admin-import-tools-base\.js(?:\?|$)/.test(node.src)) continue;
        latePromptObserver.disconnect();
        node.addEventListener("load", () => {
          if (document.readyState === "complete") {
            queueMicrotask(() => window.dispatchEvent(new Event("load")));
          }
        }, { once: true });
        return;
      }
    }
  });
  latePromptObserver.observe(document.head, { childList: true });
}

// When accounts are enabled, install this tiny bridge synchronously before the static
// leaderboard client runs. Studio also keeps this bridge because direct challenge
// publishing uses the signed-in Supabase session without exposing privileged keys.
if (window.FPL_LEADERBOARD_CONFIG.enabled && window.FPL_LEADERBOARD_CONFIG.accounts?.enabled && !window.FPL_ACCOUNT_AUTH) {
  let ready = false;
  let session = null;
  let resolveReady;
  const readyPromise = new Promise(resolve => { resolveReady = resolve; });
  window.FPL_ACCOUNT_AUTH = {
    client: null,
    signedIn: false,
    _setSession(nextSession) {
      session = nextSession || null;
      this.signedIn = Boolean(session);
    },
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

// Live-game presentation modules are deliberately skipped in Challenge Studio. They have
// no admin DOM to enhance and previously created unnecessary network/parse work on every
// Studio visit.
if (!FPL_IS_STUDIO && !document.querySelector('script[data-ui-cleanup]')) {
  const cleanup = document.createElement("script");
  cleanup.src = new URL("js/ui-cleanup.js", document.baseURI).toString();
  cleanup.async = true;
  cleanup.dataset.uiCleanup = "1";
  document.head.appendChild(cleanup);
}

// Secondary live-game presentation is intentionally deferred. The core challenge and
// verified-attempt bridge stay available immediately, while results/leaderboard extras only
// download once the player can actually see or use them.
if (!FPL_IS_STUDIO) {
  const loadModule = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = true;
    script.setAttribute(marker, "1");
    document.head.appendChild(script);
  };

  const loadResultsV2 = () => {
    if (window.FPL_LEADERBOARD_CONFIG.resultsV2) loadModule("js/results-v2.js", "data-results-v2");
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

  let leaderboardExtrasLoaded = false;
  const loadLeaderboardExtras = () => {
    if (leaderboardExtrasLoaded) return;
    leaderboardExtrasLoaded = true;
    const live = window.FPL_LEADERBOARD_CONFIG;
    if (live.enabled && live.teamSheets) loadModule("js/leaderboard-team-view.js", "data-leaderboard-team-view");
    if (live.enabled && live.rankingRules) loadModule("js/leaderboard-ranking-rules.js", "data-leaderboard-ranking-rules");
    if (live.enabled && live.allTimeLeaderboard) loadModule("js/leaderboard-all-time.js", "data-leaderboard-all-time");
    if (live.enabled && live.playerProfile && live.accounts?.enabled) loadModule("js/player-profile.js", "data-player-profile");
  };
  window.addEventListener("fpl:leaderboard-visible", loadLeaderboardExtras, { once: true });
  window.FPL_LOAD_LEADERBOARD_EXTRAS = loadLeaderboardExtras;
}

// Studio-only publishing enhancement. It reuses the validated seven-day ZIP package,
// sends the public challenge source plus private verifiers to Supabase, and never exposes
// service-role credentials in the browser.
if (window.FPL_LEADERBOARD_CONFIG.dailyPublishing?.enabled && document.getElementById("downloadWeekBtn") && !document.querySelector('script[data-admin-daily-publish]')) {
  const publisher = document.createElement("script");
  publisher.src = new URL("js/admin-daily-publish.js", document.baseURI).toString();
  publisher.async = true;
  publisher.dataset.adminDailyPublish = "1";
  document.head.appendChild(publisher);
}

// Studio finishing controls are admin-only. They aggregate existing health/certification
// state and never run an expensive audit or certification automatically.
if (FPL_IS_STUDIO && !document.querySelector('script[data-admin-studio-finish]')) {
  const finish = document.createElement("script");
  finish.src = new URL("js/admin-studio-finish.js?v=1.0.0", document.baseURI).toString();
  finish.async = true;
  finish.dataset.adminStudioFinish = "1";
  document.head.appendChild(finish);
}

// Relationship wording helper: career-overlap means same Premier League season(s), not
// teammates. Keep the rule unchanged while making Prompt Studio wording unambiguous.
if (FPL_IS_STUDIO && !document.querySelector('script[data-career-overlap-wording]')) {
  const overlapWording = document.createElement("script");
  overlapWording.src = new URL("js/career-overlap-wording.js?v=1.0.0", document.baseURI).toString();
  overlapWording.async = true;
  overlapWording.dataset.careerOverlapWording = "1";
  document.head.appendChild(overlapWording);
}
