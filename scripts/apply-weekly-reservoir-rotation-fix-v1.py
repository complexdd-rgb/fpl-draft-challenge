from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)

batch_path = Path('js/admin-batch-calendar.js')
batch = batch_path.read_text()
batch = replace_once(
    batch,
    'Theme & Formation Engine v3.2.0: date-identified seven-day challenge calendar generator.',
    'Theme & Formation Engine v3.3.0: weekly-reservoir-aware date-identified seven-day challenge calendar generator.',
    'batch version',
)
helper_anchor = '  function buildExactRotationState(schedule, beforeDate, basePools, promptById) {\n'
helper = '''  function buildWeeklyReservoirRotationState(basePools) {\n    // The guarded Daily flow has already selected a fresh immutable 77-prompt reservoir for\n    // this week. Cross-week unused/cycle decisions belong to the guard; replaying historical\n    // schedule rows against this new reservoir creates false bridge backlogs. Start the weekly\n    // consumption cycle at zero and let the seven generated days consume every reservoir prompt once.\n    return Object.fromEntries(\n      Object.keys(basePools).map(position => [position, { cycle: 1, usedIds: new Set() }])\n    );\n  }\n\n'''
if helper not in batch:
    batch = replace_once(batch, helper_anchor, helper + helper_anchor, 'weekly reservoir rotation helper')
old_state = '    const rotationState = buildExactRotationState(virtualSchedule, startDate, basePools, promptById);\n'
new_state = '''    const rotationState = generationSnapshot\n      ? buildWeeklyReservoirRotationState(basePools)\n      : buildExactRotationState(virtualSchedule, startDate, basePools, promptById);\n'''
batch = replace_once(batch, old_state, new_state, 'weekly reservoir rotation handoff')
batch = batch.replace(
    'Exact prompt rotation currently forces more than one nationality prompt into the same day. Regenerate from a later rotation point rather than relaxing the nationality quota.',
    'Exact prompt rotation currently forces more than one nationality prompt into the same day. The guarded weekly reservoir must start from a fresh weekly rotation; reload Studio if this persists.'
)
batch_path.write_text(batch)

config_path = Path('config/asset-manifest.json')
config = config_path.read_text()
config = replace_once(config, '"manifestVersion": "3.0.0-date-only-daily"', '"manifestVersion": "3.0.1-nationality-rotation"', 'manifest version')
config = replace_once(config, '"assetManifestRuntime": { "path": "js/asset-manifest.js", "version": "3.0.0-date-only-daily" }', '"assetManifestRuntime": { "path": "js/asset-manifest.js", "version": "3.0.1-nationality-rotation" }', 'runtime manifest version')
config = replace_once(config, '"adminBatchCalendar": { "path": "js/admin-batch-calendar.js", "version": "3.2.0-date-identity" }', '"adminBatchCalendar": { "path": "js/admin-batch-calendar.js", "version": "3.3.0-nationality-rotation" }', 'batch asset version')
config_path.write_text(config)

verify_path = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
verify = verify_path.read_text()
anchor = "assert(!publishEdge.includes('.gte(\"release_date\", today)'), 'Schedule status still hides historical Supabase dates needed for exact rotation history.');\n"
addition = '''assert(batch.includes('function buildWeeklyReservoirRotationState(basePools)'), 'Guarded weekly generation does not have a fresh reservoir rotation state.');\nassert(batch.includes('const rotationState = generationSnapshot'), 'Batch generator does not distinguish guarded reservoir rotation from legacy history replay.');\nassert(batch.includes('? buildWeeklyReservoirRotationState(basePools)'), 'Guarded reservoir still replays old schedule history into its fresh 77-prompt cycle.');\nassert(!batch.includes('Regenerate from a later rotation point rather than relaxing the nationality quota.'), 'Generator still recommends moving the fixed schedule date to escape a rotation conflict.');\n'''
if addition not in verify:
    verify = replace_once(verify, anchor, anchor + addition, 'weekly rotation assertions')
model_anchor = "// Reproduce the final weekly-consumption gate: seven PASS days must consume all 77 snapshot\n"
model = '''// In guarded mode the reservoir has exactly seven days of position capacity. Starting its\n// rotation fresh means every day, including day 7, still has at least one full formation of\n// unused prompts. Therefore the exact planner never enters a bridge cycle and cannot force\n// multiple old-cycle nationality prompts into one day.\nconst dailyFormation = { GK: 1, DEF: 4, MID: 4, FWD: 2 };\nconst weeklyPositionPool = { GK: 7, DEF: 28, MID: 28, FWD: 14 };\nfor (let day = 0; day < 7; day += 1) {\n  for (const position of Object.keys(dailyFormation)) {\n    const unusedBeforeDay = weeklyPositionPool[position] - dailyFormation[position] * day;\n    assert(unusedBeforeDay >= dailyFormation[position], `Fresh weekly rotation bridges too early for ${position} on day ${day + 1}.`);\n  }\n}\n\n'''
if model not in verify:
    verify = replace_once(verify, model_anchor, model + model_anchor, 'fresh weekly rotation model')
verify_path.write_text(verify)

clean_path = Path('scripts/verify-prompt-studio-clean-reset.mjs')
clean = clean_path.read_text()
clean = clean.replace("manifest.manifestVersion === '3.0.0-date-only-daily'", "manifest.manifestVersion === '3.0.1-nationality-rotation'")
clean = clean.replace("manifest.assets?.assetManifestRuntime?.version === '3.0.0-date-only-daily'", "manifest.assets?.assetManifestRuntime?.version === '3.0.1-nationality-rotation'")
clean = clean.replace("manifest.assets?.adminBatchCalendar?.version === '3.2.0-date-identity'", "manifest.assets?.adminBatchCalendar?.version === '3.3.0-nationality-rotation'")
clean = clean.replace("generatedManifest.includes('3.0.0-date-only-daily')", "generatedManifest.includes('3.0.1-nationality-rotation')")
clean_path.write_text(clean)

print('Applied weekly reservoir rotation fix.')
