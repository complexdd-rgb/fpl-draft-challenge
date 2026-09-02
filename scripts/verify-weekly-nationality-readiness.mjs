import fs from 'node:fs';
import vm from 'node:vm';

const listeners = new Map();
const window = {
  location: { pathname: '/' },
  setTimeout,
  clearTimeout,
  addEventListener(type, handler) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(handler);
  },
  dispatchEvent(event) {
    for (const handler of listeners.get(event?.type) || []) handler(event);
  }
};
const sandbox = {
  window,
  document: {
    readyState: 'complete',
    querySelector: () => null,
    write: () => {}
  },
  console,
  setTimeout,
  clearTimeout,
  CustomEvent: class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }
};
vm.createContext(sandbox);

const run = path => vm.runInContext(fs.readFileSync(path, 'utf8'), sandbox, { filename: path });
run('players.js');
run('js/career-context.js');
run('prompt-library.js');

window.FPL_STUDIO_API = {
  getPromptLibrary: () => window.FPL_PROMPT_LIBRARY
};

run('nationality-enrichment.js');
run('js/prompt-nationality-context-pack-v1.js');

const pack = window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1;
if (!pack?.ready || Number(pack.installedCount) < 4) {
  throw new Error(`Nationality context pack was not ready for weekly generation (${pack?.installedCount || 0} installed).`);
}

const prompts = window.FPL_PROMPT_LIBRARY.filter(prompt => pack.ids.includes(prompt.id));
const positions = new Set(prompts.map(prompt => prompt.position));
for (const position of ['DEF', 'MID', 'FWD']) {
  if (!positions.has(position)) throw new Error(`Nationality context pack has no ${position} prompt.`);
}

const readinessSource = fs.readFileSync('js/prompt-field-readiness.js', 'utf8');
const enrichmentIndex = readinessSource.indexOf('nationality-enrichment.js?v=1.1.0');
const contextIndex = readinessSource.indexOf('prompt-nationality-context-pack-v1.js?v=1.0.0');
if (enrichmentIndex < 0 || contextIndex < 0 || enrichmentIndex >= contextIndex) {
  throw new Error('Studio does not load nationality enrichment before the weekly nationality prompt pack.');
}

const weeklySource = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');
if (!weeklySource.includes('counts.nationality === plan.nationality')) {
  throw new Error('Weekly generation does not enforce the exact daily nationality quota.');
}
if (!weeklySource.includes('mix.nationality - promptMixPlan.nationality')) {
  throw new Error('Weekly generation does not penalise excess nationality prompts.');
}

console.log(`Weekly nationality readiness verified with ${prompts.length} installed prompts across all outfield positions.`);
