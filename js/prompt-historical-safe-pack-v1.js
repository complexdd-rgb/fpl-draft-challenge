/* FPL Draft Challenge — Historical-safe prompt pack v1.0.0
   Quality-checked prompt families for partial historical seasons. Null/unknown values are
   excluded during candidate analysis as well as runtime, so Number(null) can never create
   a false answer. Focus: minutes, goals, cards, clean sheets, nationality and anti-meta. */
(() => {
  "use strict";
  if (window.FPL_HISTORICAL_SAFE_PROMPT_PACK_V1?.ready) return;

  const POS = ["GK","DEF","MID","FWD"];
  const NOUN = {GK:"Goalkeeper",DEF:"Defender",MID:"Midfielder",FWD:"Forward"};
  const LOW = {GK:"goalkeeper",DEF:"defender",MID:"midfielder",FWD:"forward"};
  const BIG6 = ["Arsenal","Chelsea","Liverpool","Man City","Man Utd","Spurs"];
  const RANGE = {GK:[5,35,70],DEF:[8,90,165],MID:[8,90,165],FWD:[6,60,110]};
  const GOALS = {GK:[1],DEF:[1,2,3,4],MID:[2,4,6,8],FWD:[4,6,8,10,12]};
  const CAPS = {GK:[70,85,100],DEF:[70,85,100],MID:[70,85,100],FWD:[60,75,90]};
  const CS = {GK:[6,8,10,12],DEF:[5,7,9,11]};
  const LIMIT = 7;

  const players = () => Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  const library = () => { const api = window.FPL_STUDIO_API?.getPromptLibrary?.(); return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null); };
  const numeric = (p,k) => p && p[k] !== null && p[k] !== undefined && p[k] !== "" && Number.isFinite(Number(p[k]));
  const known = (p,k) => p && p[k] !== null && p[k] !== undefined && p[k] !== "";
  const slug = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  const k = f => `(p.${f} !== null && p.${f} !== undefined && p.${f} !== "" && Number.isFinite(Number(p.${f})))`;
  const b = f => `(p.${f} !== null && p.${f} !== undefined)`;
  const compile = src => { try { return Function(`"use strict"; return (${src});`)(); } catch (_) { return null; } };

  function canonicalCountry(v) {
    const raw = String(v||"").trim(); if (!raw) return "";
    const a = {"Cote d’Ivoire":"Ivory Coast","Cote d'Ivoire":"Ivory Coast","United States":"USA","Republic of Ireland":"Ireland","Korea Republic":"South Korea","Czechia":"Czech Republic"};
    return a[raw] || raw;
  }

  function analyse(position, test, fields, members) {
    const ids = new Set(); let seasons=0, evaluable=0, total=0;
    const memberSet = members ? new Set(members.map(String)) : null;
    for (const pl of players()) {
      if (memberSet && !memberSet.has(String(pl.playerId))) continue;
      for (const p of pl.seasons||[]) {
        if (p.position !== position || !numeric(p,"minutes") || Number(p.minutes)<=0) continue;
        total++;
        if (!fields.every(f => f==="club" ? known(p,f) : (typeof p[f] === "boolean" ? known(p,f) : numeric(p,f)))) continue;
        evaluable++;
        try { if (test(p)) { ids.add(pl.playerId); seasons++; } } catch (_) {}
      }
    }
    return {ids, players:ids.size, seasons, coverage:total ? evaluable/total : 0};
  }

  function candidate(position,family,tail,label,fail,src,fields,tags,novelty=0,members=null) {
    const test=compile(src); if (!test) return null;
    const stats=analyse(position,test,fields,members), [min,ideal,broad]=RANGE[position];
    if (stats.players<min || stats.players>broad) return null;
    const score=120+novelty-Math.abs(stats.players-Math.min(ideal,35))/Math.max(1,ideal)*20+stats.coverage*8;
    return {id:`historical_safe_v1_${position.toLowerCase()}_${tail}`.replace(/[^a-z0-9_]+/g,"_"),family:`historical-safe-v1:${family}`,position,label,fail,src,test,fields,tags:["historical-safe","partial-data-safe","anti-meta","quality-pack-historical-v1",...tags],stats,score};
  }

  function core(position,out) {
    const noun=NOUN[position], lower=LOW[position];
    for (const m of [1500,2100,2700,3000]) for (const g of GOALS[position]) out.push(candidate(position,"workhorse-scorer",`m${m}_g${g}`,`${noun} with ${m.toLocaleString("en-GB")}+ minutes and ${g}+ goal${g===1?"":"s"}`,`That ${lower} must have known minutes and goals, play ${m.toLocaleString("en-GB")}+ minutes and score ${g}+ goal${g===1?"":"s"}.`,`p => (${k("minutes")} && ${k("goals")} && Number(p.minutes)>=${m} && Number(p.goals)>=${g})`,["minutes","goals"],["minutes","goals","historical-core"],18));
    for (const cap of CAPS[position]) for (const m of [1800,2400,3000]) out.push(candidate(position,"inverse-points",`under_${cap}_m${m}`,`${noun} with under ${cap} FPL points despite ${m.toLocaleString("en-GB")}+ minutes`,`That ${lower} must have known points and minutes, score under ${cap} FPL points and play ${m.toLocaleString("en-GB")}+ minutes.`,`p => (${k("minutes")} && ${k("points")} && Number(p.minutes)>=${m} && Number(p.points)<${cap})`,["minutes","points"],["under-points","minutes","less-obvious"],28));
    for (const g of GOALS[position]) {
      out.push(candidate(position,"outside-big-six-scorer",`outside_big6_g${g}`,`${noun} outside the traditional Big Six with ${g}+ goal${g===1?"":"s"}`,`That ${lower} must play outside the traditional Big Six and score ${g}+ goal${g===1?"":"s"}.`,`p => (p.club !== null && p.club !== undefined && p.club !== "" && !${JSON.stringify(BIG6)}.includes(p.club) && ${k("goals")} && Number(p.goals)>=${g} && ${k("minutes")} && Number(p.minutes)>0)`,["club","goals","minutes"],["outside-big-six","goals","less-obvious"],26));
      out.push(candidate(position,"relegated-scorer",`relegated_g${g}`,`${noun} from a relegated club with ${g}+ goal${g===1?"":"s"}`,`That ${lower} must play for a relegated club and score ${g}+ goal${g===1?"":"s"}.`,`p => (${b("relegated")} && p.relegated===true && ${k("goals")} && Number(p.goals)>=${g} && ${k("minutes")} && Number(p.minutes)>0)`,["relegated","goals","minutes"],["relegated","goals","less-obvious"],30));
    }
    for (const m of [1800,2400,3000]) for (const y of [0,1,2]) out.push(candidate(position,"disciplined-workhorse",`m${m}_yc${y}`,`${noun} with ${m.toLocaleString("en-GB")}+ minutes and at most ${y} yellow card${y===1?"":"s"}`,`That ${lower} must have known minutes and yellow cards, play ${m.toLocaleString("en-GB")}+ minutes and receive at most ${y} yellow card${y===1?"":"s"}.`,`p => (${k("minutes")} && ${k("yellowCards")} && Number(p.minutes)>=${m} && Number(p.yellowCards)<=${y})`,["minutes","yellowCards"],["minutes","discipline","yellow-cards"],20));
    if (CS[position]) for (const cs of CS[position]) for (const m of [1800,2400,3000]) out.push(candidate(position,"clean-sheet-workhorse",`cs${cs}_m${m}`,`${noun} with ${cs}+ clean sheets and ${m.toLocaleString("en-GB")}+ minutes`,`That ${lower} must have known clean sheets and minutes, record ${cs}+ clean sheets and play ${m.toLocaleString("en-GB")}+ minutes.`,`p => (${k("cleanSheets")} && ${k("minutes")} && Number(p.cleanSheets)>=${cs} && Number(p.minutes)>=${m})`,["cleanSheets","minutes"],["clean-sheets","minutes"],18));
  }

  function nationality(position,out) {
    const map=new Map(), lower=LOW[position];
    for (const pl of players()) {
      const c=canonicalCountry(pl?.bio?.nationality); if (!c) continue;
      if (!(pl.seasons||[]).some(p=>p.position===position && numeric(p,"minutes") && Number(p.minutes)>0)) continue;
      if (!map.has(c)) map.set(c,[]); map.get(c).push(String(pl.playerId));
    }
    for (const [country,ids] of map) {
      if (ids.length<RANGE[position][0]) continue;
      const member=`${JSON.stringify(ids)}.includes(String(p._career?.playerId))`;
      for (const g of GOALS[position].slice(0,3)) out.push(candidate(position,"nationality-scorer",`nat_${slug(country)}_g${g}`,`${country} ${lower} with ${g}+ goal${g===1?"":"s"}`,`That ${lower} must be from ${country} and score ${g}+ goal${g===1?"":"s"}.`,`p => (${member} && ${k("goals")} && Number(p.goals)>=${g} && ${k("minutes")} && Number(p.minutes)>0)`,["goals","minutes"],["nationality",`country-${slug(country)}`,"goals"],country==="England"?18:30,ids));
    }
  }

  const overlap=(a,b)=>{ if(!a.size||!b.size)return 0; const s=a.size<=b.size?a:b,l=s===a?b:a; let n=0; for(const id of s)if(l.has(id))n++; return n/s.size; };
  function choose(items, ids, labels) {
    const pool=items.filter(Boolean).filter(x=>!ids.has(x.id)&&!labels.has(x.label.toLowerCase())).sort((a,b)=>b.score-a.score), picked=[];
    while(picked.length<LIMIT&&pool.length){ let bi=-1,bv=-Infinity; for(let i=0;i<pool.length;i++){const x=pool[i]; if(picked.some(y=>overlap(x.stats.ids,y.stats.ids)>=.82))continue; const family=picked.filter(y=>y.family===x.family).length; const v=x.score-family*16; if(v>bv){bv=v;bi=i;}} if(bi<0)break; picked.push(pool.splice(bi,1)[0]); } return picked;
  }
  function difficulty(pos,n){return pos==="GK"?(n<=12?"hard":n<=25?"medium":"easy"):pos==="FWD"?(n<=14?"hard":n<=35?"medium":"easy"):(n<=20?"hard":n<=55?"medium":"easy");}

  function install(){
    const lib=library(); if(!lib||!players().length)return false;
    const ids=new Set(lib.map(x=>String(x?.id||""))), labels=new Set(lib.map(x=>String(x?.label||"").trim().toLowerCase())), added=[], audit=[];
    for(const pos of POS){const all=[];core(pos,all);nationality(pos,all);for(const x of choose(all,ids,labels)){const p={id:x.id,family:x.family,position:x.position,label:x.label,fail:x.fail,difficulty:difficulty(pos,x.stats.players),tags:x.tags,rating:5,cooldown:12,enabled:true,requiredFields:x.fields,historicalSafe:true,fieldCoverage:Number(x.stats.coverage.toFixed(3)),answerPool:x.stats.players,studioRule:{kind:"source",source:x.src},testSource:x.src,test:x.test};lib.push(p);ids.add(p.id);labels.add(p.label.toLowerCase());added.push(p.id);audit.push({id:p.id,family:p.family,position:pos,answerPool:x.stats.players,seasonAnswers:x.stats.seasons,fieldCoverage:p.fieldCoverage,requiredFields:p.requiredFields});}}
    window.FPL_PROMPT_FIELD_GUARD?.guardCollection?.(lib);
    window.FPL_HISTORICAL_SAFE_PROMPT_PACK_V1=Object.freeze({ready:true,version:"1.0.0",ids:added,installedCount:added.length,audit,policy:"Candidate analysis and runtime both exclude unknown required fields."});
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed",{detail:{source:"historical-safe-v1",added:added.length}})); return true;
  }
  let tries=0; function boot(){if(install())return;if(++tries<80)setTimeout(boot,100);} boot(); window.addEventListener("fpl:prompt-tools-ready",boot);
})();
