/* FPL Draft Challenge — leaderboard configuration and synchronous compatibility bridges.
   Only browser-safe publishable configuration belongs here. Two tiny bridges remain
   synchronous because their timing must precede immediately-following page scripts. */
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

window.FPL_IS_STUDIO = /\/admin(?:\.html)?$/i.test(window.location.pathname)
  || Boolean(document.querySelector("main.studio-shell"));

// Timing-sensitive Studio compatibility guard. Two older prompt-tool modules still bind
// initialisers to window.load; install this observer before DOMContentLoaded so a lazy-loaded
// bundle cannot race past it. Remove this once those modules are modernised.
if (window.FPL_IS_STUDIO) {
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

// Synchronous account bridge. This intercepts only leaderboard Edge Function requests and
// adds the signed-in access token when one exists. The actual account UI remains deferred.
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

// Studio runtime feature ownership lives in studio-bootstrap.js. Live play keeps its
// own deferred feature loader and does not depend on the Studio asset manifest.
if (!window.FPL_IS_STUDIO) {
  const featureLoader = document.createElement("script");
  featureLoader.src = new URL("js/live-feature-loader.js", document.baseURI).toString();
  featureLoader.async = true;
  featureLoader.dataset.fplFeatureLoader = "live";
  document.head.appendChild(featureLoader);
}

window.dispatchEvent(new CustomEvent("fpl:leaderboard-config-ready", {
  detail: window.FPL_LEADERBOARD_CONFIG
}));
