/* FPL Career Shape future-generation quality guard · v1.0.0
   Preview-only. Does not rewrite the prompt library or browser manager state. */
(() => {
  "use strict";

  const RANGES = {
    GK: { narrow: 5, broad: 70 },
    DEF: { narrow: 8, broad: 165 },
    MID: { narrow: 8, broad: 165 },
    FWD: { narrow: 6, broad: 110 }
  };

  function inspect() {
    const preview = document.getElementById("promptFactoryPreview");
    if (!preview) return;
    for (const card of preview.querySelectorAll(".career-shape-unified-card")) {
      if (card.dataset.futureQualityChecked) continue;
      card.dataset.futureQualityChecked = "true";
      const position = card.querySelector(".position-badge")?.textContent?.trim();
      const meta = card.querySelector(".factory-prompt-meta");
      const text = meta?.textContent || "";
      const match = text.match(/(\d+)\s+players/i);
      const checkbox = card.querySelector("[data-career-unified-select]");
      if (!RANGES[position] || !match || !checkbox) continue;

      const playerCount = Number(match[1]);
      const range = RANGES[position];
      const safe = playerCount >= range.narrow && playerCount <= range.broad;
      const chip = document.createElement("span");
      chip.className = "career-chip";
      chip.textContent = safe ? "Quality-safe breadth" : "Outside quality range";
      meta?.appendChild(chip);

      if (!safe && checkbox.checked) {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  function install() {
    const preview = document.getElementById("promptFactoryPreview");
    if (!preview || preview.dataset.futureCareerQualityGuard) return;
    preview.dataset.futureCareerQualityGuard = "true";
    new MutationObserver(() => setTimeout(inspect, 0)).observe(preview, { childList: true, subtree: true });
    inspect();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
