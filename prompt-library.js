/* FPL Challenge Studio prompt library — Expanded Library v1 (180 tested prompts). */
(() => {
  "use strict";

  const makePrompt = (id, position, label, fail, difficulty, tags, rating, test) => ({
    id,
    position,
    label,
    fail,
    difficulty,
    tags,
    rating,
    cooldown: 7,
    enabled: true,
    test
  });

  window.FPL_PROMPT_LIBRARY = [
    // Goalkeepers
    makePrompt(
      "gk_relegated_100_saves", "GK",
      "Goalkeeper from a relegated club with at least 100 saves",
      "That goalkeeper season must be for a relegated club and include at least 100 saves.",
      "medium", ["relegated", "saves", "anti-meta"], 5,
      p => p.relegated === true && p.saves >= 100
    ),
    makePrompt(
      "gk_survival_saves", "GK",
      "Goalkeeper whose club finished 13th–17th with at least 100 saves",
      "That goalkeeper's club must have finished 13th–17th and the season must include at least 100 saves.",
      "medium", ["survival", "saves", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.saves >= 100
    ),
    makePrompt(
      "gk_promoted_90_points", "GK",
      "Goalkeeper from a promoted club with at least 90 FPL points",
      "That goalkeeper must play for a promoted club and score at least 90 FPL points.",
      "medium", ["promoted", "points", "anti-meta"], 4,
      p => p.promoted === true && p.points >= 90
    ),
    makePrompt(
      "gk_bottom_half_10_bonus", "GK",
      "Goalkeeper from a bottom-half club with at least 10 bonus points",
      "That goalkeeper's club must finish in the bottom half and the season must include at least 10 bonus points.",
      "medium", ["bottom-half", "bonus", "anti-meta"], 4,
      p => p.bottomHalf === true && p.bonus >= 10
    ),
    makePrompt(
      "gk_budget_100_points", "GK",
      "Goalkeeper who started at £4.5m or less and scored 100+ points",
      "That goalkeeper must start at £4.5m or less and score at least 100 FPL points.",
      "easy", ["budget", "points"], 4,
      p => p.startingPrice <= 4.5 && p.points >= 100
    ),
    makePrompt(
      "gk_non_top_four_10_cs", "GK",
      "Goalkeeper outside the top four with at least 10 clean sheets",
      "That goalkeeper's club must finish outside the top four and record at least 10 clean sheets.",
      "medium", ["outside-top-four", "clean-sheets", "anti-meta"], 4,
      p => p.topFour !== true && p.cleanSheets >= 10
    ),
    makePrompt(
      "gk_120_saves_under_5", "GK",
      "Goalkeeper with 120+ saves who started below £5.0m",
      "That goalkeeper season must include at least 120 saves and a starting price below £5.0m.",
      "medium", ["saves", "budget", "anti-meta"], 5,
      p => p.saves >= 120 && p.startingPrice < 5
    ),
    makePrompt(
      "gk_age_25_under_100", "GK",
      "Goalkeeper aged 25 or under with at least 100 FPL points",
      "That goalkeeper must be aged 25 or under at the season start and score at least 100 FPL points.",
      "hard", ["young", "points"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 25 && p.points >= 100
    ),
    makePrompt(
      "gk_sean_dyche_100_saves", "GK",
      "Goalkeeper managed by Sean Dyche",
      "That goalkeeper season must be managed by Sean Dyche.",
      "medium", ["manager", "Sean Dyche", "anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Sean Dyche")
    ),
    makePrompt(
      "gk_midtable_10_cs", "GK",
      "Goalkeeper from a club finishing 7th–12th with 10+ clean sheets",
      "That goalkeeper's club must finish 7th–12th and record at least 10 clean sheets.",
      "medium", ["mid-table", "clean-sheets", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.cleanSheets >= 10
    ),
    makePrompt(
      "gk_5_clean_120_saves", "GK",
      "Goalkeeper with 5+ clean sheets and at least 120 saves",
      "That goalkeeper season must include at least five clean sheets and 120 saves.",
      "medium", ["saves", "clean-sheets", "anti-meta"], 4,
      p => p.cleanSheets >= 5 && p.saves >= 120
    ),
    makePrompt(
      "gk_exact_10_cs_outside_big_six", "GK",
      "Goalkeeper outside the traditional Big Six with exactly 10 clean sheets",
      "That goalkeeper must play outside the traditional Big Six and record exactly 10 clean sheets.",
      "hard", ["outside-big-six", "exact-stat", "clean-sheets", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.cleanSheets === 10
    ),

    // Defenders
    makePrompt(
      "def_moyes_minutes", "DEF",
      "Defender managed by David Moyes who played at least 2,000 minutes",
      "That defender season must be managed by David Moyes and include at least 2,000 minutes.",
      "medium", ["manager", "David Moyes", "minutes", "anti-meta"], 5,
      p => Array.isArray(p.managers) && p.managers.includes("David Moyes") && p.minutes >= 2000
    ),
    makePrompt(
      "def_creator_outside_big_six", "DEF",
      "Defender outside the traditional Big Six with 5+ assists and more assists than goals",
      "That defender must be outside the traditional Big Six, record at least five assists and have more assists than goals.",
      "medium", ["outside-big-six", "assists", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.assists >= 5 && p.assists > p.goals
    ),
    makePrompt(
      "def_midtable_minutes", "DEF",
      "Defender from a club finishing 7th–12th who played at least 2,500 minutes",
      "That defender's club must finish 7th–12th and the season must include at least 2,500 minutes.",
      "medium", ["mid-table", "minutes", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.minutes >= 2500
    ),
    makePrompt(
      "def_budget_clean_sheets", "DEF",
      "Defender outside the traditional Big Six who started at £4.5m or less and kept 10+ clean sheets",
      "That defender must be outside the traditional Big Six, start at £4.5m or less and record at least 10 clean sheets.",
      "hard", ["outside-big-six", "budget", "clean-sheets", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.startingPrice <= 4.5 && p.cleanSheets >= 10
    ),
    makePrompt(
      "def_promoted_80_points", "DEF",
      "Defender from a promoted club with at least 80 FPL points",
      "That defender must play for a promoted club and score at least 80 FPL points.",
      "easy", ["promoted", "points", "anti-meta"], 4,
      p => p.promoted === true && p.points >= 80
    ),
    makePrompt(
      "def_relegated_3_assists", "DEF",
      "Defender from a relegated club with at least three assists",
      "That defender must play for a relegated club and record at least three assists.",
      "hard", ["relegated", "assists", "anti-meta"], 5,
      p => p.relegated === true && p.assists >= 3
    ),
    makePrompt(
      "def_bottom_half_100_points", "DEF",
      "Defender from a bottom-half club with at least 100 FPL points",
      "That defender's club must finish in the bottom half and the season must score at least 100 FPL points.",
      "medium", ["bottom-half", "points", "anti-meta"], 4,
      p => p.bottomHalf === true && p.points >= 100
    ),
    makePrompt(
      "def_non_big_six_10_cs", "DEF",
      "Defender outside the traditional Big Six with at least 10 clean sheets",
      "That defender must play outside the traditional Big Six and record at least 10 clean sheets.",
      "easy", ["outside-big-six", "clean-sheets", "anti-meta"], 4,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.cleanSheets >= 10
    ),
    makePrompt(
      "def_age_u23_2000", "DEF",
      "Defender aged 23 or under who played at least 2,000 minutes",
      "That defender must be aged 23 or under at the season start and play at least 2,000 minutes.",
      "medium", ["young", "minutes"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 23 && p.minutes >= 2000
    ),
    makePrompt(
      "def_exact_3_goals_midtable", "DEF",
      "Defender from a club finishing 7th–12th who scored exactly three goals",
      "That defender's club must finish 7th–12th and the player must score exactly three goals.",
      "hard", ["mid-table", "exact-stat", "goals", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.goals === 3
    ),
    makePrompt(
      "def_assists_gt_goals_5", "DEF",
      "Defender with 5+ assists and more assists than goals",
      "That defender season must record at least five assists and more assists than goals.",
      "easy", ["assists"], 4,
      p => p.assists >= 5 && p.assists > p.goals
    ),
    makePrompt(
      "def_budget_2500_minutes", "DEF",
      "Defender who started at £4.5m or less and played at least 3,000 minutes",
      "That defender must start at £4.5m or less and play at least 3,000 minutes.",
      "easy", ["budget", "minutes"], 4,
      p => p.startingPrice <= 4.5 && p.minutes >= 3000
    ),
    makePrompt(
      "def_sean_dyche_2500", "DEF",
      "Defender managed by Sean Dyche who played at least 2,500 minutes",
      "That defender season must be managed by Sean Dyche and include at least 2,500 minutes.",
      "hard", ["manager", "Sean Dyche", "minutes", "anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Sean Dyche") && p.minutes >= 2500
    ),
    makePrompt(
      "def_pep_under_5m", "DEF",
      "Defender managed by Pep Guardiola who started below £5.0m",
      "That defender season must be managed by Pep Guardiola and have a starting price below £5.0m.",
      "hard", ["manager", "Pep Guardiola", "budget"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Pep Guardiola") && p.startingPrice < 5
    ),
    makePrompt(
      "def_top_four_zero_goals_10cs", "DEF",
      "Defender from a top-four club with 10+ clean sheets and no goals",
      "That defender's club must finish in the top four, record at least 10 clean sheets and the player must score no goals.",
      "hard", ["top-four", "clean-sheets", "zero-goals"], 4,
      p => p.topFour === true && p.goals === 0 && p.cleanSheets >= 10
    ),
    makePrompt(
      "def_7_12_5assists", "DEF",
      "Defender from a club finishing 7th–12th with at least five assists",
      "That defender's club must finish 7th–12th and the player must record at least five assists.",
      "hard", ["mid-table", "assists", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.assists >= 5
    ),
    makePrompt(
      "def_13_17_2500", "DEF",
      "Defender from a club finishing 13th–17th who played at least 2,500 minutes",
      "That defender's club must finish 13th–17th and the season must include at least 2,500 minutes.",
      "medium", ["survival", "minutes", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.minutes >= 2500
    ),
    makePrompt(
      "def_8_bonus_bottomhalf", "DEF",
      "Defender from a bottom-half club with at least eight bonus points",
      "That defender's club must finish in the bottom half and the season must include at least eight bonus points.",
      "medium", ["bottom-half", "bonus", "anti-meta"], 4,
      p => p.bottomHalf === true && p.bonus >= 8
    ),
    makePrompt(
      "def_yellow_8_100points", "DEF",
      "Defender with eight or more yellow cards and at least 100 FPL points",
      "That defender season must include at least eight yellow cards and 100 FPL points.",
      "hard", ["cards", "points", "anti-meta"], 4,
      p => p.yellowCards >= 8 && p.points >= 100
    ),
    makePrompt(
      "def_promoted_2500", "DEF",
      "Defender from a promoted club who played at least 2,500 minutes",
      "That defender must play for a promoted club and complete at least 2,500 minutes.",
      "medium", ["promoted", "minutes", "anti-meta"], 5,
      p => p.promoted === true && p.minutes >= 2500
    ),

    // Midfielders
    makePrompt(
      "mid_relegated_involvements", "MID",
      "Midfielder from a relegated club with at least five goal involvements",
      "That midfielder must play for a relegated club and record at least five combined goals and assists.",
      "medium", ["relegated", "goal-involvements", "anti-meta"], 5,
      p => p.relegated === true && (p.goals + p.assists) >= 5
    ),
    makePrompt(
      "mid_creator_outside_big_six", "MID",
      "Midfielder outside the traditional Big Six with 8+ assists and more assists than goals",
      "That midfielder must be outside the traditional Big Six, record at least eight assists and have more assists than goals.",
      "hard", ["outside-big-six", "assists", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.assists >= 8 && p.assists > p.goals
    ),
    makePrompt(
      "mid_midtable_exact_five", "MID",
      "Midfielder from a club finishing 8th–12th who scored exactly five goals",
      "That midfielder's club must finish 8th–12th and the player must score exactly five goals.",
      "hard", ["mid-table", "exact-stat", "goals", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 8 && p.leaguePosition <= 12 && p.goals === 5
    ),
    makePrompt(
      "mid_budget_involvements", "MID",
      "Midfielder outside the traditional Big Six who started below £6.0m and had 10+ goal involvements",
      "That midfielder must be outside the traditional Big Six, start below £6.0m and record at least 10 combined goals and assists.",
      "medium", ["outside-big-six", "budget", "goal-involvements", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.startingPrice < 6 && (p.goals + p.assists) >= 10
    ),
    makePrompt(
      "mid_more_assists_than_goals_100", "MID",
      "Midfielder with more assists than goals and at least 120 FPL points",
      "That midfielder season must have more assists than goals and score at least 120 FPL points.",
      "medium", ["assists", "points"], 4,
      p => p.assists > p.goals && p.points >= 120
    ),
    makePrompt(
      "mid_promoted_8_involvements", "MID",
      "Midfielder from a promoted club with at least eight goal involvements",
      "That midfielder must play for a promoted club and record at least eight combined goals and assists.",
      "medium", ["promoted", "goal-involvements", "anti-meta"], 5,
      p => p.promoted === true && (p.goals + p.assists) >= 8
    ),
    makePrompt(
      "mid_bottomhalf_10_goals", "MID",
      "Midfielder from a bottom-half club with at least 10 goals",
      "That midfielder's club must finish in the bottom half and the player must score at least 10 goals.",
      "hard", ["bottom-half", "goals", "anti-meta"], 5,
      p => p.bottomHalf === true && p.goals >= 10
    ),
    makePrompt(
      "mid_non_big_six_10assists", "MID",
      "Midfielder outside the traditional Big Six with at least 10 assists",
      "That midfielder must play outside the traditional Big Six and record at least 10 assists.",
      "hard", ["outside-big-six", "assists", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.assists >= 10
    ),
    makePrompt(
      "mid_age_u23_2000", "MID",
      "Midfielder aged 23 or under who played at least 2,000 minutes",
      "That midfielder must be aged 23 or under at the season start and play at least 2,000 minutes.",
      "medium", ["young", "minutes"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 23 && p.minutes >= 2000
    ),
    makePrompt(
      "mid_exact_7_goals_7_12", "MID",
      "Midfielder from a club finishing 7th–12th who scored exactly seven goals",
      "That midfielder's club must finish 7th–12th and the player must score exactly seven goals.",
      "hard", ["mid-table", "exact-stat", "goals", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.goals === 7
    ),
    makePrompt(
      "mid_2500_minutes_under_5goals", "MID",
      "Midfielder with 2,500+ minutes, fewer than five goals and at least five assists",
      "That midfielder must play at least 2,500 minutes, score fewer than five goals and record at least five assists.",
      "hard", ["minutes", "low-goals", "assists", "anti-meta"], 5,
      p => p.minutes >= 2500 && p.goals < 5 && p.assists >= 5
    ),
    makePrompt(
      "mid_sean_dyche_5involvements", "MID",
      "Midfielder managed by Sean Dyche with at least five goal involvements",
      "That midfielder season must be managed by Sean Dyche and include at least five combined goals and assists.",
      "hard", ["manager", "Sean Dyche", "goal-involvements", "anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Sean Dyche") && (p.goals + p.assists) >= 5
    ),
    makePrompt(
      "mid_moyes_100points", "MID",
      "Midfielder managed by David Moyes with at least 100 FPL points",
      "That midfielder season must be managed by David Moyes and score at least 100 FPL points.",
      "medium", ["manager", "David Moyes", "points", "anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("David Moyes") && p.points >= 100
    ),
    makePrompt(
      "mid_relegated_100points", "MID",
      "Midfielder from a relegated club with at least 100 FPL points",
      "That midfielder must play for a relegated club and score at least 100 FPL points.",
      "hard", ["relegated", "points", "anti-meta"], 5,
      p => p.relegated === true && p.points >= 100
    ),
    makePrompt(
      "mid_budget_120points", "MID",
      "Midfielder who started at £5.5m or less and scored 120+ FPL points",
      "That midfielder must start at £5.5m or less and score at least 120 FPL points.",
      "easy", ["budget", "points"], 4,
      p => p.startingPrice <= 5.5 && p.points >= 120
    ),
    makePrompt(
      "mid_assists_gt_goals_6", "MID",
      "Midfielder with at least eight assists and more assists than goals",
      "That midfielder season must record at least eight assists and more assists than goals.",
      "medium", ["assists"], 4,
      p => p.assists >= 8 && p.assists > p.goals
    ),
    makePrompt(
      "mid_topfour_under6_100points", "MID",
      "Midfielder from a top-four club who started below £6.0m and scored 100+ points",
      "That midfielder's club must finish in the top four, the starting price must be below £6.0m and the season must score at least 100 points.",
      "hard", ["top-four", "budget", "points"], 4,
      p => p.topFour === true && p.startingPrice < 6 && p.points >= 100
    ),
    makePrompt(
      "mid_13_17_8involvements", "MID",
      "Midfielder from a club finishing 13th–17th with at least eight goal involvements",
      "That midfielder's club must finish 13th–17th and the player must record at least eight combined goals and assists.",
      "medium", ["survival", "goal-involvements", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && (p.goals + p.assists) >= 8
    ),
    makePrompt(
      "mid_10_clean_5involvements_bottomhalf", "MID",
      "Midfielder from a bottom-half club with 10+ clean sheets and five goal involvements",
      "That midfielder's club must finish in the bottom half, record at least 10 clean sheets and the player must have at least five combined goals and assists.",
      "hard", ["bottom-half", "clean-sheets", "goal-involvements", "anti-meta"], 5,
      p => p.bottomHalf === true && p.cleanSheets >= 10 && (p.goals + p.assists) >= 5
    ),
    makePrompt(
      "mid_promoted_100", "MID",
      "Midfielder from a promoted club with at least 100 FPL points",
      "That midfielder must play for a promoted club and score at least 100 FPL points.",
      "medium", ["promoted", "points", "anti-meta"], 4,
      p => p.promoted === true && p.points >= 100
    ),

    // Forwards
    makePrompt(
      "fwd_promoted_goals", "FWD",
      "Forward from a promoted club who scored at least 10 goals",
      "That forward must play for a promoted club and score at least 10 goals.",
      "hard", ["promoted", "goals", "anti-meta"], 5,
      p => p.promoted === true && p.goals >= 10
    ),
    makePrompt(
      "fwd_exact_ten_outside_big_six", "FWD",
      "Forward outside the traditional Big Six who scored exactly 10 goals",
      "That forward must play outside the traditional Big Six and score exactly 10 goals.",
      "hard", ["outside-big-six", "exact-stat", "goals", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.goals === 10
    ),
    makePrompt(
      "fwd_relegated_8goals", "FWD",
      "Forward from a relegated club who scored at least eight goals",
      "That forward must play for a relegated club and score at least eight goals.",
      "hard", ["relegated", "goals", "anti-meta"], 5,
      p => p.relegated === true && p.goals >= 8
    ),
    makePrompt(
      "fwd_bottomhalf_12goals", "FWD",
      "Forward from a bottom-half club who scored at least 12 goals",
      "That forward's club must finish in the bottom half and the player must score at least 12 goals.",
      "hard", ["bottom-half", "goals", "anti-meta"], 5,
      p => p.bottomHalf === true && p.goals >= 12
    ),
    makePrompt(
      "fwd_budget_120points", "FWD",
      "Forward who started at £6.5m or less and scored 120+ FPL points",
      "That forward must start at £6.5m or less and score at least 120 FPL points.",
      "easy", ["budget", "points"], 4,
      p => p.startingPrice <= 6.5 && p.points >= 120
    ),
    makePrompt(
      "fwd_non_big_six_150points", "FWD",
      "Forward outside the traditional Big Six with at least 150 FPL points",
      "That forward must play outside the traditional Big Six and score at least 150 FPL points.",
      "medium", ["outside-big-six", "points", "anti-meta"], 4,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.points >= 150
    ),
    makePrompt(
      "fwd_age_u23_10goals", "FWD",
      "Forward aged 23 or under who scored at least 10 goals",
      "That forward must be aged 23 or under at the season start and score at least 10 goals.",
      "medium", ["young", "goals"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 23 && p.goals >= 10
    ),
    makePrompt(
      "fwd_midtable_10goals", "FWD",
      "Forward from a club finishing 7th–12th who scored at least 10 goals",
      "That forward's club must finish 7th–12th and the player must score at least 10 goals.",
      "medium", ["mid-table", "goals", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.goals >= 10
    ),
    makePrompt(
      "fwd_5assists_10goals_outside", "FWD",
      "Forward outside the traditional Big Six with 10+ goals and five assists",
      "That forward must play outside the traditional Big Six, score at least 10 goals and record at least five assists.",
      "hard", ["outside-big-six", "goals", "assists", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.goals >= 10 && p.assists >= 5
    ),
    makePrompt(
      "fwd_moyes_8goals", "FWD",
      "Forward managed by David Moyes who scored at least eight goals",
      "That forward season must be managed by David Moyes and include at least eight goals.",
      "hard", ["manager", "David Moyes", "goals", "anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("David Moyes") && p.goals >= 8
    ),
    makePrompt(
      "fwd_sean_dyche_8goals", "FWD",
      "Forward managed by Sean Dyche who scored at least eight goals",
      "That forward season must be managed by Sean Dyche and include at least eight goals.",
      "hard", ["manager", "Sean Dyche", "goals", "anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Sean Dyche") && p.goals >= 8
    ),
    makePrompt(
      "fwd_promoted_100points", "FWD",
      "Forward from a promoted club with at least 100 FPL points",
      "That forward must play for a promoted club and score at least 100 FPL points.",
      "medium", ["promoted", "points", "anti-meta"], 4,
      p => p.promoted === true && p.points >= 100
    ),
    makePrompt(
      "fwd_13_17_10goals", "FWD",
      "Forward from a club finishing 13th–17th who scored at least 10 goals",
      "That forward's club must finish 13th–17th and the player must score at least 10 goals.",
      "medium", ["survival", "goals", "anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.goals >= 10
    ),
    makePrompt(
      "fwd_exact15_outside_big_six", "FWD",
      "Forward outside the traditional Big Six who scored exactly 15 goals",
      "That forward must play outside the traditional Big Six and score exactly 15 goals.",
      "hard", ["outside-big-six", "exact-stat", "goals", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.goals === 15
    ),
    makePrompt(
      "fwd_2000min_10goals", "FWD",
      "Forward who played at least 2,000 minutes and scored 10+ goals",
      "That forward must play at least 2,000 minutes and score at least 10 goals.",
      "easy", ["minutes", "goals"], 4,
      p => p.minutes >= 2000 && p.goals >= 10
    ),

    // Expanded Library v1 — 113 additional prompts, including name rules
    makePrompt(
      "gk_surname_m", "GK",
      "Goalkeeper whose surname starts with M",
      "That goalkeeper’s surname must start with M.",
      "easy", ["name-rule","surname","anti-meta"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("m")); }
    ),
    makePrompt(
      "gk_surname_s", "GK",
      "Goalkeeper whose surname starts with S",
      "That goalkeeper’s surname must start with S.",
      "easy", ["name-rule","surname","anti-meta"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("s")); }
    ),
    makePrompt(
      "gk_firstname_j_70", "GK",
      "Goalkeeper whose first name starts with J and scored 70+ points",
      "That goalkeeper’s first name must start with J and the season must score at least 70 FPL points.",
      "medium", ["name-rule","first-name","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__first.startsWith("j") && p.points >= 70); }
    ),
    makePrompt(
      "gk_same_initials_50", "GK",
      "Goalkeeper whose first name and surname share an initial with 50+ points",
      "That goalkeeper’s first name and surname must share an initial and the season must score at least 50 points.",
      "hard", ["name-rule","same-initials","points","anti-meta"], 5,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__tokens.length > 1 && __first[0] && __first[0] === __surname[0] && p.points >= 50); }
    ),
    makePrompt(
      "gk_surname_son", "GK",
      "Goalkeeper whose surname ends in “son”",
      "That goalkeeper’s surname must end in “son”.",
      "hard", ["name-rule","surname","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.endsWith("son")); }
    ),
    makePrompt(
      "gk_age_30_100", "GK",
      "Goalkeeper aged 30 or over with at least 100 FPL points",
      "That goalkeeper must be aged 30 or over at the season start and score at least 100 points.",
      "medium", ["age","veteran","points"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 30 && p.points >= 100
    ),
    makePrompt(
      "gk_age_u24_80", "GK",
      "Goalkeeper aged 23 or under with at least 80 FPL points",
      "That goalkeeper must be aged 23 or under at the season start and score at least 80 points.",
      "hard", ["age","young","points"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 23 && p.points >= 80
    ),
    makePrompt(
      "gk_bottomhalf_120_saves", "GK",
      "Goalkeeper from a bottom-half club with 120+ saves",
      "That goalkeeper’s club must finish in the bottom half and the season must include at least 120 saves.",
      "medium", ["bottom-half","saves","anti-meta"], 5,
      p => p.bottomHalf === true && p.saves >= 120
    ),
    makePrompt(
      "gk_midtable_100_saves", "GK",
      "Goalkeeper from a club finishing 7th–12th with 100+ saves",
      "That goalkeeper’s club must finish 7th–12th and the season must include at least 100 saves.",
      "medium", ["mid-table","saves","anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.saves >= 100
    ),
    makePrompt(
      "gk_survival_10_bonus", "GK",
      "Goalkeeper from a club finishing 13th–17th with 10+ bonus points",
      "That goalkeeper’s club must finish 13th–17th and the season must include at least 10 bonus points.",
      "medium", ["survival","bonus","anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.bonus >= 10
    ),
    makePrompt(
      "gk_budget_10_bonus", "GK",
      "Goalkeeper who started at £4.5m or less with 10+ bonus points",
      "That goalkeeper must start at £4.5m or less and earn at least 10 bonus points.",
      "easy", ["budget","bonus"], 4,
      p => p.startingPrice <= 4.5 && p.bonus >= 10
    ),
    makePrompt(
      "gk_final_45_100", "GK",
      "Goalkeeper who finished at £4.5m or less with 100+ points",
      "That goalkeeper must finish at £4.5m or less and score at least 100 FPL points.",
      "easy", ["budget","final-price","points"], 4,
      p => p.finalPrice <= 4.5 && p.points >= 100
    ),
    makePrompt(
      "gk_zero_yellows_100_saves", "GK",
      "Goalkeeper with no yellow cards and at least 100 saves",
      "That goalkeeper season must include no yellow cards and at least 100 saves.",
      "medium", ["discipline","saves"], 4,
      p => p.yellowCards === 0 && p.saves >= 100
    ),
    makePrompt(
      "gk_assist_80_points", "GK",
      "Goalkeeper with an assist and at least 80 FPL points",
      "That goalkeeper season must include at least one assist and 80 FPL points.",
      "hard", ["assists","points","anti-meta"], 5,
      p => p.assists >= 1 && p.points >= 80
    ),
    makePrompt(
      "gk_3000_10cs_outside_top4", "GK",
      "Goalkeeper outside the top four with 3,000+ minutes and 10+ clean sheets",
      "That goalkeeper’s club must finish outside the top four with at least 3,000 minutes and 10 clean sheets.",
      "hard", ["outside-top-four","minutes","clean-sheets"], 5,
      p => p.topFour !== true && p.minutes >= 3000 && p.cleanSheets >= 10
    ),
    makePrompt(
      "gk_hodgson_40_saves", "GK",
      "Goalkeeper managed by Roy Hodgson with at least 40 saves",
      "That goalkeeper season must be managed by Roy Hodgson and include at least 40 saves.",
      "hard", ["manager","Roy Hodgson","saves","anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Roy Hodgson") && p.saves >= 40
    ),
    makePrompt(
      "gk_howe_20_saves", "GK",
      "Goalkeeper managed by Eddie Howe with at least 20 saves",
      "That goalkeeper season must be managed by Eddie Howe and include at least 20 saves.",
      "hard", ["manager","Eddie Howe","points"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Eddie Howe") && p.saves >= 20
    ),
    makePrompt(
      "gk_exact5cs_80saves", "GK",
      "Goalkeeper with exactly five clean sheets and 80+ saves",
      "That goalkeeper season must include exactly five clean sheets and at least 80 saves.",
      "hard", ["exact-stat","clean-sheets","saves","anti-meta"], 5,
      p => p.cleanSheets === 5 && p.saves >= 80
    ),
    makePrompt(
      "def_surname_t_1000", "DEF",
      "Defender whose surname starts with T and played 1,000+ minutes",
      "That defender’s surname must start with T and the season must include at least 1,000 minutes.",
      "medium", ["name-rule","surname","minutes"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("t") && p.minutes >= 1000); }
    ),
    makePrompt(
      "def_surname_v_1000", "DEF",
      "Defender whose surname starts with V and played 1,000+ minutes",
      "That defender’s surname must start with V and the season must include at least 1,000 minutes.",
      "medium", ["name-rule","surname","minutes"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("v") && p.minutes >= 1000); }
    ),
    makePrompt(
      "def_firstname_j_2000", "DEF",
      "Defender whose first name starts with J and played 2,000+ minutes",
      "That defender’s first name must start with J and the season must include at least 2,000 minutes.",
      "medium", ["name-rule","first-name","minutes"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__first.startsWith("j") && p.minutes >= 2000); }
    ),
    makePrompt(
      "def_same_initials_1000", "DEF",
      "Defender whose first name and surname share an initial with 1,000+ minutes",
      "That defender’s first name and surname must share an initial and the season must include at least 1,000 minutes.",
      "hard", ["name-rule","same-initials","minutes","anti-meta"], 5,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__tokens.length > 1 && __first[0] && __first[0] === __surname[0] && p.minutes >= 1000); }
    ),
    makePrompt(
      "def_hyphenated_1000", "DEF",
      "Defender with a hyphenated surname who played 1,000+ minutes",
      "That defender must have a hyphenated surname and play at least 1,000 minutes.",
      "hard", ["name-rule","hyphenated","minutes"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.includes("-") && p.minutes >= 1000); }
    ),
    makePrompt(
      "def_surname_son_1500", "DEF",
      "Defender whose surname ends in “son” and played 1,500+ minutes",
      "That defender’s surname must end in “son” and the season must include at least 1,500 minutes.",
      "hard", ["name-rule","surname","minutes"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.endsWith("son") && p.minutes >= 1500); }
    ),
    makePrompt(
      "def_surname_10letters_2000", "DEF",
      "Defender with a surname of 10+ letters who played 2,000+ minutes",
      "That defender’s surname must contain at least 10 letters and the season must include 2,000 minutes.",
      "hard", ["name-rule","name-length","minutes"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__letters(__surname) >= 10 && p.minutes >= 2000); }
    ),
    makePrompt(
      "def_longname_100points", "DEF",
      "Defender with 16+ letters in their full name and 100+ points",
      "That defender’s full name must contain at least 16 letters and the season must score 100 FPL points.",
      "hard", ["name-rule","name-length","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__letters(__raw) >= 16 && p.points >= 100); }
    ),
    makePrompt(
      "def_age30_2500", "DEF",
      "Defender aged 30 or over who played 2,700+ minutes",
      "That defender must be aged 30 or over at the season start and play at least 2,700 minutes.",
      "medium", ["age","veteran","minutes"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 30 && p.minutes >= 2500
    ),
    makePrompt(
      "def_age_u21_1000", "DEF",
      "Defender aged 20 or under who played 1,000+ minutes",
      "That defender must be aged 20 or under at the season start and play at least 1,000 minutes.",
      "hard", ["age","young","minutes"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 20 && p.minutes >= 1000
    ),
    makePrompt(
      "def_start_40_1500", "DEF",
      "Defender who started at £4.0m or less and played 1,500+ minutes",
      "That defender must start at £4.0m or less and play at least 1,500 minutes.",
      "medium", ["budget","minutes","anti-meta"], 5,
      p => p.startingPrice <= 4 && p.minutes >= 1500
    ),
    makePrompt(
      "def_final_45_2700", "DEF",
      "Defender who finished at £4.5m or less and played 2,700+ minutes",
      "That defender must finish at £4.5m or less and play at least 2,700 minutes.",
      "easy", ["budget","final-price","minutes"], 4,
      p => p.finalPrice <= 4.5 && p.minutes >= 2700
    ),
    makePrompt(
      "def_zero_goals_5assists", "DEF",
      "Defender with no goals and at least five assists",
      "That defender season must include no goals and at least five assists.",
      "easy", ["assists","zero-goals"], 4,
      p => p.goals === 0 && p.assists >= 5
    ),
    makePrompt(
      "def_onegoal_10cs", "DEF",
      "Defender with exactly one goal and at least 10 clean sheets",
      "That defender season must include exactly one goal and at least 10 clean sheets.",
      "medium", ["exact-stat","goals","clean-sheets"], 4,
      p => p.goals === 1 && p.cleanSheets >= 10
    ),
    makePrompt(
      "def_bottomhalf_2g2a", "DEF",
      "Defender from a bottom-half club with 2+ goals and 2+ assists",
      "That defender’s club must finish in the bottom half with at least two goals and two assists.",
      "hard", ["bottom-half","goals","assists","anti-meta"], 5,
      p => p.bottomHalf === true && p.goals >= 2 && p.assists >= 2
    ),
    makePrompt(
      "def_10yellows_2000", "DEF",
      "Defender with 10+ yellow cards who played 2,000+ minutes",
      "That defender season must include at least 10 yellow cards and 2,000 minutes.",
      "hard", ["cards","minutes","anti-meta"], 4,
      p => p.yellowCards >= 10 && p.minutes >= 2000
    ),
    makePrompt(
      "def_promoted_5cs", "DEF",
      "Defender from a promoted club with at least five clean sheets",
      "That defender must play for a promoted club and record at least five clean sheets.",
      "easy", ["promoted","clean-sheets","anti-meta"], 4,
      p => p.promoted === true && p.cleanSheets >= 5
    ),
    makePrompt(
      "def_relegated_5cs", "DEF",
      "Defender from a relegated club with at least five clean sheets",
      "That defender must play for a relegated club and record at least five clean sheets.",
      "medium", ["relegated","clean-sheets","anti-meta"], 5,
      p => p.relegated === true && p.cleanSheets >= 5
    ),
    makePrompt(
      "def_survival_4assists", "DEF",
      "Defender from a club finishing 13th–17th with 4+ assists",
      "That defender’s club must finish 13th–17th and the season must include at least four assists.",
      "hard", ["survival","assists","anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.assists >= 4
    ),
    makePrompt(
      "def_midtable_2goals", "DEF",
      "Defender from a club finishing 7th–12th with at least two goals",
      "That defender’s club must finish 7th–12th and the player must score at least two goals.",
      "medium", ["mid-table","goals","anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.goals >= 2
    ),
    makePrompt(
      "def_arteta_2000", "DEF",
      "Defender managed by Mikel Arteta who played 2,000+ minutes",
      "That defender season must be managed by Mikel Arteta and include at least 2,000 minutes.",
      "medium", ["manager","Mikel Arteta","minutes"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Mikel Arteta") && p.minutes >= 2000
    ),
    makePrompt(
      "def_klopp_2000", "DEF",
      "Defender managed by Jürgen Klopp who played 2,000+ minutes",
      "That defender season must be managed by Jürgen Klopp and include at least 2,000 minutes.",
      "medium", ["manager","Jürgen Klopp","minutes"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Jürgen Klopp") && p.minutes >= 2000
    ),
    makePrompt(
      "def_hodgson_2000", "DEF",
      "Defender managed by Roy Hodgson who played 2,000+ minutes",
      "That defender season must be managed by Roy Hodgson and include at least 2,000 minutes.",
      "hard", ["manager","Roy Hodgson","minutes","anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Roy Hodgson") && p.minutes >= 2000
    ),
    makePrompt(
      "def_howe_2000", "DEF",
      "Defender managed by Eddie Howe who played 2,000+ minutes",
      "That defender season must be managed by Eddie Howe and include at least 2,000 minutes.",
      "medium", ["manager","Eddie Howe","minutes"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Eddie Howe") && p.minutes >= 2000
    ),
    makePrompt(
      "def_nuno_2000", "DEF",
      "Defender managed by Nuno Espírito Santo who played 2,000+ minutes",
      "That defender season must be managed by Nuno Espírito Santo and include at least 2,000 minutes.",
      "hard", ["manager","Nuno Espírito Santo","minutes","anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Nuno Espírito Santo") && p.minutes >= 2000
    ),
    makePrompt(
      "def_pochettino_1500", "DEF",
      "Defender managed by Mauricio Pochettino who played 1,500+ minutes",
      "That defender season must be managed by Mauricio Pochettino and include at least 1,500 minutes.",
      "medium", ["manager","Mauricio Pochettino","minutes"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Mauricio Pochettino") && p.minutes >= 1500
    ),
    makePrompt(
      "def_outside_big6_3g3a", "DEF",
      "Defender outside the traditional Big Six with 3+ goals and 3+ assists",
      "That defender must play outside the traditional Big Six and record at least three goals and three assists.",
      "hard", ["outside-big-six","goals","assists","anti-meta"], 5,
      p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.goals >= 3 && p.assists >= 3
    ),
    makePrompt(
      "def_top4_5assists", "DEF",
      "Defender from a top-four club with at least five assists",
      "That defender’s club must finish in the top four and the season must include at least five assists.",
      "medium", ["top-four","assists"], 4,
      p => p.topFour === true && p.assists >= 5
    ),
    makePrompt(
      "def_champion_zero_goal_1500", "DEF",
      "Defender from the champions with no goals and 1,500+ minutes",
      "That defender must play for the champions, score no goals and play at least 1,500 minutes.",
      "hard", ["champions","zero-goals","minutes"], 4,
      p => p.champions === true && p.goals === 0 && p.minutes >= 1500
    ),
    makePrompt(
      "def_10cs_under5", "DEF",
      "Defender with 10+ clean sheets who started below £5.0m",
      "That defender must start below £5.0m and record at least 10 clean sheets.",
      "easy", ["budget","clean-sheets"], 4,
      p => p.startingPrice < 5 && p.cleanSheets >= 10
    ),
    makePrompt(
      "def_2500_5bonus_zero_goal", "DEF",
      "Defender with 2,500+ minutes, 5+ bonus points and no goals",
      "That defender season must include 2,500 minutes, at least five bonus points and no goals.",
      "medium", ["minutes","bonus","zero-goals"], 4,
      p => p.minutes >= 2500 && p.bonus >= 5 && p.goals === 0
    ),
    makePrompt(
      "def_outside_big6_gc30_2000", "DEF",
      "Defender outside the Big Six who played 2,000+ minutes and conceded 30 or fewer",
      "That defender must play outside the traditional Big Six, complete 2,000 minutes and concede no more than 30 goals.",
      "hard", ["outside-big-six","goals-conceded","minutes","anti-meta"], 5,
      p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.minutes >= 2000 && p.goalsConceded <= 30
    ),
    makePrompt(
      "def_100pts_6yellows", "DEF",
      "Defender with 100+ points and at least six yellow cards",
      "That defender season must score at least 100 points and include at least six yellow cards.",
      "medium", ["points","cards"], 4,
      p => p.points >= 100 && p.yellowCards >= 6
    ),
    makePrompt(
      "def_exact4assists_2000", "DEF",
      "Defender with exactly four assists who played 2,000+ minutes",
      "That defender season must include exactly four assists and at least 2,000 minutes.",
      "hard", ["exact-stat","assists","minutes"], 4,
      p => p.assists === 4 && p.minutes >= 2000
    ),
    makePrompt(
      "def_exact8cs_2000", "DEF",
      "Defender with exactly eight clean sheets who played 2,000+ minutes",
      "That defender season must include exactly eight clean sheets and at least 2,000 minutes.",
      "hard", ["exact-stat","clean-sheets","minutes"], 4,
      p => p.cleanSheets === 8 && p.minutes >= 2000
    ),
    makePrompt(
      "mid_surname_b_100", "MID",
      "Midfielder whose surname starts with B and scored 100+ points",
      "That midfielder’s surname must start with B and the season must score at least 100 points.",
      "medium", ["name-rule","surname","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("b") && p.points >= 100); }
    ),
    makePrompt(
      "mid_surname_d_100", "MID",
      "Midfielder whose surname starts with D and scored 100+ points",
      "That midfielder’s surname must start with D and the season must score at least 100 points.",
      "medium", ["name-rule","surname","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("d") && p.points >= 100); }
    ),
    makePrompt(
      "mid_firstname_j_100", "MID",
      "Midfielder whose first name starts with J and scored 100+ points",
      "That midfielder’s first name must start with J and the season must score at least 100 points.",
      "medium", ["name-rule","first-name","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__first.startsWith("j") && p.points >= 100); }
    ),
    makePrompt(
      "mid_same_initials_100", "MID",
      "Midfielder whose first name and surname share an initial with 100+ points",
      "That midfielder’s first name and surname must share an initial and the season must score at least 100 points.",
      "hard", ["name-rule","same-initials","points","anti-meta"], 5,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__tokens.length > 1 && __first[0] && __first[0] === __surname[0] && p.points >= 100); }
    ),
    makePrompt(
      "mid_hyphenated_80", "MID",
      "Midfielder with a hyphenated surname who scored 80+ points",
      "That midfielder must have a hyphenated surname and score at least 80 points.",
      "hard", ["name-rule","hyphenated","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.includes("-") && p.points >= 80); }
    ),
    makePrompt(
      "mid_surname_son_100", "MID",
      "Midfielder whose surname ends in “son” with 100+ points",
      "That midfielder’s surname must end in “son” and the season must score at least 100 points.",
      "hard", ["name-rule","surname","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.endsWith("son") && p.points >= 100); }
    ),
    makePrompt(
      "mid_surname_10letters_100", "MID",
      "Midfielder with a surname of 10+ letters and 100+ points",
      "That midfielder’s surname must contain at least 10 letters and the season must score 100 points.",
      "hard", ["name-rule","name-length","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__letters(__surname) >= 10 && p.points >= 100); }
    ),
    makePrompt(
      "mid_longname_120", "MID",
      "Midfielder with 16+ letters in their full name and 120+ points",
      "That midfielder’s full name must contain at least 16 letters and the season must score at least 120 points.",
      "hard", ["name-rule","name-length","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__letters(__raw) >= 16 && p.points >= 120); }
    ),
    makePrompt(
      "mid_age_u21_80", "MID",
      "Midfielder aged 20 or under with at least 80 FPL points",
      "That midfielder must be aged 20 or under at the season start and score at least 80 points.",
      "hard", ["age","young","points"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 20 && p.points >= 80
    ),
    makePrompt(
      "mid_age30_120", "MID",
      "Midfielder aged 30 or over with at least 120 FPL points",
      "That midfielder must be aged 30 or over at the season start and score at least 120 points.",
      "medium", ["age","veteran","points"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 30 && p.points >= 120
    ),
    makePrompt(
      "mid_outside_big6_2000_10gi", "MID",
      "Midfielder outside the Big Six with 2,000+ minutes and 10+ goal involvements",
      "That midfielder must play outside the traditional Big Six, complete 2,000 minutes and record at least 10 goals plus assists.",
      "medium", ["outside-big-six","minutes","goal-involvements","anti-meta"], 5,
      p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.minutes >= 2000 && (p.goals + p.assists) >= 10
    ),
    makePrompt(
      "mid_promoted_5assists", "MID",
      "Midfielder from a promoted club with at least five assists",
      "That midfielder must play for a promoted club and record at least five assists.",
      "medium", ["promoted","assists","anti-meta"], 5,
      p => p.promoted === true && p.assists >= 5
    ),
    makePrompt(
      "mid_relegated_5assists", "MID",
      "Midfielder from a relegated club with at least five assists",
      "That midfielder must play for a relegated club and record at least five assists.",
      "hard", ["relegated","assists","anti-meta"], 5,
      p => p.relegated === true && p.assists >= 5
    ),
    makePrompt(
      "mid_bottomhalf_10gi", "MID",
      "Midfielder from a bottom-half club with 10+ goal involvements",
      "That midfielder’s club must finish in the bottom half and the season must include at least 10 goals plus assists.",
      "medium", ["bottom-half","goal-involvements","anti-meta"], 5,
      p => p.bottomHalf === true && (p.goals + p.assists) >= 10
    ),
    makePrompt(
      "mid_survival_9gi", "MID",
      "Midfielder from a club finishing 13th–17th with 9+ goal involvements",
      "That midfielder’s club must finish 13th–17th and the season must include at least nine goals plus assists.",
      "medium", ["survival","goal-involvements","anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && (p.goals + p.assists) >= 9
    ),
    makePrompt(
      "mid_midtable_10gi", "MID",
      "Midfielder from a club finishing 7th–12th with 10+ goal involvements",
      "That midfielder’s club must finish 7th–12th and the season must include at least 10 goals plus assists.",
      "medium", ["mid-table","goal-involvements","anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && (p.goals + p.assists) >= 10
    ),
    makePrompt(
      "mid_exact5g5a", "MID",
      "Midfielder with exactly five goals and exactly five assists",
      "That midfielder season must include exactly five goals and five assists.",
      "hard", ["exact-stat","goals","assists","anti-meta"], 5,
      p => p.goals === 5 && p.assists === 5
    ),
    makePrompt(
      "mid_exact10goals_outside_big6", "MID",
      "Midfielder outside the Big Six with exactly 10 goals",
      "That midfielder must play outside the traditional Big Six and score exactly 10 goals.",
      "hard", ["outside-big-six","exact-stat","goals","anti-meta"], 5,
      p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.goals === 10
    ),
    makePrompt(
      "mid_zero_goals_5assists", "MID",
      "Midfielder with no goals and at least five assists",
      "That midfielder season must include no goals and at least five assists.",
      "hard", ["zero-goals","assists","anti-meta"], 5,
      p => p.goals === 0 && p.assists >= 5
    ),
    makePrompt(
      "mid_exact8assists_100", "MID",
      "Midfielder with exactly eight assists and 100+ points",
      "That midfielder season must include exactly eight assists and at least 100 points.",
      "hard", ["exact-stat","assists","points"], 4,
      p => p.assists === 8 && p.points >= 100
    ),
    makePrompt(
      "mid_exact7goals_100", "MID",
      "Midfielder with exactly seven goals and 100+ points",
      "That midfielder season must include exactly seven goals and at least 100 points.",
      "hard", ["exact-stat","goals","points"], 4,
      p => p.goals === 7 && p.points >= 100
    ),
    makePrompt(
      "mid_10yellows_100", "MID",
      "Midfielder with 10+ yellow cards and 100+ points",
      "That midfielder season must include at least 10 yellow cards and 100 FPL points.",
      "hard", ["cards","points","anti-meta"], 4,
      p => p.yellowCards >= 10 && p.points >= 100
    ),
    makePrompt(
      "mid_start5_8gi", "MID",
      "Midfielder who started at £5.0m or less with 8+ goal involvements",
      "That midfielder must start at £5.0m or less and record at least eight goals plus assists.",
      "easy", ["budget","goal-involvements"], 4,
      p => p.startingPrice <= 5 && (p.goals + p.assists) >= 8
    ),
    makePrompt(
      "mid_final5_100", "MID",
      "Midfielder who finished at £5.0m or less with 100+ points",
      "That midfielder must finish at £5.0m or less and score at least 100 points.",
      "easy", ["budget","final-price","points"], 4,
      p => p.finalPrice <= 5 && p.points >= 100
    ),
    makePrompt(
      "mid_top4_15gi", "MID",
      "Midfielder from a top-four club with 15+ goal involvements",
      "That midfielder’s club must finish in the top four and the season must include at least 15 goals plus assists.",
      "easy", ["top-four","goal-involvements"], 4,
      p => p.topFour === true && (p.goals + p.assists) >= 15
    ),
    makePrompt(
      "mid_champion_10assists", "MID",
      "Midfielder from the champions with at least 10 assists",
      "That midfielder must play for the champions and record at least 10 assists.",
      "medium", ["champions","assists"], 4,
      p => p.champions === true && p.assists >= 10
    ),
    makePrompt(
      "mid_nuno_100", "MID",
      "Midfielder managed by Nuno Espírito Santo with at least 100 FPL points",
      "That midfielder season must be managed by Nuno Espírito Santo and score at least 100 points.",
      "medium", ["manager","Nuno Espírito Santo","points","anti-meta"], 5,
      p => Array.isArray(p.managers) && p.managers.includes("Nuno Espírito Santo") && p.points >= 100
    ),
    makePrompt(
      "mid_hodgson_80", "MID",
      "Midfielder managed by Roy Hodgson with at least 80 FPL points",
      "That midfielder season must be managed by Roy Hodgson and score at least 80 points.",
      "hard", ["manager","Roy Hodgson","points","anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Roy Hodgson") && p.points >= 80
    ),
    makePrompt(
      "mid_howe_100", "MID",
      "Midfielder managed by Eddie Howe with at least 100 FPL points",
      "That midfielder season must be managed by Eddie Howe and score at least 100 points.",
      "medium", ["manager","Eddie Howe","points"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Eddie Howe") && p.points >= 100
    ),
    makePrompt(
      "mid_emery_100", "MID",
      "Midfielder managed by Unai Emery with at least 100 FPL points",
      "That midfielder season must be managed by Unai Emery and score at least 100 points.",
      "medium", ["manager","Unai Emery","points"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Unai Emery") && p.points >= 100
    ),
    makePrompt(
      "mid_pochettino_100", "MID",
      "Midfielder managed by Mauricio Pochettino with at least 100 FPL points",
      "That midfielder season must be managed by Mauricio Pochettino and score at least 100 points.",
      "medium", ["manager","Mauricio Pochettino","points"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Mauricio Pochettino") && p.points >= 100
    ),
    makePrompt(
      "mid_wenger_100", "MID",
      "Midfielder managed by Arsène Wenger with at least 100 FPL points",
      "That midfielder season must be managed by Arsène Wenger and score at least 100 points.",
      "hard", ["manager","Arsène Wenger","points"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Arsène Wenger") && p.points >= 100
    ),
    makePrompt(
      "mid_pep_150", "MID",
      "Midfielder managed by Pep Guardiola with at least 150 FPL points",
      "That midfielder season must be managed by Pep Guardiola and score at least 150 points.",
      "medium", ["manager","Pep Guardiola","points"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Pep Guardiola") && p.points >= 150
    ),
    makePrompt(
      "mid_2500_10bonus_astgtgoal", "MID",
      "Midfielder with 2,500+ minutes, 10+ bonus and more assists than goals",
      "That midfielder season must include 2,500 minutes, at least 10 bonus points and more assists than goals.",
      "medium", ["minutes","bonus","assists","anti-meta"], 5,
      p => p.minutes >= 2500 && p.bonus >= 10 && p.assists > p.goals
    ),
    makePrompt(
      "mid_bottomhalf_3000_no_red", "MID",
      "Midfielder from a bottom-half club with 3,000+ minutes and no red cards",
      "That midfielder’s club must finish in the bottom half with at least 3,000 minutes and no red cards.",
      "medium", ["bottom-half","minutes","discipline","anti-meta"], 4,
      p => p.bottomHalf === true && p.minutes >= 3000 && p.redCards === 0
    ),
    makePrompt(
      "fwd_surname_m_80", "FWD",
      "Forward whose surname starts with M and scored 80+ points",
      "That forward’s surname must start with M and the season must score at least 80 points.",
      "medium", ["name-rule","surname","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("m") && p.points >= 80); }
    ),
    makePrompt(
      "fwd_surname_s_80", "FWD",
      "Forward whose surname starts with S and scored 80+ points",
      "That forward’s surname must start with S and the season must score at least 80 points.",
      "medium", ["name-rule","surname","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("s") && p.points >= 80); }
    ),
    makePrompt(
      "fwd_firstname_a_80", "FWD",
      "Forward whose first name starts with A and scored 80+ points",
      "That forward’s first name must start with A and the season must score at least 80 points.",
      "medium", ["name-rule","first-name","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__first.startsWith("a") && p.points >= 80); }
    ),
    makePrompt(
      "fwd_same_initials_50", "FWD",
      "Forward whose first name and surname share an initial with 50+ points",
      "That forward’s first name and surname must share an initial and the season must score at least 50 points.",
      "hard", ["name-rule","same-initials","points","anti-meta"], 5,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__tokens.length > 1 && __first[0] && __first[0] === __surname[0] && p.points >= 50); }
    ),
    makePrompt(
      "fwd_hyphenated", "FWD",
      "Forward with a hyphenated surname",
      "That forward must have a hyphenated surname.",
      "hard", ["name-rule","hyphenated","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.includes("-")); }
    ),
    makePrompt(
      "fwd_surname_son", "FWD",
      "Forward whose surname ends in “son”",
      "That forward’s surname must end in “son”.",
      "hard", ["name-rule","surname","points"], 4,
      p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.endsWith("son")); }
    ),
    makePrompt(
      "fwd_age_u22_5goals", "FWD",
      "Forward aged 21 or under with at least five goals",
      "That forward must be aged 21 or under at the season start and score at least five goals.",
      "hard", ["age","young","goals"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 21 && p.goals >= 5
    ),
    makePrompt(
      "fwd_age30_10goals", "FWD",
      "Forward aged 30 or over with at least 10 goals",
      "That forward must be aged 30 or over at the season start and score at least 10 goals.",
      "hard", ["age","veteran","goals"], 4,
      p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 30 && p.goals >= 10
    ),
    makePrompt(
      "fwd_start6_8goals", "FWD",
      "Forward who started at £6.0m or less and scored 8+ goals",
      "That forward must start at £6.0m or less and score at least eight goals.",
      "easy", ["budget","goals"], 4,
      p => p.startingPrice <= 6 && p.goals >= 8
    ),
    makePrompt(
      "fwd_final6_8goals", "FWD",
      "Forward who finished at £6.0m or less and scored 8+ goals",
      "That forward must finish at £6.0m or less and score at least eight goals.",
      "easy", ["budget","final-price","goals"], 4,
      p => p.finalPrice <= 6 && p.goals >= 8
    ),
    makePrompt(
      "fwd_promoted_5goals", "FWD",
      "Forward from a promoted club with at least five goals",
      "That forward must play for a promoted club and score at least five goals.",
      "easy", ["promoted","goals","anti-meta"], 4,
      p => p.promoted === true && p.goals >= 5
    ),
    makePrompt(
      "fwd_relegated_5goals", "FWD",
      "Forward from a relegated club with at least five goals",
      "That forward must play for a relegated club and score at least five goals.",
      "medium", ["relegated","goals","anti-meta"], 5,
      p => p.relegated === true && p.goals >= 5
    ),
    makePrompt(
      "fwd_bottomhalf_12gi", "FWD",
      "Forward from a bottom-half club with 12+ goal involvements",
      "That forward’s club must finish in the bottom half and the season must include at least 12 goals plus assists.",
      "medium", ["bottom-half","goal-involvements","anti-meta"], 5,
      p => p.bottomHalf === true && (p.goals + p.assists) >= 12
    ),
    makePrompt(
      "fwd_midtable_12gi", "FWD",
      "Forward from a club finishing 7th–12th with 12+ goal involvements",
      "That forward’s club must finish 7th–12th and the season must include at least 12 goals plus assists.",
      "medium", ["mid-table","goal-involvements","anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && (p.goals + p.assists) >= 12
    ),
    makePrompt(
      "fwd_survival_8goals", "FWD",
      "Forward from a club finishing 13th–17th with at least eight goals",
      "That forward’s club must finish 13th–17th and the player must score at least eight goals.",
      "medium", ["survival","goals","anti-meta"], 5,
      p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.goals >= 8
    ),
    makePrompt(
      "fwd_exact10g5a", "FWD",
      "Forward with exactly 10 goals and at least five assists",
      "That forward season must include exactly 10 goals and at least five assists.",
      "hard", ["exact-stat","goals","assists"], 4,
      p => p.goals === 10 && p.assists >= 5
    ),
    makePrompt(
      "fwd_9goals_zero_assists", "FWD",
      "Forward with 9+ goals and no assists",
      "That forward season must include at least nine goals and no assists.",
      "hard", ["goals","zero-assists","anti-meta"], 5,
      p => p.goals >= 9 && p.assists === 0
    ),
    makePrompt(
      "fwd_assists_gt_goals_80", "FWD",
      "Forward with more assists than goals and at least 80 FPL points",
      "That forward season must include more assists than goals and at least 80 FPL points.",
      "hard", ["assists","points","anti-meta"], 5,
      p => p.assists > p.goals && p.points >= 80
    ),
    makePrompt(
      "fwd_outside_big6_5assists", "FWD",
      "Forward outside the traditional Big Six with at least five assists",
      "That forward must play outside the traditional Big Six and record at least five assists.",
      "medium", ["outside-big-six","assists","anti-meta"], 5,
      p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.assists >= 5
    ),
    makePrompt(
      "fwd_2000_15gi", "FWD",
      "Forward with 2,000+ minutes and 15+ goal involvements",
      "That forward season must include at least 2,000 minutes and 15 goals plus assists.",
      "easy", ["minutes","goal-involvements"], 4,
      p => p.minutes >= 2000 && (p.goals + p.assists) >= 15
    ),
    makePrompt(
      "fwd_1500_10bonus", "FWD",
      "Forward with 1,500+ minutes and at least 10 bonus points",
      "That forward season must include at least 1,500 minutes and 10 bonus points.",
      "easy", ["minutes","bonus"], 4,
      p => p.minutes >= 1500 && p.bonus >= 10
    ),
    makePrompt(
      "fwd_hodgson_5goals", "FWD",
      "Forward managed by Roy Hodgson with at least five goals",
      "That forward season must be managed by Roy Hodgson and include at least five goals.",
      "hard", ["manager","Roy Hodgson","goals","anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Roy Hodgson") && p.goals >= 5
    ),
    makePrompt(
      "fwd_howe_6goals", "FWD",
      "Forward managed by Eddie Howe with at least six goals",
      "That forward season must be managed by Eddie Howe and include at least six goals.",
      "medium", ["manager","Eddie Howe","goals"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Eddie Howe") && p.goals >= 6
    ),
    makePrompt(
      "fwd_nuno_7goals", "FWD",
      "Forward managed by Nuno Espírito Santo with at least seven goals",
      "That forward season must be managed by Nuno Espírito Santo and include at least seven goals.",
      "hard", ["manager","Nuno Espírito Santo","goals","anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Nuno Espírito Santo") && p.goals >= 7
    ),
    makePrompt(
      "fwd_marco_silva_5goals", "FWD",
      "Forward managed by Marco Silva with at least five goals",
      "That forward season must be managed by Marco Silva and include at least five goals.",
      "medium", ["manager","Marco Silva","goals"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Marco Silva") && p.goals >= 5
    )
  ];

  window.FPL_RECENT_PROMPT_IDS = [
    "gk_survival_saves",
    "def_moyes_minutes",
    "def_creator_outside_big_six",
    "def_midtable_minutes",
    "def_budget_clean_sheets",
    "mid_relegated_involvements",
    "mid_creator_outside_big_six",
    "mid_midtable_exact_five",
    "mid_budget_involvements",
    "fwd_promoted_goals",
    "fwd_exact_ten_outside_big_six"
  ];
})();
