/* FPL Challenge Studio — Theme & Formation Engine: formation-aware seven-day challenge calendar generator.
   Builds seven dated, validated challenges for the Phase 1 UK-midnight loader.
   This module is deliberately separate from admin-core.js so the existing single-draft
   generator, Prompt Studio, certification tools and database logic remain untouched. */
(() => {
  "use strict";

  const DAYS_IN_BATCH = 7;
  const FORMATIONS = Object.freeze({
    "4-4-2": { label: "4-4-2", counts: { GK: 1, DEF: 4, MID: 4, FWD: 2 } },
    "4-3-3": { label: "4-3-3", counts: { GK: 1, DEF: 4, MID: 3, FWD: 3 } },
    "3-4-3": { label: "3-4-3", counts: { GK: 1, DEF: 3, MID: 4, FWD: 3 } },
    "3-5-2": { label: "3-5-2", counts: { GK: 1, DEF: 3, MID: 5, FWD: 2 } },
    "5-3-2": { label: "5-3-2", counts: { GK: 1, DEF: 5, MID: 3, FWD: 2 } },
    "5-4-1": { label: "5-4-1", counts: { GK: 1, DEF: 5, MID: 4, FWD: 1 } },
    "4-2-3-1": { label: "4-2-3-1", counts: { GK: 1, DEF: 4, MID: 5, FWD: 1 } }
  });
  const THEME_PRESETS = Object.freeze({
    "generated-mix": { label: "Generated Mix", formation: "4-4-2", name: "The Generated Mix" },
    "conte-style": { label: "Conte Style", formation: "5-3-2", name: "Conte Style" },
    "classic-442": { label: "Classic 4-4-2", formation: "4-4-2", name: "Classic 4-4-2" },
    "all-out-attack": { label: "All-Out Attack", formation: "3-4-3", name: "All-Out Attack" },
    "park-the-bus": { label: "Park the Bus", formation: "5-4-1", name: "Park the Bus" },
    "possession-433": { label: "Possession 4-3-3", formation: "4-3-3", name: "Possession 4-3-3" },
    "wingback-352": { label: "Wing-back 3-5-2", formation: "3-5-2", name: "Wing-back 3-5-2" },
    "gegenpress-4231": { label: "Gegenpress 4-2-3-1", formation: "4-2-3-1", name: "Gegenpress 4-2-3-1" },
    "custom": { label: "Custom", formation: null, name: null }
  });
  const DIFFICULTY_VALUE = { easy: 1, medium: 2, hard: 3 };
  const DIVERSITY_TAGS = new Set([
    "relegated", "promoted", "bottom-half", "mid-table", "survival",
    "outside-big-six", "outside-top-four", "manager", "budget", "young",
    "exact-stat", "name-rule", "surname", "first-name"
  ]);
  const FAMILY_GENERIC_TAGS = new Set(["anti-meta", "auto-generated", "relationship", "club-season", "excludes-top"]);
  const FAMILY_NAME_TAGS = new Set(["surname", "first-name", "name-length", "same-initials", "initials", "hyphenated", "name-rule"]);
  const FAMILY_SEASON_TAGS = new Set(["season-rule", "season-exact", "season-before", "season-after", "season-between"]);
  const FAMILY_CAREER_TAGS = new Set(["career-total", "career-seasons", "career-clubs", "career-overlap", "returned-club", "played-for-both"]);
  const FAMILY_STAT_PRIORITY = Object.freeze([
    "points", "goals", "assists", "goal-involvements", "minutes", "clean-sheets", "saves",
    "bonus", "cards", "discipline", "budget", "final-price", "age", "young", "veteran",
    "promoted", "relegated", "bottom-half", "bottomhalf", "mid-table", "league-position",
    "top-four", "survival"
  ]);
  const ROTATION_POLICY_VERSION = 1;
  const FORBIDDEN_COST = 1_000_000;
  const LONDON_TIMEZONE = "Europe/London";
  const MAX_CANDIDATES_PER_DAY = 650;
  const MAX_EXACT_CAP_CHECKS = 90;

  const core = window.FPL_STUDIO_API;
  if (!core) return;

  const elements = {
    startDate: document.querySelector("#batchStartDate"),
    firstNumber: document.querySelector("#batchFirstNumber"),
    generateButton: document.querySelector("#generateWeekBtn"),
    downloadButton: document.querySelector("#downloadWeekBtn"),
    clearButton: document.querySelector("#clearWeekBtn"),
    status: document.querySelector("#batchStatus"),
    review: document.querySelector("#batchReview"),
    manifestChip: document.querySelector("#batchManifestChip"),
    challengeName: document.querySelector("#challengeName"),
    difficultyTarget: document.querySelector("#difficultyTarget"),
    minAnswers: document.querySelector("#minAnswers"),
    maxAnswers: document.querySelector("#maxAnswers"),
    minAntiMeta: document.querySelector("#minAntiMeta"),
    cooldownChallenges: document.querySelector("#cooldownChallenges"),
    avoidRecent: document.querySelector("#avoidRecent"),
    maxPerfectScore: document.querySelector("#maxPerfectScore"),
    formation: document.querySelector("#batchFormation"),
    themePreset: document.querySelector("#batchThemePreset")
  };

  if (!elements.generateButton || !elements.review) return;

  let batchResults = [];
  let batchManifest = null;
  let generationToken = 0;

  initialise();

  function initialise() {
    const manifestEntries = getManifestEntries();
    const manifestMaxNumber = manifestEntries.reduce((max, entry) => Math.max(max, Number(entry.number) || 0), 0);
    const singleNumber = Number(document.querySelector("#challengeNumber")?.value) || 1;

    if (elements.startDate && !elements.startDate.value) {
      const singleReleaseDate = document.querySelector("#releaseDate")?.value;
      elements.startDate.value = isIsoDate(singleReleaseDate) ? singleReleaseDate : addDaysIso(londonDateKey(), 1);
    }
    if (elements.firstNumber && !Number(elements.firstNumber.value)) {
      elements.firstNumber.value = String(Math.max(singleNumber, manifestMaxNumber + 1));
    } else if (elements.firstNumber && manifestMaxNumber && Number(elements.firstNumber.value) <= manifestMaxNumber) {
      elements.firstNumber.value = String(manifestMaxNumber + 1);
    }

    if (elements.manifestChip) {
      elements.manifestChip.textContent = manifestEntries.length
        ? `${manifestEntries.length} calendar ${manifestEntries.length === 1 ? "entry" : "entries"} loaded`
        : "No calendar manifest loaded";
    }

    elements.generateButton.addEventListener("click", generateSevenDayBatch);
    elements.downloadButton?.addEventListener("click", downloadSevenDayBatch);
    elements.clearButton?.addEventListener("click", clearBatch);
    elements.themePreset?.addEventListener("change", applyThemePreset);

    for (const input of [
      elements.startDate, elements.firstNumber, elements.challengeName, elements.difficultyTarget,
      elements.minAnswers, elements.maxAnswers, elements.minAntiMeta, elements.cooldownChallenges,
      elements.avoidRecent, elements.maxPerfectScore, elements.formation, elements.themePreset
    ]) {
      input?.addEventListener("change", invalidateBatch);
    }

    applyThemePreset(false);
    renderEmptyReview();
  }

  function applyThemePreset(invalidate = true) {
    const preset = THEME_PRESETS[elements.themePreset?.value || "generated-mix"] || THEME_PRESETS["generated-mix"];
    if (preset.formation && elements.formation) elements.formation.value = preset.formation;
    if (preset.name && elements.challengeName) elements.challengeName.value = preset.name;
    if (invalidate) invalidateBatch();
  }

  function formationFromUi() {
    const key = elements.formation?.value || "4-4-2";
    return FORMATIONS[key] || FORMATIONS["4-4-2"];
  }

  function formationSequence(formation) {
    const counts = formation?.counts || FORMATIONS["4-4-2"].counts;
    return [
      ...Array(counts.GK || 0).fill("GK"),
      ...Array(counts.DEF || 0).fill("DEF"),
      ...Array(counts.MID || 0).fill("MID"),
      ...Array(counts.FWD || 0).fill("FWD")
    ];
  }

  function settingsFromUi() {
    const minAnswers = clampNumber(elements.minAnswers?.value, 2, 300, 6);
    const maxAnswers = clampNumber(elements.maxAnswers?.value, minAnswers, 500, 100);
    return {
      minAnswers,
      maxAnswers,
      minAntiMeta: clampNumber(elements.minAntiMeta?.value, 0, 11, 5),
      maxPerfectScore: clampNumber(elements.maxPerfectScore?.value, 0, 5000, 0),
      difficultyTarget: elements.difficultyTarget?.value || "mixed",
      avoidRecent: elements.avoidRecent?.checked !== false,
      cooldownChallenges: clampNumber(elements.cooldownChallenges?.value, 1, 50, 7),
      formationKey: elements.formation?.value || "4-4-2",
      formation: formationFromUi(),
      themeKey: elements.themePreset?.value || "generated-mix",
      theme: (THEME_PRESETS[elements.themePreset?.value || "generated-mix"] || THEME_PRESETS["generated-mix"]).label
    };
  }

  async function generateSevenDayBatch() {
    clearBatch(false);
    const token = ++generationToken;
    const settings = settingsFromUi();
    const startDate = elements.startDate?.value;
    const firstNumber = clampNumber(elements.firstNumber?.value, 1, 9999, 1);
    const baseName = (elements.challengeName?.value || "The Generated Mix").trim() || "The Generated Mix";
    const formation = settings.formation;
    const requiredFormation = formation.counts;
    const formationSlots = formationSequence(formation);

    if (!isIsoDate(startDate)) {
      setStatus("Choose a valid first challenge date.", "fail");
      return;
    }

    const batchDates = Array.from({ length: DAYS_IN_BATCH }, (_, index) => addDaysIso(startDate, index));
    const existingEntries = getManifestEntries();
    const datesBeingReplaced = new Set(batchDates);
    const reservedNumbers = new Map(
      existingEntries
        .filter(entry => !datesBeingReplaced.has(entry.date))
        .map(entry => [Number(entry.number) || 0, entry])
        .filter(([number]) => number > 0)
    );
    const numberCollision = Array.from({ length: DAYS_IN_BATCH }, (_, index) => firstNumber + index)
      .find(number => reservedNumbers.has(number));
    if (numberCollision) {
      const entry = reservedNumbers.get(numberCollision);
      setStatus(`An internal challenge ID is already reserved for ${entry.date || "another calendar date"}. The generator will choose the next available internal ID.`, "fail");
      return;
    }

    const promptLibrary = core.getPromptLibrary?.() || [];
    if (!promptLibrary.length) {
      setStatus("The prompt library is unavailable. Reload Studio before generating the week.", "fail");
      return;
    }

    elements.generateButton.disabled = true;
    if (elements.downloadButton) elements.downloadButton.disabled = true;
    elements.review.innerHTML = "";

    // Exact-prompt rotation is always enforced by the seven-day generator. The optional
    // browser/live history below is an extra freshness guard for challenges that may not yet
    // be represented in the calendar manifest.
    const extraBlockedIds = settings.avoidRecent
      ? new Set(window.FPL_STUDIO_PHASE3?.getCooldownPromptIds?.() || [])
      : new Set();
    if (settings.avoidRecent) {
      const livePromptIds = await loadLivePromptIds();
      livePromptIds.forEach(id => extraBlockedIds.add(id));
    }

    const basePools = buildBasePools(promptLibrary, settings, new Set());
    const missingBase = Object.keys(requiredFormation).filter(position => basePools[position].length < requiredFormation[position]);
    if (missingBase.length) {
      setStatus(`Not enough eligible ${missingBase.join(", ")} prompts for a seven-day batch. Adjust the answer limits.`, "fail");
      elements.generateButton.disabled = false;
      return;
    }

    const promptById = new Map(promptLibrary.map(prompt => [prompt.id, prompt]));
    const virtualSchedule = existingEntries
      .filter(entry => entry.date && !datesBeingReplaced.has(entry.date))
      .map(entry => ({
        ...entry,
        promptIds: Array.isArray(entry.promptIds) ? [...entry.promptIds] : [],
        promptFamilies: Array.isArray(entry.promptFamilies) ? [...entry.promptFamilies] : []
      }));
    const scheduledDates = new Set(virtualSchedule.map(entry => entry.date));
    const browserHistory = window.FPL_STUDIO_PHASE3?.getHistory?.() || [];
    for (const entry of browserHistory) {
      const date = entry?.releaseDate;
      if (!date || datesBeingReplaced.has(date) || scheduledDates.has(date) || !Array.isArray(entry.promptIds) || !entry.promptIds.length) continue;
      virtualSchedule.push({
        date,
        id: entry.id || "",
        number: Number(entry.number) || 0,
        title: entry.title || "",
        promptIds: [...entry.promptIds],
        promptFamilies: Array.isArray(entry.promptFamilies) ? [...entry.promptFamilies] : []
      });
      scheduledDates.add(date);
    }
    const rotationState = buildExactRotationState(virtualSchedule, startDate, basePools, promptById);

    try {
      for (let dayIndex = 0; dayIndex < DAYS_IN_BATCH; dayIndex += 1) {
        if (token !== generationToken) return;
        const date = batchDates[dayIndex];
        const number = firstNumber + dayIndex;
        const futureReservedIds = getFutureReservedPromptIds(virtualSchedule, date);
        const exactPlan = buildExactRotationPlan({
          rotationState,
          basePools,
          requiredFormation,
          extraBlockedIds,
          futureReservedIds
        });
        const familyPlan = buildFamilyCooldownPlan({
          schedule: virtualSchedule,
          date,
          cooldownDays: settings.cooldownChallenges,
          promptById,
          basePools,
          exactPlan,
          requiredFormation
        });

        setStatus(`Generating ${dayIndex + 1}/${DAYS_IN_BATCH} · ${friendlyDate(date)} · exact rotation + ${settings.cooldownChallenges}-day family cooldown…`, "working");
        await yieldToBrowser();

        const generated = await generateCandidateForDay({
          basePools,
          settings,
          requiredFormation,
          formationSlots,
          exactPlan,
          familyPlan,
          dayIndex,
          date,
          token
        });

        if (token !== generationToken) return;
        if (!generated.ok) {
          batchResults.push({
            date,
            number,
            title: `${longChallengeDate(date)} · ${baseName}`,
            difficulty: "—",
            formation: formation.label,
            formationCounts: { ...requiredFormation },
            theme: settings.themeKey === "custom" ? baseName : (settings.theme || baseName),
            perfectScore: 0,
            antiMetaCount: 0,
            promptIds: [],
            status: "FAIL",
            issues: [generated.reason]
          });
          renderBatchReview();
          setStatus(`Batch stopped on ${friendlyDate(date)}: ${generated.reason}`, "fail");
          return;
        }

        const prompts = generated.prompts;
        const perfect = generated.perfect;
        const difficulty = displayDifficultyFor(prompts);
        const challenge = {
          id: `daily-${date}-${slugify(baseName) || "generated-mix"}`,
          number,
          title: `${longChallengeDate(date)} · ${baseName}`,
          dateLabel: `${settings.theme || baseName} · ${formation.label} · ${difficulty}`,
          difficulty,
          releaseDate: date,
          formation: formation.label,
          formationCounts: { ...requiredFormation },
          theme: settings.themeKey === "custom" ? baseName : (settings.theme || baseName),
          perfectScore: perfect.score,
          prompts
        };
        const validation = validateChallenge(challenge, perfect, settings, exactPlan, familyPlan);
        const source = buildChallengeSource(challenge);

        const result = {
          ...challenge,
          promptIds: prompts.map(prompt => prompt.id),
          promptFamilies: prompts.map(promptFamily),
          antiMetaCount: prompts.filter(isAntiMeta).length,
          familyCooldownRelaxedPositions: [...familyPlan.relaxedPositions],
          perfect,
          source,
          status: validation.length ? "FAIL" : "PASS",
          issues: validation
        };
        batchResults.push(result);
        if (!validation.length) commitExactRotationSelection(rotationState, exactPlan, prompts, basePools);
        virtualSchedule.push(manifestEntryForResult(result));
        renderBatchReview();

        if (validation.length) {
          setStatus(`Batch stopped on ${friendlyDate(date)} because final validation failed: ${validation[0]}`, "fail");
          return;
        }

        setStatus(`Generated ${dayIndex + 1}/${DAYS_IN_BATCH} · ${friendlyDate(date)} · perfect ${perfect.score.toLocaleString()} · PASS`, "working");
        await yieldToBrowser();
      }

      batchManifest = buildMergedManifest(existingEntries, batchResults, settings);
      window.FPL_STUDIO_PHASE3?.recordBatchChallenges?.(batchResults.map(result => ({
        ...result,
        name: baseName,
        promptLabels: (result.prompts || []).map(prompt => prompt.label)
      })));
      if (elements.downloadButton) elements.downloadButton.disabled = false;
      setStatus(`All ${DAYS_IN_BATCH} challenges passed. The calendar ZIP is ready for ${friendlyDate(batchDates[0])}–${friendlyDate(batchDates[batchDates.length - 1])}.`, "pass");
    } catch (error) {
      console.error(error);
      setStatus(`The seven-day generator stopped: ${error instanceof Error ? error.message : String(error)}`, "fail");
    } finally {
      elements.generateButton.disabled = false;
    }
  }


  async function loadLivePromptIds() {
    try {
      if (!/^https?:$/.test(String(window.location?.protocol || "")) || typeof fetch !== "function") return [];
      const response = await fetch(`todays-challenge.js?phase2=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return [];
      const source = await response.text();
      const sandbox = Object.create(null);
      const challenge = new Function("window", `"use strict";\n${source}\nreturn window.FPL_DAILY_CHALLENGE || null;`)(sandbox);
      return Array.isArray(challenge?.prompts) ? challenge.prompts.map(prompt => prompt?.id).filter(Boolean) : [];
    } catch (error) {
      console.warn("Phase 2 could not read todays-challenge.js for freshness checking.", error);
      return [];
    }
  }

  function buildBasePools(promptLibrary, settings, historyBlocked) {
    const pools = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const prompt of promptLibrary) {
      if (!pools[prompt.position] || prompt.enabled === false) continue;
      if (historyBlocked.has(prompt.id)) continue;
      const count = Number(core.getPromptStats(prompt)?.playerCount || 0);
      if (count < settings.minAnswers || count > settings.maxAnswers) continue;
      pools[prompt.position].push(prompt);
    }
    return pools;
  }

  function promptFamily(prompt) {
    if (!prompt) return "UNKNOWN:other";
    if (prompt.family) return `${prompt.position || "ANY"}:${String(prompt.family)}`;

    const tags = (Array.isArray(prompt.tags) ? prompt.tags : []).filter(tag => !FAMILY_GENERIC_TAGS.has(tag));
    const statTag = () => FAMILY_STAT_PRIORITY.find(tag => tags.includes(tag));

    let family = "";
    if (tags.includes("teammate")) {
      const secondary = statTag();
      family = `teammate${secondary ? `+${secondary}` : ""}`;
    } else if (tags.includes("manager")) {
      const secondary = statTag();
      family = `manager${secondary ? `+${secondary}` : ""}`;
    } else {
      const nameTags = tags.filter(tag => FAMILY_NAME_TAGS.has(tag) && tag !== "name-rule").sort();
      const seasonTags = tags.filter(tag => FAMILY_SEASON_TAGS.has(tag) && tag !== "season-rule").sort();
      const careerTags = tags.filter(tag => FAMILY_CAREER_TAGS.has(tag)).sort();
      if (nameTags.length) family = `name:${nameTags[0]}`;
      else if (seasonTags.length) family = `season:${seasonTags[0]}`;
      else if (tags.includes("season-rule")) family = "season";
      else if (careerTags.length) family = `career:${careerTags[0]}`;
      else {
        const statTags = FAMILY_STAT_PRIORITY.filter(tag => tags.includes(tag));
        if (statTags.length >= 2) family = statTags.slice(0, 2).sort().join("+");
        else if (statTags.length) family = statTags[0];
      }
    }

    if (!family) family = tags[0] || String(prompt.id || "other").split("_").slice(0, 3).join("_") || "other";
    return `${prompt.position || "ANY"}:${family}`;
  }

  function buildExactRotationState(schedule, beforeDate, basePools, promptById) {
    const state = Object.fromEntries(Object.keys(basePools).map(position => [position, { cycle: 1, usedIds: new Set() }]));
    const poolIds = Object.fromEntries(Object.entries(basePools).map(([position, prompts]) => [position, new Set(prompts.map(prompt => prompt.id))]));
    const entries = schedule
      .filter(entry => entry.date && entry.date < beforeDate)
      .sort((left, right) => String(left.date).localeCompare(String(right.date)));

    for (const entry of entries) {
      for (const promptId of entry.promptIds || []) {
        const prompt = promptById.get(promptId);
        const position = prompt?.position;
        if (!position || !state[position] || !poolIds[position].has(promptId)) continue;
        const positionState = state[position];
        if (positionState.usedIds.size >= poolIds[position].size) {
          positionState.cycle += 1;
          positionState.usedIds.clear();
        }
        positionState.usedIds.add(promptId);
        if (positionState.usedIds.size >= poolIds[position].size) {
          positionState.cycle += 1;
          positionState.usedIds.clear();
        }
      }
    }
    return state;
  }

  function getFutureReservedPromptIds(schedule, date) {
    return new Set(schedule
      .filter(entry => entry.date && entry.date > date)
      .flatMap(entry => Array.isArray(entry.promptIds) ? entry.promptIds : []));
  }

  function buildExactRotationPlan({ rotationState, basePools, requiredFormation, extraBlockedIds, futureReservedIds }) {
    const plan = {};
    for (const [position, required] of Object.entries(requiredFormation)) {
      const positionState = rotationState[position] || { cycle: 1, usedIds: new Set() };
      const available = basePools[position].filter(prompt => !extraBlockedIds.has(prompt.id) && !futureReservedIds.has(prompt.id));
      const unused = available.filter(prompt => !positionState.usedIds.has(prompt.id));

      if (unused.length >= required) {
        plan[position] = {
          cycle: positionState.cycle,
          bridgeCycle: false,
          allowedIds: new Set(unused.map(prompt => prompt.id)),
          mustUseIds: new Set(),
          unavailableCount: basePools[position].length - available.length
        };
      } else {
        // The current cycle has fewer prompts left than today's formation needs. Force every
        // remaining unused prompt into today's XI, then fill the remaining slots from the new cycle.
        plan[position] = {
          cycle: positionState.cycle,
          bridgeCycle: true,
          allowedIds: new Set(available.map(prompt => prompt.id)),
          mustUseIds: new Set(unused.map(prompt => prompt.id)),
          unavailableCount: basePools[position].length - available.length
        };
      }
    }
    return plan;
  }

  function commitExactRotationSelection(rotationState, exactPlan, prompts, basePools) {
    for (const position of Object.keys(rotationState)) {
      const selected = prompts.filter(prompt => prompt.position === position).map(prompt => prompt.id);
      if (!selected.length) continue;
      const positionState = rotationState[position];
      const plan = exactPlan[position];
      if (plan?.bridgeCycle) {
        const oldCycleIds = plan.mustUseIds || new Set();
        positionState.cycle += 1;
        positionState.usedIds = new Set(selected.filter(id => !oldCycleIds.has(id)));
      } else {
        selected.forEach(id => positionState.usedIds.add(id));
        if (positionState.usedIds.size >= basePools[position].length) {
          positionState.cycle += 1;
          positionState.usedIds.clear();
        }
      }
    }
  }

  function familiesForEntry(entry, promptById) {
    if (Array.isArray(entry.promptFamilies) && entry.promptFamilies.length) return entry.promptFamilies;
    return (entry.promptIds || []).map(id => promptFamily(promptById.get(id))).filter(Boolean);
  }

  function buildFamilyCooldownPlan({ schedule, date, cooldownDays, promptById, basePools, exactPlan, requiredFormation }) {
    const cutoffBefore = addDaysIso(date, -cooldownDays);
    const cutoffAfter = addDaysIso(date, cooldownDays);
    const nearbyEntries = schedule.filter(entry => entry.date && entry.date !== date && entry.date >= cutoffBefore && entry.date <= cutoffAfter);
    const recentFamilies = new Set(nearbyEntries.flatMap(entry => familiesForEntry(entry, promptById)));
    const relaxedPositions = new Set();
    const allowedFamiliesByPosition = {};

    for (const [position, required] of Object.entries(requiredFormation)) {
      const exactAllowed = exactPlan[position]?.allowedIds || new Set();
      const candidates = basePools[position].filter(prompt => exactAllowed.has(prompt.id));
      const fresh = candidates.filter(prompt => !recentFamilies.has(promptFamily(prompt)));
      const freshFamilies = new Set(fresh.map(promptFamily));
      if (fresh.length >= required && freshFamilies.size >= required) {
        allowedFamiliesByPosition[position] = freshFamilies;
      } else {
        // Family cooldown is the only rule we relax automatically. Exact-prompt rotation stays hard.
        relaxedPositions.add(position);
        allowedFamiliesByPosition[position] = null;
      }
    }

    return {
      cooldownDays,
      recentFamilies,
      relaxedPositions,
      allowedFamiliesByPosition
    };
  }

  function exactPlanAllows(prompt, exactPlan) {
    return Boolean(exactPlan[prompt.position]?.allowedIds?.has(prompt.id));
  }

  function familyPlanAllows(prompt, familyPlan) {
    const allowed = familyPlan.allowedFamiliesByPosition[prompt.position];
    return allowed == null || allowed.has(promptFamily(prompt));
  }

  function satisfiesExactRotationRequirements(draft, exactPlan) {
    const selectedIds = new Set(draft.map(prompt => prompt.id));
    for (const positionPlan of Object.values(exactPlan)) {
      for (const requiredId of positionPlan.mustUseIds || []) if (!selectedIds.has(requiredId)) return false;
    }
    return true;
  }

  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, dayIndex, date, token }) {
    const availability = Object.fromEntries(
      Object.keys(requiredFormation).map(position => [
        position,
        basePools[position].filter(prompt => exactPlanAllows(prompt, exactPlan) && familyPlanAllows(prompt, familyPlan)).length
      ])
    );
    const missing = Object.keys(requiredFormation).filter(position => availability[position] < requiredFormation[position]);
    if (missing.length) {
      return { ok: false, reason: `Exact prompt rotation leaves too few ${missing.join(", ")} prompts. The family cooldown has already been relaxed where necessary.` };
    }

    const candidates = [];
    const signatures = new Set();
    for (let attempt = 0; attempt < MAX_CANDIDATES_PER_DAY; attempt += 1) {
      if (token !== generationToken) return { ok: false, reason: "Generation cancelled." };
      const used = new Set();
      const draft = [];

      for (const position of formationSlots) {
        const options = basePools[position].filter(prompt =>
          exactPlanAllows(prompt, exactPlan) && familyPlanAllows(prompt, familyPlan) && !used.has(prompt.id)
        );
        const choice = weightedPick(options, draft, settings, familyPlan);
        if (!choice) break;
        draft.push(choice);
        used.add(choice.id);
      }
      if (draft.length !== 11) continue;
      if (!satisfiesExactRotationRequirements(draft, exactPlan)) continue;
      if (draft.filter(isAntiMeta).length < settings.minAntiMeta) continue;

      const signature = draft.map(prompt => prompt.id).join("|");
      if (signatures.has(signature)) continue;
      signatures.add(signature);
      candidates.push({
        prompts: draft,
        balance: scoreDraft(draft, settings),
        naiveScore: naivePerfectUpperBound(draft)
      });

      if (attempt > 0 && attempt % 130 === 0) {
        setStatus(`Generating ${dayIndex + 1}/${DAYS_IN_BATCH} · ${friendlyDate(date)} · ${candidates.length} candidate XIs checked…`, "working");
        await yieldToBrowser();
      }
    }

    if (!candidates.length) return { ok: false, reason: "No complete XI could be generated with the current restrictions." };
    candidates.sort((left, right) => left.balance - right.balance || left.naiveScore - right.naiveScore);

    if (settings.maxPerfectScore <= 0) {
      for (const candidate of candidates.slice(0, 35)) {
        const perfect = calculatePerfectXI(candidate.prompts);
        if (perfect.possible) return { ok: true, prompts: candidate.prompts, perfect };
      }
      return { ok: false, reason: "The optimiser could not find a valid unique-player XI for the strongest candidates." };
    }

    // If the simple per-slot upper bound is already below the ceiling, the exact unique-player
    // score must also be below it. This usually lets the batch generator calculate only one exact XI.
    const definitelyUnderCap = candidates.filter(candidate => candidate.naiveScore <= settings.maxPerfectScore);
    for (const candidate of definitelyUnderCap.slice(0, 25)) {
      const perfect = calculatePerfectXI(candidate.prompts);
      if (perfect.possible && perfect.score <= settings.maxPerfectScore) {
        return { ok: true, prompts: candidate.prompts, perfect };
      }
    }

    const closest = [...candidates]
      .sort((left, right) => Math.abs(left.naiveScore - settings.maxPerfectScore) - Math.abs(right.naiveScore - settings.maxPerfectScore) || left.balance - right.balance)
      .slice(0, MAX_EXACT_CAP_CHECKS);

    let lowestExact = Number.POSITIVE_INFINITY;
    for (let index = 0; index < closest.length; index += 1) {
      const candidate = closest[index];
      const perfect = calculatePerfectXI(candidate.prompts);
      if (perfect.possible) {
        lowestExact = Math.min(lowestExact, perfect.score);
        if (perfect.score <= settings.maxPerfectScore) return { ok: true, prompts: candidate.prompts, perfect };
      }
      if (index > 0 && index % 12 === 0) {
        setStatus(`Generating ${dayIndex + 1}/${DAYS_IN_BATCH} · ${friendlyDate(date)} · exact score checks ${index + 1}/${closest.length} · lowest ${Number.isFinite(lowestExact) ? lowestExact.toLocaleString() : "—"}`, "working");
        await yieldToBrowser();
      }
    }

    return {
      ok: false,
      reason: `No checked draft met the ${settings.maxPerfectScore.toLocaleString()} perfect-score ceiling${Number.isFinite(lowestExact) ? `; the lowest exact score found was ${lowestExact.toLocaleString()}` : ""}.`
    };
  }

  function weightedPick(options, currentDraft, settings, familyPlan) {
    if (!options.length) return null;
    const usedFamilies = new Set(currentDraft.map(promptFamily));
    const familyFreshOptions = options.filter(prompt => !usedFamilies.has(promptFamily(prompt)));
    if (familyFreshOptions.length) options = familyFreshOptions;

    const target = difficultyTargetValue(settings.difficultyTarget);
    const currentAnti = currentDraft.filter(isAntiMeta).length;
    const antiNeeded = Math.max(0, settings.minAntiMeta - currentAnti);
    const remainingSlots = 11 - currentDraft.length;
    const tagsAlreadyUsed = new Set(
      currentDraft.flatMap(prompt => (prompt.tags || []).filter(tag => DIVERSITY_TAGS.has(tag)))
    );

    const weighted = options.map(prompt => {
      const difficultyDistance = Math.abs((DIFFICULTY_VALUE[prompt.difficulty] || 2) - target);
      let weight = Math.max(1, Number(prompt.rating) || 3) * (1 / (1 + difficultyDistance));
      if (antiNeeded >= remainingSlots && isAntiMeta(prompt)) weight *= 8;
      else if (antiNeeded > 0 && isAntiMeta(prompt)) weight *= 2;
      const repeatedThemeCount = (prompt.tags || []).filter(tag => DIVERSITY_TAGS.has(tag) && tagsAlreadyUsed.has(tag)).length;
      weight /= 1 + repeatedThemeCount * 1.6;
      if (familyPlan?.recentFamilies?.has(promptFamily(prompt))) weight /= 12;
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
    const target = difficultyTargetValue(settings.difficultyTarget);
    const averageDifficulty = draft.reduce((sum, prompt) => sum + (DIFFICULTY_VALUE[prompt.difficulty] || 2), 0) / draft.length;
    let score = Math.abs(averageDifficulty - target) * 20;
    const antiCount = draft.filter(isAntiMeta).length;
    if (antiCount < settings.minAntiMeta) score += (settings.minAntiMeta - antiCount) * 150;

    const tagCounts = new Map();
    for (const prompt of draft) {
      for (const tag of prompt.tags || []) {
        if (!DIVERSITY_TAGS.has(tag)) continue;
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
      const answerCount = Number(core.getPromptStats(prompt)?.playerCount || 0);
      score += Math.abs(Math.log(Math.max(answerCount, 1)) - Math.log(25)) * 0.8;
    }
    for (const count of tagCounts.values()) if (count > 2) score += (count - 2) * 14;
    return score + Math.random() * 0.25;
  }

  function naivePerfectUpperBound(prompts) {
    return prompts.reduce((sum, prompt) => sum + Number(core.getPromptStats(prompt)?.bestAnswer?.points || 0), 0);
  }

  function calculatePerfectXI(prompts) {
    if (prompts.length !== 11) return { possible: false, reason: "The draft does not contain eleven prompts." };

    const playerIdSet = new Set();
    for (const prompt of prompts) {
      for (const playerId of core.getPromptStats(prompt).bestByPlayer.keys()) playerIdSet.add(playerId);
    }
    const playerIds = [...playerIdSet];
    if (playerIds.length < prompts.length) {
      return { possible: false, reason: "There are not enough different valid footballers to complete the XI." };
    }

    let maximumPoints = 0;
    for (const prompt of prompts) {
      const best = core.getPromptStats(prompt).bestAnswer;
      if (best) maximumPoints = Math.max(maximumPoints, Number(best.points) || 0);
    }

    const recordsBySlot = prompts.map(prompt => {
      const bestByPlayer = core.getPromptStats(prompt).bestByPlayer;
      return playerIds.map(playerId => bestByPlayer.get(playerId) || null);
    });
    const costs = recordsBySlot.map(row => {
      const values = new Float64Array(playerIds.length);
      for (let column = 0; column < playerIds.length; column += 1) {
        const record = row[column];
        values[column] = record ? maximumPoints - Number(record.points || 0) : FORBIDDEN_COST;
      }
      return values;
    });

    const assignment = hungarianMinimumAssignment(costs);
    if (!assignment) return { possible: false, reason: "The score optimiser could not complete the matching." };
    const picks = assignment.map((column, slotIndex) => {
      const record = recordsBySlot[slotIndex][column];
      return record ? { prompt: prompts[slotIndex], record, slotIndex } : null;
    });
    if (picks.some(pick => !pick)) return { possible: false, reason: "No valid eleven-player assignment exists for these prompts." };

    const score = picks.reduce((sum, pick) => sum + Number(pick.record.points || 0), 0);
    const naiveScore = naivePerfectUpperBound(prompts);
    return { possible: true, score, naiveScore, uniquenessCost: naiveScore - score, picks };
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

  function validateChallenge(challenge, perfect, settings, exactPlan, familyPlan) {
    const issues = [];
    const prompts = challenge.prompts || [];
    if (prompts.length !== 11) issues.push("Challenge does not contain 11 prompts.");
    const uniqueIds = new Set(prompts.map(prompt => prompt.id));
    if (uniqueIds.size !== prompts.length) issues.push("A prompt is repeated inside the XI.");

    const formation = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    prompts.forEach(prompt => { if (formation[prompt.position] != null) formation[prompt.position] += 1; });
    const requiredFormation = challenge.formationCounts || settings.formation?.counts || FORMATIONS["4-4-2"].counts;
    for (const [position, required] of Object.entries(requiredFormation)) {
      if (formation[position] !== required) issues.push(`${challenge.formation || "Selected formation"} requires ${required} ${position} prompt${required === 1 ? "" : "s"}.`);
    }

    const exactRotationConflicts = prompts.filter(prompt => !exactPlanAllows(prompt, exactPlan));
    if (exactRotationConflicts.length) issues.push(`${exactRotationConflicts.length} prompt(s) break the exact-prompt rotation.`);
    if (!satisfiesExactRotationRequirements(prompts, exactPlan)) issues.push("The XI skipped a prompt that had to finish the current exact-prompt cycle.");
    const familyConflicts = prompts.filter(prompt =>
      !familyPlan.relaxedPositions.has(prompt.position) && familyPlan.recentFamilies.has(promptFamily(prompt))
    );
    if (familyConflicts.length) issues.push(`${familyConflicts.length} prompt(s) break the ${familyPlan.cooldownDays}-day prompt-family cooldown.`);
    if (prompts.filter(isAntiMeta).length < settings.minAntiMeta) issues.push("Minimum anti-meta prompt target was not met.");

    for (const prompt of prompts) {
      const count = Number(core.getPromptStats(prompt)?.playerCount || 0);
      if (count < settings.minAnswers || count > settings.maxAnswers) {
        issues.push(`${prompt.id} has ${count} valid players, outside the configured range.`);
        break;
      }
    }

    if (!perfect?.possible) issues.push(perfect?.reason || "Exact perfect XI could not be calculated.");
    if (settings.maxPerfectScore > 0 && Number(perfect?.score || 0) > settings.maxPerfectScore) {
      issues.push(`Perfect score ${Number(perfect.score).toLocaleString()} exceeds the ${settings.maxPerfectScore.toLocaleString()} ceiling.`);
    }
    return issues;
  }

  function buildChallengeSource(challenge) {
    const promptsCode = challenge.prompts.map(prompt => {
      const testSource = typeof prompt.test === "function" ? prompt.test.toString() : "p => false";
      return `    {\n      id: ${JSON.stringify(prompt.id)},\n      family: ${JSON.stringify(promptFamily(prompt))},\n      position: ${JSON.stringify(prompt.position)},\n      label: ${JSON.stringify(prompt.label)},\n      fail: ${JSON.stringify(prompt.fail)},\n      test: ${testSource}\n    }`;
    }).join(",\n");

    return `/* Generated by FPL Challenge Studio — Seven-Day Calendar.\n   Release date: ${challenge.releaseDate} (Europe/London)\n   Exact perfect score calculated with eleven unique footballers. */\nwindow.FPL_DAILY_CHALLENGE = {\n  id: ${JSON.stringify(challenge.id)},\n  number: ${challenge.number},\n  title: ${JSON.stringify(challenge.title)},\n  dateLabel: ${JSON.stringify(challenge.dateLabel)},\n  difficulty: ${JSON.stringify(challenge.difficulty)},\n  releaseDate: ${JSON.stringify(challenge.releaseDate)},\n  formation: ${JSON.stringify(challenge.formation || "4-4-2")},\n  formationCounts: ${JSON.stringify(challenge.formationCounts || FORMATIONS["4-4-2"].counts)},\n  theme: ${JSON.stringify(challenge.theme || "Generated Mix")},\n  perfectScore: ${challenge.perfectScore},\n  prompts: [\n${promptsCode}\n  ]\n};\n`;
  }

  function buildLeaderboardVerifier(result) {
    const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
    const records = [];
    for (const player of players) {
      for (const season of player.seasons || []) {
        const record = Object.assign(Object.create(season), {
          playerId: player.playerId,
          playerName: player.name,
          name: player.name
        });
        records.push(record);
      }
    }
    const prompts = (result.prompts || []).map(prompt => {
      const allowed = [];
      for (const record of records) {
        if (record.position !== prompt.position || Number(record.minutes) <= 0) continue;
        let valid = false;
        try { valid = Boolean(prompt.test(record)); } catch {}
        if (!valid) continue;
        allowed.push({
          playerId: record.playerId,
          season: record.season,
          points: Number(record.points) || 0
        });
      }
      allowed.sort((left, right) => right.points - left.points || String(left.playerId).localeCompare(String(right.playerId)) || String(left.season).localeCompare(String(right.season)));
      return {
        promptId: prompt.id,
        position: prompt.position,
        allowedCount: allowed.length,
        bestPoints: allowed[0]?.points || 0,
        allowed
      };
    });
    return {
      version: 1,
      challengeId: result.id,
      challengeNumber: Number(result.number) || 0,
      releaseDate: result.releaseDate,
      title: result.title,
      formation: result.formation || "4-4-2",
      formationCounts: result.formationCounts || FORMATIONS["4-4-2"].counts,
      theme: result.theme || "Generated Mix",
      perfectScore: Number(result.perfectScore) || 0,
      calculatedPerfectScore: Number(result.perfect?.score) || 0,
      perfectScoreVerified: Number(result.perfect?.score) === Number(result.perfectScore),
      prompts,
      perfectXi: Array.isArray(result.perfect?.picks) ? result.perfect.picks.map(pick => ({
        promptId: pick.prompt.id,
        playerId: pick.record.playerId,
        season: pick.record.season,
        points: Number(pick.record.points) || 0
      })) : []
    };
  }

  function buildLeaderboardVerifierJson(result) {
    return JSON.stringify(buildLeaderboardVerifier(result), null, 2) + "\n";
  }

  function sqlLiteral(value) {
    return `'${String(value ?? "").replace(/'/g, "''")}'`;
  }

  function buildLeaderboardVerifierSql(results) {
    const verifiers = results.map(buildLeaderboardVerifier);
    if (!verifiers.length) return "-- No leaderboard verifiers were generated.\n";
    const firstDate = verifiers[0].releaseDate;
    const lastDate = verifiers[verifiers.length - 1].releaseDate;
    const activeIds = verifiers.map(verifier => sqlLiteral(verifier.challengeId)).join(", ");
    const statements = [
      "-- FPL Draft Challenge — PRIVATE leaderboard verifier seed",
      `-- ${firstDate} to ${lastDate}`,
      "-- Run this in Supabase SQL Editor AFTER the dated challenge files are generated.",
      "-- DO NOT commit or upload this file to the public GitHub repository.",
      "",
      "begin;",
      "",
      "update public.leaderboard_verifiers",
      "set active = false, updated_at = now()",
      `where release_date between ${sqlLiteral(firstDate)} and ${sqlLiteral(lastDate)}`,
      `  and challenge_id not in (${activeIds});`,
      ""
    ];
    for (const verifier of verifiers) {
      const payload = JSON.stringify(verifier);
      statements.push(
        "insert into public.leaderboard_verifiers",
        "  (challenge_id, release_date, challenge_number, title, perfect_score, payload, active, updated_at)",
        `values (${sqlLiteral(verifier.challengeId)}, ${sqlLiteral(verifier.releaseDate)}, ${Number(verifier.challengeNumber) || 0}, ${sqlLiteral(verifier.title)}, ${Number(verifier.perfectScore) || 0}, $fpl$${payload}$fpl$::jsonb, true, now())`,
        "on conflict (challenge_id) do update set",
        "  release_date = excluded.release_date,",
        "  challenge_number = excluded.challenge_number,",
        "  title = excluded.title,",
        "  perfect_score = excluded.perfect_score,",
        "  payload = excluded.payload,",
        "  active = true,",
        "  updated_at = now();",
        ""
      );
    }
    statements.push(
      "commit;",
      "",
      `-- Sanity check: should return ${verifiers.length} active row${verifiers.length === 1 ? "" : "s"}.`,
      "select release_date, challenge_number, challenge_id, perfect_score, active",
      "from public.leaderboard_verifiers",
      `where release_date between ${sqlLiteral(firstDate)} and ${sqlLiteral(lastDate)} and active = true`,
      "order by release_date;",
      ""
    );
    return statements.join("\n");
  }

  function buildMergedManifest(existingEntries, results, settings) {
    const replacementDates = new Set(results.map(result => result.releaseDate));
    const merged = existingEntries
      .filter(entry => entry.date && !replacementDates.has(entry.date))
      .map(entry => ({ ...entry }));
    for (const result of results) merged.push(manifestEntryForResult(result));
    merged.sort((left, right) => String(left.date).localeCompare(String(right.date)));
    return {
      version: Math.max(2, Number(window.FPL_CHALLENGE_MANIFEST?.version || 1) + 1),
      timezone: LONDON_TIMEZONE,
      fallbackPath: window.FPL_CHALLENGE_MANIFEST?.fallbackPath || "todays-challenge.js",
      rotationPolicy: {
        version: ROTATION_POLICY_VERSION,
        exactPromptRotation: "full-compatible-position-cycle",
        familyCooldownDays: Number(settings?.cooldownChallenges) || 7,
        familyScope: "position-scoped-template-family",
        familyFallback: "relax-family-only-when-required"
      },
      challenges: merged
    };
  }

  function manifestEntryForResult(result) {
    return {
      date: result.releaseDate || result.date,
      path: `challenges/${result.releaseDate || result.date}.js`,
      id: result.id,
      number: Number(result.number) || 0,
      title: result.title || "",
      difficulty: result.difficulty || "Mixed",
      formation: result.formation || "4-4-2",
      formationCounts: result.formationCounts || FORMATIONS["4-4-2"].counts,
      theme: result.theme || "Generated Mix",
      perfectScore: Number(result.perfectScore) || 0,
      promptIds: Array.isArray(result.promptIds) ? [...result.promptIds] : [],
      promptFamilies: Array.isArray(result.promptFamilies)
        ? [...result.promptFamilies]
        : Array.isArray(result.prompts) ? result.prompts.map(promptFamily) : [],
      familyCooldownRelaxedPositions: Array.isArray(result.familyCooldownRelaxedPositions)
        ? [...result.familyCooldownRelaxedPositions]
        : []
    };
  }

  function buildManifestSource(manifest) {
    return `/* FPL Daily Challenge calendar manifest.\n   Generated by Challenge Studio Seven-Day Calendar.\n   Upload dated challenge files first, then replace this manifest last. */\nwindow.FPL_CHALLENGE_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`;
  }

  function getManifestEntries() {
    return Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges)
      ? window.FPL_CHALLENGE_MANIFEST.challenges.map(entry => ({
          ...entry,
          promptIds: Array.isArray(entry.promptIds) ? [...entry.promptIds] : [],
          promptFamilies: Array.isArray(entry.promptFamilies) ? [...entry.promptFamilies] : [],
          familyCooldownRelaxedPositions: Array.isArray(entry.familyCooldownRelaxedPositions) ? [...entry.familyCooldownRelaxedPositions] : []
        }))
      : [];
  }

  function renderBatchReview() {
    if (!batchResults.length) {
      renderEmptyReview();
      return;
    }

    const rows = batchResults.map(result => {
      const statusClass = result.status === "PASS" ? "batch-pass" : "batch-fail";
      const issueText = result.issues?.length ? escapeHtml(result.issues.join(" · ")) : "Validated";
      return `<tr>
        <td><strong>${escapeHtml(shortDay(result.releaseDate || result.date))}</strong><span>${escapeHtml(result.releaseDate || result.date)}</span></td>
        <td><strong>${escapeHtml(longChallengeDate(result.releaseDate || result.date))}</strong><span>${escapeHtml(result.theme || "Generated Mix")}</span></td>
        <td>${escapeHtml(result.difficulty || "—")}</td>
        <td><strong>${escapeHtml(result.formation || "4-4-2")}</strong><span>${escapeHtml(result.theme || "Generated Mix")}</span></td>
        <td>${result.perfectScore ? Number(result.perfectScore).toLocaleString() : "—"}</td>
        <td>${Number(result.antiMetaCount) || 0}/11</td>
        <td><span class="batch-status ${statusClass}">${escapeHtml(result.status || "—")}</span><small>${issueText}</small></td>
      </tr>`;
    }).join("");

    elements.review.innerHTML = `<div class="batch-table-wrap"><table class="batch-table">
      <thead><tr><th>Date</th><th>Challenge</th><th>Difficulty</th><th>Formation</th><th>Perfect</th><th>Anti-meta</th><th>Validation</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function renderEmptyReview() {
    elements.review.innerHTML = `<div class="batch-empty"><strong>No seven-day batch generated yet.</strong><span>The review table will show each date, exact perfect score and validation result before the ZIP unlocks.</span></div>`;
  }

  function invalidateBatch() {
    if (!batchResults.length && !batchManifest) return;
    ++generationToken;
    batchResults = [];
    batchManifest = null;
    if (elements.downloadButton) elements.downloadButton.disabled = true;
    renderEmptyReview();
    setStatus("Settings changed. Generate the seven-day batch again before downloading.", "neutral");
  }

  function clearBatch(updateStatus = true) {
    ++generationToken;
    batchResults = [];
    batchManifest = null;
    if (elements.downloadButton) elements.downloadButton.disabled = true;
    renderEmptyReview();
    if (updateStatus) setStatus("Seven-day review cleared. Nothing on the live site was changed.", "neutral");
  }

  function downloadSevenDayBatch() {
    if (batchResults.length !== DAYS_IN_BATCH || batchResults.some(result => result.status !== "PASS") || !batchManifest) {
      setStatus("The ZIP is locked until all seven dated challenges pass validation.", "fail");
      return;
    }
    const zipBuilder = window.FPL_STUDIO_PHASE6?.buildZipBlob;
    if (typeof zipBuilder !== "function") {
      setStatus("Studio ZIP support is unavailable. Reload admin.html and try again.", "fail");
      return;
    }

    const manifestSource = buildManifestSource(batchManifest);
    const originalManifest = window.FPL_CHALLENGE_MANIFEST
      ? buildManifestSource({
          version: Number(window.FPL_CHALLENGE_MANIFEST.version || 1),
          timezone: window.FPL_CHALLENGE_MANIFEST.timezone || LONDON_TIMEZONE,
          fallbackPath: window.FPL_CHALLENGE_MANIFEST.fallbackPath || "todays-challenge.js",
          challenges: getManifestEntries()
        })
      : "/* No challenge manifest was loaded before this batch was generated. */\n";

    const files = batchResults.map(result => ({
      name: `UPLOAD/challenges/${result.releaseDate}.js`,
      content: ensureTrailingNewline(result.source)
    }));
    for (const result of batchResults) {
      files.push({
        name: `BACKEND/verifiers/${result.releaseDate}.json`,
        content: buildLeaderboardVerifierJson(result)
      });
    }
    files.push({
      name: `BACKEND/PRIVATE-Supabase-leaderboard-verifiers-${batchResults[0].releaseDate}-to-${batchResults[batchResults.length - 1].releaseDate}.sql`,
      content: buildLeaderboardVerifierSql(batchResults)
    });
    files.push(
      { name: "UPLOAD/challenges/manifest.js", content: manifestSource },
      { name: "BACKUPS/manifest-before-batch.js", content: originalManifest },
      { name: "REVIEW/seven-day-batch-report.json", content: buildBatchReport() },
      { name: "README-UPLOAD.txt", content: buildReadme() }
    );

    const blob = zipBuilder(files);
    const filename = `fpl-seven-day-calendar-${batchResults[0].releaseDate}-to-${batchResults[batchResults.length - 1].releaseDate}.zip`;
    downloadBlob(filename, blob);
    setStatus(`${filename} downloaded. Upload the seven dated files first, manifest.js last, then run the PRIVATE Supabase verifier SQL from BACKEND.`, "pass");
  }

  function buildBatchReport() {
    const settings = settingsFromUi();
    return JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      timezone: LONDON_TIMEZONE,
      allPassed: batchResults.length === DAYS_IN_BATCH && batchResults.every(result => result.status === "PASS"),
      settings,
      challenges: batchResults.map(result => ({
        date: result.releaseDate,
        id: result.id,
        number: result.number,
        title: result.title,
        difficulty: result.difficulty,
        formation: result.formation,
        formationCounts: result.formationCounts,
        theme: result.theme,
        perfectScore: result.perfectScore,
        antiMetaCount: result.antiMetaCount,
        promptIds: result.promptIds,
        status: result.status,
        issues: result.issues
      }))
    }, null, 2) + "\n";
  }

  function buildReadme() {
    const first = batchResults[0];
    const last = batchResults[batchResults.length - 1];
    return [
      "FPL DRAFT CHALLENGE — SEVEN-DAY CALENDAR PACKAGE",
      "=================================================",
      "",
      `Schedule: ${first.releaseDate} to ${last.releaseDate}`,
      `Timezone: ${LONDON_TIMEZONE}`,
      `Challenges: ${longChallengeDate(first.releaseDate)} to ${longChallengeDate(last.releaseDate)}`,
      `Formation: ${first.formation || "4-4-2"}`,
      `Theme: ${first.theme || "Generated Mix"}`,
      "",
      "UPLOAD ORDER",
      "------------",
      "1. Phase 1 (Challenge Calendar + UK midnight loader) must already be uploaded.",
      "2. Extract this ZIP.",
      "3. Open UPLOAD/challenges/.",
      "4. Upload ALL seven YYYY-MM-DD.js files into the repository challenges/ folder.",
      "5. Upload challenges/manifest.js LAST, replacing the existing manifest.",
      "6. Commit the changes and wait for GitHub Pages to publish.",
      "7. Open BACKEND/PRIVATE-Supabase-leaderboard-verifiers-<dates>.sql.",
      "8. Run that PRIVATE SQL file in Supabase SQL Editor so the live leaderboard verifier matches the newly published challenges.",
      "9. Confirm the SQL sanity check returns one active verifier row per published date.",
      "10. Hard-refresh the live page and confirm both the scheduled challenge/countdown and leaderboard are healthy.",
      "",
      "WHY THE SUPABASE SQL STEP MATTERS",
      "---------------------------------",
      "The browser and leaderboard backend must use the same challenge ID, prompts and perfect score. Publishing a regenerated challenge batch without reseeding the private verifier makes the website leaderboard reject starts or submissions even when the API itself is online.",
      "",
      "WHY MANIFEST.JS IS LAST",
      "-----------------------",
      "The manifest tells the live game which dated file to load. Uploading the dated files first prevents a temporary broken challenge while GitHub Pages is publishing.",
      "",
      "DO NOT upload the ZIP itself. GitHub Pages will not extract it.",
      "DO NOT replace players.js, prompt-library.js or admin-core.js for this weekly publishing step.",
      "",
      "The REVIEW folder contains the generation/validation report. BACKUPS contains the manifest that Studio saw before this batch was built. BACKEND contains private leaderboard verifier JSON plus a ready-to-run Supabase SQL seed; NEVER upload any BACKEND verifier files to public GitHub Pages.",
      ""
    ].join("\n");
  }

  function displayDifficultyFor(prompts) {
    const counts = { easy: 0, medium: 0, hard: 0 };
    prompts.forEach(prompt => { counts[prompt.difficulty] = (counts[prompt.difficulty] || 0) + 1; });
    if (counts.hard >= 6) return "Medium / Hard";
    if (counts.easy >= 6) return "Easy / Medium";
    return "Mixed";
  }

  function difficultyTargetValue(value) {
    if (value === "easy") return 1.35;
    if (value === "hard") return 2.65;
    return 2;
  }

  function isAntiMeta(prompt) {
    return Array.isArray(prompt?.tags) && prompt.tags.includes("anti-meta");
  }

  function londonDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function addDaysIso(isoDate, amount) {
    if (!isIsoDate(isoDate)) return "";
    const [year, month, day] = isoDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + amount));
    return date.toISOString().slice(0, 10);
  }

  function friendlyDate(isoDate) {
    if (!isIsoDate(isoDate)) return isoDate || "—";
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" })
      .format(new Date(Date.UTC(year, month - 1, day, 12)));
  }

  function longChallengeDate(isoDate) {
    if (!isIsoDate(isoDate)) return isoDate || "—";
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, month - 1, day, 12)));
  }

  function shortDay(isoDate) {
    if (!isIsoDate(isoDate)) return "—";
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  }

  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
  }

  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
  }

  function ensureTrailingNewline(value) {
    return String(value || "").replace(/\s*$/, "\n");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
  }

  function setStatus(message, state = "neutral") {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.dataset.state = state;
  }

  function yieldToBrowser() {
    return new Promise(resolve => window.setTimeout(resolve, 0));
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.FPL_STUDIO_BATCH_CALENDAR = Object.freeze({
    generate: generateSevenDayBatch,
    clear: clearBatch,
    getResults: () => batchResults.map(result => ({
      date: result.releaseDate,
      id: result.id,
      number: result.number,
      formation: result.formation,
      formationCounts: result.formationCounts,
      theme: result.theme,
      perfectScore: result.perfectScore,
      status: result.status,
      promptIds: [...(result.promptIds || [])],
      promptFamilies: [...(result.promptFamilies || [])],
      familyCooldownRelaxedPositions: [...(result.familyCooldownRelaxedPositions || [])]
    })),
    getManifest: () => batchManifest ? JSON.parse(JSON.stringify(batchManifest)) : null,
    getSources: () => batchResults.filter(result => result.source).map(result => ({ date: result.releaseDate, source: result.source })),
    addDaysIso,
    londonDateKey,
    formations: FORMATIONS,
    themePresets: THEME_PRESETS,
    formationSequence,
    promptFamily
  });
})();
