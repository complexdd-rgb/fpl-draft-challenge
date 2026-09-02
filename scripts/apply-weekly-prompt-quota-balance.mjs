import fs from 'node:fs';

const path = 'js/admin-batch-calendar.js';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Missing patch anchor: ${label}`);
  source = source.replace(needle, replacement);
}

replaceOnce(
`  const FAMILY_STAT_PRIORITY = Object.freeze([\n    "points", "goals", "assists", "goal-involvements", "minutes", "clean-sheets", "saves",\n    "bonus", "cards", "discipline", "budget", "final-price", "age", "young", "veteran",\n    "promoted", "relegated", "bottom-half", "bottomhalf", "mid-table", "league-position",\n    "top-four", "survival"\n  ]);\n`,
`  const FAMILY_STAT_PRIORITY = Object.freeze([\n    "points", "goals", "assists", "goal-involvements", "minutes", "clean-sheets", "saves",\n    "bonus", "cards", "discipline", "budget", "final-price", "age", "young", "veteran",\n    "promoted", "relegated", "bottom-half", "bottomhalf", "mid-table", "league-position",\n    "top-four", "survival"\n  ]);\n  const MIX_STAT_TAGS = new Set([\n    "points", "goals", "assists", "goal-involvements", "minutes", "clean-sheets", "saves",\n    "bonus", "cards", "discipline", "budget", "starting-price", "final-price", "exact-stat",\n    "penalties-saved", "penalties-missed", "age", "young", "veteran"\n  ]);\n  const MIX_CONTEXT_TAGS = new Set([\n    "relegated", "promoted", "bottom-half", "bottomhalf", "mid-table", "survival",\n    "outside-big-six", "outside-top-four", "manager", "teammate", "club-season",\n    "season-rule", "season-exact", "season-before", "season-after", "season-between",\n    "career-total", "career-seasons", "career-clubs", "career-overlap", "returned-club", "played-for-both"\n  ]);\n  const DAILY_PROMPT_MIX_TARGET = Object.freeze({ nationality: 1, stats: 4, context: 2, maxName: 2 });\n`,
'quota constants'
);

replaceOnce(
`  function promptFamily(prompt) {\n`,
`  function promptTags(prompt) {\n    return Array.isArray(prompt?.tags) ? prompt.tags : [];\n  }\n\n  function isNationalityPrompt(prompt) {\n    const family = String(prompt?.family || "").toLowerCase();\n    return family.includes("nationality") || promptTags(prompt).some(tag => tag === "nationality" || String(tag).startsWith("country-"));\n  }\n\n  function isNameRulePrompt(prompt) {\n    const family = String(prompt?.family || "").toLowerCase();\n    return family.includes("name:") || promptTags(prompt).some(tag => FAMILY_NAME_TAGS.has(tag));\n  }\n\n  function isStatMixPrompt(prompt) {\n    const tags = promptTags(prompt);\n    if (tags.some(tag => MIX_STAT_TAGS.has(tag))) return true;\n    const family = String(promptFamily(prompt) || "").toLowerCase();\n    return [...MIX_STAT_TAGS].some(tag => family.includes(tag));\n  }\n\n  function isContextMixPrompt(prompt) {\n    const tags = promptTags(prompt);\n    if (tags.some(tag => MIX_CONTEXT_TAGS.has(tag))) return true;\n    const family = String(promptFamily(prompt) || "").toLowerCase();\n    return family.includes("season:") || family.includes("career:") || family.includes("manager") || family.includes("teammate");\n  }\n\n  function promptMixCounts(prompts) {\n    return {\n      nationality: prompts.filter(isNationalityPrompt).length,\n      stats: prompts.filter(isStatMixPrompt).length,\n      context: prompts.filter(isContextMixPrompt).length,\n      name: prompts.filter(isNameRulePrompt).length\n    };\n  }\n\n  function promptMixMeets(counts, plan) {\n    return counts.nationality >= plan.nationality && counts.stats >= plan.stats && counts.context >= plan.context && counts.name <= plan.maxName;\n  }\n\n  function buildPromptMixQuotaPlan({ basePools, exactPlan, familyPlan }) {\n    const eligible = Object.values(basePools).flat().filter(prompt => exactPlanAllows(prompt, exactPlan) && familyPlanAllows(prompt, familyPlan));\n    const nationalityAvailable = eligible.filter(isNationalityPrompt).length;\n    const statAvailable = eligible.filter(isStatMixPrompt).length;\n    const contextAvailable = eligible.filter(isContextMixPrompt).length;\n    const nonNameAvailable = eligible.filter(prompt => !isNameRulePrompt(prompt)).length;\n    return {\n      nationality: Math.min(DAILY_PROMPT_MIX_TARGET.nationality, nationalityAvailable),\n      stats: Math.min(DAILY_PROMPT_MIX_TARGET.stats, statAvailable),\n      context: Math.min(DAILY_PROMPT_MIX_TARGET.context, contextAvailable),\n      maxName: nonNameAvailable >= 9 ? DAILY_PROMPT_MIX_TARGET.maxName : 11,\n      eligible: eligible.length\n    };\n  }\n\n  function promptFamily(prompt) {\n`,
'quota helpers before promptFamily'
);

replaceOnce(
`        const generated = await generateCandidateForDay({\n          basePools,\n          settings,\n          requiredFormation,\n          formationSlots,\n          exactPlan,\n          familyPlan,\n          weeklyLeaderDays,\n          dayIndex,\n          date,\n          token\n        });\n`,
`        const promptMixPlan = buildPromptMixQuotaPlan({ basePools, exactPlan, familyPlan });\n        const generated = await generateCandidateForDay({\n          basePools,\n          settings,\n          requiredFormation,\n          formationSlots,\n          exactPlan,\n          familyPlan,\n          promptMixPlan,\n          weeklyLeaderDays,\n          dayIndex,\n          date,\n          token\n        });\n`,
'pass quota plan into generator'
);

replaceOnce(
`        const validation = validateChallenge(challenge, perfect, settings, exactPlan, familyPlan);\n`,
`        const validation = validateChallenge(challenge, perfect, settings, exactPlan, familyPlan, promptMixPlan, generated.quotaRelaxed);\n`,
'validate quota plan'
);

replaceOnce(
`          antiMetaCount: prompts.filter(isAntiMeta).length,\n          familyCooldownRelaxedPositions: [...familyPlan.relaxedPositions],\n`,
`          antiMetaCount: prompts.filter(isAntiMeta).length,\n          promptMix: promptMixCounts(prompts),\n          promptMixTarget: { ...promptMixPlan },\n          promptMixQuotaRelaxed: Boolean(generated.quotaRelaxed),\n          familyCooldownRelaxedPositions: [...familyPlan.relaxedPositions],\n`,
'result quota metadata'
);

replaceOnce(
`  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, weeklyLeaderDays, dayIndex, date, token }) {\n`,
`  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, promptMixPlan, weeklyLeaderDays, dayIndex, date, token }) {\n`,
'generator quota parameter'
);

replaceOnce(
`        const choice = weightedPick(options, draft, settings, familyPlan, weeklyLeaderDays);\n`,
`        const choice = weightedPick(options, draft, settings, familyPlan, promptMixPlan, weeklyLeaderDays);\n`,
'weighted pick quota parameter'
);

replaceOnce(
`        balance: scoreDraft(draft, settings, weeklyLeaderDays),\n`,
`        balance: scoreDraft(draft, settings, promptMixPlan, weeklyLeaderDays),\n`,
'score quota parameter'
);

replaceOnce(
`    if (!candidates.length) return { ok: false, reason: "No complete XI could be generated with the current restrictions." };\n    candidates.sort((left, right) => left.balance - right.balance || left.naiveScore - right.naiveScore);\n\n    if (settings.maxPerfectScore <= 0) {\n      for (const candidate of candidates.slice(0, 35)) {\n        const perfect = calculatePerfectXI(candidate.prompts);\n        if (perfect.possible) return { ok: true, prompts: candidate.prompts, perfect };\n`,
`    if (!candidates.length) return { ok: false, reason: "No complete XI could be generated with the current restrictions." };\n    candidates.sort((left, right) => left.balance - right.balance || left.naiveScore - right.naiveScore);\n    const quotaCandidates = candidates.filter(candidate => promptMixMeets(promptMixCounts(candidate.prompts), promptMixPlan));\n    const rankedCandidates = quotaCandidates.length ? quotaCandidates : candidates;\n    const quotaRelaxed = quotaCandidates.length === 0;\n\n    if (settings.maxPerfectScore <= 0) {\n      for (const candidate of rankedCandidates.slice(0, 35)) {\n        const perfect = calculatePerfectXI(candidate.prompts);\n        if (perfect.possible) return { ok: true, prompts: candidate.prompts, perfect, quotaRelaxed };\n`,
'quota candidate preference'
);

replaceOnce(
`    const definitelyUnderCap = candidates.filter(candidate => candidate.naiveScore <= settings.maxPerfectScore);\n`,
`    const definitelyUnderCap = rankedCandidates.filter(candidate => candidate.naiveScore <= settings.maxPerfectScore);\n`,
'quota candidates under cap'
);

replaceOnce(
`        return { ok: true, prompts: candidate.prompts, perfect };\n`,
`        return { ok: true, prompts: candidate.prompts, perfect, quotaRelaxed };\n`,
'quota return under cap'
);

replaceOnce(
`    const closest = [...candidates]\n`,
`    const closest = [...rankedCandidates]\n`,
'quota candidates closest'
);

replaceOnce(
`        if (perfect.score <= settings.maxPerfectScore) return { ok: true, prompts: candidate.prompts, perfect };\n`,
`        if (perfect.score <= settings.maxPerfectScore) return { ok: true, prompts: candidate.prompts, perfect, quotaRelaxed };\n`,
'quota return closest'
);

replaceOnce(
`  function weightedPick(options, currentDraft, settings, familyPlan, weeklyLeaderDays) {\n`,
`  function weightedPick(options, currentDraft, settings, familyPlan, promptMixPlan, weeklyLeaderDays) {\n`,
'weighted pick signature'
);

replaceOnce(
`    const weighted = options.map(prompt => {\n      const difficultyDistance = Math.abs((DIFFICULTY_VALUE[prompt.difficulty] || 2) - target);\n      let weight = Math.max(1, Number(prompt.rating) || 3) * (1 / (1 + difficultyDistance));\n`,
`    const currentMix = promptMixCounts(currentDraft);\n    const weighted = options.map(prompt => {\n      const difficultyDistance = Math.abs((DIFFICULTY_VALUE[prompt.difficulty] || 2) - target);\n      let weight = Math.max(1, Number(prompt.rating) || 3) * (1 / (1 + difficultyDistance));\n      if (currentMix.nationality < promptMixPlan.nationality && isNationalityPrompt(prompt)) weight *= 7;\n      if (currentMix.stats < promptMixPlan.stats && isStatMixPrompt(prompt)) weight *= 2.8;\n      if (currentMix.context < promptMixPlan.context && isContextMixPrompt(prompt)) weight *= 2.4;\n      if (currentMix.name >= promptMixPlan.maxName && isNameRulePrompt(prompt)) weight /= 18;\n`,
'quota weighted boosts'
);

replaceOnce(
`  function scoreDraft(draft, settings, weeklyLeaderDays) {\n`,
`  function scoreDraft(draft, settings, promptMixPlan, weeklyLeaderDays) {\n`,
'score quota signature'
);

replaceOnce(
`    for (const count of tagCounts.values()) if (count > 2) score += (count - 2) * 14;\n    score += answerDiversityPenalty(draft);\n`,
`    for (const count of tagCounts.values()) if (count > 2) score += (count - 2) * 14;\n    const mix = promptMixCounts(draft);\n    score += Math.max(0, promptMixPlan.nationality - mix.nationality) * 280;\n    score += Math.max(0, promptMixPlan.stats - mix.stats) * 120;\n    score += Math.max(0, promptMixPlan.context - mix.context) * 110;\n    score += Math.max(0, mix.name - promptMixPlan.maxName) * 180;\n    score += answerDiversityPenalty(draft);\n`,
'quota score penalties'
);

replaceOnce(
`  function validateChallenge(challenge, perfect, settings, exactPlan, familyPlan) {\n`,
`  function validateChallenge(challenge, perfect, settings, exactPlan, familyPlan, promptMixPlan, quotaRelaxed) {\n`,
'validate quota signature'
);

replaceOnce(
`    if (prompts.filter(isAntiMeta).length < settings.minAntiMeta) issues.push("Minimum anti-meta prompt target was not met.");\n\n    for (const prompt of prompts) {\n`,
`    if (prompts.filter(isAntiMeta).length < settings.minAntiMeta) issues.push("Minimum anti-meta prompt target was not met.");\n    const mix = promptMixCounts(prompts);\n    if (!quotaRelaxed && !promptMixMeets(mix, promptMixPlan)) issues.push("Prompt-family mix quota was not met.");\n\n    for (const prompt of prompts) {\n`,
'quota validation'
);

replaceOnce(
`        antiMetaCount: result.antiMetaCount,\n        promptIds: result.promptIds,\n`,
`        antiMetaCount: result.antiMetaCount,\n        promptMix: result.promptMix,\n        promptMixTarget: result.promptMixTarget,\n        promptMixQuotaRelaxed: result.promptMixQuotaRelaxed,\n        promptIds: result.promptIds,\n`,
'batch report quota metadata'
);

replaceOnce(
`      promptIds: [...(result.promptIds || [])],\n      promptFamilies: [...(result.promptFamilies || [])],\n`,
`      promptIds: [...(result.promptIds || [])],\n      promptFamilies: [...(result.promptFamilies || [])],\n      promptMix: { ...(result.promptMix || {}) },\n      promptMixTarget: { ...(result.promptMixTarget || {}) },\n      promptMixQuotaRelaxed: Boolean(result.promptMixQuotaRelaxed),\n`,
'export quota metadata'
);

fs.writeFileSync(path, source);
console.log('Applied weekly prompt quota balancing to', path);
