import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const finish = read('js/admin-studio-finish.js');
const engineSource = read('js/validation-engine.js');
const repositoryPool = read('js/repository-certified-prompt-pool.js');
const adminHtml = read('admin.html');

const requiredFinishMarkers = [
  'const CERTIFICATION_POOL_WAIT_MS = 120000;',
  'function certifiedPromptPoolState()',
  'window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL',
  'window.FPL_STUDIO_LOAD_PROMPT_TOOLS',
  'fpl:repository-certified-prompt-pool-ready',
  'await waitForCertifiedPromptPool(status)',
  'Object.freeze(poolState.prompts.slice())',
  'window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL = certificationPool',
  'delete window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL',
  'expected:851',
  'Preparing the repository-certified 851-prompt pool.',
  'Certified prompt snapshot locked at',
  'The final prompt set is frozen for the whole run'
];

for (const marker of requiredFinishMarkers) {
  if (!finish.includes(marker)) throw new Error(`All-season certification gate is missing: ${marker}`);
}

// All-season certification must no longer treat the whole browser Prompt Manager library
// (which can contain thousands of local customs) as the production prompt set.
if (finish.includes('window.FPL_FOUR_STAR_LIBRARY')) {
  throw new Error('All-season certification still depends directly on FPL_FOUR_STAR_LIBRARY instead of the repository-owned pool.');
}
if (!repositoryPool.includes('const EXPECTED_TOTAL = 851;')) {
  throw new Error('Repository-certified prompt pool does not pin the expected 851-prompt production population.');
}
if (!repositoryPool.includes('Browser-local Prompt Manager changes touch')) {
  throw new Error('Repository-certified prompt pool does not block local edits that collide with certified prompt IDs.');
}
if (!repositoryPool.includes('browser-only prompt(s) ignored')) {
  throw new Error('Repository-certified prompt pool does not explicitly isolate unrelated browser-only prompts.');
}

const promptLibraryIndex = adminHtml.indexOf('prompt-library.js?v=2.0.1');
const repositoryPoolIndex = adminHtml.indexOf('js/repository-certified-prompt-pool.js');
const adminCoreIndex = adminHtml.indexOf('js/admin-core.js');
if (!(promptLibraryIndex >= 0 && repositoryPoolIndex > promptLibraryIndex && adminCoreIndex > repositoryPoolIndex)) {
  throw new Error('Repository-certified prompt pool must load after prompt-library.js and before admin-core applies browser-local Prompt Manager state.');
}

if (!engineSource.includes('const certificationSnapshot = window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;')) {
  throw new Error('Validation Engine does not prioritise the frozen certification prompt snapshot.');
}

const snapshot = Object.freeze([{ id: 'snapshot-prompt', rating: 4, enabled: true }]);
globalThis.window = {
  FPL_VALIDATION_CERTIFICATION_PROMPT_POOL: snapshot,
  FPL_STUDIO_API: { getPromptLibrary: () => [{ id: 'live-prompt', rating: 4, enabled: true }] },
  FPL_PROMPT_LIBRARY: [{ id: 'global-prompt', rating: 4, enabled: true }],
  FPL_PLAYERS: []
};
vm.runInThisContext(engineSource, { filename: 'js/validation-engine.js' });

if (window.ValidationEngine.getPromptLibrary() !== snapshot) {
  throw new Error('Validation Engine did not return the frozen certification snapshot first.');
}
delete window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;
const live = window.ValidationEngine.getPromptLibrary();
if (!Array.isArray(live) || live[0]?.id !== 'live-prompt') {
  throw new Error('Validation Engine did not return to the live Studio library after the snapshot was released.');
}

// Re-run the dedicated browser-local isolation regression from this gate so a green
// all-season check proves the exact 2,072-custom scenario cannot contaminate production.
execFileSync(process.execPath, ['scripts/verify-repository-certified-prompt-pool.mjs'], { stdio: 'inherit' });

console.log('All-season repository-certified readiness gate verification passed.');
