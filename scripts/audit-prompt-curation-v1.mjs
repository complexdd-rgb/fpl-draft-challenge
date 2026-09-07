import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

function args(argv) {
  const out = { input: '', outDir: 'reports', prefix: 'prompt-curation-v1', quiet: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out-dir') out.outDir = argv[++i] || out.outDir;
    else if (argv[i] === '--prefix') out.prefix = argv[++i] || out.prefix;
    else if (argv[i] === '--quiet') out.quiet = true;
    else if (!out.input) out.input = argv[i];
    else throw new Error(`Unexpected argument: ${argv[i]}`);
  }
  if (!out.input) throw new Error('Usage: node scripts/audit-prompt-curation-v1.mjs <export.json> [--out-dir reports] [--prefix prompt-curation-v1]');
  return out;
}

function load(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (payload?.kind !== 'fpl-prompt-library-family-shards' || !payload.manifest || !Array.isArray(payload.shards)) {
    throw new Error('Input is not an FPL prompt-library family-shard export.');
  }
  return payload;
}

function loadReviewExporter() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const exporterPath = path.resolve(here, '../js/prompt-curation-review-export-v1.js');
  const source = fs.readFileSync(exporterPath, 'utf8');
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
  const window = { addEventListener() {}, dispatchEvent() {}, FPL_PROMPT_LIBRARY_SHARDS_V1: null };
  const context = vm.createContext({
    window, document, console, CustomEvent: class {}, MutationObserver: class {},
    requestAnimationFrame() {}, setTimeout() {}, queueMicrotask, URL, Blob
  });
  new vm.Script(source, { filename: exporterPath }).runInContext(context);
  const api = window.FPL_PROMPT_CURATION_REVIEW_EXPORT_V1;
  if (!api?.ready || typeof api.buildReviewPayloadFromPackage !== 'function') throw new Error('Curation review exporter did not initialise in CLI mode.');
  return api;
}

function audit(payload, file, api) {
  const review = api.buildReviewPayloadFromPackage(payload);
  const familyRows = review.audit.families || [];
  const total = Math.max(1, review.source.total || 0);
  const topFamilies = [...familyRows]
    .sort((a, b) => b.prompts - a.prompts || a.family.localeCompare(b.family))
    .map(row => ({ family: row.family, prompts: row.prompts, sharePct: Math.round((row.prompts / total) * 10000) / 100 }));
  return {
    schemaVersion: 2,
    auditVersion: '1.2.0-triad-calibration',
    generatedAt: review.generatedAt,
    source: { file: path.basename(file), ...review.source },
    policy: review.policy,
    concentration: { topFamilies, ...review.audit.concentration },
    compression: review.audit.compression,
    families: familyRows,
    reviewBatch: review.reviewBatch
  };
}

function md(a) {
  const lines = [
    '# Prompt curation Phase 1 audit', '',
    `Generated: ${a.generatedAt}`, '',
    `- Source prompts: **${a.source.total.toLocaleString('en-GB')}**`,
    `- Variant groups: **${a.compression.variantGroups.toLocaleString('en-GB')}**`,
    `- Average prompts/group: **${a.compression.averagePromptsPerGroup}**`,
    `- Top-five family share: **${a.concentration.topFiveSharePct}%**`,
    `- Nominal family-budget ceiling: **${a.policy.survivorTargetCeilingTotal.toLocaleString('en-GB')}**`,
    `- Effective snapshot ceiling: **${a.policy.survivorTargetTotal.toLocaleString('en-GB')}** (${a.compression.survivorCompressionPct}% compression)`,
    `- Review calibration: **${a.reviewBatch.triadCount} same-group triads / ${a.reviewBatch.records.length} records**`, '',
    '## Variant-group policy', '',
    '- Current variant groups are semantic shapes, not hard survivor buckets.',
    '- Hard cap per current variant group: **none**.',
    '- Hard cap per materially equivalent cell: **1**.',
    '- CERTIFY / RESCUE / REJECT are reviewed together inside the same variant group.', '',
    '## Variant groups', '',
    `- Median: ${a.compression.medianGroupSize}`,
    `- P90 / P95 / P99: ${a.compression.p90GroupSize} / ${a.compression.p95GroupSize} / ${a.compression.p99GroupSize}`,
    `- Maximum: ${a.compression.maxGroupSize}`,
    `- Diagnostic cap 1 / 2 / 3 counts: ${a.compression.capOne.toLocaleString('en-GB')} / ${a.compression.capTwo.toLocaleString('en-GB')} / ${a.compression.capThree.toLocaleString('en-GB')}`, '',
    '## Family ceilings', '',
    '| Family | Source | Groups | Avg/group | Ceiling | Effective |',
    '|---|---:|---:|---:|---:|---:|'
  ];
  for (const row of [...a.families].sort((x, y) => y.prompts - x.prompts)) {
    lines.push(`| ${row.family} | ${row.prompts.toLocaleString('en-GB')} | ${row.variantGroups.toLocaleString('en-GB')} | ${row.promptsPerGroup} | ${row.target.toLocaleString('en-GB')} | ${row.effectiveTarget.toLocaleString('en-GB')} |`);
  }
  return `${lines.join('\n')}\n`;
}

const cli = args(process.argv);
const payload = load(cli.input);
const api = loadReviewExporter();
const result = audit(payload, cli.input, api);
fs.mkdirSync(cli.outDir, { recursive: true });
const base = path.join(cli.outDir, cli.prefix);
fs.writeFileSync(`${base}-audit.json`, `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(`${base}-audit.md`, md(result));
fs.writeFileSync(`${base}-review-batch.json`, `${JSON.stringify({
  schemaVersion: 2,
  auditVersion: result.auditVersion,
  generatedAt: result.generatedAt,
  source: result.source,
  policy: result.policy,
  structure: result.reviewBatch.structure,
  triadCount: result.reviewBatch.triadCount,
  decisionTargets: result.policy.reviewDecisionTargets,
  familyQuotas: result.reviewBatch.familyQuotas,
  records: result.reviewBatch.records
}, null, 2)}\n`);
if (!cli.quiet) {
  console.log(`Prompt curation audit complete: ${result.source.total.toLocaleString('en-GB')} prompts / ${result.compression.variantGroups.toLocaleString('en-GB')} groups.`);
  console.log(`Effective survivor ceiling: ${result.policy.survivorTargetTotal.toLocaleString('en-GB')} of nominal ${result.policy.survivorTargetCeilingTotal.toLocaleString('en-GB')} (${result.compression.survivorCompressionPct}% compression).`);
  console.log(`Review batch: ${result.reviewBatch.triadCount} same-group triads / ${result.reviewBatch.records.length} prompts (${JSON.stringify(result.reviewBatch.decisionCounts)}).`);
}