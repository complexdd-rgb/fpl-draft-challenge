import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const repositoryPool = read('js/repository-certified-prompt-pool.js');
const dailyGuard = read('js/admin-daily-generator-guard.js');
const semanticDiversity = read('js/daily-semantic-diversity-v1.js');
const batchCalendar = read('js/admin-batch-calendar.js');
const engineSource = read('js/validation-engine.js');

// Full all-season certification has not been restarted after the Prompt Studio clean reset.
// This gate protects that deferred state: the repository production population must remain
// intentionally empty, while Daily Challenge is allowed to use its separate saved-library
// reservoir only after structural, runtime and semantic-diversity checks.
assert(repositoryPool.includes('expectedTotal: 0'), 'Repository production prompt pool is not pinned to zero during the deferred all-season phase.');
assert(repositoryPool.includes('total: 0'), 'Repository production prompt pool is no longer empty.');
assert(!repositoryPool.includes('851'), 'All-season boundary still contains the retired 851-prompt population.');

for (const token of [
  'saved-library generation guard v2.3.0',
  'async function buildCertifiedReservoir()',
  'window.FPL_DAILY_GENERATION_PROMPT_POOL = prompts;',
  'const uniqueWeekIds = new Set(weekIds);',
  'semanticWeeklyCap: DAYS_IN_BATCH',
  'fpl:daily-saved-library-week-certified'
]) {
  assert(dailyGuard.includes(token), `Daily saved-library isolation is missing: ${token}`);
}
assert(!dailyGuard.includes('FPL_REPOSITORY_CERTIFIED_PROMPT_POOL'), 'Daily generation has fallen back to the deferred repository production pool.');
assert(semanticDiversity.includes('entity:manager:'), 'Daily semantic boundary no longer protects repeated manager concepts.');
assert(semanticDiversity.includes('rare:bonus'), 'Daily semantic boundary no longer protects bonus-point clustering.');
assert(batchCalendar.includes('semantic.dayClash(choice, existing)'), 'Daily selector no longer blocks a semantic clash while constructing the XI.');
assert(batchCalendar.includes('semantic.missingRequiredKeys(draft, semanticPressure.required)'), 'Daily selector no longer spreads required semantic backlog across remaining days.');

// Preserve the independent frozen-snapshot hook used by Validation Engine. When all-season
// certification resumes it can still lock a deliberately supplied prompt snapshot for a run.
assert(engineSource.includes('const certificationSnapshot = window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;'), 'Validation Engine no longer prioritises an explicit frozen certification snapshot.');
const snapshot = Object.freeze([{ id: 'snapshot-prompt', rating: 4, enabled: true }]);
const sandbox = {
  console,
  window: {
    FPL_VALIDATION_CERTIFICATION_PROMPT_POOL: snapshot,
    FPL_STUDIO_API: { getPromptLibrary: () => [{ id: 'live-prompt', rating: 4, enabled: true }] },
    FPL_PROMPT_LIBRARY: [{ id: 'global-prompt', rating: 4, enabled: true }],
    FPL_PLAYERS: []
  }
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(engineSource, sandbox, { filename: 'js/validation-engine.js' });
assert(sandbox.window.ValidationEngine.getPromptLibrary() === snapshot, 'Validation Engine did not return the frozen certification snapshot first.');
delete sandbox.window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;
const live = sandbox.window.ValidationEngine.getPromptLibrary();
assert(Array.isArray(live) && live[0]?.id === 'live-prompt', 'Validation Engine did not return to the live Studio library after releasing the frozen snapshot.');

execFileSync(process.execPath, ['scripts/verify-repository-certified-prompt-pool.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-daily-semantic-diversity-v1.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-weekly-certified-snapshot-race.mjs'], { stdio: 'inherit' });

console.log('All-season certification boundary verified: full certification remains deferred, repository production is intentionally zero, and Daily saved-library generation stays isolated behind its semantic-diverse 77-prompt runtime-certified reservoir.');
