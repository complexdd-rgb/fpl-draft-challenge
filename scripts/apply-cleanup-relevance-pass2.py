from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match in {path}, found {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count < 1:
        raise RuntimeError(f"{label}: expected at least one match in {path}")
    p.write_text(text.replace(old, new), encoding="utf-8")


batch = "js/admin-batch-calendar.js"

replace_once(
    batch,
    "/* FPL Challenge Studio — Theme & Formation Engine v3.7.0: leader-preplanned date-identified seven-day challenge calendar generator.",
    "/* FPL Challenge Studio — Theme & Formation Engine v3.8.0: preplanned fast-path date-identified seven-day challenge calendar generator.",
    "batch version header",
)

replace_once(
    batch,
    "  let lastLeaderLayoutPolicy = null;\n  let lastLeaderPreplan = null;",
    "  let lastLeaderPreplan = null;",
    "remove duplicate leader layout state",
)

replace_once(
    batch,
    "    lastLeaderLayoutPolicy = null;\n    lastLeaderPreplan = null;",
    "    lastLeaderPreplan = null;",
    "remove duplicate leader layout reset",
)

replace_once(
    batch,
    '''    const layoutAttempts = Array.from({ length: WEEK_LAYOUT_ATTEMPTS }, (_, index) => ({\n      strictLeaderCap: true,\n      plannerSalt: index\n    }));''',
    '''    const layoutAttempts = Array.from({ length: WEEK_LAYOUT_ATTEMPTS }, (_, index) => ({ plannerSalt: index }));''',
    "remove dead layout strict flag",
)

replace_once(
    batch,
    '''          weeklyLeaderDays,\n          strictLeaderCap: true,\n          dayIndex,''',
    '''          weeklyLeaderDays,\n          preplanned: Boolean(plannedPromptIds),\n          dayIndex,''',
    "pass preplanned fast-path flag",
)

replace_once(
    batch,
    "  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, promptMixPlan, weeklyLeaderDays, strictLeaderCap = true, dayIndex, date, token }) {",
    "  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, promptMixPlan, weeklyLeaderDays, preplanned = false, dayIndex, date, token }) {",
    "candidate signature",
)

replace_once(
    batch,
    "      if (strictLeaderCap && [...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)) continue;",
    "      if ([...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)) continue;",
    "hard leader cap",
)

replace_once(
    batch,
    '''    if (!candidates.length) return { ok: false, reason: strictLeaderCap\n      ? "No complete XI could satisfy exact rotation, formation, the hard same-day semantic-diversity guard and the strict three-leader-day weekly cap."\n      : "No complete XI could satisfy exact rotation, formation and the hard same-day semantic-diversity guard, even after leader-day fallback was enabled." };''',
    '''    if (!candidates.length) return {\n      ok: false,\n      reason: "No complete XI could satisfy exact rotation, formation, the hard same-day semantic-diversity guard and the strict three-leader-day weekly cap."\n    };''',
    "remove unreachable fallback error",
)

replace_once(
    batch,
    '''          lastLeaderLayoutPolicy = Object.freeze({\n            strictLeaderCap: true,\n            attempt: layoutAttemptIndex + 1,\n            totalAttemptsAvailable: layoutAttempts.length,\n            preplanned: Boolean(leaderPreplan)\n          });''',
    '''          if (lastLeaderPreplan) {\n            lastLeaderPreplan = Object.freeze({\n              ...lastLeaderPreplan,\n              layoutAttempt: layoutAttemptIndex + 1,\n              totalLayoutAttempts: layoutAttempts.length\n            });\n          }''',
    "fold layout metadata into preplan audit",
)

replace_once(
    batch,
    "      layoutPolicy: lastLeaderLayoutPolicy ? { ...lastLeaderLayoutPolicy } : null,\n      leaderPreplan: lastLeaderPreplan ? { ...lastLeaderPreplan } : null,",
    "      leaderPreplan: lastLeaderPreplan ? { ...lastLeaderPreplan } : null,",
    "remove duplicate layout policy audit field",
)

anchor = '''    const candidates = [];\n    const signatures = new Set();'''
fast_path = '''    if (preplanned) {\n      if (token !== generationToken) return { ok: false, reason: "Generation cancelled." };\n      const positionOrder = [...new Set(formationSlots)];\n      const prompts = positionOrder.flatMap(position => basePools[position] || []);\n      if (prompts.length !== 11) {\n        return { ok: false, reason: `The leader-day pre-plan supplied ${prompts.length} prompts instead of exactly 11.` };\n      }\n      if (promptMixCounts(prompts).nationality !== DAILY_PROMPT_MIX_TARGET.nationality) {\n        return { ok: false, reason: "The leader-day pre-plan did not preserve exactly one nationality prompt for this day." };\n      }\n      if (!satisfiesExactRotationRequirements(prompts, exactPlan)) {\n        return { ok: false, reason: "The leader-day pre-plan skipped a prompt required by exact rotation." };\n      }\n      if (prompts.filter(isAntiMeta).length < settings.minAntiMeta) {\n        return { ok: false, reason: "The leader-day pre-plan fell below the daily anti-meta minimum." };\n      }\n      const semanticIssues = semantic.dayIssues(prompts);\n      if (semanticIssues.length) return { ok: false, reason: semanticIssues[0].message };\n      if (semantic.missingRequiredKeys(prompts, semanticPressure.required).length) {\n        return { ok: false, reason: "The leader-day pre-plan did not place a semantic backlog item required on this day." };\n      }\n      if ([...weeklyLeaderIds(prompts)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)) {\n        return { ok: false, reason: "The leader-day pre-plan would exceed the hard maximum of three appearance days for one top-answer player." };\n      }\n      const perfect = calculatePerfectXI(prompts);\n      if (!perfect.possible) return { ok: false, reason: perfect.reason || "The preplanned XI has no valid unique-player solution." };\n      if (settings.maxPerfectScore > 0 && perfect.score > settings.maxPerfectScore) {\n        return { ok: false, reason: `The preplanned XI perfect score is ${perfect.score.toLocaleString()}, above the ${settings.maxPerfectScore.toLocaleString()} ceiling.` };\n      }\n      return {\n        ok: true,\n        prompts,\n        perfect,\n        quotaRelaxed: !promptMixMeets(promptMixCounts(prompts), promptMixPlan)\n      };\n    }\n\n    const candidates = [];\n    const signatures = new Set();'''
replace_once(batch, anchor, fast_path, "insert exact-11 preplanned fast path")

# Cache/version boundary for the changed production runtime.
for path in ["config/asset-manifest.json", "js/asset-manifest.js", "admin.html", "scripts/verify-prompt-studio-clean-reset.mjs"]:
    replace_all(path, "3.0.5-leader-preplan", "3.0.6-preplan-fastpath", f"manifest version {path}")
    replace_all(path, "3.7.0-leader-preplan", "3.8.0-preplan-fastpath", f"batch version {path}")

verifier = Path("scripts/verify-weekly-top-answer-diversity.mjs")
text = verifier.read_text(encoding="utf-8")
text = text.replace(
    '["strict hard cap filter", "strictLeaderCap && [...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)"],',
    '["hard cap filter", "[...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)"],\n  ["preplanned exact-11 fast path", "preplanned: Boolean(plannedPromptIds)"],',
)
if 'preplanned exact-11 fast path' not in text:
    raise RuntimeError("weekly leader verifier did not update hard-cap/fast-path checks")
needle = 'if (batch.includes("FALLBACK_WEEK_LAYOUT_ATTEMPTS")) throw new Error("Leader-day fallback can still permit 4+ appearance days.");'
replacement = needle + '\nif (batch.includes("strictLeaderCap")) throw new Error("Dead strictLeaderCap fallback plumbing remains in the batch generator.");\nif (batch.includes("leader-day fallback was enabled")) throw new Error("Unreachable leader-day fallback messaging remains in the batch generator.");\nif (batch.includes("lastLeaderLayoutPolicy")) throw new Error("Duplicate leader layout audit state remains alongside the preplan audit.");'
if needle not in text:
    raise RuntimeError("weekly leader verifier fallback assertion anchor missing")
text = text.replace(needle, replacement, 1)
verifier.write_text(text, encoding="utf-8")

print("Pass 2 runtime simplification applied.")
