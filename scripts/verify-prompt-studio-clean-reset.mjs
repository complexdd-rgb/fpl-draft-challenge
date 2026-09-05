import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const forbid = (text, needle, label) => assert(!text.includes(needle), `${label} still contains retired Prompt Studio wiring: ${needle}`);

const config = JSON.parse(read('config/asset-manifest.json'));
const generatedManifest = read('js/asset-manifest.js');
const bootstrap = read('js/studio-bootstrap.js');
const entrypoint = read('js/admin-import-tools.js');
const cleanStudio = read('js/prompt-studio-clean-reset.js');
const cleanCss = read('admin-prompt-studio-clean.css');
const promptFactoryMount = read('js/prompt-factory-mount-v1.js');
const promptFactory = read('js/prompt-factory-v1.js');
const qualityMount = read('js/prompt-quality-analyser-mount-v1.js');
const qualityAnalyser = read('js/prompt-quality-analyser-v1.js');
const qualityCss = read('admin-prompt-quality-analyser.css');
const repositoryPool = read('js/repository-certified-prompt-pool.js');
const promptLibrary = read('prompt-library.js');
const executablePromptLibrary = promptLibrary
  .replace(/^\uFEFF/, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

assert(config.manifestVersion === '2.3.0-quality-analyser-v1', 'Central manifest is not on the Quality Analyser v1 boundary.');
assert(config.assets?.promptStudioClean?.path === 'js/prompt-studio-clean-reset.js', 'Clean Prompt Studio asset is missing.');
assert(config.assets?.promptStudioClean?.version === '1.1.0-library-browser', 'Library Browser controller cache version changed unexpectedly.');
assert(config.assets?.promptFactoryMountV1?.path === 'js/prompt-factory-mount-v1.js', 'Prompt Factory mount asset is missing.');
assert(config.assets?.promptFactoryV1?.path === 'js/prompt-factory-v1.js', 'Prompt Factory engine asset is missing.');
assert(config.assets?.promptQualityAnalyserMountV1?.path === 'js/prompt-quality-analyser-mount-v1.js', 'Quality Analyser mount asset is missing.');
assert(config.assets?.promptQualityAnalyserV1?.path === 'js/prompt-quality-analyser-v1.js', 'Quality Analyser engine asset is missing.');
assert(config.assets?.promptQualityAnalyserCssV1?.path === 'admin-prompt-quality-analyser.css', 'Quality Analyser CSS asset is missing.');
assert(config.assets?.studioBootstrap?.version === '2.2.0-quality-analyser', 'Quality Analyser bootstrap version is missing.');
assert(config.assets?.repositoryCertifiedPromptPool?.version === '2.0.0-clean-reset', 'Clean repository pool boundary changed unexpectedly.');
assert(generatedManifest.includes('2.3.0-quality-analyser-v1'), 'Generated manifest was not refreshed.');
assert(generatedManifest.includes('"promptFactoryV1"'), 'Generated manifest does not expose the Prompt Factory engine.');
assert(generatedManifest.includes('"promptQualityAnalyserMountV1"'), 'Generated manifest does not expose the Quality Analyser mount.');
assert(generatedManifest.includes('"promptQualityAnalyserV1"'), 'Generated manifest does not expose the Quality Analyser engine.');
assert(generatedManifest.includes('"promptQualityAnalyserCssV1"'), 'Generated manifest does not expose the Quality Analyser CSS.');

assert(bootstrap.includes('ensurePromptStudio'), 'Bootstrap does not own the clean Prompt Studio load.');
assert(bootstrap.includes('ensurePromptFactory'), 'Bootstrap does not own the Prompt Factory load.');
assert(bootstrap.includes('ensureQualityAnalyser'), 'Bootstrap does not own the Quality Analyser load.');
assert(bootstrap.includes('promptQualityAnalyserMountV1'), 'Bootstrap does not load the Quality Analyser mount owner.');
assert(bootstrap.includes('promptQualityAnalyserV1'), 'Bootstrap does not load the Quality Analyser engine.');
for (const retired of [
  'ensurePromptRedesign',
  'ensurePromptV3',
  'ensurePromptLoader',
  'ensureCertificationLayer',
  'ensureRefinementIncubator',
  'promptStudioRedesign',
  'promptStudioV3',
  'promptStudioV4Simple',
  'promptLibraryLegacyAdditions',
  'promptRefinementIncubator'
]) forbid(bootstrap, retired, 'Studio bootstrap');

assert(entrypoint.includes('2.2.0-quality-analyser'), 'Admin entrypoint does not cache-bust the Quality Analyser bootstrap.');
forbid(entrypoint, 'prompt-studio-loader.js', 'Admin entrypoint');
forbid(entrypoint, 'loadLegacyPromptPath', 'Admin entrypoint');
assert(entrypoint.includes('fallback is disabled by design'), 'Admin entrypoint does not fail closed.');

assert(
  executablePromptLibrary === 'window.FPL_PROMPT_LIBRARY = [];',
  'prompt-library.js must contain only the empty canonical array initializer at the clean reset boundary.'
);
assert(cleanStudio.includes('FPL_PROMPT_STUDIO_CLEAN'), 'Clean Prompt Studio API is missing.');
assert(cleanStudio.includes('promptLibraryBrowserList'), 'Library Browser list is missing.');
assert(cleanStudio.includes('This browser is read-only'), 'Library Browser is not explicitly read-only.');

assert(promptFactoryMount.includes('promptFactoryMount'), 'Prompt Factory mount owner does not create the clean mount.');
assert(promptFactoryMount.includes('MutationObserver'), 'Prompt Factory mount owner does not survive native workspace redraws.');
assert(promptFactory.includes('const VERSION = "1.0.0"'), 'Prompt Factory runtime version is not 1.0.0.');
assert(promptFactory.includes('FAMILY_DEFS'), 'Prompt Factory family registry is missing.');
assert(promptFactory.includes('MAX_CANDIDATES_PER_FAMILY'), 'Prompt Factory safety boundary is missing.');
assert(promptFactory.includes('generateFamily'), 'Prompt Factory candidate generation is missing.');
assert(promptFactory.includes('evaluateCandidate'), 'Prompt Factory viability evaluation is missing.');
assert(promptFactory.includes('runAll'), 'Prompt Factory all-family runner is missing.');
assert(promptFactory.includes('Nothing here publishes to the canonical library'), 'Prompt Factory does not state the non-publishing boundary.');
assert(!promptFactory.includes('localStorage.setItem'), 'Prompt Factory must not persist candidate state into browser storage.');
assert(!promptFactory.includes('.addPrompt('), 'Prompt Factory must not write directly into the canonical library.');

assert(qualityMount.includes('promptQualityMount'), 'Quality Analyser mount owner does not create the clean mount.');
assert(qualityMount.includes('MutationObserver'), 'Quality Analyser mount owner does not survive native workspace redraws.');
assert(qualityAnalyser.includes('const VERSION = "1.0.0"'), 'Quality Analyser runtime version is not 1.0.0.');
assert(qualityAnalyser.includes('exactSignature'), 'Quality Analyser exact-duplicate boundary is missing.');
assert(qualityAnalyser.includes('variantSignature'), 'Quality Analyser variant-group signature is missing.');
assert(qualityAnalyser.includes('variantGroup'), 'Quality Analyser variant-group metadata is missing.');
assert(qualityAnalyser.includes('NUMERIC_OPERATORS'), 'Quality Analyser does not distinguish numeric threshold variants.');
assert(qualityAnalyser.includes('Review candidates are retained'), 'Quality Analyser does not state that Review candidates are kept.');
assert(qualityAnalyser.includes('getQualityCandidates'), 'Quality Analyser promotion-facing survivor API is missing.');
assert(!qualityAnalyser.includes('.addPrompt('), 'Quality Analyser must not publish directly into the canonical library.');
assert(!qualityAnalyser.includes('localStorage.setItem'), 'Quality Analyser must not persist its candidate pool into browser storage.');
assert(qualityCss.includes('.prompt-quality-family-row'), 'Quality Analyser family table styling is missing.');
assert(qualityCss.includes('.prompt-quality-state.review'), 'Quality Analyser review-state styling is missing.');
assert(qualityCss.includes('@media (max-width: 620px)'), 'Quality Analyser mobile layout is missing.');

assert(cleanCss.includes('.prompt-clean-status-card'), 'Mobile-safe clean status card styling is missing.');
assert(cleanCss.includes('.prompt-library-browser-toolbar'), 'Library Browser toolbar styling is missing.');
assert(cleanCss.includes('.prompt-factory-controls'), 'Prompt Factory controls styling is missing.');
assert(cleanCss.includes('@media (max-width: 620px)'), 'Prompt Studio mobile layout is missing.');

assert(repositoryPool.includes('version: VERSION'), 'Clean repository prompt pool API is missing.');
assert(repositoryPool.includes('expectedTotal: 0'), 'Repository prompt pool was not reset to zero.');
forbid(repositoryPool, 'prompt-library-canonical-state.js', 'Repository prompt pool');
forbid(repositoryPool, 'EXPECTED_TOTAL = 851', 'Repository prompt pool');

console.log('Prompt Studio clean boundary + Prompt Factory + Quality Analyser v1 verified: zero-prompt canonical library, maximum-library variant policy, no legacy fallback chain, no publishing path.');
