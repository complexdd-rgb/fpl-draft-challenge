import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {context} from './lib/game-fixture.mjs';
const source=fs.readFileSync('js/leaderboard-client.js','utf8'),setup=source.indexOf('  renderShell(); recoverCompletedRecord();');
let serial=0;
const x=context();x.c.crypto.randomUUID=()=>`event-${++serial}-fixture`;x.c.FPL_DAILY_CHALLENGE={id:'probe',releaseDate:'2026-10-14',perfectScore:10};
x.c.FPL_LEADERBOARD_CONFIG={enabled:true,supabaseUrl:'https://fixture.invalid',functions:{start:'start',pick:'pick',finish:'finish',list:'list'}};
let calls=[],dropPick=false;
x.c.fetch=async(url,{body})=>{
 const b=JSON.parse(body),name=url.split('/').at(-1);calls.push({name,body:b});
 if(name==='pick'&&dropPick){dropPick=false;throw new TypeError('Lost acknowledgement')}
 return {ok:true,json:async()=>name==='start'?{attemptId:'attempt',startedAt:'2026-10-14T12:00:00Z'}:name==='finish'?b.action==='complete'?{completed:true,elapsedSeconds:43}:{finalScore:10,elapsedSeconds:43,rank:1}:{entries:[],valid:true,penaltyPoints:0}};
};
vm.runInContext(source.slice(0,setup)+'window.probe={onAttemptStarted,onPickAttempt,onCompleted,networkChanged,submitPendingResult,settled:()=>requestQueue};})();',x.c);
x.c.navigator.onLine=false;x.c.probe.onAttemptStarted();await x.c.probe.settled();
x.c.probe.onPickAttempt({detail:{promptId:'p1',playerId:'invalid',season:'2025/26'}});await x.c.probe.settled();
x.c.probe.onCompleted({detail:{record:{official:true,completed:true,selections:[{promptId:'p1',playerId:'a',season:'2025/26'}]}}});await x.c.probe.settled();
x.c.navigator.onLine=true;x.c.probe.networkChanged();await x.c.probe.settled();
assert.equal(calls.filter(c=>c.name==='start').length,1,'Reconnect must recover a failed start');
assert.ok(calls.some(c=>c.name==='pick'&&c.body.playerId==='invalid'),'Failed invalid picks must replay');
assert.ok(calls.some(c=>c.name==='finish'&&c.body.action==='complete'),'Reveal must seal before name submission');
assert.equal(calls.filter(c=>c.name==='finish'&&!c.body.action).length,0);
assert.equal(x.elem('leaderboardSubmitResult').disabled,false);
await x.c.probe.submitPendingResult();
assert.equal(calls.filter(c=>c.name==='finish'&&!c.body.action).length,1);
// A lost response must retry the original persisted event ID, not create another penalty.
const y=context();y.c.crypto.randomUUID=()=>`event-${++serial}-fixture`;y.c.FPL_DAILY_CHALLENGE=x.c.FPL_DAILY_CHALLENGE;y.c.FPL_LEADERBOARD_CONFIG=x.c.FPL_LEADERBOARD_CONFIG;y.c.fetch=x.c.fetch;
vm.runInContext(source.slice(0,setup)+'window.probe={onPickAttempt,networkChanged,settled:()=>requestQueue};})();',y.c);
dropPick=true;calls=[];y.c.probe.onPickAttempt({detail:{promptId:'p1',playerId:'bad',season:'2025/26'}});await y.c.probe.settled();
y.c.probe.networkChanged();await y.c.probe.settled();
const bad=calls.filter(c=>c.name==='pick'&&c.body.playerId==='bad');assert.equal(bad.length,2);assert.equal(bad[0].body.eventId,bad[1].body.eventId);assert.ok(bad[0].body.eventId);
console.log('PASS failed start/pick recovery, retained event IDs and completion before publishing');
// Reload without an online event must replay an unfinished game's persisted queue.
const z=context(Object.fromEntries(y.values));z.c.FPL_DAILY_CHALLENGE=x.c.FPL_DAILY_CHALLENGE;z.c.FPL_LEADERBOARD_CONFIG=x.c.FPL_LEADERBOARD_CONFIG;z.c.fetch=x.c.fetch;
z.values.set('fpl-v6-leaderboard-outbox-probe',JSON.stringify([bad[0].body]));
vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.probe={settled:()=>requestQueue};})();'),z.c);
await z.c.probe.settled();assert.equal(JSON.parse(z.values.get('fpl-v6-leaderboard-outbox-probe')).length,0);
const w=context({'fpl-v2-probe':JSON.stringify({startedAt:Date.now()-10000})});w.c.FPL_DAILY_CHALLENGE=x.c.FPL_DAILY_CHALLENGE;w.c.FPL_LEADERBOARD_CONFIG=x.c.FPL_LEADERBOARD_CONFIG;w.c.fetch=x.c.fetch;
vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.probe={settled:()=>requestQueue};})();'),w.c);
await w.c.probe.settled();assert.ok(w.values.get('fpl-v5.1-leaderboard-attempt-probe'));
console.log('PASS unfinished reload and failed-start intent recovery');
