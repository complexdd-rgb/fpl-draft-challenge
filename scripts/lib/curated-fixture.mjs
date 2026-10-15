import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
export async function curatedFixture(){
  const definition=JSON.parse(fs.readFileSync('prompt-library-curated-v2/manifest.json','utf8'));
  let serial=0,cached=null,calls=0;
  // Minimal synthetic records isolate membership/cache validation. They are never
  // installed into production and make no claim about original answer evidence.
  const shards=definition.familySelectors.map(d=>{
    const selector=JSON.parse(fs.readFileSync(d.path,'utf8'));
    const records=Object.entries(selector.positions).flatMap(([position,ids])=>ids.map(suffix=>({
      id:`factory_${d.family.replaceAll('-','_')}_${position}_${suffix}`,family:d.family,
      position:position==='any'?'ANY':position.toUpperCase(),label:'Synthetic fixture',
      conditions:[{field:'minutes',operator:'gt',value:0}],qualityStatus:'pass',enabled:true,
      qualityEvidence:{answerPlayers:2},variantGroup:`fixture-${serial++%1330}`
    })));
    return {family:d.family,count:records.length,records};
  });
  const source={kind:'fpl-prompt-library-family-shards',manifest:{
    promotionFingerprint:definition.sourcePromotionFingerprint,total:definition.sourcePrompts,
    families:definition.families,variantGroups:definition.sourceVariantGroups},shards};
  const window={FPL_PROMPT_LIBRARY_SHARDS_V1:{ready:true,buildRepositoryPackage:async()=>{calls++;return source;}},
    addEventListener(){},dispatchEvent(){},indexedDB:{open(){const request={};queueMicrotask(()=>{
      request.result={objectStoreNames:{contains:()=>true},close(){},transaction(){const tx={objectStore(){return{
        get(){const r={};queueMicrotask(()=>{r.result=cached;r.onsuccess?.();});return r;},
        put(value){cached=structuredClone(value);queueMicrotask(()=>tx.oncomplete?.());}
      };}};return tx;}};request.onsuccess?.();});return request;}}};
  const c=vm.createContext({window,document:{baseURI:'https://fixture.invalid/'},console,TextEncoder,
    crypto:crypto.webcrypto,fetch:async url=>({ok:true,text:async()=>fs.readFileSync(new URL(url).pathname.slice(1),'utf8')}),URL,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}}});
  vm.runInContext(fs.readFileSync('js/admin-daily-curated-authority-v1.js','utf8'),c);
  const api=window.FPL_DAILY_CURATED_AUTHORITY_V1;
  const original=await api.buildGenerationPackage();
  return {api,original,mutate(fn){fn(cached);api.invalidate();},calls:()=>calls};
}
