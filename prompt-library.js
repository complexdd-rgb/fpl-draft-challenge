/* FPL Challenge Studio prompt library — exported by Phase 5.
   Disabled prompts remain stored but are ignored by the generator. */
(() => {
  "use strict";

  window.FPL_PROMPT_LIBRARY = [
    {
      id: "gk_relegated_100_saves",
      position: "GK",
      label: "Goalkeeper from a relegated club with at least 100 saves",
      fail: "That goalkeeper season must be for a relegated club and include at least 100 saves.",
      difficulty: "medium",
      tags: ["relegated","saves","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.relegated === true && p.saves >= 100
    },
    {
      id: "gk_survival_saves",
      position: "GK",
      label: "Goalkeeper whose club finished 13th–17th with at least 100 saves",
      fail: "That goalkeeper's club must have finished 13th–17th and the season must include at least 100 saves.",
      difficulty: "medium",
      tags: ["survival","saves","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.saves >= 100
    },
    {
      id: "gk_promoted_90_points",
      position: "GK",
      label: "Goalkeeper from a promoted club with at least 90 FPL points",
      fail: "That goalkeeper must play for a promoted club and score at least 90 FPL points.",
      difficulty: "medium",
      tags: ["promoted","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && p.points >= 90
    },
    {
      id: "gk_bottom_half_10_bonus",
      position: "GK",
      label: "Goalkeeper from a bottom-half club with at least 10 bonus points",
      fail: "That goalkeeper's club must finish in the bottom half and the season must include at least 10 bonus points.",
      difficulty: "medium",
      tags: ["bottom-half","bonus","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && p.bonus >= 10
    },
    {
      id: "gk_budget_100_points",
      position: "GK",
      label: "Goalkeeper who started at £4.5m or less and scored 100+ points",
      fail: "That goalkeeper must start at £4.5m or less and score at least 100 FPL points.",
      difficulty: "easy",
      tags: ["budget","points"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.startingPrice <= 4.5 && p.points >= 100
    },
    {
      id: "gk_non_top_four_10_cs",
      position: "GK",
      label: "Goalkeeper outside the top four with at least 10 clean sheets",
      fail: "That goalkeeper's club must finish outside the top four and record at least 10 clean sheets.",
      difficulty: "medium",
      tags: ["outside-top-four","clean-sheets","anti-meta"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => p.topFour !== true && p.cleanSheets >= 10
    },
    {
      id: "gk_120_saves_under_5",
      position: "GK",
      label: "Goalkeeper with 120+ saves who started below £5.0m",
      fail: "That goalkeeper season must include at least 120 saves and a starting price below £5.0m.",
      difficulty: "medium",
      tags: ["saves","budget","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.saves >= 120 && p.startingPrice < 5
    },
    {
      id: "gk_age_25_under_100",
      position: "GK",
      label: "Goalkeeper aged 25 or under with at least 100 FPL points",
      fail: "That goalkeeper must be aged 25 or under at the season start and score at least 100 FPL points.",
      difficulty: "hard",
      tags: ["young","points"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 25 && p.points >= 100
    },
    {
      id: "gk_sean_dyche_100_saves",
      position: "GK",
      label: "Goalkeeper managed by Sean Dyche",
      fail: "That goalkeeper season must be managed by Sean Dyche.",
      difficulty: "medium",
      tags: ["manager","sean dyche","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Sean Dyche")
    },
    {
      id: "gk_midtable_10_cs",
      position: "GK",
      label: "Goalkeeper from a club finishing 7th–12th with 10+ clean sheets",
      fail: "That goalkeeper's club must finish 7th–12th and record at least 10 clean sheets.",
      difficulty: "medium",
      tags: ["mid-table","clean-sheets","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.cleanSheets >= 10
    },
    {
      id: "gk_5_clean_120_saves",
      position: "GK",
      label: "Goalkeeper with 5+ clean sheets and at least 120 saves",
      fail: "That goalkeeper season must include at least five clean sheets and 120 saves.",
      difficulty: "medium",
      tags: ["saves","clean-sheets","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.cleanSheets >= 5 && p.saves >= 120
    },
    {
      id: "gk_exact_10_cs_outside_big_six",
      position: "GK",
      label: "Goalkeeper outside the traditional Big Six with exactly 10 clean sheets",
      fail: "That goalkeeper must play outside the traditional Big Six and record exactly 10 clean sheets.",
      difficulty: "hard",
      tags: ["outside-big-six","exact-stat","clean-sheets","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.cleanSheets === 10
    },
    {
      id: "def_moyes_minutes",
      position: "DEF",
      label: "Defender managed by David Moyes who played at least 2,000 minutes",
      fail: "That defender season must be managed by David Moyes and include at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["manager","David Moyes","minutes","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("David Moyes") && p.minutes >= 2000
    },
    {
      id: "def_creator_outside_big_six",
      position: "DEF",
      label: "Defender outside the traditional Big Six with 5+ assists and more assists than goals",
      fail: "That defender must be outside the traditional Big Six, record at least five assists and have more assists than goals.",
      difficulty: "medium",
      tags: ["outside-big-six","assists","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.assists >= 5 && p.assists > p.goals
    },
    {
      id: "def_midtable_minutes",
      position: "DEF",
      label: "Defender from a club finishing 7th–12th who played at least 2,500 minutes",
      fail: "That defender's club must finish 7th–12th and the season must include at least 2,500 minutes.",
      difficulty: "medium",
      tags: ["mid-table","minutes","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.minutes >= 2500
    },
    {
      id: "def_budget_clean_sheets",
      position: "DEF",
      label: "Defender outside the traditional Big Six who started at £4.5m or less and kept 10+ clean sheets",
      fail: "That defender must be outside the traditional Big Six, start at £4.5m or less and record at least 10 clean sheets.",
      difficulty: "hard",
      tags: ["outside-big-six","budget","clean-sheets","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.startingPrice <= 4.5 && p.cleanSheets >= 10
    },
    {
      id: "def_promoted_80_points",
      position: "DEF",
      label: "Defender from a promoted club with at least 80 FPL points",
      fail: "That defender must play for a promoted club and score at least 80 FPL points.",
      difficulty: "easy",
      tags: ["promoted","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && p.points >= 80
    },
    {
      id: "def_relegated_3_assists",
      position: "DEF",
      label: "Defender from a relegated club with at least three assists",
      fail: "That defender must play for a relegated club and record at least three assists.",
      difficulty: "hard",
      tags: ["relegated","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.relegated === true && p.assists >= 3
    },
    {
      id: "def_bottom_half_100_points",
      position: "DEF",
      label: "Defender from a bottom-half club with at least 100 FPL points",
      fail: "That defender's club must finish in the bottom half and the season must score at least 100 FPL points.",
      difficulty: "medium",
      tags: ["bottom-half","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && p.points >= 100
    },
    {
      id: "def_non_big_six_10_cs",
      position: "DEF",
      label: "Defender outside the traditional Big Six with at least 10 clean sheets",
      fail: "That defender must play outside the traditional Big Six and record at least 10 clean sheets.",
      difficulty: "easy",
      tags: ["outside-big-six","clean-sheets","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.cleanSheets >= 10
    },
    {
      id: "def_age_u23_2000",
      position: "DEF",
      label: "Defender aged 23 or under who played at least 2,000 minutes",
      fail: "That defender must be aged 23 or under at the season start and play at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["young","minutes"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 23 && p.minutes >= 2000
    },
    {
      id: "def_exact_3_goals_midtable",
      position: "DEF",
      label: "Defender from a club finishing 7th–12th who scored exactly three goals",
      fail: "That defender's club must finish 7th–12th and the player must score exactly three goals.",
      difficulty: "hard",
      tags: ["mid-table","exact-stat","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.goals === 3
    },
    {
      id: "def_assists_gt_goals_5",
      position: "DEF",
      label: "Defender with 5+ assists and more assists than goals",
      fail: "That defender season must record at least five assists and more assists than goals.",
      difficulty: "easy",
      tags: ["assists"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.assists >= 5 && p.assists > p.goals
    },
    {
      id: "def_budget_2500_minutes",
      position: "DEF",
      label: "Defender who started at £4.5m or less and played at least 3,000 minutes",
      fail: "That defender must start at £4.5m or less and play at least 3,000 minutes.",
      difficulty: "easy",
      tags: ["budget","minutes"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.startingPrice <= 4.5 && p.minutes >= 3000
    },
    {
      id: "def_sean_dyche_2500",
      position: "DEF",
      label: "Defender managed by Sean Dyche who played at least 2,500 minutes",
      fail: "That defender season must be managed by Sean Dyche and include at least 2,500 minutes.",
      difficulty: "hard",
      tags: ["manager","sean dyche","minutes","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Sean Dyche") && p.minutes >= 2500
    },
    {
      id: "def_pep_under_5m",
      position: "DEF",
      label: "Defender managed by Pep Guardiola who started below £5.0m",
      fail: "That defender season must be managed by Pep Guardiola and have a starting price below £5.0m.",
      difficulty: "hard",
      tags: ["manager","pep guardiola","budget"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Pep Guardiola") && p.startingPrice < 5
    },
    {
      id: "def_top_four_zero_goals_10cs",
      position: "DEF",
      label: "Defender from a top-four club with 10+ clean sheets and no goals",
      fail: "That defender's club must finish in the top four, record at least 10 clean sheets and the player must score no goals.",
      difficulty: "hard",
      tags: ["top-four","clean-sheets","zero-goals"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.topFour === true && p.goals === 0 && p.cleanSheets >= 10
    },
    {
      id: "def_7_12_5assists",
      position: "DEF",
      label: "Defender from a club finishing 7th–12th with at least five assists",
      fail: "That defender's club must finish 7th–12th and the player must record at least five assists.",
      difficulty: "hard",
      tags: ["mid-table","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.assists >= 5
    },
    {
      id: "def_13_17_2500",
      position: "DEF",
      label: "Defender from a club finishing 13th–17th who played at least 2,500 minutes",
      fail: "That defender's club must finish 13th–17th and the season must include at least 2,500 minutes.",
      difficulty: "medium",
      tags: ["survival","minutes","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.minutes >= 2500
    },
    {
      id: "def_8_bonus_bottomhalf",
      position: "DEF",
      label: "Defender from a bottom-half club with at least eight bonus points",
      fail: "That defender's club must finish in the bottom half and the season must include at least eight bonus points.",
      difficulty: "medium",
      tags: ["bottom-half","bonus","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && p.bonus >= 8
    },
    {
      id: "def_yellow_8_100points",
      position: "DEF",
      label: "Defender with eight or more yellow cards and at least 100 FPL points",
      fail: "That defender season must include at least eight yellow cards and 100 FPL points.",
      difficulty: "hard",
      tags: ["cards","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.yellowCards >= 8 && p.points >= 100
    },
    {
      id: "def_promoted_2500",
      position: "DEF",
      label: "Defender from a promoted club who played at least 2,500 minutes",
      fail: "That defender must play for a promoted club and complete at least 2,500 minutes.",
      difficulty: "medium",
      tags: ["promoted","minutes","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && p.minutes >= 2500
    },
    {
      id: "mid_relegated_involvements",
      position: "MID",
      label: "Midfielder from a relegated club with at least five goal involvements",
      fail: "That midfielder must play for a relegated club and record at least five combined goals and assists.",
      difficulty: "medium",
      tags: ["relegated","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.relegated === true && (p.goals + p.assists) >= 5
    },
    {
      id: "mid_creator_outside_big_six",
      position: "MID",
      label: "Midfielder outside the traditional Big Six with 8+ assists and more assists than goals",
      fail: "That midfielder must be outside the traditional Big Six, record at least eight assists and have more assists than goals.",
      difficulty: "hard",
      tags: ["outside-big-six","assists","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.assists >= 8 && p.assists > p.goals
    },
    {
      id: "mid_midtable_exact_five",
      position: "MID",
      label: "Midfielder from a club finishing 8th–12th who scored exactly five goals",
      fail: "That midfielder's club must finish 8th–12th and the player must score exactly five goals.",
      difficulty: "hard",
      tags: ["mid-table","exact-stat","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 8 && p.leaguePosition <= 12 && p.goals === 5
    },
    {
      id: "mid_budget_involvements",
      position: "MID",
      label: "Midfielder outside the traditional Big Six who started below £6.0m and had 10+ goal involvements",
      fail: "That midfielder must be outside the traditional Big Six, start below £6.0m and record at least 10 combined goals and assists.",
      difficulty: "medium",
      tags: ["outside-big-six","budget","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.startingPrice < 6 && (p.goals + p.assists) >= 10
    },
    {
      id: "mid_more_assists_than_goals_100",
      position: "MID",
      label: "Midfielder with more assists than goals and at least 120 FPL points",
      fail: "That midfielder season must have more assists than goals and score at least 120 FPL points.",
      difficulty: "medium",
      tags: ["assists","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.assists > p.goals && p.points >= 120
    },
    {
      id: "mid_promoted_8_involvements",
      position: "MID",
      label: "Midfielder from a promoted club with at least eight goal involvements",
      fail: "That midfielder must play for a promoted club and record at least eight combined goals and assists.",
      difficulty: "medium",
      tags: ["promoted","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && (p.goals + p.assists) >= 8
    },
    {
      id: "mid_bottomhalf_10_goals",
      position: "MID",
      label: "Midfielder from a bottom-half club with at least 10 goals",
      fail: "That midfielder's club must finish in the bottom half and the player must score at least 10 goals.",
      difficulty: "hard",
      tags: ["bottom-half","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && p.goals >= 10
    },
    {
      id: "mid_non_big_six_10assists",
      position: "MID",
      label: "Midfielder outside the traditional Big Six with at least 10 assists",
      fail: "That midfielder must play outside the traditional Big Six and record at least 10 assists.",
      difficulty: "hard",
      tags: ["outside-big-six","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.assists >= 10
    },
    {
      id: "mid_age_u23_2000",
      position: "MID",
      label: "Midfielder aged 23 or under who played at least 2,000 minutes",
      fail: "That midfielder must be aged 23 or under at the season start and play at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["young","minutes"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 23 && p.minutes >= 2000
    },
    {
      id: "mid_exact_7_goals_7_12",
      position: "MID",
      label: "Midfielder from a club finishing 7th–12th who scored exactly seven goals",
      fail: "That midfielder's club must finish 7th–12th and the player must score exactly seven goals.",
      difficulty: "hard",
      tags: ["mid-table","exact-stat","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.goals === 7
    },
    {
      id: "mid_2500_minutes_under_5goals",
      position: "MID",
      label: "Midfielder with 2,500+ minutes, fewer than five goals and at least five assists",
      fail: "That midfielder must play at least 2,500 minutes, score fewer than five goals and record at least five assists.",
      difficulty: "hard",
      tags: ["minutes","low-goals","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.minutes >= 2500 && p.goals < 5 && p.assists >= 5
    },
    {
      id: "mid_sean_dyche_5involvements",
      position: "MID",
      label: "Midfielder managed by Sean Dyche with at least five goal involvements",
      fail: "That midfielder season must be managed by Sean Dyche and include at least five combined goals and assists.",
      difficulty: "hard",
      tags: ["manager","Sean Dyche","goal-involvements","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Sean Dyche") && (p.goals + p.assists) >= 5
    },
    {
      id: "mid_moyes_100points",
      position: "MID",
      label: "Midfielder managed by David Moyes with at least 100 FPL points",
      fail: "That midfielder season must be managed by David Moyes and score at least 100 FPL points.",
      difficulty: "medium",
      tags: ["manager","David Moyes","points","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("David Moyes") && p.points >= 100
    },
    {
      id: "mid_relegated_100points",
      position: "MID",
      label: "Midfielder from a relegated club with at least 100 FPL points",
      fail: "That midfielder must play for a relegated club and score at least 100 FPL points.",
      difficulty: "hard",
      tags: ["relegated","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.relegated === true && p.points >= 100
    },
    {
      id: "mid_budget_120points",
      position: "MID",
      label: "Midfielder who started at £5.5m or less and scored 120+ FPL points",
      fail: "That midfielder must start at £5.5m or less and score at least 120 FPL points.",
      difficulty: "easy",
      tags: ["budget","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.startingPrice <= 5.5 && p.points >= 120
    },
    {
      id: "mid_assists_gt_goals_6",
      position: "MID",
      label: "Midfielder with at least eight assists and more assists than goals",
      fail: "That midfielder season must record at least eight assists and more assists than goals.",
      difficulty: "medium",
      tags: ["assists"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.assists >= 8 && p.assists > p.goals
    },
    {
      id: "mid_topfour_under6_100points",
      position: "MID",
      label: "Midfielder from a top-four club who started below £6.0m and scored 100+ points",
      fail: "That midfielder's club must finish in the top four, the starting price must be below £6.0m and the season must score at least 100 points.",
      difficulty: "hard",
      tags: ["top-four","budget","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.topFour === true && p.startingPrice < 6 && p.points >= 100
    },
    {
      id: "mid_13_17_8involvements",
      position: "MID",
      label: "Midfielder from a club finishing 13th–17th with at least eight goal involvements",
      fail: "That midfielder's club must finish 13th–17th and the player must record at least eight combined goals and assists.",
      difficulty: "medium",
      tags: ["survival","goal-involvements","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && (p.goals + p.assists) >= 8
    },
    {
      id: "mid_10_clean_5involvements_bottomhalf",
      position: "MID",
      label: "Midfielder from a bottom-half club with 10+ clean sheets and five goal involvements",
      fail: "That midfielder's club must finish in the bottom half, record at least 10 clean sheets and the player must have at least five combined goals and assists.",
      difficulty: "hard",
      tags: ["bottom-half","clean-sheets","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && p.cleanSheets >= 10 && (p.goals + p.assists) >= 5
    },
    {
      id: "mid_promoted_100",
      position: "MID",
      label: "Midfielder from a promoted club with at least 100 FPL points",
      fail: "That midfielder must play for a promoted club and score at least 100 FPL points.",
      difficulty: "medium",
      tags: ["promoted","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && p.points >= 100
    },
    {
      id: "fwd_promoted_goals",
      position: "FWD",
      label: "Forward from a promoted club who scored at least 10 goals",
      fail: "That forward must play for a promoted club and score at least 10 goals.",
      difficulty: "hard",
      tags: ["promoted","goals","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && p.goals >= 10
    },
    {
      id: "fwd_exact_ten_outside_big_six",
      position: "FWD",
      label: "Forward outside the traditional Big Six who scored exactly 10 goals",
      fail: "That forward must play outside the traditional Big Six and score exactly 10 goals.",
      difficulty: "hard",
      tags: ["outside-big-six","exact-stat","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.goals === 10
    },
    {
      id: "fwd_relegated_8goals",
      position: "FWD",
      label: "Forward from a relegated club who scored at least eight goals",
      fail: "That forward must play for a relegated club and score at least eight goals.",
      difficulty: "hard",
      tags: ["relegated","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.relegated === true && p.goals >= 8
    },
    {
      id: "fwd_bottomhalf_12goals",
      position: "FWD",
      label: "Forward from a bottom-half club who scored at least 12 goals",
      fail: "That forward's club must finish in the bottom half and the player must score at least 12 goals.",
      difficulty: "hard",
      tags: ["bottom-half","goals","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && p.goals >= 12
    },
    {
      id: "fwd_budget_120points",
      position: "FWD",
      label: "Forward who started at £6.5m or less and scored 120+ FPL points",
      fail: "That forward must start at £6.5m or less and score at least 120 FPL points.",
      difficulty: "easy",
      tags: ["budget","points"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.startingPrice <= 6.5 && p.points >= 120
    },
    {
      id: "fwd_non_big_six_150points",
      position: "FWD",
      label: "Forward outside the traditional Big Six with at least 150 FPL points",
      fail: "That forward must play outside the traditional Big Six and score at least 150 FPL points.",
      difficulty: "medium",
      tags: ["outside-big-six","points","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.points >= 150
    },
    {
      id: "fwd_age_u23_10goals",
      position: "FWD",
      label: "Forward aged 23 or under who scored at least 10 goals",
      fail: "That forward must be aged 23 or under at the season start and score at least 10 goals.",
      difficulty: "medium",
      tags: ["young","goals"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 23 && p.goals >= 10
    },
    {
      id: "fwd_midtable_10goals",
      position: "FWD",
      label: "Forward from a club finishing 7th–12th who scored at least 10 goals",
      fail: "That forward's club must finish 7th–12th and the player must score at least 10 goals.",
      difficulty: "medium",
      tags: ["mid-table","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.goals >= 10
    },
    {
      id: "fwd_5assists_10goals_outside",
      position: "FWD",
      label: "Forward outside the traditional Big Six with 10+ goals and five assists",
      fail: "That forward must play outside the traditional Big Six, score at least 10 goals and record at least five assists.",
      difficulty: "hard",
      tags: ["outside-big-six","goals","assists","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.goals >= 10 && p.assists >= 5
    },
    {
      id: "fwd_moyes_8goals",
      position: "FWD",
      label: "Forward managed by David Moyes who scored at least eight goals",
      fail: "That forward season must be managed by David Moyes and include at least eight goals.",
      difficulty: "hard",
      tags: ["manager","david moyes","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("David Moyes") && p.goals >= 8
    },
    {
      id: "fwd_sean_dyche_8goals",
      position: "FWD",
      label: "Forward managed by Sean Dyche who scored at least eight goals",
      fail: "That forward season must be managed by Sean Dyche and include at least eight goals.",
      difficulty: "hard",
      tags: ["manager","Sean Dyche","goals","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Sean Dyche") && p.goals >= 8
    },
    {
      id: "fwd_promoted_100points",
      position: "FWD",
      label: "Forward from a promoted club with at least 100 FPL points",
      fail: "That forward must play for a promoted club and score at least 100 FPL points.",
      difficulty: "medium",
      tags: ["promoted","points","anti-meta"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && p.points >= 100
    },
    {
      id: "fwd_13_17_10goals",
      position: "FWD",
      label: "Forward from a club finishing 13th–17th who scored at least 10 goals",
      fail: "That forward's club must finish 13th–17th and the player must score at least 10 goals.",
      difficulty: "medium",
      tags: ["survival","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.goals >= 10
    },
    {
      id: "fwd_exact15_outside_big_six",
      position: "FWD",
      label: "Forward outside the traditional Big Six who scored exactly 15 goals",
      fail: "That forward must play outside the traditional Big Six and score exactly 15 goals.",
      difficulty: "hard",
      tags: ["outside-big-six","exact-stat","goals","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs"].includes(p.club) && p.goals === 15
    },
    {
      id: "fwd_2000min_10goals",
      position: "FWD",
      label: "Forward who played at least 2,000 minutes and scored 10+ goals",
      fail: "That forward must play at least 2,000 minutes and score at least 10 goals.",
      difficulty: "easy",
      tags: ["minutes","goals"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => p.minutes >= 2000 && p.goals >= 10
    },
    {
      id: "gk_surname_m",
      position: "GK",
      label: "Goalkeeper whose surname starts with M",
      fail: "That goalkeeper’s surname must start with M.",
      difficulty: "easy",
      tags: ["name-rule","surname","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("m")); }
    },
    {
      id: "gk_surname_s",
      position: "GK",
      label: "Goalkeeper whose surname starts with S",
      fail: "That goalkeeper’s surname must start with S.",
      difficulty: "easy",
      tags: ["name-rule","surname","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("s")); }
    },
    {
      id: "gk_firstname_j_70",
      position: "GK",
      label: "Goalkeeper whose first name starts with J and scored 70+ points",
      fail: "That goalkeeper’s first name must start with J and the season must score at least 70 FPL points.",
      difficulty: "medium",
      tags: ["name-rule","first-name","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__first.startsWith("j") && p.points >= 70); }
    },
    {
      id: "gk_same_initials_50",
      position: "GK",
      label: "Goalkeeper whose first name and surname share an initial with 50+ points",
      fail: "That goalkeeper’s first name and surname must share an initial and the season must score at least 50 points.",
      difficulty: "hard",
      tags: ["name-rule","same-initials","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__tokens.length > 1 && __first[0] && __first[0] === __surname[0] && p.points >= 50); }
    },
    {
      id: "gk_surname_son",
      position: "GK",
      label: "Goalkeeper whose surname ends in “son”",
      fail: "That goalkeeper’s surname must end in “son”.",
      difficulty: "hard",
      tags: ["name-rule","surname","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.endsWith("son")); }
    },
    {
      id: "gk_age_30_100",
      position: "GK",
      label: "Goalkeeper aged 30 or over with at least 100 FPL points",
      fail: "That goalkeeper must be aged 30 or over at the season start and score at least 100 points.",
      difficulty: "medium",
      tags: ["age","veteran","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 30 && p.points >= 100
    },
    {
      id: "gk_age_u24_80",
      position: "GK",
      label: "Goalkeeper aged 23 or under with at least 80 FPL points",
      fail: "That goalkeeper must be aged 23 or under at the season start and score at least 80 points.",
      difficulty: "hard",
      tags: ["age","young","points"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 23 && p.points >= 80
    },
    {
      id: "gk_bottomhalf_120_saves",
      position: "GK",
      label: "Goalkeeper from a bottom-half club with 120+ saves",
      fail: "That goalkeeper’s club must finish in the bottom half and the season must include at least 120 saves.",
      difficulty: "medium",
      tags: ["bottom-half","saves","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && p.saves >= 120
    },
    {
      id: "gk_midtable_100_saves",
      position: "GK",
      label: "Goalkeeper from a club finishing 7th–12th with 100+ saves",
      fail: "That goalkeeper’s club must finish 7th–12th and the season must include at least 100 saves.",
      difficulty: "medium",
      tags: ["mid-table","saves","anti-meta"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.saves >= 100
    },
    {
      id: "gk_survival_10_bonus",
      position: "GK",
      label: "Goalkeeper from a club finishing 13th–17th with 10+ bonus points",
      fail: "That goalkeeper’s club must finish 13th–17th and the season must include at least 10 bonus points.",
      difficulty: "medium",
      tags: ["survival","bonus","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.bonus >= 10
    },
    {
      id: "gk_budget_10_bonus",
      position: "GK",
      label: "Goalkeeper who started at £4.5m or less with 10+ bonus points",
      fail: "That goalkeeper must start at £4.5m or less and earn at least 10 bonus points.",
      difficulty: "easy",
      tags: ["budget","bonus"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.startingPrice <= 4.5 && p.bonus >= 10
    },
    {
      id: "gk_final_45_100",
      position: "GK",
      label: "Goalkeeper who finished at £4.5m or less with 100+ points",
      fail: "That goalkeeper must finish at £4.5m or less and score at least 100 FPL points.",
      difficulty: "easy",
      tags: ["budget","final-price","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.finalPrice <= 4.5 && p.points >= 100
    },
    {
      id: "gk_zero_yellows_100_saves",
      position: "GK",
      label: "Goalkeeper with no yellow cards and at least 100 saves",
      fail: "That goalkeeper season must include no yellow cards and at least 100 saves.",
      difficulty: "medium",
      tags: ["discipline","saves"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.yellowCards === 0 && p.saves >= 100
    },
    {
      id: "gk_assist_80_points",
      position: "GK",
      label: "Goalkeeper with an assist and at least 80 FPL points",
      fail: "That goalkeeper season must include at least one assist and 80 FPL points.",
      difficulty: "hard",
      tags: ["assists","points","anti-meta"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => p.assists >= 1 && p.points >= 80
    },
    {
      id: "gk_3000_10cs_outside_top4",
      position: "GK",
      label: "Goalkeeper outside the top four with 3,000+ minutes and 10+ clean sheets",
      fail: "That goalkeeper’s club must finish outside the top four with at least 3,000 minutes and 10 clean sheets.",
      difficulty: "hard",
      tags: ["outside-top-four","minutes","clean-sheets"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => p.topFour !== true && p.minutes >= 3000 && p.cleanSheets >= 10
    },
    {
      id: "gk_hodgson_40_saves",
      position: "GK",
      label: "Goalkeeper managed by Roy Hodgson with at least 40 saves",
      fail: "That goalkeeper season must be managed by Roy Hodgson and include at least 40 saves.",
      difficulty: "hard",
      tags: ["manager","Roy Hodgson","saves","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Roy Hodgson") && p.saves >= 40
    },
    {
      id: "gk_howe_20_saves",
      position: "GK",
      label: "Goalkeeper managed by Eddie Howe with at least 20 saves",
      fail: "That goalkeeper season must be managed by Eddie Howe and include at least 20 saves.",
      difficulty: "hard",
      tags: ["manager","eddie howe","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Eddie Howe") && p.saves >= 20
    },
    {
      id: "gk_exact5cs_80saves",
      position: "GK",
      label: "Goalkeeper with exactly five clean sheets and 80+ saves",
      fail: "That goalkeeper season must include exactly five clean sheets and at least 80 saves.",
      difficulty: "hard",
      tags: ["exact-stat","clean-sheets","saves","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.cleanSheets === 5 && p.saves >= 80
    },
    {
      id: "def_surname_t_1000",
      position: "DEF",
      label: "Defender whose surname starts with T and played 1,000+ minutes",
      fail: "That defender’s surname must start with T and the season must include at least 1,000 minutes.",
      difficulty: "medium",
      tags: ["name-rule","surname","minutes"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("t") && p.minutes >= 1000); }
    },
    {
      id: "def_surname_v_1000",
      position: "DEF",
      label: "Defender whose surname starts with V and played 1,000+ minutes",
      fail: "That defender’s surname must start with V and the season must include at least 1,000 minutes.",
      difficulty: "medium",
      tags: ["name-rule","surname","minutes"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("v") && p.minutes >= 1000); }
    },
    {
      id: "def_firstname_j_2000",
      position: "DEF",
      label: "Defender whose first name starts with J and played 2,000+ minutes",
      fail: "That defender’s first name must start with J and the season must include at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["name-rule","first-name","minutes"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__first.startsWith("j") && p.minutes >= 2000); }
    },
    {
      id: "def_same_initials_1000",
      position: "DEF",
      label: "Defender whose first name and surname share an initial with 1,000+ minutes",
      fail: "That defender’s first name and surname must share an initial and the season must include at least 1,000 minutes.",
      difficulty: "hard",
      tags: ["name-rule","same-initials","minutes","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__tokens.length > 1 && __first[0] && __first[0] === __surname[0] && p.minutes >= 1000); }
    },
    {
      id: "def_hyphenated_1000",
      position: "DEF",
      label: "Defender with a hyphenated surname who played 1,000+ minutes",
      fail: "That defender must have a hyphenated surname and play at least 1,000 minutes.",
      difficulty: "hard",
      tags: ["name-rule","hyphenated","minutes"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.includes("-") && p.minutes >= 1000); }
    },
    {
      id: "def_surname_son_1500",
      position: "DEF",
      label: "Defender whose surname ends in “son” and played 1,500+ minutes",
      fail: "That defender’s surname must end in “son” and the season must include at least 1,500 minutes.",
      difficulty: "hard",
      tags: ["name-rule","surname","minutes"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.endsWith("son") && p.minutes >= 1500); }
    },
    {
      id: "def_surname_10letters_2000",
      position: "DEF",
      label: "Defender with a surname of 10+ letters who played 2,000+ minutes",
      fail: "That defender’s surname must contain at least 10 letters and the season must include 2,000 minutes.",
      difficulty: "hard",
      tags: ["name-rule","name-length","minutes"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__letters(__surname) >= 10 && p.minutes >= 2000); }
    },
    {
      id: "def_longname_100points",
      position: "DEF",
      label: "Defender with 16+ letters in their full name and 100+ points",
      fail: "That defender’s full name must contain at least 16 letters and the season must score 100 FPL points.",
      difficulty: "hard",
      tags: ["name-rule","name-length","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__letters(__raw) >= 16 && p.points >= 100); }
    },
    {
      id: "def_age30_2500",
      position: "DEF",
      label: "Defender aged 30 or over who played 2,700+ minutes",
      fail: "That defender must be aged 30 or over at the season start and play at least 2,700 minutes.",
      difficulty: "medium",
      tags: ["age","veteran","minutes"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 30 && p.minutes >= 2500
    },
    {
      id: "def_age_u21_1000",
      position: "DEF",
      label: "Defender aged 20 or under who played 1,000+ minutes",
      fail: "That defender must be aged 20 or under at the season start and play at least 1,000 minutes.",
      difficulty: "hard",
      tags: ["age","young","minutes"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 20 && p.minutes >= 1000
    },
    {
      id: "def_start_40_1500",
      position: "DEF",
      label: "Defender who started at £4.0m or less and played 1,500+ minutes",
      fail: "That defender must start at £4.0m or less and play at least 1,500 minutes.",
      difficulty: "medium",
      tags: ["budget","minutes","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.startingPrice <= 4 && p.minutes >= 1500
    },
    {
      id: "def_final_45_2700",
      position: "DEF",
      label: "Defender who finished at £4.5m or less and played 2,700+ minutes",
      fail: "That defender must finish at £4.5m or less and play at least 2,700 minutes.",
      difficulty: "easy",
      tags: ["budget","final-price","minutes"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.finalPrice <= 4.5 && p.minutes >= 2700
    },
    {
      id: "def_zero_goals_5assists",
      position: "DEF",
      label: "Defender with no goals and at least five assists",
      fail: "That defender season must include no goals and at least five assists.",
      difficulty: "easy",
      tags: ["assists","zero-goals"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.goals === 0 && p.assists >= 5
    },
    {
      id: "def_onegoal_10cs",
      position: "DEF",
      label: "Defender with exactly one goal and at least 10 clean sheets",
      fail: "That defender season must include exactly one goal and at least 10 clean sheets.",
      difficulty: "medium",
      tags: ["exact-stat","goals","clean-sheets"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.goals === 1 && p.cleanSheets >= 10
    },
    {
      id: "def_bottomhalf_2g2a",
      position: "DEF",
      label: "Defender from a bottom-half club with 2+ goals and 2+ assists",
      fail: "That defender’s club must finish in the bottom half with at least two goals and two assists.",
      difficulty: "hard",
      tags: ["bottom-half","goals","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && p.goals >= 2 && p.assists >= 2
    },
    {
      id: "def_10yellows_2000",
      position: "DEF",
      label: "Defender with 10+ yellow cards who played 2,000+ minutes",
      fail: "That defender season must include at least 10 yellow cards and 2,000 minutes.",
      difficulty: "hard",
      tags: ["cards","minutes","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.yellowCards >= 10 && p.minutes >= 2000
    },
    {
      id: "def_promoted_5cs",
      position: "DEF",
      label: "Defender from a promoted club with at least five clean sheets",
      fail: "That defender must play for a promoted club and record at least five clean sheets.",
      difficulty: "easy",
      tags: ["promoted","clean-sheets","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && p.cleanSheets >= 5
    },
    {
      id: "def_relegated_5cs",
      position: "DEF",
      label: "Defender from a relegated club with at least five clean sheets",
      fail: "That defender must play for a relegated club and record at least five clean sheets.",
      difficulty: "medium",
      tags: ["relegated","clean-sheets","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.relegated === true && p.cleanSheets >= 5
    },
    {
      id: "def_survival_4assists",
      position: "DEF",
      label: "Defender from a club finishing 13th–17th with 4+ assists",
      fail: "That defender’s club must finish 13th–17th and the season must include at least four assists.",
      difficulty: "hard",
      tags: ["survival","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.assists >= 4
    },
    {
      id: "def_midtable_2goals",
      position: "DEF",
      label: "Defender from a club finishing 7th–12th with at least two goals",
      fail: "That defender’s club must finish 7th–12th and the player must score at least two goals.",
      difficulty: "medium",
      tags: ["mid-table","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && p.goals >= 2
    },
    {
      id: "def_arteta_2000",
      position: "DEF",
      label: "Defender managed by Mikel Arteta who played 2,000+ minutes",
      fail: "That defender season must be managed by Mikel Arteta and include at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["manager","mikel arteta","minutes"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Mikel Arteta") && p.minutes >= 2000
    },
    {
      id: "def_klopp_2000",
      position: "DEF",
      label: "Defender managed by Jürgen Klopp who played 2,000+ minutes",
      fail: "That defender season must be managed by Jürgen Klopp and include at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["manager","jürgen klopp","minutes"],
      rating: 1,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Jürgen Klopp") && p.minutes >= 2000
    },
    {
      id: "def_hodgson_2000",
      position: "DEF",
      label: "Defender managed by Roy Hodgson who played 2,000+ minutes",
      fail: "That defender season must be managed by Roy Hodgson and include at least 2,000 minutes.",
      difficulty: "hard",
      tags: ["manager","Roy Hodgson","minutes","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Roy Hodgson") && p.minutes >= 2000
    },
    {
      id: "def_howe_2000",
      position: "DEF",
      label: "Defender managed by Eddie Howe who played 2,000+ minutes",
      fail: "That defender season must be managed by Eddie Howe and include at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["manager","Eddie Howe","minutes"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Eddie Howe") && p.minutes >= 2000
    },
    {
      id: "def_nuno_2000",
      position: "DEF",
      label: "Defender managed by Nuno Espírito Santo who played 2,000+ minutes",
      fail: "That defender season must be managed by Nuno Espírito Santo and include at least 2,000 minutes.",
      difficulty: "hard",
      tags: ["manager","Nuno Espírito Santo","minutes","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Nuno Espírito Santo") && p.minutes >= 2000
    },
    {
      id: "def_pochettino_1500",
      position: "DEF",
      label: "Defender managed by Mauricio Pochettino who played 1,500+ minutes",
      fail: "That defender season must be managed by Mauricio Pochettino and include at least 1,500 minutes.",
      difficulty: "medium",
      tags: ["manager","mauricio pochettino","minutes"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Mauricio Pochettino") && p.minutes >= 1500
    },
    {
      id: "def_outside_big6_3g3a",
      position: "DEF",
      label: "Defender outside the traditional Big Six with 3+ goals and 3+ assists",
      fail: "That defender must play outside the traditional Big Six and record at least three goals and three assists.",
      difficulty: "hard",
      tags: ["outside-big-six","goals","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.goals >= 3 && p.assists >= 3
    },
    {
      id: "def_top4_5assists",
      position: "DEF",
      label: "Defender from a top-four club with at least five assists",
      fail: "That defender’s club must finish in the top four and the season must include at least five assists.",
      difficulty: "medium",
      tags: ["top-four","assists"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.topFour === true && p.assists >= 5
    },
    {
      id: "def_champion_zero_goal_1500",
      position: "DEF",
      label: "Defender from the champions with no goals and 1,500+ minutes",
      fail: "That defender must play for the champions, score no goals and play at least 1,500 minutes.",
      difficulty: "hard",
      tags: ["champions","zero-goals","minutes"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.champions === true && p.goals === 0 && p.minutes >= 1500
    },
    {
      id: "def_10cs_under5",
      position: "DEF",
      label: "Defender with 10+ clean sheets who started below £5.0m",
      fail: "That defender must start below £5.0m and record at least 10 clean sheets.",
      difficulty: "easy",
      tags: ["budget","clean-sheets"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.startingPrice < 5 && p.cleanSheets >= 10
    },
    {
      id: "def_2500_5bonus_zero_goal",
      position: "DEF",
      label: "Defender with 2,500+ minutes, 5+ bonus points and no goals",
      fail: "That defender season must include 2,500 minutes, at least five bonus points and no goals.",
      difficulty: "medium",
      tags: ["minutes","bonus","zero-goals"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.minutes >= 2500 && p.bonus >= 5 && p.goals === 0
    },
    {
      id: "def_outside_big6_gc30_2000",
      position: "DEF",
      label: "Defender outside the Big Six who played 2,000+ minutes and conceded 30 or fewer",
      fail: "That defender must play outside the traditional Big Six, complete 2,000 minutes and concede no more than 30 goals.",
      difficulty: "hard",
      tags: ["outside-big-six","goals-conceded","minutes","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.minutes >= 2000 && p.goalsConceded <= 30
    },
    {
      id: "def_100pts_6yellows",
      position: "DEF",
      label: "Defender with 100+ points and at least six yellow cards",
      fail: "That defender season must score at least 100 points and include at least six yellow cards.",
      difficulty: "medium",
      tags: ["points","cards"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.points >= 100 && p.yellowCards >= 6
    },
    {
      id: "def_exact4assists_2000",
      position: "DEF",
      label: "Defender with exactly four assists who played 2,000+ minutes",
      fail: "That defender season must include exactly four assists and at least 2,000 minutes.",
      difficulty: "hard",
      tags: ["exact-stat","assists","minutes"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.assists === 4 && p.minutes >= 2000
    },
    {
      id: "def_exact8cs_2000",
      position: "DEF",
      label: "Defender with exactly eight clean sheets who played 2,000+ minutes",
      fail: "That defender season must include exactly eight clean sheets and at least 2,000 minutes.",
      difficulty: "hard",
      tags: ["exact-stat","clean-sheets","minutes"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.cleanSheets === 8 && p.minutes >= 2000
    },
    {
      id: "mid_surname_b_100",
      position: "MID",
      label: "Midfielder whose surname starts with B and scored 100+ points",
      fail: "That midfielder’s surname must start with B and the season must score at least 100 points.",
      difficulty: "medium",
      tags: ["name-rule","surname","points"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("b") && p.points >= 100); }
    },
    {
      id: "mid_surname_d_100",
      position: "MID",
      label: "Midfielder whose surname starts with D and scored 100+ points",
      fail: "That midfielder’s surname must start with D and the season must score at least 100 points.",
      difficulty: "medium",
      tags: ["name-rule","surname","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("d") && p.points >= 100); }
    },
    {
      id: "mid_firstname_j_100",
      position: "MID",
      label: "Midfielder whose first name starts with J and scored 100+ points",
      fail: "That midfielder’s first name must start with J and the season must score at least 100 points.",
      difficulty: "medium",
      tags: ["name-rule","first-name","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__first.startsWith("j") && p.points >= 100); }
    },
    {
      id: "mid_same_initials_100",
      position: "MID",
      label: "Midfielder whose first name and surname share an initial with 100+ points",
      fail: "That midfielder’s first name and surname must share an initial and the season must score at least 100 points.",
      difficulty: "hard",
      tags: ["name-rule","same-initials","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__tokens.length > 1 && __first[0] && __first[0] === __surname[0] && p.points >= 100); }
    },
    {
      id: "mid_hyphenated_80",
      position: "MID",
      label: "Midfielder with a hyphenated surname who scored 80+ points",
      fail: "That midfielder must have a hyphenated surname and score at least 80 points.",
      difficulty: "hard",
      tags: ["name-rule","hyphenated","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.includes("-") && p.points >= 80); }
    },
    {
      id: "mid_surname_son_100",
      position: "MID",
      label: "Midfielder whose surname ends in “son” with 100+ points",
      fail: "That midfielder’s surname must end in “son” and the season must score at least 100 points.",
      difficulty: "hard",
      tags: ["name-rule","surname","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.endsWith("son") && p.points >= 100); }
    },
    {
      id: "mid_surname_10letters_100",
      position: "MID",
      label: "Midfielder with a surname of 10+ letters and 100+ points",
      fail: "That midfielder’s surname must contain at least 10 letters and the season must score 100 points.",
      difficulty: "hard",
      tags: ["name-rule","name-length","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__letters(__surname) >= 10 && p.points >= 100); }
    },
    {
      id: "mid_longname_120",
      position: "MID",
      label: "Midfielder with 16+ letters in their full name and 120+ points",
      fail: "That midfielder’s full name must contain at least 16 letters and the season must score at least 120 points.",
      difficulty: "hard",
      tags: ["name-rule","name-length","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__letters(__raw) >= 16 && p.points >= 120); }
    },
    {
      id: "mid_age_u21_80",
      position: "MID",
      label: "Midfielder aged 20 or under with at least 80 FPL points",
      fail: "That midfielder must be aged 20 or under at the season start and score at least 80 points.",
      difficulty: "hard",
      tags: ["age","young","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 20 && p.points >= 80
    },
    {
      id: "mid_age30_120",
      position: "MID",
      label: "Midfielder aged 30 or over with at least 120 FPL points",
      fail: "That midfielder must be aged 30 or over at the season start and score at least 120 points.",
      difficulty: "medium",
      tags: ["age","veteran","points"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 30 && p.points >= 120
    },
    {
      id: "mid_outside_big6_2000_10gi",
      position: "MID",
      label: "Midfielder outside the Big Six with 2,000+ minutes and 10+ goal involvements",
      fail: "That midfielder must play outside the traditional Big Six, complete 2,000 minutes and record at least 10 goals plus assists.",
      difficulty: "medium",
      tags: ["outside-big-six","minutes","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.minutes >= 2000 && (p.goals + p.assists) >= 10
    },
    {
      id: "mid_promoted_5assists",
      position: "MID",
      label: "Midfielder from a promoted club with at least five assists",
      fail: "That midfielder must play for a promoted club and record at least five assists.",
      difficulty: "medium",
      tags: ["promoted","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && p.assists >= 5
    },
    {
      id: "mid_relegated_5assists",
      position: "MID",
      label: "Midfielder from a relegated club with at least five assists",
      fail: "That midfielder must play for a relegated club and record at least five assists.",
      difficulty: "hard",
      tags: ["relegated","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.relegated === true && p.assists >= 5
    },
    {
      id: "mid_bottomhalf_10gi",
      position: "MID",
      label: "Midfielder from a bottom-half club with 10+ goal involvements",
      fail: "That midfielder’s club must finish in the bottom half and the season must include at least 10 goals plus assists.",
      difficulty: "medium",
      tags: ["bottom-half","goal-involvements","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && (p.goals + p.assists) >= 10
    },
    {
      id: "mid_survival_9gi",
      position: "MID",
      label: "Midfielder from a club finishing 13th–17th with 9+ goal involvements",
      fail: "That midfielder’s club must finish 13th–17th and the season must include at least nine goals plus assists.",
      difficulty: "medium",
      tags: ["survival","goal-involvements","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && (p.goals + p.assists) >= 9
    },
    {
      id: "mid_midtable_10gi",
      position: "MID",
      label: "Midfielder from a club finishing 7th–12th with 10+ goal involvements",
      fail: "That midfielder’s club must finish 7th–12th and the season must include at least 10 goals plus assists.",
      difficulty: "medium",
      tags: ["mid-table","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && (p.goals + p.assists) >= 10
    },
    {
      id: "mid_exact5g5a",
      position: "MID",
      label: "Midfielder with exactly five goals and exactly five assists",
      fail: "That midfielder season must include exactly five goals and five assists.",
      difficulty: "hard",
      tags: ["exact-stat","goals","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.goals === 5 && p.assists === 5
    },
    {
      id: "mid_exact10goals_outside_big6",
      position: "MID",
      label: "Midfielder outside the Big Six with exactly 10 goals",
      fail: "That midfielder must play outside the traditional Big Six and score exactly 10 goals.",
      difficulty: "hard",
      tags: ["outside-big-six","exact-stat","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.goals === 10
    },
    {
      id: "mid_zero_goals_5assists",
      position: "MID",
      label: "Midfielder with no goals and at least five assists",
      fail: "That midfielder season must include no goals and at least five assists.",
      difficulty: "hard",
      tags: ["zero-goals","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.goals === 0 && p.assists >= 5
    },
    {
      id: "mid_exact8assists_100",
      position: "MID",
      label: "Midfielder with exactly eight assists and 100+ points",
      fail: "That midfielder season must include exactly eight assists and at least 100 points.",
      difficulty: "hard",
      tags: ["exact-stat","assists","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.assists === 8 && p.points >= 100
    },
    {
      id: "mid_exact7goals_100",
      position: "MID",
      label: "Midfielder with exactly seven goals and 100+ points",
      fail: "That midfielder season must include exactly seven goals and at least 100 points.",
      difficulty: "hard",
      tags: ["exact-stat","goals","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.goals === 7 && p.points >= 100
    },
    {
      id: "mid_10yellows_100",
      position: "MID",
      label: "Midfielder with 10+ yellow cards and 100+ points",
      fail: "That midfielder season must include at least 10 yellow cards and 100 FPL points.",
      difficulty: "hard",
      tags: ["cards","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.yellowCards >= 10 && p.points >= 100
    },
    {
      id: "mid_start5_8gi",
      position: "MID",
      label: "Midfielder who started at £5.0m or less with 8+ goal involvements",
      fail: "That midfielder must start at £5.0m or less and record at least eight goals plus assists.",
      difficulty: "easy",
      tags: ["budget","goal-involvements"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.startingPrice <= 5 && (p.goals + p.assists) >= 8
    },
    {
      id: "mid_final5_100",
      position: "MID",
      label: "Midfielder who finished at £5.0m or less with 100+ points",
      fail: "That midfielder must finish at £5.0m or less and score at least 100 points.",
      difficulty: "easy",
      tags: ["budget","final-price","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.finalPrice <= 5 && p.points >= 100
    },
    {
      id: "mid_top4_15gi",
      position: "MID",
      label: "Midfielder from a top-four club with 15+ goal involvements",
      fail: "That midfielder’s club must finish in the top four and the season must include at least 15 goals plus assists.",
      difficulty: "easy",
      tags: ["top-four","goal-involvements"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.topFour === true && (p.goals + p.assists) >= 15
    },
    {
      id: "mid_champion_10assists",
      position: "MID",
      label: "Midfielder from the champions with at least 10 assists",
      fail: "That midfielder must play for the champions and record at least 10 assists.",
      difficulty: "medium",
      tags: ["champions","assists"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => p.champions === true && p.assists >= 10
    },
    {
      id: "mid_nuno_100",
      position: "MID",
      label: "Midfielder managed by Nuno Espírito Santo with at least 100 FPL points",
      fail: "That midfielder season must be managed by Nuno Espírito Santo and score at least 100 points.",
      difficulty: "medium",
      tags: ["manager","Nuno Espírito Santo","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Nuno Espírito Santo") && p.points >= 100
    },
    {
      id: "mid_hodgson_80",
      position: "MID",
      label: "Midfielder managed by Roy Hodgson with at least 80 FPL points",
      fail: "That midfielder season must be managed by Roy Hodgson and score at least 80 points.",
      difficulty: "hard",
      tags: ["manager","Roy Hodgson","points","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Roy Hodgson") && p.points >= 80
    },
    {
      id: "mid_howe_100",
      position: "MID",
      label: "Midfielder managed by Eddie Howe with at least 100 FPL points",
      fail: "That midfielder season must be managed by Eddie Howe and score at least 100 points.",
      difficulty: "medium",
      tags: ["manager","Eddie Howe","points"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Eddie Howe") && p.points >= 100
    },
    {
      id: "mid_emery_100",
      position: "MID",
      label: "Midfielder managed by Unai Emery with at least 100 FPL points",
      fail: "That midfielder season must be managed by Unai Emery and score at least 100 points.",
      difficulty: "medium",
      tags: ["manager","Unai Emery","points"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Unai Emery") && p.points >= 100
    },
    {
      id: "mid_pochettino_100",
      position: "MID",
      label: "Midfielder managed by Mauricio Pochettino with at least 100 FPL points",
      fail: "That midfielder season must be managed by Mauricio Pochettino and score at least 100 points.",
      difficulty: "medium",
      tags: ["manager","mauricio pochettino","points"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Mauricio Pochettino") && p.points >= 100
    },
    {
      id: "mid_wenger_100",
      position: "MID",
      label: "Midfielder managed by Arsène Wenger with at least 100 FPL points",
      fail: "That midfielder season must be managed by Arsène Wenger and score at least 100 points.",
      difficulty: "hard",
      tags: ["manager","arsène wenger","points"],
      rating: 1,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Arsène Wenger") && p.points >= 100
    },
    {
      id: "mid_pep_150",
      position: "MID",
      label: "Midfielder managed by Pep Guardiola with at least 150 FPL points",
      fail: "That midfielder season must be managed by Pep Guardiola and score at least 150 points.",
      difficulty: "medium",
      tags: ["manager","pep guardiola","points"],
      rating: 2,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Pep Guardiola") && p.points >= 150
    },
    {
      id: "mid_2500_10bonus_astgtgoal",
      position: "MID",
      label: "Midfielder with 2,500+ minutes, 10+ bonus and more assists than goals",
      fail: "That midfielder season must include 2,500 minutes, at least 10 bonus points and more assists than goals.",
      difficulty: "medium",
      tags: ["minutes","bonus","assists","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.minutes >= 2500 && p.bonus >= 10 && p.assists > p.goals
    },
    {
      id: "mid_bottomhalf_3000_no_red",
      position: "MID",
      label: "Midfielder from a bottom-half club with 3,000+ minutes and no red cards",
      fail: "That midfielder’s club must finish in the bottom half with at least 3,000 minutes and no red cards.",
      difficulty: "medium",
      tags: ["bottom-half","minutes","discipline","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && p.minutes >= 3000 && p.redCards === 0
    },
    {
      id: "fwd_surname_m_80",
      position: "FWD",
      label: "Forward whose surname starts with M and scored 80+ points",
      fail: "That forward’s surname must start with M and the season must score at least 80 points.",
      difficulty: "medium",
      tags: ["name-rule","surname","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("m") && p.points >= 80); }
    },
    {
      id: "fwd_surname_s_80",
      position: "FWD",
      label: "Forward whose surname starts with S and scored 80+ points",
      fail: "That forward’s surname must start with S and the season must score at least 80 points.",
      difficulty: "medium",
      tags: ["name-rule","surname","points"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.startsWith("s") && p.points >= 80); }
    },
    {
      id: "fwd_firstname_a_80",
      position: "FWD",
      label: "Forward whose first name starts with A and scored 80+ points",
      fail: "That forward’s first name must start with A and the season must score at least 80 points.",
      difficulty: "medium",
      tags: ["name-rule","first-name","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__first.startsWith("a") && p.points >= 80); }
    },
    {
      id: "fwd_same_initials_50",
      position: "FWD",
      label: "Forward whose first name and surname share an initial with 50+ points",
      fail: "That forward’s first name and surname must share an initial and the season must score at least 50 points.",
      difficulty: "hard",
      tags: ["name-rule","same-initials","points","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__tokens.length > 1 && __first[0] && __first[0] === __surname[0] && p.points >= 50); }
    },
    {
      id: "fwd_hyphenated",
      position: "FWD",
      label: "Forward with a hyphenated surname",
      fail: "That forward must have a hyphenated surname.",
      difficulty: "hard",
      tags: ["name-rule","hyphenated","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.includes("-")); }
    },
    {
      id: "fwd_surname_son",
      position: "FWD",
      label: "Forward whose surname ends in “son”",
      fail: "That forward’s surname must end in “son”.",
      difficulty: "hard",
      tags: ["name-rule","surname","points"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => { const __raw=String(p.name || p.playerName || "").trim(); const __norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[’']/g,"'").trim().toLowerCase(); const __tokens=__raw.split(/\s+/).filter(Boolean); const __particles=new Set(["al","ap","bin","bint","da","das","de","del","della","den","der","di","dos","du","el","la","le","van","von","y"]); let __start=Math.max(0,__tokens.length-1); while(__start>0 && __particles.has(__norm(__tokens[__start-1]))) __start--; const __first=__norm(__tokens[0]||""); const __surname=__norm(__tokens.slice(__start).join(" ")); const __letters=v=>__norm(v).replace(/[^a-z]/g,"").length; return (__surname.endsWith("son")); }
    },
    {
      id: "fwd_age_u22_5goals",
      position: "FWD",
      label: "Forward aged 21 or under with at least five goals",
      fail: "That forward must be aged 21 or under at the season start and score at least five goals.",
      difficulty: "hard",
      tags: ["age","young","goals"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart <= 21 && p.goals >= 5
    },
    {
      id: "fwd_age30_10goals",
      position: "FWD",
      label: "Forward aged 30 or over with at least 10 goals",
      fail: "That forward must be aged 30 or over at the season start and score at least 10 goals.",
      difficulty: "hard",
      tags: ["age","veteran","goals"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 30 && p.goals >= 10
    },
    {
      id: "fwd_start6_8goals",
      position: "FWD",
      label: "Forward who started at £6.0m or less and scored 8+ goals",
      fail: "That forward must start at £6.0m or less and score at least eight goals.",
      difficulty: "easy",
      tags: ["budget","goals"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => p.startingPrice <= 6 && p.goals >= 8
    },
    {
      id: "fwd_final6_8goals",
      position: "FWD",
      label: "Forward who finished at £6.0m or less and scored 8+ goals",
      fail: "That forward must finish at £6.0m or less and score at least eight goals.",
      difficulty: "easy",
      tags: ["budget","final-price","goals"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.finalPrice <= 6 && p.goals >= 8
    },
    {
      id: "fwd_promoted_5goals",
      position: "FWD",
      label: "Forward from a promoted club with at least five goals",
      fail: "That forward must play for a promoted club and score at least five goals.",
      difficulty: "easy",
      tags: ["promoted","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.promoted === true && p.goals >= 5
    },
    {
      id: "fwd_relegated_5goals",
      position: "FWD",
      label: "Forward from a relegated club with at least five goals",
      fail: "That forward must play for a relegated club and score at least five goals.",
      difficulty: "medium",
      tags: ["relegated","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.relegated === true && p.goals >= 5
    },
    {
      id: "fwd_bottomhalf_12gi",
      position: "FWD",
      label: "Forward from a bottom-half club with 12+ goal involvements",
      fail: "That forward’s club must finish in the bottom half and the season must include at least 12 goals plus assists.",
      difficulty: "medium",
      tags: ["bottom-half","goal-involvements","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.bottomHalf === true && (p.goals + p.assists) >= 12
    },
    {
      id: "fwd_midtable_12gi",
      position: "FWD",
      label: "Forward from a club finishing 7th–12th with 12+ goal involvements",
      fail: "That forward’s club must finish 7th–12th and the season must include at least 12 goals plus assists.",
      difficulty: "medium",
      tags: ["mid-table","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12 && (p.goals + p.assists) >= 12
    },
    {
      id: "fwd_survival_8goals",
      position: "FWD",
      label: "Forward from a club finishing 13th–17th with at least eight goals",
      fail: "That forward’s club must finish 13th–17th and the player must score at least eight goals.",
      difficulty: "medium",
      tags: ["survival","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17 && p.goals >= 8
    },
    {
      id: "fwd_exact10g5a",
      position: "FWD",
      label: "Forward with exactly 10 goals and at least five assists",
      fail: "That forward season must include exactly 10 goals and at least five assists.",
      difficulty: "hard",
      tags: ["exact-stat","goals","assists"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.goals === 10 && p.assists >= 5
    },
    {
      id: "fwd_9goals_zero_assists",
      position: "FWD",
      label: "Forward with 9+ goals and no assists",
      fail: "That forward season must include at least nine goals and no assists.",
      difficulty: "hard",
      tags: ["goals","zero-assists","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.goals >= 9 && p.assists === 0
    },
    {
      id: "fwd_assists_gt_goals_80",
      position: "FWD",
      label: "Forward with more assists than goals and at least 80 FPL points",
      fail: "That forward season must include more assists than goals and at least 80 FPL points.",
      difficulty: "hard",
      tags: ["assists","points","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => p.assists > p.goals && p.points >= 80
    },
    {
      id: "fwd_outside_big6_5assists",
      position: "FWD",
      label: "Forward outside the traditional Big Six with at least five assists",
      fail: "That forward must play outside the traditional Big Six and record at least five assists.",
      difficulty: "medium",
      tags: ["outside-big-six","assists","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => !["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club) && p.assists >= 5
    },
    {
      id: "fwd_2000_15gi",
      position: "FWD",
      label: "Forward with 2,000+ minutes and 15+ goal involvements",
      fail: "That forward season must include at least 2,000 minutes and 15 goals plus assists.",
      difficulty: "easy",
      tags: ["minutes","goal-involvements"],
      rating: 3,
      cooldown: 7,
      enabled: true,
      test: p => p.minutes >= 2000 && (p.goals + p.assists) >= 15
    },
    {
      id: "fwd_1500_10bonus",
      position: "FWD",
      label: "Forward with 1,500+ minutes and at least 10 bonus points",
      fail: "That forward season must include at least 1,500 minutes and 10 bonus points.",
      difficulty: "easy",
      tags: ["minutes","bonus"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => p.minutes >= 1500 && p.bonus >= 10
    },
    {
      id: "fwd_hodgson_5goals",
      position: "FWD",
      label: "Forward managed by Roy Hodgson with at least five goals",
      fail: "That forward season must be managed by Roy Hodgson and include at least five goals.",
      difficulty: "hard",
      tags: ["manager","roy hodgson","goals","anti-meta"],
      rating: 5,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Roy Hodgson") && p.goals >= 5
    },
    {
      id: "fwd_howe_6goals",
      position: "FWD",
      label: "Forward managed by Eddie Howe with at least six goals",
      fail: "That forward season must be managed by Eddie Howe and include at least six goals.",
      difficulty: "medium",
      tags: ["manager","Eddie Howe","goals"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Eddie Howe") && p.goals >= 6
    },
    {
      id: "fwd_nuno_7goals",
      position: "FWD",
      label: "Forward managed by Nuno Espírito Santo with at least seven goals",
      fail: "That forward season must be managed by Nuno Espírito Santo and include at least seven goals.",
      difficulty: "hard",
      tags: ["manager","Nuno Espírito Santo","goals","anti-meta"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Nuno Espírito Santo") && p.goals >= 7
    },
    {
      id: "fwd_marco_silva_5goals",
      position: "FWD",
      label: "Forward managed by Marco Silva with at least five goals",
      fail: "That forward season must be managed by Marco Silva and include at least five goals.",
      difficulty: "medium",
      tags: ["manager","Marco Silva","goals"],
      rating: 4,
      cooldown: 7,
      enabled: true,
      test: p => Array.isArray(p.managers) && p.managers.includes("Marco Silva") && p.goals >= 5
    },
    {
      id: "auto_mid_goals_3_league_10_15",
      position: "MID",
      label: "Midfielder from a club finishing 10th–15th who scored exactly 3 goals",
      fail: "That midfielder's club must finish 10th–15th and the player must score exactly 3 goals.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 3,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15) && (Number.isFinite(p.goals) && p.goals === 3))
    },
    {
      id: "auto_def_clean_12_price_5_5",
      position: "DEF",
      label: "Defender with 12+ clean sheets who started at £5.5m or less",
      fail: "That defender must record at least 12 clean sheets and start at £5.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","defender","clean-sheets","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 12) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5.5))
    },
    {
      id: "auto_mid_surname_length_10",
      position: "MID",
      label: "Midfielder whose surname has at least 10 letters and who played 1,500+ minutes",
      fail: "That midfielder's surname must contain at least 10 letters and the season must include at least 1,500 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","name-rule","surname","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "surnameLength",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1500,
                        "value2": 0
                  }
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
      return ((Number.isFinite(__letterCount(__surname)) && __letterCount(__surname) >= 10) && (Number.isFinite(p.minutes) && p.minutes >= 1500));
    }
    },
    {
      id: "auto_def_surname_d_minutes",
      position: "DEF",
      label: "Defender whose surname starts with D and who played at least 1,000 minutes",
      fail: "That defender's surname must start with D and the season must include at least 1,000 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","name-rule","surname","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "surname",
                        "operator": "startsWith",
                        "value": "D",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
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
      return (__surname.startsWith("d") && (Number.isFinite(p.minutes) && p.minutes >= 1000));
    }
    },
    {
      id: "auto_fwd_gi_12_price_8_5",
      position: "FWD",
      label: "Forward with 12+ goal involvements who started at £8.5m or less",
      fail: "That forward must record at least 12 combined goals and assists and start at £8.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 8.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 12) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 8.5))
    },
    {
      id: "auto_def_league_1_4_1500",
      position: "DEF",
      label: "Defender from a club finishing 1th–4th who played at least 1,500 minutes",
      fail: "That defender's club must finish 1th–4th and the season must include at least 1,500 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 1,
                        "value2": 4
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 1 && p.leaguePosition <= 4) && (Number.isFinite(p.minutes) && p.minutes >= 1500))
    },
    {
      id: "auto_mid_gi_12_18_price_7",
      position: "MID",
      label: "Midfielder with 12–18 goal involvements who started at £7.0m or less",
      fail: "That midfielder must record 12–18 combined goals and assists and start at £7.0m or less.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goal-involvements","budget","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "between",
                        "value": 12,
                        "value2": 18
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 7,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 12 && (p.goals + p.assists) <= 18) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 7))
    },
    {
      id: "auto_gk_minutes_500_1500",
      position: "GK",
      label: "Goalkeeper who played between 500 and 1,500 minutes",
      fail: "That goalkeeper season must include between 500 and 1,500 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","minutes","range","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "between",
                        "value": 500,
                        "value2": 1500
                  }
            ]
      },
      test: p => (Number.isFinite(p.minutes) && p.minutes >= 500 && p.minutes <= 1500)
    },
    {
      id: "auto_fwd_bottomhalf_goals_6",
      position: "FWD",
      label: "Forward from a bottom-half club with 6+ goals",
      fail: "That forward must play for a bottom-half club and score at least 6 goals.",
      difficulty: "easy",
      tags: ["auto-generated","forward","bottomhalf","goals","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "bottomHalf",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.bottomHalf === true) && (Number.isFinite(p.goals) && p.goals >= 6))
    },
    {
      id: "auto_mid_goals_10_assists_5",
      position: "MID",
      label: "Midfielder with 10+ goals and 5+ assists",
      fail: "That midfielder season must include at least 10 goals and 5 assists.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 10) && (Number.isFinite(p.assists) && p.assists >= 5))
    },
    {
      id: "auto_gk_clean_6_price_5",
      position: "GK",
      label: "Goalkeeper with 6+ clean sheets who started at £5.0m or less",
      fail: "That goalkeeper must record at least 6 clean sheets and start at £5.0m or less.",
      difficulty: "easy",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 6) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5))
    },
    {
      id: "auto_def_first_j_points",
      position: "DEF",
      label: "Defender whose first name starts with J and who scored at least 60 FPL points",
      fail: "That defender's first name must start with J and the season must score at least 60 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","name-rule","first-name","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "firstName",
                        "operator": "startsWith",
                        "value": "J",
                        "value2": ""
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 60,
                        "value2": 0
                  }
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
      return (__firstName.startsWith("j") && (Number.isFinite(p.points) && p.points >= 60));
    }
    },
    {
      id: "auto_def_goals_3_minutes_1500",
      position: "DEF",
      label: "Defender who scored exactly 3 goals and played 1,500+ minutes",
      fail: "That defender must score exactly 3 goals and play at least 1,500 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","defender","goals","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 3,
                        "value2": 0
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals === 3) && (Number.isFinite(p.minutes) && p.minutes >= 1500))
    },
    {
      id: "auto_fwd_minutes_2400_goals_8",
      position: "FWD",
      label: "Forward who played at most 2,400 minutes and scored 8+ goals",
      fail: "That forward must play no more than 2,400 minutes and score at least 8 goals.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "lte",
                        "value": 2400,
                        "value2": 0
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.minutes) && p.minutes <= 2400) && (Number.isFinite(p.goals) && p.goals >= 8))
    },
    {
      id: "auto_gk_points_120_180",
      position: "GK",
      label: "Goalkeeper with between 120 and 180 FPL points",
      fail: "That goalkeeper season must score between 120 and 180 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","points","range"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 120,
                        "value2": 180
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 120 && p.points <= 180)
    },
    {
      id: "auto_mid_promoted_gi_5",
      position: "MID",
      label: "Midfielder from a promoted club with 5+ goal involvements",
      fail: "That midfielder must play for a promoted club and record at least 5 combined goals and assists.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","promoted","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "promoted",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.promoted === true) && (Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 5))
    },
    {
      id: "auto_fwd_goals_8_assists_5",
      position: "FWD",
      label: "Forward with 8+ goals and 5+ assists",
      fail: "That forward season must include at least 8 goals and 5 assists.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 8) && (Number.isFinite(p.assists) && p.assists >= 5))
    },
    {
      id: "auto_def_assists_over_goals_4",
      position: "DEF",
      label: "Defender with more assists than goals and at least 4 assists",
      fail: "That defender must record more assists than goals and at least 4 assists.",
      difficulty: "easy",
      tags: ["auto-generated","defender","assists","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "assistsMoreThanGoals",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 4,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.assists > p.goals) && (Number.isFinite(p.assists) && p.assists >= 4))
    },
    {
      id: "auto_gk_bottomhalf_saves_70",
      position: "GK",
      label: "Goalkeeper from a bottom-half club with 70+ saves",
      fail: "That goalkeeper must play for a bottom-half club and record at least 70 saves.",
      difficulty: "easy",
      tags: ["auto-generated","goalkeeper","bottomhalf","saves","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "bottomHalf",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 70,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.bottomHalf === true) && (Number.isFinite(p.saves) && p.saves >= 70))
    },
    {
      id: "auto_mid_assists_over_goals_10",
      position: "MID",
      label: "Midfielder with more assists than goals and 10+ assists",
      fail: "That midfielder must record more assists than goals and at least 10 assists.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","assists","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "assistsMoreThanGoals",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.assists > p.goals) && (Number.isFinite(p.assists) && p.assists >= 10))
    },
    {
      id: "auto_mid_surname_h_minutes",
      position: "MID",
      label: "Midfielder whose surname starts with H and who played at least 1,000 minutes",
      fail: "That midfielder's surname must start with H and the season must include at least 1,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","name-rule","surname","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "surname",
                        "operator": "startsWith",
                        "value": "H",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
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
      return (__surname.startsWith("h") && (Number.isFinite(p.minutes) && p.minutes >= 1000));
    }
    },
    {
      id: "auto_def_assists_over_goals_8",
      position: "DEF",
      label: "Defender with more assists than goals and at least 8 assists",
      fail: "That defender must record more assists than goals and at least 8 assists.",
      difficulty: "medium",
      tags: ["auto-generated","defender","assists","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "assistsMoreThanGoals",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.assists > p.goals) && (Number.isFinite(p.assists) && p.assists >= 8))
    },
    {
      id: "auto_mid_goals_12_assists_3",
      position: "MID",
      label: "Midfielder with 12+ goals and 3+ assists",
      fail: "That midfielder season must include at least 12 goals and 3 assists.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 3,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 12) && (Number.isFinite(p.assists) && p.assists >= 3))
    },
    {
      id: "auto_def_clean_12_price_4_5",
      position: "DEF",
      label: "Defender with 12+ clean sheets who started at £4.5m or less",
      fail: "That defender must record at least 12 clean sheets and start at £4.5m or less.",
      difficulty: "medium",
      tags: ["auto-generated","defender","clean-sheets","budget","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 4.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 12) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 4.5))
    },
    {
      id: "auto_mid_same_initials_points",
      position: "MID",
      label: "Midfielder whose first name and surname share an initial with 50+ FPL points",
      fail: "That midfielder's first name and surname must share an initial and the season must score at least 50 points.",
      difficulty: "medium",
      tags: ["auto-generated","name-rule","initials","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "sameInitials",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 50,
                        "value2": 0
                  }
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
      return (((__nameTokens.length > 1 && Boolean(__firstInitial) && __firstInitial === __surnameInitial)) && (Number.isFinite(p.points) && p.points >= 50));
    }
    },
    {
      id: "auto_gk_clean_10_price_4_5",
      position: "GK",
      label: "Goalkeeper with 10+ clean sheets who started at £4.5m or less",
      fail: "That goalkeeper must record at least 10 clean sheets and start at £4.5m or less.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 4.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 10) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 4.5))
    },
    {
      id: "auto_fwd_outside_goals_15",
      position: "FWD",
      label: "Forward outside the traditional Big Six with 15+ goals",
      fail: "That forward must play outside the traditional Big Six and score at least 15 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goals","outside-big-six","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "outsideBigSix",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 15,
                        "value2": 0
                  }
            ]
      },
      test: p => ((!["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club)) && (Number.isFinite(p.goals) && p.goals >= 15))
    },
    {
      id: "auto_def_bottom_assists_5",
      position: "DEF",
      label: "Defender from a bottom-half club with 5+ assists",
      fail: "That defender must play for a bottom-half club and record at least 5 assists.",
      difficulty: "medium",
      tags: ["auto-generated","defender","assists","bottom-half","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "bottomHalf",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.bottomHalf === true) && (Number.isFinite(p.assists) && p.assists >= 5))
    },
    {
      id: "auto_gk_assist_points_100",
      position: "GK",
      label: "Goalkeeper with an assist and at least 100 FPL points",
      fail: "That goalkeeper season must include an assist and at least 100 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","assist","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 1,
                        "value2": 0
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 100,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.assists) && p.assists >= 1) && (Number.isFinite(p.points) && p.points >= 100))
    },
    {
      id: "auto_mid_first_s_points",
      position: "MID",
      label: "Midfielder whose first name starts with S and who scored at least 60 FPL points",
      fail: "That midfielder's first name must start with S and the season must score at least 60 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","name-rule","first-name","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "firstName",
                        "operator": "startsWith",
                        "value": "S",
                        "value2": ""
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 60,
                        "value2": 0
                  }
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
      return (__firstName.startsWith("s") && (Number.isFinite(p.points) && p.points >= 60));
    }
    },
    {
      id: "auto_fwd_minutes_2000_goals_8",
      position: "FWD",
      label: "Forward who played at most 2,000 minutes and scored 8+ goals",
      fail: "That forward must play no more than 2,000 minutes and score at least 8 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goals","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "lte",
                        "value": 2000,
                        "value2": 0
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.minutes) && p.minutes <= 2000) && (Number.isFinite(p.goals) && p.goals >= 8))
    },
    {
      id: "auto_def_surname_length_10",
      position: "DEF",
      label: "Defender whose surname has at least 10 letters and who played 1,500+ minutes",
      fail: "That defender's surname must contain at least 10 letters and the season must include at least 1,500 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","name-rule","surname","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "surnameLength",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1500,
                        "value2": 0
                  }
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
      return ((Number.isFinite(__letterCount(__surname)) && __letterCount(__surname) >= 10) && (Number.isFinite(p.minutes) && p.minutes >= 1500));
    }
    },
    {
      id: "auto_fwd_league_1_4_1500",
      position: "FWD",
      label: "Forward from a club finishing 1th–4th who played at least 1,500 minutes",
      fail: "That forward's club must finish 1th–4th and the season must include at least 1,500 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 1,
                        "value2": 4
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 1 && p.leaguePosition <= 4) && (Number.isFinite(p.minutes) && p.minutes >= 1500))
    },
    {
      id: "auto_mid_age_31_35_1400",
      position: "MID",
      label: "Midfielder aged 31–35 who played at least 1,400 minutes",
      fail: "That midfielder must be aged 31–35 at the season start and play at least 1,400 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 31,
                        "value2": 35
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1400,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 31 && p.ageAtSeasonStart <= 35) && (Number.isFinite(p.minutes) && p.minutes >= 1400))
    },
    {
      id: "auto_def_nuno_espirito_santo_minutes_1000",
      position: "DEF",
      label: "Defender managed by Nuno Espírito Santo who played 1,000+ minutes",
      fail: "That defender season must have been managed by Nuno Espírito Santo and include at least 1,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Nuno Espírito Santo",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Nuno Espírito Santo".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1000))
    },
    {
      id: "auto_gk_bottomhalf_saves_90",
      position: "GK",
      label: "Goalkeeper from a bottom-half club with 90+ saves",
      fail: "That goalkeeper must play for a bottom-half club and record at least 90 saves.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","bottomhalf","saves","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "bottomHalf",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 90,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.bottomHalf === true) && (Number.isFinite(p.saves) && p.saves >= 90))
    },
    {
      id: "auto_mid_goals_4_league_13_17",
      position: "MID",
      label: "Midfielder from a club finishing 13th–17th who scored exactly 4 goals",
      fail: "That midfielder's club must finish 13th–17th and the player must score exactly 4 goals.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 4,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17) && (Number.isFinite(p.goals) && p.goals === 4))
    },
    {
      id: "auto_fwd_promoted_goals_6",
      position: "FWD",
      label: "Forward from a promoted club with 6+ goals",
      fail: "That forward must play for a promoted club and score at least 6 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","promoted","goals","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "promoted",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.promoted === true) && (Number.isFinite(p.goals) && p.goals >= 6))
    },
    {
      id: "auto_def_points_150_210",
      position: "DEF",
      label: "Defender with between 150 and 210 FPL points",
      fail: "That defender season must score between 150 and 210 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","points","range"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 150,
                        "value2": 210
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 150 && p.points <= 210)
    },
    {
      id: "auto_gk_saves_70_league_13_17",
      position: "GK",
      label: "Goalkeeper with 70+ saves from a club finishing 13th–17th",
      fail: "That goalkeeper season must include at least 70 saves for a club finishing 13th–17th.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 70,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 70) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17))
    },
    {
      id: "auto_mid_goals_6_league_13_17",
      position: "MID",
      label: "Midfielder from a club finishing 13th–17th who scored exactly 6 goals",
      fail: "That midfielder's club must finish 13th–17th and the player must score exactly 6 goals.",
      difficulty: "hard",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17) && (Number.isFinite(p.goals) && p.goals === 6))
    },
    {
      id: "auto_def_unai_emery_minutes_1800",
      position: "DEF",
      label: "Defender managed by Unai Emery who played 1,800+ minutes",
      fail: "That defender season must have been managed by Unai Emery and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Unai Emery",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Unai Emery".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_mid_relegated_gi_10",
      position: "MID",
      label: "Midfielder from a relegated club with 10+ goal involvements",
      fail: "That midfielder must play for a relegated club and record at least 10 combined goals and assists.",
      difficulty: "hard",
      tags: ["auto-generated","midfielder","relegated","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "relegated",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.relegated === true) && (Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 10))
    },
    {
      id: "auto_def_outside_assists_7",
      position: "DEF",
      label: "Defender outside the traditional Big Six with 7+ assists",
      fail: "That defender must play outside the traditional Big Six and record at least 7 assists.",
      difficulty: "hard",
      tags: ["auto-generated","defender","assists","outside-big-six","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "outsideBigSix",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 7,
                        "value2": 0
                  }
            ]
      },
      test: p => ((!["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club)) && (Number.isFinite(p.assists) && p.assists >= 7))
    },
    {
      id: "auto_gk_promoted_saves_110",
      position: "GK",
      label: "Goalkeeper from a promoted club with 110+ saves",
      fail: "That goalkeeper must play for a promoted club and record at least 110 saves.",
      difficulty: "hard",
      tags: ["auto-generated","goalkeeper","promoted","saves","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "promoted",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 110,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.promoted === true) && (Number.isFinite(p.saves) && p.saves >= 110))
    },
    {
      id: "auto_fwd_outside_goals_18",
      position: "FWD",
      label: "Forward outside the traditional Big Six with 18+ goals",
      fail: "That forward must play outside the traditional Big Six and score at least 18 goals.",
      difficulty: "hard",
      tags: ["auto-generated","forward","goals","outside-big-six","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "outsideBigSix",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 18,
                        "value2": 0
                  }
            ]
      },
      test: p => ((!["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club)) && (Number.isFinite(p.goals) && p.goals >= 18))
    },
    {
      id: "auto_def_bottom_assists_7",
      position: "DEF",
      label: "Defender from a bottom-half club with 7+ assists",
      fail: "That defender must play for a bottom-half club and record at least 7 assists.",
      difficulty: "hard",
      tags: ["auto-generated","defender","assists","bottom-half","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "bottomHalf",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 7,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.bottomHalf === true) && (Number.isFinite(p.assists) && p.assists >= 7))
    },
    {
      id: "auto_mid_eddie_howe_minutes_2500",
      position: "MID",
      label: "Midfielder managed by Eddie Howe who played 2,500+ minutes",
      fail: "That midfielder season must have been managed by Eddie Howe and include at least 2,500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Eddie Howe",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Eddie Howe".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 2500))
    },
    {
      id: "auto_gk_saves_130_league_10_15",
      position: "GK",
      label: "Goalkeeper with 130+ saves from a club finishing 10th–15th",
      fail: "That goalkeeper season must include at least 130 saves for a club finishing 10th–15th.",
      difficulty: "hard",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 130,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 130) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15))
    },
    {
      id: "auto_fwd_first_m_points",
      position: "FWD",
      label: "Forward whose first name starts with M and who scored at least 60 FPL points",
      fail: "That forward's first name must start with M and the season must score at least 60 FPL points.",
      difficulty: "hard",
      tags: ["auto-generated","name-rule","first-name","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "firstName",
                        "operator": "startsWith",
                        "value": "M",
                        "value2": ""
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 60,
                        "value2": 0
                  }
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
      return (__firstName.startsWith("m") && (Number.isFinite(p.points) && p.points >= 60));
    }
    },
    {
      id: "auto_def_hyphenated_minutes",
      position: "DEF",
      label: "Defender with a hyphenated surname who played 500+ minutes",
      fail: "That defender must have a hyphenated surname and play at least 500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","name-rule","hyphenated","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "hyphenatedSurname",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 500,
                        "value2": 0
                  }
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
      return ((__surname.includes("-")) && (Number.isFinite(p.minutes) && p.minutes >= 500));
    }
    },
    {
      id: "auto_gk_age_20_24_1800",
      position: "GK",
      label: "Goalkeeper aged 20–24 who played at least 1,800 minutes",
      fail: "That goalkeeper must be aged 20–24 at the season start and play at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 20,
                        "value2": 24
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 20 && p.ageAtSeasonStart <= 24) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_fwd_relegated_goals_10",
      position: "FWD",
      label: "Forward from a relegated club with 10+ goals",
      fail: "That forward must play for a relegated club and score at least 10 goals.",
      difficulty: "hard",
      tags: ["auto-generated","forward","relegated","goals","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "relegated",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.relegated === true) && (Number.isFinite(p.goals) && p.goals >= 10))
    },
    {
      id: "auto_mid_steve_cooper_minutes_1800",
      position: "MID",
      label: "Midfielder managed by Steve Cooper who played 1,800+ minutes",
      fail: "That midfielder season must have been managed by Steve Cooper and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Steve Cooper",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Steve Cooper".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_gk_surname_d_minutes",
      position: "GK",
      label: "Goalkeeper whose surname starts with D and who played at least 1,000 minutes",
      fail: "That goalkeeper's surname must start with D and the season must include at least 1,000 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","name-rule","surname","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "surname",
                        "operator": "startsWith",
                        "value": "D",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
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
      return (__surname.startsWith("d") && (Number.isFinite(p.minutes) && p.minutes >= 1000));
    }
    },
    {
      id: "auto_fwd_minutes_1600_goals_10",
      position: "FWD",
      label: "Forward who played at most 1,600 minutes and scored 10+ goals",
      fail: "That forward must play no more than 1,600 minutes and score at least 10 goals.",
      difficulty: "hard",
      tags: ["auto-generated","forward","goals","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "lte",
                        "value": 1600,
                        "value2": 0
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.minutes) && p.minutes <= 1600) && (Number.isFinite(p.goals) && p.goals >= 10))
    },
    {
      id: "auto_gk_surname_length_10",
      position: "GK",
      label: "Goalkeeper whose surname has at least 10 letters and who played 1,500+ minutes",
      fail: "That goalkeeper's surname must contain at least 10 letters and the season must include at least 1,500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","name-rule","surname","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "surnameLength",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1500,
                        "value2": 0
                  }
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
      return ((Number.isFinite(__letterCount(__surname)) && __letterCount(__surname) >= 10) && (Number.isFinite(p.minutes) && p.minutes >= 1500));
    }
    },
    {
      id: "auto_fwd_promoted_goals_12",
      position: "FWD",
      label: "Forward from a promoted club with 12+ goals",
      fail: "That forward must play for a promoted club and score at least 12 goals.",
      difficulty: "hard",
      tags: ["auto-generated","forward","promoted","goals","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "promoted",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.promoted === true) && (Number.isFinite(p.goals) && p.goals >= 12))
    },
    {
      id: "auto_gk_clean_12_price_5",
      position: "GK",
      label: "Goalkeeper with 12+ clean sheets who started at £5.0m or less",
      fail: "That goalkeeper must record at least 12 clean sheets and start at £5.0m or less.",
      difficulty: "hard",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 12) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5))
    },
    {
      id: "auto_fwd_first_s_points",
      position: "FWD",
      label: "Forward whose first name starts with S and who scored at least 60 FPL points",
      fail: "That forward's first name must start with S and the season must score at least 60 FPL points.",
      difficulty: "hard",
      tags: ["auto-generated","name-rule","first-name","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "firstName",
                        "operator": "startsWith",
                        "value": "S",
                        "value2": ""
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 60,
                        "value2": 0
                  }
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
      return (__firstName.startsWith("s") && (Number.isFinite(p.points) && p.points >= 60));
    }
    },
    {
      id: "auto_mid_goals_10_assists_7",
      position: "MID",
      label: "Midfielder with 10+ goals and 7+ assists",
      fail: "That midfielder season must include at least 10 goals and 7 assists.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 7,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 10) && (Number.isFinite(p.assists) && p.assists >= 7))
    },
    {
      id: "auto_def_same_initials_points",
      position: "DEF",
      label: "Defender whose first name and surname share an initial with 50+ FPL points",
      fail: "That defender's first name and surname must share an initial and the season must score at least 50 points.",
      difficulty: "medium",
      tags: ["auto-generated","name-rule","initials","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "sameInitials",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 50,
                        "value2": 0
                  }
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
      return (((__nameTokens.length > 1 && Boolean(__firstInitial) && __firstInitial === __surnameInitial)) && (Number.isFinite(p.points) && p.points >= 50));
    }
    },
    {
      id: "auto_mid_assists_over_goals_12",
      position: "MID",
      label: "Midfielder with more assists than goals and 12+ assists",
      fail: "That midfielder must record more assists than goals and at least 12 assists.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","assists","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "assistsMoreThanGoals",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.assists > p.goals) && (Number.isFinite(p.assists) && p.assists >= 12))
    },
    {
      id: "auto_def_clean_12_price_5",
      position: "DEF",
      label: "Defender with 12+ clean sheets who started at £5.0m or less",
      fail: "That defender must record at least 12 clean sheets and start at £5.0m or less.",
      difficulty: "easy",
      tags: ["auto-generated","defender","clean-sheets","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 12) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5))
    },
    {
      id: "auto_mid_slaven_bilic_minutes_1000",
      position: "MID",
      label: "Midfielder managed by Slaven Bilić who played 1,000+ minutes",
      fail: "That midfielder season must have been managed by Slaven Bilić and include at least 1,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Slaven Bilić",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Slaven Bilić".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1000))
    },
    {
      id: "auto_def_goals_4_minutes_1500",
      position: "DEF",
      label: "Defender who scored exactly 4 goals and played 1,500+ minutes",
      fail: "That defender must score exactly 4 goals and play at least 1,500 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","defender","goals","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 4,
                        "value2": 0
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals === 4) && (Number.isFinite(p.minutes) && p.minutes >= 1500))
    },
    {
      id: "auto_def_bottom_assists_3",
      position: "DEF",
      label: "Defender from a bottom-half club with 3+ assists",
      fail: "That defender must play for a bottom-half club and record at least 3 assists.",
      difficulty: "easy",
      tags: ["auto-generated","defender","assists","bottom-half","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "bottomHalf",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 3,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.bottomHalf === true) && (Number.isFinite(p.assists) && p.assists >= 3))
    },
    {
      id: "auto_fwd_league_10_15_1800",
      position: "FWD",
      label: "Forward from a club finishing 10th–15th who played at least 1,800 minutes",
      fail: "That forward's club must finish 10th–15th and the season must include at least 1,800 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_mid_goals_4_league_7_12",
      position: "MID",
      label: "Midfielder from a club finishing 7th–12th who scored exactly 4 goals",
      fail: "That midfielder's club must finish 7th–12th and the player must score exactly 4 goals.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 7,
                        "value2": 12
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 4,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12) && (Number.isFinite(p.goals) && p.goals === 4))
    },
    {
      id: "auto_gk_first_r_points",
      position: "GK",
      label: "Goalkeeper whose first name starts with R and who scored at least 60 FPL points",
      fail: "That goalkeeper's first name must start with R and the season must score at least 60 FPL points.",
      difficulty: "hard",
      tags: ["auto-generated","name-rule","first-name","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "firstName",
                        "operator": "startsWith",
                        "value": "R",
                        "value2": ""
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 60,
                        "value2": 0
                  }
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
      return (__firstName.startsWith("r") && (Number.isFinite(p.points) && p.points >= 60));
    }
    },
    {
      id: "auto_fwd_surname_length_9",
      position: "FWD",
      label: "Forward whose surname has at least 9 letters and who played 1,500+ minutes",
      fail: "That forward's surname must contain at least 9 letters and the season must include at least 1,500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","name-rule","surname","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "surnameLength",
                        "operator": "gte",
                        "value": 9,
                        "value2": 0
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1500,
                        "value2": 0
                  }
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
      return ((Number.isFinite(__letterCount(__surname)) && __letterCount(__surname) >= 9) && (Number.isFinite(p.minutes) && p.minutes >= 1500));
    }
    },
    {
      id: "auto_def_age_18_22_1200",
      position: "DEF",
      label: "Defender aged 18–22 who played at least 1,200 minutes",
      fail: "That defender must be aged 18–22 at the season start and play at least 1,200 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 18,
                        "value2": 22
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1200,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 18 && p.ageAtSeasonStart <= 22) && (Number.isFinite(p.minutes) && p.minutes >= 1200))
    },
    {
      id: "auto_mid_hyphenated_minutes",
      position: "MID",
      label: "Midfielder with a hyphenated surname who played 500+ minutes",
      fail: "That midfielder must have a hyphenated surname and play at least 500 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","name-rule","hyphenated","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "hyphenatedSurname",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 500,
                        "value2": 0
                  }
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
      return ((__surname.includes("-")) && (Number.isFinite(p.minutes) && p.minutes >= 500));
    }
    },
    {
      id: "auto_fwd_goals_8_assists_4",
      position: "FWD",
      label: "Forward with 8+ goals and 4+ assists",
      fail: "That forward season must include at least 8 goals and 4 assists.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 4,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 8) && (Number.isFinite(p.assists) && p.assists >= 4))
    },
    {
      id: "auto_gk_saves_90_league_10_15",
      position: "GK",
      label: "Goalkeeper with 90+ saves from a club finishing 10th–15th",
      fail: "That goalkeeper season must include at least 90 saves for a club finishing 10th–15th.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 90,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 90) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15))
    },
    {
      id: "auto_def_frank_lampard_minutes_1800",
      position: "DEF",
      label: "Defender managed by Frank Lampard who played 1,800+ minutes",
      fail: "That defender season must have been managed by Frank Lampard and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Frank Lampard",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Frank Lampard".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_mid_gi_15_22_price_8",
      position: "MID",
      label: "Midfielder with 15–22 goal involvements who started at £8.0m or less",
      fail: "That midfielder must record 15–22 combined goals and assists and start at £8.0m or less.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goal-involvements","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "between",
                        "value": 15,
                        "value2": 22
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 8,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 15 && (p.goals + p.assists) <= 22) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 8))
    },
    {
      id: "auto_fwd_surname_n_minutes",
      position: "FWD",
      label: "Forward whose surname starts with N and who played at least 1,000 minutes",
      fail: "That forward's surname must start with N and the season must include at least 1,000 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","name-rule","surname","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "surname",
                        "operator": "startsWith",
                        "value": "N",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
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
      return (__surname.startsWith("n") && (Number.isFinite(p.minutes) && p.minutes >= 1000));
    }
    },
    {
      id: "auto_gk_bottomhalf_saves_110",
      position: "GK",
      label: "Goalkeeper from a bottom-half club with 110+ saves",
      fail: "That goalkeeper must play for a bottom-half club and record at least 110 saves.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","bottomhalf","saves","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "bottomHalf",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 110,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.bottomHalf === true) && (Number.isFinite(p.saves) && p.saves >= 110))
    },
    {
      id: "auto_def_assists_over_goals_6",
      position: "DEF",
      label: "Defender with more assists than goals and at least 6 assists",
      fail: "That defender must record more assists than goals and at least 6 assists.",
      difficulty: "easy",
      tags: ["auto-generated","defender","assists","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "assistsMoreThanGoals",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.assists > p.goals) && (Number.isFinite(p.assists) && p.assists >= 6))
    },
    {
      id: "auto_mid_promoted_gi_10",
      position: "MID",
      label: "Midfielder from a promoted club with 10+ goal involvements",
      fail: "That midfielder must play for a promoted club and record at least 10 combined goals and assists.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","promoted","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "promoted",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.promoted === true) && (Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 10))
    },
    {
      id: "auto_gk_clean_12_price_4_5",
      position: "GK",
      label: "Goalkeeper with 12+ clean sheets who started at £4.5m or less",
      fail: "That goalkeeper must record at least 12 clean sheets and start at £4.5m or less.",
      difficulty: "hard",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 4.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 12) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 4.5))
    },
    {
      id: "auto_fwd_outside_goals_8",
      position: "FWD",
      label: "Forward outside the traditional Big Six with 8+ goals",
      fail: "That forward must play outside the traditional Big Six and score at least 8 goals.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","outside-big-six","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "outsideBigSix",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  }
            ]
      },
      test: p => ((!["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club)) && (Number.isFinite(p.goals) && p.goals >= 8))
    },
    {
      id: "auto_mid_relegated_gi_8",
      position: "MID",
      label: "Midfielder from a relegated club with 8+ goal involvements",
      fail: "That midfielder must play for a relegated club and record at least 8 combined goals and assists.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","relegated","goal-involvements","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "relegated",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.relegated === true) && (Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 8))
    },
    {
      id: "auto_fwd_minutes_2000_goals_12",
      position: "FWD",
      label: "Forward who played at most 2,000 minutes and scored 12+ goals",
      fail: "That forward must play no more than 2,000 minutes and score at least 12 goals.",
      difficulty: "hard",
      tags: ["auto-generated","forward","goals","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "lte",
                        "value": 2000,
                        "value2": 0
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.minutes) && p.minutes <= 2000) && (Number.isFinite(p.goals) && p.goals >= 12))
    },
    {
      id: "auto_mid_goals_6_league_10_15",
      position: "MID",
      label: "Midfielder from a club finishing 10th–15th who scored exactly 6 goals",
      fail: "That midfielder's club must finish 10th–15th and the player must score exactly 6 goals.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15) && (Number.isFinite(p.goals) && p.goals === 6))
    },
    {
      id: "auto_def_age_28_31_2000",
      position: "DEF",
      label: "Defender aged 28–31 who played at least 2,000 minutes",
      fail: "That defender must be aged 28–31 at the season start and play at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 28,
                        "value2": 31
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 28 && p.ageAtSeasonStart <= 31) && (Number.isFinite(p.minutes) && p.minutes >= 2000))
    },
    {
      id: "auto_mid_goals_12_assists_5",
      position: "MID",
      label: "Midfielder with 12+ goals and 5+ assists",
      fail: "That midfielder season must include at least 12 goals and 5 assists.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 12) && (Number.isFinite(p.assists) && p.assists >= 5))
    },
    {
      id: "auto_def_goals_3_minutes_2000",
      position: "DEF",
      label: "Defender who scored exactly 3 goals and played 2,000+ minutes",
      fail: "That defender must score exactly 3 goals and play at least 2,000 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","defender","goals","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 3,
                        "value2": 0
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals === 3) && (Number.isFinite(p.minutes) && p.minutes >= 2000))
    },
    {
      id: "auto_fwd_relegated_goals_6",
      position: "FWD",
      label: "Forward from a relegated club with 6+ goals",
      fail: "That forward must play for a relegated club and score at least 6 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","relegated","goals","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "relegated",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.relegated === true) && (Number.isFinite(p.goals) && p.goals >= 6))
    },
    {
      id: "auto_gk_league_1_4_1500",
      position: "GK",
      label: "Goalkeeper from a club finishing 1th–4th who played at least 1,500 minutes",
      fail: "That goalkeeper's club must finish 1th–4th and the season must include at least 1,500 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 1,
                        "value2": 4
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 1 && p.leaguePosition <= 4) && (Number.isFinite(p.minutes) && p.minutes >= 1500))
    },
    {
      id: "auto_mid_gi_15_22_price_7",
      position: "MID",
      label: "Midfielder with 15–22 goal involvements who started at £7.0m or less",
      fail: "That midfielder must record 15–22 combined goals and assists and start at £7.0m or less.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goal-involvements","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "between",
                        "value": 15,
                        "value2": 22
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 7,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 15 && (p.goals + p.assists) <= 22) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 7))
    },
    {
      id: "auto_def_gary_o_neil_minutes_1800",
      position: "DEF",
      label: "Defender managed by Gary O'Neil who played 1,800+ minutes",
      fail: "That defender season must have been managed by Gary O'Neil and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Gary O'Neil",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Gary O'Neil".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_gk_saves_110_league_7_12",
      position: "GK",
      label: "Goalkeeper with 110+ saves from a club finishing 7th–12th",
      fail: "That goalkeeper season must include at least 110 saves for a club finishing 7th–12th.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 110,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 7,
                        "value2": 12
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 110) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12))
    },
    {
      id: "auto_fwd_gi_10_price_6_5",
      position: "FWD",
      label: "Forward with 10+ goal involvements who started at £6.5m or less",
      fail: "That forward must record at least 10 combined goals and assists and start at £6.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 6.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 10) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 6.5))
    },
    {
      id: "auto_mid_marco_silva_minutes_2500",
      position: "MID",
      label: "Midfielder managed by Marco Silva who played 2,500+ minutes",
      fail: "That midfielder season must have been managed by Marco Silva and include at least 2,500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Marco Silva",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Marco Silva".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 2500))
    },
    {
      id: "auto_def_age_31_35_1400",
      position: "DEF",
      label: "Defender aged 31–35 who played at least 1,400 minutes",
      fail: "That defender must be aged 31–35 at the season start and play at least 1,400 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 31,
                        "value2": 35
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1400,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 31 && p.ageAtSeasonStart <= 35) && (Number.isFinite(p.minutes) && p.minutes >= 1400))
    },
    {
      id: "auto_fwd_goals_10_assists_4",
      position: "FWD",
      label: "Forward with 10+ goals and 4+ assists",
      fail: "That forward season must include at least 10 goals and 4 assists.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 4,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 10) && (Number.isFinite(p.assists) && p.assists >= 4))
    },
    {
      id: "auto_gk_relegated_saves_110",
      position: "GK",
      label: "Goalkeeper from a relegated club with 110+ saves",
      fail: "That goalkeeper must play for a relegated club and record at least 110 saves.",
      difficulty: "hard",
      tags: ["auto-generated","goalkeeper","relegated","saves","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "relegated",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 110,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.relegated === true) && (Number.isFinite(p.saves) && p.saves >= 110))
    },
    {
      id: "auto_mid_points_150_210",
      position: "MID",
      label: "Midfielder with between 150 and 210 FPL points",
      fail: "That midfielder season must score between 150 and 210 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","points","range"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 150,
                        "value2": 210
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 150 && p.points <= 210)
    },
    {
      id: "auto_fwd_minutes_1600_goals_8",
      position: "FWD",
      label: "Forward who played at most 1,600 minutes and scored 8+ goals",
      fail: "That forward must play no more than 1,600 minutes and score at least 8 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goals","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "lte",
                        "value": 1600,
                        "value2": 0
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.minutes) && p.minutes <= 1600) && (Number.isFinite(p.goals) && p.goals >= 8))
    },
    {
      id: "auto_gk_saves_130_league_7_12",
      position: "GK",
      label: "Goalkeeper with 130+ saves from a club finishing 7th–12th",
      fail: "That goalkeeper season must include at least 130 saves for a club finishing 7th–12th.",
      difficulty: "hard",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 130,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 7,
                        "value2": 12
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 130) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12))
    },
    {
      id: "auto_mid_goals_5_assists_7",
      position: "MID",
      label: "Midfielder with 5+ goals and 7+ assists",
      fail: "That midfielder season must include at least 5 goals and 7 assists.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 7,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 5) && (Number.isFinite(p.assists) && p.assists >= 7))
    },
    {
      id: "auto_gk_clean_10_price_5",
      position: "GK",
      label: "Goalkeeper with 10+ clean sheets who started at £5.0m or less",
      fail: "That goalkeeper must record at least 10 clean sheets and start at £5.0m or less.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 10) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5))
    },
    {
      id: "auto_fwd_bottomhalf_goals_10",
      position: "FWD",
      label: "Forward from a bottom-half club with 10+ goals",
      fail: "That forward must play for a bottom-half club and score at least 10 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","bottomhalf","goals","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "bottomHalf",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.bottomHalf === true) && (Number.isFinite(p.goals) && p.goals >= 10))
    },
    {
      id: "auto_mid_goals_5_league_13_17",
      position: "MID",
      label: "Midfielder from a club finishing 13th–17th who scored exactly 5 goals",
      fail: "That midfielder's club must finish 13th–17th and the player must score exactly 5 goals.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17) && (Number.isFinite(p.goals) && p.goals === 5))
    },
    {
      id: "auto_mid_daniel_farke_minutes_1000",
      position: "MID",
      label: "Midfielder managed by Daniel Farke who played 1,000+ minutes",
      fail: "That midfielder season must have been managed by Daniel Farke and include at least 1,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Daniel Farke",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Daniel Farke".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1000))
    },
    {
      id: "auto_fwd_points_150_210",
      position: "FWD",
      label: "Forward with between 150 and 210 FPL points",
      fail: "That forward season must score between 150 and 210 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","points","range"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 150,
                        "value2": 210
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 150 && p.points <= 210)
    },
    {
      id: "auto_mid_age_28_31_2000",
      position: "MID",
      label: "Midfielder aged 28–31 who played at least 2,000 minutes",
      fail: "That midfielder must be aged 28–31 at the season start and play at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 28,
                        "value2": 31
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 28 && p.ageAtSeasonStart <= 31) && (Number.isFinite(p.minutes) && p.minutes >= 2000))
    },
    {
      id: "auto_def_ange_postecoglou_minutes_1800",
      position: "DEF",
      label: "Defender managed by Ange Postecoglou who played 1,800+ minutes",
      fail: "That defender season must have been managed by Ange Postecoglou and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Ange Postecoglou",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Ange Postecoglou".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_fwd_promoted_goals_8",
      position: "FWD",
      label: "Forward from a promoted club with 8+ goals",
      fail: "That forward must play for a promoted club and score at least 8 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","promoted","goals","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "promoted",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.promoted === true) && (Number.isFinite(p.goals) && p.goals >= 8))
    },
    {
      id: "auto_mid_goals_8_assists_7",
      position: "MID",
      label: "Midfielder with 8+ goals and 7+ assists",
      fail: "That midfielder season must include at least 8 goals and 7 assists.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 7,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 8) && (Number.isFinite(p.assists) && p.assists >= 7))
    },
    {
      id: "auto_fwd_minutes_2000_goals_10",
      position: "FWD",
      label: "Forward who played at most 2,000 minutes and scored 10+ goals",
      fail: "That forward must play no more than 2,000 minutes and score at least 10 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goals","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "lte",
                        "value": 2000,
                        "value2": 0
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.minutes) && p.minutes <= 2000) && (Number.isFinite(p.goals) && p.goals >= 10))
    },
    {
      id: "auto_gk_minutes_2000_3000",
      position: "GK",
      label: "Goalkeeper who played between 2,000 and 3,000 minutes",
      fail: "That goalkeeper season must include between 2,000 and 3,000 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","minutes","range","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "between",
                        "value": 2000,
                        "value2": 3000
                  }
            ]
      },
      test: p => (Number.isFinite(p.minutes) && p.minutes >= 2000 && p.minutes <= 3000)
    },
    {
      id: "auto_mid_gi_10_15_price_6",
      position: "MID",
      label: "Midfielder with 10–15 goal involvements who started at £6.0m or less",
      fail: "That midfielder must record 10–15 combined goals and assists and start at £6.0m or less.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goal-involvements","budget","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 10 && (p.goals + p.assists) <= 15) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 6))
    },
    {
      id: "auto_gk_assist_points_50",
      position: "GK",
      label: "Goalkeeper with an assist and at least 50 FPL points",
      fail: "That goalkeeper season must include an assist and at least 50 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","assist","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 1,
                        "value2": 0
                  },
                  {
                        "field": "points",
                        "operator": "gte",
                        "value": 50,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.assists) && p.assists >= 1) && (Number.isFinite(p.points) && p.points >= 50))
    },
    {
      id: "auto_fwd_outside_goals_10",
      position: "FWD",
      label: "Forward outside the traditional Big Six with 10+ goals",
      fail: "That forward must play outside the traditional Big Six and score at least 10 goals.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","outside-big-six","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "outsideBigSix",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  }
            ]
      },
      test: p => ((!["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club)) && (Number.isFinite(p.goals) && p.goals >= 10))
    },
    {
      id: "auto_mid_goals_12_assists_7",
      position: "MID",
      label: "Midfielder with 12+ goals and 7+ assists",
      fail: "That midfielder season must include at least 12 goals and 7 assists.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 7,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 12) && (Number.isFinite(p.assists) && p.assists >= 7))
    },
    {
      id: "auto_gk_saves_110_league_13_17",
      position: "GK",
      label: "Goalkeeper with 110+ saves from a club finishing 13th–17th",
      fail: "That goalkeeper season must include at least 110 saves for a club finishing 13th–17th.",
      difficulty: "hard",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 110,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 110) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17))
    },
    {
      id: "auto_fwd_gi_18_price_6_5",
      position: "FWD",
      label: "Forward with 18+ goal involvements who started at £6.5m or less",
      fail: "That forward must record at least 18 combined goals and assists and start at £6.5m or less.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 18,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 6.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 18) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 6.5))
    },
    {
      id: "auto_mid_gi_12_18_price_6",
      position: "MID",
      label: "Midfielder with 12–18 goal involvements who started at £6.0m or less",
      fail: "That midfielder must record 12–18 combined goals and assists and start at £6.0m or less.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goal-involvements","budget","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "between",
                        "value": 12,
                        "value2": 18
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 12 && (p.goals + p.assists) <= 18) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 6))
    },
    {
      id: "auto_fwd_hyphenated_minutes",
      position: "FWD",
      label: "Forward with a hyphenated surname who played 500+ minutes",
      fail: "That forward must have a hyphenated surname and play at least 500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","name-rule","hyphenated","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "hyphenatedSurname",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 500,
                        "value2": 0
                  }
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
      return ((__surname.includes("-")) && (Number.isFinite(p.minutes) && p.minutes >= 500));
    }
    },
    {
      id: "auto_gk_clean_8_price_5_5",
      position: "GK",
      label: "Goalkeeper with 8+ clean sheets who started at £5.5m or less",
      fail: "That goalkeeper must record at least 8 clean sheets and start at £5.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 8) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5.5))
    },
    {
      id: "auto_mid_goals_5_league_10_15",
      position: "MID",
      label: "Midfielder from a club finishing 10th–15th who scored exactly 5 goals",
      fail: "That midfielder's club must finish 10th–15th and the player must score exactly 5 goals.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15) && (Number.isFinite(p.goals) && p.goals === 5))
    },
    {
      id: "auto_fwd_age_31_35_1400",
      position: "FWD",
      label: "Forward aged 31–35 who played at least 1,400 minutes",
      fail: "That forward must be aged 31–35 at the season start and play at least 1,400 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 31,
                        "value2": 35
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1400,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 31 && p.ageAtSeasonStart <= 35) && (Number.isFinite(p.minutes) && p.minutes >= 1400))
    },
    {
      id: "auto_gk_league_10_15_1800",
      position: "GK",
      label: "Goalkeeper from a club finishing 10th–15th who played at least 1,800 minutes",
      fail: "That goalkeeper's club must finish 10th–15th and the season must include at least 1,800 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_fwd_bottomhalf_goals_8",
      position: "FWD",
      label: "Forward from a bottom-half club with 8+ goals",
      fail: "That forward must play for a bottom-half club and score at least 8 goals.",
      difficulty: "easy",
      tags: ["auto-generated","forward","bottomhalf","goals","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "bottomHalf",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.bottomHalf === true) && (Number.isFinite(p.goals) && p.goals >= 8))
    },
    {
      id: "auto_gk_saves_110_league_10_15",
      position: "GK",
      label: "Goalkeeper with 110+ saves from a club finishing 10th–15th",
      fail: "That goalkeeper season must include at least 110 saves for a club finishing 10th–15th.",
      difficulty: "hard",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 110,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 110) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15))
    },
    {
      id: "auto_mid_goals_8_assists_3",
      position: "MID",
      label: "Midfielder with 8+ goals and 3+ assists",
      fail: "That midfielder season must include at least 8 goals and 3 assists.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 3,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 8) && (Number.isFinite(p.assists) && p.assists >= 3))
    },
    {
      id: "auto_gk_promoted_saves_70",
      position: "GK",
      label: "Goalkeeper from a promoted club with 70+ saves",
      fail: "That goalkeeper must play for a promoted club and record at least 70 saves.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","promoted","saves","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "promoted",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 70,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.promoted === true) && (Number.isFinite(p.saves) && p.saves >= 70))
    },
    {
      id: "auto_fwd_goals_5_assists_4",
      position: "FWD",
      label: "Forward with 5+ goals and 4+ assists",
      fail: "That forward season must include at least 5 goals and 4 assists.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 4,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 5) && (Number.isFinite(p.assists) && p.assists >= 4))
    },
    {
      id: "auto_mid_goals_5_league_7_12",
      position: "MID",
      label: "Midfielder from a club finishing 7th–12th who scored exactly 5 goals",
      fail: "That midfielder's club must finish 7th–12th and the player must score exactly 5 goals.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 7,
                        "value2": 12
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12) && (Number.isFinite(p.goals) && p.goals === 5))
    },
    {
      id: "auto_mid_goals_6_league_7_12",
      position: "MID",
      label: "Midfielder from a club finishing 7th–12th who scored exactly 6 goals",
      fail: "That midfielder's club must finish 7th–12th and the player must score exactly 6 goals.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 7,
                        "value2": 12
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12) && (Number.isFinite(p.goals) && p.goals === 6))
    },
    {
      id: "auto_mid_goals_4_league_10_15",
      position: "MID",
      label: "Midfielder from a club finishing 10th–15th who scored exactly 4 goals",
      fail: "That midfielder's club must finish 10th–15th and the player must score exactly 4 goals.",
      difficulty: "medium",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 4,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15) && (Number.isFinite(p.goals) && p.goals === 4))
    },
    {
      id: "auto_def_pep_guardiola_minutes_1800",
      position: "DEF",
      label: "Defender managed by Pep Guardiola who played 1,800+ minutes",
      fail: "That defender season must have been managed by Pep Guardiola and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Pep Guardiola",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Pep Guardiola".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_fwd_age_18_22_1200",
      position: "FWD",
      label: "Forward aged 18–22 who played at least 1,200 minutes",
      fail: "That forward must be aged 18–22 at the season start and play at least 1,200 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 18,
                        "value2": 22
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1200,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 18 && p.ageAtSeasonStart <= 22) && (Number.isFinite(p.minutes) && p.minutes >= 1200))
    },
    {
      id: "auto_mid_goals_8_assists_5",
      position: "MID",
      label: "Midfielder with 8+ goals and 5+ assists",
      fail: "That midfielder season must include at least 8 goals and 5 assists.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 8) && (Number.isFinite(p.assists) && p.assists >= 5))
    },
    {
      id: "auto_fwd_outside_goals_12",
      position: "FWD",
      label: "Forward outside the traditional Big Six with 12+ goals",
      fail: "That forward must play outside the traditional Big Six and score at least 12 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goals","outside-big-six","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "outsideBigSix",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  }
            ]
      },
      test: p => ((!["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"].includes(p.club)) && (Number.isFinite(p.goals) && p.goals >= 12))
    },
    {
      id: "auto_gk_clean_12_price_5_5",
      position: "GK",
      label: "Goalkeeper with 12+ clean sheets who started at £5.5m or less",
      fail: "That goalkeeper must record at least 12 clean sheets and start at £5.5m or less.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 12) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5.5))
    },
    {
      id: "auto_mid_gi_15_22_price_6",
      position: "MID",
      label: "Midfielder with 15–22 goal involvements who started at £6.0m or less",
      fail: "That midfielder must record 15–22 combined goals and assists and start at £6.0m or less.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goal-involvements","budget","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "between",
                        "value": 15,
                        "value2": 22
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 15 && (p.goals + p.assists) <= 22) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 6))
    },
    {
      id: "auto_fwd_league_5_8_1800",
      position: "FWD",
      label: "Forward from a club finishing 5th–8th who played at least 1,800 minutes",
      fail: "That forward's club must finish 5th–8th and the season must include at least 1,800 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 5,
                        "value2": 8
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 5 && p.leaguePosition <= 8) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_gk_saves_90_league_13_17",
      position: "GK",
      label: "Goalkeeper with 90+ saves from a club finishing 13th–17th",
      fail: "That goalkeeper season must include at least 90 saves for a club finishing 13th–17th.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 90,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 90) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17))
    },
    {
      id: "auto_mid_goals_10_assists_3",
      position: "MID",
      label: "Midfielder with 10+ goals and 3+ assists",
      fail: "That midfielder season must include at least 10 goals and 3 assists.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goals","assists"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 3,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 10) && (Number.isFinite(p.assists) && p.assists >= 3))
    },
    {
      id: "auto_gk_relegated_saves_70",
      position: "GK",
      label: "Goalkeeper from a relegated club with 70+ saves",
      fail: "That goalkeeper must play for a relegated club and record at least 70 saves.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","relegated","saves","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "relegated",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 70,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.relegated === true) && (Number.isFinite(p.saves) && p.saves >= 70))
    },
    {
      id: "auto_fwd_goals_10_assists_6",
      position: "FWD",
      label: "Forward with 10+ goals and 6+ assists",
      fail: "That forward season must include at least 10 goals and 6 assists.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 10) && (Number.isFinite(p.assists) && p.assists >= 6))
    },
    {
      id: "auto_mid_scott_parker_minutes_1800",
      position: "MID",
      label: "Midfielder managed by Scott Parker who played 1,800+ minutes",
      fail: "That midfielder season must have been managed by Scott Parker and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Scott Parker",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Scott Parker".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_gk_promoted_saves_90",
      position: "GK",
      label: "Goalkeeper from a promoted club with 90+ saves",
      fail: "That goalkeeper must play for a promoted club and record at least 90 saves.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","promoted","saves","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "promoted",
                        "operator": "isTrue",
                        "value": "",
                        "value2": ""
                  },
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 90,
                        "value2": 0
                  }
            ]
      },
      test: p => ((p.promoted === true) && (Number.isFinite(p.saves) && p.saves >= 90))
    },
    {
      id: "auto_mid_goals_3_league_13_17",
      position: "MID",
      label: "Midfielder from a club finishing 13th–17th who scored exactly 3 goals",
      fail: "That midfielder's club must finish 13th–17th and the player must score exactly 3 goals.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 3,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17) && (Number.isFinite(p.goals) && p.goals === 3))
    },
    {
      id: "auto_fwd_minutes_2400_goals_12",
      position: "FWD",
      label: "Forward who played at most 2,400 minutes and scored 12+ goals",
      fail: "That forward must play no more than 2,400 minutes and score at least 12 goals.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goals","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "lte",
                        "value": 2400,
                        "value2": 0
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.minutes) && p.minutes <= 2400) && (Number.isFinite(p.goals) && p.goals >= 12))
    },
    {
      id: "auto_mid_sean_dyche_minutes_2500",
      position: "MID",
      label: "Midfielder managed by Sean Dyche who played 2,500+ minutes",
      fail: "That midfielder season must have been managed by Sean Dyche and include at least 2,500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Sean Dyche",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Sean Dyche".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 2500))
    },
    {
      id: "auto_fwd_gi_18_price_7_5",
      position: "FWD",
      label: "Forward with 18+ goal involvements who started at £7.5m or less",
      fail: "That forward must record at least 18 combined goals and assists and start at £7.5m or less.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 18,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 7.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 18) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 7.5))
    },
    {
      id: "auto_gk_points_100_150",
      position: "GK",
      label: "Goalkeeper with between 100 and 150 FPL points",
      fail: "That goalkeeper season must score between 100 and 150 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","points","range"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 100,
                        "value2": 150
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 100 && p.points <= 150)
    },
    {
      id: "auto_gk_minutes_1000_2000",
      position: "GK",
      label: "Goalkeeper who played between 1,000 and 2,000 minutes",
      fail: "That goalkeeper season must include between 1,000 and 2,000 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","minutes","range","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "between",
                        "value": 1000,
                        "value2": 2000
                  }
            ]
      },
      test: p => (Number.isFinite(p.minutes) && p.minutes >= 1000 && p.minutes <= 2000)
    },
    {
      id: "auto_mid_claudio_ranieri_minutes_2500",
      position: "MID",
      label: "Midfielder managed by Claudio Ranieri who played 2,500+ minutes",
      fail: "That midfielder season must have been managed by Claudio Ranieri and include at least 2,500 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Claudio Ranieri",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2500,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Claudio Ranieri".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 2500))
    },
    {
      id: "auto_fwd_age_20_24_1800",
      position: "FWD",
      label: "Forward aged 20–24 who played at least 1,800 minutes",
      fail: "That forward must be aged 20–24 at the season start and play at least 1,800 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 20,
                        "value2": 24
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 20 && p.ageAtSeasonStart <= 24) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_mid_goals_3_league_7_12",
      position: "MID",
      label: "Midfielder from a club finishing 7th–12th who scored exactly 3 goals",
      fail: "That midfielder's club must finish 7th–12th and the player must score exactly 3 goals.",
      difficulty: "easy",
      tags: ["auto-generated","midfielder","goals","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 7,
                        "value2": 12
                  },
                  {
                        "field": "goals",
                        "operator": "eq",
                        "value": 3,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12) && (Number.isFinite(p.goals) && p.goals === 3))
    },
    {
      id: "auto_fwd_gi_15_price_6_5",
      position: "FWD",
      label: "Forward with 15+ goal involvements who started at £6.5m or less",
      fail: "That forward must record at least 15 combined goals and assists and start at £6.5m or less.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 15,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 6.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 15) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 6.5))
    },
    {
      id: "auto_gk_league_5_8_1800",
      position: "GK",
      label: "Goalkeeper from a club finishing 5th–8th who played at least 1,800 minutes",
      fail: "That goalkeeper's club must finish 5th–8th and the season must include at least 1,800 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 5,
                        "value2": 8
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 5 && p.leaguePosition <= 8) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_fwd_goals_5_assists_6",
      position: "FWD",
      label: "Forward with 5+ goals and 6+ assists",
      fail: "That forward season must include at least 5 goals and 6 assists.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 5) && (Number.isFinite(p.assists) && p.assists >= 6))
    },
    {
      id: "auto_gk_saves_130_league_13_17",
      position: "GK",
      label: "Goalkeeper with 130+ saves from a club finishing 13th–17th",
      fail: "That goalkeeper season must include at least 130 saves for a club finishing 13th–17th.",
      difficulty: "hard",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 130,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 130) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17))
    },
    {
      id: "auto_gk_clean_6_price_4_5",
      position: "GK",
      label: "Goalkeeper with 6+ clean sheets who started at £4.5m or less",
      fail: "That goalkeeper must record at least 6 clean sheets and start at £4.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 4.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 6) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 4.5))
    },
    {
      id: "auto_fwd_minutes_1600_goals_12",
      position: "FWD",
      label: "Forward who played at most 1,600 minutes and scored 12+ goals",
      fail: "That forward must play no more than 1,600 minutes and score at least 12 goals.",
      difficulty: "hard",
      tags: ["auto-generated","forward","goals","minutes","anti-meta"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "lte",
                        "value": 1600,
                        "value2": 0
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.minutes) && p.minutes <= 1600) && (Number.isFinite(p.goals) && p.goals >= 12))
    },
    {
      id: "auto_gk_points_150_210",
      position: "GK",
      label: "Goalkeeper with between 150 and 210 FPL points",
      fail: "That goalkeeper season must score between 150 and 210 FPL points.",
      difficulty: "medium",
      tags: ["auto-generated","points","range"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 150,
                        "value2": 210
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 150 && p.points <= 210)
    },
    {
      id: "auto_fwd_minutes_2000_3000",
      position: "FWD",
      label: "Forward who played between 2,000 and 3,000 minutes",
      fail: "That forward season must include between 2,000 and 3,000 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","minutes","range","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "between",
                        "value": 2000,
                        "value2": 3000
                  }
            ]
      },
      test: p => (Number.isFinite(p.minutes) && p.minutes >= 2000 && p.minutes <= 3000)
    },
    {
      id: "auto_gk_league_13_17_1800",
      position: "GK",
      label: "Goalkeeper from a club finishing 13th–17th who played at least 1,800 minutes",
      fail: "That goalkeeper's club must finish 13th–17th and the season must include at least 1,800 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_fwd_age_28_31_2000",
      position: "FWD",
      label: "Forward aged 28–31 who played at least 2,000 minutes",
      fail: "That forward must be aged 28–31 at the season start and play at least 2,000 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 28,
                        "value2": 31
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 28 && p.ageAtSeasonStart <= 31) && (Number.isFinite(p.minutes) && p.minutes >= 2000))
    },
    {
      id: "auto_gk_clean_8_price_4_5",
      position: "GK",
      label: "Goalkeeper with 8+ clean sheets who started at £4.5m or less",
      fail: "That goalkeeper must record at least 8 clean sheets and start at £4.5m or less.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 4.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 8) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 4.5))
    },
    {
      id: "auto_fwd_gi_12_price_7_5",
      position: "FWD",
      label: "Forward with 12+ goal involvements who started at £7.5m or less",
      fail: "That forward must record at least 12 combined goals and assists and start at £7.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 7.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 12) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 7.5))
    },
    {
      id: "auto_gk_age_18_22_1200",
      position: "GK",
      label: "Goalkeeper aged 18–22 who played at least 1,200 minutes",
      fail: "That goalkeeper must be aged 18–22 at the season start and play at least 1,200 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 18,
                        "value2": 22
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1200,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 18 && p.ageAtSeasonStart <= 22) && (Number.isFinite(p.minutes) && p.minutes >= 1200))
    },
    {
      id: "auto_fwd_goals_5_assists_5",
      position: "FWD",
      label: "Forward with 5+ goals and 5+ assists",
      fail: "That forward season must include at least 5 goals and 5 assists.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 5) && (Number.isFinite(p.assists) && p.assists >= 5))
    },
    {
      id: "auto_gk_saves_70_league_10_15",
      position: "GK",
      label: "Goalkeeper with 70+ saves from a club finishing 10th–15th",
      fail: "That goalkeeper season must include at least 70 saves for a club finishing 10th–15th.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 70,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 10,
                        "value2": 15
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 70) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 10 && p.leaguePosition <= 15))
    },
    {
      id: "auto_fwd_points_120_180",
      position: "FWD",
      label: "Forward with between 120 and 180 FPL points",
      fail: "That forward season must score between 120 and 180 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","points","range"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 120,
                        "value2": 180
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 120 && p.points <= 180)
    },
    {
      id: "auto_gk_thomas_frank_minutes_1800",
      position: "GK",
      label: "Goalkeeper managed by Thomas Frank who played 1,800+ minutes",
      fail: "That goalkeeper season must have been managed by Thomas Frank and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Thomas Frank",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Thomas Frank".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_fwd_league_13_17_1800",
      position: "FWD",
      label: "Forward from a club finishing 13th–17th who played at least 1,800 minutes",
      fail: "That forward's club must finish 13th–17th and the season must include at least 1,800 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 13,
                        "value2": 17
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 13 && p.leaguePosition <= 17) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_gk_minutes_2500_3420",
      position: "GK",
      label: "Goalkeeper who played between 2,500 and 3,420 minutes",
      fail: "That goalkeeper season must include between 2,500 and 3,420 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","minutes","range","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "between",
                        "value": 2500,
                        "value2": 3420
                  }
            ]
      },
      test: p => (Number.isFinite(p.minutes) && p.minutes >= 2500 && p.minutes <= 3420)
    },
    {
      id: "auto_fwd_gi_18_price_8_5",
      position: "FWD",
      label: "Forward with 18+ goal involvements who started at £8.5m or less",
      fail: "That forward must record at least 18 combined goals and assists and start at £8.5m or less.",
      difficulty: "medium",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 18,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 8.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 18) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 8.5))
    },
    {
      id: "auto_fwd_minutes_2400_goals_10",
      position: "FWD",
      label: "Forward who played at most 2,400 minutes and scored 10+ goals",
      fail: "That forward must play no more than 2,400 minutes and score at least 10 goals.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "lte",
                        "value": 2400,
                        "value2": 0
                  },
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.minutes) && p.minutes <= 2400) && (Number.isFinite(p.goals) && p.goals >= 10))
    },
    {
      id: "auto_gk_dean_smith_minutes_1800",
      position: "GK",
      label: "Goalkeeper managed by Dean Smith who played 1,800+ minutes",
      fail: "That goalkeeper season must have been managed by Dean Smith and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Dean Smith",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Dean Smith".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_gk_saves_90_league_7_12",
      position: "GK",
      label: "Goalkeeper with 90+ saves from a club finishing 7th–12th",
      fail: "That goalkeeper season must include at least 90 saves for a club finishing 7th–12th.",
      difficulty: "medium",
      tags: ["auto-generated","goalkeeper","saves","league-position","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "saves",
                        "operator": "gte",
                        "value": 90,
                        "value2": 0
                  },
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 7,
                        "value2": 12
                  }
            ]
      },
      test: p => ((Number.isFinite(p.saves) && p.saves >= 90) && (Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12))
    },
    {
      id: "auto_fwd_goals_8_assists_6",
      position: "FWD",
      label: "Forward with 8+ goals and 6+ assists",
      fail: "That forward season must include at least 8 goals and 6 assists.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 8) && (Number.isFinite(p.assists) && p.assists >= 6))
    },
    {
      id: "auto_gk_jurgen_klopp_minutes_1000",
      position: "GK",
      label: "Goalkeeper managed by Jürgen Klopp who played 1,000+ minutes",
      fail: "That goalkeeper season must have been managed by Jürgen Klopp and include at least 1,000 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 1,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Jürgen Klopp",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Jürgen Klopp".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1000))
    },
    {
      id: "auto_mid_roy_hodgson_minutes_1000",
      position: "MID",
      label: "Midfielder managed by Roy Hodgson who played 1,000+ minutes",
      fail: "That midfielder season must have been managed by Roy Hodgson and include at least 1,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Roy Hodgson",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Roy Hodgson".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1000))
    },
    {
      id: "auto_fwd_sean_dyche_minutes_1000",
      position: "FWD",
      label: "Forward managed by Sean Dyche who played 1,000+ minutes",
      fail: "That forward season must have been managed by Sean Dyche and include at least 1,000 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Sean Dyche",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Sean Dyche".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1000))
    },
    {
      id: "auto_fwd_nuno_espirito_santo_minutes_1800",
      position: "FWD",
      label: "Forward managed by Nuno Espírito Santo who played 1,800+ minutes",
      fail: "That forward season must have been managed by Nuno Espírito Santo and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Nuno Espírito Santo",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Nuno Espírito Santo".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_mid_sam_allardyce_minutes_1800",
      position: "MID",
      label: "Midfielder managed by Sam Allardyce who played 1,800+ minutes",
      fail: "That midfielder season must have been managed by Sam Allardyce and include at least 1,800 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Sam Allardyce",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Sam Allardyce".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_mid_sam_allardyce_minutes_1000",
      position: "MID",
      label: "Midfielder managed by Sam Allardyce who played 1,000+ minutes",
      fail: "That midfielder season must have been managed by Sam Allardyce and include at least 1,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Sam Allardyce",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Sam Allardyce".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1000))
    },
    {
      id: "auto_mid_frank_lampard_minutes_1000",
      position: "MID",
      label: "Midfielder managed by Frank Lampard who played 1,000+ minutes",
      fail: "That midfielder season must have been managed by Frank Lampard and include at least 1,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Frank Lampard",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Frank Lampard".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1000))
    },
    {
      id: "auto_def_jose_mourinho_minutes_1800",
      position: "DEF",
      label: "Defender managed by José Mourinho who played 1,800+ minutes",
      fail: "That defender season must have been managed by José Mourinho and include at least 1,800 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "José Mourinho",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "José Mourinho".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_mid_daniel_farke_minutes_1800",
      position: "MID",
      label: "Midfielder managed by Daniel Farke who played 1,800+ minutes",
      fail: "That midfielder season must have been managed by Daniel Farke and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Daniel Farke",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Daniel Farke".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_def_antonio_conte_minutes_1800",
      position: "DEF",
      label: "Defender managed by Antonio Conte who played 1,800+ minutes",
      fail: "That defender season must have been managed by Antonio Conte and include at least 1,800 minutes.",
      difficulty: "hard",
      tags: ["auto-generated","manager","minutes","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "manager",
                        "operator": "equals",
                        "value": "Antonio Conte",
                        "value2": ""
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1800,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Array.isArray(p.managers) && p.managers.some(manager => String(manager).toLowerCase() === "Antonio Conte".toLowerCase())) && (Number.isFinite(p.minutes) && p.minutes >= 1800))
    },
    {
      id: "auto_fwd_gi_15_price_8_5",
      position: "FWD",
      label: "Forward with 15+ goal involvements who started at £8.5m or less",
      fail: "That forward must record at least 15 combined goals and assists and start at £8.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 15,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 8.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 15) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 8.5))
    },
    {
      id: "auto_gk_age_23_27_2000",
      position: "GK",
      label: "Goalkeeper aged 23–27 who played at least 2,000 minutes",
      fail: "That goalkeeper must be aged 23–27 at the season start and play at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 23,
                        "value2": 27
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 23 && p.ageAtSeasonStart <= 27) && (Number.isFinite(p.minutes) && p.minutes >= 2000))
    },
    {
      id: "auto_fwd_minutes_2500_3420",
      position: "FWD",
      label: "Forward who played between 2,500 and 3,420 minutes",
      fail: "That forward season must include between 2,500 and 3,420 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","minutes","range","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "minutes",
                        "operator": "between",
                        "value": 2500,
                        "value2": 3420
                  }
            ]
      },
      test: p => (Number.isFinite(p.minutes) && p.minutes >= 2500 && p.minutes <= 3420)
    },
    {
      id: "auto_gk_clean_8_price_5",
      position: "GK",
      label: "Goalkeeper with 8+ clean sheets who started at £5.0m or less",
      fail: "That goalkeeper must record at least 8 clean sheets and start at £5.0m or less.",
      difficulty: "easy",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 8,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 8) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5))
    },
    {
      id: "auto_fwd_points_100_150",
      position: "FWD",
      label: "Forward with between 100 and 150 FPL points",
      fail: "That forward season must score between 100 and 150 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","points","range"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 100,
                        "value2": 150
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 100 && p.points <= 150)
    },
    {
      id: "auto_gk_clean_6_price_5_5",
      position: "GK",
      label: "Goalkeeper with 6+ clean sheets who started at £5.5m or less",
      fail: "That goalkeeper must record at least 6 clean sheets and start at £5.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 6,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 6) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5.5))
    },
    {
      id: "auto_gk_clean_10_price_5_5",
      position: "GK",
      label: "Goalkeeper with 10+ clean sheets who started at £5.5m or less",
      fail: "That goalkeeper must record at least 10 clean sheets and start at £5.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","goalkeeper","clean-sheets","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "cleanSheets",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 5.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.cleanSheets) && p.cleanSheets >= 10) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 5.5))
    },
    {
      id: "auto_gk_points_40_80",
      position: "GK",
      label: "Goalkeeper with between 40 and 80 FPL points",
      fail: "That goalkeeper season must score between 40 and 80 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","points","range"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 40,
                        "value2": 80
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 40 && p.points <= 80)
    },
    {
      id: "auto_fwd_age_23_27_2000",
      position: "FWD",
      label: "Forward aged 23–27 who played at least 2,000 minutes",
      fail: "That forward must be aged 23–27 at the season start and play at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 23,
                        "value2": 27
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 23 && p.ageAtSeasonStart <= 27) && (Number.isFinite(p.minutes) && p.minutes >= 2000))
    },
    {
      id: "auto_gk_age_28_31_2000",
      position: "GK",
      label: "Goalkeeper aged 28–31 who played at least 2,000 minutes",
      fail: "That goalkeeper must be aged 28–31 at the season start and play at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 28,
                        "value2": 31
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 28 && p.ageAtSeasonStart <= 31) && (Number.isFinite(p.minutes) && p.minutes >= 2000))
    },
    {
      id: "auto_fwd_goals_10_assists_5",
      position: "FWD",
      label: "Forward with 10+ goals and 5+ assists",
      fail: "That forward season must include at least 10 goals and 5 assists.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goals","assists"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goals",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "assists",
                        "operator": "gte",
                        "value": 5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.goals) && p.goals >= 10) && (Number.isFinite(p.assists) && p.assists >= 5))
    },
    {
      id: "auto_fwd_gi_12_price_6_5",
      position: "FWD",
      label: "Forward with 12+ goal involvements who started at £6.5m or less",
      fail: "That forward must record at least 12 combined goals and assists and start at £6.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 12,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 6.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 12) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 6.5))
    },
    {
      id: "auto_gk_league_7_12_2000",
      position: "GK",
      label: "Goalkeeper from a club finishing 7th–12th who played at least 2,000 minutes",
      fail: "That goalkeeper's club must finish 7th–12th and the season must include at least 2,000 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 7,
                        "value2": 12
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12) && (Number.isFinite(p.minutes) && p.minutes >= 2000))
    },
    {
      id: "auto_fwd_gi_10_price_8_5",
      position: "FWD",
      label: "Forward with 10+ goal involvements who started at £8.5m or less",
      fail: "That forward must record at least 10 combined goals and assists and start at £8.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 8.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 10) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 8.5))
    },
    {
      id: "auto_gk_points_80_120",
      position: "GK",
      label: "Goalkeeper with between 80 and 120 FPL points",
      fail: "That goalkeeper season must score between 80 and 120 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","points","range"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 80,
                        "value2": 120
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 80 && p.points <= 120)
    },
    {
      id: "auto_fwd_points_80_120",
      position: "FWD",
      label: "Forward with between 80 and 120 FPL points",
      fail: "That forward season must score between 80 and 120 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","points","range"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 80,
                        "value2": 120
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 80 && p.points <= 120)
    },
    {
      id: "auto_gk_points_60_100",
      position: "GK",
      label: "Goalkeeper with between 60 and 100 FPL points",
      fail: "That goalkeeper season must score between 60 and 100 FPL points.",
      difficulty: "easy",
      tags: ["auto-generated","points","range"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "points",
                        "operator": "between",
                        "value": 60,
                        "value2": 100
                  }
            ]
      },
      test: p => (Number.isFinite(p.points) && p.points >= 60 && p.points <= 100)
    },
    {
      id: "auto_fwd_league_7_12_2000",
      position: "FWD",
      label: "Forward from a club finishing 7th–12th who played at least 2,000 minutes",
      fail: "That forward's club must finish 7th–12th and the season must include at least 2,000 minutes.",
      difficulty: "easy",
      tags: ["auto-generated","league-position","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "leaguePosition",
                        "operator": "between",
                        "value": 7,
                        "value2": 12
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 2000,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.leaguePosition) && p.leaguePosition >= 7 && p.leaguePosition <= 12) && (Number.isFinite(p.minutes) && p.minutes >= 2000))
    },
    {
      id: "auto_fwd_gi_10_price_7_5",
      position: "FWD",
      label: "Forward with 10+ goal involvements who started at £7.5m or less",
      fail: "That forward must record at least 10 combined goals and assists and start at £7.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 2,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 10,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 7.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 10) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 7.5))
    },
    {
      id: "auto_gk_age_31_35_1400",
      position: "GK",
      label: "Goalkeeper aged 31–35 who played at least 1,400 minutes",
      fail: "That goalkeeper must be aged 31–35 at the season start and play at least 1,400 minutes.",
      difficulty: "medium",
      tags: ["auto-generated","age","minutes","anti-meta"],
      rating: 5,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "ageAtSeasonStart",
                        "operator": "between",
                        "value": 31,
                        "value2": 35
                  },
                  {
                        "field": "minutes",
                        "operator": "gte",
                        "value": 1400,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite(p.ageAtSeasonStart) && p.ageAtSeasonStart >= 31 && p.ageAtSeasonStart <= 35) && (Number.isFinite(p.minutes) && p.minutes >= 1400))
    },
    {
      id: "auto_fwd_gi_15_price_7_5",
      position: "FWD",
      label: "Forward with 15+ goal involvements who started at £7.5m or less",
      fail: "That forward must record at least 15 combined goals and assists and start at £7.5m or less.",
      difficulty: "easy",
      tags: ["auto-generated","forward","goal-involvements","budget","anti-meta"],
      rating: 3,
      cooldown: 10,
      enabled: true,
      studioRule: {
            "kind": "builder",
            "join": "all",
            "conditions": [
                  {
                        "field": "goalInvolvements",
                        "operator": "gte",
                        "value": 15,
                        "value2": 0
                  },
                  {
                        "field": "startingPrice",
                        "operator": "lte",
                        "value": 7.5,
                        "value2": 0
                  }
            ]
      },
      test: p => ((Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 15) && (Number.isFinite(p.startingPrice) && p.startingPrice <= 7.5))
    }
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
