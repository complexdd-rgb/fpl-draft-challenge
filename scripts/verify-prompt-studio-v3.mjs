import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const studio = read('js/prompt-studio-v3-clean-room.js');
const registry = read('js/prompt-family-registry-v3.js');
const manifest = JSON.parse(read('config/asset-manifest.json'));
const bootstrap = read('js/studio-bootstrap.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(studio.includes('const STORAGE_KEY = "fplPromptStudioV3CleanRoom"'), 'V3 does not own an isolated storage key.');
assert(studio.includes('enabled:false'), 'V3 drafts are not explicitly disabled.');
assert(studio.includes('status:"draft"'), 'V3 create flow does not start in draft state.');
assert(studio.includes('humanReviewed:true'), 'V3 quality review does not record explicit human review.');
assert(studio.includes('prompt.status = "approved"'), 'V3 has no explicit human approval state.');
assert(studio.includes('prompt.enabled = false'), 'V3 approval is not proven non-live.');
assert(!studio.includes('prompt.enabled = true'), 'V3 must never automatically enable a prompt.');
assert(!studio.includes('FPL_PROMPT_QUALITY_ENFORCEMENT_V2'), 'V3 must not consume automatic Quality Enforcement v2 decisions.');
assert(!studio.includes('FPL_FOUR_STAR_LIBRARY'), 'V3 must not use the old automatic four-star library as its review authority.');
assert(!studio.includes('familyBonus('), 'V3 must not apply automatic family rescue bonuses.');
assert(!studio.includes('removeIds('), 'V3 must not automatically remove prompts.');
assert(studio.includes('V3 state never mutates the legacy production library'), 'Legacy/V3 isolation contract is missing.');
assert(studio.includes('Legacy live pool:'), 'V3 does not visibly distinguish the frozen legacy production pool.');

const familyCount = (registry.match(/^    \["/gm) || []).length;
assert(familyCount >= 30, `V3 family registry is too small (${familyCount}); expected at least 30 families.`);
for (const family of ['league-position','career-consistency','career-peak','comeback','one-club','one-season-wonder','era-crossover','premium-disappointment','cross-season-achievement','composite-story']) {
  assert(registry.includes(`"${family}"`), `V3 family registry is missing ${family}.`);
}

assert(manifest.manifestVersion === '1.6.0-prompt-studio-v3-foundation', 'Central manifest is not on the V3 foundation version.');
assert(manifest.assets.promptStudioV3?.path === 'js/prompt-studio-v3-clean-room.js', 'V3 runtime is not manifest-owned.');
assert(manifest.assets.promptFamilyRegistryV3?.path === 'js/prompt-family-registry-v3.js', 'V3 family registry is not manifest-owned.');
assert(bootstrap.includes('function ensurePromptV3()'), 'Studio bootstrap does not own V3 loading.');
assert(bootstrap.includes('loadAsset("promptFamilyRegistryV3"'), 'V3 registry is not loaded by bootstrap.');
assert(bootstrap.includes('loadAsset("promptStudioV3"'), 'V3 runtime is not loaded by bootstrap.');

console.log(`Prompt Studio V3 verification passed: isolated zero-start library, manual quality/approval, ${familyCount} registered families, and frozen legacy production remain separate.`);
