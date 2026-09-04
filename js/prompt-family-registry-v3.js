/* FPL Draft Challenge — Prompt Studio V3 family registry.
   Describes the families available to the clean-room V3 library. This registry never creates,
   rates, approves or enables prompts by itself. */
(() => {
  "use strict";
  if (window.FPL_PROMPT_FAMILY_REGISTRY_V3?.version === "3.0.0") return;

  const families = [
    ["season-stats", "Season stats", "Core", "Single-season goals, assists, points, clean sheets, saves and other familiar totals."],
    ["combined-stats", "Combined stats", "Core", "Two or more familiar season statistics combined into one prompt."],
    ["exact-bands", "Exact values & bands", "Core", "Exact totals, ranges and threshold bands."],
    ["club-stat", "Club + stat", "Core", "Club membership combined with a season statistic."],
    ["position-stat", "Position + stat", "Core", "Position-restricted statistical prompts."],
    ["nationality-stat", "Nationality + stat", "Core", "Nationality combined with familiar season statistics."],
    ["league-position", "League position", "Priority", "Champions, top four, top half, bottom half, promoted and relegated club context."],
    ["promoted-clubs", "Promoted clubs", "Priority", "Promoted-team players and survival/first-season achievements."],
    ["relegated-clubs", "Relegated clubs", "Priority", "Relegated-team achievements and anti-meta combinations."],
    ["champions", "Champions", "Priority", "Players from title-winning sides and title-season achievements."],
    ["career-totals", "Career totals", "Core", "Premier League career goals, appearances, points and other cumulative records."],
    ["career-longevity", "Career longevity", "Priority", "Seasons played, decade span and long Premier League careers."],
    ["club-journey", "Club journey", "Core", "Played for both clubs, multiple clubs and transfer-path prompts."],
    ["club-count", "Premier League club count", "Priority", "Players who represented a specified number of Premier League clubs."],
    ["return-journey", "Return to former club", "Core", "Players who returned to a former Premier League club."],
    ["career-consistency", "Career consistency", "Priority", "Repeated achievements across consecutive or multiple seasons."],
    ["career-peak", "Career peak", "Priority", "Best-season and peak-performance achievements."],
    ["rise-fall", "Rise & fall", "Priority", "Season-to-season improvement or decline."],
    ["comeback", "Premier League comeback", "New", "Players who returned to the league after one or more seasons away."],
    ["one-club", "One-club Premier League career", "New", "Long Premier League careers recorded with only one league club."],
    ["one-season-wonder", "One-season wonder", "New", "A standout season compared with the rest of the player's Premier League career."],
    ["era-crossover", "Era crossover", "New", "Players whose Premier League careers span decades or eras."],
    ["manager", "Manager relationship", "Core", "Player achievements under a named manager."],
    ["manager-journey", "Manager journey", "Priority", "Players who followed or met a manager at multiple clubs."],
    ["teammate", "Teammate relationship", "Selective", "Career-overlap and teammate relationship prompts."],
    ["name-identity", "Name & identity", "Selective", "First-name, surname, initials and other recognisable identity rules."],
    ["anti-meta", "Anti-meta", "Priority", "Good achievements with deliberately non-obvious score, price or status constraints."],
    ["value", "Starting-price value", "FPL era", "Starting-price value prompts for seasons with reliable FPL price data."],
    ["premium-disappointment", "Premium disappointment", "FPL era", "High starting-price players who missed a familiar performance threshold."],
    ["minutes-role", "Minutes & role", "Core", "Minutes played combined with goals, assists or defensive output."],
    ["cross-season-achievement", "Cross-season achievement", "Priority", "The same achievement reached in multiple different seasons."],
    ["club-status-journey", "Club-status journey", "Priority", "Career paths involving promoted, relegated, champion or top-four clubs."],
    ["composite-story", "Composite story", "Priority", "Two or three simple facts combined into a recognisable quiz-style story prompt."]
  ].map(([id, name, tier, description]) => Object.freeze({ id, name, tier, description }));

  window.FPL_PROMPT_FAMILY_REGISTRY_V3 = Object.freeze({
    ready: true,
    version: "3.0.0",
    families: Object.freeze(families)
  });
  window.dispatchEvent(new CustomEvent("fpl:prompt-family-registry-v3-ready", { detail: window.FPL_PROMPT_FAMILY_REGISTRY_V3 }));
})();
