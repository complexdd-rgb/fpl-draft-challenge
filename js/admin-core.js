/* ===== BEGIN admin-phase5.js ===== */
(() => {
  "use strict";

  const STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const BIG_SIX = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"];
  const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const baseIds = new Set(library.map(prompt => prompt.id));

  const FIELD_DEFS = Object.freeze({
    points: { label: "FPL points", type: "number" },
    minutes: { label: "Minutes", type: "number" },
    goals: { label: "Goals", type: "number" },
    assists: { label: "Assists", type: "number" },
    goalInvolvements: { label: "Goals + assists", type: "number", derived: true },
    cleanSheets: { label: "Clean sheets", type: "number" },
    bonus: { label: "Bonus points", type: "number" },
    saves: { label: "Saves", type: "number" },
    goalsConceded: { label: "Goals conceded", type: "number" },
    yellowCards: { label: "Yellow cards", type: "number" },
    redCards: { label: "Red cards", type: "number" },
    startingPrice: { label: "Starting price (£m)", type: "number" },
    finalPrice: { label: "Final price (£m)", type: "number" },
    leaguePosition: { label: "League position", type: "number" },
    ageAtSeasonStart: { label: "Age at season start", type: "number" },
    season: { label: "Season played", type: "season" },
    careerSeasonCount: { label: "Recorded Premier League seasons", type: "number", career: true },
    careerClubCount: { label: "Recorded Premier League clubs", type: "number", career: true },
    playedForBothClubs: { label: "Played for both clubs", type: "clubPair", career: true },
    returnedToFormerClub: { label: "Returned to a former club", type: "boolean", career: true },
    careerOverlapWithPlayer: { label: "Career overlapped with player", type: "playerReference", career: true },
    sameClubSeasonAsPlayer: { label: "Same Premier League club-season as player", type: "teammateReference", career: true },
    champions: { label: "League champions", type: "boolean" },
    topFour: { label: "Top-four club", type: "boolean" },
    bottomHalf: { label: "Bottom-half club", type: "boolean" },
    relegated: { label: "Relegated club", type: "boolean" },
    promoted: { label: "Promoted club", type: "boolean" },
    outsideBigSix: { label: "Outside traditional Big Six", type: "boolean", derived: true },
    assistsMoreThanGoals: { label: "More assists than goals", type: "boolean", derived: true },
    fullName: { label: "Full player name", type: "nameText", derived: true },
    firstName: { label: "First name", type: "nameText", derived: true },
    surname: { label: "Surname / family name", type: "nameText", derived: true },
    firstInitial: { label: "First-name initial", type: "nameText", derived: true },
    surnameInitial: { label: "Surname initial", type: "nameText", derived: true },
    fullNameLength: { label: "Full-name letter count", type: "number", derived: true },
    firstNameLength: { label: "First-name letter count", type: "number", derived: true },
    surnameLength: { label: "Surname letter count", type: "number", derived: true },
    nameWordCount: { label: "Name word count", type: "number", derived: true },
    hyphenatedSurname: { label: "Hyphenated surname", type: "boolean", derived: true },
    sameInitials: { label: "First name and surname share an initial", type: "boolean", derived: true },
    singleWordName: { label: "Single-word player name", type: "boolean", derived: true },
    club: { label: "Club", type: "text" },
    manager: { label: "Manager", type: "manager" }
  });

  const NUMBER_OPERATORS = Object.freeze({
    gte: "at least",
    lte: "at most",
    eq: "exactly",
    gt: "more than",
    lt: "less than",
    between: "between"
  });
  const TEXT_OPERATORS = Object.freeze({ equals: "is", notEquals: "is not", contains: "contains" });
  const NAME_TEXT_OPERATORS = Object.freeze({ equals: "is", notEquals: "is not", startsWith: "starts with", endsWith: "ends with", contains: "contains" });
  const BOOLEAN_OPERATORS = Object.freeze({ isTrue: "is true", isFalse: "is false" });
  const SEASON_OPERATORS = Object.freeze({ equals: "is exactly", before: "is before", after: "is after", between: "is between" });
  const CLUB_PAIR_OPERATORS = Object.freeze({ both: "includes both" });
  const PLAYER_REFERENCE_OPERATORS = Object.freeze({ overlaps: "overlaps with" });
  const TEAMMATE_REFERENCE_OPERATORS = Object.freeze({ sameClubSeason: "same club and season as" });

  let state = loadState();
  applyStoredState();
  window.addEventListener("load", initialiseManager, { once: true });

  function blankState() {
    return { version: 1, overrides: {}, customs: [], deletedIds: [] };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return blankState();
      return {
        version: 1,
        overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
        customs: Array.isArray(parsed.customs) ? parsed.customs : [],
        deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
      };
    } catch (error) {
      console.warn("Prompt manager storage could not be read.", error);
      return blankState();
    }
  }

  function applyStoredState() {
    for (const prompt of library) {
      prompt.enabled = prompt.enabled !== false;
      prompt._studioBuiltIn = !prompt.studioRule;
      prompt._studioCustom = Boolean(prompt.studioRule);
      const override = state.overrides[prompt.id];
      if (override) applyMetadata(prompt, override);
    }

    const deleted = new Set(state.deletedIds);
    for (let index = library.length - 1; index >= 0; index -= 1) {
      if (deleted.has(library[index].id)) library.splice(index, 1);
    }

    for (const saved of state.customs) {
      if (!saved?.id || deleted.has(saved.id)) continue;
      const prompt = hydrateCustomPrompt(saved);
      const existing = library.find(item => item.id === prompt.id);
      if (existing) Object.assign(existing, prompt);
      else library.push(prompt);
    }
  }

  function hydrateCustomPrompt(saved) {
    const studioRule = normaliseStudioRule(saved.studioRule);
    const testSource = studioRule.kind === "builder"
      ? compileRuleSource(studioRule)
      : String(studioRule.source || saved.testSource || "p => false");
    return {
      id: String(saved.id),
      position: validPosition(saved.position),
      label: String(saved.label || "Untitled prompt"),
      fail: String(saved.fail || "That player-season does not meet the prompt."),
      difficulty: validDifficulty(saved.difficulty),
      tags: normaliseTags(saved.tags),
      rating: clamp(saved.rating, 1, 5, 3),
      cooldown: clamp(saved.cooldown, 0, 50, 7),
      enabled: saved.enabled !== false,
      studioRule,
      test: functionFromSource(testSource),
      _studioBuiltIn: false,
      _studioCustom: true
    };
  }

  function initialiseManager() {
    const core = window.FPL_STUDIO_API;
    if (!core) return;

    const elements = getElements();
    if (!elements.panel) return;

    const ui = {
      editingId: null,
      previewPrompt: null,
      page: 1,
      pageSize: 24
    };

    bindEvents(elements, ui, core);
    renderAll(elements, ui, core);
  }

  function getElements() {
    return {
      panel: document.querySelector("#libraryManagerPanel"),
      managerStatus: document.querySelector("#managerStatus"),
      libraryCount: document.querySelector("#managerLibraryCount"),
      enabledCount: document.querySelector("#managerEnabledCount"),
      disabledCount: document.querySelector("#managerDisabledCount"),
      customCount: document.querySelector("#managerCustomCount"),
      search: document.querySelector("#promptManagerSearch"),
      position: document.querySelector("#promptManagerPosition"),
      difficulty: document.querySelector("#promptManagerDifficulty"),
      status: document.querySelector("#promptManagerStatusFilter"),
      newBtn: document.querySelector("#newPromptBtn"),
      downloadBtn: document.querySelector("#downloadLibraryBtn"),
      backupBtn: document.querySelector("#downloadPromptBackupBtn"),
      importInput: document.querySelector("#importPromptBackupInput"),
      resetBtn: document.querySelector("#resetPromptManagerBtn"),
      editor: document.querySelector("#promptEditor"),
      editorTitle: document.querySelector("#promptEditorTitle"),
      editorNotice: document.querySelector("#promptEditorNotice"),
      id: document.querySelector("#promptEditorId"),
      promptPosition: document.querySelector("#promptEditorPosition"),
      label: document.querySelector("#promptEditorLabel"),
      fail: document.querySelector("#promptEditorFail"),
      promptDifficulty: document.querySelector("#promptEditorDifficulty"),
      rating: document.querySelector("#promptEditorRating"),
      cooldown: document.querySelector("#promptEditorCooldown"),
      tags: document.querySelector("#promptEditorTags"),
      enabled: document.querySelector("#promptEditorEnabled"),
      join: document.querySelector("#promptRuleJoin"),
      rules: document.querySelector("#promptRuleRows"),
      addConditionBtn: document.querySelector("#addPromptConditionBtn"),
      testBtn: document.querySelector("#testPromptBtn"),
      saveBtn: document.querySelector("#savePromptBtn"),
      duplicateBtn: document.querySelector("#duplicatePromptBtn"),
      cancelBtn: document.querySelector("#cancelPromptEditBtn"),
      testResults: document.querySelector("#promptTestResults"),
      list: document.querySelector("#promptManagerList"),
      listSummary: document.querySelector("#promptListSummary"),
      previousBtn: document.querySelector("#promptPreviousPageBtn"),
      nextBtn: document.querySelector("#promptNextPageBtn"),
      pageLabel: document.querySelector("#promptPageLabel")
    };
  }

  function bindEvents(elements, ui, core) {
    for (const input of [elements.search, elements.position, elements.difficulty, elements.status]) {
      input.addEventListener(input === elements.search ? "input" : "change", () => {
        ui.page = 1;
        renderPromptList(elements, ui, core);
      });
    }

    elements.newBtn.addEventListener("click", () => openNewEditor(elements, ui));
    elements.cancelBtn.addEventListener("click", () => closeEditor(elements, ui));
    elements.addConditionBtn.addEventListener("click", () => addRuleRow(elements, blankCondition()));
    elements.testBtn.addEventListener("click", () => previewEditorPrompt(elements, ui, core));
    elements.saveBtn.addEventListener("click", () => saveEditorPrompt(elements, ui, core));
    elements.duplicateBtn.addEventListener("click", () => duplicateEditingPrompt(elements, ui));
    elements.downloadBtn.addEventListener("click", () => downloadPromptLibrary(elements));
    elements.backupBtn.addEventListener("click", () => downloadManagerBackup(elements));
    elements.importInput.addEventListener("change", event => importManagerBackup(event, elements));
    elements.resetBtn.addEventListener("click", () => resetManagerChanges(elements));
    elements.previousBtn.addEventListener("click", () => {
      ui.page = Math.max(1, ui.page - 1);
      renderPromptList(elements, ui, core);
    });
    elements.nextBtn.addEventListener("click", () => {
      ui.page += 1;
      renderPromptList(elements, ui, core);
    });

    elements.list.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const prompt = library.find(item => item.id === button.dataset.id);
      if (!prompt) return;
      const action = button.dataset.action;
      if (action === "edit") openExistingEditor(elements, ui, prompt);
      if (action === "test") renderPromptTest(elements, prompt, core);
      if (action === "toggle") togglePrompt(prompt, elements, ui, core);
      if (action === "duplicate") duplicatePrompt(prompt, elements, ui);
      if (action === "delete") deletePrompt(prompt, elements, ui, core);
    });

    elements.rules.addEventListener("click", event => {
      const remove = event.target.closest("button[data-remove-rule]");
      if (!remove) return;
      remove.closest(".rule-row")?.remove();
      if (!elements.rules.children.length) addRuleRow(elements, blankCondition());
    });

    elements.rules.addEventListener("change", event => {
      if (!event.target.matches("select[data-rule-field]")) return;
      rebuildRuleRow(event.target.closest(".rule-row"));
    });

    elements.editor.addEventListener("click", event => {
      const button = event.target.closest("button[data-name-preset]");
      if (!button) return;
      applyNamePreset(elements, ui, button.dataset.namePreset);
    });
  }

  function renderAll(elements, ui, core) {
    renderManagerCounts(elements);
    renderPromptList(elements, ui, core);
    elements.managerStatus.textContent = "Library Manager is ready. Changes stay in this browser until you download prompt-library.js.";
  }

  function renderManagerCounts(elements) {
    const enabled = library.filter(prompt => prompt.enabled !== false).length;
    const custom = library.filter(prompt => prompt.studioRule).length;
    elements.libraryCount.textContent = library.length.toLocaleString();
    elements.enabledCount.textContent = enabled.toLocaleString();
    elements.disabledCount.textContent = (library.length - enabled).toLocaleString();
    elements.customCount.textContent = custom.toLocaleString();
  }

  function filteredPrompts(elements) {
    const query = elements.search.value.trim().toLowerCase();
    return library
      .filter(prompt => !query || [prompt.id, prompt.label, prompt.fail, ...(prompt.tags || [])].join(" ").toLowerCase().includes(query))
      .filter(prompt => elements.position.value === "all" || prompt.position === elements.position.value)
      .filter(prompt => elements.difficulty.value === "all" || prompt.difficulty === elements.difficulty.value)
      .filter(prompt => {
        if (elements.status.value === "enabled") return prompt.enabled !== false;
        if (elements.status.value === "disabled") return prompt.enabled === false;
        if (elements.status.value === "custom") return Boolean(prompt.studioRule);
        if (elements.status.value === "built-in") return !prompt.studioRule;
        return true;
      })
      .sort((a, b) => a.position.localeCompare(b.position) || a.label.localeCompare(b.label));
  }

  function renderPromptList(elements, ui, core) {
    const prompts = filteredPrompts(elements);
    const totalPages = Math.max(1, Math.ceil(prompts.length / ui.pageSize));
    ui.page = Math.min(ui.page, totalPages);
    const start = (ui.page - 1) * ui.pageSize;
    const pagePrompts = prompts.slice(start, start + ui.pageSize);

    elements.listSummary.textContent = `${prompts.length} matching prompt${prompts.length === 1 ? "" : "s"}`;
    elements.pageLabel.textContent = `Page ${ui.page} of ${totalPages}`;
    elements.previousBtn.disabled = ui.page <= 1;
    elements.nextBtn.disabled = ui.page >= totalPages;

    elements.list.innerHTML = pagePrompts.length ? pagePrompts.map(prompt => {
      const stats = core.getPromptStats(prompt);
      const selected = core.isPromptSelected?.(prompt.id);
      const origin = prompt.studioRule ? "Custom" : "Built-in";
      const status = prompt.enabled === false ? "Disabled" : "Enabled";
      return `<article class="library-prompt-card ${prompt.enabled === false ? "disabled" : ""}">
        <div class="library-prompt-head">
          <div class="library-prompt-title">
            <span class="position-badge">${escapeHtml(prompt.position)}</span>
            <div>
              <h3>${escapeHtml(prompt.label)}</h3>
              <p>${escapeHtml(prompt.id)}</p>
            </div>
          </div>
          <div class="library-prompt-chips">
            <span>${escapeHtml(origin)}</span>
            <span class="${prompt.enabled === false ? "off" : "on"}">${status}</span>
            ${selected ? '<span class="selected">In current XI</span>' : ""}
          </div>
        </div>
        <div class="library-prompt-meta">
          <span>${capitalise(prompt.difficulty)}</span>
          <span>Rating ${prompt.rating}/5</span>
          <span>Cooldown ${prompt.cooldown ?? 7}</span>
          <span>${stats.playerCount} players</span>
          <span>${stats.seasonCount} seasons</span>
        </div>
        <div class="tags">${(prompt.tags || []).map(tag => `<span class="tag${tag === "anti-meta" ? " anti" : ""}">${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="library-prompt-actions">
          <button type="button" data-action="edit" data-id="${escapeAttribute(prompt.id)}">Edit</button>
          <button type="button" data-action="test" data-id="${escapeAttribute(prompt.id)}">Test</button>
          <button type="button" data-action="toggle" data-id="${escapeAttribute(prompt.id)}">${prompt.enabled === false ? "Enable" : "Disable"}</button>
          <button type="button" data-action="duplicate" data-id="${escapeAttribute(prompt.id)}">Duplicate</button>
          <button class="danger-action" type="button" data-action="delete" data-id="${escapeAttribute(prompt.id)}">Delete</button>
        </div>
      </article>`;
    }).join("") : '<div class="history-empty">No prompts match those filters.</div>';
  }

  function openNewEditor(elements, ui) {
    ui.editingId = null;
    elements.editorTitle.textContent = "Create a custom prompt";
    elements.editorNotice.innerHTML = "Use the rule builder below. The player position is automatically enforced by the generator.";
    elements.id.value = "";
    elements.id.disabled = false;
    elements.promptPosition.value = "GK";
    elements.promptPosition.disabled = false;
    elements.label.value = "";
    elements.fail.value = "";
    elements.promptDifficulty.value = "medium";
    elements.rating.value = "4";
    elements.cooldown.value = "7";
    elements.tags.value = "anti-meta";
    elements.enabled.checked = true;
    elements.join.value = "all";
    elements.rules.innerHTML = "";
    addRuleRow(elements, blankCondition());
    setRuleBuilderLocked(elements, false);
    elements.duplicateBtn.classList.add("hidden");
    elements.testResults.innerHTML = "";
    elements.editor.classList.remove("hidden");
    elements.editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openExistingEditor(elements, ui, prompt) {
    ui.editingId = prompt.id;
    elements.editorTitle.textContent = `Edit ${prompt.studioRule ? "custom" : "built-in"} prompt`;
    elements.id.value = prompt.id;
    elements.id.disabled = true;
    elements.promptPosition.value = prompt.position;
    elements.promptPosition.disabled = !prompt.studioRule;
    elements.label.value = prompt.label;
    elements.fail.value = prompt.fail;
    elements.promptDifficulty.value = prompt.difficulty;
    elements.rating.value = prompt.rating;
    elements.cooldown.value = prompt.cooldown ?? 7;
    elements.tags.value = (prompt.tags || []).join(", ");
    elements.enabled.checked = prompt.enabled !== false;
    elements.rules.innerHTML = "";

    const editableBuilder = prompt.studioRule?.kind === "builder";
    if (editableBuilder) {
      elements.join.value = prompt.studioRule.join || "all";
      for (const condition of prompt.studioRule.conditions || []) addRuleRow(elements, condition);
      if (!elements.rules.children.length) addRuleRow(elements, blankCondition());
      elements.editorNotice.innerHTML = "This custom prompt has an editable safe rule. Changes are tested against the full player database before saving.";
    } else {
      elements.join.value = "all";
      elements.editorNotice.innerHTML = prompt.studioRule
        ? "This duplicated prompt keeps its original JavaScript rule. Its wording, rating, tags and status can be edited, but the rule itself is locked."
        : "Built-in rules are locked to protect working prompts. You can edit wording, difficulty, rating, tags, cooldown and status, or create a new custom rule.";
    }
    setRuleBuilderLocked(elements, !editableBuilder);
    elements.duplicateBtn.classList.remove("hidden");
    elements.testResults.innerHTML = "";
    elements.editor.classList.remove("hidden");
    elements.editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeEditor(elements, ui) {
    ui.editingId = null;
    ui.previewPrompt = null;
    elements.editor.classList.add("hidden");
    elements.testResults.innerHTML = "";
  }

  function setRuleBuilderLocked(elements, locked) {
    elements.join.disabled = locked;
    elements.addConditionBtn.disabled = locked;
    elements.rules.classList.toggle("locked", locked);
    for (const control of elements.rules.querySelectorAll("input, select, button")) control.disabled = locked;
    if (locked && !elements.rules.children.length) {
      elements.rules.innerHTML = '<div class="rule-locked-message">The existing rule remains unchanged.</div>';
    }
  }

  function blankCondition() {
    return { field: "points", operator: "gte", value: 100, value2: 150 };
  }

  function applyNamePreset(elements, ui, preset) {
    const position = validPosition(elements.promptPosition.value);
    const positionName = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" }[position];
    const positionId = position.toLowerCase();
    const presets = {
      "surname-starts": {
        id: `${positionId}_surname_t`,
        label: `${positionName} whose surname starts with T`,
        fail: `That ${positionName.toLowerCase()}'s surname must start with T.`,
        tags: "anti-meta, name-rule, surname, initial",
        difficulty: "medium",
        condition: { field: "surname", operator: "startsWith", value: "T", value2: "" }
      },
      "first-starts": {
        id: `${positionId}_first_name_b`,
        label: `${positionName} whose first name starts with B`,
        fail: `That ${positionName.toLowerCase()}'s first name must start with B.`,
        tags: "anti-meta, name-rule, first-name, initial",
        difficulty: "medium",
        condition: { field: "firstName", operator: "startsWith", value: "B", value2: "" }
      },
      "surname-son": {
        id: `${positionId}_surname_ends_son`,
        label: `${positionName} whose surname ends in “son”`,
        fail: `That ${positionName.toLowerCase()}'s surname must end in “son”.`,
        tags: "anti-meta, name-rule, surname",
        difficulty: "hard",
        condition: { field: "surname", operator: "endsWith", value: "son", value2: "" }
      },
      "same-initials": {
        id: `${positionId}_same_name_initials`,
        label: `${positionName} whose first name and surname start with the same letter`,
        fail: `That ${positionName.toLowerCase()}'s first name and surname must start with the same letter.`,
        tags: "anti-meta, name-rule, initials",
        difficulty: "hard",
        condition: { field: "sameInitials", operator: "isTrue", value: "", value2: "" }
      },
      "hyphenated": {
        id: `${positionId}_hyphenated_surname`,
        label: `${positionName} with a hyphenated surname`,
        fail: `That ${positionName.toLowerCase()} must have a hyphenated surname.`,
        tags: "anti-meta, name-rule, surname, hyphenated",
        difficulty: "hard",
        condition: { field: "hyphenatedSurname", operator: "isTrue", value: "", value2: "" }
      }
    };
    const selected = presets[preset];
    if (!selected) return;

    if (ui.editingId) {
      ui.editingId = null;
      elements.id.disabled = false;
      elements.promptPosition.disabled = false;
      elements.editorTitle.textContent = "Create a custom name prompt";
      elements.duplicateBtn.classList.add("hidden");
    }
    elements.id.value = uniqueId(selected.id);
    elements.label.value = selected.label;
    elements.fail.value = selected.fail;
    elements.promptDifficulty.value = selected.difficulty;
    elements.rating.value = "4";
    elements.cooldown.value = "7";
    elements.tags.value = selected.tags;
    elements.enabled.checked = true;
    elements.join.value = "all";
    elements.rules.innerHTML = "";
    addRuleRow(elements, selected.condition);
    setRuleBuilderLocked(elements, false);
    elements.editorNotice.innerHTML = "Name starter loaded. Change the letter, text or wording, then test it against the full database before saving.";
    elements.testResults.innerHTML = "";
  }

  function availableSeasonLabels() {
    const labels = [...new Set((Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [])
      .flatMap(player => (Array.isArray(player?.seasons) ? player.seasons : []).map(season => String(season?.season || "").trim()))
      .filter(Boolean))];
    return labels.sort((a, b) => {
      const left = Number.parseInt(a.slice(0, 4), 10);
      const right = Number.parseInt(b.slice(0, 4), 10);
      return right - left || b.localeCompare(a);
    });
  }

  function seasonOptions(selectedValue) {
    const labels = availableSeasonLabels();
    const selected = labels.includes(String(selectedValue || "")) ? String(selectedValue) : (labels[0] || "2025/26");
    return labels.map(label => `<option value="${escapeAttribute(label)}" ${label === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
  }

  function availableCareerClubs() {
    const contextClubs = Array.isArray(window.FPL_CAREER_CONTEXT?.players)
      ? window.FPL_CAREER_CONTEXT.players.flatMap(player => Array.isArray(player.clubs) ? player.clubs : [])
      : [];
    const recordClubs = (Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [])
      .flatMap(player => (Array.isArray(player?.seasons) ? player.seasons : []))
      .filter(season => Number(season?.minutes) > 0)
      .map(season => String(season?.club || "").trim());
    return [...new Set([...contextClubs, ...recordClubs].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function clubOptions(selectedValue, excludedValue = "") {
    const clubs = availableCareerClubs();
    const selected = clubs.includes(String(selectedValue || "")) ? String(selectedValue) : (clubs.find(club => club !== excludedValue) || clubs[0] || "");
    return clubs.map(club => `<option value="${escapeAttribute(club)}" ${club === selected ? "selected" : ""}>${escapeHtml(club)}</option>`).join("");
  }

  function normaliseCareerClub(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ø/g, "o").replace(/ł/g, "l").replace(/[đð]/g, "d")
      .replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe")
      .replace(/’/g, "'")
      .replace(/[^a-z0-9'\-]+/g, " ")
      .trim();
  }

  function ensureCareerPlayerDatalist() {
    let datalist = document.querySelector("#careerPlayerOptions");
    if (datalist) return datalist;
    datalist = document.createElement("datalist");
    datalist.id = "careerPlayerOptions";
    const names = [...new Set((window.FPL_CAREER_CONTEXT?.players || []).map(player => player.playerName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    datalist.innerHTML = names.map(name => `<option value="${escapeAttribute(name)}"></option>`).join("");
    document.body.append(datalist);
    return datalist;
  }

  function resolveCareerReference(value) {
    const result = window.FPL_CAREER_CONTEXT?.resolvePlayer?.(String(value || "").trim());
    return result?.ok ? result.player : null;
  }

  function addRuleRow(elements, condition) {
    const row = document.createElement("div");
    row.className = "rule-row";
    row.dataset.value = condition.value ?? "";
    row.dataset.value2 = condition.value2 ?? "";
    row.innerHTML = `
      <select data-rule-field aria-label="Rule field">
        ${Object.entries(FIELD_DEFS).map(([key, definition]) => `<option value="${escapeAttribute(key)}" ${key === condition.field ? "selected" : ""}>${escapeHtml(definition.label)}</option>`).join("")}
      </select>
      <span class="rule-operator-wrap"></span>
      <span class="rule-value-wrap"></span>
      <button class="rule-remove" type="button" data-remove-rule aria-label="Remove condition">Remove</button>`;
    elements.rules.append(row);
    rebuildRuleRow(row, condition);
  }

  function rebuildRuleRow(row, suppliedCondition = null) {
    const field = row.querySelector("[data-rule-field]").value;
    const definition = FIELD_DEFS[field];
    const operatorWrap = row.querySelector(".rule-operator-wrap");
    const valueWrap = row.querySelector(".rule-value-wrap");
    const previousOperator = suppliedCondition?.operator || row.querySelector("[data-rule-operator]")?.value;
    const previousValue = suppliedCondition?.value ?? row.querySelector("[data-rule-value]")?.value ?? row.dataset.value;
    const previousValue2 = suppliedCondition?.value2 ?? row.querySelector("[data-rule-value2]")?.value ?? row.dataset.value2;

    const operatorSet = definition.type === "number"
      ? NUMBER_OPERATORS
      : definition.type === "boolean"
        ? BOOLEAN_OPERATORS
        : definition.type === "season"
          ? SEASON_OPERATORS
          : definition.type === "clubPair"
            ? CLUB_PAIR_OPERATORS
            : definition.type === "playerReference"
              ? PLAYER_REFERENCE_OPERATORS
              : definition.type === "teammateReference"
                ? TEAMMATE_REFERENCE_OPERATORS
              : definition.type === "nameText"
              ? NAME_TEXT_OPERATORS
              : TEXT_OPERATORS;
    const operator = operatorSet[previousOperator] ? previousOperator : Object.keys(operatorSet)[0];
    operatorWrap.innerHTML = `<select data-rule-operator aria-label="Rule operator">${Object.entries(operatorSet).map(([key, label]) => `<option value="${key}" ${key === operator ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;

    if (definition.type === "boolean") {
      valueWrap.innerHTML = '<span class="rule-no-value">No value needed</span>';
    } else if (definition.type === "clubPair") {
      const clubs = availableCareerClubs();
      const firstValue = clubs.includes(String(previousValue || "")) ? String(previousValue) : (clubs[0] || "");
      const secondValue = clubs.includes(String(previousValue2 || "")) && String(previousValue2) !== firstValue
        ? String(previousValue2)
        : (clubs.find(club => club !== firstValue) || firstValue);
      valueWrap.innerHTML = `<select data-rule-value aria-label="First career club">${clubOptions(firstValue)}</select>
        <span class="rule-pair-and">and</span>
        <select data-rule-value2 aria-label="Second career club">${clubOptions(secondValue, firstValue)}</select>`;
    } else if (definition.type === "playerReference" || definition.type === "teammateReference") {
      ensureCareerPlayerDatalist();
      valueWrap.innerHTML = `<input data-rule-value type="text" list="careerPlayerOptions" value="${escapeAttribute(previousValue)}" placeholder="e.g. Mohamed Salah" aria-label="Reference player">`;
    } else if (definition.type === "season") {
      const firstValue = previousValue || availableSeasonLabels()[0] || "2025/26";
      const secondValue = previousValue2 || availableSeasonLabels().at(-1) || firstValue;
      valueWrap.innerHTML = `<select data-rule-value aria-label="Season value">${seasonOptions(firstValue)}</select>
        <select data-rule-value2 class="${operator === "between" ? "" : "hidden"}" aria-label="Second season value">${seasonOptions(secondValue)}</select>`;
      operatorWrap.querySelector("select").addEventListener("change", event => {
        valueWrap.querySelector("[data-rule-value2]").classList.toggle("hidden", event.target.value !== "between");
      });
    } else if (definition.type === "number") {
      valueWrap.innerHTML = `<input data-rule-value type="number" step="any" value="${escapeAttribute(previousValue === "" ? 0 : previousValue)}" aria-label="Rule value">
        <input data-rule-value2 class="${operator === "between" ? "" : "hidden"}" type="number" step="any" value="${escapeAttribute(previousValue2 === "" ? 0 : previousValue2)}" aria-label="Second rule value">`;
      operatorWrap.querySelector("select").addEventListener("change", event => {
        valueWrap.querySelector("[data-rule-value2]").classList.toggle("hidden", event.target.value !== "between");
      });
    } else {
      const placeholder = definition.type === "manager"
        ? "e.g. David Moyes"
        : definition.type === "nameText"
          ? (field.toLowerCase().includes("initial") ? "e.g. M" : "e.g. Smith")
          : "e.g. Everton";
      valueWrap.innerHTML = `<input data-rule-value type="text" value="${escapeAttribute(previousValue)}" placeholder="${placeholder}" aria-label="Rule text value">`;
    }
  }

  function collectEditorPrompt(elements, ui, { preview = false } = {}) {
    const existing = ui.editingId ? library.find(prompt => prompt.id === ui.editingId) : null;
    const id = ui.editingId || slugify(elements.id.value);
    if (!id) throw new Error("Enter a unique prompt ID using letters, numbers, hyphens or underscores.");
    if (!ui.editingId && library.some(prompt => prompt.id === id)) throw new Error("That prompt ID already exists.");
    if (!elements.label.value.trim()) throw new Error("Enter the prompt wording.");
    if (!elements.fail.value.trim()) throw new Error("Enter the invalid-answer message.");

    let studioRule = existing?.studioRule || null;
    let test = existing?.test || null;
    const builderEditable = !existing || existing.studioRule?.kind === "builder";
    if (builderEditable) {
      studioRule = collectRule(elements);
      const source = compileRuleSource(studioRule);
      test = functionFromSource(source);
    }
    if (typeof test !== "function") throw new Error("This prompt does not have a working test rule.");

    return {
      id: preview ? `__preview_${Date.now()}` : id,
      originalId: id,
      position: validPosition(elements.promptPosition.value),
      label: elements.label.value.trim(),
      fail: elements.fail.value.trim(),
      difficulty: validDifficulty(elements.promptDifficulty.value),
      tags: normaliseTags(elements.tags.value),
      rating: clamp(elements.rating.value, 1, 5, 3),
      cooldown: clamp(elements.cooldown.value, 0, 50, 7),
      enabled: elements.enabled.checked,
      studioRule,
      test,
      _studioBuiltIn: existing ? existing._studioBuiltIn : false,
      _studioCustom: existing ? existing._studioCustom : true
    };
  }

  function collectRule(elements) {
    const conditions = [...elements.rules.querySelectorAll(".rule-row")].map(row => {
      const field = row.querySelector("[data-rule-field]")?.value;
      const operator = row.querySelector("[data-rule-operator]")?.value;
      const value = row.querySelector("[data-rule-value]")?.value ?? "";
      const value2 = row.querySelector("[data-rule-value2]")?.value ?? "";
      return { field, operator, value, value2 };
    });
    if (!conditions.length) throw new Error("Add at least one rule condition.");
    if (conditions.length > 6) throw new Error("Use no more than six conditions in one prompt.");
    for (const condition of conditions) validateCondition(condition);
    return { kind: "builder", join: elements.join.value === "any" ? "any" : "all", conditions };
  }

  function validateCondition(condition) {
    const definition = FIELD_DEFS[condition.field];
    if (!definition) throw new Error("One rule uses an unknown field.");
    if (definition.type === "number") {
      if (!Number.isFinite(Number(condition.value))) throw new Error(`${definition.label} needs a number.`);
      if (condition.operator === "between" && !Number.isFinite(Number(condition.value2))) throw new Error(`${definition.label} needs two numbers for a between rule.`);
    }
    if (definition.type === "season") {
      const valid = value => /^\d{4}\/\d{2}$/.test(String(value || ""));
      if (!valid(condition.value)) throw new Error(`${definition.label} needs a valid season such as 2020/21.`);
      if (condition.operator === "between" && !valid(condition.value2)) throw new Error("A between-season rule needs two valid seasons.");
    }
    if (definition.type === "clubPair") {
      const first = String(condition.value || "").trim();
      const second = String(condition.value2 || "").trim();
      if (!first || !second) throw new Error(`${definition.label} needs two clubs.`);
      if (normaliseCareerClub(first) === normaliseCareerClub(second)) throw new Error("Choose two different clubs for a played-for-both rule.");
    }
    if ((definition.type === "playerReference" || definition.type === "teammateReference") && !resolveCareerReference(condition.value)) throw new Error(`${definition.label} needs one unique stored player name.`);
    if ((definition.type === "text" || definition.type === "manager" || definition.type === "nameText") && !String(condition.value).trim()) throw new Error(`${definition.label} needs text.`);
  }

  function previewEditorPrompt(elements, ui, core) {
    try {
      const prompt = collectEditorPrompt(elements, ui, { preview: true });
      ui.previewPrompt = prompt;
      renderPromptTest(elements, prompt, core);
    } catch (error) {
      elements.testResults.innerHTML = `<div class="warning">${escapeHtml(error.message)}</div>`;
    }
  }

  function renderPromptTest(elements, prompt, core) {
    core.invalidatePromptStats?.(prompt.id);
    const stats = core.getPromptStats(prompt);
    const warnings = [];
    if (stats.playerCount < 2) warnings.push("This prompt has fewer than two different valid footballers.");
    else if (stats.playerCount < 6) warnings.push("This is a narrow prompt with fewer than six valid footballers.");
    if (stats.playerCount > 150) warnings.push("This prompt is very broad with more than 150 valid footballers.");
    const answers = stats.topAnswers.length
      ? stats.topAnswers.map(answer => `<li><strong>${escapeHtml(answer.playerName)}</strong><span>${escapeHtml(answer.season)} · ${escapeHtml(answer.club)} · ${answer.points} points</span></li>`).join("")
      : "<li>No valid player-seasons found.</li>";
    elements.testResults.innerHTML = `<div class="prompt-test-summary">
        <div><span>Valid players</span><strong>${stats.playerCount}</strong></div>
        <div><span>Matching seasons</span><strong>${stats.seasonCount}</strong></div>
        <div><span>Best score</span><strong>${stats.bestAnswer?.points ?? 0}</strong></div>
      </div>
      ${warnings.map(message => `<div class="warning">${escapeHtml(message)}</div>`).join("")}
      ${!warnings.length ? '<div class="success-message">The prompt rule runs successfully against the full database.</div>' : ""}
      <ol class="prompt-test-answers">${answers}</ol>`;
    elements.editor.classList.remove("hidden");
    elements.testResults.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function saveEditorPrompt(elements, ui, core) {
    try {
      const candidate = collectEditorPrompt(elements, ui);
      const statsPrompt = { ...candidate, id: `__savecheck_${Date.now()}` };
      const stats = core.getPromptStats(statsPrompt);
      if (stats.playerCount === 0) throw new Error("This prompt has no valid player answers. Adjust the rule before saving.");

      if (ui.editingId) {
        const existing = library.find(prompt => prompt.id === ui.editingId);
        if (!existing) throw new Error("The prompt being edited could not be found.");
        const preservedBuiltIn = existing._studioBuiltIn;
        const preservedCustom = existing._studioCustom;
        Object.assign(existing, candidate, { id: ui.editingId, _studioBuiltIn: preservedBuiltIn, _studioCustom: preservedCustom });
        savePromptToState(existing);
      } else {
        const custom = { ...candidate, _studioBuiltIn: false, _studioCustom: true };
        library.push(custom);
        savePromptToState(custom);
        ui.editingId = custom.id;
      }

      persistState();
      const affectsDraft = Boolean(ui.editingId && core.isPromptSelected?.(ui.editingId));
      core.refreshLibrary?.({ recalculateDraft: affectsDraft });
      renderManagerCounts(elements);
      renderPromptList(elements, ui, core);
      elements.managerStatus.textContent = `${candidate.label} saved in this browser with ${stats.playerCount} valid players.`;
      closeEditor(elements, ui);
    } catch (error) {
      elements.testResults.innerHTML = `<div class="warning">${escapeHtml(error.message)}</div>`;
    }
  }

  function savePromptToState(prompt) {
    if (prompt.studioRule) {
      const serialised = serialisePrompt(prompt);
      const index = state.customs.findIndex(item => item.id === prompt.id);
      if (index >= 0) state.customs[index] = serialised;
      else state.customs.push(serialised);
      state.deletedIds = state.deletedIds.filter(id => id !== prompt.id);
    } else {
      state.overrides[prompt.id] = metadataForStorage(prompt);
    }
  }

  function togglePrompt(prompt, elements, ui, core) {
    prompt.enabled = prompt.enabled === false;
    savePromptToState(prompt);
    persistState();
    core.refreshLibrary?.({ recalculateDraft: Boolean(core.isPromptSelected?.(prompt.id)) });
    renderManagerCounts(elements);
    renderPromptList(elements, ui, core);
    elements.managerStatus.textContent = `${prompt.label} is now ${prompt.enabled ? "enabled" : "disabled"}.`;
  }

  function duplicatePrompt(prompt, elements, ui) {
    const id = uniqueId(`${prompt.id}_copy`);
    const clone = {
      ...prompt,
      id,
      label: `${prompt.label} (copy)`,
      enabled: false,
      studioRule: prompt.studioRule || { kind: "source", source: prompt.test.toString() },
      test: prompt.test,
      _studioBuiltIn: false,
      _studioCustom: true
    };
    library.push(clone);
    savePromptToState(clone);
    persistState();
    openExistingEditor(elements, ui, clone);
    elements.managerStatus.textContent = "A disabled custom copy was created. Review and test it before enabling.";
  }

  function duplicateEditingPrompt(elements, ui) {
    const prompt = ui.editingId ? library.find(item => item.id === ui.editingId) : null;
    if (prompt) duplicatePrompt(prompt, elements, ui);
  }

  function removePromptIds(promptIds, { confirmDelete = false } = {}) {
    const requested = [...new Set((promptIds || []).map(String))];
    const core = window.FPL_STUDIO_API;
    const protectedIds = requested.filter(id => core?.isPromptSelected?.(id));
    const protectedSet = new Set(protectedIds);
    const deletableIds = requested.filter(id => !protectedSet.has(id));
    if (confirmDelete && deletableIds.length) {
      const wording = deletableIds.length === 1 ? "this prompt" : `${deletableIds.length} prompts`;
      if (!window.confirm(`Delete ${wording} from the browser collection? They will also be absent from the next downloaded prompt-library.js.`)) return { deleted: 0, protected: protectedIds.length, cancelled: true };
    }
    let deleted = 0;
    for (const id of deletableIds) {
      const index = library.findIndex(item => String(item.id) === id);
      if (index < 0) continue;
      const prompt = library[index];
      library.splice(index, 1);
      state.customs = state.customs.filter(item => String(item.id) !== id);
      if (baseIds.has(prompt.id) && !state.deletedIds.includes(prompt.id)) state.deletedIds.push(prompt.id);
      delete state.overrides[prompt.id];
      deleted += 1;
    }
    if (deleted) {
      persistState();
      core?.refreshLibrary?.({ recalculateDraft: false });
    }
    return { deleted, protected: protectedIds.length, cancelled: false };
  }

  function deletePrompt(prompt, elements, ui, core) {
    if (core.isPromptSelected?.(prompt.id)) {
      elements.managerStatus.textContent = "That prompt is in the current draft. Reroll it before deleting it.";
      return;
    }
    const result = removePromptIds([prompt.id], { confirmDelete: true });
    if (!result.deleted) return;
    renderManagerCounts(elements);
    renderPromptList(elements, ui, core);
    elements.managerStatus.textContent = `${prompt.label} was deleted from this browser collection. Download prompt-library.js when you are ready to make it permanent.`;
  }

  function downloadPromptLibrary(elements) {
    const source = buildLibrarySource();
    downloadText("prompt-library.js", source, "text/javascript;charset=utf-8");
    elements.managerStatus.textContent = "prompt-library.js downloaded. Replace only that file in GitHub after keeping a backup.";
  }

  function buildLibrarySource() {
    const promptsSource = library.map(prompt => {
      const testSource = prompt.test.toString();
      const studioRule = prompt.studioRule ? `,
      studioRule: ${JSON.stringify(prompt.studioRule, null, 6).replace(/\n/g, "\n      ")}` : "";
      return `    {
      id: ${JSON.stringify(prompt.id)},
      position: ${JSON.stringify(prompt.position)},
      label: ${JSON.stringify(prompt.label)},
      fail: ${JSON.stringify(prompt.fail)},
      difficulty: ${JSON.stringify(prompt.difficulty)},
      tags: ${JSON.stringify(prompt.tags || [])},
      rating: ${Number(prompt.rating) || 3},
      cooldown: ${Number(prompt.cooldown) || 0},
      enabled: ${prompt.enabled !== false}${studioRule},
      test: ${testSource}
    }`;
    }).join(",\n");

    return `/* FPL Challenge Studio prompt library — exported by Phase 5.
   Disabled prompts remain stored but are ignored by the generator. */
(() => {
  "use strict";

  window.FPL_PROMPT_LIBRARY = [
${promptsSource}
  ];

  window.FPL_RECENT_PROMPT_IDS = ${JSON.stringify(Array.isArray(window.FPL_RECENT_PROMPT_IDS) ? window.FPL_RECENT_PROMPT_IDS : [], null, 2)};
})();
`;
  }

  function downloadManagerBackup(elements) {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      state
    };
    downloadText("fpl-prompt-manager-backup.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    elements.managerStatus.textContent = "Prompt Manager browser changes downloaded as a JSON backup.";
  }

  async function importManagerBackup(event, elements) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = parsed.state || parsed;
      if (!incoming || !Array.isArray(incoming.customs) || typeof incoming.overrides !== "object") throw new Error("This is not a valid Prompt Manager backup.");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
      elements.managerStatus.textContent = "Backup imported. Reloading the studio to apply it…";
      window.location.reload();
    } catch (error) {
      elements.managerStatus.textContent = `Backup could not be imported: ${error.message}`;
    }
  }

  function resetManagerChanges(elements) {
    if (!window.confirm("Reset all browser-only prompt edits, custom prompts and disabled states? Your uploaded prompt-library.js will not be changed.")) return;
    localStorage.removeItem(STORAGE_KEY);
    elements.managerStatus.textContent = "Browser-only prompt changes cleared. Reloading…";
    window.location.reload();
  }

  function metadataForStorage(prompt) {
    return {
      label: prompt.label,
      fail: prompt.fail,
      difficulty: prompt.difficulty,
      tags: [...(prompt.tags || [])],
      rating: prompt.rating,
      cooldown: prompt.cooldown,
      enabled: prompt.enabled !== false
    };
  }

  function serialisePrompt(prompt) {
    return {
      id: prompt.id,
      position: prompt.position,
      label: prompt.label,
      fail: prompt.fail,
      difficulty: prompt.difficulty,
      tags: [...(prompt.tags || [])],
      rating: prompt.rating,
      cooldown: prompt.cooldown,
      enabled: prompt.enabled !== false,
      studioRule: prompt.studioRule,
      testSource: prompt.test.toString()
    };
  }

  function applyMetadata(prompt, metadata) {
    if (typeof metadata.label === "string") prompt.label = metadata.label;
    if (typeof metadata.fail === "string") prompt.fail = metadata.fail;
    if (["easy", "medium", "hard"].includes(metadata.difficulty)) prompt.difficulty = metadata.difficulty;
    if (Array.isArray(metadata.tags)) prompt.tags = normaliseTags(metadata.tags);
    if (metadata.rating != null) prompt.rating = clamp(metadata.rating, 1, 5, prompt.rating || 3);
    if (metadata.cooldown != null) prompt.cooldown = clamp(metadata.cooldown, 0, 50, prompt.cooldown ?? 7);
    if (typeof metadata.enabled === "boolean") prompt.enabled = metadata.enabled;
  }

  function persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function compileRuleSource(rule) {
    const joiner = rule.join === "any" ? " || " : " && ";
    const usesNameData = rule.conditions.some(condition => isNameField(condition.field));
    const expressions = rule.conditions.map(conditionToExpression);
    const result = expressions.length > 1 ? `(${expressions.join(joiner)})` : expressions[0] || "false";
    if (!usesNameData) return `p => ${result}`;

    return String.raw`p => {
      const __rawName = String(p.name || p.playerName || "").trim();
      const __normaliseName = value => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ø/g, "o").replace(/ł/g, "l").replace(/[đð]/g, "d")
        .replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe")
        .replace(/’/g, "'")
        .replace(/[^a-z0-9'\-]+/g, " ")
        .trim();
      const __fullName = __normaliseName(__rawName);
      const __nameTokens = __fullName.split(/\s+/).filter(Boolean);
      const __firstName = __nameTokens[0] || "";
      const __surnameParticles = new Set(["al", "ap", "bin", "bint", "da", "das", "de", "del", "della", "den", "der", "di", "dos", "du", "el", "la", "le", "van", "von", "y"]);
      let __surnameStart = Math.max(0, __nameTokens.length - 1);
      while (__surnameStart > 0 && __surnameParticles.has(__nameTokens[__surnameStart - 1])) __surnameStart -= 1;
      const __surname = __nameTokens.slice(__surnameStart).join(" ");
      const __firstInitial = __firstName.charAt(0);
      const __surnameInitial = __surname.charAt(0);
      const __letterCount = value => String(value || "").replace(/[^a-z0-9]/g, "").length;
      return ${result};
    }`;
  }

  function isNameField(field) {
    return [
      "fullName", "firstName", "surname", "firstInitial", "surnameInitial",
      "fullNameLength", "firstNameLength", "surnameLength", "nameWordCount",
      "hyphenatedSurname", "sameInitials", "singleWordName"
    ].includes(field);
  }

  function conditionToExpression(condition) {
    const definition = FIELD_DEFS[condition.field];
    const accessor = numericAccessor(condition.field);
    if (definition.type === "season") {
      const current = `Number.parseInt(String(p.season || "").slice(0, 4), 10)`;
      const firstLabel = String(condition.value || "");
      const secondLabel = String(condition.value2 || "");
      const first = Number.parseInt(firstLabel.slice(0, 4), 10);
      const second = Number.parseInt(secondLabel.slice(0, 4), 10);
      if (condition.operator === "equals") return `String(p.season || "") === ${JSON.stringify(firstLabel)}`;
      if (condition.operator === "before") return `(Number.isFinite(${current}) && ${current} < ${first})`;
      if (condition.operator === "after") return `(Number.isFinite(${current}) && ${current} > ${first})`;
      if (condition.operator === "between") {
        const low = Math.min(first, second);
        const high = Math.max(first, second);
        return `(Number.isFinite(${current}) && ${current} >= ${low} && ${current} <= ${high})`;
      }
      return "false";
    }
    if (definition.type === "clubPair") {
      const first = JSON.stringify(normaliseCareerClub(condition.value));
      const second = JSON.stringify(normaliseCareerClub(condition.value2));
      return `(Array.isArray(p._career?.normalisedClubs) && p._career.normalisedClubs.includes(${first}) && p._career.normalisedClubs.includes(${second}))`;
    }
    if (definition.type === "playerReference") {
      const reference = resolveCareerReference(condition.value);
      if (!reference) return "false";
      const anchorId = JSON.stringify(reference.playerId);
      return `(() => { const __anchor = window.FPL_CAREER_CONTEXT?.getPlayer?.(${anchorId}); return p.playerId !== ${anchorId} && Array.isArray(p._career?.seasonYears) && Array.isArray(__anchor?.seasonYears) && p._career.seasonYears.some(year => __anchor.seasonYears.includes(year)); })()`;
    }
    if (definition.type === "teammateReference") {
      const reference = resolveCareerReference(condition.value);
      if (!reference) return "false";
      const anchorId = JSON.stringify(reference.playerId);
      return `(() => { const __anchor = window.FPL_CAREER_CONTEXT?.getPlayer?.(${anchorId}); const __clubKey = window.FPL_CAREER_CONTEXT?.normalise?.(p.club) || ""; const __key = String(p.season || "") + "|" + __clubKey; return p.playerId !== ${anchorId} && Number(p.minutes) > 0 && Array.isArray(__anchor?.clubSeasonKeys) && __anchor.clubSeasonKeys.includes(__key); })()`;
    }
    if (definition.type === "number") {
      const value = Number(condition.value);
      const value2 = Number(condition.value2);
      const finite = `Number.isFinite(${accessor})`;
      if (condition.operator === "gte") return `(${finite} && ${accessor} >= ${value})`;
      if (condition.operator === "lte") return `(${finite} && ${accessor} <= ${value})`;
      if (condition.operator === "eq") return `(${finite} && ${accessor} === ${value})`;
      if (condition.operator === "gt") return `(${finite} && ${accessor} > ${value})`;
      if (condition.operator === "lt") return `(${finite} && ${accessor} < ${value})`;
      if (condition.operator === "between") {
        const low = Math.min(value, value2);
        const high = Math.max(value, value2);
        return `(${finite} && ${accessor} >= ${low} && ${accessor} <= ${high})`;
      }
    }

    if (definition.type === "boolean") {
      let expression;
      if (condition.field === "outsideBigSix") expression = `!${JSON.stringify(BIG_SIX)}.includes(p.club)`;
      else if (condition.field === "assistsMoreThanGoals") expression = `p.assists > p.goals`;
      else if (condition.field === "returnedToFormerClub") expression = `p._career?.returnedToFormerClub === true`;
      else if (condition.field === "hyphenatedSurname") expression = `__surname.includes("-")`;
      else if (condition.field === "sameInitials") expression = `(__nameTokens.length > 1 && Boolean(__firstInitial) && __firstInitial === __surnameInitial)`;
      else if (condition.field === "singleWordName") expression = `__nameTokens.length === 1`;
      else expression = `p.${condition.field} === true`;
      return condition.operator === "isFalse" ? `!(${expression})` : `(${expression})`;
    }

    if (definition.type === "nameText") {
      const value = JSON.stringify(normaliseNameLiteral(condition.value));
      const nameAccessor = {
        fullName: "__fullName",
        firstName: "__firstName",
        surname: "__surname",
        firstInitial: "__firstInitial",
        surnameInitial: "__surnameInitial"
      }[condition.field] || "__fullName";
      if (condition.operator === "notEquals") return `${nameAccessor} !== ${value}`;
      if (condition.operator === "startsWith") return `${nameAccessor}.startsWith(${value})`;
      if (condition.operator === "endsWith") return `${nameAccessor}.endsWith(${value})`;
      if (condition.operator === "contains") return `${nameAccessor}.includes(${value})`;
      return `${nameAccessor} === ${value}`;
    }

    const value = JSON.stringify(String(condition.value).trim());
    if (definition.type === "manager") {
      const equals = `(Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === ${value}.toLowerCase()))`;
      if (condition.operator === "notEquals") return `!${equals}`;
      if (condition.operator === "contains") return `(Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase().includes(${value}.toLowerCase())))`;
      return equals;
    }

    if (condition.operator === "notEquals") return `String(p.club || "").toLowerCase() !== ${value}.toLowerCase()`;
    if (condition.operator === "contains") return `String(p.club || "").toLowerCase().includes(${value}.toLowerCase())`;
    return `String(p.club || "").toLowerCase() === ${value}.toLowerCase()`;
  }

  function numericAccessor(field) {
    if (field === "goalInvolvements") return `(p.goals + p.assists)`;
    if (field === "fullNameLength") return `__letterCount(__fullName)`;
    if (field === "firstNameLength") return `__letterCount(__firstName)`;
    if (field === "surnameLength") return `__letterCount(__surname)`;
    if (field === "nameWordCount") return `__nameTokens.length`;
    if (field === "careerSeasonCount") return `Number(p._career?.seasonCount)`;
    if (field === "careerClubCount") return `Number(p._career?.clubCount)`;
    return `p.${field}`;
  }

  function normaliseNameLiteral(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ø/g, "o").replace(/ł/g, "l").replace(/[đð]/g, "d")
      .replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe")
      .replace(/’/g, "'")
      .replace(/[^a-z0-9'\-]+/g, " ")
      .trim();
  }

  function functionFromSource(source) {
    try {
      const fn = Function(`"use strict"; return (${source});`)();
      if (typeof fn !== "function") throw new Error("Rule source did not create a function.");
      return fn;
    } catch (error) {
      console.warn("A stored custom prompt rule could not be compiled.", error);
      return () => false;
    }
  }

  function normaliseStudioRule(rule) {
    if (rule?.kind === "builder" && Array.isArray(rule.conditions)) {
      return {
        kind: "builder",
        join: rule.join === "any" ? "any" : "all",
        conditions: rule.conditions.map(condition => ({
          field: FIELD_DEFS[condition.field] ? condition.field : "points",
          operator: String(condition.operator || "gte"),
          value: condition.value ?? 0,
          value2: condition.value2 ?? 0
        }))
      };
    }
    return { kind: "source", source: String(rule?.source || "p => false") };
  }

  function normaliseTags(value) {
    const source = Array.isArray(value) ? value : String(value || "").split(",");
    return [...new Set(source.map(tag => String(tag).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  }

  function validPosition(value) {
    return ["GK", "DEF", "MID", "FWD"].includes(value) ? value : "GK";
  }

  function validDifficulty(value) {
    return ["easy", "medium", "hard"].includes(value) ? value : "medium";
  }

  function uniqueId(base) {
    let id = slugify(base) || "custom_prompt";
    let suffix = 2;
    while (library.some(prompt => prompt.id === id)) id = `${slugify(base)}_${suffix++}`;
    return id;
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback;
  }

  function formatChallengeDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return String(value || "Challenge");
    const [, year, month, day] = match;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12)));
  }

  function capitalise(value) {
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  window.FPL_PROMPT_MANAGER_API = Object.freeze({
    deletePrompts: promptIds => removePromptIds(promptIds, { confirmDelete: false }),
    getDeletedIds: () => state.deletedIds.slice()
  });
})();

/* ===== END admin-phase5.js ===== */

/* ===== BEGIN admin.js ===== */
(() => {
  "use strict";

  const FORMATION = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD"];
  const DIFFICULTY_VALUE = { easy: 1, medium: 2, hard: 3 };
  const DIVERSITY_TAGS = new Set([
    "relegated", "promoted", "bottom-half", "mid-table", "survival",
    "outside-big-six", "outside-top-four", "manager", "budget", "young", "exact-stat", "name-rule", "surname", "first-name"
  ]);
  const STORAGE_KEY = "fplChallengeStudioPhase5Draft";
  const LEGACY_STORAGE_KEYS = ["fplChallengeStudioPhase4Draft", "fplChallengeStudioPhase3Draft", "fplChallengeStudioPhase2Draft", "fplChallengeStudioPhase1Draft"];
  const FORBIDDEN_COST = 1_000_000;

  const elements = {
    dbStatus: document.querySelector("#dbStatus"),
    libraryStatus: document.querySelector("#libraryStatus"),
    challengeNumber: document.querySelector("#challengeNumber"),
    challengeName: document.querySelector("#challengeName"),
    difficultyTarget: document.querySelector("#difficultyTarget"),
    releaseDate: document.querySelector("#releaseDate"),
    minAnswers: document.querySelector("#minAnswers"),
    maxAnswers: document.querySelector("#maxAnswers"),
    maxPerfectScore: document.querySelector("#maxPerfectScore"),
    minAntiMeta: document.querySelector("#minAntiMeta"),
    avoidRecent: document.querySelector("#avoidRecent"),
    cooldownChallenges: document.querySelector("#cooldownChallenges"),
    generateBtn: document.querySelector("#generateBtn"),
    saveDraftBtn: document.querySelector("#saveDraftBtn"),
    loadDraftBtn: document.querySelector("#loadDraftBtn"),
    actionStatus: document.querySelector("#actionStatus"),
    draftPanel: document.querySelector("#draftPanel"),
    draftSummary: document.querySelector("#draftSummary"),
    warnings: document.querySelector("#warnings"),
    perfectScore: document.querySelector("#perfectScore"),
    perfectComparison: document.querySelector("#perfectComparison"),
    perfectXI: document.querySelector("#perfectXI"),
    promptSlots: document.querySelector("#promptSlots"),
    codePanel: document.querySelector("#codePanel"),
    codeOutput: document.querySelector("#codeOutput"),
    downloadBtn: document.querySelector("#downloadBtn"),
    copyCodeBtn: document.querySelector("#copyCodeBtn"),
    copyStatus: document.querySelector("#copyStatus")
  };

  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const promptLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const recentPromptIds = new Set(Array.isArray(window.FPL_RECENT_PROMPT_IDS) ? window.FPL_RECENT_PROMPT_IDS : []);
  const records = [];
  const statsCache = new Map();
  let selectedPrompts = [];
  let currentPerfect = null;

  for (const player of players) {
    for (const season of player.seasons || []) {
      records.push({
        ...season,
        playerId: player.playerId,
        playerName: player.name
      });
    }
  }

  initialise();

  function initialise() {
    setDefaultReleaseDate();
    updateStatusCards();
    bindEvents();

    if (!players.length || !promptLibrary.length) {
      elements.generateBtn.disabled = true;
      elements.actionStatus.textContent = !players.length
        ? "The studio cannot find players.js. Keep admin.html beside the existing players.js file."
        : "The prompt library failed to load.";
      return;
    }

    for (const prompt of promptLibrary) getPromptStats(prompt);
    updateLibraryStatus("checked");
    elements.actionStatus.textContent = "Ready. Generate a draft; the live game will not be changed.";
  }

  function bindEvents() {
    elements.generateBtn.addEventListener("click", generateDraft);
    elements.saveDraftBtn.addEventListener("click", saveDraft);
    elements.loadDraftBtn.addEventListener("click", loadDraft);
    elements.downloadBtn.addEventListener("click", downloadChallengeFile);
    elements.copyCodeBtn.addEventListener("click", copyChallengeCode);

    for (const input of [
      elements.challengeNumber,
      elements.challengeName,
      elements.difficultyTarget,
      elements.releaseDate,
      elements.minAnswers,
      elements.maxAnswers,
      elements.maxPerfectScore,
      elements.minAntiMeta,
      elements.cooldownChallenges,
      elements.avoidRecent
    ]) {
      input.addEventListener("change", () => {
        if (selectedPrompts.length) refreshDraft();
      });
    }
  }

  function setDefaultReleaseDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    elements.releaseDate.value = localDate.toISOString().slice(0, 10);
  }

  function updateStatusCards() {
    elements.dbStatus.textContent = players.length
      ? `${players.length.toLocaleString()} players · ${records.length.toLocaleString()} seasons`
      : "Not found";
    elements.libraryStatus.textContent = promptLibrary.length
      ? `${promptLibrary.filter(prompt => prompt.enabled !== false).length} enabled · ${promptLibrary.length} total loading…`
      : "Not found";
  }

  function updateLibraryStatus(suffix = "") {
    const enabledCount = promptLibrary.filter(prompt => prompt.enabled !== false).length;
    const customCount = promptLibrary.filter(prompt => prompt.studioRule).length;
    const pieces = [`${enabledCount} enabled`, `${promptLibrary.length} total`];
    if (customCount) pieces.push(`${customCount} custom`);
    if (suffix) pieces.push(suffix);
    elements.libraryStatus.textContent = pieces.join(" · ");
  }

  function getPromptStats(prompt) {
    if (statsCache.has(prompt.id)) return statsCache.get(prompt.id);

    const matches = [];
    for (const record of records) {
      if (record.position !== prompt.position) continue;
          if (Number(record?.minutes) <= 0) continue;
      try {
        if (prompt.test(record)) matches.push(record);
      } catch (error) {
        console.warn(`Prompt ${prompt.id} failed while checking a record.`, error);
      }
    }

    const bestByPlayer = new Map();
    for (const match of matches) {
      const previous = bestByPlayer.get(match.playerId);
      if (
        !previous ||
        match.points > previous.points ||
        (match.points === previous.points && seasonSortValue(match.season) > seasonSortValue(previous.season))
      ) {
        bestByPlayer.set(match.playerId, match);
      }
    }

    const allBestAnswers = [...bestByPlayer.values()]
      .sort((a, b) => b.points - a.points || a.playerName.localeCompare(b.playerName));

    const stats = {
      playerCount: bestByPlayer.size,
      seasonCount: matches.length,
      bestByPlayer,
      bestAnswer: allBestAnswers[0] || null,
      topAnswers: allBestAnswers.slice(0, 5)
    };
    statsCache.set(prompt.id, stats);
    return stats;
  }

  function currentSettings() {
    const minAnswers = clampNumber(elements.minAnswers.value, 2, 300, 6);
    const maxAnswers = clampNumber(elements.maxAnswers.value, minAnswers, 500, 100);
    const minAntiMeta = clampNumber(elements.minAntiMeta.value, 0, 11, 5);
    const maxPerfectScore = clampNumber(elements.maxPerfectScore?.value, 0, 5000, 0);
    return {
      minAnswers,
      maxAnswers,
      minAntiMeta,
      maxPerfectScore,
      avoidRecent: elements.avoidRecent.checked,
      difficultyTarget: elements.difficultyTarget.value,
      cooldownChallenges: clampNumber(elements.cooldownChallenges?.value, 1, 50, 7)
    };
  }
  function eligiblePrompts(position, settings, excludedIds = new Set()) {
    return promptLibrary.filter(prompt => {
      if (prompt.enabled === false) return false;
      if (prompt.position !== position || excludedIds.has(prompt.id)) return false;
      if (settings.avoidRecent) {
        const phase3Cooldown = window.FPL_STUDIO_PHASE3?.getCooldownPromptIds?.();
        const blockedByHistory = phase3Cooldown instanceof Set && phase3Cooldown.has(prompt.id);
        const blockedByBaseline = !(phase3Cooldown instanceof Set) && recentPromptIds.has(prompt.id);
        if (blockedByHistory || blockedByBaseline) return false;
      }
      const count = getPromptStats(prompt).playerCount;
      return count >= settings.minAnswers && count <= settings.maxAnswers;
    });
  }

  async function generateDraft() {
    const settings = currentSettings();
    const capEnabled = settings.maxPerfectScore > 0;
    elements.generateBtn.disabled = true;
    elements.actionStatus.textContent = capEnabled
      ? `Generating candidates and checking exact perfect scores against ${settings.maxPerfectScore.toLocaleString()}…`
      : "Generating and checking prompt balance…";

    try {
      const positionAvailability = Object.fromEntries(
        ["GK", "DEF", "MID", "FWD"].map(position => [position, eligiblePrompts(position, settings).length])
      );
      const required = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
      const missing = Object.keys(required).filter(position => positionAvailability[position] < required[position]);
      if (missing.length) {
        elements.actionStatus.textContent = `Not enough eligible ${missing.join(", ")} prompts. Increase the maximum answers, lower the minimum, or allow recent prompts.`;
        return;
      }

      const candidates = [];
      const signatures = new Set();
      for (let attempt = 0; attempt < 1400; attempt += 1) {
        const used = new Set();
        const candidate = [];
        for (const position of FORMATION) {
          const options = eligiblePrompts(position, settings, used);
          const choice = weightedPick(options, candidate, settings);
          if (!choice) break;
          candidate.push(choice);
          used.add(choice.id);
        }
        if (candidate.length !== 11) continue;
        const signature = candidate.map(prompt => prompt.id).join("|");
        if (signatures.has(signature)) continue;
        signatures.add(signature);
        candidates.push({ prompts: candidate, balance: scoreDraft(candidate, settings) });
      }
      candidates.sort((a, b) => a.balance - b.balance);
      if (!candidates.length) {
        elements.actionStatus.textContent = "A complete XI could not be generated with those restrictions.";
        return;
      }

      let chosen = candidates[0];
      let chosenPerfect = null;
      let lowestChecked = Number.POSITIVE_INFINITY;
      if (capEnabled) {
        chosen = null;
        const checks = candidates.slice(0, Math.min(180, candidates.length));
        for (let index = 0; index < checks.length; index += 1) {
          const item = checks[index];
          const perfect = calculatePerfectXI(item.prompts);
          if (perfect?.possible) {
            lowestChecked = Math.min(lowestChecked, perfect.score);
            if (perfect.score <= settings.maxPerfectScore) {
              chosen = item;
              chosenPerfect = perfect;
              break;
            }
          }
          if (index % 8 === 7) {
            elements.actionStatus.textContent = `Checking exact scores ${index + 1}/${checks.length} · lowest so far ${Number.isFinite(lowestChecked) ? lowestChecked.toLocaleString() : "—"}`;
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        if (!chosen) {
          elements.actionStatus.textContent = `No checked draft met the ${settings.maxPerfectScore.toLocaleString()} ceiling. The lowest exact score found was ${Number.isFinite(lowestChecked) ? lowestChecked.toLocaleString() : "unavailable"}. Raise the ceiling or adjust the prompt limits.`;
          return;
        }
      }

      selectedPrompts = chosen.prompts;
      currentPerfect = chosenPerfect || calculatePerfectXI(selectedPrompts);
      elements.draftPanel.classList.remove("hidden");
      elements.codePanel.classList.remove("hidden");
      elements.saveDraftBtn.disabled = false;
      renderDraft();
      updateCodeOutput();
      document.dispatchEvent(new CustomEvent("fplstudio:draftchange", {
        detail: { promptIds: selectedPrompts.map(prompt => prompt.id), perfectScore: currentPerfect?.possible ? currentPerfect.score : 0 }
      }));
      elements.actionStatus.textContent = capEnabled
        ? `Draft generated at ${currentPerfect.score.toLocaleString()} — within the ${settings.maxPerfectScore.toLocaleString()} maximum.`
        : "Draft generated. The exact unique-player perfect score has been calculated.";
      elements.draftPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      elements.generateBtn.disabled = false;
    }
  }
  function weightedPick(options, currentDraft, settings) {
    if (!options.length) return null;
    const target = difficultyTargetValue(settings.difficultyTarget);
    const currentAnti = currentDraft.filter(isAntiMeta).length;
    const antiNeeded = Math.max(0, settings.minAntiMeta - currentAnti);
    const remainingSlots = 11 - currentDraft.length;

    const weighted = options.map(prompt => {
      const difficultyDistance = Math.abs(DIFFICULTY_VALUE[prompt.difficulty] - target);
      let weight = Math.max(1, prompt.rating || 3) * (1 / (1 + difficultyDistance));
      if (antiNeeded >= remainingSlots && isAntiMeta(prompt)) weight *= 8;
      else if (antiNeeded > 0 && isAntiMeta(prompt)) weight *= 2;

      const tagsAlreadyUsed = new Set(currentDraft.flatMap(item => item.tags.filter(tag => DIVERSITY_TAGS.has(tag))));
      const repeatedThemeCount = prompt.tags.filter(tag => DIVERSITY_TAGS.has(tag) && tagsAlreadyUsed.has(tag)).length;
      weight /= 1 + repeatedThemeCount * 1.6;
      return { prompt, weight };
    });

    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * total;
    for (const item of weighted) {
      random -= item.weight;
      if (random <= 0) return item.prompt;
    }
    return weighted[weighted.length - 1].prompt;
  }

  function scoreDraft(draft, settings) {
    let score = 0;
    const target = difficultyTargetValue(settings.difficultyTarget);
    const averageDifficulty = draft.reduce((sum, prompt) => sum + DIFFICULTY_VALUE[prompt.difficulty], 0) / draft.length;
    score += Math.abs(averageDifficulty - target) * 20;

    const antiCount = draft.filter(isAntiMeta).length;
    if (antiCount < settings.minAntiMeta) score += (settings.minAntiMeta - antiCount) * 150;

    const tagCounts = new Map();
    for (const prompt of draft) {
      for (const tag of prompt.tags) {
        if (!DIVERSITY_TAGS.has(tag)) continue;
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
      const answerCount = getPromptStats(prompt).playerCount;
      score += Math.abs(Math.log(Math.max(answerCount, 1)) - Math.log(25)) * .8;
    }
    for (const count of tagCounts.values()) {
      if (count > 2) score += (count - 2) * 14;
    }

    return score + Math.random() * .25;
  }

  function refreshDraft() {
    currentPerfect = calculatePerfectXI(selectedPrompts);
    renderDraft();
    updateCodeOutput();
    document.dispatchEvent(new CustomEvent("fplstudio:draftchange", {
      detail: {
        promptIds: selectedPrompts.map(prompt => prompt.id),
        perfectScore: currentPerfect?.possible ? currentPerfect.score : 0
      }
    }));
  }

  function calculatePerfectXI(prompts) {
    if (prompts.length !== 11) return { possible: false, reason: "The draft does not contain eleven prompts." };

    const playerIdSet = new Set();
    for (const prompt of prompts) {
      for (const playerId of getPromptStats(prompt).bestByPlayer.keys()) playerIdSet.add(playerId);
    }
    const playerIds = [...playerIdSet];
    if (playerIds.length < prompts.length) {
      return { possible: false, reason: "There are not enough different valid footballers to complete the XI." };
    }

    let maximumPoints = 0;
    for (const prompt of prompts) {
      const best = getPromptStats(prompt).bestAnswer;
      if (best) maximumPoints = Math.max(maximumPoints, best.points);
    }

    const recordsBySlot = prompts.map(prompt => {
      const bestByPlayer = getPromptStats(prompt).bestByPlayer;
      return playerIds.map(playerId => bestByPlayer.get(playerId) || null);
    });

    const costs = recordsBySlot.map(row => {
      const values = new Float64Array(playerIds.length);
      for (let column = 0; column < playerIds.length; column += 1) {
        const record = row[column];
        values[column] = record ? maximumPoints - record.points : FORBIDDEN_COST;
      }
      return values;
    });

    const assignment = hungarianMinimumAssignment(costs);
    if (!assignment) return { possible: false, reason: "The score optimiser could not complete the matching." };

    const picks = assignment.map((column, slotIndex) => {
      const record = recordsBySlot[slotIndex][column];
      return record ? { prompt: prompts[slotIndex], record, slotIndex } : null;
    });
    if (picks.some(pick => !pick)) {
      return { possible: false, reason: "No valid eleven-player assignment exists for these prompts." };
    }

    const score = picks.reduce((sum, pick) => sum + pick.record.points, 0);
    const naiveScore = prompts.reduce((sum, prompt) => sum + (getPromptStats(prompt).bestAnswer?.points || 0), 0);
    return {
      possible: true,
      score,
      naiveScore,
      uniquenessCost: naiveScore - score,
      picks
    };
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
      const minValue = new Float64Array(columnCount + 1);
      minValue.fill(Number.POSITIVE_INFINITY);
      const used = new Uint8Array(columnCount + 1);

      do {
        used[column0] = 1;
        const row0 = p[column0];
        let delta = Number.POSITIVE_INFINITY;
        let column1 = 0;

        for (let column = 1; column <= columnCount; column += 1) {
          if (used[column]) continue;
          const current = costs[row0 - 1][column - 1] - u[row0] - v[column];
          if (current < minValue[column]) {
            minValue[column] = current;
            way[column] = column0;
          }
          if (minValue[column] < delta) {
            delta = minValue[column];
            column1 = column;
          }
        }

        if (!Number.isFinite(delta)) return null;
        for (let column = 0; column <= columnCount; column += 1) {
          if (used[column]) {
            u[p[column]] += delta;
            v[column] -= delta;
          } else {
            minValue[column] -= delta;
          }
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
    for (let column = 1; column <= columnCount; column += 1) {
      if (p[column] !== 0) assignment[p[column] - 1] = column - 1;
    }
    return [...assignment];
  }

  function renderDraft() {
    elements.promptSlots.innerHTML = "";
    const perfectPicks = currentPerfect?.possible ? currentPerfect.picks : [];

    selectedPrompts.forEach((prompt, index) => {
      const stats = getPromptStats(prompt);
      const perfectPick = perfectPicks[index]?.record || null;
      const card = document.createElement("article");
      card.className = "prompt-card";

      const head = document.createElement("div");
      head.className = "prompt-card-head";
      head.innerHTML = `
        <span class="position-badge">${escapeHtml(prompt.position)}</span>
        <div>
          <h3>${index + 1}. ${escapeHtml(prompt.label)}</h3>
          <p class="prompt-meta">${capitalise(prompt.difficulty)} · Rating ${prompt.rating}/5 · ${stats.seasonCount} matching player-seasons</p>
        </div>
        <span class="count-chip">${stats.playerCount} valid players</span>
      `;

      const controls = document.createElement("div");
      controls.className = "prompt-controls";
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Change prompt ${index + 1}`);
      populatePromptSelect(select, prompt, index);
      select.addEventListener("change", event => {
        const replacement = promptLibrary.find(item => item.id === event.target.value);
        if (!replacement) return;
        selectedPrompts[index] = replacement;
        refreshDraft();
      });

      const reroll = document.createElement("button");
      reroll.type = "button";
      reroll.className = "reroll-button";
      reroll.textContent = "Reroll this slot";
      reroll.addEventListener("click", () => rerollSlot(index));
      controls.append(select, reroll);

      const insights = document.createElement("div");
      insights.className = "answer-insights";
      insights.innerHTML = `
        <div>
          <span>Best individual answer</span>
          <strong>${formatAnswer(stats.bestAnswer)}</strong>
        </div>
        <div>
          <span>Perfect-XI selection</span>
          <strong>${formatAnswer(perfectPick)}</strong>
        </div>
      `;

      const tags = document.createElement("div");
      tags.className = "tags";
      for (const tagName of prompt.tags) {
        const tag = document.createElement("span");
        tag.className = `tag${tagName === "anti-meta" ? " anti" : ""}`;
        tag.textContent = tagName;
        tags.append(tag);
      }

      const answers = document.createElement("details");
      answers.className = "sample-answer";
      const answerItems = stats.topAnswers.length
        ? stats.topAnswers.map(answer => `<li>${escapeHtml(answer.playerName)} — ${escapeHtml(answer.season)}, ${escapeHtml(answer.club)} · ${answer.points} pts</li>`).join("")
        : "<li>No examples found.</li>";
      answers.innerHTML = `<summary>Show five high-scoring valid examples</summary><ol>${answerItems}</ol>`;

      card.append(head, controls, insights, tags, answers);
      elements.promptSlots.append(card);
    });

    renderPerfectXI();
    renderSummaryAndWarnings();
  }

  function renderPerfectXI() {
    elements.perfectXI.innerHTML = "";
    if (!currentPerfect?.possible) {
      elements.perfectScore.textContent = "Unavailable";
      elements.perfectComparison.textContent = currentPerfect?.reason || "No score has been calculated.";
      const item = document.createElement("li");
      item.textContent = currentPerfect?.reason || "No valid XI.";
      elements.perfectXI.append(item);
      return;
    }

    elements.perfectScore.textContent = currentPerfect.score.toLocaleString();
    elements.perfectComparison.textContent = currentPerfect.uniquenessCost > 0
      ? `Individual maxima total ${currentPerfect.naiveScore.toLocaleString()}; unique-player rule costs ${currentPerfect.uniquenessCost} points.`
      : `Matches the individual maximum of ${currentPerfect.naiveScore.toLocaleString()} points with no answer conflicts.`;

    for (const pick of currentPerfect.picks) {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${pick.slotIndex + 1}. ${escapeHtml(pick.record.playerName)}</strong><span>${escapeHtml(pick.record.season)} · ${escapeHtml(pick.record.club)} · ${pick.record.points} pts</span>`;
      elements.perfectXI.append(item);
    }
  }

  function populatePromptSelect(select, currentPrompt, currentIndex) {
    const settings = currentSettings();
    const selectedElsewhere = new Set(
      selectedPrompts.filter((_, index) => index !== currentIndex).map(prompt => prompt.id)
    );
    let options = eligiblePrompts(currentPrompt.position, settings, selectedElsewhere);
    if (!options.some(prompt => prompt.id === currentPrompt.id)) options = [currentPrompt, ...options];
    options.sort((a, b) => a.label.localeCompare(b.label));

    for (const prompt of options) {
      const option = document.createElement("option");
      option.value = prompt.id;
      option.selected = prompt.id === currentPrompt.id;
      option.textContent = `${prompt.label} (${getPromptStats(prompt).playerCount})`;
      select.append(option);
    }
  }

  function rerollSlot(index) {
    const current = selectedPrompts[index];
    const settings = currentSettings();
    const excluded = new Set(selectedPrompts.map(prompt => prompt.id));
    const options = eligiblePrompts(current.position, settings, excluded);
    if (!options.length) {
      elements.actionStatus.textContent = `No other eligible ${current.position} prompt is available with the current restrictions.`;
      return;
    }

    selectedPrompts[index] = weightedPick(options, selectedPrompts.filter((_, slotIndex) => slotIndex !== index), settings);
    refreshDraft();
    elements.actionStatus.textContent = `Slot ${index + 1} was rerolled and the perfect score was recalculated.`;
  }

  function renderSummaryAndWarnings() {
    const antiCount = selectedPrompts.filter(isAntiMeta).length;
    const average = selectedPrompts.reduce((sum, prompt) => sum + DIFFICULTY_VALUE[prompt.difficulty], 0) / selectedPrompts.length;
    const difficultyLabel = average < 1.65 ? "Easy" : average < 2.35 ? "Medium" : "Hard";
    const answerRange = selectedPrompts.map(prompt => getPromptStats(prompt).playerCount);

    elements.draftSummary.innerHTML = `
      <span>${antiCount} anti-meta</span>
      <span>${difficultyLabel} average</span>
      <span>${Math.min(...answerRange)}–${Math.max(...answerRange)} valid players</span>
      <span>${currentPerfect?.possible ? `${currentPerfect.score.toLocaleString()} perfect score` : "Score unavailable"}</span>
      <span>${currentSettings().maxPerfectScore > 0 ? `${currentSettings().maxPerfectScore.toLocaleString()} score ceiling` : "No score ceiling"}</span>
    `;

    const warnings = [];
    const settings = currentSettings();
    const disabledSelected = selectedPrompts.filter(prompt => prompt.enabled === false);
    if (settings.maxPerfectScore > 0 && currentPerfect?.possible && currentPerfect.score > settings.maxPerfectScore) warnings.push(`Perfect score ${currentPerfect.score.toLocaleString()} exceeds the configured maximum of ${settings.maxPerfectScore.toLocaleString()}. Reroll or generate again before publishing.`);
    if (disabledSelected.length) warnings.push(`${disabledSelected.length} selected prompt(s) are disabled in the Prompt Library Manager. Reroll them before publishing.`);
    if (antiCount < settings.minAntiMeta) warnings.push(`Only ${antiCount} anti-meta prompts are selected; your target is ${settings.minAntiMeta}.`);

    const themeCounts = new Map();
    for (const prompt of selectedPrompts) {
      for (const tag of prompt.tags) {
        if (!DIVERSITY_TAGS.has(tag)) continue;
        themeCounts.set(tag, (themeCounts.get(tag) || 0) + 1);
      }
    }
    const repeated = [...themeCounts.entries()].filter(([, count]) => count > 2);
    if (repeated.length) warnings.push(`Repeated themes: ${repeated.map(([tag, count]) => `${tag} ×${count}`).join(", ")}. Consider rerolling one slot.`);

    const narrow = selectedPrompts.filter(prompt => getPromptStats(prompt).playerCount < 6);
    if (narrow.length) warnings.push(`${narrow.length} prompt(s) have fewer than six valid players.`);

    const overlaps = getAnswerOverlapWarnings();
    warnings.push(...overlaps);

    if (settings.avoidRecent && window.FPL_STUDIO_PHASE3?.isPromptCoolingDown) {
      const cooldownConflicts = selectedPrompts.filter(prompt => window.FPL_STUDIO_PHASE3.isPromptCoolingDown(prompt.id));
      if (cooldownConflicts.length) warnings.push(`${cooldownConflicts.length} selected prompt(s) are currently on history cooldown. Reroll those slots before recording the challenge.`);
    }

    if (!currentPerfect?.possible) warnings.push(currentPerfect?.reason || "The exact perfect score could not be calculated.");
    else if (currentPerfect.uniquenessCost >= 80) warnings.push(`The obvious answers overlap heavily: enforcing eleven different players reduces the theoretical total by ${currentPerfect.uniquenessCost} points.`);

    elements.warnings.innerHTML = warnings.length
      ? warnings.map(message => `<div class="warning">${escapeHtml(message)}</div>`).join("")
      : '<div class="success-message">The formation, answer counts, anti-meta target, theme balance, answer overlap and exact scoring checks all pass.</div>';
  }

  function getAnswerOverlapWarnings() {
    const messages = [];
    const bestAnswerSlots = new Map();
    const topFiveSlots = new Map();

    selectedPrompts.forEach((prompt, index) => {
      const stats = getPromptStats(prompt);
      if (stats.bestAnswer) {
        const entry = bestAnswerSlots.get(stats.bestAnswer.playerId) || { name: stats.bestAnswer.playerName, slots: [] };
        entry.slots.push(index + 1);
        bestAnswerSlots.set(stats.bestAnswer.playerId, entry);
      }
      for (const answer of stats.topAnswers) {
        const entry = topFiveSlots.get(answer.playerId) || { name: answer.playerName, slots: new Set() };
        entry.slots.add(index + 1);
        topFiveSlots.set(answer.playerId, entry);
      }
    });

    const duplicateLeaders = [...bestAnswerSlots.values()]
      .filter(entry => entry.slots.length > 1)
      .sort((a, b) => b.slots.length - a.slots.length)
      .slice(0, 3);
    if (duplicateLeaders.length) {
      messages.push(`Obvious-answer overlap: ${duplicateLeaders.map(entry => `${entry.name} leads slots ${entry.slots.join("/")}`).join("; ")}.`);
    }

    const broadOverlaps = [...topFiveSlots.values()]
      .filter(entry => entry.slots.size >= 3)
      .sort((a, b) => b.slots.size - a.slots.size)
      .slice(0, 3);
    if (broadOverlaps.length) {
      messages.push(`Top-five answer overlap: ${broadOverlaps.map(entry => `${entry.name} appears in ${entry.slots.size} prompts`).join("; ")}.`);
    }

    return messages;
  }

  function updateCodeOutput() {
    if (!selectedPrompts.length) return;
    const challengeNumber = clampNumber(elements.challengeNumber.value, 1, 9999, 7);
    const challengeName = elements.challengeName.value.trim() || "Generated Mix";
    const releaseDate = elements.releaseDate.value || new Date().toISOString().slice(0, 10);
    const difficulty = displayDifficulty();
    const slug = slugify(challengeName) || "generated-mix";
    const perfectScore = currentPerfect?.possible ? currentPerfect.score : 0;

    const promptsCode = selectedPrompts.map(prompt => {
      const testSource = prompt.test.toString();
      return `    {\n      id: ${JSON.stringify(prompt.id)},\n      position: ${JSON.stringify(prompt.position)},\n      label: ${JSON.stringify(prompt.label)},\n      fail: ${JSON.stringify(prompt.fail)},\n      test: ${testSource}\n    }`;
    }).join(",\n");

    elements.codeOutput.value = `/* Generated by FPL Challenge Studio Phase 4.\n   Exact perfect score calculated with eleven unique footballers.\n   Review before manually uploading to GitHub. */\nwindow.FPL_DAILY_CHALLENGE = {\n  id: ${JSON.stringify(`daily-${releaseDate}-${slug}`)},\n  number: ${challengeNumber},\n  title: ${JSON.stringify(`${formatChallengeDate(releaseDate)} · ${challengeName}`)},\n  dateLabel: ${JSON.stringify(`Generated Mix · ${difficulty}`)},\n  difficulty: ${JSON.stringify(difficulty)},\n  releaseDate: ${JSON.stringify(releaseDate)},\n  perfectScore: ${perfectScore},\n  prompts: [\n${promptsCode}\n  ]\n};\n`;

    const scoreCapPassed = currentSettings().maxPerfectScore <= 0 || (currentPerfect?.possible && currentPerfect.score <= currentSettings().maxPerfectScore);
    elements.downloadBtn.disabled = !currentPerfect?.possible || !scoreCapPassed;
  }

  function displayDifficulty() {
    if (!selectedPrompts.length) return "Mixed";
    const counts = { easy: 0, medium: 0, hard: 0 };
    selectedPrompts.forEach(prompt => { counts[prompt.difficulty] += 1; });
    if (counts.hard >= 6) return "Medium / Hard";
    if (counts.easy >= 6) return "Easy / Medium";
    return "Mixed";
  }

  function saveDraft() {
    if (!selectedPrompts.length) return;
    const payload = {
      version: 4,
      savedAt: new Date().toISOString(),
      promptIds: selectedPrompts.map(prompt => prompt.id),
      settings: {
        challengeNumber: elements.challengeNumber.value,
        challengeName: elements.challengeName.value,
        difficultyTarget: elements.difficultyTarget.value,
        releaseDate: elements.releaseDate.value,
        minAnswers: elements.minAnswers.value,
        maxAnswers: elements.maxAnswers.value,
        maxPerfectScore: elements.maxPerfectScore?.value || "0",
        minAntiMeta: elements.minAntiMeta.value,
        cooldownChallenges: elements.cooldownChallenges?.value || "7",
        avoidRecent: elements.avoidRecent.checked
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    elements.actionStatus.textContent = "Draft saved in this browser. It has not been published or sent anywhere.";
  }

  function loadDraft() {
    const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
    if (!raw) {
      elements.actionStatus.textContent = "No saved Challenge Studio draft was found in this browser.";
      return;
    }

    try {
      const payload = JSON.parse(raw);
      const prompts = payload.promptIds.map(id => promptLibrary.find(prompt => prompt.id === id)).filter(Boolean);
      if (prompts.length !== 11) throw new Error("The saved prompt list is incomplete.");

      const settings = payload.settings || {};
      for (const [key, value] of Object.entries(settings)) {
        if (!elements[key]) continue;
        if (elements[key].type === "checkbox") elements[key].checked = Boolean(value);
        else elements[key].value = value;
      }

      selectedPrompts = prompts;
      elements.draftPanel.classList.remove("hidden");
      elements.codePanel.classList.remove("hidden");
      elements.saveDraftBtn.disabled = false;
      refreshDraft();
      elements.actionStatus.textContent = `Saved draft loaded${payload.savedAt ? ` from ${new Date(payload.savedAt).toLocaleString()}` : ""}. The perfect score was recalculated.`;
    } catch (error) {
      elements.actionStatus.textContent = `The saved draft could not be loaded: ${error.message}`;
    }
  }

  function downloadChallengeFile() {
    const settings = currentSettings();
    if (!currentPerfect?.possible || !elements.codeOutput.value) return;
    if (settings.maxPerfectScore > 0 && currentPerfect.score > settings.maxPerfectScore) { elements.copyStatus.textContent = `Download blocked: perfect score ${currentPerfect.score.toLocaleString()} exceeds the ${settings.maxPerfectScore.toLocaleString()} ceiling.`; return; }
    const blob = new Blob([elements.codeOutput.value], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "todays-challenge.js";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    elements.copyStatus.textContent = "todays-challenge.js downloaded. Review it, then replace only that file in GitHub.";
  }

  async function copyChallengeCode() {
    try {
      await navigator.clipboard.writeText(elements.codeOutput.value);
      elements.copyStatus.textContent = "Challenge code copied. The live game has not been changed.";
    } catch (error) {
      elements.codeOutput.focus();
      elements.codeOutput.select();
      elements.copyStatus.textContent = "Automatic copy was blocked. The code is selected so you can press Ctrl+C.";
    }
  }

  function formatAnswer(answer) {
    if (!answer) return "Unavailable";
    return `${escapeHtml(answer.playerName)} · ${escapeHtml(answer.season)} · ${answer.points} pts`;
  }

  function isAntiMeta(prompt) {
    return prompt.tags.includes("anti-meta");
  }

  function difficultyTargetValue(value) {
    return ({ easy: 1.45, medium: 2, hard: 2.65, mixed: 2.1 })[value] || 2.1;
  }

  function seasonSortValue(season) {
    const start = Number.parseInt(String(season).slice(0, 4), 10);
    return Number.isFinite(start) ? start : 0;
  }

  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
  }

  function capitalise(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  window.FPL_STUDIO_API = Object.freeze({
    getSelectedPrompts: () => selectedPrompts.slice(),
    getPerfectResult: () => currentPerfect,
    getPromptStats,
    getPromptLibrary: () => promptLibrary,
    isPromptSelected: promptId => selectedPrompts.some(prompt => prompt.id === promptId),
    invalidatePromptStats: promptId => {
      if (promptId) statsCache.delete(promptId);
      else statsCache.clear();
    },
    refreshLibrary: ({ recalculateDraft = true } = {}) => {
      statsCache.clear();
      updateLibraryStatus("checked");
      if (recalculateDraft && selectedPrompts.length) refreshDraft();
    },
    getChallengeMeta: () => ({
      number: clampNumber(elements.challengeNumber.value, 1, 9999, 7),
      name: elements.challengeName.value.trim() || "Generated Mix",
      releaseDate: elements.releaseDate.value || new Date().toISOString().slice(0, 10),
      difficulty: displayDifficulty(),
      code: elements.codeOutput.value
    }),
    refreshDraft: () => selectedPrompts.length && refreshDraft()
  });

})();

/* ===== END admin.js ===== */

/* ===== BEGIN admin-phase3.js ===== */
(() => {
  "use strict";

  const HISTORY_KEY = "fplChallengeStudioHistoryV1";
  const INVALID_PENALTY = 10;
  const BASELINE_CHALLENGE = {
    version: 1,
    id: "daily-006-underdog-xi",
    number: 6,
    name: "The Underdog XI",
    title: "20 July 2026 · The Underdog XI",
    releaseDate: "2026-07-20",
    difficulty: "Medium / Hard",
    perfectScore: 1885,
    status: "published",
    locked: false,
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

  migrateLegacyHistory();
  syncManifestHistory();

  window.FPL_STUDIO_PHASE3 = Object.freeze({
    getCooldownPromptIds,
    isPromptCoolingDown: promptId => getCooldownPromptIds().has(promptId),
    getHistory: () => history.map(entry => ({ ...entry, promptIds: [...entry.promptIds], promptLabels: [...(entry.promptLabels || [])], promptFamilies: [...(entry.promptFamilies || [])] })),
    recordBatchChallenges
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

  function testPickEfficiencyMarkup(record, prompt) {
    const best = Number(core?.getPromptStats?.(prompt)?.bestAnswer?.points);
    const picked = Number(record?.points) || 0;
    const percentage = best > 0 ? Math.max(0, Math.min(100, (picked / best) * 100)) : picked === best ? 100 : 0;
    const rounded = Math.round(percentage);
    const label = rounded === 100 ? "Perfect pick" : rounded >= 90 ? "Elite selection" : rounded >= 75 ? "Strong selection" : rounded >= 50 ? "Competitive selection" : "Points left available";
    return `<div class="test-pick-efficiency"><div class="test-pick-efficiency-head"><span>${escapeHtml(label)}</span><strong>${rounded}%</strong></div><div class="test-efficiency-track"><div class="test-efficiency-fill" style="width:${percentage.toFixed(1)}%"></div></div></div>`;
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
        ${saved && record ? testPickEfficiencyMarkup(record, prompt) : ""}
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
    return (player?.seasons || []).filter(season => season.position === prompt.position && Number(season?.minutes) > 0);
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

  function migrateLegacyHistory() {
    let changed = false;
    history = history.map(entry => {
      const next = { ...entry };
      if (next.locked) { next.locked = false; changed = true; }
      if (next.releaseDate && /^Challenge #\d+/.test(String(next.title || ""))) {
        next.title = `${formatHistoryDate(next.releaseDate)} · ${next.name || String(next.title).replace(/^Challenge #\d+\s*·\s*/, "") || "Daily Challenge"}`;
        changed = true;
      }
      return next;
    });
    if (changed) saveHistory();
  }

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function syncManifestHistory() {
    const manifestEntries = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges)
      ? window.FPL_CHALLENGE_MANIFEST.challenges
      : [];
    if (!manifestEntries.length) return;
    const promptById = new Map(promptLibrary.map(prompt => [prompt.id, prompt]));
    let changed = false;
    for (const item of manifestEntries) {
      if (!item?.date || !Array.isArray(item.promptIds) || !item.promptIds.length) continue;
      const existing = history.find(entry => entry.releaseDate === item.date || entry.id === item.id);
      if (existing) {
        if ((!existing.promptLabels || !existing.promptLabels.length) && item.promptIds.length) {
          existing.promptLabels = item.promptIds.map(id => promptById.get(id)?.label || id);
          existing.promptFamilies = Array.isArray(item.promptFamilies) ? [...item.promptFamilies] : [];
          existing.locked = false;
          changed = true;
        }
        continue;
      }
      history.push({
        version: 2,
        id: item.id || `daily-${item.date}-generated-mix`,
        number: Number(item.number) || 0,
        name: item.theme || "Generated Mix",
        title: item.title || `${formatHistoryDate(item.date)} · ${item.theme || "Generated Mix"}`,
        releaseDate: item.date,
        difficulty: item.difficulty || "Mixed",
        perfectScore: Number(item.perfectScore) || 0,
        status: item.date <= new Date().toISOString().slice(0, 10) ? "published" : "scheduled",
        locked: false,
        recordedAt: new Date().toISOString(),
        promptIds: [...item.promptIds],
        promptLabels: item.promptIds.map(id => promptById.get(id)?.label || id),
        promptFamilies: Array.isArray(item.promptFamilies) ? [...item.promptFamilies] : []
      });
      changed = true;
    }
    if (changed) saveHistory();
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
    const existingIndex = history.findIndex(entry => entry.releaseDate === meta.releaseDate || entry.id === `daily-${meta.releaseDate}-${slugify(meta.name) || "generated-mix"}`);
    if (existingIndex >= 0) {
      const replace = window.confirm(`${formatHistoryDate(meta.releaseDate)} is already in this browser's history. Replace it with the tested version?`);
      if (!replace) return;
    }

    const entry = {
      version: 1,
      id: `daily-${meta.releaseDate}-${slugify(meta.name) || "generated-mix"}`,
      number: meta.number,
      name: meta.name,
      title: `${formatHistoryDate(meta.releaseDate)} · ${meta.name}`,
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
    elements.historyActionStatus.textContent = `${formatHistoryDate(meta.releaseDate)} recorded. Its prompts now count towards the cooldown.`;
  }

  function recordBatchChallenges(entries) {
    if (!Array.isArray(entries) || !entries.length) return;
    let recorded = 0;
    for (const item of entries) {
      if (!item || !item.releaseDate || !Array.isArray(item.promptIds) || !item.promptIds.length) continue;
      const promptLabels = Array.isArray(item.promptLabels) && item.promptLabels.length
        ? [...item.promptLabels]
        : (item.prompts || []).map(prompt => prompt?.label || prompt?.id).filter(Boolean);
      const entry = {
        version: 2,
        id: item.id || `daily-${item.releaseDate}-${slugify(item.name || item.theme || "generated-mix")}`,
        number: Number(item.number) || 0,
        name: item.name || item.theme || "Generated Mix",
        title: `${formatHistoryDate(item.releaseDate)} · ${item.name || item.theme || "Generated Mix"}`,
        releaseDate: item.releaseDate,
        difficulty: item.difficulty || "Mixed",
        perfectScore: Number(item.perfectScore) || 0,
        status: "scheduled",
        locked: false,
        recordedAt: new Date().toISOString(),
        promptIds: [...item.promptIds],
        promptLabels,
        promptFamilies: Array.isArray(item.promptFamilies) ? [...item.promptFamilies] : []
      };
      const index = history.findIndex(existing => existing.releaseDate === entry.releaseDate || existing.id === entry.id);
      if (index >= 0) history[index] = entry; else history.push(entry);
      recorded += 1;
    }
    if (!recorded) return;
    saveHistory();
    renderHistory();
    core?.refreshDraft?.();
    elements.historyActionStatus.textContent = `${recorded} batch challenge${recorded === 1 ? "" : "s"} saved to Challenge History with all prompts.`;
  }

  function formatHistoryDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return String(value || "No date");
    const [, year, month, day] = match;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12)));
  }

  function renderHistory() {
    const ordered = sortedHistory();
    elements.historyStatus.textContent = `${ordered.length} challenge${ordered.length === 1 ? "" : "s"} recorded`;
    elements.historyList.innerHTML = ordered.length ? ordered.map(entry => {
      const status = entry.status === "published" ? "Published" : entry.status === "scheduled" ? "Scheduled" : "Ready to upload";
      const prompts = (entry.promptLabels?.length ? entry.promptLabels : entry.promptIds).map((label, index) => `<li>${escapeHtml(label || entry.promptIds[index])}</li>`).join("");
      return `<article class="history-card" data-history-id="${escapeAttribute(entry.id)}">
        <div class="history-card-head">
          <div>
            <h3>${escapeHtml(entry.title || `${formatHistoryDate(entry.releaseDate)} · ${entry.name || "Daily Challenge"}`)}</h3>
            <p class="history-meta">${escapeHtml(entry.releaseDate || "No date")} · ${escapeHtml(entry.difficulty || "Mixed")} · ${Number(entry.perfectScore || 0).toLocaleString()} perfect score</p>
          </div>
          <span class="history-status ${entry.status === "published" ? "published" : ""}">${status}</span>
        </div>
        <details class="history-prompts"><summary>Show ${entry.promptIds.length} used prompts</summary><ol>${prompts}</ol></details>
        <div class="history-actions">
          <button type="button" data-history-toggle="${escapeAttribute(entry.id)}">Mark ${entry.status === "published" ? "ready" : "published"}</button><button type="button" data-history-delete="${escapeAttribute(entry.id)}">Delete entry</button>
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
    if (!entry) return;
    entry.status = entry.status === "published" ? "ready" : "published";
    saveHistory();
    renderHistory();
    elements.historyActionStatus.textContent = `${entry.title} marked ${entry.status}.`;
  }

  function deleteHistoryEntry(id) {
    const entry = history.find(item => item.id === id);
    if (!entry) return;
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
      lines.push(`## ${formatHistoryDate(entry.releaseDate)} · ${entry.name || "Daily Challenge"}`);
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

/* ===== END admin-phase3.js ===== */

/* ===== BEGIN admin-phase7.js ===== */
/* FPL Challenge Studio Phase 7 — player database auditor, reviewed 2026-07-28.
   Updates:
   - Age 15 is valid without a warning.
   - Verified age exceptions can use season.ageVerified = true.
   - Verified mononyms can use player.mononymVerified = true.
   - Same-name players with unique identityDisambiguator values are treated as separate people.
   - Optional historical statistics no longer block database expansion when source data is unavailable.
*/
(() => {
  "use strict";

  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const PAGE_SIZE = 12;
  const VALID_POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  const PERFORMANCE_FIELDS = ["goals", "assists", "cleanSheets", "bonus", "saves", "goalsConceded"];
  const REQUIRED_NUMERIC_FIELDS = ["points", "minutes", "goals", "assists", "cleanSheets", "bonus", "startingPrice"];
  const PROMPT_OPTIONAL_NUMERIC_FIELDS = ["saves"];
  const OPTIONAL_METADATA_NUMERIC_FIELDS = ["goalsConceded", "yellowCards", "redCards", "finalPrice"];
  const ALL_NUMERIC_FIELDS = [...REQUIRED_NUMERIC_FIELDS, ...PROMPT_OPTIONAL_NUMERIC_FIELDS, ...OPTIONAL_METADATA_NUMERIC_FIELDS];
  const SURNAME_PARTICLES = new Set(["al", "ap", "bin", "bint", "da", "das", "de", "del", "della", "den", "der", "di", "dos", "du", "el", "la", "le", "van", "von", "y"]);
  const state = { running: false, groups: [], rows: [], filteredGroups: [], page: 1, report: null };
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
    ].forEach(id => { elements[id] = document.getElementById(id); });

    if (!elements.runDatabaseAuditBtn) return;

    elements.runDatabaseAuditBtn.addEventListener("click", runAudit);
    elements.downloadAuditJsonBtn?.addEventListener("click", downloadJsonReport);
    elements.downloadAuditCsvBtn?.addEventListener("click", downloadCsvReport);
    elements.copyAuditSummaryBtn?.addEventListener("click", copySummary);
    elements.auditSearch?.addEventListener("input", applyFilters);
    elements.auditSeverityFilter?.addEventListener("change", applyFilters);
    elements.auditCategoryFilter?.addEventListener("change", applyFilters);
    elements.auditPreviousPageBtn?.addEventListener("click", () => changePage(-1));
    elements.auditNextPageBtn?.addEventListener("click", () => changePage(1));

    const seasonCount = players.reduce((total, player) => total + (Array.isArray(player.seasons) ? player.seasons.length : 0), 0);
    window.FPL_DATABASE_AUDITOR = { getReport: () => state.report, run: runAudit };
    setText("auditPlayerCount", players.length.toLocaleString());
    setText("auditSeasonCount", seasonCount.toLocaleString());

    if (!players.length) {
      setTopStatus("Database unavailable", "blocked");
      setText("auditActionStatus", "players.js did not load, so the database cannot be audited.");
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
    window.FPL_DATABASE_AUDIT_REPORT = null;

    setTopStatus("Auditing…", "pending");
    elements.runDatabaseAuditBtn.disabled = true;
    elements.runDatabaseAuditBtn.textContent = "Auditing database…";
    setDisabled("downloadAuditJsonBtn", true);
    setDisabled("downloadAuditCsvBtn", true);
    setDisabled("copyAuditSummaryBtn", true);
    elements.auditProgressWrap?.classList.remove("hidden");
    elements.auditReadinessPanel?.classList.add("hidden");
    if (elements.auditCategorySummary) elements.auditCategorySummary.innerHTML = "";
    if (elements.auditIssueList) elements.auditIssueList.innerHTML = "";
    setText("auditActionStatus", "Scanning identities, player-seasons, statistics and metadata…");

    const groupMap = new Map();
    const idMap = new Map();
    const normalisedNameMap = new Map();
    let seasonCount = 0;
    let nameReadyCount = 0;
    let latestSeasonYear = 0;

    for (const player of players) {
      for (const season of Array.isArray(player.seasons) ? player.seasons : []) {
        latestSeasonYear = Math.max(latestSeasonYear, parseSeasonStartYear(season?.season) || 0);
      }
    }

    const addFinding = (definition, occurrence = {}) => {
      if (!groupMap.has(definition.code)) {
        groupMap.set(definition.code, {
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
      const group = groupMap.get(definition.code);
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
        normalisedNameMap.get(normalisedName).push({
          playerId,
          playerName,
          identityDisambiguator: String(player.identityDisambiguator || "").trim(),
          seasons: seasons.map(item => item?.season).filter(Boolean)
        });
      }

      const nameParts = deriveNameParts(playerName);
      if (nameParts.ready || player.mononymVerified === true) nameReadyCount += 1;
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
        } else {
          seasonMap.set(seasonLabel, season || {});
        }

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

        for (const field of REQUIRED_NUMERIC_FIELDS) {
          /* Zero-minute starting-price exemption. */
          if (field === "startingPrice" && Number(season?.minutes) === 0) continue;
          const value = season?.[field];
          if (!Number.isFinite(value)) {
            addFinding(DEFINITIONS.invalidNumeric(field), { ...seasonContext, field, currentValue: value, expected: "Finite number" });
          } else if (field !== "points" && value < 0) {
            addFinding(DEFINITIONS.negativeNumeric(field), { ...seasonContext, field, currentValue: value, expected: "0 or more" });
          }
        }

        for (const field of PROMPT_OPTIONAL_NUMERIC_FIELDS) {
          const value = season?.[field];
          if (value == null || value === "") {
            addFinding(DEFINITIONS.missingPromptStatistic(field), { ...seasonContext, field, currentValue: value, expected: "Finite number when source data is available" });
          } else if (!Number.isFinite(value)) {
            addFinding(DEFINITIONS.invalidOptionalNumeric(field), { ...seasonContext, field, currentValue: value, expected: "Finite number or blank" });
          } else if (value < 0) {
            addFinding(DEFINITIONS.negativeNumeric(field), { ...seasonContext, field, currentValue: value, expected: "0 or more" });
          }
        }

        for (const field of OPTIONAL_METADATA_NUMERIC_FIELDS) {
          const value = season?.[field];
          if (value == null || value === "") continue;
          if (!Number.isFinite(value)) {
            addFinding(DEFINITIONS.invalidOptionalNumeric(field), { ...seasonContext, field, currentValue: value, expected: "Finite number or blank" });
          } else if (value < 0) {
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
            const expectedFlags = { champions: position === 1, topFour: position <= 4, bottomHalf: position >= 11, relegated: position >= 18 };
            for (const [field, expected] of Object.entries(expectedFlags)) {
              if (Boolean(season?.[field]) !== expected) {
                addFinding(DEFINITIONS.flagMismatch(field), { ...seasonContext, field, currentValue: season?.[field], expected });
              }
            }
          }
        }

        const age = season?.ageAtSeasonStart;
        if (!Number.isFinite(age)) {
          addFinding(DEFINITIONS.missingAge, seasonContext);
        } else {
          if (age < 15 || age > 45) {
            addFinding(DEFINITIONS.impossibleAge, { ...seasonContext, field: "ageAtSeasonStart", currentValue: age, expected: "15–45" });
          } else if (age >= 40 && season?.ageVerified !== true) {
            addFinding(DEFINITIONS.ageReview, { ...seasonContext, field: "ageAtSeasonStart", currentValue: age, expected: "Confirm unusually old player or set ageVerified: true" });
          }

          if (dob && seasonYear) {
            const expectedAge = ageOnDate(dob, new Date(Date.UTC(seasonYear, 7, 1)));
            if (Number.isFinite(expectedAge) && Math.abs(age - expectedAge) > 1) {
              addFinding(DEFINITIONS.ageDobMismatch, {
                ...seasonContext,
                field: "ageAtSeasonStart",
                currentValue: age,
                expected: `${expectedAge} (approximately, from DOB ${dobRaw})`
              });
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

      const labels = entries.map(entry => normaliseName(entry.identityDisambiguator)).filter(Boolean);
      const verifiedSeparatePeople = labels.length === entries.length && new Set(labels).size === entries.length;
      if (verifiedSeparatePeople) continue;

      const allSeasons = entries.flatMap(entry => entry.seasons);
      addFinding(DEFINITIONS.splitIdentity, {
        playerId: entries.map(entry => entry.playerId).join(" | "),
        playerName: entries[0].playerName,
        season: [...new Set(allSeasons)].sort().join(", "),
        currentValue: entries.map(entry => entry.playerId).join(", "),
        expected: "One stable playerId per footballer, or unique identityDisambiguator values for different people",
        detail: `${entries[0].playerName} appears under ${entries.length} player IDs without complete identity labels.`
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
    window.FPL_DATABASE_AUDIT_REPORT = state.report;
    document.dispatchEvent(new CustomEvent("fplstudio:databaseauditcomplete", { detail: { report: state.report } }));

    setText("auditPlayerCount", players.length.toLocaleString());
    setText("auditSeasonCount", seasonCount.toLocaleString());
    setText("auditCriticalCount", severityCounts.critical.toLocaleString());
    setText("auditWarningCount", severityCounts.warning.toLocaleString());
    setText("auditInfoCount", severityCounts.info.toLocaleString());
    setText("auditNameReady", `${nameReadyPercent.toFixed(1)}%`);
    updateProgress(100, "Audit complete");
    renderCategorySummary(categoryCounts);
    renderReadiness(severityCounts);
    applyFilters();

    setDisabled("downloadAuditJsonBtn", false);
    setDisabled("downloadAuditCsvBtn", false);
    setDisabled("copyAuditSummaryBtn", false);
    elements.runDatabaseAuditBtn.disabled = false;
    elements.runDatabaseAuditBtn.textContent = "Run audit again";
    setText("auditActionStatus", `Audit complete: ${severityCounts.critical.toLocaleString()} blocking occurrences, ${severityCounts.warning.toLocaleString()} warnings and ${severityCounts.info.toLocaleString()} metadata gaps across ${state.groups.length} issue types.`);
    state.running = false;

    if (severityCounts.critical > 0) setTopStatus(`${severityCounts.critical.toLocaleString()} blockers found`, "blocked");
    else if (severityCounts.warning > 0) setTopStatus("Passed with warnings", "warning");
    else setTopStatus("Database passed", "ready");

    setTimeout(() => elements.auditProgressWrap?.classList.add("hidden"), 900);
  }

  function renderReadiness(counts) {
    elements.auditReadinessPanel?.classList.remove("hidden");
    const priorities = state.groups.filter(group => group.severity === "critical").slice(0, 4);
    if (counts.critical > 0) {
      setText("auditReadinessHeading", "Fix blockers before expanding the player pool");
      setText("auditReadinessCopy", "The current game can continue running, but adding older seasons now would make identity and data-quality problems harder to untangle.");
    } else if (counts.warning > 0) {
      setText("auditReadinessHeading", "Safe to expand carefully");
      setText("auditReadinessCopy", "No blocking corruption was found. Review the warnings, then add one historical season at a time and rerun this audit after each import.");
    } else {
      setText("auditReadinessHeading", "Ready for controlled expansion");
      setText("auditReadinessCopy", "The database passed all blocking and warning checks. Metadata gaps are listed separately and are not structural errors.");
    }
    if (elements.auditPriorityList) {
      elements.auditPriorityList.innerHTML = priorities.length
        ? priorities.map(group => `<div><span>${escapeHtml(group.title)}</span><strong>${group.count.toLocaleString()}</strong></div>`).join("")
        : `<div><span>Blocking issue types</span><strong>0</strong></div>`;
    }
  }

  function renderCategorySummary(categoryCounts) {
    if (!elements.auditCategorySummary) return;
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
        if (elements.auditCategoryFilter) elements.auditCategoryFilter.value = button.dataset.auditCategory;
        applyFilters();
        elements.auditIssueList?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function applyFilters() {
    const query = normaliseName(elements.auditSearch?.value);
    const severity = elements.auditSeverityFilter?.value || "all";
    const category = elements.auditCategoryFilter?.value || "all";
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
    if (!elements.auditIssueList) return;
    const total = state.filteredGroups.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = state.filteredGroups.slice(start, start + PAGE_SIZE);

    setText("auditListSummary", state.report ? `${total.toLocaleString()} of ${state.groups.length.toLocaleString()} issue types shown` : "Run the audit to see findings");
    setText("auditPageLabel", `Page ${state.page} of ${pages}`);
    setDisabled("auditPreviousPageBtn", state.page <= 1);
    setDisabled("auditNextPageBtn", state.page >= pages);

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
    elements.auditIssueList?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function downloadJsonReport() {
    if (!state.report) return;
    downloadText(`fpl-player-database-audit-${dateStamp()}.json`, JSON.stringify(state.report, null, 2), "application/json");
    setText("auditActionStatus", "JSON audit report downloaded.");
  }

  function downloadCsvReport() {
    if (!state.report) return;
    const columns = ["severity", "category", "code", "issue", "playerId", "playerName", "season", "club", "field", "currentValue", "expected", "detail"];
    const lines = [columns.join(","), ...state.rows.map(row => columns.map(column => csvCell(row[column])).join(","))];
    downloadText(`fpl-player-database-issues-${dateStamp()}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
    setText("auditActionStatus", "Detailed issues CSV downloaded.");
  }

  async function copySummary() {
    if (!state.report) return;
    const report = state.report;
    const top = state.groups.slice(0, 5).map(group => `- ${group.title}: ${group.count}`).join("\n");
    const text = `FPL Player Database Audit\n${report.generatedAt}\n\nPlayers: ${report.database.players}\nPlayer-seasons: ${report.database.playerSeasons}\nBlocking occurrences: ${report.summary.blockingOccurrences}\nWarnings: ${report.summary.warningOccurrences}\nMetadata gaps: ${report.summary.metadataOccurrences}\nName-rule ready: ${report.database.nameRuleReadyPercent}%\n\nHighest-priority findings:\n${top}`;
    try {
      await navigator.clipboard.writeText(text);
      setText("auditActionStatus", "Audit summary copied.");
    } catch {
      setText("auditActionStatus", "Clipboard access was unavailable. Download the JSON report instead.");
    }
  }

  function setText(id, text) {
    if (elements[id]) elements[id].textContent = text;
  }

  function setDisabled(id, value) {
    if (elements[id]) elements[id].disabled = value;
  }

  function setTopStatus(text, mode) {
    setText("auditStatusTop", text);
    setText("auditReadyChip", text);
    if (!elements.auditReadyChip) return;
    elements.auditReadyChip.classList.remove("audit-ready", "audit-warning", "audit-blocked");
    if (mode === "ready") elements.auditReadyChip.classList.add("audit-ready");
    if (mode === "warning") elements.auditReadyChip.classList.add("audit-warning");
    if (mode === "blocked") elements.auditReadyChip.classList.add("audit-blocked");
  }

  function updateProgress(percent, text) {
    setText("auditProgressPercent", `${percent}%`);
    setText("auditProgressText", text);
    if (elements.auditProgressBar) elements.auditProgressBar.style.width = `${percent}%`;
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
    return new Promise(resolve => requestAnimationFrame(resolve));
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
    singleWordName: definition("single-word-name", "info", "names", "Single-word name needs special handling", "Surname prompts cannot reliably split an unverified one-word display name.", "Verify the mononym and set mononymVerified: true."),
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
    ageReview: definition("unusual-player-age", "warning", "age", "Unusually old player age", "Players aged 40–45 are valid but should be confirmed before age prompts rely on them.", "Confirm the date of birth and set ageVerified: true on the player-season."),
    ageDobMismatch: definition("age-dob-mismatch", "critical", "age", "Season age conflicts with date of birth", "The stored age differs by more than one year from the player's date of birth.", "Check for a merged same-name player, then recalculate the age after correcting identity."),
    splitIdentity: definition("split-player-identity", "critical", "identity", "Same footballer appears under multiple player IDs", "Accent or spelling changes can split one footballer into separate identities, allowing duplicate use in an XI.", "Merge the seasons, or add unique identityDisambiguator values when they are genuinely different people."),
    invalidNumeric: field => definition(`invalid-number-${field}`, "critical", "statistics", `${field} is not numeric`, "This field is required by scoring or active prompt rules.", `Restore a finite numeric ${field} value from the source data.`),
    missingPromptStatistic: field => definition(`missing-prompt-stat-${field}`, "warning", "statistics", `${field} is unavailable`, "Some prompt types use this statistic, but missing values safely fail those prompts and do not corrupt scoring.", `Restore ${field} when a reliable historical source becomes available.`),
    invalidOptionalNumeric: field => definition(`invalid-optional-number-${field}`, "warning", "statistics", `${field} is malformed`, "This historical field is optional, but a supplied value should still be numeric.", `Correct the value or leave ${field} blank until it can be verified.`),
    negativeNumeric: field => definition(`negative-number-${field}`, "critical", "statistics", `${field} is negative`, "This statistic cannot be negative. Total FPL points are excluded because negative season totals can be legitimate.", `Correct the ${field} value after checking the source record.`),
    flagMismatch: field => definition(`league-flag-mismatch-${field}`, "critical", "league", `${field} flag conflicts with league position`, "League flags must agree with the final table or prompts will accept incorrect answers.", `Recalculate ${field} from leaguePosition for completed seasons.`)
  };

  function definition(code, severity, category, title, explanation, recommendation) {
    return { code, severity, category, title, explanation, recommendation };
  }
})();

/* ===== END admin-phase7.js ===== */

/* ===== BEGIN admin-phase10.js ===== */
/* FPL Challenge Studio Phase 10 — protected single-season historical importer. */
(() => {
  "use strict";

  const originalPlayers = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const promptLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const VALID_POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  const POSITION_BY_TYPE = Object.freeze({ 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" });
  const REQUIRED_NUMERIC = ["points", "minutes", "goals", "assists", "cleanSheets", "bonus"];
  const OPTIONAL_NUMERIC = ["saves", "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice"];

  const state = {
    datasetRows: [],
    teamMap: new Map(),
    metadataMap: new Map(),
    clubMetadata: new Map(),
    normalisedRows: [],
    conflicts: [],
    decisions: new Map(),
    quarantine: [],
    workspace: null,
    regression: [],
    ready: false,
    liveChallenge: null,
    sourceFiles: {},
    parsed: false
  };

  const elements = {};
  window.addEventListener("load", initialise, { once: true });

  function initialise() {
    [
      "importCentreStatus", "importBaseDatabase", "importSeasonLabel", "importSourceName", "importSourceUrl", "importSourceTrust", "importRequireManagers",
      "importDatasetFile", "importTeamsFile", "importMetadataFile", "importDatasetFileStatus", "importTeamsFileStatus", "importMetadataFileStatus",
      "parseImportFilesBtn", "buildImportPreviewBtn", "resetImportCentreBtn", "importActionStatus", "importClubMetadataPanel", "importClubMetadataStatus",
      "importClubMetadataRows", "importPreviewPanel", "importSourceRows", "importMatchedPlayers", "importNewPlayers", "importConflictCount",
      "importQuarantineCount", "importProjectedSeasons", "importWarnings", "importConflictPanel", "importConflictList", "rebuildImportPreviewBtn",
      "runImportChecksBtn", "importRegressionList", "importDownloadExplanation", "downloadImportPackBtn", "importDownloadStatus"
    ].forEach(id => elements[id] = document.getElementById(id));

    if (!elements.parseImportFilesBtn) return;

    bindFileStatus(elements.importDatasetFile, elements.importDatasetFileStatus);
    bindFileStatus(elements.importTeamsFile, elements.importTeamsFileStatus);
    bindFileStatus(elements.importMetadataFile, elements.importMetadataFileStatus);
    elements.parseImportFilesBtn.addEventListener("click", readImportFiles);
    elements.buildImportPreviewBtn.addEventListener("click", buildImportPreview);
    elements.rebuildImportPreviewBtn.addEventListener("click", buildImportPreview);
    elements.runImportChecksBtn.addEventListener("click", runRegressionChecks);
    elements.resetImportCentreBtn.addEventListener("click", resetImporter);
    elements.downloadImportPackBtn.addEventListener("click", downloadImportPack);
    elements.importClubMetadataRows.addEventListener("input", onMetadataEdit);
    elements.importClubMetadataRows.addEventListener("change", onMetadataEdit);
    elements.importConflictList.addEventListener("change", onConflictDecision);

    window.FPL_DATABASE_IMPORT_CENTRE = Object.freeze({
      readFiles: readImportFiles,
      buildPreview: buildImportPreview,
      runChecks: runRegressionChecks,
      getWorkspace: () => cloneData(state.workspace),
      getRegression: () => cloneData(state.regression),
      getQuarantine: () => cloneData(state.quarantine),
      reset: resetImporter
    });

    if (!originalPlayers.length) {
      setCentreStatus("Database unavailable", "blocked");
      elements.importActionStatus.textContent = "players.js did not load, so the importer cannot start.";
      elements.parseImportFilesBtn.disabled = true;
      return;
    }
    setCentreStatus("Waiting for files", "pending");
  }

  function bindFileStatus(input, status) {
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      status.textContent = file ? `${file.name} · ${formatBytes(file.size)}` : "No file selected.";
    });
  }

  async function readImportFiles() {
    resetPreviewOnly();
    const datasetFile = elements.importDatasetFile.files?.[0];
    const season = normaliseSeasonLabel(elements.importSeasonLabel.value);
    const sourceName = elements.importSourceName.value.trim();
    if (!datasetFile) return showImportError("Choose the player season dataset first.");
    if (!season) return showImportError("Enter the season as YYYY/YY, for example 2015/16.");
    if (!sourceName) return showImportError("Enter a source name so every imported record can be traced.");

    elements.parseImportFilesBtn.disabled = true;
    setCentreStatus("Reading files…", "pending");
    elements.importActionStatus.textContent = "Reading the dataset and optional mapping files…";

    try {
      const [datasetText, teamsText, metadataText] = await Promise.all([
        datasetFile.text(),
        elements.importTeamsFile.files?.[0]?.text() || Promise.resolve(""),
        elements.importMetadataFile.files?.[0]?.text() || Promise.resolve("")
      ]);
      const dataset = parseDataFile(datasetFile.name, datasetText, "dataset");
      const teams = teamsText ? parseDataFile(elements.importTeamsFile.files[0].name, teamsText, "teams") : [];
      const metadata = metadataText ? parseDataFile(elements.importMetadataFile.files[0].name, metadataText, "metadata") : [];

      state.datasetRows = flattenDataset(dataset, season);
      state.teamMap = buildTeamMap(teams);
      state.metadataMap = buildMetadataMap(metadata);
      state.sourceFiles = {
        dataset: fileDescriptor(datasetFile),
        teams: elements.importTeamsFile.files?.[0] ? fileDescriptor(elements.importTeamsFile.files[0]) : null,
        metadata: elements.importMetadataFile.files?.[0] ? fileDescriptor(elements.importMetadataFile.files[0]) : null
      };

      if (!state.datasetRows.length) throw new Error("No player-season rows were recognised in the selected dataset.");
      state.normalisedRows = state.datasetRows.map((row, index) => normaliseSourceRow(row, index, season, state.teamMap));
      const recognised = state.normalisedRows.filter(row => row.name && row.position && row.clubKey).length;
      if (!recognised) throw new Error("The rows could not be mapped to footballer names, positions and clubs.");

      seedClubMetadata();
      renderClubMetadata();
      state.parsed = true;
      elements.buildImportPreviewBtn.disabled = false;
      elements.importClubMetadataPanel.classList.remove("hidden");
      elements.importActionStatus.textContent = `${state.normalisedRows.length.toLocaleString()} source rows read. Complete the club metadata, then build the preview.`;
      setCentreStatus("Files mapped", "pending");
    } catch (error) {
      state.parsed = false;
      elements.buildImportPreviewBtn.disabled = true;
      showImportError(error instanceof Error ? error.message : String(error));
    } finally {
      elements.parseImportFilesBtn.disabled = false;
    }
  }

  function parseDataFile(filename, text, purpose) {
    const trimmed = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!trimmed) return [];
    const extension = filename.toLowerCase().split(".").pop();
    if (extension === "csv") return parseCsv(trimmed);
    if (extension === "json") return unwrapData(JSON.parse(trimmed), purpose);
    if (extension === "js" || extension === "txt") {
      try { return unwrapData(JSON.parse(trimmed), purpose); }
      catch {}
      const sandbox = Object.create(null);
      const value = new Function("window", `"use strict";\n${trimmed}\nreturn window.FPL_PLAYERS || window.FPL_TEAMS || window.FPL_CLUB_METADATA || null;`)(sandbox);
      if (value) return unwrapData(value, purpose);
      throw new Error(`Could not find a supported data array in ${filename}.`);
    }
    throw new Error(`${filename} is not a supported CSV, JSON, JS or TXT file.`);
  }

  function unwrapData(value, purpose) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    const keys = purpose === "dataset"
      ? ["players", "elements", "data", "rows", "FPL_PLAYERS"]
      : purpose === "teams"
        ? ["teams", "data", "rows"]
        : ["metadata", "clubs", "teams", "data", "rows"];
    for (const key of keys) if (Array.isArray(value[key])) return value[key];
    return [];
  }

  function flattenDataset(data, season) {
    const rows = [];
    for (const item of data || []) {
      if (!item || typeof item !== "object") continue;
      if (Array.isArray(item.seasons)) {
        for (const seasonRecord of item.seasons) {
          if (!seasonRecord || typeof seasonRecord !== "object") continue;
          if (seasonRecord.season && seasonRecord.season !== season) continue;
          rows.push({ ...seasonRecord, name: item.name || seasonRecord.name, playerId: item.playerId, bio: item.bio || {}, sourcePlayer: item });
        }
      } else rows.push(item);
    }
    return rows;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
      else field += char;
    }
    if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
    const nonEmpty = rows.filter(values => values.some(value => String(value).trim() !== ""));
    if (nonEmpty.length < 2) return [];
    const headers = nonEmpty[0].map(header => canonicalHeader(header));
    return nonEmpty.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  }

  function canonicalHeader(value) {
    return String(value || "").trim().replace(/^\uFEFF/, "").replace(/[\s-]+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  }

  function buildTeamMap(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const id = first(row, ["id", "team", "team_id", "code"]);
      const name = first(row, ["name", "club", "team_name", "short_name"]);
      if (id != null && name) map.set(String(id), String(name).trim());
    }
    return map;
  }

  function buildMetadataMap(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const sourceClub = first(row, ["source_team", "sourceclub", "team", "club", "name", "team_name"]);
      if (!sourceClub) continue;
      const club = String(first(row, ["club_name", "canonical_club", "club", "name", "team_name"]) || sourceClub).trim();
      const leaguePosition = integer(first(row, ["league_position", "final_position", "position", "leagueposition"]));
      const promoted = booleanValue(first(row, ["promoted", "is_promoted"]));
      const managers = splitManagers(first(row, ["managers", "manager", "coaches"]));
      map.set(normaliseText(sourceClub), { sourceClub: String(sourceClub), club, leaguePosition, promoted, managers });
    }
    return map;
  }

  function normaliseSourceRow(row, index, season, teamMap) {
    const firstName = first(row, ["first_name", "firstname", "firstName"]);
    const secondName = first(row, ["second_name", "surname", "lastname", "last_name", "secondName"]);
    const knownName = first(row, ["known_name", "knownname"]);
    const name = String(first(row, ["name", "player_name", "player", "full_name"]) || knownName || [firstName, secondName].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim();
    const rawTeam = first(row, ["club", "team_name", "teamname", "team", "team_id"]);
    const sourceClub = teamMap.get(String(rawTeam)) || String(rawTeam ?? "").trim();
    const positionRaw = first(row, ["position", "pos", "element_type", "elementtype"]);
    const position = normalisePosition(positionRaw);
    const finalPriceRaw = first(row, ["finalprice", "final_price", "now_cost", "nowcost", "price"]);
    const costChangeRaw = first(row, ["cost_change_start", "costchangestart"]);
    const finalPrice = priceValue(finalPriceRaw);
    const explicitStarting = first(row, ["startingprice", "starting_price", "start_price", "startprice"]);
    let startingPrice = explicitStarting != null && explicitStarting !== "" ? priceValue(explicitStarting) : null;
    if (startingPrice == null && finalPrice != null && numeric(costChangeRaw) != null) startingPrice = roundOne(finalPrice - numeric(costChangeRaw) / 10);

    const birthDate = String(first(row, ["dateofbirth", "date_of_birth", "birth_date", "birthdate"]) || row.bio?.dateOfBirth || "").trim() || null;
    const regionId = integer(first(row, ["regionid", "region_id", "region"])) ?? integer(row.bio?.regionId);
    const ageFromRow = integer(first(row, ["ageatseasonstart", "age_at_season_start", "age"]));
    const ageAtSeasonStart = ageFromRow ?? calculateSeasonAge(birthDate, season);
    const sourceId = String(first(row, ["opta_code", "optacode", "code", "playerid", "player_id", "id"]) || row.playerId || "").trim();

    return {
      rowIndex: index + 1,
      raw: row,
      name,
      nameKey: normaliseText(name),
      suggestedPlayerId: slugify(row.playerId || name),
      sourceId,
      birthDate,
      regionId,
      season,
      sourceClub,
      clubKey: normaliseText(sourceClub),
      position,
      points: whole(first(row, ["points", "total_points", "totalpoints"])),
      minutes: whole(first(row, ["minutes", "mins"])),
      goals: whole(first(row, ["goals", "goals_scored", "goalsscored"])),
      assists: whole(first(row, ["assists"])),
      cleanSheets: whole(first(row, ["cleansheets", "clean_sheets"])),
      bonus: whole(first(row, ["bonus"])),
      saves: whole(first(row, ["saves"])),
      goalsConceded: whole(first(row, ["goalsconceded", "goals_conceded"])),
      yellowCards: whole(first(row, ["yellowcards", "yellow_cards"])),
      redCards: whole(first(row, ["redcards", "red_cards"])),
      startingPrice,
      finalPrice,
      ageAtSeasonStart
    };
  }

  function seedClubMetadata() {
    state.clubMetadata.clear();
    const clubKeys = [...new Set(state.normalisedRows.map(row => row.clubKey).filter(Boolean))].sort();
    for (const key of clubKeys) {
      const sample = state.normalisedRows.find(row => row.clubKey === key);
      const supplied = state.metadataMap.get(key) || state.metadataMap.get(normaliseText(sample?.sourceClub));
      state.clubMetadata.set(key, {
        sourceClub: sample?.sourceClub || "Unknown",
        club: supplied?.club || sample?.sourceClub || "",
        leaguePosition: supplied?.leaguePosition ?? null,
        promoted: supplied?.promoted ?? false,
        managers: supplied?.managers || []
      });
    }
  }

  function renderClubMetadata() {
    const entries = [...state.clubMetadata.entries()];
    elements.importClubMetadataRows.innerHTML = entries.map(([key, meta]) => `
      <tr data-club-key="${escapeHtml(key)}">
        <td>${escapeHtml(meta.sourceClub)}</td>
        <td><input class="club-name-input" type="text" value="${escapeHtml(meta.club)}" aria-label="Club name for ${escapeHtml(meta.sourceClub)}"></td>
        <td><input class="club-position-input" type="number" min="1" max="20" value="${meta.leaguePosition ?? ""}" aria-label="Final position for ${escapeHtml(meta.sourceClub)}"></td>
        <td class="promoted-cell"><input class="club-promoted-input" type="checkbox" ${meta.promoted ? "checked" : ""} aria-label="${escapeHtml(meta.sourceClub)} promoted"></td>
        <td><input class="club-managers-input" type="text" value="${escapeHtml(meta.managers.join(", "))}" placeholder="Manager One, Manager Two" aria-label="Managers for ${escapeHtml(meta.sourceClub)}"></td>
      </tr>`).join("");
    updateClubMetadataStatus();
  }

  function onMetadataEdit(event) {
    const row = event.target.closest("tr[data-club-key]");
    if (!row) return;
    const key = row.dataset.clubKey;
    const meta = state.clubMetadata.get(key);
    if (!meta) return;
    meta.club = row.querySelector(".club-name-input").value.trim();
    meta.leaguePosition = integer(row.querySelector(".club-position-input").value);
    meta.promoted = row.querySelector(".club-promoted-input").checked;
    meta.managers = splitManagers(row.querySelector(".club-managers-input").value);
    state.ready = false;
    elements.downloadImportPackBtn.disabled = true;
    updateClubMetadataStatus();
  }

  function updateClubMetadataStatus() {
    const requireManagers = elements.importRequireManagers.checked;
    const values = [...state.clubMetadata.values()];
    const ready = values.filter(meta => meta.club && between(meta.leaguePosition, 1, 20) && (!requireManagers || meta.managers.length)).length;
    elements.importClubMetadataStatus.textContent = `${ready} of ${values.length} clubs ready`;
    elements.importClubMetadataStatus.classList.toggle("ready-chip", Boolean(values.length && ready === values.length));
  }

  async function buildImportPreview() {
    if (!state.parsed) return showImportError("Read the import files first.");
    pullMetadataFromTable();
    state.ready = false;
    state.workspace = null;
    state.regression = [];
    elements.downloadImportPackBtn.disabled = true;
    elements.importDownloadStatus.textContent = "";
    setCentreStatus("Building preview…", "pending");
    elements.importActionStatus.textContent = "Matching footballers without changing the loaded database…";

    try {
      const base = getSelectedBaseDatabase();
      const preview = buildWorkspace(base);
      state.workspace = preview.database;
      state.conflicts = preview.conflicts;
      state.quarantine = preview.quarantine;
      renderPreview(preview);
      elements.importPreviewPanel.classList.remove("hidden");
      await runRegressionChecks();
      elements.importActionStatus.textContent = state.ready
        ? "Preview passed every safety gate. The protected upload package is ready."
        : "Preview built. Resolve the highlighted items before using the database.";
    } catch (error) {
      showImportError(error instanceof Error ? error.message : String(error));
    }
  }

  function getSelectedBaseDatabase() {
    if (elements.importBaseDatabase.value === "auto-repaired") {
      const repaired = window.FPL_AUTOMATIC_DATABASE_REPAIR?.getWorkspace?.();
      if (!Array.isArray(repaired) || !repaired.length) throw new Error("Run Phase 9 automatic repair first, or choose the current loaded players.js as the base.");
      return cloneData(repaired);
    }
    return cloneData(originalPlayers);
  }

  function buildWorkspace(base) {
    const database = cloneData(base);
    const byName = new Map();
    const byId = new Map(database.map(player => [player.playerId, player]));
    database.forEach(player => {
      const key = normaliseText(player.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(player);
    });

    const conflicts = [], quarantine = [], additions = [];
    let matched = 0, newPlayers = 0;
    const reservedIds = new Set(database.map(player => player.playerId));

    for (const row of state.normalisedRows) {
      const validation = validateNormalisedRow(row);
      if (validation.length) {
        quarantine.push({ row, reason: validation.join("; ") });
        continue;
      }
      const meta = state.clubMetadata.get(row.clubKey);
      if (!meta || !meta.club || !between(meta.leaguePosition, 1, 20)) {
        quarantine.push({ row, reason: `Club metadata is incomplete for ${row.sourceClub || "an unknown club"}.` });
        continue;
      }
      if (elements.importRequireManagers.checked && !meta.managers.length) {
        quarantine.push({ row, reason: `Manager metadata is missing for ${meta.club}.` });
        continue;
      }

      const candidates = byName.get(row.nameKey) || [];
      let target = null;
      const decisionKey = conflictKey(row);
      const existingDecision = state.decisions.get(decisionKey);

      if (existingDecision) {
        if (existingDecision === "quarantine") {
          quarantine.push({ row, reason: "Manually quarantined during identity review." });
          continue;
        }
        if (existingDecision === "new") target = null;
        else target = byId.get(existingDecision) || null;
      } else if (candidates.length === 1 && identityCompatible(candidates[0], row)) {
        target = candidates[0];
      } else if (candidates.length === 0) {
        target = null;
      } else {
        conflicts.push({ key: decisionKey, row, candidates });
        continue;
      }

      const record = createSeasonRecord(row, meta);
      if (target) {
        if (target.seasons.some(seasonRecord => seasonRecord.season === row.season)) {
          quarantine.push({ row, reason: `${target.name} already has a ${row.season} season record.` });
          continue;
        }
        target.seasons.push(record);
        target.seasons.sort(compareSeasonsDescending);
        enrichBio(target, row);
        matched += 1;
      } else {
        const playerId = uniquePlayerId(row.suggestedPlayerId || row.name, reservedIds);
        reservedIds.add(playerId);
        const player = { playerId, name: row.name, seasons: [record], bio: {} };
        enrichBio(player, row);
        database.push(player);
        byId.set(playerId, player);
        if (!byName.has(row.nameKey)) byName.set(row.nameKey, []);
        byName.get(row.nameKey).push(player);
        newPlayers += 1;
      }
      additions.push({ row, targetId: target?.playerId || null });
    }

    database.sort((a, b) => a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId));
    return { database, conflicts, quarantine, additions, matched, newPlayers, projectedSeasons: countSeasons(database) };
  }

  function validateNormalisedRow(row) {
    const errors = [];
    if (!row.name) errors.push("Missing footballer name");
    if (!row.clubKey) errors.push("Missing club/team");
    if (!VALID_POSITIONS.has(row.position)) errors.push("Invalid or missing position");
    for (const field of REQUIRED_NUMERIC) {
      if (!Number.isFinite(row[field]) || row[field] < 0) errors.push(`Invalid ${field}`);
    }
    for (const field of OPTIONAL_NUMERIC) {
      const value = row[field];
      if (value == null || value === "") continue;
      if (!Number.isFinite(value) || value < 0) errors.push(`Invalid optional ${field}`);
    }
    if (Number.isFinite(row.minutes) && row.minutes > 4500) errors.push("Minutes exceed a plausible Premier League season");
    if (Number.isFinite(row.startingPrice) && !between(row.startingPrice, 3.5, 16)) errors.push("Starting price outside £3.5m–£16.0m");
    if (Number.isFinite(row.finalPrice) && !between(row.finalPrice, 3.5, 16)) errors.push("Final price outside £3.5m–£16.0m");
    return [...new Set(errors)];
  }

  function createSeasonRecord(row, meta) {
    const position = meta.leaguePosition;
    return {
      season: row.season,
      club: meta.club,
      position: row.position,
      points: row.points,
      minutes: row.minutes,
      goals: row.goals,
      assists: row.assists,
      cleanSheets: row.cleanSheets,
      bonus: row.bonus,
      ...(Number.isFinite(row.saves) ? { saves: row.saves } : {}),
      ...(Number.isFinite(row.goalsConceded) ? { goalsConceded: row.goalsConceded } : {}),
      ...(Number.isFinite(row.yellowCards) ? { yellowCards: row.yellowCards } : {}),
      ...(Number.isFinite(row.redCards) ? { redCards: row.redCards } : {}),
      ...(Number.isFinite(row.startingPrice) ? { startingPrice: roundOne(row.startingPrice) } : {}),
      ...(Number.isFinite(row.finalPrice) ? { finalPrice: roundOne(row.finalPrice) } : {}),
      managers: [...meta.managers],
      leaguePosition: position,
      champions: position === 1,
      topFour: position <= 4,
      bottomHalf: position >= 11,
      relegated: position >= 18,
      promoted: Boolean(meta.promoted),
      ageAtSeasonStart: row.ageAtSeasonStart ?? null,
      source: {
        name: elements.importSourceName.value.trim(),
        reference: elements.importSourceUrl.value.trim() || state.sourceFiles.dataset?.name || "",
        trust: elements.importSourceTrust.value,
        importedAt: new Date().toISOString().slice(0, 10),
        sourceId: row.sourceId || null
      }
    };
  }

  function enrichBio(player, row) {
    if (!player.bio || typeof player.bio !== "object") player.bio = {};
    if (!player.bio.dateOfBirth && validDate(row.birthDate)) player.bio.dateOfBirth = row.birthDate;
    if (player.bio.regionId == null && Number.isInteger(row.regionId)) player.bio.regionId = row.regionId;
  }

  function renderPreview(preview) {
    elements.importSourceRows.textContent = state.normalisedRows.length.toLocaleString();
    elements.importMatchedPlayers.textContent = preview.matched.toLocaleString();
    elements.importNewPlayers.textContent = preview.newPlayers.toLocaleString();
    elements.importConflictCount.textContent = preview.conflicts.length.toLocaleString();
    elements.importQuarantineCount.textContent = preview.quarantine.length.toLocaleString();
    elements.importProjectedSeasons.textContent = preview.projectedSeasons.toLocaleString();

    const warnings = [];
    if (preview.conflicts.length) warnings.push(warningHtml("Identity decisions needed", `${preview.conflicts.length} row(s) match more than one possible identity or conflict with birth data.`));
    if (preview.quarantine.length) warnings.push(warningHtml("Rows quarantined", `${preview.quarantine.length} row(s) will not be imported. They remain in the package report.`));
    if (elements.importSourceTrust.value === "unverified") warnings.push(warningHtml("Unverified source", "The importer will create a review package only until the source confidence is upgraded."));
    elements.importWarnings.innerHTML = warnings.join("");

    renderConflicts(preview.conflicts);
  }

  function renderConflicts(conflicts) {
    elements.importConflictPanel.classList.toggle("hidden", !conflicts.length);
    elements.importConflictList.innerHTML = conflicts.map(conflict => {
      const options = [
        `<option value="">Choose an action…</option>`,
        ...conflict.candidates.map(player => `<option value="${escapeHtml(player.playerId)}">Merge into ${escapeHtml(player.name)} (${escapeHtml(player.playerId)})</option>`),
        `<option value="new">Create a separate new footballer</option>`,
        `<option value="quarantine">Quarantine this row</option>`
      ].join("");
      return `<article class="import-conflict-card" data-conflict-key="${escapeHtml(conflict.key)}">
        <div><strong>${escapeHtml(conflict.row.name)} · ${escapeHtml(conflict.row.sourceClub)}</strong>
          <p>${escapeHtml(conflict.row.season)} · ${escapeHtml(conflict.row.position)} · ${conflict.row.points} points</p>
          <p>${conflict.row.birthDate ? `Birth date: ${escapeHtml(conflict.row.birthDate)}` : "No birth date supplied"}</p></div>
        <label>Identity decision<select>${options}</select></label>
      </article>`;
    }).join("");
  }

  function onConflictDecision(event) {
    const card = event.target.closest("[data-conflict-key]");
    if (!card || event.target.tagName !== "SELECT") return;
    const value = event.target.value;
    if (value) state.decisions.set(card.dataset.conflictKey, value);
    else state.decisions.delete(card.dataset.conflictKey);
    state.ready = false;
    elements.downloadImportPackBtn.disabled = true;
  }

  async function runRegressionChecks() {
    if (!state.workspace) {
      elements.importRegressionList.innerHTML = `<div class="repair-empty-state">Build the preview before running checks.</div>`;
      return;
    }
    setCentreStatus("Running checks…", "pending");
    elements.runImportChecksBtn.disabled = true;
    const results = [];
    try {
      const unresolved = state.conflicts.filter(conflict => !state.decisions.has(conflict.key)).length;
      addCheck(results, unresolved === 0 ? "pass" : "fail", "No unresolved identity matches", unresolved ? `${unresolved} ambiguous row(s) still need a decision.` : "Every imported row has a deterministic identity outcome.", true);

      const metadataIssues = validateAllClubMetadata();
      addCheck(results, metadataIssues.length ? "fail" : "pass", "Club metadata is complete", metadataIssues.length ? metadataIssues.slice(0, 4).join(" · ") : `${state.clubMetadata.size} clubs have final positions${elements.importRequireManagers.checked ? " and managers" : ""}.`, true);

      const structural = findStructuralIssues(state.workspace);
      addCheck(results, structural.length ? "fail" : "pass", "No structural database blockers", structural.length ? `${structural.length} structural problem(s) found after the import.` : `${state.workspace.length.toLocaleString()} players and ${countSeasons(state.workspace).toLocaleString()} player-seasons are structurally valid.`, true);

      const sourceRecords = findImportedRecords(state.workspace, normaliseSeasonLabel(elements.importSeasonLabel.value));
      const tracked = sourceRecords.filter(record => record.source?.name && record.source?.trust).length;
      addCheck(results, tracked === sourceRecords.length && tracked > 0 ? "pass" : "fail", "Every imported season is source-tracked", `${tracked} of ${sourceRecords.length} imported records contain source metadata.`, true);

      const promptResult = testPromptLibrary(state.workspace);
      addCheck(results, promptResult.failed.length ? "fail" : "pass", "All enabled prompts still work", promptResult.failed.length ? `${promptResult.failed.length} prompt(s) failed: ${promptResult.failed.slice(0, 4).join(", ")}` : `${promptResult.checked} enabled prompts were evaluated successfully.`, true);

      const liveResult = await testLiveChallenge(state.workspace);
      if (!liveResult.challenge) addCheck(results, "warn", "Live challenge could not be fetched", liveResult.error || "The live challenge will need checking after upload.", false);
      else {
        const expected = Number(liveResult.challenge.perfectScore) || 0;
        const status = liveResult.possible && liveResult.score === expected ? "pass" : "fail";
        addCheck(results, status, "Live challenge and perfect score are preserved", status === "pass" ? `${liveResult.score.toLocaleString()} points still matches todays-challenge.js.` : liveResult.possible ? `The imported database calculates ${liveResult.score.toLocaleString()}, but todays-challenge.js stores ${expected.toLocaleString()}.` : liveResult.reason, true);
      }

      const season = normaliseSeasonLabel(elements.importSeasonLabel.value);
      const collisions = state.workspace.flatMap(player => player.seasons.filter(record => record.season === season).map(record => `${player.playerId}|${record.season}`));
      addCheck(results, new Set(collisions).size === collisions.length ? "pass" : "fail", "No duplicate player-season keys", `${collisions.length.toLocaleString()} records exist for ${season}.`, true);

      const trust = elements.importSourceTrust.value;
      addCheck(results, trust === "unverified" ? "warn" : "pass", "Source confidence recorded", trust === "unverified" ? "Unverified imports remain review-only." : `The source is marked ${trust}.`, trust === "unverified");

      state.regression = results;
      renderRegression(results);
      state.ready = results.every(result => result.state === "pass" || !result.blocking);
      elements.downloadImportPackBtn.disabled = !state.workspace;
      elements.downloadImportPackBtn.textContent = state.ready ? "Download upload-ready package" : "Download review package";
      elements.importDownloadExplanation.textContent = state.ready
        ? "All blocking checks passed. Upload only UPLOAD/players.js after keeping the original backup."
        : "The package is marked REVIEW ONLY. Do not replace players.js until all blocking checks pass.";
      setCentreStatus(state.ready ? "Upload ready" : "Review required", state.ready ? "ready" : "blocked");
      elements.importDownloadStatus.textContent = state.ready ? "The protected package is ready." : "A review package can be downloaded, but it is not safe to upload yet.";
    } finally {
      elements.runImportChecksBtn.disabled = false;
    }
  }

  function renderRegression(results) {
    elements.importRegressionList.innerHTML = results.map(result => `<div class="repair-regression-row ${result.state}">
      <span class="regression-icon">${result.state === "pass" ? "✓" : result.state === "warn" ? "△" : "!"}</span>
      <div><strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.detail)}</span></div>
    </div>`).join("");
  }

  async function downloadImportPack() {
    if (!state.workspace) return;
    const season = normaliseSeasonLabel(elements.importSeasonLabel.value);
    const manifest = {
      phase: 10,
      status: state.ready ? "UPLOAD READY" : "REVIEW ONLY",
      createdAt: new Date().toISOString(),
      season,
      source: {
        name: elements.importSourceName.value.trim(),
        reference: elements.importSourceUrl.value.trim(),
        trust: elements.importSourceTrust.value,
        files: state.sourceFiles
      },
      before: { players: originalPlayers.length, seasons: countSeasons(originalPlayers) },
      after: { players: state.workspace.length, seasons: countSeasons(state.workspace) },
      conflicts: state.conflicts.length,
      quarantine: state.quarantine.length,
      regression: state.regression
    };
    const files = [
      { name: `${state.ready ? "UPLOAD" : "REVIEW"}/players.js`, content: serialisePlayers(state.workspace, `FPL database with protected ${season} import`) },
      { name: "BACKUPS/players-before-import.js", content: serialisePlayers(originalPlayers, "Database backup before Phase 10 import") },
      { name: "REPORTS/import-manifest.json", content: JSON.stringify(manifest, null, 2) + "\n" },
      { name: "REPORTS/quarantined-rows.json", content: JSON.stringify(state.quarantine, null, 2) + "\n" },
      { name: "REPORTS/identity-decisions.json", content: JSON.stringify(Object.fromEntries(state.decisions), null, 2) + "\n" },
      { name: "README-UPLOAD.txt", content: buildReadme(manifest) }
    ];
    const zipBuilder = window.FPL_STUDIO_ZIP?.buildZipBlob;
    if (typeof zipBuilder !== "function") {
      downloadBlob(`players-${season.replace("/", "-")}-${state.ready ? "upload" : "review"}.js`, new Blob([serialisePlayers(state.workspace, `Phase 10 ${season} import`)], { type: "text/javascript" }));
      elements.importDownloadStatus.textContent = "ZIP support was unavailable, so the database JavaScript was downloaded directly.";
      return;
    }
    downloadBlob(`fpl-phase-10-import-${season.replace("/", "-")}-${dateStamp()}.zip`, zipBuilder(files));
    elements.importDownloadStatus.textContent = state.ready ? "Upload-ready import package downloaded." : "Review-only import package downloaded. Do not upload its players.js yet.";
  }

  function buildReadme(manifest) {
    return `FPL CHALLENGE STUDIO PHASE 10 — HISTORICAL IMPORT\n\nSTATUS: ${manifest.status}\nSEASON: ${manifest.season}\nSOURCE: ${manifest.source.name}\nCONFIDENCE: ${manifest.source.trust}\n\nBEFORE\nPlayers: ${manifest.before.players}\nPlayer-seasons: ${manifest.before.seasons}\n\nAFTER\nPlayers: ${manifest.after.players}\nPlayer-seasons: ${manifest.after.seasons}\nQuarantined rows: ${manifest.quarantine}\nIdentity conflicts: ${manifest.conflicts}\n\n${manifest.status === "UPLOAD READY" ? "UPLOAD STEPS\n1. Keep BACKUPS/players-before-import.js.\n2. Upload only UPLOAD/players.js to the root of GitHub.\n3. Replace the existing players.js.\n4. Wait for deployment and hard-refresh the live game.\n5. Test one full challenge.\n" : "REVIEW ONLY\nDo not upload the generated players.js. Resolve every blocking check in the Import Centre, rebuild the preview and download again.\n"}`;
  }

  function validateAllClubMetadata() {
    const errors = [];
    const requireManagers = elements.importRequireManagers.checked;
    for (const meta of state.clubMetadata.values()) {
      if (!meta.club) errors.push(`${meta.sourceClub}: missing canonical club name`);
      if (!between(meta.leaguePosition, 1, 20)) errors.push(`${meta.sourceClub}: invalid final position`);
      if (requireManagers && !meta.managers.length) errors.push(`${meta.sourceClub}: missing manager`);
    }
    return errors;
  }

  function findStructuralIssues(database) {
    const issues = [];
    const ids = new Set();
    for (const player of database) {
      if (!player.playerId || ids.has(player.playerId)) issues.push(`Duplicate/missing player ID: ${player.playerId || player.name}`);
      ids.add(player.playerId);
      const seasons = new Set();
      for (const record of player.seasons || []) {
        if (seasons.has(record.season)) issues.push(`${player.name}: duplicate ${record.season}`);
        seasons.add(record.season);
        if (!VALID_POSITIONS.has(record.position)) issues.push(`${player.name}: invalid position`);
        if (!record.club) issues.push(`${player.name}: missing club`);
        for (const field of REQUIRED_NUMERIC) if (!Number.isFinite(record[field]) || record[field] < 0) issues.push(`${player.name}: invalid ${field}`);
        for (const field of OPTIONAL_NUMERIC) {
          const value = record[field];
          if (value == null || value === "") continue;
          if (!Number.isFinite(value) || value < 0) issues.push(`${player.name}: invalid optional ${field}`);
        }
      }
    }
    return issues;
  }

  function testPromptLibrary(database) {
    const flat = flattenDatabase(database);
    const enabled = promptLibrary.filter(prompt => prompt && prompt.enabled !== false && typeof prompt.test === "function");
    const failed = [];
    for (const prompt of enabled) {
      try {
        const validPlayers = new Set(flat.filter(record => Number(record?.minutes) > 0 && record.position === prompt.position && prompt.test(record)).map(record => record.playerId));
        if (!validPlayers.size) failed.push(prompt.id);
      } catch { failed.push(prompt.id); }
    }
    return { checked: enabled.length, failed };
  }

  async function testLiveChallenge(database) {
    try {
      let challenge = window.FPL_DAILY_CHALLENGE || null;
      if (!challenge) {
        const response = await fetch(`todays-challenge.js?phase10=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.text();
        challenge = new Function("window", `"use strict";\n${source}\nreturn window.FPL_DAILY_CHALLENGE || null;`)(Object.create(null));
      }
      if (!challenge?.prompts?.length) throw new Error("todays-challenge.js did not provide a valid challenge");
      const perfect = calculatePerfectXI(database, challenge.prompts);
      return { challenge, ...perfect };
    } catch (error) {
      return { challenge: null, error: error instanceof Error ? error.message : String(error) };
    }
  }

  function calculatePerfectXI(database, prompts) {
    const flat = flattenDatabase(database);
    const bestBySlot = prompts.map(prompt => {
      const map = new Map();
      for (const record of flat) {
        if (record.position !== prompt.position) continue;
          if (Number(record?.minutes) <= 0) continue;
        let valid = false;
        try { valid = prompt.test(record); } catch {}
        if (!valid) continue;
        const current = map.get(record.playerId);
        if (!current || record.points > current.points) map.set(record.playerId, record);
      }
      return map;
    });
    const playerIds = [...new Set(bestBySlot.flatMap(map => [...map.keys()]))];
    if (playerIds.length < prompts.length) return { possible: false, reason: "Not enough unique valid footballers." };
    const maxPoints = Math.max(0, ...bestBySlot.flatMap(map => [...map.values()].map(record => record.points)));
    const forbidden = 1_000_000;
    const costs = bestBySlot.map(map => playerIds.map(id => map.has(id) ? maxPoints - map.get(id).points : forbidden));
    const assignment = hungarian(costs);
    if (!assignment || assignment.some((column, row) => !bestBySlot[row].has(playerIds[column]))) return { possible: false, reason: "No unique-player XI exists." };
    const picks = assignment.map((column, slot) => ({ prompt: prompts[slot], record: bestBySlot[slot].get(playerIds[column]) }));
    return { possible: true, picks, score: picks.reduce((sum, pick) => sum + pick.record.points, 0) };
  }

  function hungarian(costs) {
    const rows = costs.length, columns = costs[0]?.length || 0;
    if (!rows || columns < rows) return null;
    const u = new Float64Array(rows + 1), v = new Float64Array(columns + 1);
    const p = new Int32Array(columns + 1), way = new Int32Array(columns + 1);
    for (let i = 1; i <= rows; i += 1) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(columns + 1); minv.fill(Infinity);
      const used = new Uint8Array(columns + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0];
        let delta = Infinity, j1 = 0;
        for (let j = 1; j <= columns; j += 1) if (!used[j]) {
          const cur = costs[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        if (!Number.isFinite(delta)) return null;
        for (let j = 0; j <= columns; j += 1) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0);
    }
    const assignment = new Int32Array(rows); assignment.fill(-1);
    for (let j = 1; j <= columns; j += 1) if (p[j]) assignment[p[j] - 1] = j - 1;
    return [...assignment];
  }

  function pullMetadataFromTable() {
    for (const row of elements.importClubMetadataRows.querySelectorAll("tr[data-club-key]")) {
      const meta = state.clubMetadata.get(row.dataset.clubKey);
      if (!meta) continue;
      meta.club = row.querySelector(".club-name-input").value.trim();
      meta.leaguePosition = integer(row.querySelector(".club-position-input").value);
      meta.promoted = row.querySelector(".club-promoted-input").checked;
      meta.managers = splitManagers(row.querySelector(".club-managers-input").value);
    }
  }

  function resetImporter() {
    state.datasetRows = [];
    state.teamMap.clear();
    state.metadataMap.clear();
    state.clubMetadata.clear();
    state.normalisedRows = [];
    state.conflicts = [];
    state.decisions.clear();
    state.quarantine = [];
    state.workspace = null;
    state.regression = [];
    state.ready = false;
    state.sourceFiles = {};
    state.parsed = false;
    [elements.importDatasetFile, elements.importTeamsFile, elements.importMetadataFile].forEach(input => { if (input) input.value = ""; });
    elements.importDatasetFileStatus.textContent = "No file selected.";
    elements.importTeamsFileStatus.textContent = "No file selected.";
    elements.importMetadataFileStatus.textContent = "No file selected.";
    elements.importClubMetadataRows.innerHTML = "";
    elements.importClubMetadataPanel.classList.add("hidden");
    elements.importPreviewPanel.classList.add("hidden");
    elements.buildImportPreviewBtn.disabled = true;
    elements.downloadImportPackBtn.disabled = true;
    elements.importActionStatus.textContent = "Choose a single-season player dataset to begin.";
    elements.importDownloadStatus.textContent = "";
    setCentreStatus("Waiting for files", "pending");
  }

  function resetPreviewOnly() {
    state.conflicts = [];
    state.decisions.clear();
    state.quarantine = [];
    state.workspace = null;
    state.regression = [];
    state.ready = false;
    state.parsed = false;
    elements.importPreviewPanel.classList.add("hidden");
    elements.downloadImportPackBtn.disabled = true;
    elements.importWarnings.innerHTML = "";
  }

  function identityCompatible(player, row) {
    const existingBirth = player.bio?.dateOfBirth || null;
    if (existingBirth && row.birthDate && existingBirth !== row.birthDate) return false;
    return true;
  }

  function conflictKey(row) { return `${row.rowIndex}|${row.nameKey}|${row.sourceId}|${row.clubKey}`; }
  function uniquePlayerId(value, used) {
    const base = slugify(value) || "imported-player";
    let id = base, counter = 2;
    while (used.has(id)) id = `${base}-${counter++}`;
    return id;
  }
  function compareSeasonsDescending(a, b) { return seasonStartYear(b.season) - seasonStartYear(a.season); }
  function seasonStartYear(value) { return Number(String(value || "").slice(0, 4)) || 0; }
  function findImportedRecords(database, season) { return database.flatMap(player => (player.seasons || []).filter(record => record.season === season)); }
  function flattenDatabase(database) { return database.flatMap(player => (player.seasons || []).map(record => ({ ...record, playerId: player.playerId, name: player.name }))); }
  function countSeasons(database) { return database.reduce((sum, player) => sum + (player.seasons?.length || 0), 0); }
  function serialisePlayers(database, note) { return `/* ${note}. */\nwindow.FPL_PLAYERS = ${JSON.stringify(database)};\n`; }
  function cloneData(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function splitManagers(value) { return String(value || "").split(/[;,|]/).map(item => item.trim()).filter(Boolean); }
  function normaliseText(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function slugify(value) { return normaliseText(value).replace(/\s+/g, "-"); }
  function normalisePosition(value) {
    const raw = String(value ?? "").trim().toUpperCase();
    if (POSITION_BY_TYPE[raw]) return POSITION_BY_TYPE[raw];
    if (["GKP", "GOALKEEPER"].includes(raw)) return "GK";
    if (["D", "DEFENDER"].includes(raw)) return "DEF";
    if (["M", "MIDFIELDER"].includes(raw)) return "MID";
    if (["F", "FW", "FORWARD", "STRIKER"].includes(raw)) return "FWD";
    return VALID_POSITIONS.has(raw) ? raw : "";
  }
  function normaliseSeasonLabel(value) {
    const match = String(value || "").trim().match(/^(\d{4})[\/-](\d{2}|\d{4})$/);
    if (!match) return "";
    const start = Number(match[1]);
    const end = Number(match[2].length === 2 ? String(start).slice(0, 2) + match[2] : match[2]);
    return end === start + 1 ? `${start}/${String(end).slice(-2)}` : "";
  }
  function calculateSeasonAge(date, season) {
    if (!validDate(date)) return null;
    const birth = new Date(`${date}T00:00:00Z`);
    const startYear = seasonStartYear(season);
    if (!startYear) return null;
    const seasonStart = new Date(Date.UTC(startYear, 7, 1));
    let age = seasonStart.getUTCFullYear() - birth.getUTCFullYear();
    if (seasonStart.getUTCMonth() < birth.getUTCMonth() || (seasonStart.getUTCMonth() === birth.getUTCMonth() && seasonStart.getUTCDate() < birth.getUTCDate())) age -= 1;
    return between(age, 15, 50) ? age : null;
  }
  function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)); }
  function first(object, keys) { for (const key of keys) if (object?.[key] != null && object[key] !== "") return object[key]; return null; }
  function numeric(value) { const number = Number(String(value ?? "").replace(/[^0-9.+-]/g, "")); return Number.isFinite(number) ? number : null; }
  function whole(value) { return Math.max(0, Math.round(numeric(value) ?? 0)); }
  function integer(value) { const number = numeric(value); return number == null ? null : Math.round(number); }
  function priceValue(value) { const number = numeric(value); if (number == null) return null; return roundOne(number > 30 ? number / 10 : number); }
  function roundOne(value) { return Math.round(Number(value) * 10) / 10; }
  function booleanValue(value) { if (typeof value === "boolean") return value; return ["1", "true", "yes", "y"].includes(String(value || "").trim().toLowerCase()); }
  function between(value, min, max) { return Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max; }
  function fileDescriptor(file) { return { name: file.name, size: file.size, type: file.type || "", lastModified: new Date(file.lastModified).toISOString() }; }
  function formatBytes(value) { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 ** 2).toFixed(1)} MB`; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
  function warningHtml(title, detail) { return `<div class="warning"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`; }
  function addCheck(results, stateValue, title, detail, blocking) { results.push({ state: stateValue, title, detail, blocking: blocking !== false }); }
  function showImportError(message) { setCentreStatus("Needs attention", "blocked"); elements.importActionStatus.textContent = message; }
  function setCentreStatus(text, status) { elements.importCentreStatus.textContent = text; elements.importCentreStatus.className = `audit-status-chip ${status}`; }
  function dateStamp() { return new Date().toISOString().slice(0, 10); }
  function downloadBlob(filename, blob) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
})();

/* ===== END admin-phase10.js ===== */

/* ===== BEGIN admin-phase11.js ===== */
/* FPL Challenge Studio Phase 11 — conservative player identity consolidation. */
(() => {
  "use strict";

  const originalPlayers = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const promptLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const VALID_POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  const CORE_SEASON_FIELDS = ["club", "position", "points", "minutes", "goals", "assists", "cleanSheets", "bonus", "saves", "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice"];
  const NAME_PARTICLES = new Set(["de", "da", "do", "dos", "das", "del", "della", "di", "van", "von", "der", "den", "la", "le", "el", "al", "bin", "ibn", "st", "saint"]);
  const NICKNAME_GROUPS = [
    ["matthew", "matty", "matt"], ["robert", "rob", "robbie", "bob", "bobby"], ["alexander", "alex"], ["benjamin", "ben"],
    ["nicholas", "nick", "nicky"], ["christopher", "chris"], ["jonathan", "jon", "johnny"], ["joseph", "joe", "joey"],
    ["samuel", "sam", "sammy"], ["daniel", "dan", "danny"], ["edward", "ed", "eddie"], ["william", "will", "bill", "billy"],
    ["james", "jim", "jimmy"], ["thomas", "tom", "tommy"], ["anthony", "tony"], ["michael", "mike", "mikey"],
    ["patrick", "pat", "paddy"], ["timothy", "tim"], ["andrew", "andy"], ["charles", "charlie"],
    ["frederick", "fred", "freddie"], ["stephen", "steven", "steve"], ["philip", "phil"], ["nathaniel", "nathan"],
    ["theodore", "theo"], ["dominic", "dom"], ["maximilian", "max"]
  ];
  const NICKNAME_MAP = new Map();
  NICKNAME_GROUPS.forEach(group => group.forEach(name => NICKNAME_MAP.set(name, new Set(group))));

  const state = {
    candidates: [], selected: new Set(), workspace: null, mergeReport: [], checks: [], ready: false, liveChallenge: null
  };
  const elements = {};

  window.addEventListener("load", initialise, { once: true });

  function initialise() {
    [
      "identityCentreStatus", "identityPlayersScanned", "identitySafeCount", "identityReviewCount", "identityBlockedCount",
      "identityProjectedPlayers", "identityProjectedSeasons", "runIdentityScanBtn", "selectSafeIdentityBtn", "applyIdentityMergesBtn",
      "resetIdentityBtn", "identityActionStatus", "identityResultsPanel", "identityConfidenceFilter", "identitySearchInput",
      "identityShownCount", "identityCandidateList", "identityRegressionPanel", "runIdentityChecksBtn", "identityRegressionList",
      "identityDownloadPanel", "identityDownloadExplanation", "downloadIdentityPackBtn", "identityDownloadStatus"
    ].forEach(id => elements[id] = document.getElementById(id));
    if (!elements.runIdentityScanBtn) return;

    elements.runIdentityScanBtn.addEventListener("click", runScan);
    elements.selectSafeIdentityBtn.addEventListener("click", selectSafeCandidates);
    elements.applyIdentityMergesBtn.addEventListener("click", buildWorkspace);
    elements.resetIdentityBtn.addEventListener("click", resetWorkspace);
    elements.identityConfidenceFilter.addEventListener("change", renderCandidates);
    elements.identitySearchInput.addEventListener("input", renderCandidates);
    elements.identityCandidateList.addEventListener("change", onCandidateToggle);
    elements.runIdentityChecksBtn.addEventListener("click", runRegressionChecks);
    elements.downloadIdentityPackBtn.addEventListener("click", downloadPack);

    elements.identityPlayersScanned.textContent = originalPlayers.length.toLocaleString();
    elements.identityProjectedPlayers.textContent = originalPlayers.length.toLocaleString();
    elements.identityProjectedSeasons.textContent = seasonCount(originalPlayers).toLocaleString();

    window.FPL_STUDIO_PHASE11 = Object.freeze({
      scan: runScan,
      buildWorkspace,
      runChecks: runRegressionChecks,
      getCandidates: () => clone(state.candidates),
      getWorkspace: () => clone(state.workspace),
      getReport: () => clone(state.mergeReport)
    });
  }

  function runScan() {
    setStatus("Scanning names, aliases, clubs, seasons and birth dates…");
    state.candidates = findCandidates(originalPlayers);
    state.selected = new Set(state.candidates.filter(candidate => candidate.confidence === "safe").map(candidate => candidate.id));
    state.workspace = null;
    state.mergeReport = [];
    state.ready = false;
    updateSummary();
    elements.identityResultsPanel.classList.remove("hidden");
    elements.identityRegressionPanel.classList.add("hidden");
    elements.identityDownloadPanel.classList.add("hidden");
    elements.selectSafeIdentityBtn.disabled = !state.candidates.some(candidate => candidate.confidence === "safe");
    elements.applyIdentityMergesBtn.disabled = !state.selected.size;
    elements.identityCentreStatus.textContent = `${state.candidates.length} candidates`;
    renderCandidates();
    const safe = state.candidates.filter(candidate => candidate.confidence === "safe").length;
    const review = state.candidates.filter(candidate => candidate.confidence === "review").length;
    setStatus(`Scan complete: ${safe} safe merges and ${review} review candidates. Ambiguous same-name footballers remain protected.`);
  }

  function findCandidates(database) {
    const profiles = database.map(player => buildProfile(player));
    const pairKeys = new Set();
    const blocks = new Map();
    const addBlock = (key, index) => {
      if (!key) return;
      if (!blocks.has(key)) blocks.set(key, []);
      blocks.get(key).push(index);
    };
    profiles.forEach((profile, index) => {
      addBlock(`surname:${profile.lastToken}`, index);
      addBlock(`name:${profile.normalName}`, index);
      if (profile.dob) addBlock(`dob:${profile.dob}`, index);
    });

    const candidates = [];
    for (const indexes of blocks.values()) {
      if (indexes.length < 2) continue;
      for (let left = 0; left < indexes.length; left += 1) {
        for (let right = left + 1; right < indexes.length; right += 1) {
          const aIndex = indexes[left], bIndex = indexes[right];
          const key = aIndex < bIndex ? `${aIndex}:${bIndex}` : `${bIndex}:${aIndex}`;
          if (pairKeys.has(key)) continue;
          pairKeys.add(key);
          const result = evaluatePair(profiles[aIndex], profiles[bIndex]);
          if (result) candidates.push(result);
        }
      }
    }
    return candidates.sort((a, b) => confidenceRank(a.confidence) - confidenceRank(b.confidence) || b.score - a.score || a.left.name.localeCompare(b.left.name));
  }

  function buildProfile(player) {
    const tokens = tokenise(player.name);
    const years = player.seasons.map(season => seasonYear(season.season)).filter(Number.isFinite);
    return {
      player,
      id: player.playerId,
      name: player.name,
      normalName: normalise(player.name),
      tokens,
      firstToken: tokens[0] || "",
      lastToken: tokens.at(-1) || "",
      surnameTokens: surnameTokens(tokens),
      dob: player.bio?.dateOfBirth || "",
      clubs: new Set(player.seasons.map(season => season.club).filter(Boolean)),
      positions: new Set(player.seasons.map(season => season.position).filter(Boolean)),
      years,
      aliases: Array.isArray(player.aliases) ? player.aliases : []
    };
  }

  function evaluatePair(left, right) {
    const sameNormalName = left.normalName === right.normalName;
    const sameDob = Boolean(left.dob && right.dob && left.dob === right.dob);
    const conflictingDob = Boolean(left.dob && right.dob && left.dob !== right.dob);
    const sharedClub = intersects(left.clubs, right.clubs);
    const adjacent = areAdjacent(left.years, right.years);
    const firstNamesMatch = firstNameEquivalent(left.firstToken, right.firstToken);
    const lastNamesMatch = left.lastToken && left.lastToken === right.lastToken;
    const contained = nameContained(left.tokens, right.tokens);
    const similarity = similarityRatio(left.normalName, right.normalName);
    const compatible = seasonsCompatible(left.player, right.player);
    const mojibakePair = normalise(fixCommonEncoding(left.name)) === normalise(fixCommonEncoding(right.name));
    const reasons = [];
    let score = 0;

    if (sameDob) { score += 5; reasons.push("same birth date"); }
    if (firstNamesMatch && lastNamesMatch) { score += 5; reasons.push("nickname/full first name and same surname"); }
    if (contained) { score += 4; reasons.push("one name is contained in the other"); }
    if (similarity >= .9) { score += 4; reasons.push(`very similar spelling (${Math.round(similarity * 100)}%)`); }
    else if (similarity >= .74) { score += 2; reasons.push(`similar spelling (${Math.round(similarity * 100)}%)`); }
    if (sharedClub) { score += 3; reasons.push("shared club history"); }
    if (adjacent) { score += 1; reasons.push("adjacent seasons"); }
    if (mojibakePair && !sameNormalName) { score += 5; reasons.push("encoding-only spelling difference"); }
    if (!compatible) { score -= 12; reasons.push("conflicting record in the same season"); }
    if (conflictingDob) { score -= 8; reasons.push("different birth dates"); }

    let confidence = null;
    if (!compatible || conflictingDob) {
      if (sameNormalName || score >= 7) confidence = "blocked";
    } else if (
      (sameDob && sharedClub && (contained || similarity >= .72)) ||
      (firstNamesMatch && lastNamesMatch && sharedClub && adjacent) ||
      (mojibakePair && sharedClub) ||
      (contained && sharedClub && adjacent && left.firstToken === right.firstToken)
    ) {
      confidence = "safe";
    } else if (sameNormalName && !sameDob && !sharedClub) {
      confidence = "blocked";
      reasons.push("same name without enough identity evidence");
    } else if (score >= 11 && (sharedClub || sameDob || adjacent)) {
      confidence = "review";
    }
    if (!confidence) return null;

    const canonical = chooseCanonical([left.player, right.player]);
    return {
      id: `${left.id}::${right.id}`,
      left: summary(left.player),
      right: summary(right.player),
      confidence,
      score,
      reasons: [...new Set(reasons)],
      canonicalId: canonical.playerId,
      canonicalName: canonical.name,
      warning: confidence === "blocked" ? "This pair is deliberately protected from automatic merging." : ""
    };
  }

  function onCandidateToggle(event) {
    const checkbox = event.target.closest("[data-identity-candidate]");
    if (!checkbox) return;
    if (checkbox.checked) state.selected.add(checkbox.dataset.identityCandidate);
    else state.selected.delete(checkbox.dataset.identityCandidate);
    elements.applyIdentityMergesBtn.disabled = !state.selected.size;
  }

  function selectSafeCandidates() {
    state.selected = new Set(state.candidates.filter(candidate => candidate.confidence === "safe").map(candidate => candidate.id));
    renderCandidates();
    elements.applyIdentityMergesBtn.disabled = !state.selected.size;
    setStatus(`${state.selected.size} safe merges selected.`);
  }

  function renderCandidates() {
    const filter = elements.identityConfidenceFilter.value;
    const query = normalise(elements.identitySearchInput.value);
    const filtered = state.candidates.filter(candidate => {
      if (filter !== "all" && candidate.confidence !== filter) return false;
      if (!query) return true;
      const haystack = normalise(`${candidate.left.name} ${candidate.right.name} ${candidate.left.id} ${candidate.right.id} ${candidate.left.clubs.join(" ")} ${candidate.right.clubs.join(" ")}`);
      return haystack.includes(query);
    });
    elements.identityShownCount.textContent = `${filtered.length} candidate${filtered.length === 1 ? "" : "s"}`;
    elements.identityCandidateList.innerHTML = filtered.length ? filtered.map(candidateCard).join("") : '<div class="identity-empty">No identity candidates match these filters.</div>';
  }

  function candidateCard(candidate) {
    const checked = state.selected.has(candidate.id);
    const disabled = candidate.confidence === "blocked";
    return `<article class="identity-card ${candidate.confidence}">
      <div class="identity-card-head">
        <input class="identity-select" type="checkbox" data-identity-candidate="${escapeHtml(candidate.id)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} aria-label="Merge ${escapeHtml(candidate.left.name)} and ${escapeHtml(candidate.right.name)}">
        <div class="identity-names">${escapeHtml(candidate.left.name)}<span class="identity-arrow">⇄</span>${escapeHtml(candidate.right.name)}</div>
        <span class="identity-confidence">${candidate.confidence === "safe" ? "Safe merge" : candidate.confidence === "review" ? "Review" : "Protected"}</span>
      </div>
      <div class="identity-reasons">${candidate.reasons.map(reason => `<span class="identity-reason">${escapeHtml(reason)}</span>`).join("")}</div>
      <div class="identity-columns">
        ${playerBox(candidate.left)}${playerBox(candidate.right)}
      </div>
      <div class="identity-canonical">Proposed display identity: <strong>${escapeHtml(candidate.canonicalName)}</strong> · all other names retained as searchable aliases in the database.</div>
      ${candidate.warning ? `<div class="identity-warning">${escapeHtml(candidate.warning)}</div>` : ""}
    </article>`;
  }

  function playerBox(player) {
    return `<div class="identity-player-box"><strong>${escapeHtml(player.name)}</strong><small>ID: ${escapeHtml(player.id)}</small><small>${player.seasonCount} seasons · ${escapeHtml(player.seasons.join(" · "))}</small><small>${escapeHtml(player.clubs.join(" · ") || "No club")}${player.dob ? ` · DOB ${escapeHtml(player.dob)}` : ""}</small></div>`;
  }

  async function buildWorkspace() {
    if (!state.selected.size) return;
    const selected = state.candidates.filter(candidate => state.selected.has(candidate.id) && candidate.confidence !== "blocked");
    const result = mergeSelectedGroups(originalPlayers, selected);
    state.workspace = result.database;
    state.mergeReport = result.report;
    state.ready = false;
    updateSummary();
    elements.identityRegressionPanel.classList.remove("hidden");
    elements.identityDownloadPanel.classList.remove("hidden");
    setStatus(`Preview built: ${result.report.length} identity groups consolidated. Running safety checks…`);
    await runRegressionChecks();
  }

  function mergeSelectedGroups(database, selectedCandidates) {
    const parent = new Map(database.map(player => [player.playerId, player.playerId]));
    const find = id => {
      let root = id;
      while (parent.get(root) !== root) root = parent.get(root);
      let current = id;
      while (parent.get(current) !== root) { const next = parent.get(current); parent.set(current, root); current = next; }
      return root;
    };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
    selectedCandidates.forEach(candidate => union(candidate.left.id, candidate.right.id));

    const groups = new Map();
    database.forEach(player => {
      const root = find(player.playerId);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(player);
    });

    const output = [];
    const report = [];
    for (const players of groups.values()) {
      if (players.length === 1) { output.push(clone(players[0])); continue; }
      if (!groupCompatible(players)) {
        players.forEach(player => output.push(clone(player)));
        report.push({ status: "skipped", reason: "conflicting same-season records", players: players.map(summary) });
        continue;
      }
      const merged = mergePlayers(players);
      output.push(merged);
      report.push({
        status: "merged",
        canonicalId: merged.playerId,
        canonicalName: merged.name,
        aliases: merged.aliases || [],
        legacyPlayerIds: merged.legacyPlayerIds || [],
        players: players.map(summary),
        seasonsAfter: merged.seasons.length
      });
    }
    output.sort((a, b) => a.name.localeCompare(b.name));
    return { database: output, report };
  }

  function mergePlayers(players) {
    const canonical = chooseCanonical(players);
    const aliases = new Set();
    const legacyIds = new Set();
    players.forEach(player => {
      aliases.add(player.name);
      (player.aliases || []).forEach(alias => aliases.add(alias));
      legacyIds.add(player.playerId);
      (player.legacyPlayerIds || []).forEach(id => legacyIds.add(id));
    });
    aliases.delete(canonical.name);
    legacyIds.delete(canonical.playerId);

    const seasonMap = new Map();
    players.flatMap(player => player.seasons).forEach(season => {
      const existing = seasonMap.get(season.season);
      seasonMap.set(season.season, existing ? mergeDuplicateSeason(existing, season) : clone(season));
    });
    const bio = mergeBio(players, canonical.bio || {});
    const merged = {
      ...clone(canonical),
      playerId: canonical.playerId,
      name: canonical.name,
      aliases: [...aliases].sort((a, b) => a.localeCompare(b)),
      legacyPlayerIds: [...legacyIds].sort(),
      seasons: [...seasonMap.values()].sort((a, b) => seasonYear(b.season) - seasonYear(a.season)),
      bio
    };
    return merged;
  }

  function chooseCanonical(players) {
    return [...players].sort((a, b) => {
      const aBroken = looksBrokenEncoding(a.name) ? 1 : 0;
      const bBroken = looksBrokenEncoding(b.name) ? 1 : 0;
      if (aBroken !== bBroken) return aBroken - bBroken;
      const aWords = tokenise(a.name).length, bWords = tokenise(b.name).length;
      if (aWords !== bWords) return aWords - bWords;
      if (a.name.length !== b.name.length) return a.name.length - b.name.length;
      if (a.seasons.length !== b.seasons.length) return b.seasons.length - a.seasons.length;
      return latestSeason(b) - latestSeason(a);
    })[0];
  }

  function mergeDuplicateSeason(left, right) {
    if (coreSeasonEqual(left, right)) return mergeObjects(left, right);
    if ((Number(left.minutes) || 0) === 0 && (Number(right.minutes) || 0) > 0) return clone(right);
    if ((Number(right.minutes) || 0) === 0 && (Number(left.minutes) || 0) > 0) return clone(left);
    return completeness(right) > completeness(left) ? clone(right) : clone(left);
  }

  function mergeObjects(primary, secondary) {
    const output = { ...clone(secondary), ...clone(primary) };
    const managers = new Set([...(primary.managers || []), ...(secondary.managers || [])]);
    output.managers = [...managers];
    for (const [key, value] of Object.entries(secondary)) {
      if ((output[key] === null || output[key] === undefined || output[key] === "") && value !== null && value !== undefined && value !== "") output[key] = clone(value);
    }
    return output;
  }

  function mergeBio(players, fallback) {
    const dates = players.map(player => player.bio?.dateOfBirth).filter(Boolean);
    const regions = players.map(player => player.bio?.regionId).filter(value => value !== undefined && value !== null);
    return {
      ...clone(fallback),
      ...(new Set(dates).size === 1 ? { dateOfBirth: dates[0] } : {}),
      ...(new Set(regions).size === 1 ? { regionId: regions[0] } : {})
    };
  }

  async function runRegressionChecks() {
    if (!state.workspace) return;
    setStatus("Running identity regression checks…");
    const checks = [];
    addCheck(checks, originalPlayers.length > 0, "Original database preserved", `${originalPlayers.length.toLocaleString()} loaded players remain untouched in memory.`);
    addCheck(checks, uniquePlayerIds(state.workspace), "Every player ID is unique", `${state.workspace.length.toLocaleString()} consolidated player identities checked.`);
    addCheck(checks, uniqueSeasonsPerPlayer(state.workspace), "No player has duplicate seasons", `${seasonCount(state.workspace).toLocaleString()} player-season records checked.`);
    addCheck(checks, validCoreData(state.workspace), "Core positions and statistics remain valid", "All retained seasons use supported positions and finite core values.");

    const promptFailures = evaluatePrompts(state.workspace);
    addCheck(checks, promptFailures.length === 0, "All enabled prompts retain enough answers", promptFailures.length ? `${promptFailures.length} prompts fell below six valid footballers.` : `${promptLibrary.filter(prompt => prompt.enabled !== false).length} enabled prompts passed.`);

    const selectedMergeReports = state.mergeReport.filter(item => item.status === "merged");
    const expectedPlayers = originalPlayers.length - selectedMergeReports.reduce((sum, item) => sum + item.players.length - 1, 0);
    addCheck(checks, state.workspace.length === expectedPlayers, "Player-count change matches approved merges", `${originalPlayers.length.toLocaleString()} → ${state.workspace.length.toLocaleString()} players.`);
    addCheck(checks, seasonCount(state.workspace) <= seasonCount(originalPlayers), "Season count is controlled", `${seasonCount(originalPlayers).toLocaleString()} → ${seasonCount(state.workspace).toLocaleString()} seasons; records were never summed.`);

    const live = await loadLiveChallenge();
    if (live) {
      const result = calculatePerfectXI(live.prompts || [], state.workspace);
      addCheck(checks, result.possible, "The live challenge still has eleven unique valid footballers", result.possible ? "A valid unique-player XI still exists." : result.reason);
      addCheck(checks, result.possible && result.score === Number(live.perfectScore), "Live perfect score remains correct", result.possible ? `${result.score.toLocaleString()} calculated versus ${Number(live.perfectScore).toLocaleString()} stored.` : "Perfect score could not be calculated.");
    } else {
      addCheck(checks, false, "Live challenge could not be verified", "todays-challenge.js could not be read, so the upload package remains locked.");
    }

    state.checks = checks;
    state.ready = checks.every(check => check.pass);
    renderRegression();
    elements.downloadIdentityPackBtn.disabled = !state.ready;
    elements.downloadIdentityPackBtn.textContent = state.ready ? "Download upload-ready package" : "Download review package";
    elements.identityDownloadExplanation.textContent = state.ready
      ? "Every identity, prompt and live-challenge check passed. Upload only UPLOAD/players.js after keeping the backup."
      : "At least one blocking check failed. Review the candidates before replacing players.js.";
    elements.identityCentreStatus.textContent = state.ready ? "Upload-ready" : "Review required";
    setStatus(state.ready ? "Identity consolidation passed every safety check." : "Identity consolidation needs review; no upload-ready file has been unlocked.");
  }

  function renderRegression() {
    elements.identityRegressionList.innerHTML = state.checks.map(check => `
      <div class="repair-check ${check.pass ? "pass" : "fail"}">
        <span class="repair-check-icon">${check.pass ? "✓" : "!"}</span>
        <div><strong>${escapeHtml(check.title)}</strong><small>${escapeHtml(check.detail)}</small></div>
      </div>`).join("");
  }

  function downloadPack() {
    if (!state.workspace || !state.ready) return;
    const zipBuilder = window.FPL_STUDIO_ZIP?.buildZipBlob;
    if (typeof zipBuilder !== "function") {
      elements.identityDownloadStatus.textContent = "The ZIP builder is unavailable. Reload the Studio and try again.";
      return;
    }
    const merged = state.mergeReport.filter(item => item.status === "merged");
    const files = [
      { name: "UPLOAD/players.js", content: buildPlayersSource(state.workspace, "Generated by Challenge Studio Phase 11 identity consolidation") },
      { name: "BACKUPS/players-before-identity-consolidation.js", content: buildPlayersSource(originalPlayers, "Backup created before Phase 11 identity consolidation") },
      { name: "REPORTS/identity-merges.json", content: JSON.stringify(merged, null, 2) + "\n" },
      { name: "REPORTS/aliases.json", content: JSON.stringify(state.workspace.filter(player => player.aliases?.length).map(player => ({ playerId: player.playerId, name: player.name, aliases: player.aliases, legacyPlayerIds: player.legacyPlayerIds || [] })), null, 2) + "\n" },
      { name: "REPORTS/regression-checks.json", content: JSON.stringify(state.checks, null, 2) + "\n" },
      { name: "README-UPLOAD.txt", content: buildReadme(merged) }
    ];
    downloadBlob(`fpl-phase-11-identity-consolidation-${dateStamp()}.zip`, zipBuilder(files));
    elements.identityDownloadStatus.textContent = "Package downloaded. Keep the backup and replace only players.js from the UPLOAD folder.";
  }

  function buildReadme(merged) {
    return [
      "FPL CHALLENGE STUDIO — PHASE 11 IDENTITY CONSOLIDATION",
      "=======================================================",
      "",
      `Merged identity groups: ${merged.length}`,
      `Players: ${originalPlayers.length} -> ${state.workspace.length}`,
      `Player-seasons: ${seasonCount(originalPlayers)} -> ${seasonCount(state.workspace)}`,
      "",
      "UPLOAD STEPS",
      "1. Keep BACKUPS/players-before-identity-consolidation.js locally.",
      "2. Upload only UPLOAD/players.js to the root of the GitHub repository.",
      "3. Wait for GitHub Pages to deploy and hard-refresh the game and admin page.",
      "4. Confirm the displayed player and season totals match this report.",
      "",
      "IMPORTANT",
      "Different seasons were combined under one footballer identity. Same-season statistics were never added together. Exact duplicate or zero-minute stub records were deduplicated conservatively.",
      ""
    ].join("\n");
  }

  function resetWorkspace() {
    state.candidates = [];
    state.selected.clear();
    state.workspace = null;
    state.mergeReport = [];
    state.checks = [];
    state.ready = false;
    elements.identityResultsPanel.classList.add("hidden");
    elements.identityRegressionPanel.classList.add("hidden");
    elements.identityDownloadPanel.classList.add("hidden");
    elements.selectSafeIdentityBtn.disabled = true;
    elements.applyIdentityMergesBtn.disabled = true;
    elements.downloadIdentityPackBtn.disabled = true;
    elements.identityCentreStatus.textContent = "Ready to scan";
    elements.identitySafeCount.textContent = "0";
    elements.identityReviewCount.textContent = "0";
    elements.identityBlockedCount.textContent = "0";
    elements.identityProjectedPlayers.textContent = originalPlayers.length.toLocaleString();
    elements.identityProjectedSeasons.textContent = seasonCount(originalPlayers).toLocaleString();
    setStatus("Identity workspace reset. The loaded database was not changed.");
  }

  function updateSummary() {
    const safe = state.candidates.filter(candidate => candidate.confidence === "safe").length;
    const review = state.candidates.filter(candidate => candidate.confidence === "review").length;
    const blocked = state.candidates.filter(candidate => candidate.confidence === "blocked").length;
    elements.identityPlayersScanned.textContent = originalPlayers.length.toLocaleString();
    elements.identitySafeCount.textContent = safe.toLocaleString();
    elements.identityReviewCount.textContent = review.toLocaleString();
    elements.identityBlockedCount.textContent = blocked.toLocaleString();
    elements.identityProjectedPlayers.textContent = (state.workspace?.length || originalPlayers.length).toLocaleString();
    elements.identityProjectedSeasons.textContent = seasonCount(state.workspace || originalPlayers).toLocaleString();
  }

  function summary(player) {
    return {
      id: player.playerId,
      name: player.name,
      dob: player.bio?.dateOfBirth || "",
      clubs: [...new Set(player.seasons.map(season => season.club).filter(Boolean))],
      seasons: player.seasons.map(season => season.season).sort((a, b) => seasonYear(a) - seasonYear(b)),
      seasonCount: player.seasons.length
    };
  }

  function seasonsCompatible(left, right) {
    const rightMap = new Map(right.seasons.map(season => [season.season, season]));
    for (const leftSeason of left.seasons) {
      const rightSeason = rightMap.get(leftSeason.season);
      if (!rightSeason) continue;
      if (coreSeasonEqual(leftSeason, rightSeason)) continue;
      if (leftSeason.club === rightSeason.club && ((Number(leftSeason.minutes) || 0) === 0 || (Number(rightSeason.minutes) || 0) === 0)) continue;
      return false;
    }
    return true;
  }

  function groupCompatible(players) {
    for (let left = 0; left < players.length; left += 1) for (let right = left + 1; right < players.length; right += 1) if (!seasonsCompatible(players[left], players[right])) return false;
    return true;
  }

  function coreSeasonEqual(left, right) {
    return CORE_SEASON_FIELDS.every(field => normalValue(left[field]) === normalValue(right[field]));
  }

  function normalValue(value) {
    if (Array.isArray(value)) return JSON.stringify([...value].sort());
    return value === undefined ? null : value;
  }

  function completeness(record) {
    return Object.values(record).reduce((score, value) => score + (value !== null && value !== undefined && value !== "" ? 1 : 0), 0);
  }

  function evaluatePrompts(database) {
    const flat = flatten(database);
    return promptLibrary.filter(prompt => prompt.enabled !== false).map(prompt => {
      const players = new Set();
      for (const record of flat) {
        try { if (Number(record?.minutes) > 0 && record.position === prompt.position && prompt.test(record)) players.add(record.playerId); } catch { /* handled as failure */ }
      }
      return { id: prompt.id, players: players.size };
    }).filter(result => result.players < 6);
  }

  function calculatePerfectXI(prompts, database) {
    if (!Array.isArray(prompts) || prompts.length !== 11) return { possible: false, reason: "The live challenge does not contain eleven prompts." };
    const flat = flatten(database);
    const bestBySlot = prompts.map(prompt => {
      const map = new Map();
      for (const record of flat) {
        if (record.position !== prompt.position) continue;
          if (Number(record?.minutes) <= 0) continue;
        let valid = false;
        try { valid = prompt.test(record); } catch { valid = false; }
        if (!valid) continue;
        const current = map.get(record.playerId);
        if (!current || Number(record.points) > Number(current.points)) map.set(record.playerId, record);
      }
      return map;
    });
    if (bestBySlot.some(map => map.size === 0)) return { possible: false, reason: "At least one live prompt has no valid footballers." };
    const playerIds = [...new Set(bestBySlot.flatMap(map => [...map.keys()]))];
    if (playerIds.length < 11) return { possible: false, reason: "Fewer than eleven unique valid footballers remain." };
    const maxPoints = Math.max(...bestBySlot.flatMap(map => [...map.values()].map(record => Number(record.points) || 0)));
    const forbidden = 1e9;
    const costs = bestBySlot.map(map => Float64Array.from(playerIds, id => map.has(id) ? maxPoints - (Number(map.get(id).points) || 0) : forbidden));
    const assignment = hungarianMinimumAssignment(costs);
    if (!assignment) return { possible: false, reason: "The unique-player optimiser could not complete an XI." };
    const records = assignment.map((column, slot) => bestBySlot[slot].get(playerIds[column]) || null);
    if (records.some(record => !record)) return { possible: false, reason: "No complete unique-player assignment exists." };
    return { possible: true, score: records.reduce((sum, record) => sum + (Number(record.points) || 0), 0), records };
  }

  function hungarianMinimumAssignment(costs) {
    const rows = costs.length, columns = costs[0]?.length || 0;
    if (!rows || columns < rows) return null;
    const u = new Float64Array(rows + 1), v = new Float64Array(columns + 1);
    const p = new Int32Array(columns + 1), way = new Int32Array(columns + 1);
    for (let i = 1; i <= rows; i += 1) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(columns + 1); minv.fill(Infinity);
      const used = new Uint8Array(columns + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0];
        let delta = Infinity, j1 = 0;
        for (let j = 1; j <= columns; j += 1) {
          if (used[j]) continue;
          const current = costs[i0 - 1][j - 1] - u[i0] - v[j];
          if (current < minv[j]) { minv[j] = current; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        if (!Number.isFinite(delta)) return null;
        for (let j = 0; j <= columns; j += 1) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0);
    }
    const assignment = new Int32Array(rows); assignment.fill(-1);
    for (let j = 1; j <= columns; j += 1) if (p[j] > 0 && p[j] <= rows) assignment[p[j] - 1] = j - 1;
    return [...assignment].every(value => value >= 0) ? [...assignment] : null;
  }

  async function loadLiveChallenge() {
    try {
      const response = await fetch(`todays-challenge.js?identity=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return null;
      const source = await response.text();
      const sandbox = {};
      Function("window", `${source}\n;return window.FPL_DAILY_CHALLENGE;`)(sandbox);
      state.liveChallenge = sandbox.FPL_DAILY_CHALLENGE || null;
      return state.liveChallenge;
    } catch { return null; }
  }

  function buildPlayersSource(database, note) {
    return `/* ${note}. */\nwindow.FPL_PLAYERS = ${JSON.stringify(database)};\n`;
  }

  function uniquePlayerIds(database) { return new Set(database.map(player => player.playerId)).size === database.length; }
  function uniqueSeasonsPerPlayer(database) { return database.every(player => new Set(player.seasons.map(season => season.season)).size === player.seasons.length); }
  function validCoreData(database) {
    return database.every(player => player.playerId && player.name && Array.isArray(player.seasons) && player.seasons.every(season => VALID_POSITIONS.has(season.position) && CORE_SEASON_FIELDS.filter(field => !["club", "position"].includes(field)).every(field => Number.isFinite(Number(season[field])))));
  }

  function flatten(database) { return database.flatMap(player => player.seasons.map(season => ({ ...season, playerId: player.playerId, name: player.name, aliases: player.aliases || [] }))); }
  function seasonCount(database) { return database.reduce((sum, player) => sum + player.seasons.length, 0); }
  function latestSeason(player) { return Math.max(...player.seasons.map(season => seasonYear(season.season)).filter(Number.isFinite), 0); }
  function seasonYear(season) { const match = String(season || "").match(/^(\d{4})/); return match ? Number(match[1]) : NaN; }
  function intersects(left, right) { for (const value of left) if (right.has(value)) return true; return false; }
  function areAdjacent(left, right) { return left.length && right.length && Math.min(...left.flatMap(a => right.map(b => Math.abs(a - b)))) <= 1; }
  function nameContained(left, right) { const short = left.length <= right.length ? left : right; const long = left.length <= right.length ? right : left; return short.length >= 2 && short.every(token => long.includes(token)); }
  function firstNameEquivalent(left, right) { return left === right || Boolean(NICKNAME_MAP.get(left)?.has(right)); }
  function surnameTokens(tokens) { if (tokens.length <= 1) return tokens; const result = [tokens.at(-1)]; for (let index = tokens.length - 2; index >= 1 && NAME_PARTICLES.has(tokens[index]); index -= 1) result.unshift(tokens[index]); return result; }
  function tokenise(value) { return normalise(value).split(" ").filter(Boolean); }
  function normalise(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, " ").replace(/-/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function fixCommonEncoding(value) { try { return decodeURIComponent(escape(String(value))); } catch { return String(value); } }
  function looksBrokenEncoding(value) { return /Ã|Â|Å|Ä|â€/.test(String(value)); }

  function similarityRatio(left, right) {
    if (left === right) return 1;
    if (!left || !right) return 0;
    const longer = left.length >= right.length ? left : right;
    const shorter = left.length >= right.length ? right : left;
    const distance = levenshtein(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  function levenshtein(left, right) {
    const previous = new Uint16Array(right.length + 1), current = new Uint16Array(right.length + 1);
    for (let j = 0; j <= right.length; j += 1) previous[j] = j;
    for (let i = 1; i <= left.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= right.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous.set(current);
    }
    return previous[right.length];
  }

  function confidenceRank(value) { return value === "safe" ? 0 : value === "review" ? 1 : 2; }
  function addCheck(list, pass, title, detail) { list.push({ pass: Boolean(pass), title, detail }); }
  function setStatus(message) { elements.identityActionStatus.textContent = message; }
  function normaliseNumber(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  function dateStamp() { return new Date().toISOString().slice(0, 10); }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
})();

/* ===== END admin-phase11.js ===== */
