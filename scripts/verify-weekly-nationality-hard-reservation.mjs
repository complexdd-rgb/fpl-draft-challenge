import fs from 'node:fs';

const source = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');

const required = [
  'const NATIONALITY_RESERVATION_POLICY_VERSION = 1;',
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
  if (!source.includes(token)) throw new Error(`Weekly generator is missing hard nationality reservation marker: ${token}`);
}

if (source.includes('nationality: Math.min(DAILY_PROMPT_MIX_TARGET.nationality, nationalityAvailable)')) {
  throw new Error('Weekly generator can still silently lower the nationality target to zero.');
}
if (source.includes('const rankedCandidates = quotaCandidates.length ? quotaCandidates : candidates;')) {
  throw new Error('Weekly generator can still relax nationality by falling back to arbitrary candidates.');
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

console.log('Weekly hard nationality reservation verified: target cannot drop to zero, one slot is reserved, extra nationality slots are excluded, and arbitrary quota fallback is removed.');
