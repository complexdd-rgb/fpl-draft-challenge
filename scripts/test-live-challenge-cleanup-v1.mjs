import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const exists = path => fs.existsSync(path);
const failures = [];
const requireText = (source, needle, message) => { if (!source.includes(needle)) failures.push(message); };
const forbidText = (source, needle, message) => { if (source.includes(needle)) failures.push(message); };

const index = read('index.html');
const loader = read('js/live-feature-loader.js');
const bootstrap = read('js/live-ui-bootstrap.js');
const header = read('js/top-header-polish.js');
const phase45 = read('js/phase45-dashboard.js');
const mobile = read('js/mobile-results-cleanup.js');
const uiPass = read('player-ui-pass-3.css');
const compat = read('player-daily-redesign-v1-compat.css');
const resultsV2 = read('js/results-v2.js');
const leaderboardConfig = read('js/leaderboard-config.js');

const retired = [
  'js/ui-cleanup.js',
  'js/live-visual-enhancements.js',
  'js/autocomplete-layer.js',
  'js/draft-board-polish.js',
  'js/visual-overhaul.js',
  'js/visual-finishing.js',
  'js/results-polish-v3.js'
];
for (const file of retired) {
  if (exists(file)) failures.push(`${file} must remain physically retired.`);
  forbidText(index, file, `index.html must not load retired ${file}.`);
  forbidText(loader, file, `live-feature-loader.js must not reference retired ${file}.`);
  forbidText(bootstrap, file, `live-ui-bootstrap.js must not reference retired ${file}.`);
}

for (const needle of [
  'js/challenge-manifest-bootstrap.js?v=1.0.0',
  'js/daily-challenge-loader.js?v=1.0.0',
  'js/challenge-legacy-fallback.js?v=1.0.0',
  'js/challenge-archive.js?v=2.0.0',
  'js/prompt-helpers.js?v=1.0.0',
  'players-live.js?v=1.0.0',
  'js/career-context.js?v=1.5.0',
  'js/game-engine.js?v=1.0.0'
]) requireText(index, needle, `Core live dependency missing: ${needle}`);

const coreOrder = [
  'js/challenge-manifest-bootstrap.js?v=1.0.0',
  'js/daily-challenge-loader.js?v=1.0.0',
  'js/challenge-legacy-fallback.js?v=1.0.0',
  'js/challenge-archive.js?v=2.0.0',
  'js/prompt-helpers.js?v=1.0.0',
  'players-live.js?v=1.0.0',
  'js/career-context.js?v=1.5.0',
  'js/game-engine.js?v=1.0.0'
].map(item => index.indexOf(item));
if (!coreOrder.every(value => value >= 0) || !coreOrder.every((value, i) => i === 0 || value > coreOrder[i - 1])) {
  failures.push('Core challenge/data/game-engine load order must remain unchanged.');
}

for (const [needle, message] of [
  ['player-ui-pass-3.css?v=1.1.0', 'Trimmed local-history stylesheet must be cache-busted.'],
  ['player-daily-redesign-v1-compat.css?v=1.2.0', 'Consolidated Daily compatibility CSS must be cache-busted.'],
  ['meta name="application-name" content="FPL Draft Challenge"', 'Static application-name metadata must replace visual-finishing injection.'],
  ['rel="icon" href="icons/icon-192.svg"', 'Static favicon must replace visual-finishing injection.'],
  ['rel="apple-touch-icon" href="icons/icon-192.svg"', 'Static Apple touch icon must replace visual-finishing injection.']
]) requireText(index, needle, message);
forbidText(index, 'id="phase45Shell"', 'Retired hidden Phase 4.5 hero shell must not return.');
forbidText(index, 'id="phase45Hero"', 'Retired hidden Phase 4.5 hero mount must not return.');

for (const [needle, message] of [
  ['js/live-ui-bootstrap.js', 'Live feature loader must directly load the permanent bootstrap.'],
  ['js/top-header-polish.js', 'Live feature loader must keep the current header.'],
  ['js/mobile-results-cleanup.js', 'Live feature loader must keep mobile competition controls.'],
  ['js/results-v2.js', 'Results v2 must remain the deferred results authority.'],
  ['js/leaderboard-team-view.js', 'Leaderboard team view must remain deferred.'],
  ['js/leaderboard-ranking-rules.js', 'Leaderboard ranking rules must remain deferred.'],
  ['js/leaderboard-all-time.js', 'All-time leaderboard must remain deferred.'],
  ['js/player-profile.js', 'Player profile must remain deferred.']
]) requireText(loader, needle, message);

requireText(bootstrap, 'js/prompt-missing-field-guard.js?v=1.0.0', 'Prompt readiness guard must remain active.');
requireText(bootstrap, 'js/season-select-performance.js', 'Slot-level render optimisation must remain active.');
requireText(header, 'topChallengeHeader', 'Permanent live header must remain active.');
forbidText(header, 'fpl-visual-overhaul-body', 'Permanent header must not depend on the retired visual-overhaul class.');

for (const needle of ['historyGridExtended', 'shareResult', 'phase45BottomNav', 'serviceWorker.register']) {
  requireText(phase45, needle, `Retained Phase 4.5 behavior missing: ${needle}`);
}
for (const needle of ['renderHero', 'phase45HeroCountdown', 'setInterval(']) {
  forbidText(phase45, needle, `Retired Phase 4.5 hero/countdown work must stay removed: ${needle}`);
}

for (const needle of ['leaderboard-collapse-toggle', 'leaderboard-account-collapse-toggle', 'account-controls-hidden']) {
  requireText(mobile, needle, `Mobile competition behavior missing: ${needle}`);
}
for (const needle of ['fpl-visual-overhaul-body', '.draft-progress-dock', '.phase45-bottom-nav', 'mobile-ui-complete']) {
  forbidText(mobile, needle, `Mobile competition module must not reclaim Daily UI layout ownership: ${needle}`);
}

forbidText(uiPass, 'player-ui-compact-dashboard', 'Retired Phase 4.5 dashboard styles must stay removed.');
forbidText(uiPass, '.phase45-hero', 'Retired Phase 4.5 hero styles must stay removed.');
requireText(uiPass, '.player-stats-details', 'Local-history details styles must remain.');
forbidText(compat, 'fpl-visual-overhaul-body', 'Daily compatibility CSS must not fight a retired visual-overhaul class.');

for (const needle of ['results-v2-scoreboard', 'results-v2-analysis', 'renderShareCard', 'replaceShareActions']) {
  requireText(resultsV2, needle, `Results v2 must retain permanent results capability: ${needle}`);
}
requireText(leaderboardConfig, 'resultsV2: true', 'Results v2 must remain enabled in live config.');
requireText(leaderboardConfig, 'enabled: true', 'Leaderboard must remain enabled.');

if (failures.length) {
  console.error('Live Challenge cleanup regression check failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`PASS: Live Challenge cleanup is permanent; ${retired.length} superseded runtime files remain retired.`);
