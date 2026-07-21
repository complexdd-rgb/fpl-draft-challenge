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
      if (deleted.has(library[index].id) && library[index].studioRule) library.splice(index, 1);
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
      if (action === "delete") deleteCustomPrompt(prompt, elements, ui, core);
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
          ${prompt.studioRule ? `<button class="danger-action" type="button" data-action="delete" data-id="${escapeAttribute(prompt.id)}">Delete</button>` : ""}
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
        : definition.type === "nameText"
          ? NAME_TEXT_OPERATORS
          : TEXT_OPERATORS;
    const operator = operatorSet[previousOperator] ? previousOperator : Object.keys(operatorSet)[0];
    operatorWrap.innerHTML = `<select data-rule-operator aria-label="Rule operator">${Object.entries(operatorSet).map(([key, label]) => `<option value="${key}" ${key === operator ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;

    if (definition.type === "boolean") {
      valueWrap.innerHTML = '<span class="rule-no-value">No value needed</span>';
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

  function deleteCustomPrompt(prompt, elements, ui, core) {
    if (!prompt.studioRule) return;
    if (core.isPromptSelected?.(prompt.id)) {
      elements.managerStatus.textContent = "That prompt is in the current draft. Reroll it before deleting it.";
      return;
    }
    if (!window.confirm(`Delete the custom prompt “${prompt.label}” from this browser?`)) return;
    const index = library.findIndex(item => item.id === prompt.id);
    if (index >= 0) library.splice(index, 1);
    state.customs = state.customs.filter(item => item.id !== prompt.id);
    if (baseIds.has(prompt.id) && !state.deletedIds.includes(prompt.id)) state.deletedIds.push(prompt.id);
    delete state.overrides[prompt.id];
    persistState();
    core.refreshLibrary?.({ recalculateDraft: false });
    renderManagerCounts(elements);
    renderPromptList(elements, ui, core);
    elements.managerStatus.textContent = `${prompt.label} was removed from this browser library.`;
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
})();
