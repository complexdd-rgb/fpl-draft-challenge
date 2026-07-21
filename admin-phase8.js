/* FPL Challenge Studio Phase 8 — reversible database repair workspace. */
(() => {
  "use strict";

  const originalPlayers = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const promptLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const PAGE_SIZE = 12;
  const VALID_POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  const NUMERIC_FIELDS = [
    "points", "minutes", "goals", "assists", "cleanSheets", "bonus", "saves",
    "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice"
  ];
  const FORBIDDEN_COST = 1_000_000;

  const state = {
    planning: false,
    applying: false,
    plan: [],
    filtered: [],
    page: 1,
    workspace: null,
    appliedItems: [],
    regression: null,
    auditReport: null,
    packMode: "none"
  };

  const elements = {};

  window.addEventListener("load", initialise, { once: true });

  function initialise() {
    [
      "repairStatusTop", "repairReadyChip", "repairSafeCount", "repairReviewCount", "repairSelectedCount",
      "repairBlockedCount", "repairPlayerCount", "repairSeasonCount", "buildRepairPlanBtn", "selectSafeRepairsBtn",
      "clearRepairSelectionsBtn", "applyRepairsBtn", "resetRepairWorkspaceBtn", "repairProgressWrap",
      "repairProgressText", "repairProgressPercent", "repairProgressBar", "repairActionStatus", "repairSearch",
      "repairConfidenceFilter", "repairCategoryFilter", "repairListSummary", "repairPreviousPageBtn",
      "repairNextPageBtn", "repairPageLabel", "repairItemList", "runRepairRegressionBtn",
      "repairRegressionList", "repairPackHeading", "repairPackCopy", "downloadRepairPackBtn",
      "repairDownloadStatus"
    ].forEach(id => elements[id] = document.getElementById(id));

    if (!elements.buildRepairPlanBtn) return;

    elements.buildRepairPlanBtn.addEventListener("click", buildRepairPlan);
    elements.selectSafeRepairsBtn.addEventListener("click", selectRecommended);
    elements.clearRepairSelectionsBtn.addEventListener("click", clearSelections);
    elements.applyRepairsBtn.addEventListener("click", applySelectedRepairs);
    elements.resetRepairWorkspaceBtn.addEventListener("click", resetWorkspace);
    elements.repairSearch.addEventListener("input", applyFilters);
    elements.repairConfidenceFilter.addEventListener("change", applyFilters);
    elements.repairCategoryFilter.addEventListener("change", applyFilters);
    elements.repairPreviousPageBtn.addEventListener("click", () => changePage(-1));
    elements.repairNextPageBtn.addEventListener("click", () => changePage(1));
    elements.runRepairRegressionBtn.addEventListener("click", runRegressionChecks);
    elements.downloadRepairPackBtn.addEventListener("click", downloadRepairPack);

    window.FPL_DATABASE_REPAIR = {
      buildPlan: buildRepairPlan,
      getPlan: () => state.plan.map(serialiseRepairItem),
      getWorkspace: () => state.workspace,
      getRegression: () => state.regression,
      select: predicate => {
        state.plan.forEach(item => { if (item.operation && predicate(item)) item.selected = true; });
        updateSummary();
        applyFilters(false);
      },
      apply: applySelectedRepairs,
      runChecks: runRegressionChecks
    };

    document.addEventListener("fplstudio:databaseauditcomplete", event => {
      state.auditReport = event.detail?.report || window.FPL_DATABASE_AUDIT_REPORT || null;
      setRepairStatus("Audit complete", "warning");
      elements.repairActionStatus.textContent = "The read-only audit is complete. Building the repair plan…";
      setTimeout(buildRepairPlan, 250);
    });

    const counts = databaseCounts(originalPlayers);
    elements.repairPlayerCount.textContent = counts.players.toLocaleString();
    elements.repairSeasonCount.textContent = counts.seasons.toLocaleString();

    if (!originalPlayers.length) {
      setRepairStatus("Database unavailable", "blocked");
      elements.repairActionStatus.textContent = "players.js did not load, so a repair workspace cannot be created.";
      elements.buildRepairPlanBtn.disabled = true;
      return;
    }

    state.auditReport = window.FPL_DATABASE_AUDIT_REPORT || null;
    if (state.auditReport) setTimeout(buildRepairPlan, 200);
    else setRepairStatus("Waiting for audit", "pending");
  }

  async function buildRepairPlan() {
    if (state.planning || !originalPlayers.length) return;
    state.planning = true;
    state.plan = [];
    state.filtered = [];
    state.page = 1;
    state.workspace = null;
    state.appliedItems = [];
    state.regression = null;
    state.packMode = "none";

    toggleProgress(true, 0, "Preparing a reversible repair plan…");
    setRepairStatus("Building plan…", "pending");
    elements.buildRepairPlanBtn.disabled = true;
    elements.buildRepairPlanBtn.textContent = "Building repair plan…";
    elements.downloadRepairPackBtn.disabled = true;
    elements.runRepairRegressionBtn.disabled = true;
    elements.repairRegressionList.innerHTML = `<div class="repair-empty-state">Apply selected repairs to run the safety checks.</div>`;
    elements.repairActionStatus.textContent = "Scanning safe fixes, manual-review fixes and problems that require source data…";

    const plan = [];
    const duplicateIdMap = new Map();
    const normalisedNameMap = new Map();
    const managerRemovalPlayers = new Set();

    const add = item => {
      item.id = item.id || `repair-${plan.length + 1}`;
      item.selected = item.confidence === "safe";
      plan.push(item);
    };

    for (let playerIndex = 0; playerIndex < originalPlayers.length; playerIndex += 1) {
      const player = originalPlayers[playerIndex] || {};
      const playerId = String(player.playerId || "");
      const playerName = String(player.name || "");
      const seasons = Array.isArray(player.seasons) ? player.seasons : [];
      const targetLabel = playerName || playerId || `Player record ${playerIndex + 1}`;

      if (playerId) {
        if (!duplicateIdMap.has(playerId)) duplicateIdMap.set(playerId, []);
        duplicateIdMap.get(playerId).push(playerIndex);
      } else {
        add(blocked("identity", "Missing playerId", `${targetLabel} has no permanent identity key.`, targetLabel, "blank", "A verified unique playerId is required."));
      }

      if (playerName) {
        const key = normaliseIdentity(playerName);
        if (key) {
          if (!normalisedNameMap.has(key)) normalisedNameMap.set(key, []);
          normalisedNameMap.get(key).push(playerIndex);
        }
      } else {
        add(blocked("identity", "Missing player name", "The game and name-based prompts cannot use an unnamed record.", targetLabel, "blank", "Restore the verified display name."));
      }

      const cleanedName = cleanWhitespace(playerName);
      if (playerName && cleanedName !== playerName) {
        add(repair("safe", "formatting", "Normalise player-name spacing", "Remove leading, trailing or repeated spaces without changing spelling.", targetLabel, playerName, cleanedName, {
          kind: "set-player-field", playerIndex, field: "name", value: cleanedName
        }));
      }

      const seenSeasons = new Map();
      let managerRecord = false;

      for (let seasonIndex = 0; seasonIndex < seasons.length; seasonIndex += 1) {
        const season = seasons[seasonIndex] || {};
        const seasonLabel = String(season.season || "");
        const club = String(season.club || "");
        const seasonTarget = [targetLabel, seasonLabel, club].filter(Boolean).join(" · ");
        const seasonKey = seasonLabel;

        if (seenSeasons.has(seasonKey)) {
          const previousIndex = seenSeasons.get(seasonKey);
          const previous = seasons[previousIndex] || {};
          if (stableStringify(previous) === stableStringify(season)) {
            add(repair("safe", "structure", "Remove exact duplicate player-season", "Both season records are identical, so the later duplicate can be removed safely.", seasonTarget, `Duplicate season at row ${seasonIndex + 1}`, "Keep one identical record", {
              kind: "remove-season", playerIndex, seasonIndex
            }));
          } else {
            add(blocked("identity", "Conflicting records for the same player-season", "The two season records are different. This can represent a merged same-name footballer or a transfer import that needs source-level review.", seasonTarget, summariseSeason(previous), summariseSeason(season)));
          }
        } else {
          seenSeasons.set(seasonKey, seasonIndex);
        }

        const stringChanges = {};
        for (const field of ["season", "club", "position"]) {
          const value = season[field];
          if (typeof value !== "string") continue;
          const cleaned = cleanWhitespace(value);
          if (cleaned !== value) stringChanges[field] = cleaned;
        }
        if (Array.isArray(season.managers)) {
          const cleanedManagers = [...new Set(season.managers.map(cleanWhitespace).filter(Boolean))];
          if (stableStringify(cleanedManagers) !== stableStringify(season.managers)) stringChanges.managers = cleanedManagers;
        }
        if (Object.keys(stringChanges).length) {
          add(repair("safe", "formatting", "Normalise season text formatting", "Trim repeated spaces, remove blank managers and deduplicate manager names.", seasonTarget, summariseFields(season, Object.keys(stringChanges)), summariseFields({ ...season, ...stringChanges }, Object.keys(stringChanges)), {
            kind: "set-season-fields", playerIndex, seasonIndex, values: stringChanges
          }));
        }

        const numericChanges = {};
        for (const field of NUMERIC_FIELDS) {
          const value = season[field];
          if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) numericChanges[field] = Number(value);
        }
        if (Object.keys(numericChanges).length) {
          add(repair("safe", "statistics", "Convert numeric text to numbers", "The values are valid numbers stored as text. Converting them prevents prompt and scoring errors.", seasonTarget, summariseFields(season, Object.keys(numericChanges)), summariseFields({ ...season, ...numericChanges }, Object.keys(numericChanges)), {
            kind: "set-season-fields", playerIndex, seasonIndex, values: numericChanges
          }));
        }

        for (const priceField of ["startingPrice", "finalPrice"]) {
          const price = Number(season[priceField]);
          if (Number.isFinite(price) && price >= 3.5 && price <= 15.5) {
            const rounded = Math.round(price * 10) / 10;
            if (Math.abs(price - rounded) > 1e-8) {
              add(repair("safe", "statistics", "Round FPL price to one decimal place", "FPL prices are stored in £m to one decimal place.", `${seasonTarget} · ${priceField}`, price, rounded, {
                kind: "set-season-field", playerIndex, seasonIndex, field: priceField, value: rounded
              }));
            }
          }
        }

        const leaguePosition = Number(season.leaguePosition);
        if (Number.isInteger(leaguePosition) && leaguePosition >= 1 && leaguePosition <= 20) {
          const expected = {
            champions: leaguePosition === 1,
            topFour: leaguePosition <= 4,
            bottomHalf: leaguePosition >= 11,
            relegated: leaguePosition >= 18
          };
          const changed = Object.fromEntries(Object.entries(expected).filter(([field, value]) => Boolean(season[field]) !== value));
          if (Object.keys(changed).length) {
            add(repair("safe", "league", "Recalculate league-position flags", "Champion, top-four, bottom-half and relegation flags can be derived directly from the final league position.", seasonTarget, summariseFields(season, Object.keys(changed)), summariseFields({ ...season, ...changed }, Object.keys(changed)), {
              kind: "set-season-fields", playerIndex, seasonIndex, values: changed
            }));
          }
        }

        const dob = parseDate(player.bio?.dateOfBirth);
        const startYear = parseSeasonStartYear(seasonLabel);
        if (dob && startYear) {
          const expectedAge = ageOnDate(dob, new Date(Date.UTC(startYear, 7, 1)));
          const currentAge = season.ageAtSeasonStart;
          if (!Number.isFinite(currentAge)) {
            add(repair("safe", "age", "Calculate missing season-start age", "A valid date of birth and season label are available, so the age can be calculated consistently.", seasonTarget, currentAge, expectedAge, {
              kind: "set-season-field", playerIndex, seasonIndex, field: "ageAtSeasonStart", value: expectedAge
            }));
          } else if (Math.abs(currentAge - expectedAge) > 1) {
            add(repair("review", "age", "Correct age that conflicts with date of birth", "The calculated age differs by more than one year. Approve only after confirming the player identity and birth date are correct.", seasonTarget, currentAge, expectedAge, {
              kind: "set-season-field", playerIndex, seasonIndex, field: "ageAtSeasonStart", value: expectedAge
            }));
          }
        }

        const managers = Array.isArray(season.managers) ? season.managers : [];
        const playerMatchesManager = managers.some(manager => normaliseIdentity(manager) === normaliseIdentity(playerName));
        const invalidPosition = !VALID_POSITIONS.has(season.position);
        const invalidLowPrice = Number.isFinite(Number(season.startingPrice)) && Number(season.startingPrice) < 3.5;
        if ((invalidPosition || invalidLowPrice) && playerMatchesManager) managerRecord = true;

        if (!season.club) add(blocked("structure", "Missing club", "Club-based and league-position prompts cannot validate this season without a club.", seasonTarget, "blank", "Restore from a reliable season source."));
        if (invalidPosition && !playerMatchesManager) add(blocked("structure", "Invalid player position", "Only GK, DEF, MID and FWD are supported.", seasonTarget, season.position, "Verify the footballer's position or remove a non-player record."));

        for (const field of NUMERIC_FIELDS) {
          const value = season[field];
          if (!Number.isFinite(value) && !(typeof value === "string" && Number.isFinite(Number(value)))) {
            add(blocked("statistics", `${field} is not numeric`, "Prompt tests and scoring require a finite numeric value.", `${seasonTarget} · ${field}`, value, "Restore from the source data."));
          } else if (field !== "points" && Number(value) < 0) {
            add(blocked("statistics", `${field} is negative`, "This statistic cannot be negative.", `${seasonTarget} · ${field}`, value, "Correct after checking the source record."));
          }
        }

        for (const priceField of ["startingPrice", "finalPrice"]) {
          const value = Number(season[priceField]);
          if (Number.isFinite(value) && (value < 3.5 || value > 15.5) && !playerMatchesManager) {
            add(blocked("statistics", "Price is outside the footballer range", "The price may use the wrong units or belong to a non-player record.", `${seasonTarget} · ${priceField}`, value, "Verify a value between £3.5m and £15.5m."));
          }
        }
      }

      if (managerRecord && !managerRemovalPlayers.has(playerIndex)) {
        managerRemovalPlayers.add(playerIndex);
        add(repair("review", "identity", "Remove fantasy manager stored as a player", "The record's name matches its manager list and it has a non-player position or price. Review the examples in the auditor before approving removal.", targetLabel, `${seasons.length} player-season record(s)`, "Remove the complete non-player record", {
          kind: "remove-player", playerIndex
        }));
      }

      if ((playerIndex + 1) % 120 === 0 || playerIndex === originalPlayers.length - 1) {
        const percent = Math.round(((playerIndex + 1) / originalPlayers.length) * 82);
        toggleProgress(true, percent, `Scanning player ${Math.min(playerIndex + 1, originalPlayers.length).toLocaleString()} of ${originalPlayers.length.toLocaleString()}…`);
        await nextFrame();
      }
    }

    toggleProgress(true, 86, "Checking duplicate player IDs…");
    for (const [playerId, indices] of duplicateIdMap.entries()) {
      if (indices.length < 2) continue;
      const group = indices.map(index => originalPlayers[index]);
      const sameName = new Set(group.map(player => normaliseIdentity(player.name))).size === 1;
      if (sameName && canMergePlayerGroup(indices)) {
        const targetIndex = chooseMergeTarget(indices);
        const sourceIndices = indices.filter(index => index !== targetIndex);
        add(repair("review", "identity", "Merge duplicate playerId records", "These records share a playerId and can be merged without conflicting season data. Approve only after confirming they represent the same footballer.", `${originalPlayers[targetIndex].name || playerId} · ${playerId}`, `${indices.length} separate player records`, "One player record with combined seasons", {
          kind: "merge-players", targetIndex, sourceIndices
        }));
      } else {
        add(blocked("identity", "Duplicate playerId requires manual identity work", "The records share an identity key but their names or season data conflict.", playerId, indices.map(index => originalPlayers[index].name || `row ${index + 1}`).join(" | "), "Split or merge using verified source data."));
      }
    }

    toggleProgress(true, 91, "Checking footballers split across multiple IDs…");
    const duplicateIdIndexSets = new Set([...duplicateIdMap.values()].filter(indices => indices.length > 1).flatMap(indices => indices.map(index => String(index))));
    for (const [normalisedName, indices] of normalisedNameMap.entries()) {
      if (indices.length < 2) continue;
      if (indices.every(index => duplicateIdIndexSets.has(String(index)))) continue;
      const ids = new Set(indices.map(index => originalPlayers[index].playerId));
      if (ids.size < 2) continue;
      if (canMergePlayerGroup(indices)) {
        const targetIndex = chooseMergeTarget(indices);
        const sourceIndices = indices.filter(index => index !== targetIndex);
        add(repair("review", "identity", "Merge a footballer split across player IDs", "The normalised names match and the seasons do not conflict. Approve only after confirming accents or spelling changes refer to the same footballer.", originalPlayers[targetIndex].name || normalisedName, indices.map(index => originalPlayers[index].playerId).join(" | "), `Keep ${originalPlayers[targetIndex].playerId} and combine seasons`, {
          kind: "merge-players", targetIndex, sourceIndices
        }));
      } else {
        add(blocked("identity", "Same-name identities conflict", "Multiple player IDs share the same normalised name, but overlapping seasons differ. They may be different footballers or a merged source error.", originalPlayers[indices[0]].name || normalisedName, indices.map(index => `${originalPlayers[index].playerId} (${(originalPlayers[index].seasons || []).map(season => season.season).join(", ")})`).join(" | "), "Verify identities manually before merging or keeping separate."));
      }
    }

    toggleProgress(true, 97, "Preparing repair workspace…");
    state.plan = deduplicatePlan(plan);
    state.workspace = cloneData(originalPlayers);
    updateSummary();
    applyFilters();
    elements.selectSafeRepairsBtn.disabled = false;
    elements.clearRepairSelectionsBtn.disabled = false;
    elements.applyRepairsBtn.disabled = !state.plan.some(item => item.selected && item.operation);
    elements.resetRepairWorkspaceBtn.disabled = false;
    elements.buildRepairPlanBtn.disabled = false;
    elements.buildRepairPlanBtn.textContent = "Rebuild repair plan";
    elements.repairActionStatus.textContent = `Repair plan ready: ${countConfidence("safe").toLocaleString()} recommended fixes, ${countConfidence("review").toLocaleString()} fixes needing approval and ${countConfidence("blocked").toLocaleString()} issues that need source data.`;
    setRepairStatus("Plan ready", countConfidence("blocked") ? "warning" : "ready");
    toggleProgress(true, 100, "Repair plan complete");
    state.planning = false;
    setTimeout(() => toggleProgress(false), 700);
  }

  function selectRecommended() {
    for (const item of state.plan) item.selected = item.confidence === "safe";
    invalidateWorkspace();
    updateSummary();
    applyFilters(false);
    elements.repairActionStatus.textContent = "All recommended safe fixes are selected. Manual-review fixes remain unselected.";
  }

  function clearSelections() {
    for (const item of state.plan) item.selected = false;
    invalidateWorkspace();
    updateSummary();
    applyFilters(false);
    elements.repairActionStatus.textContent = "All repair selections have been cleared.";
  }

  async function applySelectedRepairs() {
    if (state.applying || !state.plan.length) return;
    const selected = state.plan.filter(item => item.selected && item.operation);
    if (!selected.length) {
      elements.repairActionStatus.textContent = "Select at least one repair before applying the workspace.";
      return;
    }

    state.applying = true;
    setRepairStatus("Applying repairs…", "pending");
    elements.applyRepairsBtn.disabled = true;
    elements.buildRepairPlanBtn.disabled = true;
    toggleProgress(true, 5, "Cloning the original player database…");
    await nextFrame();

    const workspace = cloneData(originalPlayers);
    const removedPlayerIndices = new Set();
    const removeSeasonMap = new Map();
    const mergeOperations = [];
    const applied = [];

    const scalarItems = selected.filter(item => !["remove-season", "remove-player", "merge-players"].includes(item.operation.kind));
    for (let index = 0; index < scalarItems.length; index += 1) {
      const item = scalarItems[index];
      applyScalarOperation(workspace, item.operation);
      applied.push(item);
      if ((index + 1) % 100 === 0) {
        toggleProgress(true, 10 + Math.round(((index + 1) / Math.max(1, scalarItems.length)) * 35), `Applying field repair ${index + 1} of ${scalarItems.length}…`);
        await nextFrame();
      }
    }

    for (const item of selected) {
      const operation = item.operation;
      if (operation.kind === "remove-season") {
        if (!removeSeasonMap.has(operation.playerIndex)) removeSeasonMap.set(operation.playerIndex, []);
        removeSeasonMap.get(operation.playerIndex).push(operation.seasonIndex);
        applied.push(item);
      } else if (operation.kind === "remove-player") {
        removedPlayerIndices.add(operation.playerIndex);
        applied.push(item);
      } else if (operation.kind === "merge-players") {
        mergeOperations.push({ item, operation });
      }
    }

    toggleProgress(true, 52, "Merging approved duplicate identities…");
    for (const { item, operation } of mergeOperations) {
      const target = workspace[operation.targetIndex];
      if (!target || removedPlayerIndices.has(operation.targetIndex)) continue;
      for (const sourceIndex of operation.sourceIndices) {
        const source = workspace[sourceIndex];
        if (!source) continue;
        mergePlayerInto(target, source);
        removedPlayerIndices.add(sourceIndex);
      }
      applied.push(item);
    }
    await nextFrame();

    toggleProgress(true, 64, "Removing approved duplicate seasons…");
    for (const [playerIndex, seasonIndices] of removeSeasonMap.entries()) {
      if (removedPlayerIndices.has(playerIndex)) continue;
      const player = workspace[playerIndex];
      if (!player || !Array.isArray(player.seasons)) continue;
      for (const seasonIndex of [...new Set(seasonIndices)].sort((a, b) => b - a)) player.seasons.splice(seasonIndex, 1);
    }

    toggleProgress(true, 72, "Removing approved non-player records…");
    for (const playerIndex of [...removedPlayerIndices].sort((a, b) => b - a)) workspace.splice(playerIndex, 1);

    state.workspace = workspace;
    state.appliedItems = applied;
    state.regression = null;
    updateSummary();
    elements.runRepairRegressionBtn.disabled = false;
    elements.resetRepairWorkspaceBtn.disabled = false;
    elements.repairActionStatus.textContent = `${applied.length.toLocaleString()} approved repairs were applied to the browser workspace. Running regression checks…`;
    toggleProgress(true, 80, "Running regression checks…");
    await runRegressionChecks(true);
    state.applying = false;
    elements.applyRepairsBtn.disabled = false;
    elements.buildRepairPlanBtn.disabled = false;
    toggleProgress(true, 100, "Repair workspace complete");
    setTimeout(() => toggleProgress(false), 700);
  }

  function resetWorkspace() {
    state.workspace = cloneData(originalPlayers);
    state.appliedItems = [];
    state.regression = null;
    state.packMode = "none";
    for (const item of state.plan) item.selected = item.confidence === "safe";
    elements.runRepairRegressionBtn.disabled = true;
    elements.downloadRepairPackBtn.disabled = true;
    elements.repairRegressionList.innerHTML = `<div class="repair-empty-state">Apply selected repairs to run the safety checks.</div>`;
    elements.repairPackHeading.textContent = "Repair pack not ready";
    elements.repairPackCopy.innerHTML = "Build and apply a repair plan first. A deployable <code>UPLOAD/players.js</code> is included only when no blocking issues remain and every regression check passes.";
    elements.repairActionStatus.textContent = "The workspace has been reset to the original database. Recommended fixes remain selected.";
    setRepairStatus("Plan ready", countConfidence("blocked") ? "warning" : "ready");
    updateSummary();
    applyFilters(false);
  }

  async function runRegressionChecks(internalCall = false) {
    if (!state.workspace || !state.appliedItems.length) {
      if (!internalCall) elements.repairActionStatus.textContent = "Apply selected repairs before running regression checks.";
      return;
    }

    elements.runRepairRegressionBtn.disabled = true;
    elements.downloadRepairPackBtn.disabled = true;
    elements.repairRegressionList.innerHTML = `<div class="repair-empty-state">Running database, prompt-library and live-challenge checks…</div>`;
    setRepairStatus("Checking workspace…", "pending");
    toggleProgress(true, 82, "Checking repaired database structure…");
    await nextFrame();

    const results = [];
    const beforeCounts = databaseCounts(originalPlayers);
    const afterCounts = databaseCounts(state.workspace);
    const beforeCritical = criticalIssueSummary(originalPlayers);
    const afterCritical = criticalIssueSummary(state.workspace);

    addRegression(results, "pass", "Original database preserved", `All repairs were made against a cloned workspace; the loaded FPL_PLAYERS array still contains ${beforeCounts.players.toLocaleString()} players.`);

    const selectedRemovals = state.appliedItems.filter(item => ["remove-player", "merge-players"].includes(item.operation?.kind)).length;
    const playerDrop = beforeCounts.players - afterCounts.players;
    addRegression(results, playerDrop >= 0 && playerDrop <= Math.max(selectedRemovals * 8, selectedRemovals + 4) ? "pass" : "fail", "Player-count change is controlled", `${beforeCounts.players.toLocaleString()} → ${afterCounts.players.toLocaleString()} players (${signedNumber(-playerDrop)}).`);

    const seasonDrop = beforeCounts.seasons - afterCounts.seasons;
    addRegression(results, seasonDrop >= 0 ? "pass" : "fail", "Player-season count is controlled", `${beforeCounts.seasons.toLocaleString()} → ${afterCounts.seasons.toLocaleString()} seasons (${signedNumber(-seasonDrop)}).`);

    const criticalDelta = afterCritical.count - beforeCritical.count;
    addRegression(results, criticalDelta <= 0 ? "pass" : "fail", "No new blocking data errors", `${beforeCritical.count.toLocaleString()} → ${afterCritical.count.toLocaleString()} blocking occurrences (${signedNumber(criticalDelta)}).`);

    if (afterCritical.count === 0) addRegression(results, "pass", "No blocking database issues remain", "The repaired workspace passes all Phase 8 structural blocker checks.");
    else addRegression(results, "warn", "Some blocking issues still need manual source work", `${afterCritical.count.toLocaleString()} blocking occurrences remain. The download will be a REVIEW preview rather than an upload-ready players.js.`);

    toggleProgress(true, 87, "Testing every enabled prompt against the repaired database…");
    await nextFrame();
    const promptResult = testPromptLibrary(state.workspace);
    if (!promptLibrary.length) addRegression(results, "fail", "Prompt library unavailable", "prompt-library.js did not load, so compatibility cannot be verified.");
    else if (promptResult.errors.length) addRegression(results, "fail", "Prompt tests threw JavaScript errors", `${promptResult.errors.length} prompt(s) failed while being evaluated.`);
    else if (promptResult.zero.length) addRegression(results, "fail", "Some prompts have no valid answers", `${promptResult.zero.length} enabled prompt(s) became unusable after repair.`);
    else addRegression(results, "pass", "All enabled prompts still work", `${promptResult.checked.toLocaleString()} prompts were evaluated against ${afterCounts.seasons.toLocaleString()} player-seasons.`);
    if (promptResult.low.length) addRegression(results, "warn", "Some prompts now have fewer than six valid players", `${promptResult.low.length} prompt(s) need a difficulty review, although they still have valid answers.`);

    toggleProgress(true, 92, "Checking the live daily challenge…");
    await nextFrame();
    const liveResult = await testLiveChallenge(state.workspace);
    if (!liveResult.challenge) addRegression(results, "fail", "Live challenge could not be loaded", liveResult.error || "todays-challenge.js could not be parsed.");
    else if (!liveResult.possible) addRegression(results, "fail", "The live challenge no longer has a unique XI", liveResult.reason || "No eleven-player assignment exists.");
    else {
      addRegression(results, "pass", "The live challenge still has eleven unique valid footballers", `${liveResult.challenge.prompts.length} prompts can still be completed without reusing a player.`);
      const expectedScore = Number(liveResult.challenge.perfectScore) || 0;
      const status = liveResult.score === expectedScore ? "pass" : "fail";
      addRegression(results, status, "Live perfect score remains correct", status === "pass" ? `${liveResult.score.toLocaleString()} points matches todays-challenge.js.` : `Repaired database calculates ${liveResult.score.toLocaleString()} points, but todays-challenge.js stores ${expectedScore.toLocaleString()}.`);
    }

    const failures = results.filter(result => result.status === "fail").length;
    const warnings = results.filter(result => result.status === "warn").length;
    const uploadReady = failures === 0 && afterCritical.count === 0;
    const previewReady = failures === 0 && !uploadReady;

    state.regression = {
      generatedAt: new Date().toISOString(),
      beforeCounts,
      afterCounts,
      beforeCritical,
      afterCritical,
      promptResult,
      liveResult: serialisableLiveResult(liveResult),
      results,
      failures,
      warnings,
      uploadReady,
      previewReady
    };
    state.packMode = uploadReady ? "upload" : "review";

    renderRegression(results);
    elements.downloadRepairPackBtn.disabled = false;
    elements.runRepairRegressionBtn.disabled = false;
    updatePackStatus();
    updateSummary();
    toggleProgress(true, 98, "Regression checks complete");

    if (uploadReady) {
      setRepairStatus("Upload-ready repair", "ready");
      elements.repairActionStatus.textContent = `All regression checks passed. The repair pack will contain UPLOAD/players.js and complete backups.`;
    } else if (previewReady) {
      setRepairStatus("Review pack ready", "warning");
      elements.repairActionStatus.textContent = `Regression checks passed, but ${afterCritical.count.toLocaleString()} blockers remain. The pack will contain a REVIEW preview, not an upload file.`;
    } else {
      setRepairStatus(`${failures} regression failure${failures === 1 ? "" : "s"}`, "blocked");
      elements.repairActionStatus.textContent = `Do not upload the repaired database. Review the failed checks and adjust your selected repairs.`;
    }
  }

  function renderRegression(results) {
    elements.repairRegressionList.innerHTML = results.map(result => {
      const icon = result.status === "pass" ? "✓" : result.status === "warn" ? "△" : "!";
      return `<div class="repair-regression-row ${result.status}"><div class="regression-icon">${icon}</div><div><strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.detail)}</span></div></div>`;
    }).join("");
  }

  function updatePackStatus() {
    if (!state.regression) {
      elements.repairPackHeading.textContent = "Repair pack not ready";
      elements.repairPackCopy.innerHTML = "Apply selected repairs and run the regression checks first.";
      return;
    }
    if (state.regression.uploadReady) {
      elements.repairPackHeading.textContent = "Upload-ready repair pack";
      elements.repairPackCopy.innerHTML = "Every blocking check passed. The ZIP will include <code>UPLOAD/players.js</code>, the original database backup, audit and repair reports, regression results and instructions.";
    } else if (state.regression.previewReady) {
      elements.repairPackHeading.textContent = "Review-only repair pack";
      elements.repairPackCopy.innerHTML = "The workspace did not introduce regressions, but blockers remain. The ZIP will include <code>REVIEW/players-repaired-preview.js</code> and all reports. Do not replace the live database yet.";
    } else {
      elements.repairPackHeading.textContent = "Repair pack contains failed checks";
      elements.repairPackCopy.innerHTML = "The ZIP can be downloaded for diagnosis, but its repaired database is placed in <code>REVIEW/</code> and must not be uploaded.";
    }
  }

  async function downloadRepairPack() {
    if (!state.workspace || !state.regression) return;
    elements.downloadRepairPackBtn.disabled = true;
    elements.repairDownloadStatus.textContent = "Building the repair ZIP and backups…";
    await nextFrame();

    const repairPlan = state.plan.map(serialiseRepairItem);
    const applied = state.appliedItems.map(serialiseRepairItem);
    const unresolved = state.plan.filter(item => item.confidence === "blocked" || (item.confidence === "review" && !item.selected)).map(serialiseRepairItem);
    const originalSource = buildPlayersSource(originalPlayers, "Backup created before Phase 8 repairs");
    const repairedSource = buildPlayersSource(state.workspace, "Generated by Challenge Studio Phase 8 repair workspace");
    const uploadReady = state.regression.uploadReady;

    const files = [
      { name: "BACKUPS/players-before-repair.js", content: originalSource },
      { name: "REPORTS/database-audit.json", content: JSON.stringify(state.auditReport || window.FPL_DATABASE_AUDIT_REPORT || { note: "Phase 7 audit report was unavailable." }, null, 2) + "\n" },
      { name: "REPORTS/repair-plan.json", content: JSON.stringify(repairPlan, null, 2) + "\n" },
      { name: "REPORTS/applied-fixes.json", content: JSON.stringify(applied, null, 2) + "\n" },
      { name: "REPORTS/unresolved-fixes.json", content: JSON.stringify(unresolved, null, 2) + "\n" },
      { name: "REPORTS/regression-results.json", content: JSON.stringify(state.regression, null, 2) + "\n" },
      { name: "repair-manifest.json", content: JSON.stringify(buildManifest(), null, 2) + "\n" },
      { name: "README-UPLOAD.txt", content: buildReadme(uploadReady) }
    ];
    files.push(uploadReady
      ? { name: "UPLOAD/players.js", content: repairedSource }
      : { name: "REVIEW/players-repaired-preview.js", content: repairedSource });

    const blob = buildZipBlob(files);
    downloadBlob(`fpl-database-repair-${dateStamp()}.zip`, blob);
    elements.repairDownloadStatus.textContent = uploadReady
      ? "Upload-ready repair pack downloaded. Extract it and upload only UPLOAD/players.js after keeping the backup."
      : "Review-only repair pack downloaded. Do not upload the preview players.js while blockers or failed checks remain.";
    elements.downloadRepairPackBtn.disabled = false;
  }

  function buildManifest() {
    return {
      phase: 8,
      generatedAt: new Date().toISOString(),
      mode: state.regression?.uploadReady ? "upload-ready" : "review-only",
      original: databaseCounts(originalPlayers),
      repaired: databaseCounts(state.workspace || []),
      selectedRepairs: state.plan.filter(item => item.selected && item.operation).length,
      appliedRepairs: state.appliedItems.length,
      unresolvedItems: state.plan.filter(item => item.confidence === "blocked" || (item.confidence === "review" && !item.selected)).length,
      regressionFailures: state.regression?.failures ?? null,
      regressionWarnings: state.regression?.warnings ?? null,
      instructions: state.regression?.uploadReady
        ? "Upload only UPLOAD/players.js to the repository root after saving BACKUPS/players-before-repair.js."
        : "Do not upload the REVIEW preview. Resolve remaining blockers or failed regression checks first."
    };
  }

  function buildReadme(uploadReady) {
    const counts = databaseCounts(state.workspace || []);
    const lines = [
      "FPL CHALLENGE STUDIO — PHASE 8 DATABASE REPAIR PACK",
      "=====================================================",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Mode: ${uploadReady ? "UPLOAD READY" : "REVIEW ONLY"}`,
      `Repaired players: ${counts.players}`,
      `Repaired player-seasons: ${counts.seasons}`,
      `Applied repairs: ${state.appliedItems.length}`,
      ""
    ];
    if (uploadReady) {
      lines.push(
        "UPLOAD INSTRUCTIONS",
        "-------------------",
        "1. Keep BACKUPS/players-before-repair.js somewhere safe.",
        "2. Open the UPLOAD folder.",
        "3. Upload players.js to the main/root of the GitHub repository.",
        "4. Replace the existing players.js and commit the change.",
        "5. Wait for GitHub Pages to deploy, then test the live game and admin page.",
        "6. Keep every REPORTS file so the repairs can be traced.",
        "",
        "Do not upload the ZIP itself. GitHub does not unpack ZIP files automatically."
      );
    } else {
      lines.push(
        "DO NOT UPLOAD THE PREVIEW DATABASE",
        "----------------------------------",
        "This pack contains REVIEW/players-repaired-preview.js because blockers or regression failures remain.",
        "Use the reports to decide which manual-review fixes are trustworthy, rebuild the workspace, and rerun every check.",
        "Only a future pack containing UPLOAD/players.js should replace the live database."
      );
    }
    return lines.join("\n") + "\n";
  }

  function applyFilters(resetPage = true) {
    const query = normaliseIdentity(elements.repairSearch.value);
    const confidence = elements.repairConfidenceFilter.value;
    const category = elements.repairCategoryFilter.value;
    state.filtered = state.plan.filter(item => {
      if (confidence === "selected" && !item.selected) return false;
      if (!["all", "selected"].includes(confidence) && item.confidence !== confidence) return false;
      if (category !== "all" && item.category !== category) return false;
      if (!query) return true;
      return normaliseIdentity([item.title, item.detail, item.target, item.before, item.after, item.category, item.confidence].join(" ")).includes(query);
    });
    if (resetPage) state.page = 1;
    renderRepairList();
  }

  function renderRepairList() {
    const total = state.filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const items = state.filtered.slice(start, start + PAGE_SIZE);

    elements.repairListSummary.textContent = state.plan.length
      ? `${total.toLocaleString()} of ${state.plan.length.toLocaleString()} repair items shown`
      : "Build the repair plan to see proposed changes";
    elements.repairPageLabel.textContent = `Page ${state.page} of ${pages}`;
    elements.repairPreviousPageBtn.disabled = state.page <= 1;
    elements.repairNextPageBtn.disabled = state.page >= pages;

    if (!state.plan.length) {
      elements.repairItemList.innerHTML = `<div class="repair-empty-state">The repair plan will appear here after the audit.</div>`;
      return;
    }
    if (!items.length) {
      elements.repairItemList.innerHTML = `<div class="repair-empty-state">No repair items match those filters.</div>`;
      return;
    }

    elements.repairItemList.innerHTML = items.map(item => {
      const selectable = item.confidence !== "blocked" && item.operation;
      const control = selectable
        ? `<input type="checkbox" data-repair-select="${escapeHtml(item.id)}" ${item.selected ? "checked" : ""} aria-label="Select ${escapeHtml(item.title)}">`
        : "!";
      const label = item.confidence === "safe" ? "Recommended" : item.confidence === "review" ? "Your approval" : "Source data needed";
      return `<article class="repair-item-card ${item.confidence}">
        <div class="repair-item-check">${control}</div>
        <div>
          <div class="repair-item-head">
            <div><div class="repair-item-kicker"><span class="repair-confidence ${item.confidence}">${label}</span><span>${escapeHtml(item.category)}</span></div><h3>${escapeHtml(item.title)}</h3></div>
            <div class="repair-item-target">${escapeHtml(item.target)}</div>
          </div>
          <p class="repair-item-copy">${escapeHtml(item.detail)}</p>
          <div class="repair-change-grid"><div><span>Current</span><strong>${escapeHtml(formatValue(item.before))}</strong></div><div class="repair-change-arrow">→</div><div><span>Proposed</span><strong>${escapeHtml(formatValue(item.after))}</strong></div></div>
        </div>
      </article>`;
    }).join("");

    elements.repairItemList.querySelectorAll("[data-repair-select]").forEach(input => {
      input.addEventListener("change", () => {
        const item = state.plan.find(entry => entry.id === input.dataset.repairSelect);
        if (!item) return;
        item.selected = input.checked;
        invalidateWorkspace();
        updateSummary();
        elements.applyRepairsBtn.disabled = !state.plan.some(entry => entry.selected && entry.operation);
      });
    });
  }

  function changePage(delta) {
    const pages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    state.page = Math.max(1, Math.min(pages, state.page + delta));
    renderRepairList();
    elements.repairItemList.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateSummary() {
    const selected = state.plan.filter(item => item.selected && item.operation).length;
    const blocked = state.regression?.afterCritical?.count ?? countConfidence("blocked");
    const counts = databaseCounts(state.workspace || originalPlayers);
    elements.repairSafeCount.textContent = countConfidence("safe").toLocaleString();
    elements.repairReviewCount.textContent = countConfidence("review").toLocaleString();
    elements.repairSelectedCount.textContent = selected.toLocaleString();
    elements.repairBlockedCount.textContent = blocked.toLocaleString();
    elements.repairPlayerCount.textContent = counts.players.toLocaleString();
    elements.repairSeasonCount.textContent = counts.seasons.toLocaleString();
    elements.applyRepairsBtn.disabled = !selected || state.planning || state.applying;
  }

  function invalidateWorkspace() {
    if (!state.appliedItems.length && !state.regression) return;
    state.workspace = cloneData(originalPlayers);
    state.appliedItems = [];
    state.regression = null;
    state.packMode = "none";
    elements.runRepairRegressionBtn.disabled = true;
    elements.downloadRepairPackBtn.disabled = true;
    elements.repairRegressionList.innerHTML = `<div class="repair-empty-state">Selections changed. Apply the repair plan again to run the safety checks.</div>`;
    updatePackStatus();
    setRepairStatus("Selections changed", "warning");
  }

  function setRepairStatus(text, stateName) {
    elements.repairStatusTop.textContent = text;
    elements.repairReadyChip.textContent = text;
    elements.repairReadyChip.classList.remove("repair-ready", "repair-warning", "repair-blocked");
    if (stateName === "ready") elements.repairReadyChip.classList.add("repair-ready");
    else if (stateName === "warning" || stateName === "pending") elements.repairReadyChip.classList.add("repair-warning");
    else if (stateName === "blocked") elements.repairReadyChip.classList.add("repair-blocked");
  }

  function toggleProgress(show, percent = 0, text = "") {
    elements.repairProgressWrap.classList.toggle("hidden", !show);
    if (show) {
      elements.repairProgressPercent.textContent = `${Math.max(0, Math.min(100, percent))}%`;
      elements.repairProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      if (text) elements.repairProgressText.textContent = text;
    }
  }

  function applyScalarOperation(workspace, operation) {
    const player = workspace[operation.playerIndex];
    if (!player) return;
    if (operation.kind === "set-player-field") player[operation.field] = cloneData(operation.value);
    else if (operation.kind === "set-season-field") {
      const season = player.seasons?.[operation.seasonIndex];
      if (season) season[operation.field] = cloneData(operation.value);
    } else if (operation.kind === "set-season-fields") {
      const season = player.seasons?.[operation.seasonIndex];
      if (season) Object.assign(season, cloneData(operation.values));
    }
  }

  function mergePlayerInto(target, source) {
    target.seasons = Array.isArray(target.seasons) ? target.seasons : [];
    const seasonMap = new Map(target.seasons.map(season => [String(season.season || ""), season]));
    for (const season of Array.isArray(source.seasons) ? source.seasons : []) {
      const key = String(season.season || "");
      if (!seasonMap.has(key)) {
        const copied = cloneData(season);
        target.seasons.push(copied);
        seasonMap.set(key, copied);
      }
    }
    target.bio = { ...(source.bio || {}), ...(target.bio || {}) };
    if (!target.name && source.name) target.name = source.name;
  }

  function canMergePlayerGroup(indices) {
    const seasonMap = new Map();
    for (const index of indices) {
      for (const season of Array.isArray(originalPlayers[index]?.seasons) ? originalPlayers[index].seasons : []) {
        const key = String(season.season || "");
        if (seasonMap.has(key) && stableStringify(seasonMap.get(key)) !== stableStringify(season)) return false;
        if (!seasonMap.has(key)) seasonMap.set(key, season);
      }
    }
    return true;
  }

  function chooseMergeTarget(indices) {
    return [...indices].sort((left, right) => {
      const leftSeasons = originalPlayers[left]?.seasons?.length || 0;
      const rightSeasons = originalPlayers[right]?.seasons?.length || 0;
      return rightSeasons - leftSeasons || left - right;
    })[0];
  }

  function testPromptLibrary(database) {
    const records = flattenDatabase(database);
    const errors = [];
    const zero = [];
    const low = [];
    let checked = 0;
    for (const prompt of promptLibrary.filter(prompt => prompt?.enabled !== false)) {
      checked += 1;
      const players = new Set();
      try {
        for (const record of records) {
          if (record.position !== prompt.position) continue;
          if (prompt.test(record)) players.add(record.playerId);
        }
      } catch (error) {
        errors.push({ id: prompt.id, message: error.message });
        continue;
      }
      if (players.size === 0) zero.push(prompt.id);
      else if (players.size < 6) low.push({ id: prompt.id, players: players.size });
    }
    return { checked, errors, zero, low };
  }

  async function testLiveChallenge(database) {
    let challenge = null;
    try {
      const response = await fetch(`todays-challenge.js?phase8=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const source = await response.text();
      challenge = parseChallengeSource(source);
    } catch (error) {
      if (window.FPL_DAILY_CHALLENGE) challenge = window.FPL_DAILY_CHALLENGE;
      else return { challenge: null, error: `Could not load todays-challenge.js: ${error.message}` };
    }
    if (!challenge || !Array.isArray(challenge.prompts) || challenge.prompts.length !== 11) return { challenge, possible: false, reason: "The live challenge is missing or does not contain eleven prompts." };
    const result = calculatePerfectXI(challenge.prompts, database);
    return { challenge, ...result };
  }

  function calculatePerfectXI(prompts, database) {
    const records = flattenDatabase(database);
    const bestByPrompt = prompts.map(prompt => {
      const map = new Map();
      for (const record of records) {
        if (record.position !== prompt.position) continue;
        let valid = false;
        try { valid = Boolean(prompt.test(record)); } catch { return null; }
        if (!valid) continue;
        const existing = map.get(record.playerId);
        if (!existing || record.points > existing.points) map.set(record.playerId, record);
      }
      return map;
    });
    if (bestByPrompt.some(map => !map || !map.size)) return { possible: false, reason: "At least one live prompt has no valid player-season." };

    const ids = [...new Set(bestByPrompt.flatMap(map => [...map.keys()]))];
    if (ids.length < prompts.length) return { possible: false, reason: "Fewer than eleven distinct footballers match the live prompts." };
    let maximumPoints = 0;
    for (const map of bestByPrompt) for (const record of map.values()) maximumPoints = Math.max(maximumPoints, Number(record.points) || 0);
    const recordRows = bestByPrompt.map(map => ids.map(id => map.get(id) || null));
    const costs = recordRows.map(row => {
      const values = new Float64Array(ids.length);
      row.forEach((record, index) => values[index] = record ? maximumPoints - (Number(record.points) || 0) : FORBIDDEN_COST);
      return values;
    });
    const assignment = hungarianMinimumAssignment(costs);
    if (!assignment) return { possible: false, reason: "The unique-player optimiser could not complete the matching." };
    const picks = assignment.map((column, row) => recordRows[row][column]);
    if (picks.some(record => !record)) return { possible: false, reason: "No eleven-player assignment exists." };
    return { possible: true, score: picks.reduce((sum, record) => sum + (Number(record.points) || 0), 0), picks };
  }

  function hungarianMinimumAssignment(costs) {
    const rowCount = costs.length;
    const columnCount = costs[0]?.length || 0;
    if (!rowCount || columnCount < rowCount) return null;
    const u = new Float64Array(rowCount + 1);
    const v = new Float64Array(columnCount + 1);
    const p = new Int32Array(columnCount + 1);
    const way = new Int32Array(columnCount + 1);
    for (let row = 1; row <= rowCount; row += 1) {
      p[0] = row;
      let column0 = 0;
      const minimum = new Float64Array(columnCount + 1);
      minimum.fill(Infinity);
      const used = new Uint8Array(columnCount + 1);
      do {
        used[column0] = 1;
        const row0 = p[column0];
        let delta = Infinity;
        let column1 = 0;
        for (let column = 1; column <= columnCount; column += 1) {
          if (used[column]) continue;
          const current = costs[row0 - 1][column - 1] - u[row0] - v[column];
          if (current < minimum[column]) { minimum[column] = current; way[column] = column0; }
          if (minimum[column] < delta) { delta = minimum[column]; column1 = column; }
        }
        if (!Number.isFinite(delta)) return null;
        for (let column = 0; column <= columnCount; column += 1) {
          if (used[column]) { u[p[column]] += delta; v[column] -= delta; }
          else minimum[column] -= delta;
        }
        column0 = column1;
      } while (p[column0] !== 0);
      do {
        const column1 = way[column0];
        p[column0] = p[column1];
        column0 = column1;
      } while (column0 !== 0);
    }
    const assignment = new Int32Array(rowCount);
    assignment.fill(-1);
    for (let column = 1; column <= columnCount; column += 1) if (p[column] > 0 && p[column] <= rowCount) assignment[p[column] - 1] = column - 1;
    return [...assignment].every(column => column >= 0) ? [...assignment] : null;
  }

  function criticalIssueSummary(database) {
    let count = 0;
    const codes = {};
    const add = code => { count += 1; codes[code] = (codes[code] || 0) + 1; };
    const ids = new Set();
    const names = new Map();
    for (const player of database) {
      const id = String(player?.playerId || "").trim();
      const name = String(player?.name || "").trim();
      if (!id) add("missing-player-id");
      else if (ids.has(id)) add("duplicate-player-id");
      else ids.add(id);
      if (!name) add("missing-player-name");
      const nameKey = normaliseIdentity(name);
      if (nameKey) {
        if (!names.has(nameKey)) names.set(nameKey, new Set());
        names.get(nameKey).add(id);
      }
      const seenSeasons = new Set();
      const dob = parseDate(player?.bio?.dateOfBirth);
      for (const season of Array.isArray(player?.seasons) ? player.seasons : []) {
        const label = String(season?.season || "");
        if (seenSeasons.has(label)) add("duplicate-player-season");
        seenSeasons.add(label);
        if (!season?.club) add("missing-club");
        if (!VALID_POSITIONS.has(season?.position)) add("invalid-position");
        for (const field of NUMERIC_FIELDS) {
          if (!Number.isFinite(season?.[field])) add(`invalid-${field}`);
          else if (field !== "points" && season[field] < 0) add(`negative-${field}`);
        }
        for (const field of ["startingPrice", "finalPrice"]) {
          const value = season?.[field];
          if (Number.isFinite(value) && (value < 3.5 || value > 15.5)) add("invalid-price");
        }
        const position = season?.leaguePosition;
        if (Number.isFinite(position)) {
          if (position < 1 || position > 20) add("invalid-league-position");
          else {
            const flags = { champions: position === 1, topFour: position <= 4, bottomHalf: position >= 11, relegated: position >= 18 };
            for (const [field, expected] of Object.entries(flags)) if (Boolean(season[field]) !== expected) add(`flag-${field}`);
          }
        }
        const age = season?.ageAtSeasonStart;
        if (Number.isFinite(age) && (age < 15 || age > 45)) add("impossible-age");
        const year = parseSeasonStartYear(label);
        if (dob && year && Number.isFinite(age)) {
          const expected = ageOnDate(dob, new Date(Date.UTC(year, 7, 1)));
          if (Math.abs(age - expected) > 1) add("age-dob-mismatch");
        }
        const managers = Array.isArray(season?.managers) ? season.managers : [];
        const managerMatch = managers.some(manager => normaliseIdentity(manager) === nameKey);
        if ((!VALID_POSITIONS.has(season?.position) || Number(season?.startingPrice) < 3.5) && managerMatch) add("manager-stored-as-player");
      }
    }
    for (const idSet of names.values()) if (idSet.size > 1) add("split-player-identity");
    return { count, codes };
  }

  function deduplicatePlan(plan) {
    const output = [];
    const seen = new Set();
    for (const item of plan) {
      const operationKey = item.operation ? stableStringify(item.operation) : "none";
      const key = `${item.confidence}|${item.category}|${item.title}|${item.target}|${operationKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      item.id = `repair-${output.length + 1}`;
      output.push(item);
    }
    return output;
  }

  function repair(confidence, category, title, detail, target, before, after, operation) {
    return { confidence, category, title, detail, target, before, after, operation };
  }

  function blocked(category, title, detail, target, before, after) {
    return { confidence: "blocked", category, title, detail, target, before, after, operation: null, selected: false };
  }

  function countConfidence(confidence) {
    return state.plan.filter(item => item.confidence === confidence).length;
  }

  function databaseCounts(database) {
    return { players: database.length, seasons: database.reduce((sum, player) => sum + (Array.isArray(player?.seasons) ? player.seasons.length : 0), 0) };
  }

  function flattenDatabase(database) {
    return database.flatMap(player => (Array.isArray(player?.seasons) ? player.seasons : []).map(season => ({
      ...season,
      playerId: player.playerId,
      name: player.name,
      playerName: player.name
    })));
  }

  function parseChallengeSource(source) {
    const sandbox = Object.create(null);
    const evaluate = new Function("window", `\"use strict\";\n${source}\nreturn window.FPL_DAILY_CHALLENGE || null;`);
    return evaluate(sandbox);
  }

  function serialisableLiveResult(result) {
    if (!result) return null;
    return {
      challenge: result.challenge ? {
        id: result.challenge.id || "",
        number: Number(result.challenge.number) || 0,
        title: result.challenge.title || "",
        releaseDate: result.challenge.releaseDate || "",
        perfectScore: Number(result.challenge.perfectScore) || 0,
        promptIds: Array.isArray(result.challenge.prompts) ? result.challenge.prompts.map(prompt => prompt.id) : []
      } : null,
      possible: Boolean(result.possible),
      score: Number(result.score) || 0,
      reason: result.reason || "",
      error: result.error || ""
    };
  }

  function addRegression(results, status, title, detail) {
    results.push({ status, title, detail });
  }

  function serialiseRepairItem(item) {
    return {
      id: item.id,
      confidence: item.confidence,
      category: item.category,
      title: item.title,
      detail: item.detail,
      target: item.target,
      before: formatValue(item.before),
      after: formatValue(item.after),
      selected: Boolean(item.selected),
      operation: item.operation ? cloneData(item.operation) : null
    };
  }

  function buildPlayersSource(database, note) {
    return `/* ${note}. */\nwindow.FPL_PLAYERS = ${JSON.stringify(database)};\n`;
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  function cloneData(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function cleanWhitespace(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function normaliseIdentity(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
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
    if (date.getUTCMonth() < dob.getUTCMonth() || (date.getUTCMonth() === dob.getUTCMonth() && date.getUTCDate() < dob.getUTCDate())) age -= 1;
    return age;
  }

  function summariseSeason(season) {
    return `${season.club || "Unknown club"} · ${season.position || "?"} · ${season.points ?? "?"} pts`;
  }

  function summariseFields(source, fields) {
    return fields.map(field => `${field}=${formatValue(source[field])}`).join(" · ");
  }

  function formatValue(value) {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "object") {
      try { return JSON.stringify(value); } catch { return String(value); }
    }
    return String(value);
  }

  function signedNumber(value) {
    return `${value > 0 ? "+" : ""}${value.toLocaleString()}`;
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  /* Minimal standards-compliant ZIP writer using stored entries. */
  function buildZipBlob(files) {
    const encoder = new TextEncoder();
    const now = new Date();
    const dos = toDosDateTime(now);
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const file of files) {
      const nameBytes = encoder.encode(file.name.replaceAll("\\", "/"));
      const dataBytes = typeof file.content === "string" ? encoder.encode(file.content) : new Uint8Array(file.content);
      const crc = crc32(dataBytes);
      const localHeader = concatBytes(
        uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0),
        uint16(dos.time), uint16(dos.date), uint32(crc), uint32(dataBytes.length), uint32(dataBytes.length),
        uint16(nameBytes.length), uint16(0), nameBytes, dataBytes
      );
      localParts.push(localHeader);
      const centralHeader = concatBytes(
        uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0),
        uint16(dos.time), uint16(dos.date), uint32(crc), uint32(dataBytes.length), uint32(dataBytes.length),
        uint16(nameBytes.length), uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes
      );
      centralParts.push(centralHeader);
      offset += localHeader.length;
    }
    const centralDirectory = concatBytes(...centralParts);
    const endRecord = concatBytes(
      uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length),
      uint32(centralDirectory.length), uint32(offset), uint16(0)
    );
    return new Blob([...localParts, centralDirectory, endRecord], { type: "application/zip" });
  }

  function toDosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() };
  }

  function uint16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value & 0xffff, true);
    return bytes;
  }

  function uint32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
  }

  function concatBytes(...parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      table[index] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 750);
  }
})();
