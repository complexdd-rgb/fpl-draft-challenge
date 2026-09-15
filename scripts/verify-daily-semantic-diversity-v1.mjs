import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/daily-semantic-diversity-v1.js', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const answerSets = new Map();
const sandbox = {
  window: {
    __TEST_LIBRARY: [],
    FPL_STUDIO_API: {
      getPromptStats(prompt) {
        const values = answerSets.get(String(prompt?.id || '')) || [];
        if (!values.length) return null;
        return {
          bestAnswer: values[0],
          bestByPlayer: { values: () => values }
        };
      },
      getPromptLibrary() {
        return sandbox.window.__TEST_LIBRARY;
      }
    }
  },
  document: {
    querySelector(selector) {
      return selector === '#batchStartDate' ? { value: '2026-09-15' } : null;
    }
  }
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(source, sandbox, { filename: 'js/daily-semantic-diversity-v1.js' });
const api = sandbox.window.FPL_DAILY_SEMANTIC_DIVERSITY;
assert(api?.version === '1.0.0', 'Semantic diversity API did not initialise.');
assert(api?.policyRevision === '1.1.0', 'Top-answer diversity policy revision did not initialise.');

const record = (id, family, position, conditions, variantGroup = '') => ({ id, family, position, conditions, variantGroup });
const prompt = (id, label, family, position, recordValue) => ({
  id, label, family, position,
  semanticDiversity: api.fromRecord(recordValue, position, label)
});

const moyes50Record = record('moyes50', 'manager', 'MID', [
  { field: 'manager', operator: 'includes', value: 'David Moyes' },
  { field: 'points', operator: 'gte', value: 50 }
], 'manager-points');
const moyes60Record = record('moyes60', 'manager', 'MID', [
  { field: 'manager', operator: 'includes', value: 'David Moyes' },
  { field: 'points', operator: 'gte', value: 60 }
], 'manager-points');
const moyes80Record = record('moyes80', 'manager', 'MID', [
  { field: 'manager', operator: 'includes', value: 'David Moyes' },
  { field: 'points', operator: 'gte', value: 80 }
], 'manager-points');
const pepRecord = record('pep60', 'manager', 'MID', [
  { field: 'manager', operator: 'includes', value: 'Pep Guardiola' },
  { field: 'points', operator: 'gte', value: 60 }
], 'manager-points');

const moyes50 = prompt('moyes50', 'Midfielder managed by David Moyes and with at least 50 FPL points', 'manager', 'MID', moyes50Record);
const moyes60 = prompt('moyes60', 'Midfielder managed by David Moyes and with at least 60 FPL points', 'manager', 'MID', moyes60Record);
const moyes80 = prompt('moyes80', 'Midfielder managed by David Moyes and with at least 80 FPL points', 'manager', 'MID', moyes80Record);
const pep60 = prompt('pep60', 'Midfielder managed by Pep Guardiola and with at least 60 FPL points', 'manager', 'MID', pepRecord);

assert(api.dayClash(moyes50, moyes60), 'David Moyes threshold variants were not recognised as a same-day clash.');
assert(api.dayClash(moyes60, moyes80), 'David Moyes threshold variants with a wider threshold gap were not recognised as similar.');
assert(!api.sharedHardKeys(moyes60, pep60).some(key => key.startsWith('entity:manager:')), 'Different managers were incorrectly collapsed into the same manager entity.');
assert(api.fromRecord(moyes50Record, 'MID').concept === api.fromRecord(moyes80Record, 'MID').concept, 'Numeric point thresholds were not normalised out of the manager concept.');

const bonusAssistsRecord = record('bonus_assists', 'combined-stats', 'DEF', [
  { field: 'assists', operator: 'gte', value: 3 },
  { field: 'bonus', operator: 'gte', value: 26 }
]);
const bonusPointsRecord = record('bonus_points', 'combined-stats', 'DEF', [
  { field: 'points', operator: 'gte', value: 145 },
  { field: 'bonus', operator: 'gte', value: 26 }
]);
const bonusPoints27Record = record('bonus_points_27', 'combined-stats', 'DEF', [
  { field: 'points', operator: 'gte', value: 55 },
  { field: 'bonus', operator: 'gte', value: 27 }
]);
const noBonusRecord = record('points_gi', 'combined-stats', 'DEF', [
  { field: 'points', operator: 'gte', value: 145 },
  { field: 'goalInvolvements', operator: 'gte', value: 4 }
]);

const bonusAssists = prompt('bonus_assists', 'Defender with 3 assists and 26 bonus points', 'combined-stats', 'DEF', bonusAssistsRecord);
const bonusPoints = prompt('bonus_points', 'Defender with 145 points and 26 bonus points', 'combined-stats', 'DEF', bonusPointsRecord);
const bonusPoints27 = prompt('bonus_points_27', 'Defender with 55 points and 27 bonus points', 'combined-stats', 'DEF', bonusPoints27Record);
const noBonus = prompt('points_gi', 'Defender with 145 points and 4 goal involvements', 'combined-stats', 'DEF', noBonusRecord);

assert(api.dayClash(bonusAssists, bonusPoints), 'Bonus-point variants with different secondary stats were not recognised as similar.');
assert(api.dayClash(bonusPoints, bonusPoints27), 'Bonus-point threshold variants were not recognised as similar.');
assert(api.sharedHardKeys(bonusAssists, bonusPoints).includes('rare:bonus'), 'Bonus-point clash did not use the global rare-stat key.');
assert(!api.dayClash(bonusAssists, noBonus), 'A non-bonus combined-stat concept was incorrectly blocked by the bonus guard.');

const issueMessages = api.dayIssues([bonusAssists, bonusPoints, moyes50, moyes60]);
assert(issueMessages.some(issue => issue.key === 'rare:bonus'), 'Day validator did not report the bonus cluster.');
assert(issueMessages.some(issue => issue.key === 'entity:manager:david-moyes'), 'Day validator did not report the David Moyes cluster.');

// Start the counter through the policy itself so the Map belongs to the same VM realm as the
// policy functions. Browser generation naturally runs in one realm; this keeps the test honest.
let counts = api.commitWeekly({ ...bonusPoints, id: 'bonus-0' }, null);
for (let index = 1; index < 7; index += 1) {
  const item = { ...bonusPoints, id: `bonus-${index}` };
  assert(api.canAddWeekly(item, counts, 7), `Weekly semantic cap blocked bonus prompt ${index + 1} too early.`);
  counts = api.commitWeekly(item, counts);
}
assert(!api.canAddWeekly({ ...bonusPoints, id: 'bonus-8' }, counts, 7), 'Weekly semantic cap allowed an eighth bonus prompt into a seven-day reservoir.');

const pressureSix = api.remainingPressure(Array.from({ length: 6 }, (_, index) => ({ ...moyes50, id: `moyes-${index}` })), 6);
assert(pressureSix.required.has('entity:manager:david-moyes'), 'A six-prompts/six-days manager backlog was not marked as required today.');
const pressureSeven = api.remainingPressure(Array.from({ length: 7 }, (_, index) => ({ ...moyes50, id: `moyes-${index}` })), 6);
assert(pressureSeven.impossible.has('entity:manager:david-moyes'), 'A seven-prompts/six-days manager backlog was not marked impossible.');
assert(api.missingRequiredKeys([moyes50], pressureSix.required).length === 0, 'Required semantic pressure was not satisfied by a matching prompt.');
assert(api.missingRequiredKeys([pep60], pressureSix.required).includes('entity:manager:david-moyes'), 'A different manager incorrectly satisfied David Moyes pressure.');

const answerRecord = (playerId, playerName, points) => ({ playerId, playerName, name: playerName, points });
const leaderA = { id: 'leader-a', label: 'Leader A prompt', family: 'season-stats', position: 'MID' };
const sameLeader = { id: 'same-leader', label: 'Same leader prompt', family: 'position-stat', position: 'MID' };
const sharedPodium = { id: 'shared-podium', label: 'Shared podium prompt', family: 'club-stat', position: 'MID' };
const freshAnswers = { id: 'fresh-answers', label: 'Fresh answers prompt', family: 'anti-meta', position: 'MID' };
answerSets.set('leader-a', [
  answerRecord('p1', 'One Player', 220), answerRecord('p2', 'Two Player', 190), answerRecord('p3', 'Three Player', 180)
]);
answerSets.set('same-leader', [
  answerRecord('p1', 'One Player', 210), answerRecord('p4', 'Four Player', 185), answerRecord('p5', 'Five Player', 170)
]);
answerSets.set('shared-podium', [
  answerRecord('p6', 'Six Player', 215), answerRecord('p1', 'One Player', 200), answerRecord('p7', 'Seven Player', 175)
]);
answerSets.set('fresh-answers', [
  answerRecord('p8', 'Eight Player', 205), answerRecord('p9', 'Nine Player', 190), answerRecord('p10', 'Ten Player', 180)
]);

const profile = api.topAnswerProfile(leaderA);
assert(profile.leaderId === 'p1', 'Top-answer profile did not identify the highest-points player as leader.');
assert(profile.top3Ids.join('|') === 'p1|p2|p3', 'Top-answer profile did not retain the expected top three answer players.');

const answerCounts = api.commitWeekly(leaderA, null);
const sameLeaderLoad = api.weeklyLoad(sameLeader, answerCounts);
const sharedPodiumLoad = api.weeklyLoad(sharedPodium, answerCounts);
const freshLoad = api.weeklyLoad(freshAnswers, answerCounts);
assert(sameLeaderLoad > sharedPodiumLoad, 'Repeated #1 answer was not penalised more strongly than top-three overlap.');
assert(sharedPodiumLoad > freshLoad, 'Top-three answer overlap was not penalised across the weekly reservoir.');

sandbox.window.__TEST_LIBRARY = [leaderA, sameLeader, sharedPodium, freshAnswers];
sandbox.window.FPL_CHALLENGE_MANIFEST = {
  challenges: [{ date: '2026-09-14', promptIds: ['leader-a'] }]
};
const recentLeaderLoad = api.recentAnswerLoad(sameLeader);
const recentPodiumLoad = api.recentAnswerLoad(sharedPodium);
const recentFreshLoad = api.recentAnswerLoad(freshAnswers);
assert(recentLeaderLoad > recentPodiumLoad, 'Previous-week leader carry-over was not penalised more strongly than top-three carry-over.');
assert(recentPodiumLoad > recentFreshLoad, 'Previous-week top-three carry-over pressure was not applied.');

console.log('Daily semantic diversity v1 verified: semantic clashes still work, weekly one-per-day pressure is preserved, repeated #1/top-three answer players are down-ranked across the reservoir, and the previous seven days add carry-over pressure.');
