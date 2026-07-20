/* FPL Challenge Studio prompt library — Phase 2. */
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
      "Goalkeeper managed by Sean Dyche with at least 100 saves",
      "That goalkeeper season must be managed by Sean Dyche and include at least 100 saves.",
      "hard", ["manager", "Sean Dyche", "saves", "anti-meta"], 4,
      p => Array.isArray(p.managers) && p.managers.includes("Sean Dyche") && p.saves >= 100
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
      "Defender who started at £4.5m or less and played at least 2,500 minutes",
      "That defender must start at £4.5m or less and play at least 2,500 minutes.",
      "easy", ["budget", "minutes"], 4,
      p => p.startingPrice <= 4.5 && p.minutes >= 2500
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
      "Midfielder outside the traditional Big Six who started below £6.0m and had 8+ goal involvements",
      "That midfielder must be outside the traditional Big Six, start below £6.0m and record at least eight combined goals and assists.",
      "medium", ["outside-big-six", "budget", "goal-involvements", "anti-meta"], 5,
      p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.startingPrice < 6 && (p.goals + p.assists) >= 8
    ),
    makePrompt(
      "mid_more_assists_than_goals_100", "MID",
      "Midfielder with more assists than goals and at least 100 FPL points",
      "That midfielder season must have more assists than goals and score at least 100 FPL points.",
      "easy", ["assists", "points"], 4,
      p => p.assists > p.goals && p.points >= 100
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
      "Midfielder with at least six assists and more assists than goals",
      "That midfielder season must record at least six assists and more assists than goals.",
      "easy", ["assists"], 4,
      p => p.assists >= 6 && p.assists > p.goals
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
