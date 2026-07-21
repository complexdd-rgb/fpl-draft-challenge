/* FPL Challenge Studio Phase 7 — read-only player database auditor. */
(() => {
  "use strict";

  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const PAGE_SIZE = 12;
  const VALID_POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  const PERFORMANCE_FIELDS = ["goals", "assists", "cleanSheets", "bonus", "saves", "goalsConceded"];
  const NUMERIC_FIELDS = ["points", "minutes", "goals", "assists", "cleanSheets", "bonus", "saves", "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice"];
  const SURNAME_PARTICLES = new Set(["al", "ap", "bin", "bint", "da", "das", "de", "del", "della", "den", "der", "di", "dos", "du", "el", "la", "le", "van", "von", "y"]);

  const state = {
    running: false,
    groups: [],
    rows: [],
    filteredGroups: [],
    page: 1,
    report: null
  };

  const elements = {};

  window.addEventListener("load", initialise, { once: true });

  function initialise() {
    [
      "auditStatusTop", "auditReadyChip", "auditPlayerCount", "auditSeasonCount", "auditCriticalCount",
      "auditWarningCount", "auditInfoCount", "auditNameReady", "runDatabaseAuditBtn", "downloadAuditJsonBtn",
      "downloadAuditCsvBtn", "copyAuditSummaryBtn", "auditProgressWrap", "auditProgressText", "auditProgressPercent",
      "auditProgressBar", "auditActionStatus", "auditReadinessPanel", "auditReadinessHeading", "auditReadinessCopy",
      "auditPriorityList", "auditCategorySummary", "auditSearch", "auditSeverityFilter", "auditCategoryFilter",
      "auditListSummary", "auditPreviousPageBtn", "auditNextPageBtn", "auditPageLabel", "auditIssueList"
    ].forEach(id => elements[id] = document.getElementById(id));

    if (!elements.runDatabaseAuditBtn) return;

    elements.runDatabaseAuditBtn.addEventListener("click", runAudit);
    elements.downloadAuditJsonBtn.addEventListener("click", downloadJsonReport);
    elements.downloadAuditCsvBtn.addEventListener("click", downloadCsvReport);
    elements.copyAuditSummaryBtn.addEventListener("click", copySummary);
    elements.auditSearch.addEventListener("input", applyFilters);
    elements.auditSeverityFilter.addEventListener("change", applyFilters);
    elements.auditCategoryFilter.addEventListener("change", applyFilters);
    elements.auditPreviousPageBtn.addEventListener("click", () => changePage(-1));
    elements.auditNextPageBtn.addEventListener("click", () => changePage(1));

    const seasonCount = players.reduce((total, player) => total + (Array.isArray(player.seasons) ? player.seasons.length : 0), 0);
    elements.auditPlayerCount.textContent = players.length.toLocaleString();
    elements.auditSeasonCount.textContent = seasonCount.toLocaleString();

    if (!players.length) {
      setTopStatus("Database unavailable", "blocked");
      elements.auditActionStatus.textContent = "players.js did not load, so the database cannot be audited.";
      elements.runDatabaseAuditBtn.disabled = true;
      return;
    }

    setTopStatus("Ready to scan", "pending");
    setTimeout(runAudit, 350);
  }

  async function runAudit() {
    if (state.running) return;
    state.running = true;
    state.groups = [];
    state.rows = [];
    state.filteredGroups = [];
    state.page = 1;
    state.report = null;

    setTopStatus("Auditing…", "pending");
    elements.runDatabaseAuditBtn.disabled = true;
    elements.runDatabaseAuditBtn.textContent = "Auditing database…";
    elements.downloadAuditJsonBtn.disabled = true;
    elements.downloadAuditCsvBtn.disabled = true;
    elements.copyAuditSummaryBtn.disabled = true;
    elements.auditProgressWrap.classList.remove("hidden");
    elements.auditReadinessPanel.classList.add("hidden");
    elements.auditCategorySummary.innerHTML = "";
    elements.auditIssueList.innerHTML = "";
    elements.auditActionStatus.textContent = "Scanning identities, player-seasons, statistics and metadata…";

    const groupMap = new Map();
    const idMap = new Map();
    const normalisedNameMap = new Map();
    let seasonCount = 0;
    let nameReadyCount = 0;
    let latestSeasonYear = 0;

    for (const player of players) {
      for (const season of Array.isArray(player.seasons) ? player.seasons : []) {
        latestSeasonYear = Math.max(latestSeasonYear, parseSeasonStartYear(season.season) || 0);
      }
    }

    const addFinding = (definition, occurrence = {}) => {
      const key = definition.code;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          code: definition.code,
          severity: definition.severity,
          category: definition.category,
          title: definition.title,
          explanation: definition.explanation,
          recommendation: definition.recommendation,
          count: 0,
          samples: []
        });
      }
      const group = groupMap.get(key);
      group.count += 1;
      const row = {
        severity: definition.severity,
        category: definition.category,
        code: definition.code,
        issue: definition.title,
        playerId: occurrence.playerId || "",
        playerName: occurrence.playerName || "",
        season: occurrence.season || "",
        club: occurrence.club || "",
        field: occurrence.field || "",
        currentValue: serialiseValue(occurrence.currentValue),
        expected: serialiseValue(occurrence.expected),
        detail: occurrence.detail || definition.explanation
      };
      state.rows.push(row);
      if (group.samples.length < 6) group.samples.push(row);
    };

    for (let index = 0; index < players.length; index += 1) {
      const player = players[index] || {};
      const playerId = String(player.playerId || "").trim();
      const playerName = String(player.name || "").trim();
      const seasons = Array.isArray(player.seasons) ? player.seasons : [];
      const context = { playerId, playerName };

      if (!playerId) addFinding(DEFINITIONS.missingPlayerId, context);
      else if (idMap.has(playerId)) addFinding(DEFINITIONS.duplicatePlayerId, { ...context, detail: `Also used by ${idMap.get(playerId)}.` });
      else idMap.set(playerId, playerName || "Unnamed player");

      if (!playerName) addFinding(DEFINITIONS.missingPlayerName, context);
      if (!seasons.length) addFinding(DEFINITIONS.emptySeasonList, context);

      const normalisedName = normaliseName(playerName);
      if (normalisedName) {
        if (!normalisedNameMap.has(normalisedName)) normalisedNameMap.set(normalisedName, []);
        normalisedNameMap.get(normalisedName).push({ playerId, playerName, seasons: seasons.map(item => item?.season).filter(Boolean) });
      }

      const nameParts = deriveNameParts(playerName);
      if (nameParts.ready) nameReadyCount += 1;
      else if (playerName) addFinding(DEFINITIONS.singleWordName, { ...context, currentValue: playerName });
      if (/\d/.test(playerName)) addFinding(DEFINITIONS.numericName, { ...context, currentValue: playerName });

      const dobRaw = player.bio?.dateOfBirth;
      const dob = parseDate(dobRaw);
      if (!dobRaw) addFinding(DEFINITIONS.missingDob, context);
      else if (!dob) addFinding(DEFINITIONS.invalidDob, { ...context, currentValue: dobRaw, expected: "YYYY-MM-DD" });

      const seasonMap = new Map();
      for (const season of seasons) {
        seasonCount += 1;
        const seasonLabel = String(season?.season || "").trim();
        const seasonContext = { ...context, season: seasonLabel, club: String(season?.club || "") };

        if (!seasonLabel || !/^\d{4}\/\d{2}$/.test(seasonLabel)) {
          addFinding(DEFINITIONS.invalidSeasonLabel, { ...seasonContext, currentValue: seasonLabel, expected: "YYYY/YY" });
        }

        if (seasonMap.has(seasonLabel)) {
          const previous = seasonMap.get(seasonLabel);
          addFinding(DEFINITIONS.duplicatePlayerSeason, {
            ...seasonContext,
            currentValue: `${previous.club || "Unknown club"} and ${season?.club || "Unknown club"}`,
            expected: "One season record per player identity",
            detail: `${playerName || playerId} has more than one ${seasonLabel} record. This usually means two different footballers were merged under one name.`
          });
        } else seasonMap.set(seasonLabel, season || {});

        if (!season?.club) addFinding(DEFINITIONS.missingClub, seasonContext);
        if (!VALID_POSITIONS.has(season?.position)) {
          addFinding(DEFINITIONS.invalidPosition, { ...seasonContext, field: "position", currentValue: season?.position, expected: "GK, DEF, MID or FWD" });
        }

        const managerNames = Array.isArray(season?.managers) ? season.managers.filter(Boolean).map(String) : [];
        if (!managerNames.length) addFinding(DEFINITIONS.missingManagers, seasonContext);

        const looksLikeManagerRecord = !VALID_POSITIONS.has(season?.position) || Number(season?.startingPrice) < 3.5;
        const playerIsListedManager = managerNames.some(manager => normaliseName(manager) === normalisedName);
        if (looksLikeManagerRecord && playerIsListedManager) {
          addFinding(DEFINITIONS.managerStoredAsPlayer, {
            ...seasonContext,
            currentValue: `${season?.position || "?"}, £${season?.startingPrice ?? "?"}m`,
            expected: "Remove non-player fantasy manager record",
            detail: `${playerName} appears to be a fantasy manager entry rather than a footballer.`
          });
        }

        for (const field of NUMERIC_FIELDS) {
          const value = season?.[field];
          if (!Number.isFinite(value)) {
            addFinding(DEFINITIONS.invalidNumeric(field), { ...seasonContext, field, currentValue: value, expected: "Finite number" });
          } else if (field !== "points" && value < 0) {
            addFinding(DEFINITIONS.negativeNumeric(field), { ...seasonContext, field, currentValue: value, expected: "0 or more" });
          }
        }

        for (const priceField of ["startingPrice", "finalPrice"]) {
          const price = season?.[priceField];
          if (Number.isFinite(price) && (price < 3.5 || price > 15.5)) {
            addFinding(DEFINITIONS.invalidPrice, { ...seasonContext, field: priceField, currentValue: price, expected: "£3.5m–£15.5m" });
          } else if (Number.isFinite(price) && Math.abs(price * 10 - Math.round(price * 10)) > 1e-8) {
            addFinding(DEFINITIONS.pricePrecision, { ...seasonContext, field: priceField, currentValue: price, expected: "One decimal place" });
          }
        }

        if (Number(season?.minutes) === 0 && PERFORMANCE_FIELDS.some(field => Number(season?.[field]) > 0)) {
          addFinding(DEFINITIONS.zeroMinutesPerformance, {
            ...seasonContext,
            currentValue: PERFORMANCE_FIELDS.filter(field => Number(season?.[field]) > 0).map(field => `${field}=${season[field]}`).join(", "),
            expected: "Performance statistics normally require minutes played"
          });
        }

        const seasonYear = parseSeasonStartYear(seasonLabel);
        if (seasonYear && seasonYear < latestSeasonYear && !Number.isFinite(season?.leaguePosition)) {
          addFinding(DEFINITIONS.missingLeaguePosition, { ...seasonContext, field: "leaguePosition", currentValue: season?.leaguePosition, expected: "1–20" });
        }

        if (Number.isFinite(season?.leaguePosition)) {
          const position = Number(season.leaguePosition);
          if (position < 1 || position > 20) {
            addFinding(DEFINITIONS.invalidLeaguePosition, { ...seasonContext, field: "leaguePosition", currentValue: position, expected: "1–20" });
          } else {
            const expectedFlags = {
              champions: position === 1,
              topFour: position <= 4,
              bottomHalf: position >= 11,
              relegated: position >= 18
            };
            Object.entries(expectedFlags).forEach(([field, expected]) => {
              if (Boolean(season?.[field]) !== expected) {
                addFinding(DEFINITIONS.flagMismatch(field), { ...seasonContext, field, currentValue: season?.[field], expected });
              }
            });
          }
        }

        const age = season?.ageAtSeasonStart;
        if (!Number.isFinite(age)) {
          addFinding(DEFINITIONS.missingAge, seasonContext);
        } else {
          if (age < 15 || age > 45) addFinding(DEFINITIONS.impossibleAge, { ...seasonContext, field: "ageAtSeasonStart", currentValue: age, expected: "15–45" });
          else if (age === 15 || age >= 40) addFinding(DEFINITIONS.ageReview, { ...seasonContext, field: "ageAtSeasonStart", currentValue: age, expected: "Confirm unusually young/old player" });

          if (dob && seasonYear) {
            const expectedAge = ageOnDate(dob, new Date(Date.UTC(seasonYear, 7, 1)));
            if (Number.isFinite(expectedAge) && Math.abs(age - expectedAge) > 1) {
              addFinding(DEFINITIONS.ageDobMismatch, { ...seasonContext, field: "ageAtSeasonStart", currentValue: age, expected: `${expectedAge} (approximately, from DOB ${dobRaw})` });
            }
          }
        }
      }

      if ((index + 1) % 120 === 0 || index === players.length - 1) {
        const percent = Math.round(((index + 1) / players.length) * 92);
        updateProgress(percent, `Scanning player ${Math.min(index + 1, players.length).toLocaleString()} of ${players.length.toLocaleString()}…`);
        await nextFrame();
      }
    }

    updateProgress(94, "Checking duplicate identities across player IDs…");
    for (const entries of normalisedNameMap.values()) {
      if (entries.length < 2) continue;
      const ids = new Set(entries.map(entry => entry.playerId));
      if (ids.size < 2) continue;
      const allSeasons = entries.flatMap(entry => entry.seasons);
      addFinding(DEFINITIONS.splitIdentity, {
        playerId: entries.map(entry => entry.playerId).join(" | "),
        playerName: entries[0].playerName,
        season: [...new Set(allSeasons)].sort().join(", "),
        currentValue: entries.map(entry => entry.playerId).join(", "),
        expected: "One stable playerId per footballer",
        detail: `${entries[0].playerName} appears under ${entries.length} player IDs. This can let the same footballer be selected twice.`
      });
    }

    updateProgress(97, "Grouping findings and calculating expansion readiness…");
    state.groups = [...groupMap.values()].sort(compareGroups);
    const severityCounts = countBySeverity(state.rows);
    const categoryCounts = countByCategory(state.rows);
    const nameReadyPercent = players.length ? (nameReadyCount / players.length) * 100 : 0;

    state.report = {
      generatedAt: new Date().toISOString(),
      database: {
        players: players.length,
        playerSeasons: seasonCount,
        latestSeasonStartYear: latestSeasonYear,
        nameRuleReadyPlayers: nameReadyCount,
        nameRuleReadyPercent: Number(nameReadyPercent.toFixed(1))
      },
      summary: {
        blockingOccurrences: severityCounts.critical,
        warningOccurrences: severityCounts.warning,
        metadataOccurrences: severityCounts.info,
        issueTypes: state.groups.length,
        categories: categoryCounts
      },
      groupedFindings: state.groups,
      detailedFindings: state.rows
    };

    elements.auditPlayerCount.textContent = players.length.toLocaleString();
    elements.auditSeasonCount.textContent = seasonCount.toLocaleString();
    elements.auditCriticalCount.textContent = severityCounts.critical.toLocaleString();
    elements.auditWarningCount.textContent = severityCounts.warning.toLocaleString();
    elements.auditInfoCount.textContent = severityCounts.info.toLocaleString();
    elements.auditNameReady.textContent = `${nameReadyPercent.toFixed(1)}%`;

    updateProgress(100, "Audit complete");
    renderCategorySummary(categoryCounts);
    renderReadiness(severityCounts);
    applyFilters();

    elements.downloadAuditJsonBtn.disabled = false;
    elements.downloadAuditCsvBtn.disabled = false;
    elements.copyAuditSummaryBtn.disabled = false;
    elements.runDatabaseAuditBtn.disabled = false;
    elements.runDatabaseAuditBtn.textContent = "Run audit again";
    elements.auditActionStatus.textContent = `Audit complete: ${severityCounts.critical.toLocaleString()} blocking occurrences, ${severityCounts.warning.toLocaleString()} warnings and ${severityCounts.info.toLocaleString()} metadata gaps across ${state.groups.length} issue types.`;
    state.running = false;

    if (severityCounts.critical > 0) setTopStatus(`${severityCounts.critical.toLocaleString()} blockers found`, "blocked");
    else if (severityCounts.warning > 0) setTopStatus("Passed with warnings", "warning");
    else setTopStatus("Database passed", "ready");

    setTimeout(() => elements.auditProgressWrap.classList.add("hidden"), 900);
  }

  function renderReadiness(counts) {
    elements.auditReadinessPanel.classList.remove("hidden");
    const priorities = state.groups.filter(group => group.severity === "critical").slice(0, 4);
    if (counts.critical > 0) {
      elements.auditReadinessHeading.textContent = "Fix blockers before expanding the player pool";
      elements.auditReadinessCopy.textContent = "The current game can continue running, but adding older seasons now would make identity and data-quality problems harder to untangle.";
    } else if (counts.warning > 0) {
      elements.auditReadinessHeading.textContent = "Safe to expand carefully";
      elements.auditReadinessCopy.textContent = "No blocking corruption was found. Review the warnings, then add one historical season at a time and rerun this audit after each import.";
    } else {
      elements.auditReadinessHeading.textContent = "Ready for controlled expansion";
      elements.auditReadinessCopy.textContent = "The database passed all blocking and warning checks. Keep a backup and import older seasons one at a time.";
    }
    elements.auditPriorityList.innerHTML = priorities.length
      ? priorities.map(group => `<div><span>${escapeHtml(group.title)}</span><strong>${group.count.toLocaleString()}</strong></div>`).join("")
      : `<div><span>Blocking issue types</span><strong>0</strong></div>`;
  }

  function renderCategorySummary(categoryCounts) {
    const labels = {
      identity: "Identity",
      structure: "Structure",
      statistics: "Statistics",
      age: "Age and DOB",
      league: "League data",
      metadata: "Metadata gaps",
      names: "Name rules"
    };
    elements.auditCategorySummary.innerHTML = Object.entries(labels).map(([key, label]) => {
      const count = categoryCounts[key] || 0;
      return `<button type="button" data-audit-category="${key}"><span>${label}</span><strong>${count.toLocaleString()}</strong></button>`;
    }).join("");
    elements.auditCategorySummary.querySelectorAll("[data-audit-category]").forEach(button => {
      button.addEventListener("click", () => {
        elements.auditCategoryFilter.value = button.dataset.auditCategory;
        applyFilters();
        elements.auditIssueList.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function applyFilters() {
    const query = normaliseName(elements.auditSearch.value);
    const severity = elements.auditSeverityFilter.value;
    const category = elements.auditCategoryFilter.value;
    state.filteredGroups = state.groups.filter(group => {
      if (severity !== "all" && group.severity !== severity) return false;
      if (category !== "all" && group.category !== category) return false;
      if (!query) return true;
      const haystack = normaliseName([
        group.code, group.title, group.explanation, group.recommendation,
        ...group.samples.flatMap(sample => [sample.playerName, sample.playerId, sample.season, sample.club, sample.detail])
      ].join(" "));
      return haystack.includes(query);
    });
    state.page = 1;
    renderIssueList();
  }

  function renderIssueList() {
    const total = state.filteredGroups.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = state.filteredGroups.slice(start, start + PAGE_SIZE);

    elements.auditListSummary.textContent = state.report
      ? `${total.toLocaleString()} of ${state.groups.length.toLocaleString()} issue types shown`
      : "Run the audit to see findings";
    elements.auditPageLabel.textContent = `Page ${state.page} of ${pages}`;
    elements.auditPreviousPageBtn.disabled = state.page <= 1;
    elements.auditNextPageBtn.disabled = state.page >= pages;

    if (!state.report) {
      elements.auditIssueList.innerHTML = `<div class="audit-empty-state">The database audit will appear here.</div>`;
      return;
    }
    if (!pageItems.length) {
      elements.auditIssueList.innerHTML = `<div class="audit-empty-state">No audit findings match those filters.</div>`;
      return;
    }

    elements.auditIssueList.innerHTML = pageItems.map(group => {
      const icon = group.severity === "critical" ? "!" : group.severity === "warning" ? "△" : "i";
      const samples = group.samples.map(sample => {
        const heading = [sample.playerName || sample.playerId, sample.season, sample.club].filter(Boolean).join(" · ") || "Database-wide finding";
        const values = [sample.field && `${sample.field}: ${sample.currentValue}`, sample.expected && `Expected: ${sample.expected}`].filter(Boolean).join(" · ");
        return `<li><strong>${escapeHtml(heading)}</strong>${values ? `<span>${escapeHtml(values)}</span>` : ""}<small>${escapeHtml(sample.detail || "")}</small></li>`;
      }).join("");
      return `<article class="audit-issue-card ${group.severity}">
        <div class="audit-issue-icon">${icon}</div>
        <div class="audit-issue-content">
          <div class="audit-issue-head"><div><span>${escapeHtml(capitalise(group.category))}</span><h3>${escapeHtml(group.title)}</h3></div><strong>${group.count.toLocaleString()}</strong></div>
          <p>${escapeHtml(group.explanation)}</p>
          <details><summary>Show examples</summary><ul>${samples}</ul></details>
          <div class="audit-recommendation"><strong>Recommended action</strong><span>${escapeHtml(group.recommendation)}</span></div>
        </div>
      </article>`;
    }).join("");
  }

  function changePage(delta) {
    const pages = Math.max(1, Math.ceil(state.filteredGroups.length / PAGE_SIZE));
    state.page = Math.max(1, Math.min(pages, state.page + delta));
    renderIssueList();
    elements.auditIssueList.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function downloadJsonReport() {
    if (!state.report) return;
    downloadText(`fpl-player-database-audit-${dateStamp()}.json`, JSON.stringify(state.report, null, 2), "application/json");
    elements.auditActionStatus.textContent = "JSON audit report downloaded.";
  }

  function downloadCsvReport() {
    if (!state.report) return;
    const columns = ["severity", "category", "code", "issue", "playerId", "playerName", "season", "club", "field", "currentValue", "expected", "detail"];
    const lines = [columns.join(","), ...state.rows.map(row => columns.map(column => csvCell(row[column])).join(","))];
    downloadText(`fpl-player-database-issues-${dateStamp()}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
    elements.auditActionStatus.textContent = "Detailed issues CSV downloaded.";
  }

  async function copySummary() {
    if (!state.report) return;
    const report = state.report;
    const top = state.groups.slice(0, 5).map(group => `- ${group.title}: ${group.count}`).join("\n");
    const text = `FPL Player Database Audit\n${report.generatedAt}\n\nPlayers: ${report.database.players}\nPlayer-seasons: ${report.database.playerSeasons}\nBlocking occurrences: ${report.summary.blockingOccurrences}\nWarnings: ${report.summary.warningOccurrences}\nMetadata gaps: ${report.summary.metadataOccurrences}\nName-rule ready: ${report.database.nameRuleReadyPercent}%\n\nHighest-priority findings:\n${top}`;
    try {
      await navigator.clipboard.writeText(text);
      elements.auditActionStatus.textContent = "Audit summary copied.";
    } catch {
      elements.auditActionStatus.textContent = "Clipboard access was unavailable. Download the JSON report instead.";
    }
  }

  function setTopStatus(text, mode) {
    elements.auditStatusTop.textContent = text;
    elements.auditReadyChip.textContent = text;
    elements.auditReadyChip.classList.remove("audit-ready", "audit-warning", "audit-blocked");
    if (mode === "ready") elements.auditReadyChip.classList.add("audit-ready");
    if (mode === "warning") elements.auditReadyChip.classList.add("audit-warning");
    if (mode === "blocked") elements.auditReadyChip.classList.add("audit-blocked");
  }

  function updateProgress(percent, text) {
    elements.auditProgressPercent.textContent = `${percent}%`;
    elements.auditProgressText.textContent = text;
    elements.auditProgressBar.style.width = `${percent}%`;
  }

  function countBySeverity(rows) {
    return rows.reduce((counts, row) => {
      counts[row.severity] = (counts[row.severity] || 0) + 1;
      return counts;
    }, { critical: 0, warning: 0, info: 0 });
  }

  function countByCategory(rows) {
    return rows.reduce((counts, row) => {
      counts[row.category] = (counts[row.category] || 0) + 1;
      return counts;
    }, {});
  }

  function compareGroups(a, b) {
    const weight = { critical: 0, warning: 1, info: 2 };
    return weight[a.severity] - weight[b.severity] || b.count - a.count || a.title.localeCompare(b.title);
  }

  function parseSeasonStartYear(value) {
    const match = String(value || "").match(/^(\d{4})\/\d{2}$/);
    return match ? Number(match[1]) : null;
  }

  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function ageOnDate(dob, date) {
    let age = date.getUTCFullYear() - dob.getUTCFullYear();
    const beforeBirthday = date.getUTCMonth() < dob.getUTCMonth() || (date.getUTCMonth() === dob.getUTCMonth() && date.getUTCDate() < dob.getUTCDate());
    if (beforeBirthday) age -= 1;
    return age;
  }

  function deriveNameParts(name) {
    const tokens = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return { ready: false, firstName: "", surname: "" };
    let surnameStart = Math.max(0, tokens.length - 1);
    while (surnameStart > 0 && SURNAME_PARTICLES.has(normaliseName(tokens[surnameStart - 1]))) surnameStart -= 1;
    return { ready: tokens.length > 1, firstName: tokens[0], surname: tokens.slice(surnameStart).join(" ") };
  }

  function normaliseName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function serialiseValue(value) {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "object") {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }

  function downloadText(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  function capitalise(value) {
    return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  const DEFINITIONS = {
    missingPlayerId: definition("missing-player-id", "critical", "identity", "Player record has no playerId", "A stable playerId is required for search, uniqueness and saved teams.", "Assign a unique, permanent slug before using this record."),
    duplicatePlayerId: definition("duplicate-player-id", "critical", "identity", "Duplicate playerId", "Two player records share the same identity key.", "Merge the records if they are the same footballer, otherwise give each footballer a unique ID."),
    missingPlayerName: definition("missing-player-name", "critical", "identity", "Player record has no name", "Search and name-based prompts cannot use a blank player name.", "Restore the player's display name from the source data."),
    emptySeasonList: definition("empty-season-list", "warning", "structure", "Player has no season records", "The player can never be selected in the game.", "Remove the empty record or attach the missing season data."),
    singleWordName: definition("single-word-name", "info", "names", "Single-word name needs special handling", "Surname prompts cannot reliably split a one-word display name.", "Keep the record, but review surname-based prompt behaviour for this footballer."),
    numericName: definition("numeric-player-name", "warning", "names", "Player name contains a number", "This is unusual and may indicate malformed source text.", "Check the original name and remove accidental numbers."),
    missingDob: definition("missing-date-of-birth", "info", "metadata", "Date of birth is missing", "Age-based checks cannot be independently verified for this player.", "Fill the date of birth when a reliable source becomes available."),
    invalidDob: definition("invalid-date-of-birth", "warning", "age", "Date of birth has an invalid format", "The auditor expects an ISO date so it can verify seasonal ages.", "Convert the value to YYYY-MM-DD or leave it blank until verified."),
    invalidSeasonLabel: definition("invalid-season-label", "critical", "structure", "Season label is malformed", "Season labels drive ordering, age checks and completed-season logic.", "Use the YYYY/YY format, for example 2024/25."),
    duplicatePlayerSeason: definition("duplicate-player-season", "critical", "identity", "Multiple records for the same player and season", "A player identity should have one consolidated record per season. Duplicate seasons often reveal different footballers merged by name.", "Split different footballers into separate player IDs or merge genuine transfer records carefully."),
    missingClub: definition("missing-club", "critical", "structure", "Season record has no club", "Many prompts require the club and league-position metadata.", "Restore the club name from the source season."),
    invalidPosition: definition("invalid-position", "critical", "structure", "Invalid player position", "The game supports only GK, DEF, MID and FWD.", "Remove non-player records or map a genuine footballer to the correct position."),
    missingManagers: definition("missing-managers", "warning", "metadata", "Manager metadata is missing", "Manager-based prompts cannot validate this player-season.", "Add the manager or managers responsible during that season."),
    managerStoredAsPlayer: definition("manager-stored-as-player", "critical", "identity", "Fantasy manager stored as a footballer", "A manager record can distort scores, searches and name-based prompts.", "Remove these manager entries from FPL_PLAYERS and keep manager names only in each season's managers array."),
    invalidPrice: definition("invalid-price", "critical", "statistics", "Price falls outside the footballer range", "Very low prices commonly identify non-player manager records or a bad unit conversion.", "Verify the source value and store prices in millions, such as 4.5."),
    pricePrecision: definition("price-precision", "warning", "statistics", "Price has unexpected precision", "FPL prices are normally stored to one decimal place.", "Round only after checking the source value."),
    zeroMinutesPerformance: definition("zero-minutes-performance", "warning", "statistics", "Performance statistics recorded with zero minutes", "Goals, assists, saves or goals conceded normally imply time on the pitch.", "Check whether minutes were lost during import or the performance fields belong to another record."),
    missingLeaguePosition: definition("missing-final-league-position", "warning", "league", "Completed season has no final league position", "League-position prompts cannot validate this season.", "Add the club's final Premier League position for the completed season."),
    invalidLeaguePosition: definition("invalid-league-position", "critical", "league", "League position is outside 1–20", "Premier League positions must be between 1 and 20.", "Correct the final position or leave the current unfinished season unset."),
    missingAge: definition("missing-season-age", "info", "metadata", "Age at season start is missing", "Age-based prompts cannot include this player-season.", "Calculate the age from a verified date of birth and the season start."),
    impossibleAge: definition("impossible-player-age", "critical", "age", "Impossible or non-player age", "A footballer age below 15 or above 45 strongly suggests a merged identity or manager record.", "Verify the identity and date of birth, then split or remove the incorrect season."),
    ageReview: definition("unusual-player-age", "warning", "age", "Unusually young or old player age", "The age may be valid, but it deserves a manual check before age prompts rely on it.", "Confirm the date of birth and season-start calculation."),
    ageDobMismatch: definition("age-dob-mismatch", "critical", "age", "Season age conflicts with date of birth", "The stored age differs by more than one year from the player's date of birth.", "Check for a merged same-name player, then recalculate the age after correcting identity."),
    splitIdentity: definition("split-player-identity", "critical", "identity", "Same footballer appears under multiple player IDs", "Accent or spelling changes have split one footballer into separate identities, allowing duplicate use in an XI.", "Merge the seasons under one canonical playerId and keep a stable display name."),
    invalidNumeric: field => definition(`invalid-number-${field}`, "critical", "statistics", `${field} is not numeric`, "Prompt tests and scoring require finite numeric values.", `Restore a finite numeric ${field} value from the source data.`),
    negativeNumeric: field => definition(`negative-number-${field}`, "critical", "statistics", `${field} is negative`, "This statistic cannot be negative. Total FPL points are excluded because negative season totals can be legitimate.", `Correct the ${field} value after checking the source record.`),
    flagMismatch: field => definition(`league-flag-mismatch-${field}`, "critical", "league", `${field} flag conflicts with league position`, "League flags must agree with the final table or prompts will accept incorrect answers.", `Recalculate ${field} from leaguePosition for completed seasons.`)
  };

  function definition(code, severity, category, title, explanation, recommendation) {
    return { code, severity, category, title, explanation, recommendation };
  }
})();
