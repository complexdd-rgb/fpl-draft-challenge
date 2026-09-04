import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(path, 'utf8');
const finish = read('js/admin-studio-finish.js');
const engineSource = read('js/validation-engine.js');

const requiredFinishMarkers = [
  'const CERTIFICATION_POOL_WAIT_MS = 120000;',
  'function certifiedPromptPoolState()',
  'window.FPL_FOUR_STAR_LIBRARY',
  'window.FPL_STUDIO_LOAD_PROMPT_TOOLS',
  'fpl:four-star-library-ready',
  'await waitForCertifiedPromptPool(status)',
  'Object.freeze(poolState.prompts.slice())',
  'window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL = certificationPool',
  'delete window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL',
  'library.length !== expected',
  'Number(prompt?.rating || 0) < 4',
  'Certified prompt snapshot locked at',
  'The final prompt set is frozen for the whole run'
];

for (const marker of requiredFinishMarkers) {
  if (!finish.includes(marker)) throw new Error(`All-season certification gate is missing: ${marker}`);
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

console.log('All-season certified-library readiness gate verification passed.');
