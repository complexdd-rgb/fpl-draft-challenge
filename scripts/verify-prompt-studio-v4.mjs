import fs from 'node:fs';

const read = file => fs.readFileSync(file,'utf8');
const v4 = read('js/prompt-studio-v4-simple.js');
const manifest = JSON.parse(read('config/asset-manifest.json'));
const bootstrap = read('js/studio-bootstrap.js');

function assert(condition,message) {
  if (!condition) throw new Error(message);
}

assert(v4.includes('const VERSION = "4.0.0"'), 'Simple Prompt Studio version is missing.');
assert(v4.includes('const STORAGE_KEY = "fplPromptStudioV4Library"'), 'V4 does not own a fresh isolated library.');
assert(v4.includes('const MAX_BATCH = 50'), 'V4 requested-count generation limit changed unexpectedly.');
assert(v4.includes('deliberate()?.supportedFamilies'), 'V4 does not generate from the prompt-family engine.');
assert(v4.includes('validation.evaluatePrompt(entry.player,entry.season,candidate.wording)'), 'V4 automatic quality does not use the real Validation Engine/database.');
assert(v4.includes('qualityRating(score)'), 'V4 does not automatically calculate quality ratings.');
assert(v4.includes('highestOverlap'), 'V4 quality analysis does not measure overlap.');
assert(v4.includes('bigSixShare'), 'V4 quality analysis does not measure Big Six concentration.');
assert(v4.includes('zeroMinuteAccepted'), 'V4 quality analysis does not protect zero-minute answers.');
assert(v4.includes('answerIds:ids'), 'V4 does not retain answer-set memory for future overlap checks.');
assert(v4.includes('enabled:true'), 'New V4 prompts are not added to the Studio library enabled by default.');
assert(v4.includes('prompt.enabled = false'), 'V4 does not support disabling weak prompts.');
assert(v4.includes('continue blocking duplicates'), 'V4 does not explicitly preserve disabled prompts as duplicate memory.');
assert(v4.includes('for (const prompt of state.prompts)'), 'Duplicate memory does not include the whole V4 library.');
assert(v4.includes('keys.labels.has(labelKey)'), 'V4 does not block duplicate wording.');
assert(v4.includes('keys.ids.has(candidate.id)'), 'V4 does not block duplicate candidate IDs.');
assert(!v4.includes('state.prompts.splice('), 'V4 must not delete disabled prompts from duplicate memory.');
assert(!v4.includes('FPL_REPOSITORY_CERTIFIED_PROMPT_POOL.add'), 'V4 must not mutate the live production pool.');
assert(!v4.includes('FPL_PROMPT_LIBRARY.push'), 'V4 must not push generated prompts into the legacy live library.');
assert(v4.includes('v3Root.hidden = true'), 'V4 does not hide the old multi-stage V3 interface.');
assert(v4.includes('v3Root.dataset.v4EngineOnly = "true"'), 'V3 is not explicitly marked as generation-engine-only under V4.');
assert(v4.includes('Generate and quality-check'), 'V4 does not expose the simple requested-count generate action.');
assert(v4.includes('Disable matching'), 'V4 does not expose manual bulk disable after automatic quality checks.');
assert(v4.includes('Disabled · remembered'), 'V4 library does not visibly explain disabled duplicate memory.');

assert(manifest.manifestVersion === '1.12.0-prompt-studio-v4-simple', 'Central manifest is not on the V4 simple version.');
assert(manifest.assets.promptStudioV4Simple?.path === 'js/prompt-studio-v4-simple.js', 'V4 runtime is not manifest-owned.');
assert(manifest.assets.promptStudioV4Simple?.version === '4.0.0', 'V4 runtime cache version is stale.');
assert(manifest.assets.studioBootstrap?.version === '1.8.0-prompt-studio-v4-simple', 'Studio bootstrap manifest version is stale.');
assert(bootstrap.includes('loadAsset("promptStudioV4Simple"'), 'Studio bootstrap does not load the simple V4 runtime.');
assert(bootstrap.includes('V3 remains available underneath as the'), 'Bootstrap does not document the hidden V3 engine boundary.');

console.log('Prompt Studio V4 verification passed: requested-count family generation, automatic database quality scoring, persistent enabled/disabled library memory, duplicate blocking, and frozen production remain separate.');
