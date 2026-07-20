/* Edit this file to publish the daily challenge. */
window.FPL_DAILY_CHALLENGE = {
  id: "daily-006-underdog-xi",
  number: 6,
  title: "Daily Challenge #6 · The Underdog XI",
  dateLabel: "Anti-Meta · Medium / Hard",
  difficulty: "Medium / Hard",
  releaseDate: "2026-07-20",
  perfectScore: 1885,
  prompts: [
    {
      id: "gk_survival_saves",
      position: "GK",
      label: "Goalkeeper whose club finished 13th–17th with at least 100 saves",
      fail: "That goalkeeper's club must have finished 13th–17th and the season must include at least 100 saves.",
      test: p => Number.isFinite(p.leaguePosition) &&
                 p.leaguePosition >= 13 &&
                 p.leaguePosition <= 17 &&
                 p.saves >= 100
    },
    {
      id: "def_moyes_minutes",
      position: "DEF",
      label: "Defender managed by David Moyes who played at least 2,000 minutes",
      fail: "That defender season must have been managed by David Moyes and include at least 2,000 minutes.",
      test: p => Array.isArray(p.managers) &&
                 p.managers.includes("David Moyes") &&
                 p.minutes >= 2000
    },
    {
      id: "def_creator_outside_big_six",
      position: "DEF",
      label: "Defender outside the traditional Big Six with 5+ assists and more assists than goals",
      fail: "That defender must be outside the traditional Big Six, record at least 5 assists and have more assists than goals.",
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) &&
                 p.assists >= 5 &&
                 p.assists > p.goals
    },
    {
      id: "def_midtable_minutes",
      position: "DEF",
      label: "Defender from a club that finished 7th–12th who played at least 2,500 minutes",
      fail: "That defender's club must have finished 7th–12th and the season must include at least 2,500 minutes.",
      test: p => Number.isFinite(p.leaguePosition) &&
                 p.leaguePosition >= 7 &&
                 p.leaguePosition <= 12 &&
                 p.minutes >= 2500
    },
    {
      id: "def_budget_clean_sheets",
      position: "DEF",
      label: "Defender outside the traditional Big Six who started at £4.5m or less and kept 10+ clean sheets",
      fail: "That defender must be outside the traditional Big Six, start at £4.5m or less and record at least 10 clean sheets.",
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) &&
                 p.startingPrice <= 4.5 &&
                 p.cleanSheets >= 10
    },
    {
      id: "mid_relegated_involvements",
      position: "MID",
      label: "Midfielder from a relegated club with at least 5 goal involvements",
      fail: "That midfielder must play for a relegated club and record at least 5 combined goals and assists.",
      test: p => p.relegated === true &&
                 (p.goals + p.assists) >= 5
    },
    {
      id: "mid_creator_outside_big_six",
      position: "MID",
      label: "Midfielder outside the traditional Big Six with 8+ assists and more assists than goals",
      fail: "That midfielder must be outside the traditional Big Six, record at least 8 assists and have more assists than goals.",
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) &&
                 p.assists >= 8 &&
                 p.assists > p.goals
    },
    {
      id: "mid_midtable_exact_five",
      position: "MID",
      label: "Midfielder from a club that finished 8th–12th who scored exactly 5 goals",
      fail: "That midfielder's club must have finished 8th–12th and the player must have scored exactly 5 goals.",
      test: p => Number.isFinite(p.leaguePosition) &&
                 p.leaguePosition >= 8 &&
                 p.leaguePosition <= 12 &&
                 p.goals === 5
    },
    {
      id: "mid_budget_involvements",
      position: "MID",
      label: "Midfielder outside the traditional Big Six who started below £6.0m and had 8+ goal involvements",
      fail: "That midfielder must be outside the traditional Big Six, start below £6.0m and record at least 8 combined goals and assists.",
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) &&
                 p.startingPrice < 6.0 &&
                 (p.goals + p.assists) >= 8
    },
    {
      id: "fwd_promoted_goals",
      position: "FWD",
      label: "Forward from a promoted club who scored at least 10 goals",
      fail: "That forward must play for a promoted club and score at least 10 goals.",
      test: p => p.promoted === true &&
                 p.goals >= 10
    },
    {
      id: "fwd_exact_ten_outside_big_six",
      position: "FWD",
      label: "Forward outside the traditional Big Six who scored exactly 10 goals",
      fail: "That forward must be outside the traditional Big Six and score exactly 10 goals.",
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) &&
                 p.goals === 10
    }
  ]
};
