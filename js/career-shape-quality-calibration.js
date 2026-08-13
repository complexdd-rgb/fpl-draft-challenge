/* FPL Career Shape quality calibration · v1.0.0
   Tightens the eight new career-shape families against the same breadth ranges
   used by Prompt Quality Analyser, and applies conservative ratings/enabling. */
(() => {
  "use strict";

  const STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const NAMES = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const RANGES = {
    GK: { narrow: 5, idealLow: 8, idealHigh: 35, broad: 70 },
    DEF: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    MID: { narrow: 8, idealLow: 18, idealHigh: 90, broad: 165 },
    FWD: { narrow: 6, idealLow: 12, idealHigh: 60, broad: 110 }
  };
  const POINTS = {
    GK: [50, 80, 110, 130],
    DEF: [60, 90, 120, 150],
    MID: [70, 100, 130, 160],
    FWD: [60, 90, 120, 150]
  };
  const MINUTES = [1000, 1800, 2500];

  const players = () => Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const makeTest = source => {
    try { return Function(`"use strict"; return (${source});`)(); }
    catch (_) { return () => false; }
  };

  function count(position, test) {
    const ids = new Set();
    for (const player of players()) {
      for (const record of player.seasons || []) {
        if (Number(record.minutes) <= 0 || record.position !== position) continue;
        let passed = false;
        try { passed = Boolean(test(record)); } catch (_) {}
        if (passed) { ids.add(player.playerId); break; }
      }
    }
    return ids.size;
  }

  function difficulty(position, playerCount) {
    const range = RANGES[position] || RANGES.MID;
    if (playerCount <= Math.max(range.narrow + 4, 12)) return "hard";
    if (playerCount <= Math.max(range.idealLow + 17, 35)) return "medium";
    return "easy";
  }

  function rating(position, playerCount) {
    const range = RANGES[position] || RANGES.MID;
    if (playerCount >= range.idealLow && playerCount <= range.idealHigh) return 5;
    if (playerCount >= range.narrow && playerCount <= range.broad) return 3;
    return 2;
  }

  function baseDefinitions(position, key) {
    const noun = NAMES[position] || "Player";
    const role = LOWER[position] || "player";
    const fixed = {
      everChampion: [{
        expression: "p._careerShape?.everChampion === true",
        label: `${noun} who won the Premier League at some point in their recorded career`,
        fail: `That ${role} must have at least one recorded title-winning Premier League season.`
      }],
      everTopFour: [{
        expression: "p._careerShape?.everTopFour === true",
        label: `${noun} who played for a top-four club at some point in their recorded career`,
        fail: `That ${role} must have at least one recorded Premier League season for a top-four club.`
      }],
      neverBigSix: [{
        expression: "p._careerShape?.neverBigSix === true",
        label: `${noun} who never played for a traditional Big Six club in their recorded Premier League career`,
        fail: `That ${role} must have recorded Premier League minutes but none for Arsenal, Chelsea, Liverpool, Man City, Man Utd or Spurs.`
      }],
      championAndRelegated: [{
        expression: "p._careerShape?.everChampion === true && p._careerShape?.everRelegatedClub === true",
        label: `${noun} who won the Premier League and also played for a relegated club in their recorded career`,
        fail: `That ${role} must have both a recorded title-winning Premier League season and a recorded season for a relegated club.`
      }]
    };
    if (fixed[key]) return fixed[key];

    const values = key === "consecutiveSameClub4" ? [4, 5, 6]
      : key === "managerCount4" ? [4, 5, 6, 7]
        : key === "bigSixClubs2" ? [2, 3]
          : key === "managersInSeason2" ? [2, 3]
            : [];

    return values.map(value => {
      if (key === "consecutiveSameClub4") return {
        expression: `Number(p._careerShape?.maxConsecutiveSameClub) >= ${value}`,
        label: `${noun} with ${value}+ consecutive recorded Premier League seasons at the same club`,
        fail: `That ${role} must have at least ${value} consecutive positive-minute Premier League seasons at the same club.`
      };
      if (key === "managerCount4") return {
        expression: `Number(p._careerShape?.managerCount) >= ${value}`,
        label: `${noun} who played under ${value}+ different managers across their recorded Premier League career`,
        fail: `That ${role} must have recorded Premier League minutes under at least ${value} different stored managers.`
      };
      if (key === "bigSixClubs2") return {
        expression: `Number(p._careerShape?.bigSixClubCount) >= ${value}`,
        label: `${noun} who played for ${value}+ traditional Big Six clubs in their recorded Premier League career`,
        fail: `That ${role} must have recorded Premier League minutes for at least ${value} different traditional Big Six clubs.`
      };
      return {
        expression: `Number(p._careerShape?.maxManagersInSeason) >= ${value}`,
        label: `${noun} who had ${value}+ stored managers during a single recorded Premier League season`,
        fail: `That ${role} must have a recorded Premier League season containing at least ${value} different stored managers.`
      };
    });
  }

  function withQualifier(base, type, value) {
    if (type === "none") return { ...base, qualifier: "none", qualifierValue: 0 };
    if (type === "points") return {
      expression: `(${base.expression}) && Number.isFinite(Number(p.points)) && Number(p.points) >= ${value}`,
      label: `${base.label} and scored ${value}+ FPL points`,
      fail: `${base.fail} The qualifying season must also score at least ${value} FPL points.`,
      qualifier: type,
      qualifierValue: value
    };
    return {
      expression: `(${base.expression}) && Number.isFinite(Number(p.minutes)) && Number(p.minutes) >= ${value}`,
      label: `${base.label} and played ${value.toLocaleString("en-GB")}+ minutes`,
      fail: `${base.fail} The qualifying season must also include at least ${value.toLocaleString("en-GB")} minutes.`,
      qualifier: type,
      qualifierValue: value
    };
  }

  function candidateScore(position, playerCount, qualifier) {
    const range = RANGES[position] || RANGES.MID;
    const midpoint = (range.idealLow + range.idealHigh) / 2;
    const complexityPenalty = qualifier === "none" ? 0 : 2;
    if (playerCount >= range.idealLow && playerCount <= range.idealHigh) {
      return 120 - Math.abs(playerCount - midpoint) / Math.max(1, midpoint) * 20 - complexityPenalty;
    }
    if (playerCount >= range.narrow && playerCount < range.idealLow) {
      return 92 - (range.idealLow - playerCount) * 2 - complexityPenalty;
    }
    if (playerCount > range.idealHigh && playerCount <= range.broad) {
      return 88 - (playerCount - range.idealHigh) / Math.max(1, range.broad - range.idealHigh) * 25 - complexityPenalty;
    }
    if (playerCount >= 3 && playerCount < range.narrow) return 52 - (range.narrow - playerCount) * 3 - complexityPenalty;
    return 10 - Math.max(0, playerCount - range.broad) / Math.max(1, range.broad) * 20 - complexityPenalty;
  }

  function chooseVariant(position, key) {
    const variants = [];
    for (const base of baseDefinitions(position, key)) {
      variants.push(withQualifier(base, "none", 0));
      for (const value of POINTS[position] || []) variants.push(withQualifier(base, "points", value));
      for (const value of MINUTES) variants.push(withQualifier(base, "minutes", value));
    }
    let best = null;
    for (const variant of variants) {
      const test = makeTest(`p => (${variant.expression})`);
      const playerCount = count(position, test);
      if (playerCount < 3) continue;
      const score = candidateScore(position, playerCount, variant.qualifier);
      if (!best || score > best.score) best = { ...variant, test, playerCount, score };
    }
    return best;
  }

  function familyKey(prompt) {
    const match = String(prompt?.id || "").match(/^career_shape_(?:gk|def|mid|fwd)_(everChampion|everTopFour|consecutiveSameClub4|managerCount4|bigSixClubs2|neverBigSix|managersInSeason2|championAndRelegated)$/);
    return match ? match[1] : null;
  }

  function calibrateBasePrompt(prompt) {
    const key = familyKey(prompt);
    if (!key || !POSITIONS.includes(prompt.position)) return prompt;
    const chosen = chooseVariant(prompt.position, key);
    if (!chosen) return prompt;
    const range = RANGES[prompt.position] || RANGES.MID;
    prompt.label = chosen.label;
    prompt.fail = chosen.fail;
    prompt.test = chosen.test;
    prompt.difficulty = difficulty(prompt.position, chosen.playerCount);
    prompt.rating = rating(prompt.position, chosen.playerCount);
    prompt.enabled = chosen.playerCount >= range.narrow && chosen.playerCount <= range.broad;
    prompt.tags = [...new Set([...(prompt.tags || []), "career-shape-calibrated", chosen.qualifier !== "none" ? `quality-${chosen.qualifier}` : "quality-career-only"])];
    prompt._careerShapeAnswerCount = chosen.playerCount;
    prompt._careerShapeQualityScore = Math.round(chosen.score);
    prompt._careerShapeCalibration = Object.freeze({ qualifier: chosen.qualifier, value: chosen.qualifierValue, playerCount: chosen.playerCount });
    return prompt;
  }

  function calibrateLibrary(library) {
    if (!Array.isArray(library)) return library;
    library.forEach(calibrateBasePrompt);
    return library;
  }

  function compileStored(prompt) {
    const source = String(prompt?.testSource || prompt?.studioRule?.source || "").trim();
    if (!source) return null;
    try { return Function(`"use strict"; return (${source});`)(); }
    catch (_) { return null; }
  }

  function calibrateStoredCustoms() {
    let state;
    try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); }
    catch (_) { return; }
    if (!state || !Array.isArray(state.customs)) return;
    let changed = false;
    for (const prompt of state.customs) {
      const tags = Array.isArray(prompt.tags) ? prompt.tags : [];
      if (!String(prompt.id || "").startsWith("career_shape_") && !tags.includes("career-shape")) continue;
      if (!POSITIONS.includes(prompt.position)) continue;
      const test = compileStored(prompt);
      if (!test) continue;
      const playerCount = count(prompt.position, test);
      const range = RANGES[prompt.position] || RANGES.MID;
      const nextRating = rating(prompt.position, playerCount);
      const nextEnabled = prompt.enabled !== false && playerCount >= range.narrow && playerCount <= range.broad;
      const nextTags = [...new Set([...tags, "career-shape-calibrated"])];
      if (prompt.rating !== nextRating || prompt.enabled !== nextEnabled || nextTags.length !== tags.length) {
        prompt.rating = nextRating;
        prompt.enabled = nextEnabled;
        prompt.tags = nextTags;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function protectFutureAssignments() {
    const descriptor = Object.getOwnPropertyDescriptor(window, "FPL_PROMPT_LIBRARY");
    if (!descriptor || descriptor.configurable === false) return;
    const originalGet = descriptor.get;
    const originalSet = descriptor.set;
    let fallback = descriptor.value;
    try {
      Object.defineProperty(window, "FPL_PROMPT_LIBRARY", {
        configurable: true,
        enumerable: descriptor.enumerable !== false,
        get() {
          const value = originalGet ? originalGet.call(window) : fallback;
          return calibrateLibrary(value);
        },
        set(value) {
          if (originalSet) originalSet.call(window, value);
          else fallback = value;
          const current = originalGet ? originalGet.call(window) : fallback;
          calibrateLibrary(current);
        }
      });
    } catch (_) {}
  }

  function qualityGuardPreview() {
    if (!/\/admin(?:\.html)?$/i.test(location.pathname)) return;
    const install = () => {
      const preview = document.getElementById("promptFactoryPreview");
      if (!preview || preview.dataset.careerQualityGuard) return;
      preview.dataset.careerQualityGuard = "true";
      const inspect = () => {
        for (const card of preview.querySelectorAll(".career-shape-unified-card")) {
          if (card.dataset.qualityGuarded) continue;
          card.dataset.qualityGuarded = "true";
          const position = card.querySelector(".position-badge")?.textContent?.trim();
          const text = card.querySelector(".factory-prompt-meta")?.textContent || "";
          const match = text.match(/(\d+)\s+players/i);
          const input = card.querySelector("[data-career-unified-select]");
          if (!POSITIONS.includes(position) || !match || !input) continue;
          const playerCount = Number(match[1]);
          const range = RANGES[position];
          if (playerCount > range.broad || playerCount < Math.max(3, range.narrow)) {
            input.checked = false;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            card.dataset.qualityState = "review";
          } else if (playerCount >= range.idealLow && playerCount <= range.idealHigh) {
            card.dataset.qualityState = "preferred";
          } else {
            card.dataset.qualityState = "acceptable";
          }
        }
      };
      new MutationObserver(inspect).observe(preview, { childList: true, subtree: true });
      inspect();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
  }

  calibrateLibrary(window.FPL_PROMPT_LIBRARY);
  protectFutureAssignments();
  calibrateStoredCustoms();
  qualityGuardPreview();

  window.FPL_CAREER_SHAPE_CALIBRATION = Object.freeze({ version: "1.0.0", ranges: RANGES, calibrateLibrary, chooseVariant });
})();