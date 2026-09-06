import fs from 'node:fs';

const path = 'scripts/apply-date-only-challenge-identity-v1.mjs';
let source = fs.readFileSync(path, 'utf8');
const startMarker = "replaceOnce(weeklyPath,\n`assert(!dailyGuard.includes(forbidden), \\`Daily Challenge guard still contains retired 851-prompt authority: \\${forbidden}\\`);\\n}\\n`,";
const endMarker = "replaceOnce(weeklyPath,\n`console.log('Saved-library generation snapshot verified: immutable 77-prompt reservoir, 17-family proportional allocation, seven nationality prompts and exact once-per-week consumption are protected.');`,";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) throw new Error('Could not locate the broken weekly-regression insertion block.');

const replacement = String.raw`{
  const weeklySource = read(weeklyPath);
  const needle = "assert(!dailyGuard.includes(forbidden), \`Daily Challenge guard still contains retired 851-prompt authority: \${forbidden}\`);\n}\n";
  assert(weeklySource.includes(needle), 'Weekly verifier retired-authority insertion marker not found.');
  const insert = [
    needle.trimEnd(),
    "",
    "assert(!guard.includes('batchFirstNumber'), 'Date-only guard still depends on the retired first challenge number input.');",
    "assert(!batch.includes('batchFirstNumber'), 'Date-only batch generator still depends on the retired first challenge number input.');",
    "assert(!dailyFragment.includes('batchFirstNumber'), 'Native Daily workspace still renders the retired first challenge number input.');",
    "assert(batch.includes('id: `daily-${date}`'), 'Generated challenge id is not canonicalised to its release date.');",
    "assert(!batch.includes('const number = firstNumber + dayIndex;'), 'Batch generator still sequences numeric challenge ids.');",
    "assert(!batch.includes('number: Number(result.number) || 0,'), 'New manifest entries still emit challenge numbers.');",
    "assert(batch.includes('function serverManifestEntries()'), 'ZIP manifest builder does not merge the authoritative Supabase schedule.');",
    "assert(batch.includes('row?.manifest_entry'), 'ZIP manifest builder does not consume stored Supabase manifest entries.');",
    "assert(publish.includes('challengeNumber: 0, // legacy schema field; releaseDate is the canonical identity'), 'Publishing payload does not pin legacy number metadata to zero.');",
    "assert(publishEdge.includes('challengeNumber < 0'), 'Publishing Edge Function still requires positive challenge numbers.');",
    "assert(publishEdge.includes('manifest_entry, published_at'), 'Schedule status does not expose stored manifest entries for non-destructive export.');",
    "assert(!publishEdge.includes('.gte(\"release_date\", today)'), 'Schedule status still hides historical Supabase dates needed to reconstruct the manifest.');",
    "",
    "const addIsoDays = (iso, amount) => {",
    "  const [year, month, day] = iso.split('-').map(Number);",
    "  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);",
    "};",
    "const dated = (start, count, source) => Array.from({ length: count }, (_, index) => ({ date: addIsoDays(start, index), source }));",
    "const staleRepo = dated('2026-08-01', 17, 'repo');",
    "const authoritativeServer = dated('2026-08-18', 20, 'server');",
    "const newWeek = dated('2026-09-07', 7, 'batch');",
    "const mergedByDate = new Map();",
    "for (const entry of staleRepo) mergedByDate.set(entry.date, entry);",
    "for (const entry of authoritativeServer) mergedByDate.set(entry.date, entry);",
    "for (const entry of newWeek) mergedByDate.set(entry.date, entry);",
    "const mergedDates = [...mergedByDate.keys()].sort();",
    "assert(mergedDates.length === 44, 'Date-keyed manifest regression lost or duplicated schedule dates.');",
    "assert(mergedDates[0] === '2026-08-01' && mergedDates.at(-1) === '2026-09-13', 'Date-keyed manifest regression has the wrong schedule boundaries.');",
    "for (let index = 1; index < mergedDates.length; index += 1) {",
    "  assert(mergedDates[index] === addIsoDays(mergedDates[index - 1], 1), 'Date-keyed manifest regression created a gap before ' + mergedDates[index] + '.');",
    "}",
    ""
  ].join('\\n');
  write(weeklyPath, weeklySource.replace(needle, insert));
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
console.log('Repaired date-only migration helper quoting.');
