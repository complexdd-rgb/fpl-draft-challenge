import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const studio = read('js/prompt-studio-v3-clean-room.js');
const tester = read('js/prompt-studio-v3-rule-tester.js');
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

assert(tester.includes('const RULE_STORE_KEY = "fplPromptStudioV3RuleDefinitions"'), 'V3 safe builder does not own isolated rule-definition storage.');
assert(tester.includes('const TEST_DETAIL_KEY = "fplPromptStudioV3TestDetails"'), 'V3 database test details are not isolated.');
assert(tester.includes('validation.evaluatePrompt(entry.player, entry.season, prompt.label)'), 'V3 Test does not execute the shared Validation Engine against the real database.');
assert(tester.includes('Array.isArray(window.FPL_PLAYERS)'), 'V3 Test is not grounded in the loaded player database.');
assert(tester.includes('Safe mapping confirmed'), 'V3 safe builder does not prove generated wording maps back to its selected rules.');
assert(tester.includes('const verb = def.type === "career" ? "had" : "recorded"'), 'V3 numeric/career wording is not generated as natural English.');
assert(tester.includes('had a ${def.noun} of £${value}m or less'), 'V3 price wording is not generated as natural English.');
assert(tester.includes('if (type === "price") return [["lte", "At most"]]'), 'V3 safe builder exposes price operators that do not have a clean parser-safe wording contract.');
assert(tester.includes('baseForm.hidden = true'), 'Manual V3 test evidence inputs are still exposed instead of database-calculated evidence.');
assert(tester.includes('runtimeErrors === 0 && zeroMinuteAccepted === 0 && byPlayer.size > 0'), 'V3 technical PASS does not enforce runtime, zero-minute and answer-count safeguards.');
assert(tester.includes('seasonSet.size') && tester.includes('clubSet.size'), 'V3 Test does not calculate real season and club breadth.');
assert(!tester.includes('prompt.enabled = true'), 'V3 rule tester must never enable a prompt.');
assert(!tester.includes('prompt.status = "approved"'), 'V3 rule tester must never approve a prompt.');
assert(!tester.includes('qualityReview ='), 'V3 rule tester must not write human quality review decisions.');
assert(!tester.includes('FPL_REPOSITORY_CERTIFIED_PROMPT_POOL.add'), 'V3 rule tester must not mutate the production pool.');

const familyCount = (registry.match(/^    \["/gm) || []).length;
assert(familyCount >= 30, `V3 family registry is too small (${familyCount}); expected at least 30 families.`);
for (const family of ['league-position','career-consistency','career-peak','comeback','one-club','one-season-wonder','era-crossover','premium-disappointment','cross-season-achievement','composite-story']) {
  assert(registry.includes(`"${family}"`), `V3 family registry is missing ${family}.`);
}

assert(manifest.manifestVersion === '1.7.0-prompt-studio-v3-testing', 'Central manifest is not on the V3 database-testing version.');
assert(manifest.assets.promptStudioV3?.path === 'js/prompt-studio-v3-clean-room.js', 'V3 runtime is not manifest-owned.');
assert(manifest.assets.promptFamilyRegistryV3?.path === 'js/prompt-family-registry-v3.js', 'V3 family registry is not manifest-owned.');
assert(manifest.assets.promptStudioV3RuleTester?.path === 'js/prompt-studio-v3-rule-tester.js', 'V3 safe builder/database tester is not manifest-owned.');
assert(manifest.assets.promptStudioV3RuleTester?.version === '3.1.1', 'V3 safe builder/database tester cache version is stale.');
assert(bootstrap.includes('function ensurePromptV3()'), 'Studio bootstrap does not own V3 loading.');
assert(bootstrap.includes('loadAsset("promptFamilyRegistryV3"'), 'V3 registry is not loaded by bootstrap.');
assert(bootstrap.includes('loadAsset("promptStudioV3"'), 'V3 runtime is not loaded by bootstrap.');
assert(bootstrap.includes('loadAsset("promptStudioV3RuleTester"'), 'V3 safe builder/database tester is not loaded by bootstrap.');

console.log(`Prompt Studio V3 verification passed: zero-start isolation, ${familyCount} families, natural safe rule mapping, real database testing, manual quality/approval, and frozen legacy production remain separate.`);
