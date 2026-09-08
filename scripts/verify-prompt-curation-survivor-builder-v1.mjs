import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-curation-survivor-builder-v1.js', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const sandbox = { window: {}, console, setTimeout, clearTimeout };
vm.runInNewContext(source, sandbox, { filename:'prompt-curation-survivor-builder-v1.js' });
const api = sandbox.window.FPL_PROMPT_CURATION_SURVIVOR_BUILDER_V1;
assert(api?.ready === true, 'Survivor Builder API did not initialise.');
assert(api.version === '1.2.0', 'Survivor Builder version mismatch.');
assert(api.minQuality === 65, 'Default survivor proposal quality floor mismatch.');

const record = (id, quality, answers, conditions, difficulty = 'easy', label = id) => ({
  schemaVersion:1, id, label, family:'anti-meta', position:'ANY', variantGroup:'vg_test',
  conditions, qualityStatus:'pass', qualityScore:quality, difficulty,
  qualityEvidence:{ answerPlayers:answers, seasons:15, clubs:20, coverage:100, variantGroupSize:8 }, enabled:true
});
const cond = value => [{ field:'points', operator:'gte', value }];
const sourcePackage = {
  kind:'fpl-prompt-library-family-shards',
  manifest:{ promotionFingerprint:'test_fp', total:8, families:1, variantGroups:1 },
  shards:[{ family:'anti-meta', count:8, records:[
    record('decorative_same', 100, 20, cond(10)),
    record('clean_same_weaker', 85, 20, cond(20)),
    record('clean_same_best', 95, 20, cond(25)),
    record('lane_best', 96, 40, cond(40), 'medium'),
    record('lane_weaker', 90, 35, cond(45), 'medium'),
    record('hard_lane', 89, 10, cond(70), 'hard'),
    record('unique_three', 88, 5, [{ field:'goals', operator:'gte', value:1 }], 'hard', 'Player with at least 1 goals'),
    record('below_floor', 60, 6, cond(95), 'hard')
  ] }]
};
const evidenceRecord = (id, fingerprint, representativeId, classSize, { decorative = 0, answers = 20, marginal = 50, neighbour = null, field = 'points' } = {}) => ({
  id, family:'anti-meta', variantGroup:'vg_test', position:'ANY', conditionCount:1, numericConditionCount:1,
  answerPlayers:answers, storedAnswerPlayers:answers, answerCountMatchesStored:true, answerFingerprint:fingerprint,
  conditionMarginality:[{ index:0, field, operator:'gte', value:1, withoutConditionPlayers:answers + 10, addedPlayers:decorative ? 0 : 10, marginalPctOfWithout:decorative ? 0 : marginal, decorative:Boolean(decorative) }],
  decorativeConditionCount:decorative, minConditionAddedPlayers:decorative ? 0 : 10,
  exactEquivalentClassSize:classSize, exactEquivalentRepresentativeId:representativeId, exactEquivalentRank:1,
  axisNeighbor:neighbour
});
const evidence = {
  kind:'fpl-prompt-curation-evidence', evidenceVersion:'1.0.0', generatedAt:'2026-09-08T00:00:00Z',
  source:{ promotionFingerprint:'test_fp', total:8, families:1, variantGroups:1 },
  summary:{ prompts:8, storedAnswerCountMismatches:0, promptsWithDecorativeCondition:1, promptsWithExactEquivalentSibling:3, promptsWithAxisNeighborJaccard95Plus:2 },
  evidenceShards:[{ family:'anti-meta', count:8, records:[
    evidenceRecord('decorative_same','20:aaaa','decorative_same',3,{ decorative:1, answers:20 }),
    evidenceRecord('clean_same_weaker','20:aaaa','decorative_same',3,{ answers:20, marginal:35 }),
    evidenceRecord('clean_same_best','20:aaaa','decorative_same',3,{ answers:20, marginal:70 }),
    evidenceRecord('lane_best','40:bbbb','lane_best',1,{ answers:40, marginal:70, neighbour:{ id:'lane_weaker', jaccard:0.93, identicalAnswerSet:false, conditionIndex:0, siblingConditionIndex:0 } }),
    evidenceRecord('lane_weaker','35:bbbc','lane_weaker',1,{ answers:35, marginal:65, neighbour:{ id:'lane_best', jaccard:0.93, identicalAnswerSet:false, conditionIndex:0, siblingConditionIndex:0 } }),
    evidenceRecord('hard_lane','10:cccc','hard_lane',1,{ answers:10, marginal:75 }),
    evidenceRecord('unique_three','5:dddd','unique_three',1,{ answers:5, marginal:80, field:'goals' }),
    evidenceRecord('below_floor','6:eeee','below_floor',1,{ answers:6, marginal:80 })
  ] }]
};

const proposal = api.buildProposalFromData(sourcePackage, evidence, { targets:{ 'anti-meta':5 } });
assert(proposal.kind === 'fpl-prompt-curation-survivor-proposal', 'Proposal kind mismatch.');
assert(proposal.summary.sourcePrompts === 8, 'Source total changed.');
assert(proposal.summary.hardRejectedDecorative === 1, 'Decorative hard reject was not recorded.');
assert(proposal.summary.collapsedExactEquivalentSiblings === 1, 'Clean exact-equivalent sibling was not collapsed.');
assert(proposal.summary.cleanExactRepresentatives === 6, 'Clean exact-class representative count is wrong.');
assert(proposal.summary.eligibleCleanRepresentatives === 5, 'Default quality floor did not reduce the eligible clean class set.');
assert(proposal.summary.materialCells === 4, 'Material-lane compression did not create the expected representative cells.');
assert(proposal.summary.deferredMaterialLaneCompression === 1, 'Same-lane monotonic sibling was not deferred.');
assert(proposal.summary.selected === 4, 'Family envelope was incorrectly treated as a quota after material compression.');
assert(proposal.summary.effectiveEligibleCeiling === 4, 'Effective eligible ceiling is wrong.');
assert(proposal.summary.deferredBelowQualityFloor === 1, 'Below-floor clean representative was not deferred.');
assert(proposal.summary.labelNormalisations === 1, 'Survivor singular/plural cleanup was not counted.');

const decisions = proposal.decisionShards.flatMap(shard => shard.records);
const byId = new Map(decisions.map(item => [item.id, item]));
assert(byId.get('decorative_same')?.status === 'HARD_REJECT' && byId.get('decorative_same')?.reason === 'decorative-condition', 'Decorative prompt survived hard collapse.');
assert(byId.get('clean_same_weaker')?.status === 'COLLAPSE', 'Weaker clean exact sibling did not collapse.');
assert(byId.get('clean_same_weaker')?.representativeId === 'clean_same_best', 'Exact class did not choose the strongest clean representative.');
assert(byId.get('lane_weaker')?.status === 'DEFER' && byId.get('lane_weaker')?.reason === 'same-monotonic-answer-band-lane', 'Same-lane monotonic sibling was not safely deferred.');
assert(byId.get('lane_weaker')?.representativeId === 'lane_best', 'Material lane did not retain the strongest representative.');
assert(byId.get('below_floor')?.status === 'DEFER' && byId.get('below_floor')?.reason === 'below-default-quality-floor', 'Below-floor prompt was not deferred for possible manual review.');
const corrected = proposal.survivorShards.flatMap(shard => shard.records).find(item => item.id === 'unique_three');
assert(corrected?.label === 'Player with at least 1 goal', 'Selected survivor label was not normalised.');
assert(corrected?.sourceLabel === 'Player with at least 1 goals', 'Original survivor label provenance was not preserved.');
assert(Array.isArray(proposal.policy.materialCompressionRules) && proposal.policy.materialCompressionRules.length === 3, 'Material compression policy was not exported.');
assert(proposal.policy.dailyAuthorityChanged === false, 'Proposal incorrectly claims Daily authority.');
assert(source.includes('typeof raw === "boolean"'), 'Boolean conditions can still leak into numeric threshold scoring.');
assert(!source.includes('FPL_DAILY_GENERATION_PROMPT_POOL ='), 'Survivor Builder must not write the Daily prompt pool.');
assert(!source.includes('FPL_DAILY_GENERATION_FAMILY_PLAN ='), 'Survivor Builder must not write the Daily family plan.');
assert(source.includes('This does not alter Promotion, saved shards, Daily generation or publishing.'), 'Read-only boundary wording is missing.');

console.log('Prompt Curation Survivor Builder v1.2 verified: exact-answer collapse and the quality floor remain intact, repetitive monotonic answer-band lanes defer to one strong representative, family envelopes remain ceilings, wording provenance is preserved, and Daily authority remains untouched.');
