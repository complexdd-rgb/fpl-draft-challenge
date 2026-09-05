/* FPL Draft Challenge — Prompt Studio clean runtime v1.1.0
   One canonical Prompt Studio runtime. No legacy Prompt Studio library, pack, incubator,
   V2/V3/V4 workspace or fallback loader is imported or merged into this boundary. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_CLEAN?.version === "1.1.0") return;

  const VERSION = "1.1.0";
  const STORE_KEY = "fplPromptStudioCleanLibraryV1";
  const RESET_MARKER_KEY = "fplPromptStudioCleanResetV1";
  const PAGE_SIZE = 20;
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

  const browserState = {
    query: "",
    status: "all",
    position: "all",
    family: "all",
    page: 1
  };

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

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

  function installStyles() {
    if (document.querySelector("link[data-prompt-studio-clean-style]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.promptStudioCleanStyle = "1";
    link.href = window.FPL_ASSET_MANIFEST?.url?.("promptStudioCleanCss") || "admin-prompt-studio-clean.css?v=1.0.0";
    document.head.appendChild(link);
  }

  function snapshot() {
    return library.map(prompt => ({ ...prompt }));
  }

  function publish(nextPrompts, { persist = true } = {}) {
    const clean = Array.isArray(nextPrompts) ? nextPrompts.map(normalisePrompt).filter(Boolean) : [];
    library.splice(0, library.length, ...clean);
    if (persist) saveCleanStore();
    browserState.page = 1;
    paintStatus();
    renderLibraryBrowser();
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", {
      detail: { source: "prompt-studio-clean", version: VERSION, total: library.length }
    }));
    return snapshot();
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

  function counts() {
    const enabled = library.filter(prompt => prompt.enabled !== false).length;
    return { total: library.length, enabled, disabled: library.length - enabled };
  }

  function paintStatus() {
    const current = counts();
    const text = `${current.total.toLocaleString("en-GB")} prompts · clean library`;
    document.querySelectorAll("#libraryStatus").forEach(node => {
      node.textContent = text;
      node.title = "Prompt Studio Clean V1. Only the new canonical library is loaded.";
    });
    document.querySelectorAll("[data-workspace-badge=\"prompts\"]").forEach(node => {
      node.textContent = String(current.total);
    });

    const values = {
      promptStudioCleanCount: current.total,
      promptStudioEnabledCount: current.enabled,
      promptStudioDisabledCount: current.disabled,
      promptLibraryBrowserTotal: current.total
    };
    for (const [id, value] of Object.entries(values)) {
      const node = document.getElementById(id);
      if (node) node.textContent = Number(value).toLocaleString("en-GB");
    }
  }

  function promptField(prompt, key) {
    const value = prompt?.[key];
    return value == null ? "" : String(value).trim();
  }

  function promptTags(prompt) {
    return Array.isArray(prompt?.tags) ? prompt.tags.map(String).map(value => value.trim()).filter(Boolean) : [];
  }

  function familyOf(prompt) {
    return promptField(prompt, "family") || promptField(prompt, "familyId") || promptTags(prompt).find(tag => tag.startsWith("family:"))?.slice(7) || "Uncategorised";
  }

  function positionOf(prompt) {
    return (promptField(prompt, "position") || "ANY").toUpperCase();
  }

  function filteredLibrary() {
    const query = browserState.query.trim().toLowerCase();
    return library.filter(prompt => {
      if (browserState.status === "enabled" && prompt.enabled === false) return false;
      if (browserState.status === "disabled" && prompt.enabled !== false) return false;
      if (browserState.position !== "all" && positionOf(prompt) !== browserState.position) return false;
      if (browserState.family !== "all" && familyOf(prompt) !== browserState.family) return false;
      if (!query) return true;

      const haystack = [
        prompt.id,
        prompt.label,
        promptField(prompt, "description"),
        promptField(prompt, "difficulty"),
        familyOf(prompt),
        positionOf(prompt),
        ...promptTags(prompt)
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }

  function selectOptions(values, selected, allLabel) {
    return [`<option value="all">${esc(allLabel)}</option>`, ...values.map(value => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(value)}</option>`)].join("");
  }

  function libraryItemMarkup(prompt) {
    const family = familyOf(prompt);
    const position = positionOf(prompt);
    const difficulty = promptField(prompt, "difficulty");
    const ratingValue = Number(prompt?.rating);
    const rating = Number.isFinite(ratingValue) && ratingValue > 0 ? `${ratingValue.toFixed(ratingValue % 1 ? 1 : 0)}★` : "";
    const tags = promptTags(prompt).slice(0, 4);
    const chips = [
      `<span class="prompt-library-chip ${prompt.enabled === false ? "disabled" : "enabled"}">${prompt.enabled === false ? "Disabled" : "Enabled"}</span>`,
      `<span class="prompt-library-chip">${esc(position)}</span>`,
      `<span class="prompt-library-chip">${esc(family)}</span>`,
      difficulty ? `<span class="prompt-library-chip">${esc(difficulty)}</span>` : "",
      ...tags.map(tag => `<span class="prompt-library-chip">${esc(tag)}</span>`)
    ].filter(Boolean).join("");

    return `
      <article class="prompt-library-item" data-prompt-id="${esc(prompt.id)}">
        <div>
          <h4>${esc(prompt.label)}</h4>
          <span class="prompt-library-item-id">${esc(prompt.id)}</span>
          <div class="prompt-library-meta">${chips}</div>
        </div>
        <div class="prompt-library-item-score">${esc(rating)}</div>
      </article>`;
  }

  function renderLibraryBrowser() {
    const list = document.getElementById("promptLibraryBrowserList");
    if (!list) return;

    const families = [...new Set(library.map(familyOf).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const positions = [...new Set(library.map(positionOf).filter(Boolean))].sort();

    const familySelect = document.getElementById("promptLibraryFamilyFilter");
    const positionSelect = document.getElementById("promptLibraryPositionFilter");
    if (familySelect) familySelect.innerHTML = selectOptions(families, browserState.family, "All families");
    if (positionSelect) positionSelect.innerHTML = selectOptions(positions, browserState.position, "All positions");

    const filtered = filteredLibrary();
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    browserState.page = Math.min(Math.max(1, browserState.page), pageCount);
    const start = (browserState.page - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(start, start + PAGE_SIZE);

    const summary = document.getElementById("promptLibraryResultSummary");
    if (summary) {
      summary.innerHTML = `<strong>${filtered.length.toLocaleString("en-GB")}</strong> of ${library.length.toLocaleString("en-GB")} canonical prompts`;
    }

    const context = document.getElementById("promptLibraryFilterContext");
    if (context) {
      const active = [
        browserState.query ? `search “${browserState.query}”` : "",
        browserState.status !== "all" ? browserState.status : "",
        browserState.position !== "all" ? browserState.position : "",
        browserState.family !== "all" ? browserState.family : ""
      ].filter(Boolean);
      context.textContent = active.length ? active.join(" · ") : "No filters applied";
    }

    if (!library.length) {
      list.innerHTML = `<div class="prompt-library-empty"><strong>The canonical library is empty</strong><span>This is intentional after the clean reset. The browser is ready; prompts will appear here only when they are added through the new Prompt Studio workflow.</span></div>`;
    } else if (!filtered.length) {
      list.innerHTML = `<div class="prompt-library-empty"><strong>No prompts match these filters</strong><span>Change the search or filters to return to the canonical library.</span></div>`;
    } else {
      list.innerHTML = pageItems.map(libraryItemMarkup).join("");
    }

    const pageLabel = document.getElementById("promptLibraryPageLabel");
    if (pageLabel) pageLabel.textContent = `Page ${browserState.page} of ${pageCount}`;
    const previous = document.getElementById("promptLibraryPreviousBtn");
    const next = document.getElementById("promptLibraryNextBtn");
    if (previous) previous.disabled = browserState.page <= 1;
    if (next) next.disabled = browserState.page >= pageCount;

    const exportButton = document.getElementById("promptLibraryExportBtn");
    if (exportButton) exportButton.disabled = library.length === 0;
    paintStatus();
  }

  function resetBrowserFilters() {
    browserState.query = "";
    browserState.status = "all";
    browserState.position = "all";
    browserState.family = "all";
    browserState.page = 1;
    const search = document.getElementById("promptLibrarySearch");
    const status = document.getElementById("promptLibraryStatusFilter");
    if (search) search.value = "";
    if (status) status.value = "all";
    renderLibraryBrowser();
  }

  function exportLibrary() {
    const payload = {
      schema: 1,
      source: "Prompt Studio Clean V1",
      runtimeVersion: VERSION,
      exportedAt: new Date().toISOString(),
      prompts: snapshot()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fpl-prompt-library-clean-v1-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  function wireLibraryBrowser() {
    const search = document.getElementById("promptLibrarySearch");
    const status = document.getElementById("promptLibraryStatusFilter");
    const position = document.getElementById("promptLibraryPositionFilter");
    const family = document.getElementById("promptLibraryFamilyFilter");

    search?.addEventListener("input", event => {
      browserState.query = event.target.value;
      browserState.page = 1;
      renderLibraryBrowser();
    });
    status?.addEventListener("change", event => {
      browserState.status = event.target.value;
      browserState.page = 1;
      renderLibraryBrowser();
    });
    position?.addEventListener("change", event => {
      browserState.position = event.target.value;
      browserState.page = 1;
      renderLibraryBrowser();
    });
    family?.addEventListener("change", event => {
      browserState.family = event.target.value;
      browserState.page = 1;
      renderLibraryBrowser();
    });
    document.getElementById("promptLibraryResetFiltersBtn")?.addEventListener("click", resetBrowserFilters);
    document.getElementById("promptLibraryExportBtn")?.addEventListener("click", exportLibrary);
    document.getElementById("promptLibraryPreviousBtn")?.addEventListener("click", () => {
      browserState.page = Math.max(1, browserState.page - 1);
      renderLibraryBrowser();
    });
    document.getElementById("promptLibraryNextBtn")?.addEventListener("click", () => {
      browserState.page += 1;
      renderLibraryBrowser();
    });
  }

  function renderWorkspace() {
    const workspace = document.getElementById("workspace-prompts") || document.querySelector('[data-workspace="prompts"]');
    if (!workspace) return false;

    const current = counts();
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
            <h2>Prompt Studio clean build</h2>
            <p class="section-copy">The previous Prompt Studio library and V2/V3/V4 loading chain are not part of this runtime. Every new tool now works only against the Clean V1 canonical library.</p>
          </div>
          <span class="phase-chip">v${VERSION}</span>
        </div>

        <div class="prompt-clean-status-grid" aria-label="Prompt Studio clean status">
          <div class="prompt-clean-status-card"><span>Canonical prompts</span><strong id="promptStudioCleanCount">${current.total.toLocaleString("en-GB")}</strong></div>
          <div class="prompt-clean-status-card"><span>Enabled</span><strong id="promptStudioEnabledCount">${current.enabled.toLocaleString("en-GB")}</strong></div>
          <div class="prompt-clean-status-card"><span>Disabled</span><strong id="promptStudioDisabledCount">${current.disabled.toLocaleString("en-GB")}</strong></div>
          <div class="prompt-clean-status-card"><span>Library source</span><strong>Clean V1</strong></div>
        </div>

        <div class="read-only-banner prompt-clean-boundary">
          <strong>Ground-up rebuild boundary</strong>
          <span>Git history preserves the old Studio, but this runtime does not load or merge it. Legacy loaders remain off and old Prompt Studio browser state is cleared.</span>
        </div>

        <section class="prompt-library-browser" aria-labelledby="promptLibraryBrowserHeading">
          <div class="prompt-library-browser-head">
            <div>
              <p class="eyebrow">Library Browser · v1</p>
              <h3 id="promptLibraryBrowserHeading">Canonical prompt library</h3>
              <p>Search and inspect exactly what the new Prompt Studio knows about. This browser is read-only; adding and editing prompts will come through the new Prompt Builder rather than hidden browser overrides.</p>
            </div>
            <div class="prompt-library-browser-actions">
              <button id="promptLibraryResetFiltersBtn" class="button secondary" type="button">Reset filters</button>
              <button id="promptLibraryExportBtn" class="button secondary" type="button"${library.length ? "" : " disabled"}>Export JSON</button>
            </div>
          </div>

          <div class="prompt-library-browser-toolbar">
            <label>Search<input id="promptLibrarySearch" type="search" autocomplete="off" placeholder="Prompt, ID, family or tag" value="${esc(browserState.query)}"></label>
            <label>Status<select id="promptLibraryStatusFilter"><option value="all">All statuses</option><option value="enabled"${browserState.status === "enabled" ? " selected" : ""}>Enabled</option><option value="disabled"${browserState.status === "disabled" ? " selected" : ""}>Disabled</option></select></label>
            <label>Position<select id="promptLibraryPositionFilter"><option value="all">All positions</option></select></label>
            <label>Family<select id="promptLibraryFamilyFilter"><option value="all">All families</option></select></label>
          </div>

          <div class="prompt-library-result-bar">
            <span id="promptLibraryResultSummary"><strong>0</strong> of ${library.length.toLocaleString("en-GB")} canonical prompts</span>
            <span id="promptLibraryFilterContext">No filters applied</span>
          </div>
          <div id="promptLibraryBrowserList" class="prompt-library-list"></div>
          <div class="prompt-library-pagination">
            <button id="promptLibraryPreviousBtn" class="button secondary" type="button" disabled>Previous</button>
            <span id="promptLibraryPageLabel">Page 1 of 1</span>
            <button id="promptLibraryNextBtn" class="button secondary" type="button" disabled>Next</button>
          </div>
        </section>

        <div class="dashboard-action-grid prompt-clean-roadmap" aria-label="Prompt Studio rebuild roadmap">
          <article class="dashboard-action-card"><span class="dashboard-action-icon">+</span><strong>Prompt Builder</strong><small>Create prompts against one explicit schema.</small><em>Next</em></article>
          <article class="dashboard-action-card"><span class="dashboard-action-icon">Q</span><strong>Quality Analyser</strong><small>Test candidates before anything enters the canonical library.</small><em>Planned</em></article>
          <article class="dashboard-action-card"><span class="dashboard-action-icon">R</span><strong>Refinement Incubator</strong><small>Rebuild survivor generation without legacy packs.</small><em>Planned</em></article>
        </div>
      </section>`;

    workspace.setAttribute("aria-labelledby", "workspace-prompts-title");
    wireLibraryBrowser();
    renderLibraryBrowser();
    paintStatus();
    return true;
  }

  function install() {
    clearLegacyBrowserState();
    installStyles();

    // Hard reset the shared array first. This also clears any browser-local prompts that
    // admin-core may have restored earlier in the same page load.
    library.splice(0, library.length);

    // Only the new clean store is eligible to repopulate the library.
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
    getCounts: counts,
    replaceLibrary: prompts => publish(prompts),
    addPrompt,
    removePrompt,
    clearLibrary,
    render: renderWorkspace,
    renderLibraryBrowser
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
