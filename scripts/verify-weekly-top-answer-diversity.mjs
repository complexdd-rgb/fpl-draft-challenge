import fs from "node:fs";

const batch = fs.readFileSync("js/admin-batch-calendar.js", "utf8");
const guard = fs.readFileSync("js/admin-daily-generator-guard.js", "utf8");
const checks = [
  ["policy v5", "const ANSWER_DIVERSITY_POLICY_VERSION = 5;"],
  ["three-day target", "const WEEKLY_LEADER_MIN_DAY_GAP = 3;"],
  ["two-day preferred cap", "const WEEKLY_LEADER_PREFERRED_DAY_CAP = 2;"],
  ["three-day hard cap", "const WEEKLY_LEADER_HARD_DAY_CAP = 3;"],
  ["day history arrays", "function weeklyLeaderHistory(weeklyLeaderDays, playerId)"],
  ["spacing penalty", "gap < WEEKLY_LEADER_MIN_DAY_GAP"],
  ["same-day grouping", "sameDayLeader"],
  ["same-day repeats allowed", "Multiple prompts led by the same player on one Daily Challenge count as one leader day."],
  ["strict hard cap filter", "strictLeaderCap && [...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)"],
  ["strict week retries", "const STRICT_WEEK_LAYOUT_ATTEMPTS = 4;"],
  ["fallback week retries", "const FALLBACK_WEEK_LAYOUT_ATTEMPTS = 2;"],
  ["layout state reset", "virtualSchedule.splice(virtualScheduleBaselineLength);"],
  ["rotation state rebuild", "buildWeeklyReservoirRotationState(basePools)"],
  ["fallback audit", "fallbackUsed: lastLeaderLayoutPolicy?.strictLeaderCap === false"],
  ["day index committed", "commitWeeklyLeaderDays(prompts, weeklyLeaderDays, dayIndex);"],
  ["actual week audit", "function weeklyTopAnswerDiversity()"],
  ["spacing audit", "spacingViolationCount"],
  ["audit exported", "getTopAnswerDayAudit"],
  ["guard uses day audit", "getTopAnswerDayAudit?.()"]
];
for (const [label, token] of checks) {
  if (!(batch.includes(token) || guard.includes(token))) throw new Error(`Missing leader-day diversity check: ${label}`);
}
if (batch.includes("const WEEKLY_LEADER_SOFT_CAP = 1;")) throw new Error("Old one-day soft cap remains.");
if (batch.includes("if (leaderRepeatedInDraft(prompt, currentDraft)) weight /= 8;")) throw new Error("Same-day leader repeats are still penalised.");
console.log("Weekly leader-day diversity policy verified.");
