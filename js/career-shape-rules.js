/* FPL Career Shape rule pack · v1.0.0
   Adds checked career-shape prompts and clarifies the Premier-League-only A→B→A return rule. */
(() => {
  "use strict";

  const VERSION = "1.0.0";
  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const NAMES = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const players = () => Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const RETURN_WORDING = "returned to a former Premier League club after playing for another Premier League club";

  const RULES = {
    everChampion: {
      title: "Won the Premier League in their recorded career",
      label: noun => `${noun} who won the Premier League at some point in their recorded career`,
      fail: role => `That ${role} must have at least one recorded Premier League season for the league champions.`,
      expression: "p._career?.everChampion === true"
    },
    everTopFour: {
      title: "Played for a top-four club in their recorded career",
      label: noun => `${noun} who played for a top-four club at some point in their recorded career`,
      fail: role => `That ${role} must have at least one recorded Premier League season for a club that finished in the top four.`,
      expression: "p._career?.everTopFour === true"
    },
    consecutiveSameClub4: {
      title: "4+ consecutive Premier League seasons at the same club",
      label: noun => `${noun} with 4+ consecutive recorded Premier League seasons at the same club`,
      fail: role => `That ${role} must have at least four consecutive positive-minute Premier League seasons at the same club.`,
      expression: "Number(p._career?.maxConsecutiveSameClub) >= 4"
    },
    managerCount4: {
      title: "Played under 4+ different Premier League managers",
      label: noun => `${noun} who played under 4+ different managers across their recorded Premier League career`,
      fail: role => `That ${role} must have recorded Premier League minutes under at least four different stored managers.`,
      expression: "Number(p._career?.managerCount) >= 4"
    },
    bigSixClubs2: {
      title: "Played for 2+ traditional Big Six clubs",
      label: noun => `${noun} who played for 2+ traditional Big Six clubs in their recorded Premier League career`,
      fail: role => `That ${role} must have recorded Premier League minutes for at least two different traditional Big Six clubs.`,
      expression: "Number(p._career?.bigSixClubCount) >= 2"
    },
    neverBigSix: {
      title: "Never played for a traditional Big Six club",
      label: noun => `${noun} who never played for a traditional Big Six club in their recorded Premier League career`,
      fail: role => `That ${role} must have recorded Premier League minutes but none for Arsenal, Chelsea, Liverpool, Man City, Man Utd or Spurs.`,
      expression: "p._career?.neverBigSix === true"
    },
    managersInSeason2: {
      title: "Had 2+ stored managers in one Premier League season",
      label: noun => `${noun} who had 2+ stored managers during a single recorded Premier League season`,
      fail: role => `That ${role} must have a recorded Premier League season containing at least two different stored managers.`,
      expression: "Number(p._career?.maxManagersInSeason) >= 2"
    },
    championAndRelegated: {
      title: "Won the league and also played for a relegated club",
      label: noun => `${noun} who won the Premier League and also played for a relegated club in their recorded career`,
      fail: role => `That ${role} must have at least one recorded title-winning Premier League season and at least one recorded season for a relegated club.`,
      expression: "p._career?.everChampion === true && p._career?.everRelegatedClub === true"
    }
  };

  function makeTest(expression) {
    try { return Function(`"use strict"; return (p => (${expression}));`)(); }
    catch (_) { return () => false; }
  }

  function normaliseReturnedPrompt(prompt) {
    if (!prompt || typeof prompt !== "object") return prompt;
    const tags = Array.isArray(prompt.tags) ? prompt.tags.map(value => String(value).toLowerCase()) : [];
    if (!/returned_to_former_club/i.test(String(prompt.id || "")) && !tags.includes("returned-club")) return prompt;
    if (!/after playing for another Premier League club/i.test(String(prompt.label || ""))) {
      prompt.label = String(prompt.label || "")
        .replace(/returned to a former Premier League club/gi, RETURN_WORDING)
        .replace(/returned to a former club/gi, RETURN_WORDING);
    }
    prompt.fail = `That ${LOWER[prompt.position] || "player"} must have Premier League minutes for Club A, then a different Premier League Club B, then Club A again in a later recorded Premier League season. A spell abroad does not count as Club B.`;
    if (!tags.includes("pl-a-b-a-return")) prompt.tags = [...(prompt.tags || []), "pl-a-b-a-return"];
    return prompt;
  }

  function validPlayerCount(prompt) {
    const ids = new Set();
    for (const player of players()) {
      for (const record of player.seasons || []) {
        if (Number(record.minutes) <= 0 || record.position !== prompt.position) continue;
        let passed = false;
        try { passed = Boolean(prompt.test(record)); } catch (_) {}
        if (passed) { ids.add(player.playerId); break; }
      }
    }
    return ids.size;
  }

  function buildPrompt(position, key) {
    const rule = RULES[key];
    const prompt = {
      id: `career_shape_${position.toLowerCase()}_${key}`,
      family: `${position}:career-shape:${key}`,
      position,
      label: rule.label(NAMES[position]),
      fail: rule.fail(LOWER[position]),
      difficulty: "medium",
      tags: ["career-shape", "career", "auto-generated", "checked", key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)],
      rating: 4,
      cooldown: 10,
      enabled: false,
      test: makeTest(rule.expression)
    };
    const count = validPlayerCount(prompt);
    if (count < 3) return null;
    prompt.enabled = count >= 6 && count <= 100;
    prompt.difficulty = count <= 12 ? "hard" : count <= 35 ? "medium" : "easy";
    prompt.rating = count <= 60 ? 5 : 4;
    prompt._careerShapeAnswerCount = count;
    return prompt;
  }

  function patchPush(library) {
    if (!Array.isArray(library) || library.__careerShapePushPatched) return;
    Object.defineProperty(library, "__careerShapePushPatched", { value: true, configurable: true });
    Object.defineProperty(library, "push", {
      configurable: true,
      writable: true,
      value: function (...items) {
        items.forEach(normaliseReturnedPrompt);
        return Array.prototype.push.apply(this, items);
      }
    });
  }

  function augmentLibrary(library) {
    if (!Array.isArray(library)) return library;
    library.forEach(normaliseReturnedPrompt);
    patchPush(library);
    const ids = new Set(library.map(prompt => String(prompt?.id || "")));
    for (const position of POSITIONS) {
      for (const key of Object.keys(RULES)) {
        const id = `career_shape_${position.toLowerCase()}_${key}`;
        if (ids.has(id)) continue;
        const prompt = buildPrompt(position, key);
        if (!prompt) continue;
        Array.prototype.push.call(library, prompt);
        ids.add(id);
      }
    }
    return library;
  }

  function installLibraryHook() {
    const descriptor = Object.getOwnPropertyDescriptor(window, "FPL_PROMPT_LIBRARY");
    let current = Array.isArray(window.FPL_PROMPT_LIBRARY) ? augmentLibrary(window.FPL_PROMPT_LIBRARY) : window.FPL_PROMPT_LIBRARY;
    if (descriptor && descriptor.configurable === false) return;
    try {
      Object.defineProperty(window, "FPL_PROMPT_LIBRARY", {
        configurable: true,
        enumerable: true,
        get() { return current; },
        set(value) { current = Array.isArray(value) ? augmentLibrary(value) : value; }
      });
    } catch (_) {
      if (Array.isArray(current)) augmentLibrary(current);
    }
  }

  function insertStudioSummary() {
    const factory = document.getElementById("automaticPromptFactory");
    if (!factory || document.getElementById("careerShapeRulePanel")) return;
    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];
    const prompts = library.filter(prompt => /^career_shape_/.test(String(prompt.id || "")));
    const enabled = prompts.filter(prompt => prompt.enabled !== false).length;
    const panel = document.createElement("details");
    panel.id = "careerShapeRulePanel";
    panel.className = "career-shape-rule-panel";
    panel.innerHTML = `<summary><span><small>Career Shape rules</small><strong>8 new career-rule families</strong></span><em>${enabled} enabled · ${prompts.length} checked</em></summary>
      <div><p>Only positive-minute Premier League records are used. A rule is created only with at least three distinct valid footballers; 6–100 answer rules are enabled automatically.</p>
      <div class="career-shape-grid">${Object.values(RULES).map(rule => `<span>${rule.title}</span>`).join("")}</div>
      <p class="career-return-note"><strong>Return wording:</strong> Club A → different Premier League Club B → Club A. Moving abroad and later returning to Club A does not qualify.</p></div>`;
    factory.before(panel);
    const help = document.querySelector("#factoryRelationshipMode")?.closest("label")?.querySelector("small");
    if (help) help.textContent = "Creates played-for-both-clubs, strict Premier League A→B→A returns, career-overlap and teammate prompts from positive-minute career records.";
  }

  function addStudioStyles() {
    if (document.getElementById("careerShapeStyles")) return;
    const style = document.createElement("style");
    style.id = "careerShapeStyles";
    style.textContent = `.career-shape-rule-panel{margin:12px 0;border:1px solid rgba(111,215,255,.15);border-radius:12px;background:rgba(111,215,255,.025);overflow:hidden}.career-shape-rule-panel summary{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;cursor:pointer}.career-shape-rule-panel summary span{display:grid;gap:2px}.career-shape-rule-panel summary small{color:#6fd7ff;font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.09em}.career-shape-rule-panel summary strong{font-size:.88rem}.career-shape-rule-panel summary em{color:#91aa9d;font-size:.65rem;font-style:normal}.career-shape-rule-panel>div{padding:0 12px 12px}.career-shape-rule-panel p{color:#91aa9d;font-size:.7rem;line-height:1.45}.career-shape-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.career-shape-grid span{padding:7px 8px;border:1px solid rgba(196,231,211,.09);border-radius:8px;background:rgba(255,255,255,.018);font-size:.66rem;line-height:1.35}.career-return-note{padding:8px;border:1px solid rgba(87,242,135,.12);border-radius:8px;background:rgba(87,242,135,.03)}@media(max-width:720px){.career-shape-grid{grid-template-columns:1fr 1fr}.career-shape-rule-panel summary{padding:10px}.career-shape-rule-panel>div{padding:0 10px 10px}}`;
    document.head.appendChild(style);
  }

  installLibraryHook();
  if (window.FPL_DAILY_CHALLENGE?.prompts) window.FPL_DAILY_CHALLENGE.prompts.forEach(normaliseReturnedPrompt);

  const ready = () => { addStudioStyles(); insertStudioSummary(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, { once: true });
  else ready();

  window.FPL_CAREER_SHAPE_RULES = Object.freeze({ version: VERSION, rules: RULES, returnWording: RETURN_WORDING, augmentLibrary });
})();
