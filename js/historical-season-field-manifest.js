/* FPL Draft Challenge — historical season field manifest v1.0.0
   Measures known-field coverage by season across positive-minute player-seasons so Prompt
   Studio can explain which historical prompt families are actually evaluable. */
(() => {
  "use strict";
  const FIELDS=["club","position","minutes","goals","assists","cleanSheets","goalsConceded","ownGoals","penaltiesSaved","penaltiesMissed","yellowCards","redCards","saves","bonus","startingPrice","endingPrice","points","relegated","promoted","bottomHalf","topFour","champions","ageAtSeasonStart"];
  const players=()=>Array.isArray(window.FPL_PLAYERS)?window.FPL_PLAYERS:[];
  const known=v=>v!==null&&v!==undefined&&v!==""&&!(typeof v==="number"&&!Number.isFinite(v));
  const positive=p=>known(p?.minutes)&&Number(p.minutes)>0;

  function build(){
    const seasons=new Map();
    for(const player of players()) for(const record of player.seasons||[]){
      if(!positive(record))continue;
      const season=String(record.season||"").trim();if(!season)continue;
      if(!seasons.has(season))seasons.set(season,{season,records:0,players:new Set(),fields:Object.fromEntries(FIELDS.map(f=>[f,{known:0,total:0}]))});
      const row=seasons.get(season);row.records++;row.players.add(String(player.playerId));
      for(const field of FIELDS){const cell=row.fields[field];cell.total++;if(known(record[field]))cell.known++;}
    }
    const output=[...seasons.values()].sort((a,b)=>String(a.season).localeCompare(String(b.season))).map(row=>({
      season:row.season,playerCount:row.players.size,recordCount:row.records,
      fields:Object.fromEntries(Object.entries(row.fields).map(([field,x])=>[field,{known:x.known,total:x.total,coverage:x.total?Number((x.known/x.total).toFixed(4)):0,complete:x.total>0&&x.known===x.total}]))
    }));
    const bySeason=Object.fromEntries(output.map(row=>[row.season,row]));
    const api={ready:true,version:"1.0.0",fields:FIELDS,seasons:output,bySeason,
      coverage:(season,field)=>bySeason[String(season)]?.fields?.[field]?.coverage??0,
      canEvaluate:(season,requiredFields,minCoverage=1)=>{const row=bySeason[String(season)];if(!row)return false;return(requiredFields||[]).every(field=>field==="season"||field==="name"||field==="_career"||(row.fields[field]?.coverage??0)>=minCoverage);}
    };
    window.FPL_HISTORICAL_FIELD_MANIFEST=Object.freeze(api);
    window.dispatchEvent(new CustomEvent("fpl:historical-field-manifest-ready",{detail:api}));
    return api;
  }
  let tries=0;function boot(){if(players().length){build();return;}if(++tries<80)setTimeout(boot,100);}boot();
  window.addEventListener("fpl:players-updated",build);window.addEventListener("fpl:challenge-loaded",build);
})();
