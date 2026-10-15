import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fixture } from './lib/backend-fixture.mjs';

const f = fixture({ releaseDate: '2026-08-23' });
f.tables.daily_challenge_schedule[0].source_js = `window.FPL_DAILY_CHALLENGE={id:'archive-fixture',prompts:[{id:'p0',test:function guardedPromptTest(record){return original(record);}}]};`;
const response = await f.handler('daily-challenge-public')(new Request('https://fixture.invalid/?date=2026-08-23&archive=1'));
assert.equal(response.status, 200);
const window = {};
vm.runInNewContext(await response.text(), { window, localStorage: { getItem() { return null; }, setItem() {} } });
const test = window.FPL_DAILY_CHALLENGE.prompts[0].test;
assert.equal(test({ playerId: 'player0', season: '2024-25' }), true, 'Released closure-backed archive must retain its verifier repair');
assert.equal(test({ playerId: 'other', season: '2024-25' }), false);
assert.equal(test({ playerId: 'player0', season: '2023-24' }), false);
assert.equal(window.FPL_CHALLENGE_RUNTIME.archiveMode, true);
console.log('PASS released archive closure repair preserves exact verifier player-season eligibility');
