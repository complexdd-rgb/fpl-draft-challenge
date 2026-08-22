import fs from 'node:fs';

const path = 'js/admin-batch-calendar.js';
let source = fs.readFileSync(path, 'utf8');
const marker = /const ANSWER_DIVERSITY_POLICY_VERSION = (\d+);/;
const markerMatch = source.match(marker);
if (markerMatch && Number(markerMatch[1]) >= 1) {
  console.log(`Answer-diversity policy v${markerMatch[1]} already applied.`);
  process.exit(0);
}

const helperAnchor = '  function weightedPick(options, currentDraft, settings, familyPlan) {';
if (!source.includes(helperAnchor)) throw new Error('weightedPick anchor not found');

const helpers = `  const ANSWER_DIVERSITY_POLICY_VERSION = 1;\n  const ANSWER_DIVERSITY_POOL_SIZE = 16;\n\n  function topAnswerRecords(prompt, limit = ANSWER_DIVERSITY_POOL_SIZE) {\n    const stats = core.getPromptStats(prompt);\n    const values = stats?.bestByPlayer?.values ? [...stats.bestByPlayer.values()] : [];\n    return values\n      .filter(Boolean)\n      .sort((left, right) => Number(right.points || 0) - Number(left.points || 0) || String(left.name || \"\").localeCompare(String(right.name || \"\")))\n      .slice(0, limit);\n  }\n\n  function topAnswerPlayerIds(prompt, limit = ANSWER_DIVERSITY_POOL_SIZE) {\n    return new Set(topAnswerRecords(prompt, limit).map(record => record.playerId).filter(Boolean));\n  }\n\n  function answerOverlapWithDraft(prompt, currentDraft) {\n    if (!currentDraft.length) return 0;\n    const candidate = topAnswerPlayerIds(prompt, 12);\n    const alreadyUsed = new Set(currentDraft.flatMap(item => [...topAnswerPlayerIds(item, 12)]));\n    let overlap = 0;\n    for (const playerId of candidate) if (alreadyUsed.has(playerId)) overlap += 1;\n    return overlap;\n  }\n\n  function leaderRepeatedInDraft(prompt, currentDraft) {\n    const leaderId = core.getPromptStats(prompt)?.bestAnswer?.playerId;\n    if (!leaderId) return false;\n    return currentDraft.some(item => core.getPromptStats(item)?.bestAnswer?.playerId === leaderId);\n  }\n\n  function answerDiversityPenalty(draft) {\n    const leaders = new Map();\n    const clubs = new Map();\n    const seasons = new Map();\n    const scoreBands = new Map();\n    const pools = draft.map(prompt => topAnswerPlayerIds(prompt));\n    let penalty = 0;\n\n    for (const prompt of draft) {\n      const leader = core.getPromptStats(prompt)?.bestAnswer;\n      if (!leader) continue;\n      if (leader.playerId) leaders.set(leader.playerId, (leaders.get(leader.playerId) || 0) + 1);\n      if (leader.club) clubs.set(leader.club, (clubs.get(leader.club) || 0) + 1);\n      if (leader.season) seasons.set(leader.season, (seasons.get(leader.season) || 0) + 1);\n      const points = Number(leader.points) || 0;\n      const band = points < 50 ? \"0-49\" : points < 100 ? \"50-99\" : points < 150 ? \"100-149\" : \"150+\";\n      scoreBands.set(band, (scoreBands.get(band) || 0) + 1);\n    }\n\n    for (const count of leaders.values()) if (count > 1) penalty += (count - 1) * 60;\n    for (const count of clubs.values()) if (count > 2) penalty += (count - 2) * 10;\n    for (const count of seasons.values()) if (count > 3) penalty += (count - 3) * 6;\n    for (const count of scoreBands.values()) if (count > 4) penalty += (count - 4) * 3;\n\n    for (let left = 0; left < pools.length; left += 1) {\n      for (let right = left + 1; right < pools.length; right += 1) {\n        const a = pools[left];\n        const b = pools[right];\n        if (!a.size || !b.size) continue;\n        let intersection = 0;\n        for (const playerId of a) if (b.has(playerId)) intersection += 1;\n        const overlapRatio = intersection / Math.min(a.size, b.size);\n        penalty += overlapRatio * 28;\n      }\n    }\n    return penalty;\n  }\n\n`;
source = source.replace(helperAnchor, helpers + helperAnchor);

const weightAnchor = '      if (familyPlan?.recentFamilies?.has(promptFamily(prompt))) weight /= 12;';
if (!source.includes(weightAnchor)) throw new Error('weightedPick scoring anchor not found');
source = source.replace(weightAnchor, `      if (leaderRepeatedInDraft(prompt, currentDraft)) weight /= 8;\n      const answerOverlap = answerOverlapWithDraft(prompt, currentDraft);\n      weight /= 1 + answerOverlap * 0.65;\n${weightAnchor}`);

const scoreAnchor = '    return score + Math.random() * 0.25;';
if (!source.includes(scoreAnchor)) throw new Error('scoreDraft return anchor not found');
source = source.replace(scoreAnchor, `    score += answerDiversityPenalty(draft);\n${scoreAnchor}`);

fs.writeFileSync(path, source);
console.log('Applied answer-diversity policy v1.');