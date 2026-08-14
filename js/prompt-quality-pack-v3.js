/* FPL Challenge Studio — Quality Prompt Pack v3.0.0
   A third, deliberately different prompt set focused on Premier League eras, named
   managers, table-position stories and exact-stat twists. Every candidate is tested
   against the current full database; only position-appropriate answer pools survive. */
(() => {
  "use strict";

  if (window.FPL_QUALITY_PROMPT_PACK_V3?.ready) return;

  const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;
  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  if (!library || !players.length) return;

  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const NAMES = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const TARGET_PER_POSITION = 5;
  const COOLDOWN = 10;
  const PRIOR_OVERLAP_LIMIT = 0.92;
  const LOCAL_OVERLAP_LIMIT = 0.86;

  const RANGES = Object.freeze({
    GK: { narrow: 5, idealLow: 8, idealHigh: 35, broad: 70 },
    DEF: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    MID: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    FWD: { narrow: 6, idealLow: 12, idealHigh: 60, broad: 110 }
  });

  const POINTS = Object.freeze({
    GK: [55, 70, 85, 100, 115, 130],
    DEF: [60, 75, 90, 105, 120, 135, 150],
    MID: [65, 80, 95, 110, 125, 140, 155],
    FWD: [55, 70, 85, 100, 115, 130, 145]
  });

  const recordsByPosition = new Map(POSITIONS.map(position => [position, []]));
  for (const player of players) {
    for (const record of player.seasons || []) {
      if (Number(record.minutes) <= 0 || !recordsByPosition.has(record.position)) continue;
      recordsByPosition.get(record.position).push({ playerId: player.playerId, record });
    }
  }

  const seasonYear = record => {
    const match = String(record?.season || "").match(/^(\d{4})/);
    return match ? Number(match[1]) : NaN;
  };
  const hasManager = (record, manager) => Array.isArray(record?.managers)
    && record.managers.some(value => String(value || "").trim().toLowerCase() === String(manager || "").trim().toLowerCase());

  function analyse(position, test) {
    const ids = new Set();
    for (const entry of recordsByPosition.get(position) || []) {
      let passed = false;
      try { passed = Boolean(test(entry.record)); } catch (_) {}
      if (passed) ids.add(entry.playerId);
    }
    return { playerCount: ids.size, ids };
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
    if (count < range.idealLow) return 97 + novelty - (range.idealLow - count) * 2.5;
    return 91 + novelty - (count - range.idealHigh) / Math.max(1, range.broad - range.idealHigh) * 28;
  }

  function candidate(position, family, idTail, label, fail, tags, source, test, novelty = 0) {
    const stats = analyse(position, test);
    return {
      id: `quality_v3_${position.toLowerCase()}_${idTail}`.replace(/[^a-z0-9_]+/g, "_"),
      family: `quality-pack-v3:${family}`,
      position,
      label,
      fail,
      tags: ["quality-pack", "quality-pack-v3", "checked", "anti-meta", ...tags],
      cooldown: COOLDOWN,
      source,
      test,
      stats,
      score: qualityScore(position, stats.playerCount, novelty)
    };
  }

  function managerCandidates(position, output) {
    const noun = NAMES[position];
    const lower = LOWER[position];
    const managerPlayers = new Map();
    for (const entry of recordsByPosition.get(position) || []) {
      for (const manager of Array.isArray(entry.record.managers) ? entry.record.managers : []) {
        const name = String(manager || "").trim();
        if (!name) continue;
        if (!managerPlayers.has(name)) managerPlayers.set(name, new Set());
        managerPlayers.get(name).add(entry.playerId);
      }
    }

    const managers = [...managerPlayers.entries()]
      .filter(([, ids]) => ids.size >= RANGES[position].narrow)
      .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
      .slice(0, 24)
      .map(([name]) => name);

    for (const manager of managers) {
      const managerKey = manager.toLowerCase();
      const managerId = manager.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
      for (const points of POINTS[position]) {
        const source = `p => (Array.isArray(p.managers) && p.managers.some(value => String(value || "").trim().toLowerCase() === ${JSON.stringify(managerKey)}) && Number.isFinite(Number(p.points)) && Number(p.points) >= ${points} && Number(p.minutes) > 0)`;
        const test = record => hasManager(record, manager) && Number(record.points) >= points && Number(record.minutes) > 0;
        output.push(candidate(position, "manager-performer", `manager_${managerId}_p${points}`,
          `${noun} managed by ${manager} who scored ${points}+ FPL points`,
          `That ${lower} season must have been managed by ${manager} and score at least ${points} FPL points.`,
          ["manager", "points"], source, test, 13));
      }

      for (const seasons of [3, 5, 7, 9]) {
        const minPoints = POINTS[position][1];
        const source = `p => (Array.isArray(p.managers) && p.managers.some(value => String(value || "").trim().toLowerCase() === ${JSON.stringify(managerKey)}) && Number(p._career?.seasonCount) >= ${seasons} && Number(p.points) >= ${minPoints} && Number(p.minutes) > 0)`;
        const test = record => hasManager(record, manager) && Number(record._career?.seasonCount) >= seasons && Number(record.points) >= minPoints && Number(record.minutes) > 0;
        output.push(candidate(position, "manager-veteran", `manager_${managerId}_career_${seasons}`,
          `${noun} managed by ${manager} with ${seasons}+ recorded Premier League seasons and ${minPoints}+ FPL points`,
          `That ${lower} season must have been managed by ${manager}; the player must have at least ${seasons} recorded Premier League seasons and score at least ${minPoints} FPL points.`,
          ["manager", "career-total", "career-seasons", "points"], source, test, 15));
      }
    }
  }

  function eraCandidates(position, output) {
    const noun = NAMES[position];
    const lower = LOWER[position];
    const eras = [
      [2011, 2015, "2011/12–2015/16"],
      [2016, 2019, "2016/17–2019/20"],
      [2020, 2022, "2020/21–2022/23"],
      [2023, 2026, "2023/24 onwards"]
    ];

    for (const [start, end, label] of eras) {
      for (const points of POINTS[position]) {
        const source = `p => (() => { const y = Number(String(p.season || "").slice(0, 4)); return Number.isFinite(y) && y >= ${start} && y <= ${end} && Number(p.points) >= ${points} && Number(p.minutes) > 0; })()`;
        const test = record => {
          const year = seasonYear(record);
          return year >= start && year <= end && Number(record.points) >= points && Number(record.minutes) > 0;
        };
        output.push(candidate(position, "era-performer", `era_${start}_${end}_p${points}`,
          `${noun} from the ${label} era who scored ${points}+ FPL points`,
          `That ${lower} must have a positive-minute season in the ${label} era and score at least ${points} FPL points in that season.`,
          ["season-rule", "era", "points"], source, test, 11));
      }
    }

    const specialist = position === "GK"
      ? { field: "saves", values: [70, 90, 110, 130], noun: "saves" }
      : position === "DEF"
        ? { field: "cleanSheets", values: [6, 8, 10, 12], noun: "clean sheets" }
        : position === "MID"
          ? { field: "assists", values: [5, 7, 9, 11], noun: "assists" }
          : { field: "goals", values: [7, 10, 13, 16], noun: "goals" };

    for (const [start, end, label] of eras) {
      for (const value of specialist.values) {
        const field = specialist.field;
        const source = `p => (() => { const y = Number(String(p.season || "").slice(0, 4)); return Number.isFinite(y) && y >= ${start} && y <= ${end} && Number(p.${field}) >= ${value} && Number(p.minutes) > 0; })()`;
        const test = record => {
          const year = seasonYear(record);
          return year >= start && year <= end && Number(record[field]) >= value && Number(record.minutes) > 0;
        };
        output.push(candidate(position, "era-specialist", `era_${start}_${end}_${field}_${value}`,
          `${noun} from the ${label} era with ${value}+ ${specialist.noun}`,
          `That ${lower} must have a positive-minute season in the ${label} era and record at least ${value} ${specialist.noun}.`,
          ["season-rule", "era", field === "cleanSheets" ? "clean-sheets" : field], source, test, 12));
      }
    }
  }

  function tableStoryCandidates(position, output) {
    const noun = NAMES[position];
    const lower = LOWER[position];
    const bands = [[1, 6, "top-six"], [7, 12, "7th–12th"], [13, 20, "13th–20th"]];
    const exact = position === "GK"
      ? { field: "bonus", values: [0, 3, 6, 9, 12], word: "bonus points" }
      : position === "DEF"
        ? { field: "goals", values: [0, 1, 2, 3, 4], word: "goals" }
        : position === "MID"
          ? { field: "assists", values: [2, 3, 4, 5, 6, 7], word: "assists" }
          : { field: "assists", values: [1, 2, 3, 4, 5, 6], word: "assists" };

    for (const [low, high, bandLabel] of bands) {
      for (const value of exact.values) {
        for (const points of [POINTS[position][1], POINTS[position][3]]) {
          const field = exact.field;
          const source = `p => (Number.isFinite(Number(p.leaguePosition)) && Number(p.leaguePosition) >= ${low} && Number(p.leaguePosition) <= ${high} && Number(p.${field}) === ${value} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`;
          const test = record => Number(record.leaguePosition) >= low && Number(record.leaguePosition) <= high && Number(record[field]) === value && Number(record.points) >= points && Number(record.minutes) > 0;
          output.push(candidate(position, "table-exact-stat", `table_${low}_${high}_${field}_${value}_p${points}`,
            `${noun} from a ${bandLabel} club with exactly ${value} ${exact.word} and ${points}+ FPL points`,
            `That ${lower}'s club must finish ${low}th–${high}th; the player must record exactly ${value} ${exact.word} and score at least ${points} FPL points.`,
            ["league-position", "exact-stat", field === "bonus" ? "bonus" : field, "points"], source, test, 14));
        }
      }
    }
  }

  function promotedRelegatedExactCandidates(position, output) {
    const noun = NAMES[position];
    const lower = LOWER[position];
    const configs = position === "GK"
      ? [{ field: "cleanSheets", values: [4, 5, 6, 7, 8], word: "clean sheets" }]
      : position === "DEF"
        ? [{ field: "assists", values: [0, 1, 2, 3, 4], word: "assists" }]
        : position === "MID"
          ? [{ field: "goals", values: [2, 3, 4, 5, 6, 7], word: "goals" }]
          : [{ field: "goals", values: [4, 5, 6, 7, 8, 10], word: "goals" }];

    for (const flag of ["promoted", "relegated"]) {
      for (const config of configs) {
        for (const value of config.values) {
          const points = POINTS[position][1];
          const source = `p => (p.${flag} === true && Number(p.${config.field}) === ${value} && Number(p.points) >= ${points} && Number(p.minutes) > 0)`;
          const test = record => record[flag] === true && Number(record[config.field]) === value && Number(record.points) >= points && Number(record.minutes) > 0;
          output.push(candidate(position, `${flag}-exact-stat`, `${flag}_${config.field}_${value}_p${points}`,
            `${noun} from a ${flag} club with exactly ${value} ${config.word} and ${points}+ FPL points`,
            `That ${lower} must play for a ${flag} club, record exactly ${value} ${config.word} and score at least ${points} FPL points.`,
            [flag, "exact-stat", config.field === "cleanSheets" ? "clean-sheets" : config.field, "points"], source, test, 15));
        }
      }
    }
  }

  function buildCandidates(position) {
    const output = [];
    managerCandidates(position, output);
    eraCandidates(position, output);
    tableStoryCandidates(position, output);
    promotedRelegatedExactCandidates(position, output);
    return output;
  }

  function priorQualityPools(position) {
    const pools = [];
    for (const prompt of library) {
      if (prompt?.position !== position || !(prompt.tags || []).includes("quality-pack")) continue;
      if ((prompt.tags || []).includes("quality-pack-v3")) continue;
      if (typeof prompt.test !== "function") continue;
      const stats = analyse(position, prompt.test);
      if (stats.ids.size) pools.push(stats.ids);
    }
    return pools;
  }

  function choose(position) {
    const priorPools = priorQualityPools(position);
    const byFamily = new Map();
    for (const item of buildCandidates(position)) {
      if (!Number.isFinite(item.score)) continue;
      if (priorPools.some(pool => overlap(item.stats.ids, pool) >= PRIOR_OVERLAP_LIMIT)) continue;
      const current = byFamily.get(item.family);
      if (!current || item.score > current.score || (item.score === current.score && item.id < current.id)) byFamily.set(item.family, item);
    }

    const ranked = [...byFamily.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const chosen = [];
    for (const item of ranked) {
      if (chosen.some(other => overlap(item.stats.ids, other.stats.ids) >= LOCAL_OVERLAP_LIMIT)) continue;
      chosen.push(item);
      if (chosen.length >= TARGET_PER_POSITION) break;
    }
    return chosen;
  }

  function compile(source) {
    try { return Function(`"use strict"; return (${source});`)(); }
    catch (_) { return null; }
  }

  const existingIds = new Set(library.map(prompt => String(prompt?.id || "")));
  const existingLabels = new Set(library.map(prompt => String(prompt?.label || "").trim().toLowerCase()));
  const selected = POSITIONS.flatMap(choose);
  const added = [];

  for (const item of selected) {
    if (existingIds.has(item.id) || existingLabels.has(item.label.trim().toLowerCase())) continue;
    const standaloneTest = compile(item.source);
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
      studioRule: { kind: "source", source: item.source },
      testSource: item.source,
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

  window.FPL_QUALITY_PROMPT_PACK_V3 = Object.freeze({
    ready: true,
    version: "3.0.0",
    added: added.length,
    selected: selected.length,
    ids: Object.freeze(added.map(prompt => prompt.id)),
    byPosition: Object.freeze(Object.fromEntries(POSITIONS.map(position => [position, added.filter(prompt => prompt.position === position).length])))
  });
})();
