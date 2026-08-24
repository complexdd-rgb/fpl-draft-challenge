import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('players.js', 'utf8');
const sandbox = { window: { addEventListener() {}, removeEventListener() {} }, console, setTimeout() { return 0; }, clearTimeout() {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'players.js', timeout: 30000 });
const players = sandbox.window.FPL_PLAYERS;
if (!Array.isArray(players) || !players.length) throw new Error('players.js did not expose FPL_PLAYERS.');

const isMissing = value => value === null || value === undefined || value === '';
const missing = { yellowCards: [], redCards: [], saves: [] };
for (const player of players) {
  for (const row of player.seasons || []) {
    if (isMissing(row.yellowCards)) missing.yellowCards.push(`${row.season}\t${player.playerId}\t${player.name}\t${row.club}`);
    if (isMissing(row.redCards)) missing.redCards.push(`${row.season}\t${player.playerId}\t${player.name}\t${row.club}`);
    if (isMissing(row.saves)) missing.saves.push(`${row.season}\t${player.playerId}\t${player.name}\t${row.club}`);
  }
}

const expectedSaves = [
  ['Ali Al-Habsi', 92],
  ['Ján Mucha', 12],
  ['Júlio César', 88],
  ['Ross Turnbull', 5]
];
const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
for (const [name, saves] of expectedSaves) {
  const matches = players.flatMap(player => (player.seasons || []).filter(row => row.season === '2012/13' && norm(player.name) === norm(name)).map(row => ({ player, row })));
  if (matches.length !== 1) throw new Error(`Expected one 2012/13 row for ${name}, found ${matches.length}`);
  if (Number(matches[0].row.saves) !== saves) throw new Error(`${name} saves expected ${saves}, found ${matches[0].row.saves}`);
}

const jacob = players.find(p => p.playerId === 'jacob-murphy');
const josh = players.find(p => p.playerId === 'josh-murphy');
const jacobRow = (jacob?.seasons || []).find(row => row.season === '2013/14');
const joshRow = (josh?.seasons || []).find(row => row.season === '2013/14');
if (jacobRow) throw new Error('Jacob Murphy incorrectly retains a 2013/14 Norwich row.');
if (!joshRow || Number(joshRow.minutes) !== 139 || Number(joshRow.points) !== 8 || Number(joshRow.yellowCards) !== 1) {
  throw new Error(`Josh Murphy 2013/14 identity row is not correct: ${JSON.stringify(joshRow)}`);
}

const summary = {
  players: players.length,
  seasonRows: players.reduce((n,p) => n + (p.seasons || []).length, 0),
  missingYellowCards: missing.yellowCards.length,
  missingRedCards: missing.redCards.length,
  missingSaves: missing.saves.length,
  murphy2013_14: { playerId: 'josh-murphy', minutes: joshRow.minutes, points: joshRow.points, yellowCards: joshRow.yellowCards }
};
console.log(JSON.stringify(summary, null, 2));
if (missing.yellowCards.length || missing.redCards.length || missing.saves.length) {
  for (const [field, rows] of Object.entries(missing)) {
    if (!rows.length) continue;
    console.log(`\nMISSING ${field.toUpperCase()} (${rows.length})`);
    console.log(rows.slice(0, 50).join('\n'));
  }
  process.exit(1);
}
