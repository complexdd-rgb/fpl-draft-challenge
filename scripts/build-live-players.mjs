import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath = 'players.js';
const enrichmentPath = 'nationality-enrichment.js';
const outputPath = 'players-live.js';
const source = fs.readFileSync(sourcePath, 'utf8');
const sandbox = {
  window: {
    addEventListener() {},
    removeEventListener() {}
  },
  console,
  setTimeout() { return 0; },
  clearTimeout() {}
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: sourcePath, timeout: 30000 });
if (fs.existsSync(enrichmentPath)) {
  vm.runInContext(fs.readFileSync(enrichmentPath, 'utf8'), sandbox, { filename: enrichmentPath, timeout: 30000 });
}

const players = sandbox.window.FPL_PLAYERS;
if (!Array.isArray(players) || !players.length) {
  throw new Error('players.js did not expose a populated window.FPL_PLAYERS array.');
}

const keepBio = bio => {
  if (!bio || typeof bio !== 'object') return undefined;
  const compact = {};
  if (bio.dateOfBirth != null) compact.dateOfBirth = bio.dateOfBirth;
  if (bio.regionId != null) compact.regionId = bio.regionId;
  if (bio.nationality != null && String(bio.nationality).trim()) compact.nationality = String(bio.nationality).trim();
  return Object.keys(compact).length ? compact : undefined;
};

let sourceRows = 0;
let liveRows = 0;
let strippedZeroMinuteRows = 0;
let strippedSourceBlocks = 0;

const livePlayers = players.map(player => {
  const output = {};

  // Preserve identity/redirect fields without carrying verbose audit metadata into the game.
  for (const [key, value] of Object.entries(player || {})) {
    if (key === 'seasons' || key === 'bio' || key === 'source') continue;
    output[key] = value;
  }

  const bio = keepBio(player?.bio);
  if (bio) output.bio = bio;

  const seasons = Array.isArray(player?.seasons) ? player.seasons : [];
  sourceRows += seasons.length;
  output.seasons = seasons
    .filter(season => {
      const eligible = Number(season?.minutes) > 0;
      if (!eligible) strippedZeroMinuteRows += 1;
      return eligible;
    })
    .map(season => {
      liveRows += 1;
      const compact = {};
      for (const [key, value] of Object.entries(season || {})) {
        if (key === 'source') {
          strippedSourceBlocks += 1;
          continue;
        }
        compact[key] = value;
      }
      return compact;
    });

  return output;
});

// Safety: player identity must stay one-for-one even if a player has no positive-minute row.
if (livePlayers.length !== players.length) throw new Error('Live player count changed unexpectedly.');
for (let index = 0; index < players.length; index += 1) {
  if (livePlayers[index]?.playerId !== players[index]?.playerId || livePlayers[index]?.name !== players[index]?.name) {
    throw new Error(`Player identity changed at index ${index}.`);
  }
}

// Safety: every retained season must be an exact copy of the certified positive-minute row
// apart from the deliberately removed source/audit metadata.
for (let index = 0; index < players.length; index += 1) {
  const originalPositive = (players[index].seasons || []).filter(season => Number(season?.minutes) > 0);
  const compactPositive = livePlayers[index].seasons || [];
  if (originalPositive.length !== compactPositive.length) throw new Error(`Positive-minute row count changed for ${players[index].playerId}.`);
  for (let row = 0; row < originalPositive.length; row += 1) {
    const expected = { ...originalPositive[row] };
    delete expected.source;
    if (JSON.stringify(expected) !== JSON.stringify(compactPositive[row])) {
      throw new Error(`Live season data changed for ${players[index].playerId} ${originalPositive[row]?.season || row}.`);
    }
  }
}

const banner = `/* Player-facing FPL database — generated from certified players.js.\n   Positive-minute seasons only; audit/source metadata is intentionally omitted.\n   Nationality enrichment is applied from nationality-enrichment.js when present.\n   Regenerate with: node scripts/build-live-players.mjs */\n`;
const output = `${banner}window.FPL_PLAYERS = ${JSON.stringify(livePlayers)};\n`;
fs.writeFileSync(outputPath, output);

const sourceBytes = Buffer.byteLength(source);
const liveBytes = Buffer.byteLength(output);
const reduction = sourceBytes ? ((1 - liveBytes / sourceBytes) * 100) : 0;
console.log(JSON.stringify({
  players: players.length,
  sourceRows,
  liveRows,
  strippedZeroMinuteRows,
  strippedSourceBlocks,
  nationalityEnrichment: fs.existsSync(enrichmentPath) ? (sandbox.window.FPL_NATIONALITY_ENRICHMENT || null) : null,
  sourceBytes,
  liveBytes,
  reductionPercent: Number(reduction.toFixed(1))
}, null, 2));
