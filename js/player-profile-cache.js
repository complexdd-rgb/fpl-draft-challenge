/* FPL Draft Challenge — lightweight stale-while-revalidate cache for the signed-in profile.
   This only accelerates presentation. The server remains the source of truth. */
(() => {
  "use strict";

  const cfg = window.FPL_LEADERBOARD_CONFIG;
  if (!cfg?.enabled || !cfg?.playerProfile || !cfg?.functions?.profile) return;
  if (window.FPL_PLAYER_PROFILE_CACHE_INSTALLED) return;
  window.FPL_PLAYER_PROFILE_CACHE_INSTALLED = true;

  const CACHE_KEY = "fpl-v6-player-profile-cache";
  const ACCOUNT_KEY = "fpl-v6-player-profile-account";
  const MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
  const profileUrl = `${String(cfg.supabaseUrl || "").replace(/\/$/, "")}/functions/v1/${encodeURIComponent(cfg.functions.profile)}`;
  const downstreamFetch = window.fetch.bind(window);

  let revalidating = false;
  let freshOnce = null;

  function clearPayload() {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  }

  function readCache() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!parsed || typeof parsed !== "object" || !parsed.payload || !Number.isFinite(Number(parsed.savedAt))) return null;
      if (Date.now() - Number(parsed.savedAt) > MAX_STALE_MS) {
        clearPayload();
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function writeCache(payload) {
    if (!payload || typeof payload !== "object") return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), payload }));
    } catch {}
  }

  function responseFor(payload) {
    return new Response(JSON.stringify(payload || {}), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-FPL-Profile-Cache": "1"
      }
    });
  }

  function isProfileRequest(input, init) {
    let url = "";
    try { url = input instanceof Request ? input.url : String(input); } catch {}
    const method = String(init?.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
    return url === profileUrl && method === "POST";
  }

  function scheduleIdle(callback, timeout = 4000) {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => callback(), { timeout });
    } else {
      setTimeout(callback, 1200);
    }
  }

  async function revalidate(input, init, previousPayload) {
    if (revalidating) return;
    revalidating = true;
    try {
      const replayInput = input instanceof Request ? input.clone() : input;
      const response = await downstreamFetch(replayInput, init);
      if (!response.ok) return;
      const payload = await response.clone().json();
      if (!payload || typeof payload !== "object") return;
      writeCache(payload);

      let changed = true;
      try { changed = JSON.stringify(payload) !== JSON.stringify(previousPayload); } catch {}
      if (changed) {
        freshOnce = payload;
        setTimeout(() => window.FPL_PLAYER_PROFILE_REFRESH?.(), 100);
      }
    } catch {
      // Cached profile remains usable when the refresh is temporarily unavailable.
    } finally {
      revalidating = false;
    }
  }

  window.fetch = async (input, init = undefined) => {
    if (!isProfileRequest(input, init)) return downstreamFetch(input, init);

    if (freshOnce) {
      const payload = freshOnce;
      freshOnce = null;
      return responseFor(payload);
    }

    const cached = readCache();
    if (cached?.payload) {
      scheduleIdle(() => revalidate(input, init, cached.payload));
      return responseFor(cached.payload);
    }

    const response = await downstreamFetch(input, init);
    if (response.ok) {
      try { writeCache(await response.clone().json()); } catch {}
    }
    return response;
  };

  window.addEventListener("fpl:account-auth-changed", event => {
    const signedIn = event?.detail?.signedIn === true;
    const email = String(event?.detail?.email || "").trim().toLowerCase();
    let previous = "";
    try { previous = String(localStorage.getItem(ACCOUNT_KEY) || "").trim().toLowerCase(); } catch {}

    if (!signedIn) {
      clearPayload();
      try { localStorage.removeItem(ACCOUNT_KEY); } catch {}
      freshOnce = null;
      return;
    }

    if (email && previous && email !== previous) {
      clearPayload();
      freshOnce = null;
    }
    if (email) {
      try { localStorage.setItem(ACCOUNT_KEY, email); } catch {}
    }
  });

  // A newly completed verified challenge must be fetched from the server rather than served
  // from the previous profile snapshot.
  window.addEventListener("fpl:challenge-completed", () => {
    clearPayload();
    freshOnce = null;
  });
})();
