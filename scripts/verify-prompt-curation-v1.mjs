import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const families = [
  'season-stats','position-stat','exact-stats','combined-stats','club-stat','league-position',
  'promoted-clubs','relegated-clubs','champions','nationality','career-longevity','club-count',
  'manager','anti-meta','value','minutes-role','composite-story'
];
const positions = ['ANY','GK','DEF','MID','FWD'];
const shards = [];
let total = 0;
let groupTotal = 0;
for (let familyIndex = 0; familyIndex < families.length; familyIndex += 1) {
  const family = families[familyIndex];
  const records = [];
  for (let groupIndex = 0; groupIndex < 12; groupIndex += 1) {
    groupTotal += 1;
    const group = `vg_${familyIndex}_${groupIndex}`;
    const answers = [30, 29, 8, 181, 28];
    const difficulty = ['easy','easy','hard','hard','easy'];
    const thresholds = [20, 21, 40, 80, 22];
    for (let sibling = 0; sibling < 5; sibling += 1) {
      records.push({
        schemaVersion:1,
        id:`fixture_${familyIndex}_${groupIndex}_${sibling}`,
        label:`Fixture ${family} group ${groupIndex} threshold ${sibling}`,
        position:positions[(familyIndex + groupIndex) % positions.length],
        family,
        conditions:[{ field:'points', operator:'gte', value:thresholds[sibling] }],
        variantGroup:group,
        qualityStatus:'pass',
        qualityScore:90 - sibling * 5,
        qualityVersion:'1.0.0',
        difficulty:difficulty[sibling],
        qualityEvidence:{ answerPlayers:answers[sibling], seasons:15 - sibling, clubs:20 - sibling, coverage:100, variantGroupSize:5 },
        enabled:true,
        source:'fixture'
      });
    }
  }
  total += records.length;
  shards.push({ family, path:`prompt-library-shards/${family}.json`, count:records.length, records });
}

const fixture = {
  schemaVersion:1,
  kind:'fpl-prompt-library-family-shards',
  generatedAt:'2026-09-07T00:00:00.000Z',
  manifest:{
    schemaVersion:1, version:'1.1.0', source:'prompt-library-shards-v1', savedAt:'2026-09-07T00:00:00.000Z',
    promotionVersion:'1.0.0', promotionFingerprint:'fixture', total, families:families.length, variantGroups:groupTotal,
    qualityPass:total, qualityReview:0,
    familyShards:shards.map(shard => ({ family:shard.family, path:shard.path, count:shard.count }))
  },
  repositoryLayout:{ manifestPath:'prompt-library-shards/manifest.json', familyDirectory:'prompt-library-shards/' },
  shards
};

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fpl-curation-'));
const input = path.join(temp, 'fixture.json');
const outDir = path.join(temp, 'reports');
fs.writeFileSync(input, JSON.stringify(fixture));
const script = new URL('audit-prompt-curation-v1.mjs', import.meta.url);
const run = spawnSync(process.execPath, [script.pathname, input, '--out-dir', outDir, '--quiet'], { encoding:'utf8' });
if (run.status !== 0) throw new Error(run.stderr || run.stdout || `Audit exited ${run.status}`);
const audit = JSON.parse(fs.readFileSync(path.join(outDir, 'prompt-curation-v1-audit.json'), 'utf8'));
const batch = JSON.parse(fs.readFileSync(path.join(outDir, 'prompt-curation-v1-review-batch.json'), 'utf8'));
function assert(condition, message) { if (!condition) throw new Error(message); }

assert(audit.source.total === total, 'Source total mismatch.');
assert(audit.source.families === 17, 'Family count mismatch.');
assert(audit.compression.variantGroups === groupTotal, 'Variant-group count mismatch.');
assert(audit.policy.survivorTargetCeilingTotal === 5585, 'Nominal survivor ceiling drifted.');
assert(audit.policy.survivorTargetTotal === total, 'Effective survivor ceiling must not pad the fixture beyond its source population.');
assert(audit.policy.hardVariantGroupCap === null, 'Semantic variant groups must not have a hard survivor cap.');
assert(audit.policy.materialCellCap === 1, 'Materially equivalent cells must cap at one survivor.');
assert(batch.structure === '48-same-group-triads', 'Review batch must use same-group triads.');
assert(batch.triadCount === 48, 'Review batch must contain 48 triads.');
assert(batch.records.length === 144, 'Review batch must contain 144 prompts.');
for (const decision of ['CERTIFY','RESCUE','REJECT']) {
  assert(batch.records.filter(row => row.proposedDecision === decision).length === 48, `${decision} quota must be 48.`);
}

const triads = new Map();
for (const row of batch.records) {
  if (!triads.has(row.triadId)) triads.set(row.triadId, []);
  triads.get(row.triadId).push(row);
}
assert(triads.size === 48, 'Review batch must expose 48 distinct triad IDs.');
for (const [triadId, rows] of triads) {
  assert(rows.length === 3, `${triadId} must contain exactly three records.`);
  assert(new Set(rows.map(row => row.variantGroup)).size === 1, `${triadId} must stay inside one variant group.`);
  const anchor = rows.find(row => row.proposedDecision === 'CERTIFY');
  assert(anchor, `${triadId} is missing its CERTIFY anchor.`);
  assert(rows.every(row => row.anchorId === anchor.id), `${triadId} does not point every comparison back to its displayed anchor.`);
  assert(new Set(rows.map(row => row.proposedDecision)).size === 3, `${triadId} must contain one of each decision role.`);
}

let sixCount = 0;
for (const family of families) {
  const count = batch.records.filter(row => row.family === family).length;
  assert(count === 6 || count === 9, `${family} must contribute two or three triads.`);
  if (count === 6) sixCount += 1;
}
assert(sixCount === 3, 'Exactly the three smallest families must contribute two triads.');
assert(new Set(batch.records.map(row => row.id)).size === 144, 'Review batch contains duplicate IDs.');
assert(audit.compression.capOne === groupTotal, 'One-per-group diagnostic simulation is wrong.');
assert(audit.compression.capTwo === groupTotal * 2, 'Two-per-group diagnostic simulation is wrong.');
assert(audit.compression.capThree === groupTotal * 3, 'Three-per-group diagnostic simulation is wrong.');
assert(audit.families.some(row => row.answerBands['151+'] > 0), '151+ answer-pool band must be preserved.');
fs.rmSync(temp, { recursive:true, force:true });
console.log('Prompt curation v1 triad verifier passed.');
