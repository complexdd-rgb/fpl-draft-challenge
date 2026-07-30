/* FPL career relationship context · v1.4.0
   Derived at runtime from verified player-season rows. Seasons with zero minutes
   do not contribute to any career or relationship rule. */
(() => {
  "use strict";

  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const normalise = value => String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ø/g, "o").replace(/ł/g, "l").replace(/[đð]/g, "d")
    .replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe")
    .replace(/’/g, "'")
    .replace(/[^a-z0-9'\-]+/g, " ")
    .trim();
  const seasonStart = value => {
    const match = String(value || "").match(/^(\d{4})/);
    return match ? Number(match[1]) : NaN;
  };
  const isPositiveSeason = season => Number(season?.minutes) > 0;
  const unique = values => [...new Set(values.filter(value => value !== "" && value != null))];
  const freezeArray = values => Object.freeze([...values]);

  const summariesByKey = new Map();
  const playerKeyByOriginalId = new Map();
  const clubSeasonIndex = new Map();
  const clubCareerIndex = new Map();
  const nameIndex = new Map();

  for (const player of players) {
    if (!player || player.playerId == null) continue;
    const playerKey = String(player.playerId);
    playerKeyByOriginalId.set(player.playerId, playerKey);
    const positiveRows = (Array.isArray(player.seasons) ? player.seasons : [])
      .filter(isPositiveSeason)
      .map(season => ({
        season,
        year: seasonStart(season.season),
        seasonLabel: String(season.season || "").trim(),
        club: String(season.club || "").trim(),
        clubKey: normalise(season.club),
        managers: Array.isArray(season.managers) ? season.managers.map(value => String(value || "").trim()).filter(Boolean) : []
      }))
      .filter(row => Number.isFinite(row.year) && row.seasonLabel);

    const summary = {
      playerId: player.playerId,
      playerKey,
      playerName: String(player.name || player.playerId),
      rows: positiveRows,
      aliases: unique([player.name, ...(Array.isArray(player.aliases) ? player.aliases : [])].map(value => String(value || "").trim())),
      teammateKeys: new Set(),
      sharedClubCareerKeys: new Set()
    };
    summariesByKey.set(playerKey, summary);

    for (const alias of summary.aliases) {
      const key = normalise(alias);
      if (!key) continue;
      if (!nameIndex.has(key)) nameIndex.set(key, new Set());
      nameIndex.get(key).add(playerKey);
    }

    for (const row of positiveRows) {
      if (!row.clubKey) continue;
      const clubSeasonKey = `${row.seasonLabel}|${row.clubKey}`;
      if (!clubSeasonIndex.has(clubSeasonKey)) clubSeasonIndex.set(clubSeasonKey, new Set());
      clubSeasonIndex.get(clubSeasonKey).add(playerKey);
      if (!clubCareerIndex.has(row.clubKey)) clubCareerIndex.set(row.clubKey, new Set());
      clubCareerIndex.get(row.clubKey).add(playerKey);
    }
  }

  for (const playerKeys of clubSeasonIndex.values()) {
    for (const playerKey of playerKeys) {
      const summary = summariesByKey.get(playerKey);
      if (!summary) continue;
      for (const otherKey of playerKeys) if (otherKey !== playerKey) summary.teammateKeys.add(otherKey);
    }
  }
  for (const playerKeys of clubCareerIndex.values()) {
    for (const playerKey of playerKeys) {
      const summary = summariesByKey.get(playerKey);
      if (!summary) continue;
      for (const otherKey of playerKeys) if (otherKey !== playerKey) summary.sharedClubCareerKeys.add(otherKey);
    }
  }

  function deriveSequenceFacts(rows) {
    const byYear = new Map();
    for (const row of rows) {
      if (!row.clubKey) continue;
      if (!byYear.has(row.year)) {
        byYear.set(row.year, {
          year: row.year,
          seasonLabel: row.seasonLabel,
          club: row.club,
          clubKey: row.clubKey
        });
      }
    }
    const sequence = [...byYear.values()].sort((a, b) => a.year - b.year);
    let changedClubConsecutively = false;
    let returnedToFormerClub = false;
    let maxConsecutiveSameClub = sequence.length ? 1 : 0;
    let currentRun = sequence.length ? 1 : 0;
    const previouslyLeft = new Set();
    const returnedClubKeys = new Set();

    for (let index = 1; index < sequence.length; index += 1) {
      const previous = sequence[index - 1];
      const current = sequence[index];
      const consecutiveYear = current.year === previous.year + 1;
      if (current.clubKey === previous.clubKey && consecutiveYear) {
        currentRun += 1;
        maxConsecutiveSameClub = Math.max(maxConsecutiveSameClub, currentRun);
      } else {
        if (consecutiveYear && current.clubKey !== previous.clubKey) changedClubConsecutively = true;
        if (current.clubKey !== previous.clubKey) previouslyLeft.add(previous.clubKey);
        if (previouslyLeft.has(current.clubKey)) {
          returnedToFormerClub = true;
          returnedClubKeys.add(current.clubKey);
        }
        currentRun = 1;
      }
    }

    const clubNamesByKey = new Map(sequence.map(row => [row.clubKey, row.club]));
    return {
      changedClubConsecutively,
      returnedToFormerClub,
      returnedClubs: [...returnedClubKeys].map(key => clubNamesByKey.get(key) || key),
      returnCount: returnedClubKeys.size,
      clubTimeline: sequence.map(row => `${row.seasonLabel} — ${row.club}`),
      maxConsecutiveSameClub
    };
  }

  const publicSummaries = [];
  for (const summary of summariesByKey.values()) {
    const seasonLabels = unique(summary.rows.map(row => row.seasonLabel)).sort((a, b) => seasonStart(a) - seasonStart(b));
    const seasonYears = unique(summary.rows.map(row => row.year)).sort((a, b) => a - b);
    const clubsByKey = new Map();
    const managersByKey = new Map();
    const clubSeasonSets = new Map();

    for (const row of summary.rows) {
      if (row.clubKey) {
        if (!clubsByKey.has(row.clubKey)) clubsByKey.set(row.clubKey, row.club);
        if (!clubSeasonSets.has(row.clubKey)) clubSeasonSets.set(row.clubKey, new Set());
        clubSeasonSets.get(row.clubKey).add(row.seasonLabel);
      }
      for (const manager of row.managers) {
        const managerKey = normalise(manager);
        if (managerKey && !managersByKey.has(managerKey)) managersByKey.set(managerKey, manager);
      }
    }

    const clubSeasonCounts = {};
    for (const [clubKey, seasons] of clubSeasonSets) clubSeasonCounts[clubKey] = seasons.size;
    const sequenceFacts = deriveSequenceFacts(summary.rows);
    const publicSummary = Object.freeze({
      playerId: summary.playerId,
      playerName: summary.playerName,
      seasonCount: seasonLabels.length,
      clubCount: clubsByKey.size,
      seasons: freezeArray(seasonLabels),
      seasonYears: freezeArray(seasonYears),
      clubSeasonKeys: freezeArray(unique(summary.rows.filter(row => row.clubKey).map(row => `${row.seasonLabel}|${row.clubKey}`))),
      clubs: freezeArray(clubsByKey.values()),
      normalisedClubs: freezeArray(clubsByKey.keys()),
      managers: freezeArray(managersByKey.values()),
      normalisedManagers: freezeArray(managersByKey.keys()),
      clubSeasonCounts: Object.freeze(clubSeasonCounts),
      maxSeasonsAtOneClub: Math.max(0, ...Object.values(clubSeasonCounts)),
      maxConsecutiveSameClub: sequenceFacts.maxConsecutiveSameClub,
      firstYear: seasonYears.length ? seasonYears[0] : null,
      lastYear: seasonYears.length ? seasonYears.at(-1) : null,
      changedClubConsecutively: sequenceFacts.changedClubConsecutively,
      returnedToFormerClub: sequenceFacts.returnedToFormerClub,
      returnedClubs: freezeArray(sequenceFacts.returnedClubs),
      returnCount: sequenceFacts.returnCount,
      clubTimeline: freezeArray(sequenceFacts.clubTimeline),
      everPromotedClub: summary.rows.some(row => row.season?.promoted === true),
      everRelegatedClub: summary.rows.some(row => row.season?.relegated === true),
      everChampion: summary.rows.some(row => row.season?.champions === true),
      everTopFour: summary.rows.some(row => row.season?.topFour === true),
      teammateIds: freezeArray([...summary.teammateKeys].map(key => summariesByKey.get(key)?.playerId).filter(value => value != null)),
      sharedClubCareerIds: freezeArray([...summary.sharedClubCareerKeys].map(key => summariesByKey.get(key)?.playerId).filter(value => value != null))
    });
    summary.publicSummary = publicSummary;
    publicSummaries.push(publicSummary);
  }

  for (const player of players) {
    if (!player || player.playerId == null) continue;
    const summary = summariesByKey.get(String(player.playerId))?.publicSummary;
    if (!summary) continue;
    for (const season of Array.isArray(player.seasons) ? player.seasons : []) {
      try {
        Object.defineProperty(season, "_career", {
          value: summary,
          configurable: true,
          enumerable: true,
          writable: false
        });
      } catch (_) {
        season._career = summary;
      }
    }
  }

  function resolvePlayer(value) {
    const query = String(value || "").trim();
    const key = normalise(query);
    if (!key) return { ok: false, reason: "Enter a player name." };
    const matches = [...(nameIndex.get(key) || [])];
    if (!matches.length) return { ok: false, reason: `No unique database player matches “${query}”. Use the player's full stored name.` };
    if (matches.length > 1) {
      const names = matches.map(playerKey => summariesByKey.get(playerKey)?.playerName).filter(Boolean);
      return { ok: false, reason: `“${query}” matches more than one player: ${names.join(", ")}. Use a unique stored name.` };
    }
    const summary = summariesByKey.get(matches[0])?.publicSummary;
    return summary ? { ok: true, player: summary } : { ok: false, reason: `No career data is available for “${query}”.` };
  }

  function getClubSeasonTeammates(playerId, seasonLabel, club) {
    const clubKey = normalise(club);
    const key = `${String(seasonLabel || "").trim()}|${clubKey}`;
    if (!clubKey || !clubSeasonIndex.has(key)) return [];
    return [...clubSeasonIndex.get(key)]
      .filter(playerKey => playerKey !== String(playerId))
      .map(playerKey => summariesByKey.get(playerKey)?.publicSummary)
      .filter(Boolean)
      .sort((a, b) => a.playerName.localeCompare(b.playerName));
  }

  const coverage = Object.freeze({
    players: players.length,
    playersWithPositiveMinutes: publicSummaries.filter(summary => summary.seasonCount > 0).length,
    positiveMinuteSeasons: publicSummaries.reduce((sum, summary) => sum + summary.seasonCount, 0),
    clubs: clubCareerIndex.size,
    clubSeasons: clubSeasonIndex.size
  });

  window.FPL_CAREER_CONTEXT = Object.freeze({
    version: "1.4.0",
    coverage,
    normalise,
    seasonStart,
    resolvePlayer,
    getPlayer: playerId => summariesByKey.get(String(playerId))?.publicSummary || null,
    getClubSeasonTeammates,
    players: freezeArray(publicSummaries)
  });
})();
