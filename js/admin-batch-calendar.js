/* FPL Challenge Studio — Theme & Formation Engine v3.7.0: leader-preplanned date-identified seven-day challenge calendar generator.
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
  const MIX_STAT_TAGS = new Set([
    "points", "goals", "assists", "goal-involvements", "minutes", "clean-sheets", "saves",
    "bonus", "cards", "discipline", "budget", "starting-price", "final-price", "exact-stat",
    "penalties-saved", "penalties-missed", "age", "young", "veteran"
  ]);
  const MIX_CONTEXT_TAGS = new Set([
    "relegated", "promoted", "bottom-half", "bottomhalf", "mid-table", "survival",
    "outside-big-six", "outside-top-four", "manager", "teammate", "club-season",
    "season-rule", "season-exact", "season-before", "season-after", "season-between",
    "career-total", "career-seasons", "career-clubs", "career-overlap", "returned-club", "played-for-both"
  ]);
  const DAILY_PROMPT_MIX_TARGET = Object.freeze({ nationality: 1, stats: 4, context: 2, maxName: 2 });
  const NATIONALITY_RESERVATION_POLICY_VERSION = 1;
  const CERTIFIED_PROMPT_POOL_ONLY_POLICY_VERSION = 1;
  const CERTIFIED_SNAPSHOT_SOURCE_POLICY_VERSION = 1;
  const EXACT_ROTATION_REPLAY_POLICY_VERSION = 2;
  const ROTATION_POLICY_VERSION = 1;
  const SEMANTIC_DIVERSITY_POLICY_VERSION = 1;
  const FORBIDDEN_COST = 1_000_000;
  const LONDON_TIMEZONE = "Europe/London";
  const MAX_CANDIDATES_PER_DAY = 650;
  const MAX_EXACT_CAP_CHECKS = 90;
  const WEEK_LAYOUT_ATTEMPTS = 6;
  const LEADER_PREPLAN_ATTEMPTS = 90;

  const core = window.FPL_STUDIO_API;
  if (!core) return;

  const elements = {
    startDate: document.querySelector("#batchStartDate"),
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
  let lastLeaderLayoutPolicy = null;
  let lastLeaderPreplan = null;

  initialise();

  function initialise() {
    const manifestEntries = getManifestEntries();

    if (elements.startDate && !elements.startDate.value) {
      const singleReleaseDate = document.querySelector("#releaseDate")?.value;
      elements.startDate.value = isIsoDate(singleReleaseDate) ? singleReleaseDate : addDaysIso(londonDateKey(), 1);
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
      elements.startDate, elements.challengeName, elements.difficultyTarget,
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
    lastLeaderLayoutPolicy = null;
    lastLeaderPreplan = null;
    const token = ++generationToken;
    const settings = settingsFromUi();
    const startDate = elements.startDate?.value;
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

    const generationSnapshot = Array.isArray(window.FPL_DAILY_GENERATION_PROMPT_POOL)
      ? window.FPL_DAILY_GENERATION_PROMPT_POOL
      : null;
    const apiLibrary = core.getPromptLibrary?.();
    const globalLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
    // Guarded Daily Challenge generation owns an immutable certified snapshot. Prefer it over
    // every mutable Studio/global prompt collection so late prompt-pack events cannot change
    // an in-progress week. Outside guarded generation, the Studio API remains authoritative.
    const promptSource = generationSnapshot || (Array.isArray(apiLibrary) ? apiLibrary : globalLibrary);
    const promptLibrary = [...new Map(promptSource.filter(prompt => prompt?.id).map(prompt => [String(prompt.id), prompt])).values()];
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
    // Guarded generation already chose the immutable weekly reservoir using authoritative
    // Supabase/GitHub/browser history, with the most recent source IDs ordered last. Do not
    // hard-block a prompt after certification, or the 77-prompt reservoir can become impossible
    // to consume. Legacy unguarded generation keeps the older browser/live freshness block.
    const extraBlockedIds = generationSnapshot
      ? new Set()
      : settings.avoidRecent
        ? new Set(window.FPL_STUDIO_PHASE3?.getCooldownPromptIds?.() || [])
        : new Set();
    if (settings.avoidRecent && !generationSnapshot) {
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
    let rotationState = generationSnapshot
      ? buildWeeklyReservoirRotationState(basePools)
      : buildExactRotationState(virtualSchedule, startDate, basePools, promptById);
    let weeklyLeaderDays = new Map();
    const virtualScheduleBaselineLength = virtualSchedule.length;
    const layoutAttempts = Array.from({ length: WEEK_LAYOUT_ATTEMPTS }, (_, index) => ({
      strictLeaderCap: true,
      plannerSalt: index
    }));
    let layoutCompleted = false;
    let lastLayoutFailure = "";

    try {
      for (let layoutAttemptIndex = 0; layoutAttemptIndex < layoutAttempts.length; layoutAttemptIndex += 1) {
        const layoutAttempt = layoutAttempts[layoutAttemptIndex];
        if (layoutAttemptIndex > 0) {
          batchResults = [];
          virtualSchedule.splice(virtualScheduleBaselineLength);
          rotationState = generationSnapshot
            ? buildWeeklyReservoirRotationState(basePools)
            : buildExactRotationState(virtualSchedule, startDate, basePools, promptById);
          weeklyLeaderDays = new Map();
          renderBatchReview();
          setStatus(`Retrying weekly layout ${layoutAttemptIndex + 1}/${layoutAttempts.length} · rebuilding the hard max-3 leader pre-plan…`, "working");
          await yieldToBrowser();
        }
        let attemptFailed = false;
        const planningPrompts = generationSnapshot
          ? [...new Map(Object.values(basePools).flat().map(prompt => [String(prompt.id), prompt])).values()]
          : null;
        const leaderPreplan = planningPrompts
          ? buildLeaderDayPreplan(planningPrompts, requiredFormation, settings, layoutAttempt.plannerSalt)
          : null;
        if (leaderPreplan && !leaderPreplan.ok) {
          lastLayoutFailure = leaderPreplan.reason;
          if (leaderPreplan.terminal) break;
          continue;
        }
        if (leaderPreplan?.audit) lastLeaderPreplan = leaderPreplan.audit;

        for (let dayIndex = 0; dayIndex < DAYS_IN_BATCH; dayIndex += 1) {
        if (token !== generationToken) return;
        const date = batchDates[dayIndex];
        const futureReservedIds = getFutureReservedPromptIds(virtualSchedule, date);
        const exactPlan = buildExactRotationPlan({
          rotationState,
          basePools,
          requiredFormation,
          extraBlockedIds,
          futureReservedIds
        });
        const plannedPromptIds = leaderPreplan?.dayPromptIds?.[dayIndex] || null;
        const dayBasePools = filterBasePoolsForIds(basePools, plannedPromptIds);
        const familyPlan = buildFamilyCooldownPlan({
          schedule: virtualSchedule,
          date,
          cooldownDays: settings.cooldownChallenges,
          promptById,
          basePools: dayBasePools,
          exactPlan,
          requiredFormation
        });

        setStatus(`Generating ${dayIndex + 1}/${DAYS_IN_BATCH} · ${friendlyDate(date)} · exact rotation + ${settings.cooldownChallenges}-day family cooldown…`, "working");
        await yieldToBrowser();

        const promptMixPlan = buildPromptMixQuotaPlan({ basePools: dayBasePools, exactPlan, familyPlan });
        const generated = await generateCandidateForDay({
          basePools: dayBasePools,
          settings,
          requiredFormation,
          formationSlots,
          exactPlan,
          familyPlan,
          promptMixPlan,
          weeklyLeaderDays,
          strictLeaderCap: true,
          dayIndex,
          date,
          token
        });

        if (token !== generationToken) return;
        if (!generated.ok) {
          lastLayoutFailure = `${friendlyDate(date)}: ${generated.reason}`;
          attemptFailed = true;
          break;
        }

        const prompts = generated.prompts;
        const perfect = generated.perfect;
        const difficulty = displayDifficultyFor(prompts);
        const challenge = {
          id: `daily-${date}`,
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
        const validation = validateChallenge(challenge, perfect, settings, exactPlan, familyPlan, promptMixPlan, generated.quotaRelaxed);
        const source = buildChallengeSource(challenge);

        const result = {
          ...challenge,
          promptIds: prompts.map(prompt => prompt.id),
          promptFamilies: prompts.map(promptFamily),
          antiMetaCount: prompts.filter(isAntiMeta).length,
          promptMix: promptMixCounts(prompts),
          promptMixTarget: { ...promptMixPlan },
          promptMixQuotaRelaxed: Boolean(generated.quotaRelaxed),
          familyCooldownRelaxedPositions: [...familyPlan.relaxedPositions],
          perfect,
          source,
          status: validation.length ? "FAIL" : "PASS",
          issues: validation
        };
        batchResults.push(result);
        if (!validation.length) {
          commitExactRotationSelection(rotationState, exactPlan, prompts, basePools);
          commitWeeklyLeaderDays(prompts, weeklyLeaderDays, dayIndex);
        }
        virtualSchedule.push(manifestEntryForResult(result));
        renderBatchReview();

        if (validation.length) {
          lastLayoutFailure = `${friendlyDate(date)}: final validation failed: ${validation[0]}`;
          attemptFailed = true;
          break;
        }

        setStatus(`Generated ${dayIndex + 1}/${DAYS_IN_BATCH} · ${friendlyDate(date)} · perfect ${perfect.score.toLocaleString()} · PASS`, "working");
        await yieldToBrowser();
        }

        if (!attemptFailed && batchResults.length === DAYS_IN_BATCH && batchResults.every(result => result.status === "PASS")) {
          layoutCompleted = true;
          lastLeaderLayoutPolicy = Object.freeze({
            strictLeaderCap: true,
            attempt: layoutAttemptIndex + 1,
            totalAttemptsAvailable: layoutAttempts.length,
            preplanned: Boolean(leaderPreplan)
          });
          break;
        }
        if (!attemptFailed) lastLayoutFailure = "The weekly layout ended before all seven dated challenges were produced.";
      }

      if (!layoutCompleted) {
        batchResults = [];
        virtualSchedule.splice(virtualScheduleBaselineLength);
        renderBatchReview();
        setStatus(`Batch layout failed after ${layoutAttempts.length} complete arrangement attempts. ${lastLayoutFailure}`, "fail");
        return;
      }

      batchManifest = buildMergedManifest(repositoryManifestEntries(), batchResults, settings);
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

  function promptTags(prompt) {
    return Array.isArray(prompt?.tags) ? prompt.tags : [];
  }

  function isNationalityPrompt(prompt) {
    const family = String(prompt?.family || "").toLowerCase();
    return family.includes("nationality") || promptTags(prompt).some(tag => tag === "nationality" || String(tag).startsWith("country-"));
  }

  function isNameRulePrompt(prompt) {
    const family = String(prompt?.family || "").toLowerCase();
    return family.includes("name:") || promptTags(prompt).some(tag => FAMILY_NAME_TAGS.has(tag));
  }

  function isStatMixPrompt(prompt) {
    const tags = promptTags(prompt);
    if (tags.some(tag => MIX_STAT_TAGS.has(tag))) return true;
    const family = String(promptFamily(prompt) || "").toLowerCase();
    return [...MIX_STAT_TAGS].some(tag => family.includes(tag));
  }

  function isContextMixPrompt(prompt) {
    const tags = promptTags(prompt);
    if (tags.some(tag => MIX_CONTEXT_TAGS.has(tag))) return true;
    const family = String(promptFamily(prompt) || "").toLowerCase();
    return family.includes("season:") || family.includes("career:") || family.includes("manager") || family.includes("teammate");
  }

  function promptMixCounts(prompts) {
    return {
      nationality: prompts.filter(isNationalityPrompt).length,
      stats: prompts.filter(isStatMixPrompt).length,
      context: prompts.filter(isContextMixPrompt).length,
      name: prompts.filter(isNameRulePrompt).length
    };
  }

  function promptMixMeets(counts, plan) {
    return counts.nationality === plan.nationality && counts.stats >= plan.stats && counts.context >= plan.context && counts.name <= plan.maxName;
  }

  function buildPromptMixQuotaPlan({ basePools, exactPlan, familyPlan }) {
    const exactEligible = Object.values(basePools).flat().filter(prompt => exactPlanAllows(prompt, exactPlan));
    const eligible = exactEligible.filter(prompt => familyPlanAllows(prompt, familyPlan));
    const nationalityExactAvailable = exactEligible.filter(isNationalityPrompt).length;
    const nationalityAvailable = eligible.filter(isNationalityPrompt).length;
    const statAvailable = eligible.filter(isStatMixPrompt).length;
    const contextAvailable = eligible.filter(isContextMixPrompt).length;
    const nonNameAvailable = eligible.filter(prompt => !isNameRulePrompt(prompt)).length;
    return {
      // Nationality is deliberately hard. Never lower the daily target to zero just because
      // another soft constraint temporarily hides nationality options.
      nationality: DAILY_PROMPT_MIX_TARGET.nationality,
      nationalityAvailable,
      nationalityExactAvailable,
      stats: Math.min(DAILY_PROMPT_MIX_TARGET.stats, statAvailable),
      context: Math.min(DAILY_PROMPT_MIX_TARGET.context, contextAvailable),
      maxName: nonNameAvailable >= 9 ? DAILY_PROMPT_MIX_TARGET.maxName : 11,
      eligible: eligible.length
    };
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

  function buildWeeklyReservoirRotationState(basePools) {
    // The guarded Daily flow has already selected a fresh immutable 77-prompt reservoir for
    // this week. Cross-week unused/cycle decisions belong to the guard; replaying historical
    // schedule rows against this new reservoir creates false bridge backlogs. Start the weekly
    // consumption cycle at zero and let the seven generated days consume every reservoir prompt once.
    return Object.fromEntries(
      Object.keys(basePools).map(position => [position, { cycle: 1, usedIds: new Set() }])
    );
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

        // The current library can be larger than the library that existed when old challenges
        // were generated. A repeat before every current ID has appeared proves that the old
        // rotation already rolled over under that earlier pool. Treat the repeat as the start
        // of the next reconstructed cycle; otherwise newly-added prompts become a false backlog
        // and can all be forced into one day at the bridge boundary.
        if (positionState.usedIds.has(promptId)) {
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
      let available = basePools[position].filter(prompt => !extraBlockedIds.has(prompt.id) && !futureReservedIds.has(prompt.id));
      // Browser/live freshness is a soft guard. If it removes every nationality option for a
      // position, restore nationality prompts that are not reserved by a future scheduled day.
      // Exact-cycle usage still remains hard because `unused` is calculated afterwards.
      if (!available.some(isNationalityPrompt)) {
        const nationalityFreshnessFallback = basePools[position].filter(prompt =>
          isNationalityPrompt(prompt) && !futureReservedIds.has(prompt.id)
        );
        if (nationalityFreshnessFallback.length) {
          available = [...new Map([...available, ...nationalityFreshnessFallback].map(prompt => [prompt.id, prompt])).values()];
        }
      }
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

  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, promptMixPlan, weeklyLeaderDays, strictLeaderCap = true, dayIndex, date, token }) {
    const exactNationality = Object.values(basePools).flat().filter(prompt =>
      isNationalityPrompt(prompt)
      && exactPlanAllows(prompt, exactPlan)
      && Number(requiredFormation[prompt.position] || 0) > 0
    );
    if (!exactNationality.length) {
      return { ok: false, reason: "Exact prompt rotation leaves no nationality prompt available for this day. The weekly nationality quota cannot be relaxed." };
    }

    const requiredNationality = exactNationality.filter(prompt =>
      exactPlan[prompt.position]?.mustUseIds?.has(prompt.id)
    );
    if (requiredNationality.length > DAILY_PROMPT_MIX_TARGET.nationality) {
      return { ok: false, reason: "Exact prompt rotation currently forces more than one nationality prompt into the same day. The guarded weekly reservoir must start from a fresh weekly rotation; reload Studio if this persists." };
    }
    if (requiredNationality.length === 1 && !familyPlanAllows(requiredNationality[0], familyPlan)) {
      const position = requiredNationality[0].position;
      familyPlan.relaxedPositions.add(position);
      familyPlan.allowedFamiliesByPosition[position] = null;
    }

    let nationalityOptions = requiredNationality.length
      ? requiredNationality
      : exactNationality.filter(prompt => familyPlanAllows(prompt, familyPlan));
    if (!nationalityOptions.length) {
      // Family cooldown is explicitly the soft rule in this generator. Relax it only because
      // the hard one-nationality-per-day requirement otherwise has no candidate.
      for (const position of new Set(exactNationality.map(prompt => prompt.position))) {
        familyPlan.relaxedPositions.add(position);
        familyPlan.allowedFamiliesByPosition[position] = null;
      }
      nationalityOptions = [...exactNationality];
    }

    nationalityOptions = nationalityOptions.filter(reserved => {
      for (const [position, required] of Object.entries(requiredFormation)) {
        const compatible = basePools[position].filter(prompt =>
          exactPlanAllows(prompt, exactPlan)
          && familyPlanAllows(prompt, familyPlan)
          && (prompt.id === reserved.id || !isNationalityPrompt(prompt))
        );
        if (compatible.length < required) return false;
      }
      return true;
    });
    if (!nationalityOptions.length) {
      return { ok: false, reason: "A nationality prompt is available, but reserving exactly one leaves too few non-nationality prompts for the selected formation." };
    }

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

    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    if (!semantic?.remainingPressure) return { ok: false, reason: "The same-day semantic diversity guard is unavailable. Reload Studio before generating." };
    const remainingDays = DAYS_IN_BATCH - dayIndex;
    const exactRemaining = Object.values(basePools).flat().filter(prompt => exactPlanAllows(prompt, exactPlan));
    const semanticPressure = semantic.remainingPressure(exactRemaining, remainingDays);
    if (semanticPressure.impossible.size) {
      const key = [...semanticPressure.impossible][0];
      return { ok: false, reason: `Semantic rotation backlog is impossible to spread: ${semantic.describeKey(key)} has more remaining prompts than remaining days. Rebuild the weekly reservoir with more variety.` };
    }
    for (const key of semanticPressure.required) {
      const exactMatches = exactRemaining.filter(prompt => semantic.hasKey(prompt, key));
      if (exactMatches.length && !exactMatches.some(prompt => familyPlanAllows(prompt, familyPlan))) {
        for (const position of new Set(exactMatches.map(prompt => prompt.position))) {
          familyPlan.relaxedPositions.add(position);
          familyPlan.allowedFamiliesByPosition[position] = null;
        }
      }
    }

    const candidates = [];
    const signatures = new Set();
    for (let attempt = 0; attempt < MAX_CANDIDATES_PER_DAY; attempt += 1) {
      if (token !== generationToken) return { ok: false, reason: "Generation cancelled." };
      const used = new Set();
      const draft = [];
      const nationalityChoice = nationalityOptions[attempt % nationalityOptions.length];
      let nationalityPlaced = false;

      for (const position of formationSlots) {
        let choice = null;
        if (!nationalityPlaced && position === nationalityChoice.position) {
          choice = nationalityChoice;
          nationalityPlaced = true;
        } else {
          const options = basePools[position].filter(prompt =>
            exactPlanAllows(prompt, exactPlan)
            && familyPlanAllows(prompt, familyPlan)
            && !used.has(prompt.id)
            && !isNationalityPrompt(prompt)
          );
          choice = weightedPick(options, draft, settings, familyPlan, promptMixPlan, weeklyLeaderDays, dayIndex, semanticPressure);
        }
        if (!choice || used.has(choice.id) || draft.some(existing => semantic.dayClash(choice, existing))) break;
        draft.push(choice);
        used.add(choice.id);
      }
      if (draft.length !== 11 || !nationalityPlaced) continue;
      if (promptMixCounts(draft).nationality !== DAILY_PROMPT_MIX_TARGET.nationality) continue;
      if (!satisfiesExactRotationRequirements(draft, exactPlan)) continue;
      if (draft.filter(isAntiMeta).length < settings.minAntiMeta) continue;
      if (semantic.dayIssues(draft).length) continue;
      if (semantic.missingRequiredKeys(draft, semanticPressure.required).length) continue;
      // Three separate leader days is the weekly hard ceiling. Repeated prompts on this same
      // day are fine because the current day is only committed once after the XI passes.
      if (strictLeaderCap && [...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)) continue;

      const signature = draft.map(prompt => prompt.id).join("|");
      if (signatures.has(signature)) continue;
      signatures.add(signature);
      candidates.push({
        prompts: draft,
        balance: scoreDraft(draft, settings, promptMixPlan, weeklyLeaderDays, dayIndex),
        naiveScore: naivePerfectUpperBound(draft)
      });

      if (attempt > 0 && attempt % 130 === 0) {
        setStatus(`Generating ${dayIndex + 1}/${DAYS_IN_BATCH} · ${friendlyDate(date)} · ${candidates.length} candidate XIs checked…`, "working");
        await yieldToBrowser();
      }
    }

    if (!candidates.length) return { ok: false, reason: strictLeaderCap
      ? "No complete XI could satisfy exact rotation, formation, the hard same-day semantic-diversity guard and the strict three-leader-day weekly cap."
      : "No complete XI could satisfy exact rotation, formation and the hard same-day semantic-diversity guard, even after leader-day fallback was enabled." };
    candidates.sort((left, right) => left.balance - right.balance || left.naiveScore - right.naiveScore);
    const nationalityCandidates = candidates.filter(candidate =>
      promptMixCounts(candidate.prompts).nationality === DAILY_PROMPT_MIX_TARGET.nationality
    );
    if (!nationalityCandidates.length) {
      return { ok: false, reason: "The optimiser could not build an XI with exactly one nationality prompt. The nationality quota is hard and was not relaxed." };
    }
    const quotaCandidates = nationalityCandidates.filter(candidate => promptMixMeets(promptMixCounts(candidate.prompts), promptMixPlan));
    const rankedCandidates = quotaCandidates.length ? quotaCandidates : nationalityCandidates;
    // Only the secondary stats/context/name mix may relax. Nationality remains exactly one.
    const quotaRelaxed = quotaCandidates.length === 0;

    if (settings.maxPerfectScore <= 0) {
      for (const candidate of rankedCandidates.slice(0, 35)) {
        const perfect = calculatePerfectXI(candidate.prompts);
        if (perfect.possible) return { ok: true, prompts: candidate.prompts, perfect, quotaRelaxed };
      }
      return { ok: false, reason: "The optimiser could not find a valid unique-player XI for the strongest candidates." };
    }

    // If the simple per-slot upper bound is already below the ceiling, the exact unique-player
    // score must also be below it. This usually lets the batch generator calculate only one exact XI.
    const definitelyUnderCap = rankedCandidates.filter(candidate => candidate.naiveScore <= settings.maxPerfectScore);
    for (const candidate of definitelyUnderCap.slice(0, 25)) {
      const perfect = calculatePerfectXI(candidate.prompts);
      if (perfect.possible && perfect.score <= settings.maxPerfectScore) {
        return { ok: true, prompts: candidate.prompts, perfect, quotaRelaxed };
      }
    }

    const closest = [...rankedCandidates]
      .sort((left, right) => Math.abs(left.naiveScore - settings.maxPerfectScore) - Math.abs(right.naiveScore - settings.maxPerfectScore) || left.balance - right.balance)
      .slice(0, MAX_EXACT_CAP_CHECKS);

    let lowestExact = Number.POSITIVE_INFINITY;
    for (let index = 0; index < closest.length; index += 1) {
      const candidate = closest[index];
      const perfect = calculatePerfectXI(candidate.prompts);
      if (perfect.possible) {
        lowestExact = Math.min(lowestExact, perfect.score);
        if (perfect.score <= settings.maxPerfectScore) return { ok: true, prompts: candidate.prompts, perfect, quotaRelaxed };
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

  const ANSWER_DIVERSITY_POLICY_VERSION = 6;
  const ANSWER_DIVERSITY_POOL_SIZE = 16;
  const WEEKLY_LEADER_MIN_DAY_GAP = 3;
  const WEEKLY_LEADER_PREFERRED_DAY_CAP = 2;
  const WEEKLY_LEADER_HARD_DAY_CAP = 3;
  const WEEKLY_LEADER_GAP_PENALTY = 900;
  const WEEKLY_LEADER_THIRD_DAY_PENALTY = 420;
  const topAnswerRecordsCache = new Map();
  const topAnswerPlayerIdsCache = new Map();

  function topAnswerRecords(prompt, limit = ANSWER_DIVERSITY_POOL_SIZE) {
    const key = `${prompt?.id || ""}|${limit}`;
    if (topAnswerRecordsCache.has(key)) return topAnswerRecordsCache.get(key);
    const stats = core.getPromptStats(prompt);
    const values = stats?.bestByPlayer?.values ? [...stats.bestByPlayer.values()] : [];
    const records = values
      .filter(Boolean)
      .sort((left, right) => Number(right.points || 0) - Number(left.points || 0) || String(left.name || "").localeCompare(String(right.name || "")))
      .slice(0, limit);
    topAnswerRecordsCache.set(key, records);
    return records;
  }

  function topAnswerPlayerIds(prompt, limit = ANSWER_DIVERSITY_POOL_SIZE) {
    const key = `${prompt?.id || ""}|${limit}`;
    if (topAnswerPlayerIdsCache.has(key)) return topAnswerPlayerIdsCache.get(key);
    const ids = new Set(topAnswerRecords(prompt, limit).map(record => record.playerId).filter(Boolean));
    topAnswerPlayerIdsCache.set(key, ids);
    return ids;
  }

  function answerOverlapWithDraft(prompt, currentDraft, alreadyUsedTopAnswerIds) {
    const alreadyUsed = alreadyUsedTopAnswerIds || new Set(
      currentDraft.flatMap(item => [...topAnswerPlayerIds(item, 12)])
    );
    if (!alreadyUsed.size) return 0;
    const candidate = topAnswerPlayerIds(prompt, 12);
    let overlap = 0;
    for (const playerId of candidate) if (alreadyUsed.has(playerId)) overlap += 1;
    return overlap;
  }

  function leaderRepeatedInDraft(prompt, currentDraft) {
    const leaderId = core.getPromptStats(prompt)?.bestAnswer?.playerId;
    if (!leaderId) return false;
    return currentDraft.some(item => core.getPromptStats(item)?.bestAnswer?.playerId === leaderId);
  }

  function answerDiversityPenalty(draft) {
    const leaders = new Map();
    const clubs = new Map();
    const seasons = new Map();
    const scoreBands = new Map();
    const pools = draft.map(prompt => topAnswerPlayerIds(prompt));
    let penalty = 0;

    for (const prompt of draft) {
      const leader = core.getPromptStats(prompt)?.bestAnswer;
      if (!leader) continue;
      if (leader.playerId) leaders.set(leader.playerId, (leaders.get(leader.playerId) || 0) + 1);
      if (leader.club) clubs.set(leader.club, (clubs.get(leader.club) || 0) + 1);
      if (leader.season) seasons.set(leader.season, (seasons.get(leader.season) || 0) + 1);
      const points = Number(leader.points) || 0;
      const band = points < 50 ? "0-49" : points < 100 ? "50-99" : points < 150 ? "100-149" : "150+";
      scoreBands.set(band, (scoreBands.get(band) || 0) + 1);
    }

    for (const count of clubs.values()) if (count > 2) penalty += (count - 2) * 10;
    for (const count of seasons.values()) if (count > 3) penalty += (count - 3) * 6;
    for (const count of scoreBands.values()) if (count > 4) penalty += (count - 4) * 3;

    for (let left = 0; left < pools.length; left += 1) {
      for (let right = left + 1; right < pools.length; right += 1) {
        const a = pools[left];
        const b = pools[right];
        if (!a.size || !b.size) continue;
        let intersection = 0;
        for (const playerId of a) if (b.has(playerId)) intersection += 1;
        const overlapRatio = intersection / Math.min(a.size, b.size);
        penalty += overlapRatio * 28;
      }
    }
    return penalty;
  }

  function weeklyLeaderIds(draft) {
    const ids = new Set();
    for (const prompt of draft || []) {
      const playerId = core.getPromptStats(prompt)?.bestAnswer?.playerId;
      if (playerId) ids.add(playerId);
    }
    return ids;
  }

  function leaderIdentity(prompt) {
    const best = core.getPromptStats(prompt)?.bestAnswer;
    const playerId = String(best?.playerId || "");
    return Object.freeze({
      playerId: playerId || `prompt:${String(prompt?.id || "unknown")}`,
      name: String(best?.playerName || best?.name || prompt?.id || "Unknown leader"),
      synthetic: !playerId
    });
  }

  function stablePlannerNoise(value, salt = 0) {
    const input = `${value}|${salt}`;
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function dayCombinations(size) {
    const results = [];
    const visit = (start, chosen) => {
      if (chosen.length === size) {
        results.push([...chosen]);
        return;
      }
      for (let day = start; day < DAYS_IN_BATCH; day += 1) {
        chosen.push(day);
        visit(day + 1, chosen);
        chosen.pop();
      }
    };
    visit(0, []);
    return results;
  }

  function cloneLeaderPlanDay(day) {
    return {
      promptIds: [...day.promptIds],
      positionCounts: { ...day.positionCounts },
      nationalityCount: day.nationalityCount,
      antiMetaCount: day.antiMetaCount,
      hardKeys: new Set(day.hardKeys)
    };
  }

  function restoreLeaderPlanDays(days, snapshot) {
    for (let index = 0; index < days.length; index += 1) {
      days[index].promptIds = [...snapshot[index].promptIds];
      days[index].positionCounts = { ...snapshot[index].positionCounts };
      days[index].nationalityCount = snapshot[index].nationalityCount;
      days[index].antiMetaCount = snapshot[index].antiMetaCount;
      days[index].hardKeys = new Set(snapshot[index].hardKeys);
    }
  }

  function leaderGroupMinimumDays(group, requiredFormation, semantic) {
    let minimum = 1;
    const positionCounts = new Map();
    const hardKeyCounts = new Map();
    let nationalityCount = 0;
    for (const prompt of group.prompts) {
      const position = String(prompt?.position || "");
      positionCounts.set(position, Number(positionCounts.get(position) || 0) + 1);
      if (isNationalityPrompt(prompt)) nationalityCount += 1;
      for (const key of semantic.hardKeys(prompt)) hardKeyCounts.set(key, Number(hardKeyCounts.get(key) || 0) + 1);
    }
    for (const [position, count] of positionCounts) {
      const capacity = Number(requiredFormation[position] || 0);
      if (!capacity) return DAYS_IN_BATCH + 1;
      minimum = Math.max(minimum, Math.ceil(count / capacity));
    }
    minimum = Math.max(minimum, nationalityCount);
    for (const count of hardKeyCounts.values()) minimum = Math.max(minimum, count);
    return minimum;
  }

  function leaderDaySetSpacingPenalty(daySet) {
    if (daySet.length < 2) return 0;
    let penalty = 0;
    for (let index = 1; index < daySet.length; index += 1) {
      const gap = daySet[index] - daySet[index - 1];
      if (gap < WEEKLY_LEADER_MIN_DAY_GAP) penalty += (WEEKLY_LEADER_MIN_DAY_GAP - gap) * 1000;
    }
    return penalty;
  }

  function leaderDaySetCapacityScore(group, daySet, days, requiredFormation, settings, salt) {
    for (const position of Object.keys(requiredFormation)) {
      const needed = group.prompts.filter(prompt => prompt.position === position).length;
      const available = daySet.reduce((sum, dayIndex) => sum + Math.max(0, requiredFormation[position] - days[dayIndex].positionCounts[position]), 0);
      if (needed > available) return Number.POSITIVE_INFINITY;
    }
    const nationalityNeeded = group.prompts.filter(isNationalityPrompt).length;
    const nationalityAvailable = daySet.filter(dayIndex => days[dayIndex].nationalityCount === 0).length;
    if (nationalityNeeded > nationalityAvailable) return Number.POSITIVE_INFINITY;

    const load = daySet.reduce((sum, dayIndex) => sum + days[dayIndex].promptIds.length, 0);
    const antiMetaDeficit = daySet.reduce((sum, dayIndex) => sum + Math.max(0, Number(settings.minAntiMeta || 0) - days[dayIndex].antiMetaCount), 0);
    return leaderDaySetSpacingPenalty(daySet) + load * 5 + antiMetaDeficit + stablePlannerNoise(`${group.playerId}:${daySet.join(",")}`, salt);
  }

  function placeLeaderGroup(group, daySet, days, requiredFormation, settings, semantic, salt) {
    const ordered = [...group.prompts].sort((left, right) => {
      const leftKeys = semantic.hardKeys(left).length;
      const rightKeys = semantic.hardKeys(right).length;
      return Number(isNationalityPrompt(right)) - Number(isNationalityPrompt(left))
        || rightKeys - leftKeys
        || Number(isAntiMeta(right)) - Number(isAntiMeta(left))
        || stablePlannerNoise(right.id, salt) - stablePlannerNoise(left.id, salt);
    });

    let steps = 0;
    const assign = index => {
      steps += 1;
      if (steps > 5000) return false;
      if (index >= ordered.length) return true;
      const prompt = ordered[index];
      const position = String(prompt.position || "");
      const keys = semantic.hardKeys(prompt);
      const nationality = isNationalityPrompt(prompt);
      const antiMeta = isAntiMeta(prompt);
      const candidates = daySet.filter(dayIndex => {
        const day = days[dayIndex];
        if (day.positionCounts[position] >= Number(requiredFormation[position] || 0)) return false;
        if (nationality && day.nationalityCount >= DAILY_PROMPT_MIX_TARGET.nationality) return false;
        if (keys.some(key => day.hardKeys.has(key))) return false;
        return true;
      }).sort((left, right) => {
        const score = dayIndex => {
          const day = days[dayIndex];
          const deficit = Math.max(0, settings.minAntiMeta - day.antiMetaCount);
          const antiScore = antiMeta ? -deficit * 30 : deficit * 8;
          const positionLoad = day.positionCounts[position] / Math.max(1, Number(requiredFormation[position] || 1));
          return antiScore + day.promptIds.length * 3 + positionLoad * 12 + stablePlannerNoise(`${prompt.id}:${dayIndex}`, salt);
        };
        return score(left) - score(right);
      });

      for (const dayIndex of candidates) {
        const day = days[dayIndex];
        day.promptIds.push(String(prompt.id));
        day.positionCounts[position] += 1;
        if (nationality) day.nationalityCount += 1;
        if (antiMeta) day.antiMetaCount += 1;
        keys.forEach(key => day.hardKeys.add(key));
        if (assign(index + 1)) return true;
        day.promptIds.pop();
        day.positionCounts[position] -= 1;
        if (nationality) day.nationalityCount -= 1;
        if (antiMeta) day.antiMetaCount -= 1;
        // Rebuild semantic keys for this day because another prompt may share a key only in
        // impossible states; rebuilding keeps rollback exact without reference counts.
        day.hardKeys = new Set(day.promptIds.flatMap(id => semantic.hardKeys(group.promptById.get(id) || group.allPromptById.get(id))));
      }
      return false;
    };

    return assign(0);
  }

  function buildLeaderDayPreplan(prompts, requiredFormation, settings, salt = 0) {
    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    if (!semantic?.hardKeys || !semantic?.dayIssues) {
      return { ok: false, terminal: true, reason: "Leader-day pre-planning cannot run because the semantic-diversity API is unavailable." };
    }
    const uniquePrompts = [...new Map((prompts || []).filter(prompt => prompt?.id).map(prompt => [String(prompt.id), prompt])).values()];
    if (uniquePrompts.length !== DAYS_IN_BATCH * 11) {
      return { ok: false, terminal: true, reason: `Leader-day pre-planning expected the certified 77-prompt reservoir but received ${uniquePrompts.length} prompts.` };
    }
    const allPromptById = new Map(uniquePrompts.map(prompt => [String(prompt.id), prompt]));
    const groupsByLeader = new Map();
    for (const prompt of uniquePrompts) {
      const leader = leaderIdentity(prompt);
      const group = groupsByLeader.get(leader.playerId) || { playerId: leader.playerId, name: leader.name, synthetic: leader.synthetic, prompts: [] };
      group.prompts.push(prompt);
      groupsByLeader.set(leader.playerId, group);
    }
    const groups = [...groupsByLeader.values()].map(group => ({
      ...group,
      allPromptById,
      promptById: new Map(group.prompts.map(prompt => [String(prompt.id), prompt])),
      minimumDays: leaderGroupMinimumDays(group, requiredFormation, semantic)
    }));
    const impossible = groups.filter(group => !group.synthetic && group.minimumDays > WEEKLY_LEADER_HARD_DAY_CAP);
    if (impossible.length) {
      impossible.sort((left, right) => right.minimumDays - left.minimumDays || right.prompts.length - left.prompts.length);
      const blocker = impossible[0];
      return {
        ok: false,
        terminal: true,
        reason: `${blocker.name} leads ${blocker.prompts.length} reservoir prompts that mathematically require at least ${blocker.minimumDays} separate days under the current formation/nationality/semantic constraints. The hard maximum is ${WEEKLY_LEADER_HARD_DAY_CAP}; improve the reservoir/family mix rather than publishing a 4+ day leader.`
      };
    }

    let best = null;
    for (let attempt = 0; attempt < LEADER_PREPLAN_ATTEMPTS; attempt += 1) {
      const attemptSalt = salt * 1000 + attempt;
      const days = Array.from({ length: DAYS_IN_BATCH }, () => ({
        promptIds: [],
        positionCounts: Object.fromEntries(Object.keys(requiredFormation).map(position => [position, 0])),
        nationalityCount: 0,
        antiMetaCount: 0,
        hardKeys: new Set()
      }));
      const orderedGroups = [...groups].sort((left, right) =>
        right.minimumDays - left.minimumDays
        || right.prompts.length - left.prompts.length
        || stablePlannerNoise(left.playerId, attemptSalt) - stablePlannerNoise(right.playerId, attemptSalt)
      );
      let failed = false;

      for (const group of orderedGroups) {
        let placed = false;
        const maximumDays = group.synthetic ? 1 : WEEKLY_LEADER_HARD_DAY_CAP;
        for (let dayCount = group.minimumDays; dayCount <= maximumDays && !placed; dayCount += 1) {
          const combinations = dayCombinations(dayCount).sort((left, right) =>
            leaderDaySetCapacityScore(group, left, days, requiredFormation, settings, attemptSalt)
            - leaderDaySetCapacityScore(group, right, days, requiredFormation, settings, attemptSalt)
          );
          for (const daySet of combinations) {
            if (!Number.isFinite(leaderDaySetCapacityScore(group, daySet, days, requiredFormation, settings, attemptSalt))) continue;
            const snapshot = days.map(cloneLeaderPlanDay);
            if (placeLeaderGroup(group, daySet, days, requiredFormation, settings, semantic, attemptSalt)) {
              placed = true;
              break;
            }
            restoreLeaderPlanDays(days, snapshot);
          }
        }
        if (!placed) {
          failed = true;
          break;
        }
      }
      if (failed) continue;

      const dayPrompts = days.map(day => day.promptIds.map(id => allPromptById.get(id)).filter(Boolean));
      const valid = dayPrompts.every((promptsForDay, dayIndex) => {
        if (promptsForDay.length !== 11) return false;
        if (days[dayIndex].nationalityCount !== DAILY_PROMPT_MIX_TARGET.nationality) return false;
        if (days[dayIndex].antiMetaCount < settings.minAntiMeta) return false;
        if (semantic.dayIssues(promptsForDay).length) return false;
        return Object.keys(requiredFormation).every(position => days[dayIndex].positionCounts[position] === requiredFormation[position]);
      });
      if (!valid) continue;

      const leaderDays = new Map();
      dayPrompts.forEach((promptsForDay, dayIndex) => {
        for (const prompt of promptsForDay) {
          const leader = leaderIdentity(prompt);
          if (leader.synthetic) continue;
          const set = leaderDays.get(leader.playerId) || new Set();
          set.add(dayIndex);
          leaderDays.set(leader.playerId, set);
        }
      });
      if ([...leaderDays.values()].some(set => set.size > WEEKLY_LEADER_HARD_DAY_CAP)) continue;
      let spacingViolations = 0;
      let thirdDayPlayers = 0;
      for (const set of leaderDays.values()) {
        const values = [...set].sort((a, b) => a - b);
        if (values.length > WEEKLY_LEADER_PREFERRED_DAY_CAP) thirdDayPlayers += 1;
        for (let index = 1; index < values.length; index += 1) if (values[index] - values[index - 1] < WEEKLY_LEADER_MIN_DAY_GAP) spacingViolations += 1;
      }
      const score = spacingViolations * 10000 + thirdDayPlayers * 1000 + [...leaderDays.values()].reduce((sum, set) => sum + set.size, 0);
      const candidate = {
        ok: true,
        dayPromptIds: days.map(day => new Set(day.promptIds)),
        audit: Object.freeze({
          plannerAttempt: attempt + 1,
          spacingViolations,
          thirdDayPlayers,
          maxLeaderDays: [...leaderDays.values()].reduce((max, set) => Math.max(max, set.size), 0),
          constrainedLeaders: groups.filter(group => !group.synthetic && group.minimumDays > 1).map(group => ({ name: group.name, promptCount: group.prompts.length, minimumDays: group.minimumDays }))
        }),
        score
      };
      if (!best || candidate.score < best.score) best = candidate;
      if (spacingViolations === 0 && thirdDayPlayers === 0) break;
    }

    if (best) return best;
    const constrained = groups
      .filter(group => !group.synthetic)
      .sort((left, right) => right.minimumDays - left.minimumDays || right.prompts.length - left.prompts.length)
      .slice(0, 5)
      .map(group => `${group.name} (${group.prompts.length} prompts; min ${group.minimumDays} day${group.minimumDays === 1 ? "" : "s"})`)
      .join(", ");
    return {
      ok: false,
      terminal: false,
      reason: `No complete 77-prompt leader-day pre-plan satisfied formation, one nationality per day, anti-meta minimums, same-day semantic diversity and the hard max-3 leader rule. Most constrained leaders: ${constrained || "none identified"}.`
    };
  }

  function filterBasePoolsForIds(basePools, promptIds) {
    if (!(promptIds instanceof Set)) return basePools;
    return Object.fromEntries(Object.entries(basePools).map(([position, prompts]) => [
      position,
      prompts.filter(prompt => promptIds.has(String(prompt.id)))
    ]));
  }

  function weeklyLeaderHistory(weeklyLeaderDays, playerId) {
    const history = weeklyLeaderDays instanceof Map ? weeklyLeaderDays.get(playerId) : null;
    return Array.isArray(history) ? history : [];
  }

  function weeklyLeaderPenalty(draft, weeklyLeaderDays, dayIndex) {
    if (!(weeklyLeaderDays instanceof Map)) return 0;
    let penalty = 0;
    for (const playerId of weeklyLeaderIds(draft)) {
      const history = weeklyLeaderHistory(weeklyLeaderDays, playerId);
      const projectedDays = history.length + 1;
      const lastDay = history.length ? history[history.length - 1] : null;
      const gap = Number.isInteger(lastDay) ? dayIndex - lastDay : Number.POSITIVE_INFINITY;
      if (gap < WEEKLY_LEADER_MIN_DAY_GAP) penalty += (WEEKLY_LEADER_MIN_DAY_GAP - gap) * WEEKLY_LEADER_GAP_PENALTY;
      if (projectedDays > WEEKLY_LEADER_PREFERRED_DAY_CAP) penalty += (projectedDays - WEEKLY_LEADER_PREFERRED_DAY_CAP) * WEEKLY_LEADER_THIRD_DAY_PENALTY;
    }
    return penalty;
  }

  function commitWeeklyLeaderDays(draft, weeklyLeaderDays, dayIndex) {
    for (const playerId of weeklyLeaderIds(draft)) {
      const history = [...weeklyLeaderHistory(weeklyLeaderDays, playerId)];
      if (!history.includes(dayIndex)) history.push(dayIndex);
      weeklyLeaderDays.set(playerId, history);
    }
  }

  function weightedPick(options, currentDraft, settings, familyPlan, promptMixPlan, weeklyLeaderDays, dayIndex, semanticPressure) {
    if (!options.length) return null;
    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    if (semantic?.filterDayCompatible) {
      options = semantic.filterDayCompatible(options, currentDraft);
      if (!options.length) return null;
    }
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
    const alreadyUsedTopAnswerIds = new Set(
      currentDraft.flatMap(prompt => [...topAnswerPlayerIds(prompt, 12)])
    );

    const currentMix = promptMixCounts(currentDraft);
    const weighted = options.map(prompt => {
      const difficultyDistance = Math.abs((DIFFICULTY_VALUE[prompt.difficulty] || 2) - target);
      let weight = Math.max(1, Number(prompt.rating) || 3) * (1 / (1 + difficultyDistance));
      if (currentMix.nationality < promptMixPlan.nationality && isNationalityPrompt(prompt)) weight *= 7;
      if (currentMix.nationality >= promptMixPlan.nationality && isNationalityPrompt(prompt)) weight /= 24;
      if (currentMix.stats < promptMixPlan.stats && isStatMixPrompt(prompt)) weight *= 2.8;
      if (currentMix.context < promptMixPlan.context && isContextMixPrompt(prompt)) weight *= 2.4;
      if (currentMix.name >= promptMixPlan.maxName && isNameRulePrompt(prompt)) weight /= 18;
      if (antiNeeded >= remainingSlots && isAntiMeta(prompt)) weight *= 8;
      else if (antiNeeded > 0 && isAntiMeta(prompt)) weight *= 2;
      const repeatedThemeCount = (prompt.tags || []).filter(tag => DIVERSITY_TAGS.has(tag) && tagsAlreadyUsed.has(tag)).length;
      weight /= 1 + repeatedThemeCount * 1.6;
      const leaderId = core.getPromptStats(prompt)?.bestAnswer?.playerId;
      const sameDayLeader = Boolean(leaderId && currentDraft.some(item => core.getPromptStats(item)?.bestAnswer?.playerId === leaderId));
      if (sameDayLeader) {
        // Multiple prompts led by the same player on one Daily Challenge count as one leader day.
        // A small grouping preference helps concentrate unavoidable repeats instead of spreading them.
        weight *= 1.2;
      } else if (leaderId) {
        const history = weeklyLeaderHistory(weeklyLeaderDays, leaderId);
        const lastDay = history.length ? history[history.length - 1] : null;
        const gap = Number.isInteger(lastDay) ? dayIndex - lastDay : Number.POSITIVE_INFINITY;
        if (gap < WEEKLY_LEADER_MIN_DAY_GAP) weight /= 1 + (WEEKLY_LEADER_MIN_DAY_GAP - gap) * 24;
        if (history.length >= WEEKLY_LEADER_PREFERRED_DAY_CAP) weight /= 18;
        if (history.length >= WEEKLY_LEADER_HARD_DAY_CAP) weight /= 1000;
      }
      const answerOverlap = answerOverlapWithDraft(prompt, currentDraft, alreadyUsedTopAnswerIds);
      weight /= 1 + answerOverlap * 0.65;
      if (semantic?.hasKey && semanticPressure?.required?.size) {
        let requiredMatches = 0;
        for (const key of semanticPressure.required) if (semantic.hasKey(prompt, key)) requiredMatches += 1;
        if (requiredMatches) weight *= 1 + requiredMatches * 18;
      }
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

  function scoreDraft(draft, settings, promptMixPlan, weeklyLeaderDays, dayIndex) {
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
    const mix = promptMixCounts(draft);
    score += Math.max(0, promptMixPlan.nationality - mix.nationality) * 280;
    score += Math.max(0, mix.nationality - promptMixPlan.nationality) * 280;
    score += Math.max(0, promptMixPlan.stats - mix.stats) * 120;
    score += Math.max(0, promptMixPlan.context - mix.context) * 110;
    score += Math.max(0, mix.name - promptMixPlan.maxName) * 180;
    score += answerDiversityPenalty(draft);
    score += weeklyLeaderPenalty(draft, weeklyLeaderDays, dayIndex);
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

  function validateChallenge(challenge, perfect, settings, exactPlan, familyPlan, promptMixPlan, quotaRelaxed) {
    const issues = [];
    const prompts = challenge.prompts || [];
    if (prompts.length !== 11) issues.push("Challenge does not contain 11 prompts.");
    const uniqueIds = new Set(prompts.map(prompt => prompt.id));
    if (uniqueIds.size !== prompts.length) issues.push("A prompt is repeated inside the XI.");
    const semanticIssues = window.FPL_DAILY_SEMANTIC_DIVERSITY?.dayIssues?.(prompts) || [];
    if (semanticIssues.length) issues.push(semanticIssues[0].message);

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
    const mix = promptMixCounts(prompts);
    if (mix.nationality !== DAILY_PROMPT_MIX_TARGET.nationality) issues.push("Exactly one nationality prompt is required in every generated day.");
    if (!quotaRelaxed && !promptMixMeets(mix, promptMixPlan)) issues.push("Prompt-family mix quota was not met.");

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

    return `/* Generated by FPL Challenge Studio — Seven-Day Calendar.\n   Release date: ${challenge.releaseDate} (Europe/London)\n   Exact perfect score calculated with eleven unique footballers. */\nwindow.FPL_DAILY_CHALLENGE = {\n  id: ${JSON.stringify(challenge.id)},\n  title: ${JSON.stringify(challenge.title)},\n  dateLabel: ${JSON.stringify(challenge.dateLabel)},\n  difficulty: ${JSON.stringify(challenge.difficulty)},\n  releaseDate: ${JSON.stringify(challenge.releaseDate)},\n  formation: ${JSON.stringify(challenge.formation || "4-4-2")},\n  formationCounts: ${JSON.stringify(challenge.formationCounts || FORMATIONS["4-4-2"].counts)},\n  theme: ${JSON.stringify(challenge.theme || "Generated Mix")},\n  perfectScore: ${challenge.perfectScore},\n  prompts: [\n${promptsCode}\n  ]\n};\n`;
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
    return `/* FPL Daily Challenge calendar manifest.\n   Generated by Challenge Studio Seven-Day Calendar.\n   Dates are canonical challenge identities. Upload dated files first, then replace this manifest last. */\nwindow.FPL_CHALLENGE_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`;
  }

  function normaliseManifestEntry(entry) {
    const date = String(entry?.date || entry?.release_date || entry?.releaseDate || "");
    if (!isIsoDate(date)) return null;
    return {
      ...(entry && typeof entry === "object" ? entry : {}),
      date,
      path: String(entry?.path || `challenges/${date}.js`),
      id: String(entry?.id || entry?.challenge_id || entry?.challengeId || `daily-${date}`),
      promptIds: Array.isArray(entry?.promptIds) ? [...entry.promptIds] : [],
      promptFamilies: Array.isArray(entry?.promptFamilies) ? [...entry.promptFamilies] : [],
      familyCooldownRelaxedPositions: Array.isArray(entry?.familyCooldownRelaxedPositions) ? [...entry.familyCooldownRelaxedPositions] : []
    };
  }

  function repositoryManifestEntries() {
    const rows = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges) ? window.FPL_CHALLENGE_MANIFEST.challenges : [];
    return rows.map(normaliseManifestEntry).filter(Boolean);
  }

  function serverManifestEntries() {
    const rows = Array.isArray(window.FPL_STUDIO_SCHEDULE?.scheduled) ? window.FPL_STUDIO_SCHEDULE.scheduled : [];
    return rows.map(row => {
      const stored = row?.manifest_entry && typeof row.manifest_entry === "object" ? row.manifest_entry : {};
      return normaliseManifestEntry({
        ...stored,
        date: row?.release_date || stored.date,
        id: stored.id || row?.challenge_id,
        title: stored.title || row?.title || "",
        difficulty: stored.difficulty || row?.difficulty || "Mixed",
        formation: stored.formation || row?.formation || "4-4-2",
        theme: stored.theme || row?.theme || "Generated Mix",
        perfectScore: Number(stored.perfectScore ?? row?.perfect_score) || 0
      });
    }).filter(Boolean);
  }

  function getManifestEntries() {
    const byDate = new Map();
    for (const entry of repositoryManifestEntries()) byDate.set(entry.date, entry);
    // Supabase is authoritative for dates already published through Studio. Server rows
    // overwrite stale repository-manifest rows for the same date and also fill repo gaps.
    for (const entry of serverManifestEntries()) byDate.set(entry.date, entry);
    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
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

    const topAnswerAudit = weeklyTopAnswerDiversity();
    const topAnswerSummary = topAnswerAudit
      ? `<div class="batch-summary"><strong>Leader-day diversity: ${topAnswerAudit.uniquePlayers} unique top-answer players</strong><span>pre-planned before XI generation · 3-day spacing target · preferred max 2 days/player · hard max 3 · ${topAnswerAudit.hardCapBreachCount ? `${topAnswerAudit.hardCapBreachCount} hard-cap breach(es)` : "no 4+ day leaders"} · ${topAnswerAudit.spacingViolationCount ? `${topAnswerAudit.spacingViolationCount} spacing exception(s)` : "no spacing exceptions"} · same-day repeats allowed</span></div>`
      : "";
    elements.review.innerHTML = `${topAnswerSummary}<div class="batch-table-wrap"><table class="batch-table">
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
    const zipBuilder = window.FPL_STUDIO_ZIP?.buildZipBlob;
    if (typeof zipBuilder !== "function") {
      setStatus("Studio ZIP support is unavailable. Reload admin.html and try again.", "fail");
      return;
    }

    const manifestSource = buildManifestSource(batchManifest);
    const originalEntries = repositoryManifestEntries();
    const originalManifest = originalEntries.length
      ? buildManifestSource({
          version: Number(window.FPL_CHALLENGE_MANIFEST?.version || 1),
          timezone: window.FPL_CHALLENGE_MANIFEST?.timezone || LONDON_TIMEZONE,
          fallbackPath: window.FPL_CHALLENGE_MANIFEST?.fallbackPath || "todays-challenge.js",
          challenges: originalEntries
        })
      : "/* No GitHub fallback manifest was loaded before this batch was generated. */\n";

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
    files.push(
      { name: "UPLOAD/challenges/manifest.js", content: manifestSource },
      { name: "BACKUPS/manifest-before-batch.js", content: originalManifest },
      { name: "REVIEW/seven-day-batch-report.json", content: buildBatchReport() },
      { name: "README-UPLOAD.txt", content: buildReadme() }
    );

    const blob = zipBuilder(files);
    const filename = `fpl-seven-day-calendar-${batchResults[0].releaseDate}-to-${batchResults[batchResults.length - 1].releaseDate}.zip`;
    downloadBlob(filename, blob);
    setStatus(`${filename} downloaded. Upload the seven dated files first and manifest.js last.`, "pass");
  }

  function weeklyTopAnswerDiversity() {
    const byPlayer = new Map();
    let promptCount = 0;
    batchResults.forEach((result, dayIndex) => {
      const leadersToday = new Map();
      for (const prompt of result?.prompts || []) {
        promptCount += 1;
        const best = core.getPromptStats(prompt)?.bestAnswer;
        const playerId = String(best?.playerId || "");
        if (!playerId) continue;
        const today = leadersToday.get(playerId) || {
          playerId,
          name: String(best?.playerName || best?.name || playerId),
          promptCount: 0
        };
        today.promptCount += 1;
        leadersToday.set(playerId, today);
      }
      for (const today of leadersToday.values()) {
        const player = byPlayer.get(today.playerId) || { playerId: today.playerId, name: today.name, days: [] };
        player.days.push({ dayIndex, date: result.releaseDate || result.date, promptCount: today.promptCount });
        byPlayer.set(today.playerId, player);
      }
    });

    const players = [...byPlayer.values()].map(player => {
      player.days.sort((a, b) => a.dayIndex - b.dayIndex);
      const gaps = [];
      for (let index = 1; index < player.days.length; index += 1) gaps.push(player.days[index].dayIndex - player.days[index - 1].dayIndex);
      return {
        playerId: player.playerId,
        name: player.name,
        appearanceDays: player.days.length,
        promptCount: player.days.reduce((sum, day) => sum + day.promptCount, 0),
        dates: player.days.map(day => day.date),
        minimumGapDays: gaps.length ? Math.min(...gaps) : null
      };
    }).sort((left, right) => right.appearanceDays - left.appearanceDays || right.promptCount - left.promptCount || left.name.localeCompare(right.name));

    const spacingViolations = players.filter(player => player.minimumGapDays != null && player.minimumGapDays < WEEKLY_LEADER_MIN_DAY_GAP);
    const preferredCapBreaches = players.filter(player => player.appearanceDays > WEEKLY_LEADER_PREFERRED_DAY_CAP);
    const hardCapBreaches = players.filter(player => player.appearanceDays > WEEKLY_LEADER_HARD_DAY_CAP);
    const playerDayAppearances = players.reduce((sum, player) => sum + player.appearanceDays, 0);
    return {
      promptCount,
      uniquePlayers: players.length,
      playerDayAppearances,
      sameDayRepeatPrompts: Math.max(0, promptCount - playerDayAppearances),
      minDayGap: WEEKLY_LEADER_MIN_DAY_GAP,
      preferredDayCap: WEEKLY_LEADER_PREFERRED_DAY_CAP,
      hardDayCap: WEEKLY_LEADER_HARD_DAY_CAP,
      maxAppearanceDays: players.reduce((max, player) => Math.max(max, player.appearanceDays), 0),
      spacingViolationCount: spacingViolations.length,
      preferredCapBreachCount: preferredCapBreaches.length,
      hardCapBreachCount: hardCapBreaches.length,
      spacingViolations,
      preferredCapBreaches,
      hardCapBreaches,
      players,
      layoutPolicy: lastLeaderLayoutPolicy ? { ...lastLeaderLayoutPolicy } : null,
      leaderPreplan: lastLeaderPreplan ? { ...lastLeaderPreplan } : null,
      preplanUsed: Boolean(lastLeaderPreplan)
    };
  }

  function buildBatchReport() {
    const settings = settingsFromUi();
    return JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      timezone: LONDON_TIMEZONE,
      allPassed: batchResults.length === DAYS_IN_BATCH && batchResults.every(result => result.status === "PASS"),
      topAnswerDiversity: weeklyTopAnswerDiversity(),
      settings,
      challenges: batchResults.map(result => ({
        date: result.releaseDate,
        id: result.id,
        title: result.title,
        difficulty: result.difficulty,
        formation: result.formation,
        formationCounts: result.formationCounts,
        theme: result.theme,
        perfectScore: result.perfectScore,
        antiMetaCount: result.antiMetaCount,
        promptMix: result.promptMix,
        promptMixTarget: result.promptMixTarget,
        promptMixQuotaRelaxed: result.promptMixQuotaRelaxed,
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
      "TOP-ANSWER DIVERSITY",
      "--------------------",
      (() => {
        const audit = weeklyTopAnswerDiversity();
        if (!audit) return "Audit unavailable.";
        return `${audit.uniquePlayers} unique top-answer players across ${audit.playerDayAppearances} leader-day appearances. Same-day repeats are allowed. The certified 77-prompt reservoir is pre-planned across all seven days before XI generation, repeat days target a ${audit.minDayGap}-day gap, ${audit.preferredDayCap} days/player is preferred and ${audit.hardDayCap} is a hard maximum. Spacing exceptions: ${audit.spacingViolationCount}; players needing a third day: ${audit.preferredCapBreachCount}; hard-cap breaches: ${audit.hardCapBreachCount}.`;
      })(),
      "",
      "UPLOAD ORDER",
      "------------",
      "1. Phase 1 (Challenge Calendar + UK midnight loader) must already be uploaded.",
      "2. Extract this ZIP.",
      "3. Open UPLOAD/challenges/.",
      "4. Upload ALL seven YYYY-MM-DD.js files into the repository challenges/ folder.",
      "5. Upload challenges/manifest.js LAST. It is a date-keyed GitHub fallback index built from the existing GitHub manifest plus these seven real files; Supabase-only dates are deliberately not given invented GitHub paths.",
      "6. Commit the changes and wait for GitHub Pages to publish.",
      "7. Hard-refresh the live page and confirm the scheduled challenge/countdown.",
      "",
      "WHY MANIFEST.JS IS LAST",
      "-----------------------",
      "Supabase is the live schedule authority. manifest.js is only the static GitHub fallback index, so it lists real GitHub challenge files only. Dates are the challenge identity; numeric challenge sequencing is no longer used. Uploading the dated files first prevents a temporary broken fallback while GitHub Pages is publishing.",
      "",
      "DO NOT upload the ZIP itself. GitHub Pages will not extract it.",
      "DO NOT replace players.js, prompt-library.js or admin-core.js for this weekly publishing step.",
      "",
      "The REVIEW folder contains the generation/validation report. BACKUPS contains the manifest that Studio saw before this batch was built. BACKEND/verifiers contains private leaderboard answer maps; do NOT upload those verifier JSON files to public GitHub Pages.",
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
      date: result.releaseDate || result.date,
      releaseDate: result.releaseDate || result.date,
      id: result.id,
      formation: result.formation,
      formationCounts: result.formationCounts,
      theme: result.theme,
      perfectScore: result.perfectScore,
      status: result.status,
      issues: Array.isArray(result.issues) ? [...result.issues] : [],
      promptIds: [...(result.promptIds || [])],
      promptFamilies: [...(result.promptFamilies || [])],
      promptMix: { ...(result.promptMix || {}) },
      promptMixTarget: { ...(result.promptMixTarget || {}) },
      promptMixQuotaRelaxed: Boolean(result.promptMixQuotaRelaxed),
      familyCooldownRelaxedPositions: [...(result.familyCooldownRelaxedPositions || [])]
    })),
    getTopAnswerDayAudit: () => JSON.parse(JSON.stringify(weeklyTopAnswerDiversity())),
    getManifest: () => batchManifest ? JSON.parse(JSON.stringify(batchManifest)) : null,
    getSources: () => batchResults.filter(result => result.source).map(result => ({ date: result.releaseDate, source: result.source })),
    addDaysIso,
    londonDateKey,
    formations: FORMATIONS,
    themePresets: THEME_PRESETS,
    formationSequence,
    promptFamily,
    semanticDiversityPolicyVersion: SEMANTIC_DIVERSITY_POLICY_VERSION
  });
})();
