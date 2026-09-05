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
const repositoryPool = read('js/repository-certified-prompt-pool.js');
const promptLibrary = read('prompt-library.js');

assert(config.manifestVersion === '2.0.0-prompt-studio-clean-reset', 'Central manifest is not on the clean-reset boundary.');
assert(config.assets?.promptStudioClean?.path === 'js/prompt-studio-clean-reset.js', 'Clean Prompt Studio asset is missing.');
assert(config.assets?.studioBootstrap?.version === '2.0.0-clean-reset', 'Clean bootstrap cache version is missing.');
assert(config.assets?.repositoryCertifiedPromptPool?.version === '2.0.0-clean-reset', 'Clean repository pool cache version is missing.');
assert(generatedManifest.includes('2.0.0-prompt-studio-clean-reset'), 'Generated manifest was not refreshed.');
assert(generatedManifest.includes('"promptStudioClean"'), 'Generated manifest does not expose the clean Prompt Studio asset.');

assert(bootstrap.includes('ensurePromptStudio'), 'Bootstrap does not own the clean Prompt Studio load.');
assert(bootstrap.includes('promptStudioClean'), 'Bootstrap does not load the clean Prompt Studio controller.');
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

assert(entrypoint.includes('2.0.0-clean-reset'), 'Admin entrypoint does not cache-bust the clean bootstrap.');
forbid(entrypoint, 'prompt-studio-loader.js', 'Admin entrypoint');
forbid(entrypoint, 'loadLegacyPromptPath', 'Admin entrypoint');
assert(entrypoint.includes('fallback is disabled by design'), 'Admin entrypoint does not fail closed.');

assert(promptLibrary.trim() === '', 'prompt-library.js must stay empty at the clean reset boundary.');
assert(cleanStudio.includes('fplPromptStudioCleanLibraryV1'), 'Clean Prompt Studio store is missing.');
assert(cleanStudio.includes('fplChallengeStudioPromptManagerV1'), 'Legacy Prompt Manager browser state is not explicitly cleared.');
assert(cleanStudio.includes('fplPromptStudioV3CleanRoom'), 'Legacy V3 browser state is not explicitly cleared.');
assert(cleanStudio.includes('library.splice(0, library.length)'), 'Shared prompt library is not hard-reset.');
assert(cleanStudio.includes('FPL_PROMPT_STUDIO_CLEAN'), 'Clean Prompt Studio API is missing.');

assert(repositoryPool.includes('version: VERSION'), 'Clean repository prompt pool API is missing.');
assert(repositoryPool.includes('expectedTotal: 0'), 'Repository prompt pool was not reset to zero.');
forbid(repositoryPool, 'prompt-library-canonical-state.js', 'Repository prompt pool');
forbid(repositoryPool, 'EXPECTED_TOTAL = 851', 'Repository prompt pool');

console.log('Prompt Studio clean reset verified: one controller, empty canonical library, no legacy fallback chain.');
