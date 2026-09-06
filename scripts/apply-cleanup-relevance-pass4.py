from pathlib import Path
import json
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def require(condition, message):
    if not condition:
        raise RuntimeError(message)

# ---------------------------------------------------------------------------
# 1. Simplify Phase 3: preserve automatic history/cooldown state, remove its
#    retired hidden UI and manual history controls.
# ---------------------------------------------------------------------------
core_path = Path('js/admin-core.js')
core = core_path.read_text(encoding='utf-8')
start_marker = '/* ===== BEGIN admin-phase3.js ===== */'
end_marker = '/* ===== END admin-phase3.js ===== */'
start = core.index(start_marker)
end = core.index(end_marker, start) + len(end_marker)
phase = core[start:end]

phase, count = re.subn(
    r'\n  const BASELINE_CHALLENGE = \{.*?\n  \};\n\n  const core',
    '\n\n  const core',
    phase,
    count=1,
    flags=re.S,
)
require(count == 1, 'Phase 3 baseline challenge block was not found exactly once.')

for line in [
    '    cooldownSummary: document.querySelector("#cooldownSummary"),\n',
    '    recordHistoryBtn: document.querySelector("#recordHistoryBtn"),\n',
    '    downloadHistoryBtn: document.querySelector("#downloadHistoryBtn"),\n',
    '    downloadHistoryMarkdownBtn: document.querySelector("#downloadHistoryMarkdownBtn"),\n',
    '    historyActionStatus: document.querySelector("#historyActionStatus"),\n',
    '    historyList: document.querySelector("#historyList")\n',
]:
    phase = phase.replace(line, '')
# The removed final historyList property leaves the preceding testOutcome property valid.
phase = phase.replace('    testOutcome: document.querySelector("#testOutcome"),\n  };', '    testOutcome: document.querySelector("#testOutcome")\n  };')

phase = phase.replace('  migrateLegacyHistory();\n', '')
phase = phase.replace(
    '  function initialise() {\n    bindEvents();\n    renderHistory();\n    syncDraftAvailability();\n    updateCooldownSummary();\n    startTimerLoop();\n  }',
    '  function initialise() {\n    bindEvents();\n    updateHistoryStatus();\n    syncDraftAvailability();\n    startTimerLoop();\n  }'
)

for line in [
    '    elements.recordHistoryBtn.addEventListener("click", recordCurrentChallenge);\n',
    '    elements.downloadHistoryBtn.addEventListener("click", downloadHistoryBackup);\n',
    '    elements.downloadHistoryMarkdownBtn.addEventListener("click", downloadHistoryMarkdown);\n',
    '      updateCooldownSummary();\n',
    '    updateRecordButton();\n',
]:
    phase = phase.replace(line, '')

phase = phase.replace(
    '      ? "Automatic checks passed. You can record this challenge in history, or manually play through it as an extra check."',
    '      ? "Automatic checks passed. You can manually play through it as an extra check."'
)

phase, count = re.subn(
    r'\n  function migrateLegacyHistory\(\) \{.*?\n  \}\n\n  function saveHistory',
    '\n  function saveHistory',
    phase,
    count=1,
    flags=re.S,
)
require(count == 1, 'Phase 3 legacy history migration block was not found exactly once.')

replacement = '''  function updateHistoryStatus() {
    const count = sortedHistory().length;
    if (elements.historyStatus) {
      elements.historyStatus.textContent = `${count} challenge${count === 1 ? "" : "s"} recorded`;
    }
  }

  function recordBatchChallenges'''
phase, count = re.subn(
    r'  function updateCooldownSummary\(\) \{.*?  function recordBatchChallenges',
    replacement,
    phase,
    count=1,
    flags=re.S,
)
require(count == 1, 'Phase 3 hidden history UI/action block was not found exactly once.')

old_tail = '''    if (!recorded) return;
    saveHistory();
    renderHistory();
    core?.refreshDraft?.();
    elements.historyActionStatus.textContent = `${recorded} batch challenge${recorded === 1 ? "" : "s"} saved to Challenge History with all prompts.`;
  }'''
new_tail = '''    if (!recorded) return;
    saveHistory();
    updateHistoryStatus();
    core?.refreshDraft?.();
  }'''
require(old_tail in phase, 'Phase 3 batch-history tail marker was not found.')
phase = phase.replace(old_tail, new_tail, 1)

phase, count = re.subn(
    r'\n  function renderHistory\(\) \{.*?\n  function normalise\(value\)',
    '\n  function normalise(value)',
    phase,
    count=1,
    flags=re.S,
)
require(count == 1, 'Phase 3 retired history renderer/download block was not found exactly once.')

for retired in [
    'cooldownSummary', 'recordHistoryBtn', 'downloadHistoryBtn',
    'downloadHistoryMarkdownBtn', 'historyActionStatus', 'historyList',
    'renderHistory', 'recordCurrentChallenge', 'updateRecordButton', 'BASELINE_CHALLENGE'
]:
    require(retired not in phase, f'Phase 3 still contains retired history residue: {retired}')
for required in ['getCooldownPromptIds', 'getHistory:', 'recordBatchChallenges', 'updateHistoryStatus']:
    require(required in phase, f'Phase 3 lost required history/cooldown API: {required}')

core = core[:start] + phase + core[end:]
core_path.write_text(core, encoding='utf-8')

# ---------------------------------------------------------------------------
# 2. Remove the hidden compatibility DOM from the canonical Daily workspace.
# ---------------------------------------------------------------------------
fragment_path = Path('fragments/admin-daily-workspace.html')
fragment = fragment_path.read_text(encoding='utf-8')
fragment, count = re.subn(
    r'\n\s*<!-- Legacy history controls remain hidden only so the existing controller can keep\n\s*recording rotation data until that controller is simplified in the cutover pass\. -->\n\s*<div id="dailyHistoryCompatibility" hidden aria-hidden="true">.*?</div>\s*$',
    '\n',
    fragment,
    count=1,
    flags=re.S,
)
require(count == 1, 'Daily hidden history compatibility mount was not found exactly once.')
fragment_path.write_text(fragment.rstrip() + '\n', encoding='utf-8')

# Build script: hidden mount is no longer required; explicitly reject its return.
builder_path = Path('scripts/build-native-daily-workspace.mjs')
builder = builder_path.read_text(encoding='utf-8')
builder = builder.replace(
    "    'id=\"codePanel\"',\n    'id=\"dailyHistoryCompatibility\" hidden'",
    "    'id=\"codePanel\"'"
)
old = '''  if (block.includes('id="historyPanel"')) {
    throw new Error('Retired visible Challenge history and cooldown panel was reintroduced into the Daily workspace.');
  }'''
new = '''  if (block.includes('id="historyPanel"')) {
    throw new Error('Retired visible Challenge history and cooldown panel was reintroduced into the Daily workspace.');
  }
  if (block.includes('id="dailyHistoryCompatibility"')) {
    throw new Error('Retired hidden Daily history compatibility mount was reintroduced.');
  }'''
require(old in builder, 'Daily builder history-panel guard marker was not found.')
builder = builder.replace(old, new, 1)
builder_path.write_text(builder, encoding='utf-8')

# Verifier: prove the hidden controls are absent while Phase 3 automatic history survives.
verifier_path = Path('scripts/verify-native-daily-workspace.mjs')
verifier = verifier_path.read_text(encoding='utf-8')
verifier = verifier.replace(
    "const stageOne = read('js/admin-stage-one.js');\n",
    "const stageOne = read('js/admin-stage-one.js');\nconst adminCore = read('js/admin-core.js');\n"
)
old_checks = '''assert(fragment.includes('id="dailyHistoryCompatibility" hidden'), 'Hidden history compatibility controls are missing while the legacy controller still records rotation data.');
assert(challengeWorkspace.includes('id="dailyHistoryCompatibility" hidden'), 'Generated Daily workspace is missing the hidden history compatibility controls.');
for (const id of ['cooldownSummary', 'recordHistoryBtn', 'downloadHistoryBtn', 'downloadHistoryMarkdownBtn', 'historyActionStatus', 'historyList']) {
  assert(fragment.includes(`id="${id}"`), `Hidden compatibility control ${id} is missing from the canonical Daily fragment.`);
}
'''
new_checks = '''assert(!fragment.includes('id="dailyHistoryCompatibility"'), 'Retired hidden Daily history compatibility mount remains in the canonical fragment.');
assert(!challengeWorkspace.includes('id="dailyHistoryCompatibility"'), 'Retired hidden Daily history compatibility mount remains in admin.html.');
for (const id of ['cooldownSummary', 'recordHistoryBtn', 'downloadHistoryBtn', 'downloadHistoryMarkdownBtn', 'historyActionStatus', 'historyList']) {
  assert(!fragment.includes(`id="${id}"`), `Retired hidden compatibility control ${id} remains in the canonical Daily fragment.`);
  assert(!challengeWorkspace.includes(`id="${id}"`), `Retired hidden compatibility control ${id} remains in admin.html.`);
  assert(!adminCore.includes(id), `Retired hidden compatibility control ${id} is still referenced by admin-core.js.`);
}
assert(adminCore.includes('getCooldownPromptIds'), 'Automatic browser history no longer exposes cooldown prompt IDs.');
assert(adminCore.includes('recordBatchChallenges'), 'Automatic seven-day history recording was removed unexpectedly.');
assert(adminCore.includes('getHistory:'), 'Automatic history snapshot API was removed unexpectedly.');
'''
require(old_checks in verifier, 'Native Daily verifier hidden compatibility assertion block was not found.')
verifier = verifier.replace(old_checks, new_checks, 1)
verifier = verifier.replace('  hiddenHistoryCompatibility: true,', '  hiddenHistoryCompatibilityRetired: true,')
verifier_path.write_text(verifier, encoding='utf-8')

# ---------------------------------------------------------------------------
# 3. Delete the disconnected runtime branch and its obsolete migration wiring.
# ---------------------------------------------------------------------------
for path in [
    'js/prompt-studio-loader.js',
    'js/career-overlap-wording.js',
    'js/admin-studio-finish.js',
    'scripts/apply-career-evolution-cache-wiring.mjs',
    'scripts/verify-career-evolution-cache-wiring.mjs',
    'scripts/apply-prompt-target-survivor-generator.mjs',
    'scripts/verify-prompt-target-survivor-generator.mjs',
    'scripts/apply-unified-prompt-family-generator.mjs',
    'scripts/verify-unified-prompt-family-generator.mjs',
    'scripts/apply-approved-null-cert-policy.mjs',
    'scripts/apply-repository-certified-pool-isolation.mjs',
    'scripts/apply-all-season-certification-gate.mjs',
]:
    p = Path(path)
    if p.exists():
        p.unlink()

# Manifest: remove only the proven-disconnected runtime owners.
manifest_path = Path('config/asset-manifest.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['manifestVersion'] = '3.2.0-runtime-prune'
manifest['assets']['assetManifestRuntime']['version'] = '3.2.0-runtime-prune'
for key in ['promptStudioLoader', 'adminStudioFinish', 'careerOverlapWording']:
    manifest['assets'].pop(key, None)
manifest_path.write_text(json.dumps(manifest, separators=(',', ': '), indent=None).replace('{"manifestVersion"', '{\n  "manifestVersion"', 1).replace(', "assets": {', ',\n  "assets": {', 1) + '\n', encoding='utf-8')
# Restore the repository's compact one-entry-per-line manifest format.
manifest_path.write_text(
    '{\n  "manifestVersion": ' + json.dumps(manifest['manifestVersion']) + ',\n  "assets": {\n' +
    ',\n'.join(f'    {json.dumps(k)}: ' + json.dumps(v, separators=(",", ": ")) for k, v in manifest['assets'].items()) +
    '\n  }\n}\n',
    encoding='utf-8'
)

# ---------------------------------------------------------------------------
# 4. Historical/refinement checks must validate their own artifacts directly,
#    not keep the retired loader alive just to prove wiring.
# ---------------------------------------------------------------------------
historical_path = Path('scripts/check-historical-safe-prompt-pack.mjs')
historical = historical_path.read_text(encoding='utf-8')
historical = historical.replace("const loaderPath = 'js/career-overlap-wording.js';\n", '')
historical = historical.replace('for (const path of [packPath, eraPath, nationalityContextPath, readinessPath, panelPath, manifestPath, unlockAuditPath, loaderPath]) {', 'for (const path of [packPath, eraPath, nationalityContextPath, readinessPath, panelPath, manifestPath, unlockAuditPath]) {')
historical = historical.replace("const loader = fs.readFileSync(loaderPath, 'utf8');\n", '')
for assertion in [
    "if (!loader.includes('prompt-historical-safe-pack-v1.js')) throw new Error('Historical-safe pack is not wired into Prompt Studio loader.');\n",
    "if (!loader.includes('prompt-historical-era-pack-v1.js')) throw new Error('Historical era pack is not wired into Prompt Studio loader.');\n",
    "if (!loader.includes('prompt-field-readiness.js')) throw new Error('Field-readiness mapper is not wired into Prompt Studio loader.');\n",
]:
    historical = historical.replace(assertion, '')
historical_path.write_text(historical, encoding='utf-8')

hist_workflow_path = Path('.github/workflows/historical-safe-prompts.yml')
hist_workflow = hist_workflow_path.read_text(encoding='utf-8')
hist_workflow = hist_workflow.replace("      - 'js/career-overlap-wording.js'\n", '')
hist_workflow = hist_workflow.replace('          node --check js/career-overlap-wording.js\n', '')
hist_workflow_path.write_text(hist_workflow, encoding='utf-8')

# Refinement survivor materialiser: stop patching a runtime loader that no longer exists.
promote_path = Path('scripts/promote-refinement-survivors.mjs')
promote = promote_path.read_text(encoding='utf-8')
promote, count = re.subn(
    r"\n\{\n  const path = 'js/career-overlap-wording\.js';.*?\n\}\n\n\{\n  const path = 'js/prompt-quality-baseline-finalizer\.js';",
    "\n{\n  const path = 'js/prompt-quality-baseline-finalizer.js';",
    promote,
    count=1,
    flags=re.S,
)
require(count == 1, 'Refinement survivor career-overlap patch block was not found exactly once.')
promote = re.sub(r"\n  source = source\.replace\('\"careerOverlapWording\"[^\n]+\n", '\n', promote)
promote_path.write_text(promote, encoding='utf-8')

# ---------------------------------------------------------------------------
# 5. Clean architecture verifier + regression assertions.
# ---------------------------------------------------------------------------
clean_path = Path('scripts/verify-prompt-studio-clean-reset.mjs')
clean = clean_path.read_text(encoding='utf-8')
clean = clean.replace("'3.1.0-studio-prune'", "'3.2.0-runtime-prune'")
old_keys = "['adminImportTools','studioFeatureLoader','promptStudioRedesign','promptFamilyRegistryV3','promptStudioV3','promptStudioV3RuleTester','promptStudioV3QualityAdvisor','promptStudioV3CandidateGenerator','promptStudioV3AutoBatchGenerator','promptStudioV3CandidateCertification','promptStudioV4Simple']"
new_keys = "['adminImportTools','studioFeatureLoader','promptStudioRedesign','promptFamilyRegistryV3','promptStudioV3','promptStudioV3RuleTester','promptStudioV3QualityAdvisor','promptStudioV3CandidateGenerator','promptStudioV3AutoBatchGenerator','promptStudioV3CandidateCertification','promptStudioV4Simple','promptStudioLoader','adminStudioFinish','careerOverlapWording']"
require(old_keys in clean, 'Clean-reset retired-key list marker was not found.')
clean = clean.replace(old_keys, new_keys, 1)
clean += '''\nfor (const retiredFile of ['js/prompt-studio-loader.js','js/admin-studio-finish.js','js/career-overlap-wording.js']) {\n  assert(!fs.existsSync(retiredFile), `Retired Studio runtime file still exists: ${retiredFile}`);\n}\n'''
clean_path.write_text(clean, encoding='utf-8')

regression_path = Path('.github/workflows/studio-regression.yml')
regression = regression_path.read_text(encoding='utf-8')
needle = '''            js/prompt-studio-v4-simple.js \\
            scripts/verify-prompt-studio-v3.mjs \\
'''
replacement = '''            js/prompt-studio-v4-simple.js \\
            js/prompt-studio-loader.js \\
            js/admin-studio-finish.js \\
            js/career-overlap-wording.js \\
            scripts/verify-prompt-studio-v3.mjs \\
'''
require(needle in regression, 'Studio regression retired-file list marker was not found.')
regression = regression.replace(needle, replacement, 1)
regression = regression.replace("          ! grep -q '\"promptStudioV4Simple\"' config/asset-manifest.json\n", "          ! grep -q '\"promptStudioV4Simple\"' config/asset-manifest.json\n          ! grep -q '\"promptStudioLoader\"' config/asset-manifest.json\n          ! grep -q '\"adminStudioFinish\"' config/asset-manifest.json\n          ! grep -q '\"careerOverlapWording\"' config/asset-manifest.json\n          ! grep -q 'id=\"dailyHistoryCompatibility\"' admin.html\n          ! grep -q 'id=\"recordHistoryBtn\"' admin.html\n")
regression_path.write_text(regression, encoding='utf-8')

# ---------------------------------------------------------------------------
# 6. Replace the stale V2/V3/851 architecture narrative with the real current
#    architecture after the clean reset.
# ---------------------------------------------------------------------------
architecture = '''# FPL Draft Challenge — Architecture Map

Updated: 6 September 2026

This map records the current runtime ownership after the Prompt Studio clean reset and the Studio relevance cleanup. Historical migration scripts are not runtime architecture.

## 1. Runtime boundaries

The repository has five active areas:

1. **Live game** — public Daily Challenge, answers, scoring, results and leaderboard.
2. **Challenge Studio** — admin generation, prompt management, validation, database audit and publishing.
3. **Clean Prompt Studio** — Factory → Quality → Promotion → durable saved family shards.
4. **Weekly engine** — seven-day generation from the saved promoted library.
5. **Historical data** — player-season database, field readiness and validation/certification tooling.

Candidate tools must never silently change production membership. Daily generation consumes only the explicitly saved promoted family-shard snapshot after its generation guard certifies the weekly reservoir.

## 2. Live game

Primary page: `index.html`.

```text
challenge-manifest-bootstrap
→ daily-challenge-loader
→ challenge fallback/archive
→ players-live.js + career-context.js
→ game-engine.js
→ result/visual layers
→ leaderboard/account layers
```

Supabase is the live Daily schedule/source authority. Repository challenge files remain a static fallback path.

## 3. Challenge Studio

Primary page: `admin.html`.

```text
admin.html
→ asset-manifest.js
→ admin-stage-one.js
→ players.js + career-context.js
→ empty prompt-library.js initializer
→ repository-certified-prompt-pool.js (deferred production pool = 0)
→ validation-engine.js
→ admin-core.js
→ Daily batch/guard modules
→ studio-bootstrap.js
```

`studio-bootstrap.js` is the single Prompt Studio bootstrap owner. `admin.html` loads it directly; compatibility bootstraps and alternate Studio owners have been removed.

Native workspaces:

- `workspace-challenge` — Daily Challenge settings, seven-day generation, XI review, Test Mode and download output.
- `workspace-prompts` — clean Prompt Studio.
- `workspace-validation` — Validation Lab.

## 4. Clean Prompt Studio

```text
prompt-studio-clean-reset.js
→ prompt-factory-v1.js
→ prompt-quality-analyser-v1.js
→ prompt-promotion-v1.js
→ prompt-library-shards-v1.js
→ admin-daily-library-cutover-v1.js
```

The canonical repository `prompt-library.js` remains intentionally empty after the clean reset. Promoted Prompt Studio output is stored durably in IndexedDB as family shards. Factory candidates do not become Daily source material until they pass through Quality and Promotion and are saved.

The old V2/V3/V4 Prompt Studio runtimes, compatibility shims, prompt lazy-loader and career-overlap loader chain are retired and physically absent.

## 5. Daily generation

```text
saved promoted 17-family snapshot
→ Daily library cutover validation
→ weekly generation guard
→ immutable 77-prompt reservoir
→ seven dated 11-prompt challenges
→ nationality / semantic / leader-day spacing policies
→ exact unique-player perfect-XI validation
→ review + ZIP
→ explicit Supabase publish
```

Protected invariants:

- 7 days × 11 prompts;
- 77 unique prompt IDs in a successful week;
- exactly one nationality prompt per day;
- all required prompt families represented;
- formation totals remain exact;
- semantic clashes are guarded;
- same top-answer player may lead multiple prompts on one day, but cross-day repeats target a three-day gap;
- two leader appearance days per player is preferred and three is the hard weekly maximum;
- the perfect XI uses unique footballers;
- partial/failed weeks cannot publish as valid packages.

### Browser rotation history

`admin-core.js` Phase 3 keeps a small browser history store only for cooldown/rotation state. Batch generation records completed generated days automatically through `FPL_STUDIO_PHASE3.recordBatchChallenges()` and reads recent prompt IDs through `getCooldownPromptIds()`.

There is no visible or hidden history-management DOM. The retired manual history buttons/cards were compatibility UI and have been removed.

## 6. Publishing and schedule ownership

- Supabase `daily_challenge_schedule` is the live schedule/source authority.
- Challenge identity is the release date: `daily-YYYY-MM-DD`.
- `admin-schedule-manager-v2.js` owns schedule management.
- `admin-daily-publish.js` owns explicit publishing.
- `challenges/manifest.js` is a static fallback file index, not the primary live schedule.

Publishing never occurs merely because a week was generated.

## 7. Certification boundary

Full repository all-season prompt certification remains deliberately deferred after the clean reset. `repository-certified-prompt-pool.js` is pinned to zero production prompts.

`validation-engine.js` still supports an explicit frozen `FPL_VALIDATION_CERTIFICATION_PROMPT_POOL` snapshot so a future certification run can lock one deliberately supplied prompt set without reading mutable browser state mid-run.

Current CI protects this state through `scripts/verify-all-season-certification-gate.mjs`. Daily generation is separate: it uses the saved promoted library only after the 77-prompt weekly reservoir passes structural, runtime and semantic checks.

## 8. Generated wiring

Authoritative asset versions live in `config/asset-manifest.json`.

```text
config/asset-manifest.json
→ scripts/build-asset-manifest-runtime.mjs
→ scripts/build-native-studio-shell.mjs
→ scripts/build-native-daily-workspace.mjs
→ scripts/build-native-prompt-workspace.mjs
→ scripts/build-studio-cache-tags.mjs
→ verification
```

Key verifiers include:

- `scripts/verify-prompt-studio-clean-reset.mjs`
- `scripts/verify-native-daily-workspace.mjs`
- `scripts/verify-native-prompt-workspace.mjs`
- `scripts/verify-native-validation-workspace.mjs`
- `scripts/verify-weekly-certified-snapshot-race.mjs`
- `scripts/verify-all-season-certification-gate.mjs`

## 9. Offline legacy analysis helpers

Some older generation/quality modules remain because diagnostic and refinement scripts still use them directly outside the live Studio runtime, particularly `js/admin-import-tools-base.js` and historical/refinement analysis helpers.

They are **not** Prompt Studio runtime owners. Remove them only after their remaining diagnostics, audits and survivor-growth workflows have been migrated or retired.

## 10. Remaining cleanup order

1. Continue decomposing the large multi-phase `js/admin-core.js` without changing generation/test behaviour.
2. Audit offline legacy quality/generator helpers and their remaining diagnostic callers.
3. Remove manifest entries that are demonstrably offline-only once their callers are settled.
4. Continue the Daily Challenge UI redesign on top of the now-clean runtime architecture.
5. Return to Prompt Factory/Quality/Promotion survivor-library growth.

Update this document when a real runtime authority changes; do not keep historical migration architecture here.
'''
Path('ARCHITECTURE.md').write_text(architecture, encoding='utf-8')

print('Pass 4 controller/runtime cleanup applied.')
