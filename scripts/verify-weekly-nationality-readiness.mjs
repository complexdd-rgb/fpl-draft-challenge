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
if (!pack?.ready || pack.version !== '1.0.2' || Number(pack.availableCount) < 4) {
  throw new Error(`Nationality context pack was not genuinely ready for weekly generation (${pack?.availableCount || 0} usable, ${pack?.installedCount || 0} newly installed).`);
}

const prompts = window.FPL_PROMPT_LIBRARY.filter(prompt => pack.ids.includes(prompt.id));
if (prompts.length !== Number(pack.availableCount)) {
  throw new Error(`Nationality pack availability mismatch: metadata says ${pack.availableCount}, library contains ${prompts.length}.`);
}
const positions = new Set(prompts.map(prompt => prompt.position));
for (const position of ['DEF', 'MID', 'FWD']) {
  if (!positions.has(position)) throw new Error(`Nationality context pack has no ${position} prompt.`);
}
for (const prompt of prompts) {
  if (!String(prompt.family || '').startsWith('nationality-context-v1:')) throw new Error(`Unexpected nationality prompt family: ${prompt.id}`);
  if (!Array.isArray(prompt.tags) || !prompt.tags.includes('nationality')) throw new Error(`Nationality prompt is missing its nationality tag: ${prompt.id}`);
  if (!(Number(prompt.answerPool) > 0)) throw new Error(`Nationality prompt has an empty answer pool: ${prompt.id}`);
}

const readinessSource = fs.readFileSync('js/prompt-field-readiness.js', 'utf8');
const enrichmentIndex = readinessSource.indexOf('nationality-enrichment.js?v=1.1.1');
const contextIndex = readinessSource.indexOf('prompt-nationality-context-pack-v1.js?v=1.0.2');
if (enrichmentIndex < 0 || contextIndex < 0 || enrichmentIndex >= contextIndex) {
  throw new Error('Studio does not load nationality enrichment before the current weekly nationality prompt pack.');
}

const weeklySource = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');
if (!weeklySource.includes('counts.nationality === plan.nationality')) {
  throw new Error('Weekly generation does not enforce the exact daily nationality quota.');
}
if (!weeklySource.includes('mix.nationality - promptMixPlan.nationality')) {
  throw new Error('Weekly generation does not penalise excess nationality prompts.');
}

console.log(`Weekly nationality readiness verified with ${prompts.length} real usable prompts across ${[...positions].sort().join(', ')}.`);
