import fs from 'node:fs';

const source = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');
const checks = [
  ['soft cap is two days', 'const WEEKLY_LEADER_SOFT_CAP = 2;'],
  ['weekly counts are batch-local', 'const weeklyLeaderDays = new Map();'],
  ['candidate scoring includes weekly penalty', 'score += weeklyLeaderPenalty(draft, weeklyLeaderDays);'],
  ['weighted selection penalises leaders after cap', 'if (priorLeaderDays >= WEEKLY_LEADER_SOFT_CAP)'],
  ['successful days commit leader usage', 'commitWeeklyLeaderDays(prompts, weeklyLeaderDays);']
];

for (const [label, needle] of checks) {
  if (!source.includes(needle)) throw new Error(`Missing weekly diversity check: ${label}`);
}

console.log('Weekly top-answer diversity policy verified.');
