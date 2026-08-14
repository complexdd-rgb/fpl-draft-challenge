/* FPL Challenge Studio — Quality Prompt Pack v2.0.0
   Adds a second, deliberately different set of checked prompts focused on value,
   age, discipline and position-specific stat combinations. Candidates are evaluated
   against the full current database and only sensible position-aware answer pools survive. */
(() => {
  "use strict";

  if (window.FPL_QUALITY_PROMPT_PACK_V2?.ready) return;

  const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;
  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  if (!library || !players.length) return;

  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const NAMES = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const BIG_SIX = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"];
  const TARGET_PER_POSITION = 5;
  const COOLDOWN = 10;

  const RANGES = Object.freeze({
    GK: { narrow: 5, idealLow: 8, idealHigh: 35, broad: 70 },
    DEF: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    MID: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    FWD: { narrow: 6, idealLow: 12, idealHigh: 60, broad: 110 }
  });

  const POINTS = Object.freeze({
    GK: [55, 70, 85, 100, 115, 130],
    DEF: [65, 80, 95, 110, 125, 140, 155],
    MID: [70, 85, 100, 115, 130, 145, 160],
    FWD: [60, 75, 90, 105, 120, 135, 150]
  });

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
    if (field === "goalInvolvements") return Number(record.goals) + Number(record.assists);
    if (field === "outsideBigSix") return !BIG_SIX.includes(record.club);
    return record[field];
  }

  function isNumericPresent(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }

  function passesCondition(record, condition) {
    const value = fieldValue(record, condition.field);
    if (condition.operator === "isTrue") return value === true;
    if (condition.operator === "isFalse") return value !== true;
    if (!isNumericPresent(value)) return false;
    const number = Number(value);
    const first = Number(condition.value);
    const second = Number(condition.value2);
    if (condition.operator === "gte") return number >= first;
    if (condition.operator === "lte") return number <= first;
    if (condition.operator === "gt") return number > first;
    if (condition.operator === "lt") return number < first;
    if (condition.operator === "eq") return number === first;
    if (condition.operator === "between") return number >= Math.min(first, second) && number <= Math.max(first, second);
    return false;
  }

  function analyse(position, conditions) {
    const ids = new Set();
    for (const entry of recordsByPosition.get(position) || []) {
      let passed = false;
      try { passed = conditions.every(condition => passesCondition(entry.record, condition)); } catch (_) {}
      if (passed) ids.add(entry.playerId);
    }
    return { playerCount: ids.size, ids };
  }

  function accessor(field) {
    if (field === "goalInvolvements") return "(Number(p.goals) + Number(p.assists))";
    if (field === "outsideBigSix") return `!${JSON.stringify(BIG_SIX)}.includes(p.club)`;
    return `p.${field}`;
  }

  function conditionSource(condition) {
    const value = accessor(condition.field);
    if (condition.operator === "isTrue") return `(${value} === true)`;
    if (condition.operator === "isFalse") return `!(${value} === true)`;
    const first = Number(condition.value);
    const second = Number(condition.value2);
    const finite = `(${value} !== null && ${value} !== undefined && ${value} !== "" && Number.isFinite(Number(${value})))`;
    if (condition.operator === "between") {
      const low = Math.min(first, second);
      const high = Math.max(first, second);
      return `(${finite} && Number(${value}) >= ${low} && Number(${value}) <= ${high})`;
    }
    const symbol = { gte: ">=", lte: "<=", gt: ">", lt: "<", eq: "===" }[condition.operator];
    return symbol ? `(${finite} && Number(${value}) ${symbol} ${first})` : "false";
  }

  function sourceFor(conditions) {
    return `p => (${conditions.map(conditionSource).join(" && ")})`;
  }

  function compile(source) {
    try { return Function(`"use strict"; return (${source});`)(); }
    catch (_) { return null; }
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
      return 140 + novelty - Math.abs(count - midpoint) / Math.max(1, midpoint) * 22;
    }
    if (count < range.idealLow) return 96 + novelty - (range.idealLow - count) * 3;
    return 92 + novelty - (count - range.idealHigh) / Math.max(1, range.broad - range.idealHigh) * 30;
  }

  function candidate(position, family, idTail, label, fail, tags, conditions, novelty = 0) {
    const stats = analyse(position, conditions);
    return {
      id: `quality_v2_${position.toLowerCase()}_${idTail}`.replace(/[^a-z0-9_]+/g, "_"),
      family: `quality-pack-v2:${family}`,
      position,
      label,
      fail,
      tags: ["quality-pack", "quality-pack-v2", "checked", "anti-meta", ...tags],
      conditions,
      stats,
      score: qualityScore(position, stats.playerCount, novelty)
    };
  }

  function commonCandidates(position, output) {
    const noun = NAMES[position];
    const lower = LOWER[position];
    const points = POINTS[position];

    for (const age of [21, 22, 23, 24]) {
      for (const target of points) {
        output.push(candidate(position, "young-breakout", `young_${age}_points_${target}`,
          `${noun} aged ${age} or under at the start of the season with ${target}+ FPL points`,
          `That ${lower} must be aged ${age} or under at the start of the qualifying season and score at least ${target} FPL points.`,
          ["age", "young", "points"],
          [num("ageAtSeasonStart", "lte", age), num("points", "gte", target), num("minutes", "gt", 0)], 11));
      }
    }

    for (const age of [29, 30, 31, 32, 33]) {
      for (const target of points) {
        output.push(candidate(position, "veteran-performer", `veteran_${age}_points_${target}`,
          `${noun} aged ${age}+ at the start of the season with ${target}+ FPL points`,
          `That ${lower} must be aged at least ${age} at the start of the qualifying season and score at least ${target} FPL points.`,
          ["age", "veteran", "points"],
          [num("ageAtSeasonStart", "gte", age), num("points", "gte", target), num("minutes", "gt", 0)], 9));
      }
    }

    for (const cards of [1, 2, 3, 4, 5]) {
      for (const minutes of [2200, 2500, 2800, 3000]) {
        output.push(candidate(position, "disciplined-workhorse", `cards_${cards}_minutes_${minutes}`,
          `${noun} with at most ${cards} yellow card${cards === 1 ? "" : "s"} who played ${minutes.toLocaleString("en-GB")}+ minutes`,
          `That ${lower} must receive no more than ${cards} yellow card${cards === 1 ? "" : "s"} and play at least ${minutes.toLocaleString("en-GB")} minutes in the qualifying season.`,
          ["discipline", "yellow-cards", "minutes"],
          [num("yellowCards", "lte", cards), num("minutes", "gte", minutes)], 10));
      }
    }

    for (const bonus of position === "GK" ? [6, 10, 14, 18, 22] : [8, 12, 16, 20, 24, 28]) {
      for (const target of points) {
        output.push(candidate(position, "bonus-performer", `bonus_${bonus}_points_${target}`,
          `${noun} with ${bonus}+ bonus points and ${target}+ FPL points`,
          `That ${lower} must record at least ${bonus} bonus points and score at least ${target} FPL points in the qualifying season.`,
          ["bonus", "points"],
          [num("bonus", "gte", bonus), num("points", "gte", target), num("minutes", "gt", 0)], 7));
      }
    }

    for (const target of points) {
      output.push(candidate(position, "outside-big-six-star", `outside_big_six_points_${target}`,
        `${noun} outside the traditional Big Six with ${target}+ FPL points`,
        `That ${lower} must play outside Arsenal, Chelsea, Liverpool, Man City, Man Utd and Spurs in the qualifying season and score at least ${target} FPL points.`,
        ["outside-big-six", "points"],
        [bool("outsideBigSix"), num("points", "gte", target), num("minutes", "gt", 0)], 6));
    }
  }

  function goalkeeperCandidates(output) {
    for (const price of [4, 4.5, 5, 5.5]) {
      for (const saves of [70, 90, 110, 130]) {
        output.push(candidate("GK", "budget-shot-stopper", `price_${price}_saves_${saves}`,
          `Goalkeeper who started at £${price.toFixed(1)}m or less and made ${saves}+ saves`,
          `That goalkeeper must start at £${price.toFixed(1)}m or less and make at least ${saves} saves in the qualifying season.`,
          ["goalkeeper", "budget", "starting-price", "saves"],
          [num("startingPrice", "lte", price), num("saves", "gte", saves), num("minutes", "gt", 0)], 13));
      }
    }
    for (const saves of [80, 100, 120, 140]) {
      for (const sheets of [6, 8, 10, 12]) {
        output.push(candidate("GK", "complete-goalkeeper", `saves_${saves}_clean_${sheets}`,
          `Goalkeeper with ${saves}+ saves and ${sheets}+ clean sheets`,
          `That goalkeeper must make at least ${saves} saves and keep at least ${sheets} clean sheets in the qualifying season.`,
          ["goalkeeper", "saves", "clean-sheets"],
          [num("saves", "gte", saves), num("cleanSheets", "gte", sheets), num("minutes", "gt", 0)], 12));
      }
    }
    for (const saves of [80, 100, 120, 140]) {
      output.push(candidate("GK", "bottom-half-shot-stopper", `bottom_half_saves_${saves}`,
        `Goalkeeper from a bottom-half club with ${saves}+ saves`,
        `That goalkeeper must play for a bottom-half club and make at least ${saves} saves in the qualifying season.`,
        ["goalkeeper", "bottom-half", "saves"],
        [bool("bottomHalf"), num("saves", "gte", saves), num("minutes", "gt", 0)], 11));
    }
  }

  function defenderCandidates(output) {
    for (const price of [4, 4.5, 5, 5.5, 6]) {
      for (const involvements of [3, 4, 5, 6, 8, 10]) {
        output.push(candidate("DEF", "budget-attacking-defender", `price_${price}_gi_${involvements}`,
          `Defender who started at £${price.toFixed(1)}m or less with ${involvements}+ goal involvements`,
          `That defender must start at £${price.toFixed(1)}m or less and record at least ${involvements} combined goals and assists in the qualifying season.`,
          ["defender", "budget", "starting-price", "goal-involvements"],
          [num("startingPrice", "lte", price), num("goalInvolvements", "gte", involvements), num("minutes", "gt", 0)], 14));
      }
    }
    for (const goals of [2, 3, 4, 5]) {
      for (const age of [29, 30, 31, 32]) {
        output.push(candidate("DEF", "veteran-goalscorer", `age_${age}_goals_${goals}`,
          `Defender aged ${age}+ at the start of the season who scored ${goals}+ goals`,
          `That defender must be aged at least ${age} at the start of the qualifying season and score at least ${goals} goals.`,
          ["defender", "veteran", "age", "goals"],
          [num("ageAtSeasonStart", "gte", age), num("goals", "gte", goals), num("minutes", "gt", 0)], 10));
      }
    }
    for (const sheets of [7, 9, 11, 13]) {
      for (const minutes of [2200, 2600, 3000]) {
        output.push(candidate("DEF", "clean-sheet-workhorse", `clean_${sheets}_minutes_${minutes}`,
          `Defender with ${sheets}+ clean sheets who played ${minutes.toLocaleString("en-GB")}+ minutes`,
          `That defender must keep at least ${sheets} clean sheets and play at least ${minutes.toLocaleString("en-GB")} minutes in the qualifying season.`,
          ["defender", "clean-sheets", "minutes"],
          [num("cleanSheets", "gte", sheets), num("minutes", "gte", minutes)], 9));
      }
    }
  }

  function midfielderCandidates(output) {
    for (const price of [5, 5.5, 6, 6.5, 7, 7.5, 8]) {
      for (const involvements of [7, 9, 12, 15, 18, 22]) {
        output.push(candidate("MID", "budget-attacker", `price_${price}_gi_${involvements}`,
          `Midfielder who started at £${price.toFixed(1)}m or less with ${involvements}+ goal involvements`,
          `That midfielder must start at £${price.toFixed(1)}m or less and record at least ${involvements} combined goals and assists in the qualifying season.`,
          ["midfielder", "budget", "starting-price", "goal-involvements"],
          [num("startingPrice", "lte", price), num("goalInvolvements", "gte", involvements), num("minutes", "gt", 0)], 14));
      }
    }
    for (const assists of [5, 7, 9, 11, 13]) {
      for (const age of [29, 30, 31, 32]) {
        output.push(candidate("MID", "veteran-creator", `age_${age}_assists_${assists}`,
          `Midfielder aged ${age}+ at the start of the season with ${assists}+ assists`,
          `That midfielder must be aged at least ${age} at the start of the qualifying season and record at least ${assists} assists.`,
          ["midfielder", "veteran", "age", "assists"],
          [num("ageAtSeasonStart", "gte", age), num("assists", "gte", assists), num("minutes", "gt", 0)], 11));
      }
    }
    for (const goals of [5, 7, 9, 11]) {
      for (const assists of [5, 7, 9, 11]) {
        output.push(candidate("MID", "balanced-attacker", `goals_${goals}_assists_${assists}`,
          `Midfielder with ${goals}+ goals and ${assists}+ assists`,
          `That midfielder must score at least ${goals} goals and record at least ${assists} assists in the qualifying season.`,
          ["midfielder", "goals", "assists"],
          [num("goals", "gte", goals), num("assists", "gte", assists), num("minutes", "gt", 0)], 9));
      }
    }
  }

  function forwardCandidates(output) {
    for (const price of [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5]) {
      for (const goals of [7, 9, 11, 13, 15, 18]) {
        output.push(candidate("FWD", "budget-goalscorer", `price_${price}_goals_${goals}`,
          `Forward who started at £${price.toFixed(1)}m or less and scored ${goals}+ goals`,
          `That forward must start at £${price.toFixed(1)}m or less and score at least ${goals} goals in the qualifying season.`,
          ["forward", "budget", "starting-price", "goals"],
          [num("startingPrice", "lte", price), num("goals", "gte", goals), num("minutes", "gt", 0)], 14));
      }
    }
    for (const goals of [7, 9, 11, 13]) {
      for (const assists of [3, 4, 5, 6, 8]) {
        output.push(candidate("FWD", "complete-forward", `goals_${goals}_assists_${assists}`,
          `Forward with ${goals}+ goals and ${assists}+ assists`,
          `That forward must score at least ${goals} goals and record at least ${assists} assists in the qualifying season.`,
          ["forward", "goals", "assists"],
          [num("goals", "gte", goals), num("assists", "gte", assists), num("minutes", "gt", 0)], 10));
      }
    }
    for (const goals of [8, 10, 12, 14]) {
      for (const age of [29, 30, 31, 32, 33]) {
        output.push(candidate("FWD", "veteran-goalscorer", `age_${age}_goals_${goals}`,
          `Forward aged ${age}+ at the start of the season who scored ${goals}+ goals`,
          `That forward must be aged at least ${age} at the start of the qualifying season and score at least ${goals} goals.`,
          ["forward", "veteran", "age", "goals"],
          [num("ageAtSeasonStart", "gte", age), num("goals", "gte", goals), num("minutes", "gt", 0)], 11));
      }
    }
  }

  function buildCandidates(position) {
    const output = [];
    commonCandidates(position, output);
    if (position === "GK") goalkeeperCandidates(output);
    if (position === "DEF") defenderCandidates(output);
    if (position === "MID") midfielderCandidates(output);
    if (position === "FWD") forwardCandidates(output);
    return output;
  }

  function choose(position) {
    const bestByFamily = new Map();
    for (const item of buildCandidates(position)) {
      if (!Number.isFinite(item.score)) continue;
      const current = bestByFamily.get(item.family);
      if (!current || item.score > current.score || (item.score === current.score && item.id < current.id)) bestByFamily.set(item.family, item);
    }

    const ranked = [...bestByFamily.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const chosen = [];
    for (const item of ranked) {
      if (chosen.some(other => overlap(item.stats.ids, other.stats.ids) >= 0.86)) continue;
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
    const test = compile(source);
    if (!test) continue;
    const ideal = item.stats.playerCount >= RANGES[item.position].idealLow && item.stats.playerCount <= RANGES[item.position].idealHigh;
    const prompt = {
      id: item.id,
      family: item.family,
      position: item.position,
      label: item.label,
      fail: item.fail,
      difficulty: difficulty(item.position, item.stats.playerCount),
      tags: [...new Set(item.tags)],
      rating: ideal ? 5 : 4,
      cooldown: COOLDOWN,
      enabled: true,
      studioRule: { kind: "builder", join: "all", conditions: item.conditions.map(condition => ({ ...condition })) },
      testSource: source,
      test,
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
    const setCount = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = Number(value).toLocaleString("en-GB");
    };
    const enabled = library.filter(prompt => prompt?.enabled !== false).length;
    const custom = library.filter(prompt => Boolean(prompt?.studioRule)).length;
    setCount("managerLibraryCount", library.length);
    setCount("managerEnabledCount", enabled);
    setCount("managerDisabledCount", library.length - enabled);
    setCount("managerCustomCount", custom);
    const search = document.getElementById("promptManagerSearch");
    if (search) search.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refreshManagerUi, { once: true });
  else refreshManagerUi();
  window.addEventListener("fpl:prompt-tools-ready", refreshManagerUi);

  window.FPL_QUALITY_PROMPT_PACK_V2 = Object.freeze({
    ready: true,
    version: "2.0.0",
    added: added.length,
    selected: selected.length,
    ids: Object.freeze(added.map(prompt => prompt.id)),
    byPosition: Object.freeze(Object.fromEntries(POSITIONS.map(position => [position, added.filter(prompt => prompt.position === position).length])))
  });
})();
