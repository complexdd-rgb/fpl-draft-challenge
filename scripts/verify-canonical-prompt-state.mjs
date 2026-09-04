import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/prompt-library-canonical-state.js', 'utf8');
const listeners = new Map();

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    contains: item => values.has(item)
  };
}

const fourthLabel = { textContent:'Custom prompts' };
const nodes = new Map([
  ['libraryStatus', { textContent:'', title:'' }],
  ['managerLibraryCount', { textContent:'' }],
  ['managerEnabledCount', { textContent:'' }],
  ['managerDisabledCount', { textContent:'' }],
  ['managerCustomCount', { textContent:'', closest: () => ({ querySelector: () => fourthLabel }) }],
  ['promptQualitySummary', { classList:classList(), querySelector: () => ({ textContent:'1,232' }) }],
  ['promptQualityFilters', { classList:classList() }],
  ['promptQualityList', { innerHTML:'old cards' }],
  ['promptQualityListSummary', { textContent:'old summary' }],
  ['promptQualityStatus', { textContent:'' }],
  ['runPromptQualityBtn', { disabled:false }],
  ['qualityProgressWrap', { classList:classList(['hidden']) }]
]);
for (const id of ['applyQualityRatingsBtn','disableQualityPromptsBtn','deleteQualityPromptsBtn','downloadQualityJsonBtn','downloadQualityCsvBtn']) {
  nodes.set(id, { disabled:false });
}

const qualityAll = { textContent:'All prompts' };
const qualityScope = {
  value:'enabled',
  disabled:false,
  title:'',
  querySelector: selector => selector === 'option[value="all"]' ? qualityAll : null
};
nodes.set('qualityScope', qualityScope);

const production = Array.from({ length:851 }, (_, index) => ({ id:`prod_${index}`, enabled:true, rating:4, test() { return true; } }));
const workingEnabled = Array.from({ length:100 }, (_, index) => ({ id:`work_enabled_${index}`, enabled:true, rating:4, test() { return true; }, studioRule:{ kind:'builder' } }));
const workingDisabled = Array.from({ length:5 }, (_, index) => ({ id:`work_disabled_${index}`, enabled:false, rating:3, test() { return true; }, studioRule:{ kind:'builder' } }));
const library = [...production, ...workingEnabled, ...workingDisabled];
const productionIds = production.map(prompt => prompt.id);

const documentListeners = new Map();
globalThis.document = {
  readyState:'complete',
  body:{ dataset:{} },
  head:{ appendChild() {} },
  getElementById:id => nodes.get(id) || null,
  querySelector() { return null; },
  addEventListener(type, handler) {
    if (!documentListeners.has(type)) documentListeners.set(type, new Set());
    documentListeners.get(type).add(handler);
  }
};

globalThis.MutationObserver = class MutationObserver {
  constructor(handler) { this.handler = handler; }
  observe() {}
};
globalThis.Event = class Event { constructor(type) { this.type = type; } };
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};

globalThis.window = {
  FPL_STUDIO_API: {
    getPromptLibrary: () => library,
    invalidatePromptStats() {}
  },
  FPL_REPOSITORY_CERTIFIED_PROMPT_POOL: {
    getState: () => ({ ready:true, total:851, ids:productionIds })
  },
  addEventListener(type, handler) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(handler);
  },
  dispatchEvent(event) {
    for (const handler of listeners.get(event.type) || []) handler(event);
  }
};
window.window = window;

vm.runInThisContext(source, { filename:'js/prompt-library-canonical-state.js' });
const state = window.FPL_PROMPT_LIBRARY_CANONICAL_STATE.reconcile({ announce:false });

if (!state?.ready) throw new Error('Canonical prompt census did not become ready.');
if (state.total !== 956) throw new Error(`Expected 956 working prompts, got ${state.total}.`);
if (state.enabled !== 851) throw new Error(`Expected exactly 851 enabled prompts, got ${state.enabled}.`);
if (state.disabled !== 105) throw new Error(`Expected 105 disabled prompts, got ${state.disabled}.`);
if (state.production !== 851) throw new Error(`Expected 851 production prompts, got ${state.production}.`);
if (workingEnabled.some(prompt => prompt.enabled !== false)) throw new Error('A working-only prompt remained enabled.');
if (production.some(prompt => prompt.enabled === false)) throw new Error('A production prompt was disabled by canonical reconciliation.');
if (production.some(prompt => prompt._productionEligible !== true)) throw new Error('Production eligibility marker missing.');
if ([...workingEnabled, ...workingDisabled].some(prompt => prompt._productionEligible !== false)) throw new Error('Working-only prompt was marked production eligible.');

if (nodes.get('libraryStatus').textContent !== '851 enabled · 956 total · 105 disabled') {
  throw new Error(`Top library status is inconsistent: ${nodes.get('libraryStatus').textContent}`);
}
if (nodes.get('managerLibraryCount').textContent !== '956' || nodes.get('managerEnabledCount').textContent !== '851' || nodes.get('managerDisabledCount').textContent !== '105') {
  throw new Error('Prompt Manager counts do not match the canonical census.');
}
if (nodes.get('managerCustomCount').textContent !== '851' || fourthLabel.textContent !== 'Production certified') {
  throw new Error('Prompt Manager fourth card did not become the production-certified count.');
}
if (qualityScope.value !== 'all' || qualityScope.disabled !== true) throw new Error('Quality analyser was not locked to the full canonical library.');
if (!nodes.get('promptQualitySummary').classList.contains('hidden')) throw new Error('Stale 1,232-prompt quality summary remained visible.');
if (!/956 total · 851 enabled · 105 disabled/.test(nodes.get('promptQualityStatus').textContent)) {
  throw new Error(`Quality stale message does not use canonical counts: ${nodes.get('promptQualityStatus').textContent}`);
}

library.push({ id:'later_working_prompt', enabled:true, rating:5, test() { return true; }, studioRule:{ kind:'builder' } });
const later = window.FPL_PROMPT_LIBRARY_CANONICAL_STATE.reconcile({ announce:false });
if (later.total !== 957 || later.enabled !== 851 || later.disabled !== 106) {
  throw new Error(`Late prompt did not converge to disabled canonical state: ${JSON.stringify(later)}`);
}
if (library.at(-1).enabled !== false) throw new Error('Late working prompt remained enabled.');

console.log('Canonical Prompt Studio state verification passed: one census, 851 enabled production prompts, all working-only prompts disabled.');
