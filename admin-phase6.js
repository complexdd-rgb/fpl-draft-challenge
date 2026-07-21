(() => {
  "use strict";

  const HISTORY_KEY = "fplChallengeStudioHistoryV1";
  const INVALID_PENALTY = 10;
  const BASELINE_CHALLENGE = {
    version: 1,
    id: "daily-006-underdog-xi",
    number: 6,
    name: "The Underdog XI",
    title: "Challenge #6 · The Underdog XI",
    releaseDate: "2026-07-20",
    difficulty: "Medium / Hard",
    perfectScore: 1885,
    status: "published",
    locked: true,
    recordedAt: "2026-07-20T00:00:00.000Z",
    promptIds: [
      "gk_survival_saves",
      "def_moyes_minutes",
      "def_creator_outside_big_six",
      "def_midtable_minutes",
      "def_budget_clean_sheets",
      "mid_relegated_involvements",
      "mid_creator_outside_big_six",
      "mid_midtable_exact_five",
      "mid_budget_involvements",
      "fwd_promoted_goals",
      "fwd_exact_ten_outside_big_six"
    ],
    promptLabels: [
      "Goalkeeper whose club finished 13th–17th with at least 100 saves",
      "Defender managed by David Moyes who played at least 2,000 minutes",
      "Defender outside the traditional Big Six with at least five assists",
      "Defender from a club finishing 7th–12th who played 2,500+ minutes",
      "Defender who started at £4.5m or less with at least eight clean sheets",
      "Midfielder from a relegated club with at least 10 goal involvements",
      "Midfielder outside the traditional Big Six with at least 10 assists",
      "Midfielder from a club finishing 7th–12th with exactly five goals",
      "Midfielder who started at £6.0m or less with at least 15 goal involvements",
      "Forward from a promoted club with at least eight goals",
      "Forward outside the traditional Big Six who scored exactly 10 goals"
    ]
  };

  const core = window.FPL_STUDIO_API;
  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const promptLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const playerById = new Map(players.map(player => [player.playerId, player]));
  const recordByKey = new Map();
  for (const player of players) {
    for (const season of player.seasons || []) {
      recordByKey.set(`${player.playerId}::${season.season}`, {
        ...season,
        playerId: player.playerId,
        playerName: player.name
      });
    }
  }

  const elements = {
    historyStatus: document.querySelector("#historyStatus"),
    cooldownChallenges: document.querySelector("#cooldownChallenges"),
    cooldownSummary: document.querySelector("#cooldownSummary"),
    testPanel: document.querySelector("#testPanel"),
    startTestBtn: document.querySelector("#startTestBtn"),
    loadPerfectBtn: document.querySelector("#loadPerfectBtn"),
    autoTestBtn: document.querySelector("#autoTestBtn"),
    resetTestBtn: document.querySelector("#resetTestBtn"),
    revealTestBtn: document.querySelector("#revealTestBtn"),
    testSlots: document.querySelector("#testSlots"),
    testProgress: document.querySelector("#testProgress"),
    testTimer: document.querySelector("#testTimer"),
    testPenalty: document.querySelector("#testPenalty"),
    testStatus: document.querySelector("#testStatus"),
    testPassChip: document.querySelector("#testPassChip"),
    autoTestReport: document.querySelector("#autoTestReport"),
    testResults: document.querySelector("#testResults"),
    testPlayerPoints: document.querySelector("#testPlayerPoints"),
    testPenaltyPoints: document.querySelector("#testPenaltyPoints"),
    testFinalScore: document.querySelector("#testFinalScore"),
    testPerfectScore: document.querySelector("#testPerfectScore"),
    testEfficiency: document.querySelector("#testEfficiency"),
    testOutcome: document.querySelector("#testOutcome"),
    recordHistoryBtn: document.querySelector("#recordHistoryBtn"),
    downloadHistoryBtn: document.querySelector("#downloadHistoryBtn"),
    downloadHistoryMarkdownBtn: document.querySelector("#downloadHistoryMarkdownBtn"),
    historyActionStatus: document.querySelector("#historyActionStatus"),
    historyList: document.querySelector("#historyList")
  };

  let history = loadHistory();
  let testState = createTestState();

  ensureBaselineChallenge();

  window.FPL_STUDIO_PHASE3 = Object.freeze({
    getCooldownPromptIds,
    isPromptCoolingDown: promptId => getCooldownPromptIds().has(promptId),
    getHistory: () => history.map(entry => ({ ...entry, promptIds: [...entry.promptIds] }))
  });

  initialise();

  function initialise() {
    bindEvents();
    renderHistory();
    syncDraftAvailability();
    updateCooldownSummary();
    startTimerLoop();
  }

  function bindEvents() {
    elements.startTestBtn.addEventListener("click", startFreshTest);
    elements.loadPerfectBtn.addEventListener("click", loadOptimalXI);
    elements.autoTestBtn.addEventListener("click", runAutomaticChecks);
    elements.resetTestBtn.addEventListener("click", resetTester);
    elements.revealTestBtn.addEventListener("click", revealTestXI);
    elements.recordHistoryBtn.addEventListener("click", recordCurrentChallenge);
    elements.downloadHistoryBtn.addEventListener("click", downloadHistoryBackup);
    elements.downloadHistoryMarkdownBtn.addEventListener("click", downloadHistoryMarkdown);
    elements.cooldownChallenges.addEventListener("change", () => {
      updateCooldownSummary();
      core?.refreshDraft?.();
    });
    document.addEventListener("fplstudio:draftchange", () => {
      invalidateTest("The draft changed, so its previous test result was cleared.");
      syncDraftAvailability();
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".test-search-wrap")) {
        document.querySelectorAll(".test-suggestions").forEach(box => box.classList.add("hidden"));
      }
    });
  }

  function createTestState() {
    return {
      signature: "",
      picks: {},
      drafts: {},
      feedback: {},
      penalties: 0,
      startedAt: null,
      completedSeconds: null,
      activeSuggestion: {},
      automaticPassed: false,
      revealed: false
    };
  }

  function currentPrompts() {
    return core?.getSelectedPrompts?.() || [];
  }

  function draftSignature() {
    return currentPrompts().map(prompt => prompt.id).join("|");
  }

  function syncDraftAvailability() {
    const hasDraft = currentPrompts().length === 11;
    elements.testPanel.classList.toggle("hidden", !hasDraft);
    elements.startTestBtn.disabled = !hasDraft;
    elements.loadPerfectBtn.disabled = !hasDraft || !core?.getPerfectResult?.()?.possible;
    elements.autoTestBtn.disabled = !hasDraft;
    updateRecordButton();
    if (hasDraft && !testState.startedAt) {
      elements.testStatus.textContent = "Draft ready. Run the automatic checks, or start a manual play-through.";
    }
  }

  function startFreshTest() {
    const prompts = currentPrompts();
    if (prompts.length !== 11) return;
    testState = createTestState();
    testState.signature = draftSignature();
    testState.startedAt = Date.now();
    elements.testResults.classList.add("hidden");
    elements.autoTestReport.innerHTML = "";
    renderTester();
    elements.testStatus.textContent = "Test started. Search for players exactly as you would in the live game.";
    elements.testPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetTester() {
    if (!currentPrompts().length) return;
    startFreshTest();
    elements.testStatus.textContent = "Tester reset. No live-game data was changed.";
  }

  function invalidateTest(message) {
    testState = createTestState();
    elements.testSlots.innerHTML = "";
    elements.autoTestReport.innerHTML = "";
    elements.testResults.classList.add("hidden");
    elements.testPassChip.textContent = "Not tested";
    elements.testPassChip.classList.remove("test-pass", "test-fail");
    elements.testStatus.textContent = message;
    updateTestStatus();
    updateRecordButton();
  }

  function renderTester() {
    const prompts = currentPrompts();
    if (prompts.length !== 11 || testState.signature !== draftSignature()) return;

    elements.testSlots.innerHTML = prompts.map((prompt, index) => {
      const saved = testState.picks[prompt.id];
      const draft = testState.drafts[prompt.id] || saved || null;
      const player = draft ? playerById.get(draft.playerId) : null;
      const seasons = player ? eligibleSeasons(player, prompt) : [];
      const record = draft ? getRecord(draft.playerId, draft.season) : null;
      const feedback = testState.feedback[prompt.id] || "";
      const feedbackClass = feedback.startsWith("✅") ? "good" : feedback.startsWith("❌") ? "bad" : "";
      return `<article class="test-slot ${saved ? "valid" : ""}" id="test-slot-${escapeAttribute(prompt.id)}">
        <div class="test-slot-head">
          <span class="position-badge">${escapeHtml(prompt.position)}</span>
          <h3>${index + 1}. ${escapeHtml(prompt.label)}</h3>
          ${saved ? '<span class="test-valid-mark" aria-label="Valid">✓</span>' : ""}
        </div>
        <div class="test-choice-row">
          <div class="test-search-wrap">
            <input class="test-player-search" data-test-search="${escapeAttribute(prompt.id)}" value="${player ? escapeAttribute(player.name) : ""}" placeholder="Search ${escapeAttribute(prompt.position)}…" autocomplete="off">
            <div class="test-suggestions hidden" id="test-suggestions-${escapeAttribute(prompt.id)}"></div>
          </div>
          <select class="test-season-select" data-test-season="${escapeAttribute(prompt.id)}" ${player ? "" : "disabled"}>
            ${player ? seasons.map(season => `<option value="${escapeAttribute(season.season)}" ${season.season === draft.season ? "selected" : ""}>${escapeHtml(season.season)}</option>`).join("") : "<option>Season</option>"}
          </select>
          <button class="test-confirm" data-test-confirm="${escapeAttribute(prompt.id)}" type="button" ${record ? "" : "disabled"}>${saved ? "Confirmed" : "Confirm"}</button>
        </div>
        ${record ? `<div class="test-selected-meta">${escapeHtml(record.club)} · ${escapeHtml(record.position)} · £${Number(record.startingPrice || 0).toFixed(1)}m starting price</div>` : ""}
        <div class="test-feedback ${feedbackClass}">${escapeHtml(feedback)}</div>
        ${player ? `<button class="test-clear" data-test-clear="${escapeAttribute(prompt.id)}" type="button">Clear selection</button>` : ""}
      </article>`;
    }).join("");

    bindTesterControls();
    updateTestStatus();
  }

  function bindTesterControls() {
    document.querySelectorAll("[data-test-search]").forEach(input => {
      input.addEventListener("input", onTestSearch);
      input.addEventListener("focus", onTestSearch);
      input.addEventListener("keydown", onTestSearchKeys);
    });
    document.querySelectorAll("[data-test-season]").forEach(select => select.addEventListener("change", event => {
      const id = event.currentTarget.dataset.testSeason;
      if (testState.drafts[id]) testState.drafts[id].season = event.currentTarget.value;
      delete testState.picks[id];
      testState.revealed = false;
      elements.testResults.classList.add("hidden");
      renderTester();
    }));
    document.querySelectorAll("[data-test-confirm]").forEach(button => button.addEventListener("click", () => confirmTestPick(button.dataset.testConfirm)));
    document.querySelectorAll("[data-test-clear]").forEach(button => button.addEventListener("click", () => clearTestPick(button.dataset.testClear)));
  }

  function onTestSearch(event) {
    const input = event.currentTarget;
    const promptId = input.dataset.testSearch;
    const prompt = currentPrompts().find(item => item.id === promptId);
    if (!prompt) return;
    const query = normalise(input.value.trim());
    const currentDraft = testState.drafts[promptId];
    if (currentDraft && normalise(playerById.get(currentDraft.playerId)?.name) !== query) {
      delete testState.drafts[promptId];
      delete testState.picks[promptId];
      testState.revealed = false;
    }

    const box = document.querySelector(`#test-suggestions-${cssEscape(promptId)}`);
    if (!box) return;
    if (query.length < 2) {
      box.classList.add("hidden");
      return;
    }

    const used = usedPlayerIds();
    const matches = players.filter(player =>
      !used.has(player.playerId) &&
      eligibleSeasons(player, prompt).length &&
      normalise(player.name).includes(query)
    ).slice(0, 10);

    testState.activeSuggestion[promptId] = -1;
    box.innerHTML = matches.length
      ? matches.map((player, index) => `<button class="test-suggestion" data-test-option="${escapeAttribute(player.playerId)}" data-test-prompt="${escapeAttribute(promptId)}" data-test-index="${index}" type="button"><strong>${escapeHtml(player.name)}</strong><small>${eligibleSeasons(player, prompt).map(season => escapeHtml(season.season)).join(" · ")}</small></button>`).join("")
      : '<div class="test-suggestion">No matching unused players</div>';
    box.classList.remove("hidden");
    box.querySelectorAll("[data-test-option]").forEach(button => button.addEventListener("click", () => chooseTestPlayer(promptId, button.dataset.testOption)));
  }

  function onTestSearchKeys(event) {
    const promptId = event.currentTarget.dataset.testSearch;
    const box = document.querySelector(`#test-suggestions-${cssEscape(promptId)}`);
    const options = box ? [...box.querySelectorAll("[data-test-option]")] : [];
    if (!box || box.classList.contains("hidden") || !options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      testState.activeSuggestion[promptId] = Math.min((testState.activeSuggestion[promptId] ?? -1) + 1, options.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      testState.activeSuggestion[promptId] = Math.max((testState.activeSuggestion[promptId] ?? 0) - 1, 0);
    } else if (event.key === "Enter" && testState.activeSuggestion[promptId] >= 0) {
      event.preventDefault();
      options[testState.activeSuggestion[promptId]].click();
      return;
    } else if (event.key === "Escape") {
      box.classList.add("hidden");
      return;
    } else {
      return;
    }
    options.forEach((option, index) => option.classList.toggle("active", index === testState.activeSuggestion[promptId]));
  }

  function chooseTestPlayer(promptId, playerId) {
    if (usedPlayerIds().has(playerId)) {
      testState.feedback[promptId] = "That footballer has already been used — no penalty.";
      renderTester();
      return;
    }
    const prompt = currentPrompts().find(item => item.id === promptId);
    const player = playerById.get(playerId);
    const seasons = eligibleSeasons(player, prompt);
    if (!seasons.length) return;
    testState.drafts[promptId] = { playerId, season: seasons[0].season };
    delete testState.picks[promptId];
    testState.feedback[promptId] = "Choose a season, then confirm.";
    testState.revealed = false;
    elements.testResults.classList.add("hidden");
    renderTester();
  }

  function confirmTestPick(promptId) {
    const prompt = currentPrompts().find(item => item.id === promptId);
    const draft = testState.drafts[promptId];
    if (!prompt || !draft) return;
    const duplicate = Object.entries(testState.picks).some(([id, pick]) => id !== promptId && pick.playerId === draft.playerId);
    if (duplicate) {
      testState.feedback[promptId] = "That footballer has already been used — no penalty.";
      renderTester();
      return;
    }
    const record = getRecord(draft.playerId, draft.season);
    if (!record) return;
    let valid = false;
    try { valid = Boolean(prompt.test(record)); } catch (error) { valid = false; }
    if (!valid) {
      testState.penalties += INVALID_PENALTY;
      testState.feedback[promptId] = `❌ ${record.playerName} ${record.season} is invalid. ${prompt.fail} −${INVALID_PENALTY} points.`;
      delete testState.picks[promptId];
      renderTester();
      const slot = document.querySelector(`#test-slot-${cssEscape(promptId)}`);
      slot?.classList.add("invalid-flash");
      setTimeout(() => slot?.classList.remove("invalid-flash"), 450);
      return;
    }
    testState.picks[promptId] = { playerId: draft.playerId, season: draft.season };
    testState.feedback[promptId] = `✅ Valid: ${record.points} points hidden until reveal.`;
    testState.revealed = false;
    elements.testResults.classList.add("hidden");
    renderTester();
  }

  function clearTestPick(promptId) {
    delete testState.drafts[promptId];
    delete testState.picks[promptId];
    testState.feedback[promptId] = "";
    testState.revealed = false;
    elements.testResults.classList.add("hidden");
    renderTester();
  }

  function loadOptimalXI() {
    const perfect = core?.getPerfectResult?.();
    const prompts = currentPrompts();
    if (!perfect?.possible || prompts.length !== 11) return;
    if (!testState.startedAt || testState.signature !== draftSignature()) startFreshTest();
    testState.picks = {};
    testState.drafts = {};
    testState.feedback = {};
    testState.penalties = 0;
    perfect.picks.forEach((pick, index) => {
      const prompt = prompts[index];
      testState.drafts[prompt.id] = { playerId: pick.record.playerId, season: pick.record.season };
      testState.feedback[prompt.id] = "Optimal answer loaded. Confirm it to test the slot.";
    });
    elements.testResults.classList.add("hidden");
    renderTester();
    elements.testStatus.textContent = "The optimal unique-player XI is loaded. Confirm each slot, or run the automatic checks.";
  }

  function runAutomaticChecks() {
    const prompts = currentPrompts();
    const perfect = core?.getPerfectResult?.();
    const checks = [];
    let passed = true;

    const addCheck = (condition, success, failure) => {
      checks.push({ passed: Boolean(condition), message: condition ? success : failure });
      if (!condition) passed = false;
    };

    addCheck(prompts.length === 11, "The draft contains exactly 11 prompts.", `The draft contains ${prompts.length} prompts instead of 11.`);
    addCheck(prompts.map(prompt => prompt.position).join(",") === "GK,DEF,DEF,DEF,DEF,MID,MID,MID,MID,FWD,FWD", "The formation is exactly 1–4–4–2.", "The prompt positions do not form a 1–4–4–2 XI.");
    addCheck(perfect?.possible, "A unique-player perfect XI exists.", perfect?.reason || "A unique-player perfect XI could not be found.");

    if (perfect?.possible) {
      const uniqueIds = new Set(perfect.picks.map(pick => pick.record.playerId));
      addCheck(uniqueIds.size === 11, "All 11 optimal answers use different footballers.", "The optimal XI repeats a footballer.");
      const allPass = perfect.picks.every((pick, index) => {
        try { return prompts[index].test(pick.record); } catch (error) { return false; }
      });
      addCheck(allPass, "Every optimal player-season passes its prompt test.", "At least one optimal player-season fails its prompt test.");
      const calculatedScore = perfect.picks.reduce((sum, pick) => sum + pick.record.points, 0);
      addCheck(calculatedScore === perfect.score, `The exact perfect score recalculates to ${perfect.score.toLocaleString()}.`, `The optimal XI totals ${calculatedScore}, but the studio reports ${perfect.score}.`);
      const code = core?.getChallengeMeta?.()?.code || "";
      addCheck(code.includes(`perfectScore: ${perfect.score}`), "The downloaded JavaScript includes the exact perfect score.", "The generated JavaScript does not contain the exact perfect score.");
      addCheck(prompts.every(prompt => code.includes(`id: ${JSON.stringify(prompt.id)}`)), "All 11 selected prompt IDs are present in the generated file.", "At least one selected prompt is missing from the generated file.");
    }

    testState.signature = draftSignature();
    testState.automaticPassed = passed;
    elements.autoTestReport.innerHTML = checks.map(check => `<div class="${check.passed ? "success-message" : "warning"}">${check.passed ? "✓" : "✕"} ${escapeHtml(check.message)}</div>`).join("");
    elements.testPassChip.textContent = passed ? "Automatic checks passed" : "Checks failed";
    elements.testPassChip.classList.toggle("test-pass", passed);
    elements.testPassChip.classList.toggle("test-fail", !passed);
    elements.testStatus.textContent = passed
      ? "Automatic checks passed. You can record this challenge in history, or manually play through it as an extra check."
      : "One or more automatic checks failed. Do not upload this challenge yet.";
    updateRecordButton();
  }

  function revealTestXI() {
    const prompts = currentPrompts();
    if (prompts.length !== 11 || prompts.some(prompt => !testState.picks[prompt.id])) return;
    const rows = prompts.map(prompt => getRecord(testState.picks[prompt.id].playerId, testState.picks[prompt.id].season));
    const points = rows.reduce((sum, record) => sum + record.points, 0);
    const finalScore = points - testState.penalties;
    const perfectScore = core?.getPerfectResult?.()?.score || 0;
    const efficiency = perfectScore > 0 ? finalScore / perfectScore * 100 : 0;
    const unique = new Set(rows.map(record => record.playerId)).size === 11;
    const allValid = rows.every((record, index) => {
      try { return currentPrompts()[index].test(record); } catch (error) { return false; }
    });
    const passed = unique && allValid;

    testState.completedSeconds = elapsedSeconds();
    testState.revealed = true;
    elements.testPlayerPoints.textContent = points.toLocaleString();
    elements.testPenaltyPoints.textContent = testState.penalties ? `−${testState.penalties}` : "0";
    elements.testFinalScore.textContent = finalScore.toLocaleString();
    elements.testPerfectScore.textContent = perfectScore.toLocaleString();
    elements.testEfficiency.textContent = `${efficiency.toFixed(1)}%`;
    elements.testOutcome.textContent = passed ? "Passed" : "Failed";
    elements.testOutcome.className = passed ? "test-pass" : "test-fail";
    elements.testResults.classList.remove("hidden");
    elements.testStatus.textContent = passed
      ? "Manual play-through passed: all 11 selections remained valid and scoring completed correctly."
      : "The manual play-through found a problem. Do not upload this challenge yet.";
  }

  function updateTestStatus() {
    const prompts = currentPrompts();
    const validCount = prompts.filter(prompt => testState.picks[prompt.id]).length;
    elements.testProgress.textContent = `${validCount} / ${prompts.length || 11} valid`;
    elements.testPenalty.textContent = `Penalties −${testState.penalties}`;
    elements.revealTestBtn.disabled = validCount !== 11;
  }

  function startTimerLoop() {
    setInterval(() => {
      const seconds = testState.completedSeconds ?? elapsedSeconds();
      elements.testTimer.textContent = `Time ${formatTime(seconds)}`;
    }, 1000);
  }

  function elapsedSeconds() {
    return testState.startedAt ? Math.floor((Date.now() - testState.startedAt) / 1000) : 0;
  }

  function eligibleSeasons(player, prompt) {
    return (player?.seasons || []).filter(season => season.position === prompt.position);
  }

  function usedPlayerIds() {
    return new Set(Object.values(testState.picks).map(pick => pick.playerId));
  }

  function getRecord(playerId, season) {
    return recordByKey.get(`${playerId}::${season}`) || null;
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(entry => entry && Array.isArray(entry.promptIds)) : [];
    } catch (error) {
      return [];
    }
  }

  function ensureBaselineChallenge() {
    if (!history.some(entry => Number(entry.number) === 6)) {
      history.push({ ...BASELINE_CHALLENGE, promptIds: [...BASELINE_CHALLENGE.promptIds], promptLabels: [...BASELINE_CHALLENGE.promptLabels] });
      saveHistory();
    }
  }

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function sortedHistory() {
    return [...history].sort((a, b) => {
      const dateCompare = String(b.releaseDate || "").localeCompare(String(a.releaseDate || ""));
      if (dateCompare) return dateCompare;
      return Number(b.number || 0) - Number(a.number || 0);
    });
  }

  function getCooldownPromptIds() {
    const count = clampNumber(elements.cooldownChallenges?.value, 1, 50, 7);
    const recent = sortedHistory().slice(0, count);
    return new Set(recent.flatMap(entry => entry.promptIds || []));
  }

  function updateCooldownSummary() {
    const challengeCount = clampNumber(elements.cooldownChallenges?.value, 1, 50, 7);
    const promptCount = getCooldownPromptIds().size;
    elements.cooldownSummary.textContent = `${promptCount} prompts blocked from the last ${Math.min(challengeCount, history.length)} challenge(s)`;
  }

  function updateRecordButton() {
    const validDraft = currentPrompts().length === 11 && core?.getPerfectResult?.()?.possible;
    const sameDraft = testState.signature === draftSignature();
    elements.recordHistoryBtn.disabled = !(validDraft && sameDraft && testState.automaticPassed);
  }

  function recordCurrentChallenge() {
    if (elements.recordHistoryBtn.disabled) return;
    const prompts = currentPrompts();
    const perfect = core.getPerfectResult();
    const meta = core.getChallengeMeta();
    const existingIndex = history.findIndex(entry => Number(entry.number) === Number(meta.number));
    if (existingIndex >= 0 && !history[existingIndex].locked) {
      const replace = window.confirm(`Challenge #${meta.number} is already in this browser's history. Replace it with the tested version?`);
      if (!replace) return;
    } else if (existingIndex >= 0 && history[existingIndex].locked) {
      elements.historyActionStatus.textContent = `Challenge #${meta.number} is a locked baseline entry and cannot be replaced.`;
      return;
    }

    const entry = {
      version: 1,
      id: `daily-${String(meta.number).padStart(3, "0")}-${slugify(meta.name) || "generated-mix"}`,
      number: meta.number,
      name: meta.name,
      title: `Challenge #${meta.number} · ${meta.name}`,
      releaseDate: meta.releaseDate,
      difficulty: meta.difficulty,
      perfectScore: perfect.score,
      status: "ready",
      locked: false,
      recordedAt: new Date().toISOString(),
      promptIds: prompts.map(prompt => prompt.id),
      promptLabels: prompts.map(prompt => prompt.label)
    };

    if (existingIndex >= 0) history[existingIndex] = entry;
    else history.push(entry);
    saveHistory();
    renderHistory();
    core.refreshDraft();
    elements.historyActionStatus.textContent = `Challenge #${meta.number} recorded. Its prompts now count towards the cooldown.`;
  }

  function renderHistory() {
    const ordered = sortedHistory();
    elements.historyStatus.textContent = `${ordered.length} challenge${ordered.length === 1 ? "" : "s"} recorded`;
    elements.historyList.innerHTML = ordered.length ? ordered.map(entry => {
      const status = entry.status === "published" ? "Published" : "Ready to upload";
      const prompts = (entry.promptLabels?.length ? entry.promptLabels : entry.promptIds).map((label, index) => `<li>${escapeHtml(label || entry.promptIds[index])}</li>`).join("");
      return `<article class="history-card" data-history-id="${escapeAttribute(entry.id)}">
        <div class="history-card-head">
          <div>
            <h3>${escapeHtml(entry.title || `Challenge #${entry.number} · ${entry.name}`)}</h3>
            <p class="history-meta">${escapeHtml(entry.releaseDate || "No date")} · ${escapeHtml(entry.difficulty || "Mixed")} · ${Number(entry.perfectScore || 0).toLocaleString()} perfect score</p>
          </div>
          <span class="history-status ${entry.status === "published" ? "published" : ""}">${status}</span>
        </div>
        <details class="history-prompts"><summary>Show ${entry.promptIds.length} used prompts</summary><ol>${prompts}</ol></details>
        <div class="history-actions">
          ${entry.locked ? "" : `<button type="button" data-history-toggle="${escapeAttribute(entry.id)}">Mark ${entry.status === "published" ? "ready" : "published"}</button><button type="button" data-history-delete="${escapeAttribute(entry.id)}">Delete entry</button>`}
        </div>
      </article>`;
    }).join("") : '<div class="history-empty">No challenge history is stored in this browser yet.</div>';

    elements.historyList.querySelectorAll("[data-history-toggle]").forEach(button => button.addEventListener("click", () => toggleHistoryStatus(button.dataset.historyToggle)));
    elements.historyList.querySelectorAll("[data-history-delete]").forEach(button => button.addEventListener("click", () => deleteHistoryEntry(button.dataset.historyDelete)));
    updateCooldownSummary();
    updateRecordButton();
  }

  function toggleHistoryStatus(id) {
    const entry = history.find(item => item.id === id);
    if (!entry || entry.locked) return;
    entry.status = entry.status === "published" ? "ready" : "published";
    saveHistory();
    renderHistory();
    elements.historyActionStatus.textContent = `${entry.title} marked ${entry.status}.`;
  }

  function deleteHistoryEntry(id) {
    const entry = history.find(item => item.id === id);
    if (!entry || entry.locked) return;
    if (!window.confirm(`Delete ${entry.title} from this browser's history?`)) return;
    history = history.filter(item => item.id !== id);
    saveHistory();
    renderHistory();
    core.refreshDraft();
    elements.historyActionStatus.textContent = `${entry.title} removed from browser history.`;
  }

  function downloadHistoryBackup() {
    const content = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), challenges: sortedHistory() }, null, 2) + "\n";
    downloadText("fpl-challenge-history.json", content, "application/json;charset=utf-8");
    elements.historyActionStatus.textContent = "Challenge history backup downloaded as JSON.";
  }

  function downloadHistoryMarkdown() {
    const lines = ["# FPL Daily Challenge History", "", `Exported: ${new Date().toLocaleString()}`, ""];
    for (const entry of sortedHistory().reverse()) {
      lines.push(`## Challenge #${entry.number} · ${entry.name}`);
      lines.push("");
      lines.push(`- Release date: ${entry.releaseDate || "—"}`);
      lines.push(`- Difficulty: ${entry.difficulty || "Mixed"}`);
      lines.push(`- Perfect score: ${entry.perfectScore || 0}`);
      lines.push(`- Status: ${entry.status || "ready"}`);
      lines.push("");
      (entry.promptLabels?.length ? entry.promptLabels : entry.promptIds).forEach((label, index) => lines.push(`${index + 1}. ${label}`));
      lines.push("");
    }
    downloadText("challenge-history.md", lines.join("\n") + "\n", "text/markdown;charset=utf-8");
    elements.historyActionStatus.textContent = "Readable challenge-history.md downloaded.";
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function normalise(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function formatTime(seconds) {
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
  }

  function slugify(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`);
  }
})();
