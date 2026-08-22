import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const externalRoot = process.argv[2] || '/tmp/premier_league_dataset/dataset/DATA_JSON';
const source = fs.readFileSync('players.js', 'utf8');
const sandbox = {
  window: { addEventListener() {}, removeEventListener() {} },
  console,
  setTimeout() { return 0; },
  clearTimeout() {}
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'players.js', timeout: 30_000 });
const players = sandbox.window.FPL_PLAYERS;
if (!Array.isArray(players)) throw new Error('players.js did not expose FPL_PLAYERS');

const normalise = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const CLUB_ALIASES = new Map([
  ['man city', 'manchester city'], ['man utd', 'manchester united'], ['newcastle', 'newcastle united'],
  ['norwich', 'norwich city'], ['qpr', 'queens park rangers'], ['spurs', 'tottenham hotspur'],
  ['stoke', 'stoke city'], ['swansea', 'swansea city'], ['west brom', 'west bromwich albion'],
  ['west ham', 'west ham united'], ['wolves', 'wolverhampton wanderers'], ['wigan', 'wigan athletic'],
  ['blackburn', 'blackburn rovers'], ['bolton', 'bolton wanderers'], ['leicester', 'leicester city'],
  ['hull', 'hull city'], ['cardiff', 'cardiff city'], ['brighton', 'brighton and hove albion'],
  ['bournemouth', 'bournemouth'], ['afc bournemouth', 'bournemouth'], ['sheff utd', 'sheffield united'],
  ['sheffield utd', 'sheffield united'], ['huddersfield', 'huddersfield town'], ['leeds', 'leeds united'],
  ['ipswich', 'ipswich town'], ['luton', 'luton town'], ['nott m forest', 'nottingham forest'],
  ['nottm forest', 'nottingham forest'], ['forest', 'nottingham forest']
]);

const canonicalClub = value => {
  const v = normalise(value)
    .replace(/\bfc\b/g, '')
    .replace(/\bafc\b/g, '')
    .replace(/\bfootball club\b/g, '')
    .trim().replace(/\s+/g, ' ');
  return CLUB_ALIASES.get(v) || v;
};

const seasonYear = season => Number(String(season || '').slice(0, 4));
const dobParts = value => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const dobEquivalent = (left, right) => {
  if (!left || !right) return false;
  if (left === right) return true;
  const a = dobParts(left), b = dobParts(right);
  if (!a || !b || a[0] !== b[0]) return false;
  return a[1] === b[2] && a[2] === b[1] && a[1] <= 12 && b[1] <= 12;
};
const externalBySeason = new Map();

for (const seasonDir of fs.readdirSync(externalRoot, { withFileTypes: true })) {
  if (!seasonDir.isDirectory()) continue;
  const match = /^Season_(\d{4})$/.exec(seasonDir.name);
  if (!match) continue;
  const year = Number(match[1]);
  if (year < 2011 || year > 2025) continue;
  const seasonPath = path.join(externalRoot, seasonDir.name);
  const records = [];
  for (const file of fs.readdirSync(seasonPath)) {
    if (!file.endsWith('.json')) continue;
    const clubName = file.replace(/_\d+_\d{4}\.json$/, '').replace(/_/g, ' ');
    const club = canonicalClub(clubName);
    let payload;
    try { payload = JSON.parse(fs.readFileSync(path.join(seasonPath, file), 'utf8')); }
    catch { continue; }
    for (const item of payload?.players || []) {
      const nationalities = Array.isArray(item?.nationality)
        ? item.nationality.map(String).map(v => v.trim()).filter(Boolean)
        : [];
      if (!item?.name || !nationalities.length) continue;
      records.push({
        name: String(item.name),
        nameKey: normalise(item.name),
        dob: String(item.dateOfBirth || ''),
        club,
        nationalities,
        primaryNationality: nationalities[0]
      });
    }
  }
  externalBySeason.set(year, records);
}

const missing = players.filter(player => player?.bio?.regionId == null);
const results = [];
const methodCounts = new Map();
const recoveredNationalityByPlayer = new Map();
let recoverable = 0;
let conflicting = 0;
let noMatch = 0;
let exactDobSupport = 0;
let swappedDobSupport = 0;
let dobConflict = 0;

for (const player of missing) {
  const names = new Set([player.name, ...(player.aliases || [])].map(normalise).filter(Boolean));
  const dob = String(player.bio?.dateOfBirth || '');
  const matches = [];

  for (const row of player.seasons || []) {
    if (!(Number(row?.minutes) > 0)) continue;
    const year = seasonYear(row.season);
    const pool = externalBySeason.get(year) || [];
    const club = canonicalClub(row.club);

    for (const ext of pool) {
      if (ext.club !== club || !names.has(ext.nameKey)) continue;
      matches.push({ ...ext, season: row.season, method: 'NAME_CLUB_SEASON' });
    }

    if (dob) {
      const dobCandidates = pool.filter(ext => ext.club === club && dobEquivalent(ext.dob, dob));
      if (dobCandidates.length === 1 && !matches.some(m => m.season === row.season && m.nameKey === dobCandidates[0].nameKey)) {
        const exact = dobCandidates[0].dob === dob;
        matches.push({ ...dobCandidates[0], season: row.season, method: exact ? 'DOB_CLUB_SEASON' : 'SWAPPED_DOB_CLUB_SEASON' });
      }
    }
  }

  const uniqueEvidence = [...new Map(matches.map(m => [`${m.season}|${m.club}|${m.nameKey}`, m])).values()];
  const distinctPrimary = [...new Set(uniqueEvidence.map(m => m.primaryNationality).filter(Boolean))];
  const exactDobMatches = uniqueEvidence.filter(m => dob && m.dob === dob).length;
  const swappedDobMatches = uniqueEvidence.filter(m => dob && m.dob !== dob && dobEquivalent(m.dob, dob)).length;
  const mismatchedDobMatches = uniqueEvidence.filter(m => dob && m.dob && !dobEquivalent(m.dob, dob) && m.method === 'NAME_CLUB_SEASON').length;
  exactDobSupport += exactDobMatches > 0 ? 1 : 0;
  swappedDobSupport += swappedDobMatches > 0 ? 1 : 0;
  dobConflict += mismatchedDobMatches > 0 ? 1 : 0;

  let status = 'NO_MATCH';
  let nationality = null;
  let method = null;
  if (distinctPrimary.length === 1) {
    status = 'RECOVERABLE';
    nationality = distinctPrimary[0];
    recoverable += 1;
    recoveredNationalityByPlayer.set(player.playerId, nationality);
    if (uniqueEvidence.some(m => m.method === 'NAME_CLUB_SEASON')) method = 'NAME_CLUB_SEASON';
    else if (uniqueEvidence.some(m => m.method === 'DOB_CLUB_SEASON')) method = 'DOB_CLUB_SEASON';
    else method = 'SWAPPED_DOB_CLUB_SEASON';
    methodCounts.set(method, (methodCounts.get(method) || 0) + 1);
  } else if (distinctPrimary.length > 1) {
    status = 'CONFLICT';
    conflicting += 1;
  } else {
    noMatch += 1;
  }

  results.push({
    playerId: player.playerId,
    name: player.name,
    dob,
    status,
    nationality,
    method,
    evidenceRows: uniqueEvidence.length,
    exactDobSupport: exactDobMatches,
    swappedDobSupport: swappedDobMatches,
    mismatchedDobEvidence: mismatchedDobMatches,
    distinctPrimaryNationalities: distinctPrimary
  });
}

const projectedSeasonStats = new Map();
for (const player of players) {
  const knownAfterPass = player?.bio?.regionId != null || recoveredNationalityByPlayer.has(player.playerId);
  for (const row of player.seasons || []) {
    if (!(Number(row?.minutes) > 0)) continue;
    const season = String(row.season || 'unknown');
    if (!projectedSeasonStats.has(season)) projectedSeasonStats.set(season, { total: 0, known: 0 });
    const stat = projectedSeasonStats.get(season);
    stat.total += 1;
    if (knownAfterPass) stat.known += 1;
  }
}
const projectedSeasonCoverage = [...projectedSeasonStats.entries()]
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([season, stat]) => ({
    season,
    positiveMinutePlayers: stat.total,
    projectedKnown: stat.known,
    missingAfterPass: stat.total - stat.known,
    projectedCoveragePct: Number((100 * stat.known / Math.max(1, stat.total)).toFixed(1))
  }));

const currentKnown = players.length - missing.length;
const projectedKnown = currentKnown + recoverable;
const summary = {
  sourcePlayers: players.length,
  alreadyHaveRegionId: currentKnown,
  missingRegionId: missing.length,
  recoverableHighConfidence: recoverable,
  conflictsNeedingReview: conflicting,
  unmatched: noMatch,
  recoveryRateOfMissingPct: Number((100 * recoverable / Math.max(1, missing.length)).toFixed(1)),
  projectedNationalityCoverage: projectedKnown,
  projectedCoveragePct: Number((100 * projectedKnown / players.length).toFixed(1)),
  recoverableWithExactDobSupport: exactDobSupport,
  recoverableWithSwappedDobSupport: swappedDobSupport,
  recoverableOrMatchedWithDobDisagreement: dobConflict,
  methods: Object.fromEntries(methodCounts),
  projectedSeasonCoverage,
  nationalityReadySeasons: projectedSeasonCoverage.filter(item => item.missingAfterPass === 0).map(item => item.season),
  note: 'Primary nationality means the first nationality listed by the external squad source. No data was written to players.js.'
};

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/nationality-recoverability-summary.json', JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync('artifacts/nationality-recoverability-detail.json', JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
