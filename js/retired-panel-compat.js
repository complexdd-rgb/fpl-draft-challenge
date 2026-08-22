/* FPL Draft Challenge — compatibility cleanup for retired Phase 4.5 panels.
   This file can disappear once the retired markup is physically removed from index.html. */
(() => {
  "use strict";

  function retireLegacyPanels() {
    const ui = window.FPL_LIVE_UI_BOOTSTRAP;
    ui?.loadPromptMissingFieldGuard?.();

    const shell = document.getElementById("phase45Shell");
    const livePanel = document.getElementById("liveXiPanel");
    const stats = document.getElementById("phase45ExtendedStats");
    const achievements = document.getElementById("phase45Achievements");

    if (shell && livePanel && stats && livePanel.contains(stats)) {
      shell.insertBefore(stats, livePanel);
      const note = stats.querySelector(".phase45-section-head p");
      if (note) note.textContent = "Your completed daily results stored on this device.";
    }

    achievements?.remove();
    livePanel?.remove();
    ui?.loadPresentationLayers?.();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", retireLegacyPanels, { once: true });
  } else {
    retireLegacyPanels();
  }
})();
