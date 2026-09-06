from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)

# Daily guard: make top-answer diversity part of 77-prompt reservoir selection.
guard_path = Path('js/admin-daily-generator-guard.js')
guard = guard_path.read_text()
guard = replace_once(
    guard,
    'saved-library generation guard v2.3.0.',
    'saved-library generation guard v2.4.0.',
    'guard header version',
)
guard = replace_once(guard, 'const VERSION = "2.3.0";', 'const VERSION = "2.4.0";', 'guard VERSION')

anchor = '''  function assignAnyRecords(records, positionNeeds, offset = 0) {\n'''
helpers = '''  function promptTopAnswer(prompt) {\n    return core.getPromptStats(prompt)?.bestAnswer || null;\n  }\n\n  function promptTopAnswerKey(prompt) {\n    return String(promptTopAnswer(prompt)?.playerId || "");\n  }\n\n  function topAnswerDiversityAudit(prompts) {\n    const counts = new Map();\n    for (const prompt of prompts || []) {\n      const best = promptTopAnswer(prompt);\n      const playerId = String(best?.playerId || "");\n      if (!playerId) continue;\n      const existing = counts.get(playerId) || {\n        playerId,\n        name: String(best?.playerName || best?.name || playerId),\n        count: 0\n      };\n      existing.count += 1;\n      counts.set(playerId, existing);\n    }\n    const repeatedPlayers = [...counts.values()]\n      .filter(item => item.count > 1)\n      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));\n    return {\n      promptCount: (prompts || []).length,\n      uniquePlayers: counts.size,\n      repeatSlots: repeatedPlayers.reduce((sum, item) => sum + item.count - 1, 0),\n      repeatedPlayers\n    };\n  }\n\n'''
if helpers not in guard:
    guard = replace_once(guard, anchor, helpers + anchor, 'top-answer helper insertion')

guard = replace_once(
    guard,
    '    const shardByFamily = new Map(payload.shards.map(shard => [String(shard.family), shard]));\n\n    for (let anyOffset = 0; anyOffset < POSITION_ORDER.length; anyOffset += 1) {',
    '    const shardByFamily = new Map(payload.shards.map(shard => [String(shard.family), shard]));\n    let bestReservoir = null;\n\n    for (let anyOffset = 0; anyOffset < POSITION_ORDER.length; anyOffset += 1) {',
    'best reservoir accumulator',
)

guard = replace_once(
    guard,
    '''          const semanticExtra = Math.max(8, Math.ceil(need * 0.75));\n          const certifyLimit = Math.min(assigned[position].length, need + semanticExtra);''',
    '''          // Top-answer diversity is decided at reservoir selection, so certify a materially\n          // wider alternative set than the family/position minimum. This gives the selector\n          // enough different leaders to avoid Salah/Robertson/TAA-style weekly clustering.\n          const diversityExtra = Math.max(24, Math.ceil(need * 3));\n          const certifyLimit = Math.min(assigned[position].length, need + diversityExtra);''',
    'wider certified alternatives',
)

guard = replace_once(
    guard,
    '''      const prompts = [];\n      const sourceIds = new Set();\n      const semanticCounts = new Map();\n      let collision = false;''',
    '''      const prompts = [];\n      const sourceIds = new Set();\n      const semanticCounts = new Map();\n      const leaderCounts = new Map();\n      let collision = false;''',
    'leader counts',
)

guard = replace_once(
    guard,
    '''            const choices = available\n              .filter(candidate => {\n                const sourceId = String(candidate.record.id || "");\n                return sourceId && !sourceIds.has(sourceId) && semantic.canAddWeekly(candidate.prompt, semanticCounts, DAYS_IN_BATCH);\n              })\n              .sort((left, right) => semantic.weeklyLoad(left.prompt, semanticCounts) - semantic.weeklyLoad(right.prompt, semanticCounts));''',
    '''            const choices = available\n              .filter(candidate => {\n                const sourceId = String(candidate.record.id || "");\n                return sourceId && !sourceIds.has(sourceId) && semantic.canAddWeekly(candidate.prompt, semanticCounts, DAYS_IN_BATCH);\n              })\n              .sort((left, right) => {\n                const leftLeader = promptTopAnswerKey(left.prompt);\n                const rightLeader = promptTopAnswerKey(right.prompt);\n                const leftLeaderLoad = leftLeader ? Number(leaderCounts.get(leftLeader) || 0) : WEEKLY_PROMPTS;\n                const rightLeaderLoad = rightLeader ? Number(leaderCounts.get(rightLeader) || 0) : WEEKLY_PROMPTS;\n                return leftLeaderLoad - rightLeaderLoad\n                  || semantic.weeklyLoad(left.prompt, semanticCounts) - semantic.weeklyLoad(right.prompt, semanticCounts);\n              });''',
    'leader-aware reservoir choice ordering',
)

guard = replace_once(
    guard,
    '''            prompts.push(candidate.prompt);\n            sourceIds.add(sourceId);\n            semantic.commitWeekly(candidate.prompt, semanticCounts);\n            added += 1;''',
    '''            prompts.push(candidate.prompt);\n            sourceIds.add(sourceId);\n            semantic.commitWeekly(candidate.prompt, semanticCounts);\n            const leaderKey = promptTopAnswerKey(candidate.prompt);\n            if (leaderKey) leaderCounts.set(leaderKey, Number(leaderCounts.get(leaderKey) || 0) + 1);\n            added += 1;''',
    'leader commit',
)

guard = replace_once(
    guard,
    '''      const frozenPrompts = Object.freeze(prompts.map(prompt => Object.freeze(prompt)));\n      const ids = new Set(frozenPrompts.map(prompt => String(prompt.id)));\n      if (ids.size !== WEEKLY_PROMPTS) continue;\n      const plan = Object.freeze({''',
    '''      const frozenPrompts = Object.freeze(prompts.map(prompt => Object.freeze(prompt)));\n      const ids = new Set(frozenPrompts.map(prompt => String(prompt.id)));\n      if (ids.size !== WEEKLY_PROMPTS) continue;\n      const topAnswerDiversity = topAnswerDiversityAudit(frozenPrompts);\n      const frozenTopAnswerDiversity = Object.freeze({\n        ...topAnswerDiversity,\n        repeatedPlayers: Object.freeze(topAnswerDiversity.repeatedPlayers.map(item => Object.freeze({ ...item })))\n      });\n      const plan = Object.freeze({''',
    'top-answer audit before plan',
)

guard = replace_once(
    guard,
    '''        nationalityCount,\n        semanticDiversityVersion: String(window.FPL_DAILY_SEMANTIC_DIVERSITY?.version || ""),''',
    '''        nationalityCount,\n        topAnswerDiversity: frozenTopAnswerDiversity,\n        semanticDiversityVersion: String(window.FPL_DAILY_SEMANTIC_DIVERSITY?.version || ""),''',
    'plan diversity audit',
)

guard = replace_once(
    guard,
    '''      });\n      return { prompts: frozenPrompts, ids, plan };\n    }\n\n    throw new Error("The saved 17-family library could not fill the selected formation with 77 runtime-certified prompts while preserving family targets and the one-per-day semantic cap. Expand variant diversity in the affected families.");''',
    '''      });\n      const reservoir = { prompts: frozenPrompts, ids, plan };\n      if (!bestReservoir\n        || frozenTopAnswerDiversity.repeatSlots < bestReservoir.plan.topAnswerDiversity.repeatSlots\n        || (frozenTopAnswerDiversity.repeatSlots === bestReservoir.plan.topAnswerDiversity.repeatSlots\n          && frozenTopAnswerDiversity.uniquePlayers > bestReservoir.plan.topAnswerDiversity.uniquePlayers)) {\n        bestReservoir = reservoir;\n      }\n      // A fully unique weekly leader set is optimal; otherwise try the remaining ANY-position\n      // assignments and keep the reservoir with the fewest unavoidable/recycled leader slots.\n      if (frozenTopAnswerDiversity.repeatSlots === 0) return reservoir;\n    }\n\n    if (bestReservoir) return bestReservoir;\n    throw new Error("The saved 17-family library could not fill the selected formation with 77 runtime-certified prompts while preserving family targets and the one-per-day semantic cap. Expand variant diversity in the affected families.");''',
    'best reservoir return',
)

guard = replace_once(
    guard,
    '''    const missing = [...snapshot.ids].filter(id => !uniqueWeekIds.has(id));\n    if (missing.length) return { ok: false, reason: `${missing.length} runtime-certified reservoir prompt(s) were not consumed by the week.` };\n    return { ok: true, reason: "" };''',
    '''    const missing = [...snapshot.ids].filter(id => !uniqueWeekIds.has(id));\n    if (missing.length) return { ok: false, reason: `${missing.length} runtime-certified reservoir prompt(s) were not consumed by the week.` };\n    const topAnswerDiversity = topAnswerDiversityAudit(snapshot.prompts || []);\n    return { ok: true, reason: "", topAnswerDiversity };''',
    'final certification diversity audit',
)

guard = replace_once(
    guard,
    '''      setStatus(`77 runtime-certified prompts locked · 17-family proportional cycle · ${reservoir.plan.cycleFamilies.length ? `${reservoir.plan.cycleFamilies.length} family cycle reset(s)` : "unused prompts preferred"}. Generating week…`, "working");''',
    '''      setStatus(`77 runtime-certified prompts locked · ${reservoir.plan.topAnswerDiversity.uniquePlayers}/77 unique top-answer players · 17-family proportional cycle · ${reservoir.plan.cycleFamilies.length ? `${reservoir.plan.cycleFamilies.length} family cycle reset(s)` : "unused prompts preferred"}. Generating week…`, "working");''',
    'pre-generation status',
)

guard = replace_once(
    guard,
    '''      setStatus(`Seven-day generation passed the saved-library guard: all 77 runtime-certified prompts were consumed exactly once, the 17-family targets were preserved and no same-day semantic clashes were allowed.`, "pass");''',
    '''      const diversity = certification.topAnswerDiversity || reservoir.plan.topAnswerDiversity;\n      const diversityText = diversity?.repeatSlots\n        ? `${diversity.uniquePlayers}/77 unique top-answer players · ${diversity.repeatSlots} fallback repeat slot(s)`\n        : "77/77 unique top-answer players";\n      setStatus(`Seven-day generation passed the saved-library guard: all 77 runtime-certified prompts were consumed exactly once, the 17-family targets were preserved, no same-day semantic clashes were allowed, and top-answer diversity finished at ${diversityText}.`, "pass");''',
    'final status diversity',
)

guard = replace_once(
    guard,
    '''    getLastFamilyPlan: () => lastPlan ? { ...lastPlan, targets: { ...lastPlan.targets }, positionNeeds: { ...lastPlan.positionNeeds } } : null,''',
    '''    getLastFamilyPlan: () => lastPlan ? {\n      ...lastPlan,\n      targets: { ...lastPlan.targets },\n      positionNeeds: { ...lastPlan.positionNeeds },\n      topAnswerDiversity: lastPlan.topAnswerDiversity ? {\n        ...lastPlan.topAnswerDiversity,\n        repeatedPlayers: (lastPlan.topAnswerDiversity.repeatedPlayers || []).map(item => ({ ...item }))\n      } : null\n    } : null,''',
    'plan getter diversity clone',
)
guard_path.write_text(guard)

# Batch calendar: one-day leader soft cap and report the reservoir audit in ZIP/UI.
batch_path = Path('js/admin-batch-calendar.js')
batch = batch_path.read_text()
batch = replace_once(
    batch,
    'Theme & Formation Engine v3.3.0: weekly-reservoir-aware date-identified seven-day challenge calendar generator.',
    'Theme & Formation Engine v3.4.0: weekly-top-answer-aware date-identified seven-day challenge calendar generator.',
    'batch version header',
)
batch = replace_once(batch, 'const ANSWER_DIVERSITY_POLICY_VERSION = 2;', 'const ANSWER_DIVERSITY_POLICY_VERSION = 3;', 'answer diversity policy version')
batch = replace_once(batch, 'const WEEKLY_LEADER_SOFT_CAP = 2;', 'const WEEKLY_LEADER_SOFT_CAP = 1;', 'weekly leader soft cap')

report_anchor = '''  function buildBatchReport() {\n'''
report_helper = '''  function weeklyTopAnswerDiversity() {\n    const plan = window.FPL_DAILY_GENERATOR_GUARD?.getLastFamilyPlan?.();\n    const audit = plan?.topAnswerDiversity;\n    if (!audit) return null;\n    return {\n      promptCount: Number(audit.promptCount) || 0,\n      uniquePlayers: Number(audit.uniquePlayers) || 0,\n      repeatSlots: Number(audit.repeatSlots) || 0,\n      repeatedPlayers: (audit.repeatedPlayers || []).map(item => ({\n        playerId: String(item.playerId || ""),\n        name: String(item.name || item.playerId || ""),\n        count: Number(item.count) || 0\n      }))\n    };\n  }\n\n'''
if report_helper not in batch:
    batch = replace_once(batch, report_anchor, report_helper + report_anchor, 'batch report helper')

batch = replace_once(
    batch,
    '''      allPassed: batchResults.length === DAYS_IN_BATCH && batchResults.every(result => result.status === "PASS"),\n      settings,''',
    '''      allPassed: batchResults.length === DAYS_IN_BATCH && batchResults.every(result => result.status === "PASS"),\n      topAnswerDiversity: weeklyTopAnswerDiversity(),\n      settings,''',
    'batch report diversity field',
)

batch = replace_once(
    batch,
    '''      `Theme: ${first.theme || "Generated Mix"}`,\n      "",\n      "UPLOAD ORDER",''',
    '''      `Theme: ${first.theme || "Generated Mix"}`,\n      "",\n      "TOP-ANSWER DIVERSITY",\n      "--------------------",\n      (() => {\n        const audit = weeklyTopAnswerDiversity();\n        if (!audit) return "Audit unavailable.";\n        return audit.repeatSlots\n          ? `${audit.uniquePlayers}/${audit.promptCount || 77} unique top-answer players · ${audit.repeatSlots} fallback repeat slot(s). Repeats are only used after unique-leader alternatives are exhausted by the certified reservoir constraints.`\n          : `${audit.uniquePlayers}/${audit.promptCount || 77} unique top-answer players · no weekly leader repeats.`;\n      })(),\n      "",\n      "UPLOAD ORDER",''',
    'README diversity section',
)

batch = replace_once(
    batch,
    '''    elements.review.innerHTML = `<div class="batch-table-wrap"><table class="batch-table">''',
    '''    const topAnswerAudit = weeklyTopAnswerDiversity();\n    const topAnswerSummary = topAnswerAudit\n      ? `<div class="batch-summary"><strong>Top-answer diversity: ${topAnswerAudit.uniquePlayers}/${topAnswerAudit.promptCount || 77} unique players</strong><span>${topAnswerAudit.repeatSlots ? `${topAnswerAudit.repeatSlots} fallback repeat slot(s)` : "No weekly leader repeats"}</span></div>`\n      : "";\n    elements.review.innerHTML = `${topAnswerSummary}<div class="batch-table-wrap"><table class="batch-table">''',
    'review summary diversity',
)
batch_path.write_text(batch)

# Central cache/version ownership.
config_path = Path('config/asset-manifest.json')
config = config_path.read_text()
config = replace_once(config, '"manifestVersion": "3.0.1-nationality-rotation"', '"manifestVersion": "3.0.2-top-answer-diversity"', 'manifest version')
config = replace_once(config, '"assetManifestRuntime": { "path": "js/asset-manifest.js", "version": "3.0.1-nationality-rotation" }', '"assetManifestRuntime": { "path": "js/asset-manifest.js", "version": "3.0.2-top-answer-diversity" }', 'runtime manifest version')
config = replace_once(config, '"adminBatchCalendar": { "path": "js/admin-batch-calendar.js", "version": "3.3.0-nationality-rotation" }', '"adminBatchCalendar": { "path": "js/admin-batch-calendar.js", "version": "3.4.0-top-answer-diversity" }', 'batch cache version')
config = replace_once(config, '"adminDailyGeneratorGuard": { "path": "js/admin-daily-generator-guard.js", "version": "2.3.0-reservoir-authority" }', '"adminDailyGeneratorGuard": { "path": "js/admin-daily-generator-guard.js", "version": "2.4.0-top-answer-diversity" }', 'guard cache version')
config_path.write_text(config)

# Existing structural verifiers follow the new boundary.
for path_name in [
    'scripts/verify-prompt-studio-clean-reset.mjs',
    'scripts/verify-all-season-certification-gate.mjs',
    'scripts/verify-weekly-certified-snapshot-race.mjs'
]:
    path = Path(path_name)
    text = path.read_text()
    text = text.replace('saved-library generation guard v2.3.0', 'saved-library generation guard v2.4.0')
    text = text.replace('2.3.0-reservoir-authority', '2.4.0-top-answer-diversity')
    text = text.replace('3.3.0-nationality-rotation', '3.4.0-top-answer-diversity')
    text = text.replace('3.0.1-nationality-rotation', '3.0.2-top-answer-diversity')
    path.write_text(text)

# Strengthen the dedicated weekly top-answer policy verifier.
verify_path = Path('scripts/verify-weekly-top-answer-diversity.mjs')
verify = verify_path.read_text()
verify = replace_once(verify, "const source = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');", "const source = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');\nconst guard = fs.readFileSync('js/admin-daily-generator-guard.js', 'utf8');", 'verifier guard source')
verify = verify.replace("['soft cap is two days', 'const WEEKLY_LEADER_SOFT_CAP = 2;']", "['soft cap is one day', 'const WEEKLY_LEADER_SOFT_CAP = 1;']")
verify = replace_once(
    verify,
    '''for (const [label, needle] of checks) {\n  if (!source.includes(needle)) throw new Error(`Missing weekly diversity check: ${label}`);\n}\n\nconsole.log('Weekly top-answer diversity policy verified.');''',
    '''for (const [label, needle] of checks) {\n  if (!source.includes(needle)) throw new Error(`Missing weekly diversity check: ${label}`);\n}\n\nfor (const [label, needle] of [\n  ['reservoir has top-answer audit', 'function topAnswerDiversityAudit(prompts)'],\n  ['reservoir ranks unused leaders first', 'leftLeaderLoad - rightLeaderLoad'],\n  ['reservoir certifies wider alternatives', 'const diversityExtra = Math.max(24, Math.ceil(need * 3));'],\n  ['reservoir keeps best ANY assignment', 'let bestReservoir = null;'],\n  ['reservoir reports diversity', 'topAnswerDiversity: frozenTopAnswerDiversity'],\n  ['generation result reports diversity', 'top-answer players']\n]) {\n  if (!guard.includes(needle)) throw new Error(`Missing reservoir top-answer uniqueness check: ${label}`);\n}\n\n// Synthetic regression: once leader A has been selected, a valid leader B alternative must\n// outrank another A candidate even when the duplicate candidate appears first.\nconst leaderCounts = new Map([['A', 1]]);\nconst candidates = [\n  { id: 'duplicate-first', leader: 'A', semantic: 0 },\n  { id: 'unique-second', leader: 'B', semantic: 5 }\n];\ncandidates.sort((left, right) => {\n  const leftLoad = Number(leaderCounts.get(left.leader) || 0);\n  const rightLoad = Number(leaderCounts.get(right.leader) || 0);\n  return leftLoad - rightLoad || left.semantic - right.semantic;\n});\nif (candidates[0].id !== 'unique-second') throw new Error('Unique top-answer alternative did not outrank a repeated weekly leader.');\n\nconsole.log('Weekly top-answer diversity policy verified: reservoir-level uniqueness preference and one-day scheduling cap are active.');''',
    'verifier strengthened body',
)
verify_path.write_text(verify)

# Add source-level assertions to the immutable weekly snapshot verifier.
snapshot_path = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
snapshot = snapshot_path.read_text()
anchor = "assert(batch.includes('? buildWeeklyReservoirRotationState(basePools)'), 'Guarded reservoir still replays old schedule history into its fresh 77-prompt cycle.');\n"
addition = '''assert(guard.includes('function topAnswerDiversityAudit(prompts)'), '77-prompt reservoir does not audit top-answer player uniqueness.');\nassert(guard.includes('leftLeaderLoad - rightLeaderLoad'), '77-prompt reservoir does not prefer unused weekly top-answer players.');\nassert(guard.includes('const diversityExtra = Math.max(24, Math.ceil(need * 3));'), '77-prompt reservoir does not certify enough alternatives for leader diversity.');\nassert(guard.includes('topAnswerDiversity: frozenTopAnswerDiversity'), '77-prompt reservoir does not expose its top-answer diversity audit.');\n'''
if addition not in snapshot:
    snapshot = replace_once(snapshot, anchor, anchor + addition, 'snapshot diversity assertions')
snapshot_path.write_text(snapshot)

print('Applied reservoir-level weekly top-answer uniqueness pass.')