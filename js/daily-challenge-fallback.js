/* FPL Daily Challenge — static GitHub fallback after Supabase schedule lookup. */
(() => {
  "use strict";
  if (window.FPL_SUPABASE_CHALLENGE_LOADED === true && window.FPL_DAILY_CHALLENGE) return;

  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const fallback = window.FPL_CHALLENGE_FALLBACK || {};
  const selectedPath = fallback.selectedPath || runtime.selectedPath || "todays-challenge.js";
  const cacheToken = fallback.cacheToken || `${runtime.requestedDate || "today"}-${Date.now()}`;
  document.write(`<script src="${selectedPath}?v=${encodeURIComponent(cacheToken)}"><\/script>`);
})();
