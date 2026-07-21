/* FPL Challenge Studio Phase 10 — protected single-season historical importer. */
(() => {
  "use strict";

  const originalPlayers = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const promptLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  const VALID_POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);
  const POSITION_BY_TYPE = Object.freeze({ 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" });
  const REQUIRED_NUMERIC = ["points", "minutes", "goals", "assists", "cleanSheets", "bonus", "saves", "goalsConceded", "yellowCards", "redCards", "startingPrice", "finalPrice"];

  const state = {
    datasetRows: [],
    teamMap: new Map(),
    metadataMap: new Map(),
    clubMetadata: new Map(),
    normalisedRows: [],
    conflicts: [],
    decisions: new Map(),
    quarantine: [],
    workspace: null,
    regression: [],
    ready: false,
    liveChallenge: null,
    sourceFiles: {},
    parsed: false
  };

  const elements = {};
  window.addEventListener("load", initialise, { once: true });

  function initialise() {
    [
      "importCentreStatus", "importBaseDatabase", "importSeasonLabel", "importSourceName", "importSourceUrl", "importSourceTrust", "importRequireManagers",
      "importDatasetFile", "importTeamsFile", "importMetadataFile", "importDatasetFileStatus", "importTeamsFileStatus", "importMetadataFileStatus",
      "parseImportFilesBtn", "buildImportPreviewBtn", "resetImportCentreBtn", "importActionStatus", "importClubMetadataPanel", "importClubMetadataStatus",
      "importClubMetadataRows", "importPreviewPanel", "importSourceRows", "importMatchedPlayers", "importNewPlayers", "importConflictCount",
      "importQuarantineCount", "importProjectedSeasons", "importWarnings", "importConflictPanel", "importConflictList", "rebuildImportPreviewBtn",
      "runImportChecksBtn", "importRegressionList", "importDownloadExplanation", "downloadImportPackBtn", "importDownloadStatus"
    ].forEach(id => elements[id] = document.getElementById(id));

    if (!elements.parseImportFilesBtn) return;

    bindFileStatus(elements.importDatasetFile, elements.importDatasetFileStatus);
    bindFileStatus(elements.importTeamsFile, elements.importTeamsFileStatus);
    bindFileStatus(elements.importMetadataFile, elements.importMetadataFileStatus);
    elements.parseImportFilesBtn.addEventListener("click", readImportFiles);
    elements.buildImportPreviewBtn.addEventListener("click", buildImportPreview);
    elements.rebuildImportPreviewBtn.addEventListener("click", buildImportPreview);
    elements.runImportChecksBtn.addEventListener("click", runRegressionChecks);
    elements.resetImportCentreBtn.addEventListener("click", resetImporter);
    elements.downloadImportPackBtn.addEventListener("click", downloadImportPack);
    elements.importClubMetadataRows.addEventListener("input", onMetadataEdit);
    elements.importClubMetadataRows.addEventListener("change", onMetadataEdit);
    elements.importConflictList.addEventListener("change", onConflictDecision);

    window.FPL_DATABASE_IMPORT_CENTRE = Object.freeze({
      readFiles: readImportFiles,
      buildPreview: buildImportPreview,
      runChecks: runRegressionChecks,
      getWorkspace: () => cloneData(state.workspace),
      getRegression: () => cloneData(state.regression),
      getQuarantine: () => cloneData(state.quarantine),
      reset: resetImporter
    });

    if (!originalPlayers.length) {
      setCentreStatus("Database unavailable", "blocked");
      elements.importActionStatus.textContent = "players.js did not load, so the importer cannot start.";
      elements.parseImportFilesBtn.disabled = true;
      return;
    }
    setCentreStatus("Waiting for files", "pending");
  }

  function bindFileStatus(input, status) {
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      status.textContent = file ? `${file.name} · ${formatBytes(file.size)}` : "No file selected.";
    });
  }

  async function readImportFiles() {
    resetPreviewOnly();
    const datasetFile = elements.importDatasetFile.files?.[0];
    const season = normaliseSeasonLabel(elements.importSeasonLabel.value);
    const sourceName = elements.importSourceName.value.trim();
    if (!datasetFile) return showImportError("Choose the player season dataset first.");
    if (!season) return showImportError("Enter the season as YYYY/YY, for example 2015/16.");
    if (!sourceName) return showImportError("Enter a source name so every imported record can be traced.");

    elements.parseImportFilesBtn.disabled = true;
    setCentreStatus("Reading files…", "pending");
    elements.importActionStatus.textContent = "Reading the dataset and optional mapping files…";

    try {
      const [datasetText, teamsText, metadataText] = await Promise.all([
        datasetFile.text(),
        elements.importTeamsFile.files?.[0]?.text() || Promise.resolve(""),
        elements.importMetadataFile.files?.[0]?.text() || Promise.resolve("")
      ]);
      const dataset = parseDataFile(datasetFile.name, datasetText, "dataset");
      const teams = teamsText ? parseDataFile(elements.importTeamsFile.files[0].name, teamsText, "teams") : [];
      const metadata = metadataText ? parseDataFile(elements.importMetadataFile.files[0].name, metadataText, "metadata") : [];

      state.datasetRows = flattenDataset(dataset, season);
      state.teamMap = buildTeamMap(teams);
      state.metadataMap = buildMetadataMap(metadata);
      state.sourceFiles = {
        dataset: fileDescriptor(datasetFile),
        teams: elements.importTeamsFile.files?.[0] ? fileDescriptor(elements.importTeamsFile.files[0]) : null,
        metadata: elements.importMetadataFile.files?.[0] ? fileDescriptor(elements.importMetadataFile.files[0]) : null
      };

      if (!state.datasetRows.length) throw new Error("No player-season rows were recognised in the selected dataset.");
      state.normalisedRows = state.datasetRows.map((row, index) => normaliseSourceRow(row, index, season, state.teamMap));
      const recognised = state.normalisedRows.filter(row => row.name && row.position && row.clubKey).length;
      if (!recognised) throw new Error("The rows could not be mapped to footballer names, positions and clubs.");

      seedClubMetadata();
      renderClubMetadata();
      state.parsed = true;
      elements.buildImportPreviewBtn.disabled = false;
      elements.importClubMetadataPanel.classList.remove("hidden");
      elements.importActionStatus.textContent = `${state.normalisedRows.length.toLocaleString()} source rows read. Complete the club metadata, then build the preview.`;
      setCentreStatus("Files mapped", "pending");
    } catch (error) {
      state.parsed = false;
      elements.buildImportPreviewBtn.disabled = true;
      showImportError(error instanceof Error ? error.message : String(error));
    } finally {
      elements.parseImportFilesBtn.disabled = false;
    }
  }

  function parseDataFile(filename, text, purpose) {
    const trimmed = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!trimmed) return [];
    const extension = filename.toLowerCase().split(".").pop();
    if (extension === "csv") return parseCsv(trimmed);
    if (extension === "json") return unwrapData(JSON.parse(trimmed), purpose);
    if (extension === "js" || extension === "txt") {
      try { return unwrapData(JSON.parse(trimmed), purpose); }
      catch {}
      const sandbox = Object.create(null);
      const value = new Function("window", `"use strict";\n${trimmed}\nreturn window.FPL_PLAYERS || window.FPL_TEAMS || window.FPL_CLUB_METADATA || null;`)(sandbox);
      if (value) return unwrapData(value, purpose);
      throw new Error(`Could not find a supported data array in ${filename}.`);
    }
    throw new Error(`${filename} is not a supported CSV, JSON, JS or TXT file.`);
  }

  function unwrapData(value, purpose) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    const keys = purpose === "dataset"
      ? ["players", "elements", "data", "rows", "FPL_PLAYERS"]
      : purpose === "teams"
        ? ["teams", "data", "rows"]
        : ["metadata", "clubs", "teams", "data", "rows"];
    for (const key of keys) if (Array.isArray(value[key])) return value[key];
    return [];
  }

  function flattenDataset(data, season) {
    const rows = [];
    for (const item of data || []) {
      if (!item || typeof item !== "object") continue;
      if (Array.isArray(item.seasons)) {
        for (const seasonRecord of item.seasons) {
          if (!seasonRecord || typeof seasonRecord !== "object") continue;
          if (seasonRecord.season && seasonRecord.season !== season) continue;
          rows.push({ ...seasonRecord, name: item.name || seasonRecord.name, playerId: item.playerId, bio: item.bio || {}, sourcePlayer: item });
        }
      } else rows.push(item);
    }
    return rows;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(field); field = ""; }
      else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
      else field += char;
    }
    if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
    const nonEmpty = rows.filter(values => values.some(value => String(value).trim() !== ""));
    if (nonEmpty.length < 2) return [];
    const headers = nonEmpty[0].map(header => canonicalHeader(header));
    return nonEmpty.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  }

  function canonicalHeader(value) {
    return String(value || "").trim().replace(/^\uFEFF/, "").replace(/[\s-]+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  }

  function buildTeamMap(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const id = first(row, ["id", "team", "team_id", "code"]);
      const name = first(row, ["name", "club", "team_name", "short_name"]);
      if (id != null && name) map.set(String(id), String(name).trim());
    }
    return map;
  }

  function buildMetadataMap(rows) {
    const map = new Map();
    for (const row of rows || []) {
      const sourceClub = first(row, ["source_team", "sourceclub", "team", "club", "name", "team_name"]);
      if (!sourceClub) continue;
      const club = String(first(row, ["club_name", "canonical_club", "club", "name", "team_name"]) || sourceClub).trim();
      const leaguePosition = integer(first(row, ["league_position", "final_position", "position", "leagueposition"]));
      const promoted = booleanValue(first(row, ["promoted", "is_promoted"]));
      const managers = splitManagers(first(row, ["managers", "manager", "coaches"]));
      map.set(normaliseText(sourceClub), { sourceClub: String(sourceClub), club, leaguePosition, promoted, managers });
    }
    return map;
  }

  function normaliseSourceRow(row, index, season, teamMap) {
    const firstName = first(row, ["first_name", "firstname", "firstName"]);
    const secondName = first(row, ["second_name", "surname", "lastname", "last_name", "secondName"]);
    const knownName = first(row, ["known_name", "knownname"]);
    const name = String(first(row, ["name", "player_name", "player", "full_name"]) || knownName || [firstName, secondName].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim();
    const rawTeam = first(row, ["club", "team_name", "teamname", "team", "team_id"]);
    const sourceClub = teamMap.get(String(rawTeam)) || String(rawTeam ?? "").trim();
    const positionRaw = first(row, ["position", "pos", "element_type", "elementtype"]);
    const position = normalisePosition(positionRaw);
    const finalPriceRaw = first(row, ["finalprice", "final_price", "now_cost", "nowcost", "price"]);
    const costChangeRaw = first(row, ["cost_change_start", "costchangestart"]);
    const finalPrice = priceValue(finalPriceRaw);
    const explicitStarting = first(row, ["startingprice", "starting_price", "start_price", "startprice"]);
    let startingPrice = explicitStarting != null && explicitStarting !== "" ? priceValue(explicitStarting) : null;
    if (startingPrice == null && finalPrice != null && numeric(costChangeRaw) != null) startingPrice = roundOne(finalPrice - numeric(costChangeRaw) / 10);
    if (startingPrice == null) startingPrice = finalPrice;

    const birthDate = String(first(row, ["dateofbirth", "date_of_birth", "birth_date", "birthdate"]) || row.bio?.dateOfBirth || "").trim() || null;
    const regionId = integer(first(row, ["regionid", "region_id", "region"])) ?? integer(row.bio?.regionId);
    const ageFromRow = integer(first(row, ["ageatseasonstart", "age_at_season_start", "age"]));
    const ageAtSeasonStart = ageFromRow ?? calculateSeasonAge(birthDate, season);
    const sourceId = String(first(row, ["opta_code", "optacode", "code", "playerid", "player_id", "id"]) || row.playerId || "").trim();

    return {
      rowIndex: index + 1,
      raw: row,
      name,
      nameKey: normaliseText(name),
      suggestedPlayerId: slugify(row.playerId || name),
      sourceId,
      birthDate,
      regionId,
      season,
      sourceClub,
      clubKey: normaliseText(sourceClub),
      position,
      points: whole(first(row, ["points", "total_points", "totalpoints"])),
      minutes: whole(first(row, ["minutes", "mins"])),
      goals: whole(first(row, ["goals", "goals_scored", "goalsscored"])),
      assists: whole(first(row, ["assists"])),
      cleanSheets: whole(first(row, ["cleansheets", "clean_sheets"])),
      bonus: whole(first(row, ["bonus"])),
      saves: whole(first(row, ["saves"])),
      goalsConceded: whole(first(row, ["goalsconceded", "goals_conceded"])),
      yellowCards: whole(first(row, ["yellowcards", "yellow_cards"])),
      redCards: whole(first(row, ["redcards", "red_cards"])),
      startingPrice,
      finalPrice,
      ageAtSeasonStart
    };
  }

  function seedClubMetadata() {
    state.clubMetadata.clear();
    const clubKeys = [...new Set(state.normalisedRows.map(row => row.clubKey).filter(Boolean))].sort();
    for (const key of clubKeys) {
      const sample = state.normalisedRows.find(row => row.clubKey === key);
      const supplied = state.metadataMap.get(key) || state.metadataMap.get(normaliseText(sample?.sourceClub));
      state.clubMetadata.set(key, {
        sourceClub: sample?.sourceClub || "Unknown",
        club: supplied?.club || sample?.sourceClub || "",
        leaguePosition: supplied?.leaguePosition ?? null,
        promoted: supplied?.promoted ?? false,
        managers: supplied?.managers || []
      });
    }
  }

  function renderClubMetadata() {
    const entries = [...state.clubMetadata.entries()];
    elements.importClubMetadataRows.innerHTML = entries.map(([key, meta]) => `
      <tr data-club-key="${escapeHtml(key)}">
        <td>${escapeHtml(meta.sourceClub)}</td>
        <td><input class="club-name-input" type="text" value="${escapeHtml(meta.club)}" aria-label="Club name for ${escapeHtml(meta.sourceClub)}"></td>
        <td><input class="club-position-input" type="number" min="1" max="20" value="${meta.leaguePosition ?? ""}" aria-label="Final position for ${escapeHtml(meta.sourceClub)}"></td>
        <td class="promoted-cell"><input class="club-promoted-input" type="checkbox" ${meta.promoted ? "checked" : ""} aria-label="${escapeHtml(meta.sourceClub)} promoted"></td>
        <td><input class="club-managers-input" type="text" value="${escapeHtml(meta.managers.join(", "))}" placeholder="Manager One, Manager Two" aria-label="Managers for ${escapeHtml(meta.sourceClub)}"></td>
      </tr>`).join("");
    updateClubMetadataStatus();
  }

  function onMetadataEdit(event) {
    const row = event.target.closest("tr[data-club-key]");
    if (!row) return;
    const key = row.dataset.clubKey;
    const meta = state.clubMetadata.get(key);
    if (!meta) return;
    meta.club = row.querySelector(".club-name-input").value.trim();
    meta.leaguePosition = integer(row.querySelector(".club-position-input").value);
    meta.promoted = row.querySelector(".club-promoted-input").checked;
    meta.managers = splitManagers(row.querySelector(".club-managers-input").value);
    state.ready = false;
    elements.downloadImportPackBtn.disabled = true;
    updateClubMetadataStatus();
  }

  function updateClubMetadataStatus() {
    const requireManagers = elements.importRequireManagers.checked;
    const values = [...state.clubMetadata.values()];
    const ready = values.filter(meta => meta.club && between(meta.leaguePosition, 1, 20) && (!requireManagers || meta.managers.length)).length;
    elements.importClubMetadataStatus.textContent = `${ready} of ${values.length} clubs ready`;
    elements.importClubMetadataStatus.classList.toggle("ready-chip", Boolean(values.length && ready === values.length));
  }

  async function buildImportPreview() {
    if (!state.parsed) return showImportError("Read the import files first.");
    pullMetadataFromTable();
    state.ready = false;
    state.workspace = null;
    state.regression = [];
    elements.downloadImportPackBtn.disabled = true;
    elements.importDownloadStatus.textContent = "";
    setCentreStatus("Building preview…", "pending");
    elements.importActionStatus.textContent = "Matching footballers without changing the loaded database…";

    try {
      const base = getSelectedBaseDatabase();
      const preview = buildWorkspace(base);
      state.workspace = preview.database;
      state.conflicts = preview.conflicts;
      state.quarantine = preview.quarantine;
      renderPreview(preview);
      elements.importPreviewPanel.classList.remove("hidden");
      await runRegressionChecks();
      elements.importActionStatus.textContent = state.ready
        ? "Preview passed every safety gate. The protected upload package is ready."
        : "Preview built. Resolve the highlighted items before using the database.";
    } catch (error) {
      showImportError(error instanceof Error ? error.message : String(error));
    }
  }

  function getSelectedBaseDatabase() {
    if (elements.importBaseDatabase.value === "auto-repaired") {
      const repaired = window.FPL_AUTOMATIC_DATABASE_REPAIR?.getWorkspace?.();
      if (!Array.isArray(repaired) || !repaired.length) throw new Error("Run Phase 9 automatic repair first, or choose the current loaded players.js as the base.");
      return cloneData(repaired);
    }
    return cloneData(originalPlayers);
  }

  function buildWorkspace(base) {
    const database = cloneData(base);
    const byName = new Map();
    const byId = new Map(database.map(player => [player.playerId, player]));
    database.forEach(player => {
      const key = normaliseText(player.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(player);
    });

    const conflicts = [], quarantine = [], additions = [];
    let matched = 0, newPlayers = 0;
    const reservedIds = new Set(database.map(player => player.playerId));

    for (const row of state.normalisedRows) {
      const validation = validateNormalisedRow(row);
      if (validation.length) {
        quarantine.push({ row, reason: validation.join("; ") });
        continue;
      }
      const meta = state.clubMetadata.get(row.clubKey);
      if (!meta || !meta.club || !between(meta.leaguePosition, 1, 20)) {
        quarantine.push({ row, reason: `Club metadata is incomplete for ${row.sourceClub || "an unknown club"}.` });
        continue;
      }
      if (elements.importRequireManagers.checked && !meta.managers.length) {
        quarantine.push({ row, reason: `Manager metadata is missing for ${meta.club}.` });
        continue;
      }

      const candidates = byName.get(row.nameKey) || [];
      let target = null;
      const decisionKey = conflictKey(row);
      const existingDecision = state.decisions.get(decisionKey);

      if (existingDecision) {
        if (existingDecision === "quarantine") {
          quarantine.push({ row, reason: "Manually quarantined during identity review." });
          continue;
        }
        if (existingDecision === "new") target = null;
        else target = byId.get(existingDecision) || null;
      } else if (candidates.length === 1 && identityCompatible(candidates[0], row)) {
        target = candidates[0];
      } else if (candidates.length === 0) {
        target = null;
      } else {
        conflicts.push({ key: decisionKey, row, candidates });
        continue;
      }

      const record = createSeasonRecord(row, meta);
      if (target) {
        if (target.seasons.some(seasonRecord => seasonRecord.season === row.season)) {
          quarantine.push({ row, reason: `${target.name} already has a ${row.season} season record.` });
          continue;
        }
        target.seasons.push(record);
        target.seasons.sort(compareSeasonsDescending);
        enrichBio(target, row);
        matched += 1;
      } else {
        const playerId = uniquePlayerId(row.suggestedPlayerId || row.name, reservedIds);
        reservedIds.add(playerId);
        const player = { playerId, name: row.name, seasons: [record], bio: {} };
        enrichBio(player, row);
        database.push(player);
        byId.set(playerId, player);
        if (!byName.has(row.nameKey)) byName.set(row.nameKey, []);
        byName.get(row.nameKey).push(player);
        newPlayers += 1;
      }
      additions.push({ row, targetId: target?.playerId || null });
    }

    database.sort((a, b) => a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId));
    return { database, conflicts, quarantine, additions, matched, newPlayers, projectedSeasons: countSeasons(database) };
  }

  function validateNormalisedRow(row) {
    const errors = [];
    if (!row.name) errors.push("Missing footballer name");
    if (!row.clubKey) errors.push("Missing club/team");
    if (!VALID_POSITIONS.has(row.position)) errors.push("Invalid or missing position");
    for (const field of REQUIRED_NUMERIC) {
      if (!Number.isFinite(row[field]) || row[field] < 0) errors.push(`Invalid ${field}`);
    }
    if (Number.isFinite(row.minutes) && row.minutes > 4500) errors.push("Minutes exceed a plausible Premier League season");
    if (Number.isFinite(row.startingPrice) && !between(row.startingPrice, 3.5, 16)) errors.push("Starting price outside £3.5m–£16.0m");
    if (Number.isFinite(row.finalPrice) && !between(row.finalPrice, 3.5, 16)) errors.push("Final price outside £3.5m–£16.0m");
    return [...new Set(errors)];
  }

  function createSeasonRecord(row, meta) {
    const position = meta.leaguePosition;
    return {
      season: row.season,
      club: meta.club,
      position: row.position,
      points: row.points,
      minutes: row.minutes,
      goals: row.goals,
      assists: row.assists,
      cleanSheets: row.cleanSheets,
      bonus: row.bonus,
      saves: row.saves,
      goalsConceded: row.goalsConceded,
      yellowCards: row.yellowCards,
      redCards: row.redCards,
      startingPrice: roundOne(row.startingPrice),
      finalPrice: roundOne(row.finalPrice),
      managers: [...meta.managers],
      leaguePosition: position,
      champions: position === 1,
      topFour: position <= 4,
      bottomHalf: position >= 11,
      relegated: position >= 18,
      promoted: Boolean(meta.promoted),
      ageAtSeasonStart: row.ageAtSeasonStart ?? null,
      source: {
        name: elements.importSourceName.value.trim(),
        reference: elements.importSourceUrl.value.trim() || state.sourceFiles.dataset?.name || "",
        trust: elements.importSourceTrust.value,
        importedAt: new Date().toISOString().slice(0, 10),
        sourceId: row.sourceId || null
      }
    };
  }

  function enrichBio(player, row) {
    if (!player.bio || typeof player.bio !== "object") player.bio = {};
    if (!player.bio.dateOfBirth && validDate(row.birthDate)) player.bio.dateOfBirth = row.birthDate;
    if (player.bio.regionId == null && Number.isInteger(row.regionId)) player.bio.regionId = row.regionId;
  }

  function renderPreview(preview) {
    elements.importSourceRows.textContent = state.normalisedRows.length.toLocaleString();
    elements.importMatchedPlayers.textContent = preview.matched.toLocaleString();
    elements.importNewPlayers.textContent = preview.newPlayers.toLocaleString();
    elements.importConflictCount.textContent = preview.conflicts.length.toLocaleString();
    elements.importQuarantineCount.textContent = preview.quarantine.length.toLocaleString();
    elements.importProjectedSeasons.textContent = preview.projectedSeasons.toLocaleString();

    const warnings = [];
    if (preview.conflicts.length) warnings.push(warningHtml("Identity decisions needed", `${preview.conflicts.length} row(s) match more than one possible identity or conflict with birth data.`));
    if (preview.quarantine.length) warnings.push(warningHtml("Rows quarantined", `${preview.quarantine.length} row(s) will not be imported. They remain in the package report.`));
    if (elements.importSourceTrust.value === "unverified") warnings.push(warningHtml("Unverified source", "The importer will create a review package only until the source confidence is upgraded."));
    elements.importWarnings.innerHTML = warnings.join("");

    renderConflicts(preview.conflicts);
  }

  function renderConflicts(conflicts) {
    elements.importConflictPanel.classList.toggle("hidden", !conflicts.length);
    elements.importConflictList.innerHTML = conflicts.map(conflict => {
      const options = [
        `<option value="">Choose an action…</option>`,
        ...conflict.candidates.map(player => `<option value="${escapeHtml(player.playerId)}">Merge into ${escapeHtml(player.name)} (${escapeHtml(player.playerId)})</option>`),
        `<option value="new">Create a separate new footballer</option>`,
        `<option value="quarantine">Quarantine this row</option>`
      ].join("");
      return `<article class="import-conflict-card" data-conflict-key="${escapeHtml(conflict.key)}">
        <div><strong>${escapeHtml(conflict.row.name)} · ${escapeHtml(conflict.row.sourceClub)}</strong>
          <p>${escapeHtml(conflict.row.season)} · ${escapeHtml(conflict.row.position)} · ${conflict.row.points} points</p>
          <p>${conflict.row.birthDate ? `Birth date: ${escapeHtml(conflict.row.birthDate)}` : "No birth date supplied"}</p></div>
        <label>Identity decision<select>${options}</select></label>
      </article>`;
    }).join("");
  }

  function onConflictDecision(event) {
    const card = event.target.closest("[data-conflict-key]");
    if (!card || event.target.tagName !== "SELECT") return;
    const value = event.target.value;
    if (value) state.decisions.set(card.dataset.conflictKey, value);
    else state.decisions.delete(card.dataset.conflictKey);
    state.ready = false;
    elements.downloadImportPackBtn.disabled = true;
  }

  async function runRegressionChecks() {
    if (!state.workspace) {
      elements.importRegressionList.innerHTML = `<div class="repair-empty-state">Build the preview before running checks.</div>`;
      return;
    }
    setCentreStatus("Running checks…", "pending");
    elements.runImportChecksBtn.disabled = true;
    const results = [];
    try {
      const unresolved = state.conflicts.filter(conflict => !state.decisions.has(conflict.key)).length;
      addCheck(results, unresolved === 0 ? "pass" : "fail", "No unresolved identity matches", unresolved ? `${unresolved} ambiguous row(s) still need a decision.` : "Every imported row has a deterministic identity outcome.", true);

      const metadataIssues = validateAllClubMetadata();
      addCheck(results, metadataIssues.length ? "fail" : "pass", "Club metadata is complete", metadataIssues.length ? metadataIssues.slice(0, 4).join(" · ") : `${state.clubMetadata.size} clubs have final positions${elements.importRequireManagers.checked ? " and managers" : ""}.`, true);

      const structural = findStructuralIssues(state.workspace);
      addCheck(results, structural.length ? "fail" : "pass", "No structural database blockers", structural.length ? `${structural.length} structural problem(s) found after the import.` : `${state.workspace.length.toLocaleString()} players and ${countSeasons(state.workspace).toLocaleString()} player-seasons are structurally valid.`, true);

      const sourceRecords = findImportedRecords(state.workspace, normaliseSeasonLabel(elements.importSeasonLabel.value));
      const tracked = sourceRecords.filter(record => record.source?.name && record.source?.trust).length;
      addCheck(results, tracked === sourceRecords.length && tracked > 0 ? "pass" : "fail", "Every imported season is source-tracked", `${tracked} of ${sourceRecords.length} imported records contain source metadata.`, true);

      const promptResult = testPromptLibrary(state.workspace);
      addCheck(results, promptResult.failed.length ? "fail" : "pass", "All enabled prompts still work", promptResult.failed.length ? `${promptResult.failed.length} prompt(s) failed: ${promptResult.failed.slice(0, 4).join(", ")}` : `${promptResult.checked} enabled prompts were evaluated successfully.`, true);

      const liveResult = await testLiveChallenge(state.workspace);
      if (!liveResult.challenge) addCheck(results, "warn", "Live challenge could not be fetched", liveResult.error || "The live challenge will need checking after upload.", false);
      else {
        const expected = Number(liveResult.challenge.perfectScore) || 0;
        const status = liveResult.possible && liveResult.score === expected ? "pass" : "fail";
        addCheck(results, status, "Live challenge and perfect score are preserved", status === "pass" ? `${liveResult.score.toLocaleString()} points still matches todays-challenge.js.` : liveResult.possible ? `The imported database calculates ${liveResult.score.toLocaleString()}, but todays-challenge.js stores ${expected.toLocaleString()}.` : liveResult.reason, true);
      }

      const season = normaliseSeasonLabel(elements.importSeasonLabel.value);
      const collisions = state.workspace.flatMap(player => player.seasons.filter(record => record.season === season).map(record => `${player.playerId}|${record.season}`));
      addCheck(results, new Set(collisions).size === collisions.length ? "pass" : "fail", "No duplicate player-season keys", `${collisions.length.toLocaleString()} records exist for ${season}.`, true);

      const trust = elements.importSourceTrust.value;
      addCheck(results, trust === "unverified" ? "warn" : "pass", "Source confidence recorded", trust === "unverified" ? "Unverified imports remain review-only." : `The source is marked ${trust}.`, trust === "unverified");

      state.regression = results;
      renderRegression(results);
      state.ready = results.every(result => result.state === "pass" || !result.blocking);
      elements.downloadImportPackBtn.disabled = !state.workspace;
      elements.downloadImportPackBtn.textContent = state.ready ? "Download upload-ready package" : "Download review package";
      elements.importDownloadExplanation.textContent = state.ready
        ? "All blocking checks passed. Upload only UPLOAD/players.js after keeping the original backup."
        : "The package is marked REVIEW ONLY. Do not replace players.js until all blocking checks pass.";
      setCentreStatus(state.ready ? "Upload ready" : "Review required", state.ready ? "ready" : "blocked");
      elements.importDownloadStatus.textContent = state.ready ? "The protected package is ready." : "A review package can be downloaded, but it is not safe to upload yet.";
    } finally {
      elements.runImportChecksBtn.disabled = false;
    }
  }

  function renderRegression(results) {
    elements.importRegressionList.innerHTML = results.map(result => `<div class="repair-regression-row ${result.state}">
      <span class="regression-icon">${result.state === "pass" ? "✓" : result.state === "warn" ? "△" : "!"}</span>
      <div><strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.detail)}</span></div>
    </div>`).join("");
  }

  async function downloadImportPack() {
    if (!state.workspace) return;
    const season = normaliseSeasonLabel(elements.importSeasonLabel.value);
    const manifest = {
      phase: 10,
      status: state.ready ? "UPLOAD READY" : "REVIEW ONLY",
      createdAt: new Date().toISOString(),
      season,
      source: {
        name: elements.importSourceName.value.trim(),
        reference: elements.importSourceUrl.value.trim(),
        trust: elements.importSourceTrust.value,
        files: state.sourceFiles
      },
      before: { players: originalPlayers.length, seasons: countSeasons(originalPlayers) },
      after: { players: state.workspace.length, seasons: countSeasons(state.workspace) },
      conflicts: state.conflicts.length,
      quarantine: state.quarantine.length,
      regression: state.regression
    };
    const files = [
      { name: `${state.ready ? "UPLOAD" : "REVIEW"}/players.js`, content: serialisePlayers(state.workspace, `FPL database with protected ${season} import`) },
      { name: "BACKUPS/players-before-import.js", content: serialisePlayers(originalPlayers, "Database backup before Phase 10 import") },
      { name: "REPORTS/import-manifest.json", content: JSON.stringify(manifest, null, 2) + "\n" },
      { name: "REPORTS/quarantined-rows.json", content: JSON.stringify(state.quarantine, null, 2) + "\n" },
      { name: "REPORTS/identity-decisions.json", content: JSON.stringify(Object.fromEntries(state.decisions), null, 2) + "\n" },
      { name: "README-UPLOAD.txt", content: buildReadme(manifest) }
    ];
    const zipBuilder = window.FPL_STUDIO_PHASE6?.buildZipBlob;
    if (typeof zipBuilder !== "function") {
      downloadBlob(`players-${season.replace("/", "-")}-${state.ready ? "upload" : "review"}.js`, new Blob([serialisePlayers(state.workspace, `Phase 10 ${season} import`)], { type: "text/javascript" }));
      elements.importDownloadStatus.textContent = "ZIP support was unavailable, so the database JavaScript was downloaded directly.";
      return;
    }
    downloadBlob(`fpl-phase-10-import-${season.replace("/", "-")}-${dateStamp()}.zip`, zipBuilder(files));
    elements.importDownloadStatus.textContent = state.ready ? "Upload-ready import package downloaded." : "Review-only import package downloaded. Do not upload its players.js yet.";
  }

  function buildReadme(manifest) {
    return `FPL CHALLENGE STUDIO PHASE 10 — HISTORICAL IMPORT\n\nSTATUS: ${manifest.status}\nSEASON: ${manifest.season}\nSOURCE: ${manifest.source.name}\nCONFIDENCE: ${manifest.source.trust}\n\nBEFORE\nPlayers: ${manifest.before.players}\nPlayer-seasons: ${manifest.before.seasons}\n\nAFTER\nPlayers: ${manifest.after.players}\nPlayer-seasons: ${manifest.after.seasons}\nQuarantined rows: ${manifest.quarantine}\nIdentity conflicts: ${manifest.conflicts}\n\n${manifest.status === "UPLOAD READY" ? "UPLOAD STEPS\n1. Keep BACKUPS/players-before-import.js.\n2. Upload only UPLOAD/players.js to the root of GitHub.\n3. Replace the existing players.js.\n4. Wait for deployment and hard-refresh the live game.\n5. Test one full challenge.\n" : "REVIEW ONLY\nDo not upload the generated players.js. Resolve every blocking check in the Import Centre, rebuild the preview and download again.\n"}`;
  }

  function validateAllClubMetadata() {
    const errors = [];
    const requireManagers = elements.importRequireManagers.checked;
    for (const meta of state.clubMetadata.values()) {
      if (!meta.club) errors.push(`${meta.sourceClub}: missing canonical club name`);
      if (!between(meta.leaguePosition, 1, 20)) errors.push(`${meta.sourceClub}: invalid final position`);
      if (requireManagers && !meta.managers.length) errors.push(`${meta.sourceClub}: missing manager`);
    }
    return errors;
  }

  function findStructuralIssues(database) {
    const issues = [];
    const ids = new Set();
    for (const player of database) {
      if (!player.playerId || ids.has(player.playerId)) issues.push(`Duplicate/missing player ID: ${player.playerId || player.name}`);
      ids.add(player.playerId);
      const seasons = new Set();
      for (const record of player.seasons || []) {
        if (seasons.has(record.season)) issues.push(`${player.name}: duplicate ${record.season}`);
        seasons.add(record.season);
        if (!VALID_POSITIONS.has(record.position)) issues.push(`${player.name}: invalid position`);
        if (!record.club) issues.push(`${player.name}: missing club`);
        for (const field of REQUIRED_NUMERIC) if (!Number.isFinite(record[field]) || record[field] < 0) issues.push(`${player.name}: invalid ${field}`);
      }
    }
    return issues;
  }

  function testPromptLibrary(database) {
    const flat = flattenDatabase(database);
    const enabled = promptLibrary.filter(prompt => prompt && prompt.enabled !== false && typeof prompt.test === "function");
    const failed = [];
    for (const prompt of enabled) {
      try {
        const validPlayers = new Set(flat.filter(record => record.position === prompt.position && prompt.test(record)).map(record => record.playerId));
        if (!validPlayers.size) failed.push(prompt.id);
      } catch { failed.push(prompt.id); }
    }
    return { checked: enabled.length, failed };
  }

  async function testLiveChallenge(database) {
    try {
      let challenge = window.FPL_DAILY_CHALLENGE || null;
      if (!challenge) {
        const response = await fetch(`todays-challenge.js?phase10=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const source = await response.text();
        challenge = new Function("window", `"use strict";\n${source}\nreturn window.FPL_DAILY_CHALLENGE || null;`)(Object.create(null));
      }
      if (!challenge?.prompts?.length) throw new Error("todays-challenge.js did not provide a valid challenge");
      const perfect = calculatePerfectXI(database, challenge.prompts);
      return { challenge, ...perfect };
    } catch (error) {
      return { challenge: null, error: error instanceof Error ? error.message : String(error) };
    }
  }

  function calculatePerfectXI(database, prompts) {
    const flat = flattenDatabase(database);
    const bestBySlot = prompts.map(prompt => {
      const map = new Map();
      for (const record of flat) {
        if (record.position !== prompt.position) continue;
        let valid = false;
        try { valid = prompt.test(record); } catch {}
        if (!valid) continue;
        const current = map.get(record.playerId);
        if (!current || record.points > current.points) map.set(record.playerId, record);
      }
      return map;
    });
    const playerIds = [...new Set(bestBySlot.flatMap(map => [...map.keys()]))];
    if (playerIds.length < prompts.length) return { possible: false, reason: "Not enough unique valid footballers." };
    const maxPoints = Math.max(0, ...bestBySlot.flatMap(map => [...map.values()].map(record => record.points)));
    const forbidden = 1_000_000;
    const costs = bestBySlot.map(map => playerIds.map(id => map.has(id) ? maxPoints - map.get(id).points : forbidden));
    const assignment = hungarian(costs);
    if (!assignment || assignment.some((column, row) => !bestBySlot[row].has(playerIds[column]))) return { possible: false, reason: "No unique-player XI exists." };
    const picks = assignment.map((column, slot) => ({ prompt: prompts[slot], record: bestBySlot[slot].get(playerIds[column]) }));
    return { possible: true, picks, score: picks.reduce((sum, pick) => sum + pick.record.points, 0) };
  }

  function hungarian(costs) {
    const rows = costs.length, columns = costs[0]?.length || 0;
    if (!rows || columns < rows) return null;
    const u = new Float64Array(rows + 1), v = new Float64Array(columns + 1);
    const p = new Int32Array(columns + 1), way = new Int32Array(columns + 1);
    for (let i = 1; i <= rows; i += 1) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(columns + 1); minv.fill(Infinity);
      const used = new Uint8Array(columns + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0];
        let delta = Infinity, j1 = 0;
        for (let j = 1; j <= columns; j += 1) if (!used[j]) {
          const cur = costs[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        if (!Number.isFinite(delta)) return null;
        for (let j = 0; j <= columns; j += 1) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0 !== 0);
    }
    const assignment = new Int32Array(rows); assignment.fill(-1);
    for (let j = 1; j <= columns; j += 1) if (p[j]) assignment[p[j] - 1] = j - 1;
    return [...assignment];
  }

  function pullMetadataFromTable() {
    for (const row of elements.importClubMetadataRows.querySelectorAll("tr[data-club-key]")) {
      const meta = state.clubMetadata.get(row.dataset.clubKey);
      if (!meta) continue;
      meta.club = row.querySelector(".club-name-input").value.trim();
      meta.leaguePosition = integer(row.querySelector(".club-position-input").value);
      meta.promoted = row.querySelector(".club-promoted-input").checked;
      meta.managers = splitManagers(row.querySelector(".club-managers-input").value);
    }
  }

  function resetImporter() {
    state.datasetRows = [];
    state.teamMap.clear();
    state.metadataMap.clear();
    state.clubMetadata.clear();
    state.normalisedRows = [];
    state.conflicts = [];
    state.decisions.clear();
    state.quarantine = [];
    state.workspace = null;
    state.regression = [];
    state.ready = false;
    state.sourceFiles = {};
    state.parsed = false;
    [elements.importDatasetFile, elements.importTeamsFile, elements.importMetadataFile].forEach(input => { if (input) input.value = ""; });
    elements.importDatasetFileStatus.textContent = "No file selected.";
    elements.importTeamsFileStatus.textContent = "No file selected.";
    elements.importMetadataFileStatus.textContent = "No file selected.";
    elements.importClubMetadataRows.innerHTML = "";
    elements.importClubMetadataPanel.classList.add("hidden");
    elements.importPreviewPanel.classList.add("hidden");
    elements.buildImportPreviewBtn.disabled = true;
    elements.downloadImportPackBtn.disabled = true;
    elements.importActionStatus.textContent = "Choose a single-season player dataset to begin.";
    elements.importDownloadStatus.textContent = "";
    setCentreStatus("Waiting for files", "pending");
  }

  function resetPreviewOnly() {
    state.conflicts = [];
    state.decisions.clear();
    state.quarantine = [];
    state.workspace = null;
    state.regression = [];
    state.ready = false;
    state.parsed = false;
    elements.importPreviewPanel.classList.add("hidden");
    elements.downloadImportPackBtn.disabled = true;
    elements.importWarnings.innerHTML = "";
  }

  function identityCompatible(player, row) {
    const existingBirth = player.bio?.dateOfBirth || null;
    if (existingBirth && row.birthDate && existingBirth !== row.birthDate) return false;
    return true;
  }

  function conflictKey(row) { return `${row.rowIndex}|${row.nameKey}|${row.sourceId}|${row.clubKey}`; }
  function uniquePlayerId(value, used) {
    const base = slugify(value) || "imported-player";
    let id = base, counter = 2;
    while (used.has(id)) id = `${base}-${counter++}`;
    return id;
  }
  function compareSeasonsDescending(a, b) { return seasonStartYear(b.season) - seasonStartYear(a.season); }
  function seasonStartYear(value) { return Number(String(value || "").slice(0, 4)) || 0; }
  function findImportedRecords(database, season) { return database.flatMap(player => (player.seasons || []).filter(record => record.season === season)); }
  function flattenDatabase(database) { return database.flatMap(player => (player.seasons || []).map(record => ({ ...record, playerId: player.playerId, name: player.name }))); }
  function countSeasons(database) { return database.reduce((sum, player) => sum + (player.seasons?.length || 0), 0); }
  function serialisePlayers(database, note) { return `/* ${note}. */\nwindow.FPL_PLAYERS = ${JSON.stringify(database)};\n`; }
  function cloneData(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function splitManagers(value) { return String(value || "").split(/[;,|]/).map(item => item.trim()).filter(Boolean); }
  function normaliseText(value) { return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function slugify(value) { return normaliseText(value).replace(/\s+/g, "-"); }
  function normalisePosition(value) {
    const raw = String(value ?? "").trim().toUpperCase();
    if (POSITION_BY_TYPE[raw]) return POSITION_BY_TYPE[raw];
    if (["GKP", "GOALKEEPER"].includes(raw)) return "GK";
    if (["D", "DEFENDER"].includes(raw)) return "DEF";
    if (["M", "MIDFIELDER"].includes(raw)) return "MID";
    if (["F", "FW", "FORWARD", "STRIKER"].includes(raw)) return "FWD";
    return VALID_POSITIONS.has(raw) ? raw : "";
  }
  function normaliseSeasonLabel(value) {
    const match = String(value || "").trim().match(/^(\d{4})[\/-](\d{2}|\d{4})$/);
    if (!match) return "";
    const start = Number(match[1]);
    const end = Number(match[2].length === 2 ? String(start).slice(0, 2) + match[2] : match[2]);
    return end === start + 1 ? `${start}/${String(end).slice(-2)}` : "";
  }
  function calculateSeasonAge(date, season) {
    if (!validDate(date)) return null;
    const birth = new Date(`${date}T00:00:00Z`);
    const startYear = seasonStartYear(season);
    if (!startYear) return null;
    const seasonStart = new Date(Date.UTC(startYear, 7, 1));
    let age = seasonStart.getUTCFullYear() - birth.getUTCFullYear();
    if (seasonStart.getUTCMonth() < birth.getUTCMonth() || (seasonStart.getUTCMonth() === birth.getUTCMonth() && seasonStart.getUTCDate() < birth.getUTCDate())) age -= 1;
    return between(age, 15, 50) ? age : null;
  }
  function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)); }
  function first(object, keys) { for (const key of keys) if (object?.[key] != null && object[key] !== "") return object[key]; return null; }
  function numeric(value) { const number = Number(String(value ?? "").replace(/[^0-9.+-]/g, "")); return Number.isFinite(number) ? number : null; }
  function whole(value) { return Math.max(0, Math.round(numeric(value) ?? 0)); }
  function integer(value) { const number = numeric(value); return number == null ? null : Math.round(number); }
  function priceValue(value) { const number = numeric(value); if (number == null) return null; return roundOne(number > 30 ? number / 10 : number); }
  function roundOne(value) { return Math.round(Number(value) * 10) / 10; }
  function booleanValue(value) { if (typeof value === "boolean") return value; return ["1", "true", "yes", "y"].includes(String(value || "").trim().toLowerCase()); }
  function between(value, min, max) { return Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max; }
  function fileDescriptor(file) { return { name: file.name, size: file.size, type: file.type || "", lastModified: new Date(file.lastModified).toISOString() }; }
  function formatBytes(value) { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1024 ** 2).toFixed(1)} MB`; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
  function warningHtml(title, detail) { return `<div class="warning"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`; }
  function addCheck(results, stateValue, title, detail, blocking) { results.push({ state: stateValue, title, detail, blocking: blocking !== false }); }
  function showImportError(message) { setCentreStatus("Needs attention", "blocked"); elements.importActionStatus.textContent = message; }
  function setCentreStatus(text, status) { elements.importCentreStatus.textContent = text; elements.importCentreStatus.className = `audit-status-chip ${status}`; }
  function dateStamp() { return new Date().toISOString().slice(0, 10); }
  function downloadBlob(filename, blob) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
})();
