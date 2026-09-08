import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const index = read('index.html');
const ui = read('js/player-daily-redesign-v1.js');
const navVisibility = read('js/player-daily-mobile-nav-visibility.js');
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
requireText(index, 'player-daily-redesign-v1-compat.css?v=1.2.0', 'index.html must load the consolidated Daily UI v1.2 compatibility boundary.');
requireText(index, 'js/player-daily-redesign-v1.js?v=1.0.0', 'index.html must load the Daily UI v1 presentation script.');
requireText(index, 'js/player-daily-mobile-nav-visibility.js?v=1.1.2', 'index.html must load the mobile draft-board nav visibility helper.');

for (const [needle, message] of [
  ['role","combobox', 'Player search must expose combobox semantics.'],
  ['role","listbox', 'Autocomplete suggestions must expose listbox semantics.'],
  ['aria-activedescendant', 'Keyboard autocomplete must expose its active option.'],
  ['aria-describedby', 'Player search must reference its feedback/status message.'],
  ['tabindex","-1', 'Autocomplete options must stay out of the normal Tab order.'],
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
  ['window.FPL_DAILY_CHALLENGE =', 'Presentation code must not replace challenge identity.'],
  ['observe(document.body', 'Presentation code must not install a broad body subtree observer.']
]) forbidText(ui, needle, message);

for (const [needle, message] of [
  ['IntersectionObserver', 'Mobile nav visibility must be driven by draft-board viewport visibility.'],
  ['daily-grid-in-view', 'Mobile nav visibility helper must toggle the draft-board visibility state class.'],
  ['max-width: 720px', 'Mobile nav visibility must remain scoped to narrow screens.']
]) requireText(navVisibility, needle, message);
for (const [needle, message] of [
  ['fetch(', 'Mobile nav visibility helper must not own network requests.'],
  ['localStorage', 'Mobile nav visibility helper must not persist state.'],
  ['FPL_DAILY_CHALLENGE =', 'Mobile nav visibility helper must not replace challenge identity.']
]) forbidText(navVisibility, needle, message);
try { new Function(navVisibility); } catch (error) { failures.push(`Mobile nav visibility helper must parse as JavaScript: ${error.message}`); }

requireText(css, 'grid-template-columns:repeat(2,minmax(0,1fr))', 'Desktop draft board must support a two-column layout.');
requireText(css, '@media(max-width:900px)', 'Responsive single-column breakpoint must remain present.');
requireText(css, 'font-size:16px!important', 'Mobile player search must retain 16px input text.');
requireText(css, '.slot.valid::after{display:none!important}', 'Legacy valid-state checkmark must not overlap the Daily state chip.');
requireText(css, '@media(prefers-reduced-motion:reduce)', 'Reduced-motion support must remain present.');
requireText(css, '@media(forced-colors:active)', 'Forced-colours support must remain present.');
requireText(css, ':focus-visible', 'Visible keyboard focus styling must remain present.');
requireText(compat, '#draftProgressDock', 'Responsive boundary must keep compact mobile draft-progress controls.');
requireText(compat, 'calc(100vw - 44px)', 'Mobile autocomplete must span the card rather than expose covered controls beside it.');
requireText(compat, ':has(#grid .suggestions:not(.hidden)) .phase45-bottom-nav', 'Mobile bottom navigation must yield while autocomplete is open.');
requireText(compat, '.daily-squad-count span', 'Compact Live XI progress must retain its /11 completion context.');

// v1.1 through v1.2 polish invariants.
requireText(compat, 'grid-template-areas:"position state ." "prompt prompt prompt"', 'Mobile clue cards must keep position/state together and give the prompt full width.');
requireText(compat, 'position:static!important', 'Mobile state/position elements must remain in normal card flow.');
requireText(compat, 'padding-bottom:calc(118px + env(safe-area-inset-bottom))', 'Mobile app content must reserve space for the fixed bottom navigation.');
requireText(compat, 'scroll-padding-bottom:calc(112px + env(safe-area-inset-bottom))', 'Mobile focus/jump targets must stay above the fixed bottom navigation.');
requireText(compat, 'daily-grid-in-view .phase45-bottom-nav', 'Mobile bottom navigation must disappear while the draft board is visible.');
requireText(compat, 'content:"Score details"', 'Results v2 must label the retained secondary score breakdown.');
requireText(compat, 'div:has(#finalScore)', 'Results v2 must suppress duplicate final-score detail from the legacy score card.');
requireText(compat, 'div:has(#perfectScore)', 'Results v2 must suppress duplicate perfect-score detail from the legacy score card.');
requireText(compat, 'clip:rect(0,0,0,0)', 'Compact mobile dock labels must remain screen-reader available rather than being display:none.');
requireText(compat, 'justify-self:center!important', 'The narrow-mobile completion ring must remain centred.');

if (failures.length) {
  console.error('Daily UI v1-v1.2 regression check failed:');
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Daily UI v1-v1.2 presentation-boundary checks passed.');
