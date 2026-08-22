import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('players.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'players.js', timeout: 30_000 });
const players = Array.isArray(sandbox.window.FPL_PLAYERS) ? sandbox.window.FPL_PLAYERS : [];

const hasValue = value => value !== null && value !== undefined && String(value).trim() !== '';
const candidateFields = ['nationality', 'country', 'countryCode', 'regionId', 'region', 'nation'];
const fieldCoverage = Object.fromEntries(candidateFields.map(field => [field, 0]));
const bioKeys = new Map();
const regionCounts = new Map();
const seasonStats = new Map();
let withBio = 0;
let positiveRows = 0;
let positiveRowsWithRegion = 0;

for (const player of players) {
  const bio = player?.bio && typeof player.bio === 'object' ? player.bio : null;
  if (bio) {
    withBio += 1;
    for (const key of Object.keys(bio)) bioKeys.set(key, (bioKeys.get(key) || 0) + 1);
    for (const field of candidateFields) if (hasValue(bio[field])) fieldCoverage[field] += 1;
    if (hasValue(bio.regionId)) regionCounts.set(String(bio.regionId), (regionCounts.get(String(bio.regionId)) || 0) + 1);
  }

  for (const row of player?.seasons || []) {
    if (!(Number(row?.minutes) > 0)) continue;
    positiveRows += 1;
    const season = String(row.season || 'unknown');
    if (!seasonStats.has(season)) seasonStats.set(season, { players: new Set(), playersWithRegion: new Set() });
    const stat = seasonStats.get(season);
    stat.players.add(player.playerId);
    if (bio && hasValue(bio.regionId)) {
      positiveRowsWithRegion += 1;
      stat.playersWithRegion.add(player.playerId);
    }
  }
}

const knownSampleNames = [
  'Wayne Rooney', 'Gareth Bale', 'Frank Lampard', 'Steven Gerrard', 'Didier Drogba',
  'Cristiano Ronaldo', 'Cesc Fàbregas', 'Sergio Agüero', 'Petr Čech', 'Robin van Persie',
  'Thierry Henry', 'David Silva', 'Mohamed Salah', 'Son Heung-min', 'Erling Haaland'
];
const samples = knownSampleNames.map(name => {
  const player = players.find(item => item?.name === name);
  return player ? { name, regionId: player.bio?.regionId ?? null, bio: player.bio || null } : { name, found: false };
});

const seasons = [...seasonStats.entries()]
  .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  .map(([season, stat]) => ({
    season,
    positiveMinutePlayers: stat.players.size,
    playersWithRegionId: stat.playersWithRegion.size,
    coveragePct: stat.players.size ? Number((100 * stat.playersWithRegion.size / stat.players.size).toFixed(1)) : 0
  }));

const result = {
  totalPlayers: players.length,
  playersWithBio: withBio,
  fieldCoverage,
  bioKeyCoverage: Object.fromEntries([...bioKeys.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  distinctRegionIds: regionCounts.size,
  topRegionIds: [...regionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([regionId, players]) => ({ regionId, players })),
  positiveMinuteSeasonRows: positiveRows,
  positiveMinuteRowsWithRegionId: positiveRowsWithRegion,
  positiveMinuteRowCoveragePct: positiveRows ? Number((100 * positiveRowsWithRegion / positiveRows).toFixed(1)) : 0,
  seasons,
  samples
};

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/nationality-coverage.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
