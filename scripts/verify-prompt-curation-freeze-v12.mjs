import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const manifestPath = 'reports/prompt-curation-134765-survivor-v12-freeze-manifest.json';
const auditPath = 'reports/prompt-curation-134765-survivor-v12-freeze-audit.md';
const manifest = JSON.parse(read(manifestPath));
const audit = read(auditPath);

assert(manifest.kind === 'fpl-prompt-curation-frozen-survivor-manifest', 'Freeze manifest kind drifted.');
assert(manifest.status === 'freeze-approved', 'Survivor set is no longer marked freeze-approved.');
assert(manifest.promotionFingerprint === 'shards_134765_1pkuiu3', 'Frozen source fingerprint drifted.');
assert(manifest.sourcePrompts === 134765, 'Frozen source total drifted.');
assert(manifest.families === 17, 'Frozen family count drifted.');
assert(manifest.variantGroups === 2684, 'Frozen variant-group count drifted.');
assert(manifest.builderVersion === '1.2.0', 'Frozen proposal was not produced by Survivor Builder v1.2.0.');
assert(manifest.selected === 4897, 'Frozen survivor count drifted.');
assert(manifest.proposalSha256 === '339b4bb4026fef113d6513dd312eef88ab16b81a2d04c81ebdd273c96cd1f1b9', 'Frozen proposal digest drifted.');
assert(manifest.survivorIdSha256 === '3d3b0776ca0df171f6017c8e436f167308c4bfdd4d0b74b4e57b6089edff972d', 'Frozen survivor-ID digest drifted.');
assert(manifest.decisionLedgerSha256 === '5dfb2516e04421190e0ccc5d46a84c760c24e453220493d52048772776048e84', 'Frozen decision-ledger digest drifted.');

const familyTotal = Object.values(manifest.familyCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
const difficultyTotal = Object.values(manifest.difficulty || {}).reduce((sum, value) => sum + Number(value || 0), 0);
const positionTotal = Object.values(manifest.positions || {}).reduce((sum, value) => sum + Number(value || 0), 0);
const answerBandTotal = Object.values(manifest.answerBands || {}).reduce((sum, value) => sum + Number(value || 0), 0);
assert(Object.keys(manifest.familyCounts || {}).length === 17, 'Frozen family metrics no longer contain all 17 families.');
assert(familyTotal === manifest.selected, 'Frozen family counts do not sum to the selected total.');
assert(difficultyTotal === manifest.selected, 'Frozen difficulty counts do not sum to the selected total.');
assert(positionTotal === manifest.selected, 'Frozen position counts do not sum to the selected total.');
assert(answerBandTotal === manifest.selected, 'Frozen answer-band counts do not sum to the selected total.');
assert(manifest.quality?.minimum === 65, 'Frozen quality floor drifted.');
assert(manifest.nearNeighborPairs?.jaccard95Plus === 10, 'Frozen >=0.95 near-neighbour residue drifted.');
assert(manifest.nearNeighborPairs?.jaccard98Plus === 2, 'Frozen >=0.98 near-neighbour residue drifted.');
assert(manifest.crossSemanticExactAnswerSets?.duplicateFingerprintGroups === 75, 'Frozen cross-semantic answer-set signature drifted.');
assert(manifest.entityCoverage?.manager?.distinct === 52, 'Frozen manager coverage drifted.');
assert(manifest.entityCoverage?.nationality?.distinct === 49, 'Frozen nationality coverage drifted.');
assert(manifest.entityCoverage?.clubStat?.distinct === 30, 'Frozen club-stat entity coverage drifted.');

for (const [key, value] of Object.entries(manifest.structuralValidation || {})) {
  assert(Number(value) === 0, `Frozen structural validation is no longer clean: ${key}=${value}`);
}
assert(manifest.policy?.dailyAuthorityChanged === false, 'Freeze manifest incorrectly claims Daily authority changed.');
assert(manifest.policy?.sourceSnapshotImmutable === true, 'Freeze manifest no longer preserves the immutable source boundary.');

for (const token of [
  'Status: **PASS — freeze approved**',
  'Frozen survivor count: **4,897**',
  manifest.proposalSha256,
  manifest.survivorIdSha256,
  manifest.decisionLedgerSha256,
  'This freeze does **not** change Daily authority.',
  'FROZEN SURVIVOR DECISIONS',
  'curated package verification',
  'full generation regression',
  'explicit cutover'
]) {
  assert(audit.includes(token), `Freeze audit is missing required token: ${token}`);
}

console.log('Prompt Curation v1.2 freeze verified: 4,897 survivors are cryptographically pinned to shards_134765_1pkuiu3, balance signatures reconcile, structural blockers remain zero, and Daily authority is unchanged.');
