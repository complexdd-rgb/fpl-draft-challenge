import fs from 'node:fs';

const reportPath = 'reports/nationality-enrichment-report.json';
const enrichmentPath = 'nationality-enrichment.js';
const outputReportPath = 'reports/nationality-final-residue-report.json';

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const missingRows = Array.isArray(report.projectedMissingPlayers) ? report.projectedMissingPlayers : [];
const missingIds = new Set(missingRows.map(row => String(row.playerId)));
const conflicts = Array.isArray(report.conflictDetails) ? report.conflictDetails : (Array.isArray(report.conflictsDetail) ? report.conflictsDetail : (Array.isArray(report.conflicts) ? report.conflicts : []));

// Current report schema stores conflict detail under `conflictDetails` in newer runs;
// older generated reports may expose the detail array as `conflictsList`. Fall back safely.
const conflictRows = Array.isArray(report.conflictDetails)
  ? report.conflictDetails
  : Array.isArray(report.conflictsList)
    ? report.conflictsList
    : [];

function year(value) {
  const parsed = Number.parseInt(String(value || '').slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : -Infinity;
}

function resolveConflict(row) {
  const candidates = Array.isArray(row?.candidates) ? row.candidates.filter(Boolean) : [];
  if (!candidates.length) return null;
  const bestScore = Math.max(...candidates.map(item => Number(item.score) || 0));
  const strongest = candidates.filter(item => (Number(item.score) || 0) === bestScore);
  const strongestNationalities = [...new Set(strongest.map(item => String(item.nationality || '').trim()).filter(Boolean))];
  if (strongestNationalities.length === 1) {
    const winner = strongest.slice().sort((a, b) => year(b.season) - year(a.season))[0];
    return { nationality: strongestNationalities[0], method: 'strongest-identity-evidence', winner };
  }

  // For genuine allegiance changes, nationality is player-level and should reflect the
  // most recent exact/shared identity evidence. We only resolve when that newest season
  // has one unambiguous nationality among the strongest candidates.
  const latestYear = Math.max(...strongest.map(item => year(item.season)));
  const latest = strongest.filter(item => year(item.season) === latestYear);
  const latestNationalities = [...new Set(latest.map(item => String(item.nationality || '').trim()).filter(Boolean))];
  if (latestNationalities.length === 1) {
    return { nationality: latestNationalities[0], method: 'latest-strongest-identity-evidence', winner: latest[0] };
  }
  return null;
}

const mapping = {};
const resolved = [];
for (const row of conflictRows) {
  const playerId = String(row?.playerId || '');
  if (!missingIds.has(playerId)) continue;
  const result = resolveConflict(row);
  if (!result) continue;
  mapping[playerId] = result.nationality;
  resolved.push({
    playerId,
    name: row.name,
    nationality: result.nationality,
    method: result.method,
    sourceFile: result.winner?.sourceFile || null,
    sourceSeason: result.winner?.season || null,
    sourceDisplayName: result.winner?.displayName || null,
    score: result.winner?.score ?? null
  });
}

const orderedMapping = Object.fromEntries(Object.entries(mapping).sort((a, b) => a[0].localeCompare(b[0])));
if (Object.keys(orderedMapping).length) {
  const overlay = `\n/* Final nationality residue resolver. Only fills players still missing nationality after the bulk pass. */\n(() => {\n  \"use strict\";\n  const mapping = ${JSON.stringify(orderedMapping)};\n  const players = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];\n  let applied = 0;\n  for (const player of players) {\n    const nationality = mapping[String(player?.playerId)];\n    if (!nationality) continue;\n    if (!player.bio || typeof player.bio !== \"object\") player.bio = {};\n    if (String(player.bio.nationality || \"\").trim()) continue;\n    const regionId = player.bio.regionId;\n    if (regionId !== null && regionId !== undefined && regionId !== \"\" && Number.isFinite(Number(regionId))) continue;\n    player.bio.nationality = nationality;\n    applied += 1;\n  }\n  window.FPL_NATIONALITY_FINAL_RESIDUE = Object.freeze({ version: \"1.0.0\", applied, mapped: Object.keys(mapping).length });\n})();\n`;
  fs.appendFileSync(enrichmentPath, overlay);
}

const remaining = missingRows.filter(row => !orderedMapping[String(row.playerId)]);
const finalReport = {
  generatedAt: new Date().toISOString(),
  startingMissing: missingRows.length,
  autoResolved: resolved.length,
  remainingMissing: remaining.length,
  finalCoverage: report.eligiblePlayers ? report.eligiblePlayers - remaining.length : null,
  finalCoveragePercent: report.eligiblePlayers ? Number(((report.eligiblePlayers - remaining.length) / report.eligiblePlayers * 100).toFixed(1)) : null,
  resolved,
  remaining
};
fs.writeFileSync(outputReportPath, `${JSON.stringify(finalReport, null, 2)}\n`);
console.log(JSON.stringify({ startingMissing: finalReport.startingMissing, autoResolved: finalReport.autoResolved, remainingMissing: finalReport.remainingMissing, finalCoveragePercent: finalReport.finalCoveragePercent }, null, 2));
