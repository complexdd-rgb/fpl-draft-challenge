/* FPL Challenge Studio — retired feature-loader compatibility shim.
   leaderboard-config no longer starts a separate Studio chain; stale cached callers are
   redirected to the single studio-bootstrap owner. */
(() => {
  "use strict";
  if (!window.FPL_IS_STUDIO && !document.querySelector('main.studio-shell')) return;

  if (window.FPL_STUDIO_BOOTSTRAP?.start) {
    window.FPL_STUDIO_BOOTSTRAP.start();
    return;
  }

  const existing = document.querySelector('script[data-studio-bootstrap]');
  if (existing) return;
  const script = document.createElement('script');
  script.src = new URL(window.FPL_ASSET_MANIFEST?.url?.('studioBootstrap') || 'js/studio-bootstrap.js', document.baseURI).toString();
  script.async = false;
  script.dataset.studioBootstrap = '1';
  document.head.appendChild(script);
})();
