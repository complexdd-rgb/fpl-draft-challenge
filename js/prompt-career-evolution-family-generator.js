/* FPL Challenge Studio — Career Evolution Family Generator v1.0.0
   Builds new 5★ prompt candidates from data already held in the player/career history:
   season-to-season change, streaks, position journeys, club/status journeys,
   nationality × career and manager journeys. */
(() => {
  "use strict";

  if (window.__FPL_CAREER_EVOLUTION_FAMILY_GENERATOR_V1__) return;
  window.__FPL_CAREER_EVOLUTION_FAMILY_GENERATOR_V1__ = true;

  const VERSION = "1.0.0";
  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const NAMES = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const RANGES = {
    GK: { low: 6, high: 35 },
    DEF: { low: 10, high: 90 },
    MID: { low: 10, high: 90 },
    FWD: { low: 8, high: 60 }
  };

  const players = () => Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const slug = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function compile(source) {
    try { return Function(`"use strict"; return (${source});`)(); }
    catch (_) { return null; }
  }

  function analyse(position, test) {
    const ids = new Set();
    let seasons = 0;
    for (const player of players()) {
      for (const record of player.seasons || []) {
        if (Number(record.minutes) <= 0 || record.position !== position) continue;
        let passed = false;
        try { passed = Boolean(test(record)); } catch (_) {}
        if (!passed) continue;
        ids.add(player.playerId);
        seasons += 1;
      }
    }
    return { ids, playerCount: ids.size, seasonCount: seasons };
  }

  function overlap(left, right) {
    if (!left?.size || !right?.size) return 0;
    const smaller = left.size <= right.size ? left : right;
    const larger = smaller === left ? right : left;
    let common = 0;
    for (const id of smaller) if (larger.has(id)) common += 1;
    return common / Math.max(1, smaller.size);
  }

  function difficulty(position, count) {
    if (position === "GK") return count <= 10 ? "hard" : count <= 22 ? "medium" : "easy";
    if (position === "FWD") return count <= 12 ? "hard" : count <= 30 ? "medium" : "easy";
    return count <= 18 ? "hard" : count <= 50 ? "medium" : "easy";
  }

  function candidate(position, family, tail, label, fail, source, tags, novelty = 0) {
    const test = compile(source);
    if (!test) return null;
    const stats = analyse(position, test);
    const range = RANGES[position];
    if (!range || stats.playerCount < range.low || stats.playerCount > range.high) return null;
    const midpoint = (range.low + range.high) / 2;
    const score = 150 + novelty - Math.abs(stats.playerCount - midpoint) / Math.max(1, midpoint) * 20;
    return {
      id: `career_evolution_${position.toLowerCase()}_${tail}`.replace(/[^a-z0-9_]+/g, "_"),
      family: `career-evolution:${family}`,
      position,
      label,
      fail,
      source,
      test,
      stats,
      score,
      difficulty: difficulty(position, stats.playerCount),
      tags: [...new Set(["auto-generated", "career-evolution", "career", "approved-5-star", "anti-meta", ...tags])],
      rating: 5,
      cooldown: Math.max(0, Math.min(50, Number(document.getElementById("factoryCooldown")?.value) || 10)),
      enabled: document.getElementById("factoryEnablePrompts")?.checked !== false
    };
  }

  function addSeasonChange(position, out) {
    const noun = NAMES[position], lower = LOWER[position];
    for (const gain of [20, 30, 40, 50, 60]) {
      out.push(candidate(position, "season-improvement", `points_gain_${gain}`,
        `${noun} whose FPL points improved by ${gain}+ between consecutive Premier League seasons`,
        `That ${lower} must have two consecutive recorded Premier League seasons with known FPL points and improve by at least ${gain} points.`,
        `p => Number(p._careerEvolution?.maxPointsGain) >= ${gain}`,
        ["season-to-season", "improvement", "points", "requires-fpl-native"], 16));
    }
    for (const gain of [2, 3, 4, 5, 6]) {
      out.push(candidate(position, "season-improvement", `goals_gain_${gain}`,
        `${noun} whose goals increased by ${gain}+ between consecutive Premier League seasons`,
        `That ${lower} must improve their goal total by at least ${gain} between consecutive recorded Premier League seasons.`,
        `p => Number(p._careerEvolution?.maxGoalsGain) >= ${gain}`,
        ["season-to-season", "improvement", "goals", "historical-core-eligible"], 18));
    }
    for (const gain of [500, 800, 1000, 1200, 1500]) {
      out.push(candidate(position, "season-improvement", `minutes_gain_${gain}`,
        `${noun} whose minutes increased by ${gain.toLocaleString("en-GB")}+ between consecutive Premier League seasons`,
        `That ${lower} must increase their recorded minutes by at least ${gain.toLocaleString("en-GB")} between consecutive Premier League seasons.`,
        `p => Number(p._careerEvolution?.maxMinutesGain) >= ${gain}`,
        ["season-to-season", "improvement", "minutes", "historical-core-eligible"], 14));
    }
    for (const gain of [20, 30, 40, 50]) {
      out.push(candidate(position, "club-switch-success", `switch_points_gain_${gain}`,
        `${noun} who changed Premier League clubs between consecutive seasons and improved by ${gain}+ FPL points`,
        `That ${lower} must change Premier League clubs between consecutive recorded seasons and improve by at least ${gain} FPL points.`,
        `p => Number(p._careerEvolution?.maxClubSwitchPointsGain) >= ${gain}`,
        ["season-to-season", "club-switch", "improvement", "points", "requires-fpl-native"], 20));
    }
    for (const gain of [2, 3, 4, 5]) {
      out.push(candidate(position, "club-switch-success", `switch_goals_gain_${gain}`,
        `${noun} who changed Premier League clubs between consecutive seasons and scored ${gain}+ more goals`,
        `That ${lower} must change Premier League clubs between consecutive recorded seasons and increase their goal total by at least ${gain}.`,
        `p => Number(p._careerEvolution?.maxClubSwitchGoalsGain) >= ${gain}`,
        ["season-to-season", "club-switch", "improvement", "goals", "historical-core-eligible"], 20));
    }
    out.push(candidate(position, "bounce-back", "points_120_after_under_70",
      `${noun} who followed a sub-70-point Premier League season with 120+ FPL points`,
      `That ${lower} must have consecutive recorded Premier League seasons where the first scored under 70 FPL points and the next scored at least 120.`,
      `p => p._careerEvolution?.bounceBack120After70 === true`,
      ["season-to-season", "bounce-back", "points", "requires-fpl-native"], 22));
    out.push(candidate(position, "bounce-back", "minutes_2500_after_under_1500",
      `${noun} who followed a sub-1,500-minute season with 2,500+ minutes`,
      `That ${lower} must have consecutive recorded Premier League seasons where the first was below 1,500 minutes and the next reached at least 2,500.`,
      `p => p._careerEvolution?.bounceBack2500After1500 === true`,
      ["season-to-season", "bounce-back", "minutes", "historical-core-eligible"], 20));
  }

  function addStreaks(position, out) {
    const noun = NAMES[position], lower = LOWER[position];
    for (const seasons of [2, 3, 4, 5]) {
      out.push(candidate(position, "career-streak", `minutes_2000_streak_${seasons}`,
        `${noun} with ${seasons}+ consecutive Premier League seasons of 2,000+ minutes`,
        `That ${lower} must record at least 2,000 minutes in ${seasons} consecutive Premier League seasons.`,
        `p => Number(p._careerEvolution?.maxConsecutive2000Minutes) >= ${seasons}`,
        ["career-streak", "minutes", "historical-core-eligible"], 18));
      out.push(candidate(position, "career-streak", `scoring_streak_${seasons}`,
        `${noun} who scored in ${seasons}+ consecutive Premier League seasons`,
        `That ${lower} must score at least one goal in ${seasons} consecutive recorded Premier League seasons.`,
        `p => Number(p._careerEvolution?.maxConsecutiveScoringSeasons) >= ${seasons}`,
        ["career-streak", "goals", "historical-core-eligible"], 17));
      out.push(candidate(position, "career-streak", `points_100_streak_${seasons}`,
        `${noun} with ${seasons}+ consecutive Premier League seasons of 100+ FPL points`,
        `That ${lower} must score at least 100 FPL points in ${seasons} consecutive recorded Premier League seasons.`,
        `p => Number(p._careerEvolution?.maxConsecutive100Points) >= ${seasons}`,
        ["career-streak", "points", "requires-fpl-native"], 18));
    }
    if (position === "FWD" || position === "MID") for (const seasons of [2, 3, 4]) {
      out.push(candidate(position, "career-streak", `goals_8_streak_${seasons}`,
        `${noun} with 8+ goals in ${seasons}+ consecutive Premier League seasons`,
        `That ${lower} must score at least eight goals in ${seasons} consecutive recorded Premier League seasons.`,
        `p => Number(p._careerEvolution?.maxConsecutive8Goals) >= ${seasons}`,
        ["career-streak", "goals", "historical-core-eligible"], 20));
    }
  }

  function addPositionJourneys(position, out) {
    const noun = NAMES[position], lower = LOWER[position];
    out.push(candidate(position, "position-journey", "multiple_positions",
      `${noun} who was classified in 2+ different positions across their recorded Premier League career`,
      `That ${lower} must have positive-minute Premier League seasons stored under at least two different positions.`,
      `p => Number(p._careerEvolution?.positionCount) >= 2`,
      ["position-journey", "position-change", "historical-core-eligible"], 22));
    if (position === "FWD") out.push(candidate(position, "position-journey", "mid_to_fwd",
      `Forward who had previously been classified as a midfielder in a Premier League season`,
      `That forward must have a recorded MID season before a later FWD season.`,
      `p => p._careerEvolution?.midToFwd === true`,
      ["position-journey", "mid-to-fwd", "historical-core-eligible"], 26));
    if (position === "MID") {
      out.push(candidate(position, "position-journey", "def_to_mid",
        `Midfielder who had previously been classified as a defender in a Premier League season`,
        `That midfielder must have a recorded DEF season before a later MID season.`,
        `p => p._careerEvolution?.defToMid === true`,
        ["position-journey", "def-to-mid", "historical-core-eligible"], 26));
      out.push(candidate(position, "position-journey", "fwd_to_mid",
        `Midfielder who had previously been classified as a forward in a Premier League season`,
        `That midfielder must have a recorded FWD season before a later MID season.`,
        `p => p._careerEvolution?.fwdToMid === true`,
        ["position-journey", "fwd-to-mid", "historical-core-eligible"], 24));
    }
    if (position === "DEF") out.push(candidate(position, "position-journey", "mid_to_def",
      `Defender who had previously been classified as a midfielder in a Premier League season`,
      `That defender must have a recorded MID season before a later DEF season.`,
      `p => p._careerEvolution?.midToDef === true`,
      ["position-journey", "mid-to-def", "historical-core-eligible"], 24));
  }

  function addStatusJourneys(position, out) {
    const noun = NAMES[position], lower = LOWER[position];
    const rules = [
      ["promoted_relegated", "played for both a promoted club and a relegated club", "everPromotedClub", "everRelegatedClub"],
      ["top4_relegated", "played for both a top-four club and a relegated club", "everTopFour", "everRelegatedClub"],
      ["champion_bottomhalf", "won the Premier League and also played for a bottom-half club", "everChampion", "everBottomHalf"],
      ["promoted_top4", "played for both a promoted club and a top-four club", "everPromotedClub", "everTopFour"]
    ];
    for (const [tail, phrase, left, right] of rules) {
      out.push(candidate(position, "club-status-journey", tail,
        `${noun} who ${phrase} in their recorded Premier League career`,
        `That ${lower} must satisfy both career-status conditions using positive-minute Premier League seasons.`,
        `p => p._careerEvolution?.${left} === true && p._careerEvolution?.${right} === true`,
        ["club-status-journey", "career-context", "historical-core-eligible"], 24));
    }
    for (const count of [3, 4]) {
      out.push(candidate(position, "club-status-journey", `table_bands_${count}`,
        `${noun} who played for clubs across ${count}+ different Premier League table bands`,
        `That ${lower} must have positive-minute seasons spanning at least ${count} of the stored table bands: 1st–4th, 5th–8th, 9th–12th, 13th–17th or 18th–20th.`,
        `p => Number(p._careerEvolution?.tableBandCount) >= ${count}`,
        ["club-status-journey", "league-position", "career-context", "requires-extra-recovery"], 22));
    }
  }

  function nationalityCounts(position) {
    const counts = new Map();
    for (const player of players()) {
      const nationality = String(player?.bio?.nationality || "").trim();
      if (!nationality) continue;
      if (!(player.seasons || []).some(record => Number(record.minutes) > 0 && record.position === position)) continue;
      counts.set(nationality, (counts.get(nationality) || 0) + 1);
    }
    return [...counts.entries()].filter(([, count]) => count >= 6).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name]) => name);
  }

  function addNationalityCareer(position, out) {
    const lower = LOWER[position];
    for (const country of nationalityCounts(position)) {
      const q = JSON.stringify(country.toLowerCase());
      for (const seasons of [4, 6, 8]) {
        out.push(candidate(position, "nationality-career", `${slug(country)}_seasons_${seasons}`,
          `${country} ${lower} with ${seasons}+ recorded Premier League seasons`,
          `That ${lower} must be ${country} and have positive-minute records in at least ${seasons} Premier League seasons.`,
          `p => String(window.FPL_CAREER_EVOLUTION_CONTEXT?.nationalityForPlayer?.(p._career?.playerId) || "").toLowerCase() === ${q} && Number(p._career?.seasonCount) >= ${seasons}`,
          ["nationality-career", "nationality", country, "career-total", "historical-core-eligible"], 25));
      }
      for (const clubs of [2, 3, 4]) {
        out.push(candidate(position, "nationality-career", `${slug(country)}_clubs_${clubs}`,
          `${country} ${lower} who represented ${clubs}+ Premier League clubs`,
          `That ${lower} must be ${country} and have positive-minute records for at least ${clubs} different Premier League clubs.`,
          `p => String(window.FPL_CAREER_EVOLUTION_CONTEXT?.nationalityForPlayer?.(p._career?.playerId) || "").toLowerCase() === ${q} && Number(p._career?.clubCount) >= ${clubs}`,
          ["nationality-career", "nationality", country, "career-clubs", "historical-core-eligible"], 25));
      }
      out.push(candidate(position, "nationality-career", `${slug(country)}_never_big_six`,
        `${country} ${lower} who never played for a traditional Big Six club in their recorded Premier League career`,
        `That ${lower} must be ${country} and have no positive-minute recorded seasons for Arsenal, Chelsea, Liverpool, Man City, Man Utd or Spurs.`,
        `p => String(window.FPL_CAREER_EVOLUTION_CONTEXT?.nationalityForPlayer?.(p._career?.playerId) || "").toLowerCase() === ${q} && p._careerShape?.neverBigSix === true`,
        ["nationality-career", "nationality", country, "never-big-six", "historical-core-eligible"], 28));
    }
  }

  function addManagerJourneys(position, out) {
    const noun = NAMES[position], lower = LOWER[position];
    out.push(candidate(position, "manager-journey", "same_manager_two_clubs",
      `${noun} who worked under the same manager at two different Premier League clubs`,
      `That ${lower} must have positive-minute Premier League seasons under the same stored manager at at least two different clubs.`,
      `p => p._careerEvolution?.sameManagerDifferentClubs === true`,
      ["manager-journey", "manager", "career-context", "historical-core-eligible"], 30));
    for (const managers of [4, 5, 6, 8]) {
      out.push(candidate(position, "manager-journey", `manager_count_${managers}`,
        `${noun} who played under ${managers}+ different managers across their recorded Premier League career`,
        `That ${lower} must have positive-minute Premier League records under at least ${managers} different stored managers.`,
        `p => Number(p._careerShape?.managerCount) >= ${managers}`,
        ["manager-journey", "manager", "career-total", "historical-core-eligible"], 16));
    }
    for (const clubs of [2, 3]) {
      out.push(candidate(position, "manager-journey", `same_manager_clubs_${clubs}`,
        `${noun} whose most-travelled manager worked with them at ${clubs}+ Premier League clubs`,
        `That ${lower} must have a stored manager relationship spanning at least ${clubs} different Premier League clubs.`,
        `p => Number(p._careerEvolution?.maxClubsWithSameManager) >= ${clubs}`,
        ["manager-journey", "manager", "career-clubs", "historical-core-eligible"], 24));
    }
  }

  function buildBatch() {
    const positionMode = document.getElementById("factoryPositionMix")?.value || "balanced";
    const requested = Math.max(1, Math.min(50, Number(document.getElementById("factoryPromptCount")?.value) || 12));
    const positions = positionMode === "balanced" ? POSITIONS : POSITIONS.filter(position => position === positionMode);
    const difficultyMode = document.getElementById("factoryDifficultyMix")?.value || "balanced";
    const out = [];
    for (const position of positions) {
      addSeasonChange(position, out);
      addStreaks(position, out);
      addPositionJourneys(position, out);
      addStatusJourneys(position, out);
      addNationalityCareer(position, out);
      addManagerJourneys(position, out);
    }

    let candidates = out.filter(Boolean);
    if (difficultyMode !== "balanced") candidates = candidates.filter(item => item.difficulty === difficultyMode);
    candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    const chosen = [];
    const familyCounts = new Map();
    while (chosen.length < requested && candidates.length) {
      let bestIndex = -1;
      let bestValue = -Infinity;
      for (let index = 0; index < candidates.length; index += 1) {
        const item = candidates[index];
        if (chosen.some(other => other.position === item.position && overlap(other.stats.ids, item.stats.ids) >= 0.84)) continue;
        const positionUsed = chosen.filter(other => other.position === item.position).length;
        const familyUsed = familyCounts.get(item.family) || 0;
        const value = item.score - positionUsed * (positions.length > 1 ? 7 : 0) - familyUsed * 13;
        if (value > bestValue) { bestValue = value; bestIndex = index; }
      }
      if (bestIndex < 0) break;
      const [selected] = candidates.splice(bestIndex, 1);
      chosen.push(selected);
      familyCounts.set(selected.family, (familyCounts.get(selected.family) || 0) + 1);
    }
    return chosen;
  }

  function serialise(item) {
    return {
      id: item.id,
      family: item.family,
      position: item.position,
      label: item.label,
      fail: item.fail,
      difficulty: item.difficulty,
      tags: item.tags,
      rating: 5,
      cooldown: item.cooldown,
      enabled: item.enabled,
      studioRule: { kind: "source", source: item.source },
      testSource: item.source
    };
  }

  window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR = Object.freeze({ version: VERSION, buildBatch, serialise });
})();
