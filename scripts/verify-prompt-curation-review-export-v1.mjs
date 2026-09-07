import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-curation-review-export-v1.js', 'utf8');
const bootstrap = fs.readFileSync('js/studio-bootstrap.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('config/asset-manifest.json', 'utf8'));

const listeners = new Map();
const document = {
  readyState: 'loading',
  addEventListener(type, handler) { listeners.set(type, handler); },
  getElementById() { return null; },
  querySelector() { return null; },
  documentElement: { dataset: {} },
  body: { appendChild() {} },
  createElement() { return { dataset: {}, addEventListener() {}, remove() {}, click() {}, setAttribute() {} }; }
};
const window = {
  addEventListener() {},
  dispatchEvent() {},
  FPL_PROMPT_LIBRARY_SHARDS_V1: null
};
const context = vm.createContext({ window, document, console, CustomEvent: class {}, MutationObserver: class {}, requestAnimationFrame() {}, setTimeout() {}, queueMicrotask, URL, Blob });
new vm.Script(source, { filename: 'prompt-curation-review-export-v1.js' }).runInContext(context);

const api = window.FPL_PROMPT_CURATION_REVIEW_EXPORT_V1;
if (!api?.ready || api.version !== '1.0.0' || typeof api.buildReviewPayloadFromPackage !== 'function') {
  throw new Error('Curation review export API did not initialise.');
}

const families = ['season-stats','position-stat','exact-stats','combined-stats','club-stat','league-position','promoted-clubs','relegated-clubs','champions','nationality','career-longevity','club-count','manager','anti-meta','value','minutes-role','composite-story'];
const shards = [];
let serial = 0;
for (let familyIndex = 0; familyIndex < families.length; familyIndex += 1) {
  const family = families[familyIndex];
  const records = [];
  for (let groupIndex = 0; groupIndex < 3; groupIndex += 1) {
    const group = `vg_${familyIndex}_${groupIndex}`;
    for (let rank = 0; rank < 4; rank += 1) {
      serial += 1;
      records.push({
        id: `fixture_${serial}`,
        family,
        variantGroup: group,
        position: ['ANY','DEF','MID','FWD'][rank],
        difficulty: ['easy','medium','hard','medium'][rank],
        qualityStatus: 'pass',
        qualityScore: 90 - rank * 10,
        label: `${family} fixture ${groupIndex}-${rank}`,
        conditions: [{ field: 'total_points', op: '>=', value: 50 + rank * 10 }],
        qualityEvidence: {
          answerPlayers: [60, 30, 10, 4][rank],
          seasons: 5,
          clubs: 8,
          coverage: 100,
          variantGroupSize: 4
        }
      });
    }
  }
  shards.push({ family, path: `prompt-library-shards/${family}.json`, count: records.length, records });
}
const total = shards.reduce((sum, shard) => sum + shard.count, 0);
const payload = {
  schemaVersion: 1,
  kind: 'fpl-prompt-library-family-shards',
  generatedAt: new Date().toISOString(),
  manifest: {
    schemaVersion: 1,
    version: '1.1.0',
    source: 'prompt-library-shards-v1',
    savedAt: new Date().toISOString(),
    promotionVersion: '1.0.0',
    promotionFingerprint: 'fixture',
    total,
    families: families.length,
    variantGroups: families.length * 3,
    qualityPass: total,
    qualityReview: 0,
    familyShards: shards.map(({ family, path, count }) => ({ family, path, count }))
  },
  shards
};

const review = api.buildReviewPayloadFromPackage(payload);
if (review.kind !== 'fpl-prompt-curation-review-batch') throw new Error('Wrong review export kind.');
if (review.reviewBatch.records.length !== 144) throw new Error(`Expected 144 review records, got ${review.reviewBatch.records.length}.`);
for (const decision of ['CERTIFY','RESCUE','REJECT']) {
  if (review.reviewBatch.decisionCounts[decision] !== 48) throw new Error(`Expected 48 ${decision}, got ${review.reviewBatch.decisionCounts[decision]}.`);
}
if (new Set(review.reviewBatch.records.map(record => record.id)).size !== 144) throw new Error('Review batch contains duplicate IDs.');
if (review.policy.survivorTargetTotal !== 5585) throw new Error(`Expected survivor target 5585, got ${review.policy.survivorTargetTotal}.`);
if (!review.audit.compression.groupBuckets['3'] && !review.audit.compression.groupBuckets['4-5']) throw new Error('Compression group buckets were not populated.');
if (!source.includes('buildRepositoryPackage')) throw new Error('Browser exporter is not reading the saved shard package.');
if (!bootstrap.includes('promptCurationReviewExportV1')) throw new Error('Studio bootstrap does not load the curation review exporter.');
if (!bootstrap.includes('ensureCurationReview();\n        ensureDailyCutover();')) throw new Error('Curation export and Daily cutover are not independently invoked after shard bridge load.');
if (manifest.assets?.promptCurationReviewExportV1?.path !== 'js/prompt-curation-review-export-v1.js') throw new Error('Central asset manifest is missing curation review exporter.');

console.log(`Prompt curation review export verifier passed: ${review.reviewBatch.records.length} records, 48/48/48 decisions, ${families.length} families.`);