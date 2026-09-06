from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    p.write_text(text.replace(old, new, 1))


# 1) career-overlap wording is presentation logic; it must not own the retired schedule manager.
replace_once(
    'js/career-overlap-wording.js',
    '  loadStatus("js/admin-schedule-manager.js?v=1.0.1", "data-admin-schedule-manager");\n',
    '',
    'retired schedule-manager loader',
)

# 2) Prompt Studio compatibility guard should track the centrally owned v2 manager only.
p = Path('.github/workflows/prompt-studio-redesign.yml')
text = p.read_text()
if text.count("js/admin-schedule-manager.js") != 2:
    raise SystemExit('prompt-studio workflow: expected two v1 schedule-manager references')
text = text.replace('js/admin-schedule-manager.js', 'js/admin-schedule-manager-v2.js')
p.write_text(text)

# 3) Preserve the normal Answer diversity check, but make it verification-only.
Path('.github/workflows/answer-diversity.yml').write_text('''name: Answer diversity policy

on:
  pull_request:
    paths:
      - 'js/admin-batch-calendar.js'
      - 'js/admin-daily-generator-guard.js'
      - 'scripts/verify-weekly-top-answer-diversity.mjs'
      - '.github/workflows/answer-diversity.yml'
  push:
    branches: [main]
    paths:
      - 'js/admin-batch-calendar.js'
      - 'js/admin-daily-generator-guard.js'
      - 'scripts/verify-weekly-top-answer-diversity.mjs'
      - '.github/workflows/answer-diversity.yml'

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Verify current answer-diversity policy
        run: |
          node scripts/verify-weekly-top-answer-diversity.mjs
          node --check js/admin-batch-calendar.js
          node --check js/admin-daily-generator-guard.js
          test ! -e scripts/apply-answer-diversity.mjs
          test ! -e scripts/apply-weekly-top-answer-diversity.mjs
          git diff --check
''')

# 4) Extend the existing clean-reset verifier so v1 cannot silently return.
p = Path('scripts/verify-prompt-studio-clean-reset.mjs')
text = p.read_text()
anchor = "const batchCalendar = read('js/admin-batch-calendar.js');\n"
if anchor not in text:
    raise SystemExit('clean-reset verifier: batch calendar anchor missing')
text = text.replace(anchor, anchor + "const careerWording = read('js/career-overlap-wording.js');\n", 1)
anchor2 = "assert(scheduleManager.includes('centrally owned published schedule manager v2.0.0'), 'Schedule manager v2 header/version is missing.');\n"
if anchor2 not in text:
    raise SystemExit('clean-reset verifier: schedule manager assertion anchor missing')
extra = (
    "assert(!fs.existsSync('js/admin-schedule-manager.js'), 'Retired schedule manager v1 still exists in the repository.');\n"
    "assert(!careerWording.includes('admin-schedule-manager.js'), 'Career-overlap wording still loads retired schedule manager v1.');\n"
)
text = text.replace(anchor2, extra + anchor2, 1)
p.write_text(text)

# 5) Delete one-off migration machinery that is already materialised in production.
for path in [
    'js/admin-schedule-manager.js',
    'scripts/apply-answer-diversity.mjs',
    'scripts/apply-weekly-top-answer-diversity.mjs',
    '.github/workflows/weekly-top-answer-diversity.yml',
]:
    p = Path(path)
    if not p.exists():
        raise SystemExit(f'missing expected cleanup target: {path}')
    p.unlink()

print('Pass 1 relevance cleanup applied.')
