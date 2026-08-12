/* FPL Draft Challenge — temporary UI retirements for low-value Phase 4.5 panels. */
(() => {
  "use strict";

  function retireLowValuePanels() {
    const shell = document.getElementById("phase45Shell");
    const livePanel = document.getElementById("liveXiPanel");
    const stats = document.getElementById("phase45ExtendedStats");
    const achievements = document.getElementById("phase45Achievements");

    // Keep the useful local-record panel, but move it out of the retired Live XI layout.
    if (shell && livePanel && stats && livePanel.contains(stats)) {
      shell.insertBefore(stats, livePanel);
      const note = stats.querySelector(".phase45-section-head p");
      if (note) note.textContent = "Your completed daily results stored on this device.";
    }

    // Retire the achievements panel and the remaining Live XI container.
    achievements?.remove();
    livePanel?.remove();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", retireLowValuePanels, { once: true });
  } else {
    retireLowValuePanels();
  }
})();
