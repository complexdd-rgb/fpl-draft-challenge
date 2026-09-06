/* FPL Draft Challenge — Promotion -> Prompt Library Shards bridge v1.0.0.
   Promotion already emits fpl:prompt-library-changed after installing its verified records.
   This bridge turns that one explicit promotion into a durable IndexedDB snapshot. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_LIBRARY_SHARDS_BRIDGE_V1?.ready) return;

  const savePromotion = event => {
    const detail = event?.detail || {};
    if (detail.source !== "prompt-promotion-v1") return;
    if (!Number(detail.total || 0)) return;
    queueMicrotask(() => {
      window.FPL_PROMPT_LIBRARY_SHARDS_V1?.saveCurrentPromotion?.({
        version: detail.version || "1.0.0",
        total: Number(detail.total || 0)
      });
    });
  };

  window.addEventListener("fpl:prompt-library-changed", savePromotion);
  window.FPL_PROMPT_LIBRARY_SHARDS_BRIDGE_V1 = Object.freeze({ ready: true, version: "1.0.0" });
})();
