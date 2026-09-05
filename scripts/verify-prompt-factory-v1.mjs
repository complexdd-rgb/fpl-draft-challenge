import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-factory-v1.js', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const seasons = [
  { season:'2024/25', club:'Alpha', position:'MID', minutes:2800, points:150, goals:12, assists:10, cleanSheets:8, bonus:20, saves:0, goalsConceded:30, startingPrice:7.0, ageAtSeasonStart:25, yellowCards:4, redCards:0, leaguePosition:5, topFour:false, bottomHalf:false, relegated:false, promoted:false, champions:false, managers:['Alex Coach'] },
  { season:'2023/24', club:'Beta', position:'MID', minutes:2400, points:125, goals:8, assists:9, cleanSheets:6, bonus:15, saves:0, goalsConceded:38, startingPrice:6.0, ageAtSeasonStart:24, yellowCards:6, redCards:0, leaguePosition:12, topFour:false, bottomHalf:true, relegated:false, promoted:true, champions:false, managers:['Bea Boss'] }
];

const players = [
  { playerId:'p1', name:'One Player', bio:{ nationality:'England' }, seasons },
  { playerId:'p2', name:'Two Player', bio:{ nationality:'France' }, seasons:seasons.map((record,index) => ({ ...record, club:index ? 'Gamma' : 'Alpha', points:record.points - 25, goals:record.goals - 3, assists:record.assists - 2, startingPrice:5.5, managers:['Alex Coach'] })) },
  { playerId:'p3', name:'Three Player', bio:{ nationality:'France' }, seasons:seasons.map((record,index) => ({ ...record, club:index ? 'Delta' : 'Alpha', position:index ? 'DEF' : 'MID', points:record.points - 45, goals:Math.max(1,record.goals - 6), assists:Math.max(1,record.assists - 4), cleanSheets:10, startingPrice:4.5, bottomHalf:index === 1, relegated:index === 1, managers:['Alex Coach'] })) },
  { playerId:'p4', name:'Four Player', bio:{ nationality:'Brazil' }, seasons:seasons.map((record,index) => ({ ...record, club:index ? 'Epsilon' : 'Alpha', position:index ? 'FWD' : 'MID', points:record.points - 60, goals:Math.max(2,record.goals - 5), assists:Math.max(1,record.assists - 6), startingPrice:5.0, outsideBigSix:true, managers:['Bea Boss'] })) }
];

const canonical = [];
const documentStub = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  documentElement: { dataset:{} }
};

const sandbox = {
  window: { FPL_PLAYERS:players, FPL_PROMPT_LIBRARY:canonical },
  document: documentStub,
  console,
  CustomEvent: class CustomEvent { constructor(type, options={}) { this.type=type; this.detail=options.detail; } },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  queueMicrotask,
  MutationObserver: class MutationObserver { observe() {} }
};
sandbox.window.window = sandbox.window;
sandbox.window.document = documentStub;
sandbox.window.dispatchEvent = () => true;

vm.runInNewContext(source, sandbox, { filename:'prompt-factory-v1.js' });
const factory = sandbox.window.FPL_PROMPT_FACTORY_V1;
assert(factory?.ready === true, 'Prompt Factory API did not initialise.');
assert(factory.version === '1.0.0', 'Prompt Factory version mismatch.');
assert(factory.families.length === 17, `Expected 17 families, found ${factory.families.length}.`);

const seasonStats = await factory.runFamily('season-stats', { renderProgress:false });
assert(seasonStats.generated > 0, 'Season-stat family generated no candidates.');
assert(seasonStats.evaluated === seasonStats.generated, 'Season-stat family did not evaluate every generated candidate.');
assert(seasonStats.playable > 0, 'Season-stat family found no playable candidates in the smoke dataset.');

const nationality = await factory.runFamily('nationality', { renderProgress:false });
assert(nationality.generated > 0, 'Nationality family generated no candidates.');
assert(nationality.candidates.some(item => item.conditions.some(condition => condition.field === 'nationality')), 'Nationality candidates do not contain nationality conditions.');

const value = await factory.runFamily('value', { renderProgress:false });
assert(value.generated > 0, 'Value family generated no candidates.');
assert(value.candidates.some(item => item.conditions.some(condition => condition.field === 'startingPrice')), 'Value candidates do not contain starting-price conditions.');

assert(canonical.length === 0, 'Prompt Factory mutated the canonical prompt library during candidate exploration.');
assert(sandbox.window.FPL_PROMPT_LIBRARY.length === 0, 'Prompt Factory published candidates into window.FPL_PROMPT_LIBRARY.');

console.log(`Prompt Factory behavioural smoke test passed: ${seasonStats.generated} season-stat, ${nationality.generated} nationality and ${value.generated} value candidates explored without publishing.`);
