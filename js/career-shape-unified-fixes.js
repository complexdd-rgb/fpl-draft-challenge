/* FPL Career Shape unified creator · control fixes v1.0.0 */
(() => {
  "use strict";

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

  function install() {
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

    document.getElementById("generatePromptBatchBtn")?.addEventListener("click", () => setTimeout(syncButtons, 120));
    document.getElementById("clearPromptBatchBtn")?.addEventListener("click", () => setTimeout(syncButtons, 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
