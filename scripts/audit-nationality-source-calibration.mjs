import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const externalRoot = process.argv[2] || '/tmp/premier_league_dataset/dataset/DATA_JSON';
const regionsPath = process.argv[3] || '/tmp/fpl-regions.json';
const source = fs.readFileSync('players.js', 'utf8');
const sandbox = { window: { addEventListener() {}, removeEventListener() {} }, console, setTimeout() { return 0; }, clearTimeout() {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'players.js', timeout: 30_000 });
const players = sandbox.window.FPL_PLAYERS;
const regions = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));

const normalise = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const countryKey = value => {
  const raw = normalise(value);
  const aliases = new Map([
    ['usa', 'united states'], ['united states of america', 'united states'],
    ['republic of ireland', 'ireland'],
    ['cote d ivoire', 'ivory coast'], ['cote divoire', 'ivory coast'],
    ['korea republic of', 'south korea'], ['korea republic', 'south korea'], ['republic of korea', 'south korea'], ['korea south', 'south korea'],
    ['czech republic', 'czechia'],
    ['bosnia herzegovina', 'bosnia and herzegovina'],
    ['dr congo', 'congo dr'], ['democratic republic of the congo', 'congo dr'], ['congo democratic republic', 'congo dr'], ['congo democratic republic of', 'congo dr'],
    ['cape verde', 'cabo verde'],
    ['turkiye', 'turkey'],
    ['macedonia', 'north macedonia'],
    ['the gambia', 'gambia']
  ]);
  return aliases.get(raw) || raw;
};

const clubAliases = new Map([
  ['man city','manchester city'],['man utd','manchester united'],['newcastle','newcastle united'],['norwich','norwich city'],
  ['qpr','queens park rangers'],['spurs','tottenham hotspur'],['stoke','stoke city'],['swansea','swansea city'],
  ['west brom','west bromwich albion'],['west ham','west ham united'],['wolves','wolverhampton wanderers'],['wigan','wigan athletic'],
  ['blackburn','blackburn rovers'],['bolton','bolton wanderers'],['leicester','leicester city'],['hull','hull city'],['cardiff','cardiff city'],
  ['brighton','brighton and hove albion'],['bournemouth','bournemouth'],['afc bournemouth','bournemouth'],['sheff utd','sheffield united'],
  ['sheffield utd','sheffield united'],['huddersfield','huddersfield town'],['leeds','leeds united'],['ipswich','ipswich town'],['luton','luton town'],
  ['nott m forest','nottingham forest'],['nottm forest','nottingham forest'],['forest','nottingham forest']
]);
const canonicalClub = value => {
  const v = normalise(value).replace(/\bfc\b/g,'').replace(/\bafc\b/g,'').replace(/\bfootball club\b/g,'').trim().replace(/\s+/g,' ');
  return clubAliases.get(v) || v;
};
const seasonYear = season => Number(String(season || '').slice(0, 4));

const regionNameById = new Map((Array.isArray(regions) ? regions : regions?.regions || []).map(item => [Number(item.id), String(item.name || item.region || item.label || '')]));
if (!regionNameById.size) throw new Error('No region names parsed from official FPL regions payload.');

const externalBySeason = new Map();
for (const seasonDir of fs.readdirSync(externalRoot, { withFileTypes: true })) {
  if (!seasonDir.isDirectory()) continue;
  const m = /^Season_(\d{4})$/.exec(seasonDir.name);
  if (!m) continue;
  const year = Number(m[1]);
  if (year < 2011 || year > 2025) continue;
  const seasonPath = path.join(externalRoot, seasonDir.name);
  const records = [];
  for (const file of fs.readdirSync(seasonPath)) {
    if (!file.endsWith('.json')) continue;
    const club = canonicalClub(file.replace(/_\d+_\d{4}\.json$/,'').replace(/_/g,' '));
    let payload;
    try { payload = JSON.parse(fs.readFileSync(path.join(seasonPath, file), 'utf8')); } catch { continue; }
    for (const item of payload?.players || []) {
      const nationalities = Array.isArray(item?.nationality) ? item.nationality.map(String).map(v => v.trim()).filter(Boolean) : [];
      if (!item?.name || !nationalities.length) continue;
      records.push({ nameKey: normalise(item.name), dob: String(item.dateOfBirth || ''), club, primaryNationality: nationalities[0] });
    }
  }
  externalBySeason.set(year, records);
}

let officialKnown = 0;
let matched = 0;
let agreed = 0;
let disagreed = 0;
let externalConflicts = 0;
let unmatched = 0;
const mismatches = [];

for (const player of players) {
  if (player?.bio?.regionId == null) continue;
  officialKnown += 1;
  const official = regionNameById.get(Number(player.bio.regionId));
  if (!official) continue;
  const names = new Set([player.name, ...(player.aliases || [])].map(normalise).filter(Boolean));
  const dob = String(player.bio?.dateOfBirth || '');
  const evidence = [];
  for (const row of player.seasons || []) {
    if (!(Number(row?.minutes) > 0)) continue;
    const pool = externalBySeason.get(seasonYear(row.season)) || [];
    const club = canonicalClub(row.club);
    const nameMatches = pool.filter(ext => ext.club === club && names.has(ext.nameKey));
    evidence.push(...nameMatches);
    if (!nameMatches.length && dob) {
      const dobMatches = pool.filter(ext => ext.club === club && ext.dob === dob);
      if (dobMatches.length === 1) evidence.push(dobMatches[0]);
    }
  }
  const distinct = [...new Set(evidence.map(item => item.primaryNationality).filter(Boolean))];
  if (!distinct.length) { unmatched += 1; continue; }
  if (distinct.length > 1) { externalConflicts += 1; continue; }
  matched += 1;
  const external = distinct[0];
  if (countryKey(external) === countryKey(official)) agreed += 1;
  else {
    disagreed += 1;
    mismatches.push({ playerId: player.playerId, player: player.name, officialRegionId: player.bio.regionId, officialNationality: official, externalPrimaryNationality: external });
  }
}

const summary = {
  officialPlayersWithRegionId: officialKnown,
  matchedToExternalSource: matched,
  unmatchedToExternalSource: unmatched,
  externalNationalityConflicts: externalConflicts,
  agreements: agreed,
  disagreements: disagreed,
  agreementPctOfComparable: Number((100 * agreed / Math.max(1, agreed + disagreed)).toFixed(1)),
  comparisonCoveragePctOfOfficial: Number((100 * (agreed + disagreed) / Math.max(1, officialKnown)).toFixed(1)),
  mismatchCount: mismatches.length
};

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/nationality-source-calibration-summary.json', JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync('artifacts/nationality-source-calibration-mismatches.json', JSON.stringify(mismatches, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
