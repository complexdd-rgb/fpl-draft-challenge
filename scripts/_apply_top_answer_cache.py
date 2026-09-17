from pathlib import Path
import json


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    return text.replace(old, new, 1)

p = Path('js/admin-daily-generator-guard.js')
s = p.read_text()
s = replace_once(s, 'saved-library generation guard v2.6.6.', 'saved-library generation guard v2.6.7.', 'guard header')
s = replace_once(s, 'const VERSION = "2.6.6";', 'const VERSION = "2.6.7";', 'guard version')
s = replace_once(
    s,
    '  let generationRunning = false;\n  let guardChip = null;\n  let lastPlan = null;\n',
    '  let generationRunning = false;\n  let guardChip = null;\n  let lastPlan = null;\n  const promptTopAnswerCache = new WeakMap();\n',
    'top answer cache declaration'
)
s = replace_once(
    s,
    '  function promptTopAnswer(prompt) {\n    return core.getPromptStats(prompt)?.bestAnswer || null;\n  }\n',
    '  function promptTopAnswer(prompt) {\n    if (!prompt || typeof prompt !== "object") return null;\n    if (promptTopAnswerCache.has(prompt)) return promptTopAnswerCache.get(prompt);\n    const best = core.getPromptStats(prompt)?.bestAnswer || null;\n    promptTopAnswerCache.set(prompt, best);\n    return best;\n  }\n',
    'top answer cache function'
)
s = replace_once(s, '.sort((heft, right) => {\n            const leftLeader = promptTopAnswerKey(left.prompt);', '.sort((left, right) => {\n            const leftLeader = promptTopAnswerKey(left.prompt);', 'repair sorter typo')
p.write_text(s)

for path in ['scripts/verify-weekly-certified-snapshot-race.mjs', 'scripts/verify-all-season-certification-gate.mjs']:
    q = Path(path)
    t = q.read_text().replace('saved-library generation guard v2.6.6', 'saved-library generation guard v2.6.7')
    q.write_text(t)

q = Path('scripts/verify-weekly-certified-snapshot-race.mjs')
t = q.read_text()
needle = "assert(guard.includes('function topAnswerDiversityAudit(prompts)'), '77-prompt reservoir does not audit top-answer player uniqueness.');"
addition = needle + "\nassert(guard.includes('const promptTopAnswerCache = new WeakMap();'), 'Top-answer diversity still recalculates prompt stats instead of caching them per prompt.');\nassert(guard.includes('if (promptTopAnswerCache.has(prompt)) return promptTopAnswerCache.get(prompt);'), 'Top-answer cache is declared but not reused.');\nassert(!guard.includes('.sort((heft, right) =>'), 'Leader-repair sorter still contains the broken left-hand callback variable.');"
t = replace_once(t, needle, addition, 'cache verifier assertions')
q.write_text(t)

manifest_path = Path('config/asset-manifest.json')
manifest = json.loads(manifest_path.read_text())
manifest['assets']['assetManifestRuntime']['version'] = '4.0.9-top-answer-cache'
manifest['assets']['adminDailyGeneratorGuard']['version'] = '2.6.7-top-answer-cache'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

q = Path('scripts/verify-prompt-studio-clean-reset.mjs')
t = q.read_text().replace('4.0.8-soft-family-balance', '4.0.9-top-answer-cache')
q.write_text(t)
