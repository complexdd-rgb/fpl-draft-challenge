/* FPL Draft Challenge — Prompt Studio clean reset v1.0.0
   New Prompt Studio runtime boundary. It does not import, merge or restore any legacy
   Prompt Studio library, pack, incubator or V3/V4 workspace state. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_CLEAN?.version === "1.0.0") return;

  const VERSION = "1.0.0";
  const STORE_KEY = "fplPromptStudioCleanLibraryV1";
  const RESET_MARKER_KEY = "fplPromptStudioCleanResetV1";
  const LEGACY_STORAGE_KEYS = [
    "fplChallengeStudioPromptManagerV1",
    "fplPromptQualityIncubatorV2",
    "fplPromptRefinementIncubatorRunV1",
    "fplPromptStudioV3CleanRoom",
    "fplPromptStudioV3QualityEvidence",
    "fplPromptStudioV3CandidateEvidence",
    "fplPromptFourStarFloorV1",
    "fplQualityFloorDeleteMigrationV1"
  ];

  const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  window.FPL_PROMPT_LIBRARY = library;

  function normalisePrompt(prompt) {
    if (!prompt || typeof prompt !== "object") return null;
    const id = String(prompt.id || "").trim();
    const label = String(prompt.label || "").trim();
    if (!id || !label) return null;
    return {
      ...prompt,
      id,
      label,
      enabled: prompt.enabled !== false
    };
  }

  function clearLegacyBrowserState() {
    try {
      for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
      localStorage.setItem(RESET_MARKER_KEY, VERSION);
    } catch (_) {
      // Storage is optional. The clean in-memory library is still authoritative.
    }
  }

  function readCleanStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!parsed || parsed.schema !== 1 || !Array.isArray(parsed.prompts)) return [];
      return parsed.prompts.map(normalisePrompt).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function saveCleanStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ schema: 1, version: VERSION, prompts: library }));
    } catch (_) {}
  }

  function publish(nextPrompts, { persist = true } = {}) {
    const clean = Array.isArray(nextPrompts) ? nextPrompts.map(normalisePrompt).filter(Boolean) : [];
    library.splice(0, library.length, ...clean);
    if (persist) saveCleanStore();
    paintStatus();
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", {
      detail: { source: "prompt-studio-clean", version: VERSION, total: library.length }
    }));
    return snapshot();
  }

  function snapshot() {
    return library.map(prompt => ({ ...prompt }));
  }

  function addPrompt(prompt) {
    const clean = normalisePrompt(prompt);
    if (!clean) throw new Error("A prompt needs both an id and label.");
    if (library.some(item => String(item.id) === clean.id)) throw new Error(`Prompt id already exists: ${clean.id}`);
    return publish([...library, clean]);
  }

  function removePrompt(id) {
    const wanted = String(id || "");
    return publish(library.filter(prompt => String(prompt.id) !== wanted));
  }

  function clearLibrary() {
    return publish([]);
  }

  function paintStatus() {
    const text = `${library.length.toLocaleString("en-GB")} prompts · clean library`;
    document.querySelectorAll("#libraryStatus").forEach(node => {
      node.textContent = text;
      node.title = "Prompt Studio clean reset. Only the new canonical library is loaded.";
    });
    document.querySelectorAll("[data-workspace-badge=\"prompts\"]").forEach(node => {
      node.textContent = String(library.length);
    });
    const count = document.getElementById("promptStudioCleanCount");
    if (count) count.textContent = library.length.toLocaleString("en-GB");
  }

  function renderWorkspace() {
    const workspace = document.getElementById("workspace-prompts") || document.querySelector('[data-workspace="prompts"]');
    if (!workspace) return false;

    workspace.innerHTML = `
      <header class="workspace-heading">
        <div>
          <p class="eyebrow">FPL Challenge Studio</p>
          <h1 id="workspace-prompts-title">Prompt Studio</h1>
          <p>Fresh build. One canonical library, one controller and no legacy prompt packs or fallback loaders.</p>
        </div>
        <a class="workspace-live-link" href="./">Open live game</a>
      </header>
      <section class="panel stage-one-tool-panel" id="promptStudioCleanRoot" data-tool-workspace="prompts" data-tool-title="Prompt Studio clean foundation">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Clean foundation</p>
            <h2>Prompt Studio reset complete</h2>
            <p class="section-copy">The previous Prompt Studio library and V2/V3/V4 loading chain are not part of this runtime. New prompt tools will be added here against the single clean library only.</p>
          </div>
          <span class="phase-chip">v${VERSION}</span>
        </div>
        <div class="summary-grid">
          <div class="summary-card"><span>Canonical prompts</span><strong id="promptStudioCleanCount">${library.length.toLocaleString("en-GB")}</strong></div>
          <div class="summary-card"><span>Library source</span><strong>Clean V1</strong></div>
          <div class="summary-card"><span>Legacy loaders</span><strong>Off</strong></div>
          <div class="summary-card"><span>Legacy browser state</span><strong>Cleared</strong></div>
        </div>
        <div class="read-only-banner">
          <strong>Ground-up rebuild boundary</strong>
          <span>Git history still preserves the old Studio, but this page does not load or merge it. The next build can add the Library Browser, Builder, Quality Analyser and Refinement Incubator one at a time.</span>
        </div>
        <div class="dashboard-action-grid">
          <article class="dashboard-action-card" aria-label="Library Browser planned"><span class="dashboard-action-icon">L</span><strong>Library Browser</strong><small>Fresh searchable canonical library.</small><em>Next</em></article>
          <article class="dashboard-action-card" aria-label="Prompt Builder planned"><span class="dashboard-action-icon">+</span><strong>Prompt Builder</strong><small>Create prompts against one schema.</small><em>Planned</em></article>
          <article class="dashboard-action-card" aria-label="Quality Analyser planned"><span class="dashboard-action-icon">Q</span><strong>Quality Analyser</strong><small>Test before anything enters the library.</small><em>Planned</em></article>
          <article class="dashboard-action-card" aria-label="Refinement Incubator planned"><span class="dashboard-action-icon">R</span><strong>Refinement Incubator</strong><small>Rebuild survivor generation without legacy packs.</small><em>Planned</em></article>
        </div>
      </section>`;

    workspace.setAttribute("aria-labelledby", "workspace-prompts-title");
    paintStatus();
    return true;
  }

  function install() {
    clearLegacyBrowserState();

    // Hard reset the shared array first. This also clears any browser-local prompts that
    // admin-core may have restored earlier in the same page load.
    library.splice(0, library.length);

    // Only the new clean-store is eligible to repopulate the library. On the first reset
    // it is empty, so no old repository/browser prompt can return accidentally.
    const cleanStore = readCleanStore();
    if (cleanStore.length) library.push(...cleanStore);
    else saveCleanStore();

    renderWorkspace();
    requestAnimationFrame(() => renderWorkspace());
    setTimeout(() => {
      renderWorkspace();
      paintStatus();
    }, 100);

    document.documentElement.dataset.promptStudioRuntime = "clean-v1";
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-clean-ready", {
      detail: { version: VERSION, total: library.length }
    }));
  }

  window.FPL_PROMPT_STUDIO_CLEAN = Object.freeze({
    version: VERSION,
    storeKey: STORE_KEY,
    getLibrary: snapshot,
    replaceLibrary: prompts => publish(prompts),
    addPrompt,
    removePrompt,
    clearLibrary,
    render: renderWorkspace
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
