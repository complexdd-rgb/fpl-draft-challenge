import assert from 'node:assert/strict';
import { fixture } from './lib/backend-fixture.mjs';

const tests = [];
const test = (name, run) => tests.push({ name, run });
const source = async (f, query) => {
  const response = await f.handler('daily-challenge-public')(new Request(`https://fixture.invalid/?${query}`));
  return { status: response.status, body: await response.text() };
};

test('future archive source is unavailable even with a forged official date', async () => {
  const f = fixture({ releaseDate: '2026-10-15' });
  const r = await source(f, 'date=2026-10-15&officialDate=2099-01-01&archive=1');
  assert(!r.body.includes('release-fixture'), 'Future source was disclosed');
});
test('future latest-date requests cannot disclose scheduled source', async () => {
  const f = fixture({ releaseDate: '2026-10-15' });
  assert(!(await source(f, 'date=2026-10-15')).body.includes('release-fixture'));
});
test('released archive practice retains its source', async () => {
  const f = fixture({ releaseDate: '2026-10-13' });
  const r = await source(f, 'date=2026-10-13&archive=1&officialDate=2099-01-01');
  assert(r.body.includes('release-fixture'));
  assert(r.body.includes('"officialDate":"2026-10-14"'), 'Server clock was not used');
  assert(r.body.includes('"archiveMode":true'));
});
test('all competitive verifier routes reject a future release', async () => {
  const f = fixture({ releaseDate: '2026-10-15' });
  for (const name of ['leaderboard-start', 'leaderboard-list', 'leaderboard-pick', 'leaderboard-finish']) {
    const r = await f.call(name, { challengeId: f.verifier.challengeId, clientId: 'guest-fixture',
      attemptId: 'fixture-attempt', displayName: 'Fixture', promptId: 'p0', playerId: 'player0', season: '2024-25', selections: [] });
    assert.equal(r.status, 404, `${name} did not enforce release time`);
  }
  assert.equal(f.tables.leaderboard_attempts.length, 0);
});
test('summer release opens at UK midnight rather than UTC midnight', async () => {
  const early = fixture({ releaseDate: '2026-07-02', now: '2026-07-01T22:59:59Z' });
  assert(!(await source(early, 'date=2026-07-02')).body.includes('release-fixture'));
  const released = fixture({ releaseDate: '2026-07-02', now: '2026-07-01T23:00:00Z' });
  assert((await source(released, 'date=2026-07-02')).body.includes('release-fixture'));
  assert.equal((await released.call('leaderboard-start', { challengeId: released.verifier.challengeId, clientId: 'guest-fixture' })).status, 200);
});
test('winter release waits until UK and UTC midnight', async () => {
  const f = fixture({ releaseDate: '2026-12-02', now: '2026-12-01T23:30:00Z' });
  assert(!(await source(f, 'date=2026-12-02')).body.includes('release-fixture'));
});

let failures = 0;
for (const { name, run } of tests) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}
assert.equal(failures, 0, `${failures}/${tests.length} release checks failed`);
