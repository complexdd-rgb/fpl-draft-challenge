/* FPL Challenge Studio — Daily Challenge scheduler + saved-library generation guard v3.0.1.
   Builds one immutable 77-prompt reservoir from the structurally certified promoted library,
   runtime-retests each selected prompt, preserves exact rotation, keeps all 18 families represented
   with a fast scored reservoir: shortlist from stored evidence, runtime-certify only selected prompts, then hand off to the existing seven-day validator. */
(() => {
  "use strict";

  if (window.__FPL_DAILY_GENERATOR_GUARD_V2__) return;
  window.__FPL_DAILY_GENERATOR_GUARD_V2__ = true;

  const VERSION = "3.0.1";
  const DAYS_IN_BATCH = 7;
  const PROMPTS_PER_DAY = 11;
  const WEEKLY_PROMPTS = DAYS_IN_BATCH * PROMPTS_PER_DAY;
  const LONDON_TIMEZONE = "Europe/London";
  const CUTOVER_WAIT_MS = 30000;
  const NATIONALITY_WEEKLY_TARGET = DAYS_IN_BATCH;
  const EXCLUDE_TOP_RESULT_WEEKLY_MIN = 4;
  const EXCLUDE_TOP_RESULT_WEEKLY_MAX = 8;
  const WEEKLY_LEADER_PREFERRED_PROMPT_CAP = 2;
  const WEEKLY_LEADER_FALLBACK_PROMPT_CAP = 3;
  const SEMANTIC_WAIT_MS = 10000;
  const GENERATOR_V3_ATTEMPTS = 10;
  const GENERATOR_V3_POOL_MULTIPLIER = 3;
  const GENERATOR_V3_POOL_BUFFER = 20;
  const POSITION_ORDER = Object.freeze(["GK", "DEF", "MID", "FWD"]);
  const FORMATIONS = Object.freeze({
    "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
    "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
    "3-4-3": { GK: 1, DEF: 3, MID: 4, FWD: 3 },
    "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
    "5-3-2": { GK: 1, DEF: 5, MID: 3, FWD: 2 },
    "5-4-1": { GK: 1, DEF: 5, MID: 4, FWD: 1 },
    "4-2-3-1": { GK: 1, DEF: 4, MID: 5, FWD: 1 }
  });
  const ANTI_META_FAMILIES = new Set([
    "club-stat", "league-position", "promoted-clubs", "relegated-clubs", "career-longevity",
    "club-count", "manager", "anti-meta", "exclude-top-result", "value", "minutes-role", "composite-story"
  ]);
  const STAT_TAG_BY_FIELD = Object.freeze({
    points: "points",
    goals: "goals",
    assists: "assists",
    goalInvolvements: "goal-involvements",
    cleanSheets: "clean-sheets",
    bonus: "bonus",
    saves: "saves",
    minutes: "minutes",
    startingPrice: "starting-price",
    ageAtSeasonStart: "age",
    yellowCards: "cards",
    redCards: "cards",
    goalsConceded: "goals-conceded"
  });
  const CONTEXT_TAG_BY_FIELD = Object.freeze({
    leaguePosition: "league-position",
    promoted: "promoted",
    relegated: "relegated",
    champions: "champions",
    topFour: "top-four",
    bottomHalf: "bottom-half",
    outsideBigSix: "outside-big-six",
    manager: "manager",
    club: "club-season",
    careerSeasonCount: "career-seasons",
    careerClubCount: "career-clubs",
    nationality: "nationality"
  });

  const core = window.FPL_STUDIO_API;
  const generateButton = document.getElementById("generateWeekBtn");
  const startDateInput = document.getElementById("batchStartDate");
  const formationInput = document.getElementById("batchFormation");
  const minAnswersInput = document.getElementById("minAnswers");
  const maxAnswersInput = document.getElementById("maxAnswers");
  const minAntiMetaInput = document.getElementById("minAntiMeta");
  const status = document.getElementById("batchStatus");
  const manifestChip = document.getElementById("batchManifestChip");

  if (!core || !generateButton || !startDateInput) return;

  let generationRunning = false;
  let guardChip = null;
  let lastPlan = null;
  const promptTopAnswerCache = new WeakMap();

  function setStatus(message, state = "neutral") {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  async function ensureSemanticDiversity() {
    if (window.FPL_DAILY_SEMANTIC_DIVERSITY?.version === "1.0.0") return window.FPL_DAILY_SEMANTIC_DIVERSITY;
    const manifestUrl = window.FPL_ASSET_MANIFEST?.url?.("dailySemanticDiversityV1");
    const src = manifestUrl || "js/daily-semantic-diversity-v1.js?v=1.0.0";
    let script = [...document.scripts].find(item => /\/js\/daily-semantic-diversity-v1\.js(?:\?|$)/.test(item.src));
    if (!script) {
      script = document.createElement("script");
      script.src = new URL(src, document.baseURI).toString();
      script.async = false;
      script.dataset.dailySemanticDiversityV1 = "1";
      document.head.appendChild(script);
    }
    const deadline = Date.now() + SEMANTIC_WAIT_MS;
    while (Date.now() < deadline) {
      if (window.FPL_DAILY_SEMANTIC_DIVERSITY?.version === "1.0.0") return window.FPL_DAILY_SEMANTIC_DIVERSITY;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("The Daily semantic-diversity policy did not load. Reload Studio before generating.");
  }

  function isIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function addDaysIso(value, amount) {
    if (!isIsoDate(value)) return "";
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
  }

  function londonToday() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function manifestRows() {
    const entries = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges)
      ? window.FPL_CHALLENGE_MANIFEST.challenges
      : [];
    return entries.map(entry => ({
      date: String(entry?.date || ""),
      source: "manifest"
    })).filter(entry => isIsoDate(entry.date));
  }

  function serverRows() {
    const rows = Array.isArray(window.FPL_STUDIO_SCHEDULE?.scheduled)
      ? window.FPL_STUDIO_SCHEDULE.scheduled
      : [];
    return rows.map(entry => ({
      date: String(entry?.release_date || entry?.releaseDate || ""),
      source: "server"
    })).filter(entry => isIsoDate(entry.date));
  }

  function combinedSchedule() {
    const byDate = new Map();
    for (const row of manifestRows()) byDate.set(row.date, row);
    for (const row of serverRows()) byDate.set(row.date, row);
    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  function expectedNext() {
    const rows = combinedSchedule();
    if (!rows.length) return { date: addDaysIso(londonToday(), 1), latest: null };
    const latest = rows[rows.length - 1];
    return { date: addDaysIso(latest.date, 1), latest };
  }

  function installGuardChip() {
    if (guardChip || document.getElementById("dailyGeneratorGuardChip")) {
      guardChip = document.getElementById("dailyGeneratorGuardChip");
      return;
    }
    guardChip = document.createElement("span");
    guardChip.id = "dailyGeneratorGuardChip";
    guardChip.className = "phase-chip";
    guardChip.textContent = "18-family pool checking…";
    guardChip.style.marginLeft = "8px";
    if (manifestChip?.parentElement) manifestChip.insertAdjacentElement("afterend", guardChip);
    else status?.insertAdjacentElement("beforebegin", guardChip);
  }

  function cutoverState() {
    return window.FPL_DAILY_LIBRARY_CUTOVER_V1?.getState?.() || null;
  }

  function updateGuardChip() {
    installGuardChip();
    if (!guardChip) return;
    const cutover = cutoverState();
    const scheduleReady = window.FPL_STUDIO_SCHEDULE?.status === "ready";
    const next = scheduleReady ? expectedNext() : null;
    const poolText = cutover?.ready
      ? `${Number(cutover.total || 0).toLocaleString("en-GB")} saved · ${Number(cutover.families || 0)} families`
      : cutover?.status === "blocked" ? "saved library blocked" : "saved library checking";
    const nextText = next?.date ? `next · ${next.date}` : "live schedule pending";
    guardChip.textContent = `${poolText} · ${nextText}`;
    guardChip.title = "Generation builds a runtime-certified 77-prompt reservoir from the saved promoted library, then locks that immutable reservoir for the whole seven-day run.";
  }

  async function waitForCutover() {
    const initial = cutoverState();
    if (initial?.ready) return true;
    window.FPL_STUDIO_BOOTSTRAP?.ensureDailyCutover?.();
    setStatus("Validating the saved promoted 18-family library before generation…", "working");
    const deadline = Date.now() + CUTOVER_WAIT_MS;
    while (Date.now() < deadline) {
      const api = window.FPL_DAILY_LIBRARY_CUTOVER_V1;
      const state = api?.getState?.();
      if (state?.ready) {
        updateGuardChip();
        return true;
      }
      if (state?.status === "blocked") return false;
      if (api?.ready && state?.status === "waiting") api.refresh?.();
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    return false;
  }

  async function refreshServerSchedule() {
    const schedule = window.FPL_STUDIO_SCHEDULE;
    if (typeof schedule?.refresh !== "function") return false;
    try {
      await schedule.refresh();
      return schedule.status === "ready";
    } catch (_) {
      return false;
    }
  }

  async function waitForServerSchedule(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    setStatus("Refreshing the live Supabase schedule before generation…", "working");
    while (Date.now() < deadline) {
      const schedule = window.FPL_STUDIO_SCHEDULE;
      if (typeof schedule?.refresh === "function") {
        if (await refreshServerSchedule()) {
          updateGuardChip();
          return true;
        }
        if (schedule.status === "unavailable") return false;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  function syncInputsToSchedule(force = false) {
    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") {
      updateGuardChip();
      return false;
    }
    const next = expectedNext();
    const start = String(startDateInput.value || "");
    const stale = !isIsoDate(start) || start < next.date;
    if (force || stale) startDateInput.value = next.date;
    updateGuardChip();
    return true;
  }

  function validateScheduleSelection() {
    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") {
      return { ok: false, reason: "The live Supabase schedule is not ready. Generation stays locked until the server schedule has been refreshed successfully." };
    }
    const next = expectedNext();
    const start = String(startDateInput.value || "");
    if (start !== next.date) {
      startDateInput.value = next.date;
      updateGuardChip();
      return {
        ok: false,
        reason: `Schedule synced to the next unused date: ${next.date}. Press Generate week again to build the next seven dated challenges.`
      };
    }

    const dates = new Set(serverRows().map(row => row.date));
    for (let index = 0; index < DAYS_IN_BATCH; index += 1) {
      const date = addDaysIso(start, index);
      if (dates.has(date)) {
        return { ok: false, reason: `${date} is already scheduled in Supabase. Remove that scheduled day or week before regenerating it.` };
      }
    }
    return { ok: true };
  }

  function formationCounts() {
    return FORMATIONS[String(formationInput?.value || "4-4-2")] || FORMATIONS["4-4-2"];
  }

  function weeklyPositionNeeds() {
    const formation = formationCounts();
    return Object.fromEntries(POSITION_ORDER.map(position => [position, Number(formation[position] || 0) * DAYS_IN_BATCH]));
  }

  function answerLimits() {
    const min = Math.max(2, Number(minAnswersInput?.value) || 6);
    const max = Math.max(min, Number(maxAnswersInput?.value) || 100);
    return { min, max };
  }

  function sourceIdFromPromptId(value) {
    return String(value || "").replace(/__(?:gk|def|mid|fwd)$/i, "");
  }

  function knownUsedSourceIds() {
    const used = new Set();
    const addIds = values => {
      for (const value of values || []) {
        const id = sourceIdFromPromptId(value);
        if (id) used.add(id);
      }
    };
    for (const entry of window.FPL_CHALLENGE_MANIFEST?.challenges || []) addIds(entry?.promptIds);
    for (const row of window.FPL_STUDIO_SCHEDULE?.scheduled || []) {
      const stored = row?.manifest_entry && typeof row.manifest_entry === "object" ? row.manifest_entry : {};
      addIds(stored.promptIds);
    }
    for (const entry of window.FPL_STUDIO_PHASE3?.getHistory?.() || []) addIds(entry?.promptIds);
    return used;
  }

  function knownRecentSourceIds(days = 7) {
    const recent = new Set();
    const start = String(startDateInput?.value || "");
    if (!isIsoDate(start)) return recent;
    const cutoff = addDaysIso(start, -Math.max(1, Number(days) || 7));
    const addEntry = (dateValue, values) => {
      const date = String(dateValue || "");
      if (!isIsoDate(date) || date >= start || date < cutoff) return;
      for (const value of values || []) {
        const id = sourceIdFromPromptId(value);
        if (id) recent.add(id);
      }
    };
    for (const entry of window.FPL_CHALLENGE_MANIFEST?.challenges || []) addEntry(entry?.date, entry?.promptIds);
    for (const row of window.FPL_STUDIO_SCHEDULE?.scheduled || []) {
      const stored = row?.manifest_entry && typeof row.manifest_entry === "object" ? row.manifest_entry : {};
      addEntry(row?.release_date, stored.promptIds);
    }
    for (const entry of window.FPL_STUDIO_PHASE3?.getHistory?.() || []) addEntry(entry?.releaseDate, entry?.promptIds);
    return recent;
  }

  function allocateFamilyTargets(familyIndex, excludeTarget = EXCLUDE_TOP_RESULT_WEEKLY_MIN, balanceOffset = 0) {
    const rows = (familyIndex || []).filter(row => Number(row?.total || 0) > 0);
    if (!rows.length) return null;
    const nationality = rows.find(row => row.family === "nationality");
    if (!nationality) return null;

    // Family size in the curated library is no longer a weekly percentage quota. Every active
    // family gets representation, nationality keeps its one-per-day requirement, and Exclude Top
    // Result keeps a deliberate diversity floor. Remaining slots are shared as evenly as possible.
    const targets = Object.fromEntries(rows.map(row => [row.family, 1]));
    targets.nationality = NATIONALITY_WEEKLY_TARGET;
    if (Object.hasOwn(targets, "exclude-top-result")) {
      targets["exclude-top-result"] = Math.max(1, Math.min(EXCLUDE_TOP_RESULT_WEEKLY_MAX, Number(excludeTarget || EXCLUDE_TOP_RESULT_WEEKLY_MIN)));
    }

    let remaining = WEEKLY_PROMPTS - Object.values(targets).reduce((sum, value) => sum + Number(value || 0), 0);
    if (remaining < 0) return null;

    const flexible = rows
      .filter(row => row.family !== "nationality" && row.family !== "exclude-top-result")
      .sort((left, right) => String(left.family).localeCompare(String(right.family)));
    if (!flexible.length && remaining > 0) return null;

    const offset = flexible.length ? ((Number(balanceOffset) || 0) % flexible.length + flexible.length) % flexible.length : 0;
    const rotated = flexible.length ? [...flexible.slice(offset), ...flexible.slice(0, offset)] : [];
    const rank = new Map(rotated.map((row, index) => [row.family, index]));

    while (remaining > 0) {
      const candidates = flexible
        .filter(row => Number(targets[row.family] || 0) < Math.max(1, Number(row.total || 0)))
        .sort((left, right) =>
          Number(targets[left.family] || 0) - Number(targets[right.family] || 0)
          || Number(rank.get(left.family) || 0) - Number(rank.get(right.family) || 0)
          || Number(right.total || 0) - Number(left.total || 0)
          || String(left.family).localeCompare(String(right.family))
        );
      const next = candidates[0];
      if (!next) return null;
      targets[next.family] += 1;
      remaining -= 1;
    }
    return targets;
  }

  function semanticTags(record, prompt) {
    const tags = new Set(Array.isArray(prompt?.tags) ? prompt.tags : []);
    tags.add(`family:${record.family}`);
    if (record.family === "nationality") tags.add("nationality");
    if (ANTI_META_FAMILIES.has(record.family)) tags.add("anti-meta");
    for (const condition of record.conditions || []) {
      const statTag = STAT_TAG_BY_FIELD[condition.field];
      const contextTag = CONTEXT_TAG_BY_FIELD[condition.field];
      if (statTag) tags.add(statTag);
      if (contextTag) tags.add(contextTag);
      if (condition.field === "startingPrice") tags.add("budget");
      if (["yellowCards", "redCards"].includes(condition.field)) tags.add("discipline");
      if (["outsideBigSix", "bottomHalf", "relegated", "promoted"].includes(condition.field)) tags.add("anti-meta");
      if (condition.operator === "lte" && ["points", "goals", "assists", "goalInvolvements", "startingPrice"].includes(condition.field)) tags.add("anti-meta");
    }
    return [...tags];
  }

  function recordQualityCompare(a, b) {
    const passA = a?.qualityStatus === "pass" ? 1 : 0;
    const passB = b?.qualityStatus === "pass" ? 1 : 0;
    if (passA !== passB) return passB - passA;
    const scoreA = Number(a?.qualityScore || 0);
    const scoreB = Number(b?.qualityScore || 0);
    return scoreB - scoreA || String(a?.id || "").localeCompare(String(b?.id || ""));
  }

  function interleaveSemanticGroups(records) {
    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    if (!semantic?.recordGroupKey) return [...records].sort(recordQualityCompare);
    const sorted = [...records].sort(recordQualityCompare);
    const groups = new Map();
    for (const record of sorted) {
      const key = semantic.recordGroupKey(record, record?.position || "ANY");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    const queues = [...groups.values()];
    const ordered = [];
    while (queues.some(queue => queue.length)) {
      for (const queue of queues) if (queue.length) ordered.push(queue.shift());
    }
    return ordered;
  }

  function recordOrder(records, usedIds, recentIds = new Set()) {
    const unused = [];
    const recycled = [];
    const recent = [];
    for (const record of records || []) {
      const id = String(record?.id || "");
      if (!usedIds.has(id)) unused.push(record);
      else if (recentIds.has(id)) recent.push(record);
      else recycled.push(record);
    }
    return [
      ...interleaveSemanticGroups(unused),
      ...interleaveSemanticGroups(recycled),
      ...interleaveSemanticGroups(recent)
    ];
  }

  function promptTopAnswer(prompt) {
    if (!prompt || typeof prompt !== "object") return null;
    if (promptTopAnswerCache.has(prompt)) return promptTopAnswerCache.get(prompt);
    const best = core.getPromptStats(prompt)?.bestAnswer || null;
    promptTopAnswerCache.set(prompt, best);
    return best;
  }

  function promptTopAnswerKey(prompt) {
    return String(promptTopAnswer(prompt)?.playerId || "");
  }

  function excludedTopPlayerId(prompt) {
    if (String(prompt?.family || "") !== "exclude-top-result") return "";
    const condition = (prompt.conditions || []).find(item => item?.field === "playerId" && item?.operator === "notEquals");
    return String(condition?.value || "");
  }

  function topAnswerDiversityAudit(prompts) {
    const counts = new Map();
    for (const prompt of prompts || []) {
      const best = promptTopAnswer(prompt);
      const playerId = String(best?.playerId || "");
      if (!playerId) continue;
      const existing = counts.get(playerId) || {
        playerId,
        name: String(best?.playerName || best?.name || playerId),
        count: 0
      };
      existing.count += 1;
      counts.set(playerId, existing);
    }
    const repeatedPlayers = [...counts.values()]
      .filter(item => item.count > 1)
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
    return {
      promptCount: (prompts || []).length,
      uniquePlayers: counts.size,
      repeatSlots: repeatedPlayers.reduce((sum, item) => sum + item.count - 1, 0),
      repeatedPlayers
    };
  }

  function repairLeaderCap(selectedEntries, selectionGroups, semantic) {
    const groups = new Map(selectionGroups.map(group => [`${group.family}|${group.position}`, group]));
    const entries = selectedEntries.map(entry => ({ ...entry }));
    const maxSwaps = Math.min(32, WEEKLY_PROMPTS);
    let swaps = 0;

    while (swaps < maxSwaps) {
      const leaderCounts = new Map();
      for (const entry of entries) {
        const leader = promptTopAnswerKey(entry.candidate.prompt);
        if (leader) leaderCounts.set(leader, Number(leaderCounts.get(leader) || 0) + 1);
      }
      const overloaded = [...leaderCounts.entries()]
        .filter(([, count]) => count > WEEKLY_LEADER_FALLBACK_PROMPT_CAP)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
      if (!overloaded) return { entries, swaps };

      const [overloadedLeader] = overloaded;
      const selectedSourceIds = new Set(entries.map(entry => String(entry.candidate.record.id || "")));
      const victimIndexes = entries
        .map((entry, index) => ({ entry, index }))
        .filter(item => promptTopAnswerKey(item.entry.candidate.prompt) === overloadedLeader)
        .sort((left, right) => {
          const leftGroup = groups.get(left.entry.groupKey);
          const rightGroup = groups.get(right.entry.groupKey);
          return Number(rightGroup?.available?.length || 0) - Number(leftGroup?.available?.length || 0);
        })
        .map(item => item.index);

      let repaired = false;
      for (const index of victimIndexes) {
        const current = entries[index];
        const group = groups.get(current.groupKey);
        if (!group) continue;

        const semanticCounts = new Map();
        const otherLeaderCounts = new Map();
        for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
          if (entryIndex === index) continue;
          const prompt = entries[entryIndex].candidate.prompt;
          semantic.commitWeekly(prompt, semanticCounts);
          const leader = promptTopAnswerKey(prompt);
          if (leader) otherLeaderCounts.set(leader, Number(otherLeaderCounts.get(leader) || 0) + 1);
        }

        const currentSourceId = String(current.candidate.record.id || "");
        const choices = (group.available || [])
          .filter(candidate => {
            const sourceId = String(candidate.record.id || "");
            if (!sourceId || sourceId === currentSourceId || selectedSourceIds.has(sourceId)) return false;
            if (!semantic.canAddWeekly(candidate.prompt, semanticCounts, DAYS_IN_BATCH)) return false;
            const leader = promptTopAnswerKey(candidate.prompt);
            return !leader || Number(otherLeaderCounts.get(leader) || 0) < WEEKLY_LEADER_FALLBACK_PROMPT_CAP;
          })
          .sort((left, right) => {
            const leftLeader = promptTopAnswerKey(left.prompt);
            const rightLeader = promptTopAnswerKey(right.prompt);
            const leftLeaderLoad = leftLeader ? Number(otherLeaderCounts.get(leftLeader) || 0) : WEEKLY_PROMPTS;
            const rightLeaderLoad = rightLeader ? Number(otherLeaderCounts.get(rightLeader) || 0) : WEEKLY_PROMPTS;
            const leftRelief = excludedTopPlayerId(left.prompt) === overloadedLeader ? 1 : 0;
            const rightRelief = excludedTopPlayerId(right.prompt) === overloadedLeader ? 1 : 0;
            return rightRelief - leftRelief
              || leftLeaderLoad - rightLeaderLoad
              || semantic.weeklyLoad(left.prompt, semanticCounts) - semantic.weeklyLoad(right.prompt, semanticCounts);
            });

        const replacement = choices[0];
        if (!replacement) continue;
        entries[index] = { ...current, candidate: replacement };
        swaps += 1;
        repaired = true;
        break;
      }

      if (!repaired) return null;
    }

    return null;
  }

  function searchLeaderCappedSelection(selectionGroups, semantic, nodeLimit = 8000) {
    const groups = selectionGroups.map(group => ({
      ...group,
      groupKey: `${group.family}|${group.position}`,
      available: [...(group.available || [])]
    }));
    const selectedEntries = [];
    let nodes = 0;
    let bestDepth = 0;
    let exhausted = false;

    function searchGroup(groupIndex, sourceIds, leaderCounts, semanticCounts) {
      bestDepth = Math.max(bestDepth, selectedEntries.length);
      if (groupIndex >= groups.length) return selectedEntries.map(entry => ({ ...entry }));
      if (nodes >= nodeLimit) {
        exhausted = true;
        return null;
      }
      const group = groups[groupIndex];
      return chooseWithinGroup(group, groupIndex, 0, Number(group.required || 0), sourceIds, leaderCounts, semanticCounts);
    }

    function chooseWithinGroup(group, groupIndex, startIndex, remaining, sourceIds, leaderCounts, semanticCounts) {
      bestDepth = Math.max(bestDepth, selectedEntries.length);
      if (remaining <= 0) return searchGroup(groupIndex + 1, sourceIds, leaderCounts, semanticCounts);
      if (nodes >= nodeLimit) {
        exhausted = true;
        return null;
      }

      const options = group.available
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate, index }) => {
          if (index < startIndex) return false;
          const sourceId = String(candidate.record?.id || "");
          if (!sourceId || sourceIds.has(sourceId)) return false;
          if (!semantic.canAddWeekly(candidate.prompt, semanticCounts, DAYS_IN_BATCH)) return false;
          const leader = promptTopAnswerKey(candidate.prompt);
          return !leader || Number(leaderCounts.get(leader) || 0) < WEEKLY_LEADER_FALLBACK_PROMPT_CAP;
        })
        .sort((left, right) => {
          const leftLeader = promptTopAnswerKey(left.candidate.prompt);
          const rightLeader = promptTopAnswerKey(right.candidate.prompt);
          const leftLeaderLoad = leftLeader ? Number(leaderCounts.get(leftLeader) || 0) : WEEKLY_PROMPTS;
          const rightLeaderLoad = rightLeader ? Number(leaderCounts.get(rightLeader) || 0) : WEEKLY_PROMPTS;
          const leftRelief = excludedTopPlayerId(left.candidate.prompt);
          const rightRelief = excludedTopPlayerId(right.candidate.prompt);
          const leftReliefLoad = leftRelief ? Number(leaderCounts.get(leftRelief) || 0) : 0;
          const rightReliefLoad = rightRelief ? Number(leaderCounts.get(rightRelief) || 0) : 0;
          return rightReliefLoad - leftReliefLoad
            || leftLeaderLoad - rightLeaderLoad
            || semantic.weeklyLoad(left.candidate.prompt, semanticCounts) - semantic.weeklyLoad(right.candidate.prompt, semanticCounts)
            || String(left.candidate.record?.id || "").localeCompare(String(right.candidate.record?.id || ""));
        });

      if (options.length < remaining) return null;
      for (const option of options) {
        nodes += 1;
        if (nodes > nodeLimit) {
          exhausted = true;
          return null;
        }
        const candidate = option.candidate;
        const sourceId = String(candidate.record?.id || "");
        const nextSourceIds = new Set(sourceIds);
        nextSourceIds.add(sourceId);
        const nextLeaderCounts = new Map(leaderCounts);
        const leader = promptTopAnswerKey(candidate.prompt);
        if (leader) nextLeaderCounts.set(leader, Number(nextLeaderCounts.get(leader) || 0) + 1);
        const nextSemanticCounts = new Map(semanticCounts);
        semantic.commitWeekly(candidate.prompt, nextSemanticCounts);
        selectedEntries.push({ groupKey: group.groupKey, candidate });
        const result = chooseWithinGroup(
          group,
          groupIndex,
          option.index + 1,
          remaining - 1,
          nextSourceIds,
          nextLeaderCounts,
          nextSemanticCounts
        );
        if (result) return result;
        selectedEntries.pop();
      }
      return null;
    }

    const entries = searchGroup(0, new Set(), new Map(), new Map());
    return { entries, nodes, bestDepth, exhausted, swaps: 0 };
  }

  function assignAnyRecords(records, positionNeeds, offset = 0) {
    const assigned = Object.fromEntries(POSITION_ORDER.map(position => [position, []]));
    const anyLoads = Object.fromEntries(POSITION_ORDER.map(position => [position, 0]));
    for (const record of records) {
      const position = String(record?.position || "");
      if (POSITION_ORDER.includes(position)) {
        assigned[position].push(record);
        continue;
      }
      if (position !== "ANY") continue;
      const positions = [...POSITION_ORDER].sort((left, right) => {
        const leftRatio = anyLoads[left] / Math.max(1, positionNeeds[left]);
        const rightRatio = anyLoads[right] / Math.max(1, positionNeeds[right]);
        return leftRatio - rightRatio || ((POSITION_ORDER.indexOf(left) - offset + POSITION_ORDER.length) % POSITION_ORDER.length) - ((POSITION_ORDER.indexOf(right) - offset + POSITION_ORDER.length) % POSITION_ORDER.length);
      });
      const chosen = positions[0];
      assigned[chosen].push(record);
      anyLoads[chosen] += 1;
    }
    return assigned;
  }

  async function certifyCandidate(record, position, limits, cutoverApi, cache) {
    const key = `${record.id}|${position}`;
    if (cache.has(key)) return cache.get(key);

    // Reject candidates that cannot fit the answer window before the expensive
    // runtime stats scan. ANY prompts still get a live count when their stored
    // total is above the maximum because a position-specific slice may fit.
    const stored = Number(record?.qualityEvidence?.answerPlayers || 0);
    const sourcePosition = String(record?.position || "").toUpperCase();
    if (!Number.isFinite(stored) || stored < limits.min || (sourcePosition !== "ANY" && stored > limits.max)) {
      cache.set(key, null);
      return null;
    }

    const prompt = cutoverApi.materialiseRecord(record, position);
    if (!prompt || typeof prompt.test !== "function") {
      cache.set(key, null);
      return null;
    }
    prompt.tags = semanticTags(record, prompt);
    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    if (semantic?.fromRecord) prompt.semanticDiversity = semantic.fromRecord(record, position, prompt.label);
    core.invalidatePromptStats?.(prompt.id);
    let stats;
    try {
      stats = core.getPromptStats(prompt);
    } catch (_) {
      cache.set(key, null);
      return null;
    }
    const count = Number(stats?.playerCount || 0);
    const evidenceConsistent = record.position === "ANY" ? count > 0 && count <= stored : count === stored;
    if (!evidenceConsistent || count < limits.min || count > limits.max) {
      cache.set(key, null);
      return null;
    }
    promptTopAnswerCache.set(prompt, stats?.bestAnswer || null);
    const certified = Object.freeze(prompt);
    cache.set(key, certified);
    return certified;
  }

  function addEdge(graph, from, to, capacity) {
    const forward = { to, rev: graph[to].length, capacity, original: capacity };
    const reverse = { to: from, rev: graph[from].length, capacity: 0, original: 0 };
    graph[from].push(forward);
    graph[to].push(reverse);
    return forward;
  }

  function solveFamilyPositionFlow(families, targets, positionNeeds, candidatePools) {
    const source = 0;
    const familyStart = 1;
    const positionStart = familyStart + families.length;
    const sink = positionStart + POSITION_ORDER.length;
    const graph = Array.from({ length: sink + 1 }, () => []);
    const familyEdges = new Map();

    families.forEach((family, index) => addEdge(graph, source, familyStart + index, Number(targets[family] || 0)));
    families.forEach((family, familyIndex) => {
      for (let positionIndex = 0; positionIndex < POSITION_ORDER.length; positionIndex += 1) {
        const position = POSITION_ORDER[positionIndex];
        const cap = Math.min(Number(targets[family] || 0), candidatePools.get(family)?.[position]?.length || 0);
        const edge = addEdge(graph, familyStart + familyIndex, positionStart + positionIndex, cap);
        familyEdges.set(`${family}|${position}`, edge);
      }
    });
    POSITION_ORDER.forEach((position, index) => addEdge(graph, positionStart + index, sink, Number(positionNeeds[position] || 0)));

    let flow = 0;
    while (true) {
      const parentNode = new Int32Array(graph.length).fill(-1);
      const parentEdge = new Int32Array(graph.length).fill(-1);
      const queue = [source];
      parentNode[source] = source;
      for (let q = 0; q < queue.length && parentNode[sink] === -1; q += 1) {
        const node = queue[q];
        for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex += 1) {
          const edge = graph[node][edgeIndex];
          if (edge.capacity <= 0 || parentNode[edge.to] !== -1) continue;
          parentNode[edge.to] = node;
          parentEdge[edge.to] = edgeIndex;
          queue.push(edge.to);
          if (edge.to === sink) break;
        }
      }
      if (parentNode[sink] === -1) break;
      let amount = Number.POSITIVE_INFINITY;
      for (let node = sink; node !== source; node = parentNode[node]) {
        amount = Math.min(amount, graph[parentNode[node]][parentEdge[node]].capacity);
      }
      for (let node = sink; node !== source; node = parentNode[node]) {
        const edge = graph[parentNode[node]][parentEdge[node]];
        edge.capacity -= amount;
        graph[node][edge.rev].capacity += amount;
      }
      flow += amount;
    }

    if (flow !== WEEKLY_PROMPTS) return null;
    const allocation = Object.fromEntries(families.map(family => [family, Object.fromEntries(POSITION_ORDER.map(position => [position, 0]))]));
    for (const family of families) {
      for (const position of POSITION_ORDER) {
        const edge = familyEdges.get(`${family}|${position}`);
        allocation[family][position] = edge ? edge.original - edge.capacity : 0;
      }
    }
    return allocation;
  }

  async function buildCertifiedReservoir() {
    const cutoverApi = window.FPL_DAILY_LIBRARY_CUTOVER_V1;
    const cutover = cutoverApi?.getState?.();
    if (!cutover?.ready) throw new Error(cutover?.reason || "The saved promoted library is not certified for Daily use.");
    const payload = await window.FPL_PROMPT_LIBRARY_SHARDS_V1?.buildRepositoryPackage?.();
    if (!payload?.manifest || !Array.isArray(payload.shards)) throw new Error("The saved Prompt Library shard package could not be read.");
    if (String(payload.manifest.promotionFingerprint || "") !== String(cutover.manifest?.promotionFingerprint || "")) {
      throw new Error("The saved shard package changed after Daily certification. Refresh Studio before generating.");
    }

    const positionNeeds = weeklyPositionNeeds();
    const limits = answerLimits();
    const usedIds = knownUsedSourceIds();
    const recentIds = knownRecentSourceIds(7);
    const runtimeCache = new Map();
    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    const antiMetaRequired = Math.max(0, Number(minAntiMetaInput?.value) || 0) * DAYS_IN_BATCH;
    const poolTargets = Object.fromEntries(POSITION_ORDER.map(position => [
      position,
      Math.max(positionNeeds[position] * GENERATOR_V3_POOL_MULTIPLIER, positionNeeds[position] + GENERATOR_V3_POOL_BUFFER)
    ]));
    const pools = Object.fromEntries(POSITION_ORDER.map(position => [position, []]));

    function materialiseShortlistCandidate(record, position) {
      const stored = Number(record?.qualityEvidence?.answerPlayers || 0);
      const sourcePosition = String(record?.position || "").toUpperCase();
      if (!Number.isFinite(stored) || stored < limits.min || (sourcePosition !== "ANY" && stored > limits.max)) return null;
      const prompt = cutoverApi.materialiseRecord(record, position);
      if (!prompt || typeof prompt.test !== "function") return null;
      prompt.tags = semanticTags(record, prompt);
      if (semantic?.fromRecord) prompt.semanticDiversity = semantic.fromRecord(record, position, prompt.label);
      return { record, prompt, position, storedAnswerPlayers: stored, invalid: false, leaderKey: "" };
    }

    // Shortlist cheaply from the already-certified quality evidence. Runtime player scans are
    // intentionally deferred until a prompt is actually selected for the provisional 77.
    const queues = payload.shards.map(shard => ({
      family: String(shard.family || ""),
      rows: recordOrder(Array.isArray(shard.records) ? shard.records : [], usedIds, recentIds),
      cursor: 0
    })).filter(queue => queue.family && queue.rows.length);

    let shortlisted = 0;
    let progress = true;
    while (progress && POSITION_ORDER.some(position => pools[position].length < poolTargets[position])) {
      progress = false;
      for (const queue of queues) {
        const record = queue.rows[queue.cursor++];
        if (!record) continue;
        progress = true;
        const sourcePosition = String(record?.position || "").toUpperCase();
        const positions = POSITION_ORDER.includes(sourcePosition) ? [sourcePosition] : sourcePosition === "ANY" ? POSITION_ORDER : [];
        for (const position of positions) {
          if (pools[position].length >= poolTargets[position]) continue;
          const candidate = materialiseShortlistCandidate(record, position);
          if (!candidate) continue;
          pools[position].push(candidate);
          shortlisted += 1;
          if (shortlisted % 80 === 0) {
            setStatus(`Generator v3 · shortlisting from stored evidence · ${shortlisted.toLocaleString("en-GB")} candidates prepared…`, "working");
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const short = POSITION_ORDER.filter(position => pools[position].length < positionNeeds[position]);
    if (short.length) throw new Error(`Generator v3 could not shortlist enough ${short.join(", ")} prompts for the selected formation.`);

    const hash = value => {
      let h = 2166136261;
      for (const char of String(value || "")) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
      return h >>> 0;
    };

    const isAntiMeta = prompt => Array.isArray(prompt?.tags) && prompt.tags.includes("anti-meta");
    const familyOf = candidate => String(candidate?.prompt?.family || candidate?.record?.family || "");
    const sourceIdOf = candidate => String(candidate?.record?.id || "");
    const leaderOf = candidate => String(candidate?.leaderKey || "");

    function scoreCandidate(candidate, state, attempt) {
      const family = familyOf(candidate);
      const sourceId = sourceIdOf(candidate);
      const leader = leaderOf(candidate);
      const quality = Number(candidate.record?.qualityScore || 0);
      const familyLoad = Number(state.familyCounts.get(family) || 0);
      const leaderLoad = leader ? Number(state.leaderCounts.get(leader) || 0) : 0;
      const semanticLoad = semantic?.weeklyLoad ? Number(semantic.weeklyLoad(candidate.prompt, state.semanticCounts) || 0) : 0;
      const excluded = excludedTopPlayerId(candidate.prompt);
      const excludedLoad = excluded ? Number(state.leaderCounts.get(excluded) || 0) : 0;
      let score = quality;
      if (!usedIds.has(sourceId)) score += 28;
      else if (recentIds.has(sourceId)) score -= 32;
      else score -= 8;
      if (familyLoad === 0) score += 24;
      score -= familyLoad * 5;
      score -= leaderLoad * leaderLoad * 30;
      score -= semanticLoad * 8;
      score += excludedLoad * 35;
      if (family === "nationality" && state.nationalityCount < NATIONALITY_WEEKLY_TARGET) score += 90;
      if (family === "exclude-top-result" && state.excludeCount < EXCLUDE_TOP_RESULT_WEEKLY_MIN) score += 105;
      if (isAntiMeta(candidate.prompt) && state.antiMetaCount < antiMetaRequired) score += 42;
      score += (hash(`${sourceId}|${candidate.position}|${attempt}`) % 1000) / 10000;
      return score;
    }

    function createState() {
      return {
        selected: [], sourceIds: new Set(), positionCounts: new Map(), familyCounts: new Map(), leaderCounts: new Map(),
        semanticCounts: new Map(), nationalityCount: 0, excludeCount: 0, antiMetaCount: 0
      };
    }

    function commit(state, candidate) {
      const sourceId = sourceIdOf(candidate);
      const family = familyOf(candidate);
      const leader = leaderOf(candidate);
      state.selected.push(candidate);
      state.sourceIds.add(sourceId);
      state.positionCounts.set(candidate.position, Number(state.positionCounts.get(candidate.position) || 0) + 1);
      state.familyCounts.set(family, Number(state.familyCounts.get(family) || 0) + 1);
      if (leader) state.leaderCounts.set(leader, Number(state.leaderCounts.get(leader) || 0) + 1);
      if (semantic?.commitWeekly) semantic.commitWeekly(candidate.prompt, state.semanticCounts);
      if (family === "nationality") state.nationalityCount += 1;
      if (family === "exclude-top-result") state.excludeCount += 1;
      if (isAntiMeta(candidate.prompt)) state.antiMetaCount += 1;
    }

    function candidatesForPosition(position, state) {
      return pools[position].filter(candidate => !candidate.invalid && !state.sourceIds.has(sourceIdOf(candidate)));
    }

    function reserveSpecial(state, predicate, target, attempt) {
      while (state.selected.filter(item => predicate(item)).length < target) {
        const choices = [];
        for (const position of POSITION_ORDER) {
          if (Number(state.positionCounts.get(position) || 0) >= positionNeeds[position]) continue;
          for (const candidate of candidatesForPosition(position, state)) if (predicate(candidate)) choices.push(candidate);
        }
        if (!choices.length) return false;
        choices.sort((a, b) => scoreCandidate(b, state, attempt) - scoreCandidate(a, state, attempt));
        commit(state, choices[0]);
      }
      return true;
    }

    let best = null;
    let runtimeCandidatesChecked = 0;
    for (let attempt = 0; attempt < GENERATOR_V3_ATTEMPTS; attempt += 1) {
      const state = createState();
      if (!reserveSpecial(state, candidate => familyOf(candidate) === "nationality", NATIONALITY_WEEKLY_TARGET, attempt)) continue;
      if (!reserveSpecial(state, candidate => familyOf(candidate) === "exclude-top-result", EXCLUDE_TOP_RESULT_WEEKLY_MIN, attempt)) continue;
      if (!reserveSpecial(state, candidate => isAntiMeta(candidate.prompt), antiMetaRequired, attempt)) continue;

      while (state.selected.length < WEEKLY_PROMPTS) {
        const remainingPositions = POSITION_ORDER.filter(position => Number(state.positionCounts.get(position) || 0) < positionNeeds[position]);
        if (!remainingPositions.length) break;
        remainingPositions.sort((a, b) => {
          const aNeed = positionNeeds[a] - Number(state.positionCounts.get(a) || 0);
          const bNeed = positionNeeds[b] - Number(state.positionCounts.get(b) || 0);
          const aAvail = candidatesForPosition(a, state).length;
          const bAvail = candidatesForPosition(b, state).length;
          return (aAvail / Math.max(1, aNeed)) - (bAvail / Math.max(1, bNeed)) || POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b);
        });
        const position = remainingPositions[0];
        const choices = candidatesForPosition(position, state);
        if (!choices.length) break;
        choices.sort((a, b) => scoreCandidate(b, state, attempt) - scoreCandidate(a, state, attempt));
        commit(state, choices[0]);
      }

      if (state.selected.length !== WEEKLY_PROMPTS || state.sourceIds.size !== WEEKLY_PROMPTS) continue;
      if (POSITION_ORDER.some(position => Number(state.positionCounts.get(position) || 0) !== positionNeeds[position])) continue;
      if (state.nationalityCount < NATIONALITY_WEEKLY_TARGET || state.excludeCount < EXCLUDE_TOP_RESULT_WEEKLY_MIN || state.antiMetaCount < antiMetaRequired) continue;

      // Runtime-certify only the provisional 77. Successful prompts stay cached and are reused
      // by later scored attempts and by the seven-day generator; failures are removed from the pool.
      let runtimeFailed = false;
      for (let index = 0; index < state.selected.length; index += 1) {
        const candidate = state.selected[index];
        const certified = await certifyCandidate(candidate.record, candidate.position, limits, cutoverApi, runtimeCache);
        runtimeCandidatesChecked += 1;
        if (!certified) {
          candidate.invalid = true;
          runtimeFailed = true;
          break;
        }
        candidate.prompt = certified;
        candidate.leaderKey = promptTopAnswerKey(certified);
        if ((index + 1) % 10 === 0 || index + 1 === WEEKLY_PROMPTS) {
          setStatus(`Generator v3 · runtime-certifying selected prompts · attempt ${attempt + 1}/${GENERATOR_V3_ATTEMPTS} · ${index + 1}/${WEEKLY_PROMPTS}…`, "working");
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      if (runtimeFailed) continue;

      const prompts = state.selected.map(item => item.prompt);
      const diversity = topAnswerDiversityAudit(prompts);
      const maxLeader = diversity.repeatedPlayers.length ? Math.max(...diversity.repeatedPlayers.map(item => item.count)) : 1;
      const familyLoads = [...state.familyCounts.values()];
      const familyConcentration = familyLoads.reduce((sum, count) => sum + count * count, 0);
      const recentCount = state.selected.filter(item => recentIds.has(sourceIdOf(item))).length;
      const objective = diversity.repeatSlots * 120 + maxLeader * 45 + familyConcentration * 2 + recentCount * 35;
      if (!best || objective < best.objective) best = { state, diversity, objective };

      setStatus(`Generator v3 · scored attempt ${attempt + 1}/${GENERATOR_V3_ATTEMPTS} · ${diversity.uniquePlayers}/77 unique top answers…`, "working");
      await new Promise(resolve => setTimeout(resolve, 0));
      if (diversity.repeatSlots <= 8 && maxLeader <= 3) break;
    }

    if (!best) throw new Error("Generator v3 could not assemble and runtime-certify a valid 77-prompt reservoir from the shortlisted candidate pool.");

    const prompts = Object.freeze(best.state.selected.map(item => Object.freeze(item.prompt)));
    const ids = new Set(prompts.map(prompt => String(prompt.id)));
    const familyCounts = Object.fromEntries(best.state.familyCounts);
    const frozenTopAnswerDiversity = Object.freeze({
      ...best.diversity,
      repeatedPlayers: Object.freeze(best.diversity.repeatedPlayers.map(item => Object.freeze({ ...item })))
    });
    const plan = Object.freeze({
      version: VERSION,
      source: "generator-v3-runtime-shortlist",
      promotionFingerprint: String(payload.manifest.promotionFingerprint || ""),
      total: WEEKLY_PROMPTS,
      targets: Object.freeze({ ...familyCounts }),
      excludeTopResultTarget: Number(best.state.excludeCount || 0),
      positionNeeds: Object.freeze({ ...positionNeeds }),
      cycleFamilies: Object.freeze([]),
      knownUsedSourceIds: usedIds.size,
      recentSourceIds: recentIds.size,
      runtimeCandidatesChecked,
      shortlistedCandidates: shortlisted,
      leaderRepairSwaps: 0,
      leaderSearchNodes: 0,
      leaderSearchBestDepth: 0,
      antiMetaCount: best.state.antiMetaCount,
      nationalityCount: best.state.nationalityCount,
      topAnswerDiversity: frozenTopAnswerDiversity,
      semanticDiversityVersion: String(window.FPL_DAILY_SEMANTIC_DIVERSITY?.version || ""),
      semanticWeeklyCap: DAYS_IN_BATCH
    });
    return { prompts, ids, plan };
  }

  function installGenerationSnapshot(reservoir) {
    const prompts = reservoir.prompts;
    window.FPL_DAILY_GENERATION_PROMPT_POOL = prompts;
    window.FPL_DAILY_GENERATION_FAMILY_PLAN = reservoir.plan;
    lastPlan = reservoir.plan;
    return Object.freeze({
      ids: reservoir.ids,
      size: prompts.length,
      prompts,
      plan: reservoir.plan,
      clear() {
        if (window.FPL_DAILY_GENERATION_PROMPT_POOL === prompts) delete window.FPL_DAILY_GENERATION_PROMPT_POOL;
        if (window.FPL_DAILY_GENERATION_FAMILY_PLAN === reservoir.plan) delete window.FPL_DAILY_GENERATION_FAMILY_PLAN;
      }
    });
  }

  function certifyGeneratedResults(snapshot) {
    const results = window.FPL_STUDIO_BATCH_CALENDAR?.getResults?.() || [];
    if (!Array.isArray(results)) return { ok: false, reason: "The generator did not expose a result list." };
    if (results.length !== DAYS_IN_BATCH) {
      const last = results[results.length - 1];
      const detail = last?.issues?.[0] || "generation stopped before all seven days completed";
      return { ok: false, reason: `Only ${results.length}/${DAYS_IN_BATCH} days were produced: ${detail}.` };
    }

    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    const snapshotPromptById = new Map((snapshot.prompts || []).map(prompt => [String(prompt.id), prompt]));
    const weekIds = [];
    for (const result of results) {
      const day = result?.releaseDate || result?.date || "A generated day";
      if (result?.status !== "PASS") return { ok: false, reason: `${day} has status ${result?.status || "missing"}: ${result?.issues?.[0] || "validation failed"}.` };
      if (!Array.isArray(result.promptIds) || result.promptIds.length !== PROMPTS_PER_DAY) return { ok: false, reason: `${day} did not return exactly ${PROMPTS_PER_DAY} prompt IDs.` };
      const uncertified = result.promptIds.filter(id => !snapshot.ids.has(String(id)));
      if (uncertified.length) return { ok: false, reason: `${day} contains prompt(s) outside the immutable saved-library reservoir: ${uncertified.slice(0, 3).join(", ")}.` };
      const dayPrompts = result.promptIds.map(id => snapshotPromptById.get(String(id))).filter(Boolean);
      const semanticIssues = semantic?.dayIssues?.(dayPrompts) || [];
      if (semanticIssues.length) return { ok: false, reason: `${day} contains overly similar prompts: ${semanticIssues[0].description}.` };
      const dayLeaderDiversity = topAnswerDiversityAudit(dayPrompts);
      if (dayLeaderDiversity.repeatSlots) {
        const repeated = dayLeaderDiversity.repeatedPlayers[0];
        return { ok: false, reason: `${day} repeats top-answer player ${repeated?.name || repeated?.playerId || "unknown"} across ${repeated?.count || 2} prompts. Same-day top answers must be unique.` };
      }
      weekIds.push(...result.promptIds.map(String));
    }

    const uniqueWeekIds = new Set(weekIds);
    if (weekIds.length !== WEEKLY_PROMPTS || uniqueWeekIds.size !== WEEKLY_PROMPTS) {
      return { ok: false, reason: `The seven-day run used ${uniqueWeekIds.size}/${WEEKLY_PROMPTS} unique reservoir prompts; exact weekly rotation must consume all 77 exactly once.` };
    }
    const missing = [...snapshot.ids].filter(id => !uniqueWeekIds.has(id));
    if (missing.length) return { ok: false, reason: `${missing.length} runtime-certified reservoir prompt(s) were not consumed by the week.` };
    const topAnswerDiversity = topAnswerDiversityAudit(snapshot.prompts || []);
    return { ok: true, reason: "", topAnswerDiversity };
  }

  async function guardedGenerate() {
    if (generationRunning) return;
    generationRunning = true;
    generateButton.disabled = true;
    let generationSnapshot = null;
    try {
      await ensureSemanticDiversity();
      if (!await waitForCutover()) {
        const state = cutoverState();
        setStatus(`Generation is blocked until the saved promoted library passes Daily certification${state?.reason ? `: ${state.reason}` : "."}`, "fail");
        return;
      }

      if (!await waitForServerSchedule()) {
        setStatus("Generation is locked until the live Supabase schedule is available. Sign in on the live game if needed, then reload Studio before generating.", "fail");
        return;
      }

      const scheduleCheck = validateScheduleSelection();
      if (!scheduleCheck.ok) {
        setStatus(scheduleCheck.reason, "fail");
        return;
      }

      setStatus("Generator v3 · building a fast scored 77-prompt reservoir…", "working");
      const reservoir = await buildCertifiedReservoir();
      generationSnapshot = installGenerationSnapshot(reservoir);
      setStatus(`77 prompts locked by Generator v3 · ${reservoir.plan.topAnswerDiversity.uniquePlayers}/77 unique top-answer players · ${reservoir.plan.targets?.["exclude-top-result"] || 0} Exclude Top Result prompts · unused prompts preferred. Generating week…`, "working");

      const generator = window.FPL_STUDIO_BATCH_CALENDAR?.generate;
      if (typeof generator !== "function") {
        setStatus("The seven-day generator is unavailable. Reload Studio and try again.", "fail");
        return;
      }

      await generator();
      const certification = certifyGeneratedResults(generationSnapshot);
      if (!certification.ok) {
        window.FPL_STUDIO_BATCH_CALENDAR?.clear?.();
        setStatus(`Saved-library certification failed: ${certification.reason} The batch was cleared and cannot be published.`, "fail");
        return;
      }
      updateGuardChip();
      const dayAudit = window.FPL_STUDIO_BATCH_CALENDAR?.getTopAnswerDayAudit?.();
      const diversityText = dayAudit
        ? `${dayAudit.uniquePlayers} unique top-answer players · max ${dayAudit.maxAppearanceDays} leader day(s) for one player · ${dayAudit.spacingViolationCount} spacing exception(s)`
        : "leader-day audit unavailable";
      setStatus(`Seven-day generation passed the saved-library guard: all 77 runtime-certified prompts were consumed exactly once, the fast scored reservoir was consumed, and no same-day semantic clashes or repeated top-answer players were allowed, and the 3-day leader-spacing audit finished at ${diversityText}.`, "pass");
      window.dispatchEvent(new CustomEvent("fpl:daily-saved-library-week-certified", { detail: { ...reservoir.plan } }));
    } catch (error) {
      console.error(error);
      setStatus(`Daily Challenge guard stopped generation: ${error instanceof Error ? error.message : String(error)}`, "fail");
    } finally {
      try { generationSnapshot?.clear?.(); } catch (_) {}
      generationRunning = false;
      generateButton.disabled = false;
    }
  }

  function onGenerateClick(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    guardedGenerate();
  }

  function onScheduleStatus() {
    if (!generationRunning && window.FPL_STUDIO_SCHEDULE?.status === "ready") syncInputsToSchedule(false);
    else updateGuardChip();
  }

  generateButton.addEventListener("click", onGenerateClick, true);
  window.addEventListener("fpl:daily-library-cutover-state", updateGuardChip);
  window.addEventListener("fpl:daily-library-cutover-ready", updateGuardChip);
  window.addEventListener("fpl:prompt-library-shards-saved", updateGuardChip);
  window.addEventListener("fpl:prompt-library-shards-restored", updateGuardChip);
  window.addEventListener("fpl:schedule-status", onScheduleStatus);

  installGuardChip();
  updateGuardChip();
  setTimeout(() => {
    waitForServerSchedule().then(ready => { if (ready) syncInputsToSchedule(false); else updateGuardChip(); });
  }, 0);

  window.FPL_DAILY_GENERATOR_GUARD = Object.freeze({
    version: VERSION,
    expectedPoolSize: WEEKLY_PROMPTS,
    qualityReady: () => Boolean(cutoverState()?.ready),
    scheduleReady: () => window.FPL_STUDIO_SCHEDULE?.status === "ready",
    getExpectedNext: () => ({ ...expectedNext() }),
    getLastFamilyPlan: () => lastPlan ? {
      ...lastPlan,
      targets: { ...lastPlan.targets },
      positionNeeds: { ...lastPlan.positionNeeds },
      topAnswerDiversity: lastPlan.topAnswerDiversity ? {
        ...lastPlan.topAnswerDiversity,
        repeatedPlayers: (lastPlan.topAnswerDiversity.repeatedPlayers || []).map(item => ({ ...item }))
      } : null
    } : null,
    sync: () => syncInputsToSchedule(true),
    generate: guardedGenerate
  });
})();
