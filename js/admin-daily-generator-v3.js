/* FPL Challenge Studio — Daily Generator v3.0.0.
   Clean weekly selector: certify once, score once, choose 77, then hand the immutable
   snapshot to the existing seven-day calendar generator and validator. */
(() => {
  "use strict";

  if (window.__FPL_DAILY_GENERATOR_V3__) return;
  window.__FPL_DAILY_GENERATOR_V3__ = true;

  const VERSION = "3.0.0";
  const DAYS_IN_BATCH = 7;
  const PROMPTS_PER_DAY = 11;
  const WEEKLY_PROMPTS = DAYS_IN_BATCH * PROMPTS_PER_DAY;
  const NATIONALITY_WEEKLY_TARGET = 7;
  const EXCLUDE_TOP_RESULT_WEEKLY_MIN = 4;
  const EXCLUDE_TOP_RESULT_WEEKLY_MAX = 8;
  const LONDON_TIMEZONE = "Europe/London";
  const CUTOVER_WAIT_MS = 30000;
  const SEMANTIC_WAIT_MS = 10000;
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
    points: "points", goals: "goals", assists: "assists", goalInvolvements: "goal-involvements",
    cleanSheets: "clean-sheets", bonus: "bonus", saves: "saves", minutes: "minutes",
    startingPrice: "starting-price", ageAtSeasonStart: "age", yellowCards: "cards",
    redCards: "cards", goalsConceded: "goals-conceded"
  });
  const CONTEXT_TAG_BY_FIELD = Object.freeze({
    leaguePosition: "league-position", promoted: "promoted", relegated: "relegated",
    champions: "champions", topFour: "top-four", bottomHalf: "bottom-half",
    outsideBigSix: "outside-big-six", manager: "manager", club: "club-season",
    careerSeasonCount: "career-seasons", careerClubCount: "career-clubs", nationality: "nationality"
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
  const topAnswerCache = new WeakMap();

  function setStatus(message, state = "neutral") {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
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
    const entries = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges) ? window.FPL_CHALLENGE_MANIFEST.challenges : [];
    return entries.map(entry => ({ date: String(entry?.date || ""), source: "manifest" })).filter(entry => isIsoDate(entry.date));
  }

  function serverRows() {
    const rows = Array.isArray(window.FPL_STUDIO_SCHEDULE?.scheduled) ? window.FPL_STUDIO_SCHEDULE.scheduled : [];
    return rows.map(entry => ({ date: String(entry?.release_date || entry?.releaseDate || ""), source: "server" })).filter(entry => isIsoDate(entry.date));
  }

  function combinedSchedule() {
    const byDate = new Map();
    for (const row of manifestRows()) byDate.set(row.date, row);
    for (const row of serverRows()) byDate.set(row.date, row);
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function expectedNext() {
    const rows = combinedSchedule();
    if (!rows.length) return { date: addDaysIso(londonToday(), 1), latest: null };
    const latest = rows.at(-1);
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
    guardChip.textContent = "Generator v3 checking…";
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
    guardChip.textContent = `v3 · ${poolText} · ${next?.date ? `next ${next.date}` : "schedule pending"}`;
    guardChip.title = "Generator v3 certifies one compact candidate bank, scores candidates, chooses 77, then hands the immutable snapshot to the existing seven-day builder.";
  }

  async function ensureSemanticDiversity() {
    const ready = () => window.FPL_DAILY_SEMANTIC_DIVERSITY?.canAddWeekly && window.FPL_DAILY_SEMANTIC_DIVERSITY?.commitWeekly;
    if (ready()) return window.FPL_DAILY_SEMANTIC_DIVERSITY;
    window.FPL_STUDIO_BOOTSTRAP?.ensureDailyCutover?.();
    const deadline = Date.now() + SEMANTIC_WAIT_MS;
    while (Date.now() < deadline) {
      if (ready()) return window.FPL_DAILY_SEMANTIC_DIVERSITY;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("The Daily semantic-diversity policy did not load. Reload Studio before generating.");
  }

  async function waitForCutover() {
    if (cutoverState()?.ready) return true;
    window.FPL_STUDIO_BOOTSTRAP?.ensureDailyCutover?.();
    setStatus("Generator v3 is validating the curated 18-family library…", "working");
    const deadline = Date.now() + CUTOVER_WAIT_MS;
    while (Date.now() < deadline) {
      const api = window.FPL_DAILY_LIBRARY_CUTOVER_V1;
      const state = api?.getState?.();
      if (state?.ready) return true;
      if (state?.status === "blocked") return false;
      if (api?.ready && state?.status === "waiting") api.refresh?.();
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    return false;
  }

  async function refreshServerSchedule() {
    try {
      const schedule = window.FPL_STUDIO_SCHEDULE;
      if (typeof schedule?.refresh !== "function") return false;
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
      if (await refreshServerSchedule()) {
        updateGuardChip();
        return true;
      }
      if (window.FPL_STUDIO_SCHEDULE?.status === "unavailable") return false;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  function syncInputsToSchedule(force = false) {
    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") return false;
    const next = expectedNext();
    const start = String(startDateInput.value || "");
    if (force || !isIsoDate(start) || start < next.date) startDateInput.value = next.date;
    updateGuardChip();
    return true;
  }

  function validateScheduleSelection() {
    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") return { ok: false, reason: "The live Supabase schedule is not ready." };
    const next = expectedNext();
    const start = String(startDateInput.value || "");
    if (start !== next.date) {
      startDateInput.value = next.date;
      updateGuardChip();
      return { ok: false, reason: `Schedule synced to ${next.date}. Press Generate again.` };
    }
    const dates = new Set(serverRows().map(row => row.date));
    for (let index = 0; index < DAYS_IN_BATCH; index += 1) {
      const date = addDaysIso(start, index);
      if (dates.has(date)) return { ok: false, reason: `${date} is already scheduled in Supabase.` };
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
    return Number(b?.qualityScore || 0) - Number(a?.qualityScore || 0) || String(a?.id || "").localeCompare(String(b?.id || ""));
  }

  function recordOrder(records, usedIds, recentIds) {
    const unused = [], recycled = [], recent = [];
    for (const record of [...(records || [])].sort(recordQualityCompare)) {
      const id = String(record?.id || "");
      if (!usedIds.has(id)) unused.push(record);
      else if (recentIds.has(id)) recent.push(record);
      else recycled.push(record);
    }
    return [...unused, ...recycled, ...recent];
  }

  function assignAnyRecords(records, positionNeeds, offset = 0) {
    const assigned = Object.fromEntries(POSITION_ORDER.map(position => [position, []]));
    const anyLoads = Object.fromEntries(POSITION_ORDER.map(position => [position, 0]));
    for (const record of records || []) {
      const position = String(record?.position || "");
      if (POSITION_ORDER.includes(position)) {
        assigned[position].push(record);
        continue;
      }
      if (position !== "ANY") continue;
      const choices = [...POSITION_ORDER].sort((left, right) => {
        const leftRatio = anyLoads[left] / Math.max(1, positionNeeds[left]);
        const rightRatio = anyLoads[right] / Math.max(1, positionNeeds[right]);
        const leftTie = (POSITION_ORDER.indexOf(left) - offset + POSITION_ORDER.length) % POSITION_ORDER.length;
        const rightTie = (POSITION_ORDER.indexOf(right) - offset + POSITION_ORDER.length) % POSITION_ORDER.length;
        return leftRatio - rightRatio || leftTie - rightTie;
      });
      const chosen = choices[0];
      assigned[chosen].push(record);
      anyLoads[chosen] += 1;
    }
    return assigned;
  }

  function excludedTopPlayerId(prompt) {
    if (String(prompt?.family || "") !== "exclude-top-result") return "";
    const condition = (prompt.conditions || []).find(item => item?.field === "playerId" && item?.operator === "notEquals");
    return String(condition?.value || "");
  }

  function topAnswerForPrompt(prompt) {
    if (topAnswerCache.has(prompt)) return topAnswerCache.get(prompt);
    let best = null;
    try { best = core.getPromptStats(prompt)?.bestAnswer || null; } catch (_) {}
    topAnswerCache.set(prompt, best);
    return best;
  }

  function topAnswerDiversityAudit(prompts) {
    const counts = new Map();
    for (const prompt of prompts || []) {
      const best = topAnswerForPrompt(prompt);
      const playerId = String(best?.playerId || "");
      if (!playerId) continue;
      const row = counts.get(playerId) || { playerId, name: String(best?.playerName || best?.name || playerId), count: 0 };
      row.count += 1;
      counts.set(playerId, row);
    }
    const repeatedPlayers = [...counts.values()].filter(item => item.count > 1)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      promptCount: (prompts || []).length,
      uniquePlayers: counts.size,
      repeatSlots: repeatedPlayers.reduce((sum, item) => sum + item.count - 1, 0),
      maxCount: repeatedPlayers[0]?.count || ((prompts || []).length ? 1 : 0),
      repeatedPlayers
    };
  }

  async function certifyCandidate(record, position, limits, cutoverApi, cache) {
    const key = `${record.id}|${position}`;
    if (cache.has(key)) return cache.get(key);
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
    try { stats = core.getPromptStats(prompt); } catch (_) {
      cache.set(key, null);
      return null;
    }
    const count = Number(stats?.playerCount || 0);
    const evidenceConsistent = sourcePosition === "ANY" ? count > 0 && count <= stored : count === stored;
    if (!evidenceConsistent || count < limits.min || count > limits.max) {
      cache.set(key, null);
      return null;
    }
    const frozenPrompt = Object.freeze(prompt);
    topAnswerCache.set(frozenPrompt, stats?.bestAnswer || null);
    const candidate = Object.freeze({
      record,
      prompt: frozenPrompt,
      sourceId: String(record.id || ""),
      family: String(record.family || ""),
      position,
      playerCount: count,
      bestAnswer: stats?.bestAnswer || null,
      excludedPlayerId: excludedTopPlayerId(frozenPrompt)
    });
    cache.set(key, candidate);
    return candidate;
  }

  async function buildCandidateBank(payload, cutoverApi, positionNeeds, layoutOffset, usedIds, recentIds, limits, runtimeCache) {
    const byPosition = Object.fromEntries(POSITION_ORDER.map(position => [position, []]));
    let scanned = 0;
    const shardRows = [...(payload.shards || [])].sort((a, b) => String(a.family).localeCompare(String(b.family)));
    for (const shard of shardRows) {
      const family = String(shard.family || "");
      const ordered = recordOrder(Array.isArray(shard.records) ? shard.records : [], usedIds, recentIds);
      const assigned = assignAnyRecords(ordered, positionNeeds, layoutOffset);
      for (const position of POSITION_ORDER) {
        const bankTarget = family === "nationality" || family === "exclude-top-result"
          ? 14
          : Math.max(8, Math.ceil(Number(positionNeeds[position] || 0) / 3));
        let accepted = 0;
        for (const record of assigned[position]) {
          if (accepted >= bankTarget) break;
          const candidate = await certifyCandidate(record, position, limits, cutoverApi, runtimeCache);
          scanned += 1;
          if (candidate) {
            byPosition[position].push(candidate);
            accepted += 1;
          }
          if (scanned > 0 && scanned % 100 === 0) {
            setStatus(`Generator v3 certifying candidates · layout ${layoutOffset + 1}/4 · ${scanned.toLocaleString("en-GB")} checked…`, "working");
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
    }
    return { byPosition, scanned };
  }

  function hashText(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function candidateJitter(candidate, seed) {
    return (hashText(`${candidate.sourceId}|${candidate.position}|${seed}`) % 1000) / 1000;
  }

  function familyMinimums(families) {
    const minimums = Object.fromEntries(families.map(family => [family, 1]));
    if (Object.hasOwn(minimums, "nationality")) minimums.nationality = NATIONALITY_WEEKLY_TARGET;
    if (Object.hasOwn(minimums, "exclude-top-result")) minimums["exclude-top-result"] = EXCLUDE_TOP_RESULT_WEEKLY_MIN;
    return minimums;
  }

  function scoreCandidate(candidate, state, semantic, usedIds, recentIds, seed) {
    const familyLoad = Number(state.familyCounts.get(candidate.family) || 0);
    const leader = String(candidate.bestAnswer?.playerId || "");
    const leaderLoad = leader ? Number(state.leaderCounts.get(leader) || 0) : 0;
    const excludedLoad = candidate.excludedPlayerId ? Number(state.leaderCounts.get(candidate.excludedPlayerId) || 0) : 0;
    const quality = Number(candidate.record?.qualityScore || 0);
    const unusedBonus = !usedIds.has(candidate.sourceId) ? 90 : recentIds.has(candidate.sourceId) ? -70 : 15;
    const answerPoolBonus = Math.max(0, 35 - Math.abs(candidate.playerCount - 30) * 0.55);
    const familyPenalty = familyLoad * 8 + Math.max(0, familyLoad - 5) * 24;
    const leaderPenalty = leaderLoad * 75 + (leaderLoad >= 3 ? 450 : 0);
    const semanticPenalty = Number(semantic.weeklyLoad?.(candidate.prompt, state.semanticCounts) || 0) * 18;
    const unseenFamilyBonus = familyLoad === 0 ? 55 : 0;
    const exclusionReliefBonus = candidate.family === "exclude-top-result" ? excludedLoad * 95 : 0;
    const antiMetaBonus = candidate.prompt.tags?.includes("anti-meta") && state.antiMetaCount < state.antiMetaRequired ? 35 : 0;
    return quality + unusedBonus + answerPoolBonus + unseenFamilyBonus + exclusionReliefBonus + antiMetaBonus
      - familyPenalty - leaderPenalty - semanticPenalty + candidateJitter(candidate, seed);
  }

  function eligibleCandidate(candidate, state, semantic, familyCaps = null) {
    if (!candidate?.sourceId || state.sourceIds.has(candidate.sourceId)) return false;
    if (Number(state.remaining[candidate.position] || 0) <= 0) return false;
    if (!semantic.canAddWeekly(candidate.prompt, state.semanticCounts, DAYS_IN_BATCH)) return false;
    if (familyCaps && Number.isFinite(familyCaps[candidate.family]) && Number(state.familyCounts.get(candidate.family) || 0) >= familyCaps[candidate.family]) return false;
    return true;
  }

  function commitCandidate(candidate, state, semantic) {
    state.selected.push(candidate);
    state.sourceIds.add(candidate.sourceId);
    state.remaining[candidate.position] -= 1;
    state.familyCounts.set(candidate.family, Number(state.familyCounts.get(candidate.family) || 0) + 1);
    const leader = String(candidate.bestAnswer?.playerId || "");
    if (leader) state.leaderCounts.set(leader, Number(state.leaderCounts.get(leader) || 0) + 1);
    semantic.commitWeekly(candidate.prompt, state.semanticCounts);
    if (candidate.prompt.tags?.includes("anti-meta")) state.antiMetaCount += 1;
  }

  function chooseBest(options, state, semantic, usedIds, recentIds, seed) {
    return options
      .map(candidate => ({ candidate, score: scoreCandidate(candidate, state, semantic, usedIds, recentIds, seed) }))
      .sort((a, b) => b.score - a.score || a.candidate.sourceId.localeCompare(b.candidate.sourceId))[0]?.candidate || null;
  }

  function selectReservoirFromBank(bank, families, positionNeeds, usedIds, recentIds, semantic, antiMetaRequired, seed) {
    const minimums = familyMinimums(families);
    const minimumTotal = Object.values(minimums).reduce((sum, value) => sum + Number(value || 0), 0);
    if (minimumTotal > WEEKLY_PROMPTS) return null;
    const familyCaps = { nationality: NATIONALITY_WEEKLY_TARGET, "exclude-top-result": EXCLUDE_TOP_RESULT_WEEKLY_MAX };
    const state = {
      selected: [], sourceIds: new Set(), remaining: { ...positionNeeds },
      familyCounts: new Map(), leaderCounts: new Map(), semanticCounts: new Map(),
      antiMetaCount: 0, antiMetaRequired
    };
    const allCandidates = POSITION_ORDER.flatMap(position => bank.byPosition[position] || []);
    const familyCandidateCounts = new Map();
    for (const family of families) familyCandidateCounts.set(family, allCandidates.filter(candidate => candidate.family === family).length);
    const tokens = [];
    for (const family of families) {
      for (let index = 0; index < Number(minimums[family] || 0); index += 1) tokens.push({ family, index });
    }
    tokens.sort((a, b) => {
      const scarcityA = Number(familyCandidateCounts.get(a.family) || 0) / Math.max(1, Number(minimums[a.family] || 1));
      const scarcityB = Number(familyCandidateCounts.get(b.family) || 0) / Math.max(1, Number(minimums[b.family] || 1));
      return scarcityA - scarcityB || a.family.localeCompare(b.family) || a.index - b.index;
    });

    for (const token of tokens) {
      const options = allCandidates.filter(candidate => candidate.family === token.family && eligibleCandidate(candidate, state, semantic, familyCaps));
      const chosen = chooseBest(options, state, semantic, usedIds, recentIds, seed + state.selected.length);
      if (!chosen) return null;
      commitCandidate(chosen, state, semantic);
    }

    while (state.selected.length < WEEKLY_PROMPTS) {
      const positionPressure = POSITION_ORDER
        .filter(position => Number(state.remaining[position] || 0) > 0)
        .map(position => {
          const eligible = (bank.byPosition[position] || []).filter(candidate => eligibleCandidate(candidate, state, semantic, familyCaps)).length;
          return { position, ratio: eligible / Math.max(1, Number(state.remaining[position] || 0)), eligible };
        })
        .sort((a, b) => a.ratio - b.ratio || a.eligible - b.eligible || POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));
      const chosenPosition = positionPressure[0]?.position;
      if (!chosenPosition) return null;
      const options = (bank.byPosition[chosenPosition] || []).filter(candidate => eligibleCandidate(candidate, state, semantic, familyCaps));
      const chosen = chooseBest(options, state, semantic, usedIds, recentIds, seed + state.selected.length);
      if (!chosen) return null;
      commitCandidate(chosen, state, semantic);
    }

    if (POSITION_ORDER.some(position => Number(state.remaining[position] || 0) !== 0)) return null;
    for (const family of families) if (Number(state.familyCounts.get(family) || 0) < Number(minimums[family] || 0)) return null;
    if (state.antiMetaCount < antiMetaRequired) return null;
    return { state, minimums, allCandidates };
  }

  function rebuildStateFromSelection(selected, positionNeeds, antiMetaRequired, semantic) {
    const state = {
      selected: [], sourceIds: new Set(), remaining: { ...positionNeeds },
      familyCounts: new Map(), leaderCounts: new Map(), semanticCounts: new Map(),
      antiMetaCount: 0, antiMetaRequired
    };
    for (const candidate of selected) commitCandidate(candidate, state, semantic);
    return state;
  }

  function repairLeaderConcentration(selection, bank, positionNeeds, semantic, antiMetaRequired, seed) {
    let selected = [...selection.state.selected];
    const minimums = selection.minimums;
    let swaps = 0;
    for (; swaps < 12; swaps += 1) {
      const state = rebuildStateFromSelection(selected, positionNeeds, antiMetaRequired, semantic);
      const overloaded = [...state.leaderCounts.entries()].filter(([, count]) => count > 3)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      if (!overloaded) return { selected, swaps };
      const [leaderId] = overloaded;
      const usedSourceIds = new Set(selected.map(candidate => candidate.sourceId));
      const victimIndexes = selected.map((candidate, index) => ({ candidate, index }))
        .filter(item => String(item.candidate.bestAnswer?.playerId || "") === leaderId)
        .filter(item => Number(state.familyCounts.get(item.candidate.family) || 0) > Number(minimums[item.candidate.family] || 0))
        .map(item => item.index);
      let replaced = false;
      for (const victimIndex of victimIndexes) {
        const victim = selected[victimIndex];
        const withoutVictim = selected.filter((_, index) => index !== victimIndex);
        const baseState = rebuildStateFromSelection(withoutVictim, positionNeeds, antiMetaRequired, semantic);
        const options = (bank.byPosition[victim.position] || []).filter(candidate => {
          if (usedSourceIds.has(candidate.sourceId)) return false;
          if (!semantic.canAddWeekly(candidate.prompt, baseState.semanticCounts, DAYS_IN_BATCH)) return false;
          const familyAfter = Number(baseState.familyCounts.get(candidate.family) || 0) + 1;
          if (candidate.family === "nationality" && familyAfter > NATIONALITY_WEEKLY_TARGET) return false;
          if (candidate.family === "exclude-top-result" && familyAfter > EXCLUDE_TOP_RESULT_WEEKLY_MAX) return false;
          const newLeader = String(candidate.bestAnswer?.playerId || "");
          return !newLeader || Number(baseState.leaderCounts.get(newLeader) || 0) < 3;
        });
        const chosen = options
          .map(candidate => {
            const relief = candidate.excludedPlayerId === leaderId ? 120 : 0;
            const quality = Number(candidate.record?.qualityScore || 0);
            const newLeader = String(candidate.bestAnswer?.playerId || "");
            const leaderLoad = newLeader ? Number(baseState.leaderCounts.get(newLeader) || 0) : 0;
            return { candidate, score: relief + quality - leaderLoad * 80 + candidateJitter(candidate, seed + swaps) };
          })
          .sort((a, b) => b.score - a.score || a.candidate.sourceId.localeCompare(b.candidate.sourceId))[0]?.candidate;
        if (!chosen) continue;
        selected[victimIndex] = chosen;
        replaced = true;
        break;
      }
      if (!replaced) return { selected, swaps, unresolved: true };
    }
    return { selected, swaps, unresolved: true };
  }

  function familyCountsFor(prompts) {
    const counts = {};
    for (const prompt of prompts || []) counts[prompt.family] = (counts[prompt.family] || 0) + 1;
    return counts;
  }

  function objectiveFor(prompts) {
    const diversity = topAnswerDiversityAudit(prompts);
    const families = familyCountsFor(prompts);
    const maxFamily = Math.max(0, ...Object.values(families));
    return { diversity, maxFamily };
  }

  function betterReservoir(left, right) {
    if (!right) return true;
    const a = left.objective, b = right.objective;
    if (a.diversity.maxCount !== b.diversity.maxCount) return a.diversity.maxCount < b.diversity.maxCount;
    if (a.diversity.repeatSlots !== b.diversity.repeatSlots) return a.diversity.repeatSlots < b.diversity.repeatSlots;
    return a.maxFamily < b.maxFamily;
  }

  async function buildCertifiedReservoir() {
    const cutoverApi = window.FPL_DAILY_LIBRARY_CUTOVER_V1;
    const cutover = cutoverApi?.getState?.();
    if (!cutover?.ready) throw new Error(cutover?.reason || "The curated Daily library is not ready.");
    const payload = await window.FPL_PROMPT_LIBRARY_SHARDS_V1?.buildRepositoryPackage?.();
    if (!payload?.manifest || !Array.isArray(payload.shards)) throw new Error("The curated Prompt Library package could not be read.");
    if (String(payload.manifest.promotionFingerprint || "") !== String(cutover.manifest?.promotionFingerprint || "")) {
      throw new Error("The saved prompt package changed after Daily certification. Refresh Studio before generating.");
    }

    const families = (cutover.familyIndex || []).filter(row => Number(row?.total || 0) > 0).map(row => String(row.family));
    const positionNeeds = weeklyPositionNeeds();
    const usedIds = knownUsedSourceIds();
    const recentIds = knownRecentSourceIds(7);
    const limits = answerLimits();
    const runtimeCache = new Map();
    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    const antiMetaRequired = Math.max(0, Number(minAntiMetaInput?.value) || 0) * DAYS_IN_BATCH;
    const baseSeed = hashText(String(startDateInput.value || "") + "|" + String(formationInput?.value || "4-4-2"));
    let best = null;

    for (let layoutOffset = 0; layoutOffset < POSITION_ORDER.length; layoutOffset += 1) {
      const bank = await buildCandidateBank(payload, cutoverApi, positionNeeds, layoutOffset, usedIds, recentIds, limits, runtimeCache);
      const totalCandidates = POSITION_ORDER.reduce((sum, position) => sum + (bank.byPosition[position]?.length || 0), 0);
      setStatus(`Generator v3 selecting 77 from ${totalCandidates.toLocaleString("en-GB")} certified candidates · layout ${layoutOffset + 1}/4…`, "working");
      await new Promise(resolve => setTimeout(resolve, 0));

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const seed = baseSeed + layoutOffset * 101 + attempt * 997;
        const selection = selectReservoirFromBank(bank, families, positionNeeds, usedIds, recentIds, semantic, antiMetaRequired, seed);
        if (!selection) continue;
        const repaired = repairLeaderConcentration(selection, bank, positionNeeds, semantic, antiMetaRequired, seed);
        const prompts = repaired.selected.map(candidate => candidate.prompt);
        if (prompts.length !== WEEKLY_PROMPTS || new Set(prompts.map(prompt => String(prompt.id))).size !== WEEKLY_PROMPTS) continue;
        const familyCounts = familyCountsFor(prompts);
        if (families.some(family => Number(familyCounts[family] || 0) < 1)) continue;
        if (Number(familyCounts.nationality || 0) !== NATIONALITY_WEEKLY_TARGET) continue;
        if (Number(familyCounts["exclude-top-result"] || 0) < EXCLUDE_TOP_RESULT_WEEKLY_MIN) continue;

        const objective = objectiveFor(prompts);
        const reservoir = {
          prompts: Object.freeze(prompts),
          ids: new Set(prompts.map(prompt => String(prompt.id))),
          objective,
          plan: Object.freeze({
            version: VERSION,
            source: "daily-generator-v3-clean-selector",
            promotionFingerprint: String(payload.manifest.promotionFingerprint || ""),
            total: WEEKLY_PROMPTS,
            positionNeeds: Object.freeze({ ...positionNeeds }),
            familyCounts: Object.freeze({ ...familyCounts }),
            knownUsedSourceIds: usedIds.size,
            recentSourceIds: recentIds.size,
            runtimeCandidatesChecked: runtimeCache.size,
            candidateBankSize: totalCandidates,
            layoutOffset,
            selectionAttempt: attempt + 1,
            leaderRepairSwaps: repaired.swaps,
            leaderRepairUnresolved: Boolean(repaired.unresolved),
            topAnswerDiversity: Object.freeze({ ...objective.diversity, repeatedPlayers: Object.freeze(objective.diversity.repeatedPlayers.map(item => Object.freeze({ ...item }))) }),
            antiMetaCount: prompts.filter(prompt => prompt.tags?.includes("anti-meta")).length,
            nationalityCount: Number(familyCounts.nationality || 0),
            excludeTopResultCount: Number(familyCounts["exclude-top-result"] || 0),
            semanticDiversityVersion: String(semantic?.version || "")
          })
        };
        if (betterReservoir(reservoir, best)) best = reservoir;
        if (objective.diversity.maxCount <= 3) return reservoir;
      }
    }

    if (best) return best;
    throw new Error("Generator v3 could not assemble 77 runtime-certified prompts for the selected formation. Try again after reviewing the saved library coverage.");
  }

  function installGenerationSnapshot(reservoir) {
    const prompts = reservoir.prompts;
    window.FPL_DAILY_GENERATION_PROMPT_POOL = prompts;
    window.FPL_DAILY_GENERATION_FAMILY_PLAN = reservoir.plan;
    lastPlan = reservoir.plan;
    return Object.freeze({
      ids: reservoir.ids, prompts, plan: reservoir.plan,
      clear() {
        if (window.FPL_DAILY_GENERATION_PROMPT_POOL === prompts) delete window.FPL_DAILY_GENERATION_PROMPT_POOL;
        if (window.FPL_DAILY_GENERATION_FAMILY_PLAN === reservoir.plan) delete window.FPL_DAILY_GENERATION_FAMILY_PLAN;
      }
    });
  }

  function certifyGeneratedResults(snapshot) {
    const results = window.FPL_STUDIO_BATCH_CALENDAR?.getResults?.() || [];
    if (!Array.isArray(results) || results.length !== DAYS_IN_BATCH) {
      return { ok: false, reason: `Only ${Array.isArray(results) ? results.length : 0}/${DAYS_IN_BATCH} days were produced.` };
    }
    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    const promptById = new Map((snapshot.prompts || []).map(prompt => [String(prompt.id), prompt]));
    const weekIds = [];
    for (const result of results) {
      const day = result?.releaseDate || result?.date || "A generated day";
      if (result?.status !== "PASS") return { ok: false, reason: `${day} has status ${result?.status || "missing"}: ${result?.issues?.[0] || "validation failed"}.` };
      if (!Array.isArray(result.promptIds) || result.promptIds.length !== PROMPTS_PER_DAY) return { ok: false, reason: `${day} did not return exactly ${PROMPTS_PER_DAY} prompt IDs.` };
      if (result.promptIds.some(id => !snapshot.ids.has(String(id)))) return { ok: false, reason: `${day} used a prompt outside the immutable v3 snapshot.` };
      const dayPrompts = result.promptIds.map(id => promptById.get(String(id))).filter(Boolean);
      const semanticIssues = semantic?.dayIssues?.(dayPrompts) || [];
      if (semanticIssues.length) return { ok: false, reason: `${day} contains overly similar prompts: ${semanticIssues[0].description}.` };
      const dayDiversity = topAnswerDiversityAudit(dayPrompts);
      if (dayDiversity.repeatSlots) {
        const repeated = dayDiversity.repeatedPlayers[0];
        return { ok: false, reason: `${day} repeats top-answer player ${repeated?.name || repeated?.playerId || "unknown"}.` };
      }
      weekIds.push(...result.promptIds.map(String));
    }
    const unique = new Set(weekIds);
    if (weekIds.length !== WEEKLY_PROMPTS || unique.size !== WEEKLY_PROMPTS) return { ok: false, reason: `The week used ${unique.size}/${WEEKLY_PROMPTS} unique snapshot prompts.` };
    return { ok: true, topAnswerDiversity: topAnswerDiversityAudit(snapshot.prompts || []) };
  }

  async function guardedGenerate() {
    if (generationRunning) return;
    generationRunning = true;
    generateButton.disabled = true;
    let generationSnapshot = null;
    try {
      await ensureSemanticDiversity();
      if (!await waitForCutover()) {
        setStatus(`Generation is blocked until the curated library passes Daily certification${cutoverState()?.reason ? `: ${cutoverState().reason}` : "."}`, "fail");
        return;
      }
      if (!await waitForServerSchedule()) {
        setStatus("Generation is locked until the live Supabase schedule is available.", "fail");
        return;
      }
      const scheduleCheck = validateScheduleSelection();
      if (!scheduleCheck.ok) {
        setStatus(scheduleCheck.reason, "fail");
        return;
      }

      setStatus("Generator v3 · building one compact runtime-certified candidate bank…", "working");
      const reservoir = await buildCertifiedReservoir();
      generationSnapshot = installGenerationSnapshot(reservoir);
      const diversity = reservoir.plan.topAnswerDiversity;
      setStatus(`Generator v3 locked 77 prompts · ${diversity.uniquePlayers}/77 unique top-answer players · max leader count ${diversity.maxCount} · generating seven days…`, "working");

      const generator = window.FPL_STUDIO_BATCH_CALENDAR?.generate;
      if (typeof generator !== "function") {
        setStatus("The seven-day calendar generator is unavailable. Reload Studio and try again.", "fail");
        return;
      }
      await generator();
      const certification = certifyGeneratedResults(generationSnapshot);
      if (!certification.ok) {
        window.FPL_STUDIO_BATCH_CALENDAR?.clear?.();
        setStatus(`Generator v3 week validation failed: ${certification.reason} The batch was cleared.`, "fail");
        return;
      }
      updateGuardChip();
      setStatus(`Generator v3 PASS · all 77 prompts used exactly once · ${certification.topAnswerDiversity.uniquePlayers}/77 unique top-answer players · 18 families represented · ready to review and publish.`, "pass");
      window.dispatchEvent(new CustomEvent("fpl:daily-saved-library-week-certified", { detail: { ...reservoir.plan } }));
    } catch (error) {
      console.error(error);
      setStatus(`Generator v3 stopped generation: ${error instanceof Error ? error.message : String(error)}`, "fail");
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

  window.FPL_DAILY_GENERATOR_V3 = Object.freeze({
    version: VERSION,
    getLastPlan: () => lastPlan,
    generate: guardedGenerate
  });

  installGuardChip();
  updateGuardChip();
  setTimeout(() => {
    waitForServerSchedule(5000).then(() => syncInputsToSchedule(false)).catch(() => updateGuardChip());
  }, 0);
})();
