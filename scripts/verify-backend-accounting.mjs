import assert from 'node:assert/strict';
import {fixture} from './lib/backend-fixture.mjs';
// Handler contract tests. Real transaction/concurrency semantics are checked by
// scripts/verify-ledger-postgres.py against an isolated Postgres service in CI.
let rpcCalls=[];
const result={playerPoints:110,penaltyPoints:20,finalScore:90,perfectScore:110,efficiency:90/110*100,perfectPromptPicks:11,elapsedSeconds:43,selections:[]};
const f=fixture({rpc:async(name,args,tables)=>{
 rpcCalls.push({name,args});
 if(name==='complete_leaderboard_attempt'){tables.leaderboard_attempts[0].completion_result=structuredClone(result);return {data:result,error:null};}
 return {data:{valid:false,penaltyPoints:20},error:null};
}});
const base={challengeId:f.verifier.challengeId,clientId:'guest-fixture'};
const start=await f.call('leaderboard-start',base);const body={...base,attemptId:start.body.attemptId};
assert.equal((await f.call('leaderboard-finish',{...body,displayName:'Fixture',selections:f.verifier.prompts.map(p=>({promptId:p.promptId,...p.allowed[0]}))})).status,409,'Finish cannot bypass Reveal or pick accounting');
assert.equal(f.tables.leaderboard_entries.length,0);
assert.equal((await f.call('leaderboard-pick',{...body,promptId:'p0',playerId:'bad',season:'2024-25',eventId:'retained-event-1'})).status,200);
assert.equal(rpcCalls[0].name,'record_leaderboard_pick');assert.equal(rpcCalls[0].args.p_event_id,'retained-event-1');
assert.deepEqual(Array.from(rpcCalls[0].args.p_client_ids),['guest-fixture']);
assert.equal((await f.call('leaderboard-finish',{...body,action:'complete',selections:[]})).body.elapsedSeconds,43);
const submitted=await f.call('leaderboard-finish',{...body,displayName:'Fixture',elapsedSeconds:99999,selections:[]});
assert.equal(submitted.status,200);assert.equal(submitted.body.elapsedSeconds,43);assert.equal(submitted.body.finalScore,90);assert.equal(submitted.body.penaltyPoints,20);
const again=await f.call('leaderboard-finish',{...body,displayName:'Fixture'});assert.equal(again.body.alreadySubmitted,true);assert.equal(f.tables.leaderboard_entries.length,1);
const locked=fixture({rpc:async()=>({error:{code:'55000',message:'No matching recorded pick'}})});
locked.tables.leaderboard_attempts.push({id:'fixture-attempt',challenge_id:locked.verifier.challengeId,client_id:'guest-fixture'});
assert.equal((await locked.call('leaderboard-finish',{...base,attemptId:'fixture-attempt',action:'complete',selections:[]})).status,409);
console.log('PASS transaction delegation, no direct finish, frozen ranking time and duplicate recovery');
