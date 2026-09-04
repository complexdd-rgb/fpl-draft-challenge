import fs from 'node:fs';

const reportPath = 'reports/refinement-incubator-audit.json';
if (!fs.existsSync(reportPath)) throw new Error('Missing refinement incubator audit report.');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const expectedParents = new Set([
  'quality_v2_mid_price_6_gi_15',
  'quality_v3_fwd_manager_david_moyes_p55'
]);
const expected = new Map([
  ['refinement_survivor_v1_mid_price_6_5_gi_15', {
    label: 'Midfielder who started at £6.5m or less with 15+ goal involvements',
    position: 'MID',
    minAnswers: 18,
    maxAnswers: 90
  }],
  ['refinement_survivor_v1_fwd_manager_david_moyes_p75', {
    label: 'Forward managed by David Moyes who scored 75+ FPL points',
    position: 'FWD',
    minAnswers: 12,
    maxAnswers: 60
  }]
]);

const pack = report?.source?.survivorPack;
if (!pack?.ready) throw new Error('Refinement survivor pack is not ready in the deterministic audit.');
const advertisedParents = new Set(Array.isArray(pack.parentIds) ? pack.parentIds.map(String) : []);
if (advertisedParents.size !== expectedParents.size || [...expectedParents].some(id => !advertisedParents.has(id))) {
  throw new Error(`Survivor pack parent set is wrong: ${[...advertisedParents].join(', ') || 'none'}.`);
}
// removedParents is telemetry for the specific installation pass. An idempotent/rebuilt
// library can legitimately report 0 here; the invariant is that no weak parent survives.
if (Number(pack.parentsPresentAfter) !== 0) throw new Error(`Weak refinement parents remain in the effective library: ${pack.parentsPresentAfter}.`);
if (Number(pack.added) !== expected.size) throw new Error(`Expected ${expected.size} durable survivors; got ${pack.added}.`);

if (Number(report?.reference?.currentIncubatorCount) !== 0) {
  throw new Error(`Expected the current Incubator to be empty after durable promotion; got ${report?.reference?.currentIncubatorCount}.`);
}
if (Number(report?.incubator?.total) !== 0) throw new Error(`Incubator report still contains ${report?.incubator?.total} unresolved prompts.`);
if (Number(report?.decisions?.rejected || 0) !== 0) throw new Error(`Deterministic audit contains ${report.decisions.rejected} rejected prompts.`);

const survivors = Array.isArray(report?.survivors?.items) ? report.survivors.items : [];
if (survivors.length !== expected.size) throw new Error(`Expected ${expected.size} survivor audit rows; got ${survivors.length}.`);

for (const row of survivors) {
  const target = expected.get(String(row?.id || ''));
  if (!target) throw new Error(`Unexpected durable survivor in audit: ${row?.id}.`);
  if (row.label !== target.label) throw new Error(`${row.id} label/rule wording mismatch: ${row.label}`);
  if (row.position !== target.position) throw new Error(`${row.id} position mismatch: ${row.position}.`);
  if (!['certified', 'rescued'].includes(String(row.state))) throw new Error(`${row.id} is not certified/rescued: ${row.state}.`);
  if (Number(row.rawRating || 0) < 4 && row.state !== 'rescued') throw new Error(`${row.id} did not meet the 4★ raw floor.`);
  if (Number(row.playerCount) < target.minAnswers || Number(row.playerCount) > target.maxAnswers) {
    throw new Error(`${row.id} answer pool ${row.playerCount} is outside ${target.minAnswers}-${target.maxAnswers}.`);
  }
  if (Number(row.overlap) >= 0.94) throw new Error(`${row.id} overlap ${row.overlap} is too high.`);
  if (Array.isArray(row.issues) && row.issues.length) throw new Error(`${row.id} has analyser issues: ${row.issues.join(', ')}.`);
  expected.delete(row.id);
}

if (expected.size) throw new Error(`Missing durable survivors: ${[...expected.keys()].join(', ')}.`);

console.log(`Refinement survivor verification passed: ${survivors.length} durable survivors, 0 unresolved Incubator prompts.`);
console.log(`Survivor pack removal telemetry for this run: ${Number(pack.removedParents || 0)} parent(s) removed directly; end state has 0 weak parents.`);
for (const row of survivors) {
  console.log(`${row.id}: ${row.state}; raw=${row.rawScore}; adjusted=${row.adjustedScore}; answers=${row.playerCount}; overlap=${Number(row.overlap).toFixed(3)}`);
}
