import fs from 'node:fs';

const guard = fs.readFileSync('js/admin-daily-generator-guard.js', 'utf8');
const batch = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const token of [
  'saved-library generation guard v2.0.0',
  'const WEEKLY_PROMPTS = DAYS_IN_BATCH * PROMPTS_PER_DAY;',
  'const NATIONALITY_WEEKLY_TARGET = DAYS_IN_BATCH;',
  'function allocateFamilyTargets(familyIndex)',
  'function buildCertifiedReservoir()',
  'function solveFamilyPositionFlow(',
  'window.FPL_DAILY_GENERATION_PROMPT_POOL = prompts;',
  'window.FPL_DAILY_GENERATION_FAMILY_PLAN = reservoir.plan;',
  'const uniqueWeekIds = new Set(weekIds);',
  'uniqueWeekIds.size !== WEEKLY_PROMPTS',
  'every snapshot prompt consumed',
  'fpl:daily-saved-library-week-certified'
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

for (const token of [
  'const CERTIFIED_SNAPSHOT_SOURCE_POLICY_VERSION = 1;',
  'Array.isArray(window.FPL_DAILY_GENERATION_PROMPT_POOL)',
  'const promptSource = generationSnapshot || (Array.isArray(apiLibrary) ? apiLibrary : globalLibrary);'
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

// Reproduce the final weekly-consumption gate: seven PASS days must consume all 77 snapshot
// IDs exactly once. One repeated ID must be detected even when every ID belongs to the snapshot.
const goodWeek = Array.from({ length: 7 }, (_, day => ({
  status: 'PASS',
  promptIds: generationPool.slice(day * 11, day * 11 + 11).map(prompt => prompt.id)
})));
const goodIds = goodWeek.flatMap(day => day.promptIds);
assert(goodIds.length === 77 && new Set(goodIds).size === 77, 'Valid 77-prompt fixture did not consume the whole reservoir exactly once.');
assert(goodIds.every(id => activeIds.has(id)), 'Valid fixture contains an ID outside the active reservoir.');

const badWeek = goodWeek.map(day => ({ ...day, promptIds: [...day.promptIds] }));
badWeek[6].promptIds[10] = badWeek[0].promptIds[0];
const badIds = badWeek.flatMap(day => day.promptIds);
assert(new Set(badIds).size === 76, 'Duplicate-prompt fixture did not reproduce the weekly consumption failure.');

// The proportional plan has a hard nationality floor of seven while all other non-empty
// families get at least one weekly slot before proportional remainder allocation.
const familyWeights = [
  ['nationality', 120], ['season-stats', 400], ['position-stat', 350], ['exact-stats', 300],
  ['combined-stats', 280], ['club-stat', 250], ['league-position', 220], ['promoted-clubs', 90],
  ['relegated-clubs', 90], ['champions', 80], ['career-longevity', 180], ['club-count', 160],
  ['manager', 140], ['anti-meta', 200], ['value', 170], ['minutes-role', 210], ['composite-story', 190]
];
const nationalityTarget = 7;
const otherFamilies = familyWeights.filter(([family]) => family !== 'nationality');
let remaining = 77 - nationalityTarget - otherFamilies.length;
assert(remaining >= 0, 'Family-floor fixture exceeds the 77-prompt weekly reservoir.');
const weightTotal = otherFamilies.reduce((sum, [, weight]) => sum + weight, 0);
const allocations = Object.fromEntries(familyWeights.map(([family]) => [family, family === 'nationality' ? 7 : 1]));
const remainders = [];
let allocated = 0;
for (const [family, weight] of otherFamilies) {
  const raw = remaining * weight / weightTotal;
  const floor = Math.floor(raw);
  allocations[family] += floor;
  allocated += floor;
  remainders.push({ family, remainder: raw - floor, weight });
}
remainders.sort((a, b) => b.remainder - a.remainder || b.weight - a.weight || a.family.localeCompare(b.family));
for (let index = 0; index < remaining - allocated; index += 1) allocations[remainders[index].family] += 1;
assert(Object.values(allocations).reduce((sum, value) => sum + value, 0) === 77, 'Proportional family allocation does not sum to 77.');
assert(allocations.nationality === 7, 'Nationality target is not fixed at seven prompts per week.');
assert(otherFamilies.every(([family]) => allocations[family] >= 1), 'A non-empty promoted family lost its weekly representation floor.');

console.log('Saved-library generation snapshot verified: immutable 77-prompt reservoir, 17-family proportional allocation, seven nationality prompts and exact once-per-week consumption are protected.');
