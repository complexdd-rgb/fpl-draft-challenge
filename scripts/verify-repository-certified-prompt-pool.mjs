import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/repository-certified-prompt-pool.js', 'utf8');
const listeners = new Map();
const statusNode = { textContent:'', title:'' };
const store = new Map();

const approved = Array.from({ length: 810 }, (_, index) => `approved_${index}`);
const baseQuality = Array.from({ length: 10 }, (_, index) => `quality_base_${index}`);
const runtimeQuality = Array.from({ length: 20 }, (_, index) => `quality_runtime_${index}`);
const survivors = ['survivor_1', 'survivor_2'];
const nationality = Array.from({ length: 9 }, (_, index) => `nationality_${index}`);
const browserCustoms = Array.from({ length: 2072 }, (_, index) => ({ id:`browser_custom_${index}`, rating:5, enabled:true }));

function prompt(id, tags = []) {
  return { id, rating:4, enabled:true, tags, test() { return true; } };
}

const baseLibrary = [
  ...approved.map(id => prompt(id)),
  ...baseQuality.map(id => prompt(id, ['quality-pack-v1']))
];

globalThis.window = {
  FPL_PROMPT_LIBRARY: baseLibrary,
  addEventListener(type, handler) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(handler);
  },
  dispatchEvent(event) {
    for (const handler of listeners.get(event.type) || []) handler(event);
  }
};
window.window = window;

globalThis.document = {
  readyState: 'complete',
  addEventListener() {},
  getElementById(id) { return id === 'libraryStatus' ? statusNode : null; }
};
globalThis.localStorage = {
  getItem(key) { return store.get(String(key)) ?? null; },
  setItem(key, value) { store.set(String(key), String(value)); },
  removeItem(key) { store.delete(String(key)); }
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};

vm.runInThisContext(source, { filename:'js/repository-certified-prompt-pool.js' });

const liveLibrary = window.FPL_PROMPT_LIBRARY;
liveLibrary.push(...runtimeQuality.map(id => prompt(id, ['quality-pack-v1'])));
liveLibrary.push(...survivors.map(id => prompt(id, ['quality-pack-v2'])));
liveLibrary.push(...nationality.map(id => prompt(id, ['nationality'])));
liveLibrary.push(...browserCustoms.map(item => ({ ...prompt(item.id), studioRule:{ kind:'builder' }, _studioCustom:true })));
window.FPL_STUDIO_API = { getPromptLibrary: () => liveLibrary };

window.FPL_APPROVED_PROMPT_IDS_20260814 = approved;
window.FPL_APPROVED_PROMPT_DISABLED_IDS_20260814 = [];
window.FPL_APPROVED_PROMPT_BASELINE = { ready:true };
window.FPL_QUALITY_PROMPT_PACK_V1 = { ready:true, ids:runtimeQuality };
window.FPL_QUALITY_PROMPT_PACK_V2 = { ready:true, ids:[] };
window.FPL_QUALITY_PROMPT_PACK_V3 = { ready:true, ids:[] };
window.FPL_QUALITY_PROMPT_BASELINE = { ready:true, ids:[...baseQuality, ...runtimeQuality, ...survivors] };
window.FPL_REFINEMENT_SURVIVOR_PACK_V1 = { ready:true, ids:survivors, parentIds:['weak_parent_1','weak_parent_2'] };
window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1 = { ready:true, ids:nationality };

localStorage.setItem('fplChallengeStudioPromptManagerV1', JSON.stringify({
  version:1,
  overrides:{},
  deletedIds:[],
  customs:browserCustoms
}));

let state = window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL.getState();
if (!state.ready) throw new Error(`Expected repository pool to be ready: ${state.reason}`);
if (state.total !== 851) throw new Error(`Expected 851 certified prompts, got ${state.total}.`);
if (state.browserCustom !== 2072) throw new Error(`Expected 2072 browser customs, got ${state.browserCustom}.`);
if (state.ignoredBrowserPrompts !== 2072) throw new Error(`Expected 2072 ignored browser prompts, got ${state.ignoredBrowserPrompts}.`);
if (state.prompts.some(item => String(item.id).startsWith('browser_custom_'))) throw new Error('Browser custom prompt leaked into repository certified pool.');

window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL.refresh();
if (!/851 certified live/.test(statusNode.textContent) || !/2072 local custom/.test(statusNode.textContent)) {
  throw new Error(`Library status did not distinguish certified and browser-local counts: ${statusNode.textContent}`);
}

localStorage.setItem('fplChallengeStudioPromptManagerV1', JSON.stringify({
  version:1,
  overrides:{},
  deletedIds:[],
  customs:[...browserCustoms, { id:approved[0], rating:5, enabled:true }]
}));
state = window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL.getState();
if (state.ready) throw new Error('Repository pool should block a browser-local collision with a certified prompt ID.');
if (!/touch/i.test(state.reason)) throw new Error(`Collision reason was not actionable: ${state.reason}`);

console.log('Repository-certified pool isolation verification passed: 851 production prompts, 2,072 browser customs ignored safely.');
