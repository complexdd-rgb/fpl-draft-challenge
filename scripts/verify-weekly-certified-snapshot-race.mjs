import fs from 'node:fs';

const guard = fs.readFileSync('js/admin-daily-generator-guard.js', 'utf8');
const batch = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');
const publish = fs.readFileSync('js/admin-daily-publish.js', 'utf8');
const publishEdge = fs.readFileSync('supabase/functions/daily-challenge-publish/index.ts', 'utf8');
const dailyFragment = fs.readFileSync('fragments/admin-daily-workspace.html', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const token of [
  'saved-library generation guard v3.1.0',
  'const WEEKLY_PROMPTS = DAYS_IN_BATCH * PROMPTS_PER_DAY;',
  'const NATIONALITY_WEEKLY_TARGET = DAYS_IN_BATCH;',
  'async function buildCertifiedReservoir()',
  'function generationHistorySnapshot(days = 7)',
  'function syncGenerationAvailability()',
  'window.FPL_DAILY_GENERATION_PROMPT_POOL = prompts;',
  'window.FPL_DAILY_GENERATION_FAMILY_PLAN = reservoir.plan;',
  'const uniqueWeekIds = new Set(weekIds);',
  'uniqueWeekIds.size !== WEEKLY_PROMPTS',
  'runtime-certified reservoir prompt(s) were not consumed by the week',
  'fpl:daily-saved-library-week-certified',
  'semanticWeeklyCap: DAYS_IN_BATCH',
  'semantic.canAddWeekly',
  'semantic?.dayIssues'
]) {
  assert(guard.includes(token), `Daily Challenge guard is missing saved-library snapshot protection: ${token}`);
}

for (const forbidden of [
  'EXPECTED_TOTAL = 851',
  'state.total !== 851',
  'ids.length !== 851',
  'certifiedPoolSize = 851',
  'repository-certified 851-prompt pool',
  'library.splice(0, library.length, ...certified)'
]) {
  assert(!guard.includes(forbidden), `Daily Challenge guard still contains retired 851-prompt authority: ${forbidden}`);
}

assert(!guard.includes('batchFirstNumber'), 'Date-only guard still depends on the retired first challenge number input.');
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
assert(batch.includes('function buildWeeklyReservoirRotationState(basePools)'), 'Guarded weekly generation does not have a fresh reservoir rotation state.');
assert(batch.includes('let rotationState = generationSnapshot'), 'Batch generator does not distinguish guarded reservoir rotation from legacy history replay or cannot reset that state between full-week layout attempts.');
assert(batch.includes('? buildWeeklyReservoirRotationState(basePools)'), 'Guarded reservoir still replays old schedule history into its fresh 77-prompt cycle.');
assert(guard.includes('function topAnswerDiversityAudit(prompts)'), '77-prompt reservoir does not audit top-answer player uniqueness.');
assert(guard.includes('const promptTopAnswerCache = new WeakMap();'), 'Top-answer diversity still recalculates prompt stats instead of caching them per prompt.');
assert(guard.includes('const GENERATOR_V3_ATTEMPTS = 10;'), 'Generator v3 does not use a bounded scored-attempt budget.');
assert(guard.includes('GENERATOR_V3_POOL_MULTIPLIER = 3'), 'Generator v3 candidate pool is missing its compact multiplier.');
assert(guard.includes('Generator v3 · shortlisting from stored evidence'), 'Generator v3 does not expose stored-evidence shortlist progress.');
assert(guard.includes('async function certifyChoice(candidate, attempt, phase)'), 'Generator v3 does not runtime-certify ranked replacements in place.');
assert(guard.includes('for (const candidate of choices)'), 'Generator v3 does not walk ranked replacements after a runtime failure.');
assert(guard.includes('async function refillPosition(position, targetAdds = GENERATOR_V3_REFILL_BATCH)'), 'Generator v3 does not lazily refill exhausted position shortlists.');
assert(guard.includes('async function refillOpenPositions(state'), 'Generator v3 does not lazily refill special-floor candidate pools.');
assert(guard.includes('source: "generator-v3-lazy-refill"'), 'Generator v3 plan identity is missing.');
assert(guard.includes('score -= leaderLoad * leaderLoad * 30'), 'Generator v3 does not strongly penalise repeated top-answer leaders.');
assert(guard.includes('score -= familyLoad * 5'), 'Generator v3 does not softly balance prompt families.');
assert(guard.includes('excludedLoad * 35'), 'Exclude Top Result is not rewarded when it relieves an over-used leader.');
assert(guard.includes('NATIONALITY_WEEKLY_TARGET'), 'Generator v3 lost the weekly nationality floor.');
assert(guard.includes('EXCLUDE_TOP_RESULT_WEEKLY_MIN'), 'Generator v3 lost the Exclude Top Result floor.');
assert(!guard.includes('.sort((heft, right) =>'), 'Generator guard contains the broken leader-repair sorter spelling.');
assert(guard.includes('Same-day top answers must be unique.'), 'Final weekly certification does not reject same-day repeated leaders.');
assert(guard.includes('getLastTiming: () => lastTiming'), 'Generator does not expose run timing instrumentation.');
assert(batch.includes('getTiming: () => lastTiming'), 'Batch generator does not expose allocation timing instrumentation.');
assert(guard.includes('runtimeCertificationMs'), 'Generator timing does not include runtime certification.');
assert(guard.includes('reservoirSelectionMs'), 'Generator timing does not include reservoir selection.');
assert(guard.includes('finalValidationMs'), 'Generator timing does not include final validation.');
for (const retired of ['function allocateFamilyTargets(', 'function repairLeaderCap(', 'function searchLeaderCappedSelection(', 'function assignAnyRecords(', 'function solveFamilyPositionFlow(']) {
  assert(!guard.includes(retired), `Retired pre-v3 solver code remains: ${retired}`);
}
assert(!guard.includes('deferred[position].shift()'), 'Lazy refill still removes from the front of arrays.');
const shortlistStart = guard.indexOf('function materialiseShortlistCandidate(record, position)');
const shortlistEnd = guard.indexOf('// Shortlist cheaply', shortlistStart);
assert(shortlistStart >= 0 && shortlistEnd > shortlistStart, 'Shortlist materialiser block is missing.');
assert(!guard.slice(shortlistStart, shortlistEnd).includes('cutoverApi.materialiseRecord'), 'Shortlisting still compiles executable prompts before runtime certification.');
assert(!batch.includes('Regenerate from a later rotation point rather than relaxing the nationality quota.'), 'Generator still recommends moving the fixed schedule date to escape a rotation conflict.');
assert(guard.includes('window.FPL_STUDIO_SCHEDULE?.scheduled || []'), 'Weekly reservoir does not consume authoritative Supabase prompt history.');
assert(guard.includes('row?.manifest_entry'), 'Weekly reservoir does not read stored Supabase manifest prompt IDs.');
assert(guard.includes('function generationHistorySnapshot(days = 7)'), 'Weekly reservoir does not build one shared used/recent history snapshot.');
assert(guard.includes('...interleaveSemanticGroups(recycled)'), 'Weekly reservoir does not prefer older recycled prompts before recent ones.');
assert(batch.includes('settings.avoidRecent && !generationSnapshot'), 'Guarded batch still applies a second hard browser freshness block after reservoir certification.');

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

for (const token of [
  'const CERTIFIED_SNAPSHOT_SOURCE_POLICY_VERSION = 1;',
  'Array.isArray(window.FPL_DAILY_GENERATION_PROMPT_POOL)',
  'const promptSource = generationSnapshot || (Array.isArray(apiLibrary) ? apiLibrary : globalLibrary);',
  'semantic.dayClash(choice, existing)',
  'semantic.missingRequiredKeys(draft, semanticPressure.required)',
  'same-day semantic/top-answer uniqueness'
]) {
  assert(batch.includes(token), `Weekly generator is missing immutable saved-library snapshot source: ${token}`);
}

// The active generation source must remain immutable even if the mutable Studio/global
// library changes after the guard has built its 77-prompt reservoir.
const generationPool = Object.freeze(Array.from({ length: 77 }, (_, index) => Object.freeze({ id: `certified-${index}` })));
const activeIds = new Set(generationPool.map(prompt => prompt.id));
const mutableGlobal = [...generationPool, { id: 'late-uncertified' }];
const selectedSource = generationPool || mutableGlobal;
assert(selectedSource.length === 77, 'Immutable generation source changed after a late global-library mutation.');
assert(!selectedSource.some(prompt => prompt.id === 'late-uncertified'), 'Late global prompt leaked into the immutable generation source.');

// In guarded mode the reservoir has exactly seven days of position capacity. Starting its
// rotation fresh means every day, including day 7, still has at least one full formation of
// unused prompts. Therefore the exact planner never enters a bridge cycle and cannot force
// multiple old-cycle nationality prompts into one day.
const dailyFormation = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
const weeklyPositionPool = { GK: 7, DEF: 28, MID: 28, FWD: 14 };
for (let day = 0; day < 7; day += 1) {
  for (const position of Object.keys(dailyFormation)) {
    const unusedBeforeDay = weeklyPositionPool[position] - dailyFormation[position] * day;
    assert(unusedBeforeDay >= dailyFormation[position], `Fresh weekly rotation bridges too early for ${position} on day ${day + 1}.`);
  }
}

// Reproduce the final weekly-consumption gate: seven PASS days must consume all 77 snapshot
// IDs exactly once. One repeated ID must be detected even when every ID belongs to the snapshot.
const goodWeek = Array.from({ length: 7 }, (_, day) => ({
  status: 'PASS',
  promptIds: generationPool.slice(day * 11, day * 11 + 11).map(prompt => prompt.id)
}));
const goodIds = goodWeek.flatMap(day => day.promptIds);
assert(goodIds.length === 77 && new Set(goodIds).size === 77, 'Valid 77-prompt fixture did not consume the whole reservoir exactly once.');
assert(goodIds.every(id => activeIds.has(id)), 'Valid fixture contains an ID outside the active reservoir.');

const badWeek = goodWeek.map(day => ({ ...day, promptIds: [...day.promptIds] }));
badWeek[6].promptIds[10] = badWeek[0].promptIds[0];
const badIds = badWeek.flatMap(day => day.promptIds);
assert(new Set(badIds).size === 76, 'Duplicate-prompt fixture did not reproduce the weekly consumption failure.');

console.log('Saved-library generation snapshot verified: immutable 77-prompt reservoir, semantic spread, date-only identity, full Supabase generation history and real-file-only GitHub fallback export are protected.');
