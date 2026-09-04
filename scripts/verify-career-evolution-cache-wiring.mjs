import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};
const manifest = fs.existsSync('config/asset-manifest.json')
  ? JSON.parse(read('config/asset-manifest.json'))
  : null;
const assetUrl = (key, fallback) => {
  const asset = manifest?.assets?.[key];
  if (!asset?.path) return fallback;
  return asset.version ? `${asset.path}?v=${asset.version}` : asset.path;
};

const admin = read('admin.html');
requireText(admin, assetUrl('adminImportTools', 'js/admin-import-tools.js?v=22.3.0-careerevolution'), 'admin compatibility cache bust');
requireText(admin, 'factoryIncludeCareerEvolutionFamilies', 'Career Evolution generator option');

const compatibility = read('js/admin-import-tools.js');
requireText(compatibility, 'studio-bootstrap.js', 'single Studio bootstrap compatibility path');
requireText(compatibility, 'js/prompt-studio-loader.js?v=', 'cache-safe legacy Prompt Studio fallback');

const loader = read('js/prompt-studio-loader.js');
requireText(loader, assetUrl('adminImportToolsBase', 'js/admin-import-tools-base.js?v=16.2.0-careerevolution'), 'main generator cache bust');
requireText(loader, assetUrl('promptTargetSurvivorGenerator', 'js/prompt-target-survivor-generator.js?v=1.0.1-careerevolution'), 'target survivor cache bust');
requireText(loader, assetUrl('promptTargetAutoExplorer', 'js/prompt-target-auto-explorer.js?v=1.0.1-careerevolution'), 'auto explorer cache bust');

const base = read('js/admin-import-tools-base.js');
requireText(base, 'js/prompt-career-evolution-family-generator.js?v=1.0.0', 'Career Evolution provider load');
requireText(base, 'includeCareerEvolutionFamilies', 'Career Evolution generator integration');

console.log('Career Evolution cache wiring verified against the central Studio asset manifest.');
