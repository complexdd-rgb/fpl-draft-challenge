import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-curation-survivor-builder-v1.js', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const sandbox = { window: {}, console, setTimeout, clearTimeout };
vm.runInNewContext(source, sandbox, { filename:'prompt-curation-survivor-builder-v1.js' });
const api = sandbox.window.FPL_PROMPT_CURATION_SURVIVOR_BUILDER_V1;
assert(api?.ready === true, 'Survivor Builder API did not initialise.');
assert(api.version === '1.0.0', 'Survivor Builder version mismatch.');

const record = (id, quality, answers, conditions, difficulty = 'easy') => ({
  schemaVersion:1, id, label:id, family:'anti-meta', position:'ANY', variantGroup:'vg_test',
  conditions, qualityStatus:'pass', qualityScore:quality, difficulty,
  qualityEvidence:{ answerPlayers:answers, seasons:15, clubs:20, coverage:100, variantGroupSize:6 }, enabled:true
});
const cond = value => [{ field:'points', operator:'gte', value }];
const sourcePackage = {
  kind:'fpl-prompt-library-family-shards',
  manifest:{ promotionFingerprint:'test_fp', total:6, families:1, variantGroups:1 },
  shards:[{ family:'anti-meta', count:6, records:[
    record('decorative_same', 100, 20, cond(10)),
    record('clean_same_weaker', 85, 20, cond(20)),
    record('clean_same_best', 95, 20, cond(25)),
    record('unique_one', 90, 40, cond(40), 'medium'),
    record('unique_two', 89, 10, cond(70), 'hard'),
    record('unique_three', 88, 5, cond(90), 'hard')
  ] }]
};
const evidenceRecord = (id, fingerprint, representativeId, classSize, { decorative = 0, answers = 20, marginal = 50, neighbour = null } = {}) => ({
  id, family:'anti-meta', variantGroup:'vg_test', position:'ANY', conditionCount:1, numericConditionCount:1,
  answerPlayers:answers, storedAnswerPlayers:answers, answerCountMatchesStored:true, answerFingerprint:fingerprint,
  conditionMarginality:[{ index:0, field:'points', operator:'gte', value:1, withoutConditionPlayers:answers + 10, addedPlayers:decorative ? 0 : 10, marginalPctOfWithout:decorative ? 0 : marginal, decorative:Boolean(decorative) }],
  decorativeConditionCount:decorative, minConditionAddedPlayers:decorative ? 0 : 10,
  exactEquivalentClassSize:classSize, exactEquivalentRepresentativeId:representativeId, exactEquivalentRank:1,
  axisNeighbor:neighbour
});
const evidence = {
  kind:'fpl-prompt-curation-evidence', evidenceVersion:'1.0.0', generatedAt:'2026-09-08T00:00:00Z',
  source:{ promotionFingerprint:'test_fp', total:6, families:1, variantGroups:1 },
  summary:{ prompts:6, storedAnswerCountMismatches:0, promptsWithDecorativeCondition:1, promptsWithExactEquivalentSibling:3, promptsWithAxisNeighborJaccard95Plus:2 },
  evidenceShards:[{ family:'anti-meta', count:6, records:[
    evidenceRecord('decorative_same','20:aaaa','decorative_same',3,{ decorative:1, answers:20 }),
    evidenceRecord('clean_same_weaker','20:aaaa','decorative_same',3,{ answers:20, marginal:35 }),
    evidenceRecord('clean_same_best','20:aaaa','decorative_same',3,{ answers:20, marginal:70 }),
    evidenceRecord('unique_one','40:bbbb','unique_one',1,{ answers:40, marginal:70, neighbour:{ id:'unique_two', jaccard:0.99, identicalAnswerSet:false, conditionIndex:0, siblingConditionIndex:0 } }),
    evidenceRecord('unique_two','10:cccc','unique_two',1,{ answers:10, marginal:75, neighbour:{ id:'unique_one', jaccard:0.99, identicalAnswerSet:false, conditionIndex:0, siblingConditionIndex:0 } }),
    evidenceRecord('unique_three','5:dddd','unique_three',1,{ answers:5, marginal:80 })
  ] }]
};

const proposal = api.buildProposalFromData(sourcePackage, evidence, { targets:{ 'anti-meta':2 } });
assert(proposal.kind === 'fpl-prompt-curation-survivor-proposal', 'Proposal kind mismatch.');
assert(proposal.summary.sourcePrompts === 6, 'Source total changed.');
assert(proposal.summary.hardRejectedDecorative === 1, 'Decorative hard reject was not recorded.');
assert(proposal.summary.collapsedExactEquivalentSiblings === 1, 'Clean exact-equivalent sibling was not collapsed.');
assert(proposal.summary.cleanExactRepresentatives === 4, 'Clean exact-class representative count is wrong.');
assert(proposal.summary.selected === 2, 'Family envelope was not applied.');
assert(proposal.summary.deferred === 2, 'Clean candidates outside the envelope were not deferred.');

const decisions = proposal.decisionShards.flatMap(shard => shard.records);
const byId = new Map(decisions.map(item => [item.id, item]));
assert(byId.get('decorative_same')?.status === 'HARD_REJECT' && byId.get('decorative_same')?.reason === 'decorative-condition', 'Decorative prompt survived hard collapse.');
assert(byId.get('clean_same_weaker')?.status === 'COLLAPSE', 'Weaker clean exact sibling did not collapse.');
assert(byId.get('clean_same_weaker')?.representativeId === 'clean_same_best', 'Exact class did not choose the strongest clean representative.');
assert(byId.get('clean_same_best')?.status === 'SELECT' || byId.get('clean_same_best')?.status === 'DEFER', 'Strongest clean exact representative disappeared.');
assert(proposal.policy.dailyAuthorityChanged === false, 'Proposal incorrectly claims Daily authority.');
assert(!source.includes('FPL_DAILY_GENERATION_PROMPT_POOL ='), 'Survivor Builder must not write the Daily prompt pool.');
assert(!source.includes('FPL_DAILY_GENERATION_FAMILY_PLAN ='), 'Survivor Builder must not write the Daily family plan.');
assert(source.includes('This does not alter Promotion, saved shards, Daily generation or publishing.'), 'Read-only boundary wording is missing.');

console.log('Prompt Curation Survivor Builder v1 verified: decorative prompts hard-reject, exact answer sets collapse to the strongest clean representative, family envelopes select a proposal only, and Daily authority remains untouched.');
