import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE_ROOT = process.argv[2] || process.env.PL_STATS_ROOT || '/tmp/plstats';
const PLAYERS_PATH = 'players.js';
const OUTPUT_PATH = 'nationality-enrichment.js';
const REPORT_PATH = 'reports/nationality-enrichment-report.json';
const SOURCE_URL = 'https://github.com/imadeddine-belkat/Premier-League-Stats';

function normalise(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/[đð]/g, 'd')
    .replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/œ/g, 'oe')
    .replace(/’/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0].map(value => value.trim());
  return rows.slice(1).filter(values => values.some(Boolean)).map(values => {
    const out = {};
    for (let i = 0; i < header.length; i += 1) out[header[i]] = values[i] ?? '';
    return out;
  });
}

function canonicalNationality(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const key = normalise(raw);
  const aliases = new Map([
    ['cote d ivoire', 'Ivory Coast'],
    ['cote divoire', 'Ivory Coast'],
    ['ivory coast', 'Ivory Coast'],
    ['korea republic', 'South Korea'],
    ['republic of korea', 'South Korea'],
    ['south korea', 'South Korea'],
    ['united states', 'USA'],
    ['united states of america', 'USA'],
    ['usa', 'USA'],
    ['republic of ireland', 'Ireland'],
    ['ireland', 'Ireland'],
    ['trinidad tobago', 'Trinidad and Tobago'],
    ['trinidad and tobago', 'Trinidad and Tobago'],
    ['bosnia and herzegovina', 'Bosnia-Herzegovina'],
    ['bosnia herzegovina', 'Bosnia-Herzegovina'],
    ['czechia', 'Czech Republic'],
    ['czech republic', 'Czech Republic'],
    ['congo dr', 'DR Congo'],
    ['democratic republic of the congo', 'DR Congo'],
    ['dr congo', 'DR Congo'],
    ['cape verde islands', 'Cape Verde'],
    ['cabo verde', 'Cape Verde'],
    ['north macedonia', 'North Macedonia'],
    ['macedonia', 'North Macedonia']
  ]);
  return aliases.get(key) || raw.replace(/\s+/g, ' ');
}

function positionCode(value) {
  const key = normalise(value);
  if (key.includes('goalkeeper')) return 'GK';
  if (key.includes('defender')) return 'DEF';
  if (key.includes('midfielder')) return 'MID';
  if (key.includes('forward') || key.includes('striker')) return 'FWD';
  return '';
}

function loadPlayers() {
  const source = fs.readFileSync(PLAYERS_PATH, 'utf8');
  const sandbox = {
    window: { addEventListener() {}, removeEventListener() {} },
    console,
    setTimeout() { return 0; },
    clearTimeout() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: PLAYERS_PATH, timeout: 30000 });
  const players = sandbox.window.FPL_PLAYERS;
  if (!Array.isArray(players) || !players.length) throw new Error('players.js did not expose FPL_PLAYERS.');
  return players;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && /_squad\.csv$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function loadExternalRows() {
  const root = path.join(SOURCE_ROOT, 'pl_stats');
  const files = walk(root).sort();
  if (!files.length) throw new Error(`No *_squad.csv files found under ${root}`);
  const rows = [];
  for (const file of files) {
    const match = path.basename(file).match(/^(\d{4})-(\d{2})_squad\.csv$/i);
    if (!match) continue;
    const season = `${match[1]}/${match[2]}`;
    const clubFolder = path.basename(path.dirname(path.dirname(file)));
    const parsed = parseCsv(fs.readFileSync(file, 'utf8'));
    for (const item of parsed) {
      const nationality = canonicalNationality(item.nationality);
      if (!nationality) continue;
      const displayName = String(item.displayName || `${item.firstName || ''} ${item.lastName || ''}`).trim();
      rows.push({
        playerId: String(item.playerId || '').trim(),
        displayName,
        nameKey: normalise(displayName),
        firstKey: normalise(item.firstName),
        lastKey: normalise(item.lastName),
        nationality,
        isoCode: String(item.isoCode || '').trim(),
        birthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.birthDate || '')) ? String(item.birthDate) : '',
        season,
        position: positionCode(item.position),
        clubFolder,
        sourceFile: path.relative(SOURCE_ROOT, file).replaceAll('\\', '/')
      });
    }
  }
  return rows;
}

function playerCodes(player) {
  const values = [
    player?.code,
    player?.optaCode,
    player?.bio?.optaCode,
    player?.bio?.playerCode,
    player?.sourceIdentity?.sourceCode,
    player?.sourceIdentity?.playerCode,
    player?.sourceIdentity?.optaCode
  ];
  return new Set(values.filter(value => value !== null && value !== undefined && value !== '').map(String));
}

function positiveSeasons(player) {
  const map = new Map();
  for (const season of player?.seasons || []) {
    if (Number(season?.minutes) <= 0) continue;
    map.set(String(season.season || ''), season);
  }
  return map;
}

function surnameKeys(player) {
  const out = new Set();
  for (const value of [player?.name, ...(Array.isArray(player?.aliases) ? player.aliases : [])]) {
    const tokens = normalise(value).split(' ').filter(Boolean);
    if (tokens.length) out.add(tokens.at(-1));
  }
  return out;
}

function namesFor(player) {
  return new Set([player?.name, ...(Array.isArray(player?.aliases) ? player.aliases : [])].map(normalise).filter(Boolean));
}

function tokenSimilarity(a, b) {
  const left = new Set(normalise(a).split(' ').filter(Boolean));
  const right = new Set(normalise(b).split(' ').filter(Boolean));
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return common / Math.max(left.size, right.size);
}

function addIndex(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

const players = loadPlayers();
const externalRows = loadExternalRows();
const byCode = new Map();
const byDob = new Map();
const byName = new Map();
for (const row of externalRows) {
  addIndex(byCode, row.playerId, row);
  addIndex(byDob, row.birthDate, row);
  addIndex(byName, row.nameKey, row);
}

const eligiblePlayers = players.filter(player => (player.seasons || []).some(season => Number(season?.minutes) > 0));
const baselineCovered = eligiblePlayers.filter(player => {
  const bio = player?.bio || {};
  return Boolean(String(bio.nationality || '').trim()) || (bio.regionId !== null && bio.regionId !== undefined && bio.regionId !== '' && Number.isFinite(Number(bio.regionId)));
}).length;

const mapping = {};
const matched = [];
const unresolved = [];
const conflicts = [];
const methodCounts = {};

for (const player of eligiblePlayers) {
  const bioNationality = canonicalNationality(player?.bio?.nationality);
  if (bioNationality) continue;

  const names = namesFor(player);
  const surnames = surnameKeys(player);
  const seasons = positiveSeasons(player);
  const dob = /^\d{4}-\d{2}-\d{2}$/.test(String(player?.bio?.dateOfBirth || '')) ? String(player.bio.dateOfBirth) : '';
  const evidence = [];

  for (const code of playerCodes(player)) {
    for (const row of byCode.get(code) || []) evidence.push({ row, score: 120, method: 'shared-player-code' });
  }

  if (dob) {
    for (const row of byDob.get(dob) || []) {
      const exactName = names.has(row.nameKey);
      const sameSeasonRecord = seasons.get(row.season);
      const samePosition = sameSeasonRecord && (!row.position || row.position === sameSeasonRecord.position);
      const surnameMatch = row.lastKey && surnames.has(row.lastKey.split(' ').at(-1));
      const similarity = Math.max(...[...names].map(name => tokenSimilarity(name, row.displayName)), 0);
      if (exactName) evidence.push({ row, score: 110, method: 'dob+exact-name' });
      else if (sameSeasonRecord && samePosition && surnameMatch) evidence.push({ row, score: 100, method: 'dob+season+position+surname' });
      else if (sameSeasonRecord && samePosition && similarity >= 0.6) evidence.push({ row, score: 96, method: 'dob+season+position+name-similarity' });
    }
  }

  if (!evidence.length) {
    for (const name of names) {
      for (const row of byName.get(name) || []) {
        const sameSeasonRecord = seasons.get(row.season);
        if (!sameSeasonRecord) continue;
        if (row.position && row.position !== sameSeasonRecord.position) continue;
        evidence.push({ row, score: 88, method: 'exact-name+season+position' });
      }
    }
  }

  if (!evidence.length) {
    unresolved.push({ playerId: player.playerId, name: player.name, dateOfBirth: dob || null, seasons: [...seasons.keys()] });
    continue;
  }

  evidence.sort((a, b) => b.score - a.score);
  const bestScore = evidence[0].score;
  const trusted = evidence.filter(item => item.score >= Math.max(88, bestScore - 8));
  const nationalities = [...new Set(trusted.map(item => item.row.nationality).filter(Boolean))];
  if (nationalities.length !== 1) {
    conflicts.push({
      playerId: player.playerId,
      name: player.name,
      dateOfBirth: dob || null,
      candidates: trusted.slice(0, 12).map(item => ({ nationality: item.row.nationality, method: item.method, score: item.score, sourceFile: item.row.sourceFile, displayName: item.row.displayName }))
    });
    continue;
  }

  const nationality = nationalities[0];
  const winner = trusted.find(item => item.row.nationality === nationality) || trusted[0];
  mapping[String(player.playerId)] = nationality;
  methodCounts[winner.method] = (methodCounts[winner.method] || 0) + 1;
  matched.push({ playerId: player.playerId, name: player.name, nationality, method: winner.method, score: winner.score, sourceFile: winner.row.sourceFile, sourcePlayerId: winner.row.playerId || null });
}

const projectedCovered = eligiblePlayers.filter(player => {
  const bio = player?.bio || {};
  const existing = Boolean(String(bio.nationality || '').trim()) || (bio.regionId !== null && bio.regionId !== undefined && bio.regionId !== '' && Number.isFinite(Number(bio.regionId)));
  return existing || Boolean(mapping[String(player.playerId)]);
}).length;

const orderedMapping = Object.fromEntries(Object.entries(mapping).sort((a, b) => a[0].localeCompare(b[0])));
const output = `/* Generated nationality enrichment. Source: ${SOURCE_URL}\n   Generated by scripts/enrich-nationalities.mjs. Existing bio.nationality values are never overwritten. */\n(() => {\n  \"use strict\";\n  const mapping = ${JSON.stringify(orderedMapping)};\n  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];\n  let applied = 0;\n  for (const player of players) {\n    const nationality = mapping[String(player?.playerId)];\n    if (!nationality) continue;\n    if (!player.bio || typeof player.bio !== \"object\") player.bio = {};\n    if (String(player.bio.nationality || \"\").trim()) continue;\n    player.bio.nationality = nationality;\n    applied += 1;\n  }\n  window.FPL_NATIONALITY_ENRICHMENT = Object.freeze({ version: \"1.0.0\", source: ${JSON.stringify(SOURCE_URL)}, applied, mapped: Object.keys(mapping).length });\n})();\n`;
fs.writeFileSync(OUTPUT_PATH, output);

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  source: SOURCE_URL,
  sourceRoot: SOURCE_ROOT,
  externalRows: externalRows.length,
  eligiblePlayers: eligiblePlayers.length,
  baselineCovered,
  baselineCoveragePercent: Number((baselineCovered / Math.max(1, eligiblePlayers.length) * 100).toFixed(1)),
  newlyMapped: Object.keys(mapping).length,
  projectedCovered,
  projectedCoveragePercent: Number((projectedCovered / Math.max(1, eligiblePlayers.length) * 100).toFixed(1)),
  unresolved: unresolved.length,
  conflicts: conflicts.length,
  methodCounts,
  matched,
  unresolvedPlayers: unresolved,
  conflictPlayers: conflicts
};
fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  eligiblePlayers: report.eligiblePlayers,
  baselineCovered: report.baselineCovered,
  baselineCoveragePercent: report.baselineCoveragePercent,
  newlyMapped: report.newlyMapped,
  projectedCovered: report.projectedCovered,
  projectedCoveragePercent: report.projectedCoveragePercent,
  unresolved: report.unresolved,
  conflicts: report.conflicts,
  methodCounts: report.methodCounts
}, null, 2));
