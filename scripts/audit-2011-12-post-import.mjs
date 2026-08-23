import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const SEASON = '2011/12';
const EXPECTED_ROWS = 539;

function makeSandbox() {
  const document = {
    readyState: 'complete',
    querySelector() { return null; },
    getElementById() { return null; },
    addEventListener() {},
    removeEventListener() {},
    write() {}
  };
  const localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  };
  const browserWindow = {
    location: { pathname: '/audit' },
    document,
    localStorage,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console
  };
  browserWindow.window = browserWindow;
  const sandbox = {
    window: browserWindow,
    document,
    localStorage,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Intl,
    URL,
    URLSearchParams
  };
  vm.createContext(sandbox);
  return sandbox;
}

function loadScript(sandbox, relativePath) {
  const filename = path.join(ROOT, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  vm.runInContext(source, sandbox, { filename: relativePath, timeout: 120000 });
}

function seasonRows(players, season = SEASON) {
  return players.flatMap(player =>
    (Array.isArray(player.seasons) ? player.seasons : [])
      .filter(record => record.season === season)
      .map(record => ({ player, record }))
  );
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

const canonicalSandbox = makeSandbox();
for (const file of [
  'players.js',
  'js/career-context.js',
  'prompt-library.js',
  'js/validation-engine.js',
  'js/certification-approved-null-policy.js'
]) loadScript(canonicalSandbox, file);

const players = canonicalSandbox.window.FPL_PLAYERS;
const engine = canonicalSandbox.window.ValidationEngine;
if (!Array.isArray(players) || !players.length) throw new Error('players.js did not expose window.FPL_PLAYERS.');
if (!engine?.certifySeason) throw new Error('Current ValidationEngine.certifySeason did not load.');

const canonicalSeasonRows = seasonRows(players);
const duplicatePlayerIds = duplicateValues(players.map(player => String(player.playerId)));
const duplicateSeasonKeys = duplicateValues(players.flatMap(player =>
  (player.seasons || []).map(record => `${String(player.playerId)}\u0000${String(record.season)}`)
));
const zeroMinuteRows = canonicalSeasonRows.filter(({ record }) => !(Number(record.minutes) > 0));

const certification = engine.certifySeason(SEASON);
if (!certification?.ok) throw new Error(certification?.error || 'Season certification did not return an OK result.');

const liveSandbox = makeSandbox();
loadScript(liveSandbox, 'players-live.js');
const livePlayers = liveSandbox.window.FPL_PLAYERS;
if (!Array.isArray(livePlayers) || !livePlayers.length) throw new Error('players-live.js did not expose window.FPL_PLAYERS.');
const liveSeasonRows = seasonRows(livePlayers);

const canonicalSeasonIds = new Set(canonicalSeasonRows.map(({ player }) => String(player.playerId)));
const liveSeasonIds = new Set(liveSeasonRows.map(({ player }) => String(player.playerId)));
const missingFromLive = [...canonicalSeasonIds].filter(id => !liveSeasonIds.has(id));
const extraInLive = [...liveSeasonIds].filter(id => !canonicalSeasonIds.has(id));

const failures = [];
if (canonicalSeasonRows.length !== EXPECTED_ROWS) failures.push(`canonical season row count ${canonicalSeasonRows.length} != ${EXPECTED_ROWS}`);
if (liveSeasonRows.length !== EXPECTED_ROWS) failures.push(`live season row count ${liveSeasonRows.length} != ${EXPECTED_ROWS}`);
if (duplicatePlayerIds.length) failures.push(`${duplicatePlayerIds.length} duplicate canonical player IDs`);
if (duplicateSeasonKeys.length) failures.push(`${duplicateSeasonKeys.length} duplicate canonical player-season keys`);
if (zeroMinuteRows.length) failures.push(`${zeroMinuteRows.length} zero/non-positive-minute ${SEASON} rows`);
if (missingFromLive.length) failures.push(`${missingFromLive.length} ${SEASON} identities missing from players-live.js`);
if (extraInLive.length) failures.push(`${extraInLive.length} unexpected ${SEASON} identities in players-live.js`);
if (!certification.certified || certification.status !== 'Certified') failures.push(`ValidationEngine status ${certification.status}`);
if (Number(certification.criticalFailures) !== 0) failures.push(`${certification.criticalFailures} critical certification failures`);
if (Number(certification.promptSummary?.runtimeErrors || 0) !== 0) failures.push(`${certification.promptSummary.runtimeErrors} prompt runtime errors`);
if (Number(certification.promptSummary?.diagnosticMismatches || 0) !== 0) failures.push(`${certification.promptSummary.diagnosticMismatches} Rule Tester/prompt-engine disagreements`);
if (Number(certification.promptSummary?.zeroMinuteAccepted || 0) !== 0) failures.push(`${certification.promptSummary.zeroMinuteAccepted} accepted zero-minute prompt answers`);

const report = {
  generatedAt: new Date().toISOString(),
  season: SEASON,
  expectedRows: EXPECTED_ROWS,
  canonical: {
    totalPlayers: players.length,
    seasonRows: canonicalSeasonRows.length,
    positiveMinuteRows: canonicalSeasonRows.length - zeroMinuteRows.length,
    duplicatePlayerIds: duplicatePlayerIds.length,
    duplicatePlayerSeasonKeys: duplicateSeasonKeys.length
  },
  live: {
    totalPlayers: livePlayers.length,
    seasonRows: liveSeasonRows.length,
    missingSeasonIdentities: missingFromLive.length,
    extraSeasonIdentities: extraInLive.length
  },
  certification: {
    status: certification.status,
    certified: certification.certified,
    fingerprint: certification.fingerprint,
    criticalFailures: certification.criticalFailures,
    health: certification.health?.summary || {},
    metadataGaps: certification.health?.metadataGaps,
    optionalMetadataGaps: certification.health?.optionalMetadataGaps,
    completeness: certification.health?.completeness,
    promptSummary: certification.promptSummary,
    tests: (certification.tests || []).map(test => ({
      id: test.id,
      label: test.label,
      passed: test.passed,
      actual: test.actual,
      expected: test.expected,
      details: test.details || []
    })),
    warnings: certification.warnings || []
  },
  structuralExamples: {
    duplicatePlayerIds: duplicatePlayerIds.slice(0, 25),
    duplicatePlayerSeasonKeys: duplicateSeasonKeys.slice(0, 25),
    zeroMinutePlayers: zeroMinuteRows.slice(0, 25).map(({ player, record }) => `${player.name} (${record.minutes})`),
    missingFromLive: missingFromLive.slice(0, 25),
    extraInLive: extraInLive.slice(0, 25)
  },
  failures
};

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/2011-12-post-import-certification.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(ROOT, 'reports/2011-12-post-import-certification.txt'), engine.makeCertificationReport(certification));

console.log('FPL 2011/12 POST-IMPORT CERTIFICATION AUDIT');
console.log(`Canonical rows: ${canonicalSeasonRows.length}/${EXPECTED_ROWS}`);
console.log(`Live rows: ${liveSeasonRows.length}/${EXPECTED_ROWS}`);
console.log(`Duplicate player IDs: ${duplicatePlayerIds.length}`);
console.log(`Duplicate player-season keys: ${duplicateSeasonKeys.length}`);
console.log(`Zero/non-positive-minute rows: ${zeroMinuteRows.length}`);
console.log(`Certification: ${certification.status}`);
console.log(`Fingerprint: ${certification.fingerprint}`);
console.log(`Critical failures: ${certification.criticalFailures}`);
console.log(`Enabled prompts: ${certification.promptSummary?.prompts}`);
console.log(`Prompt evaluations: ${certification.promptSummary?.evaluations}`);
console.log(`Runtime errors: ${certification.promptSummary?.runtimeErrors}`);
console.log(`Rule Tester disagreements: ${certification.promptSummary?.diagnosticMismatches}`);
console.log(`Zero-minute answers accepted: ${certification.promptSummary?.zeroMinuteAccepted}`);
console.log(`Warnings: ${(certification.warnings || []).length}`);
for (const test of certification.tests || []) console.log(`${test.passed ? 'PASS' : 'FAIL'} — ${test.label}: ${test.actual}`);
for (const warning of certification.warnings || []) console.log(`WARNING — ${warning.label}: ${warning.count}`);

if (failures.length) {
  console.error('\nAUDIT FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nAUDIT PASSED');
