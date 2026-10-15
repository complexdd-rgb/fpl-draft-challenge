import assert from 'node:assert/strict';
import {fixture} from './lib/backend-fixture.mjs';
const make = f => {
 const v=structuredClone(f.verifier);v.calculatedPerfectScore=v.perfectScore;v.perfectXi=v.prompts.map(p=>({promptId:p.promptId,...p.allowed[0]}));
 const prompts=v.prompts.map(p=>`{id:${JSON.stringify(p.promptId)},position:${JSON.stringify(p.position)},label:"Fixture",fail:"No",test:p=>true}`).join(',');
 return {action:'publish',challenges:[{releaseDate:v.releaseDate,challengeId:v.challengeId,challengeNumber:0,title:'Fixture',perfectScore:v.perfectScore,sourceJs:`window.FPL_DAILY_CHALLENGE={id:${JSON.stringify(v.challengeId)},releaseDate:${JSON.stringify(v.releaseDate)},perfectScore:${v.perfectScore},prompts:[${prompts}]};`,manifestEntry:{id:v.challengeId,date:v.releaseDate},verifier:v}]};
};
for(const kind of ['empty-proof','wrong-total','duplicate-player','nonoptimal']){
 const f=fixture(),body=make(f),v=body.challenges[0].verifier;
 if(kind==='empty-proof')v.perfectXi=[];
 if(kind==='wrong-total')v.calculatedPerfectScore=999999;
 if(kind==='duplicate-player')v.perfectXi[1].playerId=v.perfectXi[0].playerId;
 if(kind==='nonoptimal'){v.prompts[0].allowed.push({playerId:'better',season:'2024-25',points:11});v.prompts[0].bestPoints=11;}
 const r=await f.call('daily-challenge-publish',body,'admin-token');
 assert.equal(r.status,400,kind+' must fail');assert.ok(!f.operations.some(o=>o.rpc));console.log('PASS',kind);
}
const f=fixture(),body=make(f);
assert.equal((await f.call('daily-challenge-publish',body,'admin-token')).status,200);
assert.equal((await f.call('daily-challenge-publish',body)).status,401);
assert.equal((await f.call('daily-challenge-publish',body,'attacker-token')).status,403);
console.log('PASS valid score proof and admin authorization');

const overlap=fixture(),proof=make(overlap),v=proof.challenges[0].verifier;
for(let i=0;i<2;i++){v.prompts[i].allowed.push({playerId:'shared',season:'2024-25',points:20});v.prompts[i].bestPoints=20;}
v.perfectXi[0]={promptId:'p0',playerId:'shared',season:'2024-25',points:20};v.perfectScore=v.calculatedPerfectScore=120;
proof.challenges[0].perfectScore=120;proof.challenges[0].sourceJs=proof.challenges[0].sourceJs.replace('perfectScore:110','perfectScore:120');
assert.equal((await overlap.call('daily-challenge-publish',proof,'admin-token')).status,200,'Maximum must respect shared footballers across clues');
proof.challenges[0].sourceJs=proof.challenges[0].sourceJs.replace('perfectScore:120','perfectScore:110');
assert.equal((await overlap.call('daily-challenge-publish',proof,'admin-token')).status,400);
console.log('PASS shared-player assignment and source-score consistency');
