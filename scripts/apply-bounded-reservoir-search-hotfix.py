from pathlib import Path
import json, re


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    return text.replace(old, new, 1)


p = Path('js/admin-daily-generator-guard.js')
s = p.read_text()
s = replace_once(s, 'saved-library generation guard v2.6.4.', 'saved-library generation guard v2.6.5.', 'guard header')
s = replace_once(s, 'const VERSION = "2.6.4";', 'const VERSION = "2.6.5";', 'guard version')

anchor = '  function assignAnyRecords(records, positionNeeds, offset = 0) {'
helper = r'''  function searchLeaderCappedSelection(selectionGroups, semantic, nodeLimit = 8000) {
    const groups = selectionGroups.map(group => ({
      ...group,
      groupKey: `${group.family}|${group.position}`,
      available: [...(group.available || [])]
    }));
    const selectedEntries = [];
    let nodes = 0;
    let bestDepth = 0;
    let exhausted = false;

    function searchGroup(groupIndex, sourceIds, leaderCounts, semanticCounts) {
      bestDepth = Math.max(bestDepth, selectedEntries.length);
      if (groupIndex >= groups.length) return selectedEntries.map(entry => ({ ...entry }));
      if (nodes >= nodeLimit) {
        exhausted = true;
        return null;
      }
      const group = groups[groupIndex];
      return chooseWithinGroup(group, groupIndex, 0, Number(group.required || 0), sourceIds, leaderCounts, semanticCounts);
    }

    function chooseWithinGroup(group, groupIndex, startIndex, remaining, sourceIds, leaderCounts, semanticCounts) {
      bestDepth = Math.max(bestDepth, selectedEntries.length);
      if (remaining <= 0) return searchGroup(groupIndex + 1, sourceIds, leaderCounts, semanticCounts);
      if (nodes >= nodeLimit) {
        exhausted = true;
        return null;
      }

      const options = group.available
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate, index }) => {
          if (index < startIndex) return false;
          const sourceId = String(candidate.record?.id || "");
          if (!sourceId || sourceIds.has(sourceId)) return false;
          if (!semantic.canAddWeekly(candidate.prompt, semanticCounts, DAYS_IN_BATCH)) return false;
          const leader = promptTopAnswerKey(candidate.prompt);
          return !leader || Number(leaderCounts.get(leader) || 0) < WEEKLY_LEADER_FALLBACK_PROMPT_CAP;
        })
        .sort((left, right) => {
          const leftLeader = promptTopAnswerKey(left.candidate.prompt);
          const rightLeader = promptTopAnswerKey(right.candidate.prompt);
          const leftLeaderLoad = leftLeader ? Number(leaderCounts.get(leftLeader) || 0) : WEEKLY_PROMPTS;
          const rightLeaderLoad = rightLeader ? Number(leaderCounts.get(rightLeader) || 0) : WEEKLY_PROMPTS;
          const leftRelief = excludedTopPlayerId(left.candidate.prompt);
          const rightRelief = excludedTopPlayerId(right.candidate.prompt);
          const leftReliefLoad = leftRelief ? Number(leaderCounts.get(leftRelief) || 0) : 0;
          const rightReliefLoad = rightRelief ? Number(leaderCounts.get(rightRelief) || 0) : 0;
          return rightReliefLoad - leftReliefLoad
            || leftLeaderLoad - rightLeaderLoad
            || semantic.weeklyLoad(left.candidate.prompt, semanticCounts) - semantic.weeklyLoad(right.candidate.prompt, semanticCounts)
            || String(left.candidate.record?.id || "").localeCompare(String(right.candidate.record?.id || ""));
        });

      if (options.length < remaining) return null;
      for (const option of options) {
        nodes += 1;
        if (nodes > nodeLimit) {
          exhausted = true;
          return null;
        }
        const candidate = option.candidate;
        const sourceId = String(candidate.record?.id || "");
        const nextSourceIds = new Set(sourceIds);
        nextSourceIds.add(sourceId);
        const nextLeaderCounts = new Map(leaderCounts);
        const leader = promptTopAnswerKey(candidate.prompt);
        if (leader) nextLeaderCounts.set(leader, Number(nextLeaderCounts.get(leader) || 0) + 1);
        const nextSemanticCounts = new Map(semanticCounts);
        semantic.commitWeekly(candidate.prompt, nextSemanticCounts);
        selectedEntries.push({ groupKey: group.groupKey, candidate });
        const result = chooseWithinGroup(
          group,
          groupIndex,
          option.index + 1,
          remaining - 1,
          nextSourceIds,
          nextLeaderCounts,
          nextSemanticCounts
        );
        if (result) return result;
        selectedEntries.pop();
      }
      return null;
    }

    const entries = searchGroup(0, new Set(), new Map(), new Map());
    return { entries, nodes, bestDepth, exhausted, swaps: 0 };
  }

'''
s = replace_once(s, anchor, helper + anchor, 'bounded search helper')

pattern = re.compile(r'''      const repairedSelection = repairLeaderCap\(selectedEntries, selectionGroups, semantic\);\n      if \(!repairedSelection\) continue;\n      const leaderRepairSwaps = repairedSelection\.swaps;\n      if \(leaderRepairSwaps\) \{\n        prompts\.splice\(0, prompts\.length, \.\.\.repairedSelection\.entries\.map\(entry => entry\.candidate\.prompt\)\);\n        sourceIds\.clear\(\);\n        for \(const entry of repairedSelection\.entries\) sourceIds\.add\(String\(entry\.candidate\.record\.id \|\| ""\)\);\n      \}\n''')
match = pattern.search(s)
if not match:
    raise SystemExit('post-repair block anchor not found')
replacement = '''      let resolvedSelection = repairLeaderCap(selectedEntries, selectionGroups, semantic);\n      let leaderSearchNodes = 0;\n      let leaderSearchBestDepth = 0;\n      if (!resolvedSelection) {\n        setStatus(`Greedy reservoir needs alternate choices · bounded leader search · ${Number(targets["exclude-top-result"] || 0)} Exclude Top Result prompts · layout ${anyOffset + 1}/${POSITION_ORDER.length}…`, "working");\n        await new Promise(resolve => setTimeout(resolve, 0));\n        const searchedSelection = searchLeaderCappedSelection(selectionGroups, semantic);\n        leaderSearchNodes = Number(searchedSelection?.nodes || 0);\n        leaderSearchBestDepth = Number(searchedSelection?.bestDepth || 0);\n        if (!searchedSelection?.entries) continue;\n        resolvedSelection = searchedSelection;\n      }\n      const leaderRepairSwaps = Number(resolvedSelection.swaps || 0);\n      prompts.splice(0, prompts.length, ...resolvedSelection.entries.map(entry => entry.candidate.prompt));\n      sourceIds.clear();\n      for (const entry of resolvedSelection.entries) sourceIds.add(String(entry.candidate.record.id || ""));\n'''
s = s[:match.start()] + replacement + s[match.end():]

s = replace_once(
    s,
    '        leaderRepairSwaps,\n        antiMetaCount,',
    '        leaderRepairSwaps,\n        leaderSearchNodes,\n        leaderSearchBestDepth,\n        antiMetaCount,',
    'bounded search plan metadata'
)
s = replace_once(
    s,
    'while preserving formation, semantic and max-three leader constraints, even after increasing Exclude Top Result relief from ${EXCLUDE_TOP_RESULT_WEEKLY_MIN} to ${EXCLUDE_TOP_RESULT_WEEKLY_MAX} prompts.',
    'while preserving formation, semantic and max-three leader constraints, even after increasing Exclude Top Result relief from ${EXCLUDE_TOP_RESULT_WEEKLY_MIN} to ${EXCLUDE_TOP_RESULT_WEEKLY_MAX} prompts and running bounded alternate-choice search.',
    'final failure wording'
)
p.write_text(s)

for path in ['scripts/verify-weekly-certified-snapshot-race.mjs', 'scripts/verify-all-season-certification-gate.mjs']:
    q = Path(path)
    t = q.read_text().replace('saved-library generation guard v2.6.4', 'saved-library generation guard v2.6.5')
    q.write_text(t)

q = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
t = q.read_text()
needle = "assert(guard.includes('function repairLeaderCap(selectedEntries, selectionGroups, semantic)'), 'Reservoir does not repair leader overload inside fixed family/position groups.');"
addition = needle + "\nassert(guard.includes('function searchLeaderCappedSelection(selectionGroups, semantic, nodeLimit = 8000)'), 'Reservoir does not have a bounded backtracking fallback after local repair fails.');\nassert(guard.includes('leaderSearchNodes'), 'Reservoir plan does not expose bounded leader-search work.');\nassert(guard.includes('bounded alternate-choice search'), 'Final generation failure does not distinguish exhaustion of the bounded alternate-choice search.');"
t = replace_once(t, needle, addition, 'bounded search verifier assertions')
q.write_text(t)

manifest_path = Path('config/asset-manifest.json')
manifest = json.loads(manifest_path.read_text())
manifest['assets']['assetManifestRuntime']['version'] = '4.0.7-bounded-reservoir-search'
manifest['assets']['adminDailyGeneratorGuard']['version'] = '2.6.5-bounded-reservoir-search'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

q = Path('scripts/verify-prompt-studio-clean-reset.mjs')
t = q.read_text().replace('4.0.6-leader-repair', '4.0.7-bounded-reservoir-search')
q.write_text(t)
