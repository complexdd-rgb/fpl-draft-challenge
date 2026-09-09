import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const start = read('supabase/functions/leaderboard-start/index.ts');
const client = read('js/leaderboard-client.js');
const index = read('index.html');

function requireText(source, needle, message) {
  if (!source.includes(needle)) throw new Error(message);
}
function forbidText(source, needle, message) {
  if (source.includes(needle)) throw new Error(message);
}

// Accepted results remain account-wide, but unfinished timers must belong to the
// browser actually making the run. This prevents an earlier linked-device attempt
// from inflating a later device's elapsed time.
requireText(start, '.in("client_id", identity.memberClientIds)', 'Account-wide accepted-result duplicate protection must remain.');
requireText(start, '.eq("client_id", identity.requestClientId)', 'Leaderboard attempt lookup must be scoped to the requesting browser.');
requireText(start, '.insert({ challenge_id: challengeId, client_id: identity.requestClientId })', 'New leaderboard attempts must be stored against the requesting browser.');
forbidText(start, '.insert({ challenge_id: challengeId, client_id: identity.storageClientId })', 'Account identity must not own the server timer; it causes cross-device elapsed inflation.');

// Version the browser attempt cache so legacy account-wide attempt ids cannot be
// silently reused after the server-side timing fix.
requireText(client, 'const ATTEMPT_PREFIX = "fpl-v5.1-leaderboard-attempt-";', 'Leaderboard browser attempt cache must be versioned after the timing migration.');

// The retired Phase 4.5 anchor no longer exists. The leaderboard must live inside
// main.app so it shares the player page width and does not appear after the app's
// bottom padding as a full-width orphan.
requireText(client, 'const main=document.querySelector("main.app")||document.querySelector("main");', 'Leaderboard must target main.app directly.');
requireText(client, 'if(main)main.appendChild(shell); else document.body.appendChild(shell);', 'Leaderboard must append inside the app when available.');
forbidText(client, 'const anchor=document.getElementById("phase45Shell")||document.getElementById("localHistory")||document.querySelector("main");', 'Retired Phase 4.5/localHistory fallback must not return.');

requireText(index, 'js/leaderboard-client.js?v=5.1.0', 'Leaderboard client cache key must be bumped for the timing/layout fix.');

console.log('Leaderboard device timing + layout regression invariants passed.');
