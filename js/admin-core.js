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

    elements.codeOutput.value = `/* Generated by FPL Challenge Studio.\n   Exact perfect score calculated with eleven unique footballers.\n   Review before publishing. */\nwindow.FPL_DAILY_CHALLENGE = {\n  id: ${JSON.stringify(`daily-${releaseDate}-${slug}`)},\n  number: ${challengeNumber},\n  title: ${JSON.stringify(`${formatChallengeDate(releaseDate)} · ${challengeName}`)},\n  dateLabel: ${JSON.stringify(`Generated Mix · ${difficulty}`)},\n  difficulty: ${JSON.stringify(difficulty)},\n  releaseDate: ${JSON.stringify(releaseDate)},\n  perfectScore: ${perfectScore},\n  prompts: [\n${promptsCode}\n  ]\n};\n`;

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
    testOutcome: document.querySelector("#testOutcome")
  };

  let history = loadHistory();
  let testState = createTestState();

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
    updateHistoryStatus();
    syncDraftAvailability();
    startTimerLoop();
  }

  function bindEvents() {
    elements.startTestBtn.addEventListener("click", startFreshTest);
    elements.loadPerfectBtn.addEventListener("click", loadOptimalXI);
    elements.autoTestBtn.addEventListener("click", runAutomaticChecks);
    elements.resetTestBtn.addEventListener("click", resetTester);
    elements.revealTestBtn.addEventListener("click", revealTestXI);
    elements.cooldownChallenges.addEventListener("change", () => {
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
      ? "Automatic checks passed. You can manually play through it as an extra check."
      : "One or more automatic checks failed. Do not upload this challenge yet.";
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

  function updateHistoryStatus() {
    const count = sortedHistory().length;
    if (elements.historyStatus) {
      elements.historyStatus.textContent = `${count} challenge${count === 1 ? "" : "s"} recorded`;
    }
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
    updateHistoryStatus();
    core?.refreshDraft?.();
  }

  function formatHistoryDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return String(value || "No date");
    const [, year, month, day] = match;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12)));
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
/* FPL Challenge Studio — player database auditor, reviewed 2026-07-28.
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
