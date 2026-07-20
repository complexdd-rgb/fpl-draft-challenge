(() => {
  "use strict";

  const FORMATION = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD"];
  const DIFFICULTY_VALUE = { easy: 1, medium: 2, hard: 3 };
  const DIVERSITY_TAGS = new Set([
    "relegated", "promoted", "bottom-half", "mid-table", "survival",
    "outside-big-six", "outside-top-four", "manager", "budget", "young", "exact-stat"
  ]);
  const STORAGE_KEY = "fplChallengeStudioPhase2Draft";
  const LEGACY_STORAGE_KEY = "fplChallengeStudioPhase1Draft";
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
    minAntiMeta: document.querySelector("#minAntiMeta"),
    avoidRecent: document.querySelector("#avoidRecent"),
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
    elements.libraryStatus.textContent = `${promptLibrary.length} prompts checked`;
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
      elements.minAntiMeta,
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
      ? `${promptLibrary.length} prompts loading…`
      : "Not found";
  }

  function getPromptStats(prompt) {
    if (statsCache.has(prompt.id)) return statsCache.get(prompt.id);

    const matches = [];
    for (const record of records) {
      if (record.position !== prompt.position) continue;
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
    return {
      minAnswers,
      maxAnswers,
      minAntiMeta,
      avoidRecent: elements.avoidRecent.checked,
      difficultyTarget: elements.difficultyTarget.value
    };
  }

  function eligiblePrompts(position, settings, excludedIds = new Set()) {
    return promptLibrary.filter(prompt => {
      if (prompt.position !== position || excludedIds.has(prompt.id)) return false;
      if (settings.avoidRecent && recentPromptIds.has(prompt.id)) return false;
      const count = getPromptStats(prompt).playerCount;
      return count >= settings.minAnswers && count <= settings.maxAnswers;
    });
  }

  function generateDraft() {
    const settings = currentSettings();
    elements.actionStatus.textContent = "Generating and checking prompt balance…";

    const positionAvailability = Object.fromEntries(
      ["GK", "DEF", "MID", "FWD"].map(position => [position, eligiblePrompts(position, settings).length])
    );
    const required = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
    const missing = Object.keys(required).filter(position => positionAvailability[position] < required[position]);

    if (missing.length) {
      elements.actionStatus.textContent = `Not enough eligible ${missing.join(", ")} prompts. Increase the maximum answers, lower the minimum, or allow Challenge #6 prompts.`;
      return;
    }

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let attempt = 0; attempt < 900; attempt += 1) {
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
      const score = scoreDraft(candidate, settings);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (!best) {
      elements.actionStatus.textContent = "A complete XI could not be generated with those restrictions.";
      return;
    }

    selectedPrompts = best;
    elements.draftPanel.classList.remove("hidden");
    elements.codePanel.classList.remove("hidden");
    elements.saveDraftBtn.disabled = false;
    refreshDraft();
    elements.actionStatus.textContent = "Draft generated. The exact unique-player perfect score has been calculated.";
    elements.draftPanel.scrollIntoView({ behavior: "smooth", block: "start" });
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
    `;

    const warnings = [];
    const settings = currentSettings();
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

    elements.codeOutput.value = `/* Generated by FPL Challenge Studio Phase 2.\n   Exact perfect score calculated with eleven unique footballers.\n   Review before manually uploading to GitHub. */\nwindow.FPL_DAILY_CHALLENGE = {\n  id: ${JSON.stringify(`daily-${String(challengeNumber).padStart(3, "0")}-${slug}`)},\n  number: ${challengeNumber},\n  title: ${JSON.stringify(`Challenge #${challengeNumber} · ${challengeName}`)},\n  dateLabel: ${JSON.stringify(`Generated Mix · ${difficulty}`)},\n  difficulty: ${JSON.stringify(difficulty)},\n  releaseDate: ${JSON.stringify(releaseDate)},\n  perfectScore: ${perfectScore},\n  prompts: [\n${promptsCode}\n  ]\n};\n`;

    elements.downloadBtn.disabled = !currentPerfect?.possible;
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
      version: 2,
      savedAt: new Date().toISOString(),
      promptIds: selectedPrompts.map(prompt => prompt.id),
      settings: {
        challengeNumber: elements.challengeNumber.value,
        challengeName: elements.challengeName.value,
        difficultyTarget: elements.difficultyTarget.value,
        releaseDate: elements.releaseDate.value,
        minAnswers: elements.minAnswers.value,
        maxAnswers: elements.maxAnswers.value,
        minAntiMeta: elements.minAntiMeta.value,
        avoidRecent: elements.avoidRecent.checked
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    elements.actionStatus.textContent = "Draft saved in this browser. It has not been published or sent anywhere.";
  }

  function loadDraft() {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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
    if (!currentPerfect?.possible || !elements.codeOutput.value) return;
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
})();
