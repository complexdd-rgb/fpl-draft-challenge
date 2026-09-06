from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing {label}")
    return text.replace(old, new, 1)


path = Path("js/admin-batch-calendar.js")
text = path.read_text()

text = replace_once(
    text,
    "/* FPL Challenge Studio — Theme & Formation Engine v3.6.0: leader-layout-retry date-identified seven-day challenge calendar generator.",
    "/* FPL Challenge Studio — Theme & Formation Engine v3.7.0: leader-preplanned date-identified seven-day challenge calendar generator.",
    "batch header",
)
text = replace_once(text, "  const ANSWER_DIVERSITY_POLICY_VERSION = 5;", "  const ANSWER_DIVERSITY_POLICY_VERSION = 6;", "policy version")
text = replace_once(
    text,
    "  const STRICT_WEEK_LAYOUT_ATTEMPTS = 4;\n  const FALLBACK_WEEK_LAYOUT_ATTEMPTS = 2;",
    "  const WEEK_LAYOUT_ATTEMPTS = 6;\n  const LEADER_PREPLAN_ATTEMPTS = 90;",
    "layout constants",
)
text = replace_once(
    text,
    "  let lastLeaderLayoutPolicy = null;",
    "  let lastLeaderLayoutPolicy = null;\n  let lastLeaderPreplan = null;",
    "preplan state",
)
text = replace_once(
    text,
    "    lastLeaderLayoutPolicy = null;\n    const token = ++generationToken;",
    "    lastLeaderLayoutPolicy = null;\n    lastLeaderPreplan = null;\n    const token = ++generationToken;",
    "preplan reset",
)

marker = "  function weeklyLeaderHistory(weeklyLeaderDays, playerId) {"
if marker not in text:
    raise SystemExit("missing weekly leader helper marker")

preplanner = r'''  function leaderIdentity(prompt) {
    const best = core.getPromptStats(prompt)?.bestAnswer;
    const playerId = String(best?.playerId || "");
    return Object.freeze({
      playerId: playerId || `prompt:${String(prompt?.id || "unknown")}`,
      name: String(best?.playerName || best?.name || prompt?.id || "Unknown leader"),
      synthetic: !playerId
    });
  }

  function stablePlannerNoise(value, salt = 0) {
    const input = `${value}|${salt}`;
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function dayCombinations(size) {
    const results = [];
    const visit = (start, chosen) => {
      if (chosen.length === size) {
        results.push([...chosen]);
        return;
      }
      for (let day = start; day < DAYS_IN_BATCH; day += 1) {
        chosen.push(day);
        visit(day + 1, chosen);
        chosen.pop();
      }
    };
    visit(0, []);
    return results;
  }

  function cloneLeaderPlanDay(day) {
    return {
      promptIds: [...day.promptIds],
      positionCounts: { ...day.positionCounts },
      nationalityCount: day.nationalityCount,
      antiMetaCount: day.antiMetaCount,
      hardKeys: new Set(day.hardKeys)
    };
  }

  function restoreLeaderPlanDays(days, snapshot) {
    for (let index = 0; index < days.length; index += 1) {
      days[index].promptIds = [...snapshot[index].promptIds];
      days[index].positionCounts = { ...snapshot[index].positionCounts };
      days[index].nationalityCount = snapshot[index].nationalityCount;
      days[index].antiMetaCount = snapshot[index].antiMetaCount;
      days[index].hardKeys = new Set(snapshot[index].hardKeys);
    }
  }

  function leaderGroupMinimumDays(group, requiredFormation, semantic) {
    let minimum = 1;
    const positionCounts = new Map();
    const hardKeyCounts = new Map();
    let nationalityCount = 0;
    for (const prompt of group.prompts) {
      const position = String(prompt?.position || "");
      positionCounts.set(position, Number(positionCounts.get(position) || 0) + 1);
      if (isNationalityPrompt(prompt)) nationalityCount += 1;
      for (const key of semantic.hardKeys(prompt)) hardKeyCounts.set(key, Number(hardKeyCounts.get(key) || 0) + 1);
    }
    for (const [position, count] of positionCounts) {
      const capacity = Number(requiredFormation[position] || 0);
      if (!capacity) return DAYS_IN_BATCH + 1;
      minimum = Math.max(minimum, Math.ceil(count / capacity));
    }
    minimum = Math.max(minimum, nationalityCount);
    for (const count of hardKeyCounts.values()) minimum = Math.max(minimum, count);
    return minimum;
  }

  function leaderDaySetSpacingPenalty(daySet) {
    if (daySet.length < 2) return 0;
    let penalty = 0;
    for (let index = 1; index < daySet.length; index += 1) {
      const gap = daySet[index] - daySet[index - 1];
      if (gap < WEEKLY_LEADER_MIN_DAY_GAP) penalty += (WEEKLY_LEADER_MIN_DAY_GAP - gap) * 1000;
    }
    return penalty;
  }

  function leaderDaySetCapacityScore(group, daySet, days, requiredFormation, salt) {
    for (const position of Object.keys(requiredFormation)) {
      const needed = group.prompts.filter(prompt => prompt.position === position).length;
      const available = daySet.reduce((sum, dayIndex) => sum + Math.max(0, requiredFormation[position] - days[dayIndex].positionCounts[position]), 0);
      if (needed > available) return Number.POSITIVE_INFINITY;
    }
    const nationalityNeeded = group.prompts.filter(isNationalityPrompt).length;
    const nationalityAvailable = daySet.filter(dayIndex => days[dayIndex].nationalityCount === 0).length;
    if (nationalityNeeded > nationalityAvailable) return Number.POSITIVE_INFINITY;

    const load = daySet.reduce((sum, dayIndex) => sum + days[dayIndex].promptIds.length, 0);
    const antiMetaDeficit = daySet.reduce((sum, dayIndex) => sum + Math.max(0, Number(settingsFromUi().minAntiMeta || 0) - days[dayIndex].antiMetaCount), 0);
    return leaderDaySetSpacingPenalty(daySet) + load * 5 + antiMetaDeficit + stablePlannerNoise(`${group.playerId}:${daySet.join(",")}`, salt);
  }

  function placeLeaderGroup(group, daySet, days, requiredFormation, settings, semantic, salt) {
    const ordered = [...group.prompts].sort((left, right) => {
      const leftKeys = semantic.hardKeys(left).length;
      const rightKeys = semantic.hardKeys(right).length;
      return Number(isNationalityPrompt(right)) - Number(isNationalityPrompt(left))
        || rightKeys - leftKeys
        || Number(isAntiMeta(right)) - Number(isAntiMeta(left))
        || stablePlannerNoise(right.id, salt) - stablePlannerNoise(left.id, salt);
    });

    let steps = 0;
    const assign = index => {
      steps += 1;
      if (steps > 5000) return false;
      if (index >= ordered.length) return true;
      const prompt = ordered[index];
      const position = String(prompt.position || "");
      const keys = semantic.hardKeys(prompt);
      const nationality = isNationalityPrompt(prompt);
      const antiMeta = isAntiMeta(prompt);
      const candidates = daySet.filter(dayIndex => {
        const day = days[dayIndex];
        if (day.positionCounts[position] >= Number(requiredFormation[position] || 0)) return false;
        if (nationality && day.nationalityCount >= DAILY_PROMPT_MIX_TARGET.nationality) return false;
        if (keys.some(key => day.hardKeys.has(key))) return false;
        return true;
      }).sort((left, right) => {
        const score = dayIndex => {
          const day = days[dayIndex];
          const deficit = Math.max(0, settings.minAntiMeta - day.antiMetaCount);
          const antiScore = antiMeta ? -deficit * 30 : deficit * 8;
          const positionLoad = day.positionCounts[position] / Math.max(1, Number(requiredFormation[position] || 1));
          return antiScore + day.promptIds.length * 3 + positionLoad * 12 + stablePlannerNoise(`${prompt.id}:${dayIndex}`, salt);
        };
        return score(left) - score(right);
      });

      for (const dayIndex of candidates) {
        const day = days[dayIndex];
        day.promptIds.push(String(prompt.id));
        day.positionCounts[position] += 1;
        if (nationality) day.nationalityCount += 1;
        if (antiMeta) day.antiMetaCount += 1;
        keys.forEach(key => day.hardKeys.add(key));
        if (assign(index + 1)) return true;
        day.promptIds.pop();
        day.positionCounts[position] -= 1;
        if (nationality) day.nationalityCount -= 1;
        if (antiMeta) day.antiMetaCount -= 1;
        // Rebuild semantic keys for this day because another prompt may share a key only in
        // impossible states; rebuilding keeps rollback exact without reference counts.
        day.hardKeys = new Set(day.promptIds.flatMap(id => semantic.hardKeys(group.promptById.get(id) || group.allPromptById.get(id))));
      }
      return false;
    };

    return assign(0);
  }

  function buildLeaderDayPreplan(prompts, requiredFormation, settings, salt = 0) {
    const semantic = window.FPL_DAILY_SEMANTIC_DIVERSITY;
    if (!semantic?.hardKeys || !semantic?.dayIssues) {
      return { ok: false, terminal: true, reason: "Leader-day pre-planning cannot run because the semantic-diversity API is unavailable." };
    }
    const uniquePrompts = [...new Map((prompts || []).filter(prompt => prompt?.id).map(prompt => [String(prompt.id), prompt])).values()];
    if (uniquePrompts.length !== DAYS_IN_BATCH * 11) {
      return { ok: false, terminal: true, reason: `Leader-day pre-planning expected the certified 77-prompt reservoir but received ${uniquePrompts.length} prompts.` };
    }
    const allPromptById = new Map(uniquePrompts.map(prompt => [String(prompt.id), prompt]));
    const groupsByLeader = new Map();
    for (const prompt of uniquePrompts) {
      const leader = leaderIdentity(prompt);
      const group = groupsByLeader.get(leader.playerId) || { playerId: leader.playerId, name: leader.name, synthetic: leader.synthetic, prompts: [] };
      group.prompts.push(prompt);
      groupsByLeader.set(leader.playerId, group);
    }
    const groups = [...groupsByLeader.values()].map(group => ({
      ...group,
      allPromptById,
      promptById: new Map(group.prompts.map(prompt => [String(prompt.id), prompt])),
      minimumDays: leaderGroupMinimumDays(group, requiredFormation, semantic)
    }));
    const impossible = groups.filter(group => !group.synthetic && group.minimumDays > WEEKLY_LEADER_HARD_DAY_CAP);
    if (impossible.length) {
      impossible.sort((left, right) => right.minimumDays - left.minimumDays || right.prompts.length - left.prompts.length);
      const blocker = impossible[0];
      return {
        ok: false,
        terminal: true,
        reason: `${blocker.name} leads ${blocker.prompts.length} reservoir prompts that mathematically require at least ${blocker.minimumDays} separate days under the current formation/nationality/semantic constraints. The hard maximum is ${WEEKLY_LEADER_HARD_DAY_CAP}; improve the reservoir/family mix rather than publishing a 4+ day leader.`
      };
    }

    let best = null;
    for (let attempt = 0; attempt < LEADER_PREPLAN_ATTEMPTS; attempt += 1) {
      const attemptSalt = salt * 1000 + attempt;
      const days = Array.from({ length: DAYS_IN_BATCH }, () => ({
        promptIds: [],
        positionCounts: Object.fromEntries(Object.keys(requiredFormation).map(position => [position, 0])),
        nationalityCount: 0,
        antiMetaCount: 0,
        hardKeys: new Set()
      }));
      const orderedGroups = [...groups].sort((left, right) =>
        right.minimumDays - left.minimumDays
        || right.prompts.length - left.prompts.length
        || stablePlannerNoise(left.playerId, attemptSalt) - stablePlannerNoise(right.playerId, attemptSalt)
      );
      let failed = false;

      for (const group of orderedGroups) {
        let placed = false;
        const maximumDays = group.synthetic ? 1 : WEEKLY_LEADER_HARD_DAY_CAP;
        for (let dayCount = group.minimumDays; dayCount <= maximumDays && !placed; dayCount += 1) {
          const combinations = dayCombinations(dayCount).sort((left, right) =>
            leaderDaySetCapacityScore(group, left, days, requiredFormation, attemptSalt)
            - leaderDaySetCapacityScore(group, right, days, requiredFormation, attemptSalt)
          );
          for (const daySet of combinations) {
            if (!Number.isFinite(leaderDaySetCapacityScore(group, daySet, days, requiredFormation, attemptSalt))) continue;
            const snapshot = days.map(cloneLeaderPlanDay);
            if (placeLeaderGroup(group, daySet, days, requiredFormation, settings, semantic, attemptSalt)) {
              placed = true;
              break;
            }
            restoreLeaderPlanDays(days, snapshot);
          }
        }
        if (!placed) {
          failed = true;
          break;
        }
      }
      if (failed) continue;

      const dayPrompts = days.map(day => day.promptIds.map(id => allPromptById.get(id)).filter(Boolean));
      const valid = dayPrompts.every((promptsForDay, dayIndex) => {
        if (promptsForDay.length !== 11) return false;
        if (days[dayIndex].nationalityCount !== DAILY_PROMPT_MIX_TARGET.nationality) return false;
        if (days[dayIndex].antiMetaCount < settings.minAntiMeta) return false;
        if (semantic.dayIssues(promptsForDay).length) return false;
        return Object.keys(requiredFormation).every(position => days[dayIndex].positionCounts[position] === requiredFormation[position]);
      });
      if (!valid) continue;

      const leaderDays = new Map();
      dayPrompts.forEach((promptsForDay, dayIndex) => {
        for (const prompt of promptsForDay) {
          const leader = leaderIdentity(prompt);
          if (leader.synthetic) continue;
          const set = leaderDays.get(leader.playerId) || new Set();
          set.add(dayIndex);
          leaderDays.set(leader.playerId, set);
        }
      });
      if ([...leaderDays.values()].some(set => set.size > WEEKLY_LEADER_HARD_DAY_CAP)) continue;
      let spacingViolations = 0;
      let thirdDayPlayers = 0;
      for (const set of leaderDays.values()) {
        const values = [...set].sort((a, b) => a - b);
        if (values.length > WEEKLY_LEADER_PREFERRED_DAY_CAP) thirdDayPlayers += 1;
        for (let index = 1; index < values.length; index += 1) if (values[index] - values[index - 1] < WEEKLY_LEADER_MIN_DAY_GAP) spacingViolations += 1;
      }
      const score = spacingViolations * 10000 + thirdDayPlayers * 1000 + [...leaderDays.values()].reduce((sum, set) => sum + set.size, 0);
      const candidate = {
        ok: true,
        dayPromptIds: days.map(day => new Set(day.promptIds)),
        audit: Object.freeze({
          plannerAttempt: attempt + 1,
          spacingViolations,
          thirdDayPlayers,
          maxLeaderDays: [...leaderDays.values()].reduce((max, set) => Math.max(max, set.size), 0),
          constrainedLeaders: groups.filter(group => !group.synthetic && group.minimumDays > 1).map(group => ({ name: group.name, promptCount: group.prompts.length, minimumDays: group.minimumDays }))
        }),
        score
      };
      if (!best || candidate.score < best.score) best = candidate;
      if (spacingViolations === 0 && thirdDayPlayers === 0) break;
    }

    if (best) return best;
    const constrained = groups
      .filter(group => !group.synthetic)
      .sort((left, right) => right.minimumDays - left.minimumDays || right.prompts.length - left.prompts.length)
      .slice(0, 5)
      .map(group => `${group.name} (${group.prompts.length} prompts; min ${group.minimumDays} day${group.minimumDays === 1 ? "" : "s"})`)
      .join(", ");
    return {
      ok: false,
      terminal: false,
      reason: `No complete 77-prompt leader-day pre-plan satisfied formation, one nationality per day, anti-meta minimums, same-day semantic diversity and the hard max-3 leader rule. Most constrained leaders: ${constrained || "none identified"}.`
    };
  }

  function filterBasePoolsForIds(basePools, promptIds) {
    if (!(promptIds instanceof Set)) return basePools;
    return Object.fromEntries(Object.entries(basePools).map(([position, prompts]) => [
      position,
      prompts.filter(prompt => promptIds.has(String(prompt.id)))
    ]));
  }

'''
text = text.replace(marker, preplanner + marker, 1)

old_layout = '''    const layoutAttempts = [
      ...Array.from({ length: STRICT_WEEK_LAYOUT_ATTEMPTS }, () => ({ strictLeaderCap: true })),
      ...Array.from({ length: FALLBACK_WEEK_LAYOUT_ATTEMPTS }, () => ({ strictLeaderCap: false }))
    ];'''
new_layout = '''    const layoutAttempts = Array.from({ length: WEEK_LAYOUT_ATTEMPTS }, (_, index) => ({
      strictLeaderCap: true,
      plannerSalt: index
    }));'''
text = replace_once(text, old_layout, new_layout, "strict-only layout attempts")

text = replace_once(
    text,
    '          setStatus(`Retrying weekly layout ${layoutAttemptIndex + 1}/${layoutAttempts.length} · ${layoutAttempt.strictLeaderCap ? "strict 3-day / max-3 leader policy" : "audited leader-day fallback"}…`, "working");',
    '          setStatus(`Retrying weekly layout ${layoutAttemptIndex + 1}/${layoutAttempts.length} · rebuilding the hard max-3 leader pre-plan…`, "working");',
    "retry status",
)

loop_marker = '''        let attemptFailed = false;

        for (let dayIndex = 0; dayIndex < DAYS_IN_BATCH; dayIndex += 1) {'''
loop_insert = '''        let attemptFailed = false;
        const planningPrompts = generationSnapshot
          ? [...new Map(Object.values(basePools).flat().map(prompt => [String(prompt.id), prompt])).values()]
          : null;
        const leaderPreplan = planningPrompts
          ? buildLeaderDayPreplan(planningPrompts, requiredFormation, settings, layoutAttempt.plannerSalt)
          : null;
        if (leaderPreplan && !leaderPreplan.ok) {
          lastLayoutFailure = leaderPreplan.reason;
          if (leaderPreplan.terminal) break;
          continue;
        }
        if (leaderPreplan?.audit) lastLeaderPreplan = leaderPreplan.audit;

        for (let dayIndex = 0; dayIndex < DAYS_IN_BATCH; dayIndex += 1) {'''
text = replace_once(text, loop_marker, loop_insert, "preplan before day loop")

exact_marker = '''        const familyPlan = buildFamilyCooldownPlan({
          schedule: virtualSchedule,
          date,
          cooldownDays: settings.cooldownChallenges,
          promptById,
          basePools,
          exactPlan,
          requiredFormation
        });'''
exact_replacement = '''        const plannedPromptIds = leaderPreplan?.dayPromptIds?.[dayIndex] || null;
        const dayBasePools = filterBasePoolsForIds(basePools, plannedPromptIds);
        const familyPlan = buildFamilyCooldownPlan({
          schedule: virtualSchedule,
          date,
          cooldownDays: settings.cooldownChallenges,
          promptById,
          basePools: dayBasePools,
          exactPlan,
          requiredFormation
        });'''
text = replace_once(text, exact_marker, exact_replacement, "planned daily pools")
text = replace_once(
    text,
    "        const promptMixPlan = buildPromptMixQuotaPlan({ basePools, exactPlan, familyPlan });",
    "        const promptMixPlan = buildPromptMixQuotaPlan({ basePools: dayBasePools, exactPlan, familyPlan });",
    "planned prompt mix pools",
)
text = replace_once(
    text,
    "          basePools,\n          settings,\n          requiredFormation,",
    "          basePools: dayBasePools,\n          settings,\n          requiredFormation,",
    "planned candidate pools",
)
text = replace_once(
    text,
    "          strictLeaderCap: layoutAttempt.strictLeaderCap,",
    "          strictLeaderCap: true,",
    "hard leader cap call",
)

old_policy = '''          lastLeaderLayoutPolicy = Object.freeze({
            strictLeaderCap: layoutAttempt.strictLeaderCap,
            attempt: layoutAttemptIndex + 1,
            totalAttemptsAvailable: layoutAttempts.length,
            strictAttemptsAvailable: STRICT_WEEK_LAYOUT_ATTEMPTS,
            fallbackAttemptsAvailable: FALLBACK_WEEK_LAYOUT_ATTEMPTS
          });'''
new_policy = '''          lastLeaderLayoutPolicy = Object.freeze({
            strictLeaderCap: true,
            attempt: layoutAttemptIndex + 1,
            totalAttemptsAvailable: layoutAttempts.length,
            preplanned: Boolean(leaderPreplan)
          });'''
text = replace_once(text, old_policy, new_policy, "layout policy audit")

text = replace_once(
    text,
    "      layoutPolicy: lastLeaderLayoutPolicy ? { ...lastLeaderLayoutPolicy } : null,\n      fallbackUsed: lastLeaderLayoutPolicy?.strictLeaderCap === false",
    "      layoutPolicy: lastLeaderLayoutPolicy ? { ...lastLeaderLayoutPolicy } : null,\n      leaderPreplan: lastLeaderPreplan ? { ...lastLeaderPreplan } : null,\n      preplanUsed: Boolean(lastLeaderPreplan)",
    "weekly audit preplan",
)

old_summary = '''      ? `<div class="batch-summary"><strong>Leader-day diversity: ${topAnswerAudit.uniquePlayers} unique top-answer players</strong><span>3-day spacing · preferred max 2 days/player · strict max 3 · ${topAnswerAudit.fallbackUsed ? "fallback exception used after strict whole-week retries" : "strict max-3 held"} · ${topAnswerAudit.spacingViolationCount ? `${topAnswerAudit.spacingViolationCount} spacing exception(s)` : "no spacing exceptions"} · same-day repeats allowed</span></div>`'''
new_summary = '''      ? `<div class="batch-summary"><strong>Leader-day diversity: ${topAnswerAudit.uniquePlayers} unique top-answer players</strong><span>pre-planned before XI generation · 3-day spacing target · preferred max 2 days/player · hard max 3 · ${topAnswerAudit.hardCapBreachCount ? `${topAnswerAudit.hardCapBreachCount} hard-cap breach(es)` : "no 4+ day leaders"} · ${topAnswerAudit.spacingViolationCount ? `${topAnswerAudit.spacingViolationCount} spacing exception(s)` : "no spacing exceptions"} · same-day repeats allowed</span></div>`'''
text = replace_once(text, old_summary, new_summary, "review preplan summary")

old_readme = '''        return `${audit.uniquePlayers} unique top-answer players across ${audit.playerDayAppearances} leader-day appearances. Same-day repeats are allowed; repeat days target a ${audit.minDayGap}-day gap and prefer no more than ${audit.preferredDayCap} days per player. Studio first retries the whole week under a strict ${audit.hardDayCap}-day maximum; fallback exceptions are enabled only if every strict layout attempt fails. Fallback used: ${audit.fallbackUsed ? "YES" : "NO"}. Spacing exceptions: ${audit.spacingViolationCount}; players needing a third day: ${audit.preferredCapBreachCount}; strict-cap breaches: ${audit.hardCapBreachCount}.`;'''
new_readme = '''        return `${audit.uniquePlayers} unique top-answer players across ${audit.playerDayAppearances} leader-day appearances. Same-day repeats are allowed. The certified 77-prompt reservoir is pre-planned across all seven days before XI generation, repeat days target a ${audit.minDayGap}-day gap, ${audit.preferredDayCap} days/player is preferred and ${audit.hardDayCap} is a hard maximum. Spacing exceptions: ${audit.spacingViolationCount}; players needing a third day: ${audit.preferredCapBreachCount}; hard-cap breaches: ${audit.hardCapBreachCount}.`;'''
text = replace_once(text, old_readme, new_readme, "README preplan summary")

text = replace_once(
    text,
    "      fallbackUsed: lastLeaderLayoutPolicy?.strictLeaderCap === false",
    "      preplanUsed: Boolean(lastLeaderPreplan)",
    "fallback field cleanup",
) if "fallbackUsed: lastLeaderLayoutPolicy?.strictLeaderCap === false" in text else text

path.write_text(text)

# Central asset versions.
manifest = Path("config/asset-manifest.json")
content = manifest.read_text()
content = content.replace("3.0.4-leader-layout-retry", "3.0.5-leader-preplan")
content = content.replace("3.6.0-leader-layout-retry", "3.7.0-leader-preplan")
manifest.write_text(content)

# Version assertions in the clean-reset boundary.
clean = Path("scripts/verify-prompt-studio-clean-reset.mjs")
content = clean.read_text()
content = content.replace("3.0.4-leader-layout-retry", "3.0.5-leader-preplan")
content = content.replace("3.6.0-leader-layout-retry", "3.7.0-leader-preplan")
clean.write_text(content)

# Dedicated leader diversity regression now requires a pre-plan and forbids fallback.
verify = Path("scripts/verify-weekly-top-answer-diversity.mjs")
content = verify.read_text()
content = content.replace('["policy v5", "const ANSWER_DIVERSITY_POLICY_VERSION = 5;"],', '["policy v6", "const ANSWER_DIVERSITY_POLICY_VERSION = 6;"],')
content = re.sub(r'\n  \["strict week retries".*?\["fallback audit".*?\],', '', content, flags=re.S)
needle = '  ["day index committed", "commitWeeklyLeaderDays(prompts, weeklyLeaderDays, dayIndex);"],'
insert = '''  ["day index committed", "commitWeeklyLeaderDays(prompts, weeklyLeaderDays, dayIndex);"],
  ["whole-week leader preplanner", "function buildLeaderDayPreplan(prompts, requiredFormation, settings, salt = 0)"],
  ["leader minimum-day proof", "function leaderGroupMinimumDays(group, requiredFormation, semantic)"],
  ["hard max-three blocker", "group.minimumDays > WEEKLY_LEADER_HARD_DAY_CAP"],
  ["preplanned daily prompt ids", "leaderPreplan?.dayPromptIds?.[dayIndex]"],
  ["daily pool restriction", "filterBasePoolsForIds(basePools, plannedPromptIds)"],
  ["preplan audit", "leaderPreplan: lastLeaderPreplan ? { ...lastLeaderPreplan } : null"],'''
if needle not in content:
    raise SystemExit("missing diversity verifier insertion point")
content = content.replace(needle, insert, 1)
content += '''\nif (batch.includes("FALLBACK_WEEK_LAYOUT_ATTEMPTS")) throw new Error("Leader-day fallback can still permit 4+ appearance days.");
const minimumDays = (count, dailyCapacity) => Math.ceil(count / dailyCapacity);
if (minimumDays(8, 4) !== 2) throw new Error("Eight defender-led prompts should fit on two 4-4-2 days.");
if (minimumDays(7, 4) !== 2) throw new Error("Seven midfielder-led prompts should fit on two 4-4-2 days.");
if (minimumDays(13, 4) <= 3) throw new Error("Thirteen defender-led prompts should be diagnosed as impossible under max three days.");\n'''
verify.write_text(content)
