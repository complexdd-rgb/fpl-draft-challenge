from pathlib import Path
import json
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path, old, new, label):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match in {path}, found {count}')
    write(path, text.replace(old, new, 1))

# 1) Central manifest: keep only surviving clean Studio runtime owners.
manifest_path = Path('config/asset-manifest.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['manifestVersion'] = '3.1.0-studio-prune'
manifest['assets']['assetManifestRuntime']['version'] = '3.1.0-studio-prune'
for key in [
    'adminImportTools',
    'studioFeatureLoader',
    'promptStudioRedesign',
    'promptFamilyRegistryV3',
    'promptStudioV3',
    'promptStudioV3RuleTester',
    'promptStudioV3QualityAdvisor',
    'promptStudioV3CandidateGenerator',
    'promptStudioV3AutoBatchGenerator',
    'promptStudioV3CandidateCertification',
    'promptStudioV4Simple',
]:
    manifest['assets'].pop(key, None)
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

# 2) admin.html now loads the single Studio bootstrap directly.
admin = read('admin.html')
pattern = re.compile(r'  <script src="js/admin-import-tools\.js\?v=[^"]+"></script>')
replacement = '  <script data-studio-bootstrap="1" src="js/studio-bootstrap.js?v=2.6.0-schedule-manager"></script>'
admin, count = pattern.subn(replacement, admin, count=1)
if count != 1:
    raise RuntimeError(f'admin direct bootstrap: expected one admin-import-tools tag, found {count}')
write('admin.html', admin)

# 3) Cache-tag builder tracks the real bootstrap rather than a compatibility shim.
replace_once(
    'scripts/build-studio-cache-tags.mjs',
    "  'adminImportTools',\n",
    "  'studioBootstrap',\n",
    'cache tag bootstrap owner',
)

# 4) Clean architecture verifier now proves direct bootstrap ownership and absent retired assets.
verifier = read('scripts/verify-prompt-studio-clean-reset.mjs')
verifier = verifier.replace("const bootstrap = read('js/studio-bootstrap.js');\nconst entrypoint = read('js/admin-import-tools.js');", "const bootstrap = read('js/studio-bootstrap.js');\nconst admin = read('admin.html');")
verifier = verifier.replace("'3.0.6-preplan-fastpath'", "'3.1.0-studio-prune'")
verifier = verifier.replace("assert(manifest.assets?.adminImportTools?.version === '24.6.0-schedule-manager', 'Admin entrypoint cache version does not force the new bootstrap.');\n", "")
old_entry_asserts = """assert(entrypoint.includes('js/studio-bootstrap.js?v=2.6.0-schedule-manager'), 'Admin entrypoint does not force the schedule-manager v2 bootstrap.');\nassert(entrypoint.includes('fallback is disabled by design'), 'Admin entrypoint does not fail closed when the clean bootstrap cannot load.');\nassert(!entrypoint.includes('loadLegacyPromptPath'), 'Admin entrypoint can still resurrect the retired Prompt Studio loader path.');\n"""
new_entry_asserts = """assert(admin.includes('data-studio-bootstrap=\"1\" src=\"js/studio-bootstrap.js?v=2.6.0-schedule-manager\"'), 'admin.html does not load the single Studio bootstrap directly.');\nassert(!admin.includes('js/admin-import-tools.js'), 'admin.html still loads the retired admin-import-tools compatibility shim.');\nfor (const retiredKey of ['adminImportTools','studioFeatureLoader','promptStudioRedesign','promptFamilyRegistryV3','promptStudioV3','promptStudioV3RuleTester','promptStudioV3QualityAdvisor','promptStudioV3CandidateGenerator','promptStudioV3AutoBatchGenerator','promptStudioV3CandidateCertification','promptStudioV4Simple']) {\n  assert(!manifest.assets?.[retiredKey], `Central manifest still exposes retired Studio asset ${retiredKey}.`);\n}\n"""
if old_entry_asserts not in verifier:
    raise RuntimeError('clean verifier entrypoint assertion block not found')
verifier = verifier.replace(old_entry_asserts, new_entry_asserts, 1)
write('scripts/verify-prompt-studio-clean-reset.mjs', verifier)

# 5) Architecture document: describe the architecture that actually survives.
arch = read('ARCHITECTURE.md')
arch = arch.replace('→ admin-import-tools.js compatibility shim\n   → studio-bootstrap.js', '→ studio-bootstrap.js')
arch = arch.replace('Temporary shims:\n\n- `js/admin-import-tools.js`\n- `js/studio-feature-loader.js`\n\nRetire them only when all supported callers have migrated.\n', 'The former `admin-import-tools.js` and `studio-feature-loader.js` compatibility shims have been retired. `admin.html` now loads `js/studio-bootstrap.js` directly.\n')
for line_fragment in [
    '- `js/prompt-studio-v3-clean-room.js`',
    '- `js/prompt-family-registry-v3.js`',
    '- `js/prompt-studio-v3-rule-tester.js`',
    '- `js/prompt-studio-v3-quality-advisor.js`',
    '- `js/prompt-studio-v3-candidate-generator.js`',
    '- `js/prompt-studio-v3-auto-batch-generator.js`',
    '- `js/prompt-studio-v3-candidate-certification.js`',
    '- `js/prompt-studio-v4-simple.js`',
    '- `scripts/verify-prompt-studio-v3.mjs`',
]:
    arch = '\n'.join(line for line in arch.split('\n') if line_fragment not in line)
arch = arch.replace('→ scripts/build-studio-wiring.mjs\n', '→ scripts/build-asset-manifest-runtime.mjs\n→ scripts/build-studio-cache-tags.mjs\n')
arch = re.sub(r'\nThe V3 verifier explicitly proves[^\n]*\n', '\n', arch)
write('ARCHITECTURE.md', arch)

# 6) Retired runtime + their retired builder/verifier files are physically removed.
for path in [
    'js/admin-import-tools.js',
    'js/studio-feature-loader.js',
    'js/prompt-studio-redesign.js',
    'js/prompt-family-registry-v3.js',
    'js/prompt-studio-v3-clean-room.js',
    'js/prompt-studio-v3-rule-tester.js',
    'js/prompt-studio-v3-quality-advisor.js',
    'js/prompt-studio-v3-candidate-generator.js',
    'js/prompt-studio-v3-auto-batch-generator.js',
    'js/prompt-studio-v3-candidate-certification.js',
    'js/prompt-studio-v4-simple.js',
    'scripts/verify-prompt-studio-v3.mjs',
    'scripts/verify-prompt-studio-v4.mjs',
    'scripts/build-studio-wiring.mjs',
    'scripts/verify-studio-wiring.mjs',
]:
    p = Path(path)
    if p.exists():
        p.unlink()

print('Pass 3 Studio prune applied.')
