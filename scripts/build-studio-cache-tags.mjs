import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(read('config/asset-manifest.json'));
const assetUrl = key => {
  const asset = manifest.assets?.[key];
  if (!asset?.path) throw new Error(`Central asset manifest is missing ${key}.`);
  return asset.version ? `${asset.path}?v=${asset.version}` : asset.path;
};

const path = 'admin.html';
const before = read(path);
let after = before;

for (const key of ['assetManifestRuntime', 'validationEngine', 'adminStageOne', 'adminImportTools', 'leaderboardConfig']) {
  const asset = manifest.assets[key];
  const pattern = new RegExp(`${asset.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\?v=[^\"']+)?`, 'g');
  const matches = after.match(pattern) || [];
  if (matches.length !== 1) throw new Error(`${key}: expected exactly one admin.html script URL, found ${matches.length}.`);
  after = after.replace(pattern, assetUrl(key));
}

if (after !== before) {
  fs.writeFileSync(path, after);
  console.log('Updated admin.html cache tags from config/asset-manifest.json');
}