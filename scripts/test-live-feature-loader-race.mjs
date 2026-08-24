import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/live-feature-loader.js', 'utf8');
const loadedScripts = [];
const listeners = new Map();

const document = {
  baseURI: 'https://example.test/fpl-draft-challenge/',
  querySelector() { return null; },
  getElementById() { return null; },
  createElement(tagName) {
    if (String(tagName).toLowerCase() !== 'script') throw new Error(`Unexpected element: ${tagName}`);
    return {
      src: '',
      async: false,
      attrs: {},
      setAttribute(name, value) { this.attrs[name] = String(value); }
    };
  },
  head: {
    appendChild(node) { loadedScripts.push(node); }
  }
};

const window = {
  FPL_IS_STUDIO: false,
  FPL_LEADERBOARD_ACTIVE: true,
  FPL_LEADERBOARD_CONFIG: {
    enabled: true,
    teamSheets: true,
    rankingRules: true,
    allTimeLeaderboard: true,
    playerProfile: true,
    resultsV2: false,
    accounts: { enabled: true }
  },
  addEventListener(type, handler) {
    listeners.set(type, handler);
  }
};

const sandbox = {
  window,
  document,
  URL,
  console,
  requestAnimationFrame(callback) { callback(); return 1; },
  setTimeout() { return 1; }
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'js/live-feature-loader.js' });

const sources = loadedScripts.map(script => script.src);
const expected = [
  'js/leaderboard-team-view.js',
  'js/leaderboard-ranking-rules.js',
  'js/leaderboard-all-time.js',
  'js/player-profile.js'
];

for (const relative of expected) {
  const absolute = new URL(relative, document.baseURI).toString();
  if (!sources.includes(absolute)) {
    throw new Error(`Leaderboard extra did not catch up after an already-fired visibility event: ${relative}`);
  }
}

if (listeners.has('fpl:leaderboard-visible')) {
  throw new Error('Already-active leaderboard should load extras immediately instead of waiting for a missed visibility event.');
}

console.log(`PASS: async live feature loader caught up ${expected.length} leaderboard extras, including team sheets.`);
