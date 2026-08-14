/* FPL Draft Challenge — lazy bootstrap for the signed-in verified profile.
   Keep the full profile/history module off the critical page-start path. */
(() => {
  "use strict";

  const cfg = window.FPL_LEADERBOARD_CONFIG;
  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  if (!cfg?.enabled || !cfg?.playerProfile || !cfg?.accounts?.enabled || runtime.archiveMode) return;

  let started = false;
  let scheduled = false;

  function loadCore() {
    if (started || document.querySelector('script[data-player-profile-core]')) return;
    started = true;

    const startCore = () => {
      if (document.querySelector('script[data-player-profile-core]')) return;
      const core = document.createElement("script");
      core.src = new URL("js/player-profile-core.js", document.baseURI).toString();
      core.async = true;
      core.dataset.playerProfileCore = "1";
      document.head.appendChild(core);
    };

    if (window.FPL_PLAYER_PROFILE_CACHE_INSTALLED) {
      startCore();
      return;
    }

    let cache = document.querySelector('script[data-player-profile-cache]');
    if (!cache) {
      cache = document.createElement("script");
      cache.src = new URL("js/player-profile-cache.js", document.baseURI).toString();
      cache.async = true;
      cache.dataset.playerProfileCache = "1";
      document.head.appendChild(cache);
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      startCore();
    };
    cache.addEventListener("load", finish, { once: true });
    cache.addEventListener("error", finish, { once: true });
    setTimeout(finish, 1200);
  }

  function scheduleAfterFirstPaint() {
    if (started || scheduled || !window.FPL_ACCOUNT_AUTH?.signedIn) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(loadCore, { timeout: 2400 });
      } else {
        setTimeout(loadCore, 500);
      }
    }));
  }

  scheduleAfterFirstPaint();
  window.addEventListener("fpl:account-auth-changed", event => {
    if (event.detail?.signedIn) scheduleAfterFirstPaint();
  });
  window.addEventListener("fpl:challenge-completed", scheduleAfterFirstPaint, { once: true });
  window.FPL_LOAD_PLAYER_PROFILE_NOW = loadCore;
})();
