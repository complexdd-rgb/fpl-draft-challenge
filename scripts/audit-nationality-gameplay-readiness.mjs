import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('players.js', 'utf8');
const sandbox = { window: { addEventListener() {}, removeEventListener() {} }, console, setTimeout() { return 0; }, clearTimeout() {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'players.js', timeout: 30_000 });
const players = sandbox.window.FPL_PLAYERS;
const recovery = JSON.parse(fs.readFileSync('artifacts/nationality-recoverability-detail.json', 'utf8'));
const recoveryById = new Map(recovery.map(item => [item.playerId, item]));

const eligible = players.filter(player => (player.seasons || []).some(row => Number(row?.minutes) > 0));
let alreadyKnown = 0;
let recoverable = 0;
let conflict = 0;
let unmatched = 0;
const residual = [];

for (const player of eligible) {
  if (player?.bio?.regionId != null) {
    alreadyKnown += 1;
    continue;
  }
  const result = recoveryById.get(player.playerId);
  if (result?.status === 'RECOVERABLE') recoverable += 1;
  else if (result?.status === 'CONFLICT') {
    conflict += 1;
    residual.push({ playerId: player.playerId, name: player.name, status: 'CONFLICT', seasons: (player.seasons || []).filter(r => Number(r?.minutes) > 0).map(r => r.season) });
  } else {
    unmatched += 1;
    residual.push({ playerId: player.playerId, name: player.name, status: 'NO_MATCH', seasons: (player.seasons || []).filter(r => Number(r?.minutes) > 0).map(r => r.season) });
  }
}

const projectedKnown = alreadyKnown + recoverable;
const summary = {
  answerEligiblePlayers: eligible.length,
  alreadyHaveOfficialRegionId: alreadyKnown,
  recoverableFromBulkSource: recoverable,
  residualConflicts: conflict,
  residualUnmatched: unmatched,
  residualEligiblePlayers: conflict + unmatched,
  projectedEligibleCoverage: projectedKnown,
  projectedEligibleCoveragePct: Number((100 * projectedKnown / Math.max(1, eligible.length)).toFixed(1)),
  zeroMinuteOnlyPlayersIgnored: players.length - eligible.length
};
fs.writeFileSync('artifacts/nationality-gameplay-readiness-summary.json', JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync('artifacts/nationality-gameplay-residual.json', JSON.stringify(residual, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
