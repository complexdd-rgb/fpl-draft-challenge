import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const OUT_DIR = 'data/recovery/1996-97';
fs.mkdirSync(OUT_DIR, { recursive: true });

const USER_AGENT = 'Mozilla/5.0 (compatible; FPL-Draft-Challenge-Historical-Audit/1.0)';

const statbunkerClubs = [
  { club: 'Aston Villa', rawClub: 'Aston Villa', clubId: 24 },
  { club: 'Blackburn Rovers', rawClub: 'Blackburn Rovers', clubId: 34 },
  { club: 'Derby County', rawClub: 'Derby County', clubId: 9 },
  { club: 'Liverpool', rawClub: 'Liverpool', clubId: 4 },
  { club: 'Southampton', rawClub: 'Southampton', clubId: 18 },
  { club: 'Wimbledon', rawClub: 'Milton Keynes Dons', clubId: 22 },
];

const footballSquads = [
  ['Arsenal', 'arsenal.htm'],
  ['Aston Villa', 'avilla.htm'],
  ['Blackburn Rovers', 'blackbrn.htm'],
  ['Chelsea', 'chelsea.htm'],
  ['Coventry City', 'coventry.htm'],
  ['Derby County', 'derby.htm'],
  ['Everton', 'everton.htm'],
  ['Leeds United', 'leeds.htm'],
  ['Leicester City', 'leicester.htm'],
  ['Liverpool', 'liverpool.htm'],
  ['Manchester United', 'manutd.htm'],
  ['Middlesbrough', 'middles.htm'],
  ['Newcastle United', 'newcas.htm'],
  ['Nottingham Forest', 'nottmf.htm'],
  ['Sheffield Wednesday', 'sheffwed.htm'],
  ['Southampton', 'southam.htm'],
  ['Sunderland', 'sunder.htm'],
  ['Tottenham Hotspur', 'tottenha.htm'],
  ['West Ham United', 'westham.htm'],
  ['Wimbledon', 'wimbled.htm'],
];

function clean(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  const t = clean(value);
  if (!t || t === '-' || t === '–') return 0;
  const m = t.match(/-?\d+/);
  return m ? Number(m[0]) : null;
}

async function fetchText(url, attempts = 4) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'en-GB,en;q=0.9',
        },
        redirect: 'follow',
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const text = await response.text();
      if (text.length < 1000) throw new Error(`unexpected short response (${text.length} bytes)`);
      return text;
    } catch (error) {
      lastError = error;
      console.error(`Fetch attempt ${i}/${attempts} failed: ${url}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, i * 1500));
    }
  }
  throw lastError;
}

function findTableByHeaders($, required) {
  let found = null;
  $('table').each((_, table) => {
    if (found) return;
    const headerText = clean($(table).find('tr').slice(0, 4).text()).toLowerCase();
    if (required.every(token => headerText.includes(token.toLowerCase()))) found = table;
  });
  return found;
}

function parseStatBunker(html, meta) {
  const $ = cheerio.load(html);
  const table = findTableByHeaders($, ['Players', 'Total', 'Start', 'Goals']);
  if (!table) throw new Error(`Could not locate SeasonAppearances table for ${meta.club}`);

  const rows = [];
  $(table).find('tr').each((_, tr) => {
    const cells = $(tr).find('th,td').map((__, td) => clean($(td).text())).get();
    if (cells.length < 7 || cells[0].toLowerCase() === 'players' || !cells[0]) return;
    const total = toNumber(cells[1]);
    const start = toNumber(cells[2]);
    const sub = toNumber(cells[3]);
    const cameOn = toNumber(cells[4]);
    const off = toNumber(cells[5]);
    const goals = toNumber(cells[6]);
    if ([total, start, sub, cameOn, off, goals].some(v => v === null)) return;
    rows.push({ player: cells[0], total, start, sub, cameOn, off, goals });
  });

  const playerRows = rows.filter(r => r.player && !/^\d+$/.test(r.player));
  const startSum = playerRows.reduce((sum, r) => sum + r.start, 0);
  if (startSum !== 418) throw new Error(`${meta.club}: expected 418 starts, parsed ${startSum}`);

  return {
    club: meta.club,
    statbunkerRawClub: meta.rawClub,
    clubId: meta.clubId,
    compId: 9,
    sourceUrl: `https://statbunker.com/competitions/SeasonAppearances?club_id=${meta.clubId}&comp_id=9`,
    rowCount: playerRows.length,
    startSum,
    rows: playerRows,
  };
}

function parseFootballSquads(html, club, url) {
  const $ = cheerio.load(html);
  const bodyText = clean($('body').text());
  const rows = [];

  // Modern/table-style fallback.
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('th,td').map((__, td) => clean($(td).text())).get();
    if (cells.length >= 4 && /^[A-Z]{3}$/i.test(cells[2] || '')) {
      rows.push({ name: cells[1], nationality: cells[2].toUpperCase(), position: cells[3] });
    }
  });

  // Older FootballSquads pages can render as preformatted/comma-separated lines.
  if (rows.length < 20) {
    const text = $('pre').length ? $('pre').text() : bodyText;
    for (const rawLine of String(text).split(/\r?\n/)) {
      const line = clean(rawLine);
      if (!line) continue;
      const parts = line.split(',').map(clean);
      if (parts.length >= 4 && /^[A-Z]{3}$/i.test(parts[2] || '')) {
        rows.push({ name: parts[1], nationality: parts[2].toUpperCase(), position: parts[3] });
      }
    }
  }

  const deduped = [...new Map(rows.filter(r => r.name).map(r => [`${r.name}\u0000${r.nationality}\u0000${r.position}`, r])).values()];
  if (deduped.length < 20) throw new Error(`${club}: could not parse FootballSquads rows (parsed=${deduped.length})`);
  return { club, sourceUrl: url, rowCount: deduped.length, rows: deduped };
}

// StatBunker completion is the primary lane. Persist it as soon as its hard controls pass.
const statbunker = [];
for (const meta of statbunkerClubs) {
  const url = `https://statbunker.com/competitions/SeasonAppearances?club_id=${meta.clubId}&comp_id=9`;
  console.log(`Fetching StatBunker ${meta.club}: ${url}`);
  const html = await fetchText(url);
  const parsed = parseStatBunker(html, meta);
  console.log(`  ${parsed.rowCount} rows; ${parsed.startSum} starts`);
  statbunker.push(parsed);
}

const statOut = {
  generatedAt: new Date().toISOString(),
  season: '1996/97',
  compId: 9,
  expectedClubs: 6,
  totalStartSum: statbunker.reduce((sum, c) => sum + c.startSum, 0),
  clubs: statbunker,
};
if (statOut.totalStartSum !== 6 * 418) throw new Error(`Six-club start audit failed: ${statOut.totalStartSum}`);
fs.writeFileSync(path.join(OUT_DIR, 'statbunker-six-club-season-appearances.json'), `${JSON.stringify(statOut, null, 2)}\n`);
console.log(`StatBunker six-club harvest complete: ${statOut.totalStartSum} starts.`);

// Nationality is valuable but must not be allowed to discard a successful six-club StatBunker harvest.
const footballSquadsNationality = [];
const nationalityErrors = [];
for (const [club, slug] of footballSquads) {
  const url = `https://www.footballsquads.co.uk/eng/1996-1997/faprem/${slug}`;
  console.log(`Fetching FootballSquads ${club}: ${url}`);
  try {
    const html = await fetchText(url);
    const parsed = parseFootballSquads(html, club, url);
    console.log(`  ${parsed.rowCount} nationality rows`);
    footballSquadsNationality.push(parsed);
  } catch (error) {
    console.error(`  NATIONALITY DEFERRED — ${club}: ${error.message}`);
    nationalityErrors.push({ club, sourceUrl: url, error: error.message });
  }
}

const natOut = {
  generatedAt: new Date().toISOString(),
  season: '1996/97',
  source: 'FootballSquads',
  complete: nationalityErrors.length === 0,
  clubsParsed: footballSquadsNationality.length,
  clubsFailed: nationalityErrors.length,
  sourceRowCount: footballSquadsNationality.reduce((sum, c) => sum + c.rowCount, 0),
  clubs: footballSquadsNationality,
  errors: nationalityErrors,
};
fs.writeFileSync(path.join(OUT_DIR, 'footballsquads-nationality-harvest.json'), `${JSON.stringify(natOut, null, 2)}\n`);
console.log(`FootballSquads nationality pass: ${natOut.clubsParsed}/20 clubs, ${natOut.sourceRowCount} parsed rows, ${natOut.clubsFailed} deferred.`);
