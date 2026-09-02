import fs from 'node:fs';
import vm from 'node:vm';

const admin = fs.readFileSync('admin.html', 'utf8');
const expectedOrder = [
  'nationality-enrichment.js?v=1.1.1',
  'js/prompt-nationality-context-pack-v1.js?v=1.0.2',
  'js/admin-weekly-nationality-readiness-gate.js?v=1.0.2',
  'js/admin-batch-calendar.js?v=3.0.3'
];
let lastIndex = -1;
for (const asset of expectedOrder) {
  const index = admin.indexOf(asset);
  if (index < 0) throw new Error(`Missing cache-busted weekly nationality asset: ${asset}`);
  if (index <= lastIndex) throw new Error(`Weekly nationality assets are not ordered safely: ${asset}`);
  lastIndex = index;
}
if (!admin.includes('<button id="generateWeekBtn" class="button primary" type="button" disabled aria-busy="true">')) {
  throw new Error('Seven-day Generate button is not fail-closed in admin.html.');
}
if (!admin.includes('data-nationality-enrichment data-loaded="true"')) {
  throw new Error('Nationality enrichment is not marked as the canonical loaded Studio script.');
}
if (!admin.includes('data-nationality-context-prompt-pack-v1 data-loaded="true"')) {
  throw new Error('Nationality context pack is not marked as the canonical loaded Studio script.');
}

const source = fs.readFileSync('js/admin-weekly-nationality-readiness-gate.js', 'utf8');
for (const token of [
  'pack?.ready === true',
  'availableCount',
  'REQUIRED_POSITIONS',
  'button.disabled = true',
  'button.disabled = false',
  'fpl:prompt-library-changed',
  'fpl:prompt-tools-ready',
  'fpl:prompt-field-readiness-ready'
]) {
  if (!source.includes(token)) throw new Error(`Weekly nationality gate is missing: ${token}`);
}

const listeners = new Map();
const button = {
  disabled: true,
  dataset: {},
  attrs: new Map([['aria-busy', 'true']]),
  setAttribute(name, value) { this.attrs.set(name, String(value)); },
  removeAttribute(name) { this.attrs.delete(name); }
};
const status = { textContent: '', dataset: { state: 'neutral' } };
const window = {
  FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1: undefined,
  addEventListener(type, handler) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(handler);
  },
  removeEventListener(type, handler) {
    listeners.get(type)?.delete(handler);
  },
  dispatchEvent(event) {
    for (const handler of [...(listeners.get(event.type) || [])]) handler(event);
  }
};
const sandbox = {
  window,
  document: {
    querySelector(selector) {
      if (selector === '#generateWeekBtn') return button;
      if (selector === '#batchStatus') return status;
      return null;
    }
  },
  setTimeout,
  clearTimeout,
  console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'js/admin-weekly-nationality-readiness-gate.js' });

if (button.disabled !== true || button.dataset.nationalityReady !== 'false') {
  throw new Error('Gate did not keep seven-day generation blocked while nationality pack was absent.');
}

window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1 = Object.freeze({
  ready: true,
  version: '1.0.2',
  availableCount: 0,
  positions: []
});
window.dispatchEvent({ type: 'fpl:prompt-library-changed' });
if (button.disabled !== true) {
  throw new Error('Gate incorrectly unlocked for a ready=true pack with zero usable nationality prompts.');
}

window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1 = Object.freeze({
  ready: true,
  version: '1.0.2',
  availableCount: 7,
  positions: ['DEF', 'MID', 'FWD']
});
window.dispatchEvent({ type: 'fpl:prompt-library-changed' });

if (button.disabled !== false || button.dataset.nationalityReady !== 'true') {
  throw new Error('Gate did not unlock seven-day generation after usable nationality prompts became ready.');
}
if (button.attrs.has('aria-busy')) {
  throw new Error('Gate left aria-busy set after nationality readiness.');
}
if (window.FPL_WEEKLY_NATIONALITY_READINESS_GATE?.ready?.() !== true) {
  throw new Error('Gate readiness API does not reflect real usable nationality-pack readiness.');
}

console.log('Weekly nationality generation gate verified: empty ready packs remain blocked; real usable packs unlock; cache versions bumped.');
