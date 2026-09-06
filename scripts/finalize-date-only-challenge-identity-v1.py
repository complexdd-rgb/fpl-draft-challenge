from pathlib import Path
import subprocess


def read(path):
    return Path(path).read_text()


def write(path, value):
    Path(path).write_text(value)


def replace_once(path, before, after):
    source = read(path)
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{path}: expected one marker, found {count}: {before[:120]!r}")
    write(path, source.replace(before, after, 1))


batch = "js/admin-batch-calendar.js"
replace_once(batch,
    "      challengeNumber: Number(result.number) || 0,\n",
    "")
replace_once(batch,
    "      batchManifest = buildMergedManifest(existingEntries, batchResults, settings);",
    "      batchManifest = buildMergedManifest(repositoryManifestEntries(), batchResults, settings);")
replace_once(batch,
    "    const originalEntries = getManifestEntries();",
    "    const originalEntries = repositoryManifestEntries();")
replace_once(batch,
    '      : "/* No repository or Supabase challenge schedule was loaded before this batch was generated. */\\n";',
    '      : "/* No GitHub fallback manifest was loaded before this batch was generated. */\\n";')
replace_once(batch,
    '      "5. Upload challenges/manifest.js LAST. It is date-keyed and is rebuilt from the repository manifest plus the authoritative Supabase schedule, so previously published dates are preserved.",',
    '      "5. Upload challenges/manifest.js LAST. It is a date-keyed GitHub fallback index built from the existing GitHub manifest plus these seven real files; Supabase-only dates are deliberately not given invented GitHub paths.",')
replace_once(batch,
    '      "The manifest tells the live game which dated file to load. Dates are the challenge identity; numeric challenge sequencing is no longer used. Uploading the dated files first prevents a temporary broken challenge while GitHub Pages is publishing.",',
    '      "Supabase is the live schedule authority. manifest.js is only the static GitHub fallback index, so it lists real GitHub challenge files only. Dates are the challenge identity; numeric challenge sequencing is no longer used. Uploading the dated files first prevents a temporary broken fallback while GitHub Pages is publishing.",')

# Replace the first migration's date-only verifier block with the final authority split:
# Supabase history participates in generation, but only real GitHub files enter fallback manifest.js.
weekly_path = "scripts/verify-weekly-certified-snapshot-race.mjs"
weekly = read(weekly_path)
start_marker = "assert(!guard.includes('batchFirstNumber'), 'Date-only guard still depends on the retired first challenge number input.');"
end_marker = "for (const token of [\n  'const CERTIFIED_SNAPSHOT_SOURCE_POLICY_VERSION = 1;'"
start = weekly.find(start_marker)
end = weekly.find(end_marker, start)
if start < 0 or end < 0 or end <= start:
    raise RuntimeError("Could not locate date-only regression block in weekly verifier")
block = """assert(!guard.includes('batchFirstNumber'), 'Date-only guard still depends on the retired first challenge number input.');
assert(!batch.includes('batchFirstNumber'), 'Date-only batch generator still depends on the retired first challenge number input.');
assert(!dailyFragment.includes('batchFirstNumber'), 'Native Daily workspace still renders the retired first challenge number input.');
assert(batch.includes('daily-${date}'), 'Generated challenge id is not canonicalised to its release date.');
assert(!batch.includes('const number = firstNumber + dayIndex;'), 'Batch generator still sequences numeric challenge ids.');
assert(!batch.includes('number: Number(result.number) || 0,'), 'New manifest entries still emit challenge numbers.');
assert(!batch.includes('challengeNumber: Number(result.number) || 0,'), 'Private verifier still emits legacy challenge numbers.');
assert(batch.includes('function serverManifestEntries()'), 'Generation schedule does not merge authoritative Supabase history.');
assert(batch.includes('row?.manifest_entry'), 'Generation schedule does not consume stored Supabase prompt metadata.');
assert(batch.includes('batchManifest = buildMergedManifest(repositoryManifestEntries(), batchResults, settings);'), 'ZIP fallback manifest is not isolated to real GitHub entries plus the new batch.');
assert(batch.includes('const originalEntries = repositoryManifestEntries();'), 'ZIP backup is not isolated to the GitHub fallback manifest.');
assert(publish.includes('challengeNumber: 0, // legacy schema field; releaseDate is the canonical identity'), 'Publishing payload does not pin legacy number metadata to zero.');
assert(publishEdge.includes('challengeNumber < 0'), 'Publishing Edge Function still requires positive challenge numbers.');
assert(publishEdge.includes('manifest_entry, published_at'), 'Schedule status does not expose stored prompt metadata needed for generation history.');
assert(!publishEdge.includes('.gte("release_date", today)'), 'Schedule status still hides historical Supabase dates needed for exact rotation history.');

const addIsoDays = (iso, amount) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
};
const dated = (start, count, source) => Array.from({ length: count }, (_, index) => ({ date: addIsoDays(start, index), source }));
const staleRepo = dated('2026-08-01', 17, 'repo');
const authoritativeServer = dated('2026-08-18', 20, 'server');
const newWeek = dated('2026-09-07', 7, 'batch');

// Generation history must see the full date sequence even when GitHub fallback files were not uploaded.
const scheduleByDate = new Map();
for (const entry of staleRepo) scheduleByDate.set(entry.date, entry);
for (const entry of authoritativeServer) scheduleByDate.set(entry.date, entry);
const scheduleDates = [...scheduleByDate.keys()].sort();
assert(scheduleDates.length === 37, 'Date-keyed generation history lost or duplicated schedule dates.');
assert(scheduleDates[0] === '2026-08-01' && scheduleDates.at(-1) === '2026-09-06', 'Date-keyed generation history has the wrong boundaries.');
for (let index = 1; index < scheduleDates.length; index += 1) {
  assert(scheduleDates[index] === addIsoDays(scheduleDates[index - 1], 1), 'Generation history created a gap before ' + scheduleDates[index] + '.');
}

// GitHub fallback manifest must list only files that actually exist there: old repo entries plus this ZIP's seven files.
const fallbackByDate = new Map(staleRepo.map(entry => [entry.date, entry]));
for (const entry of newWeek) fallbackByDate.set(entry.date, entry);
const fallbackDates = [...fallbackByDate.keys()].sort();
assert(fallbackDates.length === 24, 'GitHub fallback regression lost or duplicated real static challenge files.');
assert(fallbackDates.includes('2026-08-17') && fallbackDates.includes('2026-09-07') && fallbackDates.includes('2026-09-13'), 'GitHub fallback regression lost an expected real file date.');
assert(!fallbackDates.includes('2026-08-18') && !fallbackDates.includes('2026-09-06'), 'GitHub fallback regression invented paths for Supabase-only dates.');

"""
weekly = weekly[:start] + block + weekly[end:]
weekly = weekly.replace(
    "Saved-library generation snapshot verified: immutable 77-prompt reservoir, semantic spread, date-only challenge identity and non-destructive Supabase-backed manifest export are protected.",
    "Saved-library generation snapshot verified: immutable 77-prompt reservoir, semantic spread, date-only identity, full Supabase generation history and real-file-only GitHub fallback export are protected."
)
write(weekly_path, weekly)

# Restore the intentionally compact central manifest from main, then change only the four active versions.
main_manifest = subprocess.check_output(
    ["git", "show", "origin/main:config/asset-manifest.json"], text=True
)
main_manifest = main_manifest.replace("2.9.0-daily-semantic-diversity", "3.0.0-date-only-daily")
main_manifest = main_manifest.replace(
    '"adminDailyPublish": { "path": "js/admin-daily-publish.js", "version": null }',
    '"adminDailyPublish": { "path": "js/admin-daily-publish.js", "version": "1.1.0-date-identity" }'
)
main_manifest = main_manifest.replace("3.1.0-semantic-diversity", "3.2.0-date-identity")
main_manifest = main_manifest.replace("2.1.0-semantic-diversity", "2.2.0-date-identity")
write("config/asset-manifest.json", main_manifest)

print("Finalized date-only identity: real-file-only GitHub fallback export, number-free verifier, and minimal manifest version diff.")
