/* FPL Challenge Studio Phase 9 — one-click conservative database cleaner. */
(() => {
  "use strict";

  const originalPlayers = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const promptLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const VALID_POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  const NUMERIC_FIELDS = [
    "points", "minutes", "goals", "assists", "cleanSheets", "bonus", "saves",
    "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice"
  ];
  const FORBIDDEN_COST = 1_000_000;

  const SPLIT_CATALOGUE = Object.freeze({
    "aaron-ramsey": [
      { id: "aaron-ramsey", label: "Arsenal era", keepBio: false, clearAge: true, test: season => season.club === "Arsenal" },
      { id: "aaron-ramsey-younger", label: "Aston Villa / Burnley", keepBio: true, test: season => season.club !== "Arsenal" }
    ],
    "james-wilson": [
      { id: "james-wilson", label: "Manchester United", keepBio: false, clearAge: true, test: season => season.club === "Man Utd" },
      { id: "james-wilson-spurs", label: "Tottenham Hotspur", keepBio: true, test: season => season.club === "Spurs" }
    ],
    "ben-davies": [
      { id: "ben-davies", label: "Tottenham Hotspur", keepBio: true, test: season => season.club === "Spurs" },
      { id: "ben-davies-liverpool", label: "Liverpool", keepBio: false, test: season => season.club === "Liverpool" }
    ],
    "danny-ward": [
      { id: "danny-ward", label: "Goalkeeper", keepBio: true, test: season => season.position === "GK" },
      { id: "danny-ward-cardiff", label: "Cardiff midfielder", keepBio: false, test: season => season.position !== "GK" }
    ],
    "alvaro-fernandez": [
      { id: "alvaro-fernandez", label: "Goalkeeper", keepBio: false, test: season => season.position === "GK" },
      { id: "alvaro-fernandez-defender", label: "Manchester United defender", keepBio: false, test: season => season.position === "DEF" }
    ]
  });

  const state = {
    running: false,
    workspace: null,
    changes: [],
    quarantine: [],
    blockers: [],
    regression: null
  };

  const elements = {};
  window.addEventListener("load", initialise, { once: true });

  function initialise() {
    [
      "autoRepairStatus", "autoRepairDetected", "autoRepairFixed", "autoRepairQuarantined",
      "autoRepairRemaining", "runAutoRepairBtn", "downloadAutoRepairBtn", "autoRepairProgressWrap",
      "autoRepairProgressText", "autoRepairProgressPercent", "autoRepairProgressBar", "autoRepairActionStatus",
      "autoRepairSummary", "autoRepairChangeList", "autoRepairRegressionList", "autoRepairDownloadStatus"
    ].forEach(id => elements[id] = document.getElementById(id));

    if (!elements.runAutoRepairBtn) return;
    elements.runAutoRepairBtn.addEventListener("click", runAutomaticRepair);
    elements.downloadAutoRepairBtn.addEventListener("click", downloadAutomaticRepairPack);

    window.FPL_AUTOMATIC_DATABASE_REPAIR = Object.freeze({
      run: runAutomaticRepair,
      getWorkspace: () => state.workspace,
      getChanges: () => cloneData(state.changes),
      getQuarantine: () => cloneData(state.quarantine),
      getRegression: () => cloneData(state.regression)
    });

    if (!originalPlayers.length) {
      setStatus("Database unavailable", "blocked");
      elements.autoRepairActionStatus.textContent = "players.js did not load, so automatic cleaning cannot run.";
      elements.runAutoRepairBtn.disabled = true;
      return;
    }

    const startingBlockers = findBlockingIssues(originalPlayers);
    elements.autoRepairDetected.textContent = startingBlockers.length.toLocaleString();
    elements.autoRepairFixed.textContent = "0";
    elements.autoRepairQuarantined.textContent = "0";
    elements.autoRepairRemaining.textContent = startingBlockers.length.toLocaleString();
    setStatus("Ready", "pending");
    elements.autoRepairActionStatus.textContent = "Press one button to build a cleaned copy, quarantine unsafe records and run every safety check.";
  }

  async function runAutomaticRepair() {
    if (state.running || !originalPlayers.length) return;
    state.running = true;
    state.workspace = null;
    state.changes = [];
    state.quarantine = [];
    state.blockers = [];
    state.regression = null;
    elements.runAutoRepairBtn.disabled = true;
    elements.downloadAutoRepairBtn.disabled = true;
    elements.autoRepairDownloadStatus.textContent = "";
    elements.autoRepairRegressionList.innerHTML = "";
    elements.autoRepairChangeList.innerHTML = "";
    toggleProgress(true, 2, "Cloning the original database…");
    setStatus("Auto-cleaning…", "pending");

    try {
      let database = cloneData(originalPlayers);
      await nextFrame();

      toggleProgress(true, 10, "Normalising text, numbers and league flags…");
      normaliseDatabase(database);
      await nextFrame();

      toggleProgress(true, 22, "Removing manager records accidentally imported as footballers…");
      database = removeNonPlayerRecords(database);
      await nextFrame();

      toggleProgress(true, 36, "Separating known same-name footballers…");
      database = applySplitCatalogue(database);
      await nextFrame();

      toggleProgress(true, 49, "Merging duplicate accent and ID variants…");
      database = mergeSafeIdentityVariants(database);
      await nextFrame();

      toggleProgress(true, 60, "Resolving remaining duplicate-season identities…");
      database = splitRemainingDuplicateSeasons(database);
      await nextFrame();

      toggleProgress(true, 70, "Withholding conflicting age data and quarantining unsafe seasons…");
      database = cleanAgesAndQuarantine(database);
      await nextFrame();

      toggleProgress(true, 77, "Finalising unique IDs and intentional same-name labels…");
      finaliseIdentities(database);
      state.blockers = findBlockingIssues(database);
      state.workspace = database;

      elements.autoRepairDetected.textContent = findBlockingIssues(originalPlayers).length.toLocaleString();
      elements.autoRepairFixed.textContent = state.changes.length.toLocaleString();
      elements.autoRepairQuarantined.textContent = state.quarantine.length.toLocaleString();
      elements.autoRepairRemaining.textContent = state.blockers.length.toLocaleString();
      renderSummary();
      renderChanges();
      await nextFrame();

      toggleProgress(true, 82, "Testing all enabled prompts…");
      const promptResult = testPromptLibrary(database);
      await nextFrame();

      toggleProgress(true, 90, "Checking the live daily challenge and perfect score…");
      const liveResult = await testLiveChallenge(database);
      await nextFrame();

      const originalCounts = databaseCounts(originalPlayers);
      const cleanedCounts = databaseCounts(database);
      const regressionRows = [];
      addRegression(regressionRows, state.blockers.length === 0 ? "pass" : "fail", "No structural blockers remain", state.blockers.length === 0 ? "The automatic cleaner resolved or quarantined every blocking record." : `${state.blockers.length} blocker(s) remain.`);
      addRegression(regressionRows, cleanedCounts.players <= originalCounts.players && cleanedCounts.players >= originalCounts.players - 80 ? "pass" : "fail", "Player-count change is controlled", `${originalCounts.players.toLocaleString()} → ${cleanedCounts.players.toLocaleString()} players.`);
      addRegression(regressionRows, cleanedCounts.seasons <= originalCounts.seasons && cleanedCounts.seasons >= originalCounts.seasons - 120 ? "pass" : "fail", "Season-count change is controlled", `${originalCounts.seasons.toLocaleString()} → ${cleanedCounts.seasons.toLocaleString()} player-seasons.`);
      addRegression(regressionRows, promptResult.errors.length === 0 ? "pass" : "fail", "Prompt tests execute without errors", promptResult.errors.length ? `${promptResult.errors.length} prompt test(s) threw an error.` : `${promptResult.checked} enabled prompts were evaluated.`);
      addRegression(regressionRows, promptResult.zero.length === 0 ? "pass" : "fail", "Every enabled prompt still has valid answers", promptResult.zero.length ? `${promptResult.zero.length} prompt(s) have no matching player-season.` : "No prompt became unusable.");
      if (promptResult.low.length) addRegression(regressionRows, "warn", "A few prompts have small answer pools", `${promptResult.low.length} prompt(s) have fewer than six valid footballers but still work.`);
      if (!liveResult.challenge) addRegression(regressionRows, "fail", "Live challenge could not be loaded", liveResult.error || "todays-challenge.js was unavailable.");
      else if (!liveResult.possible) addRegression(regressionRows, "fail", "Live challenge no longer has a unique XI", liveResult.reason || "No eleven-player assignment exists.");
      else {
        addRegression(regressionRows, "pass", "Live challenge still has eleven unique valid footballers", `${liveResult.challenge.prompts.length} prompts can be completed without reusing a player.`);
        const expected = Number(liveResult.challenge.perfectScore) || 0;
        addRegression(regressionRows, liveResult.score === expected ? "pass" : "fail", "Live perfect score remains correct", liveResult.score === expected ? `${liveResult.score.toLocaleString()} points matches todays-challenge.js.` : `Cleaned data calculates ${liveResult.score.toLocaleString()}, but todays-challenge.js stores ${expected.toLocaleString()}.`);
      }

      const failures = regressionRows.filter(row => row.status === "fail").length;
      state.regression = {
        generatedAt: new Date().toISOString(),
        originalCounts,
        cleanedCounts,
        blockers: cloneData(state.blockers),
        promptResult,
        liveResult: serialiseLiveResult(liveResult),
        rows: regressionRows,
        failures,
        uploadReady: failures === 0
      };

      renderRegression(regressionRows);
      toggleProgress(true, 100, failures ? "Automatic repair finished with failed safety checks" : "Automatic repair and safety checks complete");

      if (failures === 0) {
        setStatus("Upload-ready", "ready");
        elements.autoRepairActionStatus.textContent = `One-click cleaning finished: ${cleanedCounts.players.toLocaleString()} players, ${cleanedCounts.seasons.toLocaleString()} seasons and zero blocking errors.`;
        elements.downloadAutoRepairBtn.disabled = false;
      } else {
        setStatus(`${failures} safety failure${failures === 1 ? "" : "s"}`, "blocked");
        elements.autoRepairActionStatus.textContent = "Nothing has changed on the live game. Review the failed checks before downloading or uploading any database.";
      }
    } catch (error) {
      console.error(error);
      setStatus("Auto-clean failed", "blocked");
      elements.autoRepairActionStatus.textContent = `Automatic cleaning stopped safely: ${error.message || error}`;
      toggleProgress(true, 100, "Automatic repair stopped");
    } finally {
      state.running = false;
      elements.runAutoRepairBtn.disabled = false;
    }
  }

  function normaliseDatabase(database) {
    for (const player of database) {
      player.playerId = cleanWhitespace(player.playerId);
      player.name = cleanWhitespace(player.name);
      player.seasons = Array.isArray(player.seasons) ? player.seasons : [];
      for (const season of player.seasons) {
        for (const field of ["season", "club", "position"]) if (typeof season[field] === "string") season[field] = cleanWhitespace(season[field]);
        if (Array.isArray(season.managers)) season.managers = [...new Set(season.managers.map(cleanWhitespace).filter(Boolean))];
        for (const field of NUMERIC_FIELDS) {
          if (typeof season[field] === "string" && season[field].trim() !== "" && Number.isFinite(Number(season[field]))) {
            state.changes.push(change("convert-number", player, season, `${field}: ${season[field]} → ${Number(season[field])}`));
            season[field] = Number(season[field]);
          }
        }
        for (const priceField of ["startingPrice", "finalPrice"]) {
          if (Number.isFinite(season[priceField])) season[priceField] = Math.round(season[priceField] * 10) / 10;
        }
        recalculateLeagueFlags(season);
      }
    }
  }

  function removeNonPlayerRecords(database) {
    return database.filter(player => {
      const nonPlayer = player.seasons.some(season => !VALID_POSITIONS.has(season.position) && Number(season.startingPrice) < 3.5);
      if (!nonPlayer) return true;
      state.changes.push({ type: "remove-non-player", playerId: player.playerId, name: player.name, detail: `${player.seasons.length} manager/non-player season record(s) removed` });
      state.quarantine.push({ reason: "Manager or non-player record imported into the footballer pool", player: cloneData(player) });
      return false;
    });
  }

  function applySplitCatalogue(database) {
    const output = [];
    for (const player of database) {
      const rules = SPLIT_CATALOGUE[player.playerId];
      if (!rules) {
        output.push(player);
        continue;
      }
      const used = new Set();
      const created = [];
      for (const rule of rules) {
        const seasons = player.seasons.filter((season, index) => {
          if (used.has(index) || !rule.test(season)) return false;
          used.add(index);
          return true;
        });
        if (!seasons.length) continue;
        const newPlayer = {
          ...player,
          playerId: rule.id,
          identityDisambiguator: rule.label,
          seasons: seasons.map(season => ({ ...season })),
          bio: rule.keepBio ? cloneData(player.bio || {}) : {}
        };
        if (rule.clearAge) newPlayer.seasons.forEach(season => { season.ageAtSeasonStart = null; });
        created.push(newPlayer);
      }
      const remainder = player.seasons.filter((season, index) => !used.has(index));
      if (remainder.length) {
        created.push({ ...player, playerId: `${player.playerId}-other`, identityDisambiguator: "Other source record", seasons: remainder, bio: {} });
      }
      output.push(...created);
      state.changes.push({
        type: "split-composite-identity",
        playerId: player.playerId,
        name: player.name,
        detail: created.map(item => `${item.identityDisambiguator}: ${item.seasons.length} season(s)`).join("; ")
      });
    }
    return output;
  }

  function mergeSafeIdentityVariants(database) {
    const groups = new Map();
    database.forEach((player, index) => {
      const key = compactIdentity(player.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(index);
    });
    const removed = new Set();

    for (const indices of groups.values()) {
      if (indices.length < 2) continue;
      indices.sort((a, b) => database[b].seasons.length - database[a].seasons.length);
      const targetIndex = indices[0];
      for (const sourceIndex of indices.slice(1)) {
        if (removed.has(sourceIndex)) continue;
        const target = database[targetIndex];
        const source = database[sourceIndex];
        if (target.identityDisambiguator || source.identityDisambiguator) continue;
        const targetSeasons = new Set(target.seasons.map(season => season.season));
        if (source.seasons.some(season => targetSeasons.has(season.season))) continue;
        target.seasons.push(...source.seasons.map(season => ({ ...season })));
        target.seasons.sort((a, b) => (parseSeasonStartYear(b.season) || 0) - (parseSeasonStartYear(a.season) || 0));
        if (!Object.keys(target.bio || {}).length && Object.keys(source.bio || {}).length) target.bio = cloneData(source.bio);
        removed.add(sourceIndex);
        state.changes.push({ type: "merge-identity-variant", playerId: target.playerId, name: target.name, detail: `Merged duplicate ID ${source.playerId}` });
      }
    }
    return database.filter((_, index) => !removed.has(index));
  }

  function splitRemainingDuplicateSeasons(database) {
    const output = [];
    for (const player of database) {
      const labels = new Map();
      for (const season of player.seasons) labels.set(season.season, (labels.get(season.season) || 0) + 1);
      if (![...labels.values()].some(count => count > 1)) {
        output.push(player);
        continue;
      }

      const groups = new Map();
      for (const season of player.seasons) {
        const key = `${season.club}|${season.position}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(season);
      }
      const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
      sorted.forEach(([key, seasons], index) => {
        const [club, position] = key.split("|");
        output.push({
          ...player,
          playerId: index === 0 ? player.playerId : `${player.playerId}-${slugify(`${club}-${position}`)}`,
          identityDisambiguator: `${club} ${position}`,
          seasons: seasons.map(season => ({ ...season })),
          bio: index === 0 ? cloneData(player.bio || {}) : {}
        });
      });
      state.changes.push({ type: "split-duplicate-season-identity", playerId: player.playerId, name: player.name, detail: `Separated into ${sorted.length} club/position identities` });
    }
    return output;
  }

  function cleanAgesAndQuarantine(database) {
    const outputPlayers = [];
    for (const player of database) {
      const dob = parseDate(player.bio?.dateOfBirth);
      const seenExact = new Set();
      const cleanedSeasons = [];
      for (const season of player.seasons) {
        const exactKey = stableStringify(season);
        if (seenExact.has(exactKey)) {
          state.changes.push(change("remove-exact-duplicate-season", player, season, "Later identical record removed"));
          continue;
        }
        seenExact.add(exactKey);

        const seasonYear = parseSeasonStartYear(season.season);
        if (Number.isFinite(season.ageAtSeasonStart) && (season.ageAtSeasonStart < 15 || season.ageAtSeasonStart > 45)) {
          state.changes.push(change("withhold-impossible-age", player, season, `${season.ageAtSeasonStart} → null`));
          season.ageAtSeasonStart = null;
        } else if (dob && seasonYear && Number.isFinite(season.ageAtSeasonStart)) {
          const expected = ageOnDate(dob, new Date(Date.UTC(seasonYear, 7, 1)));
          if (Math.abs(season.ageAtSeasonStart - expected) > 1) {
            state.changes.push(change("withhold-conflicting-age", player, season, `${season.ageAtSeasonStart} conflicts with DOB; set to null`));
            season.ageAtSeasonStart = null;
          }
        } else if (dob && seasonYear && !Number.isFinite(season.ageAtSeasonStart)) {
          season.ageAtSeasonStart = ageOnDate(dob, new Date(Date.UTC(seasonYear, 7, 1)));
          state.changes.push(change("calculate-age", player, season, `Calculated ${season.ageAtSeasonStart}`));
        }

        const reasons = invalidSeasonReasons(season);
        if (reasons.length) {
          state.changes.push(change("quarantine-season", player, season, reasons.join(", ")));
          state.quarantine.push({ reason: reasons.join(", "), playerId: player.playerId, name: player.name, season: cloneData(season) });
          continue;
        }
        cleanedSeasons.push(season);
      }
      player.seasons = cleanedSeasons;
      if (cleanedSeasons.length) outputPlayers.push(player);
      else {
        state.quarantine.push({ reason: "No valid player-seasons remained after conservative cleaning", player: cloneData(player) });
        state.changes.push({ type: "remove-empty-player", playerId: player.playerId, name: player.name, detail: "No valid seasons remained" });
      }
    }
    return outputPlayers;
  }

  function finaliseIdentities(database) {
    const nameGroups = new Map();
    for (const player of database) {
      const key = compactIdentity(player.name);
      if (!nameGroups.has(key)) nameGroups.set(key, []);
      nameGroups.get(key).push(player);
    }
    for (const group of nameGroups.values()) {
      if (group.length < 2) continue;
      for (const player of group) {
        if (player.identityDisambiguator) continue;
        const clubs = [...new Set(player.seasons.map(season => season.club).filter(Boolean))];
        player.identityDisambiguator = clubs.slice(0, 2).join(" / ") || player.playerId;
        state.changes.push({ type: "add-identity-label", playerId: player.playerId, name: player.name, detail: player.identityDisambiguator });
      }
    }

    const usedIds = new Set();
    for (const player of database) {
      const originalId = player.playerId || slugify(player.name);
      let candidate = originalId;
      let suffix = 2;
      while (usedIds.has(candidate)) candidate = `${originalId}-${suffix++}`;
      if (candidate !== player.playerId) {
        state.changes.push({ type: "make-player-id-unique", playerId: candidate, name: player.name, detail: `${player.playerId} → ${candidate}` });
        player.playerId = candidate;
      }
      usedIds.add(candidate);
    }
  }

  function findBlockingIssues(database) {
    const issues = [];
    const ids = new Set();
    const names = new Map();
    for (const player of database) {
      const id = cleanWhitespace(player?.playerId);
      const name = cleanWhitespace(player?.name);
      const nameKey = compactIdentity(name);
      if (!id) issues.push({ code: "missing-player-id", target: name || "Unnamed record" });
      else if (ids.has(id)) issues.push({ code: "duplicate-player-id", target: id });
      else ids.add(id);
      if (!name) issues.push({ code: "missing-player-name", target: id || "Unnamed record" });
      if (nameKey) {
        if (!names.has(nameKey)) names.set(nameKey, []);
        names.get(nameKey).push(player);
      }
      const seasons = new Set();
      for (const season of Array.isArray(player?.seasons) ? player.seasons : []) {
        if (seasons.has(season.season)) issues.push({ code: "duplicate-player-season", target: `${name} · ${season.season}` });
        seasons.add(season.season);
        for (const reason of invalidSeasonReasons(season)) issues.push({ code: reason, target: `${name} · ${season.season}` });
        if (Number.isFinite(season.ageAtSeasonStart) && (season.ageAtSeasonStart < 15 || season.ageAtSeasonStart > 45)) issues.push({ code: "impossible-age", target: `${name} · ${season.season}` });
      }
    }
    for (const group of names.values()) {
      if (group.length > 1 && group.some(player => !player.identityDisambiguator)) {
        issues.push({ code: "unresolved-same-name-identities", target: group[0].name });
      }
    }
    return issues;
  }

  function invalidSeasonReasons(season) {
    const reasons = [];
    if (!season.club) reasons.push("missing club");
    if (!VALID_POSITIONS.has(season.position)) reasons.push("invalid position");
    for (const field of NUMERIC_FIELDS) {
      if (!Number.isFinite(season[field])) reasons.push(`invalid ${field}`);
      else if (field !== "points" && season[field] < 0) reasons.push(`negative ${field}`);
    }
    for (const field of ["startingPrice", "finalPrice"]) {
      if (Number.isFinite(season[field]) && (season[field] < 3.5 || season[field] > 15.5)) reasons.push(`invalid ${field}`);
    }
    const leaguePosition = season.leaguePosition;
    if (Number.isFinite(leaguePosition) && (leaguePosition < 1 || leaguePosition > 20)) reasons.push("invalid league position");
    return [...new Set(reasons)];
  }

  function testPromptLibrary(database) {
    const flat = flattenDatabase(database);
    const result = { checked: 0, zero: [], low: [], errors: [] };
    for (const prompt of promptLibrary.filter(item => item.enabled !== false)) {
      const playerIds = new Set();
      try {
        for (const record of flat) {
          if (record.position === prompt.position && prompt.test(record)) playerIds.add(record.playerId);
        }
      } catch (error) {
        result.errors.push({ id: prompt.id, error: error.message || String(error) });
        continue;
      }
      result.checked += 1;
      if (playerIds.size === 0) result.zero.push(prompt.id);
      else if (playerIds.size < 6) result.low.push({ id: prompt.id, validPlayers: playerIds.size });
    }
    return result;
  }

  async function testLiveChallenge(database) {
    let challenge = window.FPL_DAILY_CHALLENGE || null;
    try {
      if (!challenge) {
        const response = await fetch(`todays-challenge.js?phase9=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`todays-challenge.js returned HTTP ${response.status}`);
        challenge = parseChallengeSource(await response.text());
      }
      if (!challenge || !Array.isArray(challenge.prompts) || challenge.prompts.length !== 11) throw new Error("The live challenge does not contain eleven prompts.");
      const result = calculatePerfectXI(database, challenge.prompts);
      return { challenge, ...result };
    } catch (error) {
      return { challenge: null, possible: false, score: 0, error: error.message || String(error) };
    }
  }

  function calculatePerfectXI(database, prompts) {
    const flat = flattenDatabase(database);
    const playerIds = new Set();
    const bestBySlot = prompts.map(prompt => {
      const best = new Map();
      for (const record of flat) {
        if (record.position !== prompt.position) continue;
        let valid = false;
        try { valid = prompt.test(record); } catch { valid = false; }
        if (!valid) continue;
        const previous = best.get(record.playerId);
        if (!previous || record.points > previous.points) best.set(record.playerId, record);
        playerIds.add(record.playerId);
      }
      return best;
    });
    if (bestBySlot.some(map => map.size === 0)) return { possible: false, score: 0, reason: "At least one live prompt has no valid answers." };
    const ids = [...playerIds];
    if (ids.length < prompts.length) return { possible: false, score: 0, reason: "Fewer than eleven different valid footballers exist." };
    let maximum = 0;
    for (const map of bestBySlot) for (const record of map.values()) maximum = Math.max(maximum, record.points);
    const recordsBySlot = bestBySlot.map(map => ids.map(id => map.get(id) || null));
    const costs = recordsBySlot.map(row => Float64Array.from(row, record => record ? maximum - record.points : FORBIDDEN_COST));
    const assignment = hungarianMinimumAssignment(costs);
    if (!assignment) return { possible: false, score: 0, reason: "The exact assignment solver could not complete." };
    const picks = assignment.map((column, slot) => recordsBySlot[slot][column]);
    if (picks.some(record => !record)) return { possible: false, score: 0, reason: "No unique-player XI exists." };
    return { possible: true, score: picks.reduce((sum, record) => sum + record.points, 0), picks };
  }

  function hungarianMinimumAssignment(costs) {
    const rows = costs.length;
    const columns = costs[0]?.length || 0;
    if (!rows || columns < rows) return null;
    const u = new Float64Array(rows + 1);
    const v = new Float64Array(columns + 1);
    const p = new Int32Array(columns + 1);
    const way = new Int32Array(columns + 1);
    for (let row = 1; row <= rows; row += 1) {
      p[0] = row;
      let column0 = 0;
      const min = new Float64Array(columns + 1);
      min.fill(Number.POSITIVE_INFINITY);
      const used = new Uint8Array(columns + 1);
      do {
        used[column0] = 1;
        const row0 = p[column0];
        let delta = Number.POSITIVE_INFINITY;
        let column1 = 0;
        for (let column = 1; column <= columns; column += 1) {
          if (used[column]) continue;
          const current = costs[row0 - 1][column - 1] - u[row0] - v[column];
          if (current < min[column]) { min[column] = current; way[column] = column0; }
          if (min[column] < delta) { delta = min[column]; column1 = column; }
        }
        if (!Number.isFinite(delta)) return null;
        for (let column = 0; column <= columns; column += 1) {
          if (used[column]) { u[p[column]] += delta; v[column] -= delta; }
          else min[column] -= delta;
        }
        column0 = column1;
      } while (p[column0] !== 0);
      do {
        const column1 = way[column0];
        p[column0] = p[column1];
        column0 = column1;
      } while (column0 !== 0);
    }
    const assignment = new Int32Array(rows);
    assignment.fill(-1);
    for (let column = 1; column <= columns; column += 1) if (p[column] !== 0) assignment[p[column] - 1] = column - 1;
    return [...assignment];
  }

  function renderSummary() {
    const before = databaseCounts(originalPlayers);
    const after = databaseCounts(state.workspace || []);
    elements.autoRepairSummary.innerHTML = `
      <div><strong>${before.players.toLocaleString()} → ${after.players.toLocaleString()}</strong><span>players</span></div>
      <div><strong>${before.seasons.toLocaleString()} → ${after.seasons.toLocaleString()}</strong><span>player-seasons</span></div>
      <div><strong>${state.changes.length.toLocaleString()}</strong><span>automatic actions</span></div>
      <div><strong>${state.quarantine.length.toLocaleString()}</strong><span>quarantined records</span></div>
    `;
  }

  function renderChanges() {
    const grouped = new Map();
    for (const item of state.changes) grouped.set(item.type, (grouped.get(item.type) || 0) + 1);
    elements.autoRepairChangeList.innerHTML = [...grouped.entries()].map(([type, count]) => `
      <div class="auto-repair-change-row"><strong>${escapeHtml(formatType(type))}</strong><span>${count.toLocaleString()} action${count === 1 ? "" : "s"}</span></div>
    `).join("") || `<div class="repair-empty-state">No changes were required.</div>`;
  }

  function renderRegression(rows) {
    elements.autoRepairRegressionList.innerHTML = rows.map(row => {
      const icon = row.status === "pass" ? "✓" : row.status === "warn" ? "△" : "!";
      return `<div class="repair-regression-row ${row.status}"><div class="regression-icon">${icon}</div><div><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.detail)}</span></div></div>`;
    }).join("");
  }

  async function downloadAutomaticRepairPack() {
    if (!state.workspace || !state.regression?.uploadReady) return;
    elements.downloadAutoRepairBtn.disabled = true;
    elements.autoRepairDownloadStatus.textContent = "Building the upload-ready ZIP, backup and reports…";
    await nextFrame();
    const files = [
      { name: "UPLOAD/players.js", content: buildPlayersSource(state.workspace, "Generated by Challenge Studio Phase 9 automatic conservative cleaner") },
      { name: "BACKUPS/players-before-auto-clean.js", content: buildPlayersSource(originalPlayers, "Backup created before Phase 9 automatic cleaning") },
      { name: "REPORTS/automatic-repairs.json", content: JSON.stringify(state.changes, null, 2) + "\n" },
      { name: "REPORTS/quarantined-records.json", content: JSON.stringify(state.quarantine, null, 2) + "\n" },
      { name: "REPORTS/regression-results.json", content: JSON.stringify(state.regression, null, 2) + "\n" },
      { name: "README-UPLOAD.txt", content: buildReadme() }
    ];
    downloadBlob(`fpl-automatic-database-repair-${dateStamp()}.zip`, buildZipBlob(files));
    elements.autoRepairDownloadStatus.textContent = "Downloaded. Extract the ZIP, keep the backup, and upload only UPLOAD/players.js to GitHub.";
    elements.downloadAutoRepairBtn.disabled = false;
  }

  function buildReadme() {
    const counts = databaseCounts(state.workspace || []);
    return `FPL CHALLENGE STUDIO PHASE 9 — AUTOMATIC DATABASE REPAIR\n\nSTATUS: UPLOAD READY\n\nThe cleaner used conservative rules only:\n- removed manager/non-player records\n- separated known same-name footballers\n- merged safe accent/ID variants\n- withheld conflicting age values instead of guessing\n- quarantined structurally unsafe records\n- tested every enabled prompt\n- verified the live daily challenge and perfect score\n\nCLEANED DATABASE\nPlayers: ${counts.players}\nPlayer-seasons: ${counts.seasons}\nBlocking errors: 0\n\nUPLOAD\n1. Keep BACKUPS/players-before-auto-clean.js.\n2. Upload only UPLOAD/players.js to the root of the GitHub repository.\n3. Replace the existing players.js.\n4. Wait for GitHub Pages to deploy.\n5. Open the live game and press Ctrl+Shift+R.\n\nDo not upload files from BACKUPS or REPORTS.\n`;
  }

  function recalculateLeagueFlags(season) {
    const position = season.leaguePosition;
    if (!Number.isInteger(position) || position < 1 || position > 20) return;
    season.champions = position === 1;
    season.topFour = position <= 4;
    season.bottomHalf = position >= 11;
    season.relegated = position >= 18;
  }

  function parseChallengeSource(source) {
    const sandbox = Object.create(null);
    return new Function("window", `\"use strict\";\n${source}\nreturn window.FPL_DAILY_CHALLENGE || null;`)(sandbox);
  }

  function serialiseLiveResult(result) {
    if (!result) return null;
    return {
      challenge: result.challenge ? {
        id: result.challenge.id || "",
        number: Number(result.challenge.number) || 0,
        title: result.challenge.title || "",
        perfectScore: Number(result.challenge.perfectScore) || 0,
        promptIds: result.challenge.prompts.map(prompt => prompt.id)
      } : null,
      possible: Boolean(result.possible),
      score: Number(result.score) || 0,
      reason: result.reason || "",
      error: result.error || ""
    };
  }

  function flattenDatabase(database) {
    return database.flatMap(player => player.seasons.map(season => ({
      ...season,
      playerId: player.playerId,
      name: player.name,
      playerName: player.name,
      identityDisambiguator: player.identityDisambiguator || ""
    })));
  }

  function databaseCounts(database) {
    return { players: database.length, seasons: database.reduce((sum, player) => sum + (player.seasons?.length || 0), 0) };
  }

  function change(type, player, season, detail) {
    return { type, playerId: player.playerId, name: player.name, season: season.season, club: season.club, detail };
  }

  function addRegression(rows, status, title, detail) {
    rows.push({ status, title, detail });
  }

  function setStatus(text, mode) {
    elements.autoRepairStatus.textContent = text;
    elements.autoRepairStatus.className = `audit-status-chip ${mode}`;
  }

  function toggleProgress(show, percent, text) {
    elements.autoRepairProgressWrap.classList.toggle("hidden", !show);
    elements.autoRepairProgressText.textContent = text;
    elements.autoRepairProgressPercent.textContent = `${percent}%`;
    elements.autoRepairProgressBar.style.width = `${percent}%`;
  }

  function formatType(type) {
    return String(type).split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }

  function buildPlayersSource(database, note) {
    return `/* ${note}. */\nwindow.FPL_PLAYERS = ${JSON.stringify(database)};\n`;
  }

  function cleanWhitespace(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function normaliseIdentity(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function compactIdentity(value) {
    return normaliseIdentity(value).replace(/\s+/g, "");
  }

  function slugify(value) {
    return normaliseIdentity(value).replace(/\s+/g, "-") || "identity";
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
    if (date.getUTCMonth() < dob.getUTCMonth() || (date.getUTCMonth() === dob.getUTCMonth() && date.getUTCDate() < dob.getUTCDate())) age -= 1;
    return age;
  }

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }

  function cloneData(value) {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(resolve));
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
  }

  /* Minimal standards-compliant ZIP writer using stored entries. */
  function buildZipBlob(files) {
    const encoder = new TextEncoder();
    const dos = toDosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const file of files) {
      const nameBytes = encoder.encode(file.name.replaceAll("\\", "/"));
      const dataBytes = typeof file.content === "string" ? encoder.encode(file.content) : new Uint8Array(file.content);
      const crc = crc32(dataBytes);
      const localHeader = concatBytes(
        uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0), uint16(dos.time), uint16(dos.date),
        uint32(crc), uint32(dataBytes.length), uint32(dataBytes.length), uint16(nameBytes.length), uint16(0), nameBytes, dataBytes
      );
      localParts.push(localHeader);
      centralParts.push(concatBytes(
        uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0), uint16(dos.time), uint16(dos.date),
        uint32(crc), uint32(dataBytes.length), uint32(dataBytes.length), uint16(nameBytes.length), uint16(0), uint16(0),
        uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes
      ));
      offset += localHeader.length;
    }
    const central = concatBytes(...centralParts);
    const end = concatBytes(uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length), uint32(central.length), uint32(offset), uint16(0));
    return new Blob([...localParts, central, end], { type: "application/zip" });
  }

  function toDosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return { time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() };
  }

  function uint16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value & 0xffff, true);
    return bytes;
  }

  function uint32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
  }

  function concatBytes(...parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      table[index] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 750);
  }
})();
