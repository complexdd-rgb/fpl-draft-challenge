import fs from 'node:fs';
import vm from 'node:vm';

const seasons = {
  '2012/13': { compId: 415, url: 'http://www.statbunker.com/competitions/PlayerStandings?comp_id=415' },
  '2013/14': { compId: 449, url: 'http://www.statbunker.com/competitions/PlayerStandings?comp_id=449' }
};

// Explicit, human-reviewed StatBunker display-name crosswalk. These are spelling,
// short-name or common-name differences only; fuzzy suggestions are never auto-used.
const STATBUNKER_NAME = Object.freeze({
  'alexander-kacaniklic': 'Alexander Kacanikilic',
  'bradley-guzan': 'Brad Guzan',
  'bradley-jones': 'Brad Jones',
  'chico': 'Chico Flores',
  'clint-hill': 'Clinton Hill',
  'giorgos-karagounis': 'Giorgios Karagounis',
  'jonny-howson': 'Jonathan Howson',
  'jose-reina': 'Pepe Reina',
  'markus-rosenberg': 'Marcus Rosenberg',
  'matthew-jarvis': 'Matt Jarvis',
  'michael-williamson': 'Mike Williamson',
  'mousa-dembele': 'Moussa Dembele',
  'phil-bardsley': 'Philip Bardsley',
  'phil-jagielka': 'Philip Jagielka',
  'rickie-lambert': 'Ricky Lambert',
  'vassiriki-diaby': 'Abou Diaby',
  'ahmed-el-mohamady': 'Ahmed Elmohamady',
  'buomesca-tue-na-bangna': 'Mesca',
  'charalampos-mavrias': 'Charis Mavrias',
  'danny-gabbidon': 'Daniel Gabbidon',
  'david-ngog': 'David Ngog',
  'dedryck-boyata': 'Dedryk Boyata',
  'elliot-lee': 'Elliott Lee',
  'ezekiel-fryers': 'Zeki Fryers',
  'gedo': 'Mohamed Gedo',
  'ignacio-scocco': 'Nacho Scocco',
  'jordon-ibe': 'Jordan Ibe',
  'jordon-mutch': 'Jordan Mutch',
  'juan-cala': 'Cala',
  'kostas-mitroglou': 'Konstantinos Mitroglou',
  'pablo-osvaldo': 'Dani Osvaldo',
  'robbie-brady': 'Robert Brady',
  'thomas-james': 'Tom James',
  'wilfried-zaha': 'Wilfred Zaha'
});

// This is not an alias: the existing 2013/14 Norwich 139-minute row is attached
// to Jacob Murphy but StatBunker + independent identity evidence identify Josh Murphy.
const IDENTITY_MIGRATIONS = Object.freeze({
  '2013/14::jacob-murphy': { targetPlayerId: 'josh-murphy', statBunkerName: 'Josh Murphy', reason: '2013/14 Norwich 139-minute row belongs to twin Josh Murphy' }
});

function installBrowserShim() {
  globalThis.window = {
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    location: { pathname: '/admin.html' }, setTimeout, clearTimeout
  };
  window.window = window;
  globalThis.document = {
    readyState: 'complete', querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; }, addEventListener() {}, removeEventListener() {},
    createElement() { return { style: {}, dataset: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }; },
    head: { appendChild() {} }, body: { appendChild() {} }
  };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
  globalThis.Event = class Event { constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); } };
}

installBrowserShim();
const playersSource = fs.readFileSync(new URL('../players.js', import.meta.url), 'utf8');
vm.runInThisContext(playersSource, { filename: 'players.js' });
const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
if (!players.length) throw new Error('FPL_PLAYERS did not load');

const decode = s => s
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"').replace(/&ndash;|&mdash;/gi, '-').replace(/&aacute;/gi, 'á')
  .replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í').replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú')
  .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í').replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const strip = s => decode(String(s).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const norm = s => strip(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ø/g,'o').replace(/ł/g,'l').replace(/[đð]/g,'d').replace(/þ/g,'th').replace(/æ/g,'ae').replace(/œ/g,'oe').replace(/[^a-z0-9]+/g, ' ').trim();
const clubAliases = new Map(Object.entries({
  'man city': 'manchester city', 'man utd': 'manchester united', 'spurs': 'tottenham hotspur',
  'qpr': 'queens park rangers', 'wigan': 'wigan athletic', 'west ham': 'west ham united',
  'west brom': 'west bromwich albion', 'newcastle': 'newcastle united', 'norwich': 'norwich city',
  'swansea': 'swansea city', 'cardiff': 'cardiff city', 'hull': 'hull city'
}));
const normClub = s => clubAliases.get(norm(s)) || norm(s);
const num = s => { const t = strip(s).replace(/,/g,''); return t === '-' || t === '' ? 0 : Number(t); };

function parseStandings(html) {
  const rows = [];
  for (const tr of html.match(/<tr\b[\s\S]*?<\/tr>/gi) || []) {
    const cells = [...tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => m[1]);
    if (cells.length < 9) continue;
    const texts = cells.map(strip);
    const posIndex = texts.findIndex(v => /^(Forward|Midfielder|Defender|Goalkeeper)$/i.test(v));
    if (posIndex < 2) continue;
    const player = texts[0], club = texts[1], position = texts[posIndex];
    const after = texts.slice(posIndex + 1);
    if (after.length < 6 || !/^\d+$/.test(after[0].replace(/,/g,''))) continue;
    rows.push({
      player, club, position,
      total: num(after[0]), goals: num(after[1]), assists: num(after[2]),
      yellowEvents: num(after[3]), redYellow: num(after[4]), straightRed: num(after[5])
    });
  }
  return rows;
}

function bestMatch(target, statRows, forcedName = '') {
  const reviewed = forcedName || STATBUNKER_NAME[target.player.playerId] || '';
  const names = [reviewed, target.player.name, ...(Array.isArray(target.player.aliases) ? target.player.aliases : [])].map(norm).filter(Boolean);
  let candidates = statRows.filter(r => names.includes(norm(r.player)));
  if (!candidates.length && !reviewed) {
    const targetTokens = new Set(norm(target.player.name).split(' ').filter(Boolean));
    candidates = statRows.filter(r => {
      const rt = new Set(norm(r.player).split(' ').filter(Boolean));
      const common = [...targetTokens].filter(t => rt.has(t)).length;
      return common >= 2 && common === Math.min(targetTokens.size, rt.size);
    });
  }
  if (candidates.length > 1 && !forcedName) {
    const club = normClub(target.record.club);
    const clubMatches = candidates.filter(r => normClub(r.club) === club);
    if (clubMatches.length === 1) candidates = clubMatches;
  }
  return candidates.length === 1 ? candidates[0] : { ambiguous: candidates };
}

function levenshtein(a, b) {
  a = norm(a); b = norm(b);
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) cur[j] = Math.min(cur[j-1] + 1, prev[j] + 1, prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    for (let j = 0; j < cur.length; j += 1) prev[j] = cur[j];
  }
  return prev[b.length];
}

function closestCandidates(target, statRows) {
  const wantedClub = normClub(target.record.club);
  const wantedPosition = { GK: 'goalkeeper', DEF: 'defender', MID: 'midfielder', FWD: 'forward' }[target.record.position] || '';
  const pool = statRows.filter(r => normClub(r.club) === wantedClub && (!wantedPosition || norm(r.position) === wantedPosition));
  return pool.map(r => ({ player: r.player, club: r.club, position: r.position, distance: levenshtein(target.player.name, r.player), total: r.total, goals: r.goals, assists: r.assists, yellowEvents: r.yellowEvents, redYellow: r.redYellow, straightRed: r.straightRed }))
    .sort((a,b) => a.distance - b.distance || a.player.localeCompare(b.player)).slice(0, 3);
}

const requestHeaders = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
  'accept': 'text/html,application/xhtml+xml', 'accept-language': 'en-GB,en;q=0.9', 'referer': 'https://www.statbunker.com/'
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchStatBunker(url, season) {
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const attemptUrl = `${url}&_fpl_audit=${Date.now()}_${attempt}`;
    try {
      const response = await fetch(attemptUrl, { headers: requestHeaders, redirect: 'follow' });
      lastStatus = response.status;
      const html = await response.text();
      console.log(`${season} fetch attempt ${attempt}: HTTP ${response.status}, ${html.length} bytes, final=${response.url}`);
      if (response.ok && html.length > 100000) return { response, html };
    } catch (error) { console.log(`${season} fetch attempt ${attempt}: ${error.message}`); }
    if (attempt < 10) await sleep(1800);
  }
  throw new Error(`${season} StatBunker fetch failed after retries; last HTTP status ${lastStatus}`);
}

const report = { generatedAt: new Date().toISOString(), source: 'StatBunker PlayerStandings', seasons: {}, recoveries: [], unresolved: [], identityMigrations: [] };
for (const [season, cfg] of Object.entries(seasons)) {
  const { response, html } = await fetchStatBunker(cfg.url, season);
  const statRows = parseStandings(html);
  if (statRows.length < 400) throw new Error(`${season} StatBunker parse returned only ${statRows.length} player rows`);
  const targets = players.flatMap(player => (player.seasons || []).filter(record => record.season === season && (record.yellowCards === null || record.yellowCards === undefined || record.yellowCards === '')).map(record => ({ player, record })));
  let matched = 0, ambiguous = 0, missing = 0, correctedSecondYellow = 0;
  for (const target of targets) {
    const migration = IDENTITY_MIGRATIONS[`${season}::${target.player.playerId}`];
    const match = bestMatch(target, statRows, migration?.statBunkerName || '');
    if (match && !match.ambiguous) {
      const yellowCards = Math.max(0, match.yellowEvents - match.redYellow);
      const redCards = match.redYellow + match.straightRed;
      if (match.redYellow) correctedSecondYellow += 1;
      const recovery = { season, playerId: migration?.targetPlayerId || target.player.playerId, sourcePlayerId: migration ? target.player.playerId : undefined, name: migration ? players.find(p => p.playerId === migration.targetPlayerId)?.name : target.player.name, club: target.record.club, statBunkerName: match.player, statBunkerClub: match.club, yellowEvents: match.yellowEvents, redYellow: match.redYellow, straightRed: match.straightRed, yellowCards, redCards, sourceUrl: response.url };
      report.recoveries.push(recovery);
      if (migration) report.identityMigrations.push({ season, fromPlayerId: target.player.playerId, toPlayerId: migration.targetPlayerId, reason: migration.reason, statBunkerName: match.player, yellowCards });
      matched += 1;
    } else {
      const count = match?.ambiguous?.length || 0;
      report.unresolved.push({ season, playerId: target.player.playerId, name: target.player.name, club: target.record.club, position: target.record.position, minutes: target.record.minutes, goals: target.record.goals, assists: target.record.assists, reason: count ? 'ambiguous-name-match' : 'no-name-match', candidates: (match?.ambiguous || []).map(r => `${r.player} — ${r.club}`), suggestions: closestCandidates(target, statRows) });
      if (count) ambiguous += 1; else missing += 1;
    }
  }
  report.seasons[season] = { compId: cfg.compId, sourceUrl: response.url, statRows: statRows.length, targets: targets.length, matched, ambiguous, missing, correctedSecondYellow };
}

fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/statbunker-card-recovery-2012-14.json', JSON.stringify(report, null, 2));
console.log('STATBUNKER CARD RECOVERY');
console.log(JSON.stringify(report.seasons, null, 2));
console.log(`Total recovered: ${report.recoveries.length}`);
console.log(`Total unresolved: ${report.unresolved.length}`);
console.log(`Identity migrations: ${report.identityMigrations.length}`);
for (const row of report.identityMigrations) console.log(`MIGRATE ${row.season}: ${row.fromPlayerId} -> ${row.toPlayerId}; StatBunker=${row.statBunkerName}; yellowCards=${row.yellowCards}`);
if (report.unresolved.length) {
  console.log('UNRESOLVED');
  for (const row of report.unresolved) console.log(`${row.season}\t${row.playerId}\t${row.name}\t${row.club}\t${row.position}\tmins=${row.minutes}\t${row.reason}\t${row.suggestions.map(s => `${s.player}[d=${s.distance},Y=${s.yellowEvents},RY=${s.redYellow},R=${s.straightRed}]`).join(' | ')}`);
}
console.log('REVIEWED SPECIAL-NAME VALUES');
for (const row of report.recoveries.filter(r => STATBUNKER_NAME[r.sourcePlayerId || r.playerId] || r.sourcePlayerId)) console.log(`${row.season}\t${row.sourcePlayerId || row.playerId}\t${row.statBunkerName}\tY=${row.yellowEvents}\tRY=${row.redYellow}\tR=${row.straightRed}\tFPL-yellow=${row.yellowCards}`);
