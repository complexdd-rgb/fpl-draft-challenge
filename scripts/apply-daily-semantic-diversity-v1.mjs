import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

function replaceOnce(path, before, after) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one anchor, found ${count}: ${before.slice(0, 120)}`);
  write(path, source.replace(before, after));
}

// Central manifest + cache ownership.
replaceOnce('config/asset-manifest.json', '"manifestVersion": "2.8.0-schedule-manager-v2"', '"manifestVersion": "2.9.0-daily-semantic-diversity"');
replaceOnce('config/asset-manifest.json', '"assetManifestRuntime": { "path": "js/asset-manifest.js", "version": "2.8.0-schedule-manager-v2" }', '"assetManifestRuntime": { "path": "js/asset-manifest.js", "version": "2.9.0-daily-semantic-diversity" }');
replaceOnce(
  'config/asset-manifest.json',
  '    "adminDailyLibraryCutoverV1": { "path": "js/admin-daily-library-cutover-v1.js", "version": "1.0.0" },',
  '    "adminDailyLibraryCutoverV1": { "path": "js/admin-daily-library-cutover-v1.js", "version": "1.0.0" },\n    "dailySemanticDiversityV1": { "path": "js/daily-semantic-diversity-v1.js", "version": "1.0.0" },'
);
replaceOnce('config/asset-manifest.json', '"adminBatchCalendar": { "path": "js/admin-batch-calendar.js", "version": "3.0.6" }', '"adminBatchCalendar": { "path": "js/admin-batch-calendar.js", "version": "3.1.0-semantic-diversity" }');
replaceOnce('config/asset-manifest.json', '"adminDailyGeneratorGuard": { "path": "js/admin-daily-generator-guard.js", "version": "2.0.0-saved-library-cycle" }', '"adminDailyGeneratorGuard": { "path": "js/admin-daily-generator-guard.js", "version": "2.1.0-semantic-diversity" }');

// Saved-library guard: load the semantic policy, diversify reservoir candidates and independently
// reject any generated day that still contains a semantic collision.
replaceOnce(
  'js/admin-daily-generator-guard.js',
  '/* FPL Challenge Studio — Daily Challenge scheduler + saved-library generation guard v2.0.0.\n   Builds one immutable 77-prompt reservoir from the structurally certified promoted library,\n   runtime-retests each selected prompt, preserves exact rotation, and matches the real 17-family\n   library proportions across the seven-day week. */',
  '/* FPL Challenge Studio — Daily Challenge scheduler + saved-library generation guard v2.1.0.\n   Builds one immutable 77-prompt reservoir from the structurally certified promoted library,\n   runtime-retests each selected prompt, preserves exact rotation, matches the real 17-family\n   proportions and caps close semantic variants so one concept cannot flood a seven-day week. */'
);
replaceOnce('js/admin-daily-generator-guard.js', '  const VERSION = "2.0.0";', '  const VERSION = "2.1.0";');
replaceOnce(
  'js/admin-daily-generator-guard.js',
  '  const NATIONALITY_WEEKLY_TARGET = DAYS_IN_BATCH;\n  const POSITION_ORDER = Object.freeze(["GK", "DEF", "MID", "FWD"]);',
  '  const NATIONALITY_WEEKLY_TARGET = DAYS_IN_BATCH;\n  const SEMANTIC_WAIT_MS = 10000;\n  const POSITION_ORDER = Object.freeze(["GK", "DEF", "MID", "FWD"]);'
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  '  function setStatus(message, state = "neutral") {\n    if (!status) return;\n    status.textContent = message;\n    status.dataset.state = state;\n  }',
  `  function setStatus(message, state = "neutral") {\n    if (!status) return;\n    status.textContent = message;\n    status.dataset.state = state;\n  }\n\n  async function ensureSemanticDiversity() {\n    if (window.FPL_DAILY_SEMANTIC_DIVERSITY?.version === "1.0.0") return window.FPL_DAILY_SEMANTIC_DIVERSITY;\n    const manifestUrl = window.FPL_ASSET_MANIFEST?.url?.("dailySemanticDiversityV1");\n    const src = manifestUrl || "js/daily-semantic-diversity-v1.js?v=1.0.0";\n    let script = [...document.scripts].find(item => /\\/js\\/daily-semantic-diversity-v1\\.js(?:\\?|$)/.test(item.src));\n    if (!script) {\n      script = document.createElement("script");\n      script.src = new URL(src, document.baseURI).toString();\n      script.async = false;\n      script.dataset.dailySemanticDiversityV1 = "1";\n      document.head.appendChild(script);\n    }\n    const deadline = Date.now() + SEMANTIC_WAIT_MS;\n    while (Date.now() < deadline) {\n      if (window.FPL_DAILY_SEMANTIC_DIVERSITY?.version === "1.0.0") return window.FPL_DAILY_SEMANTIC_DIVERSITY;\n      await new Promise(resolve => setTimeout(resolve, 50));\n    }\n    throw new Error("The Daily semantic-diversity policy did not load. Reload Studio before generating.");\n  }`
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  `  function recordOrder(records, usedIds) {\n    return [...records].sort((a, b) => {\n      const usedA = usedIds.has(String(a?.id || "")) ? 1 : 0;\n      const usedB = usedIds.has(String(b?.id || "")) ? 1 : 0;\n      if (usedA !== usedB) return usedA - usedB;\n      const passA = a?.qualityStatus === "pass" ? 1 : 0;\n      const passB = b?.qualityStatus === "pass" ? 1 : 0;\n      if (passA !== passB) return passB - passA;\n      const scoreA = Number(a?.qualityScore || 0);\n      const scoreB = Number(b?.qualityScore || 0);\n      return scoreB - scoreA || String(a?.id || "").localeCompare(String(b?.id || ""));\n    });\n  }`,
  `  function recordQualityCompare(a, b) {\n    const passA = a?.qualityStatus === "pass" ? 1 : 0;\n    const passB = b?.qualityStatus === "pass" ? 1 : 0;\n    if (passA !== passB) return passB - passA;\n    const scoreA = Number(a?.qualityScore || 0);\n    const scoreB = Number(b?.qualityScore || 0);\n    return scoreB - scoreA || String(a?.id || "").localeCompare(String(b?.id || ""));\n  }\n\n  function interleaveSemanticGroups(records) {\n    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;\n    if (!semantic?.recordGroupKey) return [...records].sort(recordQualityCompare);\n    const sorted = [...records].sort(recordQualityCompare);\n    const groups = new Map();\n    for (const record of sorted) {\n      const key = semantic.recordGroupKey(record, record?.position || "ANY");\n      if (!groups.has(key)) groups.set(key, []);\n      groups.get(key).push(record);\n    }\n    const queues = [...groups.values()];\n    const ordered = [];\n    while (queues.some(queue => queue.length)) {\n      for (const queue of queues) if (queue.length) ordered.push(queue.shift());\n    }\n    return ordered;\n  }\n\n  function recordOrder(records, usedIds) {\n    const unused = [];\n    const used = [];\n    for (const record of records || []) {\n      (usedIds.has(String(record?.id || "")) ? used : unused).push(record);\n    }\n    return [...interleaveSemanticGroups(unused), ...interleaveSemanticGroups(used)];\n  }`
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  '    prompt.tags = semanticTags(record, prompt);\n    core.invalidatePromptStats?.(prompt.id);',
  '    prompt.tags = semanticTags(record, prompt);\n    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;\n    if (semantic?.fromRecord) prompt.semanticDiversity = semantic.fromRecord(record, position, prompt.label);\n    core.invalidatePromptStats?.(prompt.id);'
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  `        for (const position of POSITION_ORDER) {\n          const need = Math.min(targets[family], positionNeeds[position]);\n          for (const record of assigned[position]) {\n            if (certifiedByPosition[position].length >= need) break;`,
  `        for (const position of POSITION_ORDER) {\n          const need = Math.min(targets[family], positionNeeds[position]);\n          const semanticExtra = Math.max(8, Math.ceil(need * 0.75));\n          const certifyLimit = Math.min(assigned[position].length, need + semanticExtra);\n          for (const record of assigned[position]) {\n            if (certifiedByPosition[position].length >= certifyLimit) break;`
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  `      const prompts = [];\n      const sourceIds = new Set();\n      let collision = false;\n      for (const family of families) {\n        for (const position of POSITION_ORDER) {\n          const required = allocation[family][position];\n          if (!required) continue;\n          const available = candidatePools.get(family)?.[position] || [];\n          let added = 0;\n          for (const candidate of available) {\n            const sourceId = String(candidate.record.id || "");\n            if (!sourceId || sourceIds.has(sourceId)) continue;\n            prompts.push(candidate.prompt);\n            sourceIds.add(sourceId);\n            added += 1;\n            if (added >= required) break;\n          }\n          if (added !== required) {\n            collision = true;\n            break;\n          }\n        }\n        if (collision) break;\n      }`,
  `      const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;\n      if (!semantic?.canAddWeekly) throw new Error("The Daily semantic-diversity policy is unavailable while selecting the weekly reservoir.");\n      const prompts = [];\n      const sourceIds = new Set();\n      const semanticCounts = new Map();\n      let collision = false;\n      for (const family of families) {\n        for (const position of POSITION_ORDER) {\n          const required = allocation[family][position];\n          if (!required) continue;\n          const available = candidatePools.get(family)?.[position] || [];\n          let added = 0;\n          while (added < required) {\n            const choices = available\n              .filter(candidate => {\n                const sourceId = String(candidate.record.id || "");\n                return sourceId && !sourceIds.has(sourceId) && semantic.canAddWeekly(candidate.prompt, semanticCounts, DAYS_IN_BATCH);\n              })\n              .sort((left, right) => semantic.weeklyLoad(left.prompt, semanticCounts) - semantic.weeklyLoad(right.prompt, semanticCounts));\n            const candidate = choices[0];\n            if (!candidate) break;\n            const sourceId = String(candidate.record.id || "");\n            prompts.push(candidate.prompt);\n            sourceIds.add(sourceId);\n            semantic.commitWeekly(candidate.prompt, semanticCounts);\n            added += 1;\n          }\n          if (added !== required) {\n            collision = true;\n            break;\n          }\n        }\n        if (collision) break;\n      }`
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  '        antiMetaCount,\n        nationalityCount\n      });',
  '        antiMetaCount,\n        nationalityCount,\n        semanticDiversityVersion: String(window.FPL_DAILY_SEMANTIC_DIVERSITY?.version || ""),\n        semanticWeeklyCap: DAYS_IN_BATCH\n      });'
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  `    const weekIds = [];\n    for (const result of results) {`,
  `    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;\n    const snapshotPromptById = new Map((snapshot.prompts || []).map(prompt => [String(prompt.id), prompt]));\n    const weekIds = [];\n    for (const result of results) {`
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  `      const uncertified = result.promptIds.filter(id => !snapshot.ids.has(String(id)));\n      if (uncertified.length) return { ok: false, reason: \`${'${day}'} contains prompt(s) outside the immutable saved-library reservoir: \${uncertified.slice(0, 3).join(", ")}.\` };\n      weekIds.push(...result.promptIds.map(String));`,
  `      const uncertified = result.promptIds.filter(id => !snapshot.ids.has(String(id)));\n      if (uncertified.length) return { ok: false, reason: \`${'${day}'} contains prompt(s) outside the immutable saved-library reservoir: \${uncertified.slice(0, 3).join(", ")}.\` };\n      const dayPrompts = result.promptIds.map(id => snapshotPromptById.get(String(id))).filter(Boolean);\n      const semanticIssues = semantic?.dayIssues?.(dayPrompts) || [];\n      if (semanticIssues.length) return { ok: false, reason: \`${'${day}'} contains overly similar prompts: \${semanticIssues[0].description}.\` };\n      weekIds.push(...result.promptIds.map(String));`
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  `    try {\n      if (!await waitForCutover()) {`,
  `    try {\n      await ensureSemanticDiversity();\n      if (!await waitForCutover()) {`
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  '      setStatus(`Seven-day generation passed the saved-library guard: all 77 runtime-certified prompts were consumed exactly once and the 17-family weekly targets were preserved.`, "pass");',
  '      setStatus(`Seven-day generation passed the saved-library guard: all 77 runtime-certified prompts were consumed exactly once, the 17-family targets were preserved and no same-day semantic clashes were allowed.`, "pass");'
);
replaceOnce(
  'js/admin-daily-generator-guard.js',
  '    throw new Error("The saved 17-family library could not fill the selected formation with 77 runtime-certified prompts while preserving the proportional family targets.");',
  '    throw new Error("The saved 17-family library could not fill the selected formation with 77 runtime-certified prompts while preserving family targets and the one-per-day semantic cap. Expand variant diversity in the affected families.");'
);

// Seven-day selector: hard-filter same-day semantic clashes and spread any key that must now
// appear once on every remaining day before exact rotation reaches the end of the week.
replaceOnce(
  'js/admin-batch-calendar.js',
  '  const ROTATION_POLICY_VERSION = 1;\n  const FORBIDDEN_COST = 1_000_000;',
  '  const ROTATION_POLICY_VERSION = 1;\n  const SEMANTIC_DIVERSITY_POLICY_VERSION = 1;\n  const FORBIDDEN_COST = 1_000_000;'
);
replaceOnce(
  'js/admin-batch-calendar.js',
  `    const candidates = [];\n    const signatures = new Set();`,
  `    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;\n    if (!semantic?.remainingPressure) return { ok: false, reason: "The same-day semantic diversity guard is unavailable. Reload Studio before generating." };\n    const remainingDays = DAYS_IN_BATCH - dayIndex;\n    const exactRemaining = Object.values(basePools).flat().filter(prompt => exactPlanAllows(prompt, exactPlan));\n    const semanticPressure = semantic.remainingPressure(exactRemaining, remainingDays);\n    if (semanticPressure.impossible.size) {\n      const key = [...semanticPressure.impossible][0];\n      return { ok: false, reason: \`Semantic rotation backlog is impossible to spread: \${semantic.describeKey(key)} has more remaining prompts than remaining days. Rebuild the weekly reservoir with more variety.\` };\n    }\n    for (const key of semanticPressure.required) {\n      const exactMatches = exactRemaining.filter(prompt => semantic.hasKey(prompt, key));\n      if (exactMatches.length && !exactMatches.some(prompt => familyPlanAllows(prompt, familyPlan))) {\n        for (const position of new Set(exactMatches.map(prompt => prompt.position))) {\n          familyPlan.relaxedPositions.add(position);\n          familyPlan.allowedFamiliesByPosition[position] = null;\n        }\n      }\n    }\n\n    const candidates = [];\n    const signatures = new Set();`
);
replaceOnce(
  'js/admin-batch-calendar.js',
  `          choice = weightedPick(options, draft, settings, familyPlan, promptMixPlan, weeklyLeaderDays);\n        }\n        if (!choice || used.has(choice.id)) break;\n        draft.push(choice);`,
  `          choice = weightedPick(options, draft, settings, familyPlan, promptMixPlan, weeklyLeaderDays, semanticPressure);\n        }\n        if (!choice || used.has(choice.id) || draft.some(existing => semantic.dayClash(choice, existing))) break;\n        draft.push(choice);`
);
replaceOnce(
  'js/admin-batch-calendar.js',
  `      if (draft.length !== 11 || !nationalityPlaced) continue;\n      if (promptMixCounts(draft).nationality !== DAILY_PROMPT_MIX_TARGET.nationality) continue;\n      if (!satisfiesExactRotationRequirements(draft, exactPlan)) continue;\n      if (draft.filter(isAntiMeta).length < settings.minAntiMeta) continue;`,
  `      if (draft.length !== 11 || !nationalityPlaced) continue;\n      if (promptMixCounts(draft).nationality !== DAILY_PROMPT_MIX_TARGET.nationality) continue;\n      if (!satisfiesExactRotationRequirements(draft, exactPlan)) continue;\n      if (draft.filter(isAntiMeta).length < settings.minAntiMeta) continue;\n      if (semantic.dayIssues(draft).length) continue;\n      if (semantic.missingRequiredKeys(draft, semanticPressure.required).length) continue;`
);
replaceOnce(
  'js/admin-batch-calendar.js',
  '    if (!candidates.length) return { ok: false, reason: "No complete XI could be generated with the current restrictions." };',
  '    if (!candidates.length) return { ok: false, reason: "No complete XI could satisfy exact rotation, formation and the hard same-day semantic-diversity guard. The generator will not cluster near-duplicate prompts on one day." };'
);
replaceOnce(
  'js/admin-batch-calendar.js',
  '  function weightedPick(options, currentDraft, settings, familyPlan, promptMixPlan, weeklyLeaderDays) {\n    if (!options.length) return null;',
  '  function weightedPick(options, currentDraft, settings, familyPlan, promptMixPlan, weeklyLeaderDays, semanticPressure) {\n    if (!options.length) return null;\n    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;\n    if (semantic?.filterDayCompatible) {\n      options = semantic.filterDayCompatible(options, currentDraft);\n      if (!options.length) return null;\n    }'
);
replaceOnce(
  'js/admin-batch-calendar.js',
  `      const answerOverlap = answerOverlapWithDraft(prompt, currentDraft, alreadyUsedTopAnswerIds);\n      weight /= 1 + answerOverlap * 0.65;`,
  `      const answerOverlap = answerOverlapWithDraft(prompt, currentDraft, alreadyUsedTopAnswerIds);\n      weight /= 1 + answerOverlap * 0.65;\n      if (semantic?.hasKey && semanticPressure?.required?.size) {\n        let requiredMatches = 0;\n        for (const key of semanticPressure.required) if (semantic.hasKey(prompt, key)) requiredMatches += 1;\n        if (requiredMatches) weight *= 1 + requiredMatches * 18;\n      }`
);
replaceOnce(
  'js/admin-batch-calendar.js',
  `    if (uniqueIds.size !== prompts.length) issues.push("A prompt is repeated inside the XI.");\n\n    const formation = { GK: 0, DEF: 0, MID: 0, FWD: 0 };`,
  `    if (uniqueIds.size !== prompts.length) issues.push("A prompt is repeated inside the XI.");\n    const semanticIssues = window.FPL_DAILY_SEMANTIC_DIVERSITY?.dayIssues?.(prompts) || [];\n    if (semanticIssues.length) issues.push(semanticIssues[0].message);\n\n    const formation = { GK: 0, DEF: 0, MID: 0, FWD: 0 };`
);
replaceOnce(
  'js/admin-batch-calendar.js',
  '    promptFamily\n  });',
  '    promptFamily,\n    semanticDiversityPolicyVersion: SEMANTIC_DIVERSITY_POLICY_VERSION\n  });'
);

// Clean architecture verifier follows the new manifest/cache boundary.
replaceOnce('scripts/verify-prompt-studio-clean-reset.mjs', "const scheduleManager = read('js/admin-schedule-manager-v2.js');", "const scheduleManager = read('js/admin-schedule-manager-v2.js');\nconst semanticDiversity = read('js/daily-semantic-diversity-v1.js');\nconst batchCalendar = read('js/admin-batch-calendar.js');");
replaceOnce('scripts/verify-prompt-studio-clean-reset.mjs', "manifest.manifestVersion === '2.8.0-schedule-manager-v2'", "manifest.manifestVersion === '2.9.0-daily-semantic-diversity'");
replaceOnce('scripts/verify-prompt-studio-clean-reset.mjs', "manifest.assets?.assetManifestRuntime?.version === '2.8.0-schedule-manager-v2'", "manifest.assets?.assetManifestRuntime?.version === '2.9.0-daily-semantic-diversity'");
replaceOnce('scripts/verify-prompt-studio-clean-reset.mjs', "manifest.assets?.adminDailyGeneratorGuard?.version === '2.0.0-saved-library-cycle'", "manifest.assets?.adminDailyGeneratorGuard?.version === '2.1.0-semantic-diversity'");
replaceOnce(
  'scripts/verify-prompt-studio-clean-reset.mjs',
  "assert(manifest.assets?.adminScheduleManagerV2?.path === 'js/admin-schedule-manager-v2.js', 'Schedule manager v2 is missing from the central manifest.');",
  "assert(manifest.assets?.dailySemanticDiversityV1?.path === 'js/daily-semantic-diversity-v1.js', 'Daily semantic-diversity policy is missing from the central manifest.');\nassert(manifest.assets?.adminBatchCalendar?.version === '3.1.0-semantic-diversity', 'Batch calendar semantic-diversity cache version is stale.');\nassert(manifest.assets?.adminScheduleManagerV2?.path === 'js/admin-schedule-manager-v2.js', 'Schedule manager v2 is missing from the central manifest.');"
);
replaceOnce('scripts/verify-prompt-studio-clean-reset.mjs', "generatedManifest.includes('2.8.0-schedule-manager-v2')", "generatedManifest.includes('2.9.0-daily-semantic-diversity')");
replaceOnce(
  'scripts/verify-prompt-studio-clean-reset.mjs',
  "assert(generatedManifest.includes('\"adminScheduleManagerV2\"'), 'Generated asset manifest does not expose schedule manager v2.');",
  "assert(generatedManifest.includes('\"dailySemanticDiversityV1\"'), 'Generated asset manifest does not expose the Daily semantic-diversity policy.');\nassert(generatedManifest.includes('\"adminScheduleManagerV2\"'), 'Generated asset manifest does not expose schedule manager v2.');"
);
replaceOnce(
  'scripts/verify-prompt-studio-clean-reset.mjs',
  "  'saved-library generation guard v2.0.0',",
  "  'saved-library generation guard v2.1.0',\n  'ensureSemanticDiversity()',\n  'semanticWeeklyCap: DAYS_IN_BATCH',"
);
replaceOnce(
  'scripts/verify-prompt-studio-clean-reset.mjs',
  "assert(!dailyGuard.includes('state.total !== 851'), 'Daily generation guard still depends on the retired 851-prompt pool.');",
  "assert(!dailyGuard.includes('state.total !== 851'), 'Daily generation guard still depends on the retired 851-prompt pool.');\nassert(semanticDiversity.includes('entity:manager:'), 'Semantic policy is missing manager-entity isolation.');\nassert(semanticDiversity.includes('rare:bonus'), 'Semantic policy is missing bonus-point isolation.');\nassert(batchCalendar.includes('semantic.missingRequiredKeys'), 'Batch calendar is missing semantic look-ahead pressure.');\nassert(batchCalendar.includes('semantic.dayClash'), 'Batch calendar is missing the hard same-day semantic guard.');"
);

// Existing weekly snapshot verifier must understand the new v2.1 guard boundary.
replaceOnce('scripts/verify-weekly-certified-snapshot-race.mjs', "'saved-library generation guard v2.0.0'", "'saved-library generation guard v2.1.0'");
replaceOnce(
  'scripts/verify-weekly-certified-snapshot-race.mjs',
  "  'fpl:daily-saved-library-week-certified'",
  "  'fpl:daily-saved-library-week-certified',\n  'semanticWeeklyCap: DAYS_IN_BATCH',\n  'semantic.canAddWeekly',\n  'semantic?.dayIssues'"
);
replaceOnce(
  'scripts/verify-weekly-certified-snapshot-race.mjs',
  "  'const promptSource = generationSnapshot || (Array.isArray(apiLibrary) ? apiLibrary : globalLibrary);'",
  "  'const promptSource = generationSnapshot || (Array.isArray(apiLibrary) ? apiLibrary : globalLibrary);',\n  'semantic.dayClash(choice, existing)',\n  'semantic.missingRequiredKeys(draft, semanticPressure.required)',\n  'same-day semantic-diversity guard'"
);

// Studio Architecture owns the new files and runs both semantic and weekly reservoir tests.
for (const sectionAnchor of [
  "      - 'js/admin-daily-library-cutover-v1.js'\n      - 'js/admin-schedule-manager-v2.js'",
  "      - 'js/admin-daily-library-cutover-v1.js'\n      - 'js/admin-schedule-manager-v2.js'"
]) {
  const workflow = read('.github/workflows/studio-wiring.yml');
  if (!workflow.includes(sectionAnchor)) break;
  write('.github/workflows/studio-wiring.yml', workflow.replace(sectionAnchor,
    "      - 'js/admin-daily-library-cutover-v1.js'\n      - 'js/daily-semantic-diversity-v1.js'\n      - 'js/admin-daily-generator-guard.js'\n      - 'js/admin-batch-calendar.js'\n      - 'js/admin-schedule-manager-v2.js'"));
}
replaceOnce(
  '.github/workflows/studio-wiring.yml',
  "      - 'scripts/verify-daily-library-cutover-v1.mjs'\n      - 'scripts/materialise-prompt-library-shards.mjs'",
  "      - 'scripts/verify-daily-library-cutover-v1.mjs'\n      - 'scripts/verify-daily-semantic-diversity-v1.mjs'\n      - 'scripts/verify-weekly-certified-snapshot-race.mjs'\n      - 'scripts/materialise-prompt-library-shards.mjs'"
);
// Same verifier paths in push section.
{
  const workflow = read('.github/workflows/studio-wiring.yml');
  const needle = "      - 'scripts/verify-daily-library-cutover-v1.mjs'\n      - 'scripts/materialise-prompt-library-shards.mjs'";
  if (workflow.includes(needle)) write('.github/workflows/studio-wiring.yml', workflow.replace(needle,
    "      - 'scripts/verify-daily-library-cutover-v1.mjs'\n      - 'scripts/verify-daily-semantic-diversity-v1.mjs'\n      - 'scripts/verify-weekly-certified-snapshot-race.mjs'\n      - 'scripts/materialise-prompt-library-shards.mjs'"));
}
replaceOnce(
  '.github/workflows/studio-wiring.yml',
  '      - name: Verify unaffected native workspaces\n        run: |',
  '      - name: Verify Daily semantic diversity guard\n        run: node scripts/verify-daily-semantic-diversity-v1.mjs\n\n      - name: Verify immutable weekly reservoir and semantic spread\n        run: node scripts/verify-weekly-certified-snapshot-race.mjs\n\n      - name: Verify unaffected native workspaces\n        run: |'
);
replaceOnce(
  '.github/workflows/studio-wiring.yml',
  '          node --check js/admin-daily-library-cutover-v1.js\n          node --check js/admin-schedule-manager-v2.js',
  '          node --check js/admin-daily-library-cutover-v1.js\n          node --check js/daily-semantic-diversity-v1.js\n          node --check js/admin-daily-generator-guard.js\n          node --check js/admin-batch-calendar.js\n          node --check js/admin-schedule-manager-v2.js'
);
replaceOnce(
  '.github/workflows/studio-wiring.yml',
  '          node --check scripts/verify-daily-library-cutover-v1.mjs\n          node --check scripts/materialise-prompt-library-shards.mjs',
  '          node --check scripts/verify-daily-library-cutover-v1.mjs\n          node --check scripts/verify-daily-semantic-diversity-v1.mjs\n          node --check scripts/verify-weekly-certified-snapshot-race.mjs\n          node --check scripts/materialise-prompt-library-shards.mjs'
);

console.log('Daily semantic diversity v1 runtime, cache, verifier and Studio Architecture wiring applied.');
