/* FPL Challenge Studio — Daily Challenge scheduler + saved-library generation guard v2.0.0.
   Builds one immutable 77-prompt reservoir from the structurally certified promoted library,
   runtime-retests each selected prompt, preserves exact rotation, and matches the real 17-family
   library proportions across the seven-day week. */
(() => {
  "use strict";

  if (window.__FPL_DAILY_GENERATOR_GUARD_V2__) return;
  window.__FPL_DAILY_GENERATOR_GUARD_V2__ = true;

  const VERSION = "2.0.0";
  const DAYS_IN_BATCH = 7;
  const PROMPTS_PER_DAY = 11;
  const WEEKLY_PROMPTS = DAYS_IN_BATCH * PROMPTS_PER_DAY;
  const LONDON_TIMEZONE = "Europe/London";
  const CUTOVER_WAIT_MS = 30000;
  const NATIONALITY_WEEKLY_TARGET = DAYS_IN_BATCH;
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
    "club-count", "manager", "anti-meta", "value", "minutes-role", "composite-story"
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
  const firstNumberInput = document.getElementById("batchFirstNumber");
  const formationInput = document.getElementById("batchFormation");
  const minAnswersInput = document.getElementById("minAnswers");
  const maxAnswersInput = document.getElementById("maxAnswers");
  const minAntiMetaInput = document.getElementById("minAntiMeta");
  const status = document.getElementById("batchStatus");
  const manifestChip = document.getElementById("batchManifestChip");

  if (!core || !generateButton || !startDateInput || !firstNumberInput) return;

  let generationRunning = false;
  let guardChip = null;
  let lastPlan = null;

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
    const entries = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges)
      ? window.FPL_CHALLENGE_MANIFEST.challenges
      : [];
    return entries.map(entry => ({
      date: String(entry?.date || ""),
      number: Number(entry?.number) || 0,
      source: "manifest"
    })).filter(entry => isIsoDate(entry.date) && entry.number > 0);
  }

  function serverRows() {
    const rows = Array.isArray(window.FPL_STUDIO_SCHEDULE?.scheduled)
      ? window.FPL_STUDIO_SCHEDULE.scheduled
      : [];
    return rows.map(entry => ({
      date: String(entry?.release_date || entry?.releaseDate || ""),
      number: Number(entry?.challenge_number ?? entry?.challengeNumber) || 0,
      source: "server"
    })).filter(entry => isIsoDate(entry.date) && entry.number > 0);
  }

  function combinedSchedule() {
    const byDate = new Map();
    for (const row of manifestRows()) byDate.set(row.date, row);
    for (const row of serverRows()) byDate.set(row.date, row);
    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  function expectedNext() {
    const rows = combinedSchedule();
    if (!rows.length) return { date: addDaysIso(londonToday(), 1), number: 1, maxNumber: 0, consistent: true };
    const latest = rows[rows.length - 1];
    const maxNumber = rows.reduce((max, row) => Math.max(max, row.number), 0);
    return {
      date: addDaysIso(latest.date, 1),
      number: latest.number + 1,
      maxNumber,
      latest,
      consistent: latest.number === maxNumber
    };
  }

  function installGuardChip() {
    if (guardChip || document.getElementById("dailyGeneratorGuardChip")) {
      guardChip = document.getElementById("dailyGeneratorGuardChip");
      return;
    }
    guardChip = document.createElement("span");
    guardChip.id = "dailyGeneratorGuardChip";
    guardChip.className = "phase-chip";
    guardChip.textContent = "17-family pool checking…";
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
    const nextText = next?.date && next?.number ? `next #${next.number} · ${next.date}` : "live schedule pending";
    guardChip.textContent = `${poolText} · ${nextText}`;
    guardChip.title = "Generation builds a runtime-certified 77-prompt reservoir from the saved promoted library, then locks that immutable reservoir for the whole seven-day run.";
  }

  async function waitForCutover() {
    const initial = cutoverState();
    if (initial?.ready) return true;
    window.FPL_STUDIO_BOOTSTRAP?.ensureDailyCutover?.();
    setStatus("Validating the saved promoted 17-family library before generation…", "working");
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
    if (!next.consistent) return false;
    const start = String(startDateInput.value || "");
    const number = Number(firstNumberInput.value) || 0;
    const stale = !isIsoDate(start) || start < next.date || number <= next.maxNumber;
    if (force || stale) {
      startDateInput.value = next.date;
      firstNumberInput.value = String(next.number);
    }
    updateGuardChip();
    return true;
  }

  function validateScheduleSelection() {
    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") {
      return { ok: false, reason: "The live Supabase schedule is not ready. Generation stays locked until the server schedule has been refreshed successfully." };
    }
    const next = expectedNext();
    if (!next.consistent) {
      return { ok: false, reason: `Challenge numbering is inconsistent: the latest dated challenge is #${next.latest?.number || "?"}, but #${next.maxNumber} is already reserved elsewhere. Resolve the schedule before generating.` };
    }

    const start = String(startDateInput.value || "");
    const first = Number(firstNumberInput.value) || 0;
    if (start !== next.date || first !== next.number) {
      startDateInput.value = next.date;
      firstNumberInput.value = String(next.number);
      updateGuardChip();
      return {
        ok: false,
        reason: `Schedule synced to the next unused slot: ${next.date}, Challenge #${next.number}. Press Generate week again to build #${next.number}–#${next.number + DAYS_IN_BATCH - 1}.`
      };
    }

    const dates = new Set(serverRows().map(row => row.date));
    const numbers = new Set(serverRows().map(row => row.number));
    for (let index = 0; index < DAYS_IN_BATCH; index += 1) {
      const date = addDaysIso(start, index);
      const number = first + index;
      if (dates.has(date) || numbers.has(number)) {
        return { ok: false, reason: `${date} / Challenge #${number} is already scheduled in Supabase. Remove that scheduled day or week before regenerating it.` };
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
    for (const entry of window.FPL_STUDIO_PHASE3?.getHistory?.() || []) addIds(entry?.promptIds);
    return used;
  }

  function allocateFamilyTargets(familyIndex) {
    const rows = (familyIndex || []).filter(row => Number(row?.total || 0) > 0);
    if (!rows.length) return null;
    const targets = Object.fromEntries(rows.map(row => [row.family, 0]));
    const nationality = rows.find(row => row.family === "nationality");
    if (!nationality) return null;
    targets.nationality = NATIONALITY_WEEKLY_TARGET;

    const others = rows.filter(row => row.family !== "nationality");
    let remaining = WEEKLY_PROMPTS - NATIONALITY_WEEKLY_TARGET;
    for (const row of others) {
      targets[row.family] = 1;
      remaining -= 1;
    }
    if (remaining < 0) return null;

    const weightTotal = others.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const remainders = [];
    let allocated = 0;
    for (const row of others) {
      const raw = weightTotal ? remaining * Number(row.total || 0) / weightTotal : 0;
      const floor = Math.floor(raw);
      targets[row.family] += floor;
      allocated += floor;
      remainders.push({ family: row.family, remainder: raw - floor, weight: Number(row.total || 0) });
    }
    let left = remaining - allocated;
    remainders.sort((a, b) => b.remainder - a.remainder || b.weight - a.weight || a.family.localeCompare(b.family));
    for (let index = 0; index < left; index += 1) targets[remainders[index % remainders.length].family] += 1;
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

  function recordOrder(records, usedIds) {
    return [...records].sort((a, b) => {
      const usedA = usedIds.has(String(a?.id || "")) ? 1 : 0;
      const usedB = usedIds.has(String(b?.id || "")) ? 1 : 0;
      if (usedA !== usedB) return usedA - usedB;
      const passA = a?.qualityStatus === "pass" ? 1 : 0;
      const passB = b?.qualityStatus === "pass" ? 1 : 0;
      if (passA !== passB) return passB - passA;
      const scoreA = Number(a?.qualityScore || 0);
      const scoreB = Number(b?.qualityScore || 0);
      return scoreB - scoreA || String(a?.id || "").localeCompare(String(b?.id || ""));
    });
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
    const prompt = cutoverApi.materialiseRecord(record, position);
    if (!prompt || typeof prompt.test !== "function") {
      cache.set(key, null);
      return null;
    }
    prompt.tags = semanticTags(record, prompt);
    core.invalidatePromptStats?.(prompt.id);
    let stats;
    try {
      stats = core.getPromptStats(prompt);
    } catch (_) {
      cache.set(key, null);
      return null;
    }
    const count = Number(stats?.playerCount || 0);
    const stored = Number(record?.qualityEvidence?.answerPlayers || 0);
    const evidenceConsistent = record.position === "ANY" ? count > 0 && count <= stored : count === stored;
    if (!evidenceConsistent || count < limits.min || count > limits.max) {
      cache.set(key, null);
      return null;
    }
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

    const targets = allocateFamilyTargets(cutover.familyIndex);
    if (!targets || Object.values(targets).reduce((sum, value) => sum + Number(value || 0), 0) !== WEEKLY_PROMPTS) {
      throw new Error("The 17-family proportional weekly target could not be allocated to 77 prompt slots.");
    }
    const families = Object.keys(targets).filter(family => targets[family] > 0);
    const positionNeeds = weeklyPositionNeeds();
    const usedIds = knownUsedSourceIds();
    const limits = answerLimits();
    const runtimeCache = new Map();
    const cycleFamilies = new Set();
    const shardByFamily = new Map(payload.shards.map(shard => [String(shard.family), shard]));

    for (let anyOffset = 0; anyOffset < POSITION_ORDER.length; anyOffset += 1) {
      const candidatePools = new Map();
      let scanned = 0;
      for (const family of families) {
        const shard = shardByFamily.get(family);
        const raw = recordOrder(Array.isArray(shard?.records) ? shard.records : [], usedIds);
        if (raw.filter(record => !usedIds.has(String(record?.id || ""))).length < targets[family]) cycleFamilies.add(family);
        const assigned = assignAnyRecords(raw, positionNeeds, anyOffset);
        const certifiedByPosition = Object.fromEntries(POSITION_ORDER.map(position => [position, []]));
        for (const position of POSITION_ORDER) {
          const need = Math.min(targets[family], positionNeeds[position]);
          for (const record of assigned[position]) {
            if (certifiedByPosition[position].length >= need) break;
            const prompt = await certifyCandidate(record, position, limits, cutoverApi, runtimeCache);
            scanned += 1;
            if (prompt) certifiedByPosition[position].push({ record, prompt });
            if (scanned > 0 && scanned % 80 === 0) {
              setStatus(`Runtime-certifying the 17-family weekly reservoir · ${scanned.toLocaleString("en-GB")} compact candidates checked…`, "working");
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
        }
        candidatePools.set(family, certifiedByPosition);
      }

      const allocation = solveFamilyPositionFlow(families, targets, positionNeeds, candidatePools);
      if (!allocation) continue;

      const prompts = [];
      const sourceIds = new Set();
      let collision = false;
      for (const family of families) {
        for (const position of POSITION_ORDER) {
          const required = allocation[family][position];
          if (!required) continue;
          const available = candidatePools.get(family)?.[position] || [];
          let added = 0;
          for (const candidate of available) {
            const sourceId = String(candidate.record.id || "");
            if (!sourceId || sourceIds.has(sourceId)) continue;
            prompts.push(candidate.prompt);
            sourceIds.add(sourceId);
            added += 1;
            if (added >= required) break;
          }
          if (added !== required) {
            collision = true;
            break;
          }
        }
        if (collision) break;
      }
      if (collision || prompts.length !== WEEKLY_PROMPTS || sourceIds.size !== WEEKLY_PROMPTS) continue;

      const familyCounts = {};
      const positionCounts = {};
      let antiMetaCount = 0;
      let nationalityCount = 0;
      for (const prompt of prompts) {
        familyCounts[prompt.family] = (familyCounts[prompt.family] || 0) + 1;
        positionCounts[prompt.position] = (positionCounts[prompt.position] || 0) + 1;
        if (prompt.tags?.includes("anti-meta")) antiMetaCount += 1;
        if (prompt.family === "nationality") nationalityCount += 1;
      }
      if (families.some(family => familyCounts[family] !== targets[family])) continue;
      if (POSITION_ORDER.some(position => positionCounts[position] !== positionNeeds[position])) continue;
      if (nationalityCount !== NATIONALITY_WEEKLY_TARGET) continue;
      const antiMetaRequired = Math.max(0, Number(minAntiMetaInput?.value) || 0) * DAYS_IN_BATCH;
      if (antiMetaCount < antiMetaRequired) {
        throw new Error(`The proportional pool contains ${antiMetaCount} anti-meta prompts, below the configured weekly minimum of ${antiMetaRequired}. Lower the advanced anti-meta minimum or expand anti-meta-compatible saved prompts.`);
      }

      const frozenPrompts = Object.freeze(prompts.map(prompt => Object.freeze(prompt)));
      const ids = new Set(frozenPrompts.map(prompt => String(prompt.id)));
      if (ids.size !== WEEKLY_PROMPTS) continue;
      const plan = Object.freeze({
        version: VERSION,
        source: "saved-promoted-17-family-library",
        promotionFingerprint: String(payload.manifest.promotionFingerprint || ""),
        total: WEEKLY_PROMPTS,
        targets: Object.freeze({ ...targets }),
        positionNeeds: Object.freeze({ ...positionNeeds }),
        cycleFamilies: Object.freeze([...cycleFamilies]),
        knownUsedSourceIds: usedIds.size,
        runtimeCandidatesChecked: scanned,
        antiMetaCount,
        nationalityCount
      });
      return { prompts: frozenPrompts, ids, plan };
    }

    throw new Error("The saved 17-family library could not fill the selected formation with 77 runtime-certified prompts while preserving the proportional family targets.");
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

    const weekIds = [];
    for (const result of results) {
      const day = result?.releaseDate || result?.date || "A generated day";
      if (result?.status !== "PASS") return { ok: false, reason: `${day} has status ${result?.status || "missing"}: ${result?.issues?.[0] || "validation failed"}.` };
      if (!Array.isArray(result.promptIds) || result.promptIds.length !== PROMPTS_PER_DAY) return { ok: false, reason: `${day} did not return exactly ${PROMPTS_PER_DAY} prompt IDs.` };
      const uncertified = result.promptIds.filter(id => !snapshot.ids.has(String(id)));
      if (uncertified.length) return { ok: false, reason: `${day} contains prompt(s) outside the immutable saved-library reservoir: ${uncertified.slice(0, 3).join(", ")}.` };
      weekIds.push(...result.promptIds.map(String));
    }

    const uniqueWeekIds = new Set(weekIds);
    if (weekIds.length !== WEEKLY_PROMPTS || uniqueWeekIds.size !== WEEKLY_PROMPTS) {
      return { ok: false, reason: `The seven-day run used ${uniqueWeekIds.size}/${WEEKLY_PROMPTS} unique reservoir prompts; exact weekly rotation must consume all 77 exactly once.` };
    }
    const missing = [...snapshot.ids].filter(id => !uniqueWeekIds.has(id));
    if (missing.length) return { ok: false, reason: `${missing.length} runtime-certified reservoir prompt(s) were not consumed by the week.` };
    return { ok: true, reason: "" };
  }

  async function guardedGenerate() {
    if (generationRunning) return;
    generationRunning = true;
    generateButton.disabled = true;
    let generationSnapshot = null;
    try {
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

      setStatus("Building the proportional 77-prompt generation reservoir from unused saved prompts…", "working");
      const reservoir = await buildCertifiedReservoir();
      generationSnapshot = installGenerationSnapshot(reservoir);
      setStatus(`77 runtime-certified prompts locked · 17-family proportional cycle · ${reservoir.plan.cycleFamilies.length ? `${reservoir.plan.cycleFamilies.length} family cycle reset(s)` : "unused prompts preferred"}. Generating week…`, "working");

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
      setStatus(`Seven-day generation passed the saved-library guard: all 77 runtime-certified prompts were consumed exactly once and the 17-family weekly targets were preserved.`, "pass");
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
    getLastFamilyPlan: () => lastPlan ? { ...lastPlan, targets: { ...lastPlan.targets }, positionNeeds: { ...lastPlan.positionNeeds } } : null,
    sync: () => syncInputsToSchedule(true),
    generate: guardedGenerate
  });
})();
