/* FPL Challenge Studio — Prompt Studio workspace redesign v2.0.0
   Reorganises the native Prompt Studio into four focused jobs without changing prompt rules:
   Library, Create, Quality and Review. Existing control IDs and underlying handlers are preserved. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_REDESIGN?.version === "2.0.0") return;

  const VERSION = "2.0.0";
  const VIEW_KEY = "fpl-prompt-studio-view-v2";
  const VALID_VIEWS = new Set(["library", "create", "quality", "review"]);
  const HARD_FLAGS = new Set(["broken-rule", "no-answers", "runtime-error", "invalid-rule"]);
  let installed = false;
  let activeView = "library";
  let refreshTimer = 0;

  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function library() {
    const api = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function census() {
    const current = window.FPL_PROMPT_LIBRARY_CANONICAL_STATE?.getCensus?.()
      || window.FPL_PROMPT_LIBRARY_CENSUS;
    if (current?.ready) return current;
    const items = library();
    const enabled = items.filter(prompt => prompt?.enabled !== false).length;
    return {
      ready: false,
      total: items.length,
      enabled,
      disabled: Math.max(0, items.length - enabled),
      production: items.filter(prompt => prompt?._productionEligible === true).length,
      workingOnly: items.filter(prompt => prompt?._productionEligible !== true).length
    };
  }

  function qualityResults() {
    const values = window.FPL_PROMPT_QUALITY_API?.getResults?.();
    return Array.isArray(values) ? values : [];
  }

  function readStoredView() {
    try {
      const value = localStorage.getItem(VIEW_KEY);
      return VALID_VIEWS.has(value) ? value : "library";
    } catch (_) {
      return "library";
    }
  }

  function storeView(view) {
    try { localStorage.setItem(VIEW_KEY, view); } catch (_) {}
  }

  function setView(view, { scroll = false } = {}) {
    const next = VALID_VIEWS.has(view) ? view : "library";
    activeView = next;
    storeView(next);

    document.querySelectorAll("#workspace-prompts [data-prompt-view-panel]").forEach(panel => {
      const active = panel.dataset.promptViewPanel === next;
      panel.hidden = !active;
      panel.setAttribute("aria-hidden", String(!active));
    });
    document.querySelectorAll("#workspace-prompts [data-prompt-view]").forEach(button => {
      const active = button.dataset.promptView === next;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.setAttribute("tabindex", active ? "0" : "-1");
    });

    const viewTitle = document.getElementById("promptStudioActiveViewLabel");
    if (viewTitle) {
      viewTitle.textContent = ({
        library: "Library",
        create: "Create",
        quality: "Quality",
        review: "Review & promote"
      })[next];
    }

    refreshSummary();
    if (next === "review") refreshReviewQueue();
    if (scroll) document.getElementById(`promptStudioView-${next}`)?.scrollIntoView({ behavior:"smooth", block:"start" });
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-view-changed", { detail:{ view:next } }));
  }

  function createTabs() {
    const nav = document.createElement("nav");
    nav.className = "prompt-studio-tabs";
    nav.setAttribute("aria-label", "Prompt Studio sections");
    nav.setAttribute("role", "tablist");
    nav.innerHTML = `
      <button type="button" data-prompt-view="library" role="tab" aria-controls="promptStudioView-library"><span>Library</span><small>Browse & manage</small></button>
      <button type="button" data-prompt-view="create" role="tab" aria-controls="promptStudioView-create"><span>Create</span><small>Manual & automatic</small></button>
      <button type="button" data-prompt-view="quality" role="tab" aria-controls="promptStudioView-quality"><span>Quality</span><small>Analyse & repair</small></button>
      <button type="button" data-prompt-view="review" role="tab" aria-controls="promptStudioView-review"><span>Review</span><small><strong id="promptStudioReviewBadge">0</strong> waiting</small></button>
    `;
    nav.addEventListener("click", event => {
      const button = event.target.closest("[data-prompt-view]");
      if (!button) return;
      setView(button.dataset.promptView, { scroll:false });
    });
    nav.addEventListener("keydown", event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const buttons = [...nav.querySelectorAll('[data-prompt-view]')];
      const index = Math.max(0, buttons.indexOf(document.activeElement));
      let target = index;
      if (event.key === 'ArrowRight') target = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') target = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = buttons.length - 1;
      event.preventDefault();
      buttons[target]?.focus();
      setView(buttons[target]?.dataset.promptView || 'library');
    });
    return nav;
  }

  function createContextBar() {
    const bar = document.createElement("div");
    bar.className = "prompt-studio-context-bar";
    bar.innerHTML = `
      <div>
        <span>Current section</span>
        <strong id="promptStudioActiveViewLabel">Library</strong>
      </div>
      <p>Only repository-certified prompts can be enabled for the Daily Challenge. Everything else stays disabled until it is promoted or deleted.</p>
    `;
    return bar;
  }

  function makeView(name, title, copy) {
    const section = document.createElement("section");
    section.id = `promptStudioView-${name}`;
    section.className = `prompt-studio-view prompt-studio-view-${name}`;
    section.dataset.promptViewPanel = name;
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-label", title);
    section.innerHTML = `
      <header class="prompt-view-heading">
        <div><p class="eyebrow">Prompt Studio</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div>
      </header>
    `;
    return section;
  }

  function organiseLibraryActions(actions) {
    if (!actions || actions.dataset.promptRedesigned === "true") return;
    actions.dataset.promptRedesigned = "true";
    const newButton = actions.querySelector("#newPromptBtn");
    const utilityNodes = [...actions.children].filter(node => node !== newButton);
    const tools = document.createElement("details");
    tools.className = "prompt-library-utilities";
    tools.innerHTML = '<summary>Library tools</summary><div class="prompt-library-utility-actions"></div>';
    const host = tools.querySelector(".prompt-library-utility-actions");
    utilityNodes.forEach(node => host.appendChild(node));
    if (newButton) {
      newButton.textContent = "Create prompt";
      newButton.classList.add("prompt-create-primary");
      actions.replaceChildren(newButton, tools);
    } else {
      actions.replaceChildren(tools);
    }
  }

  function simplifyFactory(factory) {
    if (!factory || factory.dataset.promptRedesigned === "true") return;
    factory.dataset.promptRedesigned = "true";
    const title = factory.querySelector("#promptFactoryTitle");
    const copy = title?.parentElement?.querySelector("p:last-child");
    if (title) title.textContent = "Automatic prompt generator";
    if (copy) copy.textContent = "Build a checked batch, preview the answer pools, then send the survivors to the disabled review queue.";

    const immediate = document.getElementById("factoryEnablePrompts");
    if (immediate) {
      immediate.checked = false;
      immediate.disabled = true;
      const label = immediate.closest("label");
      if (label) {
        label.classList.add("prompt-policy-lock");
        label.lastChild.textContent = " Save generated prompts disabled for review";
      }
    }
  }

  function simplifyEditor(editor) {
    if (!editor || editor.dataset.promptRedesigned === "true") return;
    editor.dataset.promptRedesigned = "true";
    const enabled = document.getElementById("promptEditorEnabled");
    if (enabled) {
      enabled.addEventListener("change", () => {
        if (enabled.checked) {
          enabled.checked = false;
          const notice = document.getElementById("promptEditorNotice");
          if (notice) notice.textContent = "New and edited working prompts stay disabled until repository promotion certifies them for production.";
        }
      });
    }
  }

  function simplifyQuality(analyser) {
    if (!analyser || analyser.dataset.promptRedesigned === "true") return;
    analyser.dataset.promptRedesigned = "true";
    const title = analyser.querySelector("#promptQualityTitle");
    if (title) title.textContent = "Quality analyser";

    const scope = document.getElementById("qualityScope")?.closest("label");
    if (scope) scope.classList.add("prompt-quality-scope-lock");

    const advanced = document.createElement("details");
    advanced.className = "prompt-quality-advanced";
    advanced.innerHTML = '<summary>Bulk actions & report exports</summary><div class="prompt-quality-advanced-body"></div>';
    const host = advanced.querySelector(".prompt-quality-advanced-body");
    [
      analyser.querySelector(".quality-bulk-disable"),
      analyser.querySelector(".quality-bulk-delete"),
      analyser.querySelector(".quality-actions"),
      analyser.querySelector(".quality-safety-note")
    ].filter(Boolean).forEach(node => host.appendChild(node));
    const listSummary = document.getElementById("promptQualityListSummary");
    if (listSummary) analyser.insertBefore(advanced, listSummary);
    else analyser.appendChild(advanced);
  }

  function reviewState(prompt, result) {
    if (!result) return { key:"unanalyzed", label:"Needs quality analysis", tone:"muted", priority:3 };
    const flags = Array.isArray(result.flags) ? result.flags : [];
    const hard = flags.some(flag => HARD_FLAGS.has(String(flag)));
    const ready = !hard && result.suggestedEnabled !== false && Number(result.suggestedRating || 0) >= 4;
    if (ready) return { key:"ready", label:"Ready for promotion review", tone:"ready", priority:0 };
    if (hard) return { key:"blocked", label:"Blocked by rule health", tone:"danger", priority:1 };
    return { key:"repair", label:"Needs refinement", tone:"warning", priority:2 };
  }

  function renderReviewCard(prompt, result) {
    const state = reviewState(prompt, result);
    const flags = Array.isArray(result?.flags) ? result.flags : [];
    const tags = Array.isArray(prompt?.tags) ? prompt.tags.slice(0, 4) : [];
    const score = Number.isFinite(Number(result?.score)) ? `${Number(result.score)}/100` : "Not analysed";
    const answerCount = Number.isFinite(Number(result?.playerCount)) ? `${Number(result.playerCount)} answers` : "Answer count pending";
    const rating = Number.isFinite(Number(result?.suggestedRating)) ? `${Number(result.suggestedRating)}★ suggested` : `${Number(prompt?.rating || 0)}★ stored`;
    const issueText = flags.length ? flags.slice(0, 3).join(" · ") : (result ? "No major analyser issues" : "Run the Quality analyser to score this prompt");

    return `<article class="prompt-review-card" data-review-prompt="${escapeHtml(prompt.id)}">
      <div class="prompt-review-card-head">
        <span class="prompt-review-position">${escapeHtml(prompt.position || "—")}</span>
        <div><h3>${escapeHtml(prompt.label || prompt.id)}</h3><p>${escapeHtml(prompt.id)}</p></div>
        <span class="prompt-review-state ${state.tone}">${escapeHtml(state.label)}</span>
      </div>
      <div class="prompt-review-metrics"><span>${escapeHtml(score)}</span><span>${escapeHtml(rating)}</span><span>${escapeHtml(answerCount)}</span></div>
      <p class="prompt-review-issues">${escapeHtml(issueText)}</p>
      ${tags.length ? `<div class="prompt-review-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      <div class="prompt-review-actions">
        <button type="button" class="button secondary" data-review-open="${escapeHtml(prompt.id)}">Open in Library</button>
        <button type="button" class="button secondary" data-review-quality="${escapeHtml(prompt.id)}">Quality details</button>
        <button type="button" class="button secondary prompt-promotion-state" disabled>${state.key === "ready" ? "Promotion gate passed" : "Not promotion-ready"}</button>
        <button type="button" class="button danger-button" data-review-delete="${escapeHtml(prompt.id)}">Delete</button>
      </div>
    </article>`;
  }

  function refreshReviewQueue() {
    const host = document.getElementById("promptStudioReviewList");
    if (!host) return;
    const items = library().filter(prompt => prompt?._productionEligible !== true || prompt?.enabled === false);
    const byId = new Map(qualityResults().map(result => [String(result?.id || ""), result]));
    const rows = items.map(prompt => ({ prompt, result:byId.get(String(prompt.id)) || null }))
      .sort((left, right) => {
        const a = reviewState(left.prompt, left.result).priority;
        const b = reviewState(right.prompt, right.result).priority;
        return a - b || String(left.prompt.position || "").localeCompare(String(right.prompt.position || "")) || String(left.prompt.label || "").localeCompare(String(right.prompt.label || ""));
      });

    const checked = rows.filter(row => row.result).length;
    const ready = rows.filter(row => reviewState(row.prompt, row.result).key === "ready").length;
    const blocked = rows.filter(row => reviewState(row.prompt, row.result).key === "blocked").length;
    const summary = document.getElementById("promptStudioReviewSummary");
    if (summary) {
      summary.innerHTML = `
        <article><span>Waiting</span><strong>${rows.length.toLocaleString("en-GB")}</strong></article>
        <article><span>Quality checked</span><strong>${checked.toLocaleString("en-GB")}</strong></article>
        <article><span>Promotion-review ready</span><strong>${ready.toLocaleString("en-GB")}</strong></article>
        <article><span>Rule-health blocked</span><strong>${blocked.toLocaleString("en-GB")}</strong></article>`;
    }

    const visible = rows.slice(0, 80);
    host.innerHTML = visible.length
      ? visible.map(row => renderReviewCard(row.prompt, row.result)).join("")
      : '<div class="prompt-review-empty"><strong>No disabled prompts are waiting.</strong><span>The working library is fully resolved.</span></div>';
    const footer = document.getElementById("promptStudioReviewFooter");
    if (footer) footer.textContent = rows.length > visible.length
      ? `Showing the first ${visible.length.toLocaleString("en-GB")} of ${rows.length.toLocaleString("en-GB")} prompts. Use Library search for the rest.`
      : `${rows.length.toLocaleString("en-GB")} prompt${rows.length === 1 ? "" : "s"} in the review queue.`;
  }

  function refreshSummary() {
    const value = census();
    const badge = document.getElementById("promptStudioReviewBadge");
    if (badge) badge.textContent = Number(value.disabled || value.workingOnly || 0).toLocaleString("en-GB");
    const workspaceCopy = document.querySelector('#workspace-prompts > .workspace-heading p:last-child');
    if (workspaceCopy && value.total) {
      workspaceCopy.textContent = `${Number(value.enabled || 0).toLocaleString("en-GB")} enabled · ${Number(value.disabled || 0).toLocaleString("en-GB")} disabled · ${Number(value.total || 0).toLocaleString("en-GB")} total. Create, analyse and review from one workspace.`;
    }
  }

  function openPromptInLibrary(id) {
    setView("library");
    const search = document.getElementById("promptManagerSearch");
    const status = document.getElementById("promptManagerStatusFilter");
    if (search) search.value = String(id || "");
    if (status) status.value = "disabled";
    search?.dispatchEvent(new Event("input", { bubbles:true }));
    status?.dispatchEvent(new Event("change", { bubbles:true }));
    document.getElementById("promptManagerList")?.scrollIntoView({ behavior:"smooth", block:"start" });
  }

  function openPromptInQuality(id) {
    setView("quality");
    const search = document.getElementById("qualitySearch");
    if (search) {
      search.value = String(id || "");
      search.dispatchEvent(new Event("input", { bubbles:true }));
    }
    const results = qualityResults();
    if (!results.length) {
      const status = document.getElementById("promptQualityStatus");
      if (status) status.textContent = `Run full quality analysis to score ${id}.`;
    }
  }

  function bindReviewActions(reviewView) {
    reviewView.addEventListener("click", event => {
      const open = event.target.closest("[data-review-open]");
      if (open) return openPromptInLibrary(open.dataset.reviewOpen);

      const quality = event.target.closest("[data-review-quality]");
      if (quality) return openPromptInQuality(quality.dataset.reviewQuality);

      const remove = event.target.closest("[data-review-delete]");
      if (!remove) return;
      const id = String(remove.dataset.reviewDelete || "");
      const prompt = library().find(item => String(item?.id || "") === id);
      if (!prompt) return;
      if (!window.confirm(`Delete “${prompt.label || id}” from the working Prompt Studio library?`)) return;
      const result = window.FPL_PROMPT_MANAGER_API?.deletePrompts?.([id]);
      if (result?.deleted) {
        window.FPL_PROMPT_LIBRARY_CANONICAL_STATE?.reconcile?.();
        scheduleRefresh(60);
      }
    });
  }

  function installInteractionRouting(panel) {
    panel.addEventListener("click", event => {
      if (event.target.closest("#newPromptBtn")) {
        setView("create");
        setTimeout(() => {
          const enabled = document.getElementById("promptEditorEnabled");
          if (enabled) enabled.checked = false;
          document.getElementById("promptEditor")?.scrollIntoView({ behavior:"smooth", block:"start" });
        }, 0);
        return;
      }
      const managerAction = event.target.closest('#promptManagerList button[data-action="edit"], #promptManagerList button[data-action="duplicate"]');
      if (managerAction) setTimeout(() => setView("create"), 0);
    }, true);
  }

  function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshSummary();
      if (activeView === "review") refreshReviewQueue();
    }, delay);
  }

  function install() {
    if (installed) return true;
    const workspace = document.getElementById("workspace-prompts");
    const panel = document.getElementById("libraryManagerPanel");
    if (!workspace || !panel || !workspace.contains(panel)) return false;
    installed = true;

    workspace.classList.add("prompt-studio-v2");
    panel.classList.add("prompt-studio-redesign");
    panel.classList.remove("stage-one-collapsed");
    panel.querySelector(":scope > .panel-heading .stage-one-collapse-button")?.remove();

    const heading = panel.querySelector(":scope > .panel-heading");
    if (heading) heading.classList.add("prompt-studio-legacy-heading");

    const countGrid = panel.querySelector(":scope > .manager-count-grid");
    const toolbar = panel.querySelector(":scope > .manager-toolbar");
    const actions = panel.querySelector(":scope > .manager-actions");
    const managerStatus = panel.querySelector(":scope > #managerStatus");
    const factory = panel.querySelector(":scope > #automaticPromptFactory");
    const analyser = panel.querySelector(":scope > #promptQualityAnalyser");
    const editor = panel.querySelector(":scope > #promptEditor");
    const listHeading = panel.querySelector(":scope > .library-list-heading");
    const managerList = panel.querySelector(":scope > #promptManagerList");
    if (!countGrid || !toolbar || !actions || !managerStatus || !factory || !analyser || !editor || !listHeading || !managerList) {
      installed = false;
      return false;
    }

    const tabs = createTabs();
    const contextBar = createContextBar();
    const host = document.createElement("div");
    host.className = "prompt-studio-view-host";

    const libraryView = makeView("library", "Prompt library", "Search the entire canonical library. Enabled prompts are live; every other prompt stays disabled until promotion or deletion.");
    const createView = makeView("create", "Create prompts", "Use the manual rule builder or automatic generators. New ideas enter the disabled review queue by default.");
    const qualityView = makeView("quality", "Quality control", "Run one full-library quality analysis, then repair low-scoring, overlapping or unhealthy prompts.");
    const reviewView = makeView("review", "Review & promote", "Work through disabled candidates. Passing quality makes a prompt ready for repository promotion; it never enables itself automatically.");

    organiseLibraryActions(actions);
    simplifyFactory(factory);
    simplifyEditor(editor);
    simplifyQuality(analyser);

    libraryView.append(toolbar, actions, managerStatus, listHeading, managerList);
    createView.append(factory, editor);
    qualityView.append(analyser);

    const reviewSummary = document.createElement("div");
    reviewSummary.id = "promptStudioReviewSummary";
    reviewSummary.className = "prompt-review-summary";
    const reviewNotice = document.createElement("div");
    reviewNotice.className = "prompt-review-policy";
    reviewNotice.innerHTML = '<strong>Promotion is deliberately separate from editing.</strong><span>A disabled prompt can only become live after it is added to the repository-certified production pool and passes the normal 4★+ safeguards.</span>';
    const reviewList = document.createElement("div");
    reviewList.id = "promptStudioReviewList";
    reviewList.className = "prompt-review-list";
    const reviewFooter = document.createElement("p");
    reviewFooter.id = "promptStudioReviewFooter";
    reviewFooter.className = "prompt-review-footer";
    reviewView.append(reviewSummary, reviewNotice, reviewList, reviewFooter);
    bindReviewActions(reviewView);

    host.append(libraryView, createView, qualityView, reviewView);
    if (heading) heading.after(countGrid, tabs, contextBar, host);
    else panel.prepend(countGrid, tabs, contextBar, host);

    installInteractionRouting(panel);

    window.addEventListener("fpl:canonical-prompt-library-state", () => scheduleRefresh(0));
    window.addEventListener("fpl:prompt-library-changed", () => scheduleRefresh(60));
    window.addEventListener("fpl:prompt-tools-ready", () => scheduleRefresh(60));
    window.addEventListener("fpl:prompt-field-readiness-ready", () => scheduleRefresh(60));

    const qualitySummary = document.getElementById("promptQualitySummary");
    if (qualitySummary && !qualitySummary.dataset.promptReviewObserver) {
      qualitySummary.dataset.promptReviewObserver = "true";
      new MutationObserver(() => scheduleRefresh(80)).observe(qualitySummary, { childList:true, subtree:true, characterData:true, attributes:true });
    }

    activeView = readStoredView();
    setView(activeView);
    refreshSummary();
    scheduleRefresh(250);

    window.FPL_PROMPT_STUDIO_REDESIGN = Object.freeze({
      version: VERSION,
      ready: true,
      setView,
      getView: () => activeView,
      refresh: () => scheduleRefresh(0),
      refreshReviewQueue
    });
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-redesign-ready", { detail:{ version:VERSION } }));
    return true;
  }

  let attempts = 0;
  function retry() {
    if (install()) return;
    attempts += 1;
    if (attempts < 120) setTimeout(retry, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once:true });
  else retry();
  window.addEventListener("fpl:studio-bootstrap-ready", retry);
  window.addEventListener("fpl:studio-workspace-changed", event => {
    if (event?.detail?.workspace === "prompts") retry();
  });
})();
