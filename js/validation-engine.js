/* FPL Challenge Studio — Validation Lab shared engine. */
(() => {
  "use strict";

  const BIG_SIX = Object.freeze(["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"]);
  const POSITION_LABELS = Object.freeze({ GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" });
  const FIELD_LABELS = Object.freeze({
    points: "FPL points",
    minutes: "Minutes",
    goals: "Goals",
    assists: "Assists",
    goalInvolvements: "Goal involvements",
    cleanSheets: "Clean sheets",
    bonus: "Bonus points",
    saves: "Saves",
    goalsConceded: "Goals conceded",
    yellowCards: "Yellow cards",
    redCards: "Red cards",
    startingPrice: "Starting price",
    finalPrice: "Final price",
    leaguePosition: "League finish",
    ageAtSeasonStart: "Age at season start",
    season: "Season played",
    careerSeasonCount: "Recorded Premier League seasons",
    careerClubCount: "Recorded Premier League clubs",
    champions: "League champions",
    topFour: "Top-four club",
    bottomHalf: "Bottom-half club",
    relegated: "Relegated club",
    promoted: "Promoted club",
    outsideBigSix: "Outside traditional Big Six",
    assistsMoreThanGoals: "More assists than goals",
    club: "Club",
    manager: "Manager"
  });

  const promptParseCache = new Map();
  let clubNameCache = null;

  const STAT_ALIASES = Object.freeze([
    { field: "goalInvolvements", pattern: "goal involvements?|goals?\\s*\\+\\s*assists?" },
    { field: "goalsConceded", pattern: "goals? conceded" },
    { field: "cleanSheets", pattern: "clean sheets?" },
    { field: "yellowCards", pattern: "yellow cards?" },
    { field: "redCards", pattern: "red cards?" },
    { field: "startingPrice", pattern: "starting price|start(?:ed|ing)? at" },
    { field: "finalPrice", pattern: "final price|finished at" },
    { field: "leaguePosition", pattern: "league (?:position|finish)|club (?:finished|finishing|finish)" },
    { field: "ageAtSeasonStart", pattern: "age(?: at season start)?|aged" },
    { field: "points", pattern: "fpl points?|points?" },
    { field: "minutes", pattern: "minutes?" },
    { field: "goals", pattern: "goals?(?!\\s*(?:involvements?|\\+\\s*assists?))" },
    { field: "assists", pattern: "assists?" },
    { field: "bonus", pattern: "bonus(?: points?)?" },
    { field: "saves", pattern: "saves?" }
  ]);

  function getPlayers() {
    return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  }

  function getPromptLibrary() {
    const studioLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();
    if (Array.isArray(studioLibrary)) return studioLibrary;
    return Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
  }

  function normalise(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ø/g, "o")
      .replace(/ł/g, "l")
      .replace(/[đð]/g, "d")
      .replace(/þ/g, "th")
      .replace(/æ/g, "ae")
      .replace(/œ/g, "oe")
      .replace(/[–—−]/g, "-")
      .replace(/’/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function seasonSortValue(value) {
    const year = Number.parseInt(String(value || "").slice(0, 4), 10);
    return Number.isFinite(year) ? year : 0;
  }

  function hasNumericValue(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }

  function hasValidLeaguePosition(value) {
    return hasNumericValue(value) && Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 20;
  }

  function hasValidSeasonLabel(value) {
    return /^\d{4}\/\d{2}$/.test(String(value || ""));
  }

  function formatValue(field, value) {
    if (value === null || value === undefined || value === "") return "Missing";
    if (field === "startingPrice" || field === "finalPrice") return Number.isFinite(Number(value)) ? `£${Number(value).toFixed(1)}m` : String(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ") || "Missing";
    if (typeof value === "number") return value.toLocaleString("en-GB");
    return String(value);
  }

  function recordFor(player, season) {
    if (!player) return null;
    const seasonRecord = (player.seasons || []).find(item => item.season === season);
    if (!seasonRecord) return null;
    return {
      ...seasonRecord,
      playerId: player.playerId,
      playerName: player.name,
      dateOfBirth: player.bio?.dateOfBirth || "",
      regionId: player.bio?.regionId ?? null,
      aliases: Array.isArray(player.aliases) ? player.aliases.slice() : []
    };
  }

  function resolvePlayer(reference) {
    if (!reference) return null;
    if (typeof reference === "object" && reference.playerId) return reference;
    const wanted = normalise(reference);
    const wantedTokens = wanted.split(" ").filter(Boolean);
    const players = getPlayers();
    return players.find(player => player.playerId === reference)
      || players.find(player => normalise(player.name) === wanted)
      || players.find(player => (player.aliases || []).some(alias => normalise(alias) === wanted))
      || players.find(player => wantedTokens.length > 1 && wantedTokens.every(token => normalise(player.name).includes(token)))
      || null;
  }

  function searchPlayers(query, limit = 12) {
    const wanted = normalise(query);
    if (!wanted) return [];
    const wantedTokens = wanted.split(" ").filter(Boolean);
    return getPlayers()
      .map(player => {
        const name = normalise(player.name);
        const aliases = (player.aliases || []).map(normalise);
        let score = 99;
        if (name === wanted) score = 0;
        else if (name.startsWith(wanted)) score = 1;
        else if (wantedTokens.length > 1 && wantedTokens.every(token => name.includes(token))) score = 2;
        else if (name.split(" ").some(token => token.startsWith(wanted))) score = 3;
        else if (name.includes(wanted)) score = 4;
        else if (aliases.some(alias => alias.startsWith(wanted))) score = 5;
        return { player, score };
      })
      .filter(item => item.score < 99)
      .sort((a, b) => a.score - b.score || a.player.name.localeCompare(b.player.name))
      .slice(0, Math.max(1, limit))
      .map(item => item.player);
  }

  function getPlayerSeasons(reference) {
    const player = resolvePlayer(reference);
    if (!player) return [];
    return (player.seasons || []).slice().sort((a, b) => seasonSortValue(b.season) - seasonSortValue(a.season));
  }

  function getAllSeasonLabels() {
    return [...new Set(getPlayers().flatMap(player => (player.seasons || []).map(season => season.season)))]
      .sort((a, b) => seasonSortValue(b) - seasonSortValue(a));
  }

  function fieldValue(record, field) {
    if (field === "goalInvolvements") return Number(record.goals) + Number(record.assists);
    if (field === "outsideBigSix") return !BIG_SIX.includes(record.club);
    if (field === "assistsMoreThanGoals") return Number(record.assists) > Number(record.goals);
    if (field === "manager") return Array.isArray(record.managers) ? record.managers : [];
    if (field === "careerSeasonCount") return Number(record._career?.seasonCount);
    if (field === "careerClubCount") return Number(record._career?.clubCount);
    return record[field];
  }

  function dataChecks(record) {
    const checks = [
      check("Player name", Boolean(record.playerName), record.playerName || "Missing", "A player name is required for search and prompt reports."),
      check("Club", Boolean(record.club), record.club || "Missing", "Club-based rules need a stored club."),
      check("Season", hasValidSeasonLabel(record.season), record.season || "Missing", "Season relationship rules need a valid YYYY/YY season label."),
      check("Position", ["GK", "DEF", "MID", "FWD"].includes(record.position), record.position || "Missing", "The position must be GK, DEF, MID or FWD."),
      check("Minutes", hasNumericValue(record.minutes), formatValue("minutes", record.minutes), "Minutes must be numeric."),
      check("Answer eligibility", Number(record.minutes) > 0, `${formatValue("minutes", record.minutes)} minutes`, "A player-season needs at least one recorded minute to qualify as an answer."),
      check("Goals", hasNumericValue(record.goals), formatValue("goals", record.goals), "Goals must be numeric."),
      check("Assists", hasNumericValue(record.assists), formatValue("assists", record.assists), "Assists must be numeric."),
      check("FPL points", hasNumericValue(record.points), formatValue("points", record.points), "FPL points must be numeric."),
      check("Starting price", hasNumericValue(record.startingPrice), formatValue("startingPrice", record.startingPrice), "Starting-price rules cannot use a missing price."),
      check("Final price", hasNumericValue(record.finalPrice), formatValue("finalPrice", record.finalPrice), "Final-price rules cannot use a missing price."),
      check("League finish", hasValidLeaguePosition(record.leaguePosition), formatValue("leaguePosition", record.leaguePosition), "A final league position from 1 to 20 is required. Missing finishes never satisfy league-position rules."),
      check("Age", hasNumericValue(record.ageAtSeasonStart), formatValue("ageAtSeasonStart", record.ageAtSeasonStart), "Age-based prompts cannot use a missing seasonal age."),
      check("Date of birth", /^\d{4}-\d{2}-\d{2}$/.test(record.dateOfBirth || ""), record.dateOfBirth || "Missing", "A verified ISO date supports independent age checks."),
      check("Managers", Array.isArray(record.managers) && record.managers.length > 0, formatValue("manager", record.managers), "Manager prompts need at least one stored manager."),
      check("Career totals", Number.isInteger(record._career?.seasonCount) && Number.isInteger(record._career?.clubCount), record._career ? `${record._career.seasonCount} seasons · ${record._career.clubCount} clubs` : "Missing", "Career-total rules need runtime career context derived from positive-minute player-seasons.")
    ];
    return checks;
  }

  function inspectPlayer(reference, seasonLabel) {
    const player = resolvePlayer(reference);
    if (!player) return { ok: false, error: "Player not found." };
    const selectedSeason = seasonLabel || getPlayerSeasons(player)[0]?.season;
    const record = recordFor(player, selectedSeason);
    if (!record) return { ok: false, error: `${player.name} has no ${selectedSeason} record.` };
    const checks = dataChecks(record);
    const passed = checks.filter(item => item.passed).length;
    return {
      ok: true,
      player: { playerId: player.playerId, name: player.name, aliases: player.aliases || [], dateOfBirth: player.bio?.dateOfBirth || "", regionId: player.bio?.regionId ?? null },
      record,
      identity: {
        name: player.name,
        club: record.club,
        position: record.position,
        season: record.season,
        dateOfBirth: player.bio?.dateOfBirth || null,
        ageAtSeasonStart: record.ageAtSeasonStart,
        managers: record.managers || []
      },
      stats: {
        points: record.points,
        minutes: record.minutes,
        goals: record.goals,
        assists: record.assists,
        cleanSheets: record.cleanSheets,
        bonus: record.bonus,
        saves: record.saves,
        goalsConceded: record.goalsConceded,
        yellowCards: record.yellowCards,
        redCards: record.redCards
      },
      career: {
        seasonCount: record._career?.seasonCount ?? null,
        clubCount: record._career?.clubCount ?? null,
        seasons: Array.isArray(record._career?.seasons) ? record._career.seasons.slice() : [],
        clubs: Array.isArray(record._career?.clubs) ? record._career.clubs.slice() : []
      },
      database: {
        startingPrice: record.startingPrice,
        finalPrice: record.finalPrice,
        leaguePosition: record.leaguePosition,
        champions: record.champions,
        topFour: record.topFour,
        bottomHalf: record.bottomHalf,
        relegated: record.relegated,
        promoted: record.promoted
      },
      checks,
      health: {
        passed,
        total: checks.length,
        percentage: Math.round((passed / checks.length) * 100),
        eligible: Number(record.minutes) > 0
      }
    };
  }

  function check(label, passed, actual, explanation, expected = "") {
    return { label, passed: Boolean(passed), actual: String(actual ?? "Missing"), expected: String(expected || ""), explanation: String(explanation || "") };
  }

  function addRule(rules, rule) {
    const key = `${rule.field}:${rule.operator}:${String(rule.value)}:${String(rule.value2 ?? "")}`;
    if (!rules.some(existing => existing.key === key)) rules.push({ ...rule, key });
  }

  function numberFromToken(token) {
    const cleaned = String(token || "").replace(/,/g, "").trim().toLowerCase();
    if (cleaned !== "" && Number.isFinite(Number(cleaned))) return Number(cleaned);
    const words = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
      nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
      hundred: 100
    };
    if (Object.hasOwn(words, cleaned)) return words[cleaned];
    return NaN;
  }

  function positionFromText(text) {
    if (/\b(goalkeeper|gk)\b/.test(text)) return "GK";
    if (/\b(defender|def)\b/.test(text)) return "DEF";
    if (/\b(midfielder|mid)\b/.test(text)) return "MID";
    if (/\b(forward|striker|fwd)\b/.test(text)) return "FWD";
    return "";
  }

  function parsePromptText(text, positionHint = "") {
    const source = String(text || "").trim();
    const cacheKey = `${positionHint}::${source}`;
    if (promptParseCache.has(cacheKey)) return promptParseCache.get(cacheKey);
    const value = normalise(source);
    const rules = [];
    const position = positionHint || positionFromText(value);
    if (position) addRule(rules, { field: "position", operator: "equals", value: position, label: "Position", source: POSITION_LABELS[position] });

    if (/outside (?:the )?(?:traditional )?big six|non[- ]big six/.test(value)) {
      addRule(rules, { field: "outsideBigSix", operator: "isTrue", value: true, label: FIELD_LABELS.outsideBigSix, source: "outside the traditional Big Six" });
    }
    if (/more assists than goals|assists? (?:greater|higher) than goals?/.test(value)) {
      addRule(rules, { field: "assistsMoreThanGoals", operator: "isTrue", value: true, label: FIELD_LABELS.assistsMoreThanGoals, source: "more assists than goals" });
    }
    if (/\bchampions?\b|won the (?:premier )?league/.test(value)) addRule(rules, { field: "champions", operator: "isTrue", value: true, label: FIELD_LABELS.champions, source: "league champions" });
    if (/outside (?:the )?top[- ]?four|non[- ]top[- ]?four/.test(value)) {
      addRule(rules, { field: "topFour", operator: "isFalse", value: false, label: FIELD_LABELS.topFour, source: "outside the top four" });
    } else if (/top[- ]?four/.test(value)) {
      addRule(rules, { field: "topFour", operator: "isTrue", value: true, label: FIELD_LABELS.topFour, source: "top-four club" });
    }
    if (/bottom[- ]?half/.test(value)) addRule(rules, { field: "bottomHalf", operator: "isTrue", value: true, label: FIELD_LABELS.bottomHalf, source: "bottom-half club" });
    if (/\brelegated\b/.test(value)) addRule(rules, { field: "relegated", operator: "isTrue", value: true, label: FIELD_LABELS.relegated, source: "relegated club" });
    if (/\bpromoted\b/.test(value)) addRule(rules, { field: "promoted", operator: "isTrue", value: true, label: FIELD_LABELS.promoted, source: "promoted club" });

    const seasonRange = value.match(/\b(?:between|from)\s+(?:the\s+)?(\d{4}\/\d{2})(?:\s+season)?\s+(?:and|to|-)\s+(?:the\s+)?(\d{4}\/\d{2})(?:\s+seasons?)?\b/);
    const seasonBefore = value.match(/\b(?:before|prior to|earlier than)\s+(?:the\s+)?(\d{4}\/\d{2})(?:\s+season)?\b/);
    const seasonAfter = value.match(/\b(?:after|later than|since)\s+(?:the\s+)?(\d{4}\/\d{2})(?:\s+season)?\b/);
    const seasonExact = !seasonRange && !seasonBefore && !seasonAfter
      ? value.match(/\b(?:in|during|from)\s+(?:the\s+)?(\d{4}\/\d{2})(?:\s+season)?\b|\b(\d{4}\/\d{2})\s+season\b/)
      : null;
    if (seasonRange) addRule(rules, { field: "season", operator: "between", value: seasonRange[1], value2: seasonRange[2], label: FIELD_LABELS.season, source: seasonRange[0] });
    else if (seasonBefore) addRule(rules, { field: "season", operator: "before", value: seasonBefore[1], label: FIELD_LABELS.season, source: seasonBefore[0] });
    else if (seasonAfter) addRule(rules, { field: "season", operator: "after", value: seasonAfter[1], label: FIELD_LABELS.season, source: seasonAfter[0] });
    else if (seasonExact) addRule(rules, { field: "season", operator: "equals", value: seasonExact[1] || seasonExact[2], label: FIELD_LABELS.season, source: seasonExact[0] });

    const careerToken = "(?:\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)";
    const careerDefinitions = [
      { field: "careerSeasonCount", noun: "(?:recorded\\s+)?(?:premier league\\s+)?seasons?", label: FIELD_LABELS.careerSeasonCount },
      { field: "careerClubCount", noun: "(?:recorded\\s+)?(?:premier league\\s+)?clubs?", label: FIELD_LABELS.careerClubCount }
    ];
    for (const definition of careerDefinitions) {
      const patterns = [
        { operator: "between", regex: new RegExp(`between\\s+(${careerToken})\\s+(?:and|to|-)\\s+(${careerToken})\\s+${definition.noun}`, "i") },
        { operator: "eq", regex: new RegExp(`exactly\\s+(${careerToken})\\s+${definition.noun}`, "i") },
        { operator: "gte", regex: new RegExp(`at least\\s+(${careerToken})\\s+${definition.noun}`, "i") },
        { operator: "gte", regex: new RegExp(`(${careerToken})\\+\\s+${definition.noun}`, "i") },
        { operator: "lte", regex: new RegExp(`(?:at most|no more than|up to)\\s+(${careerToken})\\s+${definition.noun}`, "i") }
      ];
      for (const { operator, regex } of patterns) {
        const match = value.match(regex);
        if (!match) continue;
        const first = numberFromToken(match[1]);
        const second = numberFromToken(match[2]);
        if (Number.isFinite(first)) addRule(rules, { field: definition.field, operator, value: first, value2: Number.isFinite(second) ? second : undefined, label: definition.label, source: match[0] });
        break;
      }
    }

    const managerMatch = value.match(/managed by\s+([a-z][a-z .'-]{2,40}?)(?=\s+(?:who|with|and|from|for|at|under|over|scor|play)|$)/i);
    if (managerMatch) addRule(rules, { field: "manager", operator: "contains", value: managerMatch[1].trim(), label: FIELD_LABELS.manager, source: managerMatch[0] });

    if (!clubNameCache) {
      clubNameCache = [...new Set(getPlayers().flatMap(player => (player.seasons || []).map(season => season.club)).filter(Boolean))]
        .sort((a, b) => b.length - a.length);
    }
    const matchedClub = clubNameCache.find(club => value.includes(normalise(club)));
    if (matchedClub && !/outside (?:the )?(?:traditional )?big six/.test(value)) {
      addRule(rules, { field: "club", operator: "equals", value: matchedClub, label: FIELD_LABELS.club, source: matchedClub });
    }

    const rangePatterns = [
      /(?:club (?:finished|finishing|finish)|league (?:position|finish))(?:ed|ing)?(?: from| between| in)?\s*(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|to|and)\s*(\d{1,2})(?:st|nd|rd|th)?/g,
      /(?:finishing|finished|finish)(?:ed|ing)?\s*(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|to|and)\s*(\d{1,2})(?:st|nd|rd|th)?/g
    ];
    for (const pattern of rangePatterns) {
      for (const match of value.matchAll(pattern)) {
        addRule(rules, { field: "leaguePosition", operator: "between", value: Number(match[1]), value2: Number(match[2]), label: FIELD_LABELS.leaguePosition, source: match[0] });
      }
    }

    const token = "(?:\\d+(?:,\\d{3})*(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)";
    for (const definition of STAT_ALIASES) {
      const patterns = [
        { operator: "between", regex: new RegExp(`(?:${definition.pattern})\\s+(?:between\\s+)?(${token})\\s*(?:-|to|and)\\s*(${token})`, "gi") },
        { operator: "between", regex: new RegExp(`between\\s+(${token})\\s*(?:-|to|and)\\s*(${token})\\s+(?:${definition.pattern})`, "gi") },
        { operator: "eq", regex: new RegExp(`exactly\\s+(${token})\\s+(?:${definition.pattern})`, "gi") },
        { operator: "gte", regex: new RegExp(`at least\\s+(${token})\\s+(?:${definition.pattern})`, "gi") },
        { operator: "gte", regex: new RegExp(`(${token})\\+\\s*(?:${definition.pattern})`, "gi") },
        { operator: "lte", regex: new RegExp(`(?:at most|no more than|up to|under)\\s+£?(${token})m?\\s+(?:${definition.pattern})`, "gi") },
        { operator: "lte", regex: new RegExp(`(?:${definition.pattern})\\s+(?:of|at)?\\s*£?(${token})m?\\s+or less`, "gi") },
        { operator: "gte", regex: new RegExp(`(?:more than|over)\\s+(${token})\\s+(?:${definition.pattern})`, "gi") },
        { operator: "lte", regex: new RegExp(`(?:less than|fewer than)\\s+(${token})\\s+(?:${definition.pattern})`, "gi") }
      ];

      for (const { operator, regex } of patterns) {
        for (const match of value.matchAll(regex)) {
          const first = numberFromToken(match[1]);
          const second = numberFromToken(match[2]);
          if (!Number.isFinite(first)) continue;
          addRule(rules, {
            field: definition.field,
            operator,
            value: first,
            value2: Number.isFinite(second) ? second : undefined,
            label: FIELD_LABELS[definition.field],
            source: match[0]
          });
        }
      }
    }

    const directPrice = value.match(/start(?:ed|ing)? at\s*£?([\d.]+)m?\s+or less/);
    if (directPrice) addRule(rules, { field: "startingPrice", operator: "lte", value: Number(directPrice[1]), label: FIELD_LABELS.startingPrice, source: directPrice[0] });

    const parsed = { source, position, rules, recognised: rules.length > 0 };
    promptParseCache.set(cacheKey, parsed);
    return parsed;
  }

  function evaluateRule(record, rule) {
    if (rule.field === "position") {
      const passed = record.position === rule.value;
      return check(rule.label, passed, POSITION_LABELS[record.position] || record.position || "Missing", `Expected ${POSITION_LABELS[rule.value] || rule.value}.`, POSITION_LABELS[rule.value] || rule.value);
    }

    if (rule.field === "season") {
      const actualLabel = String(record.season || "");
      const actualYear = seasonSortValue(actualLabel);
      const firstLabel = String(rule.value || "");
      const secondLabel = String(rule.value2 || "");
      const firstYear = seasonSortValue(firstLabel);
      const secondYear = seasonSortValue(secondLabel);
      let passed = false;
      let expected = firstLabel || "Missing";
      if (!hasValidSeasonLabel(actualLabel) || !hasValidSeasonLabel(firstLabel)) {
        return check(rule.label || FIELD_LABELS.season, false, actualLabel || "Missing", "This rule needs valid season labels in YYYY/YY format.", expected);
      }
      if (rule.operator === "equals" || rule.operator === "eq") passed = actualLabel === firstLabel;
      else if (rule.operator === "before") { passed = actualYear < firstYear; expected = `Before ${firstLabel}`; }
      else if (rule.operator === "after") { passed = actualYear > firstYear; expected = `After ${firstLabel}`; }
      else if (rule.operator === "between") {
        if (!hasValidSeasonLabel(secondLabel)) return check(rule.label || FIELD_LABELS.season, false, actualLabel, "A between-season rule needs two valid season labels.", `${firstLabel}–${secondLabel || "Missing"}`);
        const low = Math.min(firstYear, secondYear);
        const high = Math.max(firstYear, secondYear);
        passed = actualYear >= low && actualYear <= high;
        expected = `${low === firstYear ? firstLabel : secondLabel}–${high === secondYear ? secondLabel : firstLabel}`;
      }
      return check(rule.label || FIELD_LABELS.season, passed, actualLabel, `Stored: ${actualLabel}. Expected: ${expected}.`, expected);
    }

    const leagueDependentFields = new Set(["leaguePosition", "champions", "topFour", "bottomHalf", "relegated"]);
    if (leagueDependentFields.has(rule.field) && !hasValidLeaguePosition(record.leaguePosition)) {
      return check(
        rule.label || FIELD_LABELS[rule.field] || rule.field,
        false,
        "Missing",
        "This rule needs a final league position from 1 to 20. Missing league finishes are never valid answers.",
        rule.operator === "between" ? `${rule.value}–${rule.value2}` : formatValue(rule.field, rule.value)
      );
    }

    const actual = fieldValue(record, rule.field);
    let passed = false;
    let expected = "";

    if (rule.operator === "between") {
      passed = hasNumericValue(actual) && Number(actual) >= Number(rule.value) && Number(actual) <= Number(rule.value2);
      expected = `${formatValue(rule.field, rule.value)}–${formatValue(rule.field, rule.value2)}`;
    } else if (rule.operator === "eq" || rule.operator === "equals") {
      if (typeof actual === "string") passed = normalise(actual) === normalise(rule.value);
      else passed = hasNumericValue(actual) ? Number(actual) === Number(rule.value) : actual === rule.value;
      expected = formatValue(rule.field, rule.value);
    } else if (rule.operator === "gte") {
      passed = hasNumericValue(actual) && Number(actual) >= Number(rule.value);
      expected = `At least ${formatValue(rule.field, rule.value)}`;
    } else if (rule.operator === "lte") {
      passed = hasNumericValue(actual) && Number(actual) <= Number(rule.value);
      expected = `At most ${formatValue(rule.field, rule.value)}`;
    } else if (rule.operator === "gt") {
      passed = hasNumericValue(actual) && Number(actual) > Number(rule.value);
      expected = `More than ${formatValue(rule.field, rule.value)}`;
    } else if (rule.operator === "lt") {
      passed = hasNumericValue(actual) && Number(actual) < Number(rule.value);
      expected = `Less than ${formatValue(rule.field, rule.value)}`;
    } else if (rule.operator === "isTrue") {
      passed = actual === true;
      expected = "Yes";
    } else if (rule.operator === "isFalse") {
      passed = actual === false;
      expected = "No";
    } else if (rule.operator === "contains") {
      passed = Array.isArray(actual)
        ? actual.some(item => normalise(item).includes(normalise(rule.value)))
        : normalise(actual).includes(normalise(rule.value));
      expected = String(rule.value);
    }

    const actualText = formatValue(rule.field, actual);
    return check(rule.label || FIELD_LABELS[rule.field] || rule.field, passed, actualText, `Stored: ${actualText}. Expected: ${expected}.`, expected);
  }

  function promptObject(input) {
    if (!input) return null;
    if (typeof input === "object" && typeof input.test === "function") return input;
    const text = String(input);
    return getPromptLibrary().find(prompt => prompt.id === text) || null;
  }

  function evaluatePrompt(reference, seasonLabel, input) {
    const player = resolvePlayer(reference);
    if (!player) return { ok: false, error: "Player not found." };
    const record = recordFor(player, seasonLabel);
    if (!record) return { ok: false, error: `${player.name} has no ${seasonLabel} record.` };

    const prompt = promptObject(input);
    const sourceText = prompt?.label || String(input || "");
    const parsed = parsePromptText(sourceText, prompt?.position || "");
    const checks = [];

    checks.push(check("Answer eligibility", Number(record.minutes) > 0, `${formatValue("minutes", record.minutes)} minutes`, "A player-season must have at least one recorded minute.", "At least 1 minute"));
    for (const rule of parsed.rules) checks.push(evaluateRule(record, rule));

    let nativePassed = null;
    if (prompt) {
      try {
        nativePassed = Number(record.minutes) > 0 && record.position === prompt.position && Boolean(prompt.test(record));
      } catch (error) {
        nativePassed = false;
        checks.push(check("Original prompt logic", false, "Error", error.message || "The stored prompt function threw an error.", "No error"));
      }
      if (!checks.some(item => item.label === "Position")) {
        checks.splice(1, 0, check("Position", record.position === prompt.position, POSITION_LABELS[record.position] || record.position, `Expected ${POSITION_LABELS[prompt.position] || prompt.position}.`, POSITION_LABELS[prompt.position] || prompt.position));
      }
      if (!checks.some(item => item.label === "Original prompt logic")) {
        checks.push(check("Original prompt logic", nativePassed, nativePassed ? "Matched" : "Did not match", prompt.fail || "The stored prompt test returned false.", "Matched"));
      }
    }

    const failed = checks.filter(item => !item.passed);
    const diagnosticPassed = checks
      .filter(item => item.label !== "Original prompt logic")
      .every(item => item.passed);
    const overallPassed = prompt ? nativePassed === true && diagnosticPassed : parsed.recognised && failed.length === 0;
    return {
      ok: true,
      player: { playerId: player.playerId, name: player.name },
      record,
      prompt: prompt ? { id: prompt.id, label: prompt.label, position: prompt.position, fail: prompt.fail } : { id: "manual", label: sourceText, position: parsed.position || "" },
      parsed,
      checks,
      passed: overallPassed,
      failed,
      warning: !prompt && !parsed.recognised ? "No supported rules were recognised in the manual prompt." : ""
    };
  }

  function explorePrompt(input, options = {}) {
    const prompt = promptObject(input);
    const source = prompt || String(input || "");
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
    const seasonFilter = options.season || "";
    const validByPlayer = new Map();
    const nearMisses = [];
    let checked = 0;

    for (const player of getPlayers()) {
      for (const season of player.seasons || []) {
        if (seasonFilter && season.season !== seasonFilter) continue;
        checked += 1;
        const result = evaluatePrompt(player, season.season, source);
        if (!result.ok) continue;
        if (result.passed) {
          const existing = validByPlayer.get(player.playerId);
          if (!existing || Number(result.record.points) > Number(existing.record.points)) validByPlayer.set(player.playerId, result);
        } else {
          const diagnosticFailures = result.checks.filter(item => !item.passed && item.label !== "Original prompt logic");
          if (diagnosticFailures.length === 1 && Number(result.record.minutes) > 0) nearMisses.push({ result, failedRule: diagnosticFailures[0] });
        }
      }
    }

    const valid = [...validByPlayer.values()]
      .sort((a, b) => Number(b.record.points) - Number(a.record.points) || a.player.name.localeCompare(b.player.name));
    nearMisses.sort((a, b) => Number(b.result.record.points) - Number(a.result.record.points));

    return {
      ok: true,
      prompt: prompt ? { id: prompt.id, label: prompt.label, position: prompt.position } : { id: "manual", label: String(input || "") },
      checked,
      validPlayerCount: valid.length,
      validSeasonCount: valid.reduce((count, item) => count + 1, 0),
      valid: valid.slice(0, limit),
      nearMisses: nearMisses.slice(0, limit)
    };
  }

  function seasonHealth(seasonLabel) {
    const rows = [];
    for (const player of getPlayers()) {
      const record = recordFor(player, seasonLabel);
      if (record) rows.push(record);
    }
    if (!rows.length) return { ok: false, error: `No ${seasonLabel} records were found.` };

    const missing = predicate => rows.filter(predicate).length;
    const summary = {
      players: rows.length,
      eligible: rows.filter(record => Number(record.minutes) > 0).length,
      zeroMinutes: rows.filter(record => Number(record.minutes) <= 0).length,
      missingDob: missing(record => !/^\d{4}-\d{2}-\d{2}$/.test(record.dateOfBirth || "")),
      missingAge: missing(record => !hasNumericValue(record.ageAtSeasonStart)),
      missingStartingPrice: missing(record => !hasNumericValue(record.startingPrice)),
      missingFinalPrice: missing(record => !hasNumericValue(record.finalPrice)),
      missingLeaguePosition: missing(record => !hasValidLeaguePosition(record.leaguePosition)),
      missingManagers: missing(record => !Array.isArray(record.managers) || record.managers.length === 0),
      invalidPosition: missing(record => !["GK", "DEF", "MID", "FWD"].includes(record.position)),
      invalidCoreStats: missing(record => ["points", "minutes", "goals", "assists"].some(field => !hasNumericValue(record[field])))
    };
    const blocking = summary.invalidPosition + summary.invalidCoreStats;
    const metadataGaps = summary.missingDob + summary.missingAge + summary.missingStartingPrice + summary.missingFinalPrice + summary.missingLeaguePosition + summary.missingManagers;
    const possibleMetadata = rows.length * 6;
    const completeness = Math.max(0, Math.round(((possibleMetadata - metadataGaps) / possibleMetadata) * 100));
    const status = blocking > 0 ? "Blocked" : completeness === 100 ? "Ready" : completeness >= 95 ? "Review" : "Incomplete";

    return { ok: true, season: seasonLabel, rows, summary, blocking, metadataGaps, completeness, status };
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function seasonFingerprint(seasonLabel, entries, prompts) {
    const recordSignature = entries
      .slice()
      .sort((a, b) => a.player.playerId.localeCompare(b.player.playerId))
      .map(({ player, record }) => [
        player.playerId,
        record.club,
        record.position,
        record.points,
        record.minutes,
        record.goals,
        record.assists,
        record.startingPrice,
        record.finalPrice,
        record.leaguePosition,
        record.ageAtSeasonStart,
        (record.managers || []).join("/"),
        record.champions,
        record.topFour,
        record.bottomHalf,
        record.relegated,
        record.promoted
      ].join("~"))
      .join("|");
    const promptSignature = prompts
      .map(prompt => `${prompt.id}~${prompt.position}~${prompt.label}~${String(prompt.test)}`)
      .join("|");
    return `${seasonLabel}-${hashText(`${recordSignature}::${promptSignature}`)}`;
  }

  function getSeasonFingerprint(seasonLabel) {
    const entries = [];
    for (const player of getPlayers()) {
      const record = recordFor(player, seasonLabel);
      if (record) entries.push({ player, record });
    }
    const prompts = getPromptLibrary().filter(prompt => prompt?.enabled !== false);
    return entries.length ? seasonFingerprint(seasonLabel, entries, prompts) : "";
  }

  function certificationTest(id, label, passed, actual, expected, details = [], severity = "critical") {
    return {
      id,
      label,
      passed: Boolean(passed),
      actual: String(actual ?? ""),
      expected: String(expected ?? ""),
      details: Array.isArray(details) ? details.slice(0, 25) : [],
      severity
    };
  }

  function certifySeason(seasonLabel) {
    const health = seasonHealth(seasonLabel);
    if (!health.ok) return health;

    const entries = [];
    for (const player of getPlayers()) {
      const record = recordFor(player, seasonLabel);
      if (record) entries.push({ player, record });
    }

    const prompts = getPromptLibrary().filter(prompt => prompt?.enabled !== false);
    const tests = [];
    const warnings = [];

    tests.push(certificationTest(
      "core-data",
      "Core player data",
      health.blocking === 0,
      `${health.blocking} blocking records`,
      "0 blocking records"
    ));
    tests.push(certificationTest(
      "metadata",
      "Required prompt metadata",
      health.metadataGaps === 0,
      `${health.metadataGaps} missing values`,
      "0 missing values"
    ));

    const clubPositions = new Map();
    for (const { record } of entries) {
      if (!clubPositions.has(record.club)) clubPositions.set(record.club, new Set());
      clubPositions.get(record.club).add(Number(record.leaguePosition));
    }
    const inconsistentClubs = [...clubPositions.entries()]
      .filter(([, positions]) => positions.size !== 1)
      .map(([club, positions]) => `${club}: ${[...positions].join(", ")}`);
    const uniqueLeaguePositions = [...new Set([...clubPositions.values()].flatMap(positions => [...positions]))]
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const expectedLeaguePositions = Array.from({ length: 20 }, (_, index) => index + 1);
    const completeLeagueTable = clubPositions.size === 20
      && inconsistentClubs.length === 0
      && uniqueLeaguePositions.length === 20
      && uniqueLeaguePositions.every((value, index) => value === expectedLeaguePositions[index]);
    tests.push(certificationTest(
      "league-table",
      "Complete 20-club league table",
      completeLeagueTable,
      `${clubPositions.size} clubs · positions ${uniqueLeaguePositions.join(", ") || "none"}`,
      "20 clubs with one unique finish each from 1 to 20",
      inconsistentClubs
    ));

    const flagErrors = [];
    for (const { player, record } of entries) {
      const position = Number(record.leaguePosition);
      const expected = {
        champions: position === 1,
        topFour: position >= 1 && position <= 4,
        bottomHalf: position >= 11 && position <= 20,
        relegated: position >= 18 && position <= 20
      };
      for (const [field, wanted] of Object.entries(expected)) {
        if (record[field] !== wanted) flagErrors.push(`${player.name}: ${field}=${record[field]} (expected ${wanted})`);
      }
    }
    tests.push(certificationTest(
      "league-flags",
      "League-finish flags",
      flagErrors.length === 0,
      `${flagErrors.length} inconsistencies`,
      "0 inconsistencies",
      flagErrors
    ));

    const eligibility = window.FPL_ANSWER_ELIGIBILITY?.qualifies || (record => Number(record?.minutes) > 0);
    const eligibilityErrors = entries
      .filter(({ record }) => Boolean(eligibility(record)) !== (Number(record.minutes) > 0))
      .map(({ player, record }) => `${player.name}: ${record.minutes} minutes`);
    tests.push(certificationTest(
      "eligibility-api",
      "Answer-eligibility rule",
      eligibilityErrors.length === 0,
      `${eligibilityErrors.length} inconsistencies`,
      "0 inconsistencies",
      eligibilityErrors
    ));

    const seasonRuleErrors = [];
    const orderedSeasons = getAllSeasonLabels().slice().sort((a, b) => seasonSortValue(a) - seasonSortValue(b));
    const seasonIndex = orderedSeasons.indexOf(seasonLabel);
    const previousSeason = seasonIndex > 0 ? orderedSeasons[seasonIndex - 1] : null;
    const nextSeason = seasonIndex >= 0 && seasonIndex < orderedSeasons.length - 1 ? orderedSeasons[seasonIndex + 1] : null;
    const oldestSeason = orderedSeasons[0] || seasonLabel;
    const newestSeason = orderedSeasons.at(-1) || seasonLabel;
    for (const { player, record } of entries) {
      if (Number(record.minutes) <= 0) continue;
      const positionLabel = POSITION_LABELS[record.position] || record.position;
      const scenarios = [
        { label: `${positionLabel} from the ${seasonLabel} season`, expected: true }
      ];
      if (previousSeason) scenarios.push({ label: `${positionLabel} after the ${previousSeason} season`, expected: true });
      if (nextSeason) scenarios.push({ label: `${positionLabel} before the ${nextSeason} season`, expected: true });
      scenarios.push({ label: `${positionLabel} between ${oldestSeason} and ${newestSeason} seasons`, expected: true });
      for (const scenario of scenarios) {
        const result = evaluatePrompt(player, seasonLabel, scenario.label);
        if (!result.ok || result.passed !== scenario.expected) {
          if (seasonRuleErrors.length < 25) seasonRuleErrors.push(`${player.name} · ${scenario.label} · ${result.ok ? "did not pass" : result.error}`);
        }
      }
    }
    tests.push(certificationTest(
      "season-relationship-rules",
      "Season relationship rules",
      seasonRuleErrors.length === 0,
      `${seasonRuleErrors.length} exact/before/after/between failures`,
      "0 failures",
      seasonRuleErrors
    ));

    const careerErrors = [];
    const careerContext = window.FPL_CAREER_CONTEXT;
    if (!careerContext?.players?.length) {
      careerErrors.push("Career context did not load.");
    } else {
      for (const player of getPlayers()) {
        const positive = (player.seasons || []).filter(record => Number(record.minutes) > 0);
        const expectedSeasons = new Set(positive.map(record => record.season).filter(Boolean)).size;
        const expectedClubs = new Set(positive.map(record => normalise(record.club)).filter(Boolean)).size;
        const summary = careerContext.getPlayer?.(player.playerId);
        if (!summary) {
          if (careerErrors.length < 25) careerErrors.push(`${player.name}: no career summary`);
          continue;
        }
        if (summary.seasonCount !== expectedSeasons || summary.clubCount !== expectedClubs) {
          if (careerErrors.length < 25) careerErrors.push(`${player.name}: ${summary.seasonCount}/${summary.clubCount}, expected ${expectedSeasons}/${expectedClubs}`);
        }
        for (const record of player.seasons || []) {
          if (record._career !== summary && careerErrors.length < 25) careerErrors.push(`${player.name} ${record.season}: career context not attached`);
        }
      }
    }
    tests.push(certificationTest(
      "career-totals",
      "Career season and club totals",
      careerErrors.length === 0,
      `${careerErrors.length} context or count failures`,
      "0 failures",
      careerErrors
    ));

    const duplicatePromptIds = [];
    const seenPromptIds = new Set();
    const invalidPrompts = [];
    for (const prompt of prompts) {
      if (seenPromptIds.has(prompt?.id)) duplicatePromptIds.push(prompt.id);
      seenPromptIds.add(prompt?.id);
      if (!prompt?.id || !prompt?.label || !["GK", "DEF", "MID", "FWD"].includes(prompt?.position) || typeof prompt?.test !== "function") {
        invalidPrompts.push(prompt?.id || prompt?.label || "Unnamed prompt");
      }
    }
    tests.push(certificationTest(
      "prompt-definitions",
      "Prompt definitions",
      duplicatePromptIds.length === 0 && invalidPrompts.length === 0,
      `${invalidPrompts.length} invalid · ${duplicatePromptIds.length} duplicate IDs`,
      "0 invalid prompts and 0 duplicate IDs",
      [...invalidPrompts.map(value => `Invalid: ${value}`), ...duplicatePromptIds.map(value => `Duplicate: ${value}`)]
    ));

    let evaluations = 0;
    let runtimeErrors = 0;
    let diagnosticMismatches = 0;
    let zeroMinuteAccepted = 0;
    const runtimeExamples = [];
    const mismatchExamples = [];
    const zeroMinuteExamples = [];
    const answerCounts = new Map(prompts.map(prompt => [prompt.id, 0]));

    for (const { player, record } of entries) {
      for (const prompt of prompts) {
        evaluations += 1;
        const result = evaluatePrompt(player, seasonLabel, prompt.id);
        if (!result.ok) {
          runtimeErrors += 1;
          if (runtimeExamples.length < 25) runtimeExamples.push(`${prompt.id} · ${player.name}: ${result.error}`);
          continue;
        }
        const originalCheck = result.checks.find(item => item.label === "Original prompt logic");
        if (originalCheck?.actual === "Error") {
          runtimeErrors += 1;
          if (runtimeExamples.length < 25) runtimeExamples.push(`${prompt.id} · ${player.name}: ${originalCheck.explanation}`);
        }
        const originalPassed = originalCheck?.passed === true;
        if (originalPassed !== result.passed) {
          diagnosticMismatches += 1;
          if (mismatchExamples.length < 25) {
            const failedRules = result.checks.filter(item => !item.passed && item.label !== "Original prompt logic").map(item => item.label).join(", ");
            mismatchExamples.push(`${prompt.id} · ${player.name}${failedRules ? ` · ${failedRules}` : ""}`);
          }
        }
        if (Number(record.minutes) <= 0 && result.passed) {
          zeroMinuteAccepted += 1;
          if (zeroMinuteExamples.length < 25) zeroMinuteExamples.push(`${prompt.id} · ${player.name}`);
        }
        if (result.passed) answerCounts.set(prompt.id, (answerCounts.get(prompt.id) || 0) + 1);
      }
    }

    tests.push(certificationTest(
      "prompt-runtime",
      "Prompt runtime",
      runtimeErrors === 0,
      `${runtimeErrors} errors across ${evaluations.toLocaleString("en-GB")} evaluations`,
      "0 runtime errors",
      runtimeExamples
    ));
    tests.push(certificationTest(
      "diagnostic-agreement",
      "Rule Tester and prompt-engine agreement",
      diagnosticMismatches === 0,
      `${diagnosticMismatches} disagreements`,
      "0 disagreements",
      mismatchExamples
    ));
    tests.push(certificationTest(
      "zero-minute-prompts",
      "Zero-minute answer exclusion",
      zeroMinuteAccepted === 0,
      `${zeroMinuteAccepted} accepted zero-minute answers`,
      "0 accepted zero-minute answers",
      zeroMinuteExamples
    ));

    const noAnswerPrompts = prompts
      .filter(prompt => (answerCounts.get(prompt.id) || 0) === 0)
      .map(prompt => `${prompt.id} · ${prompt.label}`);
    if (noAnswerPrompts.length) {
      warnings.push({
        id: "no-answer-prompts",
        label: "Prompts with no qualifying answer in this season",
        count: noAnswerPrompts.length,
        details: noAnswerPrompts.slice(0, 25)
      });
    }

    const criticalFailures = tests.filter(test => test.severity === "critical" && !test.passed);
    const status = criticalFailures.length === 0 ? "Certified" : "Failed";
    const certifiedAt = new Date().toISOString();
    const fingerprint = seasonFingerprint(seasonLabel, entries, prompts);

    return {
      ok: true,
      season: seasonLabel,
      status,
      certified: status === "Certified",
      certifiedAt,
      fingerprint,
      health,
      tests,
      warnings,
      criticalFailures: criticalFailures.length,
      promptSummary: {
        prompts: prompts.length,
        evaluations,
        runtimeErrors,
        diagnosticMismatches,
        zeroMinuteAccepted,
        noAnswerPrompts: noAnswerPrompts.length
      }
    };
  }

  function makeCertificationReport(result) {
    if (!result?.ok) return `FPL CHALLENGE STUDIO — SEASON CERTIFICATION\n\nERROR\n${result?.error || "Unknown error"}\n`;
    const lines = [
      "FPL CHALLENGE STUDIO — SEASON CERTIFICATION",
      "",
      `Season: ${result.season}`,
      `Status: ${result.status}`,
      `Certified at: ${result.certifiedAt}`,
      `Fingerprint: ${result.fingerprint}`,
      "",
      `Player records: ${result.health.summary.players}`,
      `Eligible answers: ${result.health.summary.eligible}`,
      `Zero-minute records: ${result.health.summary.zeroMinutes}`,
      `Enabled prompts: ${result.promptSummary.prompts}`,
      `Prompt evaluations: ${result.promptSummary.evaluations}`,
      "",
      "CERTIFICATION TESTS"
    ];
    for (const test of result.tests || []) {
      lines.push(`${test.passed ? "PASS" : "FAIL"} — ${test.label}`);
      lines.push(`Actual: ${test.actual}`);
      lines.push(`Expected: ${test.expected}`);
      for (const detail of test.details || []) lines.push(`  - ${detail}`);
      lines.push("");
    }
    for (const warning of result.warnings || []) {
      lines.push(`WARNING — ${warning.label}: ${warning.count}`);
      for (const detail of warning.details || []) lines.push(`  - ${detail}`);
      lines.push("");
    }
    return lines.join("\n").trim() + "\n";
  }

  function makeDebugReport(result) {
    if (!result?.ok) return `Validation Lab\n\nERROR\n${result?.error || "Unknown error"}`;
    const lines = [
      "FPL CHALLENGE STUDIO — VALIDATION LAB",
      "",
      `Prompt: ${result.prompt?.label || "Manual prompt"}`,
      `Player: ${result.player?.name || result.record?.playerName || "Unknown"}`,
      `Season: ${result.record?.season || "Unknown"}`,
      `Club: ${result.record?.club || "Unknown"}`,
      `Result: ${result.passed ? "PASS" : "FAIL"}`,
      ""
    ];
    for (const item of result.checks || []) {
      lines.push(`${item.passed ? "PASS" : "FAIL"} — ${item.label}`);
      lines.push(`Stored: ${item.actual}`);
      if (item.expected) lines.push(`Expected: ${item.expected}`);
      if (item.explanation) lines.push(item.explanation);
      lines.push("");
    }
    if (result.warning) lines.push(`Warning: ${result.warning}`);
    return lines.join("\n").trim() + "\n";
  }

  window.ValidationEngine = Object.freeze({
    BIG_SIX,
    POSITION_LABELS,
    FIELD_LABELS,
    getPlayers,
    getPromptLibrary,
    getAllSeasonLabels,
    searchPlayers,
    resolvePlayer,
    getPlayerSeasons,
    inspectPlayer,
    parsePromptText,
    evaluatePrompt,
    explorePrompt,
    seasonHealth,
    getSeasonFingerprint,
    certifySeason,
    makeCertificationReport,
    makeDebugReport,
    formatValue
  });
})();
