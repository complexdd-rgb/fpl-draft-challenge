import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
const repo=process.cwd();
// Same Acorn parser API as the pinned Edge dependency. Node bundles Acorn for
// its own parser tooling, keeping these offline fixtures dependency-free.
const parserContext=vm.createContext({});
vm.runInContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],parserContext);
const parse=parserContext.acorn.parse;
// Executes actual Edge Function handlers against in-memory storage; never sends requests.
export function fixture({ releaseDate = '2026-10-14', now = '2026-10-14T12:00:00Z', rpc = null, sources = {} } = {}){
 const nowMs=Date.parse(now); class ClockDate extends Date { constructor(...args){super(...(args.length?args:[nowMs]));} static now(){return nowMs;} }
 const verifier={version:1,challengeId:'daily-'+releaseDate,releaseDate,perfectScore:110,perfectScoreVerified:true,prompts:Array.from({length:11},(_,i)=>({promptId:`p${i}`,position:'MID',bestPoints:10,allowed:[{playerId:`player${i}`,season:'2024-25',points:10}]}))};
 const tables={leaderboard_verifiers:[{challenge_id:verifier.challengeId,release_date:verifier.releaseDate,perfect_score:110,payload:verifier,active:true}],daily_challenge_schedule:[{release_date:verifier.releaseDate,challenge_id:verifier.challengeId,source_js:'window.FPL_DAILY_CHALLENGE={id:"release-fixture"};',active:true}],leaderboard_attempts:[],leaderboard_entries:[],leaderboard_account_identities:[],leaderboard_account_devices:[],app_admin_users:[{user_id:'admin-fixture'}]};
 const operations=[];let serial=0;
 const client={auth:{getUser:async token=>({data:{user:{id:token==='admin-token'?'admin-fixture':'attacker-fixture'}},error:null})},from(table){
  let filters=[],orders=[],lim=null,from=0,to=null,mode='select',value,one=false;
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},lte(k,v){filters.push(r=>r[k]<=v);return q},gt(k,v){filters.push(r=>r[k]>v);return q},order(k,o={}){orders.push([k,o.ascending!==false]);return q},limit(n){lim=n;return q},range(a,b){from=a;to=b;return q},maybeSingle(){one=true;return q},single(){one=true;return q},insert(v){mode='insert';value=v;return q},update(v){mode='update';value=v;return q},then(resolve,reject){return Promise.resolve().then(()=>{
   operations.push({table,mode});let rows=tables[table].filter(r=>filters.every(f=>f(r)));
   if(mode==='insert'){const r={identity_id:'identity-fixture',id:`fixture-${++serial}`,started_at:new ClockDate().toISOString(),created_at:new ClockDate().toISOString(),penalty_points:0,completed:false,...value};tables[table].push(r);rows=[r];}
   if(mode==='update'){rows.forEach(r=>Object.assign(r,value));}
   rows=rows.map(r=>structuredClone(r)); rows.sort((a,b)=>{for(const[k,asc]of orders){if(a[k]<b[k])return asc?-1:1;if(a[k]>b[k])return asc?1:-1}return 0});if(lim!==null)rows=rows.slice(0,lim);if(to!==null)rows=rows.slice(from,to+1);
   return {data:one?rows[0]||null:rows,error:null};}).then(resolve,reject)}};return q;
 },rpc:async(name,args)=>{operations.push({rpc:name,args:structuredClone(args)});return rpc ? rpc(name,args,tables) : {data:args.p_challenges?.length||1,error:null}}};
 function handler(name){let fn;const c=vm.createContext({Request,Response,URL,Date:ClockDate,Intl,parse,console:{error(){}},createClient:()=>client,Deno:{env:{get:k=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-secret',SUPABASE_ANON_KEY:'fixture-public-key'})[k]},serve:f=>fn=f}});
 const backend=fs.readFileSync(`${repo}/supabase/functions/_shared/backend.ts`,'utf8').replace(/^import .*;\n/m,'').replace(/^export /gm,'');
 const endpoint=(sources[name] ?? fs.readFileSync(`${repo}/supabase/functions/${name}/index.ts`,'utf8')).replace(/^import .*;\n/gm,'');
 const validator=fs.readFileSync(`${repo}/supabase/functions/_shared/generated-source.ts`,'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 // Separate wrappers emulate module scopes to avoid shadowing helpers such as bearerToken.
 const js=stripTypeScriptTypes(backend,{mode:'transform'})+'\n'+stripTypeScriptTypes(validator,{mode:'transform'})+'\n'+stripTypeScriptTypes(`(function(){${endpoint}\n})()`,{mode:'transform'});
 vm.runInContext(js,c);return fn;}
 const call=async(name,body,token='')=>{const req=new Request('https://fixture.invalid/functions/v1/'+name,{method:'POST',headers:{apikey:'fixture-public-key','Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const r=await handler(name)(req);return {status:r.status,body:await r.json()}};
 return {verifier,tables,operations,handler,call,client};
}
