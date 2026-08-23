
/* Core FPL Daily Challenge game engine. */
"use strict";
const challenge = window.FPL_DAILY_CHALLENGE || null;

if (!challenge) {
  const status = document.getElementById("dbStatus");
  if (status) status.textContent = "Challenge failed to load";
  throw new Error("No FPL daily challenge was loaded.");
}
const groupedPlayers = Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
if (!groupedPlayers.length) {
  const status = document.getElementById("dbStatus");
  if (status) status.textContent = "Player database failed to load";
  throw new Error("No FPL player database was loaded.");
}
const playerById = new Map();
const recordByKey = new Map();
const flatSeasons = [];
for (const player of groupedPlayers) {
  playerById.set(player.playerId, player);
  for (const season of Array.isArray(player.seasons) ? player.seasons : []) {
    // Use the existing certified/live row object rather than cloning every season.
    // Career Context attaches _career to these same objects before the game engine runs.
    if (season.playerId == null) season.playerId = player.playerId;
    if (season.name == null) season.name = player.name;
    flatSeasons.push(season);
    recordByKey.set(`${player.playerId}\u0000${season.season}`, season);
  }
}
const availableSeasonLabels = [...new Set(flatSeasons.map(record => record.season).filter(season => /^\d{4}\/\d{2}$/.test(String(season))))]
  .sort((a,b) => Number(a.slice(0,4)) - Number(b.slice(0,4)));
const databaseSeasonRange = availableSeasonLabels.length
  ? `${availableSeasonLabels[0]}–${availableSeasonLabels[availableSeasonLabels.length-1]}`
  : "Historical seasons";
const INVALID_PENALTY = 10;
const ARCHIVE_MODE = window.FPL_CHALLENGE_RUNTIME?.archiveMode === true;
const ATTEMPT_MODE = ARCHIVE_MODE ? "archive-practice" : "official";
const STORE = ARCHIVE_MODE ? `fpl-v2-practice-${challenge.id}` : `fpl-v2-${challenge.id}`;
const BEST = ARCHIVE_MODE ? `fpl-v2-practice-${challenge.id}-best` : `fpl-v2-${challenge.id}-best`;
const HISTORY_STORE = "fpl-v4-local-history";
let picks = {};
let drafts = {};
let feedback = {};
let penalties = 0;
let startedAt = null;
let completedSeconds = null;
let completedRecord = null;
let timerId;
let active = {};

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalise=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const formatTime=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,"0")}`;
const getPlayer=id=>playerById.get(id);
const getRecord=(playerId,season)=>recordByKey.get(`${playerId}\u0000${season}`);
const usedPlayerIds=()=>new Set(Object.values(picks).map(p=>p.playerId));
/* Zero-minute answer eligibility rule. */
const qualifiesForAnswer=record=>Number.isFinite(Number(record?.minutes))&&Number(record.minutes)>0;
const promptBestPointsCache=new Map();
function promptBestPoints(prompt){
  if(promptBestPointsCache.has(prompt.id))return promptBestPointsCache.get(prompt.id);
  let best=Number.NEGATIVE_INFINITY;
  for(const candidate of flatSeasons){
    if(!qualifiesForAnswer(candidate)||candidate.position!==prompt.position||!prompt.test(candidate))continue;
    const points=Number(candidate.points);
    if(Number.isFinite(points)&&points>best)best=points;
  }
  const resolved=Number.isFinite(best)?best:0;
  promptBestPointsCache.set(prompt.id,resolved);
  return resolved;
}
function pickEfficiencyDetails(record,prompt){
  const picked=Number(record?.points)||0;
  const best=promptBestPoints(prompt);
  const percentage=best>0?Math.max(0,Math.min(100,(picked/best)*100)):(picked===best?100:0);
  const rounded=Math.round(percentage);
  const tier=rounded===100?"perfect":rounded>=90?"elite":rounded>=75?"strong":"risky";
  const label=rounded===100?"Perfect":rounded>=90?"Elite":rounded>=75?"Strong":"Risky";
  return {picked,best,percentage,rounded,tier,label};
}
function pickEfficiencyMarkup(record,prompt){
  const detail=pickEfficiencyDetails(record,prompt);
  return `<div class="pick-efficiency" data-tier="${detail.tier}" aria-label="Pick efficiency ${detail.rounded} percent"><div class="pick-efficiency-head"><span>${detail.label} selection</span><strong>${detail.rounded}%</strong></div><div class="efficiency-track"><div class="efficiency-fill" style="width:${detail.percentage.toFixed(1)}%"></div></div><small>Compared with the highest-scoring valid player-season for this prompt.</small></div>`;
}

function save(){
  const payload={version:3,challengeId:challenge.id,releaseDate:challenge.releaseDate||null,picks,penalties,startedAt,completedSeconds,completedRecord};
  localStorage.setItem(STORE,JSON.stringify(payload));
}
function load(){
  try{
    if(ARCHIVE_MODE){
      const official=loadHistory().find(item=>item&&item.completed===true&&item.challengeId===challenge.id);
      if(official){
        completedRecord=official;
        picks=official.picks||{};
        penalties=Number(official.penalties)||0;
        startedAt=Number(official.startedAt)||null;
        completedSeconds=Number(official.elapsedSeconds)||0;
        return;
      }
    }
    const x=JSON.parse(localStorage.getItem(STORE)||"{}");
    picks=x.picks||{};
    penalties=Number(x.penalties)||0;
    startedAt=Number.isFinite(Number(x.startedAt))&&Number(x.startedAt)>0?Number(x.startedAt):null;
    completedSeconds=Number.isFinite(Number(x.completedSeconds))?Number(x.completedSeconds):null;
    completedRecord=x.completedRecord&&x.completedRecord.challengeId===challenge.id?x.completedRecord:null;
    if(completedRecord){
      picks=completedRecord.picks||picks;
      penalties=Number(completedRecord.penalties)||penalties;
      startedAt=Number(completedRecord.startedAt)||startedAt;
      completedSeconds=Number(completedRecord.elapsedSeconds)||completedSeconds||0;
    }else if(Object.keys(picks).length&&startedAt===null){
      startedAt=Date.now();
    }
  }catch{}
}
function ensureStarted(){
  if(completedRecord||startedAt!==null)return;
  startedAt=Date.now();
  save();
  tick();
  window.dispatchEvent(new CustomEvent("fpl:attempt-started",{detail:{challengeId:challenge.id,challengeDate:challengeDate(),startedAt}}));
}
function isGameCompleted(){return !!completedRecord;}
function loadHistory(){
  try{
    const value=JSON.parse(localStorage.getItem(HISTORY_STORE)||"[]");
    return Array.isArray(value)?value:[];
  }catch{return [];}
}
function saveHistory(history){
  localStorage.setItem(HISTORY_STORE,JSON.stringify(history));
}
function upsertHistory(record){
  const history=loadHistory().filter(item=>item&&item.challengeId!==record.challengeId);
  history.push(record);
  history.sort((a,b)=>String(a.challengeDate||"").localeCompare(String(b.challengeDate||"")));
  saveHistory(history.slice(-400));
  renderLocalHistory();
}
function dateDayNumber(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||""));
  if(!match)return null;
  return Math.floor(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))/86400000);
}
function currentStreak(history){
  const days=[...new Set(history.map(item=>dateDayNumber(item.challengeDate)).filter(Number.isFinite))].sort((a,b)=>a-b);
  if(!days.length)return 0;
  let streak=1;
  for(let i=days.length-1;i>0;i--){if(days[i]-days[i-1]===1)streak++;else break;}
  return streak;
}
function renderLocalHistory(){
  const history=loadHistory().filter(item=>item&&item.completed===true&&item.official!==false);
  const games=history.length;
  const scores=history.map(item=>Number(item.finalScore)).filter(Number.isFinite);
  const efficiencies=history.map(item=>Number(item.efficiency)).filter(Number.isFinite);
  const perfectPicks=history.reduce((sum,item)=>sum+(Number(item.perfectPromptPicks)||0),0);
  const set=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=value;};
  set("historyGames",games.toLocaleString());
  set("historyStreak",currentStreak(history).toLocaleString());
  set("historyBestScore",scores.length?Math.max(...scores).toLocaleString():"0");
  set("historyBestEfficiency",efficiencies.length?`${Math.max(...efficiencies).toFixed(1)}%`:"0%");
  set("historyAverageEfficiency",efficiencies.length?`${(efficiencies.reduce((a,b)=>a+b,0)/efficiencies.length).toFixed(1)}%`:"0%");
  set("historyPerfectPicks",perfectPicks.toLocaleString());
  const note=document.getElementById("completedLocalNote");
  if(note){
    note.classList.toggle("hidden",!completedRecord);
    if(completedRecord)note.textContent=ARCHIVE_MODE&&completedRecord.official===false?"This archive practice is already completed on this device. Your saved practice result has been restored.":ARCHIVE_MODE?"You completed this challenge on its original day. Your locked daily result has been restored.":"Today’s challenge is already completed on this device. Your saved result has been restored.";
  }
}
function challengeDate(){return challenge.releaseDate||window.FPL_CHALLENGE_RUNTIME?.selectedDate||new Date().toISOString().slice(0,10);}
function challengeDateLabel(value=challengeDate()){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||""));if(!m)return String(value||"Daily Challenge");return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),12)));}

function eligibleSeasons(player,prompt){
  return player.seasons.filter(s=>s.position===prompt.position&&qualifiesForAnswer(s));
}
function render(){
  document.getElementById("title").textContent=`FPL Daily Challenge 4.5 · ${challenge.title}`;
  document.getElementById("grid").innerHTML=challenge.prompts.map((prompt,index)=>{
    const saved=picks[prompt.id];
    const draft=drafts[prompt.id] || (saved ? {playerId:saved.playerId,season:saved.season}:null);
    const player=draft?getPlayer(draft.playerId):null;
    const seasons=player?eligibleSeasons(player,prompt):[];
    const record=draft?getRecord(draft.playerId,draft.season):null;
    const fb=feedback[prompt.id]||"";
    if(saved&&record){
      const detail=pickEfficiencyDetails(record,prompt);
      const price=Number.isFinite(record.startingPrice)?`£${record.startingPrice.toFixed(1)}m start`:"Starting price unavailable";
      return `<article class="slot valid compact-confirmed" data-position="${prompt.position}" id="slot-${prompt.id}">
        <div class="slot-head"><span class="pos">${prompt.position}</span><div><div class="prompt">${index+1}. ${esc(prompt.label)}</div></div></div>
        <div class="confirmed-summary">
          <div class="confirmed-player"><strong>${esc(record.name)}</strong><span>${record.season} · ${esc(record.club)} · ${price} · points hidden</span></div>
          <div class="compact-efficiency" data-tier="${detail.tier}" title="Compared with the best valid answer for this prompt"><span>${detail.label}</span><strong>${detail.rounded}%</strong></div>
          ${completedRecord?'<button class="compact-change attempt-locked" type="button" disabled>Completed</button>':`<button class="compact-change clear" data-clear="${prompt.id}" type="button">Change pick</button>`}
        </div>
        <div class="compact-track" aria-hidden="true"><span style="width:${detail.percentage.toFixed(1)}%"></span></div>
      </article>`;
    }
    return `<article class="slot" data-position="${prompt.position}" id="slot-${prompt.id}">
      <div class="slot-head"><span class="pos">${prompt.position}</span><div><div class="prompt">${index+1}. ${esc(prompt.label)}</div></div></div>
      <div class="choice-row">
        <div class="search-wrap">
          <input class="player-search" data-id="${prompt.id}" value="${player?esc(player.name):""}" placeholder="Search ${prompt.position}..." autocomplete="off">
          <div class="suggestions hidden" id="s-${prompt.id}"></div>
        </div>
        <select class="season-select" data-season="${prompt.id}" ${player?"":"disabled"}>
          ${player?seasons.map(s=>`<option value="${s.season}" ${s.season===draft.season?"selected":""}>${s.season}</option>`).join(""):`<option>Season</option>`}
        </select>
        <button class="confirm" data-confirm="${prompt.id}" ${record?"":"disabled"}>Confirm</button>
      </div>
      ${record?`<div class="selected-meta">${esc(record.club)} · ${record.position} · ${Number.isFinite(record.startingPrice) ? `£${record.startingPrice.toFixed(1)}m starting price` : "Starting price unavailable"}</div>`:""}
      <div class="feedback ${fb.startsWith("✅")?"good":fb.startsWith("❌")?"bad":""}">${esc(fb)}</div>
      ${player?`<button class="clear" data-clear="${prompt.id}">Clear selection</button>`:""}
    </article>`;
  }).join("");
  bind();
  updateStatus();
}
function bind(){
  document.querySelectorAll(".player-search").forEach(input=>{
    input.addEventListener("input",e=>{ensureStarted();onSearch(e);});
    input.addEventListener("keydown",e=>{ensureStarted();onKeys(e);});
    input.addEventListener("focus",e=>{ensureStarted();onSearch(e);});
  });
  document.querySelectorAll("[data-season]").forEach(select=>select.addEventListener("change",e=>{
    ensureStarted();const id=e.target.dataset.season;if(drafts[id]) drafts[id].season=e.target.value;save();render();
  }));
  document.querySelectorAll("[data-confirm]").forEach(b=>b.addEventListener("click",()=>{ensureStarted();confirmPick(b.dataset.confirm);}));
  document.querySelectorAll("[data-clear]").forEach(b=>b.addEventListener("click",()=>{if(completedRecord)return;ensureStarted();delete drafts[b.dataset.clear];delete picks[b.dataset.clear];feedback[b.dataset.clear]="";save();render();}));
}
function onSearch(e){
  const id=e.target.dataset.id;
  const prompt=challenge.prompts.find(p=>p.id===id);
  const q=normalise(e.target.value.trim());
  if(drafts[id] && normalise(getPlayer(drafts[id].playerId)?.name)!==q){delete drafts[id];delete picks[id];}
  const box=document.getElementById(`s-${id}`);
  if(q.length<2){box.classList.add("hidden");return;}
  const used=usedPlayerIds();
  const matches=groupedPlayers.filter(player=>
    !used.has(player.playerId) &&
    eligibleSeasons(player,prompt).length &&
    normalise(player.name).includes(q)
  ).slice(0,10);
  active[id]=-1;
  box.innerHTML=matches.length?matches.map((p,i)=>`<button class="suggestion" data-option="${p.playerId}" data-index="${i}" type="button"><strong>${esc(p.name)}</strong><small>${eligibleSeasons(p,prompt).map(s=>s.season).join(" · ")}</small></button>`).join(""):`<div class="suggestion">No matching unused players</div>`;
  box.classList.remove("hidden");
  box.querySelectorAll("[data-option]").forEach(b=>b.addEventListener("click",()=>choosePlayer(id,b.dataset.option)));
}
function onKeys(e){
  const id=e.target.dataset.id,box=document.getElementById(`s-${id}`),opts=[...box.querySelectorAll("[data-option]")];
  if(box.classList.contains("hidden")||!opts.length)return;
  if(e.key==="ArrowDown"){e.preventDefault();active[id]=Math.min((active[id]??-1)+1,opts.length-1);}
  else if(e.key==="ArrowUp"){e.preventDefault();active[id]=Math.max((active[id]??0)-1,0);}
  else if(e.key==="Enter"&&active[id]>=0){e.preventDefault();opts[active[id]].click();return;}
  else if(e.key==="Escape"){box.classList.add("hidden");return;}else return;
  opts.forEach((o,i)=>o.classList.toggle("active",i===active[id]));
}
function choosePlayer(id,playerId){
  ensureStarted();
  if(usedPlayerIds().has(playerId)){feedback[id]="That footballer has already been used — no penalty.";render();return;}
  const prompt=challenge.prompts.find(p=>p.id===id),player=getPlayer(playerId);
  const seasons=eligibleSeasons(player,prompt);
  drafts[id]={playerId,season:seasons[0].season};
  delete picks[id];feedback[id]="Choose a season, then confirm.";render();
}
function confirmPick(id){
  if(completedRecord)return;
  ensureStarted();
  const prompt=challenge.prompts.find(p=>p.id===id),draft=drafts[id];
  if(!draft)return;
  const duplicate=Object.entries(picks).some(([key,p])=>key!==id&&p.playerId===draft.playerId);
  if(duplicate){feedback[id]="That footballer has already been used — no penalty.";render();return;}
  const record=getRecord(draft.playerId,draft.season);
  if(!record)return;
  if(!qualifiesForAnswer(record)){feedback[id]="This player-season recorded 0 minutes and cannot be used — no penalty.";delete picks[id];save();render();return;}
  window.dispatchEvent(new CustomEvent("fpl:pick-attempt",{detail:{challengeId:challenge.id,challengeDate:challengeDate(),promptId:id,playerId:draft.playerId,season:draft.season}}));
  if(!prompt.test(record)){
    penalties+=INVALID_PENALTY;feedback[id]=`❌ ${record.name} ${record.season} is invalid. ${prompt.fail} −${INVALID_PENALTY} points.`;
    delete picks[id];save();render();
    const slot=document.getElementById(`slot-${id}`);slot?.classList.add("invalid-flash");setTimeout(()=>slot?.classList.remove("invalid-flash"),450);
    return;
  }
  picks[id]={playerId:draft.playerId,season:draft.season};feedback[id]=`✅ Valid: ${record.points} points hidden until reveal.`;save();render();
}
function updateStatus(){
  const count=challenge.prompts.filter(p=>picks[p.id]).length;
  const total=challenge.prompts.length;
  const percent=total?Math.max(0,Math.min(100,(count/total)*100)):0;
  document.getElementById("dbStatus").textContent=`${groupedPlayers.length.toLocaleString()} players · ${flatSeasons.length.toLocaleString()} player-seasons · ${databaseSeasonRange}${ARCHIVE_MODE?" · PRACTICE":""}`;
  document.getElementById("progress").textContent=`${count} / ${total} valid`;
  document.getElementById("penalty").textContent=`Penalties −${penalties}`;
  const revealButton=document.getElementById("reveal");
  revealButton.disabled=count!==total||!!completedRecord;
  revealButton.textContent=completedRecord?"Challenge completed":"Reveal my XI";
  const resetButton=document.getElementById("reset");
  if(resetButton){resetButton.disabled=!!completedRecord;resetButton.classList.toggle("attempt-locked",!!completedRecord);resetButton.textContent=completedRecord?"Result locked":"Reset team";}
  const dockProgress=document.getElementById("dockProgress");
  const dockPenalty=document.getElementById("dockPenalty");
  const dockBar=document.getElementById("dockProgressBar");
  const nextButton=document.getElementById("jumpToNext");
  if(dockProgress)dockProgress.textContent=`${count}/${total}`;
  if(dockPenalty)dockPenalty.textContent=`−${penalties}`;
  if(dockBar)dockBar.style.width=`${percent}%`;
  if(nextButton)nextButton.textContent=count===total?"Reveal completed XI":"Next open pick";
}
function topFive(prompt){return flatSeasons.filter(p=>qualifiesForAnswer(p)&&p.position===prompt.position&&prompt.test(p)).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name)).slice(0,5);}
function shirt(row,perfectMode=false){return `<div class="shirt ${row.exactMatch?"exact-match":""}"><div class="shirt-icon">${row.position}</div><strong>${esc(row.name)}</strong><span>${row.season} · ${row.points} pts</span></div>`;}
function pitchMarkup(rows,perfectMode=false){const by=pos=>rows.filter(r=>r.position===pos);return `<div class="pitch ${perfectMode?"perfect-pitch":"user-pitch"}"><div class="line">${by("FWD").map(r=>shirt(r,perfectMode)).join("")}</div><div class="line">${by("MID").map(r=>shirt(r,perfectMode)).join("")}</div><div class="line">${by("DEF").map(r=>shirt(r,perfectMode)).join("")}</div><div class="line">${by("GK").map(r=>shirt(r,perfectMode)).join("")}</div></div>`;}
function calculatePerfectXI(){
  const bestBySlot=challenge.prompts.map(prompt=>{const map=new Map();for(const record of flatSeasons){if(record.position!==prompt.position||!qualifiesForAnswer(record))continue;let valid=false;try{valid=prompt.test(record);}catch{}if(!valid)continue;const current=map.get(record.playerId);if(!current||record.points>current.points)map.set(record.playerId,record);}return map;});
  const playerIds=[...new Set(bestBySlot.flatMap(map=>[...map.keys()]))];if(playerIds.length<challenge.prompts.length)return null;
  const maximum=Math.max(0,...bestBySlot.flatMap(map=>[...map.values()].map(record=>record.points)));const forbidden=1000000;
  const costs=bestBySlot.map(map=>playerIds.map(id=>map.has(id)?maximum-map.get(id).points:forbidden));const assignment=hungarianAssignment(costs);if(!assignment)return null;
  const rows=assignment.map((column,index)=>bestBySlot[index].get(playerIds[column])||null);if(rows.some(row=>!row))return null;return {rows,score:rows.reduce((sum,row)=>sum+row.points,0)};
}
function hungarianAssignment(costs){const n=costs.length,m=costs[0]?.length||0;if(!n||m<n)return null;const u=new Float64Array(n+1),v=new Float64Array(m+1),p=new Int32Array(m+1),way=new Int32Array(m+1);for(let i=1;i<=n;i++){p[0]=i;let j0=0;const minv=new Float64Array(m+1);minv.fill(Infinity);const used=new Uint8Array(m+1);do{used[j0]=1;const i0=p[j0];let delta=Infinity,j1=0;for(let j=1;j<=m;j++)if(!used[j]){const cur=costs[i0-1][j-1]-u[i0]-v[j];if(cur<minv[j]){minv[j]=cur;way[j]=j0;}if(minv[j]<delta){delta=minv[j];j1=j;}}if(!Number.isFinite(delta))return null;for(let j=0;j<=m;j++){if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;}j0=j1;}while(p[j0]!==0);do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0!==0);}const answer=new Int32Array(n);answer.fill(-1);for(let j=1;j<=m;j++)if(p[j])answer[p[j]-1]=j-1;return [...answer];}
function reveal(restoring=false){
  if(!restoring&&completedRecord){renderCompletedResult(completedRecord,true);return;}
  if(!challenge.prompts.every(prompt=>picks[prompt.id]))return;
  ensureStarted();
  const rows=challenge.prompts.map(p=>getRecord(picks[p.id].playerId,picks[p.id].season));
  if(rows.some(row=>!row))return;
  const now=Date.now();
  completedSeconds=restoring&&completedRecord?Number(completedRecord.elapsedSeconds)||0:Math.max(0,Math.floor((now-startedAt)/1000));
  clearInterval(timerId);
  const points=rows.reduce((a,b)=>a+(Number(b.points)||0),0),score=points-penalties,eff=challenge.perfectScore>0?score/challenge.perfectScore*100:0;
  const grade=eff>=100?"Perfect":eff>=95?"A+":eff>=90?"A":eff>=82?"B":eff>=72?"C":"D";
  const boundedEfficiency=Math.max(0,Math.min(100,eff));
  const headline=eff>=100?"A perfect historical XI":eff>=95?"An elite draft-board performance":eff>=85?"A strong historical XI":eff>=70?"A competitive XI with room to climb":"A brave XI with points left available";
  const ring=document.getElementById("resultRing");
  if(ring)ring.style.setProperty("--result-progress",`${boundedEfficiency*3.6}deg`);
  document.getElementById("resultEfficiencyHero").textContent=`${eff.toFixed(1)}%`;
  document.getElementById("resultGradeHero").textContent=grade;
  document.getElementById("resultHeadline").textContent=headline;
  document.getElementById("resultSummary").textContent=`${points.toLocaleString()} player points, ${penalties?`${penalties} penalty points`:"no penalties"}, completed in ${formatTime(completedSeconds)}.`;
  if(!restoring)showCompletionMoment(grade,eff,score);
  const perfect=calculatePerfectXI();
  let exactMatches=0;
  if(perfect){
    const comparedUser=rows.map((row,index)=>({...row,exactMatch:perfect.rows[index].playerId===row.playerId&&perfect.rows[index].season===row.season}));
    const comparedPerfect=perfect.rows.map((row,index)=>({...row,exactMatch:rows[index].playerId===row.playerId&&rows[index].season===row.season}));
    exactMatches=comparedUser.filter(row=>row.exactMatch).length;
    document.getElementById("pitch").innerHTML=pitchMarkup(comparedUser,false);
    document.getElementById("perfectPitch").innerHTML=pitchMarkup(comparedPerfect,true);
    document.getElementById("perfectXiNote").textContent=`${exactMatches} of your 11 selections exactly match the perfect XI. Calculated total: ${perfect.score.toLocaleString()} points.`;
  }else{
    document.getElementById("pitch").innerHTML=pitchMarkup(rows,false);
    document.getElementById("perfectPitch").innerHTML='<p class="feedback bad">The perfect unique-player XI could not be calculated.</p>';
    document.getElementById("perfectXiNote").textContent='';
  }
  document.getElementById("playerPoints").textContent=points;document.getElementById("penaltyPoints").textContent=penalties?`−${penalties}`:"0";document.getElementById("finalScore").textContent=score;document.getElementById("perfectScore").textContent=challenge.perfectScore;document.getElementById("efficiency").textContent=`${eff.toFixed(1)}%`;document.getElementById("grade").textContent=grade;document.getElementById("timeTaken").textContent=formatTime(completedSeconds);
  const best=Math.max(Number(localStorage.getItem(BEST)||0),score);localStorage.setItem(BEST,best);document.getElementById("bestScore").textContent=best;
  document.getElementById("reviews").innerHTML=challenge.prompts.map((p,i)=>`<details class="review"><summary>${i+1}. ${p.position} · ${esc(p.label)}</summary><ol>${topFive(p).map(r=>`<li><strong>${esc(r.name)}</strong> — ${r.season} — ${r.points} pts <small>${esc(r.club)}</small></li>`).join("")}</ol></details>`).join("");
  if(!restoring){
    const promptEfficiencies=rows.map((row,index)=>pickEfficiencyDetails(row,challenge.prompts[index]));
    completedRecord={
      version:2,completed:true,official:!ARCHIVE_MODE,mode:ATTEMPT_MODE,challengeId:challenge.id,challengeNumber:Number(challenge.number)||null,challengeDate:challengeDate(),challengeTitle:challenge.title||"FPL Daily Challenge",
      startedAt,completedAt:now,elapsedSeconds:completedSeconds,penalties,playerPoints:points,finalScore:score,perfectScore:Number(challenge.perfectScore)||0,
      calculatedPerfectScore:perfect?.score??null,perfectScoreVerified:perfect?perfect.score===Number(challenge.perfectScore):null,efficiency:Number(eff.toFixed(4)),grade,perfectPromptPicks:promptEfficiencies.filter(item=>item.picked===item.best).length,exactPerfectXiMatches:exactMatches,
      picks:{...picks},selections:rows.map((row,index)=>({promptId:challenge.prompts[index].id,position:row.position,playerId:row.playerId,name:row.name,season:row.season,club:row.club,points:Number(row.points)||0,pickEfficiency:Number(promptEfficiencies[index].percentage.toFixed(4))}))
    };
    save();
    if(!ARCHIVE_MODE)upsertHistory(completedRecord);
    else renderLocalHistory();
    window.dispatchEvent(new CustomEvent("fpl:challenge-completed",{detail:{record:completedRecord}}));
  }
  document.getElementById("results").classList.remove("hidden");
  render();
  tick();
  if(!restoring)document.getElementById("results").scrollIntoView({behavior:"smooth"});
}
function renderCompletedResult(record,quiet=true){
  if(!record)return;
  completedRecord=record;
  completedSeconds=Number(record.elapsedSeconds)||0;
  reveal(true);
  renderLocalHistory();
  if(!quiet)document.getElementById("results")?.scrollIntoView({behavior:"smooth"});
}
function showCompletionMoment(grade,eff,score){
  const moment=document.getElementById("completionMoment");
  if(!moment)return;
  document.getElementById("completionMomentGrade").textContent=grade;
  document.getElementById("completionMomentScore").textContent=score.toLocaleString();
  document.getElementById("completionMomentEfficiency").textContent=`${eff.toFixed(1)}%`;
  moment.classList.remove("hidden");
  requestAnimationFrame(()=>moment.classList.add("show"));
  clearTimeout(showCompletionMoment.timer);
  showCompletionMoment.timer=setTimeout(()=>{
    moment.classList.remove("show");
    setTimeout(()=>moment.classList.add("hidden"),260);
  },1700);
}
function tick(){
  const runningElapsed=startedAt===null?0:Math.max(0,Math.floor((Date.now()-startedAt)/1000));
  const elapsed=completedSeconds??runningElapsed;
  const timer=document.getElementById("timer");
  if(timer){timer.textContent=startedAt===null&&!completedRecord?"Time 0:00 · starts on first interaction":`Time ${formatTime(elapsed)}`;timer.classList.toggle("timer-waiting",startedAt===null&&!completedRecord);}
  const dockTimer=document.getElementById("dockTimer");
  if(dockTimer)dockTimer.textContent=formatTime(elapsed);
}
document.getElementById("reveal").addEventListener("click",()=>reveal(false));
document.getElementById("jumpToNext").addEventListener("click",()=>{
  const openPrompt=challenge.prompts.find(prompt=>!picks[prompt.id]);
  if(!openPrompt){
    document.getElementById("reveal").scrollIntoView({behavior:"smooth",block:"center"});
    document.getElementById("reveal").focus();
    return;
  }
  const slot=document.getElementById(`slot-${openPrompt.id}`);
  slot?.scrollIntoView({behavior:"smooth",block:"center"});
  setTimeout(()=>slot?.querySelector(".player-search")?.focus(),350);
});
document.getElementById("reset").addEventListener("click",()=>{if(completedRecord)return;if(confirm(ARCHIVE_MODE?"Clear your practice XI? Your practice timer and any penalties will stay with this attempt.":"Clear your selected XI? Your official timer and any penalties will stay with this attempt.")){picks={};drafts={};feedback={};completedSeconds=null;document.getElementById("results").classList.add("hidden");save();render();tick();}});
document.getElementById("copy").addEventListener("click",async()=>{const text=`🏆 FPL Daily Challenge 4.5${ARCHIVE_MODE?" · Archive practice":""}\n${challenge.title}\n\nFinal score: ${document.getElementById("finalScore").textContent} / ${challenge.perfectScore}\nPenalties: ${document.getElementById("penaltyPoints").textContent}\nEfficiency: ${document.getElementById("efficiency").textContent}\nTime: ${document.getElementById("timeTaken").textContent}\n\nSpoiler-free result shared from FPL Draft Challenge.`;try{await navigator.clipboard.writeText(text);document.getElementById("copyStatus").textContent="Result copied.";}catch{document.getElementById("copyStatus").textContent=text;}});
document.addEventListener("click",e=>{if(!e.target.closest(".search-wrap"))document.querySelectorAll(".suggestions").forEach(x=>x.classList.add("hidden"));});
load();
if(ARCHIVE_MODE){
  const kicker=document.querySelector(".challenge-overview .overview-kicker");
  if(kicker)kicker.textContent="Archive practice challenge";
  const overview=document.querySelector(".challenge-overview .overview-copy p");
  if(overview)overview.textContent="This is a previous daily challenge. Practice attempts are saved on this device but do not change your official games played or streak.";
}
const validIds=new Set(groupedPlayers.map(p=>p.playerId));Object.keys(picks).forEach(id=>{const p=picks[id],prompt=challenge.prompts.find(x=>x.id===id),r=getRecord(p.playerId,p.season);if(!prompt||!validIds.has(p.playerId)||!r||!qualifiesForAnswer(r)||!prompt.test(r))delete picks[id];else drafts[id]={...p};});if(!(ARCHIVE_MODE&&completedRecord&&completedRecord.official!==false))save();render();renderLocalHistory();tick();
if(completedRecord){renderCompletedResult(completedRecord,true);}else{timerId=setInterval(tick,1000);}

