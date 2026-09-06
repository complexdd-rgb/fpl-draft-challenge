import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/repository-certified-prompt-pool.js', 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const statusNode = { textContent: '', title: '' };
const browserLibrary = [
  { id: 'saved-browser-1', enabled: true },
  { id: 'saved-browser-2', enabled: true },
  { id: 'saved-browser-3', enabled: true }
];

const sandbox = {
  console,
  window: {
    FPL_PROMPT_LIBRARY: browserLibrary,
    FPL_PROMPT_STUDIO_CLEAN: { getLibrary: () => browserLibrary }
  },
  document: {
    readyState: 'complete',
    addEventListener() {},
    getElementById(id) { return id === 'libraryStatus' ? statusNode : null; }
  }
};
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;

vm.runInNewContext(source, sandbox, { filename: 'js/repository-certified-prompt-pool.js' });
const api = sandbox.window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL;
assert(api?.ready === true, 'Clean repository prompt-pool API did not initialise.');
assert(api.version === '2.0.0', 'Repository prompt pool is not on clean reset v2.0.0.');
assert(api.expectedTotal === 0, 'Repository prompt pool must remain intentionally zero after the clean reset.');
assert(api.baseCount === 0, 'Repository prompt pool still exposes a pre-reset base population.');

const state = api.getState();
assert(state.ready === true, 'Clean repository prompt pool is unexpectedly blocked.');
assert(state.expected === 0 && state.total === 0, 'Repository production membership is not pinned to zero.');
assert(state.actual === browserLibrary.length, 'Repository pool did not report the current browser library separately.');
assert(state.browserTotal === browserLibrary.length, 'Browser library count is incorrect.');
assert(state.ignoredBrowserPrompts === browserLibrary.length, 'Browser/saved prompts are not explicitly isolated from repository production membership.');
assert(Array.isArray(state.prompts) && state.prompts.length === 0, 'Repository pool leaked browser prompts into production prompts.');
assert(Array.isArray(state.ids) && state.ids.length === 0, 'Repository pool leaked browser prompt IDs into production IDs.');
assert(Array.isArray(api.snapshot()) && api.snapshot().length === 0, 'Repository production snapshot must remain empty.');

api.refresh();
assert(statusNode.textContent === '0 certified · clean reset', `Repository status is misleading: ${statusNode.textContent}`);
assert(/retired|clean/i.test(statusNode.title), 'Repository status title does not explain the clean reset boundary.');

assert(!source.includes('EXPECTED_TOTAL = 851'), 'Repository pool source still pins the retired 851-prompt population.');
assert(!source.includes('prompt-library-canonical-state.js'), 'Repository pool still tries to load the retired canonical-state runtime.');

console.log('Repository prompt-pool isolation verified: repository production remains intentionally zero while saved/browser prompts stay outside that boundary.');
