
(() => {
  "use strict";

  const STORAGE_KEY = "fpl-studio-stage-one-workspace";
  const COLLAPSE_KEY = "fpl-studio-stage-one-collapsed";
  const SCROLL_KEY = "fpl-studio-stage-one-scroll-v1";

  const workspaceDefinitions = [
    {
      id: "dashboard",
      label: "Overview",
      title: "Studio overview",
      icon: "⌂",
      description: "Database health, publishing status and the quickest route to your next task."
    },
    {
      id: "challenge",
      label: "Daily Challenge",
      title: "Daily Challenge",
      icon: "XI",
      description: "Create, review, test and download the next seven-day FPL challenge calendar."
    },
    {
      id: "prompts",
      label: "Prompt Studio",
      title: "Prompt Studio",
      icon: "P",
      description: "Manage, create and quality-check the prompt library."
    },
    {
      id: "validation",
      label: "Validation Lab",
      title: "Validation Lab",
      icon: "V",
      description: "Inspect players, trace prompt rules and certify historical seasons."
    },
    {
      id: "database",
      label: "Database Health",
      title: "Database Health",
      icon: "DB",
      description: "Run the read-only database audit and review anything that still needs research."
    },
    {
      id: "leaderboard",
      label: "Leaderboard",
      title: "Leaderboard",
      icon: "#",
      description: "Check Supabase configuration, deployment readiness and backend health."
    },
    {
      id: "imports",
      label: "Historical Imports",
      title: "Historical Imports",
      icon: "↥",
      description: "Import verified historical seasons and review identity matches safely."
    }
  ];

  const workspaceMap = new Map(workspaceDefinitions.map(item => [item.id, item]));

  function normaliseText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function parseNumber(value) {
    const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function getToolTitle(element) {
    return element.querySelector(":scope > .panel-heading h2, :scope > .section-heading-row h2, :scope > h2")?.textContent?.trim()
      || element.querySelector("h2")?.textContent?.trim()
      || element.id
      || "Studio tool";
  }

  function classifyElement(element) {
    if (element.matches(".studio-hero, .safety-banner, .status-grid")) return "dashboard";

    const title = normaliseText(getToolTitle(element));

    if (/validation lab|player inspector|rule tester|prompt explorer|season health/.test(title)) return "validation";
    if (/prompt library|prompt quality|prompt studio/.test(title)) return "prompts";
    if (/leaderboard backend|leaderboard health|supabase/.test(title)) return "leaderboard";
    if (/historical database import|official fpl archive import|archive import|identity consolidation/.test(title)) return "imports";
    if (/player database auditor|database health/.test(title)) return "database";
    if (/challenge settings|review the generated xi|test mode|download-ready challenge|challenge history|daily challenge/.test(title)) return "challenge";

    return "challenge";
  }

  function createWorkspace(definition) {
    const section = document.createElement("section");
    section.className = "studio-workspace";
    section.dataset.workspace = definition.id;
    section.hidden = definition.id !== "dashboard";
    section.setAttribute("aria-labelledby", `workspace-${definition.id}-title`);

    if (definition.id !== "dashboard") {
      const header = document.createElement("header");
      header.className = "workspace-heading";
      header.innerHTML = `
        <div>
          <p class="eyebrow">FPL Challenge Studio</p>
          <h1 id="workspace-${definition.id}-title">${definition.title}</h1>
          <p>${definition.description}</p>
        </div>
        <a class="workspace-live-link" href="./">Open live game</a>
      `;
      section.appendChild(header);
    }

    return section;
  }

  function createSidebar() {
    const aside = document.createElement("aside");
    aside.className = "studio-sidebar";
    aside.setAttribute("aria-label", "Studio navigation");

    const navItems = workspaceDefinitions.map(item => `
      <button class="studio-nav-button" type="button" data-open-workspace="${item.id}" aria-controls="workspace-${item.id}">
        <span class="studio-nav-icon" aria-hidden="true">${item.icon}</span>
        <span class="studio-nav-copy">
          <strong>${item.label}</strong>
          <small>${item.id === "dashboard" ? "Status and next action" : item.description}</small>
        </span>
        <span class="studio-nav-badge" data-workspace-badge="${item.id}" aria-hidden="true"></span>
      </button>
    `).join("");

    aside.innerHTML = `
      <div class="studio-sidebar-head">
        <div class="studio-mark" aria-hidden="true">FPL</div>
        <div>
          <strong>Challenge Studio</strong>
          <span>Admin tools</span>
        </div>
        <button class="studio-sidebar-close" type="button" aria-label="Close navigation">×</button>
      </div>
      <nav class="studio-navigation">${navItems}</nav>
      <div class="studio-sidebar-footer">
        <span>Safety-first tools</span>
        <strong>Read-only inspection and prompt diagnosis</strong>
        <a href="./">Open live game</a>
      </div>
    `;

    return aside;
  }

  function createTopbar() {
    const topbar = document.createElement("header");
    topbar.className = "studio-topbar";
    topbar.innerHTML = `
      <button class="studio-menu-button" type="button" aria-label="Open studio navigation" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <div class="studio-topbar-title">
        <span>Workspace</span>
        <strong id="activeWorkspaceTitle">Studio overview</strong>
      </div>
      <div class="studio-topbar-status" aria-label="Current studio status">
        <span class="topbar-pill" id="stageOneBlockerPill">Audit not run</span>
        <span class="topbar-pill muted" id="stageOnePromptPill">Prompts loading</span>
      </div>
    `;
    return topbar;
  }

  function createDashboardEnhancements() {
    const wrapper = document.createElement("div");
    wrapper.className = "dashboard-enhancements";
    wrapper.innerHTML = `
      <section class="next-action-card" aria-labelledby="nextActionTitle">
        <div class="next-action-icon" aria-hidden="true">→</div>
        <div>
          <p class="eyebrow">Next recommended action</p>
          <h2 id="nextActionTitle">Run the database audit</h2>
          <p id="nextActionCopy">Start with a fresh read-only scan so the studio can guide database research safely.</p>
        </div>
        <button id="nextActionButton" class="button primary" type="button">Open Database Health</button>
      </section>

      <section class="dashboard-action-section" aria-labelledby="dashboardActionsTitle">
        <div class="dashboard-section-heading">
          <div>
            <p class="eyebrow">Work areas</p>
            <h2 id="dashboardActionsTitle">What are you working on?</h2>
          </div>
          <p>Only the selected work area is shown, so the studio stays focused and easier to navigate.</p>
        </div>
        <div class="dashboard-action-grid">
          <button class="dashboard-action-card" type="button" data-open-workspace="challenge" data-target-title="Challenge settings">
            <span class="dashboard-action-icon">XI</span>
            <strong>Create today's challenge</strong>
            <small>Generate, test and download the seven-day calendar.</small>
            <em id="dashboardChallengeStatus">Ready to create</em>
          </button>
          <button class="dashboard-action-card" type="button" data-open-workspace="prompts" data-target-title="Prompt Library Manager">
            <span class="dashboard-action-icon">P</span>
            <strong>Manage prompts</strong>
            <small>Create prompt batches and review library quality.</small>
            <em id="dashboardPromptStatus">Loading prompt library…</em>
          </button>
          <button class="dashboard-action-card" type="button" data-open-workspace="validation" data-target-title="Validation Lab">
            <span class="dashboard-action-icon">V</span>
            <strong>Validate players and prompts</strong>
            <small>Trace rule failures and check season completeness.</small>
            <em id="dashboardValidationStatus">Player Inspector ready</em>
          </button>
          <button class="dashboard-action-card" type="button" data-open-workspace="database" data-target-title="Player Database Auditor">
            <span class="dashboard-action-icon">DB</span>
            <strong>Check database health</strong>
            <small>Audit blockers, statistics and metadata gaps.</small>
            <em id="dashboardDatabaseStatus">Audit not run</em>
          </button>
          <button class="dashboard-action-card" type="button" data-open-workspace="imports" data-target-title="Historical Database Import Centre">
            <span class="dashboard-action-icon">↥</span>
            <strong>Import a historical season</strong>
            <small>Map clubs, review identities and certify the imported season.</small>
            <em id="dashboardImportStatus">Waiting for a source file</em>
          </button>
        </div>
      </section>
    `;
    return wrapper;
  }

  function labelToolPanel(panel, workspaceId) {
    panel.classList.add("stage-one-tool-panel");
    panel.dataset.toolTitle = getToolTitle(panel);
    panel.dataset.toolWorkspace = workspaceId;

    const eyebrow = panel.querySelector(":scope > .panel-heading .eyebrow, :scope > .section-heading-row .eyebrow");
    if (eyebrow && /^step\s+\d+$/i.test(eyebrow.textContent.trim())) {
      const labels = {
        challenge: "Challenge workflow",
        prompts: "Prompt workspace",
        validation: "Validation lab",
        database: "Database health",
        imports: "Historical imports",
        leaderboard: "Leaderboard backend"
      };
      eyebrow.textContent = labels[workspaceId] || "Studio tool";
    }

    const heading = panel.querySelector(":scope > .panel-heading, :scope > .section-heading-row");
    if (!heading || heading.querySelector(".stage-one-collapse-button")) return;

    const button = document.createElement("button");
    button.className = "stage-one-collapse-button";
    button.type = "button";
    button.textContent = "Collapse";
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", `Collapse ${panel.dataset.toolTitle}`);
    heading.appendChild(button);

    button.addEventListener("click", () => {
      const collapsed = panel.classList.toggle("stage-one-collapsed");
      button.textContent = collapsed ? "Expand" : "Collapse";
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${panel.dataset.toolTitle}`);
      saveCollapsedPanels();
    });
  }

  function getPanelKey(panel) {
    return panel.id || panel.dataset.toolTitle || "panel";
  }

  function saveCollapsedPanels() {
    try {
      const values = [...document.querySelectorAll(".stage-one-tool-panel.stage-one-collapsed")].map(getPanelKey);
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(values));
    } catch (_) {
      // Local storage is optional; the page still works without it.
    }
  }

  function restoreCollapsedPanels() {
    let values = [];
    let hasSavedPreference = false;
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      hasSavedPreference = raw !== null;
      values = JSON.parse(raw || "[]");
    } catch (_) {
      values = [];
    }
    if (!Array.isArray(values)) values = [];
    if (!hasSavedPreference) values.push("historyPanel", "identityConsolidationCentre");

    document.querySelectorAll(".stage-one-tool-panel").forEach(panel => {
      if (!values.includes(getPanelKey(panel))) return;
      panel.classList.add("stage-one-collapsed");
      const button = panel.querySelector(":scope > .panel-heading .stage-one-collapse-button, :scope > .section-heading-row .stage-one-collapse-button");
      if (button) {
        button.textContent = "Expand";
        button.setAttribute("aria-expanded", "false");
      }
    });
  }

  function readScrollState() {
    try {
      const value = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "null");
      return value && typeof value.workspace === "string" && Number.isFinite(Number(value.y)) ? value : null;
    } catch (_) { return null; }
  }

  function activeWorkspaceId() {
    return document.querySelector('.studio-workspace:not([hidden])')?.dataset.workspace || "";
  }

  function saveScrollState() {
    const workspace = activeWorkspaceId();
    if (!workspace) return;
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ workspace, y: Math.max(0, Math.round(window.scrollY || 0)) }));
    } catch (_) {}
  }

  function restoreScrollState(workspaceId) {
    const state = readScrollState();
    if (!state || state.workspace !== workspaceId) return;
    const restore = () => window.scrollTo({ top: Math.max(0, Number(state.y) || 0), behavior: "auto" });
    requestAnimationFrame(() => requestAnimationFrame(restore));
  }

  function updateHero() {
    document.title = "FPL Challenge Studio";
    const hero = document.querySelector(".studio-hero");
    if (!hero) return;

    const eyebrow = hero.querySelector(".eyebrow");
    const title = hero.querySelector("h1");
    const copy = hero.querySelector(".hero-copy");
    const backLink = hero.querySelector(".back-link");

    if (eyebrow) eyebrow.textContent = "FPL Challenge Studio";
    if (title) title.textContent = "Build, test and maintain your FPL game";
    if (copy) copy.textContent = "Create the daily challenge, manage prompts, audit the player database and import historical seasons from one focused workspace.";
    if (backLink) backLink.textContent = "Open live game";

    if (!hero.querySelector(".studio-version-badge")) {
      const badge = document.createElement("span");
      badge.className = "studio-version-badge";
      badge.textContent = "Admin";
      hero.querySelector(":scope > div")?.prepend(badge);
    }
  }

  function findPanelByTitle(title) {
    const wanted = normaliseText(title);
    return [...document.querySelectorAll(".stage-one-tool-panel")].find(panel => normaliseText(panel.dataset.toolTitle) === wanted)
      || [...document.querySelectorAll(".stage-one-tool-panel")].find(panel => normaliseText(panel.dataset.toolTitle).includes(wanted));
  }

  function updateDynamicStatus() {
    const auditText = document.getElementById("auditStatusTop")?.textContent?.trim() || "Not run";
    const critical = parseNumber(document.getElementById("auditCriticalCount")?.textContent);
    const metadata = parseNumber(document.getElementById("auditInfoCount")?.textContent);
    const libraryText = document.getElementById("libraryStatus")?.textContent?.trim() || "Loading…";
    const challengeText = document.getElementById("batchStatus")?.textContent?.trim() || "Ready to generate";
    const importText = document.getElementById("importCentreStatus")?.textContent?.trim() || "Waiting for files";

    const auditHasRun = !/not run|loading|waiting/i.test(auditText) || parseNumber(document.getElementById("auditPlayerCount")?.textContent) > 0;
    const effectiveBlockers = critical;

    const blockerPill = document.getElementById("stageOneBlockerPill");
    const promptPill = document.getElementById("stageOnePromptPill");
    const nextTitle = document.getElementById("nextActionTitle");
    const nextCopy = document.getElementById("nextActionCopy");
    const nextButton = document.getElementById("nextActionButton");

    if (blockerPill) {
      blockerPill.classList.toggle("danger", effectiveBlockers > 0);
      blockerPill.classList.toggle("safe", auditHasRun && effectiveBlockers === 0);
      blockerPill.textContent = !auditHasRun
        ? "Audit not run"
        : effectiveBlockers > 0
          ? `${effectiveBlockers.toLocaleString()} blocker${effectiveBlockers === 1 ? "" : "s"}`
          : "No blockers";
    }

    if (promptPill) promptPill.textContent = libraryText;

    const badges = {
      dashboard: effectiveBlockers > 0 ? String(effectiveBlockers) : "",
      challenge: /ready|passed|calendar zip is ready/i.test(challengeText) ? "✓" : "",
      prompts: parseNumber(libraryText) > 0 ? String(parseNumber(libraryText)) : "",
      validation: "✓",
      database: effectiveBlockers > 0 ? String(effectiveBlockers) : auditHasRun ? "✓" : "!",
      imports: /waiting/i.test(importText) ? "" : "•"
    };

    Object.entries(badges).forEach(([workspace, value]) => {
      const badge = document.querySelector(`[data-workspace-badge="${workspace}"]`);
      if (!badge) return;
      badge.textContent = value;
      badge.hidden = !value;
      badge.classList.toggle("danger", workspace === "database" && effectiveBlockers > 0);
    });

    const challengeStatus = document.getElementById("dashboardChallengeStatus");
    const promptStatus = document.getElementById("dashboardPromptStatus");
    const databaseStatus = document.getElementById("dashboardDatabaseStatus");
    const importStatus = document.getElementById("dashboardImportStatus");
    if (challengeStatus) challengeStatus.textContent = challengeText;
    if (promptStatus) promptStatus.textContent = libraryText;
    if (databaseStatus) databaseStatus.textContent = !auditHasRun
      ? "Audit not run"
      : `${effectiveBlockers.toLocaleString()} blockers · ${metadata.toLocaleString()} metadata gaps`;
    if (importStatus) importStatus.textContent = importText;

    if (!nextTitle || !nextCopy || !nextButton) return;

    if (!auditHasRun) {
      nextTitle.textContent = "Run the database audit";
      nextCopy.textContent = "Start with a fresh read-only scan so the studio can guide the repair work safely.";
      nextButton.textContent = "Open Database Health";
      nextButton.dataset.openWorkspace = "database";
      nextButton.dataset.targetTitle = "Player Database Auditor";
    } else if (effectiveBlockers > 0) {
      nextTitle.textContent = `Review ${effectiveBlockers.toLocaleString()} database blocker${effectiveBlockers === 1 ? "" : "s"}`;
      nextCopy.textContent = metadata > 0
        ? `${metadata.toLocaleString()} metadata gaps are also recorded. Keep unresolved historical values visible until a reliable source is found.`
        : "Use the audit findings to decide the next evidence-backed database fix.";
      nextButton.textContent = "Open Database Audit";
      nextButton.dataset.openWorkspace = "database";
      nextButton.dataset.targetTitle = "Player Database Auditor";
    } else {
      nextTitle.textContent = "Generate the next seven-day calendar";
      nextCopy.textContent = "The database has no blocking errors. Build and test the next dated challenge batch when you are ready.";
      nextButton.textContent = "Open Daily Challenge";
      nextButton.dataset.openWorkspace = "challenge";
      nextButton.dataset.targetTitle = "Challenge settings";
    }
  }

  function initialise() {
    const shell = document.querySelector("main.studio-shell");
    if (!shell || shell.dataset.stageOneReady === "true") return;

    shell.dataset.stageOneReady = "true";
    document.body.classList.add("stage-one-enabled");
    updateHero();

    const originalChildren = [...shell.children];
    // The current Stage One shell is authored in admin.html. Clone that native markup
    // when available; the JS constructors remain only as a cache-safe fallback.
    const nativeTemplate = document.getElementById("studioNativeWorkspaceTemplate");
    const nativeLayout = nativeTemplate?.content?.querySelector(".studio-stage-one-layout")?.cloneNode(true) || null;
    const sidebar = nativeLayout?.querySelector(".studio-sidebar") || createSidebar();
    const mainColumn = nativeLayout?.querySelector(".studio-main-column") || document.createElement("div");
    mainColumn.classList.add("studio-main-column");
    const topbar = nativeLayout?.querySelector(".studio-topbar") || createTopbar();
    const workspaceHost = nativeLayout?.querySelector(".studio-workspace-host") || document.createElement("div");
    workspaceHost.classList.add("studio-workspace-host");

    const workspaces = new Map();
    workspaceDefinitions.forEach(definition => {
      let workspace = nativeLayout?.querySelector(`[data-workspace="${definition.id}"]`) || null;
      if (!workspace) workspace = createWorkspace(definition);
      workspace.id = `workspace-${definition.id}`;
      workspaces.set(definition.id, workspace);
      if (workspace.parentElement !== workspaceHost) workspaceHost.appendChild(workspace);
    });

    const layout = nativeLayout || document.createElement("div");
    layout.classList.add("studio-stage-one-layout");
    if (!nativeLayout) {
      mainColumn.append(topbar, workspaceHost);
      layout.append(sidebar, mainColumn);
    }
    shell.appendChild(layout);

    // Panels authored directly inside native workspaces never pass through originalChildren.
    // Apply the same shared panel metadata/collapse behaviour before legacy panels are moved.
    workspaces.forEach((workspace, workspaceId) => {
      [...workspace.children].forEach(element => {
        if (element.matches(".workspace-heading, .studio-hero, .safety-banner, .status-grid")) return;
        if (!element.classList.contains("stage-one-tool-panel")) labelToolPanel(element, workspaceId);
      });
    });

    originalChildren.forEach(element => {
      const workspaceId = classifyElement(element);
      if (workspaceId === "retired") {
        element.classList.add("studio-retired-tool");
        element.setAttribute("aria-hidden", "true");
        return;
      }
      workspaces.get(workspaceId)?.appendChild(element);
      if (!element.matches(".studio-hero, .safety-banner, .status-grid")) labelToolPanel(element, workspaceId);
    });

    const dashboard = workspaces.get("dashboard");
    const hero = dashboard?.querySelector(".studio-hero");
    const safety = dashboard?.querySelector(".safety-banner");
    const statusGrid = dashboard?.querySelector(".status-grid");
    const enhancements = createDashboardEnhancements();
    if (statusGrid) statusGrid.after(enhancements);
    else if (safety) safety.after(enhancements);
    else if (hero) hero.after(enhancements);
    else dashboard?.prepend(enhancements);

    restoreCollapsedPanels();

    const menuButton = document.querySelector(".studio-menu-button");
    const closeButton = document.querySelector(".studio-sidebar-close");

    const closeSidebar = () => {
      document.body.classList.remove("stage-one-sidebar-open");
      menuButton?.setAttribute("aria-expanded", "false");
    };

    const activateWorkspace = (workspaceId, targetTitle, preserveScroll = false) => {
      const definition = workspaceMap.get(workspaceId) || workspaceMap.get("dashboard");
      const activeId = definition.id;

      workspaces.forEach((workspace, id) => {
        const active = id === activeId;
        workspace.hidden = !active;
        workspace.setAttribute("aria-hidden", String(!active));
      });

      document.querySelectorAll(".studio-nav-button").forEach(button => {
        const active = button.dataset.openWorkspace === activeId;
        button.classList.toggle("active", active);
        button.setAttribute("aria-current", active ? "page" : "false");
      });

      const title = document.getElementById("activeWorkspaceTitle");
      if (title) title.textContent = definition.title;

      try {
        localStorage.setItem(STORAGE_KEY, activeId);
      } catch (_) {
        // Local storage is optional.
      }

      closeSidebar();

      requestAnimationFrame(() => {
        const target = targetTitle ? findPanelByTitle(targetTitle) : null;
        if (target) {
          target.classList.remove("stage-one-collapsed");
          const collapseButton = target.querySelector(":scope > .panel-heading .stage-one-collapse-button, :scope > .section-heading-row .stage-one-collapse-button");
          if (collapseButton) {
            collapseButton.textContent = "Collapse";
            collapseButton.setAttribute("aria-expanded", "true");
          }
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          target.classList.add("stage-one-focus-flash");
          window.setTimeout(() => target.classList.remove("stage-one-focus-flash"), 1200);
        } else if (!preserveScroll) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    };

    document.addEventListener("click", event => {
      const trigger = event.target.closest("[data-open-workspace]");
      if (!trigger) return;
      const workspaceId = trigger.dataset.openWorkspace;
      if (!workspaceMap.has(workspaceId)) return;
      event.preventDefault();
      activateWorkspace(workspaceId, trigger.dataset.targetTitle || "");
    });

    menuButton?.addEventListener("click", () => {
      const open = document.body.classList.toggle("stage-one-sidebar-open");
      menuButton.setAttribute("aria-expanded", String(open));
    });
    closeButton?.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeSidebar();
    });

    let initialWorkspace = "dashboard";
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && workspaceMap.has(saved)) initialWorkspace = saved;
    } catch (_) {
      // Use the dashboard when storage is unavailable.
    }
    activateWorkspace(initialWorkspace, "", true);
    restoreScrollState(initialWorkspace);
    window.addEventListener("pagehide", saveScrollState);
    if (initialWorkspace === "prompts") {
      window.addEventListener("fpl:prompt-tools-ready", () => restoreScrollState("prompts"), { once: true });
    }
    document.documentElement.classList.remove("studio-preboot");
    document.documentElement.dataset.studioStageReady = "true";

    const watchedIds = [
      "auditStatusTop", "auditCriticalCount", "auditInfoCount",
      "libraryStatus", "batchStatus", "importCentreStatus", "auditPlayerCount"
    ];
    const observer = new MutationObserver(updateDynamicStatus);
    watchedIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) observer.observe(element, { childList: true, subtree: true, characterData: true });
    });

    updateDynamicStatus();
  }

  // admin-stage-one.js is loaded immediately after </main>, so the complete Studio markup
  // already exists even while document.readyState is still "loading". Build the modern
  // workspace immediately instead of waiting for every heavy script and DOMContentLoaded.
  if (document.querySelector("main.studio-shell")) {
    initialise();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
