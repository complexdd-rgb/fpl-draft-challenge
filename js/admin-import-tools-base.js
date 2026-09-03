/* ===== BEGIN admin-phase15.js ===== */
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
      seasonMode: document.querySelector("#factorySeasonMode"),
      careerMode: document.querySelector("#factoryCareerMode"),
      relationship: document.querySelector("#factoryRelationshipMode"),
      exclusion: document.querySelector("#factoryExclusionMode"),
      includeNames: document.querySelector("#factoryIncludeNameRules"),
      avoidPools: document.querySelector("#factoryAvoidSimilarPools"),
      enable: document.querySelector("#factoryEnablePrompts"),
      includeQualityFamilies: document.querySelector("#factoryIncludeQualityFamilies"),
      includeNationalityFamily: document.querySelector("#factoryIncludeNationalityFamily"),
      includeCareerEvolutionFamilies: document.querySelector("#factoryIncludeCareerEvolutionFamilies"),
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
    const seasonMode = ["none", "mix", "only"].includes(elements.seasonMode?.value) ? elements.seasonMode.value : "mix";
    const careerMode = ["none", "mix", "only"].includes(elements.careerMode?.value) ? elements.careerMode.value : "mix";
    const relationshipMode = ["none", "mix", "only"].includes(elements.relationship?.value) ? elements.relationship.value : "mix";
    const exclusionMode = ["none", "mix", "top1", "top2"].includes(elements.exclusion?.value) ? elements.exclusion.value : "mix";
    const includeQualityFamilies = elements.includeQualityFamilies?.checked !== false;
    const includeNationalityFamily = elements.includeNationalityFamily?.checked !== false;
    const includeCareerEvolutionFamilies = elements.includeCareerEvolutionFamilies?.checked !== false;

    const missingProviders = [];
    if (includeQualityFamilies && !window.FPL_QUALITY_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Quality Families");
    if (includeNationalityFamily && !window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Nationality Family");
    if (includeCareerEvolutionFamilies && !window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Career Evolution");
    if (missingProviders.length) {
      elements.status.textContent = "Loading " + missingProviders.join(" + ") + " into the main generator…";
      ensureIntegratedFamilyProviders(() => generateBatch(elements, core));
      return;
    }

    const onlyModes = [
      ["season", seasonMode],
      ["career totals", careerMode],
      ["relationships", relationshipMode]
    ].filter(([, mode]) => mode === "only");
    if (onlyModes.length > 1) {
      elements.status.textContent = `Choose only one “only” mode at a time: ${onlyModes.map(([label]) => label).join(", ")}.`;
      return;
    }

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
          seasonMode,
          careerMode,
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

        appendIntegratedFamilyCandidates({
          core, evaluated, rejected, seenCandidatePools, familyCounts, familyLimit,
          minimum, maximum, difficultyMode, enable: elements.enable.checked,
          avoidPools: elements.avoidPools.checked, includeQualityFamilies, includeNationalityFamily
        });

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

  function buildCandidateVariants({ includeNameRules, positionMode, cooldown, seasonMode = "mix", careerMode = "mix", relationshipMode = "mix" }) {
    const positions = positionMode === "balanced" ? POSITIONS : [positionMode];
    const variants = [];
    const add = (position, family, idBase, label, fail, tags, conditions, join = "all") => {
      variants.push({ position, family, idBase, label, fail, tags, cooldown, studioRule: { kind: "builder", join, conditions } });
    };
    const includeStandard = relationshipMode !== "only" && seasonMode !== "only" && careerMode !== "only";
    const includeSeason = relationshipMode !== "only" && careerMode !== "only" && seasonMode !== "none";
    const includeCareerTotals = relationshipMode !== "only" && seasonMode !== "only" && careerMode !== "none";
    const includeRelationships = relationshipMode !== "none" && seasonMode !== "only" && careerMode !== "only";

    if (includeStandard) for (const position of positions) {
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

    if (includeStandard) {
      addPositionSpecificVariants(variants, positions, cooldown, add);
      addManagerVariants(variants, positions, cooldown, add);
    }
    if (includeSeason) addSeasonPlayedVariants(positions, add);
    if (includeCareerTotals) addCareerTotalVariants(positions, add);
    if (includeRelationships) {
      addPlayedForBothClubVariants(positions, add);
      addReturnedToFormerClubVariants(positions, add);
      addCareerOverlapVariants(positions, add);
      addTeammateVariants(variants, positions, cooldown);
    }
    return variants;
  }

  function addSeasonPlayedVariants(positions, add) {
    const seasons = [...new Set(flatRecords
      .map(record => String(record.season || "").trim())
      .filter(season => /^\d{4}\/\d{2}$/.test(season)))]
      .sort((a, b) => seasonStartYear(a) - seasonStartYear(b));
    if (!seasons.length) return;

    const exactPointThresholds = {
      GK: [40, 70, 100],
      DEF: [50, 80, 110],
      MID: [50, 90, 130],
      FWD: [40, 70, 100]
    };
    const boundaryPointThresholds = { GK: 80, DEF: 90, MID: 100, FWD: 85 };
    const boundaryMinuteThresholds = { GK: 1800, DEF: 2000, MID: 2000, FWD: 1800 };

    for (const position of positions) {
      const noun = POSITION_LABELS[position];
      const lower = noun.toLowerCase();

      for (const label of seasons) {
        for (const points of exactPointThresholds[position]) {
          add(
            position,
            "season-exact",
            `${position.toLowerCase()}_season_${seasonId(label)}_points_${points}`,
            `${noun} with ${points}+ FPL points in the ${label} season`,
            `That ${lower} must score at least ${points} FPL points in the ${label} season.`,
            ["auto-generated", "season-rule", "season-exact", "points", "anti-meta"],
            [seasonCondition("equals", label), num("points", "gte", points), num("minutes", "gt", 0)]
          );
        }
      }

      for (const label of seasonBoundaryLabels(seasons)) {
        const points = boundaryPointThresholds[position];
        const minutes = boundaryMinuteThresholds[position];
        add(
          position,
          "season-before-points",
          `${position.toLowerCase()}_before_${seasonId(label)}_points_${points}`,
          `${noun} with ${points}+ FPL points before the ${label} season`,
          `That ${lower} must score at least ${points} FPL points in a season before ${label}.`,
          ["auto-generated", "season-rule", "season-before", "points", "anti-meta"],
          [seasonCondition("before", label), num("points", "gte", points), num("minutes", "gt", 0)]
        );
        add(
          position,
          "season-after-points",
          `${position.toLowerCase()}_after_${seasonId(label)}_points_${points}`,
          `${noun} with ${points}+ FPL points after the ${label} season`,
          `That ${lower} must score at least ${points} FPL points in a season after ${label}.`,
          ["auto-generated", "season-rule", "season-after", "points", "anti-meta"],
          [seasonCondition("after", label), num("points", "gte", points), num("minutes", "gt", 0)]
        );
        add(
          position,
          "season-before-minutes",
          `${position.toLowerCase()}_before_${seasonId(label)}_minutes_${minutes}`,
          `${noun} who played ${formatNumber(minutes)}+ minutes before the ${label} season`,
          `That ${lower} must play at least ${formatNumber(minutes)} minutes in a season before ${label}.`,
          ["auto-generated", "season-rule", "season-before", "minutes", "anti-meta"],
          [seasonCondition("before", label), num("minutes", "gte", minutes)]
        );
        add(
          position,
          "season-after-minutes",
          `${position.toLowerCase()}_after_${seasonId(label)}_minutes_${minutes}`,
          `${noun} who played ${formatNumber(minutes)}+ minutes after the ${label} season`,
          `That ${lower} must play at least ${formatNumber(minutes)} minutes in a season after ${label}.`,
          ["auto-generated", "season-rule", "season-after", "minutes", "anti-meta"],
          [seasonCondition("after", label), num("minutes", "gte", minutes)]
        );
      }

      for (const [from, to] of seasonWindows(seasons)) {
        const points = boundaryPointThresholds[position];
        const minutes = boundaryMinuteThresholds[position];
        add(
          position,
          "season-between-points",
          `${position.toLowerCase()}_between_${seasonId(from)}_${seasonId(to)}_points_${points}`,
          `${noun} with ${points}+ FPL points between the ${from} and ${to} seasons`,
          `That ${lower} must score at least ${points} FPL points between the ${from} and ${to} seasons.`,
          ["auto-generated", "season-rule", "season-between", "points", "anti-meta"],
          [seasonCondition("between", from, to), num("points", "gte", points), num("minutes", "gt", 0)]
        );
        add(
          position,
          "season-between-minutes",
          `${position.toLowerCase()}_between_${seasonId(from)}_${seasonId(to)}_minutes_${minutes}`,
          `${noun} who played ${formatNumber(minutes)}+ minutes between the ${from} and ${to} seasons`,
          `That ${lower} must play at least ${formatNumber(minutes)} minutes between the ${from} and ${to} seasons.`,
          ["auto-generated", "season-rule", "season-between", "minutes", "anti-meta"],
          [seasonCondition("between", from, to), num("minutes", "gte", minutes)]
        );
      }
    }
  }

  function addCareerTotalVariants(positions, add) {
    const careerContext = window.FPL_CAREER_CONTEXT;
    if (!careerContext?.players?.length) return;

    const pointThresholds = { GK: [50, 80], DEF: [60, 90], MID: [70, 100], FWD: [60, 90] };
    const minuteThresholds = { GK: 1800, DEF: 2000, MID: 2000, FWD: 1800 };
    const seasonCounts = [2, 3, 4, 5, 6, 8, 10, 12];
    const exactSeasonCounts = [2, 3, 4, 5, 6, 8, 10];
    const clubCounts = [2, 3, 4, 5, 6];
    const exactClubCounts = [1, 2, 3, 4, 5];

    for (const position of positions) {
      const noun = POSITION_LABELS[position];
      const lower = noun.toLowerCase();

      for (const count of seasonCounts) {
        for (const points of pointThresholds[position]) {
          add(
            position,
            "career-seasons-minimum",
            `${position.toLowerCase()}_career_seasons_${count}_points_${points}`,
            `${noun} with at least ${count} recorded Premier League seasons and ${points}+ FPL points`,
            `That ${lower} must have recorded minutes in at least ${count} Premier League seasons and score at least ${points} FPL points in the selected season.`,
            ["auto-generated", "career-total", "career-seasons", "points", "anti-meta"],
            [num("careerSeasonCount", "gte", count), num("points", "gte", points), num("minutes", "gt", 0)]
          );
        }
      }

      for (const count of exactSeasonCounts) {
        add(
          position,
          "career-seasons-exact",
          `${position.toLowerCase()}_career_seasons_exact_${count}_minutes_${minuteThresholds[position]}`,
          `${noun} with exactly ${count} recorded Premier League seasons who played ${formatNumber(minuteThresholds[position])}+ minutes`,
          `That ${lower} must have exactly ${count} positive-minute Premier League seasons in the database and play at least ${formatNumber(minuteThresholds[position])} minutes in the selected season.`,
          ["auto-generated", "career-total", "career-seasons", "exact-stat", "minutes", "anti-meta"],
          [num("careerSeasonCount", "eq", count), num("minutes", "gte", minuteThresholds[position])]
        );
      }

      for (const count of clubCounts) {
        for (const points of pointThresholds[position]) {
          add(
            position,
            "career-clubs-minimum",
            `${position.toLowerCase()}_career_clubs_${count}_points_${points}`,
            `${noun} who represented at least ${count} recorded Premier League clubs and scored ${points}+ FPL points`,
            `That ${lower} must have recorded minutes for at least ${count} Premier League clubs and score at least ${points} FPL points in the selected season.`,
            ["auto-generated", "career-total", "career-clubs", "points", "anti-meta"],
            [num("careerClubCount", "gte", count), num("points", "gte", points), num("minutes", "gt", 0)]
          );
        }
      }

      for (const count of exactClubCounts) {
        add(
          position,
          "career-clubs-exact",
          `${position.toLowerCase()}_career_clubs_exact_${count}_minutes_${minuteThresholds[position]}`,
          `${noun} who represented exactly ${count} recorded Premier League club${count === 1 ? "" : "s"} and played ${formatNumber(minuteThresholds[position])}+ minutes`,
          `That ${lower} must have recorded minutes for exactly ${count} Premier League club${count === 1 ? "" : "s"} and play at least ${formatNumber(minuteThresholds[position])} minutes in the selected season.`,
          ["auto-generated", "career-total", "career-clubs", "exact-stat", "minutes", "anti-meta"],
          [num("careerClubCount", "eq", count), num("minutes", "gte", minuteThresholds[position])]
        );
      }

      for (const [low, high] of [[2, 4], [5, 7], [8, 10]]) {
        add(
          position,
          "career-seasons-range",
          `${position.toLowerCase()}_career_seasons_${low}_${high}_points_60`,
          `${noun} with between ${low} and ${high} recorded Premier League seasons and 60+ FPL points`,
          `That ${lower} must have between ${low} and ${high} positive-minute Premier League seasons in the database and score at least 60 FPL points in the selected season.`,
          ["auto-generated", "career-total", "career-seasons", "range", "points", "anti-meta"],
          [num("careerSeasonCount", "between", low, high), num("points", "gte", 60), num("minutes", "gt", 0)]
        );
      }
    }
  }

  function seasonBoundaryLabels(seasons) {
    if (seasons.length < 3) return [];
    const last = seasons.length - 1;
    return [...new Set([0.25, 0.5, 0.75]
      .map(fraction => seasons[Math.round(last * fraction)])
      .filter(Boolean))];
  }

  function seasonWindows(seasons) {
    if (seasons.length < 2) return [];
    const last = seasons.length - 1;
    const indexes = [
      [0, Math.max(1, Math.floor(last / 3))],
      [Math.max(0, Math.floor(last / 3)), Math.max(1, Math.floor((last * 2) / 3))],
      [Math.max(0, Math.floor((last * 2) / 3)), last]
    ];
    return indexes
      .map(([from, to]) => [seasons[from], seasons[to]])
      .filter(([from, to]) => from && to && from !== to)
      .filter((pair, index, all) => all.findIndex(other => other[0] === pair[0] && other[1] === pair[1]) === index);
  }

  function seasonStartYear(label) {
    const year = Number.parseInt(String(label || "").slice(0, 4), 10);
    return Number.isFinite(year) ? year : Number.MAX_SAFE_INTEGER;
  }

  function seasonId(label) {
    return String(label || "").replace(/[^0-9a-z]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
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


  function addPlayedForBothClubVariants(positions, add) {
    const careerContext = window.FPL_CAREER_CONTEXT;
    if (!careerContext?.players?.length) return;

    const playersById = new Map((Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : []).map(player => [player.playerId, player]));
    const pairPositionPlayers = new Map();
    for (const summary of careerContext.players) {
      const clubs = Array.isArray(summary.clubs) ? [...new Set(summary.clubs)] : [];
      if (clubs.length < 2) continue;
      const player = playersById.get(summary.playerId);
      const playerPositions = [...new Set((player?.seasons || []).filter(record => Number(record.minutes) > 0).map(record => record.position).filter(position => POSITIONS.includes(position)))];
      for (let left = 0; left < clubs.length; left += 1) {
        for (let right = left + 1; right < clubs.length; right += 1) {
          const ordered = [clubs[left], clubs[right]].sort((a, b) => a.localeCompare(b));
          const pairKey = `${ordered[0]}|||${ordered[1]}`;
          for (const position of playerPositions) {
            const key = `${position}|${pairKey}`;
            if (!pairPositionPlayers.has(key)) pairPositionPlayers.set(key, new Set());
            pairPositionPlayers.get(key).add(summary.playerId);
          }
        }
      }
    }

    const pointThresholds = { GK: [60, 90], DEF: [70, 100], MID: [80, 110], FWD: [70, 100] };
    for (const position of positions) {
      const noun = POSITION_LABELS[position];
      const lower = noun.toLowerCase();
      const candidates = [...pairPositionPlayers.entries()]
        .filter(([key, playerIds]) => key.startsWith(`${position}|`) && playerIds.size >= 3 && playerIds.size <= 100)
        .map(([key, playerIds]) => ({ clubs: key.slice(position.length + 1).split("|||"), playerCount: playerIds.size }))
        .sort((a, b) => Math.abs(a.playerCount - 16) - Math.abs(b.playerCount - 16) || b.playerCount - a.playerCount)
        .slice(0, 140);

      for (const candidate of candidates) {
        const [firstClub, secondClub] = candidate.clubs;
        const baseConditions = [clubPair(firstClub, secondClub), num("minutes", "gt", 0)];
        add(
          position,
          "career-both-clubs",
          `${position.toLowerCase()}_both_${slugify(firstClub)}_${slugify(secondClub)}`,
          `${noun} who played for both ${firstClub} and ${secondClub}`,
          `That ${lower} must have recorded Premier League minutes for both ${firstClub} and ${secondClub}.`,
          ["auto-generated", "relationship", "played-for-both", "career-clubs", "anti-meta"],
          baseConditions
        );

        if (candidate.playerCount >= 7) {
          for (const points of pointThresholds[position]) {
            add(
              position,
              "career-both-clubs-points",
              `${position.toLowerCase()}_both_${slugify(firstClub)}_${slugify(secondClub)}_points_${points}`,
              `${noun} who played for both ${firstClub} and ${secondClub} and scored ${points}+ FPL points`,
              `That ${lower} must have recorded minutes for both ${firstClub} and ${secondClub}, then score at least ${points} FPL points in the qualifying season.`,
              ["auto-generated", "relationship", "played-for-both", "career-clubs", "points", "anti-meta"],
              [clubPair(firstClub, secondClub), num("points", "gte", points), num("minutes", "gt", 0)]
            );
          }
        }
      }
    }
  }

  function addReturnedToFormerClubVariants(positions, add) {
    const careerContext = window.FPL_CAREER_CONTEXT;
    if (!careerContext?.players?.length) return;

    const playersById = new Map((Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : []).map(player => [player.playerId, player]));
    const eligibleByPosition = new Map(POSITIONS.map(position => [position, new Set()]));
    for (const summary of careerContext.players) {
      if (summary.returnedToFormerClub !== true) continue;
      const player = playersById.get(summary.playerId);
      for (const record of player?.seasons || []) {
        if (Number(record.minutes) > 0 && eligibleByPosition.has(record.position)) eligibleByPosition.get(record.position).add(summary.playerId);
      }
    }

    const pointThresholds = { DEF: [70, 100], MID: [70, 100], FWD: [60, 90] };
    const minuteThresholds = { DEF: [1200, 2000], MID: [1200, 2000], FWD: [900, 1600] };
    for (const position of positions) {
      const playerCount = eligibleByPosition.get(position)?.size || 0;
      if (playerCount < 3) continue;
      const noun = POSITION_LABELS[position];
      const lower = noun.toLowerCase();
      const returnedRule = bool("returnedToFormerClub");

      add(
        position,
        "career-returned-club",
        `${position.toLowerCase()}_returned_to_former_club`,
        `${noun} who returned to a former Premier League club`,
        `That ${lower} must have recorded Premier League minutes for a club, left it, and later recorded minutes for that club again.`,
        ["auto-generated", "relationship", "returned-club", "career-clubs", "anti-meta"],
        [returnedRule, num("minutes", "gt", 0)]
      );

      for (const points of pointThresholds[position] || []) {
        add(
          position,
          "career-returned-club-points",
          `${position.toLowerCase()}_returned_to_former_club_points_${points}`,
          `${noun} who returned to a former Premier League club and scored ${points}+ FPL points`,
          `That ${lower} must have returned to a former Premier League club and score at least ${points} FPL points in the qualifying season.`,
          ["auto-generated", "relationship", "returned-club", "career-clubs", "points", "anti-meta"],
          [bool("returnedToFormerClub"), num("points", "gte", points), num("minutes", "gt", 0)]
        );
      }

      for (const minutes of minuteThresholds[position] || []) {
        add(
          position,
          "career-returned-club-minutes",
          `${position.toLowerCase()}_returned_to_former_club_minutes_${minutes}`,
          `${noun} who returned to a former Premier League club and played ${formatNumber(minutes)}+ minutes`,
          `That ${lower} must have returned to a former Premier League club and play at least ${formatNumber(minutes)} minutes in the qualifying season.`,
          ["auto-generated", "relationship", "returned-club", "career-clubs", "minutes", "anti-meta"],
          [bool("returnedToFormerClub"), num("minutes", "gte", minutes)]
        );
      }
    }
  }

  function addCareerOverlapVariants(positions, add) {
    const careerContext = window.FPL_CAREER_CONTEXT;
    const playerRows = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
    if (!careerContext?.players?.length || !playerRows.length) return;
    const playerById = new Map(playerRows.map(player => [player.playerId, player]));
    const positionPlayers = new Map(POSITIONS.map(position => [position, new Map()]));
    for (const player of playerRows) for (const record of player.seasons || []) {
      if (Number(record.minutes) > 0 && positionPlayers.has(record.position)) positionPlayers.get(record.position).set(player.playerId, careerContext.getPlayer?.(player.playerId));
    }
    const anchors = careerContext.players
      .filter(summary => summary.seasonCount >= 3 && careerContext.resolvePlayer?.(summary.playerName)?.ok)
      .map(summary => ({ summary, points: (playerById.get(summary.playerId)?.seasons || []).reduce((total, record) => total + (Number(record.points) || 0), 0) }))
      .sort((a, b) => b.points - a.points || b.summary.seasonCount - a.summary.seasonCount)
      .slice(0, 140);
    const thresholds = { GK: [70], DEF: [70, 100], MID: [80, 110], FWD: [70, 100] };
    for (const position of positions) {
      const noun = POSITION_LABELS[position];
      const lower = noun.toLowerCase();
      const candidates = positionPlayers.get(position) || new Map();
      for (const { summary: anchor } of anchors) {
        const anchorYears = new Set(anchor.seasonYears || []);
        let overlapCount = 0;
        for (const [playerId, summary] of candidates) if (summary && playerId !== anchor.playerId && (summary.seasonYears || []).some(year => anchorYears.has(year))) overlapCount += 1;
        if (overlapCount < 4 || overlapCount > 600) continue;
        add(position, "career-overlap", `${position.toLowerCase()}_career_overlap_${slugify(anchor.playerName)}`, `${noun} whose recorded Premier League career overlapped with ${anchor.playerName}`, `That ${lower} must have recorded Premier League minutes in at least one of the same seasons as ${anchor.playerName}.`, ["auto-generated", "relationship", "career-overlap", "career-seasons", "anti-meta"], [playerReference(anchor.playerName), num("minutes", "gt", 0)]);
        if (overlapCount >= 8) for (const points of thresholds[position] || []) {
          add(position, "career-overlap-points", `${position.toLowerCase()}_career_overlap_${slugify(anchor.playerName)}_points_${points}`, `${noun} whose career overlapped with ${anchor.playerName} and who scored ${points}+ FPL points`, `That ${lower} must overlap with ${anchor.playerName} and score at least ${points} FPL points in the qualifying season.`, ["auto-generated", "relationship", "career-overlap", "career-seasons", "points", "anti-meta"], [playerReference(anchor.playerName), num("points", "gte", points), num("minutes", "gt", 0)]);
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
          label: `${noun} who played in the same Premier League season as a teammate of ${anchor.name}`,
          fail: `That ${lower} must have recorded Premier League minutes for the same club in the same season as ${anchor.name}.`,
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
              label: `${noun} who played in the same Premier League season as a teammate of ${anchor.name} and scored ${threshold}+ FPL points`,
              fail: `That ${lower} must play for the same club in the same Premier League season as ${anchor.name} and score at least ${threshold} FPL points in that season.`,
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

  function ensureIntegratedFamilyProviders(done) {
    const wanted = [];
    if (!window.FPL_QUALITY_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-quality-family-generator.js?v=1.1.0", "FPL_QUALITY_FAMILY_GENERATOR"]);
    if (!window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-nationality-family-generator.js?v=1.1.1", "FPL_NATIONALITY_FAMILY_GENERATOR"]);
    if (!window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-career-evolution-family-generator.js?v=1.0.0", "FPL_CAREER_EVOLUTION_FAMILY_GENERATOR"]);
    if (!wanted.length) return done();
    let remaining = wanted.length;
    const finish = () => { remaining -= 1; if (remaining <= 0) done(); };
    for (const [src, apiName] of wanted) {
      const existing = [...document.scripts].find(script => script.src && script.src.includes(src.split("?")[0]));
      if (existing) {
        if (window[apiName]?.buildBatch) finish();
        else existing.addEventListener("load", finish, { once: true });
        continue;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.addEventListener("load", finish, { once: true });
      document.head.appendChild(script);
    }
  }

  function appendIntegratedFamilyCandidates({ core, evaluated, rejected, seenCandidatePools, familyCounts, familyLimit, minimum, maximum, difficultyMode, enable, avoidPools, includeQualityFamilies, includeNationalityFamily, includeCareerEvolutionFamilies }) {
    const providers = [];
    if (includeQualityFamilies && window.FPL_QUALITY_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_QUALITY_FAMILY_GENERATOR);
    if (includeNationalityFamily && window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_NATIONALITY_FAMILY_GENERATOR);
    if (includeCareerEvolutionFamilies && window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR);
    const pendingIds = new Set(evaluated.map(prompt => String(prompt.id || "")));

    for (const provider of providers) {
      let candidates = [];
      try { candidates = provider.buildBatch() || []; } catch (_) { rejected.broken += 1; continue; }
      for (const item of candidates) {
        try {
          const prompt = provider.serialise(item);
          if (!prompt || pendingIds.has(String(prompt.id || ""))) { rejected.duplicate += 1; continue; }
          prompt.family = item.family || prompt.family || "quality-family";
          prompt.test = item.test || prompt.test;
          prompt.tags = Array.isArray(prompt.tags) ? [...prompt.tags] : [];
          prompt.rating = 5;
          prompt.enabled = enable;
          prompt.selected = true;
          const stats = core.getPromptStats(prompt);
          if (stats.playerCount < minimum || stats.playerCount > maximum) { rejected.answerRange += 1; continue; }
          prompt.difficulty = item.difficulty || classifyDifficulty(stats.playerCount);
          if (difficultyMode !== "balanced" && prompt.difficulty !== difficultyMode) continue;

          const labelKey = normaliseLabel(prompt.label);
          if (existingLabelTokens.some(existing => existing.position === prompt.position && labelSimilarity(labelKey, existing.key) >= 0.86)) { rejected.duplicate += 1; continue; }
          const signature = poolSignature(stats);
          const poolKey = prompt.position + "|" + signature;
          if (!signature || existingPoolIndex.has(poolKey) || seenCandidatePools.has(poolKey)) { rejected.duplicate += 1; continue; }
          if (avoidPools && hasNearPoolDuplicate(prompt.position, stats, existingPoolIndex, seenCandidatePools)) { rejected.similar += 1; continue; }
          const familyUsed = familyCounts.get(prompt.family) || 0;
          if (familyUsed >= familyLimit) continue;

          prompt.stats = stats;
          prompt.poolSignature = signature;
          evaluated.push(prompt);
          pendingIds.add(String(prompt.id || ""));
          familyCounts.set(prompt.family, familyUsed + 1);
          seenCandidatePools.set(poolKey, stats.bestByPlayer);
        } catch (_) { rejected.broken += 1; }
      }
    }
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
      <article><span>Season rules</span><strong>${currentBatch.filter(item => item.tags.includes("season-rule")).length}</strong></article>
      <article><span>Career totals</span><strong>${currentBatch.filter(item => item.tags.includes("career-total")).length}</strong></article>
      <article><span>Both-club rules</span><strong>${currentBatch.filter(item => item.tags.includes("played-for-both")).length}</strong></article>
      <article><span>Returned-club rules</span><strong>${currentBatch.filter(item => item.tags.includes("returned-club")).length}</strong></article>
      <article><span>Teammate rules</span><strong>${currentBatch.filter(item => item.tags.includes("teammate")).length}</strong></article>
      <article><span>Top-answer exclusions</span><strong>${currentBatch.filter(item => item.tags.includes("excludes-top")).length}</strong></article>
      <article><span>Quality families</span><strong>${currentBatch.filter(item => item.tags.includes("quality-family")).length}</strong></article>
      <article><span>Nationality family</span><strong>${currentBatch.filter(item => item.tags.includes("nationality")).length}</strong></article>
      <article><span>Career Evolution</span><strong>${currentBatch.filter(item => item.tags.includes("career-evolution")).length}</strong></article>`;
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
            ${prompt.tags.includes("season-rule") ? '<span class="relation">Season rule</span>' : ""}
            ${prompt.tags.includes("career-total") ? '<span class="relation">Career total</span>' : ""}
            ${prompt.tags.includes("played-for-both") ? '<span class="relation">Played for both</span>' : ""}
            ${prompt.tags.includes("returned-club") ? '<span class="relation">Returned club</span>' : ""}
            ${prompt.tags.includes("teammate") ? '<span class="relation">Teammate rule</span>' : ""}
            ${prompt.tags.includes("quality-family") ? '<span class="relation">Quality family</span>' : ""}
            ${prompt.tags.includes("nationality") ? '<span class="relation">Nationality</span>' : ""}
            ${prompt.tags.includes("career-evolution") ? '<span class="relation">Career evolution</span>' : ""}
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

  function seasonCondition(operator, value, value2 = "") {
    return { field: "season", operator, value, value2 };
  }

  function clubPair(value, value2) {
    return { field: "playedForBothClubs", operator: "both", value, value2 };
  }

  function playerReference(value) {
    return { field: "careerOverlapWithPlayer", operator: "overlaps", value, value2: "" };
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
    if (field === "season") {
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
    if (field === "playedForBothClubs") {
      const first = JSON.stringify(normaliseCareerClub(condition.value));
      const second = JSON.stringify(normaliseCareerClub(condition.value2));
      return `(Array.isArray(p._career?.normalisedClubs) && p._career.normalisedClubs.includes(${first}) && p._career.normalisedClubs.includes(${second}))`;
    }
    if (field === "careerOverlapWithPlayer") {
      const reference = window.FPL_CAREER_CONTEXT?.resolvePlayer?.(condition.value);
      if (!reference?.ok) return "false";
      const anchorId = JSON.stringify(reference.player.playerId);
      return `(() => { const __anchor = window.FPL_CAREER_CONTEXT?.getPlayer?.(${anchorId}); return p.playerId !== ${anchorId} && Array.isArray(p._career?.seasonYears) && Array.isArray(__anchor?.seasonYears) && p._career.seasonYears.some(year => __anchor.seasonYears.includes(year)); })()`;
    }
    if (["points", "minutes", "goals", "assists", "goalInvolvements", "cleanSheets", "bonus", "saves", "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice", "leaguePosition", "ageAtSeasonStart", "fullNameLength", "firstNameLength", "surnameLength", "nameWordCount", "careerSeasonCount", "careerClubCount"].includes(field)) {
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

    if (["champions", "topFour", "bottomHalf", "relegated", "promoted", "outsideBigSix", "assistsMoreThanGoals", "returnedToFormerClub", "hyphenatedSurname", "sameInitials", "singleWordName"].includes(field)) {
      let expression;
      if (field === "outsideBigSix") expression = `!${JSON.stringify(BIG_SIX)}.includes(p.club)`;
      else if (field === "assistsMoreThanGoals") expression = `p.assists > p.goals`;
      else if (field === "returnedToFormerClub") expression = `p._career?.returnedToFormerClub === true`;
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
    if (field === "careerSeasonCount") return `Number(p._career?.seasonCount)`;
    if (field === "careerClubCount") return `Number(p._career?.clubCount)`;
    return `p.${field}`;
  }

  function isNameField(field) {
    return ["fullName", "firstName", "surname", "firstInitial", "surnameInitial", "fullNameLength", "firstNameLength", "surnameLength", "nameWordCount", "hyphenatedSurname", "sameInitials", "singleWordName"].includes(field);
  }

  function normaliseCareerClub(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ø/g, "o").replace(/ł/g, "l").replace(/[đð]/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/’/g, "'").replace(/[^a-z0-9'\-]+/g, " ").trim();
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

/* ===== END admin-phase15.js ===== */

/* ===== BEGIN admin-phase14.js ===== */
(() => {
  "use strict";

  const MANAGER_STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const BIG_SIX = new Set(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"]);
  const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  const QUALITY_ORDER = { excellent: 5, good: 4, fair: 3, review: 2, poor: 1, broken: 0 };
  const IDEAL_RANGES = {
    GK: { narrow: 5, idealLow: 8, idealHigh: 35, broad: 70 },
    DEF: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    MID: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    FWD: { narrow: 6, idealLow: 12, idealHigh: 60, broad: 110 }
  };

  let analysisResults = [];
  let analysisById = new Map();
  let running = false;
  let cancelled = false;

  window.FPL_PROMPT_QUALITY_ENGINE = Object.freeze({
    analyseLibrary: (library, players, options = {}) => analyseLibrary(library, players, options)
  });

  window.addEventListener("load", () => {
    window.setTimeout(initialiseQualityAnalyser, 80);
  }, { once: true });

  function initialiseQualityAnalyser() {
    const core = window.FPL_STUDIO_API;
    const panel = document.querySelector("#promptQualityAnalyser");
    if (!core || !panel) return;

    const elements = getElements();
    bindEvents(elements, core);

    const library = core.getPromptLibrary?.() || [];
    const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
    elements.status.textContent = library.length && players.length
      ? `Ready to analyse ${library.length.toLocaleString()} prompts against ${players.length.toLocaleString()} footballers.`
      : "The analyser is waiting for players.js and prompt-library.js.";

    window.FPL_PROMPT_QUALITY_API = Object.freeze({
      run: options => analyseLibrary(core.getPromptLibrary?.() || [], window.FPL_PLAYERS || [], options),
      getResults: () => analysisResults.map(copyResult),
      getResult: promptId => analysisById.has(promptId) ? copyResult(analysisById.get(promptId)) : null
    });
  }

  function getElements() {
    return {
      panel: document.querySelector("#promptQualityAnalyser"),
      scope: document.querySelector("#qualityScope"),
      runBtn: document.querySelector("#runPromptQualityBtn"),
      cancelBtn: document.querySelector("#cancelPromptQualityBtn"),
      ratingsBtn: document.querySelector("#applyQualityRatingsBtn"),
      disableMode: document.querySelector("#qualityDisableMode"),
      disableBtn: document.querySelector("#disableQualityPromptsBtn"),
      deleteMode: document.querySelector("#qualityDeleteMode"),
      deleteBtn: document.querySelector("#deleteQualityPromptsBtn"),
      jsonBtn: document.querySelector("#downloadQualityJsonBtn"),
      csvBtn: document.querySelector("#downloadQualityCsvBtn"),
      status: document.querySelector("#promptQualityStatus"),
      progressWrap: document.querySelector("#qualityProgressWrap"),
      progressBar: document.querySelector("#qualityProgressBar"),
      progressText: document.querySelector("#qualityProgressText"),
      summary: document.querySelector("#promptQualitySummary"),
      controls: document.querySelector("#promptQualityFilters"),
      search: document.querySelector("#qualitySearch"),
      position: document.querySelector("#qualityPosition"),
      quality: document.querySelector("#qualityBand"),
      issue: document.querySelector("#qualityIssue"),
      sort: document.querySelector("#qualitySort"),
      list: document.querySelector("#promptQualityList"),
      listSummary: document.querySelector("#promptQualityListSummary")
    };
  }

  function bindEvents(elements, core) {
    elements.runBtn.addEventListener("click", () => runAnalysis(elements, core));
    elements.cancelBtn.addEventListener("click", () => { cancelled = true; });
    elements.ratingsBtn.addEventListener("click", () => applyRecommendations(elements, core, { ratings: true }));
    elements.disableBtn.addEventListener("click", () => applyRecommendations(elements, core, { disableMode: elements.disableMode?.value || "review" }));
    elements.disableMode?.addEventListener("change", () => updateDisableAction(elements));
    elements.deleteBtn?.addEventListener("click", () => deleteQualityPrompts(elements, core, elements.deleteMode?.value || "poor"));
    elements.deleteMode?.addEventListener("change", () => updateDeleteAction(elements));
    elements.list?.addEventListener("click", event => {
      const button = event.target.closest("button[data-delete-quality-prompt]");
      if (button) deleteQualityPromptById(elements, core, button.dataset.deleteQualityPrompt);
    });
    elements.jsonBtn.addEventListener("click", downloadJsonReport);
    elements.csvBtn.addEventListener("click", downloadCsvReport);

    for (const input of [elements.search, elements.position, elements.quality, elements.issue, elements.sort]) {
      if (!input) continue;
      input.addEventListener(input === elements.search ? "input" : "change", () => renderResults(elements));
    }
  }

  async function runAnalysis(elements, core) {
    if (running) return;
    running = true;
    cancelled = false;
    setRunningState(elements, true);
    analysisResults = [];
    analysisById = new Map();
    clearOutput(elements);

    try {
      const library = (core.getPromptLibrary?.() || []).filter(prompt => elements.scope.value !== "enabled" || prompt.enabled !== false);
      const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
      if (!library.length) throw new Error("No prompts are available in the selected scope.");
      if (!players.length) throw new Error("players.js is not loaded.");

      elements.status.textContent = `Preparing ${library.length.toLocaleString()} prompts for analysis…`;
      const progress = (current, total, label) => updateProgress(elements, current, total, label);
      const results = await analyseLibrary(library, players, { progress, shouldCancel: () => cancelled });
      if (cancelled) {
        elements.status.textContent = "Analysis cancelled. No prompt settings were changed.";
        return;
      }

      analysisResults = results;
      analysisById = new Map(results.map(result => [result.id, result]));
      renderSummary(elements);
      renderResults(elements);
      enableReportActions(elements, true);

      const excellent = results.filter(result => result.quality === "excellent").length;
      const needsAttention = results.filter(result => ["review", "poor", "broken"].includes(result.quality)).length;
      elements.status.textContent = `Analysis complete: ${excellent} excellent, ${needsAttention} needing attention. Nothing has been changed automatically.`;
    } catch (error) {
      console.error("Prompt Quality Analyser failed.", error);
      elements.status.textContent = `Analysis could not be completed: ${error.message}`;
    } finally {
      running = false;
      setRunningState(elements, false);
    }
  }

  async function analyseLibrary(library, players, options = {}) {
    const progress = typeof options.progress === "function" ? options.progress : () => {};
    const shouldCancel = typeof options.shouldCancel === "function" ? options.shouldCancel : () => false;
    const records = [];
    const allSeasonLabels = new Set();

    for (const player of players) {
      for (const season of player.seasons || []) {
        records.push({ ...season, playerId: player.playerId, playerName: player.name, name: player.name });
        if (season.season) allSeasonLabels.add(season.season);
      }
    }

    const raw = [];
    const totalSteps = library.length * 2 + Math.max(1, Math.floor((library.length * (library.length - 1)) / 2));
    let step = 0;

    for (let index = 0; index < library.length; index += 1) {
      if (shouldCancel()) return [];
      const prompt = library[index];
      const evaluated = evaluatePrompt(prompt, records);
      raw.push({ prompt, ...evaluated });
      step += 1;
      progress(step, totalSteps, `Testing ${index + 1} of ${library.length}: ${prompt.label}`);
      if (index % 4 === 3) await nextFrame();
    }

    const bestLeaderCounts = new Map();
    for (const item of raw) {
      if (!item.bestAnswer) continue;
      bestLeaderCounts.set(item.bestAnswer.playerId, (bestLeaderCounts.get(item.bestAnswer.playerId) || 0) + 1);
    }

    const overlapData = new Map(raw.map(item => [item.prompt.id, { max: 0, averageTopThree: 0, closestId: null, closestLabel: null, labelSimilarity: 0, similarLabelId: null, similarLabel: null, values: [] }]));
    const pairTotal = Math.max(1, Math.floor((raw.length * (raw.length - 1)) / 2));
    let pairIndex = 0;

    for (let leftIndex = 0; leftIndex < raw.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < raw.length; rightIndex += 1) {
        if (shouldCancel()) return [];
        const left = raw[leftIndex];
        const right = raw[rightIndex];
        const labelScore = tokenSimilarity(normaliseLabel(left.prompt.label), normaliseLabel(right.prompt.label));
        updateLabelSimilarity(overlapData.get(left.prompt.id), right.prompt, labelScore);
        updateLabelSimilarity(overlapData.get(right.prompt.id), left.prompt, labelScore);

        if (left.prompt.position === right.prompt.position) {
          const overlap = jaccard(left.playerSet, right.playerSet);
          updatePoolOverlap(overlapData.get(left.prompt.id), right.prompt, overlap);
          updatePoolOverlap(overlapData.get(right.prompt.id), left.prompt, overlap);
        }

        pairIndex += 1;
        step += 1;
        if (pairIndex % 500 === 0) {
          progress(step, totalSteps, `Comparing prompt overlap ${pairIndex.toLocaleString()} of ${pairTotal.toLocaleString()}`);
          await nextFrame();
        }
      }
    }

    for (const data of overlapData.values()) {
      data.values.sort((a, b) => b - a);
      const top = data.values.slice(0, 3);
      data.averageTopThree = top.length ? top.reduce((sum, value) => sum + value, 0) / top.length : 0;
      delete data.values;
    }

    const results = [];
    for (let index = 0; index < raw.length; index += 1) {
      if (shouldCancel()) return [];
      const item = raw[index];
      const overlap = overlapData.get(item.prompt.id);
      const bestRepeatCount = item.bestAnswer ? bestLeaderCounts.get(item.bestAnswer.playerId) || 0 : 0;
      results.push(scorePrompt(item, overlap, bestRepeatCount, allSeasonLabels.size));
      step += 1;
      progress(Math.min(step, totalSteps), totalSteps, `Scoring ${index + 1} of ${raw.length}: ${item.prompt.label}`);
      if (index % 8 === 7) await nextFrame();
    }

    progress(totalSteps, totalSteps, "Prompt quality report ready");
    return results;
  }

  function evaluatePrompt(prompt, records) {
    const matches = [];
    const errors = [];

    for (const record of records) {
      if (record.position !== prompt.position || Number(record.minutes) <= 0) continue;
      try {
        if (prompt.test(record)) matches.push(record);
      } catch (error) {
        if (errors.length < 5) errors.push(String(error?.message || error));
      }
    }

    const bestByPlayer = new Map();
    for (const match of matches) {
      const previous = bestByPlayer.get(match.playerId);
      if (!previous || match.points > previous.points || (match.points === previous.points && seasonValue(match.season) > seasonValue(previous.season))) {
        bestByPlayer.set(match.playerId, match);
      }
    }

    const uniqueAnswers = [...bestByPlayer.values()].sort((a, b) => b.points - a.points || String(a.playerName).localeCompare(String(b.playerName)));
    const clubCounts = countBy(uniqueAnswers, answer => answer.club || "Unknown");
    const seasonCounts = countBy(matches, answer => answer.season || "Unknown");
    const playerSet = new Set(bestByPlayer.keys());
    const bigSixCount = uniqueAnswers.filter(answer => BIG_SIX.has(answer.club)).length;
    const largestClub = largestEntry(clubCounts);
    const pointValues = uniqueAnswers.map(answer => Number(answer.points) || 0);
    const topFive = pointValues.slice(0, 5);
    const top = topFive[0] || 0;
    const second = topFive[1] ?? top;
    const fifth = topFive[4] ?? topFive[topFive.length - 1] ?? top;

    return {
      playerCount: bestByPlayer.size,
      seasonCount: matches.length,
      uniqueSeasonCount: seasonCounts.size,
      uniqueClubCount: clubCounts.size,
      playerSet,
      bestAnswer: uniqueAnswers[0] || null,
      topAnswers: uniqueAnswers.slice(0, 5),
      largestClubName: largestClub?.[0] || "—",
      largestClubCount: largestClub?.[1] || 0,
      largestClubShare: uniqueAnswers.length ? (largestClub?.[1] || 0) / uniqueAnswers.length : 0,
      bigSixShare: uniqueAnswers.length ? bigSixCount / uniqueAnswers.length : 0,
      topGapRatio: top > 0 ? Math.max(0, top - second) / top : 0,
      topToFifthRatio: top > 0 ? Math.max(0, top - fifth) / top : 0,
      errorCount: errors.length,
      errorSamples: errors
    };
  }

  function scorePrompt(item, overlap, bestRepeatCount, totalSeasonCount) {
    const prompt = item.prompt;
    const flags = [];
    const recommendations = [];
    const components = {};
    const range = IDEAL_RANGES[prompt.position] || IDEAL_RANGES.MID;

    components.answerBreadth = breadthScore(item.playerCount, range);
    components.seasonDiversity = Math.min(15, totalSeasonCount ? (item.uniqueSeasonCount / Math.min(totalSeasonCount, 8)) * 15 : 0);
    components.clubSpread = spreadScore(item.largestClubShare, 15);
    components.bigSixBalance = eliteBalanceScore(item.bigSixShare, prompt);
    components.answerObviousness = obviousnessScore(item.topGapRatio, item.topToFifthRatio, bestRepeatCount);
    components.poolUniqueness = overlapScore(overlap.max);
    components.difficultyFit = difficultyFitScore(prompt, item.playerCount);
    components.ruleHealth = item.errorCount ? 0 : 5;

    let score = Object.values(components).reduce((sum, value) => sum + value, 0);

    if (item.errorCount) {
      flags.push("broken-rule");
      recommendations.push("Repair the test rule before using this prompt.");
      score -= 40;
    }
    if (item.playerCount === 0) {
      flags.push("no-answers");
      recommendations.push("Disable this prompt until the rule or database is corrected.");
      score = 0;
    } else if (item.playerCount < range.narrow) {
      flags.push("too-narrow");
      recommendations.push(`Broaden the rule; only ${item.playerCount} footballers currently qualify.`);
      score -= item.playerCount < 3 ? 25 : 10;
    }
    if (item.playerCount > range.broad) {
      flags.push("too-broad");
      recommendations.push(`Add another condition; ${item.playerCount} footballers currently qualify.`);
      score -= item.playerCount > range.broad * 1.5 ? 18 : 8;
    }
    if (overlap.max >= 0.8) {
      flags.push("high-overlap");
      recommendations.push(`This answer pool is very similar to “${overlap.closestLabel}”.`);
      score -= overlap.max >= 0.95 ? 20 : 9;
    }
    if (overlap.labelSimilarity >= 0.82) {
      flags.push("similar-wording");
      recommendations.push(`Review the wording against “${overlap.similarLabel}”.`);
      score -= overlap.labelSimilarity >= 0.94 ? 10 : 4;
    }
    if (item.topGapRatio >= 0.35 || item.topToFifthRatio >= 0.55) {
      flags.push("too-obvious");
      recommendations.push("The highest-scoring answer stands well clear of the alternatives.");
    }
    if (bestRepeatCount >= 6) {
      flags.push("repeated-leader");
      recommendations.push(`${item.bestAnswer?.playerName || "The leading answer"} is also the best answer for ${bestRepeatCount - 1} other prompts.`);
      score -= bestRepeatCount >= 10 ? 8 : 4;
    }
    if (item.largestClubShare >= 0.45 && item.playerCount >= 8) {
      flags.push("club-dominated");
      recommendations.push(`${item.largestClubName} supplies ${formatPercent(item.largestClubShare)} of the valid footballers.`);
    }
    if (item.bigSixShare >= 0.78 && !explicitElitePrompt(prompt)) {
      flags.push("big-six-heavy");
      recommendations.push(`${formatPercent(item.bigSixShare)} of valid footballers come from the traditional Big Six.`);
      score -= item.bigSixShare >= 0.92 ? 7 : 3;
    }
    if (item.uniqueSeasonCount < 3 && item.seasonCount > 0) {
      flags.push("low-season-spread");
      recommendations.push("The answers are concentrated in very few seasons.");
      score -= 7;
    }

    const inferredDifficulty = inferDifficulty(prompt.position, item.playerCount);
    if (prompt.difficulty !== inferredDifficulty) {
      flags.push("difficulty-mismatch");
      recommendations.push(`Consider changing the difficulty from ${capitalise(prompt.difficulty)} to ${capitalise(inferredDifficulty)}.`);
    }

    score = clamp(Math.round(score), 0, 100);
    const quality = qualityBand(score, item.errorCount, item.playerCount);
    const suggestedRating = score >= 85 ? 5 : score >= 72 ? 4 : score >= 58 ? 3 : score >= 42 ? 2 : 1;
    const suggestedEnabled = !(quality === "broken" || quality === "poor" || item.playerCount < 3 || overlap.max >= 0.97);

    if (!recommendations.length) recommendations.push("No major quality problems were detected.");

    return {
      id: prompt.id,
      label: prompt.label,
      position: prompt.position,
      difficulty: prompt.difficulty,
      enabled: prompt.enabled !== false,
      currentRating: Number(prompt.rating) || 3,
      score,
      quality,
      suggestedRating,
      suggestedEnabled,
      inferredDifficulty,
      playerCount: item.playerCount,
      seasonCount: item.seasonCount,
      uniqueSeasonCount: item.uniqueSeasonCount,
      uniqueClubCount: item.uniqueClubCount,
      largestClubName: item.largestClubName,
      largestClubShare: item.largestClubShare,
      bigSixShare: item.bigSixShare,
      bestAnswer: item.bestAnswer ? {
        playerId: item.bestAnswer.playerId,
        playerName: item.bestAnswer.playerName,
        season: item.bestAnswer.season,
        club: item.bestAnswer.club,
        points: item.bestAnswer.points
      } : null,
      topAnswers: item.topAnswers.map(answer => ({
        playerId: answer.playerId,
        playerName: answer.playerName,
        season: answer.season,
        club: answer.club,
        points: answer.points
      })),
      topGapRatio: item.topGapRatio,
      topToFifthRatio: item.topToFifthRatio,
      bestRepeatCount,
      maxPoolOverlap: overlap.max,
      averageTopThreeOverlap: overlap.averageTopThree,
      closestPromptId: overlap.closestId,
      closestPromptLabel: overlap.closestLabel,
      labelSimilarity: overlap.labelSimilarity,
      similarLabelId: overlap.similarLabelId,
      similarLabel: overlap.similarLabel,
      errorCount: item.errorCount,
      errorSamples: item.errorSamples,
      flags,
      recommendations,
      components: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Math.round(value * 10) / 10]))
    };
  }

  function renderSummary(elements) {
    const total = analysisResults.length;
    const bands = countBy(analysisResults, result => result.quality);
    const enabled = analysisResults.filter(result => result.enabled).length;
    const suggestedDisable = analysisResults.filter(result => !result.suggestedEnabled && result.enabled).length;
    const average = total ? Math.round(analysisResults.reduce((sum, result) => sum + result.score, 0) / total) : 0;

    elements.summary.classList.remove("hidden");
    elements.controls.classList.remove("hidden");
    elements.summary.innerHTML = `
      <article><span>Analysed</span><strong>${total.toLocaleString()}</strong></article>
      <article><span>Average score</span><strong>${average}/100</strong></article>
      <article><span>Excellent</span><strong>${bands.get("excellent") || 0}</strong></article>
      <article><span>Good</span><strong>${bands.get("good") || 0}</strong></article>
      <article><span>Needs attention</span><strong>${(bands.get("review") || 0) + (bands.get("poor") || 0) + (bands.get("broken") || 0)}</strong></article>
      <article><span>Enabled</span><strong>${enabled}</strong></article>
      <article><span>Suggested disables</span><strong>${suggestedDisable}</strong></article>
    `;
  }

  function filteredQualityResults(elements) {
    const query = normaliseLabel(elements.search.value);
    const position = elements.position.value;
    const quality = elements.quality.value;
    const issue = elements.issue.value;
    const sort = elements.sort.value;

    const filtered = analysisResults.filter(result => {
      if (position !== "all" && result.position !== position) return false;
      if (quality !== "all" && result.quality !== quality) return false;
      if (issue !== "all" && !result.flags.includes(issue)) return false;
      if (query && !normaliseLabel(`${result.id} ${result.label} ${result.flags.join(" ")}`).includes(query)) return false;
      return true;
    });

    filtered.sort((left, right) => {
      if (sort === "score-desc") return right.score - left.score || comparePrompt(left, right);
      if (sort === "score-asc") return left.score - right.score || comparePrompt(left, right);
      if (sort === "players-asc") return left.playerCount - right.playerCount || comparePrompt(left, right);
      if (sort === "players-desc") return right.playerCount - left.playerCount || comparePrompt(left, right);
      if (sort === "overlap-desc") return right.maxPoolOverlap - left.maxPoolOverlap || comparePrompt(left, right);
      if (sort === "quality") return QUALITY_ORDER[right.quality] - QUALITY_ORDER[left.quality] || right.score - left.score;
      return comparePrompt(left, right);
    });
    return filtered;
  }

  function resultsForDisableMode(elements, mode) {
    const enabledResults = analysisResults.filter(result => result.enabled);
    if (mode === "filtered") return filteredQualityResults(elements).filter(result => result.enabled);
    if (mode === "recommended") return enabledResults.filter(result => !result.suggestedEnabled);
    const maximumOrder = ({ broken: 0, poor: 1, review: 2, fair: 3 })[mode];
    if (!Number.isInteger(maximumOrder)) return [];
    return enabledResults.filter(result => (QUALITY_ORDER[result.quality] ?? 99) <= maximumOrder);
  }

  function disableModeLabel(mode) {
    return ({
      recommended: "analyser recommendations",
      broken: "broken prompts",
      poor: "poor or broken prompts",
      review: "needs-review, poor or broken prompts",
      fair: "fair or worse prompts",
      filtered: "enabled prompts currently shown"
    })[mode] || "matching prompts";
  }

  function updateDisableAction(elements) {
    if (!elements.disableBtn) return;
    const mode = elements.disableMode?.value || "review";
    const count = analysisResults.length ? resultsForDisableMode(elements, mode).length : 0;
    elements.disableBtn.disabled = running || count === 0;
    elements.disableBtn.textContent = count ? `Disable ${count} matching prompt${count === 1 ? "" : "s"}` : "No matching prompts to disable";
  }

  function resultsForDeleteMode(elements, mode) {
    if (mode === "filtered") return filteredQualityResults(elements);
    if (mode === "recommended") return analysisResults.filter(result => !result.suggestedEnabled);
    const maximumOrder = ({ broken: 0, poor: 1, review: 2, fair: 3 })[mode];
    if (!Number.isInteger(maximumOrder)) return [];
    return analysisResults.filter(result => (QUALITY_ORDER[result.quality] ?? 99) <= maximumOrder);
  }

  function updateDeleteAction(elements) {
    if (!elements.deleteBtn) return;
    const mode = elements.deleteMode?.value || "poor";
    const count = analysisResults.length ? resultsForDeleteMode(elements, mode).length : 0;
    elements.deleteBtn.disabled = running || count === 0;
    elements.deleteBtn.textContent = count ? `Delete ${count} matching prompt${count === 1 ? "" : "s"}` : "No matching prompts to delete";
  }

  function renderResults(elements) {
    if (!analysisResults.length) return;
    const filtered = filteredQualityResults(elements);
    elements.listSummary.textContent = `${filtered.length.toLocaleString()} of ${analysisResults.length.toLocaleString()} analysed prompts shown`;
    elements.list.innerHTML = filtered.length ? filtered.map(renderQualityCard).join("") : '<div class="quality-empty">No prompts match these filters.</div>';
    updateDisableAction(elements);
    updateDeleteAction(elements);
  }

  function renderQualityCard(result) {
    const best = result.bestAnswer
      ? `${escapeHtml(result.bestAnswer.playerName)} · ${escapeHtml(result.bestAnswer.season)} · ${Number(result.bestAnswer.points).toLocaleString()} pts`
      : "No valid answer";
    const issues = result.flags.length
      ? result.flags.map(flag => `<span class="quality-issue">${escapeHtml(issueLabel(flag))}</span>`).join("")
      : '<span class="quality-issue clear">No major issues</span>';
    const recommendations = result.recommendations.map(item => `<li>${escapeHtml(item)}</li>`).join("");
    const ratingChange = result.suggestedRating === result.currentRating
      ? `Keep rating ${result.currentRating}/5`
      : `Rating ${result.currentRating}/5 → ${result.suggestedRating}/5`;

    return `<article class="quality-card ${result.quality}" data-prompt-id="${escapeAttribute(result.id)}">
      <div class="quality-card-head">
        <div class="quality-title">
          <span class="position-badge">${escapeHtml(result.position)}</span>
          <div><h4>${escapeHtml(result.label)}</h4><p>${escapeHtml(result.id)}</p></div>
        </div>
        <div class="quality-score"><strong>${result.score}</strong><span>/100</span><em>${escapeHtml(qualityLabel(result.quality))}</em></div>
      </div>
      <div class="quality-meter"><span style="width:${result.score}%"></span></div>
      <div class="quality-metrics">
        <span><b>${result.playerCount}</b> players</span>
        <span><b>${result.seasonCount}</b> seasons</span>
        <span><b>${result.uniqueSeasonCount}</b> season years</span>
        <span><b>${result.uniqueClubCount}</b> clubs</span>
        <span><b>${formatPercent(result.maxPoolOverlap)}</b> max overlap</span>
        <span><b>${formatPercent(result.bigSixShare)}</b> Big Six</span>
      </div>
      <div class="quality-detail-grid">
        <div><span>Best answer</span><strong>${best}</strong></div>
        <div><span>Largest club share</span><strong>${escapeHtml(result.largestClubName)} · ${formatPercent(result.largestClubShare)}</strong></div>
        <div><span>Closest answer pool</span><strong>${result.closestPromptLabel ? `${escapeHtml(result.closestPromptLabel)} · ${formatPercent(result.maxPoolOverlap)}` : "None"}</strong></div>
        <div><span>Recommendation</span><strong>${escapeHtml(ratingChange)} · ${result.suggestedEnabled ? "Keep enabled" : "Disable for review"}</strong></div>
      </div>
      <div class="quality-issues">${issues}</div>
      <details class="quality-details"><summary>Why it received this score</summary>
        <div class="quality-component-grid">
          ${Object.entries(result.components).map(([key, value]) => `<span>${escapeHtml(componentLabel(key))}<b>${value}</b></span>`).join("")}
        </div>
        <ul>${recommendations}</ul>
      </details>
      <div class="quality-card-actions"><button type="button" data-delete-quality-prompt="${escapeAttribute(result.id)}">Delete this prompt</button></div>
    </article>`;
  }

  function deleteQualityPromptById(elements, core, promptId) {
    const result = analysisById.get(promptId);
    if (!result || !window.confirm(`Delete “${result.label}” from the browser prompt collection?`)) return;
    const outcome = window.FPL_PROMPT_MANAGER_API?.deletePrompts?.([promptId]);
    if (!outcome) { elements.status.textContent = "Prompt deletion is unavailable until the Prompt Library Manager has loaded."; return; }
    if (outcome.protected) { elements.status.textContent = "That prompt is in the current XI. Reroll it before deleting it."; return; }
    elements.status.textContent = "Prompt deleted from the browser collection. Reloading the Studio…";
    window.setTimeout(() => window.location.reload(), 450);
  }

  function deleteQualityPrompts(elements, core, mode) {
    const targets = resultsForDeleteMode(elements, mode);
    if (!targets.length) { elements.status.textContent = "No analysed prompts match that delete rule."; updateDeleteAction(elements); return; }
    if (!window.confirm(`Delete ${targets.length} matching prompt${targets.length === 1 ? "" : "s"} from the browser collection? Prompts in the current XI will be protected.`)) return;
    if (window.prompt(`Type DELETE to confirm removing ${targets.length} prompt${targets.length === 1 ? "" : "s"}.`) !== "DELETE") { elements.status.textContent = "Deletion cancelled — confirmation text did not match."; return; }
    const outcome = window.FPL_PROMPT_MANAGER_API?.deletePrompts?.(targets.map(result => result.id));
    if (!outcome) { elements.status.textContent = "Prompt deletion is unavailable until the Prompt Library Manager has loaded."; return; }
    elements.status.textContent = `${outcome.deleted} prompt${outcome.deleted === 1 ? "" : "s"} deleted${outcome.protected ? `; ${outcome.protected} current-XI prompt${outcome.protected === 1 ? " was" : "s were"} protected` : ""}. Reloading the Studio…`;
    window.setTimeout(() => window.location.reload(), 600);
  }

  function applyRecommendations(elements, core, options) {
    if (!analysisResults.length) return;
    const ratingMode = options.ratings === true;
    const disableMode = options.disableMode || "";
    const targets = ratingMode
      ? analysisResults.filter(result => result.suggestedRating !== result.currentRating)
      : resultsForDisableMode(elements, disableMode);

    if (!targets.length) {
      elements.status.textContent = ratingMode
        ? "There are no rating suggestions to apply."
        : "No enabled prompts match that bulk-disable rule.";
      updateDisableAction(elements);
      return;
    }

    const message = ratingMode
      ? `Apply suggested quality ratings to ${targets.length} analysed prompt(s) in this browser workspace?`
      : `Disable ${targets.length} ${disableModeLabel(disableMode)} in this browser workspace? This does not change GitHub until you download and upload prompt-library.js.`;
    if (!window.confirm(message)) return;

    const targetIds = new Set(targets.map(result => result.id));
    const library = core.getPromptLibrary?.() || [];
    const state = loadManagerState();
    let changed = 0;

    for (const result of analysisResults) {
      if (!targetIds.has(result.id)) continue;
      const prompt = library.find(item => item.id === result.id);
      if (!prompt) continue;
      let shouldPersist = false;
      if (ratingMode && prompt.rating !== result.suggestedRating) {
        prompt.rating = result.suggestedRating;
        shouldPersist = true;
      }
      if (!ratingMode && prompt.enabled !== false) {
        prompt.enabled = false;
        shouldPersist = true;
      }
      if (!shouldPersist) continue;
      persistPromptMetadata(state, prompt);
      changed += 1;
    }

    if (!changed) {
      elements.status.textContent = ratingMode
        ? "The analysed prompts already use those suggested ratings."
        : "Those prompts are already disabled.";
      return;
    }

    localStorage.setItem(MANAGER_STORAGE_KEY, JSON.stringify(state));
    elements.status.textContent = `${changed} browser-only prompt setting(s) updated. Reloading the Studio…`;
    window.setTimeout(() => window.location.reload(), 450);
  }

  function persistPromptMetadata(state, prompt) {
    const metadata = {
      label: prompt.label,
      fail: prompt.fail,
      difficulty: prompt.difficulty,
      tags: [...(prompt.tags || [])],
      rating: prompt.rating,
      cooldown: prompt.cooldown,
      enabled: prompt.enabled !== false
    };
    const customIndex = state.customs.findIndex(item => item.id === prompt.id);
    if (customIndex >= 0 || prompt.studioRule) {
      const source = customIndex >= 0 ? state.customs[customIndex] : {};
      const serialised = {
        ...source,
        id: prompt.id,
        position: prompt.position,
        label: prompt.label,
        fail: prompt.fail,
        difficulty: prompt.difficulty,
        tags: [...(prompt.tags || [])],
        rating: prompt.rating,
        cooldown: prompt.cooldown,
        enabled: prompt.enabled !== false,
        studioRule: prompt.studioRule || source.studioRule,
        testSource: prompt.test?.toString?.() || source.testSource
      };
      if (customIndex >= 0) state.customs[customIndex] = serialised;
      else state.customs.push(serialised);
      return;
    }
    state.overrides[prompt.id] = { ...(state.overrides[prompt.id] || {}), ...metadata };
  }

  function loadManagerState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MANAGER_STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") {
        return {
          version: 1,
          overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
          customs: Array.isArray(parsed.customs) ? parsed.customs : [],
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
        };
      }
    } catch (error) {
      console.warn("Prompt manager state could not be read.", error);
    }
    return { version: 1, overrides: {}, customs: [], deletedIds: [] };
  }

  function downloadJsonReport() {
    if (!analysisResults.length) return;
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      database: {
        players: Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS.length : 0,
        playerSeasons: Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS.reduce((sum, player) => sum + (player.seasons?.length || 0), 0) : 0
      },
      summary: buildSummaryObject(),
      prompts: analysisResults.map(copyResult)
    };
    downloadText("prompt-quality-report.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  }

  function downloadCsvReport() {
    if (!analysisResults.length) return;
    const headers = [
      "id", "position", "label", "enabled", "difficulty", "score", "quality", "currentRating", "suggestedRating", "suggestedEnabled",
      "playerCount", "seasonCount", "uniqueSeasonCount", "uniqueClubCount", "largestClub", "largestClubShare", "bigSixShare",
      "bestAnswer", "bestAnswerSeason", "bestAnswerPoints", "maxPoolOverlap", "closestPromptId", "flags", "recommendations"
    ];
    const rows = analysisResults.map(result => [
      result.id, result.position, result.label, result.enabled, result.difficulty, result.score, result.quality, result.currentRating,
      result.suggestedRating, result.suggestedEnabled, result.playerCount, result.seasonCount, result.uniqueSeasonCount, result.uniqueClubCount,
      result.largestClubName, result.largestClubShare, result.bigSixShare, result.bestAnswer?.playerName || "", result.bestAnswer?.season || "",
      result.bestAnswer?.points ?? "", result.maxPoolOverlap, result.closestPromptId || "", result.flags.join("|"), result.recommendations.join(" | ")
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
    downloadText("prompt-quality-report.csv", csv, "text/csv;charset=utf-8");
  }

  function buildSummaryObject() {
    const bands = Object.fromEntries(countBy(analysisResults, result => result.quality));
    return {
      analysed: analysisResults.length,
      averageScore: analysisResults.length ? Math.round(analysisResults.reduce((sum, result) => sum + result.score, 0) / analysisResults.length) : 0,
      qualityBands: bands,
      suggestedDisables: analysisResults.filter(result => !result.suggestedEnabled && result.enabled).length,
      difficultyMismatches: analysisResults.filter(result => result.flags.includes("difficulty-mismatch")).length,
      highOverlap: analysisResults.filter(result => result.flags.includes("high-overlap")).length
    };
  }

  function setRunningState(elements, isRunning) {
    elements.runBtn.disabled = isRunning;
    elements.cancelBtn.disabled = !isRunning;
    elements.scope.disabled = isRunning;
    if (elements.disableMode) elements.disableMode.disabled = isRunning || !analysisResults.length;
    if (elements.deleteMode) elements.deleteMode.disabled = isRunning || !analysisResults.length;
    if (elements.deleteBtn) elements.deleteBtn.disabled = isRunning || !analysisResults.length;
    if (!isRunning) {
      elements.cancelBtn.textContent = "Cancel analysis";
      if (analysisResults.length) { updateDisableAction(elements); updateDeleteAction(elements); }
    }
  }

  function clearOutput(elements) {
    elements.summary.classList.add("hidden");
    elements.controls.classList.add("hidden");
    elements.list.innerHTML = "";
    elements.listSummary.textContent = "";
    enableReportActions(elements, false);
    elements.progressWrap.classList.remove("hidden");
    updateProgress(elements, 0, 1, "Starting…");
  }

  function enableReportActions(elements, enabled) {
    elements.ratingsBtn.disabled = !enabled;
    elements.jsonBtn.disabled = !enabled;
    elements.csvBtn.disabled = !enabled;
    if (elements.disableMode) elements.disableMode.disabled = !enabled;
    if (elements.deleteMode) elements.deleteMode.disabled = !enabled;
    if (!enabled) {
      elements.disableBtn.disabled = true;
      elements.disableBtn.textContent = "Disable matching prompts";
      if (elements.deleteBtn) { elements.deleteBtn.disabled = true; elements.deleteBtn.textContent = "Delete matching prompts"; }
    } else {
      updateDisableAction(elements);
      updateDeleteAction(elements);
    }
  }

  function updateProgress(elements, current, total, label) {
    const percent = total ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressWrap.setAttribute("aria-valuenow", String(Math.round(percent)));
    elements.progressText.textContent = `${label} · ${Math.round(percent)}%`;
  }

  function breadthScore(count, range) {
    if (count <= 0) return 0;
    if (count < range.narrow) return 20 * (count / range.narrow) * 0.55;
    if (count < range.idealLow) return 11 + ((count - range.narrow) / Math.max(1, range.idealLow - range.narrow)) * 9;
    if (count <= range.idealHigh) return 20;
    if (count <= range.broad) return 20 - ((count - range.idealHigh) / Math.max(1, range.broad - range.idealHigh)) * 12;
    return Math.max(1, 8 - ((count - range.broad) / range.broad) * 7);
  }

  function spreadScore(largestShare, maximum) {
    if (!Number.isFinite(largestShare)) return 0;
    if (largestShare <= 0.2) return maximum;
    if (largestShare <= 0.35) return maximum - ((largestShare - 0.2) / 0.15) * 4;
    if (largestShare <= 0.55) return maximum - 4 - ((largestShare - 0.35) / 0.2) * 6;
    return Math.max(1, maximum - 10 - ((largestShare - 0.55) / 0.45) * 5);
  }

  function eliteBalanceScore(bigSixShare, prompt) {
    if (explicitElitePrompt(prompt)) return 8;
    if (bigSixShare <= 0.45) return 10;
    if (bigSixShare <= 0.65) return 8;
    if (bigSixShare <= 0.8) return 5;
    if (bigSixShare <= 0.92) return 3;
    return 1;
  }

  function obviousnessScore(topGap, topToFifth, repeatCount) {
    let score = 15;
    if (topGap > 0.12) score -= Math.min(6, (topGap - 0.12) * 16);
    if (topToFifth > 0.35) score -= Math.min(7, (topToFifth - 0.35) * 12);
    if (repeatCount > 4) score -= Math.min(4, (repeatCount - 4) * 0.7);
    return Math.max(0, score);
  }

  function overlapScore(overlap) {
    if (overlap <= 0.25) return 20;
    if (overlap <= 0.45) return 20 - ((overlap - 0.25) / 0.2) * 4;
    if (overlap <= 0.65) return 16 - ((overlap - 0.45) / 0.2) * 6;
    if (overlap <= 0.82) return 10 - ((overlap - 0.65) / 0.17) * 6;
    return Math.max(0, 4 - ((overlap - 0.82) / 0.18) * 4);
  }

  function difficultyFitScore(prompt, count) {
    const inferred = inferDifficulty(prompt.position, count);
    if (prompt.difficulty === inferred) return 5;
    const values = { easy: 1, medium: 2, hard: 3 };
    return Math.abs((values[prompt.difficulty] || 2) - (values[inferred] || 2)) === 1 ? 3 : 1;
  }

  function inferDifficulty(position, count) {
    const thresholds = position === "GK"
      ? { hard: 7, medium: 20 }
      : position === "FWD"
        ? { hard: 9, medium: 28 }
        : { hard: 13, medium: 45 };
    if (count <= thresholds.hard) return "hard";
    if (count <= thresholds.medium) return "medium";
    return "easy";
  }

  function qualityBand(score, errorCount, playerCount) {
    if (errorCount || playerCount === 0) return "broken";
    if (score >= 85) return "excellent";
    if (score >= 72) return "good";
    if (score >= 58) return "fair";
    if (score >= 42) return "review";
    return "poor";
  }

  function explicitElitePrompt(prompt) {
    const text = normaliseLabel(`${prompt.label} ${(prompt.tags || []).join(" ")}`);
    return /big six|top four|champion|league winner|arsenal|chelsea|liverpool|man city|man utd|spurs/.test(text);
  }

  function updatePoolOverlap(data, otherPrompt, value) {
    data.values.push(value);
    if (value > data.max) {
      data.max = value;
      data.closestId = otherPrompt.id;
      data.closestLabel = otherPrompt.label;
    }
  }

  function updateLabelSimilarity(data, otherPrompt, value) {
    if (value > data.labelSimilarity) {
      data.labelSimilarity = value;
      data.similarLabelId = otherPrompt.id;
      data.similarLabel = otherPrompt.label;
    }
  }

  function jaccard(left, right) {
    if (!left.size && !right.size) return 1;
    if (!left.size || !right.size) return 0;
    const smaller = left.size <= right.size ? left : right;
    const larger = left.size <= right.size ? right : left;
    let intersection = 0;
    for (const value of smaller) if (larger.has(value)) intersection += 1;
    return intersection / (left.size + right.size - intersection);
  }

  function tokenSimilarity(left, right) {
    const leftSet = new Set(left.split(/\s+/).filter(Boolean));
    const rightSet = new Set(right.split(/\s+/).filter(Boolean));
    if (!leftSet.size || !rightSet.size) return 0;
    return jaccard(leftSet, rightSet);
  }

  function countBy(items, getKey) {
    const counts = new Map();
    for (const item of items) {
      const key = getKey(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  function largestEntry(map) {
    let largest = null;
    for (const entry of map.entries()) if (!largest || entry[1] > largest[1]) largest = entry;
    return largest;
  }

  function comparePrompt(left, right) {
    return (POSITION_ORDER[left.position] ?? 99) - (POSITION_ORDER[right.position] ?? 99) || left.label.localeCompare(right.label);
  }

  function seasonValue(season) {
    const value = Number.parseInt(String(season || "").slice(0, 4), 10);
    return Number.isFinite(value) ? value : 0;
  }

  function qualityLabel(value) {
    return ({ excellent: "Excellent", good: "Good", fair: "Fair", review: "Needs review", poor: "Poor", broken: "Broken" })[value] || capitalise(value);
  }

  function issueLabel(value) {
    return ({
      "broken-rule": "Broken rule", "no-answers": "No answers", "too-narrow": "Too narrow", "too-broad": "Too broad",
      "high-overlap": "High overlap", "similar-wording": "Similar wording", "too-obvious": "Obvious leader",
      "repeated-leader": "Repeated leader", "club-dominated": "Club dominated", "big-six-heavy": "Big Six heavy",
      "low-season-spread": "Low season spread", "difficulty-mismatch": "Difficulty mismatch"
    })[value] || capitalise(value.replaceAll("-", " "));
  }

  function componentLabel(value) {
    return ({
      answerBreadth: "Answer breadth", seasonDiversity: "Season diversity", clubSpread: "Club spread", bigSixBalance: "Anti-meta balance",
      answerObviousness: "Answer variety", poolUniqueness: "Pool uniqueness", difficultyFit: "Difficulty fit", ruleHealth: "Rule health"
    })[value] || capitalise(value);
  }

  function formatPercent(value) {
    return `${Math.round((Number(value) || 0) * 100)}%`;
  }

  function normaliseLabel(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function capitalise(value) {
    return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function nextFrame() {
    return new Promise(resolve => window.setTimeout(resolve, 0));
  }

  function copyResult(result) {
    return JSON.parse(JSON.stringify(result));
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type });
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
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();

/* ===== END admin-phase14.js ===== */
