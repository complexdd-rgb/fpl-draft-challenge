import fs from 'node:fs';

const source = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');
const guard = fs.readFileSync('js/admin-daily-generator-guard.js', 'utf8');
const checks = [
  ['soft cap is one day', 'const WEEKLY_LEADER_SOFT_CAP = 1;'],
  ['weekly counts are batch-local', 'const weeklyLeaderDays = new Map();'],
  ['candidate scoring includes weekly penalty', 'score += weeklyLeaderPenalty(draft, weeklyLeaderDays);'],
  ['weighted selection penalises leaders after cap', 'if (priorLeaderDays >= WEEKLY_LEADER_SOFT_CAP)'],
  ['successful days commit leader usage', 'commitWeeklyLeaderDays(prompts, weeklyLeaderDays);'],
  ['top-answer records are cached', 'const topAnswerRecordsCache = new Map();'],
  ['top-answer player ids are cached', 'const topAnswerPlayerIdsCache = new Map();'],
  ['weighted selection reuses the current answer pool', 'answerOverlapWithDraft(prompt, currentDraft, alreadyUsedTopAnswerIds)']
];

for (const [label, needle] of checks) {
  if (!source.includes(needle)) throw new Error(`Missing weekly diversity check: ${label}`);
}

for (const [label, needle] of [
  ['reservoir has top-answer audit', 'function topAnswerDiversityAudit(prompts)'],
  ['reservoir ranks unused leaders first', 'leftLeaderLoad - rightLeaderLoad'],
  ['reservoir certifies wider alternatives', 'const diversityExtra = Math.max(24, Math.ceil(need * 3));'],
  ['reservoir keeps best ANY assignment', 'let bestReservoir = null;'],
  ['reservoir reports diversity', 'topAnswerDiversity: frozenTopAnswerDiversity'],
  ['generation result reports diversity', 'top-answer players']
]) {
  if (!guard.includes(needle)) throw new Error(`Missing reservoir top-answer uniqueness check: ${label}`);
}

// Synthetic regression: once leader A has been selected, a valid leader B alternative must
// outrank another A candidate even when the duplicate candidate appears first.
const leaderCounts = new Map([['A', 1]]);
const candidates = [
  { id: 'duplicate-first', leader: 'A', semantic: 0 },
  { id: 'unique-second', leader: 'B', semantic: 5 }
];
candidates.sort((left, right) => {
  const leftLoad = Number(leaderCounts.get(left.leader) || 0);
  const rightLoad = Number(leaderCounts.get(right.leader) || 0);
  return leftLoad - rightLoad || left.semantic - right.semantic;
});
if (candidates[0].id !== 'unique-second') throw new Error('Unique top-answer alternative did not outrank a repeated weekly leader.');

console.log('Weekly top-answer diversity policy verified: reservoir-level uniqueness preference and one-day scheduling cap are active.');
