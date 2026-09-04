/* FPL Challenge Studio — legacy compatibility entrypoint.
   Runtime ownership has moved to studio-bootstrap.js. This file remains only so cached
   admin pages and older generated-wiring checks fail safely during the migration. */
(() => {
  "use strict";

  const LEGACY_PROMPT_STUDIO_LOADER = "js/prompt-studio-loader.js?v=1.3.0-careerevolution";

  const startBootstrap = () => {
    if (window.FPL_STUDIO_BOOTSTRAP?.start) {
      window.FPL_STUDIO_BOOTSTRAP.start();
      return;
    }

    const existing = document.querySelector('script[data-studio-bootstrap]');
    if (existing) {
      existing.addEventListener('load', () => window.FPL_STUDIO_BOOTSTRAP?.start?.(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = new URL(window.FPL_ASSET_MANIFEST?.url?.('studioBootstrap') || 'js/studio-bootstrap.js', document.baseURI).toString();
    script.async = false;
    script.dataset.studioBootstrap = '1';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      window.FPL_STUDIO_BOOTSTRAP?.start?.();
    }, { once: true });
    script.addEventListener('error', loadLegacyPromptPath, { once: true });
    document.head.appendChild(script);
  };

  const loadLegacyPromptPath = () => {
    if ([...document.scripts].some(item => item.src && item.src.includes('js/prompt-studio-loader.js'))) return;
    const script = document.createElement('script');
    script.src = new URL(LEGACY_PROMPT_STUDIO_LOADER, document.baseURI).toString();
    script.async = false;
    script.dataset.promptStudioLoader = '1';
    document.head.appendChild(script);
  };

  startBootstrap();
})();
