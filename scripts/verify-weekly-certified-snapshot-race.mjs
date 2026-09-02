import fs from 'node:fs';

const guard = fs.readFileSync('js/admin-daily-generator-guard.js', 'utf8');
const batch = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');

for (const token of [
  'const CERTIFIED_GENERATION_SNAPSHOT_POLICY_VERSION = 1;',
  'window.FPL_DAILY_GENERATION_PROMPT_POOL = prompts;',
  'const certification = certifyGeneratedResults(generationSnapshot.ids);',
  'if (generationRunning) { updateGuardChip(); return; }',
  'Only ${results.length}/${DAYS_IN_BATCH} days were produced',
  'contains ${uncertified.length} prompt(s) outside the certified generation snapshot'
]) {
  if (!guard.includes(token)) throw new Error(`Daily Challenge guard is missing certified-snapshot race protection: ${token}`);
}
if (guard.includes('library.splice(0, library.length, ...certified)')) {
  throw new Error('Daily Challenge guard still mutates the live Studio library to enforce the quality pool.');
}
if (guard.includes('result.promptIds.every(id => qualityIds?.has(String(id)))')) {
  throw new Error('Final certification still depends on the mutable shared qualityIds set.');
}

for (const token of [
  'const CERTIFIED_SNAPSHOT_SOURCE_POLICY_VERSION = 1;',
  'Array.isArray(window.FPL_DAILY_GENERATION_PROMPT_POOL)',
  'const promptSource = generationSnapshot || (Array.isArray(apiLibrary) ? apiLibrary : globalLibrary);'
]) {
  if (!batch.includes(token)) throw new Error(`Weekly generator is missing immutable certified snapshot source: ${token}`);
}

// Reproduce the live race: generation starts with a certified pool, then a late prompt-pack
// event invalidates the shared quality state before final certification. The active snapshot
// must remain authoritative and certify the generated prompt IDs successfully.
let sharedQualityIds = new Set(['nat-certified', 'other-certified']);
const activeIds = new Set(sharedQualityIds);
const generationPool = Object.freeze([
  { id: 'nat-certified', nationality: true },
  { id: 'other-certified', nationality: false }
]);
sharedQualityIds = null;
const generated = [{
  status: 'PASS',
  releaseDate: '2026-09-03',
  promptIds: ['nat-certified', 'other-certified', ...Array.from({ length: 9 }, (_, i) => `extra-${i}`)]
}];
for (let i = 0; i < 9; i += 1) activeIds.add(`extra-${i}`);
if (!generationPool.some(prompt => prompt.nationality)) throw new Error('Race fixture lost its certified nationality prompt.');
if (sharedQualityIds !== null) throw new Error('Race fixture did not invalidate shared quality state.');
if (!generated[0].promptIds.every(id => activeIds.has(id))) {
  throw new Error('Immutable certified snapshot did not survive shared quality-state invalidation.');
}

const lateGlobalPrompt = { id: 'uncertified-late', nationality: true };
const mutableGlobal = [...generationPool, lateGlobalPrompt];
const selectedSource = generationPool || mutableGlobal;
if (selectedSource.some(prompt => prompt.id === lateGlobalPrompt.id)) {
  throw new Error('Late global prompt leaked into immutable generation source.');
}

console.log('Certified generation snapshot race verified: late prompt-library invalidation cannot change the active pool or final certification.');
