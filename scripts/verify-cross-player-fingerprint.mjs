import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function snapshot(anchorSeason){
 const window={location:{pathname:'/audit'},addEventListener(){},FPL_PLAYERS:[
  {playerId:'subject',name:'Subject',bio:{nationality:'England'},seasons:[{season:'2011/12',club:'Arsenal',position:'MID',minutes:100,points:10},{season:'2012/13',club:'Arsenal',position:'MID',minutes:100,points:10}]},
  {playerId:'anchor',name:'Anchor',bio:{nationality:'England'},seasons:[{season:anchorSeason,club:'Chelsea',position:'MID',minutes:100,points:10}]}
 ]};window.window=window;
 const c=vm.createContext({window,document:{readyState:'complete',addEventListener(){},querySelector(){return null}},console});
 for(const file of ['js/career-context.js','js/validation-engine.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
 const prompt={id:'relationship',position:'MID',label:'Midfielder whose recorded Premier League career overlapped with Anchor',test:r=>r._career.seasonYears.some(year=>window.FPL_CAREER_CONTEXT.getPlayer('anchor').seasonYears.includes(year))};
 window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL=Object.freeze([prompt]);
 return {fingerprint:window.ValidationEngine.getSeasonFingerprint('2011/12'),answer:prompt.test(window.FPL_PLAYERS[0].seasons[0])};
}
const before=snapshot('2012/13'),after=snapshot('2013/14');
assert.equal(before.answer,true);assert.equal(after.answer,false);assert.notEqual(before.fingerprint,after.fingerprint,'A reference-player career must invalidate target-season evidence');
console.log('PASS cross-player career dependency changes target-season fingerprint');
