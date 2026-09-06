from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)

# Guard: make the certified reservoir the complete cross-week prompt-history authority.
guard_path = Path('js/admin-daily-generator-guard.js')
guard = guard_path.read_text()
guard = replace_once(guard, 'saved-library generation guard v2.2.0.', 'saved-library generation guard v2.3.0.', 'guard header')
guard = replace_once(guard, 'const VERSION = "2.2.0";', 'const VERSION = "2.3.0";', 'guard runtime version')

old_used = '''  function knownUsedSourceIds() {\n    const used = new Set();\n    const addIds = values => {\n      for (const value of values || []) {\n        const id = sourceIdFromPromptId(value);\n        if (id) used.add(id);\n      }\n    };\n    for (const entry of window.FPL_CHALLENGE_MANIFEST?.challenges || []) addIds(entry?.promptIds);\n    for (const entry of window.FPL_STUDIO_PHASE3?.getHistory?.() || []) addIds(entry?.promptIds);\n    return used;\n  }\n'''
new_used = '''  function knownUsedSourceIds() {\n    const used = new Set();\n    const addIds = values => {\n      for (const value of values || []) {\n        const id = sourceIdFromPromptId(value);\n        if (id) used.add(id);\n      }\n    };\n    for (const entry of window.FPL_CHALLENGE_MANIFEST?.challenges || []) addIds(entry?.promptIds);\n    for (const row of window.FPL_STUDIO_SCHEDULE?.scheduled || []) {\n      const stored = row?.manifest_entry && typeof row.manifest_entry === "object" ? row.manifest_entry : {};\n      addIds(stored.promptIds);\n    }\n    for (const entry of window.FPL_STUDIO_PHASE3?.getHistory?.() || []) addIds(entry?.promptIds);\n    return used;\n  }\n\n  function knownRecentSourceIds(days = 7) {\n    const recent = new Set();\n    const start = String(startDateInput?.value || "");\n    if (!isIsoDate(start)) return recent;\n    const cutoff = addDaysIso(start, -Math.max(1, Number(days) || 7));\n    const addEntry = (dateValue, values) => {\n      const date = String(dateValue || "");\n      if (!isIsoDate(date) || date >= start || date < cutoff) return;\n      for (const value of values || []) {\n        const id = sourceIdFromPromptId(value);\n        if (id) recent.add(id);\n      }\n    };\n    for (const entry of window.FPL_CHALLENGE_MANIFEST?.challenges || []) addEntry(entry?.date, entry?.promptIds);\n    for (const row of window.FPL_STUDIO_SCHEDULE?.scheduled || []) {\n      const stored = row?.manifest_entry && typeof row.manifest_entry === "object" ? row.manifest_entry : {};\n      addEntry(row?.release_date, stored.promptIds);\n    }\n    for (const entry of window.FPL_STUDIO_PHASE3?.getHistory?.() || []) addEntry(entry?.releaseDate, entry?.promptIds);\n    return recent;\n  }\n'''
guard = replace_once(guard, old_used, new_used, 'authoritative used/recent source history')

old_order = '''  function recordOrder(records, usedIds) {\n    const unused = [];\n    const used = [];\n    for (const record of records || []) {\n      (usedIds.has(String(record?.id || "")) ? used : unused).push(record);\n    }\n    return [...interleaveSemanticGroups(unused), ...interleaveSemanticGroups(used)];\n  }\n'''
new_order = '''  function recordOrder(records, usedIds, recentIds = new Set()) {\n    const unused = [];\n    const recycled = [];\n    const recent = [];\n    for (const record of records || []) {\n      const id = String(record?.id || "");\n      if (!usedIds.has(id)) unused.push(record);\n      else if (recentIds.has(id)) recent.push(record);\n      else recycled.push(record);\n    }\n    return [\n      ...interleaveSemanticGroups(unused),\n      ...interleaveSemanticGroups(recycled),\n      ...interleaveSemanticGroups(recent)\n    ];\n  }\n'''
guard = replace_once(guard, old_order, new_order, 'unused/recycled/recent ordering')

guard = replace_once(
    guard,
    '    const usedIds = knownUsedSourceIds();\n    const limits = answerLimits();',
    '    const usedIds = knownUsedSourceIds();\n    const recentIds = knownRecentSourceIds(7);\n    const limits = answerLimits();',
    'recent history snapshot',
)
guard = replace_once(
    guard,
    '        const raw = recordOrder(Array.isArray(shard?.records) ? shard.records : [], usedIds);',
    '        const raw = recordOrder(Array.isArray(shard?.records) ? shard.records : [], usedIds, recentIds);',
    'recent-aware record order call',
)
guard = replace_once(
    guard,
    '        knownUsedSourceIds: usedIds.size,\n        runtimeCandidatesChecked: scanned,',
    '        knownUsedSourceIds: usedIds.size,\n        recentSourceIds: recentIds.size,\n        runtimeCandidatesChecked: scanned,',
    'plan recent history metadata',
)
guard_path.write_text(guard)

# Batch: once a certified snapshot exists, do not apply a second hard exact-prompt freshness block.
batch_path = Path('js/admin-batch-calendar.js')
batch = batch_path.read_text()
old_block = '''    const extraBlockedIds = settings.avoidRecent\n      ? new Set(window.FPL_STUDIO_PHASE3?.getCooldownPromptIds?.() || [])\n      : new Set();\n    if (settings.avoidRecent) {\n      const livePromptIds = await loadLivePromptIds();\n      livePromptIds.forEach(id => extraBlockedIds.add(id));\n    }\n'''
new_block = '''    // Guarded generation already chose the immutable weekly reservoir using authoritative\n    // Supabase/GitHub/browser history, with the most recent source IDs ordered last. Do not\n    // hard-block a prompt after certification, or the 77-prompt reservoir can become impossible\n    // to consume. Legacy unguarded generation keeps the older browser/live freshness block.\n    const extraBlockedIds = generationSnapshot\n      ? new Set()\n      : settings.avoidRecent\n        ? new Set(window.FPL_STUDIO_PHASE3?.getCooldownPromptIds?.() || [])\n        : new Set();\n    if (settings.avoidRecent && !generationSnapshot) {\n      const livePromptIds = await loadLivePromptIds();\n      livePromptIds.forEach(id => extraBlockedIds.add(id));\n    }\n'''
batch = replace_once(batch, old_block, new_block, 'guarded freshness ownership')
batch_path.write_text(batch)

# Cache/version wiring.
config_path = Path('config/asset-manifest.json')
config = config_path.read_text()
config = replace_once(
    config,
    '"adminDailyGeneratorGuard": { "path": "js/admin-daily-generator-guard.js", "version": "2.2.0-date-identity" }',
    '"adminDailyGeneratorGuard": { "path": "js/admin-daily-generator-guard.js", "version": "2.3.0-reservoir-authority" }',
    'guard asset version',
)
config_path.write_text(config)

# Regression boundaries.
weekly_path = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
weekly = weekly_path.read_text()
weekly = weekly.replace('saved-library generation guard v2.2.0', 'saved-library generation guard v2.3.0')
weekly_anchor = "assert(!batch.includes('Regenerate from a later rotation point rather than relaxing the nationality quota.'), 'Generator still recommends moving the fixed schedule date to escape a rotation conflict.');\n"
weekly_add = '''assert(guard.includes('window.FPL_STUDIO_SCHEDULE?.scheduled || []'), 'Weekly reservoir does not consume authoritative Supabase prompt history.');\nassert(guard.includes('row?.manifest_entry'), 'Weekly reservoir does not read stored Supabase manifest prompt IDs.');\nassert(guard.includes('function knownRecentSourceIds(days = 7)'), 'Weekly reservoir does not isolate the most recent seven days for late reuse.');\nassert(guard.includes('...interleaveSemanticGroups(recycled)'), 'Weekly reservoir does not prefer older recycled prompts before recent ones.');\nassert(batch.includes('settings.avoidRecent && !generationSnapshot'), 'Guarded batch still applies a second hard browser freshness block after reservoir certification.');\n'''
if weekly_add not in weekly:
    weekly = replace_once(weekly, weekly_anchor, weekly_anchor + weekly_add, 'reservoir authority assertions')
weekly_path.write_text(weekly)

clean_path = Path('scripts/verify-prompt-studio-clean-reset.mjs')
clean = clean_path.read_text()
clean = clean.replace("manifest.assets?.adminDailyGeneratorGuard?.version === '2.2.0-date-identity'", "manifest.assets?.adminDailyGeneratorGuard?.version === '2.3.0-reservoir-authority'")
clean = clean.replace('saved-library generation guard v2.2.0', 'saved-library generation guard v2.3.0')
clean_path.write_text(clean)

all_season_path = Path('scripts/verify-all-season-certification-gate.mjs')
all_season = all_season_path.read_text().replace('saved-library generation guard v2.2.0', 'saved-library generation guard v2.3.0')
all_season_path.write_text(all_season)

print('Applied weekly reservoir authority v2.')
