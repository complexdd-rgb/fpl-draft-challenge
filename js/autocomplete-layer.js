/* FPL Draft Challenge — player autocomplete stacking/fill fix. */
(() => {
  "use strict";
  if (document.getElementById("fplAutocompleteLayerStyles")) return;

  const style = document.createElement("style");
  style.id = "fplAutocompleteLayerStyles";
  style.textContent = `
    /* The open autocomplete card must sit above every neighbouring card and message. */
    .fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)) {
      z-index: 100000 !important;
      isolation: isolate;
      overflow: visible !important;
    }

    .fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)) .search-wrap {
      position: relative;
      z-index: 100001 !important;
      isolation: isolate;
    }

    /* Treat autocomplete as a true floating menu, never a translucent overlay. */
    .fpl-visual-overhaul-body .suggestions {
      z-index: 100002 !important;
      background: #071a11 !important;
      background-image: none !important;
      opacity: 1 !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      border: 1px solid rgba(95,229,255,.34) !important;
      box-shadow: 0 24px 64px rgba(0,0,0,.72), 0 0 0 1px rgba(0,255,135,.08) !important;
      overflow-y: auto;
      overscroll-behavior: contain;
      pointer-events: auto !important;
      max-height: min(320px, 48vh);
    }

    .fpl-visual-overhaul-body .suggestion {
      position: relative;
      z-index: 1;
      background: #071a11 !important;
      color: #f7fff9 !important;
      border-bottom: 1px solid rgba(255,255,255,.08) !important;
      pointer-events: auto !important;
      cursor: pointer;
    }

    .fpl-visual-overhaul-body .suggestion:hover,
    .fpl-visual-overhaul-body .suggestion.active,
    .fpl-visual-overhaul-body .suggestion:focus-visible {
      background: #123a27 !important;
      color: #fff !important;
      outline: none;
    }

    .fpl-visual-overhaul-body .suggestion:first-child { border-radius: 12px 12px 0 0; }
    .fpl-visual-overhaul-body .suggestion:last-child {
      border-bottom: 0 !important;
      border-radius: 0 0 12px 12px;
    }

    /* Messages remain in their reserved space but cannot intercept a click while menu is open. */
    .fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)) > .feedback,
    .fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)) > .selected-meta,
    .fpl-visual-overhaul-body .slot:has(.suggestions:not(.hidden)) > .clear {
      pointer-events: none !important;
    }

    @media (max-width: 700px) {
      .fpl-visual-overhaul-body .suggestions {
        max-height: min(300px, 52vh);
      }
      .fpl-visual-overhaul-body .suggestion {
        min-height: 46px;
        padding: 11px 12px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
