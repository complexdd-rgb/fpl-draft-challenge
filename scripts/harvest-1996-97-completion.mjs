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
          'accept': 'text/html,application/xhtml+xml',
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
    const firstRows = $(table).find('tr').slice(0, 4);
    const headerText = clean(firstRows.text()).toLowerCase();
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
    if (cells.length < 7) return;
    if (cells[0].toLowerCase() === 'players') return;
    if (!cells[0] || cells[0].toLowerCase().includes('total =')) return;

    // Club-filtered SeasonAppearances columns: Players | Total | Start | Sub | CO | Off | Goals | More
    const total = toNumber(cells[1]);
    const start = toNumber(cells[2]);
    const sub = toNumber(cells[3]);
    const cameOn = toNumber(cells[4]);
    const off = toNumber(cells[5]);
    const goals = toNumber(cells[6]);
    if ([total, start, sub, cameOn, off, goals].some(v => v === null)) return;

    rows.push({
      player: cells[0],
      total,
      start,
      sub,
      cameOn,
      off,
      goals,
    });
  });

  const playerRows = rows.filter(r => r.player && !/^\d+$/.test(r.player));
  const startSum = playerRows.reduce((sum, r) => sum + r.start, 0);
  if (startSum !== 418) {
    throw new Error(`${meta.club}: expected 418 starts, parsed ${startSum} across ${playerRows.length} rows`);
  }

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
  const candidates = [];

  $('table').each((_, table) => {
    const tableRows = [];
    $(table).find('tr').each((__, tr) => {
      const cells = $(tr).find('th,td').map((___, td) => clean($(td).text())).get();
      if (cells.length) tableRows.push(cells);
    });
    if (tableRows.length) candidates.push(tableRows);
  });

  let best = null;
  for (const tableRows of candidates) {
    const headerIndex = tableRows.findIndex(row => {
      const lower = row.map(x => x.toLowerCase());
      return lower.some(x => x === 'name') && lower.some(x => x === 'nat' || x === 'nationality') && lower.some(x => x === 'pos' || x === 'position');
    });
    if (headerIndex >= 0) {
      const headers = tableRows[headerIndex].map(x => x.toLowerCase());
      const nameIndex = headers.findIndex(x => x === 'name');
      const natIndex = headers.findIndex(x => x === 'nat' || x === 'nationality');
      const posIndex = headers.findIndex(x => x === 'pos' || x === 'position');
      const parsed = tableRows.slice(headerIndex + 1)
        .filter(row => row.length > Math.max(nameIndex, natIndex, posIndex))
        .map(row => ({ name: clean(row[nameIndex]), nationality: clean(row[natIndex]), position: clean(row[posIndex]) }))
        .filter(row => row.name && row.nationality && !/^(name|player)$/i.test(row.name));
      if (!best || parsed.length > best.length) best = parsed;
    }
  }

  if (!best || best.length < 20) {
    // Fallback for pages whose table uses implicit column order: Number | Name | Nat | Pos | ...
    for (const tableRows of candidates) {
      const parsed = tableRows
        .filter(row => row.length >= 4)
        .map(row => ({ name: clean(row[1]), nationality: clean(row[2]), position: clean(row[3]) }))
        .filter(row => row.name && row.nationality && !/^(name|player|nat)$/i.test(row.name) && /^[A-Z]{3}$/i.test(row.nationality));
      if (!best || parsed.length > best.length) best = parsed;
    }
  }

  if (!best || best.length < 20) {
    throw new Error(`${club}: could not parse FootballSquads rows (best=${best?.length ?? 0})`);
  }

  return { club, sourceUrl: url, rowCount: best.length, rows: best };
}

const statbunker = [];
for (const meta of statbunkerClubs) {
  const url = `https://statbunker.com/competitions/SeasonAppearances?club_id=${meta.clubId}&comp_id=9`;
  console.log(`Fetching StatBunker ${meta.club}: ${url}`);
  const html = await fetchText(url);
  const parsed = parseStatBunker(html, meta);
  console.log(`  ${parsed.rowCount} rows; ${parsed.startSum} starts`);
  statbunker.push(parsed);
}

const footballSquadsNationality = [];
for (const [club, slug] of footballSquads) {
  const url = `https://www.footballsquads.co.uk/eng/1996-1997/faprem/${slug}`;
  console.log(`Fetching FootballSquads ${club}: ${url}`);
  const html = await fetchText(url);
  const parsed = parseFootballSquads(html, club, url);
  console.log(`  ${parsed.rowCount} nationality rows`);
  footballSquadsNationality.push(parsed);
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

const natOut = {
  generatedAt: new Date().toISOString(),
  season: '1996/97',
  source: 'FootballSquads',
  clubs: footballSquadsNationality,
  sourceRowCount: footballSquadsNationality.reduce((sum, c) => sum + c.rowCount, 0),
};

fs.writeFileSync(path.join(OUT_DIR, 'statbunker-six-club-season-appearances.json'), `${JSON.stringify(statOut, null, 2)}\n`);
fs.writeFileSync(path.join(OUT_DIR, 'footballsquads-nationality-harvest.json'), `${JSON.stringify(natOut, null, 2)}\n`);

console.log(`StatBunker six-club harvest complete: ${statOut.totalStartSum} starts.`);
console.log(`FootballSquads nationality harvest complete: ${natOut.sourceRowCount} source rows.`);
