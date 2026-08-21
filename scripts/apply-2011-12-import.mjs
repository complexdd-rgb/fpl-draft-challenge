import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const playersPath = process.argv[2] || 'players.js';
const patchPath = process.argv[3] || 'data/fpl-2011-12-import-v15.json.br.b64';
const source = fs.readFileSync(playersPath, 'utf8');
const encodedPatch = patchPath.endsWith('.parts')
  ? fs.readFileSync(patchPath, 'utf8').split(/\r?\n/).map(part => part.trim()).filter(Boolean).map(part => fs.readFileSync(part, 'utf8').trim()).join('')
  : fs.readFileSync(patchPath, 'utf8').trim();
const patchText = patchPath.endsWith('.br.b64') || patchPath.endsWith('.parts')
  ? zlib.brotliDecompressSync(Buffer.from(encodedPatch, 'base64')).toString('utf8')
  : patchPath.endsWith('.gz.b64')
    ? zlib.gunzipSync(Buffer.from(encodedPatch, 'base64')).toString('utf8')
    : encodedPatch;
const patch = JSON.parse(patchText);

function gitBlobSha(text) {
  const body = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body])).digest('hex');
}
const currentBlob = gitBlobSha(source);
const sandbox = { window: { addEventListener() {}, removeEventListener() {} }, console, setTimeout() { return 0; }, clearTimeout() {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: playersPath, timeout: 30000 });
const players = sandbox.window.FPL_PLAYERS;
if (!Array.isArray(players) || !players.length) throw new Error('players.js did not expose window.FPL_PLAYERS.');

const season = patch.season;
const byId = new Map(players.map(player => [player.playerId, player]));
const existingSeasonRows = players.reduce((n,p)=>n+(p.seasons||[]).filter(r=>r.season===season).length,0);
if (existingSeasonRows === patch.expected.total) {
  console.log(JSON.stringify({ status: 'already-applied', season, players: players.length, seasonRows: existingSeasonRows, blob: currentBlob }, null, 2));
  process.exit(0);
}
if (existingSeasonRows !== 0) throw new Error(`Refusing partial import: found ${existingSeasonRows} existing ${season} rows.`);
if (patch.basePlayersBlob && currentBlob !== patch.basePlayersBlob) throw new Error(`Base players.js blob changed: expected ${patch.basePlayersBlob}, got ${currentBlob}.`);

let matched = 0;
for (const item of patch.existing) {
  const player = byId.get(item.playerId);
  if (!player) throw new Error(`Missing canonical playerId ${item.playerId}.`);
  if ((player.seasons || []).some(row => row.season === season)) throw new Error(`Duplicate ${season} for ${item.playerId}.`);
  player.seasons ||= [];
  player.seasons.push(item.season);
  matched += 1;
}
let created = 0;
for (const player of patch.created) {
  if (byId.has(player.playerId)) throw new Error(`New historical playerId collides: ${player.playerId}.`);
  const rows = (player.seasons || []).filter(row => row.season === season);
  if (rows.length !== 1) throw new Error(`New player ${player.playerId} does not contain exactly one ${season} row.`);
  players.push(player);
  byId.set(player.playerId, player);
  created += 1;
}
if (Array.isArray(patch.targetOrder)) {
  const rank = new Map(patch.targetOrder.map((id,index)=>[id,index]));
  if (rank.size !== players.length) throw new Error(`Target order size ${rank.size} does not match player count ${players.length}.`);
  players.sort((a,b)=>(rank.get(a.playerId) ?? 1e9) - (rank.get(b.playerId) ?? 1e9));
} else {
  players.sort((a,b)=>String(a.name).localeCompare(String(b.name)) || String(a.playerId).localeCompare(String(b.playerId)));
}

const ids = new Set();
const seasonKeys = new Set();
let duplicateIds = 0, duplicateSeasons = 0, totalSeasonRows = 0, positiveMinutes = 0;
for (const player of players) {
  if (ids.has(player.playerId)) duplicateIds += 1;
  ids.add(player.playerId);
  for (const row of player.seasons || []) {
    const key = `${player.playerId}\u0000${row.season}`;
    if (seasonKeys.has(key)) duplicateSeasons += 1;
    seasonKeys.add(key);
    if (row.season === season) { totalSeasonRows += 1; if (Number(row.minutes) > 0) positiveMinutes += 1; }
  }
}
if (matched !== patch.expected.existing || created !== patch.expected.created || totalSeasonRows !== patch.expected.total) {
  throw new Error(`Import totals mismatch: matched=${matched}, created=${created}, seasonRows=${totalSeasonRows}.`);
}
if (duplicateIds || duplicateSeasons || positiveMinutes !== totalSeasonRows) throw new Error(`Structural validation failed: duplicateIds=${duplicateIds}, duplicateSeasons=${duplicateSeasons}, positiveMinutes=${positiveMinutes}/${totalSeasonRows}.`);

const lines = source.split('\n');
if (!lines[1]?.startsWith('window.FPL_PLAYERS = ')) throw new Error('Unexpected players.js serialization layout.');
lines[1] = `window.FPL_PLAYERS = ${JSON.stringify(players)}`;
const output = lines.join('\n');
fs.writeFileSync(playersPath, output);
console.log(JSON.stringify({ status: 'applied', season, matched, created, totalSeasonRows, positiveMinutes, players: players.length, beforeBlob: currentBlob, afterBlob: gitBlobSha(output) }, null, 2));
