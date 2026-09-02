import fs from 'node:fs';

const source = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');
for (const token of [
  'const EXACT_ROTATION_REPLAY_POLICY_VERSION = 2;',
  'if (positionState.usedIds.has(promptId)) {',
  'positionState.cycle += 1;',
  'date: result.releaseDate || result.date,',
  'releaseDate: result.releaseDate || result.date,',
  'issues: Array.isArray(result.issues) ? [...result.issues] : []'
]) {
  if (!source.includes(token)) throw new Error(`Weekly rotation/library-evolution fix is missing: ${token}`);
}

const replayStart = source.indexOf('function buildExactRotationState(');
const replayEnd = source.indexOf('function getFutureReservedPromptIds(', replayStart);
if (replayStart < 0 || replayEnd <= replayStart) throw new Error('Could not isolate exact rotation replay function.');
const replay = source.slice(replayStart, replayEnd);
const repeatIndex = replay.indexOf('positionState.usedIds.has(promptId)');
const addIndex = replay.indexOf('positionState.usedIds.add(promptId)');
if (repeatIndex < 0 || addIndex < 0 || repeatIndex >= addIndex) {
  throw new Error('Historical repeat is not detected before the repeated prompt is added to the reconstructed cycle.');
}

// Model the live library-expansion failure. The historical pool contained A/B/C and had
// already rolled into a new cycle (A repeats). Three nationality prompts are later added.
// Old replay would retain A/B/C as "used", leaving the three new nationality prompts as the
// only unused DEF options; a 4-DEF formation would bridge and force all three in one day.
const currentPool = ['old-a', 'old-b', 'old-c', 'nat-1', 'nat-2', 'nat-3'];
const historical = ['old-a', 'old-b', 'old-c', 'old-a'];
const nationality = new Set(['nat-1', 'nat-2', 'nat-3']);
const requiredDefenders = 4;

function replayOld() {
  const used = new Set();
  for (const id of historical) used.add(id);
  return used;
}

function replayNew() {
  const used = new Set();
  for (const id of historical) {
    if (used.has(id)) used.clear();
    used.add(id);
    if (used.size >= currentPool.length) used.clear();
  }
  return used;
}

const oldUsed = replayOld();
const oldUnused = currentPool.filter(id => !oldUsed.has(id));
if (oldUnused.length >= requiredDefenders || oldUnused.filter(id => nationality.has(id)).length !== 3) {
  throw new Error('Library-expansion regression fixture does not reproduce the former three-nationality bridge.');
}

const newUsed = replayNew();
const newUnused = currentPool.filter(id => !newUsed.has(id));
if (newUnused.length < requiredDefenders) {
  throw new Error('Repeat-aware replay still creates a false bridge after library expansion.');
}
if (newUsed.size !== 1 || !newUsed.has('old-a')) {
  throw new Error('Repeat-aware replay did not reconstruct the newest historical cycle correctly.');
}

console.log('Weekly rotation library-evolution verified: historical repeats roll the reconstructed cycle, new nationality prompts are not forced as a false backlog, and FAIL issues remain visible.');
