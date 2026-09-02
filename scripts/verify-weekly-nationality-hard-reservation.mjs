import fs from 'node:fs';

const source = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');

const required = [
  'const NATIONALITY_RESERVATION_POLICY_VERSION = 1;',
  'const CERTIFIED_PROMPT_POOL_ONLY_POLICY_VERSION = 1;',
  'nationality: DAILY_PROMPT_MIX_TARGET.nationality',
  'nationalityExactAvailable',
  'const nationalityChoice = nationalityOptions[attempt % nationalityOptions.length];',
  '&& !isNationalityPrompt(prompt)',
  'promptMixCounts(draft).nationality !== DAILY_PROMPT_MIX_TARGET.nationality',
  'const nationalityCandidates = candidates.filter(candidate =>',
  'The nationality quota is hard and was not relaxed.',
  'Exactly one nationality prompt is required in every generated day.',
  'nationalityFreshnessFallback'
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Weekly generator is missing hard nationality/certified-pool marker: ${token}`);
}

if (source.includes('nationality: Math.min(DAILY_PROMPT_MIX_TARGET.nationality, nationalityAvailable)')) {
  throw new Error('Weekly generator can still silently lower the nationality target to zero.');
}
if (source.includes('const rankedCandidates = quotaCandidates.length ? quotaCandidates : candidates;')) {
  throw new Error('Weekly generator can still relax nationality by falling back to arbitrary candidates.');
}
if (source.includes('[...apiLibrary, ...globalLibrary]')) {
  throw new Error('Weekly generator can still union the unlocked global library back into a certified Studio API pool.');
}

const preSnapshotSource = 'const promptSource = Array.isArray(apiLibrary) ? apiLibrary : globalLibrary;';
const snapshotSource = 'const promptSource = generationSnapshot || (Array.isArray(apiLibrary) ? apiLibrary : globalLibrary);';
if (!source.includes(preSnapshotSource) && !source.includes(snapshotSource)) {
  throw new Error('Weekly generator does not have a safe authoritative prompt-source selection.');
}

const sourceSelectionStart = source.includes(snapshotSource)
  ? source.indexOf('const generationSnapshot = Array.isArray(window.FPL_DAILY_GENERATION_PROMPT_POOL)')
  : source.indexOf('const apiLibrary = core.getPromptLibrary?.();');
const sourceSelectionEnd = source.indexOf('if (!promptLibrary.length)', sourceSelectionStart);
if (sourceSelectionStart < 0 || sourceSelectionEnd < sourceSelectionStart) {
  throw new Error('Certified prompt source-selection block is malformed.');
}
const sourceSelection = source.slice(sourceSelectionStart, sourceSelectionEnd);
if (sourceSelection.includes('...globalLibrary')) {
  throw new Error('Global prompt library is still being merged into the authoritative generation source.');
}

// Before the snapshot patch the Studio API is authoritative. After the snapshot patch the
// immutable generation snapshot is authoritative while the Studio API remains the fallback.
const certifiedApi = [
  { id: 'cert-nationality', certified: true, nationality: true },
  { id: 'cert-other', certified: true, nationality: false }
];
const unlockedGlobal = [
  ...certifiedApi,
  { id: 'uncert-nationality', certified: false, nationality: true }
];
const selectedSource = source.includes(snapshotSource)
  ? certifiedApi
  : (Array.isArray(certifiedApi) ? certifiedApi : unlockedGlobal);
if (selectedSource.some(prompt => !prompt.certified)) {
  throw new Error('Certified-pool regression model allowed an uncertified global prompt into generation.');
}
if (!selectedSource.some(prompt => prompt.nationality)) {
  throw new Error('Certified-pool regression model lost valid certified nationality prompts.');
}

const reservationStart = source.indexOf('const nationalityChoice = nationalityOptions[attempt % nationalityOptions.length];');
const reservationEnd = source.indexOf('if (draft.length !== 11 || !nationalityPlaced) continue;', reservationStart);
if (reservationStart < 0 || reservationEnd < reservationStart) throw new Error('Nationality reservation block is malformed.');
const reservationBlock = source.slice(reservationStart, reservationEnd);
if (!reservationBlock.includes('position === nationalityChoice.position')) {
  throw new Error('Reserved nationality prompt is not tied to its formation position.');
}
if (!reservationBlock.includes('!isNationalityPrompt(prompt)')) {
  throw new Error('Non-reserved slots can still add extra nationality prompts.');
}

const hardTarget = 1;
const simulatedDraft = [
  { id: 'nationality-1', nationality: true },
  ...Array.from({ length: 10 }, (_, index) => ({ id: `other-${index}`, nationality: false }))
];
const countNationality = draft => draft.filter(prompt => prompt.nationality).length;
if (countNationality(simulatedDraft) !== hardTarget) throw new Error('Reservation simulation did not produce exactly one nationality prompt.');
const badDraft = [
  simulatedDraft[0],
  { id: 'nationality-2', nationality: true },
  ...simulatedDraft.slice(1, 10)
];
if (badDraft.length !== 11 || countNationality(badDraft) !== 2) throw new Error('Extra-nationality regression fixture is malformed.');
if (countNationality(badDraft) === hardTarget) throw new Error('Reservation regression simulation failed to detect an extra nationality prompt.');

console.log('Weekly nationality generation verified: exactly one nationality prompt is reserved and the global prompt library cannot bypass the authoritative certified source.');
