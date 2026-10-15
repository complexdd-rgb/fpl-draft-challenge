import fs from 'node:fs';
import vm from 'node:vm';
const repo=process.cwd()+'/';
const read=p=>fs.readFileSync(repo+p,'utf8');
export function context(seed={}) {
  const values=new Map(Object.entries(seed)); const elements=new Map(); const events=new Map();
  const elem=id=>{if(!elements.has(id))elements.set(id,{id,textContent:'',innerHTML:'',value:'Player One',dataset:{},disabled:false,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false;}},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},scrollIntoView(){},focus(){},appendChild(){},setAttribute(){}});return elements.get(id);};
  const c={console,Map,Set,Intl,URL,URLSearchParams,Date,crypto:{randomUUID:()=> 'client-probe'},navigator:{onLine:true},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},document:{getElementById:elem,querySelector(){return null},querySelectorAll(){return []},addEventListener(){},createElement:()=>elem('created'),head:{appendChild(){}},body:{appendChild(){}},visibilityState:'visible'},setInterval(){return 1},clearInterval(){},setTimeout(){return 1},clearTimeout(){},requestAnimationFrame(){},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}},confirm:()=>true,addEventListener:(name,cb)=>events.set(name,cb),dispatchEvent:(e)=>events.get(e.type)?.(e),location:{pathname:'/',search:''}};
  c.window=c; vm.createContext(c); return {c,values,elem,events};
}
export function game(seed={}, players=null) {
 const x=context(seed); x.c.FPL_DAILY_CHALLENGE={id:'probe',releaseDate:'2026-10-14',title:'Probe',perfectScore:200,prompts:[{id:'p1',position:'MID',label:'One',test:r=>r.points>0},{id:'p2',position:'MID',label:'Two',test:r=>r.points>0}]};
 x.c.FPL_PLAYERS=[{playerId:'a',name:'A',seasons:[{season:'2025/26',position:'MID',minutes:90,points:100,club:'Club'}]},{playerId:'b',name:'B',seasons:[{season:'2025/26',position:'FWD',minutes:90,points:200,club:'Club'}]}];
 if(players)x.c.FPL_PLAYERS=players;
 vm.runInContext(read('js/game-engine.js'),x.c);return x;
}
