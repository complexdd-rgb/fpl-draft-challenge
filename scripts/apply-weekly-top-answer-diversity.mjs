import fs from 'node:fs';

const path = 'js/admin-batch-calendar.js';
let source = fs.readFileSync(path, 'utf8');

const replacements = [
  [
    '  const ANSWER_DIVERSITY_POLICY_VERSION = 1;\n  const ANSWER_DIVERSITY_POOL_SIZE = 16;\n',
    '  const ANSWER_DIVERSITY_POLICY_VERSION = 2;\n  const ANSWER_DIVERSITY_POOL_SIZE = 16;\n  const WEEKLY_LEADER_SOFT_CAP = 2;\n  const WEEKLY_LEADER_BASE_PENALTY = 180;\n'
  ],
  [
    '    const rotationState = buildExactRotationState(virtualSchedule, startDate, basePools, promptById);\n\n    try {',
    '    const rotationState = buildExactRotationState(virtualSchedule, startDate, basePools, promptById);\n    const weeklyLeaderDays = new Map();\n\n    try {'
  ],
  [
    '          familyPlan,\n          dayIndex,\n          date,\n          token\n        });',
    '          familyPlan,\n          weeklyLeaderDays,\n          dayIndex,\n          date,\n          token\n        });'
  ],
  [
    '        batchResults.push(result);\n        if (!validation.length) commitExactRotationSelection(rotationState, exactPlan, prompts, basePools);',
    '        batchResults.push(result);\n        if (!validation.length) {\n          commitExactRotationSelection(rotationState, exactPlan, prompts, basePools);\n          commitWeeklyLeaderDays(prompts, weeklyLeaderDays);\n        }'
  ],
  [
    '  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, dayIndex, date, token }) {',
    '  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, weeklyLeaderDays, dayIndex, date, token }) {'
  ],
  [
    '        const choice = weightedPick(options, draft, settings, familyPlan);',
    '        const choice = weightedPick(options, draft, settings, familyPlan, weeklyLeaderDays);'
  ],
  [
    '        balance: scoreDraft(draft, settings),',
    '        balance: scoreDraft(draft, settings, weeklyLeaderDays),'
  ],
  [
    '  function weightedPick(options, currentDraft, settings, familyPlan) {',
    '  function weightedPick(options, currentDraft, settings, familyPlan, weeklyLeaderDays) {'
  ],
  [
    '      if (leaderRepeatedInDraft(prompt, currentDraft)) weight /= 8;\n      const answerOverlap = answerOverlapWithDraft(prompt, currentDraft);',
    '      if (leaderRepeatedInDraft(prompt, currentDraft)) weight /= 8;\n      const leaderId = core.getPromptStats(prompt)?.bestAnswer?.playerId;\n      const priorLeaderDays = leaderId ? Number(weeklyLeaderDays?.get(leaderId) || 0) : 0;\n      if (priorLeaderDays >= WEEKLY_LEADER_SOFT_CAP) {\n        const excess = priorLeaderDays - WEEKLY_LEADER_SOFT_CAP + 1;\n        weight /= 1 + excess * excess * 12;\n      }\n      const answerOverlap = answerOverlapWithDraft(prompt, currentDraft);'
  ],
  [
    '  function scoreDraft(draft, settings) {',
    '  function scoreDraft(draft, settings, weeklyLeaderDays) {'
  ],
  [
    '    score += answerDiversityPenalty(draft);\n    return score + Math.random() * 0.25;',
    '    score += answerDiversityPenalty(draft);\n    score += weeklyLeaderPenalty(draft, weeklyLeaderDays);\n    return score + Math.random() * 0.25;'
  ]
];

for (const [before, after] of replacements) {
  if (source.includes(after)) continue;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one patch target, found ${count}: ${before.slice(0, 90)}`);
  source = source.replace(before, after);
}

const anchor = '  function weightedPick(options, currentDraft, settings, familyPlan, weeklyLeaderDays) {';
const helpers = `  function weeklyLeaderIds(draft) {\n    const ids = new Set();\n    for (const prompt of draft || []) {\n      const playerId = core.getPromptStats(prompt)?.bestAnswer?.playerId;\n      if (playerId) ids.add(playerId);\n    }\n    return ids;\n  }\n\n  function weeklyLeaderPenalty(draft, weeklyLeaderDays) {\n    if (!(weeklyLeaderDays instanceof Map) || !weeklyLeaderDays.size) return 0;\n    let penalty = 0;\n    for (const playerId of weeklyLeaderIds(draft)) {\n      const projectedDays = Number(weeklyLeaderDays.get(playerId) || 0) + 1;\n      if (projectedDays <= WEEKLY_LEADER_SOFT_CAP) continue;\n      const excess = projectedDays - WEEKLY_LEADER_SOFT_CAP;\n      penalty += excess * excess * WEEKLY_LEADER_BASE_PENALTY;\n    }\n    return penalty;\n  }\n\n  function commitWeeklyLeaderDays(draft, weeklyLeaderDays) {\n    for (const playerId of weeklyLeaderIds(draft)) {\n      weeklyLeaderDays.set(playerId, Number(weeklyLeaderDays.get(playerId) || 0) + 1);\n    }\n  }\n\n`;
if (!source.includes('  function weeklyLeaderPenalty(draft, weeklyLeaderDays) {')) {
  if (!source.includes(anchor)) throw new Error('Weekly diversity helper anchor not found.');
  source = source.replace(anchor, helpers + anchor);
}

fs.writeFileSync(path, source);
console.log('Weekly top-answer diversity patch applied.');
