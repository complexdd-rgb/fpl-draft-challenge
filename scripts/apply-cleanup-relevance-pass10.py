from pathlib import Path


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, content):
    Path(path).write_text(content, encoding="utf-8")


# 1. Remove the retired static V2 Prompt Studio shell from admin.html.
admin_path = Path("admin.html")
admin = read(admin_path)
start_marker = "            <!-- STUDIO_NATIVE_PROMPT_WORKSPACE_START -->"
end_marker = "            <!-- STUDIO_NATIVE_PROMPT_WORKSPACE_END -->"
start = admin.find(start_marker)
end = admin.find(end_marker, start + len(start_marker))
if start < 0 or end < 0:
    raise SystemExit("Prompt Studio static shell markers were not found exactly as expected.")
end += len(end_marker)
replacement = "            <!-- Clean Prompt Studio mounts its runtime-owned workspace here. -->"
admin = admin[:start] + replacement + admin[end:]
write(admin_path, admin)

# 2. Tighten the native Daily verifier so the retired Prompt Manager shell cannot return.
verify_path = Path("scripts/verify-native-daily-workspace.mjs")
verify = read(verify_path)
old = '''assert(!challengeWorkspace.includes('id="libraryManagerPanel"'), 'Prompt Library Manager leaked into the Daily workspace.');
if (html.includes('<!-- STUDIO_NATIVE_PROMPT_WORKSPACE_START -->')) {
  assert(promptWorkspace.includes('id="libraryManagerPanel"'), 'Prompt Library Manager is not inside the native Prompt Studio workspace.');
  assert(!legacyMain.includes('id="libraryManagerPanel"'), 'Legacy <main> still contains Prompt Library Manager after native migration.');
}
'''
new = '''assert(!challengeWorkspace.includes('id="libraryManagerPanel"'), 'Prompt Library Manager leaked into the Daily workspace.');
assert(!html.includes('<!-- STUDIO_NATIVE_PROMPT_WORKSPACE_START -->'), 'Retired static Prompt Studio shell marker returned to admin.html.');
assert(!html.includes('id="libraryManagerPanel"'), 'Retired static Prompt Library Manager returned to admin.html.');
assert(!promptWorkspace.includes('promptManagerSearch'), 'Retired Prompt Manager controls returned to the native Prompt workspace shell.');
'''
if old not in verify:
    raise SystemExit("Expected old Prompt shell verifier block was not found.")
verify = verify.replace(old, new, 1)
write(verify_path, verify)

# 3. Guard the clean Prompt Studio boundary directly as well.
clean_verify_path = Path("scripts/verify-prompt-studio-clean-reset.mjs")
clean_verify = read(clean_verify_path)
anchor = "assert(!admin.includes('js/admin-import-tools.js'), 'admin.html still loads the retired admin-import-tools compatibility shim.');\n"
addition = anchor + "assert(!admin.includes('id=\"libraryManagerPanel\"'), 'admin.html still embeds the retired static Prompt Library Manager shell.');\nassert(!admin.includes('STUDIO_NATIVE_PROMPT_WORKSPACE_START'), 'admin.html still embeds the retired static Prompt Studio migration shell.');\n"
if anchor not in clean_verify:
    raise SystemExit("Clean reset verifier insertion point was not found.")
clean_verify = clean_verify.replace(anchor, addition, 1)
write(clean_verify_path, clean_verify)

# 4. Record the completed ownership change in the architecture map.
arch_path = Path("ARCHITECTURE.md")
arch = read(arch_path)
needle = "`studio-bootstrap.js` is the single Prompt Studio bootstrap owner. `admin.html` loads it directly; compatibility bootstraps and alternate Studio owners have been removed.\n"
replacement_arch = needle + "\nThe Prompt workspace shell in `admin.html` is intentionally empty. `prompt-studio-clean-reset.js` owns and renders the current Prompt Studio DOM at runtime; the retired V2 static Prompt Manager markup is no longer shipped.\n"
if needle not in arch:
    raise SystemExit("Architecture insertion point was not found.")
arch = arch.replace(needle, replacement_arch, 1)
write(arch_path, arch)
