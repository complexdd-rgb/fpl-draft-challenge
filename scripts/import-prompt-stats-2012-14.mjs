import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const playersPath = 'players.js';
const reportPath = 'reports/statbunker-card-recovery-2012-14.json';

const SAVE_RECOVERY = [
  { season: '2012/13', club: 'Wigan', names: ['Ali Al-Habsi', 'Ali Al Habsi'], saves: 92, source: 'FBref 2012/13 Premier League goalkeeping totals; StatBunker historical table does not expose ordinary saves' },
  { season: '2012/13', club: 'Everton', names: ['Ján Mucha', 'Jan Mucha'], saves: 12, source: 'FBref 2012/13 Premier League goalkeeping totals; StatBunker historical table does not expose ordinary saves' },
  { season: '2012/13', club: 'QPR', names: ['Júlio César', 'Julio Cesar'], saves: 88, source: 'FBref 2012/13 Premier League goalkeeping totals; StatBunker historical table does not expose ordinary saves' },
  { season: '2012/13', club: 'Chelsea', names: ['Ross Turnbull'], saves: 5, source: 'FBref 2012/13 Premier League goalkeeping totals; StatBunker historical table does not expose ordinary saves' }
];

function installSandbox(source) {
  const sandbox = {
    window: { addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, location: { pathname: '/admin.html' } },
    console,
    setTimeout() { return 0; },
    clearTimeout() {}
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: playersPath, timeout: 30000 });
  const players = sandbox.window.FPL_PLAYERS;
  if (!Array.isArray(players) || !players.length) throw new Error('players.js did not expose window.FPL_PLAYERS.');
  return players;
}

const norm = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const isMissing = value => value === null || value === undefined || value === '';

function clubMatches(actual, expected) {
  const aliases = new Map([
    ['wigan', 'wigan athletic'], ['qpr', 'queens park rangers'], ['everton', 'everton'], ['chelsea', 'chelsea']
  ]);
  const a = aliases.get(norm(actual)) || norm(actual);
  const e = aliases.get(norm(expected)) || norm(expected);
  return a === e;
}

function findSeasonRow(players, playerId, season) {
  const player = players.find(p => p.playerId === playerId);
  if (!player) throw new Error(`Missing playerId ${playerId}`);
  const rows = (player.seasons || []).filter(r => r.season === season);
  if (rows.length !== 1) throw new Error(`Expected exactly one ${season} row for ${playerId}, found ${rows.length}`);
  return { player, row: rows[0] };
}

function findByIdentity(players, target) {
  const wantedNames = new Set(target.names.map(norm));
  const candidates = players.flatMap(player => (player.seasons || [])
    .filter(row => row.season === target.season && clubMatches(row.club, target.club) && wantedNames.has(norm(player.name)))
    .map(row => ({ player, row })));
  if (candidates.length !== 1) {
    throw new Error(`Expected one save target for ${target.names[0]} ${target.season} ${target.club}; found ${candidates.length}`);
  }
  return candidates[0];
}

const source = fs.readFileSync(playersPath, 'utf8');
const players = installSandbox(source);
const missingYellowBefore = players.reduce((n, player) => n + (player.seasons || []).filter(row => ['2012/13','2013/14'].includes(row.season) && isMissing(row.yellowCards)).length, 0);
const missingSavesBefore = SAVE_RECOVERY.filter(target => isMissing(findByIdentity(players, target).row.saves)).length;
const jacob = players.find(p => p.playerId === 'jacob-murphy');
const josh = players.find(p => p.playerId === 'josh-murphy');
const jacob1314 = (jacob?.seasons || []).find(r => r.season === '2013/14');
const josh1314 = (josh?.seasons || []).find(r => r.season === '2013/14');

let recoveredYellow = 0;
let recoveredRed = 0;
let migrated = 0;

if (missingYellowBefore > 0) {
  const result = spawnSync(process.execPath, ['scripts/recover-statbunker-cards-2012-14.mjs'], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`StatBunker recovery exited with status ${result.status}`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (report.unresolved?.length) throw new Error(`Refusing import with ${report.unresolved.length} unresolved StatBunker rows.`);
  if ((report.recoveries || []).length !== missingYellowBefore) {
    throw new Error(`Recovery count ${report.recoveries?.length || 0} does not match missing yellow-card count ${missingYellowBefore}.`);
  }

  for (const move of report.identityMigrations || []) {
    if (move.fromPlayerId !== 'jacob-murphy' || move.toPlayerId !== 'josh-murphy' || move.season !== '2013/14') {
      throw new Error(`Unexpected identity migration ${JSON.stringify(move)}`);
    }
    const from = players.find(p => p.playerId === move.fromPlayerId);
    const to = players.find(p => p.playerId === move.toPlayerId);
    if (!from || !to) throw new Error('Murphy migration players missing.');
    const fromIndex = (from.seasons || []).findIndex(r => r.season === move.season);
    if (fromIndex < 0) throw new Error('Jacob Murphy 2013/14 source row missing before migration.');
    if ((to.seasons || []).some(r => r.season === move.season)) throw new Error('Josh Murphy already has a 2013/14 row; refusing duplicate migration.');
    const [row] = from.seasons.splice(fromIndex, 1);
    if (Number(row.minutes) !== 139 || Number(row.points) !== 8 || norm(row.club) !== 'norwich') {
      throw new Error(`Unexpected Murphy source row: ${JSON.stringify(row)}`);
    }
    to.seasons ||= [];
    to.seasons.push(row);
    migrated += 1;
  }

  for (const recovery of report.recoveries || []) {
    const { row } = findSeasonRow(players, recovery.playerId, recovery.season);
    if (!isMissing(row.yellowCards) && Number(row.yellowCards) !== Number(recovery.yellowCards)) {
      throw new Error(`Yellow-card conflict for ${recovery.playerId} ${recovery.season}: ${row.yellowCards} vs ${recovery.yellowCards}`);
    }
    if (isMissing(row.yellowCards)) {
      row.yellowCards = Number(recovery.yellowCards);
      recoveredYellow += 1;
    }
    if (isMissing(row.redCards)) {
      row.redCards = Number(recovery.redCards);
      recoveredRed += 1;
    } else if (Number(row.redCards) !== Number(recovery.redCards)) {
      throw new Error(`Red-card conflict for ${recovery.playerId} ${recovery.season}: ${row.redCards} vs ${recovery.redCards}`);
    }
  }
} else if (jacob1314) {
  throw new Error('Yellow cards are complete but the Jacob/Josh 2013/14 identity migration is still unresolved.');
}

let recoveredSaves = 0;
for (const target of SAVE_RECOVERY) {
  const { row } = findByIdentity(players, target);
  if (isMissing(row.saves)) {
    row.saves = target.saves;
    recoveredSaves += 1;
  } else if (Number(row.saves) !== target.saves) {
    throw new Error(`Save conflict for ${target.names[0]} ${target.season}: ${row.saves} vs ${target.saves}`);
  }
}

const lines = source.split('\n');
if (!lines[1]?.startsWith('window.FPL_PLAYERS = ')) throw new Error('Unexpected players.js serialization layout.');
lines[1] = `window.FPL_PLAYERS = ${JSON.stringify(players)}`;
const output = lines.join('\n');
if (output !== source) fs.writeFileSync(playersPath, output);

const missingYellowAfter = players.reduce((n, player) => n + (player.seasons || []).filter(row => isMissing(row.yellowCards)).length, 0);
const missingRedAfter = players.reduce((n, player) => n + (player.seasons || []).filter(row => isMissing(row.redCards)).length, 0);
const missingSavesAfter = players.reduce((n, player) => n + (player.seasons || []).filter(row => isMissing(row.saves)).length, 0);
const finalJacob1314 = (players.find(p => p.playerId === 'jacob-murphy')?.seasons || []).find(r => r.season === '2013/14');
const finalJosh1314 = (players.find(p => p.playerId === 'josh-murphy')?.seasons || []).find(r => r.season === '2013/14');
if (finalJacob1314) throw new Error('Jacob Murphy still has the 2013/14 Norwich row after import.');
if (!finalJosh1314 || Number(finalJosh1314.minutes) !== 139 || Number(finalJosh1314.points) !== 8 || Number(finalJosh1314.yellowCards) !== 1) {
  throw new Error(`Josh Murphy 2013/14 migration audit failed: ${JSON.stringify(finalJosh1314)}`);
}
if (missingYellowAfter !== 0 || missingRedAfter !== 0 || missingSavesAfter !== 0) {
  throw new Error(`Prompt-stat completeness failed: yellow=${missingYellowAfter}, red=${missingRedAfter}, saves=${missingSavesAfter}`);
}

console.log(JSON.stringify({
  status: output === source ? 'already-applied' : 'applied',
  missingYellowBefore,
  missingSavesBefore,
  recoveredYellow,
  recoveredRed,
  recoveredSaves,
  migrated,
  missingYellowAfter,
  missingRedAfter,
  missingSavesAfter,
  saveSources: SAVE_RECOVERY.map(({ names, season, saves, source }) => ({ name: names[0], season, saves, source }))
}, null, 2));
