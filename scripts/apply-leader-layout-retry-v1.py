from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing {label}")
    return text.replace(old, new, 1)


batch_path = Path("js/admin-batch-calendar.js")
batch = batch_path.read_text()

batch = replace_once(
    batch,
    "/* FPL Challenge Studio — Theme & Formation Engine v3.5.0: leader-day-spaced date-identified seven-day challenge calendar generator.",
    "/* FPL Challenge Studio — Theme & Formation Engine v3.6.0: leader-layout-retry date-identified seven-day challenge calendar generator.",
    "batch header",
)
batch = replace_once(batch, "  const ANSWER_DIVERSITY_POLICY_VERSION = 4;", "  const ANSWER_DIVERSITY_POLICY_VERSION = 5;", "policy version")
batch = replace_once(
    batch,
    "  const MAX_EXACT_CAP_CHECKS = 90;",
    "  const MAX_EXACT_CAP_CHECKS = 90;\n  const STRICT_WEEK_LAYOUT_ATTEMPTS = 4;\n  const FALLBACK_WEEK_LAYOUT_ATTEMPTS = 2;",
    "layout attempt constants",
)
batch = replace_once(
    batch,
    "  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, promptMixPlan, weeklyLeaderDays, dayIndex, date, token }) {",
    "  async function generateCandidateForDay({ basePools, settings, requiredFormation, formationSlots, exactPlan, familyPlan, promptMixPlan, weeklyLeaderDays, strictLeaderCap = true, dayIndex, date, token }) {",
    "candidate signature",
)
batch = replace_once(
    batch,
    "      if ([...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)) continue;",
    "      if (strictLeaderCap && [...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)) continue;",
    "conditional leader hard cap",
)
batch = replace_once(
    batch,
    '    if (!candidates.length) return { ok: false, reason: "No complete XI could satisfy exact rotation, formation and the hard same-day semantic-diversity guard. The generator will not cluster near-duplicate prompts on one day." };',
    '    if (!candidates.length) return { ok: false, reason: strictLeaderCap\n      ? "No complete XI could satisfy exact rotation, formation, the hard same-day semantic-diversity guard and the strict three-leader-day weekly cap."\n      : "No complete XI could satisfy exact rotation, formation and the hard same-day semantic-diversity guard, even after leader-day fallback was enabled." };',
    "accurate candidate failure reason",
)

batch = replace_once(
    batch,
    "  let generationToken = 0;",
    "  let generationToken = 0;\n  let lastLeaderLayoutPolicy = null;",
    "layout policy state",
)
batch = replace_once(
    batch,
    "    clearBatch(false);\n    const token = ++generationToken;",
    "    clearBatch(false);\n    lastLeaderLayoutPolicy = null;\n    const token = ++generationToken;",
    "reset layout policy",
)

old_start = '''    const rotationState = generationSnapshot
      ? buildWeeklyReservoirRotationState(basePools)
      : buildExactRotationState(virtualSchedule, startDate, basePools, promptById);
    const weeklyLeaderDays = new Map();

    try {
      for (let dayIndex = 0; dayIndex < DAYS_IN_BATCH; dayIndex += 1) {'''
new_start = '''    let rotationState = generationSnapshot
      ? buildWeeklyReservoirRotationState(basePools)
      : buildExactRotationState(virtualSchedule, startDate, basePools, promptById);
    let weeklyLeaderDays = new Map();
    const virtualScheduleBaselineLength = virtualSchedule.length;
    const layoutAttempts = [
      ...Array.from({ length: STRICT_WEEK_LAYOUT_ATTEMPTS }, () => ({ strictLeaderCap: true })),
      ...Array.from({ length: FALLBACK_WEEK_LAYOUT_ATTEMPTS }, () => ({ strictLeaderCap: false }))
    ];
    let layoutCompleted = false;
    let lastLayoutFailure = "";

    try {
      for (let layoutAttemptIndex = 0; layoutAttemptIndex < layoutAttempts.length; layoutAttemptIndex += 1) {
        const layoutAttempt = layoutAttempts[layoutAttemptIndex];
        if (layoutAttemptIndex > 0) {
          batchResults = [];
          virtualSchedule.splice(virtualScheduleBaselineLength);
          rotationState = generationSnapshot
            ? buildWeeklyReservoirRotationState(basePools)
            : buildExactRotationState(virtualSchedule, startDate, basePools, promptById);
          weeklyLeaderDays = new Map();
          renderBatchReview();
          setStatus(`Retrying weekly layout ${layoutAttemptIndex + 1}/${layoutAttempts.length} · ${layoutAttempt.strictLeaderCap ? "strict 3-day / max-3 leader policy" : "audited leader-day fallback"}…`, "working");
          await yieldToBrowser();
        }
        let attemptFailed = false;

        for (let dayIndex = 0; dayIndex < DAYS_IN_BATCH; dayIndex += 1) {'''
batch = replace_once(batch, old_start, new_start, "outer layout retry loop")

batch = replace_once(
    batch,
    "          promptMixPlan,\n          weeklyLeaderDays,\n          dayIndex,",
    "          promptMixPlan,\n          weeklyLeaderDays,\n          strictLeaderCap: layoutAttempt.strictLeaderCap,\n          dayIndex,",
    "strict leader cap call",
)

pattern = re.compile(r'''        if \(!generated\.ok\) \{\n.*?\n          return;\n        \}\n\n        const prompts = generated\.prompts;''', re.S)
replacement = '''        if (!generated.ok) {
          lastLayoutFailure = `${friendlyDate(date)}: ${generated.reason}`;
          attemptFailed = true;
          break;
        }

        const prompts = generated.prompts;'''
batch, count = pattern.subn(replacement, batch, count=1)
if count != 1:
    raise SystemExit("generated failure block replacement failed")

old_validation = '''        if (validation.length) {
          setStatus(`Batch stopped on ${friendlyDate(date)} because final validation failed: ${validation[0]}`, "fail");
          return;
        }'''
new_validation = '''        if (validation.length) {
          lastLayoutFailure = `${friendlyDate(date)}: final validation failed: ${validation[0]}`;
          attemptFailed = true;
          break;
        }'''
batch = replace_once(batch, old_validation, new_validation, "validation retry block")

old_end = '''        setStatus(`Generated ${dayIndex + 1}/${DAYS_IN_BATCH} · ${friendlyDate(date)} · perfect ${perfect.score.toLocaleString()} · PASS`, "working");
        await yieldToBrowser();
      }

      batchManifest = buildMergedManifest(repositoryManifestEntries(), batchResults, settings);'''
new_end = '''        setStatus(`Generated ${dayIndex + 1}/${DAYS_IN_BATCH} · ${friendlyDate(date)} · perfect ${perfect.score.toLocaleString()} · PASS`, "working");
        await yieldToBrowser();
        }

        if (!attemptFailed && batchResults.length === DAYS_IN_BATCH && batchResults.every(result => result.status === "PASS")) {
          layoutCompleted = true;
          lastLeaderLayoutPolicy = Object.freeze({
            strictLeaderCap: layoutAttempt.strictLeaderCap,
            attempt: layoutAttemptIndex + 1,
            totalAttemptsAvailable: layoutAttempts.length,
            strictAttemptsAvailable: STRICT_WEEK_LAYOUT_ATTEMPTS,
            fallbackAttemptsAvailable: FALLBACK_WEEK_LAYOUT_ATTEMPTS
          });
          break;
        }
        if (!attemptFailed) lastLayoutFailure = "The weekly layout ended before all seven dated challenges were produced.";
      }

      if (!layoutCompleted) {
        batchResults = [];
        virtualSchedule.splice(virtualScheduleBaselineLength);
        renderBatchReview();
        setStatus(`Batch layout failed after ${layoutAttempts.length} complete arrangement attempts. ${lastLayoutFailure}`, "fail");
        return;
      }

      batchManifest = buildMergedManifest(repositoryManifestEntries(), batchResults, settings);'''
batch = replace_once(batch, old_end, new_end, "layout retry completion")

old_audit_tail = '''      hardCapBreaches,
      players
    };'''
new_audit_tail = '''      hardCapBreaches,
      players,
      layoutPolicy: lastLeaderLayoutPolicy ? { ...lastLeaderLayoutPolicy } : null,
      fallbackUsed: lastLeaderLayoutPolicy?.strictLeaderCap === false
    };'''
batch = replace_once(batch, old_audit_tail, new_audit_tail, "audit layout policy")

old_summary = '''      ? `<div class="batch-summary"><strong>Leader-day diversity: ${topAnswerAudit.uniquePlayers} unique top-answer players</strong><span>3-day spacing · preferred max 2 days/player · hard max 3 · ${topAnswerAudit.spacingViolationCount ? `${topAnswerAudit.spacingViolationCount} spacing exception(s)` : "no spacing exceptions"} · same-day repeats allowed</span></div>`'''
new_summary = '''      ? `<div class="batch-summary"><strong>Leader-day diversity: ${topAnswerAudit.uniquePlayers} unique top-answer players</strong><span>3-day spacing · preferred max 2 days/player · strict max 3 · ${topAnswerAudit.fallbackUsed ? "fallback exception used after strict whole-week retries" : "strict max-3 held"} · ${topAnswerAudit.spacingViolationCount ? `${topAnswerAudit.spacingViolationCount} spacing exception(s)` : "no spacing exceptions"} · same-day repeats allowed</span></div>`'''
batch = replace_once(batch, old_summary, new_summary, "review fallback summary")

old_readme = '''        return `${audit.uniquePlayers} unique top-answer players across ${audit.playerDayAppearances} leader-day appearances. Same-day repeats are allowed; repeat days target a ${audit.minDayGap}-day gap, prefer no more than ${audit.preferredDayCap} days per player and never exceed ${audit.hardDayCap}. Spacing exceptions: ${audit.spacingViolationCount}; players needing a third day: ${audit.preferredCapBreachCount}.`;'''
new_readme = '''        return `${audit.uniquePlayers} unique top-answer players across ${audit.playerDayAppearances} leader-day appearances. Same-day repeats are allowed; repeat days target a ${audit.minDayGap}-day gap and prefer no more than ${audit.preferredDayCap} days per player. Studio first retries the whole week under a strict ${audit.hardDayCap}-day maximum; fallback exceptions are enabled only if every strict layout attempt fails. Fallback used: ${audit.fallbackUsed ? "YES" : "NO"}. Spacing exceptions: ${audit.spacingViolationCount}; players needing a third day: ${audit.preferredCapBreachCount}; strict-cap breaches: ${audit.hardCapBreachCount}.`;'''
batch = replace_once(batch, old_readme, new_readme, "readme fallback summary")

batch_path.write_text(batch)

config_path = Path("config/asset-manifest.json")
config = config_path.read_text()
config = config.replace("3.0.3-leader-day-spacing", "3.0.4-leader-layout-retry")
config = config.replace("3.5.0-leader-day-spacing", "3.6.0-leader-layout-retry")
config_path.write_text(config)

clean_path = Path("scripts/verify-prompt-studio-clean-reset.mjs")
clean = clean_path.read_text()
clean = clean.replace("3.0.3-leader-day-spacing", "3.0.4-leader-layout-retry")
clean = clean.replace("3.5.0-leader-day-spacing", "3.6.0-leader-layout-retry")
clean_path.write_text(clean)

verify_path = Path("scripts/verify-weekly-top-answer-diversity.mjs")
verify = verify_path.read_text()
verify = verify.replace('["policy v4", "const ANSWER_DIVERSITY_POLICY_VERSION = 4;"],', '["policy v5", "const ANSWER_DIVERSITY_POLICY_VERSION = 5;"],')
verify = verify.replace(
    '["hard cap filter", "weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP"],',
    '["strict hard cap filter", "strictLeaderCap && [...weeklyLeaderIds(draft)].some(playerId => weeklyLeaderHistory(weeklyLeaderDays, playerId).length >= WEEKLY_LEADER_HARD_DAY_CAP)"],\n  ["strict week retries", "const STRICT_WEEK_LAYOUT_ATTEMPTS = 4;"],\n  ["fallback week retries", "const FALLBACK_WEEK_LAYOUT_ATTEMPTS = 2;"],\n  ["layout state reset", "virtualSchedule.splice(virtualScheduleBaselineLength);"],\n  ["rotation state rebuild", "buildWeeklyReservoirRotationState(basePools)"],\n  ["fallback audit", "fallbackUsed: lastLeaderLayoutPolicy?.strictLeaderCap === false"],'
)
verify_path.write_text(verify)
