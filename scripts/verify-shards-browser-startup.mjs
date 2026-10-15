import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync('js/prompt-library-shards-v1.js', 'utf8');

for (const readyState of ['loading', 'complete']) {
  const events = new Map(), dispatched = [];
  const document = { readyState, body: {}, documentElement: { dataset: {} },
    getElementById: () => null, querySelector: () => null,
    createElement: () => ({ dataset: {} }), head: { appendChild() {} },
    addEventListener: (name, callback) => events.set(name, callback) };
  const window = { document, FPL_PROMPT_LIBRARY: [],
    addEventListener: (name, callback) => events.set(name, callback),
    dispatchEvent: event => dispatched.push(event.type) };
  const sandbox = { window, document, console, Intl, Date,
    MutationObserver: class { observe() {} }, requestAnimationFrame() {}, setTimeout() {},
    CustomEvent: class { constructor(type) { this.type = type; } } };
  vm.runInNewContext(source, sandbox);
  if (readyState === 'loading') events.get('DOMContentLoaded')();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(document.documentElement.dataset.promptLibraryShards, 'v1-2');
  assert(dispatched.includes('fpl:prompt-library-shards-ready'));
  assert.equal(typeof events.get('fpl:prompt-studio-clean-rendered'), 'function');
  events.get('fpl:prompt-studio-clean-rendered')();
  console.log(`PASS source-storage ${readyState} document startup`);
}
