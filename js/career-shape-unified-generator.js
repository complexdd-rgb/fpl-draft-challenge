/* FPL Career Shape · unified Automatic Creator integration v1.0.0 */
(() => {
  "use strict";

  const STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const FACTORY_MESSAGE_KEY = "fplChallengeStudioPromptFactoryMessage";
  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const NAMES = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const SHAPE_KEYS = [
    "everChampion", "everTopFour", "consecutiveSameClub", "managerCount",
    "bigSixClubCount", "neverBigSix", "managersInSeason", "championAndRelegated"
  ];

  let careerBatch = [];
  let plannedRequested = 0;
  let modeAtGeneration = "mix";
  let generationToken = 0;

  function players() {
    return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function slug(value) {
    return String(value || "")
      .replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function integer(id, min, max, fallback) {
    const value = Math.round(Number(document.getElementById(id)?.value));
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function settings(requestedOverride = null) {
    const position = document.getElementById("factoryPositionMix")?.value || "balanced";
    const difficulty = document.getElementById("factoryDifficultyMix")?.value || "balanced";
    return {
      requested: requestedOverride ?? integer("factoryPromptCount", 1, 50, 20),
      minimum: integer("factoryMinPlayers", 3, 100, 6),
      maximum: integer("factoryMaxPlayers", 6, 250, 100),
      cooldown: integer("factoryCooldown", 0, 50, 10),
      position: POSITIONS.includes(position) ? position : "balanced",
      difficulty: ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "balanced",
      enabled: Boolean(document.getElementById("factoryEnablePrompts")?.checked),
      avoidSimilar: Boolean(document.getElementById("factoryAvoidSimilarPools")?.checked)
    };
  }

  function shapeExpression(key, operator = "gte", value = 0) {
    const symbol = operator === "eq" ? "===" : operator === "lte" ? "<=" : ">=";
    if (key === "everChampion") return "p._careerShape?.everChampion === true";
    if (key === "everTopFour") return "p._careerShape?.everTopFour === true";
    if (key === "neverBigSix") return "p._careerShape?.neverBigSix === true";
    if (key === "championAndRelegated") return "p._careerShape?.everChampion === true && p._careerShape?.everRelegatedClub === true";
    const accessor = {
      consecutiveSameClub: "Number(p._careerShape?.maxConsecutiveSameClub)",
      managerCount: "Number(p._careerShape?.managerCount)",
      bigSixClubCount: "Number(p._careerShape?.bigSixClubCount)",
      managersInSeason: "Number(p._careerShape?.maxManagersInSeason)"
    }[key];
    return accessor ? `(Number.isFinite(${accessor}) && ${accessor} ${symbol} ${Math.round(Number(value) || 0)})` : "false";
  }

  function wording(position, key, operator = "gte", value = 0) {
    const noun = NAMES[position] || "Player";
    const role = LOWER[position] || "player";
    const phrase = operator === "eq" ? `exactly ${value}` : operator === "lte" ? `at most ${value}` : `at least ${value}`;
    if (key === "everChampion") return {
      label: `${noun} who won the Premier League at some point in their recorded career`,
      fail: `That ${role} must have at least one recorded title-winning Premier League season.`
    };
    if (key === "everTopFour") return {
      label: `${noun} who played for a top-four club at some point in their recorded career`,
      fail: `That ${role} must have at least one recorded Premier League season for a top-four club.`
    };
    if (key === "neverBigSix") return {
      label: `${noun} who never played for a traditional Big Six club in their recorded Premier League career`,
      fail: `That ${role} must have recorded Premier League minutes but none for Arsenal, Chelsea, Liverpool, Man City, Man Utd or Spurs.`
    };
    if (key === "championAndRelegated") return {
      label: `${noun} who won the Premier League and also played for a relegated club in their recorded career`,
      fail: `That ${role} must have both a recorded title-winning Premier League season and a recorded season for a relegated club.`
    };
    if (key === "consecutiveSameClub") return {
      label: `${noun} with ${phrase} consecutive recorded Premier League seasons at the same club`,
      fail: `That ${role} must have ${phrase} consecutive positive-minute Premier League seasons at the same club.`
    };
    if (key === "managerCount") return {
      label: `${noun} who played under ${phrase} different managers across their recorded Premier League career`,
      fail: `That ${role} must have recorded Premier League minutes under ${phrase} different stored managers.`
    };
    if (key === "bigSixClubCount") return {
      label: `${noun} who played for ${phrase} traditional Big Six clubs in their recorded Premier League career`,
      fail: `That ${role} must have recorded Premier League minutes for ${phrase} different traditional Big Six clubs.`
    };
    return {
      label: `${noun} who had ${phrase} managers during a single recorded Premier League season`,
      fail: `That ${role} must have a recorded Premier League season containing ${phrase} different stored managers.`
    };
  }

  function withQualifier(expression, text, type = "none", rawValue = 0) {
    const value = Math.max(0, Math.round(Number(rawValue) || 0));
    if (type === "none" || !value) return { expression, label: text.label, fail: text.fail, tag: "" };
    if (type === "points") {
      return {
        expression: `(${expression}) && (Number.isFinite(Number(p.points)) && Number(p.points) >= ${value})`,
        label: `${text.label} and scored ${value}+ FPL points`,
        fail: `${text.fail} The qualifying season must also score at least ${value} FPL points.`,
        tag: "points"
      };
    }
    return {
      expression: `(${expression}) && (Number.isFinite(Number(p.minutes)) && Number(p.minutes) >= ${value})`,
      label: `${text.label} and played ${value.toLocaleString("en-GB")}+ minutes`,
      fail: `${text.fail} The qualifying season must also include at least ${value.toLocaleString("en-GB")} minutes.`,
      tag: "minutes"
    };
  }

  function numericVariants(key) {
    if (key === "consecutiveSameClub") return [2, 3, 4, 5, 6].flatMap(value => [["gte", value], ["eq", value]]);
    if (key === "managerCount") return [2, 3, 4, 5, 6, 7].flatMap(value => [["gte", value], ["eq", value]]);
    if (key === "bigSixClubCount") return [1, 2, 3].flatMap(value => [["gte", value], ["eq", value]]);
    if (key === "managersInSeason") return [2, 3].flatMap(value => [["gte", value], ["eq", value]]);
    return [["gte", 0]];
  }

  function pointThresholds(position) {
    return ({ GK: [50, 80, 110], DEF: [60, 90, 120, 150], MID: [70, 100, 130, 160], FWD: [60, 90, 120, 150] })[position] || [60, 90, 120];
  }

  function makeCandidate(position, key, operator, value, qualifier = "none", qualifierValue = 0, cooldown = 10) {
    const combined = withQualifier(shapeExpression(key, operator, value), wording(position, key, operator, value), qualifier, qualifierValue);
    const numeric = ["consecutiveSameClub", "managerCount", "bigSixClubCount", "managersInSeason"].includes(key);
    const suffix = numeric ? `${operator}_${value}` : "career";
    const qualifierSuffix = qualifier === "none" ? "" : `_${qualifier}_${qualifierValue}`;
    const source = `p => (${combined.expression})`;
    const antiMeta = ["neverBigSix", "managerCount", "managersInSeason", "championAndRelegated", "consecutiveSameClub"].includes(key);
    let test;
    try { test = Function(`"use strict"; return (${source});`)(); }
    catch (_) { test = () => false; }
    return {
      id: `career_shape_auto_${position.toLowerCase()}_${key}_${suffix}${qualifierSuffix}`.replace(/[^a-z0-9_]+/g, "_"),
      family: `${position}:career-shape:${key}`,
      position,
      label: combined.label,
      fail: combined.fail,
      difficulty: "medium",
      tags: ["career-shape", "career", "auto-generated", "checked", slug(key), combined.tag, antiMeta ? "anti-meta" : ""].filter(Boolean),
      rating: 4,
      cooldown,
      enabled: false,
      studioRule: { kind: "source", source },
      testSource: source,
      test
    };
  }

  function buildCandidates(currentSettings) {
    const positions = currentSettings.position === "balanced" ? POSITIONS : [currentSettings.position];
    const output = [];
    for (const position of positions) {
      for (const key of SHAPE_KEYS) {
        const bases = ["consecutiveSameClub", "managerCount", "bigSixClubCount", "managersInSeason"].includes(key)
          ? numericVariants(key)
          : [["gte", 0]];
        for (const [operator, value] of bases) {
          output.push(makeCandidate(position, key, operator, value, "none", 0, currentSettings.cooldown));
          for (const points of pointThresholds(position)) output.push(makeCandidate(position, key, operator, value, "points", points, currentSettings.cooldown));
          for (const minutes of [1000, 1800, 2500]) output.push(makeCandidate(position, key, operator, value, "minutes", minutes, currentSettings.cooldown));
        }
      }
    }
    return output;
  }

  function analyse(prompt) {
    const best = new Map();
    let seasonCount = 0;
    let errors = 0;
    for (const player of players()) {
      for (const record of player.seasons || []) {
        if (Number(record.minutes) <= 0 || record.position !== prompt.position) continue;
        let passed = false;
        try { passed = Boolean(prompt.test(record)); } catch (_) { errors += 1; }
        if (!passed) continue;
        seasonCount += 1;
        const current = best.get(player.playerId);
        if (!current || Number(record.points || 0) > Number(current.points || 0)) {
          best.set(player.playerId, {
            playerId: player.playerId,
            playerName: player.name,
            season: record.season,
            club: record.club,
            points: Number(record.points) || 0
          });
        }
      }
    }
    return {
      playerCount: best.size,
      seasonCount,
      errors,
      ids: new Set(best.keys()),
      examples: [...best.values()].sort((a, b) => b.points - a.points || String(a.playerName).localeCompare(String(b.playerName))).slice(0, 3)
    };
  }

  function overlap(left, right) {
    if (!left.size || !right.size) return 0;
    let intersection = 0;
    for (const id of left) if (right.has(id)) intersection += 1;
    return intersection / Math.min(left.size, right.size);
  }

  function existingCareerPools() {
    const pools = [];
    for (const prompt of window.FPL_PROMPT_LIBRARY || []) {
      if (!(prompt.tags || []).includes("career-shape") && !String(prompt.id || "").startsWith("career_shape_")) continue;
      try {
        const stats = analyse(prompt);
        if (stats.ids.size) pools.push({ position: prompt.position, ids: stats.ids });
      } catch (_) {}
    }
    return pools;
  }

  function chooseBalanced(items, requested, positionMode, difficultyMode) {
    if (items.length <= requested) return items.slice();
    const remaining = items.slice().sort(() => Math.random() - 0.5);
    const chosen = [];
    const familyCounts = new Map();
    while (chosen.length < requested && remaining.length) {
      let bestIndex = 0;
      let bestScore = -Infinity;
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index];
        const positionUsed = chosen.filter(item => item.position === candidate.position).length;
        const difficultyUsed = chosen.filter(item => item.difficulty === candidate.difficulty).length;
        const familyUsed = familyCounts.get(candidate.family) || 0;
        const positionTarget = positionMode === "balanced" ? requested / 4 : requested;
        const difficultyTarget = difficultyMode === "balanced" ? requested / 3 : requested;
        const score = (positionTarget - positionUsed) * 4 + (difficultyTarget - difficultyUsed) * 2 - familyUsed * 4 + Math.random();
        if (score > bestScore) { bestScore = score; bestIndex = index; }
      }
      const [picked] = remaining.splice(bestIndex, 1);
      chosen.push(picked);
      familyCounts.set(picked.family, (familyCounts.get(picked.family) || 0) + 1);
    }
    return chosen;
  }

  function generateCareerBatch(currentSettings, requested, normalLabels = new Set()) {
    const existingIds = new Set((window.FPL_PROMPT_LIBRARY || []).map(prompt => String(prompt.id || "")));
    const existingLabels = new Set((window.FPL_PROMPT_LIBRARY || []).map(prompt => norm(prompt.label)));
    const oldPools = currentSettings.avoidSimilar ? existingCareerPools() : [];
    const seenPools = [];
    const accepted = [];
    const rejected = { range: 0, duplicate: 0, similar: 0, broken: 0 };

    for (const candidate of buildCandidates(currentSettings)) {
      if (existingIds.has(candidate.id) || existingLabels.has(norm(candidate.label)) || normalLabels.has(norm(candidate.label))) {
        rejected.duplicate += 1;
        continue;
      }
      const stats = analyse(candidate);
      if (stats.errors) { rejected.broken += 1; continue; }
      if (stats.playerCount < currentSettings.minimum || stats.playerCount > currentSettings.maximum) {
        rejected.range += 1;
        continue;
      }
      candidate.stats = stats;
      candidate.difficulty = stats.playerCount <= 12 ? "hard" : stats.playerCount <= 35 ? "medium" : "easy";
      if (currentSettings.difficulty !== "balanced" && candidate.difficulty !== currentSettings.difficulty) continue;
      if (currentSettings.avoidSimilar && [...oldPools, ...seenPools].some(item => item.position === candidate.position && overlap(item.ids, stats.ids) >= 0.97)) {
        rejected.similar += 1;
        continue;
      }
      candidate.rating = stats.playerCount <= 60 ? 5 : 4;
      candidate.enabled = currentSettings.enabled;
      accepted.push(candidate);
      seenPools.push({ position: candidate.position, ids: stats.ids });
    }

    return { batch: chooseBalanced(accepted, requested, currentSettings.position, currentSettings.difficulty), rejected };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") {
        return {
          version: 1,
          overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
          customs: Array.isArray(parsed.customs) ? parsed.customs : [],
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
        };
      }
    } catch (_) {}
    return { version: 1, overrides: {}, customs: [], deletedIds: [] };
  }

  function serialise(prompt) {
    return {
      id: prompt.id,
      position: prompt.position,
      label: prompt.label,
      fail: prompt.fail,
      difficulty: prompt.difficulty,
      tags: [...new Set(prompt.tags || [])],
      rating: Number(prompt.rating) || 4,
      cooldown: Number(prompt.cooldown) || 10,
      enabled: prompt.enabled !== false,
      studioRule: prompt.studioRule,
      testSource: prompt.testSource || prompt.studioRule?.source || "p => false"
    };
  }

  function persistCareerSelection() {
    const selected = [...document.querySelectorAll("[data-career-unified-select]:checked")]
      .map(input => careerBatch[Number(input.dataset.careerUnifiedSelect)])
      .filter(Boolean);
    if (!selected.length) return 0;
    const state = loadState();
    const ids = new Set([...(window.FPL_PROMPT_LIBRARY || []).map(prompt => String(prompt.id || "")), ...state.customs.map(prompt => String(prompt.id || ""))]);
    let added = 0;
    for (const prompt of selected) {
      if (!prompt?.id || ids.has(prompt.id)) continue;
      state.customs.push(serialise(prompt));
      ids.add(prompt.id);
      added += 1;
    }
    if (added) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return added;
  }

  function mode() {
    return document.getElementById("factoryCareerShapeMode")?.value || "mix";
  }

  function normalCards() {
    return [...document.querySelectorAll("#promptFactoryPreview .factory-prompt-card:not(.career-shape-unified-card)")];
  }

  function careerBoxes() {
    return [...document.querySelectorAll("#promptFactoryPreview [data-career-unified-select]")];
  }

  function normalLabels() {
    return new Set(normalCards().map(card => norm(card.querySelector("h4")?.textContent || "")));
  }

  function renderCareerCards(append = true) {
    const preview = document.getElementById("promptFactoryPreview");
    if (!preview) return;
    preview.querySelectorAll(".career-shape-unified-card").forEach(node => node.remove());
    const html = careerBatch.map((prompt, index) => {
      const examples = prompt.stats.examples.map(answer => `${esc(answer.playerName)} (${esc(answer.season)})`).join(" · ");
      return `<article class="factory-prompt-card career-shape-unified-card">
        <input class="factory-prompt-select" type="checkbox" data-career-unified-select="${index}" checked aria-label="Select ${esc(prompt.label)}">
        <div class="factory-prompt-main">
          <h4><span class="position-badge">${esc(prompt.position)}</span> ${esc(prompt.label)}</h4>
          <p>${esc(prompt.id)}</p>
          <div class="factory-prompt-meta">
            <span>${esc(prompt.difficulty.charAt(0).toUpperCase() + prompt.difficulty.slice(1))}</span>
            <span>${prompt.stats.playerCount} players</span>
            <span>${prompt.stats.seasonCount} seasons</span>
            <span>Cooldown ${prompt.cooldown}</span>
            <span class="career-chip">Career Shape</span>
            ${prompt.tags.includes("anti-meta") ? '<span class="anti">Anti-meta</span>' : ""}
          </div>
          <small>${examples || "Checked against the full player database."}</small>
        </div>
      </article>`;
    }).join("");
    if (!append) preview.innerHTML = "";
    preview.insertAdjacentHTML("beforeend", html);
    preview.classList.remove("hidden");
    updateButtons();
  }

  function updateSummary(normalCount, careerCount) {
    const summary = document.getElementById("promptFactorySummary");
    if (!summary) return;
    summary.classList.remove("hidden");
    let chip = summary.querySelector("[data-career-unified-summary]");
    if (!chip) {
      chip = document.createElement("span");
      chip.dataset.careerUnifiedSummary = "true";
      chip.className = "career-unified-summary-chip";
      summary.append(chip);
    }
    chip.textContent = modeAtGeneration === "only"
      ? `${careerCount} Career Shape prompt${careerCount === 1 ? "" : "s"}`
      : `${normalCount} standard + ${careerCount} Career Shape · ${normalCount + careerCount} total`;
  }

  function updateButtons() {
    const preview = document.getElementById("promptFactoryPreview");
    const add = document.getElementById("addPromptBatchBtn");
    const select = document.getElementById("selectPromptBatchBtn");
    const clear = document.getElementById("clearPromptBatchBtn");
    if (!preview || !add || !select || !clear) return;
    const normal = [...preview.querySelectorAll("[data-factory-select]")];
    const career = careerBoxes();
    const boxes = [...normal, ...career];
    const selected = boxes.filter(box => box.checked).length;
    const hasBatch = boxes.length > 0;
    add.disabled = selected === 0;
    clear.disabled = !hasBatch;
    select.disabled = !hasBatch;
    select.textContent = selected === boxes.length && boxes.length ? "Clear selection" : "Select all";
    if (selected) add.textContent = `Add ${selected} selected to browser library`;
    else add.textContent = "Add selected to browser library";
  }

  function clearCareerPreview() {
    careerBatch = [];
    document.querySelectorAll("#promptFactoryPreview .career-shape-unified-card").forEach(node => node.remove());
    document.querySelector("[data-career-unified-summary]")?.remove();
  }

  function generateOnly(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = document.getElementById("generatePromptBatchBtn");
    const status = document.getElementById("promptFactoryStatus");
    const preview = document.getElementById("promptFactoryPreview");
    const summary = document.getElementById("promptFactorySummary");
    const requested = integer("factoryPromptCount", 1, 50, 20);
    modeAtGeneration = "only";
    plannedRequested = requested;
    generationToken += 1;
    const token = generationToken;
    careerBatch = [];
    if (button) button.disabled = true;
    if (preview) { preview.innerHTML = ""; preview.classList.add("hidden"); }
    if (summary) { summary.innerHTML = ""; summary.classList.add("hidden"); }
    if (status) status.textContent = `Building and checking up to ${requested} Career Shape prompts against the full player database…`;
    setTimeout(() => {
      if (token !== generationToken) return;
      try {
        const result = generateCareerBatch(settings(requested), requested);
        careerBatch = result.batch;
        renderCareerCards(false);
        updateSummary(0, careerBatch.length);
        if (status) status.textContent = `${careerBatch.length} checked Career Shape prompt${careerBatch.length === 1 ? "" : "s"} created. ${result.rejected.duplicate} duplicates, ${result.rejected.similar} near-identical pools and ${result.rejected.range} out-of-range candidates were rejected.`;
      } catch (error) {
        if (status) status.textContent = `Career Shape generation failed safely: ${error.message}`;
      } finally {
        if (button) button.disabled = false;
        updateButtons();
      }
    }, 25);
  }

  function waitForNormalGeneration(token, requested) {
    const button = document.getElementById("generatePromptBatchBtn");
    const preview = document.getElementById("promptFactoryPreview");
    const countInput = document.getElementById("factoryPromptCount");
    const status = document.getElementById("promptFactoryStatus");
    let checks = 0;
    const poll = () => {
      if (token !== generationToken) return;
      checks += 1;
      const ready = button && !button.disabled && preview && !preview.classList.contains("hidden");
      if (!ready && checks < 240) return setTimeout(poll, 50);
      if (countInput) countInput.value = requested;
      if (!preview) return;
      const normalCount = normalCards().length;
      const careerWanted = Math.max(0, requested - normalCount);
      if (!careerWanted) {
        careerBatch = [];
        updateSummary(normalCount, 0);
        updateButtons();
        return;
      }
      try {
        const result = generateCareerBatch(settings(careerWanted), careerWanted, normalLabels());
        careerBatch = result.batch;
        renderCareerCards(true);
        updateSummary(normalCount, careerBatch.length);
        const base = status?.textContent || `${normalCount} standard prompts created.`;
        if (status) status.textContent = `${base} Added ${careerBatch.length} checked Career Shape prompt${careerBatch.length === 1 ? "" : "s"} to the same ${normalCount + careerBatch.length}-prompt review batch.`;
      } catch (error) {
        if (status) status.textContent += ` Career Shape mix-in failed safely: ${error.message}`;
      }
      updateButtons();
    };
    setTimeout(poll, 45);
  }

  function onGenerateCapture(event) {
    const currentMode = mode();
    modeAtGeneration = currentMode;
    clearCareerPreview();
    generationToken += 1;
    const token = generationToken;
    if (currentMode === "none") return;
    if (currentMode === "only") return generateOnly(event);

    const input = document.getElementById("factoryPromptCount");
    const requested = integer("factoryPromptCount", 1, 50, 20);
    plannedRequested = requested;
    if (requested <= 1) return generateOnly(event);
    const plannedCareer = Math.max(1, Math.min(requested - 1, Math.round(requested * 0.25)));
    const normalTarget = Math.max(1, requested - plannedCareer);
    if (input) input.value = normalTarget;
    waitForNormalGeneration(token, requested);
  }

  function onAddCapture(event) {
    const currentMode = modeAtGeneration || mode();
    if (currentMode === "none" || !careerBatch.length) return;
    const careerSelected = careerBoxes().some(box => box.checked);
    if (!careerSelected && currentMode !== "only") return;
    const added = persistCareerSelection();
    const normalSelected = document.querySelectorAll("#promptFactoryPreview [data-factory-select]:checked").length;
    if (currentMode === "only" || normalSelected === 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = document.getElementById("promptFactoryStatus");
      if (!added) {
        if (status) status.textContent = "Select at least one generated prompt before adding it.";
        return;
      }
      sessionStorage.setItem(FACTORY_MESSAGE_KEY, `${added} automatically generated Career Shape prompt${added === 1 ? "" : "s"} added to the browser library.`);
      window.location.reload();
      return;
    }
    if (added) sessionStorage.setItem("fplUnifiedCareerShapeAdded", String(added));
  }

  function onSelectBubble() {
    const preview = document.getElementById("promptFactoryPreview");
    if (!preview || !careerBatch.length) return;
    const normal = [...preview.querySelectorAll("[data-factory-select]")];
    const career = careerBoxes();
    const normalAllSelected = normal.length ? normal.every(box => box.checked) : career.every(box => box.checked);
    career.forEach(box => { box.checked = normalAllSelected; });
    updateButtons();
  }

  function onClearBubble() {
    careerBatch = [];
    document.querySelector("[data-career-unified-summary]")?.remove();
    updateButtons();
  }

  function installModeControl() {
    if (document.getElementById("factoryCareerShapeMode")) return;
    const settingsGrid = document.querySelector("#automaticPromptFactory .prompt-factory-settings");
    if (!settingsGrid) return;
    const label = document.createElement("label");
    label.className = "career-shape-mode-control";
    label.innerHTML = `Career Shape rules
      <select id="factoryCareerShapeMode">
        <option value="mix" selected>Mix into checked batch</option>
        <option value="none">Exclude Career Shape rules</option>
        <option value="only">Career Shape only</option>
      </select>
      <small>Uses the same position, difficulty, answer-range, cooldown and enable settings as the main Automatic Creator.</small>`;
    const relationship = document.getElementById("factoryRelationshipMode")?.closest("label");
    if (relationship?.parentElement === settingsGrid) relationship.after(label);
    else settingsGrid.append(label);
  }

  function hideLegacyCareerFactory() {
    const old = document.getElementById("careerShapeFactory");
    if (old) {
      old.hidden = true;
      old.setAttribute("aria-hidden", "true");
    }
  }

  function installStyles() {
    if (document.getElementById("careerShapeUnifiedStyles")) return;
    const style = document.createElement("style");
    style.id = "careerShapeUnifiedStyles";
    style.textContent = `
      #careerShapeFactory[hidden]{display:none!important}
      .career-shape-mode-control{border:1px solid rgba(111,215,255,.16);border-radius:10px;padding:9px!important;background:rgba(111,215,255,.025)}
      .career-shape-mode-control small{color:#86a396!important}
      .career-shape-unified-card{border-color:rgba(111,215,255,.18)!important;background:linear-gradient(135deg,rgba(111,215,255,.035),rgba(87,242,135,.015))!important}
      .career-chip,.career-unified-summary-chip{color:#75dcff!important;border:1px solid rgba(111,215,255,.22);background:rgba(111,215,255,.07);border-radius:999px;padding:3px 7px;font-weight:800}
      .career-unified-summary-chip{display:inline-flex;margin:4px;font-size:.7rem}
      @media(max-width:720px){
        .career-shape-mode-control{grid-column:1/-1!important}
        .career-shape-mode-control select{width:100%!important;min-height:40px!important}
        .career-shape-unified-card .factory-prompt-meta{gap:5px!important}
      }
    `;
    document.head.append(style);
  }

  function restoreCombinedMessage() {
    const added = Number(sessionStorage.getItem("fplUnifiedCareerShapeAdded") || 0);
    if (!added) return;
    sessionStorage.removeItem("fplUnifiedCareerShapeAdded");
    const status = document.getElementById("promptFactoryStatus");
    if (status) {
      const base = status.textContent || "Prompt Library updated.";
      status.textContent = `${base} The same add action also saved ${added} Career Shape prompt${added === 1 ? "" : "s"}.`;
    }
  }

  function install() {
    const factory = document.getElementById("automaticPromptFactory");
    const generate = document.getElementById("generatePromptBatchBtn");
    if (!factory || !generate || generate.dataset.careerUnifiedInstalled) return;
    generate.dataset.careerUnifiedInstalled = "true";
    installStyles();
    hideLegacyCareerFactory();
    installModeControl();

    generate.addEventListener("click", onGenerateCapture, true);
    document.getElementById("addPromptBatchBtn")?.addEventListener("click", onAddCapture, true);
    document.getElementById("selectPromptBatchBtn")?.addEventListener("click", () => setTimeout(onSelectBubble, 0));
    document.getElementById("clearPromptBatchBtn")?.addEventListener("click", () => setTimeout(onClearBubble, 0));
    document.getElementById("promptFactoryPreview")?.addEventListener("change", event => {
      if (event.target.matches("[data-career-unified-select]")) updateButtons();
    });
    document.getElementById("factoryCareerShapeMode")?.addEventListener("change", () => {
      clearCareerPreview();
      const status = document.getElementById("promptFactoryStatus");
      if (status) status.textContent = mode() === "mix"
        ? "Career Shape rules will be mixed into the next checked batch."
        : mode() === "only"
          ? "The next checked batch will use Career Shape rules only."
          : "Career Shape rules are excluded from the next checked batch.";
      updateButtons();
    });
    restoreCombinedMessage();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();

  window.FPL_CAREER_SHAPE_UNIFIED = Object.freeze({ version: "1.0.0", settings, generateCareerBatch });
})();
