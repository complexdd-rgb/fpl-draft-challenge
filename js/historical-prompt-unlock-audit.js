/* FPL Draft Challenge — historical prompt unlock audit v1.0.0
   On-demand audit of how many prompts have a usable answer pool in each loaded season. */
(() => {
  "use strict";
  const players=()=>Array.isArray(window.FPL_PLAYERS)?window.FPL_PLAYERS:[];
  const library=()=>{const api=window.FPL_STUDIO_API?.getPromptLibrary?.();return Array.isArray(api)?api:(Array.isArray(window.FPL_PROMPT_LIBRARY)?window.FPL_PROMPT_LIBRARY:[]);};
  const known=v=>v!==null&&v!==undefined&&v!==""&&!(typeof v==="number"&&!Number.isFinite(v));

  function required(prompt){
    if(Array.isArray(prompt?.requiredFields)&&prompt.requiredFields.length)return prompt.requiredFields;
    try{return window.FPL_PROMPT_FIELD_GUARD?.promptDependencies?.(prompt)||[];}catch(_){return[];}
  }
  function evaluable(prompt,record){
    const guard=window.FPL_PROMPT_FIELD_GUARD;
    if(guard?.canEvaluatePrompt){try{return guard.canEvaluatePrompt(prompt,record);}catch(_){} }
    return required(prompt).every(field=>field==="name"||field==="_career"||known(record?.[field]));
  }
  function test(prompt,record){
    if(!evaluable(prompt,record))return false;
    try{return typeof prompt.test==="function"&&Boolean(prompt.test(record));}catch(_){return false;}
  }

  function run(options={}){
    const minAnswers=Math.max(1,Number(options.minAnswers)||5);
    const onlyEnabled=options.onlyEnabled!==false;
    const promptList=library().filter(p=>!onlyEnabled||p.enabled!==false);
    const bySeason=new Map();
    for(const player of players())for(const record of player.seasons||[]){if(!known(record?.minutes)||Number(record.minutes)<=0)continue;const season=String(record.season||"").trim();if(!season)continue;if(!bySeason.has(season))bySeason.set(season,[]);bySeason.get(season).push({playerId:String(player.playerId),record});}
    const seasons=[];
    for(const [season,records] of [...bySeason.entries()].sort((a,b)=>a[0].localeCompare(b[0]))){
      const unlocked=[],byPosition={GK:0,DEF:0,MID:0,FWD:0},byReadiness={};
      for(const prompt of promptList){
        const ids=new Set();let evaluableRows=0;
        for(const entry of records){if(prompt.position&&entry.record.position!==prompt.position)continue;if(!evaluable(prompt,entry.record))continue;evaluableRows++;if(test(prompt,entry.record))ids.add(entry.playerId);}
        if(ids.size<minAnswers)continue;
        const readiness=prompt.historicalReadiness||"UNCLASSIFIED";
        unlocked.push({id:prompt.id,label:prompt.label,position:prompt.position,answerPlayers:ids.size,evaluableRows,readiness,requiredFields:required(prompt)});
        if(byPosition[prompt.position]!==undefined)byPosition[prompt.position]++;
        byReadiness[readiness]=(byReadiness[readiness]||0)+1;
      }
      seasons.push({season,playerSeasons:records.length,unlockedCount:unlocked.length,byPosition,byReadiness,unlocked});
    }
    const result={ready:true,version:"1.0.0",generatedAt:new Date().toISOString(),minAnswers,promptCount:promptList.length,seasons,bySeason:Object.fromEntries(seasons.map(x=>[x.season,x]))};
    window.FPL_HISTORICAL_PROMPT_UNLOCK_AUDIT_RESULT=result;
    window.dispatchEvent(new CustomEvent("fpl:historical-prompt-unlock-audit-ready",{detail:result}));
    return result;
  }

  window.FPL_HISTORICAL_PROMPT_UNLOCK_AUDIT=Object.freeze({version:"1.0.0",run});
})();
