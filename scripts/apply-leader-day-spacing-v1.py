from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing {label}')
    return text.replace(old, new, 1)

batch_path = Path('js/admin-batch-calendar.js')
batch = batch_path.read_text()
batch = replace_once(batch,
'''/* FPL Challenge Studio — Theme & Formation Engine v3.4.0: weekly-top-answer-aware date-identified seven-day challenge calendar generator.''',
'''/* FPL Challenge Studio — Theme & Formation Engine v3.5.0: leader-day-spaced date-identified seven-day challenge calendar generator.''', 'batch header')
batch = replace_once(batch,
'''  const ANSWER_DIVERSITY_POLICY_VERSION = 3;\n  const ANSWER_DIVERSITY_POOL_SIZE = 16;\n  const WEEKLY_LEADER_SOFT_CAP = 1;\n  const WEEKLY_LEADER_BASE_PENALTY = 180;''',
'''  const ANSWER_DIVERSITY_POLICY_VERSION = 4;\n  const ANSWER_DIVERSITY_POOL_SIZE = 16;\n  const WEEKLY_LEADER_MIN_DAY_GAP = 3;\n  const WEEKLY_LEADER_PREFERRED_DAY_CAP = 2;\n  const WEEKLY_LEADER_HARD_DAY_CAP = 3;\n  const WEEKLY_LEADER_GAP_PENALTY = 900;\n  const WEEKLY_LEADER_THIRD_DAY_PENALTY = 420;''', 'leader constants')
batch = batch.replace('    for (const count of leaders.values()) if (count > 1) penalty += (count - 1) * 60;\n', '')
old = '''  function weeklyLeaderPenalty(draft, weeklyLeaderDays) {\n    if (!(weeklyLeaderDays instanceof Map) || !weeklyLeaderDays.size) return 0;\n    let penalty = 0;\n    for (const playerId of weeklyLeaderIds(draft)) {\n      const projectedDays = Number(weeklyLeaderDays.get(playerId) || 0) + 1;\n      if (projectedDays <= WEEKLY_LEADER_SOFT_CAP) continue;\n      const excess = projectedDays - WEEKLY_LEADER_SOFT_CAP;\n      penalty += excess * excess * WEEKLY_LEADER_BASE_PENALTY;\n    }\n    return penalty;\n  }\n\n  function commitWeeklyLeaderDays(draft, weeklyLeaderDays) {\n    for (const playerId of weeklyLeaderIds(draft)) {\n      weeklyLeaderDays.set(playerId, Number(weeklyLeaderDays.get(playerId) || 0) + 1);\n    }\n  }'''
new = '''  function weeklyLeaderHistory(weeklyLeaderDays, playerId) {\n    const history = weeklyLeaderDays instanceof Map ? weeklyLeaderDays.get(playerId) : null;\n    return Array.isArray(history) ? history : [];\n  }\n\n  function weeklyLeaderPenalty(draft, weeklyLeaderDays, dayIndex) {\n    if (!(weeklyLeaderDays instanceof Map)) return 0;\n    let penalty = 0;\n    for (const playerId of weeklyLeaderIds(draft)) {\n      const history = weeklyLeaderHistory(weeklyLeaderDays, playerId);\n      const projectedDays = history.length + 1;\n      const lastDay = history.length ? history[history.length - 1] : null;\n      const gap = Number.isInteger(lastDay) ? dayIndex - lastDay : Number.POSITIVE_INFINITY;\n      if (gap < WEEKLY_LEADER_MIN_DAY_GAP) penalty += (WEEKLY_LEADER_MIN_DAY_GAP - gap) * WEEKLY_LEADER_GAP_PENALTY;\n      if (projectedDays > WEEKLY_LEADER_PREFERRED_DAY_CAP) penalty += (projectedDays - WEEKLY_LEADER_PREFERRED_DAY_CAP) * WEEKLY_LEADER_THIRD_DAY_PENALTY;\n    }\n    return penalty;\n  }\n\n  function commitWeeklyLeaderDays(draft, weeklyLeaderDays, dayIndex) {\n    for (const playerId of weeklyLeaderIds(draft)) {\n      const history = [...weeklyLeaderHistory(weeklyLeaderDays, playerId)];\n      if (!history.includes(dayIndex)) history.push(dayIndex);\n      weeklyLeaderDays.set(playerId, history);\n    }\n  }'''
batch = replace_once(batch, old, new, 'leader history functions')
batch = replace_once(batch,
'  function weightedPick(options, currentDraft, settings, familyPlan, promptMixPlan, weeklyLeaderDays, semanticPressure) {',
'  function weightedPick(options, currentDraft, settings, familyPlan, promptMixPlan, weeklyLeaderDays, dayIndex, semanticPressure) {', 'weighted signature')
old = '''      if (leaderRepeatedInDraft(prompt, currentDraft)) weight /= 8;\n      const leaderId = core.getPromptStats(prompt)?.bestAnswer?.playerId;\n      const priorLeaderDays = leaderId ? Number(weeklyLeaderDays?.get(leaderId) || 0) : 0;\n      if (priorLeaderDays >= WEEKLY_LEADER_SOFT_CAP) {\n        const excess = priorLeaderDays - WEEKLY_LEADER_SOFT_CAP + 1;\n        weight /= 1 + excess * excess * 12;\n      }'''
new = '''      const leaderId = core.getPromptStats(prompt)?.bestAnswer?.playerId;\n      const sameDayLeader = Boolean(leaderId && currentDraft.some(item => core.getPromptStats(item)?.bestAnswer?.playerId === leaderId));\n      if (sameDayLeader) {\n        // Multiple prompts led by the same player on one Daily Challenge count as one leader day.\n        // A small grouping preference helps concentrate unavoidable repeats instead of spreading them.\n        weight *= 1.2;\n      } else if (leaderId) {\n        const history = weeklyLeaderHistory(weeklyLeaderDays, leaderId);\n        const lastDay = history.length ? history[history.length - 1] : null;\n        const gap = Number.isInteger(lastDay) ? dayIndex - lastDay : Number.POSITIVE_INFINITY;\n        if (gap < WEEKLY_LEADER_MIN_DAY_GAP) weight /= 1 + (WEEKLY_LEADER_MIN_DAY_GAP - gap) * 24;\n        if (history.length >= WEEKLY_LEADER_PREFERRED_DAY_CAP) weight /= 18;\n        if (history.length >= WEEKLY_LEADER_HARD_DAY_CAP) weight /= 1000;\n      }'''
batch = replace_once(batch, old, new, 'weighted leader block')
batch = replace_once(batch,
'  function scoreDraft(draft, settings, promptMixPlan, weeklyLeaderDays) {',
'  function scoreDraft(draft, settings, promptMixPlan, weeklyLeaderDays, dayIndex) {', 'score signature')
batch = replace_once(batch, '    score += weeklyLeaderPenalty(draft, weeklyLeaderDays);', '    score += weeklyLeaderPenalty(draft, weeklyLeaderDays, dayIndex);', 'score penalty call')
batch = replace_once(batch,
'choice = weightedPick(options, draft, settings, familyPlan, promptMixPlan, weeklyLeaderDays, semanticPressure);',
'choice = weightedPick(options, draft, settings, familyPlan, promptMixPlan, weeklyLeaderDays, dayIndex, semanticPressure);', 'weighted call')
batch = replace_once(batch,
'        balance: scoreDraft(draft, settings, promptMixPlan, weeklyLeaderDays),',
'        balance: scoreDraft(draft, settings, promptMixPlan, weeklyLeaderDays, dayIndex),', 'candidate score call')
batch = replace_once(batch,
'      if (semantic.missingRequiredKeys(draft, semanticPressure.required).length) continue;\n',
'''      if (semantic.missingRequiredKeys(draft, semanticPressure.required).length) continue;\n      // Three separate leader days is the weekly hard ceiling. Repeated prompts on this same\n      // day are fine because the current day is only committed once after the XI passes.\n      if ([...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)) continue;\n''', 'hard day cap')
batch = replace_once(batch, '          commitWeeklyLeaderDays(prompts, weeklyLeaderDays);', '          commitWeeklyLeaderDays(prompts, weeklyLeaderDays, dayIndex);', 'commit day index')

pattern = re.compile(r'  function weeklyTopAnswerDiversity\(\) \{.*?\n  \}\n\n  function buildBatchReport\(\)', re.S)
replacement = '''  function weeklyTopAnswerDiversity() {\n    const byPlayer = new Map();\n    let promptCount = 0;\n    batchResults.forEach((result, dayIndex) => {\n      const leadersToday = new Map();\n      for (const prompt of result?.prompts || []) {\n        promptCount += 1;\n        const best = core.getPromptStats(prompt)?.bestAnswer;\n        const playerId = String(best?.playerId || "");\n        if (!playerId) continue;\n        const today = leadersToday.get(playerId) || {\n          playerId,\n          name: String(best?.playerName || best?.name || playerId),\n          promptCount: 0\n        };\n        today.promptCount += 1;\n        leadersToday.set(playerId, today);\n      }\n      for (const today of leadersToday.values()) {\n        const player = byPlayer.get(today.playerId) || { playerId: today.playerId, name: today.name, days: [] };\n        player.days.push({ dayIndex, date: result.releaseDate || result.date, promptCount: today.promptCount });\n        byPlayer.set(today.playerId, player);\n      }\n    });\n\n    const players = [...byPlayer.values()].map(player => {\n      player.days.sort((a, b) => a.dayIndex - b.dayIndex);\n      const gaps = [];\n      for (let index = 1; index < player.days.length; index += 1) gaps.push(player.days[index].dayIndex - player.days[index - 1].dayIndex);\n      return {\n        playerId: player.playerId,\n        name: player.name,\n        appearanceDays: player.days.length,\n        promptCount: player.days.reduce((sum, day) => sum + day.promptCount, 0),\n        dates: player.days.map(day => day.date),\n        minimumGapDays: gaps.length ? Math.min(...gaps) : null\n      };\n    }).sort((left, right) => right.appearanceDays - left.appearanceDays || right.promptCount - left.promptCount || left.name.localeCompare(right.name));\n\n    const spacingViolations = players.filter(player => player.minimumGapDays != null && player.minimumGapDays < WEEKLY_LEADER_MIN_DAY_GAP);\n    const preferredCapBreaches = players.filter(player => player.appearanceDays > WEEKLY_LEADER_PREFERRED_DAY_CAP);\n    const hardCapBreaches = players.filter(player => player.appearanceDays > WEEKLY_LEADER_HARD_DAY_CAP);\n    const playerDayAppearances = players.reduce((sum, player) => sum + player.appearanceDays, 0);\n    return {\n      promptCount,\n      uniquePlayers: players.length,\n      playerDayAppearances,\n      sameDayRepeatPrompts: Math.max(0, promptCount - playerDayAppearances),\n      minDayGap: WEEKLY_LEADER_MIN_DAY_GAP,\n      preferredDayCap: WEEKLY_LEADER_PREFERRED_DAY_CAP,\n      hardDayCap: WEEKLY_LEADER_HARD_DAY_CAP,\n      maxAppearanceDays: players.reduce((max, player) => Math.max(max, player.appearanceDays), 0),\n      spacingViolationCount: spacingViolations.length,\n      preferredCapBreachCount: preferredCapBreaches.length,\n      hardCapBreachCount: hardCapBreaches.length,\n      spacingViolations,\n      preferredCapBreaches,\n      hardCapBreaches,\n      players\n    };\n  }\n\n  function buildBatchReport()'''
batch, count = pattern.subn(replacement, batch, count=1)
if count != 1:
    raise SystemExit('weekly audit function replacement failed')
old = '''    const topAnswerAudit = weeklyTopAnswerDiversity();\n    const topAnswerSummary = topAnswerAudit\n      ? `<div class="batch-summary"><strong>Top-answer diversity: ${topAnswerAudit.uniquePlayers}/${topAnswerAudit.promptCount || 77} unique players</strong><span>${topAnswerAudit.repeatSlots ? `${topAnswerAudit.repeatSlots} fallback repeat slot(s)` : "No weekly leader repeats"}</span></div>`\n      : "";'''
new = '''    const topAnswerAudit = weeklyTopAnswerDiversity();\n    const topAnswerSummary = topAnswerAudit\n      ? `<div class="batch-summary"><strong>Leader-day diversity: ${topAnswerAudit.uniquePlayers} unique top-answer players</strong><span>3-day spacing · preferred max 2 days/player · hard max 3 · ${topAnswerAudit.spacingViolationCount ? `${topAnswerAudit.spacingViolationCount} spacing exception(s)` : "no spacing exceptions"} · same-day repeats allowed</span></div>`\n      : "";'''
batch = replace_once(batch, old, new, 'review summary')
old = '''        return audit.repeatSlots\n          ? `${audit.uniquePlayers}/${audit.promptCount || 77} unique top-answer players · ${audit.repeatSlots} fallback repeat slot(s). Repeats are only used after unique-leader alternatives are exhausted by the certified reservoir constraints.`\n          : `${audit.uniquePlayers}/${audit.promptCount || 77} unique top-answer players · no weekly leader repeats.`;'''
new = '''        return `${audit.uniquePlayers} unique top-answer players across ${audit.playerDayAppearances} leader-day appearances. Same-day repeats are allowed; repeat days target a ${audit.minDayGap}-day gap, prefer no more than ${audit.preferredDayCap} days per player and never exceed ${audit.hardDayCap}. Spacing exceptions: ${audit.spacingViolationCount}; players needing a third day: ${audit.preferredCapBreachCount}.`;'''
batch = replace_once(batch, old, new, 'readme summary')
batch = replace_once(batch,
'    getManifest: () => batchManifest ? JSON.parse(JSON.stringify(batchManifest)) : null,',
'    getTopAnswerDayAudit: () => JSON.parse(JSON.stringify(weeklyTopAnswerDiversity())),\n    getManifest: () => batchManifest ? JSON.parse(JSON.stringify(batchManifest)) : null,', 'audit api')
batch_path.write_text(batch)

guard_path = Path('js/admin-daily-generator-guard.js')
guard = guard_path.read_text()
guard = replace_once(guard, 'saved-library generation guard v2.4.0.', 'saved-library generation guard v2.5.0.', 'guard header')
guard = replace_once(guard, '  const VERSION = "2.4.0";', '  const VERSION = "2.5.0";', 'guard version')
old = '''      const diversity = certification.topAnswerDiversity || reservoir.plan.topAnswerDiversity;\n      const diversityText = diversity?.repeatSlots\n        ? `${diversity.uniquePlayers}/77 unique top-answer players · ${diversity.repeatSlots} fallback repeat slot(s)`\n        : "77/77 unique top-answer players";\n      setStatus(`Seven-day generation passed the saved-library guard: all 77 runtime-certified prompts were consumed exactly once, the 17-family targets were preserved, no same-day semantic clashes were allowed, and top-answer diversity finished at ${diversityText}.`, "pass");'''
new = '''      const dayAudit = window.FPL_STUDIO_BATCH_CALENDAR?.getTopAnswerDayAudit?.();\n      const diversityText = dayAudit\n        ? `${dayAudit.uniquePlayers} unique top-answer players · max ${dayAudit.maxAppearanceDays} leader day(s) for one player · ${dayAudit.spacingViolationCount} spacing exception(s)`\n        : "leader-day audit unavailable";\n      setStatus(`Seven-day generation passed the saved-library guard: all 77 runtime-certified prompts were consumed exactly once, the 17-family targets were preserved, no same-day semantic clashes were allowed, and the 3-day leader-spacing audit finished at ${diversityText}.`, "pass");'''
guard = replace_once(guard, old, new, 'guard success summary')
guard_path.write_text(guard)

config = Path('config/asset-manifest.json')
text = config.read_text()
text = text.replace('3.0.2-top-answer-diversity', '3.0.3-leader-day-spacing')
text = text.replace('3.4.0-top-answer-diversity', '3.5.0-leader-day-spacing')
text = text.replace('2.4.0-top-answer-diversity', '2.5.0-leader-day-spacing')
config.write_text(text)

for filename in ['scripts/verify-prompt-studio-clean-reset.mjs','scripts/verify-all-season-certification-gate.mjs','scripts/verify-weekly-certified-snapshot-race.mjs']:
    path = Path(filename)
    text = path.read_text()
    text = text.replace('saved-library generation guard v2.4.0', 'saved-library generation guard v2.5.0')
    text = text.replace('2.4.0-top-answer-diversity', '2.5.0-leader-day-spacing')
    text = text.replace('3.4.0-top-answer-diversity', '3.5.0-leader-day-spacing')
    text = text.replace('3.0.2-top-answer-diversity', '3.0.3-leader-day-spacing')
    path.write_text(text)

verify = Path('scripts/verify-weekly-top-answer-diversity.mjs')
verify.write_text('''import fs from "node:fs";\n\nconst batch = fs.readFileSync("js/admin-batch-calendar.js", "utf8");\nconst guard = fs.readFileSync("js/admin-daily-generator-guard.js", "utf8");\nconst checks = [\n  ["policy v4", "const ANSWER_DIVERSITY_POLICY_VERSION = 4;"],\n  ["three-day target", "const WEEKLY_LEADER_MIN_DAY_GAP = 3;"],\n  ["two-day preferred cap", "const WEEKLY_LEADER_PREFERRED_DAY_CAP = 2;"],\n  ["three-day hard cap", "const WEEKLY_LEADER_HARD_DAY_CAP = 3;"],\n  ["day history arrays", "function weeklyLeaderHistory(weeklyLeaderDays, playerId)"],\n  ["spacing penalty", "gap < WEEKLY_LEADER_MIN_DAY_GAP"],\n  ["same-day grouping", "sameDayLeader"],\n  ["same-day repeats allowed", "Multiple prompts led by the same player on one Daily Challenge count as one leader day."],\n  ["hard cap filter", "weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP"],\n  ["day index committed", "commitWeeklyLeaderDays(prompts, weeklyLeaderDays, dayIndex);"],\n  ["actual week audit", "function weeklyTopAnswerDiversity()"],\n  ["spacing audit", "spacingViolationCount"],\n  ["audit exported", "getTopAnswerDayAudit"],\n  ["guard uses day audit", "getTopAnswerDayAudit?.()"]\n];\nfor (const [label, token] of checks) {\n  if (!(batch.includes(token) || guard.includes(token))) throw new Error(`Missing leader-day diversity check: ${label}`);\n}\nif (batch.includes("const WEEKLY_LEADER_SOFT_CAP = 1;")) throw new Error("Old one-day soft cap remains.");\nif (batch.includes("if (leaderRepeatedInDraft(prompt, currentDraft)) weight /= 8;")) throw new Error("Same-day leader repeats are still penalised.");\nconsole.log("Weekly leader-day diversity policy verified.");\n''')
