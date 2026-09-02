import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = 'js/admin-batch-calendar.js';
let source = fs.readFileSync(path, 'utf8');

const marker = 'const NATIONALITY_RESERVATION_POLICY_VERSION = 1;';
if (!source.includes(marker)) {
  const replacements = [];
  const replaceOnce = (label, before, after) => {
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`${label}: expected one patch anchor, found ${count}.`);
    source = source.replace(before, after);
    replacements.push(label);
  };

  replaceOnce(
    'policy marker',
    '  const DAILY_PROMPT_MIX_TARGET = Object.freeze({ nationality: 1, stats: 4, context: 2, maxName: 2 });\n  const ROTATION_POLICY_VERSION = 1;',
    '  const DAILY_PROMPT_MIX_TARGET = Object.freeze({ nationality: 1, stats: 4, context: 2, maxName: 2 });\n  const NATIONALITY_RESERVATION_POLICY_VERSION = 1;\n  const ROTATION_POLICY_VERSION = 1;'
  );

  replaceOnce(
    'freshness fallback',
    '      const available = basePools[position].filter(prompt => !extraBlockedIds.has(prompt.id) && !futureReservedIds.has(prompt.id));\n      const unused = available.filter(prompt => !positionState.usedIds.has(prompt.id));',
    '      let available = basePools[position].filter(prompt => !extraBlockedIds.has(prompt.id) && !futureReservedIds.has(prompt.id));\n      // Browser/live freshness is a soft guard. If it removes every nationality option for a\n      // position, restore nationality prompts that are not reserved by a future scheduled day.\n      // Exact-cycle usage still remains hard because `unused` is calculated afterwards.\n      if (!available.some(isNationalityPrompt)) {\n        const nationalityFreshnessFallback = basePools[position].filter(prompt =>\n          isNationalityPrompt(prompt) && !futureReservedIds.has(prompt.id)\n        );\n        if (nationalityFreshnessFallback.length) {\n          available = [...new Map([...available, ...nationalityFreshnessFallback].map(prompt => [prompt.id, prompt])).values()];\n        }\n      }\n      const unused = available.filter(prompt => !positionState.usedIds.has(prompt.id));'
  );

  replaceOnce(
    'hard quota plan',
    '  function buildPromptMixQuotaPlan({ basePools, exactPlan, familyPlan }) {\n    const eligible = Object.values(basePools).flat().filter(prompt => exactPlanAllows(prompt, exactPlan) && familyPlanAllows(prompt, familyPlan));\n    const nationalityAvailable = eligible.filter(isNationalityPrompt).length;\n    const statAvailable = eligible.filter(isStatMixPrompt).length;\n    const contextAvailable = eligible.filter(isContextMixPrompt).length;\n    const nonNameAvailable = eligible.filter(prompt => !isNameRulePrompt(prompt)).length;\n    return {\n      nationality: Math.min(DAILY_PROMPT_MIX_TARGET.nationality, nationalityAvailable),\n      stats: Math.min(DAILY_PROMPT_MIX_TARGET.stats, statAvailable),\n      context: Math.min(DAILY_PROMPT_MIX_TARGET.context, contextAvailable),\n      maxName: nonNameAvailable >= 9 ? DAILY_PROMPT_MIX_TARGET.maxName : 11,\n      eligible: eligible.length\n    };\n  }',
    '  function buildPromptMixQuotaPlan({ basePools, exactPlan, familyPlan }) {\n    const exactEligible = Object.values(basePools).flat().filter(prompt => exactPlanAllows(prompt, exactPlan));\n    const eligible = exactEligible.filter(prompt => familyPlanAllows(prompt, familyPlan));\n    const nationalityExactAvailable = exactEligible.filter(isNationalityPrompt).length;\n    const nationalityAvailable = eligible.filter(isNationalityPrompt).length;\n    const statAvailable = eligible.filter(isStatMixPrompt).length;\n    const contextAvailable = eligible.filter(isContextMixPrompt).length;\n    const nonNameAvailable = eligible.filter(prompt => !isNameRulePrompt(prompt)).length;\n    return {\n      // Nationality is deliberately hard. Never lower the daily target to zero just because\n      // another soft constraint temporarily hides nationality options.\n      nationality: DAILY_PROMPT_MIX_TARGET.nationality,\n      nationalityAvailable,\n      nationalityExactAvailable,\n      stats: Math.min(DAILY_PROMPT_MIX_TARGET.stats, statAvailable),\n      context: Math.min(DAILY_PROMPT_MIX_TARGET.context, contextAvailable),\n      maxName: nonNameAvailable >= 9 ? DAILY_PROMPT_MIX_TARGET.maxName : 11,\n      eligible: eligible.length\n    };\n  }'
  );

  replaceOnce(
    'nationality reservation setup',
    '  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, promptMixPlan, weeklyLeaderDays, dayIndex, date, token }) {\n    const availability = Object.fromEntries(',
    '  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, promptMixPlan, weeklyLeaderDays, dayIndex, date, token }) {\n    const exactNationality = Object.values(basePools).flat().filter(prompt =>\n      isNationalityPrompt(prompt)\n      && exactPlanAllows(prompt, exactPlan)\n      && Number(requiredFormation[prompt.position] || 0) > 0\n    );\n    if (!exactNationality.length) {\n      return { ok: false, reason: "Exact prompt rotation leaves no nationality prompt available for this day. The weekly nationality quota cannot be relaxed." };\n    }\n\n    const requiredNationality = exactNationality.filter(prompt =>\n      exactPlan[prompt.position]?.mustUseIds?.has(prompt.id)\n    );\n    if (requiredNationality.length > DAILY_PROMPT_MIX_TARGET.nationality) {\n      return { ok: false, reason: "Exact prompt rotation currently forces more than one nationality prompt into the same day. Regenerate from a later rotation point rather than relaxing the nationality quota." };\n    }\n    if (requiredNationality.length === 1 && !familyPlanAllows(requiredNationality[0], familyPlan)) {\n      const position = requiredNationality[0].position;\n      familyPlan.relaxedPositions.add(position);\n      familyPlan.allowedFamiliesByPosition[position] = null;\n    }\n\n    let nationalityOptions = requiredNationality.length\n      ? requiredNationality\n      : exactNationality.filter(prompt => familyPlanAllows(prompt, familyPlan));\n    if (!nationalityOptions.length) {\n      // Family cooldown is explicitly the soft rule in this generator. Relax it only because\n      // the hard one-nationality-per-day requirement otherwise has no candidate.\n      for (const position of new Set(exactNationality.map(prompt => prompt.position))) {\n        familyPlan.relaxedPositions.add(position);\n        familyPlan.allowedFamiliesByPosition[position] = null;\n      }\n      nationalityOptions = [...exactNationality];\n    }\n\n    nationalityOptions = nationalityOptions.filter(reserved => {\n      for (const [position, required] of Object.entries(requiredFormation)) {\n        const compatible = basePools[position].filter(prompt =>\n          exactPlanAllows(prompt, exactPlan)\n          && familyPlanAllows(prompt, familyPlan)\n          && (prompt.id === reserved.id || !isNationalityPrompt(prompt))\n        );\n        if (compatible.length < required) return false;\n      }\n      return true;\n    });\n    if (!nationalityOptions.length) {\n      return { ok: false, reason: "A nationality prompt is available, but reserving exactly one leaves too few non-nationality prompts for the selected formation." };\n    }\n\n    const availability = Object.fromEntries('
  );

  replaceOnce(
    'forced nationality slot',
    '      const used = new Set();\n      const draft = [];\n\n      for (const position of formationSlots) {\n        const options = basePools[position].filter(prompt =>\n          exactPlanAllows(prompt, exactPlan) && familyPlanAllows(prompt, familyPlan) && !used.has(prompt.id)\n        );\n        const choice = weightedPick(options, draft, settings, familyPlan, promptMixPlan, weeklyLeaderDays);\n        if (!choice) break;\n        draft.push(choice);\n        used.add(choice.id);\n      }\n      if (draft.length !== 11) continue;',
    '      const used = new Set();\n      const draft = [];\n      const nationalityChoice = nationalityOptions[attempt % nationalityOptions.length];\n      let nationalityPlaced = false;\n\n      for (const position of formationSlots) {\n        let choice = null;\n        if (!nationalityPlaced && position === nationalityChoice.position) {\n          choice = nationalityChoice;\n          nationalityPlaced = true;\n        } else {\n          const options = basePools[position].filter(prompt =>\n            exactPlanAllows(prompt, exactPlan)\n            && familyPlanAllows(prompt, familyPlan)\n            && !used.has(prompt.id)\n            && !isNationalityPrompt(prompt)\n          );\n          choice = weightedPick(options, draft, settings, familyPlan, promptMixPlan, weeklyLeaderDays);\n        }\n        if (!choice || used.has(choice.id)) break;\n        draft.push(choice);\n        used.add(choice.id);\n      }\n      if (draft.length !== 11 || !nationalityPlaced) continue;\n      if (promptMixCounts(draft).nationality !== DAILY_PROMPT_MIX_TARGET.nationality) continue;'
  );

  replaceOnce(
    'never relax nationality',
    '    candidates.sort((left, right) => left.balance - right.balance || left.naiveScore - right.naiveScore);\n    const quotaCandidates = candidates.filter(candidate => promptMixMeets(promptMixCounts(candidate.prompts), promptMixPlan));\n    const rankedCandidates = quotaCandidates.length ? quotaCandidates : candidates;\n    const quotaRelaxed = quotaCandidates.length === 0;',
    '    candidates.sort((left, right) => left.balance - right.balance || left.naiveScore - right.naiveScore);\n    const nationalityCandidates = candidates.filter(candidate =>\n      promptMixCounts(candidate.prompts).nationality === DAILY_PROMPT_MIX_TARGET.nationality\n    );\n    if (!nationalityCandidates.length) {\n      return { ok: false, reason: "The optimiser could not build an XI with exactly one nationality prompt. The nationality quota is hard and was not relaxed." };\n    }\n    const quotaCandidates = nationalityCandidates.filter(candidate => promptMixMeets(promptMixCounts(candidate.prompts), promptMixPlan));\n    const rankedCandidates = quotaCandidates.length ? quotaCandidates : nationalityCandidates;\n    // Only the secondary stats/context/name mix may relax. Nationality remains exactly one.\n    const quotaRelaxed = quotaCandidates.length === 0;'
  );

  replaceOnce(
    'hard final validation',
    '    const mix = promptMixCounts(prompts);\n    if (!quotaRelaxed && !promptMixMeets(mix, promptMixPlan)) issues.push("Prompt-family mix quota was not met.");',
    '    const mix = promptMixCounts(prompts);\n    if (mix.nationality !== DAILY_PROMPT_MIX_TARGET.nationality) issues.push("Exactly one nationality prompt is required in every generated day.");\n    if (!quotaRelaxed && !promptMixMeets(mix, promptMixPlan)) issues.push("Prompt-family mix quota was not met.");'
  );

  fs.writeFileSync(path, source);
  console.log(`Applied weekly hard nationality reservation policy (${replacements.join(', ')}).`);
} else {
  console.log('Weekly hard nationality reservation policy is already applied.');
}

execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-weekly-nationality-hard-reservation.mjs'], { stdio: 'inherit' });
