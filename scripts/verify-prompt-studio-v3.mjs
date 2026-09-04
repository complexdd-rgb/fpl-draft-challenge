// Bulk candidate import must remain an explicit, confirmed Draft-only action.
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const studio = read('js/prompt-studio-v3-clean-room.js');
const tester = read('js/prompt-studio-v3-rule-tester.js');
const advisor = read('js/prompt-studio-v3-quality-advisor.js');
const generator = read('js/prompt-studio-v3-candidate-generator.js');
const certification = read('js/prompt-studio-v3-candidate-certification.js');
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

assert(advisor.includes('const EVIDENCE_KEY = "fplPromptStudioV3QualityAdvisoryEvidence"'), 'V3 advisory evidence does not use isolated storage.');
assert(advisor.includes('validation.evaluatePrompt(entry.player, entry.season, prompt.label)'), 'V3 advisory evidence is not grounded in the real Validation Engine/database.');
assert(advisor.includes('return common / smaller.size'), 'V3 overlap evidence does not use the established smaller-answer-set overlap convention.');
assert(advisor.includes('breadthSignal('), 'V3 advisory layer does not calculate answer breadth.');
assert(advisor.includes('obviousnessSignal('), 'V3 advisory layer does not calculate obviousness indicators.');
assert(advisor.includes('familySignal('), 'V3 advisory layer does not calculate family coverage.');
assert(advisor.includes('data-v3-copy-advisory-overlap'), 'Advisory overlap cannot be explicitly copied into the human form.');
assert(advisor.includes('data-v3-copy-advisory-obviousness'), 'Advisory obviousness cannot be explicitly copied into the human form.');
assert(!advisor.includes('qualityReview ='), 'V3 advisor must never write human quality review state.');
assert(!advisor.includes('prompt.status ='), 'V3 advisor must never change prompt lifecycle state.');
assert(!advisor.includes('prompt.enabled = true'), 'V3 advisor must never enable a prompt.');
assert(!advisor.includes('rating:'), 'V3 advisor must never persist an automatic star rating.');
assert(!advisor.includes('decision:'), 'V3 advisor must never persist an automatic review decision.');
assert(!advisor.includes('FPL_REPOSITORY_CERTIFIED_PROMPT_POOL'), 'V3 advisor must not mutate or depend on the production prompt pool.');

assert(generator.includes('const VERSION = "3.3.1"'), 'V3 candidate generator version is missing.');
assert(generator.includes('const SUPPORTED_FAMILIES = Object.freeze(new Set(['), 'V3 candidate generation is not explicitly family-scoped.');
assert(generator.includes('minAnswers') && generator.includes('maxAnswers'), 'V3 candidate generator does not use a target answer-pool range.');
assert(generator.includes('validation.evaluatePrompt(entry.player,entry.season,spec.wording)'), 'V3 candidate shortlist is not measured against the real Validation Engine/database.');
assert(generator.includes('tester()?.inspectWording?.(spec.position,spec.rules,spec.wording)'), 'V3 candidate recipes are not parser-safety checked before shortlisting.');
assert(generator.includes('Nothing has been saved.'), 'V3 candidate generator does not make temporary shortlist state explicit.');
assert(generator.includes('data-v3-add-candidate'), 'V3 candidate generator has no explicit human Add Draft action.');
assert(generator.includes('data-v3-add-all-candidates'), 'V3 candidate generator has no explicit Add all Draft action.');
assert(generator.includes('function addAllCandidates(root)'), 'V3 candidate generator has no guarded Add all implementation.');
assert(generator.includes('window.confirm(`Add all ${candidates.length} remaining shortlist candidate'), 'V3 Add all does not require explicit confirmation.');
assert(generator.includes('They will NOT be tested, rated, approved or enabled automatically.'), 'V3 Add all does not explain its non-authoritative boundary.');
assert(generator.includes('for (const candidate of candidates) if (saveCandidateAsDraft(root,candidate))'), 'V3 Add all does not route every candidate through the normal Draft-only save path.');
assert(generator.includes('create.requestSubmit()'), 'V3 candidate generator does not route selected material through the normal disabled Draft form.');
assert(generator.includes('This is a Draft only. It still requires real Test → advisory Quality → human Review.'), 'Generated V3 draft does not preserve the manual-review lifecycle note.');
assert(!generator.includes('prompt.enabled = true'), 'V3 candidate generator must never enable a prompt.');
assert(!generator.includes('prompt.status = "approved"'), 'V3 candidate generator must never approve a prompt.');
assert(!generator.includes('qualityReview ='), 'V3 candidate generator must never write human quality state.');
assert(!generator.includes('FPL_REPOSITORY_CERTIFIED_PROMPT_POOL'), 'V3 candidate generator must not mutate or depend on the production pool.');

assert(certification.includes('const VERSION = "3.4.0"'), 'V3 candidate certification version is missing.');
assert(certification.includes('const EVIDENCE_KEY = "fplPromptStudioV3CandidateAllSeasonEvidence"'), 'V3 candidate certification does not own isolated evidence storage.');
assert(certification.includes('validation.getAllSeasonLabels()'), 'V3 candidate certification does not enumerate every supported season.');
assert(certification.includes('validation.evaluatePrompt(player, season, prompt.label)'), 'V3 candidate certification is not grounded in the shared Validation Engine.');
assert(certification.includes('test.technical !== "pass"'), 'V3 candidate certification does not require the real database Test first.');
assert(certification.includes('NO MATCH is not a technical failure'), 'V3 all-season evidence does not distinguish natural no-match seasons from technical failure.');
assert(certification.includes('runtimeErrors === 0') && certification.includes('zeroMinuteAccepted === 0'), 'V3 candidate certification does not enforce runtime/zero-minute technical safety.');
assert(certification.includes('evidence.fingerprint !== fingerprint(prompt)'), 'V3 candidate certification does not detect stale evidence.');
assert(!certification.includes('qualityReview ='), 'V3 candidate certification must never write human quality review state.');
assert(!certification.includes('prompt.status ='), 'V3 candidate certification must never change prompt lifecycle state.');
assert(!certification.includes('prompt.enabled = true'), 'V3 candidate certification must never enable a prompt.');
assert(!certification.includes('FPL_REPOSITORY_CERTIFIED_PROMPT_POOL'), 'V3 candidate certification must not mutate or depend on the production pool.');

const supportedBlock = generator.match(/const SUPPORTED_FAMILIES = Object\.freeze\(new Set\(\[([\s\S]*?)\]\)\);/);
const supportedFamilyCount = supportedBlock ? (supportedBlock[1].match(/"[a-z0-9-]+"/g) || []).length : 0;
assert(supportedFamilyCount >= 15, `V3 deliberate generator supports too few families (${supportedFamilyCount}); expected at least 15.`);

const familyCount = (registry.match(/^    \["/gm) || []).length;
assert(familyCount >= 30, `V3 family registry is too small (${familyCount}); expected at least 30 families.`);
for (const family of ['league-position','career-consistency','career-peak','comeback','one-club','one-season-wonder','era-crossover','premium-disappointment','cross-season-achievement','composite-story']) {
  assert(registry.includes(`"${family}"`), `V3 family registry is missing ${family}.`);
}

assert(manifest.manifestVersion === '1.10.1-prompt-studio-v3-add-all', 'Central manifest is not on the V3 Add all version.');
assert(manifest.assets.promptStudioV3?.path === 'js/prompt-studio-v3-clean-room.js', 'V3 runtime is not manifest-owned.');
assert(manifest.assets.promptFamilyRegistryV3?.path === 'js/prompt-family-registry-v3.js', 'V3 family registry is not manifest-owned.');
assert(manifest.assets.promptStudioV3RuleTester?.path === 'js/prompt-studio-v3-rule-tester.js', 'V3 safe builder/database tester is not manifest-owned.');
assert(manifest.assets.promptStudioV3RuleTester?.version === '3.1.1', 'V3 safe builder/database tester cache version is stale.');
assert(manifest.assets.promptStudioV3QualityAdvisor?.path === 'js/prompt-studio-v3-quality-advisor.js', 'V3 quality advisor is not manifest-owned.');
assert(manifest.assets.promptStudioV3QualityAdvisor?.version === '3.2.0', 'V3 quality advisor cache version is stale.');
assert(manifest.assets.promptStudioV3CandidateGenerator?.path === 'js/prompt-studio-v3-candidate-generator.js', 'V3 candidate generator is not manifest-owned.');
assert(manifest.assets.promptStudioV3CandidateGenerator?.version === '3.3.1', 'V3 candidate generator cache version is stale.');
assert(manifest.assets.promptStudioV3CandidateCertification?.path === 'js/prompt-studio-v3-candidate-certification.js', 'V3 candidate certification is not manifest-owned.');
assert(manifest.assets.promptStudioV3CandidateCertification?.version === '3.4.0', 'V3 candidate certification cache version is stale.');
assert(bootstrap.includes('function ensurePromptV3()'), 'Studio bootstrap does not own V3 loading.');
assert(bootstrap.includes('loadAsset("promptFamilyRegistryV3"'), 'V3 registry is not loaded by bootstrap.');
assert(bootstrap.includes('loadAsset("promptStudioV3"'), 'V3 runtime is not loaded by bootstrap.');
assert(bootstrap.includes('loadAsset("promptStudioV3RuleTester"'), 'V3 safe builder/database tester is not loaded by bootstrap.');
assert(bootstrap.includes('loadAsset("promptStudioV3QualityAdvisor"'), 'V3 advisory quality layer is not loaded by bootstrap.');
assert(bootstrap.includes('loadAsset("promptStudioV3CandidateGenerator"'), 'V3 deliberate candidate generator is not loaded by bootstrap.');
assert(bootstrap.includes('loadAsset("promptStudioV3CandidateCertification"'), 'V3 candidate all-season certification is not loaded by bootstrap.');

console.log(`Prompt Studio V3 verification passed: zero-start isolation, ${familyCount} registered families, ${supportedFamilyCount} deliberate generator families, confirmed Add all draft-only bulk import, natural safe rule mapping, real database testing, advisory-only quality evidence, read-only all-season candidate certification, manual quality/approval, and frozen legacy production remain separate.`);
