/* ===== BEGIN admin-phase12.js ===== */
/* Challenge Studio Phase 12 — official 2015/16 FPL archive importer. */
(() => {
  "use strict";

  const SEASON = "2015/16";
  const NEXT_SEASON = "2016/17";
  const VALID_POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  const HISTORY = window.FPL_2015_16_HISTORY || {};
  const BASE_PLAYERS = clone(window.FPL_PLAYERS || []);
  const PROMPTS = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];

  const CLUBS = Object.freeze({
    "arsenal": meta("Arsenal", 2, false, ["Arsène Wenger"]),
    "aston villa": meta("Aston Villa", 20, false, ["Tim Sherwood", "Kevin MacDonald", "Rémi Garde", "Eric Black"]),
    "afc bournemouth": meta("Bournemouth", 16, true, ["Eddie Howe"]),
    "bournemouth": meta("Bournemouth", 16, true, ["Eddie Howe"]),
    "chelsea": meta("Chelsea", 10, false, ["José Mourinho", "Steve Holland", "Guus Hiddink"]),
    "crystal palace": meta("Crystal Palace", 15, false, ["Alan Pardew"]),
    "everton": meta("Everton", 11, false, ["Roberto Martínez", "David Unsworth"]),
    "leicester": meta("Leicester", 1, false, ["Claudio Ranieri"]),
    "leicester city": meta("Leicester", 1, false, ["Claudio Ranieri"]),
    "liverpool": meta("Liverpool", 8, false, ["Brendan Rodgers", "Jürgen Klopp"]),
    "manchester city": meta("Man City", 4, false, ["Manuel Pellegrini"]),
    "man city": meta("Man City", 4, false, ["Manuel Pellegrini"]),
    "manchester united": meta("Man Utd", 5, false, ["Louis van Gaal"]),
    "man utd": meta("Man Utd", 5, false, ["Louis van Gaal"]),
    "newcastle": meta("Newcastle", 18, false, ["Steve McClaren", "Rafael Benítez"]),
    "newcastle united": meta("Newcastle", 18, false, ["Steve McClaren", "Rafael Benítez"]),
    "norwich": meta("Norwich", 19, true, ["Alex Neil"]),
    "norwich city": meta("Norwich", 19, true, ["Alex Neil"]),
    "southampton": meta("Southampton", 6, false, ["Ronald Koeman"]),
    "stoke": meta("Stoke", 9, false, ["Mark Hughes"]),
    "stoke city": meta("Stoke", 9, false, ["Mark Hughes"]),
    "sunderland": meta("Sunderland", 17, false, ["Dick Advocaat", "Sam Allardyce"]),
    "swansea": meta("Swansea", 12, false, ["Garry Monk", "Alan Curtis", "Francesco Guidolin"]),
    "swansea city": meta("Swansea", 12, false, ["Garry Monk", "Alan Curtis", "Francesco Guidolin"]),
    "tottenham": meta("Spurs", 3, false, ["Mauricio Pochettino"]),
    "tottenham hotspur": meta("Spurs", 3, false, ["Mauricio Pochettino"]),
    "spurs": meta("Spurs", 3, false, ["Mauricio Pochettino"]),
    "watford": meta("Watford", 13, true, ["Quique Sánchez Flores"]),
    "west brom": meta("West Brom", 14, false, ["Tony Pulis"]),
    "west bromwich albion": meta("West Brom", 14, false, ["Tony Pulis"]),
    "west ham": meta("West Ham", 7, false, ["Slaven Bilić"]),
    "west ham united": meta("West Ham", 7, false, ["Slaven Bilić"])
  });

  const NICKNAMES = [
    ["matthew", "matty"], ["benjamin", "ben"], ["nicholas", "nick"], ["jonathan", "jon"],
    ["joseph", "joe"], ["alexander", "alex"], ["daniel", "danny"], ["robert", "rob"],
    ["william", "will"], ["christopher", "chris"], ["edward", "ed"], ["samuel", "sam"],
    ["thomas", "tom"], ["steven", "steve"], ["stephen", "steve"], ["anthony", "tony"],
    ["andrew", "andy"], ["james", "jimmy"], ["patrick", "paddy"], ["kieran", "keiron"]
  ];

  const els = {};
  let sourceSnapshots = [];
  let sourceErrors = [];
  let preview = null;
  let checks = [];
  let liveAssets = null;

  function init() {
    [
      "legacyImportStatus", "legacyArchiveInput", "legacyArchiveFileStatus", "readLegacyArchiveBtn",
      "buildLegacyPreviewBtn", "resetLegacyImportBtn", "legacyImportActionStatus", "legacyImportPreview",
      "legacySnapshotCount", "legacyImportableCount", "legacyMatchedCount", "legacyNewCount",
      "legacyReviewCount", "legacyQuarantineCount", "legacyProjectedPlayers", "legacyProjectedSeasons",
      "legacyImportWarnings", "legacyReviewPanel", "legacyReviewShown", "legacyReviewList",
      "runLegacyChecksBtn", "legacyRegressionList", "legacyDownloadExplanation",
      "downloadLegacyPackBtn", "legacyDownloadStatus"
    ].forEach(id => { els[id] = document.getElementById(id); });
    if (!els.legacyArchiveInput) return;

    els.legacyArchiveInput.addEventListener("change", onFilesChosen);
    els.readLegacyArchiveBtn.addEventListener("click", readSourceFiles);
    els.buildLegacyPreviewBtn.addEventListener("click", buildPreview);
    els.resetLegacyImportBtn.addEventListener("click", reset);
    els.runLegacyChecksBtn.addEventListener("click", runChecks);
    els.downloadLegacyPackBtn.addEventListener("click", downloadPackage);

    setStatus("Waiting for archive", "pending");
    if (!BASE_PLAYERS.length) {
      setStatus("Player database missing", "blocked");
      els.legacyImportActionStatus.textContent = "players.js did not load. Refresh after GitHub Pages has finished deploying.";
    } else if (!Object.keys(HISTORY).length) {
      setStatus("History supplement missing", "blocked");
      els.legacyImportActionStatus.textContent = "fpl-history-2015-16.js did not load.";
    }
  }

  function onFilesChosen() {
    const files = [...els.legacyArchiveInput.files];
    sourceSnapshots = [];
    preview = null;
    checks = [];
    els.buildLegacyPreviewBtn.disabled = true;
    els.downloadLegacyPackBtn.disabled = true;
    if (!files.length) {
      els.legacyArchiveFileStatus.textContent = "No archive selected.";
      return;
    }
    const total = files.reduce((sum, file) => sum + file.size, 0);
    els.legacyArchiveFileStatus.textContent = `${files.length} file${files.length === 1 ? "" : "s"} selected · ${formatBytes(total)}`;
    els.legacyImportActionStatus.textContent = "Press “Read 2015/16 archive” to parse the source files.";
  }

  async function readSourceFiles() {
    const files = [...els.legacyArchiveInput.files];
    if (!files.length) return showError("Choose the repository ZIP or its JSON player files first.");
    setStatus("Reading archive…", "pending");
    els.readLegacyArchiveBtn.disabled = true;
    els.buildLegacyPreviewBtn.disabled = true;
    sourceSnapshots = [];
    sourceErrors = [];
    preview = null;

    try {
      const parsed = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        els.legacyImportActionStatus.textContent = `Reading ${file.name} (${index + 1}/${files.length})…`;
        if (/\.zip$/i.test(file.name)) {
          const result = await readZip(file, progress => {
            els.legacyImportActionStatus.textContent = `Reading ${file.name} · ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} archive entries…`;
          });
          parsed.push(...result.objects);
          sourceErrors.push(...result.errors);
        } else {
          try { parsed.push(...extractPlayerObjects(JSON.parse(await file.text()))); }
          catch (error) { sourceErrors.push({ file: file.name, reason: error.message }); }
        }
      }

      sourceSnapshots = dedupeSnapshots(parsed.filter(isPlayerSnapshot));
      els.legacySnapshotCount.textContent = sourceSnapshots.length.toLocaleString();
      els.legacyArchiveFileStatus.textContent = `${sourceSnapshots.length.toLocaleString()} unique player snapshots read${sourceErrors.length ? ` · ${sourceErrors.length} file errors` : ""}.`;
      if (sourceSnapshots.length < 500) {
        setStatus("Archive looks incomplete", "blocked");
        els.legacyImportActionStatus.textContent = `Only ${sourceSnapshots.length} player snapshots were found. Select the full repository ZIP or all files in PlayersInfo.`;
        return;
      }
      els.buildLegacyPreviewBtn.disabled = false;
      setStatus("Archive ready", "safe");
      els.legacyImportActionStatus.textContent = `${sourceSnapshots.length.toLocaleString()} official player snapshots are ready. Build the protected expansion preview.`;
    } catch (error) {
      showError(`The archive could not be read: ${error.message}`);
    } finally {
      els.readLegacyArchiveBtn.disabled = false;
    }
  }

  async function buildPreview() {
    if (!sourceSnapshots.length) return showError("Read the source archive first.");
    setStatus("Matching identities…", "pending");
    els.buildLegacyPreviewBtn.disabled = true;
    els.legacyImportActionStatus.textContent = "Matching 2015/16 records against the consolidated player database…";
    await yieldFrame();

    const database = clone(BASE_PLAYERS);
    const identityIndex = buildIdentityIndex(database);
    const usedIds = new Set(database.map(player => player.playerId));
    const imported = [];
    const matched = [];
    const created = [];
    const review = [];
    const quarantine = [];
    const crossChecks = [];

    for (let index = 0; index < sourceSnapshots.length; index += 1) {
      const snapshot = sourceSnapshots[index];
      const converted = convertSnapshot(snapshot);
      if (!converted.ok) {
        quarantine.push({ name: sourceName(snapshot), sourceId: snapshot.id ?? null, reason: converted.reason, snapshot: compactSnapshot(snapshot) });
        continue;
      }

      if (converted.crossCheck) crossChecks.push(converted.crossCheck);
      const match = matchIdentity(converted, database, identityIndex);
      if (match.kind === "review") {
        review.push({ ...converted, reason: match.reason, candidates: match.candidates });
        continue;
      }

      let player;
      if (match.kind === "matched") {
        player = database[match.index];
        if (player.seasons.some(season => season.season === SEASON)) {
          quarantine.push({ name: converted.name, sourceId: converted.sourceId, reason: "This identity already contains a 2015/16 season.", snapshot: compactSnapshot(snapshot) });
          continue;
        }
        player.seasons.push(converted.record);
        addAlias(player, converted.name);
        if (converted.webName && normalise(converted.webName) !== normalise(player.name)) addAlias(player, converted.webName);
        matched.push({ sourceName: converted.name, playerId: player.playerId, canonicalName: player.name, club: converted.record.club });
      } else {
        const id = uniqueId(slugify(converted.name), converted.record.club, usedIds);
        player = {
          playerId: id,
          name: converted.name,
          seasons: [converted.record],
          bio: converted.dateOfBirth ? { dateOfBirth: converted.dateOfBirth } : {},
          aliases: converted.webName && normalise(converted.webName) !== normalise(converted.name) ? [converted.webName] : [],
          sourceIdentity: { season: SEASON, sourcePlayerId: converted.sourceId, sourceCode: converted.code || null }
        };
        database.push(player);
        usedIds.add(id);
        created.push({ sourceName: converted.name, playerId: id, club: converted.record.club });
      }
      imported.push({ playerId: player.playerId, name: player.name, sourceName: converted.name, record: converted.record, historyVerified: Boolean(converted.history) });
    }

    const partialStartingPrice = imported.filter(item => !Number.isFinite(item.record.startingPrice)).length;
    preview = { database, imported, matched, created, review, quarantine, crossChecks, partialStartingPrice, sourceErrors: clone(sourceErrors), generatedAt: new Date().toISOString() };
    liveAssets = await loadLiveAssets();

    updatePreviewUi();
    await runChecks();
    els.buildLegacyPreviewBtn.disabled = false;
  }

  function convertSnapshot(snapshot) {
    const name = sourceName(snapshot);
    if (!name) return fail("Player name is missing.");
    const clubMeta = clubMetadata(first(snapshot, ["team_name", "club_name", "club", "teamName"]));
    if (!clubMeta) return fail(`Club could not be mapped from “${first(snapshot, ["team_name", "club_name", "club", "teamName"]) ?? "blank"}”.`);
    const position = positionValue(first(snapshot, ["type_name", "position", "element_type", "element_type_id", "type"]));
    if (!position) return fail("FPL position is missing or invalid.");

    const code = String(first(snapshot, ["code", "element_code", "player_code"]) ?? "");
    const history = code && HISTORY[code] ? HISTORY[code] : findHistoryByName(name);
    const sourceStats = {
      points: whole(first(snapshot, ["total_points", "points"])),
      minutes: whole(first(snapshot, ["minutes"])),
      goals: whole(first(snapshot, ["goals_scored", "goals"])),
      assists: whole(first(snapshot, ["assists"])),
      cleanSheets: whole(first(snapshot, ["clean_sheets", "cleanSheets"])),
      bonus: whole(first(snapshot, ["bonus"])),
      saves: whole(first(snapshot, ["saves"])),
      goalsConceded: whole(first(snapshot, ["goals_conceded", "goalsConceded"])),
      yellowCards: whole(first(snapshot, ["yellow_cards", "yellowCards"])),
      redCards: whole(first(snapshot, ["red_cards", "redCards"]))
    };

    const finalPrice = history?.endCost ?? price(first(snapshot, ["now_cost", "end_cost", "final_price", "finalPrice"]));
    let startingPrice = history?.startCost ?? price(first(snapshot, ["original_cost", "start_cost", "initial_cost", "starting_price", "startingPrice"]));
    if (startingPrice == null) {
      const now = numeric(first(snapshot, ["now_cost"]));
      const change = numeric(first(snapshot, ["cost_change_start"]));
      if (now != null && change != null) startingPrice = roundOne((now - change) / (Math.abs(now) > 30 ? 10 : 1));
    }
    if (!validPrice(finalPrice)) return fail("A trustworthy final FPL price is unavailable.");
    const startingPriceKnown = validPrice(startingPrice);

    const stats = history ? {
      points: history.points, minutes: history.minutes, goals: history.goals, assists: history.assists,
      cleanSheets: history.cleanSheets, bonus: history.bonus, saves: history.saves,
      goalsConceded: history.goalsConceded, yellowCards: history.yellowCards, redCards: history.redCards
    } : sourceStats;
    if (!Object.values(stats).every(Number.isFinite)) return fail("One or more required FPL statistics are invalid.");

    const dateOfBirth = dateValue(first(snapshot, ["birth_date", "date_of_birth", "dateOfBirth"]));
    const record = {
      season: SEASON,
      club: clubMeta.club,
      position,
      points: stats.points,
      minutes: stats.minutes,
      goals: stats.goals,
      assists: stats.assists,
      cleanSheets: stats.cleanSheets,
      bonus: stats.bonus,
      saves: stats.saves,
      goalsConceded: stats.goalsConceded,
      yellowCards: stats.yellowCards,
      redCards: stats.redCards,
      ...(startingPriceKnown ? { startingPrice: roundOne(startingPrice) } : {}),
      finalPrice: roundOne(finalPrice),
      managers: [...clubMeta.managers],
      leaguePosition: clubMeta.position,
      champions: clubMeta.position === 1,
      topFour: clubMeta.position <= 4,
      bottomHalf: clubMeta.position >= 11,
      relegated: clubMeta.position >= 18,
      promoted: clubMeta.promoted,
      ageAtSeasonStart: dateOfBirth ? ageAtSeasonStart(dateOfBirth) : null,
      source: {
        seasonSnapshot: "Official FPL 2015/16 player API archive",
        historySupplement: history ? history.source : null,
        sourcePlayerId: first(snapshot, ["id"]) ?? null,
        sourceCode: code || null,
        startingPriceConfidence: startingPriceKnown ? "verified" : "unavailable",
        confidence: history ? "verified-cross-source" : startingPriceKnown ? "verified-official-snapshot" : "verified-official-stats-final-price-only"
      }
    };

    const crossCheck = history ? compareStats(name, sourceStats, history) : null;
    return {
      ok: true, name, webName: String(first(snapshot, ["web_name", "display_name"]) ?? "").trim(),
      firstName: String(first(snapshot, ["first_name"]) ?? "").trim(),
      surname: String(first(snapshot, ["second_name", "surname", "last_name"]) ?? "").trim(),
      sourceId: first(snapshot, ["id"]) ?? null, code, dateOfBirth, record, history, crossCheck, snapshot
    };
  }

  function buildIdentityIndex(database) {
    const exact = new Map();
    database.forEach((player, index) => {
      const values = [player.name, ...(player.aliases || [])];
      values.forEach(value => {
        const key = normalise(value);
        if (!key) return;
        if (!exact.has(key)) exact.set(key, []);
        exact.get(key).push(index);
      });
    });
    return { exact };
  }

  function matchIdentity(converted, database, index) {
    const key = normalise(converted.name);
    const exact = [...new Set(index.exact.get(key) || [])];
    if (exact.length === 1) return { kind: "matched", index: exact[0], reason: "Exact canonical name or alias." };
    if (exact.length > 1) {
      const continuity = exact.filter(i => adjacentClub(database[i]) === converted.record.club);
      if (continuity.length === 1) return { kind: "matched", index: continuity[0], reason: "Exact name plus adjacent-season club continuity." };
      return reviewMatch("Several existing footballers share this exact name.", exact, database);
    }

    const scored = [];
    for (let i = 0; i < database.length; i += 1) {
      const player = database[i];
      let score = nameSimilarity(converted, player);
      if (!score) continue;
      if (adjacentClub(player) === converted.record.club) score += 18;
      if (player.bio?.dateOfBirth && converted.dateOfBirth && player.bio.dateOfBirth === converted.dateOfBirth) score += 35;
      scored.push({ index: i, score, player });
    }
    scored.sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name));
    if (!scored.length || scored[0].score < 82) return { kind: "new" };
    const top = scored[0];
    const next = scored[1];
    if (top.score >= 108 && (!next || top.score - next.score >= 12)) return { kind: "matched", index: top.index, reason: "Strong name and career-continuity match." };
    return {
      kind: "review",
      reason: `Closest identity match scored ${top.score}, which is not safe enough for automatic merging.`,
      candidates: scored.slice(0, 5).map(item => candidateSummary(item.player, item.score))
    };
  }

  function nameSimilarity(converted, player) {
    const sourceFull = normalise(converted.name);
    const playerNames = [player.name, ...(player.aliases || [])].map(normalise);
    if (playerNames.includes(sourceFull)) return 120;
    const sf = normalise(converted.firstName || firstToken(converted.name));
    const ss = normalise(converted.surname || lastToken(converted.name));
    let best = 0;
    for (const value of [player.name, ...(player.aliases || [])]) {
      const pf = firstToken(value), ps = lastToken(value);
      if (ss && normalise(ps) === ss) {
        if (normalise(pf) === sf) best = Math.max(best, 96);
        else if (nicknameEquivalent(pf, sf)) best = Math.max(best, 92);
        else if (normalise(pf).startsWith(sf[0] || "_") && sf.length > 2) best = Math.max(best, 76);
      }
      const a = normalise(value), b = sourceFull;
      if (a && b && (a.includes(b) || b.includes(a))) best = Math.max(best, 84);
    }
    return best;
  }

  async function runChecks() {
    if (!preview) return;
    setStatus("Running safety checks…", "pending");
    els.legacyImportActionStatus.textContent = "Running database, prompt and live-challenge regressions…";
    els.downloadLegacyPackBtn.disabled = true;
    await yieldFrame();

    const results = [];
    const database = preview.database;
    const totalSeasons = database.reduce((sum, player) => sum + player.seasons.length, 0);
    const baseSeasons = BASE_PLAYERS.reduce((sum, player) => sum + player.seasons.length, 0);
    addCheck(results, sourceSnapshots.length >= 700, "Complete official archive", `${sourceSnapshots.length.toLocaleString()} snapshots read; the expected archive contains 723 files.`);
    addCheck(results, preview.imported.length >= 500, "Useful 2015/16 coverage", `${preview.imported.length.toLocaleString()} verified player-seasons are included.`);
    addCheck(results, new Set(database.map(player => player.playerId)).size === database.length, "Unique player IDs", `${database.length.toLocaleString()} players have unique IDs.`);

    const duplicateSeasons = [];
    database.forEach(player => {
      const seen = new Set();
      player.seasons.forEach(season => {
        if (seen.has(season.season)) duplicateSeasons.push(`${player.name} · ${season.season}`);
        seen.add(season.season);
      });
    });
    addCheck(results, duplicateSeasons.length === 0, "No duplicate player-seasons", duplicateSeasons.length ? duplicateSeasons.slice(0, 5).join("; ") : "Every footballer has at most one record per season.");
    addCheck(results, totalSeasons === baseSeasons + preview.imported.length, "Season-count reconciliation", `${baseSeasons.toLocaleString()} + ${preview.imported.length.toLocaleString()} = ${totalSeasons.toLocaleString()}.`);
    addCheck(results, existingDataUnchanged(database), "Existing database preserved", "All pre-existing player identities and season records remain unchanged.");

    const invalidImported = preview.imported.filter(item => !validImportedRecord(item.record));
    addCheck(results, invalidImported.length === 0, "Imported schema and metadata", invalidImported.length ? `${invalidImported.length} imported records are invalid.` : "All imported records have valid clubs, positions, statistics, final prices and 2015/16 flags.");
    results.push({
      state: preview.partialStartingPrice ? "warn" : "pass",
      title: "Historical starting-price coverage",
      detail: preview.partialStartingPrice
        ? `${preview.partialStartingPrice} official records have no recoverable starting price. Their startingPrice field is omitted, so they cannot accidentally pass starting-price prompts.`
        : "Every imported record has a verified starting price.",
      blocking: false
    });

    const promptResult = testPrompts(database);
    addCheck(results, promptResult.failures.length === 0, "Prompt-library regression", promptResult.failures.length ? promptResult.failures.slice(0, 4).join("; ") : `${promptResult.tested} enabled prompts execute successfully after expansion.`);
    results.push({ state: promptResult.broad.length ? "warn" : "pass", title: "Prompt breadth review", detail: promptResult.broad.length ? `${promptResult.broad.length} prompts now have more than 125 valid footballers; this is informational, not a data error.` : "No prompt became unusually broad.", blocking: false });

    const crossMismatch = preview.crossChecks.filter(item => item && item.differences.length);
    results.push({ state: crossMismatch.length ? "warn" : "pass", title: "Cross-source FPL totals", detail: crossMismatch.length ? `${crossMismatch.length} source snapshots differ from the official history supplement; the supplement values are used and the differences are recorded.` : `${preview.crossChecks.length} supplemented records agree on key totals.`, blocking: false });

    let challengeInfo = null;
    if (liveAssets?.challenge) {
      const before = solvePerfectXi(liveAssets.challenge.prompts, BASE_PLAYERS);
      const after = solvePerfectXi(liveAssets.challenge.prompts, database);
      const exists = after && after.rows.length === liveAssets.challenge.prompts.length;
      addCheck(results, Boolean(exists), "Live challenge still solvable", exists ? `A unique-player XI exists with ${after.score.toLocaleString()} points.` : "The live challenge no longer has a complete unique-player XI.");
      if (exists) {
        challengeInfo = { before, after, declared: Number(liveAssets.challenge.perfectScore) || 0 };
        const changed = after.score !== challengeInfo.declared;
        results.push({ state: changed ? "warn" : "pass", title: "Live perfect score", detail: changed ? `The expanded database changes the exact perfect score from ${challengeInfo.declared.toLocaleString()} to ${after.score.toLocaleString()}. A corrected todays-challenge.js will be included.` : `The declared perfect score remains ${after.score.toLocaleString()}.`, blocking: false });
      }
    } else {
      results.push({ state: "warn", title: "Live challenge check unavailable", detail: "todays-challenge.js could not be read. The database package remains review-only until that file can be checked.", blocking: true });
    }

    const tooManyWithheld = preview.review.length + preview.quarantine.length > 180;
    addCheck(results, !tooManyWithheld, "Withheld-row limit", `${preview.review.length} need identity review and ${preview.quarantine.length} are quarantined.`);

    preview.challengeInfo = challengeInfo;
    checks = results;
    renderChecks();
    const blocked = checks.some(check => check.blocking && check.state !== "pass");
    if (blocked) {
      setStatus("Review package only", "blocked");
      els.downloadLegacyPackBtn.disabled = false;
      els.downloadLegacyPackBtn.textContent = "Download review package";
      els.legacyDownloadExplanation.textContent = "One or more blocking checks failed. The package contains reports and backups but clearly marks the upload files as review-only.";
      els.legacyImportActionStatus.textContent = "The preview is built, but blocking checks remain.";
    } else {
      setStatus("Upload-ready", "safe");
      els.downloadLegacyPackBtn.disabled = false;
      els.downloadLegacyPackBtn.textContent = "Download upload-ready package";
      els.legacyDownloadExplanation.textContent = `${preview.imported.length.toLocaleString()} verified 2015/16 player-seasons passed every blocking check.`;
      els.legacyImportActionStatus.textContent = "The 2015/16 expansion is ready to package.";
    }
  }

  function updatePreviewUi() {
    els.legacyImportPreview.classList.remove("hidden");
    els.legacySnapshotCount.textContent = sourceSnapshots.length.toLocaleString();
    els.legacyImportableCount.textContent = preview.imported.length.toLocaleString();
    els.legacyMatchedCount.textContent = preview.matched.length.toLocaleString();
    els.legacyNewCount.textContent = preview.created.length.toLocaleString();
    els.legacyReviewCount.textContent = preview.review.length.toLocaleString();
    els.legacyQuarantineCount.textContent = preview.quarantine.length.toLocaleString();
    els.legacyProjectedPlayers.textContent = preview.database.length.toLocaleString();
    els.legacyProjectedSeasons.textContent = preview.database.reduce((sum, player) => sum + player.seasons.length, 0).toLocaleString();

    const warnings = [];
    if (preview.review.length) warnings.push(warning("Identity review", `${preview.review.length} uncertain records are safely excluded from the upload database.`));
    if (preview.partialStartingPrice) warnings.push(warning("Historical starting prices", `${preview.partialStartingPrice} official 2015/16 records have verified stats and final prices but no recoverable starting price. They are imported safely and cannot satisfy starting-price prompts.`));
    if (preview.quarantine.length) warnings.push(warning("Quarantine", `${preview.quarantine.length} incomplete or invalid records are excluded.`));
    if (sourceErrors.length) warnings.push(warning("Archive file errors", `${sourceErrors.length} source files could not be parsed.`));
    els.legacyImportWarnings.innerHTML = warnings.join("") || '<div class="success-box"><strong>Clean source pass</strong><span>No source-file or identity warnings were raised.</span></div>';

    const allReview = [
      ...preview.review.map(item => ({ type: "review", name: item.name, detail: `${item.record.club} · ${item.record.position} · ${item.reason}`, extra: item.candidates?.map(candidate => `${candidate.name} (${candidate.score})`).join(" · ") || "No safe candidate" })),
      ...preview.quarantine.map(item => ({ type: "quarantine", name: item.name || "Unknown player", detail: item.reason, extra: `Source ID: ${item.sourceId ?? "unknown"}` }))
    ];
    els.legacyReviewShown.textContent = `${allReview.length.toLocaleString()} rows`;
    els.legacyReviewPanel.classList.toggle("hidden", !allReview.length);
    els.legacyReviewList.innerHTML = allReview.slice(0, 300).map(item => `
      <article class="legacy-review-card ${item.type}">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.detail)}</span>
        <small>${escapeHtml(item.extra)}</small>
      </article>`).join("") || '<div class="repair-empty-state">No rows need review.</div>';
  }

  function renderChecks() {
    els.legacyRegressionList.innerHTML = checks.map(check => `
      <article class="repair-regression-item ${check.state}">
        <span class="repair-regression-icon">${check.state === "pass" ? "✓" : check.state === "warn" ? "!" : "×"}</span>
        <div><strong>${escapeHtml(check.title)}</strong><p>${escapeHtml(check.detail)}</p></div>
      </article>`).join("");
  }

  async function downloadPackage() {
    if (!preview) return;
    const blocked = checks.some(check => check.blocking && check.state !== "pass");
    const files = [];
    const note = blocked ? "REVIEW ONLY — blocking checks remain" : "Upload-ready 2015/16 expansion generated by Challenge Studio Phase 12";
    const playersSource = serialisePlayers(preview.database, note);
    files.push({ name: blocked ? "REVIEW-ONLY/players-2015-16-preview.js" : "UPLOAD/players.js", content: playersSource });
    files.push({ name: "BACKUPS/players-before-2015-16.js", content: serialisePlayers(BASE_PLAYERS, "Pre-2015/16 expansion backup") });

    if (liveAssets?.challengeSource && preview.challengeInfo?.after) {
      const corrected = replacePerfectScore(liveAssets.challengeSource, preview.challengeInfo.after.score);
      files.push({ name: blocked ? "REVIEW-ONLY/todays-challenge-perfect-score-preview.js" : "UPLOAD/todays-challenge.js", content: corrected });
    }
    if (liveAssets?.indexSource) {
      const correctedIndex = patchIndexFor2015(liveAssets.indexSource);
      files.push({ name: blocked ? "REVIEW-ONLY/index-range-preview.html" : "UPLOAD/index.html", content: correctedIndex });
      files.push({ name: "BACKUPS/index-before-2015-16.html", content: liveAssets.indexSource });
    }

    const summary = {
      phase: 12, season: SEASON, generatedAt: preview.generatedAt, uploadReady: !blocked,
      basePlayers: BASE_PLAYERS.length, expandedPlayers: preview.database.length,
      baseSeasons: BASE_PLAYERS.reduce((sum, player) => sum + player.seasons.length, 0),
      expandedSeasons: preview.database.reduce((sum, player) => sum + player.seasons.length, 0),
      sourceSnapshots: sourceSnapshots.length, imported: preview.imported.length,
      matched: preview.matched.length, created: preview.created.length,
      review: preview.review.length, quarantine: preview.quarantine.length,
      partialStartingPrice: preview.partialStartingPrice || 0,
      livePerfectScoreBefore: preview.challengeInfo?.declared ?? null,
      livePerfectScoreAfter: preview.challengeInfo?.after?.score ?? null,
      checks
    };
    files.push({ name: "REPORTS/import-summary.json", content: JSON.stringify(summary, null, 2) });
    files.push({ name: "REPORTS/imported-2015-16-records.json", content: JSON.stringify(preview.imported, null, 2) });
    files.push({ name: "REPORTS/identity-review.json", content: JSON.stringify(preview.review, null, 2) });
    files.push({ name: "REPORTS/quarantine.json", content: JSON.stringify(preview.quarantine, null, 2) });
    files.push({ name: "REPORTS/cross-source-comparison.json", content: JSON.stringify(preview.crossChecks, null, 2) });
    files.push({ name: "README-UPLOAD.txt", content: readmeText(summary, blocked) });

    const zipBuilder = window.FPL_STUDIO_PHASE6?.buildZipBlob;
    if (typeof zipBuilder !== "function") return showError("The Phase 6 ZIP builder is unavailable. Refresh the Studio and try again.");
    downloadBlob(`fpl-2015-16-expansion-12-1-${blocked ? "review" : "upload-ready"}-${dateStamp()}.zip`, zipBuilder(files));
    els.legacyDownloadStatus.textContent = blocked ? "Review package downloaded. Do not upload its preview files yet." : "Upload-ready package downloaded. Follow README-UPLOAD.txt in order.";
  }

  async function loadLiveAssets() {
    const result = { challenge: null, challengeSource: "", indexSource: "" };
    try {
      const response = await fetch(`todays-challenge.js?phase12=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        result.challengeSource = await response.text();
        const sandbox = {};
        Function("window", `${result.challengeSource}\nreturn window.FPL_DAILY_CHALLENGE;`)(sandbox);
        result.challenge = sandbox.FPL_DAILY_CHALLENGE || null;
      }
    } catch {}
    try {
      const response = await fetch(`index.html?phase12=${Date.now()}`, { cache: "no-store" });
      if (response.ok) result.indexSource = await response.text();
    } catch {}
    return result;
  }

  function solvePerfectXi(prompts, database) {
    if (!Array.isArray(prompts) || !prompts.length) return null;
    const bestByPrompt = prompts.map(prompt => {
      const map = new Map();
      database.forEach(player => player.seasons.forEach(season => {
        if (season.position !== prompt.position) return;
        const row = { ...season, playerId: player.playerId, name: player.name };
        let valid = false;
        try { valid = Boolean(prompt.test(row)); } catch { valid = false; }
        if (!valid) return;
        const previous = map.get(player.playerId);
        if (!previous || row.points > previous.points) map.set(player.playerId, row);
      }));
      return map;
    });
    if (bestByPrompt.some(map => !map.size)) return null;
    const playerIds = [...new Set(bestByPrompt.flatMap(map => [...map.keys()]))];
    if (playerIds.length < prompts.length) return null;
    const n = prompts.length, m = playerIds.length, BIG = 1e8;
    const cost = Array.from({ length: n }, (_, i) => playerIds.map(id => bestByPrompt[i].has(id) ? -bestByPrompt[i].get(id).points : BIG));
    const assignment = hungarian(cost);
    if (!assignment) return null;
    const rows = assignment.map((j, i) => bestByPrompt[i].get(playerIds[j])).filter(Boolean);
    if (rows.length !== n) return null;
    return { score: rows.reduce((sum, row) => sum + row.points, 0), rows };
  }

  function hungarian(a) {
    const n = a.length, m = a[0]?.length || 0;
    if (!n || n > m) return null;
    const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
    for (let i = 1; i <= n; i += 1) {
      p[0] = i;
      let j0 = 0;
      const minv = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity, j1 = 0;
        for (let j = 1; j <= m; j += 1) if (!used[j]) {
          const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j += 1) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do {
        const j1 = way[j0]; p[j0] = p[j1]; j0 = j1;
      } while (j0 !== 0);
    }
    const answer = Array(n).fill(-1);
    for (let j = 1; j <= m; j += 1) if (p[j]) answer[p[j] - 1] = j - 1;
    if (answer.some((j, i) => j < 0 || a[i][j] >= 1e8)) return null;
    return answer;
  }

  function testPrompts(database) {
    const flat = database.flatMap(player => player.seasons.map(season => ({ ...season, playerId: player.playerId, name: player.name })));
    const enabled = PROMPTS.filter(prompt => prompt.enabled !== false && typeof prompt.test === "function");
    const failures = [], broad = [];
    enabled.forEach(prompt => {
      const players = new Set();
      let threw = false;
      flat.forEach(row => {
        if (row.position !== prompt.position) return;
        try { if (prompt.test(row)) players.add(row.playerId); } catch { threw = true; }
      });
      if (threw || players.size === 0) failures.push(`${prompt.id}: ${threw ? "test error" : "no valid players"}`);
      if (players.size > 125) broad.push({ id: prompt.id, players: players.size });
    });
    return { tested: enabled.length, failures, broad };
  }

  async function readZip(file, onProgress) {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const eocd = findSignature(view, 0x06054b50, Math.max(0, view.byteLength - 66000), view.byteLength - 22);
    if (eocd < 0) throw new Error("ZIP end record was not found.");
    const total = view.getUint16(eocd + 10, true);
    let cursor = view.getUint32(eocd + 16, true);
    const entries = [];
    for (let i = 0; i < total; i += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Invalid ZIP central directory.");
      const method = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(buffer, cursor + 46, nameLength));
      entries.push({ name, method, compressedSize, localOffset });
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    const jsonEntries = entries.filter(entry => /\.json$/i.test(entry.name) && !entry.name.includes("__MACOSX"));
    const objects = [], errors = [];
    for (let i = 0; i < jsonEntries.length; i += 1) {
      const entry = jsonEntries[i];
      try {
        const bytes = await unzipEntry(buffer, view, entry);
        objects.push(...extractPlayerObjects(JSON.parse(new TextDecoder().decode(bytes))));
      } catch (error) { errors.push({ file: entry.name, reason: error.message }); }
      if (i % 25 === 0) { onProgress?.({ done: i + 1, total: jsonEntries.length }); await yieldFrame(); }
    }
    onProgress?.({ done: jsonEntries.length, total: jsonEntries.length });
    return { objects, errors };
  }

  async function unzipEntry(buffer, view, entry) {
    const offset = entry.localOffset;
    if (view.getUint32(offset, true) !== 0x04034b50) throw new Error("Invalid local ZIP header.");
    const nameLength = view.getUint16(offset + 26, true), extraLength = view.getUint16(offset + 28, true);
    const dataOffset = offset + 30 + nameLength + extraLength;
    const compressed = new Uint8Array(buffer, dataOffset, entry.compressedSize);
    if (entry.method === 0) return new Uint8Array(compressed);
    if (entry.method !== 8) throw new Error(`Unsupported ZIP compression method ${entry.method}.`);
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot decompress ZIP files. Extract the ZIP and select its JSON files instead.");
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function findSignature(view, signature, start, end) {
    for (let offset = end; offset >= start; offset -= 1) if (view.getUint32(offset, true) === signature) return offset;
    return -1;
  }

  function reset() {
    sourceSnapshots = []; sourceErrors = []; preview = null; checks = []; liveAssets = null;
    els.legacyArchiveInput.value = "";
    els.legacyArchiveFileStatus.textContent = "No archive selected.";
    els.legacyImportPreview.classList.add("hidden");
    els.buildLegacyPreviewBtn.disabled = true;
    els.downloadLegacyPackBtn.disabled = true;
    els.legacyImportActionStatus.textContent = "Choose the source ZIP to begin.";
    els.legacyDownloadStatus.textContent = "";
    setStatus("Waiting for archive", "pending");
  }

  function meta(club, position, promoted, managers) { return { club, position, promoted, managers }; }
  function clubMetadata(value) { return CLUBS[normalise(value)] || null; }
  function sourceName(snapshot) { return `${String(first(snapshot, ["first_name", "firstName"]) ?? "").trim()} ${String(first(snapshot, ["second_name", "surname", "last_name", "lastName"]) ?? "").trim()}`.trim() || String(first(snapshot, ["name", "web_name"]) ?? "").trim(); }
  function isPlayerSnapshot(value) { return value && typeof value === "object" && (value.total_points != null || value.points != null) && (value.first_name != null || value.second_name != null || value.web_name != null || value.name != null); }
  function extractPlayerObjects(value) {
    if (Array.isArray(value)) return value.flatMap(extractPlayerObjects);
    if (!value || typeof value !== "object") return [];
    if (isPlayerSnapshot(value)) return [value];
    for (const key of ["players", "elements", "data", "results"]) if (Array.isArray(value[key])) return value[key].flatMap(extractPlayerObjects);
    return [];
  }
  function dedupeSnapshots(values) {
    const map = new Map();
    values.forEach(value => {
      const key = String(first(value, ["id", "code"]) ?? `${normalise(sourceName(value))}|${normalise(first(value, ["team_name", "club"]))}`);
      const previous = map.get(key);
      if (!previous || completeness(value) > completeness(previous)) map.set(key, value);
    });
    return [...map.values()];
  }
  function completeness(value) { return ["first_name", "second_name", "team_name", "type_name", "total_points", "minutes", "now_cost", "original_cost"].reduce((n, key) => n + (value[key] != null ? 1 : 0), 0); }
  function positionValue(value) {
    const raw = String(value ?? "").trim().toUpperCase();
    if (["1", "GK", "GKP", "GOALKEEPER", "K"].includes(raw)) return "GK";
    if (["2", "DEF", "D", "DEFENDER"].includes(raw)) return "DEF";
    if (["3", "MID", "M", "MIDFIELDER"].includes(raw)) return "MID";
    if (["4", "FWD", "FW", "F", "FORWARD", "STRIKER", "S"].includes(raw)) return "FWD";
    return "";
  }
  function findHistoryByName(name) { const key = normalise(name); return Object.values(HISTORY).find(record => record.names.some(item => normalise(item) === key)) || null; }
  function compareStats(name, source, history) {
    const pairs = [["points", "points"], ["minutes", "minutes"], ["goals", "goals"], ["assists", "assists"], ["cleanSheets", "cleanSheets"], ["bonus", "bonus"], ["saves", "saves"]];
    const differences = pairs.filter(([a, b]) => Number(source[a]) !== Number(history[b])).map(([key]) => ({ field: key, snapshot: source[key], history: history[key] }));
    return { name, code: history.code, differences };
  }
  function validImportedRecord(record) {
    const club = Object.values(CLUBS).some(item => item.club === record.club);
    const startingPriceValid = record.startingPrice == null
      ? record.source?.startingPriceConfidence === "unavailable"
      : validPrice(record.startingPrice);
    return record.season === SEASON && club && VALID_POSITIONS.has(record.position) && startingPriceValid && validPrice(record.finalPrice) && Number.isInteger(record.leaguePosition) && record.leaguePosition >= 1 && record.leaguePosition <= 20 && Array.isArray(record.managers) && record.managers.length && ["points", "minutes", "goals", "assists", "cleanSheets", "bonus", "saves", "goalsConceded", "yellowCards", "redCards"].every(key => Number.isFinite(record[key]) && record[key] >= 0);
  }
  function existingDataUnchanged(database) {
    const map = new Map(database.map(player => [player.playerId, player]));
    return BASE_PLAYERS.every(base => {
      const current = map.get(base.playerId);
      if (!current || current.name !== base.name) return false;
      if (JSON.stringify(current.bio || {}) !== JSON.stringify(base.bio || {})) return false;
      if ((current.identityDisambiguator || "") !== (base.identityDisambiguator || "")) return false;
      const currentSeasons = new Map(current.seasons.filter(season => season.season !== SEASON).map(season => [season.season, season]));
      if (currentSeasons.size !== base.seasons.length) return false;
      return base.seasons.every(season => {
        const preserved = currentSeasons.get(season.season);
        return preserved && JSON.stringify(preserved) === JSON.stringify(season);
      });
    });
  }
  function adjacentClub(player) { return player.seasons.find(season => season.season === NEXT_SEASON)?.club || ""; }
  function candidateSummary(player, score) { return { playerId: player.playerId, name: player.name, score, adjacentClub: adjacentClub(player), seasons: player.seasons.map(season => `${season.season} ${season.club}`).slice(0, 4) }; }
  function reviewMatch(reason, indexes, database) { return { kind: "review", reason, candidates: indexes.map(index => candidateSummary(database[index], 120)) }; }
  function nicknameEquivalent(a, b) {
    const x = normalise(a), y = normalise(b);
    if (x === y) return true;
    return NICKNAMES.some(pair => pair.includes(x) && pair.includes(y));
  }
  function addAlias(player, value) { if (!value || normalise(value) === normalise(player.name)) return; player.aliases ||= []; if (!player.aliases.some(alias => normalise(alias) === normalise(value))) player.aliases.push(value); }
  function uniqueId(base, club, used) { let id = base || `legacy-player`; if (!used.has(id)) return id; id = `${base}-${slugify(club)}`; let suffix = 2, candidate = id; while (used.has(candidate)) candidate = `${id}-${suffix++}`; return candidate; }
  function compactSnapshot(snapshot) { return { id: first(snapshot, ["id"]), code: first(snapshot, ["code"]), name: sourceName(snapshot), club: first(snapshot, ["team_name", "club"]), position: first(snapshot, ["type_name", "position"]), points: first(snapshot, ["total_points", "points"]) }; }
  function addCheck(results, condition, title, detail) { results.push({ state: condition ? "pass" : "fail", title, detail, blocking: true }); }
  function warning(title, detail) { return `<div class="warning"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`; }
  function fail(reason) { return { ok: false, reason }; }
  function first(object, keys) { for (const key of keys) if (object?.[key] != null && object[key] !== "") return object[key]; return null; }
  function numeric(value) { const n = Number(String(value ?? "").replace(/[^0-9.+-]/g, "")); return Number.isFinite(n) ? n : null; }
  function whole(value) { const n = numeric(value); return n == null ? 0 : Math.max(0, Math.round(n)); }
  function price(value) { const n = numeric(value); if (n == null) return null; return roundOne(Math.abs(n) > 30 ? n / 10 : n); }
  function validPrice(value) { return Number.isFinite(value) && value >= 3 && value <= 20; }
  function roundOne(value) { return Math.round(Number(value) * 10) / 10; }
  function dateValue(value) { const text = String(value ?? "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : null; }
  function ageAtSeasonStart(date) { const birth = new Date(`${date}T00:00:00Z`), start = new Date("2015-08-08T00:00:00Z"); let age = start.getUTCFullYear() - birth.getUTCFullYear(); if (start.getUTCMonth() < birth.getUTCMonth() || (start.getUTCMonth() === birth.getUTCMonth() && start.getUTCDate() < birth.getUTCDate())) age -= 1; return age >= 15 && age <= 50 ? age : null; }
  function normalise(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function slugify(value) { return normalise(value).replace(/\s+/g, "-"); }
  function firstToken(value) { return normalise(value).split(" ").filter(Boolean)[0] || ""; }
  function lastToken(value) { const parts = normalise(value).split(" ").filter(Boolean); return parts[parts.length - 1] || ""; }
  function seasonYear(value) { return Number(String(value || "").slice(0, 4)) || 0; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function formatBytes(value) { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 ** 2).toFixed(1)} MB`; }
  function serialisePlayers(database, note) { return `/* ${note}. */\nwindow.FPL_PLAYERS = ${JSON.stringify(database)};\n`; }
  function replacePerfectScore(source, score) { return /perfectScore\s*:\s*\d+/.test(source) ? source.replace(/perfectScore\s*:\s*\d+/, `perfectScore: ${score}`) : source; }
  function patchIndexFor2015(source) {
    return String(source)
      .replaceAll("2016/17–2025/26", "2015/16–2025/26")
      .replace(/players\.js\?v=[^"']+/g, "players.js?v=12.1.0")
      .replace(
        "£${record.startingPrice.toFixed(1)}m starting price",
        '${Number.isFinite(record.startingPrice) ? `£${record.startingPrice.toFixed(1)}m starting price` : "Starting price unavailable"}'
      );
  }
  function readmeText(summary, blocked) { return `${blocked ? "REVIEW ONLY — DO NOT UPLOAD THE PREVIEW FILES" : "2015/16 FPL DATABASE EXPANSION — UPLOAD READY"}

Season added: 2015/16
Official source snapshots read: ${summary.sourceSnapshots}
Verified player-seasons imported: ${summary.imported}
Matched existing identities: ${summary.matched}
New historical identities: ${summary.created}
Verified records without recoverable starting price: ${summary.partialStartingPrice || 0}
Withheld for review: ${summary.review}
Quarantined: ${summary.quarantine}

Records without a recoverable starting price remain eligible for all non-price prompts, but are automatically excluded from starting-price prompts.

${blocked ? "Resolve the failed checks shown in REPORTS/import-summary.json before uploading." : "Upload every file inside UPLOAD/ to the root of your GitHub repository, replacing the existing files. Commit them together, wait for GitHub Pages to turn green, then refresh with Ctrl+Shift+R."}

Backups and detailed reports are included.
`; }
  function setStatus(text, state) { els.legacyImportStatus.textContent = text; els.legacyImportStatus.className = `audit-status-chip ${state}`; }
  function showError(message) { setStatus("Needs attention", "blocked"); els.legacyImportActionStatus.textContent = message; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
  function yieldFrame() { return new Promise(resolve => setTimeout(resolve, 0)); }
  function dateStamp() { return new Date().toISOString().slice(0, 10); }
  function downloadBlob(filename, blob) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  window.FPL_STUDIO_PHASE12 = Object.freeze({
    parseSnapshots: values => dedupeSnapshots(values.flatMap(extractPlayerObjects)),
    readZip,
    convertSnapshot,
    solvePerfectXi,
    getPreview: () => preview,
    getChecks: () => checks
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* ===== END admin-phase12.js ===== */

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
      disableBtn: document.querySelector("#disablePoorPromptsBtn"),
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
    elements.ratingsBtn.addEventListener("click", () => applyRecommendations(elements, core, { ratings: true, disable: false }));
    elements.disableBtn.addEventListener("click", () => applyRecommendations(elements, core, { ratings: false, disable: true }));
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
      if (record.position !== prompt.position) continue;
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

  function renderResults(elements) {
    if (!analysisResults.length) return;
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

    elements.listSummary.textContent = `${filtered.length.toLocaleString()} of ${analysisResults.length.toLocaleString()} analysed prompts shown`;
    elements.list.innerHTML = filtered.length ? filtered.map(renderQualityCard).join("") : '<div class="quality-empty">No prompts match these filters.</div>';
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
    </article>`;
  }

  function applyRecommendations(elements, core, options) {
    if (!analysisResults.length) return;
    const targets = analysisResults.filter(result => options.ratings || (!result.suggestedEnabled && result.enabled));
    if (!targets.length) {
      elements.status.textContent = options.disable ? "No enabled prompts are recommended for disabling." : "There are no rating suggestions to apply.";
      return;
    }

    const message = options.disable
      ? `Disable ${targets.filter(result => !result.suggestedEnabled && result.enabled).length} low-quality prompt(s) in this browser workspace? You can still reset the browser edits later.`
      : `Apply the suggested quality rating to ${targets.length} analysed prompt(s) in this browser workspace?`;
    if (!window.confirm(message)) return;

    const library = core.getPromptLibrary?.() || [];
    const state = loadManagerState();
    let changed = 0;

    for (const result of analysisResults) {
      const prompt = library.find(item => item.id === result.id);
      if (!prompt) continue;
      let shouldPersist = false;
      if (options.ratings && prompt.rating !== result.suggestedRating) {
        prompt.rating = result.suggestedRating;
        shouldPersist = true;
      }
      if (options.disable && !result.suggestedEnabled && prompt.enabled !== false) {
        prompt.enabled = false;
        shouldPersist = true;
      }
      if (!shouldPersist) continue;
      persistPromptMetadata(state, prompt);
      changed += 1;
    }

    if (!changed) {
      elements.status.textContent = "The analysed prompts already match those recommendations.";
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
    if (!isRunning) elements.cancelBtn.textContent = "Cancel analysis";
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
    elements.disableBtn.disabled = !enabled;
    elements.jsonBtn.disabled = !enabled;
    elements.csvBtn.disabled = !enabled;
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
