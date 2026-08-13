/* FPL Career Shape unified creator · control fixes v1.0.2 */
(() => {
  "use strict";

  function ensureQualityCss() {
    if (document.querySelector('link[data-prompt-quality-mobile="1.2"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "admin-prompts-mobile-v1-2.css?v=1.2.0";
    link.dataset.promptQualityMobile = "1.2";
    document.head.appendChild(link);
  }

  function boxes() {
    return [...document.querySelectorAll("#promptFactoryPreview [data-factory-select], #promptFactoryPreview [data-career-unified-select]")];
  }

  function careerBoxes() {
    return [...document.querySelectorAll("#promptFactoryPreview [data-career-unified-select]")];
  }

  function syncButtons() {
    const all = boxes();
    const selected = all.filter(box => box.checked).length;
    const select = document.getElementById("selectPromptBatchBtn");
    const add = document.getElementById("addPromptBatchBtn");
    const clear = document.getElementById("clearPromptBatchBtn");
    if (select) {
      select.disabled = all.length === 0;
      select.textContent = all.length && selected === all.length ? "Clear selection" : "Select all";
    }
    if (add) {
      add.disabled = selected === 0;
      add.textContent = selected ? `Add ${selected} selected to browser library` : "Add selected to browser library";
    }
    if (clear) clear.disabled = all.length === 0;
  }

  function decorateQualityStates() {
    for (const card of document.querySelectorAll("#promptFactoryPreview .career-shape-unified-card")) {
      if (card.dataset.qualityDecorated) continue;
      card.dataset.qualityDecorated = "true";
      const state = card.dataset.qualityState;
      if (!state) continue;
      const meta = card.querySelector(".factory-prompt-meta");
      if (!meta) continue;
      const chip = document.createElement("span");
      chip.className = "career-chip";
      chip.textContent = state === "preferred" ? "Preferred breadth" : state === "review" ? "Quality review" : "Acceptable breadth";
      meta.appendChild(chip);
    }
  }

  function install() {
    ensureQualityCss();
    const preview = document.getElementById("promptFactoryPreview");
    const select = document.getElementById("selectPromptBatchBtn");
    if (!preview || !select || select.dataset.careerUnifiedFixes) return;
    select.dataset.careerUnifiedFixes = "true";

    select.addEventListener("click", event => {
      const mode = document.getElementById("factoryCareerShapeMode")?.value || "mix";
      const career = careerBoxes();
      const normal = [...preview.querySelectorAll("[data-factory-select]")];
      if (mode !== "only" || !career.length || normal.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const allSelected = career.every(box => box.checked);
      career.forEach(box => { box.checked = !allSelected; });
      syncButtons();
    }, true);

    preview.addEventListener("change", event => {
      if (!event.target.matches("[data-factory-select], [data-career-unified-select]")) return;
      setTimeout(syncButtons, 0);
    });

    const observer = new MutationObserver(() => {
      setTimeout(() => { syncButtons(); decorateQualityStates(); }, 0);
    });
    observer.observe(preview, { childList: true, subtree: true });

    document.getElementById("generatePromptBatchBtn")?.addEventListener("click", () => setTimeout(() => { syncButtons(); decorateQualityStates(); }, 150));
    document.getElementById("clearPromptBatchBtn")?.addEventListener("click", () => setTimeout(syncButtons, 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();