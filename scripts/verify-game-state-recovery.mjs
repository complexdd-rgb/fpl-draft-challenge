import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { game } from './lib/game-fixture.mjs';
const cases = [];
const test = (name, run) => cases.push({ name, run });
const saved = value => ({ 'fpl-v2-probe': JSON.stringify(value) });

for (const completedSeconds of [null, 0]) test(`unfinished reload recovers running time from ${completedSeconds}`, () => {
  const x = game(saved({ picks: { p1: { playerId: 'a', season: '2025/26' } }, startedAt: Date.now()-95000, completedSeconds }));
  assert.equal(vm.runInContext('completedSeconds', x.c), null);
  assert.match(x.elem('timer').textContent, /^Time 1:3[5-9]/);
});
test('a null saved pick is discarded safely', () => {
  let x;
  assert.doesNotThrow(() => { x=game(saved({ picks: { p1: null } })); });
  assert.equal(vm.runInContext('Object.keys(picks).length',x.c),0);
});
test('restored duplicates retain one valid footballer', () => {
  const x=game(saved({picks:{p1:{playerId:'a',season:'2025/26'},p2:{playerId:'a',season:'2025/26'}}}));
  assert.equal(vm.runInContext('Object.keys(picks).length',x.c),1);
});
test('a restored wrong-position pick is discarded', () => {
  const x=game(saved({picks:{p1:{playerId:'b',season:'2025/26'}}}));
  assert.equal(vm.runInContext('Object.keys(picks).length',x.c),0);
});
const players=[{playerId:'a',legacyPlayerIds:['old-a'],name:'Player A',aliases:['Nickname'],seasons:[{season:'2025/26',position:'MID',minutes:90,points:100}]}];
test('legacy IDs restore through the retained live identity metadata', () => {
  const x=game(saved({picks:{p1:{playerId:'old-a',season:'2025/26'}}}),players);
  assert.equal(vm.runInContext('picks.p1?.playerId',x.c),'a');
  assert.equal(vm.runInContext('getRecord("old-a","2025/26")?.points',x.c),100);
});
test('a verified stored search alias finds the canonical player', () => {
  const x=game({},players);
  vm.runInContext('onSearch({target:{dataset:{id:"p1"},value:"Nickname"}})',x.c);
  assert(x.elem('s-p1').innerHTML.includes('data-option="a"'));
});
test('reserved layout metadata does not make an empty clue Selected', () => {
  const src=fs.readFileSync('js/player-daily-redesign-v1.js','utf8');
  const fn=src.slice(src.indexOf('  function slotState('),src.indexOf('  function escapeHtml('));
  const c=vm.createContext({});vm.runInContext(fn,c);
  const slot={classList:{contains:()=>false},querySelector:s=>s==='.player-search'?{value:''}:s.includes('selected-meta')?{classList:{contains:k=>k==='fpl-reserved-meta'}}:null};
  assert.equal(c.slotState(slot),'open');
});
let failures=0;
for(const {name,run}of cases){try{run();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.message);}}
assert.equal(failures,0,`${failures}/${cases.length} game recovery checks failed`);
