import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

// Use the real Studio stats evaluator, including its cache invalidation and
// zero-minute/position/season filtering, before loading the real diversity policy.
const coreSource = fs.readFileSync('js/admin-core.js', 'utf8').split('/* ===== BEGIN admin-phase3.js ===== */')[0];
const policySource = fs.readFileSync('js/daily-semantic-diversity-v1.js', 'utf8');

function fixture() {
  const elements = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, { value: '', addEventListener() {} });
      return elements.get(selector);
    }
  };
  document.querySelector('#batchStartDate').value = '2026-10-15';
  const window = {
    FPL_PROMPT_LIBRARY: [],
    FPL_PLAYERS: [
      { playerId: 'p1', name: 'One', seasons: [
        { season: '2011/12', position: 'MID', minutes: 100, points: 220 },
        { season: '2010/11', position: 'DEF', minutes: 100, points: 250 }
      ] },
      { playerId: 'p2', name: 'Two', seasons: [{ season: '2011/12', position: 'MID', minutes: 100, points: 190 }] },
      { playerId: 'p3', name: 'Three', seasons: [{ season: '2011/12', position: 'MID', minutes: 100, points: 180 }] },
      { playerId: 'zero', name: 'Zero minutes', seasons: [{ season: '2011/12', position: 'MID', minutes: 0, points: 300 }] }
    ]
  };
  window.window = window;
  // Missing test functions are expected during cheap generator shortlisting.
  const context = vm.createContext({ window, document, console: { warn() {} } });
  vm.runInContext(coreSource, context);
  vm.runInContext(policySource, context);
  const core = window.FPL_STUDIO_API;
  const api = window.FPL_DAILY_SEMANTIC_DIVERSITY;
  const prompt = (id, playerId) => ({
    id, label: id, family: 'season-stats', position: 'MID',
    test: record => record.season === '2011/12' && (!playerId || record.playerId === playerId)
  });
  return { window, core, api, prompt, document };
}

test('shortlist answer profiles refresh after runtime certification and penalise repeated players', () => {
  const { core, api, prompt } = fixture();
  const shortlist = { id: 'candidate', position: 'MID' };
  assert.equal(api.topAnswerProfile(shortlist).leaderId, '');
  const certified = prompt('candidate');
  core.invalidatePromptStats(certified.id);
  assert.equal(core.getPromptStats(certified).playerCount, 3);
  assert.equal(api.topAnswerProfile(certified).leaderId, 'p1');
  assert.deepEqual(Array.from(api.topAnswerProfile(certified).top3Ids), ['p1', 'p2', 'p3']);
  const counts = api.commitWeekly(certified, null);
  const repeated = prompt('repeated', 'p1');
  const fresh = prompt('fresh', 'p2');
  assert(api.weeklyLoad(repeated, counts) > api.weeklyLoad(fresh, counts));
});

test('refreshed runtime stats replace a same-ID profile without changing season eligibility', () => {
  const { core, api, prompt } = fixture();
  assert.equal(api.topAnswerProfile(prompt('candidate', 'p1')).leaderId, 'p1');
  core.invalidatePromptStats('candidate');
  assert.equal(api.topAnswerProfile(prompt('candidate', 'p2')).leaderId, 'p2');
  assert.equal(api.topAnswerProfile({ ...prompt('other-season'), position: 'DEF', test: r => r.season === '2010/11' }).leaderId, 'p1');
  assert.equal(api.topAnswerProfile(prompt('zero', 'zero')).leaderId, '');
});

test('same-length schedule edits move carry-over pressure to the new answers', () => {
  const { window, api, prompt } = fixture();
  const one = prompt('one', 'p1');
  const two = prompt('two', 'p2');
  window.FPL_PROMPT_LIBRARY.push(one, two);
  window.FPL_CHALLENGE_MANIFEST = { challenges: [{ date: '2026-10-14', promptIds: ['one'] }] };
  assert(api.recentAnswerLoad(one) > api.recentAnswerLoad(two));
  window.FPL_CHALLENGE_MANIFEST.challenges[0].promptIds = ['two'];
  assert(api.recentAnswerLoad(two) > api.recentAnswerLoad(one));
});

test('history pressure refreshes when a scheduled prompt receives new runtime stats', () => {
  const { window, core, api, prompt } = fixture();
  const one = prompt('one', 'p1');
  const two = prompt('two', 'p2');
  window.FPL_PROMPT_LIBRARY.push(one, two);
  window.FPL_CHALLENGE_MANIFEST = { challenges: [{ date: '2026-10-14', promptIds: ['one'] }] };
  assert(api.recentAnswerLoad(one) > 0);
  one.test = two.test;
  core.invalidatePromptStats('one');
  assert(api.recentAnswerLoad(two) > 0);
  assert.equal(api.recentAnswerLoad(prompt('probe', 'p1')), 0);
});

test('an unavailable stats API does not poison profiles when Studio becomes ready', () => {
  const { window, api, prompt } = fixture();
  const core = window.FPL_STUDIO_API;
  delete window.FPL_STUDIO_API;
  const candidate = prompt('candidate');
  assert.equal(api.topAnswerProfile(candidate).leaderId, '');
  window.FPL_STUDIO_API = core;
  assert.equal(api.topAnswerProfile(candidate).leaderId, 'p1');
});

test('stable runtime stats reuse the answer profile', () => {
  const { api, prompt } = fixture();
  const candidate = prompt('candidate');
  assert.equal(api.topAnswerProfile(candidate), api.topAnswerProfile(candidate));
});

test('carry-over counts appearance days once and uses only the preceding seven days', () => {
  const { window, api, prompt } = fixture();
  const one = prompt('one', 'p1');
  window.FPL_PROMPT_LIBRARY.push(one);
  const entry = { date: '2026-10-08', promptIds: ['one', 'one'] };
  window.FPL_CHALLENGE_MANIFEST = { challenges: [entry] };
  const once = api.recentAnswerLoad(one);
  assert(once > 0);
  window.FPL_STUDIO_SCHEDULE = { scheduled: [{ release_date: entry.date, manifest_entry: entry }] };
  window.FPL_CHALLENGE_MANIFEST.challenges.push(
    { date: '2026-10-07', promptIds: ['one'] },
    { date: '2026-10-15', promptIds: ['one'] },
    { date: '2026-10-16', promptIds: ['one'] }
  );
  assert.equal(api.recentAnswerLoad(one), once);
});
