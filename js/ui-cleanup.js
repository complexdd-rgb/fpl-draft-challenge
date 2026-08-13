/* FPL Draft Challenge — temporary UI retirements for low-value Phase 4.5 panels. */
(() => {
  "use strict";

  function loadVisualOverhaul() {
    if (document.querySelector('script[data-visual-overhaul]')) return;
    const visual = document.createElement("script");
    visual.src = new URL("js/visual-overhaul.js", document.baseURI).toString();
    visual.async = true;
    visual.dataset.visualOverhaul = "1";
    document.head.appendChild(visual);
  }

  function loadVisualFinishing() {
    if (document.querySelector('script[data-visual-finishing]')) return;
    const finishing = document.createElement("script");
    finishing.src = new URL("js/visual-finishing.js", document.baseURI).toString();
    finishing.async = true;
    finishing.dataset.visualFinishing = "1";
    document.head.appendChild(finishing);
  }

  function loadSeasonSelectPerformance() {
    if (document.querySelector('script[data-season-select-performance]')) return;
    const performance = document.createElement("script");
    performance.src = new URL("js/season-select-performance.js", document.baseURI).toString();
    performance.async = true;
    performance.dataset.seasonSelectPerformance = "1";
    document.head.appendChild(performance);
  }

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
    loadSeasonSelectPerformance();
    loadVisualOverhaul();
    loadVisualFinishing();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", retireLowValuePanels, { once: true });
  } else {
    retireLowValuePanels();
  }
})();
