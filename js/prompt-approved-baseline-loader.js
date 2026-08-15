/* FPL Challenge Studio — approved prompt baseline asset loader v1.0.2 */
(() => {
  "use strict";
  if (window.__FPL_APPROVED_BASELINE_LOADER__) return;
  window.__FPL_APPROVED_BASELINE_LOADER__ = true;

  const assets = [
    ...Array.from({ length: 8 }, (_, index) => `js/prompt-approved-ids-20260814-${index + 1}.js?v=1.0.0`),
    "js/prompt-approved-disabled-20260814.js?v=1.0.0",
    "js/prompt-approved-baseline.js?v=1.0.3"
  ];

  function load(index) {
    if (index >= assets.length) return;
    const src = assets[index];
    const marker = `data-approved-baseline-asset-${index + 1}`;
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) {
      if (index === assets.length - 1 || existing.dataset.loaded === "1") load(index + 1);
      else existing.addEventListener("load", () => load(index + 1), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = false;
    script.setAttribute(marker, "1");
    script.addEventListener("load", () => { script.dataset.loaded = "1"; load(index + 1); }, { once: true });
    document.head.appendChild(script);
  }

  load(0);
})();
