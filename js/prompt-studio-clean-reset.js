/* FPL Draft Challenge — Prompt Studio permanent runtime v1.3.0
   Maintains a small staging library for future prompt-family work while Daily generation
   remains isolated behind the frozen curated authority. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_CLEAN?.version === "1.3.0") return;

  const VERSION = "1.3.0";
  const STORE_KEY = "fplPromptStudioCleanLibraryV1";
  const RESET_MARKER_KEY = "fplPromptStudioCleanResetV1";
  const PAGE_SIZE = 20;
  const DAILY_CURATED_COUNT = 4897;
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
  const browserState = { query: "", status: "all", position: "all", family: "all", page: 1 };

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
    return { ...prompt, id, label, enabled: prompt.enabled !== false };
  }

  function clearLegacyBrowserState() {
    try {
      for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
      localStorage.setItem(RESET_MARKER_KEY, VERSION);
    } catch (_) {}
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
    link.href = window.FPL_ASSET_MANIFEST?.url?.("promptStudioCleanCss") || "admin-prompt-studio-clean.css?v=1.1.0";
    document.head.appendChild(link);
  }

  const snapshot = () => library.map(prompt => ({ ...prompt }));

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

  const removePrompt = id => publish(library.filter(prompt => String(prompt.id) !== String(id || "")));
  const clearLibrary = () => publish([]);

  function counts() {
    const enabled = library.filter(prompt => prompt.enabled !== false).length;
    return { total: library.length, enabled, disabled: library.length - enabled };
  }

  function paintStatus() {
    const current = counts();
    const text = `${current.total.toLocaleString("en-GB")} staging prompts · ${DAILY_CURATED_COUNT.toLocaleString("en-GB")} curated for Daily`;
    document.querySelectorAll("#libraryStatus").forEach(node => {
      node.textContent = text;
      node.title = "Prompt Studio staging is separate from the frozen curated Daily library.";
    });
    document.querySelectorAll('[data-workspace-badge="prompts"]').forEach(node => {
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

  const promptField = (prompt, key) => prompt?.[key] == null ? "" : String(prompt[key]).trim();
  const promptTags = prompt => Array.isArray(prompt?.tags) ? prompt.tags.map(String).map(value => value.trim()).filter(Boolean) : [];
  const familyOf = prompt => promptField(prompt, "family") || promptField(prompt, "familyId") || promptTags(prompt).find(tag => tag.startsWith("family:"))?.slice(7) || "Uncategorised";
  const positionOf = prompt => (promptField(prompt, "position") || "ANY").toUpperCase();

  function filteredLibrary() {
    const query = browserState.query.trim().toLowerCase();
    return library.filter(prompt => {
      if (browserState.status === "enabled" && prompt.enabled === false) return false;
      if (browserState.status === "disabled" && prompt.enabled !== false) return false;
      if (browserState.position !== "all" && positionOf(prompt) !== browserState.position) return false;
      if (browserState.family !== "all" && familyOf(prompt) !== browserState.family) return false;
      if (!query) return true;
      return [prompt.id, prompt.label, promptField(prompt, "description"), promptField(prompt, "difficulty"), familyOf(prompt), positionOf(prompt), ...promptTags(prompt)]
        .join(" ").toLowerCase().includes(query);
    });
  }

  function selectOptions(values, selected, allLabel) {
    return [`<option value="all">${esc(allLabel)}</option>`, ...values.map(value => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(value)}</option>`)].join("");
  }

  function libraryItemMarkup(prompt) {
    const difficulty = promptField(prompt, "difficulty");
    const ratingValue = Number(prompt?.rating);
    const rating = Number.isFinite(ratingValue) && ratingValue > 0 ? `${ratingValue.toFixed(ratingValue % 1 ? 1 : 0)}★` : "";
    const chips = [
      `<span class="prompt-library-chip ${prompt.enabled === false ? "disabled" : "enabled"}">${prompt.enabled === false ? "Disabled" : "Enabled"}</span>`,
      `<span class="prompt-library-chip">${esc(positionOf(prompt))}</span>`,
      `<span class="prompt-library-chip">${esc(familyOf(prompt))}</span>`,
      difficulty ? `<span class="prompt-library-chip">${esc(difficulty)}</span>` : "",
      ...promptTags(prompt).slice(0, 4).map(tag => `<span class="prompt-library-chip">${esc(tag)}</span>`)
    ].filter(Boolean).join("");

    return `<article class="prompt-library-item" data-prompt-id="${esc(prompt.id)}">
      <div><h4>${esc(prompt.label)}</h4><span class="prompt-library-item-id">${esc(prompt.id)}</span><div class="prompt-library-meta">${chips}</div></div>
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
    const pageItems = filtered.slice((browserState.page - 1) * PAGE_SIZE, browserState.page * PAGE_SIZE);

    const summary = document.getElementById("promptLibraryResultSummary");
    if (summary) summary.innerHTML = `<strong>${filtered.length.toLocaleString("en-GB")}</strong> of ${library.length.toLocaleString("en-GB")} staging prompts`;
    const context = document.getElementById("promptLibraryFilterContext");
    if (context) {
      const active = [browserState.query ? `search “${browserState.query}”` : "", browserState.status !== "all" ? browserState.status : "", browserState.position !== "all" ? browserState.position : "", browserState.family !== "all" ? browserState.family : ""].filter(Boolean);
      context.textContent = active.length ? active.join(" · ") : "No filters applied";
    }

    if (!library.length) list.innerHTML = `<div class="prompt-library-empty"><strong>No staging prompts</strong><span>Use Prompt Builder and Quality Analyser when you want to develop a new family. Daily continues using the frozen ${DAILY_CURATED_COUNT.toLocaleString("en-GB")} prompts.</span></div>`;
    else if (!filtered.length) list.innerHTML = `<div class="prompt-library-empty"><strong>No prompts match these filters</strong><span>Change the search or filters.</span></div>`;
    else list.innerHTML = pageItems.map(libraryItemMarkup).join("");

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
    Object.assign(browserState, { query: "", status: "all", position: "all", family: "all", page: 1 });
    const search = document.getElementById("promptLibrarySearch");
    const status = document.getElementById("promptLibraryStatusFilter");
    if (search) search.value = "";
    if (status) status.value = "all";
    renderLibraryBrowser();
  }

  function exportLibrary() {
    const payload = { schema: 1, source: "Prompt Studio staging", runtimeVersion: VERSION, exportedAt: new Date().toISOString(), prompts: snapshot() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fpl-prompt-staging-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    const href = link.href;
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  function wireLibraryBrowser() {
    document.getElementById("promptLibrarySearch")?.addEventListener("input", event => { browserState.query = event.target.value; browserState.page = 1; renderLibraryBrowser(); });
    document.getElementById("promptLibraryStatusFilter")?.addEventListener("change", event => { browserState.status = event.target.value; browserState.page = 1; renderLibraryBrowser(); });
    document.getElementById("promptLibraryPositionFilter")?.addEventListener("change", event => { browserState.position = event.target.value; browserState.page = 1; renderLibraryBrowser(); });
    document.getElementById("promptLibraryFamilyFilter")?.addEventListener("change", event => { browserState.family = event.target.value; browserState.page = 1; renderLibraryBrowser(); });
    document.getElementById("promptLibraryResetFiltersBtn")?.addEventListener("click", resetBrowserFilters);
    document.getElementById("promptLibraryExportBtn")?.addEventListener("click", exportLibrary);
    document.getElementById("promptLibraryPreviousBtn")?.addEventListener("click", () => { browserState.page = Math.max(1, browserState.page - 1); renderLibraryBrowser(); });
    document.getElementById("promptLibraryNextBtn")?.addEventListener("click", () => { browserState.page += 1; renderLibraryBrowser(); });
  }

  function renderWorkspace() {
    const workspace = document.getElementById("workspace-prompts") || document.querySelector('[data-workspace="prompts"]');
    if (!workspace) return false;
    const current = counts();

    workspace.innerHTML = `<header class="workspace-heading"><div><p class="eyebrow">FPL Challenge Studio</p><h1 id="workspace-prompts-title">Prompt Studio</h1><p>Create and validate future prompt families without changing the live Daily pool until they pass the controlled promotion and curated-authority process.</p></div><a class="workspace-live-link" href="./">Open live game</a></header>
      <section class="panel stage-one-tool-panel" id="promptStudioCleanRoot" data-tool-workspace="prompts" data-tool-title="Prompt Studio">
        <div class="panel-heading"><div><p class="eyebrow">Permanent prompt workflow</p><h2>Build, test and promote safely</h2><p class="section-copy">Prompt Builder and Quality Analyser are the maintained development tools. Promotion stores approved source material; Daily remains pinned to the frozen curated selector package until a deliberate authority update is certified.</p></div><span class="phase-chip">v${VERSION}</span></div>

        <div class="prompt-clean-status-grid" aria-label="Prompt Studio status">
          <div class="prompt-clean-status-card"><span>Staging prompts</span><strong id="promptStudioCleanCount">${current.total.toLocaleString("en-GB")}</strong></div>
          <div class="prompt-clean-status-card"><span>Enabled staging</span><strong id="promptStudioEnabledCount">${current.enabled.toLocaleString("en-GB")}</strong></div>
          <div class="prompt-clean-status-card"><span>Disabled staging</span><strong id="promptStudioDisabledCount">${current.disabled.toLocaleString("en-GB")}</strong></div>
          <div class="prompt-clean-status-card"><span>Daily authority</span><strong>${DAILY_CURATED_COUNT.toLocaleString("en-GB")} curated</strong></div>
        </div>

        <div class="read-only-banner prompt-clean-boundary"><strong>New-family safety boundary</strong><span>Creating, testing or promoting prompts does not add them to Daily automatically. A new family must be curated into a versioned selector package and pass Daily authority verification before it can be generated live.</span></div>

        <section class="prompt-library-browser" aria-labelledby="promptLibraryBrowserHeading">
          <div class="prompt-library-browser-head"><div><p class="eyebrow">Staging library</p><h3 id="promptLibraryBrowserHeading">Future prompt work</h3><p>Inspect temporary or manually-added prompts here. The promoted source archive and the curated Daily library are maintained separately.</p></div><div class="prompt-library-browser-actions"><button id="promptLibraryResetFiltersBtn" class="button secondary" type="button">Reset filters</button><button id="promptLibraryExportBtn" class="button secondary" type="button"${library.length ? "" : " disabled"}>Export staging JSON</button></div></div>
          <div class="prompt-library-browser-toolbar"><label>Search<input id="promptLibrarySearch" type="search" autocomplete="off" placeholder="Prompt, ID, family or tag" value="${esc(browserState.query)}"></label><label>Status<select id="promptLibraryStatusFilter"><option value="all">All statuses</option><option value="enabled"${browserState.status === "enabled" ? " selected" : ""}>Enabled</option><option value="disabled"${browserState.status === "disabled" ? " selected" : ""}>Disabled</option></select></label><label>Position<select id="promptLibraryPositionFilter"><option value="all">All positions</option></select></label><label>Family<select id="promptLibraryFamilyFilter"><option value="all">All families</option></select></label></div>
          <div class="prompt-library-result-bar"><span id="promptLibraryResultSummary"><strong>0</strong> of ${library.length.toLocaleString("en-GB")} staging prompts</span><span id="promptLibraryFilterContext">No filters applied</span></div>
          <div id="promptLibraryBrowserList" class="prompt-library-list"></div>
          <div class="prompt-library-pagination"><button id="promptLibraryPreviousBtn" class="button secondary" type="button" disabled>Previous</button><span id="promptLibraryPageLabel">Page 1 of 1</span><button id="promptLibraryNextBtn" class="button secondary" type="button" disabled>Next</button></div>
        </section>

        <div class="dashboard-action-grid prompt-clean-roadmap" aria-label="Permanent prompt workflow">
          <article class="dashboard-action-card"><span class="dashboard-action-icon">+</span><strong>Prompt Builder</strong><small>Create candidates and future families against the current player schema.</small><em>Live</em></article>
          <article class="dashboard-action-card"><span class="dashboard-action-icon">Q</span><strong>Quality Analyser</strong><small>Reject duplicates and weak candidates before promotion.</small><em>Live</em></article>
          <article class="dashboard-action-card"><span class="dashboard-action-icon">P</span><strong>Promotion + source archive</strong><small>Persist approved candidates without changing Daily authority.</small><em>Live</em></article>
          <article class="dashboard-action-card"><span class="dashboard-action-icon">✓</span><strong>Curated Daily authority</strong><small>${DAILY_CURATED_COUNT.toLocaleString("en-GB")} frozen survivors currently power generation.</small><em>Live</em></article>
        </div>
      </section>`;

    workspace.setAttribute("aria-labelledby", "workspace-prompts-title");
    wireLibraryBrowser();
    renderLibraryBrowser();
    paintStatus();
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-clean-rendered", { detail: { version: VERSION } }));
    return true;
  }

  function install() {
    clearLegacyBrowserState();
    installStyles();
    library.splice(0, library.length);
    const cleanStore = readCleanStore();
    if (cleanStore.length) library.push(...cleanStore);
    else saveCleanStore();

    renderWorkspace();
    requestAnimationFrame(renderWorkspace);
    setTimeout(() => { renderWorkspace(); paintStatus(); }, 100);

    document.documentElement.dataset.promptStudioRuntime = "permanent-v1";
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-clean-ready", {
      detail: { version: VERSION, stagingPrompts: library.length, dailyCuratedPrompts: DAILY_CURATED_COUNT }
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
