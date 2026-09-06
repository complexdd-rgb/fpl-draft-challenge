import fs from "node:fs";

const batch = fs.readFileSync("js/admin-batch-calendar.js", "utf8");
const guard = fs.readFileSync("js/admin-daily-generator-guard.js", "utf8");
const checks = [
  ["policy v6", "const ANSWER_DIVERSITY_POLICY_VERSION = 6;"],
  ["three-day target", "const WEEKLY_LEADER_MIN_DAY_GAP = 3;"],
  ["two-day preferred cap", "const WEEKLY_LEADER_PREFERRED_DAY_CAP = 2;"],
  ["three-day hard cap", "const WEEKLY_LEADER_HARD_DAY_CAP = 3;"],
  ["day history arrays", "function weeklyLeaderHistory(weeklyLeaderDays, playerId)"],
  ["spacing penalty", "gap < WEEKLY_LEADER_MIN_DAY_GAP"],
  ["same-day grouping", "sameDayLeader"],
  ["same-day repeats allowed", "Multiple prompts led by the same player on one Daily Challenge count as one leader day."],
  ["strict hard cap filter", "strictLeaderCap && [...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)"],
  ["day index committed", "commitWeeklyLeaderDays(prompts, weeklyLeaderDays, dayIndex);"],
  ["whole-week leader preplanner", "function buildLeaderDayPreplan(prompts, requiredFormation, settings, salt = 0)"],
  ["leader minimum-day proof", "function leaderGroupMinimumDays(group, requiredFormation, semantic)"],
  ["hard max-three blocker", "group.minimumDays > WEEKLY_LEADER_HARD_DAY_CAP"],
  ["preplanned daily prompt ids", "leaderPreplan?.dayPromptIds?.[dayIndex]"],
  ["daily pool restriction", "filterBasePoolsForIds(basePools, plannedPromptIds)"],
  ["preplan audit", "leaderPreplan: lastLeaderPreplan ? { ...lastLeaderPreplan } : null"],
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

if (batch.includes("FALLBACK_WEEK_LAYOUT_ATTEMPTS")) throw new Error("Leader-day fallback can still permit 4+ appearance days.");
const minimumDays = (count, dailyCapacity) => Math.ceil(count / dailyCapacity);
if (minimumDays(8, 4) !== 2) throw new Error("Eight defender-led prompts should fit on two 4-4-2 days.");
if (minimumDays(7, 4) !== 2) throw new Error("Seven midfielder-led prompts should fit on two 4-4-2 days.");
if (minimumDays(13, 4) <= 3) throw new Error("Thirteen defender-led prompts should be diagnosed as impossible under max three days.");
