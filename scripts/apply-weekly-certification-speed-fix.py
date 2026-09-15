from pathlib import Path

p = Path('js/admin-daily-generator-guard.js')
s = p.read_text()
s = s.replace('saved-library generation guard v2.5.0.', 'saved-library generation guard v2.5.2.')
s = s.replace('const VERSION = "2.5.0";', 'const VERSION = "2.5.2";')
s = s.replace('Runtime-certifying the 17-family weekly reservoir', 'Runtime-certifying the 18-family weekly reservoir')
old = '''  async function certifyCandidate(record, position, limits, cutoverApi, cache) {
    const key = `${record.id}|${position}`;
    if (cache.has(key)) return cache.get(key);
    const prompt = cutoverApi.materialiseRecord(record, position);
'''
new = '''  async function certifyCandidate(record, position, limits, cutoverApi, cache) {
    const key = `${record.id}|${position}`;
    if (cache.has(key)) return cache.get(key);

    // Reject candidates that cannot fit the answer window before the expensive
    // runtime stats scan. ANY prompts still get a live count when their stored
    // total is above the maximum because a position-specific slice may fit.
    const stored = Number(record?.qualityEvidence?.answerPlayers || 0);
    const sourcePosition = String(record?.position || "").toUpperCase();
    if (!Number.isFinite(stored) || stored < limits.min || (sourcePosition !== "ANY" && stored > limits.max)) {
      cache.set(key, null);
      return null;
    }

    const prompt = cutoverApi.materialiseRecord(record, position);
'''
if old not in s:
    raise SystemExit('certifyCandidate insertion anchor not found')
s = s.replace(old, new, 1)
old2 = '''    const count = Number(stats?.playerCount || 0);
    const stored = Number(record?.qualityEvidence?.answerPlayers || 0);
    const evidenceConsistent = record.position === "ANY" ? count > 0 && count <= stored : count === stored;
'''
new2 = '''    const count = Number(stats?.playerCount || 0);
    const evidenceConsistent = record.position === "ANY" ? count > 0 && count <= stored : count === stored;
'''
if old2 not in s:
    raise SystemExit('stored evidence anchor not found')
s = s.replace(old2, new2, 1)
p.write_text(s)

for test in ['scripts/verify-all-season-certification-gate.mjs', 'scripts/verify-weekly-certified-snapshot-race.mjs']:
    q = Path(test)
    q.write_text(q.read_text().replace('saved-library generation guard v2.5.0', 'saved-library generation guard v2.5.2'))

q = Path('config/asset-manifest.json')
t = q.read_text()
oldv = '"version": "2.5.1-18-family"'
if oldv not in t:
    raise SystemExit('asset manifest guard version anchor not found')
q.write_text(t.replace(oldv, '"version": "2.5.2-fast-certification"', 1))
