/* FPL Challenge Studio — approved prompt additions from the 14 Aug 2026 Studio export.
   Kept separate from runtime/bootstrap configuration until these five definitions are
   promoted into the canonical prompt library. Append only missing IDs. */
(() => {
  "use strict";
  if (!Array.isArray(window.FPL_PROMPT_LIBRARY)) return;

  const promptAdditions20260814 = [
    {
      id: "auto_fwd_teammate_matthew_lowton_points_100_excluding_christian_benteke",
      position: "FWD",
      label: "Forward who played in the same Premier League season as a teammate of Matthew Lowton and scored 100+ FPL points — excluding Christian Benteke",
      fail: "That forward must play for the same club in the same Premier League season as Matthew Lowton and score at least 100 FPL points in that season. Excluding Christian Benteke.",
      difficulty: "hard",
      tags: ["auto-generated","teammate","relationship","club-season","points","anti-meta","excludes-top"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
        kind: "source",
        source: "p => ((p => ((p => (p.playerId !== \"matthew-lowton\" && Number(p.minutes) > 0 && [\"2012/13|Aston Villa\",\"2013/14|Aston Villa\",\"2014/15|Aston Villa\",\"2016/17|Burnley\",\"2017/18|Burnley\",\"2018/19|Burnley\",\"2019/20|Burnley\",\"2020/21|Burnley\",\"2021/22|Burnley\"].includes(String(p.season || \"\") + \"|\" + String(p.club || \"\"))))(p) && Number(p.points) >= 100))(p) && ![\"christian-benteke\"].includes(p.playerId))"
      },
      test: p => ((p => ((p => (p.playerId !== "matthew-lowton" && Number(p.minutes) > 0 && ["2012/13|Aston Villa","2013/14|Aston Villa","2014/15|Aston Villa","2016/17|Burnley","2017/18|Burnley","2018/19|Burnley","2019/20|Burnley","2020/21|Burnley","2021/22|Burnley"].includes(String(p.season || "") + "|" + String(p.club || ""))))(p) && Number(p.points) >= 100))(p) && !["christian-benteke"].includes(p.playerId))
    },
    {
      id: "auto_def_season_2013_14_points_50_excluding_seamus_coleman",
      position: "DEF",
      label: "Defender with 50+ FPL points in the 2013/14 season — excluding Séamus Coleman",
      fail: "That defender must score at least 50 FPL points in the 2013/14 season. Excluding Séamus Coleman.",
      difficulty: "easy",
      tags: ["auto-generated","season-rule","season-exact","points","anti-meta","excludes-top"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
        kind: "source",
        source: "p => ((p => (String(p.season || \"\") === \"2013/14\" && (Number.isFinite(p.points) && p.points >= 50) && (Number.isFinite(p.minutes) && p.minutes > 0)))(p) && ![\"seamus-coleman\"].includes(p.playerId))"
      },
      test: p => ((p => (String(p.season || "") === "2013/14" && (Number.isFinite(p.points) && p.points >= 50) && (Number.isFinite(p.minutes) && p.minutes > 0)))(p) && !["seamus-coleman"].includes(p.playerId))
    },
    {
      id: "auto_gk_assist_points_50",
      position: "GK",
      label: "Goalkeeper with an assist and at least 50 FPL points",
      fail: "That goalkeeper season must include an assist and at least 50 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","assist","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
        kind: "builder",
        join: "all",
        conditions: [
          { field: "assists", operator: "gte", value: 1, value2: 0 },
          { field: "points", operator: "gte", value: 50, value2: 0 }
        ]
      },
      test: p => ((Number.isFinite(p.assists) && p.assists >= 1) && (Number.isFinite(p.points) && p.points >= 50))
    },
    {
      id: "auto_def_mark_hughes_minutes_2500",
      position: "DEF",
      label: "Defender managed by Mark Hughes who played 2,500+ minutes",
      fail: "That defender season must have been managed by Mark Hughes and include at least 2,500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
        kind: "builder",
        join: "all",
        conditions: [
          { field: "manager", operator: "equals", value: "Mark Hughes", value2: "" },
          { field: "minutes", operator: "gte", value: 2500, value2: 0 }
        ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Mark Hughes".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 2500))
    },
    {
      id: "auto_mid_first_g_points",
      position: "MID",
      label: "Midfielder whose first name starts with G and who scored at least 60 FPL points",
      fail: "That midfielder's first name must start with G and the season must score at least 60 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","name-rule","first-name","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
        kind: "builder",
        join: "all",
        conditions: [
          { field: "firstName", operator: "startsWith", value: "G", value2: "" },
          { field: "points", operator: "gte", value: 60, value2: 0 }
        ]
      },
      test: p => {
        const __rawName = String(p.name || p.playerName || "").trim();
        const __normaliseName = value => String(value || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/ø/g, "o").replace(/ł/g, "l").replace(/[đð]/g, "d")
          .replace(/þ/g, "th").replace(/æ/g, "ae").replace(/œ/g, "oe")
          .replace(/’/g, "'")
          .replace(/[^a-z0-9'\-]+/g, " ")
          .trim();
        const __fullName = __normaliseName(__rawName);
        const __nameTokens = __fullName.split(/\s+/).filter(Boolean);
        const __firstName = __nameTokens[0] || "";
        const __surnameParticles = new Set(["al", "ap", "bin", "bint", "da", "das", "de", "del", "della", "den", "der", "di", "dos", "du", "el", "la", "le", "van", "von", "y"]);
        let __surnameStart = Math.max(0, __nameTokens.length - 1);
        while (__surnameStart > 0 && __surnameParticles.has(__nameTokens[__surnameStart - 1])) __surnameStart -= 1;
        const __surname = __nameTokens.slice(__surnameStart).join(" ");
        const __firstInitial = __firstName.charAt(0);
        const __surnameInitial = __surname.charAt(0);
        const __letterCount = value => String(value || "").replace(/[^a-z0-9]/g, "").length;
        return (__firstName.startsWith("g") && (Number.isFinite(p.points) && p.points >= 60));
      }
    }
  ];

  const existingPromptIds = new Set(window.FPL_PROMPT_LIBRARY.map(prompt => String(prompt?.id || "")));
  for (const prompt of promptAdditions20260814) {
    if (!prompt?.id || existingPromptIds.has(prompt.id)) continue;
    prompt._studioBuiltIn = false;
    prompt._studioCustom = true;
    window.FPL_PROMPT_LIBRARY.push(prompt);
    existingPromptIds.add(prompt.id);
  }
})();
