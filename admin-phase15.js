(() => {
  "use strict";

  const STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const SESSION_MESSAGE_KEY = "fplChallengeStudioPromptFactoryMessage";
  const HARD_MAX = 50;
  const RECOMMENDED_MAX = 25;
  const BIG_SIX = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"];
  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const POSITION_LABELS = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };

  let currentBatch = [];
  let flatRecords = [];
  let existingPoolIndex = new Map();
  let existingLabelTokens = [];

  window.addEventListener("load", initialiseFactory, { once: true });

  function initialiseFactory() {
    const panel = document.querySelector("#automaticPromptFactory");
    const core = window.FPL_STUDIO_API;
    const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
    if (!panel || !core || !players.length) return;

    flatRecords = players.flatMap(player => (player.seasons || []).map(season => ({
      ...season,
      playerId: player.playerId,
      name: player.name,
      playerName: player.name
    })));

    const elements = getElements();
    elements.generateBtn.addEventListener("click", () => generateBatch(elements, core));
    elements.selectBtn.addEventListener("click", () => toggleAll(elements));
    elements.addBtn.addEventListener("click", () => addSelectedToLibrary(elements));
    elements.clearBtn.addEventListener("click", () => clearPreview(elements));
    elements.preview.addEventListener("change", event => {
      if (event.target.matches("[data-factory-select]")) updateSelectionState(elements);
    });

    const message = sessionStorage.getItem(SESSION_MESSAGE_KEY);
    if (message) {
      sessionStorage.removeItem(SESSION_MESSAGE_KEY);
      elements.status.textContent = message;
    }
  }

  function getElements() {
    return {
      count: document.querySelector("#factoryPromptCount"),
      position: document.querySelector("#factoryPositionMix"),
      difficulty: document.querySelector("#factoryDifficultyMix"),
      minimum: document.querySelector("#factoryMinPlayers"),
      maximum: document.querySelector("#factoryMaxPlayers"),
      cooldown: document.querySelector("#factoryCooldown"),
      relationship: document.querySelector("#factoryRelationshipMode"),
      exclusion: document.querySelector("#factoryExclusionMode"),
      includeNames: document.querySelector("#factoryIncludeNameRules"),
      avoidPools: document.querySelector("#factoryAvoidSimilarPools"),
      enable: document.querySelector("#factoryEnablePrompts"),
      generateBtn: document.querySelector("#generatePromptBatchBtn"),
      selectBtn: document.querySelector("#selectPromptBatchBtn"),
      addBtn: document.querySelector("#addPromptBatchBtn"),
      clearBtn: document.querySelector("#clearPromptBatchBtn"),
      status: document.querySelector("#promptFactoryStatus"),
      summary: document.querySelector("#promptFactorySummary"),
      preview: document.querySelector("#promptFactoryPreview")
    };
  }

  function generateBatch(elements, core) {
    const requested = clampInteger(elements.count.value, 1, HARD_MAX, 20);
    const minimum = clampInteger(elements.minimum.value, 3, 100, 6);
    const maximum = clampInteger(elements.maximum.value, minimum, 250, 100);
    const cooldown = clampInteger(elements.cooldown.value, 0, 50, 10);
    const positionMode = POSITIONS.includes(elements.position.value) ? elements.position.value : "balanced";
    const difficultyMode = ["easy", "medium", "hard"].includes(elements.difficulty.value) ? elements.difficulty.value : "balanced";
    const relationshipMode = ["none", "mix", "only"].includes(elements.relationship?.value) ? elements.relationship.value : "mix";
    const exclusionMode = ["none", "mix", "top1", "top2"].includes(elements.exclusion?.value) ? elements.exclusion.value : "mix";

    elements.count.value = requested;
    elements.minimum.value = minimum;
    elements.maximum.value = maximum;
    elements.cooldown.value = cooldown;
    elements.generateBtn.disabled = true;
    elements.status.textContent = `Building and checking up to ${requested} prompts against ${flatRecords.length.toLocaleString()} player-seasons…`;
    elements.preview.classList.add("hidden");
    elements.summary.classList.add("hidden");

    setTimeout(() => {
      try {
        buildExistingIndexes(core);
        const variants = buildCandidateVariants({
          includeNameRules: elements.includeNames.checked,
          positionMode,
          cooldown,
          relationshipMode
        });
        shuffle(variants);

        const evaluated = [];
        const rejected = { answerRange: 0, duplicate: 0, similar: 0, broken: 0 };
        const seenCandidatePools = new Map();
        const familyCounts = new Map();
        const familyLimit = Math.max(2, Math.ceil(requested / 6));

        for (const variant of variants) {
          if (evaluated.length >= Math.max(requested * 5, 100)) break;
          try {
            let prompt = hydrateVariant(variant, core);
            let stats = core.getPromptStats(prompt);
            prompt = applyRequestedExclusion(prompt, stats, exclusionMode, core);
            stats = core.getPromptStats(prompt);
            if (stats.playerCount < minimum || stats.playerCount > maximum) {
              rejected.answerRange += 1;
              continue;
            }

            prompt.difficulty = classifyDifficulty(stats.playerCount);
            if (difficultyMode !== "balanced" && prompt.difficulty !== difficultyMode) continue;

            const labelKey = normaliseLabel(prompt.label);
            if (existingLabelTokens.some(item => item.position === prompt.position && labelSimilarity(labelKey, item.key) >= 0.86)) {
              rejected.duplicate += 1;
              continue;
            }

            const signature = poolSignature(stats);
            if (!signature) {
              rejected.broken += 1;
              continue;
            }
            if (existingPoolIndex.has(`${prompt.position}|${signature}`) || seenCandidatePools.has(`${prompt.position}|${signature}`)) {
              rejected.duplicate += 1;
              continue;
            }

            if (elements.avoidPools.checked && hasNearPoolDuplicate(prompt.position, stats, existingPoolIndex, seenCandidatePools)) {
              rejected.similar += 1;
              continue;
            }

            const familyUsed = familyCounts.get(prompt.family) || 0;
            if (familyUsed >= familyLimit) continue;

            prompt.stats = stats;
            prompt.poolSignature = signature;
            prompt.id = uniqueGeneratedId(prompt.idBase, evaluated);
            prompt.rating = prompt.difficulty === "easy" ? 3 : 4;
            prompt.enabled = elements.enable.checked;
            prompt.selected = true;
            evaluated.push(prompt);
            familyCounts.set(prompt.family, familyUsed + 1);
            seenCandidatePools.set(`${prompt.position}|${signature}`, stats.bestByPlayer);
          } catch (error) {
            rejected.broken += 1;
          }
        }

        currentBatch = chooseBalancedBatch(evaluated, requested, positionMode, difficultyMode);
        renderBatch(elements, requested, rejected);
      } catch (error) {
        elements.status.textContent = `Automatic generation failed safely: ${error.message}`;
        currentBatch = [];
        updateButtons(elements);
      } finally {
        elements.generateBtn.disabled = false;
      }
    }, 30);
  }

  function buildExistingIndexes(core) {
    existingPoolIndex = new Map();
    existingLabelTokens = [];
    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
    for (const prompt of library) {
      existingLabelTokens.push({ position: prompt.position, key: normaliseLabel(prompt.label) });
      try {
        const stats = core.getPromptStats(prompt);
        const signature = poolSignature(stats);
        if (signature) existingPoolIndex.set(`${prompt.position}|${signature}`, stats.bestByPlayer);
      } catch {
        // Existing broken prompts are handled by the normal manager and do not block the factory.
      }
    }
  }

  function buildCandidateVariants({ includeNameRules, positionMode, cooldown, relationshipMode = "mix" }) {
    const positions = positionMode === "balanced" ? POSITIONS : [positionMode];
    const variants = [];
    const add = (position, family, idBase, label, fail, tags, conditions, join = "all") => {
      variants.push({ position, family, idBase, label, fail, tags, cooldown, studioRule: { kind: "builder", join, conditions } });
    };

    if (relationshipMode !== "only") for (const position of positions) {
      const noun = POSITION_LABELS[position];
      const lower = noun.toLowerCase();

      for (const [low, high] of [[40, 80], [60, 100], [80, 120], [100, 150], [120, 180], [150, 210]]) {
        add(position, "points-range", `${position.toLowerCase()}_points_${low}_${high}`, `${noun} with between ${low} and ${high} FPL points`, `That ${lower} season must score between ${low} and ${high} FPL points.`, ["auto-generated", "points", "range"], [num("points", "between", low, high)]);
      }

      for (const [low, high] of [[500, 1500], [1000, 2000], [1500, 2500], [2000, 3000], [2500, 3420]]) {
        add(position, "minutes-range", `${position.toLowerCase()}_minutes_${low}_${high}`, `${noun} who played between ${formatNumber(low)} and ${formatNumber(high)} minutes`, `That ${lower} season must include between ${formatNumber(low)} and ${formatNumber(high)} minutes.`, ["auto-generated", "minutes", "range", "anti-meta"], [num("minutes", "between", low, high)]);
      }

      for (const [low, high, minutes] of [[1, 4, 1500], [5, 8, 1800], [7, 12, 2000], [10, 15, 1800], [13, 17, 1800]]) {
        add(position, "league-position", `${position.toLowerCase()}_league_${low}_${high}_${minutes}`, `${noun} from a club finishing ${low}th–${high}th who played at least ${formatNumber(minutes)} minutes`, `That ${lower}'s club must finish ${low}th–${high}th and the season must include at least ${formatNumber(minutes)} minutes.`, ["auto-generated", "league-position", "minutes", "anti-meta"], [num("leaguePosition", "between", low, high), num("minutes", "gte", minutes)]);
      }

      for (const [low, high, minutes] of [[18, 22, 1200], [20, 24, 1800], [23, 27, 2000], [28, 31, 2000], [31, 35, 1400]]) {
        add(position, "age-minutes", `${position.toLowerCase()}_age_${low}_${high}_${minutes}`, `${noun} aged ${low}–${high} who played at least ${formatNumber(minutes)} minutes`, `That ${lower} must be aged ${low}–${high} at the season start and play at least ${formatNumber(minutes)} minutes.`, ["auto-generated", "age", "minutes", "anti-meta"], [num("ageAtSeasonStart", "between", low, high), num("minutes", "gte", minutes)]);
      }

      if (includeNameRules) {
        for (const letter of ["A", "B", "C", "D", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "S", "T", "W"]) {
          add(position, "surname-initial", `${position.toLowerCase()}_surname_${letter.toLowerCase()}_minutes`, `${noun} whose surname starts with ${letter} and who played at least 1,000 minutes`, `That ${lower}'s surname must start with ${letter} and the season must include at least 1,000 minutes.`, ["auto-generated", "name-rule", "surname", "anti-meta"], [text("surname", "startsWith", letter), num("minutes", "gte", 1000)]);
          add(position, "first-initial", `${position.toLowerCase()}_first_${letter.toLowerCase()}_points`, `${noun} whose first name starts with ${letter} and who scored at least 60 FPL points`, `That ${lower}'s first name must start with ${letter} and the season must score at least 60 FPL points.`, ["auto-generated", "name-rule", "first-name", "anti-meta"], [text("firstName", "startsWith", letter), num("points", "gte", 60)]);
        }
        for (const length of [6, 7, 8, 9, 10]) {
          add(position, "surname-length", `${position.toLowerCase()}_surname_length_${length}`, `${noun} whose surname has at least ${length} letters and who played 1,500+ minutes`, `That ${lower}'s surname must contain at least ${length} letters and the season must include at least 1,500 minutes.`, ["auto-generated", "name-rule", "surname", "anti-meta"], [num("surnameLength", "gte", length), num("minutes", "gte", 1500)]);
        }
        add(position, "same-initials", `${position.toLowerCase()}_same_initials_points`, `${noun} whose first name and surname share an initial with 50+ FPL points`, `That ${lower}'s first name and surname must share an initial and the season must score at least 50 points.`, ["auto-generated", "name-rule", "initials", "anti-meta"], [bool("sameInitials"), num("points", "gte", 50)]);
        add(position, "hyphenated", `${position.toLowerCase()}_hyphenated_minutes`, `${noun} with a hyphenated surname who played 500+ minutes`, `That ${lower} must have a hyphenated surname and play at least 500 minutes.`, ["auto-generated", "name-rule", "hyphenated", "anti-meta"], [bool("hyphenatedSurname"), num("minutes", "gte", 500)]);
      }
    }

    if (relationshipMode !== "only") {
      addPositionSpecificVariants(variants, positions, cooldown, add);
      addManagerVariants(variants, positions, cooldown, add);
    }
    if (relationshipMode !== "none") addTeammateVariants(variants, positions, cooldown);
    return variants;
  }

  function addPositionSpecificVariants(variants, positions, cooldown, add) {
    if (positions.includes("GK")) {
      for (const saves of [70, 90, 110, 130]) {
        for (const [low, high] of [[7, 12], [10, 15], [13, 17]]) {
          add("GK", "gk-saves-league", `gk_saves_${saves}_league_${low}_${high}`, `Goalkeeper with ${saves}+ saves from a club finishing ${low}th–${high}th`, `That goalkeeper season must include at least ${saves} saves for a club finishing ${low}th–${high}th.`, ["auto-generated", "goalkeeper", "saves", "league-position", "anti-meta"], [num("saves", "gte", saves), num("leaguePosition", "between", low, high)]);
        }
      }
      for (const cleanSheets of [6, 8, 10, 12]) {
        for (const price of [4.5, 5, 5.5]) {
          add("GK", "gk-budget-clean", `gk_clean_${cleanSheets}_price_${price}`, `Goalkeeper with ${cleanSheets}+ clean sheets who started at £${price.toFixed(1)}m or less`, `That goalkeeper must record at least ${cleanSheets} clean sheets and start at £${price.toFixed(1)}m or less.`, ["auto-generated", "goalkeeper", "clean-sheets", "budget", "anti-meta"], [num("cleanSheets", "gte", cleanSheets), num("startingPrice", "lte", price)]);
        }
      }
      for (const points of [50, 80, 100]) {
        add("GK", "gk-assist", `gk_assist_points_${points}`, `Goalkeeper with an assist and at least ${points} FPL points`, `That goalkeeper season must include an assist and at least ${points} FPL points.`, ["auto-generated", "goalkeeper", "assist", "anti-meta"], [num("assists", "gte", 1), num("points", "gte", points)]);
      }
      for (const flag of ["promoted", "relegated", "bottomHalf"]) {
        for (const saves of [70, 90, 110]) {
          const phrase = flag === "promoted" ? "promoted club" : flag === "relegated" ? "relegated club" : "bottom-half club";
          add("GK", `gk-${flag}`, `gk_${flag}_saves_${saves}`, `Goalkeeper from a ${phrase} with ${saves}+ saves`, `That goalkeeper must play for a ${phrase} and record at least ${saves} saves.`, ["auto-generated", "goalkeeper", flag, "saves", "anti-meta"], [bool(flag), num("saves", "gte", saves)]);
        }
      }
    }

    if (positions.includes("DEF")) {
      for (const cleanSheets of [8, 10, 12]) {
        for (const price of [4.5, 5, 5.5]) {
          add("DEF", "def-budget-clean", `def_clean_${cleanSheets}_price_${price}`, `Defender with ${cleanSheets}+ clean sheets who started at £${price.toFixed(1)}m or less`, `That defender must record at least ${cleanSheets} clean sheets and start at £${price.toFixed(1)}m or less.`, ["auto-generated", "defender", "clean-sheets", "budget", "anti-meta"], [num("cleanSheets", "gte", cleanSheets), num("startingPrice", "lte", price)]);
        }
      }
      for (const assists of [3, 5, 7]) {
        add("DEF", "def-creative-outside", `def_outside_assists_${assists}`, `Defender outside the traditional Big Six with ${assists}+ assists`, `That defender must play outside the traditional Big Six and record at least ${assists} assists.`, ["auto-generated", "defender", "assists", "outside-big-six", "anti-meta"], [bool("outsideBigSix"), num("assists", "gte", assists)]);
        add("DEF", "def-bottom-assists", `def_bottom_assists_${assists}`, `Defender from a bottom-half club with ${assists}+ assists`, `That defender must play for a bottom-half club and record at least ${assists} assists.`, ["auto-generated", "defender", "assists", "bottom-half", "anti-meta"], [bool("bottomHalf"), num("assists", "gte", assists)]);
      }
      for (const goals of [2, 3, 4]) {
        for (const minutes of [1500, 2000]) {
          add("DEF", "def-exact-goals", `def_goals_${goals}_minutes_${minutes}`, `Defender who scored exactly ${goals} goals and played ${formatNumber(minutes)}+ minutes`, `That defender must score exactly ${goals} goals and play at least ${formatNumber(minutes)} minutes.`, ["auto-generated", "defender", "goals", "minutes", "anti-meta"], [num("goals", "eq", goals), num("minutes", "gte", minutes)]);
        }
      }
      for (const assists of [4, 6, 8]) {
        add("DEF", "def-assists-over-goals", `def_assists_over_goals_${assists}`, `Defender with more assists than goals and at least ${assists} assists`, `That defender must record more assists than goals and at least ${assists} assists.`, ["auto-generated", "defender", "assists", "anti-meta"], [bool("assistsMoreThanGoals"), num("assists", "gte", assists)]);
      }
    }

    if (positions.includes("MID")) {
      for (const goals of [5, 8, 10, 12]) {
        for (const assists of [3, 5, 7]) {
          add("MID", "mid-goals-assists", `mid_goals_${goals}_assists_${assists}`, `Midfielder with ${goals}+ goals and ${assists}+ assists`, `That midfielder season must include at least ${goals} goals and ${assists} assists.`, ["auto-generated", "midfielder", "goals", "assists"], [num("goals", "gte", goals), num("assists", "gte", assists)]);
        }
      }
      for (const assists of [6, 8, 10, 12]) {
        add("MID", "mid-creator", `mid_assists_over_goals_${assists}`, `Midfielder with more assists than goals and ${assists}+ assists`, `That midfielder must record more assists than goals and at least ${assists} assists.`, ["auto-generated", "midfielder", "assists", "anti-meta"], [bool("assistsMoreThanGoals"), num("assists", "gte", assists)]);
      }
      for (const [low, high] of [[8, 12], [10, 15], [12, 18], [15, 22]]) {
        for (const price of [6, 7, 8]) {
          add("MID", "mid-budget-involvements", `mid_gi_${low}_${high}_price_${price}`, `Midfielder with ${low}–${high} goal involvements who started at £${price.toFixed(1)}m or less`, `That midfielder must record ${low}–${high} combined goals and assists and start at £${price.toFixed(1)}m or less.`, ["auto-generated", "midfielder", "goal-involvements", "budget", "anti-meta"], [num("goalInvolvements", "between", low, high), num("startingPrice", "lte", price)]);
        }
      }
      for (const goals of [3, 4, 5, 6]) {
        for (const [low, high] of [[7, 12], [10, 15], [13, 17]]) {
          add("MID", "mid-exact-goals-league", `mid_goals_${goals}_league_${low}_${high}`, `Midfielder from a club finishing ${low}th–${high}th who scored exactly ${goals} goals`, `That midfielder's club must finish ${low}th–${high}th and the player must score exactly ${goals} goals.`, ["auto-generated", "midfielder", "goals", "league-position", "anti-meta"], [num("leaguePosition", "between", low, high), num("goals", "eq", goals)]);
        }
      }
      for (const flag of ["promoted", "relegated"]) {
        for (const involvements of [5, 8, 10]) {
          const phrase = flag === "promoted" ? "promoted club" : "relegated club";
          add("MID", `mid-${flag}`, `mid_${flag}_gi_${involvements}`, `Midfielder from a ${phrase} with ${involvements}+ goal involvements`, `That midfielder must play for a ${phrase} and record at least ${involvements} combined goals and assists.`, ["auto-generated", "midfielder", flag, "goal-involvements", "anti-meta"], [bool(flag), num("goalInvolvements", "gte", involvements)]);
        }
      }
    }

    if (positions.includes("FWD")) {
      for (const goals of [8, 10, 12, 15, 18]) {
        add("FWD", "fwd-goals-outside", `fwd_outside_goals_${goals}`, `Forward outside the traditional Big Six with ${goals}+ goals`, `That forward must play outside the traditional Big Six and score at least ${goals} goals.`, ["auto-generated", "forward", "goals", "outside-big-six", "anti-meta"], [bool("outsideBigSix"), num("goals", "gte", goals)]);
      }
      for (const involvements of [10, 12, 15, 18]) {
        for (const price of [6.5, 7.5, 8.5]) {
          add("FWD", "fwd-budget-involvements", `fwd_gi_${involvements}_price_${price}`, `Forward with ${involvements}+ goal involvements who started at £${price.toFixed(1)}m or less`, `That forward must record at least ${involvements} combined goals and assists and start at £${price.toFixed(1)}m or less.`, ["auto-generated", "forward", "goal-involvements", "budget", "anti-meta"], [num("goalInvolvements", "gte", involvements), num("startingPrice", "lte", price)]);
        }
      }
      for (const flag of ["promoted", "relegated", "bottomHalf"]) {
        for (const goals of [6, 8, 10, 12]) {
          const phrase = flag === "promoted" ? "promoted club" : flag === "relegated" ? "relegated club" : "bottom-half club";
          add("FWD", `fwd-${flag}`, `fwd_${flag}_goals_${goals}`, `Forward from a ${phrase} with ${goals}+ goals`, `That forward must play for a ${phrase} and score at least ${goals} goals.`, ["auto-generated", "forward", flag, "goals", "anti-meta"], [bool(flag), num("goals", "gte", goals)]);
        }
      }
      for (const assists of [4, 5, 6]) {
        for (const goals of [5, 8, 10]) {
          add("FWD", "fwd-balanced-return", `fwd_goals_${goals}_assists_${assists}`, `Forward with ${goals}+ goals and ${assists}+ assists`, `That forward season must include at least ${goals} goals and ${assists} assists.`, ["auto-generated", "forward", "goals", "assists"], [num("goals", "gte", goals), num("assists", "gte", assists)]);
        }
      }
      for (const minutes of [1600, 2000, 2400]) {
        for (const goals of [8, 10, 12]) {
          add("FWD", "fwd-efficient", `fwd_minutes_${minutes}_goals_${goals}`, `Forward who played at most ${formatNumber(minutes)} minutes and scored ${goals}+ goals`, `That forward must play no more than ${formatNumber(minutes)} minutes and score at least ${goals} goals.`, ["auto-generated", "forward", "goals", "minutes", "anti-meta"], [num("minutes", "lte", minutes), num("goals", "gte", goals)]);
        }
      }
    }
  }

  function addManagerVariants(variants, positions, cooldown, add) {
    const managerMaps = new Map(POSITIONS.map(position => [position, new Map()]));
    const seenByManager = new Map();
    for (const record of flatRecords) {
      if (!POSITIONS.includes(record.position) || !Array.isArray(record.managers)) continue;
      for (const manager of record.managers) {
        const key = `${record.position}|${manager}`;
        if (!seenByManager.has(key)) seenByManager.set(key, new Set());
        seenByManager.get(key).add(record.playerId);
      }
    }
    for (const [key, players] of seenByManager) {
      const [position, manager] = key.split("|");
      if (players.size >= 8) managerMaps.get(position).set(manager, players.size);
    }

    for (const position of positions) {
      const noun = POSITION_LABELS[position];
      const lower = noun.toLowerCase();
      const managers = [...managerMaps.get(position).entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
      for (const [manager] of managers) {
        for (const minutes of [1000, 1800, 2500]) {
          const safeManager = slugify(manager);
          add(position, "manager-minutes", `${position.toLowerCase()}_${safeManager}_minutes_${minutes}`, `${noun} managed by ${manager} who played ${formatNumber(minutes)}+ minutes`, `That ${lower} season must have been managed by ${manager} and include at least ${formatNumber(minutes)} minutes.`, ["auto-generated", "manager", "minutes", "anti-meta"], [text("manager", "equals", manager), num("minutes", "gte", minutes)]);
        }
      }
    }
  }


  function addTeammateVariants(variants, positions, cooldown) {
    const playerRows = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
    const playerById = new Map(playerRows.map(player => [player.playerId, player]));
    const nameCounts = new Map();
    for (const player of playerRows) {
      const key = normaliseLabel(player.name);
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    }

    const clubSeasonRecords = new Map();
    const anchorData = new Map();
    for (const record of flatRecords) {
      if (!(Number(record.minutes) > 0) || !record.playerId || !record.season || !record.club) continue;
      const key = `${record.season}|${record.club}`;
      if (!clubSeasonRecords.has(key)) clubSeasonRecords.set(key, []);
      clubSeasonRecords.get(key).push(record);

      if (!anchorData.has(record.playerId)) {
        const player = playerById.get(record.playerId);
        anchorData.set(record.playerId, {
          playerId: record.playerId,
          name: player?.name || record.playerName || record.name || record.playerId,
          keys: new Set(),
          seasons: new Set(),
          totalMinutes: 0,
          totalPoints: 0
        });
      }
      const anchor = anchorData.get(record.playerId);
      anchor.keys.add(key);
      anchor.seasons.add(record.season);
      anchor.totalMinutes += Number(record.minutes) || 0;
      anchor.totalPoints += Number(record.points) || 0;
    }

    const anchors = [...anchorData.values()]
      .filter(anchor => nameCounts.get(normaliseLabel(anchor.name)) === 1)
      .filter(anchor => anchor.seasons.size >= 2 && anchor.totalMinutes >= 1800)
      .sort((a, b) => b.totalPoints - a.totalPoints || b.totalMinutes - a.totalMinutes)
      .slice(0, 180);

    const pointThresholds = { GK: [70, 100], DEF: [70, 100], MID: [80, 120], FWD: [70, 100] };
    for (const position of positions) {
      const noun = POSITION_LABELS[position];
      const lower = noun.toLowerCase();
      for (const anchor of anchors) {
        const teammateIds = new Set();
        for (const key of anchor.keys) {
          for (const record of clubSeasonRecords.get(key) || []) {
            if (record.position === position && record.playerId !== anchor.playerId && Number(record.minutes) > 0) {
              teammateIds.add(record.playerId);
            }
          }
        }
        if (teammateIds.size < 4 || teammateIds.size > 180) continue;

        const keys = [...anchor.keys].sort();
        const baseSource = buildClubSeasonTeammateSource(anchor.playerId, keys);
        variants.push({
          position,
          family: `${position.toLowerCase()}-club-season-teammate`,
          idBase: `${position.toLowerCase()}_teammate_${slugify(anchor.name)}`,
          label: `${noun} who shared a Premier League club-season with ${anchor.name}`,
          fail: `That ${lower} must have recorded minutes for the same club in the same FPL season as ${anchor.name}.`,
          tags: ["auto-generated", "teammate", "relationship", "club-season", "anti-meta"],
          cooldown,
          studioRule: { kind: "source", source: baseSource }
        });

        if (teammateIds.size >= 9) {
          for (const threshold of pointThresholds[position]) {
            const source = `p => ((${baseSource})(p) && Number(p.points) >= ${threshold})`;
            variants.push({
              position,
              family: `${position.toLowerCase()}-club-season-teammate-points`,
              idBase: `${position.toLowerCase()}_teammate_${slugify(anchor.name)}_points_${threshold}`,
              label: `${noun} who shared a club-season with ${anchor.name} and scored ${threshold}+ FPL points`,
              fail: `That ${lower} must share a club-season with ${anchor.name} and score at least ${threshold} FPL points in the qualifying season.`,
              tags: ["auto-generated", "teammate", "relationship", "club-season", "points", "anti-meta"],
              cooldown,
              studioRule: { kind: "source", source }
            });
          }
        }
      }
    }
  }

  function buildClubSeasonTeammateSource(anchorPlayerId, clubSeasonKeys) {
    const anchorId = JSON.stringify(anchorPlayerId);
    const keys = JSON.stringify(clubSeasonKeys);
    return `p => (p.playerId !== ${anchorId} && Number(p.minutes) > 0 && ${keys}.includes(String(p.season || "") + "|" + String(p.club || "")))`;
  }

  function applyRequestedExclusion(prompt, stats, mode, core) {
    let exclusionCount = 0;
    if (mode === "top1") exclusionCount = 1;
    if (mode === "top2") exclusionCount = 2;
    if (mode === "mix") {
      const bucket = stableHash(prompt.idBase || prompt.label) % 10;
      exclusionCount = bucket < 3 ? 1 : bucket === 3 ? 2 : 0;
    }
    if (!exclusionCount || !stats?.topAnswers?.length) return prompt;

    const excluded = stats.topAnswers.slice(0, exclusionCount).filter(answer => answer?.playerId);
    if (excluded.length < exclusionCount) return prompt;

    const excludedIds = excluded.map(answer => answer.playerId);
    const excludedNames = excluded.map(answer => answer.playerName || answer.name || answer.playerId);
    const wording = excludedNames.length === 1
      ? `excluding ${excludedNames[0]}`
      : `excluding ${excludedNames.slice(0, -1).join(", ")} and ${excludedNames.at(-1)}`;
    const baseSource = String(prompt.testSource || prompt.studioRule?.source || "p => false");
    const source = `p => ((${baseSource})(p) && !${JSON.stringify(excludedIds)}.includes(p.playerId))`;
    return hydrateVariant({
      ...prompt,
      family: `${prompt.family}-excluded`,
      idBase: `${prompt.idBase}_excluding_${excludedIds.map(slugify).join("_")}`,
      label: `${prompt.label} — ${wording}`,
      fail: `${prompt.fail} ${capitalise(wording)}.`,
      tags: [...new Set([...(prompt.tags || []), "anti-meta", "excludes-top"])],
      studioRule: { kind: "source", source },
      testSource: source
    }, core);
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function hydrateVariant(variant, core) {
    const testSource = variant.studioRule?.kind === "source"
      ? String(variant.studioRule.source || variant.testSource || "p => false")
      : compileRuleSource(variant.studioRule);
    const test = Function(`"use strict"; return (${testSource});`)();
    const temporaryId = `__factory_${Math.random().toString(36).slice(2)}`;
    core.invalidatePromptStats?.(temporaryId);
    return {
      ...variant,
      id: temporaryId,
      difficulty: "medium",
      rating: 4,
      enabled: false,
      test,
      testSource
    };
  }

  function chooseBalancedBatch(candidates, requested, positionMode, difficultyMode) {
    if (candidates.length <= requested) return candidates.slice();
    const chosen = [];
    const remaining = candidates.slice();
    const positionTargets = positionMode === "balanced"
      ? weightedTargets(requested, { GK: 0.17, DEF: 0.31, MID: 0.31, FWD: 0.21 })
      : { [positionMode]: requested };
    const difficultyTargets = difficultyMode === "balanced"
      ? weightedTargets(requested, { easy: 0.30, medium: 0.45, hard: 0.25 })
      : { [difficultyMode]: requested };

    const familyCounts = new Map();
    while (chosen.length < requested && remaining.length) {
      let bestIndex = -1;
      let bestScore = -Infinity;
      for (let index = 0; index < remaining.length; index += 1) {
        const candidate = remaining[index];
        const positionUsed = chosen.filter(item => item.position === candidate.position).length;
        const difficultyUsed = chosen.filter(item => item.difficulty === candidate.difficulty).length;
        const familyUsed = familyCounts.get(candidate.family) || 0;
        const score =
          ((positionTargets[candidate.position] || 0) - positionUsed) * 7 +
          ((difficultyTargets[candidate.difficulty] || 0) - difficultyUsed) * 5 -
          familyUsed * 4 +
          Math.random();
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      }
      if (bestIndex < 0) break;
      const [selected] = remaining.splice(bestIndex, 1);
      chosen.push(selected);
      familyCounts.set(selected.family, (familyCounts.get(selected.family) || 0) + 1);
    }
    return chosen;
  }

  function renderBatch(elements, requested, rejected) {
    if (!currentBatch.length) {
      elements.status.textContent = "No safe new prompts met those settings. Widen the valid-player range or choose balanced difficulty.";
      elements.preview.innerHTML = '<div class="factory-empty">No preview was created.</div>';
      elements.preview.classList.remove("hidden");
      elements.summary.classList.add("hidden");
      updateButtons(elements);
      return;
    }

    const counts = countBy(currentBatch, item => item.position);
    const difficulties = countBy(currentBatch, item => item.difficulty);
    elements.summary.innerHTML = `
      <article><span>Created</span><strong>${currentBatch.length} / ${requested}</strong></article>
      <article><span>Goalkeepers</span><strong>${counts.GK || 0}</strong></article>
      <article><span>Defenders / midfielders</span><strong>${counts.DEF || 0} / ${counts.MID || 0}</strong></article>
      <article><span>Forwards</span><strong>${counts.FWD || 0}</strong></article>
      <article><span>Easy / medium / hard</span><strong>${difficulties.easy || 0} / ${difficulties.medium || 0} / ${difficulties.hard || 0}</strong></article>
      <article><span>Teammate rules</span><strong>${currentBatch.filter(item => item.tags.includes("teammate")).length}</strong></article>
      <article><span>Top-answer exclusions</span><strong>${currentBatch.filter(item => item.tags.includes("excludes-top")).length}</strong></article>`;
    elements.summary.classList.remove("hidden");

    elements.preview.innerHTML = currentBatch.map((prompt, index) => {
      const examples = prompt.stats.topAnswers.slice(0, 3).map(answer => `${escapeHtml(answer.playerName)} (${escapeHtml(answer.season)})`).join(" · ");
      return `<article class="factory-prompt-card">
        <input class="factory-prompt-select" type="checkbox" data-factory-select="${index}" checked aria-label="Select ${escapeAttribute(prompt.label)}">
        <div class="factory-prompt-main">
          <h4><span class="position-badge">${prompt.position}</span> ${escapeHtml(prompt.label)}</h4>
          <p>${escapeHtml(prompt.id)}</p>
          <div class="factory-prompt-meta">
            <span>${capitalise(prompt.difficulty)}</span>
            <span>${prompt.stats.playerCount} players</span>
            <span>${prompt.stats.seasonCount} seasons</span>
            <span>Cooldown ${prompt.cooldown}</span>
            ${prompt.tags.includes("anti-meta") ? '<span class="anti">Anti-meta</span>' : ""}
            ${prompt.tags.includes("teammate") ? '<span class="relation">Teammate rule</span>' : ""}
            ${prompt.tags.includes("excludes-top") ? '<span class="exclude">Top answer excluded</span>' : ""}
          </div>
        </div>
        <div class="factory-prompt-examples"><strong>Example valid answers</strong>${examples || "No examples"}</div>
      </article>`;
    }).join("");
    elements.preview.classList.remove("hidden");

    const warning = currentBatch.length < requested ? ` Only ${currentBatch.length} sufficiently different prompts were available for these settings.` : "";
    const maxNote = requested > RECOMMENDED_MAX ? " This is a large review batch; 10–25 is normally easier to quality-check." : "";
    elements.status.textContent = `${currentBatch.length} checked prompts created. ${rejected.duplicate} duplicates, ${rejected.similar} near-identical pools and ${rejected.answerRange} out-of-range candidates were rejected.${warning}${maxNote}`;
    updateButtons(elements);
  }

  function addSelectedToLibrary(elements) {
    const selectedIndexes = [...elements.preview.querySelectorAll("[data-factory-select]:checked")].map(input => Number(input.dataset.factorySelect));
    const selected = selectedIndexes.map(index => currentBatch[index]).filter(Boolean);
    if (!selected.length) {
      elements.status.textContent = "Select at least one generated prompt before adding it.";
      return;
    }

    const state = loadManagerState();
    const existingIds = new Set([
      ...(Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY.map(prompt => prompt.id) : []),
      ...state.customs.map(prompt => prompt.id)
    ]);
    let added = 0;
    for (const prompt of selected) {
      if (existingIds.has(prompt.id)) continue;
      state.customs.push({
        id: prompt.id,
        position: prompt.position,
        label: prompt.label,
        fail: prompt.fail,
        difficulty: prompt.difficulty,
        tags: [...prompt.tags],
        rating: prompt.rating,
        cooldown: prompt.cooldown,
        enabled: prompt.enabled,
        studioRule: prompt.studioRule,
        testSource: prompt.testSource
      });
      existingIds.add(prompt.id);
      added += 1;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    sessionStorage.setItem(SESSION_MESSAGE_KEY, `${added} automatically generated prompt${added === 1 ? "" : "s"} added to the browser library. They are ${selected[0]?.enabled ? "enabled" : "disabled for review"}.`);
    window.location.reload();
  }

  function clearPreview(elements) {
    currentBatch = [];
    elements.preview.innerHTML = "";
    elements.summary.innerHTML = "";
    elements.preview.classList.add("hidden");
    elements.summary.classList.add("hidden");
    elements.status.textContent = "Preview cleared. No prompts were added.";
    updateButtons(elements);
  }

  function toggleAll(elements) {
    const boxes = [...elements.preview.querySelectorAll("[data-factory-select]")];
    const allSelected = boxes.length && boxes.every(box => box.checked);
    boxes.forEach(box => { box.checked = !allSelected; });
    updateSelectionState(elements);
  }

  function updateSelectionState(elements) {
    const boxes = [...elements.preview.querySelectorAll("[data-factory-select]")];
    const selected = boxes.filter(box => box.checked).length;
    elements.selectBtn.textContent = selected === boxes.length ? "Clear selection" : "Select all";
    elements.addBtn.disabled = selected === 0;
  }

  function updateButtons(elements) {
    const hasBatch = currentBatch.length > 0;
    elements.selectBtn.disabled = !hasBatch;
    elements.clearBtn.disabled = !hasBatch;
    elements.addBtn.disabled = !hasBatch;
    if (hasBatch) updateSelectionState(elements);
  }

  function loadManagerState() {
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
    } catch {
      // Fall through to a new state.
    }
    return { version: 1, overrides: {}, customs: [], deletedIds: [] };
  }

  function classifyDifficulty(playerCount) {
    if (playerCount <= 15) return "hard";
    if (playerCount <= 39) return "medium";
    return "easy";
  }

  function hasNearPoolDuplicate(position, stats, existing, pending) {
    const pool = new Set(stats.bestByPlayer.keys());
    for (const [key, candidatePool] of [...existing.entries(), ...pending.entries()]) {
      if (!key.startsWith(`${position}|`)) continue;
      const other = candidatePool instanceof Map ? new Set(candidatePool.keys()) : new Set(candidatePool.keys?.() || []);
      if (!other.size) continue;
      const ratio = Math.min(pool.size, other.size) / Math.max(pool.size, other.size);
      if (ratio < 0.72) continue;
      let intersection = 0;
      const smaller = pool.size <= other.size ? pool : other;
      const larger = pool.size <= other.size ? other : pool;
      for (const playerId of smaller) if (larger.has(playerId)) intersection += 1;
      const union = pool.size + other.size - intersection;
      if (union && intersection / union >= 0.90) return true;
    }
    return false;
  }

  function poolSignature(stats) {
    return [...stats.bestByPlayer.keys()].sort().join("|");
  }

  function uniqueGeneratedId(base, pending) {
    const existing = new Set((window.FPL_PROMPT_LIBRARY || []).map(prompt => prompt.id));
    for (const prompt of pending) existing.add(prompt.id);
    let id = `auto_${slugify(base)}`;
    let suffix = 2;
    while (existing.has(id)) id = `auto_${slugify(base)}_${suffix++}`;
    return id;
  }

  function weightedTargets(total, weights) {
    const entries = Object.entries(weights);
    const targets = {};
    let assigned = 0;
    const remainders = [];
    for (const [key, weight] of entries) {
      const raw = total * weight;
      const floor = Math.floor(raw);
      targets[key] = floor;
      assigned += floor;
      remainders.push([key, raw - floor]);
    }
    remainders.sort((a, b) => b[1] - a[1]);
    for (let index = 0; assigned < total; index = (index + 1) % remainders.length) {
      targets[remainders[index][0]] += 1;
      assigned += 1;
    }
    return targets;
  }

  function countBy(items, accessor) {
    const counts = {};
    for (const item of items) {
      const key = accessor(item);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }

  function num(field, operator, value, value2 = 0) {
    return { field, operator, value, value2 };
  }

  function text(field, operator, value) {
    return { field, operator, value, value2: "" };
  }

  function bool(field, operator = "isTrue") {
    return { field, operator, value: "", value2: "" };
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

  function conditionToExpression(condition) {
    const field = condition.field;
    const accessor = numericAccessor(field);
    if (["points", "minutes", "goals", "assists", "goalInvolvements", "cleanSheets", "bonus", "saves", "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice", "leaguePosition", "ageAtSeasonStart", "fullNameLength", "firstNameLength", "surnameLength", "nameWordCount"].includes(field)) {
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

    if (["champions", "topFour", "bottomHalf", "relegated", "promoted", "outsideBigSix", "assistsMoreThanGoals", "hyphenatedSurname", "sameInitials", "singleWordName"].includes(field)) {
      let expression;
      if (field === "outsideBigSix") expression = `!${JSON.stringify(BIG_SIX)}.includes(p.club)`;
      else if (field === "assistsMoreThanGoals") expression = `p.assists > p.goals`;
      else if (field === "hyphenatedSurname") expression = `__surname.includes("-")`;
      else if (field === "sameInitials") expression = `(__nameTokens.length > 1 && Boolean(__firstInitial) && __firstInitial === __surnameInitial)`;
      else if (field === "singleWordName") expression = `__nameTokens.length === 1`;
      else expression = `p.${field} === true`;
      return condition.operator === "isFalse" ? `!(${expression})` : `(${expression})`;
    }

    if (["fullName", "firstName", "surname", "firstInitial", "surnameInitial"].includes(field)) {
      const value = JSON.stringify(normaliseNameLiteral(condition.value));
      const nameAccessor = { fullName: "__fullName", firstName: "__firstName", surname: "__surname", firstInitial: "__firstInitial", surnameInitial: "__surnameInitial" }[field] || "__fullName";
      if (condition.operator === "notEquals") return `${nameAccessor} !== ${value}`;
      if (condition.operator === "startsWith") return `${nameAccessor}.startsWith(${value})`;
      if (condition.operator === "endsWith") return `${nameAccessor}.endsWith(${value})`;
      if (condition.operator === "contains") return `${nameAccessor}.includes(${value})`;
      return `${nameAccessor} === ${value}`;
    }

    const value = JSON.stringify(String(condition.value).trim());
    if (field === "manager") {
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

  function isNameField(field) {
    return ["fullName", "firstName", "surname", "firstInitial", "surnameInitial", "fullNameLength", "firstNameLength", "surnameLength", "nameWordCount", "hyphenatedSurname", "sameInitials", "singleWordName"].includes(field);
  }

  function normaliseNameLiteral(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o").replace(/ł/g, "l").replace(/[đð]/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/’/g, "'").replace(/[^a-z0-9'\-]+/g, " ").trim();
  }

  function normaliseLabel(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function labelSimilarity(left, right) {
    const a = new Set(left.split(/\s+/).filter(Boolean));
    const b = new Set(right.split(/\s+/).filter(Boolean));
    if (!a.size || !b.size) return 0;
    let intersection = 0;
    for (const token of a) if (b.has(token)) intersection += 1;
    return intersection / (a.size + b.size - intersection);
  }

  function clampInteger(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(minimum, Math.min(maximum, Math.round(number)));
  }

  function slugify(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 72) || "prompt";
  }

  function shuffle(items) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
    }
    return items;
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("en-GB");
  }

  function capitalise(value) {
    return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();
