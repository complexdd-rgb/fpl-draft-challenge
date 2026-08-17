/* FPL Draft Challenge — canonical Premier League season metadata · 2011/12
   Purpose: season-wide metadata source for Historical Database Import Centre.
   Upload this file as the optional "Club metadata" file when importing 2011/12.
   Player-level FPL statistics/prices are intentionally out of scope here. */
(() => {
  "use strict";

  const SEASON = "2011/12";
  const START_DATE = "2011-08-13";
  const END_DATE = "2012-05-13";

  const clubs = [
    {
      source_team: "Manchester City",
      club_name: "Man City",
      aliases: ["Manchester City", "Man City", "MCI"],
      league_position: 1,
      promoted: false,
      relegated: false,
      managers: "Roberto Mancini",
      start_manager: "Roberto Mancini",
      manager_history: [{ manager: "Roberto Mancini", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Manchester United",
      club_name: "Man Utd",
      aliases: ["Manchester United", "Man Utd", "MUN"],
      league_position: 2,
      promoted: false,
      relegated: false,
      managers: "Alex Ferguson",
      start_manager: "Alex Ferguson",
      manager_history: [{ manager: "Alex Ferguson", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Arsenal",
      club_name: "Arsenal",
      aliases: ["Arsenal", "ARS"],
      league_position: 3,
      promoted: false,
      relegated: false,
      managers: "Arsène Wenger",
      start_manager: "Arsène Wenger",
      manager_history: [{ manager: "Arsène Wenger", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Tottenham Hotspur",
      club_name: "Spurs",
      aliases: ["Tottenham Hotspur", "Tottenham", "Spurs", "TOT"],
      league_position: 4,
      promoted: false,
      relegated: false,
      managers: "Harry Redknapp",
      start_manager: "Harry Redknapp",
      manager_history: [{ manager: "Harry Redknapp", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Newcastle United",
      club_name: "Newcastle",
      aliases: ["Newcastle United", "Newcastle", "NEW"],
      league_position: 5,
      promoted: false,
      relegated: false,
      managers: "Alan Pardew",
      start_manager: "Alan Pardew",
      manager_history: [{ manager: "Alan Pardew", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Chelsea",
      club_name: "Chelsea",
      aliases: ["Chelsea", "CHE"],
      league_position: 6,
      promoted: false,
      relegated: false,
      managers: "André Villas-Boas; Roberto Di Matteo",
      start_manager: "André Villas-Boas",
      manager_history: [
        { manager: "André Villas-Boas", from: START_DATE, to: "2012-03-04" },
        { manager: "Roberto Di Matteo", from: "2012-03-04", to: END_DATE, interim: true }
      ]
    },
    {
      source_team: "Everton",
      club_name: "Everton",
      aliases: ["Everton", "EVE"],
      league_position: 7,
      promoted: false,
      relegated: false,
      managers: "David Moyes",
      start_manager: "David Moyes",
      manager_history: [{ manager: "David Moyes", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Liverpool",
      club_name: "Liverpool",
      aliases: ["Liverpool", "LIV"],
      league_position: 8,
      promoted: false,
      relegated: false,
      managers: "Kenny Dalglish",
      start_manager: "Kenny Dalglish",
      manager_history: [{ manager: "Kenny Dalglish", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Fulham",
      club_name: "Fulham",
      aliases: ["Fulham", "FUL"],
      league_position: 9,
      promoted: false,
      relegated: false,
      managers: "Martin Jol",
      start_manager: "Martin Jol",
      manager_history: [{ manager: "Martin Jol", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "West Bromwich Albion",
      club_name: "West Brom",
      aliases: ["West Bromwich Albion", "West Brom", "WBA"],
      league_position: 10,
      promoted: false,
      relegated: false,
      managers: "Roy Hodgson",
      start_manager: "Roy Hodgson",
      manager_history: [{ manager: "Roy Hodgson", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Swansea City",
      club_name: "Swansea",
      aliases: ["Swansea City", "Swansea", "SWA"],
      league_position: 11,
      promoted: true,
      relegated: false,
      managers: "Brendan Rodgers",
      start_manager: "Brendan Rodgers",
      manager_history: [{ manager: "Brendan Rodgers", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Norwich City",
      club_name: "Norwich",
      aliases: ["Norwich City", "Norwich", "NOR"],
      league_position: 12,
      promoted: true,
      relegated: false,
      managers: "Paul Lambert",
      start_manager: "Paul Lambert",
      manager_history: [{ manager: "Paul Lambert", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Sunderland",
      club_name: "Sunderland",
      aliases: ["Sunderland", "SUN"],
      league_position: 13,
      promoted: false,
      relegated: false,
      managers: "Steve Bruce; Eric Black; Martin O'Neill",
      start_manager: "Steve Bruce",
      manager_history: [
        { manager: "Steve Bruce", from: START_DATE, to: "2011-11-30" },
        { manager: "Eric Black", from: "2011-12-01", to: "2011-12-04", caretaker: true },
        { manager: "Martin O'Neill", from: "2011-12-05", to: END_DATE }
      ]
    },
    {
      source_team: "Stoke City",
      club_name: "Stoke",
      aliases: ["Stoke City", "Stoke", "STK"],
      league_position: 14,
      promoted: false,
      relegated: false,
      managers: "Tony Pulis",
      start_manager: "Tony Pulis",
      manager_history: [{ manager: "Tony Pulis", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Wigan Athletic",
      club_name: "Wigan",
      aliases: ["Wigan Athletic", "Wigan", "WIG"],
      league_position: 15,
      promoted: false,
      relegated: false,
      managers: "Roberto Martínez",
      start_manager: "Roberto Martínez",
      manager_history: [{ manager: "Roberto Martínez", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Aston Villa",
      club_name: "Aston Villa",
      aliases: ["Aston Villa", "AVL"],
      league_position: 16,
      promoted: false,
      relegated: false,
      managers: "Alex McLeish",
      start_manager: "Alex McLeish",
      manager_history: [{ manager: "Alex McLeish", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Queens Park Rangers",
      club_name: "QPR",
      aliases: ["Queens Park Rangers", "QPR"],
      league_position: 17,
      promoted: true,
      relegated: false,
      managers: "Neil Warnock; Mark Hughes",
      start_manager: "Neil Warnock",
      manager_history: [
        { manager: "Neil Warnock", from: START_DATE, to: "2012-01-08" },
        { manager: "Mark Hughes", from: "2012-01-10", to: END_DATE }
      ]
    },
    {
      source_team: "Bolton Wanderers",
      club_name: "Bolton",
      aliases: ["Bolton Wanderers", "Bolton", "BOL"],
      league_position: 18,
      promoted: false,
      relegated: true,
      managers: "Owen Coyle",
      start_manager: "Owen Coyle",
      manager_history: [{ manager: "Owen Coyle", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Blackburn Rovers",
      club_name: "Blackburn",
      aliases: ["Blackburn Rovers", "Blackburn", "BLB"],
      league_position: 19,
      promoted: false,
      relegated: true,
      managers: "Steve Kean",
      start_manager: "Steve Kean",
      manager_history: [{ manager: "Steve Kean", from: START_DATE, to: END_DATE }]
    },
    {
      source_team: "Wolverhampton Wanderers",
      club_name: "Wolves",
      aliases: ["Wolverhampton Wanderers", "Wolverhampton", "Wolves", "WOL"],
      league_position: 20,
      promoted: false,
      relegated: true,
      managers: "Mick McCarthy; Terry Connor",
      start_manager: "Mick McCarthy",
      manager_history: [
        { manager: "Mick McCarthy", from: START_DATE, to: "2012-02-13" },
        { manager: "Terry Connor", from: "2012-02-14", to: END_DATE, caretaker: true }
      ]
    }
  ].map(club => Object.freeze({
    ...club,
    champions: club.league_position === 1,
    top_four: club.league_position <= 4,
    bottom_half: club.league_position >= 11
  }));

  function certify() {
    const issues = [];
    const positions = clubs.map(club => club.league_position).sort((a, b) => a - b);
    const canonicalNames = clubs.map(club => club.club_name);
    const sourceNames = clubs.map(club => club.source_team);
    const promoted = clubs.filter(club => club.promoted).map(club => club.club_name).sort();
    const relegated = clubs.filter(club => club.relegated).map(club => club.club_name).sort();

    if (clubs.length !== 20) issues.push(`Expected 20 clubs, found ${clubs.length}.`);
    if (new Set(canonicalNames).size !== 20) issues.push("Canonical club names are not unique.");
    if (new Set(sourceNames).size !== 20) issues.push("Source club names are not unique.");
    if (positions.join(",") !== Array.from({ length: 20 }, (_, index) => index + 1).join(",")) {
      issues.push("Final league positions are not a unique 1–20 set.");
    }
    if (clubs.filter(club => club.champions).length !== 1 || clubs.find(club => club.champions)?.league_position !== 1) {
      issues.push("Champion metadata does not resolve uniquely to league position 1.");
    }
    if (clubs.filter(club => club.top_four).length !== 4) issues.push("Top-four metadata does not contain exactly four clubs.");
    if (clubs.filter(club => club.bottom_half).length !== 10) issues.push("Bottom-half metadata does not contain exactly ten clubs.");
    if (promoted.join("|") !== ["Norwich", "QPR", "Swansea"].sort().join("|")) {
      issues.push(`Promoted club set is wrong: ${promoted.join(", ")}.`);
    }
    if (relegated.join("|") !== ["Blackburn", "Bolton", "Wolves"].sort().join("|")) {
      issues.push(`Relegated club set is wrong: ${relegated.join(", ")}.`);
    }
    for (const club of clubs) {
      if (!club.managers || !club.start_manager) issues.push(`${club.club_name}: missing manager metadata.`);
      if (!Array.isArray(club.manager_history) || !club.manager_history.length) issues.push(`${club.club_name}: missing manager history.`);
      if (!Array.isArray(club.aliases) || !club.aliases.length) issues.push(`${club.club_name}: missing aliases.`);
      if (club.relegated !== (club.league_position >= 18)) issues.push(`${club.club_name}: relegation flag disagrees with league position.`);
      if (club.champions !== (club.league_position === 1)) issues.push(`${club.club_name}: champion flag disagrees with league position.`);
      if (club.top_four !== (club.league_position <= 4)) issues.push(`${club.club_name}: top-four flag disagrees with league position.`);
      if (club.bottom_half !== (club.league_position >= 11)) issues.push(`${club.club_name}: bottom-half flag disagrees with league position.`);
    }

    return Object.freeze({
      season: SEASON,
      status: issues.length ? "FAIL" : "PASS",
      issues: Object.freeze(issues),
      clubs: clubs.length,
      positions: Object.freeze(positions),
      promoted: Object.freeze(promoted),
      relegated: Object.freeze(relegated),
      startDate: START_DATE,
      endDate: END_DATE
    });
  }

  const certification = certify();

  window.FPL_SEASON_METADATA_2011_12 = Object.freeze({
    version: "1.0.0",
    season: SEASON,
    startDate: START_DATE,
    endDate: END_DATE,
    clubs: Object.freeze(clubs),
    certification
  });

  /* Historical Import Centre reads this exact global from uploaded JS metadata files. */
  window.FPL_CLUB_METADATA = Object.freeze(clubs);
})();