import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(path, 'utf8');
const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};

const providerSource = read('js/prompt-career-evolution-family-generator.js');
for (const [token, label] of [
  ['career-evolution:season-improvement', 'season-to-season improvement family'],
  ['career-evolution:career-streak', 'career streak family'],
  ['career-evolution:position-journey', 'position journey family'],
  ['career-evolution:club-status-journey', 'club/status journey family'],
  ['career-evolution:nationality-career', 'nationality × career family'],
  ['career-evolution:manager-journey', 'manager journey family'],
  ['maxClubSwitchPointsGain', 'club-switch success metric'],
  ['bounceBack120After70', 'bounce-back metric'],
  ['sameManagerDifferentClubs', 'same-manager different-club metric']
]) requireText(providerSource, token, label);

const careerSource = read('js/career-context.js');
for (const token of [
  'FPL career relationship context · v1.5.0',
  'window.FPL_CAREER_EVOLUTION_CONTEXT',
  '_careerEvolution',
  'maxConsecutive2000Minutes',
  'maxConsecutive100Points',
  'maxConsecutiveScoringSeasons',
  'tableBandCount',
  'nationalityForPlayer'
]) requireText(careerSource, token, 'career evolution context');

const admin = read('admin.html');
requireText(admin, 'id="factoryIncludeCareerEvolutionFamilies"', 'main-generator Career Evolution checkbox');
requireText(admin, 'js/career-context.js?v=1.5.0', 'Studio career-context cache bust');
const index = read('index.html');
requireText(index, 'js/career-context.js?v=1.5.0', 'live-game career-context cache bust');

const base = read('js/admin-import-tools-base.js');
for (const token of [
  'includeCareerEvolutionFamilies: document.querySelector("#factoryIncludeCareerEvolutionFamilies")',
  'js/prompt-career-evolution-family-generator.js?v=1.0.0',
  'window.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR',
  'includeCareerEvolutionFamilies })',
  'Career Evolution</span>',
  'Career evolution</span>'
]) requireText(base, token, 'main-generator Career Evolution integration');

for (const path of ['js/prompt-target-survivor-generator.js', 'js/prompt-target-auto-explorer.js']) {
  const source = read(path);
  requireText(source, 'factoryIncludeCareerEvolutionFamilies', `${path} setting persistence`);
  requireText(source, 'includeCareerEvolutionFamilies', `${path} Career Evolution setting`);
}

const controls = new Map([
  ['factoryPositionMix', { value: 'balanced' }],
  ['factoryPromptCount', { value: '50' }],
  ['factoryDifficultyMix', { value: 'balanced' }],
  ['factoryCooldown', { value: '10' }],
  ['factoryEnablePrompts', { checked: true }]
]);
const document = {
  readyState: 'complete',
  documentElement: { dataset: {} },
  getElementById: id => controls.get(id) || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  head: { appendChild: () => {} },
  createElement: () => ({ addEventListener: () => {}, dataset: {}, style: {}, appendChild: () => {} }),
  write: () => {}
};
const sandbox = {
  console,
  document,
  location: { pathname: '/test.html' },
  setTimeout: () => 0,
  clearTimeout: () => {},
  CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  Event: class Event { constructor(type) { this.type = type; } }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const run = path => vm.runInContext(read(path), sandbox, { filename: path });

run('players.js');
run('js/career-context.js');
run('js/career-shape-rules.js');
run('nationality-enrichment.js');
run('js/prompt-career-evolution-family-generator.js');

const players = Array.isArray(sandbox.FPL_PLAYERS) ? sandbox.FPL_PLAYERS : [];
const positiveRows = players.flatMap(player => (player.seasons || []).filter(record => Number(record.minutes) > 0));
const withEvolution = positiveRows.filter(record => record._careerEvolution);
if (withEvolution.length !== positiveRows.length || withEvolution.length < 1000) {
  throw new Error(`Career Evolution context attached to ${withEvolution.length}/${positiveRows.length} positive-minute rows.`);
}

const evolutionRows = [...new Map(withEvolution.map(record => [String(record._careerEvolution.playerId), record._careerEvolution])).values()];
const metricChecks = {
  pointsGain: evolutionRows.filter(item => Number.isFinite(Number(item.maxPointsGain))).length,
  goalGain: evolutionRows.filter(item => Number.isFinite(Number(item.maxGoalsGain))).length,
  multiPosition: evolutionRows.filter(item => Number(item.positionCount) >= 2).length,
  statusBands: evolutionRows.filter(item => Number(item.tableBandCount) >= 2).length,
  managerJourney: evolutionRows.filter(item => item.sameManagerDifferentClubs === true).length,
  minutesStreak: evolutionRows.filter(item => Number(item.maxConsecutive2000Minutes) >= 2).length
};
for (const [name, count] of Object.entries(metricChecks)) {
  if (count < 3) throw new Error(`Career Evolution metric ${name} has only ${count} players; expected usable real-data coverage.`);
}

const nationalityResolved = players.filter(player => {
  const stored = String(player?.bio?.nationality || '').trim();
  return stored && sandbox.FPL_CAREER_EVOLUTION_CONTEXT?.nationalityForPlayer?.(player.playerId) === stored;
}).length;
if (nationalityResolved < 500) throw new Error(`Dynamic Career Evolution nationality lookup resolved only ${nationalityResolved} players.`);

const provider = sandbox.FPL_CAREER_EVOLUTION_FAMILY_GENERATOR;
if (!provider?.buildBatch || provider.version !== '1.0.0') throw new Error('Career Evolution provider API is not ready.');
const batch = provider.buildBatch();
if (batch.length < 12) throw new Error(`Career Evolution provider generated only ${batch.length} checked candidates.`);
const families = new Set(batch.map(item => String(item.family || '').replace('career-evolution:', '')));
if (families.size < 4) throw new Error(`Career Evolution batch covered only ${families.size} families: ${[...families].join(', ')}`);
for (const item of batch) {
  if (item.rating !== 5 || !(item.stats?.playerCount >= 6)) throw new Error(`Non-5★ Career Evolution candidate escaped: ${item.id}`);
  const serialised = provider.serialise(item);
  if (!serialised.tags?.includes('career-evolution') || serialised.rating !== 5 || !serialised.testSource) {
    throw new Error(`Career Evolution serialisation is incomplete for ${item.id}`);
  }
}

console.log(`Career Evolution verified: ${evolutionRows.length} careers derived; ${batch.length} checked candidates across ${families.size} selected families. Metrics ${JSON.stringify(metricChecks)}.`);
