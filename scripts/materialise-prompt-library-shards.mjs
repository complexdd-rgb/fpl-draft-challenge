import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2] || 'fpl-prompt-library-shards-v1.json';
const outputRoot = process.argv[3] || '.';
const packageData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const fail = message => { throw new Error(message); };
if (packageData?.kind !== 'fpl-prompt-library-family-shards') fail('Not a Prompt Library family-shard package.');
if (Number(packageData?.schemaVersion) !== 1) fail(`Unsupported package schema: ${packageData?.schemaVersion}`);
if (!packageData?.manifest || !Array.isArray(packageData?.shards)) fail('Package is missing manifest or shards.');

const expectedTotal = Number(packageData.manifest.total || 0);
const expectedFamilies = Number(packageData.manifest.families || 0);
if (packageData.shards.length !== expectedFamilies) fail(`Manifest expects ${expectedFamilies} families but package contains ${packageData.shards.length}.`);

const targetDir = path.join(outputRoot, 'prompt-library-shards');
fs.mkdirSync(targetDir, { recursive: true });

const seenIds = new Set();
let actualTotal = 0;
const manifestShards = [];

for (const shard of packageData.shards) {
  const family = String(shard?.family || '').trim();
  const records = Array.isArray(shard?.records) ? shard.records : null;
  if (!family || !records) fail('Every shard needs a family and records array.');
  if (records.length !== Number(shard.count || 0)) fail(`Count mismatch in ${family}: ${shard.count} vs ${records.length}.`);

  const descriptor = packageData.manifest.familyShards?.find(item => item.family === family);
  if (!descriptor) fail(`Manifest descriptor missing for ${family}.`);
  const relativePath = String(descriptor.path || shard.path || '');
  if (!/^prompt-library-shards\/[a-z0-9-]+\.json$/.test(relativePath)) fail(`Unsafe shard path: ${relativePath}`);

  for (const record of records) {
    const id = String(record?.id || '').trim();
    if (!id) fail(`Prompt without ID in ${family}.`);
    if (seenIds.has(id)) fail(`Duplicate prompt ID across shards: ${id}`);
    seenIds.add(id);
    if (String(record?.family || '') !== family) fail(`Prompt ${id} is in ${family} shard but declares ${record?.family}.`);
  }

  const target = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(records)}\n`);
  actualTotal += records.length;
  manifestShards.push({ family, path: relativePath, count: records.length });
}

if (actualTotal !== expectedTotal) fail(`Manifest expects ${expectedTotal} prompts but shards contain ${actualTotal}.`);

const outputManifest = {
  ...packageData.manifest,
  materialisedAt: new Date().toISOString(),
  familyShards: manifestShards
};
fs.writeFileSync(path.join(targetDir, 'manifest.json'), `${JSON.stringify(outputManifest, null, 2)}\n`);

console.log(`Materialised ${actualTotal.toLocaleString('en-GB')} prompts into ${manifestShards.length} repository family shards.`);
console.log(`Fingerprint: ${outputManifest.promotionFingerprint || 'unknown'}`);
