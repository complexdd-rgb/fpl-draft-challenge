import fs from 'node:fs';

const admin = fs.readFileSync('admin.html', 'utf8');
const batch = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');
const guard = fs.readFileSync('js/admin-daily-generator-guard.js', 'utf8');

if (admin.includes('js/admin-weekly-nationality-quota-guard.js')) {
  throw new Error('Retired nationality quota polling guard is still loaded by Studio.');
}
for (const token of [
  'const DAILY_PROMPT_MIX_TARGET = Object.freeze({',
  'nationality: 1',
  'promptMixCounts(draft).nationality !== DAILY_PROMPT_MIX_TARGET.nationality',
  'days[dayIndex].nationalityCount !== DAILY_PROMPT_MIX_TARGET.nationality',
  'Exactly one nationality prompt is required in every generated day.'
]) {
  if (!batch.includes(token)) throw new Error(`Batch generator lost its integrated nationality invariant: ${token}`);
}
for (const token of [
  'const NATIONALITY_WEEKLY_TARGET = DAYS_IN_BATCH;',
  'state.nationalityCount < NATIONALITY_WEEKLY_TARGET',
  'state.nationalityCount < NATIONALITY_WEEKLY_TARGET ||'
]) {
  if (!guard.includes(token)) throw new Error(`Reservoir generator lost its weekly nationality floor: ${token}`);
}

console.log('Weekly nationality invariant verified without polling: Generator v3 reserves seven nationality prompts and final day validation requires exactly one per Daily XI.');
