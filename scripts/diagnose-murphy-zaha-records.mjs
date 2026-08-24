import fs from 'node:fs';
import vm from 'node:vm';

globalThis.window = { addEventListener(){}, removeEventListener(){}, dispatchEvent(){}, location:{pathname:'/admin.html'}, setTimeout, clearTimeout };
window.window = window;
globalThis.document = { readyState:'complete', querySelector(){return null;}, querySelectorAll(){return [];}, getElementById(){return null;}, addEventListener(){}, removeEventListener(){}, createElement(){return {style:{},dataset:{},classList:{add(){},remove(){}},appendChild(){},setAttribute(){},addEventListener(){}};}, head:{appendChild(){}}, body:{appendChild(){}} };
globalThis.CustomEvent = class CustomEvent { constructor(type, init={}) { this.type=type; this.detail=init.detail; } };
globalThis.Event = class Event { constructor(type, init={}) { this.type=type; this.bubbles=Boolean(init.bubbles); } };
const source = fs.readFileSync(new URL('../players.js', import.meta.url),'utf8');
vm.runInThisContext(source,{filename:'players.js'});
const players = window.FPL_PLAYERS || [];
for (const token of ['murphy','zaha','gedo','scocco','mesca','buomesca']) {
  console.log(`\n=== ${token.toUpperCase()} ===`);
  for (const p of players.filter(p => String(p.name).toLowerCase().includes(token) || String(p.playerId).toLowerCase().includes(token) || (p.aliases||[]).some(a => String(a).toLowerCase().includes(token)))) {
    console.log(JSON.stringify({playerId:p.playerId,name:p.name,aliases:p.aliases||[],bio:p.bio,seasons:(p.seasons||[]).map(s=>({season:s.season,club:s.club,position:s.position,minutes:s.minutes,points:s.points,goals:s.goals,assists:s.assists,yellowCards:s.yellowCards}))},null,2));
  }
}
