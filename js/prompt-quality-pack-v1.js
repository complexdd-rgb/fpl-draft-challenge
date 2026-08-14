/* FPL Challenge Studio — Quality Prompt Pack v1.0.1
   Adds a small deterministic set of story-led prompt combinations after checking the
   current full player database. Nothing is added unless its distinct-player answer pool
   sits inside the same position-aware breadth ranges used by the quality tooling. */
(() => {
  "use strict";

  if (window.FPL_QUALITY_PROMPT_PACK_V1?.ready) return;

  const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;
  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  if (!library || !players.length) return;

  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const NAMES = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const BIG_SIX = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"];
  const TARGET_PER_POSITION = 6;
  const COOLDOWN = 10;

  const RANGES = Object.freeze({
    GK: { narrow: 5, idealLow: 8, idealHigh: 35, broad: 70 },
    DEF: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    MID: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    FWD: { narrow: 6, idealLow: 12, idealHigh: 60, broad: 110 }
  });

  const POINTS = Object.freeze({
    GK: [40, 55, 70, 85, 100, 115],
    DEF: [50, 65, 80, 95, 110, 125, 140],
    MID: [55, 70, 85, 100, 115, 130, 145],
    FWD: [45, 60, 75, 90, 105, 120, 135]
  });

  const ASSISTS = Object.freeze({ DEF: [2, 3, 4, 5, 6], MID: [4, 6, 8, 10, 12], FWD: [3, 4, 5, 6, 8] });
  const CLEAN_SHEETS = Object.freeze({ GK: [7, 9, 11, 13, 15], DEF: [6, 8, 10, 12, 14] });
  const GOAL_INVOLVEMENTS = Object.freeze({ MID: [7, 9, 12, 15, 18, 22], FWD: [6, 8, 10, 13, 16, 20] });
  const WORKHORSE_MINUTES = [1800, 2200, 2600, 3000];

  const recordsByPosition = new Map(POSITIONS.map(position => [position, []]));
  for (const player of players) {
    for (const record of player.seasons || []) {
      if (Number(record.minutes) <= 0 || !recordsByPosition.has(record.position)) continue;
      recordsByPosition.get(record.position).push({ playerId: player.playerId, record });
    }
  }

  const num = (field, operator, value, value2 = 0) => ({ field, operator, value, value2 });
  const bool = (field, truth = true) => ({ field, operator: truth ? "isTrue" : "isFalse", value: "", value2: "" });

  function fieldValue(record, field) {
    if (field === "careerSeasonCount") return Number(record._career?.seasonCount);
    if (field === "careerClubCount") return Number(record._career?.clubCount);
    if (field === "goalInvolvements") return Number(record.goals) + Number(record.assists);
    if (field === "outsideBigSix") return !BIG_SIX.includes(record.club);
    if (field === "assistsMoreThanGoals") return Number(record.assists) > Number(record.goals);
    if (field === "returnedToFormerClub") return record._career?.returnedToFormerClub === true;
    return record[field];
  }

  function passesCondition(record, condition) {
    const value = fieldValue(record, condition.field);
    const operator = condition.operator;
    if (operator === "isTrue") return value === true;
    if (operator === "isFalse") return value !== true;
    const number = Number(value);
    const target = Number(condition.value);
    const target2 = Number(condition.value2);
    if (!Number.isFinite(number)) return false;
    if (operator === "gte") return number >= target;
    if (operator === "lte") return number <= target;
    if (operator === "gt") return number > target;
    if (operator === "lt") return number < target;
    if (operator === "eq") return number === target;
    if (operator === "between") return number >= Math.min(target, target2) && number <= Math.max(target, target2);
    return false;
  }

  function testFor(conditions) {
    return record => conditions.every(condition => passesCondition(record, condition));
  }

  function accessor(field) {
    if (field === "careerSeasonCount") return "Number(p._career?.seasonCount)";
    if (field === "careerClubCount") return "Number(p._career?.clubCount)";
    if (field === "goalInvolvements") return "(Number(p.goals) + Number(p.assists))";
    if (field === "outsideBigSix") return `!${JSON.stringify(BIG_SIX)}.includes(p.club)`;
    if (field === "assistsMoreThanGoals") return "Number(p.assists) > Number(p.goals)";
    if (field === "returnedToFormerClub") return "p._career?.returnedToFormerClub === true";
    return `p.${field}`;
  }

  function conditionSource(condition) {
    const value = accessor(condition.field);
    if (condition.operator === "isTrue") return `(${value} === true)`;
    if (condition.operator === "isFalse") return `!(${value} === true)`;
    const first = Number(condition.value);
    const second = Number(condition.value2);
    if (condition.operator === "between") {
      const low = Math.min(first, second);
      const high = Math.max(first, second);
      return `(Number.isFinite(${value}) && ${value} >= ${low} && ${value} <= ${high})`;
    }
    const symbol = { gte: ">=", lte: "<=", gt: ">", lt: "<", eq: "===" }[condition.operator];
    return symbol ? `(Number.isFinite(${value}) && ${value} ${symbol} ${first})` : "false";
  }

  function sourceFor(conditions) {
    return `p => (${conditions.map(conditionSource).join(" && ")})`;
  }

  function compileStandaloneTest(source) {
    try { return Function(`"use strict"; return (${source});`)(); }
    catch (_) { return null; }
  }

  function analyse(position, conditions) {
    const ids = new Set();
    const test = testFor(conditions);
    for (const entry of recordsByPosition.get(position) || []) {
      let passed = false;
      try { passed = test(entry.record); } catch (_) {}
      if (passed) ids.add(entry.playerId);
    }
    return { playerCount: ids.size, ids, test };
  }

  function overlap(left, right) {
    if (!left.size || !right.size) return 0;
    const smaller = left.size <= right.size ? left : right;
    const larger = smaller === left ? right : left;
    let common = 0;
    for (const id of smaller) if (larger.has(id)) common += 1;
    return common / smaller.size;
  }

  function difficulty(position, count) {
    const range = RANGES[position];
    if (count <= Math.max(range.narrow + 4, 12)) return "hard";
    if (count <= Math.max(range.idealLow + 17, 35)) return "medium";
    return "easy";
  }

  function qualityScore(position, count, novelty = 0) {
    const range = RANGES[position];
    if (count < range.narrow || count > range.broad) return -Infinity;
    const midpoint = (range.idealLow + range.idealHigh) / 2;
    if (count >= range.idealLow && count <= range.idealHigh) {
      return 130 + novelty - Math.abs(count - midpoint) / Math.max(1, midpoint) * 24;
    }
    if (count < range.idealLow) return 95 + novelty - (range.idealLow - count) * 2.5;
    return 90 + novelty - (count - range.idealHigh) / Math.max(1, range.broad - range.idealHigh) * 28;
  }

  function candidate(position, family, idTail, label, fail, tags, conditions, novelty = 0) {
    const stats = analyse(position, conditions);
    const score = qualityScore(position, stats.playerCount, novelty);
    return {
      id: `quality_v1_${position.toLowerCase()}_${idTail}`.replace(/[^a-z0-9_]+/g, "_"),
      family: `quality-pack-v1:${family}`,
      position,
      label,
      fail,
      tags: ["quality-pack", "quality-pack-v1", "checked", "anti-meta", ...tags],
      cooldown: COOLDOWN,
      conditions,
      stats,
      score
    };
  }

  function buildCandidates(position) {
    const noun = NAMES[position];
    const lower = LOWER[position];
    const output = [];
    const points = POINTS[position];

    for (const seasons of [3, 4, 5, 6, 8]) {
      for (const pointTarget of points) {
        output.push(candidate(position, "one-club-veteran", `one_club_s${seasons}_p${pointTarget}`,
          `${noun} with one recorded Premier League club, ${seasons}+ recorded seasons and ${pointTarget}+ FPL points`,
          `That ${lower} must have recorded Premier League minutes for exactly one club across at least ${seasons} seasons and score at least ${pointTarget} FPL points in the qualifying season.`,
          ["career-total", "career-clubs", "career-seasons", "one-club", "points"],
          [num("careerClubCount", "eq", 1), num("careerSeasonCount", "gte", seasons), num("points", "gte", pointTarget), num("minutes", "gt", 0)], 9));
      }
    }

    for (const seasons of [4, 6, 8, 10]) {
      for (const minutes of WORKHORSE_MINUTES) {
        output.push(candidate(position, "one-club-workhorse", `one_club_s${seasons}_m${minutes}`,
          `${noun} with one recorded Premier League club, ${seasons}+ recorded seasons and ${minutes.toLocaleString("en-GB")}+ minutes in a season`,
          `That ${lower} must have recorded Premier League minutes for exactly one club across at least ${seasons} seasons and play at least ${minutes.toLocaleString("en-GB")} minutes in the qualifying season.`,
          ["career-total", "career-clubs", "career-seasons", "one-club", "minutes"],
          [num("careerClubCount", "eq", 1), num("careerSeasonCount", "gte", seasons), num("minutes", "gte", minutes)], 5));
      }
    }

    for (const seasons of [4, 6, 8, 10]) {
      for (const pointTarget of points) {
        output.push(candidate(position, "bottom-half-veteran", `bottom_half_s${seasons}_p${pointTarget}`,
          `${noun} from a bottom-half club with ${seasons}+ recorded Premier League seasons and ${pointTarget}+ FPL points`,
          `That ${lower} must play for a bottom-half club in the qualifying season, have at least ${seasons} recorded Premier League seasons and score at least ${pointTarget} FPL points.`,
          ["bottom-half", "career-total", "career-seasons", "points"],
          [bool("bottomHalf"), num("careerSeasonCount", "gte", seasons), num("points", "gte", pointTarget), num("minutes", "gt", 0)], 7));
      }
    }

    for (const clubs of [2, 3, 4, 5]) {
      for (const pointTarget of points) {
        output.push(candidate(position, "bottom-half-journeyman", `bottom_half_c${clubs}_p${pointTarget}`,
          `${noun} from a bottom-half club who represented ${clubs}+ recorded Premier League clubs and scored ${pointTarget}+ FPL points`,
          `That ${lower} must play for a bottom-half club in the qualifying season, have recorded Premier League minutes for at least ${clubs} clubs and score at least ${pointTarget} FPL points.`,
          ["bottom-half", "career-total", "career-clubs", "points"],
          [bool("bottomHalf"), num("careerClubCount", "gte", clubs), num("points", "gte", pointTarget), num("minutes", "gt", 0)], 8));
      }
    }

    for (const clubs of [3, 4, 5]) {
      for (const pointTarget of points) {
        output.push(candidate(position, "outside-big-six-journeyman", `outside_big_six_c${clubs}_p${pointTarget}`,
          `${noun} outside the traditional Big Six who represented ${clubs}+ recorded Premier League clubs and scored ${pointTarget}+ FPL points`,
          `That ${lower} must play outside the traditional Big Six in the qualifying season, have recorded Premier League minutes for at least ${clubs} clubs and score at least ${pointTarget} FPL points.`,
          ["outside-big-six", "career-total", "career-clubs", "points"],
          [bool("outsideBigSix"), num("careerClubCount", "gte", clubs), num("points", "gte", pointTarget), num("minutes", "gt", 0)], 8));
      }
    }

    for (const seasons of [3, 5, 7, 9]) {
      for (const pointTarget of points) {
        output.push(candidate(position, "promoted-veteran", `promoted_s${seasons}_p${pointTarget}`,
          `${noun} from a promoted club with ${seasons}+ recorded Premier League seasons and ${pointTarget}+ FPL points`,
          `That ${lower} must play for a promoted club in the qualifying season, have at least ${seasons} recorded Premier League seasons and score at least ${pointTarget} FPL points.`,
          ["promoted", "career-total", "career-seasons", "points"],
          [bool("promoted"), num("careerSeasonCount", "gte", seasons), num("points", "gte", pointTarget), num("minutes", "gt", 0)], 9));
      }
    }

    for (const clubs of [2, 3, 4, 5]) {
      for (const pointTarget of points) {
        output.push(candidate(position, "relegated-journeyman", `relegated_c${clubs}_p${pointTarget}`,
          `${noun} from a relegated club who represented ${clubs}+ recorded Premier League clubs and scored ${pointTarget}+ FPL points`,
          `That ${lower} must play for a relegated club in the qualifying season, have recorded Premier League minutes for at least ${clubs} clubs and score at least ${pointTarget} FPL points.`,
          ["relegated", "career-total", "career-clubs", "points"],
          [bool("relegated"), num("careerClubCount", "gte", clubs), num("points", "gte", pointTarget), num("minutes", "gt", 0)], 9));
      }
    }

    for (const clubs of [2, 3, 4]) {
      for (const pointTarget of points) {
        output.push(candidate(position, "top-four-journeyman", `top_four_c${clubs}_p${pointTarget}`,
          `${noun} from a top-four club who represented ${clubs}+ recorded Premier League clubs and scored ${pointTarget}+ FPL points`,
          `That ${lower} must play for a top-four club in the qualifying season, have recorded Premier League minutes for at least ${clubs} clubs and score at least ${pointTarget} FPL points.`,
          ["top-four", "career-total", "career-clubs", "points"],
          [bool("topFour"), num("careerClubCount", "gte", clubs), num("points", "gte", pointTarget), num("minutes", "gt", 0)], 4));
      }
    }

    for (const clubs of [2, 3, 4]) {
      for (const pointTarget of points) {
        output.push(candidate(position, "champion-journeyman", `champion_c${clubs}_p${pointTarget}`,
          `${noun} from the league champions who represented ${clubs}+ recorded Premier League clubs and scored ${pointTarget}+ FPL points`,
          `That ${lower} must play for the Premier League champions in the qualifying season, have recorded Premier League minutes for at least ${clubs} clubs and score at least ${pointTarget} FPL points.`,
          ["champions", "career-total", "career-clubs", "points"],
          [bool("champions"), num("careerClubCount", "gte", clubs), num("points", "gte", pointTarget), num("minutes", "gt", 0)], 5));
      }
    }

    if (ASSISTS[position]) {
      for (const seasons of [3, 5, 7]) {
        for (const assists of ASSISTS[position]) {
          output.push(candidate(position, "experienced-creator", `creator_s${seasons}_a${assists}`,
            `${noun} with ${seasons}+ recorded Premier League seasons, more assists than goals and ${assists}+ assists`,
            `That ${lower} must have at least ${seasons} recorded Premier League seasons, record more assists than goals and make at least ${assists} assists in the qualifying season.`,
            ["career-total", "career-seasons", "assists", "creator"],
            [num("careerSeasonCount", "gte", seasons), bool("assistsMoreThanGoals"), num("assists", "gte", assists), num("minutes", "gt", 0)], 7));
        }
      }
    }

    if (CLEAN_SHEETS[position]) {
      for (const seasons of [3, 5, 7, 9]) {
        for (const cleanSheets of CLEAN_SHEETS[position]) {
          output.push(candidate(position, "experienced-clean-sheets", `clean_s${seasons}_cs${cleanSheets}`,
            `${noun} with ${seasons}+ recorded Premier League seasons and ${cleanSheets}+ clean sheets in a season`,
            `That ${lower} must have at least ${seasons} recorded Premier League seasons and record at least ${cleanSheets} clean sheets in the qualifying season.`,
            ["career-total", "career-seasons", "clean-sheets"],
            [num("careerSeasonCount", "gte", seasons), num("cleanSheets", "gte", cleanSheets), num("minutes", "gt", 0)], 6));
        }
      }
    }

    if (GOAL_INVOLVEMENTS[position]) {
      for (const seasons of [3, 5, 7, 9]) {
        for (const involvements of GOAL_INVOLVEMENTS[position]) {
          output.push(candidate(position, "experienced-goal-involvements", `gi_s${seasons}_gi${involvements}`,
            `${noun} with ${seasons}+ recorded Premier League seasons and ${involvements}+ goal involvements in a season`,
            `That ${lower} must have at least ${seasons} recorded Premier League seasons and record at least ${involvements} combined goals and assists in the qualifying season.`,
            ["career-total", "career-seasons", "goal-involvements"],
            [num("careerSeasonCount", "gte", seasons), num("goalInvolvements", "gte", involvements), num("minutes", "gt", 0)], 6));
        }
      }
    }

    return output;
  }

  function choose(position) {
    const byFamily = new Map();
    for (const item of buildCandidates(position)) {
      if (!Number.isFinite(item.score)) continue;
      const current = byFamily.get(item.family);
      if (!current || item.score > current.score || (item.score === current.score && item.id < current.id)) byFamily.set(item.family, item);
    }

    const ranked = [...byFamily.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const chosen = [];
    for (const item of ranked) {
      if (chosen.some(other => overlap(item.stats.ids, other.stats.ids) >= 0.88)) continue;
      chosen.push(item);
      if (chosen.length >= TARGET_PER_POSITION) break;
    }
    return chosen;
  }

  const existingIds = new Set(library.map(prompt => String(prompt?.id || "")));
  const existingLabels = new Set(library.map(prompt => String(prompt?.label || "").trim().toLowerCase()));
  const selected = POSITIONS.flatMap(choose);
  const added = [];

  for (const item of selected) {
    if (existingIds.has(item.id) || existingLabels.has(item.label.trim().toLowerCase())) continue;
    const source = sourceFor(item.conditions);
    const standaloneTest = compileStandaloneTest(source);
    if (!standaloneTest) continue;
    const prompt = {
      id: item.id,
      family: item.family,
      position: item.position,
      label: item.label,
      fail: item.fail,
      difficulty: difficulty(item.position, item.stats.playerCount),
      tags: [...new Set(item.tags)],
      rating: item.stats.playerCount >= RANGES[item.position].idealLow && item.stats.playerCount <= RANGES[item.position].idealHigh ? 5 : 4,
      cooldown: item.cooldown,
      enabled: true,
      studioRule: { kind: "builder", join: "all", conditions: item.conditions.map(condition => ({ ...condition })) },
      testSource: source,
      test: standaloneTest,
      _studioBuiltIn: false,
      _studioCustom: true,
      _qualityPackAnswerCount: item.stats.playerCount,
      _qualityPackScore: Math.round(item.score)
    };
    library.push(prompt);
    existingIds.add(prompt.id);
    existingLabels.add(prompt.label.trim().toLowerCase());
    added.push(prompt);
  }

  window.FPL_STUDIO_API?.invalidatePromptStats?.();

  function refreshManagerUi() {
    const count = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = Number(value).toLocaleString("en-GB");
    };
    const enabled = library.filter(prompt => prompt?.enabled !== false).length;
    const custom = library.filter(prompt => Boolean(prompt?.studioRule)).length;
    count("managerLibraryCount", library.length);
    count("managerEnabledCount", enabled);
    count("managerDisabledCount", library.length - enabled);
    count("managerCustomCount", custom);

    const status = document.getElementById("managerStatus");
    if (status && added.length) {
      status.textContent = `Quality Pack v1 added ${added.length} checked prompts (${added.filter(prompt => prompt.rating === 5).length} rated 5★) using position-aware answer-pool limits. No player names or answers were revealed.`;
    }

    const search = document.getElementById("promptManagerSearch");
    if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refreshManagerUi, { once: true });
  else refreshManagerUi();
  window.addEventListener("fpl:prompt-tools-ready", refreshManagerUi);

  window.FPL_QUALITY_PROMPT_PACK_V1 = Object.freeze({
    ready: true,
    version: "1.0.1",
    added: added.length,
    selected: selected.length,
    ids: Object.freeze(added.map(prompt => prompt.id)),
    byPosition: Object.freeze(Object.fromEntries(POSITIONS.map(position => [position, added.filter(prompt => prompt.position === position).length])))
  });
})();
