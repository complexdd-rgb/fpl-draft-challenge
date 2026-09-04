import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireText = (source, text, label) => {
  if (!source.includes(text)) throw new Error(`${label}: missing ${text}`);
};

const manifest = JSON.parse(read('config/asset-manifest.json'));
const stageAsset = manifest.assets?.adminStageOne;
if (!stageAsset?.path) throw new Error('Central asset manifest is missing adminStageOne.');
const stageUrl = stageAsset.version ? `${stageAsset.path}?v=${stageAsset.version}` : stageAsset.path;

const html = read('admin.html');
const stage = read('js/admin-stage-one.js');

requireText(html, '<template id="studioNativeWorkspaceTemplate">', 'native Studio shell template');
requireText(html, 'data-native-studio-layout="true"', 'native layout marker');
requireText(html, stageUrl, 'manifest-owned Stage One script URL');

for (const workspace of ['dashboard', 'challenge', 'prompts', 'validation', 'database', 'leaderboard', 'imports']) {
  requireText(html, `id="workspace-${workspace}"`, `native ${workspace} workspace`);
  requireText(html, `data-open-workspace="${workspace}"`, `native ${workspace} navigation`);
}

requireText(stage, 'const nativeTemplate = document.getElementById("studioNativeWorkspaceTemplate");', 'Stage One native template lookup');
requireText(stage, 'nativeTemplate?.content?.querySelector(".studio-stage-one-layout")?.cloneNode(true)', 'Stage One native layout clone');
requireText(stage, 'const sidebar = nativeLayout?.querySelector(".studio-sidebar") || createSidebar();', 'cache-safe sidebar fallback');
requireText(stage, 'if (!nativeLayout) {', 'cache-safe generated layout fallback');

const templateIndex = html.indexOf('<template id="studioNativeWorkspaceTemplate">');
const stageIndex = html.indexOf(stageUrl);
const playersIndex = html.indexOf('players.js?v=12.3.0');
if (!(templateIndex >= 0 && templateIndex < stageIndex && stageIndex < playersIndex)) {
  throw new Error('Native Studio template must be available before Stage One executes, and Stage One must still run before heavy player data.');
}

console.log('Native Studio shell verified: navigation/topbar/workspace structure is authored in admin.html with JS constructors retained only as a fallback.');
