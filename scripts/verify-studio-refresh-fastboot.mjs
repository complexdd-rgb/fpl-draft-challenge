import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(label + ' missing: ' + token);
};
const manifest = fs.existsSync('config/asset-manifest.json')
  ? JSON.parse(read('config/asset-manifest.json'))
  : null;
const stageAsset = manifest?.assets?.adminStageOne;
const stageUrl = stageAsset?.path
  ? (stageAsset.version ? `${stageAsset.path}?v=${stageAsset.version}` : stageAsset.path)
  : 'js/admin-stage-one.js?v=1.1.0-fastboot';

const html = read('admin.html');
const css = read('admin-stage-one.css');
const stage = read('js/admin-stage-one.js');

requireText(html, '<html lang="en" class="studio-preboot">', 'preboot html class');
requireText(html, stageUrl, 'Stage One cache bust');
const stageIndex = html.indexOf(stageUrl);
const playersIndex = html.indexOf('players.js?v=12.3.0');
if (stageIndex < 0 || playersIndex < 0 || stageIndex >= playersIndex) {
  throw new Error('Stage One must load before players.js and the rest of the heavy Studio boot chain.');
}

requireText(css, 'html.studio-preboot .studio-shell', 'legacy-layout paint suppression');
requireText(css, 'visibility: hidden;', 'preboot hidden shell');
requireText(css, 'Loading FPL Challenge Studio', 'preboot loading state');

requireText(stage, 'const SCROLL_KEY = "fpl-studio-stage-one-scroll-v1";', 'refresh scroll state');
requireText(stage, 'window.addEventListener("pagehide", saveScrollState);', 'refresh position persistence');
requireText(stage, 'window.addEventListener("fpl:prompt-tools-ready", () => restoreScrollState("prompts"), { once: true });', 'post-lazy-load Prompt Studio scroll restoration');
requireText(stage, 'document.documentElement.classList.remove("studio-preboot");', 'preboot release');
requireText(stage, 'if (document.querySelector("main.studio-shell")) {', 'immediate Stage One boot');

console.log(`Studio refresh fast boot verified: ${stageUrl} loads before heavy scripts, legacy markup cannot flash, and Prompt Studio scroll restoration remains intact.`);
