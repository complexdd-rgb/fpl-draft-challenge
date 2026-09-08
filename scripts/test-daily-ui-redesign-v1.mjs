import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const index = read('index.html');
const ui = read('js/player-daily-redesign-v1.js');
const css = read('player-daily-redesign-v1.css');
const compat = read('player-daily-redesign-v1-compat.css');

const failures = [];
const requireText = (source, needle, message) => {
  if (!source.includes(needle)) failures.push(message);
};
const forbidText = (source, needle, message) => {
  if (source.includes(needle)) failures.push(message);
};

requireText(index, 'player-daily-redesign-v1.css?v=1.0.0', 'index.html must load the Daily UI v1 stylesheet.');
requireText(index, 'player-daily-redesign-v1-compat.css?v=1.0.0', 'index.html must load the Daily UI compatibility boundary.');
requireText(index, 'js/player-daily-redesign-v1.js?v=1.0.0', 'index.html must load the Daily UI v1 presentation script.');

for (const [needle, message] of [
  ['role","combobox', 'Player search must expose combobox semantics.'],
  ['role","listbox', 'Autocomplete suggestions must expose listbox semantics.'],
  ['aria-activedescendant', 'Keyboard autocomplete must expose its active option.'],
  ['role","progressbar', 'Draft completion must expose progressbar semantics.'],
  ['daily-state-chip', 'Draft slots must expose text state chips.'],
  ['dailySquadOverview', 'The live XI overview must remain present.'],
  ['leaderboardAvailable', 'Leaderboard navigation must respect official/archive availability.'],
  ['resultsV2Scoreboard', 'Completion ordering must recognise the deferred Results v2 scoreboard.']
]) requireText(ui, needle, message);

for (const [needle, message] of [
  ['prompt.test(', 'Presentation code must not execute prompt tests.'],
  ['INVALID_PENALTY', 'Presentation code must not own penalty rules.'],
  ['calculatePerfectXI', 'Presentation code must not calculate the perfect XI.'],
  ['localStorage.setItem', 'Presentation code must not persist game state.'],
  ['fetch(', 'Presentation code must not own network/backend requests.'],
  ['window.FPL_DAILY_CHALLENGE =', 'Presentation code must not replace challenge identity.']
]) forbidText(ui, needle, message);

requireText(css, 'grid-template-columns:repeat(2,minmax(0,1fr))', 'Desktop draft board must support a two-column layout.');
requireText(css, '@media(max-width:900px)', 'Responsive single-column breakpoint must remain present.');
requireText(css, 'font-size:16px!important', 'Mobile player search must retain 16px input text.');
requireText(css, '@media(prefers-reduced-motion:reduce)', 'Reduced-motion support must remain present.');
requireText(css, '@media(forced-colors:active)', 'Forced-colours support must remain present.');
requireText(css, ':focus-visible', 'Visible keyboard focus styling must remain present.');
requireText(compat, '#draftProgressDock', 'Compatibility boundary must keep the redesigned progress dock authoritative.');

if (failures.length) {
  console.error('Daily UI v1 regression check failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Daily UI v1 presentation-boundary checks passed.');
