import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/daily-semantic-diversity-v1.js', 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sandbox = { window: {} };
sandbox.window.window = sandbox.window;
vm.runInNewContext(source, sandbox, { filename: 'js/daily-semantic-diversity-v1.js' });
const api = sandbox.window.FPL_DAILY_SEMANTIC_DIVERSITY;
assert(api?.version === '1.0.0', 'Semantic diversity API did not initialise.');

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

const counts = new Map();
for (let index = 0; index < 7; index += 1) {
  const item = { ...bonusPoints, id: `bonus-${index}` };
  assert(api.canAddWeekly(item, counts, 7), `Weekly semantic cap blocked bonus prompt ${index + 1} too early.`);
  api.commitWeekly(item, counts);
}
assert(!api.canAddWeekly({ ...bonusPoints, id: 'bonus-8' }, counts, 7), 'Weekly semantic cap allowed an eighth bonus prompt into a seven-day reservoir.');

const pressureSix = api.remainingPressure(Array.from({ length: 6 }, (_, index) => ({ ...moyes50, id: `moyes-${index}` })), 6);
assert(pressureSix.required.has('entity:manager:david-moyes'), 'A six-prompts/six-days manager backlog was not marked as required today.');
const pressureSeven = api.remainingPressure(Array.from({ length: 7 }, (_, index) => ({ ...moyes50, id: `moyes-${index}` })), 6);
assert(pressureSeven.impossible.has('entity:manager:david-moyes'), 'A seven-prompts/six-days manager backlog was not marked impossible.');
assert(api.missingRequiredKeys([moyes50], pressureSix.required).length === 0, 'Required semantic pressure was not satisfied by a matching prompt.');
assert(api.missingRequiredKeys([pep60], pressureSix.required).includes('entity:manager:david-moyes'), 'A different manager incorrectly satisfied David Moyes pressure.');

console.log('Daily semantic diversity v1 verified: David Moyes threshold variants and defender bonus clusters are blocked on the same day, weekly one-per-day pressure is enforced, and distinct concepts remain available.');
