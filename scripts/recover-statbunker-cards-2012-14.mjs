import fs from 'node:fs';
import vm from 'node:vm';

const seasons = {
  '2012/13': { compId: 415, url: 'https://dr.statbunker.com/competitions/PlayerStandings?comp_id=415' },
  '2013/14': { compId: 449, url: 'https://dr.statbunker.com/competitions/PlayerStandings?comp_id=449' }
};

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
    // Player standings columns: Players, Clubs, Position, Total, Goals, A, Yellow, Red+Yellow, Red, Start...
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

function bestMatch(target, statRows) {
  const names = [target.player.name, ...(Array.isArray(target.player.aliases) ? target.player.aliases : [])].map(norm).filter(Boolean);
  let candidates = statRows.filter(r => names.includes(norm(r.player)));
  if (!candidates.length) {
    // Conservative token fallback for punctuation/known expanded-name differences only.
    const targetTokens = new Set(norm(target.player.name).split(' ').filter(Boolean));
    candidates = statRows.filter(r => {
      const rt = new Set(norm(r.player).split(' ').filter(Boolean));
      const common = [...targetTokens].filter(t => rt.has(t)).length;
      return common >= 2 && common === Math.min(targetTokens.size, rt.size);
    });
  }
  if (candidates.length > 1) {
    const club = normClub(target.record.club);
    const clubMatches = candidates.filter(r => normClub(r.club) === club);
    if (clubMatches.length === 1) candidates = clubMatches;
  }
  return candidates.length === 1 ? candidates[0] : { ambiguous: candidates };
}

const report = { generatedAt: new Date().toISOString(), source: 'StatBunker PlayerStandings', seasons: {}, recoveries: [], unresolved: [] };
for (const [season, cfg] of Object.entries(seasons)) {
  const response = await fetch(cfg.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; FPL-Draft-Challenge historical data audit)' } });
  if (!response.ok) throw new Error(`${season} StatBunker fetch failed: ${response.status}`);
  const html = await response.text();
  const statRows = parseStandings(html);
  const targets = players.flatMap(player => (player.seasons || []).filter(record => record.season === season && (record.yellowCards === null || record.yellowCards === undefined || record.yellowCards === '')).map(record => ({ player, record })));
  let matched = 0, ambiguous = 0, missing = 0, correctedSecondYellow = 0;
  for (const target of targets) {
    const match = bestMatch(target, statRows);
    if (match && !match.ambiguous) {
      // Project convention established in 2011/12 audit: StatBunker yellow event total includes the second yellow that produces a dismissal.
      // FPL-style yellowCards therefore subtracts Red+Yellow events; sent-off events are kept separately.
      const yellowCards = Math.max(0, match.yellowEvents - match.redYellow);
      const redCards = match.redYellow + match.straightRed;
      if (match.redYellow) correctedSecondYellow += 1;
      report.recoveries.push({ season, playerId: target.player.playerId, name: target.player.name, club: target.record.club, statBunkerName: match.player, statBunkerClub: match.club, yellowEvents: match.yellowEvents, redYellow: match.redYellow, straightRed: match.straightRed, yellowCards, redCards, sourceUrl: cfg.url });
      matched += 1;
    } else {
      const count = match?.ambiguous?.length || 0;
      report.unresolved.push({ season, playerId: target.player.playerId, name: target.player.name, club: target.record.club, reason: count ? 'ambiguous-name-match' : 'no-name-match', candidates: (match?.ambiguous || []).map(r => `${r.player} — ${r.club}`) });
      if (count) ambiguous += 1; else missing += 1;
    }
  }
  report.seasons[season] = { compId: cfg.compId, sourceUrl: cfg.url, statRows: statRows.length, targets: targets.length, matched, ambiguous, missing, correctedSecondYellow };
}

fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/statbunker-card-recovery-2012-14.json', JSON.stringify(report, null, 2));
console.log('STATBUNKER CARD RECOVERY');
console.log(JSON.stringify(report.seasons, null, 2));
console.log(`Total recovered: ${report.recoveries.length}`);
console.log(`Total unresolved: ${report.unresolved.length}`);
if (report.unresolved.length) {
  console.log('UNRESOLVED');
  for (const row of report.unresolved) console.log(`${row.season}\t${row.playerId}\t${row.name}\t${row.club}\t${row.reason}\t${row.candidates.join(' | ')}`);
}
console.log('SECOND-YELLOW ADJUSTMENT SAMPLE');
for (const row of report.recoveries.filter(r => r.redYellow).slice(0, 20)) console.log(`${row.season}\t${row.name}\tY=${row.yellowEvents}\tRY=${row.redYellow}\tFPL-yellow=${row.yellowCards}\tred=${row.redCards}`);
