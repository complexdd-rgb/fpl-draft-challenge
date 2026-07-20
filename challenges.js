/* Historical challenges. The current daily challenge is appended last. */
const BIG_SIX = new Set(["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"]);

window.FPL_CHALLENGES = [
  {
    id: "history-001",
    number: 1,
    title: "Historical Hard Mode",
    dateLabel: "FPL History Challenge",
    perfectScore: 2578,
    prompts: [
      {
        id: "gk_budget_150",
        position: "GK",
        label: "Goalkeeper who started at £5.0m or less and scored 150+ points",
        fail: "That season needs a starting price of £5.0m or less and at least 150 FPL points.",
        test: p => p.startingPrice <= 5 && p.points >= 150
      },
      {
        id: "def_assists_10",
        position: "DEF",
        label: "Defender with at least 10 assists",
        fail: "That season needs at least 10 assists.",
        test: p => p.assists >= 10
      },
      {
        id: "def_goals4_points180",
        position: "DEF",
        label: "Defender with at least 4 goals and 180+ points",
        fail: "That season needs at least 4 goals and 180 FPL points.",
        test: p => p.goals >= 4 && p.points >= 180
      },
      {
        id: "def_budget_bonus15",
        position: "DEF",
        label: "Defender who started at £5.0m or less and earned 15+ bonus points",
        fail: "That season needs a starting price of £5.0m or less and at least 15 bonus points.",
        test: p => p.startingPrice <= 5 && p.bonus >= 15
      },
      {
        id: "def_outside_big6_170",
        position: "DEF",
        label: "Defender outside the traditional Big Six with 170+ points",
        fail: "That season must be outside the traditional Big Six and score at least 170 FPL points.",
        test: p => !BIG_SIX.has(p.club) && p.points >= 170
      },
      {
        id: "mid_goals20",
        position: "MID",
        label: "Midfielder with at least 20 goals",
        fail: "That season needs at least 20 goals.",
        test: p => p.goals >= 20
      },
      {
        id: "mid_assists18",
        position: "MID",
        label: "Midfielder with at least 18 assists",
        fail: "That season needs at least 18 assists.",
        test: p => p.assists >= 18
      },
      {
        id: "mid_budget200",
        position: "MID",
        label: "Midfielder who started at £6.0m or less and scored 200+ points",
        fail: "That season needs a starting price of £6.0m or less and at least 200 FPL points.",
        test: p => p.startingPrice <= 6 && p.points >= 200
      },
      {
        id: "mid_outside_big6_200",
        position: "MID",
        label: "Midfielder outside the traditional Big Six with 200+ points",
        fail: "That season must be outside the traditional Big Six and score at least 200 FPL points.",
        test: p => !BIG_SIX.has(p.club) && p.points >= 200
      },
      {
        id: "fwd_goals30",
        position: "FWD",
        label: "Forward with at least 30 goals",
        fail: "That season needs at least 30 goals.",
        test: p => p.goals >= 30
      },
      {
        id: "fwd_gi35_outside",
        position: "FWD",
        label: "Forward outside the traditional Big Six with 35+ goal involvements",
        fail: "That season must be outside the traditional Big Six with at least 35 combined goals and assists.",
        test: p => !BIG_SIX.has(p.club) && (p.goals + p.assists) >= 35
      }
    ]
  },

  {
    id: "history-002",
    number: 4,
    title: "Daily Challenge #4 · Medium & Hard",
    dateLabel: "Manager & Club History Challenge",
    perfectScore: 2110,
    prompts: [
      {
        id: "gk_promoted_130",
        position: "GK",
        label: "Goalkeeper from a promoted club with 130+ points",
        fail: "That season must be for a promoted club and score at least 130 FPL points.",
        test: p => p.promoted === true && p.points >= 130
      },
      {
        id: "def_klopp_170",
        position: "DEF",
        label: "Defender managed by Jürgen Klopp with 170+ points",
        fail: "That season must be under Jürgen Klopp and score at least 170 FPL points.",
        test: p => Array.isArray(p.managers) && p.managers.includes("Jürgen Klopp") && p.points >= 170
      },
      {
        id: "def_bonus_20",
        position: "DEF",
        label: "Defender with at least 20 bonus points",
        fail: "That season needs at least 20 bonus points.",
        test: p => p.bonus >= 20
      },
      {
        id: "def_relegated_100",
        position: "DEF",
        label: "Defender from a relegated club with 100+ points",
        fail: "That season must be for a relegated club and score at least 100 FPL points.",
        test: p => p.relegated === true && p.points >= 100
      },
      {
        id: "def_champion_budget_55",
        position: "DEF",
        label: "Defender from a league-winning side who started at £5.5m or less",
        fail: "That season must be for the champions and have a starting price of £5.5m or less.",
        test: p => p.champions === true && p.startingPrice <= 5.5
      },
      {
        id: "mid_bottom_half_180",
        position: "MID",
        label: "Midfielder from a bottom-half club with 180+ points",
        fail: "That season must be for a bottom-half club and score at least 180 FPL points.",
        test: p => p.bottomHalf === true && p.points >= 180
      },
      {
        id: "mid_pep_200",
        position: "MID",
        label: "Midfielder managed by Pep Guardiola with 200+ points",
        fail: "That season must be under Pep Guardiola and score at least 200 FPL points.",
        test: p => Array.isArray(p.managers) && p.managers.includes("Pep Guardiola") && p.points >= 200
      },
      {
        id: "mid_promoted_150",
        position: "MID",
        label: "Midfielder from a promoted club with 150+ points",
        fail: "That season must be for a promoted club and score at least 150 FPL points.",
        test: p => p.promoted === true && p.points >= 150
      },
      {
        id: "mid_u23_180",
        position: "MID",
        label: "Midfielder aged 23 or under at the season start with 180+ points",
        fail: "That player must be aged 23 or under at the start of the season and score at least 180 FPL points.",
        test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 23 && p.points >= 180
      },
      {
        id: "fwd_howe_150",
        position: "FWD",
        label: "Forward managed by Eddie Howe with 150+ points",
        fail: "That season must be under Eddie Howe and score at least 150 FPL points.",
        test: p => Array.isArray(p.managers) && p.managers.includes("Eddie Howe") && p.points >= 150
      },
      {
        id: "fwd_relegated_120",
        position: "FWD",
        label: "Forward from a relegated club with 120+ points",
        fail: "That season must be for a relegated club and score at least 120 FPL points.",
        test: p => p.relegated === true && p.points >= 120
      }
    ]
  }

 ];
if (window.FPL_DAILY_CHALLENGE) {
  window.FPL_CHALLENGES = window.FPL_CHALLENGES.filter(
    item => item && item.id !== window.FPL_DAILY_CHALLENGE.id
  );
  window.FPL_CHALLENGES.push(window.FPL_DAILY_CHALLENGE);
}
