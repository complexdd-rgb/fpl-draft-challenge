from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


# 1. Remove the retired Prompt Library Manager phase from admin-core.
core_path = 'js/admin-core.js'
core = read(core_path)
pattern = re.compile(
    r'/\* ===== BEGIN admin-phase5\.js ===== \*/.*?/\* ===== END admin-phase5\.js ===== \*/\n\n',
    re.S,
)
core, count = pattern.subn('', core, count=1)
require(count == 1, 'admin-core Phase 5 block was not found exactly once.')
for retired in [
    'BEGIN admin-phase5.js',
    'END admin-phase5.js',
    'FPL_PROMPT_MANAGER_API',
    'fplChallengeStudioPromptManagerV1',
]:
    require(retired not in core, f'admin-core still contains retired Prompt Manager residue: {retired}')
require('BEGIN admin.js' in core, 'admin-core lost its main admin controller boundary.')
require('BEGIN admin-phase3.js' in core, 'admin-core lost automatic Daily rotation history.')
write(core_path, core)

# 2. Remove a now-stale clean-reset comment about Phase 5 restoring browser prompts.
clean_path = 'js/prompt-studio-clean-reset.js'
clean = read(clean_path)
old_comment = '''    // Hard reset the shared array first. This also clears any browser-local prompts that
    // admin-core may have restored earlier in the same page load.
    library.splice(0, library.length);'''
new_comment = '''    // Hard reset the shared array first so only the clean store can repopulate it.
    library.splice(0, library.length);'''
require(old_comment in clean, 'Clean-reset Phase 5 compatibility comment was not found.')
clean = clean.replace(old_comment, new_comment, 1)
write(clean_path, clean)

# 3. Extend regression coverage so the retired phase cannot silently return.
regression_path = '.github/workflows/studio-regression.yml'
regression = read(regression_path)
marker = "          ! grep -q 'recordHistoryBtn' js/admin-core.js\n"
replacement = marker + (
    "          ! grep -q 'BEGIN admin-phase5.js' js/admin-core.js\n"
    "          ! grep -q 'END admin-phase5.js' js/admin-core.js\n"
    "          ! grep -q 'FPL_PROMPT_MANAGER_API' js/admin-core.js\n"
)
require(marker in regression, 'Studio regression admin-core retirement marker was not found.')
regression = regression.replace(marker, replacement, 1)
write(regression_path, regression)

# 4. Keep the architecture map aligned with the surviving controller boundary.
architecture_path = 'ARCHITECTURE.md'
architecture = read(architecture_path)
old = 'The old V2/V3/V4 Prompt Studio runtimes, compatibility shims, prompt lazy-loader, career-overlap loader chain and V2 canonical-state layer are retired and physically absent. The obsolete V2 native-Prompt builder/verifier pair has also been removed; the clean Prompt Studio controller owns the current prompt workspace at runtime.'
new = old + ' The retired browser Prompt Library Manager phase has also been removed from `admin-core.js`, so it no longer restores or edits the shared prompt array before the clean controller starts.'
require(old in architecture, 'Architecture Prompt Studio retirement paragraph was not found.')
architecture = architecture.replace(old, new, 1)
architecture = architecture.replace(
    '1. Continue decomposing the large multi-phase `js/admin-core.js` without changing generation/test behaviour.',
    '1. Continue auditing the remaining `js/admin-core.js` phases and remove only controllers with no surviving runtime caller.',
    1,
)
write(architecture_path, architecture)
