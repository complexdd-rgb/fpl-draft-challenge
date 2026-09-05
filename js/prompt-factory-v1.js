/* FPL Draft Challenge — Prompt Factory v1.0.0
   Clean candidate exploration engine. Generates and evaluates prompt candidates by family,
   but never writes them into the canonical library. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_FACTORY_V1?.ready) return;

  const VERSION = "1.0.0";
  const MAX_CANDIDATES_PER_FAMILY = 60000;
  const POSITION_LABELS = Object.freeze({ ANY: "Player", GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" });
  const POSITION_ORDER = Object.freeze(["ANY", "GK", "DEF", "MID", "FWD"]);
  const BIG_SIX = Object.freeze(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"]);

  const FIELD_CONFIG = Object.freeze({
    points: { label: "FPL points", step: 5, min: 20 },
    goals: { label: "goals", step: 1, min: 1 },
    assists: { label: "assists", step: 1, min: 1 },
    goalInvolvements: { label: "goal involvements", step: 1, min: 2 },
    cleanSheets: { label: "clean sheets", step: 1, min: 1 },
    bonus: { label: "bonus points", step: 1, min: 1 },
    saves: { label: "saves", step: 5, min: 10 },
    minutes: { label: "minutes", step: 100, min: 100 },
    startingPrice: { label: "starting price", step: 0.5, min: 3.5, price: true },
    ageAtSeasonStart: { label: "age", step: 1, min: 16 },
    yellowCards: { label: "yellow cards", step: 1, min: 1 },
    redCards: { label: "red cards", step: 1, min: 1 },
    goalsConceded: { label: "goals conceded", step: 5, min: 5 },
    leaguePosition: { label: "league finish", step: 1, min: 1 },
    careerSeasonCount: { label: "recorded Premier League seasons", step: 1, min: 2 },
    careerClubCount: { label: "recorded Premier League clubs", step: 1, min: 2 }
  });

  const FAMILY_DEFS = Object.freeze([
    { id: "season-stats", label: "Season stats", description: "Single-stat thresholds across all positions." },
    { id: "position-stat", label: "Position stats", description: "Single-stat thresholds split by GK, DEF, MID and FWD." },
    { id: "exact-stats", label: "Exact stats", description: "Exact discrete-stat values where the database has real answers." },
    { id: "combined-stats", label: "Combined stats", description: "Two-stat combinations using data-driven thresholds." },
    { id: "club-stat", label: "Club + stat", description: "Club membership combined with output thresholds." },
    { id: "league-position", label: "League position", description: "Table-position context combined with useful stats." },
    { id: "promoted-clubs", label: "Promoted clubs", description: "Promoted-club context combined with useful stats." },
    { id: "relegated-clubs", label: "Relegated clubs", description: "Relegated-club context combined with useful stats." },
    { id: "champions", label: "Champions", description: "Champion-club context combined with useful stats." },
    { id: "nationality", label: "Nationality", description: "Nationality combined with position and stat thresholds." },
    { id: "career-longevity", label: "Career longevity", description: "Premier League season-count prompts and combinations." },
    { id: "club-count", label: "Career club count", description: "Number-of-clubs prompts and combinations." },
    { id: "manager", label: "Manager", description: "Manager relationships combined with output thresholds." },
    { id: "anti-meta", label: "Anti-meta", description: "Lower-profile contexts, ceilings and non-obvious combinations." },
    { id: "value", label: "Value", description: "Starting-price ceilings combined with output." },
    { id: "minutes-role", label: "Minutes + role", description: "Playing-time thresholds combined with role output." },
    { id: "composite-story", label: "Composite stories", description: "Three-condition context + output prompt stories." }
  ]);

  const state = {
    rows: [],
    results: new Map(),
    selectedFamily: "season-stats",
    running: false,
    cancelRequested: false,
    criteria: { minPlayers: 2, maxPlayers: 150, minSeasons: 1, minClubs: 1, minCoverage: 35 }
  };

  const players = () => Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const slug = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const number = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

  function canonicalCountry(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const key = slug(raw);
    const aliases = {
      cote_d_ivoire: "Ivory Coast", ivory_coast: "Ivory Coast",
      korea_republic: "South Korea", republic_of_korea: "South Korea", south_korea: "South Korea",
      united_states: "USA", united_states_of_america: "USA", usa: "USA",
      republic_of_ireland: "Ireland", trinidad_tobago: "Trinidad and Tobago",
      bosnia_and_herzegovina: "Bosnia-Herzegovina", czechia: "Czech Republic",
      democratic_republic_of_the_congo: "DR Congo", congo_dr: "DR Congo"
    };
    return aliases[key] || raw.replace(/\s+/g, " ");
  }

  function buildRows() {
    const out = [];
    for (const player of players()) {
      const eligible = (player.seasons || []).filter(record => Number(record?.minutes) > 0);
      if (!eligible.length) continue;
      const careerSeasonCount = new Set(eligible.map(record => String(record.season || "")).filter(Boolean)).size;
      const careerClubCount = new Set(eligible.map(record => String(record.club || "")).filter(Boolean)).size;
      const nationality = canonicalCountry(player?.bio?.nationality);
      for (const record of eligible) out.push({ player, record, careerSeasonCount, careerClubCount, nationality });
    }
    state.rows = out;
    return out;
  }

  function positionRows(position) {
    return position === "ANY" ? state.rows : state.rows.filter(row => row.record?.position === position);
  }

  function fieldValue(row, field) {
    const record = row.record || {};
    if (field === "goalInvolvements") {
      const goals = number(record.goals);
      const assists = number(record.assists);
      return goals == null || assists == null ? null : goals + assists;
    }
    if (field === "careerSeasonCount") return row.careerSeasonCount;
    if (field === "careerClubCount") return row.careerClubCount;
    if (field === "nationality") return row.nationality || null;
    if (field === "outsideBigSix") return record.club ? !BIG_SIX.includes(record.club) : null;
    if (field === "champions") return typeof record.champions === "boolean" ? record.champions : number(record.leaguePosition) === 1;
    if (field === "topFour") {
      if (typeof record.topFour === "boolean") return record.topFour;
      const finish = number(record.leaguePosition);
      return finish == null ? null : finish >= 1 && finish <= 4;
    }
    if (field === "bottomHalf") return typeof record.bottomHalf === "boolean" ? record.bottomHalf : null;
    if (field === "relegated") return typeof record.relegated === "boolean" ? record.relegated : null;
    if (field === "promoted") return typeof record.promoted === "boolean" ? record.promoted : null;
    if (field === "manager") return Array.isArray(record.managers) ? record.managers : [];
    return record[field] ?? null;
  }

  function known(row, condition) {
    const value = fieldValue(row, condition.field);
    if (condition.operator === "contains") return Array.isArray(value) ? value.length > 0 : Boolean(String(value || "").trim());
    if (["isTrue", "isFalse"].includes(condition.operator)) return typeof value === "boolean";
    if (["eqText"].includes(condition.operator)) return Boolean(String(value || "").trim());
    return number(value) != null;
  }

  function matches(row, condition) {
    const actual = fieldValue(row, condition.field);
    if (condition.operator === "isTrue") return actual === true;
    if (condition.operator === "isFalse") return actual === false;
    if (condition.operator === "eqText") return String(actual || "").trim().toLowerCase() === String(condition.value || "").trim().toLowerCase();
    if (condition.operator === "contains") return Array.isArray(actual) && actual.some(item => String(item).trim().toLowerCase() === String(condition.value || "").trim().toLowerCase());
    const actualNumber = number(actual);
    const wanted = number(condition.value);
    if (actualNumber == null || wanted == null) return false;
    if (condition.operator === "eq") return actualNumber === wanted;
    if (condition.operator === "gte") return actualNumber >= wanted;
    if (condition.operator === "lte") return actualNumber <= wanted;
    if (condition.operator === "gt") return actualNumber > wanted;
    if (condition.operator === "lt") return actualNumber < wanted;
    if (condition.operator === "between") {
      const upper = number(condition.value2);
      return upper != null && actualNumber >= wanted && actualNumber <= upper;
    }
    return false;
  }

  function thresholds(field, position = "ANY", operator = "gte") {
    const config = FIELD_CONFIG[field];
    if (!config) return [];
    const values = positionRows(position).map(row => number(fieldValue(row, field))).filter(value => value != null);
    if (!values.length) return [];
    const observedMin = Math.min(...values);
    const observedMax = Math.max(...values);
    const step = config.step;
    let low = Math.max(config.min ?? observedMin, observedMin);
    let high = observedMax;
    low = Math.ceil(low / step) * step;
    high = Math.floor(high / step) * step;
    const out = [];
    for (let value = low; value <= high + step / 1000; value += step) {
      const rounded = Number(value.toFixed(step < 1 ? 1 : 0));
      const rawAnswers = values.filter(actual => operator === "lte" ? actual <= rounded : actual >= rounded).length;
      if (rawAnswers > 0 && rawAnswers < values.length) out.push(rounded);
    }
    return out;
  }

  function exactValues(field, position = "ANY") {
    const values = positionRows(position).map(row => number(fieldValue(row, field))).filter(value => value != null);
    return [...new Set(values)].sort((a, b) => a - b).filter(value => value >= (FIELD_CONFIG[field]?.min ?? -Infinity));
  }

  function topTextValues(field, minPlayers = 2) {
    const map = new Map();
    for (const row of state.rows) {
      const raw = fieldValue(row, field);
      const values = Array.isArray(raw) ? raw : [raw];
      for (const value of values) {
        const text = String(value || "").trim();
        if (!text) continue;
        if (!map.has(text)) map.set(text, new Set());
        map.get(text).add(row.player.playerId);
      }
    }
    return [...map.entries()].filter(([, ids]) => ids.size >= minPlayers).sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0])).map(([value]) => value);
  }

  function numericCondition(field, operator, value, value2 = null) {
    return { field, operator, value, ...(value2 == null ? {} : { value2 }) };
  }

  function textCondition(field, value, operator = "eqText") {
    return { field, operator, value };
  }

  function flagCondition(field, wanted = true) {
    return { field, operator: wanted ? "isTrue" : "isFalse", value: wanted };
  }

  function conditionPhrase(condition) {
    const config = FIELD_CONFIG[condition.field];
    const value = condition.value;
    if (condition.field === "club") return `who played for ${value}`;
    if (condition.field === "manager") return `managed by ${value}`;
    if (condition.field === "nationality") return `with ${value} nationality`;
    const flags = {
      champions: "from the league champions",
      topFour: "from a top-four club",
      bottomHalf: "from a bottom-half club",
      relegated: "from a relegated club",
      promoted: "from a promoted club",
      outsideBigSix: "outside the traditional Big Six"
    };
    if (flags[condition.field]) return flags[condition.field];
    if (!config) return "";
    if (condition.field === "startingPrice") {
      if (condition.operator === "lte") return `who started at £${Number(value).toFixed(1)}m or less`;
      if (condition.operator === "gte") return `who started at £${Number(value).toFixed(1)}m or more`;
    }
    if (condition.field === "ageAtSeasonStart") {
      if (condition.operator === "lte") return `aged ${value} or under at season start`;
      if (condition.operator === "gte") return `aged ${value} or over at season start`;
      if (condition.operator === "eq") return `aged exactly ${value} at season start`;
    }
    if (condition.field === "leaguePosition") {
      if (condition.operator === "eq") return `from a club finishing exactly ${value}${ordinalSuffix(value)}`;
      if (condition.operator === "lte") return `from a club finishing ${value}${ordinalSuffix(value)} or higher`;
      if (condition.operator === "gte") return `from a club finishing ${value}${ordinalSuffix(value)} or lower`;
    }
    if (condition.operator === "eq") return `with exactly ${value} ${config.label}`;
    if (condition.operator === "lte") return `with at most ${value} ${config.label}`;
    if (condition.operator === "gte") return `with at least ${value} ${config.label}`;
    if (condition.operator === "between") return `with ${value}–${condition.value2} ${config.label}`;
    return "";
  }

  function ordinalSuffix(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    if (n % 10 === 1) return "st";
    if (n % 10 === 2) return "nd";
    if (n % 10 === 3) return "rd";
    return "th";
  }

  function wording(position, conditions) {
    const noun = POSITION_LABELS[position] || "Player";
    const phrases = conditions.map(conditionPhrase).filter(Boolean);
    return `${noun}${phrases.length ? ` ${phrases.join(" and ")}` : ""}`;
  }

  function stableId(family, position, conditions) {
    const signature = `${family}|${position}|${conditions.map(condition => `${condition.field}:${condition.operator}:${condition.value}:${condition.value2 ?? ""}`).sort().join("|")}`;
    let hash = 2166136261;
    for (const char of signature) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return `factory_${slug(family)}_${position.toLowerCase()}_${(hash >>> 0).toString(36)}`;
  }

  function candidate(family, position, conditions) {
    return {
      id: stableId(family, position, conditions),
      family,
      position,
      label: wording(position, conditions),
      conditions: conditions.map(item => ({ ...item })),
      enabled: false,
      source: "prompt-factory-v1"
    };
  }

  function dedupeAndCap(items) {
    const seen = new Set();
    const out = [];
    let capped = false;
    for (const item of items) {
      const key = `${item.position}|${item.conditions.map(condition => `${condition.field}:${condition.operator}:${condition.value}:${condition.value2 ?? ""}`).sort().join("|")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= MAX_CANDIDATES_PER_FAMILY) { capped = true; break; }
    }
    return { candidates: out, capped };
  }

  function applicableStatFields(position) {
    const common = ["points", "goals", "assists", "goalInvolvements", "bonus", "minutes", "startingPrice", "ageAtSeasonStart", "yellowCards", "redCards"];
    if (position === "GK") return [...common, "cleanSheets", "saves", "goalsConceded"];
    if (position === "DEF") return [...common, "cleanSheets", "goalsConceded"];
    return common;
  }

  function thresholdConditions(field, position, operators = ["gte"]) {
    const out = [];
    for (const operator of operators) for (const value of thresholds(field, position, operator)) out.push(numericCondition(field, operator, value));
    return out;
  }

  function primaryOutputFields(position) {
    if (position === "GK") return ["points", "saves", "cleanSheets", "bonus"];
    if (position === "DEF") return ["points", "cleanSheets", "goals", "assists", "bonus"];
    return ["points", "goals", "assists", "goalInvolvements", "bonus"];
  }

  function generateFamily(family) {
    const out = [];
    const add = (position, conditions) => out.push(candidate(family, position, conditions));

    if (family === "season-stats") {
      for (const field of applicableStatFields("ANY")) for (const condition of thresholdConditions(field, "ANY", ["gte", "lte"])) add("ANY", [condition]);
    }

    if (family === "position-stat") {
      for (const position of POSITION_ORDER.slice(1)) for (const field of applicableStatFields(position)) for (const condition of thresholdConditions(field, position, ["gte", "lte"])) add(position, [condition]);
    }

    if (family === "exact-stats") {
      const exactFields = ["goals", "assists", "goalInvolvements", "cleanSheets", "bonus", "saves", "yellowCards", "redCards", "leaguePosition", "ageAtSeasonStart"];
      for (const position of POSITION_ORDER) {
        for (const field of exactFields.filter(name => applicableStatFields(position).includes(name) || ["leaguePosition"].includes(name))) {
          for (const value of exactValues(field, position)) add(position, [numericCondition(field, "eq", value)]);
        }
      }
    }

    if (family === "combined-stats") {
      for (const position of POSITION_ORDER) {
        const fields = primaryOutputFields(position);
        for (let left = 0; left < fields.length; left += 1) for (let right = left + 1; right < fields.length; right += 1) {
          const leftConditions = thresholdConditions(fields[left], position, ["gte"]);
          const rightConditions = thresholdConditions(fields[right], position, ["gte"]);
          for (const a of leftConditions) for (const b of rightConditions) add(position, [a, b]);
        }
      }
    }

    if (family === "club-stat") {
      const clubs = topTextValues("club", 3);
      for (const club of clubs) for (const position of POSITION_ORDER) for (const field of primaryOutputFields(position).slice(0, 3)) {
        for (const condition of thresholdConditions(field, position, ["gte"])) add(position, [textCondition("club", club), condition]);
      }
    }

    if (family === "league-position") {
      const flags = ["champions", "topFour", "bottomHalf", "outsideBigSix"];
      for (const position of POSITION_ORDER) {
        for (const flag of flags) for (const field of primaryOutputFields(position).slice(0, 3)) for (const condition of thresholdConditions(field, position, ["gte"])) add(position, [flagCondition(flag), condition]);
        for (const finish of exactValues("leaguePosition", position)) add(position, [numericCondition("leaguePosition", "eq", finish)]);
      }
    }

    for (const [familyId, flag] of [["promoted-clubs", "promoted"], ["relegated-clubs", "relegated"], ["champions", "champions"]]) {
      if (family !== familyId) continue;
      for (const position of POSITION_ORDER) for (const field of primaryOutputFields(position)) for (const condition of thresholdConditions(field, position, ["gte"])) add(position, [flagCondition(flag), condition]);
    }

    if (family === "nationality") {
      const countries = topTextValues("nationality", 2);
      for (const country of countries) for (const position of POSITION_ORDER) for (const field of primaryOutputFields(position).slice(0, 4)) {
        for (const condition of thresholdConditions(field, position, ["gte"])) add(position, [textCondition("nationality", country), condition]);
      }
    }

    if (family === "career-longevity") {
      for (const position of POSITION_ORDER) {
        for (const value of thresholds("careerSeasonCount", position, "gte")) add(position, [numericCondition("careerSeasonCount", "gte", value)]);
        for (const value of thresholds("careerSeasonCount", position, "gte")) for (const points of thresholds("points", position, "gte")) add(position, [numericCondition("careerSeasonCount", "gte", value), numericCondition("points", "gte", points)]);
      }
    }

    if (family === "club-count") {
      for (const position of POSITION_ORDER) {
        for (const value of thresholds("careerClubCount", position, "gte")) add(position, [numericCondition("careerClubCount", "gte", value)]);
        for (const value of thresholds("careerClubCount", position, "gte")) for (const points of thresholds("points", position, "gte")) add(position, [numericCondition("careerClubCount", "gte", value), numericCondition("points", "gte", points)]);
      }
    }

    if (family === "manager") {
      const managers = topTextValues("manager", 2);
      for (const manager of managers) for (const position of POSITION_ORDER) for (const points of thresholds("points", position, "gte")) add(position, [textCondition("manager", manager, "contains"), numericCondition("points", "gte", points)]);
    }

    if (family === "anti-meta") {
      const contexts = [flagCondition("outsideBigSix"), flagCondition("bottomHalf"), flagCondition("relegated"), flagCondition("promoted")];
      for (const position of POSITION_ORDER) {
        for (const context of contexts) {
          for (const points of thresholdConditions("points", position, ["lte", "gte"])) add(position, [context, points]);
          for (const field of primaryOutputFields(position).filter(name => name !== "points")) for (const stat of thresholdConditions(field, position, ["gte"])) add(position, [context, stat]);
        }
      }
    }

    if (family === "value") {
      for (const position of POSITION_ORDER) {
        const prices = thresholdConditions("startingPrice", position, ["lte"]);
        const outputs = primaryOutputFields(position).slice(0, 4);
        for (const price of prices) for (const field of outputs) for (const output of thresholdConditions(field, position, ["gte"])) add(position, [price, output]);
      }
    }

    if (family === "minutes-role") {
      for (const position of POSITION_ORDER) {
        const minutes = thresholdConditions("minutes", position, ["gte"]);
        const outputFields = primaryOutputFields(position).filter(field => field !== "points");
        for (const minute of minutes) for (const field of outputFields) for (const output of thresholdConditions(field, position, ["gte"])) add(position, [minute, output]);
      }
    }

    if (family === "composite-story") {
      const contexts = [flagCondition("outsideBigSix"), flagCondition("bottomHalf"), flagCondition("relegated"), flagCondition("promoted"), flagCondition("topFour")];
      for (const position of POSITION_ORDER) {
        const fields = primaryOutputFields(position);
        const points = thresholdConditions("points", position, ["gte"]);
        for (const context of contexts) for (const point of points) for (const field of fields.filter(name => name !== "points").slice(0, 3)) for (const output of thresholdConditions(field, position, ["gte"])) add(position, [context, point, output]);
      }
    }

    return dedupeAndCap(out);
  }

  function evaluateCandidate(item, criteria) {
    const rows = positionRows(item.position);
    const answerPlayers = new Set();
    const seasons = new Set();
    const clubs = new Set();
    const nationalities = new Set();
    let answerRecords = 0;
    let knownRows = 0;

    for (const row of rows) {
      if (!item.conditions.every(condition => known(row, condition))) continue;
      knownRows += 1;
      if (!item.conditions.every(condition => matches(row, condition))) continue;
      answerRecords += 1;
      answerPlayers.add(String(row.player.playerId));
      if (row.record.season) seasons.add(String(row.record.season));
      if (row.record.club) clubs.add(String(row.record.club));
      if (row.nationality) nationalities.add(row.nationality);
    }

    const coverage = rows.length ? Number((knownRows / rows.length * 100).toFixed(1)) : 0;
    const playerCount = answerPlayers.size;
    const playable = playerCount >= criteria.minPlayers && playerCount <= criteria.maxPlayers;
    const survivor = playable && seasons.size >= criteria.minSeasons && clubs.size >= criteria.minClubs && coverage >= criteria.minCoverage;
    const difficulty = playerCount <= 8 ? "hard" : playerCount <= 30 ? "medium" : "easy";
    const score = survivor ? Math.round(coverage + Math.min(seasons.size, 25) * 3 + Math.min(clubs.size, 25) * 2 + Math.min(playerCount, 40)) : 0;

    return {
      ...item,
      evidence: {
        answerPlayers: playerCount,
        answerRecords,
        seasons: seasons.size,
        clubs: clubs.size,
        nationalities: nationalities.size,
        knownRows,
        eligibleRows: rows.length,
        coverage,
        playable,
        survivor,
        difficulty,
        score
      }
    };
  }

  function readCriteria() {
    const get = (id, fallback) => {
      const value = Number(document.getElementById(id)?.value);
      return Number.isFinite(value) ? value : fallback;
    };
    const minPlayers = Math.max(1, Math.round(get("factoryMinPlayers", 2)));
    const maxPlayers = Math.max(minPlayers, Math.round(get("factoryMaxPlayers", 150)));
    state.criteria = {
      minPlayers,
      maxPlayers,
      minSeasons: Math.max(1, Math.round(get("factoryMinSeasons", 1))),
      minClubs: Math.max(1, Math.round(get("factoryMinClubs", 1))),
      minCoverage: Math.max(0, Math.min(100, get("factoryMinCoverage", 35)))
    };
    return { ...state.criteria };
  }

  async function runFamily(family, { renderProgress = true } = {}) {
    if (!state.rows.length) buildRows();
    const criteria = readCriteria();
    const { candidates, capped } = generateFamily(family);
    const evaluated = [];
    const batch = 100;

    for (let index = 0; index < candidates.length; index += batch) {
      if (state.cancelRequested) break;
      const end = Math.min(candidates.length, index + batch);
      for (let offset = index; offset < end; offset += 1) evaluated.push(evaluateCandidate(candidates[offset], criteria));
      if (renderProgress) {
        setStatus(`Testing ${FAMILY_DEFS.find(item => item.id === family)?.label || family}: ${end.toLocaleString("en-GB")} / ${candidates.length.toLocaleString("en-GB")}`);
        renderSummaryProgress(family, candidates.length, end);
      }
      await nextFrame();
    }

    const playable = evaluated.filter(item => item.evidence.playable);
    const survivors = evaluated.filter(item => item.evidence.survivor).sort((a, b) => b.evidence.score - a.evidence.score || a.evidence.answerPlayers - b.evidence.answerPlayers || a.label.localeCompare(b.label));
    const result = { family, generated: candidates.length, evaluated: evaluated.length, playable: playable.length, survivors: survivors.length, capped, candidates: evaluated, survivorCandidates: survivors, criteria, cancelled: state.cancelRequested };
    state.results.set(family, result);
    renderFamilyTable();
    if (state.selectedFamily === family) renderCandidatePreview();
    return result;
  }

  async function runSelected() {
    if (state.running) return;
    state.running = true;
    state.cancelRequested = false;
    updateRunButtons();
    try {
      await runFamily(state.selectedFamily);
      setStatus(state.cancelRequested ? "Run stopped." : "Selected family complete.");
    } catch (error) {
      console.error(error);
      setStatus(`Factory error: ${error.message || error}`);
    } finally {
      state.running = false;
      state.cancelRequested = false;
      updateRunButtons();
      renderFamilyTable();
      renderCandidatePreview();
    }
  }

  async function runAll() {
    if (state.running) return;
    state.running = true;
    state.cancelRequested = false;
    updateRunButtons();
    try {
      for (const family of FAMILY_DEFS) {
        if (state.cancelRequested) break;
        state.selectedFamily = family.id;
        const select = document.getElementById("promptFactoryFamily");
        if (select) select.value = family.id;
        setStatus(`Generating ${family.label}…`);
        await runFamily(family.id);
      }
      setStatus(state.cancelRequested ? "Run stopped." : "All families complete.");
    } catch (error) {
      console.error(error);
      setStatus(`Factory error: ${error.message || error}`);
    } finally {
      state.running = false;
      state.cancelRequested = false;
      updateRunButtons();
      renderFamilyTable();
      renderCandidatePreview();
    }
  }

  function stopRun() {
    if (!state.running) return;
    state.cancelRequested = true;
    setStatus("Stopping after the current batch…");
  }

  function clearResults() {
    if (state.running) return;
    state.results.clear();
    renderFamilyTable();
    renderCandidatePreview();
    setStatus("Factory results cleared. The canonical library is unchanged.");
  }

  function totals() {
    const results = [...state.results.values()];
    return {
      generated: results.reduce((sum, result) => sum + result.generated, 0),
      playable: results.reduce((sum, result) => sum + result.playable, 0),
      survivors: results.reduce((sum, result) => sum + result.survivors, 0),
      families: results.length
    };
  }

  function renderSummaryProgress() {
    const total = totals();
    const map = {
      promptFactoryGenerated: total.generated,
      promptFactoryPlayable: total.playable,
      promptFactorySurvivors: total.survivors,
      promptFactoryFamiliesRun: total.families
    };
    for (const [id, value] of Object.entries(map)) {
      const node = document.getElementById(id);
      if (node) node.textContent = Number(value).toLocaleString("en-GB");
    }
  }

  function familyRow(definition) {
    const result = state.results.get(definition.id);
    const status = !result ? "Not run" : result.cancelled ? "Stopped" : result.capped ? "Capped" : "Complete";
    return `<button class="prompt-factory-family-row${state.selectedFamily === definition.id ? " selected" : ""}" type="button" data-factory-family="${esc(definition.id)}">
      <span><strong>${esc(definition.label)}</strong><small>${esc(definition.description)}</small></span>
      <b>${result ? result.generated.toLocaleString("en-GB") : "—"}</b>
      <b>${result ? result.playable.toLocaleString("en-GB") : "—"}</b>
      <b>${result ? result.survivors.toLocaleString("en-GB") : "—"}</b>
      <em>${esc(status)}</em>
    </button>`;
  }

  function renderFamilyTable() {
    const list = document.getElementById("promptFactoryFamilyTable");
    if (!list) return;
    list.innerHTML = FAMILY_DEFS.map(familyRow).join("");
    list.querySelectorAll("[data-factory-family]").forEach(button => button.addEventListener("click", () => {
      state.selectedFamily = button.dataset.factoryFamily;
      const select = document.getElementById("promptFactoryFamily");
      if (select) select.value = state.selectedFamily;
      renderFamilyTable();
      renderCandidatePreview();
    }));
    renderSummaryProgress();
  }

  function candidateCard(item) {
    return `<article class="prompt-factory-candidate">
      <div>
        <h4>${esc(item.label)}</h4>
        <code>${esc(item.id)}</code>
        <div class="prompt-library-meta">
          <span class="prompt-library-chip">${esc(item.position)}</span>
          <span class="prompt-library-chip">${esc(item.family)}</span>
          <span class="prompt-library-chip">${esc(item.evidence.difficulty)}</span>
          <span class="prompt-library-chip">${item.evidence.coverage}% coverage</span>
        </div>
      </div>
      <dl>
        <div><dt>Players</dt><dd>${item.evidence.answerPlayers}</dd></div>
        <div><dt>Seasons</dt><dd>${item.evidence.seasons}</dd></div>
        <div><dt>Clubs</dt><dd>${item.evidence.clubs}</dd></div>
      </dl>
    </article>`;
  }

  function renderCandidatePreview() {
    const heading = document.getElementById("promptFactoryPreviewHeading");
    const summary = document.getElementById("promptFactoryPreviewSummary");
    const list = document.getElementById("promptFactoryCandidateList");
    if (!list) return;
    const definition = FAMILY_DEFS.find(item => item.id === state.selectedFamily);
    const result = state.results.get(state.selectedFamily);
    if (heading) heading.textContent = definition ? `${definition.label} survivors` : "Survivors";
    if (!result) {
      if (summary) summary.textContent = "Run this family to see candidate evidence.";
      list.innerHTML = `<div class="prompt-library-empty"><strong>No factory evidence yet</strong><span>The factory is deliberately separate from the canonical library. Generate a family to inspect its candidate space.</span></div>`;
      return;
    }
    if (summary) summary.textContent = `${result.generated.toLocaleString("en-GB")} generated · ${result.playable.toLocaleString("en-GB")} playable · ${result.survivors.toLocaleString("en-GB")} basic survivors${result.capped ? " · safety cap reached" : ""}`;
    const survivors = result.survivorCandidates.slice(0, 30);
    if (!survivors.length) {
      list.innerHTML = `<div class="prompt-library-empty"><strong>No candidates survived these floors</strong><span>Lower the permissive survivor floors or inspect a different family. Nothing has been deleted or published.</span></div>`;
      return;
    }
    list.innerHTML = survivors.map(candidateCard).join("");
  }

  function setStatus(message) {
    const node = document.getElementById("promptFactoryStatus");
    if (node) node.textContent = message;
  }

  function updateRunButtons() {
    const selected = document.getElementById("promptFactoryRunSelected");
    const all = document.getElementById("promptFactoryRunAll");
    const stop = document.getElementById("promptFactoryStop");
    if (selected) selected.disabled = state.running;
    if (all) all.disabled = state.running;
    if (stop) stop.disabled = !state.running;
  }

  function render() {
    const mount = document.getElementById("promptFactoryMount");
    if (!mount) return false;
    if (!state.rows.length) buildRows();
    const options = FAMILY_DEFS.map(item => `<option value="${esc(item.id)}"${item.id === state.selectedFamily ? " selected" : ""}>${esc(item.label)}</option>`).join("");
    mount.innerHTML = `<section class="prompt-factory" aria-labelledby="promptFactoryHeading">
      <div class="prompt-library-browser-head">
        <div>
          <p class="eyebrow">Prompt Factory · v1</p>
          <h3 id="promptFactoryHeading">Maximise useful prompts from every family</h3>
          <p>Explore the database aggressively, test every generated candidate, and keep a permissive survivor pool for later Quality Analysis. Nothing here publishes to the canonical library.</p>
        </div>
        <span class="phase-chip">${VERSION}</span>
      </div>

      <div class="prompt-factory-summary-grid">
        <div class="prompt-clean-status-card"><span>Generated</span><strong id="promptFactoryGenerated">0</strong></div>
        <div class="prompt-clean-status-card"><span>Playable</span><strong id="promptFactoryPlayable">0</strong></div>
        <div class="prompt-clean-status-card"><span>Basic survivors</span><strong id="promptFactorySurvivors">0</strong></div>
        <div class="prompt-clean-status-card"><span>Families run</span><strong id="promptFactoryFamiliesRun">0</strong></div>
      </div>

      <div class="prompt-factory-controls">
        <label>Family<select id="promptFactoryFamily">${options}</select></label>
        <label>Min players<input id="factoryMinPlayers" type="number" min="1" value="${state.criteria.minPlayers}"></label>
        <label>Max players<input id="factoryMaxPlayers" type="number" min="1" value="${state.criteria.maxPlayers}"></label>
        <label>Min seasons<input id="factoryMinSeasons" type="number" min="1" value="${state.criteria.minSeasons}"></label>
        <label>Min clubs<input id="factoryMinClubs" type="number" min="1" value="${state.criteria.minClubs}"></label>
        <label>Min coverage %<input id="factoryMinCoverage" type="number" min="0" max="100" step="1" value="${state.criteria.minCoverage}"></label>
      </div>

      <div class="prompt-factory-actions">
        <button id="promptFactoryRunSelected" class="button" type="button">Run selected family</button>
        <button id="promptFactoryRunAll" class="button" type="button">Run all families</button>
        <button id="promptFactoryStop" class="button secondary" type="button" disabled>Stop</button>
        <button id="promptFactoryClear" class="button secondary" type="button">Clear results</button>
        <span id="promptFactoryStatus">${state.rows.length.toLocaleString("en-GB")} positive-minute player-season rows ready.</span>
      </div>

      <div class="prompt-factory-family-head" aria-hidden="true"><span>Family</span><b>Generated</b><b>Playable</b><b>Survivors</b><em>Status</em></div>
      <div id="promptFactoryFamilyTable" class="prompt-factory-family-table"></div>

      <section class="prompt-factory-preview">
        <div class="prompt-library-browser-head">
          <div><p class="eyebrow">Candidate evidence</p><h3 id="promptFactoryPreviewHeading">Survivors</h3><p id="promptFactoryPreviewSummary">Run a family to see candidate evidence.</p></div>
        </div>
        <div id="promptFactoryCandidateList" class="prompt-factory-candidate-list"></div>
      </section>
    </section>`;

    document.getElementById("promptFactoryFamily")?.addEventListener("change", event => {
      state.selectedFamily = event.target.value;
      renderFamilyTable();
      renderCandidatePreview();
    });
    document.getElementById("promptFactoryRunSelected")?.addEventListener("click", runSelected);
    document.getElementById("promptFactoryRunAll")?.addEventListener("click", runAll);
    document.getElementById("promptFactoryStop")?.addEventListener("click", stopRun);
    document.getElementById("promptFactoryClear")?.addEventListener("click", clearResults);
    renderFamilyTable();
    renderCandidatePreview();
    updateRunButtons();
    return true;
  }

  function install() {
    render();
    window.addEventListener("fpl:prompt-studio-clean-rendered", render);
    window.addEventListener("fpl:prompt-studio-clean-ready", render);
    document.documentElement.dataset.promptFactory = "v1";
    window.dispatchEvent(new CustomEvent("fpl:prompt-factory-ready", { detail: { version: VERSION, families: FAMILY_DEFS.length } }));
  }

  window.FPL_PROMPT_FACTORY_V1 = Object.freeze({
    ready: true,
    version: VERSION,
    families: FAMILY_DEFS.map(item => ({ ...item })),
    getRows: () => state.rows.slice(),
    getResults: () => Object.fromEntries([...state.results.entries()].map(([key, value]) => [key, value])),
    generateFamily,
    evaluateCandidate: item => evaluateCandidate(item, state.criteria),
    runFamily,
    runAll,
    render
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
