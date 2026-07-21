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

    preview = { database, imported, matched, created, review, quarantine, crossChecks, sourceErrors: clone(sourceErrors), generatedAt: new Date().toISOString() };
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
    if (!validPrice(startingPrice) || !validPrice(finalPrice)) return fail("A trustworthy starting or final FPL price is unavailable.");

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
      startingPrice: roundOne(startingPrice),
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
        confidence: history ? "verified-cross-source" : "verified-official-snapshot"
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
    addCheck(results, invalidImported.length === 0, "Imported schema and metadata", invalidImported.length ? `${invalidImported.length} imported records are invalid.` : "All imported records have valid clubs, positions, prices, statistics and 2015/16 flags.");

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
    downloadBlob(`fpl-2015-16-expansion-${blocked ? "review" : "upload-ready"}-${dateStamp()}.zip`, zipBuilder(files));
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
    return record.season === SEASON && club && VALID_POSITIONS.has(record.position) && validPrice(record.startingPrice) && validPrice(record.finalPrice) && Number.isInteger(record.leaguePosition) && record.leaguePosition >= 1 && record.leaguePosition <= 20 && Array.isArray(record.managers) && record.managers.length && ["points", "minutes", "goals", "assists", "cleanSheets", "bonus", "saves", "goalsConceded", "yellowCards", "redCards"].every(key => Number.isFinite(record[key]) && record[key] >= 0);
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
  function patchIndexFor2015(source) { return String(source).replaceAll("2016/17–2025/26", "2015/16–2025/26").replace(/players\.js\?v=[^\"']+/g, "players.js?v=12.0.0"); }
  function readmeText(summary, blocked) { return `${blocked ? "REVIEW ONLY — DO NOT UPLOAD THE PREVIEW FILES" : "2015/16 FPL DATABASE EXPANSION — UPLOAD READY"}\n\nSeason added: 2015/16\nOfficial source snapshots read: ${summary.sourceSnapshots}\nVerified player-seasons imported: ${summary.imported}\nMatched existing identities: ${summary.matched}\nNew historical identities: ${summary.created}\nWithheld for review: ${summary.review}\nQuarantined: ${summary.quarantine}\n\n${blocked ? "Resolve the failed checks shown in REPORTS/import-summary.json before uploading." : "Upload every file inside UPLOAD/ to the root of your GitHub repository, replacing the existing files. Commit them together, wait for GitHub Pages to turn green, then refresh with Ctrl+Shift+R."}\n\nBackups and detailed reports are included.\n`; }
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
