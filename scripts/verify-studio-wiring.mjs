import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const requireText = (source, text, label) => {
  if (!source.includes(text)) throw new Error(`${label}: missing ${text}`);
};
const forbidText = (source, text, label) => {
  if (source.includes(text)) throw new Error(`${label}: obsolete runtime ownership remains (${text}).`);
};

const config = JSON.parse(read('config/asset-manifest.json'));
const assetUrl = key => {
  const asset = config.assets?.[key];
  if (!asset?.path) throw new Error(`Central asset manifest is missing ${key}.`);
  return asset.version ? `${asset.path}?v=${asset.version}` : asset.path;
};
const runtimeManifest = read('js/asset-manifest.js');
const admin = read('admin.html');
const bootstrap = read('js/studio-bootstrap.js');
const compatibility = read('js/admin-import-tools.js');
const retiredFeatureLoader = read('js/studio-feature-loader.js');
const promptLoader = read('js/prompt-studio-loader.js');
const leaderboard = read('js/leaderboard-config.js');

if (!config.manifestVersion) throw new Error('Studio manifest version is missing.');
if (config.assets?.assetManifestRuntime?.version !== config.manifestVersion) {
  throw new Error('assetManifestRuntime.version must match manifestVersion so every manifest edit can be cache-busted deliberately.');
}
for (const [key, asset] of Object.entries(config.assets || {})) {
  requireText(runtimeManifest, `"${key}"`, `runtime manifest key ${key}`);
  requireText(runtimeManifest, `"path": "${asset.path}"`, `runtime manifest path ${key}`);
  if (asset.version) requireText(runtimeManifest, `"version": "${asset.version}"`, `runtime manifest version ${key}`);
}

const manifestTag = assetUrl('assetManifestRuntime');
const compatibilityTag = assetUrl('adminImportTools');
const leaderboardTag = assetUrl('leaderboardConfig');
requireText(admin, manifestTag, 'admin manifest bootstrap');
requireText(admin, compatibilityTag, 'Studio compatibility entrypoint cache tag');
requireText(admin, leaderboardTag, 'Studio leaderboard configuration cache tag');
if (admin.indexOf(manifestTag) > admin.indexOf(compatibilityTag)) {
  throw new Error('Asset manifest must load before the Studio compatibility entrypoint.');
}

for (const token of [
  'FPL_STUDIO_BOOTSTRAP',
  'ensurePromptLoader',
  'ensureCertificationLayer',
  'ensureRefinementIncubator',
  'ensurePublishing',
  'promptLibraryLegacyAdditions',
  'careerShapeValidationBridge',
  'promptEraRangeWording',
  'adminStudioFinish',
  'careerOverlapWording',
  'promptRefinementIncubator'
]) requireText(bootstrap, token, 'single Studio bootstrap');

requireText(compatibility, 'studio-bootstrap.js', 'compatibility shim delegates to bootstrap');
requireText(compatibility, 'js/prompt-studio-loader.js?v=', 'cache-safe legacy prompt fallback remains available');
forbidText(compatibility, 'career-shape-validation-bridge.js', 'compatibility shim');

requireText(retiredFeatureLoader, 'studio-bootstrap.js', 'retired feature-loader shim delegates to bootstrap');
forbidText(retiredFeatureLoader, 'career-shape-validation-bridge.js', 'retired feature-loader shim');
forbidText(retiredFeatureLoader, 'career-overlap-wording.js', 'retired feature-loader shim');

requireText(promptLoader, 'FPL_ASSET_MANIFEST', 'Prompt Studio manifest lookup');
for (const key of [
  'adminImportToolsBase',
  'promptTargetSurvivorGenerator',
  'promptTargetAutoExplorer',
  'careerShapeRules',
  'careerShapeStudio',
  'careerShapeWorkspaceRepair',
  'careerShapeUnifiedGenerator',
  'careerShapeFutureQualityGuard',
  'careerShapeUnifiedFixes'
]) requireText(promptLoader, `asset("${key}"`, `Prompt Studio asset ${key}`);

requireText(leaderboard, 'Studio runtime feature ownership lives in studio-bootstrap.js.', 'leaderboard Studio ownership note');
requireText(leaderboard, 'js/live-feature-loader.js', 'live feature loader remains');
requireText(leaderboard, 'fpl:leaderboard-config-ready', 'publishing readiness event');
forbidText(leaderboard, 'js/studio-feature-loader.js', 'leaderboard configuration');
forbidText(leaderboard, 'js/prompt-refinement-incubator.js', 'leaderboard configuration');

const promptIndex = bootstrap.indexOf('promptLibraryLegacyAdditions');
const bridgeIndex = bootstrap.indexOf('careerShapeValidationBridge');
const eraIndex = bootstrap.indexOf('promptEraRangeWording');
if (!(promptIndex >= 0 && promptIndex < bridgeIndex && bridgeIndex < eraIndex)) {
  throw new Error('Certification bootstrap order changed: legacy additions → validation bridge → era wording must remain ordered.');
}

for (const path of [
  'scripts/verify-career-evolution-cache-wiring.mjs',
  'scripts/verify-prompt-target-survivor-generator.mjs',
  'scripts/verify-studio-refresh-fastboot.mjs'
]) {
  execFileSync(process.execPath, [fileURLToPath(new URL(path, root))], { stdio: 'inherit' });
}

console.log(`Studio wiring verification passed against central manifest ${config.manifestVersion}.`);
