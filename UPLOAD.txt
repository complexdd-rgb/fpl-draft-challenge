/* Core FPL Daily Challenge game engine. */
"use strict";
const challenge = window.FPL_DAILY_CHALLENGE ||
  (Array.isArray(window.FPL_CHALLENGES)
    ? window.FPL_CHALLENGES[window.FPL_CHALLENGES.length - 1]
    : null);

if (!challenge) {
  const status = document.getElementById("dbStatus");
  if (status) status.textContent = "Challenge failed to load";
  throw new Error("No FPL daily challenge was loaded.");
}
const groupedPlayers = window.FPL_PLAYERS || [];
const flatSeasons = groupedPlayers.flatMap(player => player.seasons.map(season => ({...season,playerId:player.playerId,name:player.name})));
const INVALID_PENALTY = 10;
const STORE = `fpl-v2-${challenge.id}`;
const BEST = `fpl-v2-${challenge.id}-best`;
let picks = {};
let drafts = {};
let feedback = {};
let penalties = 0;
let startedAt = Date.now();
let completedSeconds = null;
let timerId;
let active = {};

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalise=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const formatTime=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,"0")}`;
const getPlayer=id=>groupedPlayers.find(p=>p.playerId===id);
const getRecord=(playerId,season)=>flatSeasons.find(p=>p.playerId===playerId&&p.season===season);
const usedPlayerIds=()=>new Set(Object.values(picks).map(p=>p.playerId));

function save(){localStorage.setItem(STORE,JSON.stringify({picks,penalties}));}
function load(){try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");picks=x.picks||{};penalties=Number(x.penalties)||0;}catch{}}

function eligibleSeasons(player,prompt){
  return player.seasons.filter(s=>s.position===prompt.position);
}
function render(){
  document.getElementById("title").textContent=`FPL Daily Challenge 4.0 · ${challenge.title}`;
  document.getElementById("grid").innerHTML=challenge.prompts.map((prompt,index)=>{
    const saved=picks[prompt.id];
    const draft=drafts[prompt.id] || (saved ? {playerId:saved.playerId,season:saved.season}:null);
    const player=draft?getPlayer(draft.playerId):null;
    const seasons=player?eligibleSeasons(player,prompt):[];
    const record=draft?getRecord(draft.playerId,draft.season):null;
    const fb=feedback[prompt.id]||"";
    return `<article class="slot ${saved?"valid":""}" data-position="${prompt.position}" id="slot-${prompt.id}">
      <div class="slot-head"><span class="pos">${prompt.position}</span><div><div class="prompt">${index+1}. ${esc(prompt.label)}</div></div></div>
      <div class="choice-row">
        <div class="search-wrap">
          <input class="player-search" data-id="${prompt.id}" value="${player?esc(player.name):""}" placeholder="Search ${prompt.position}..." autocomplete="off">
          <div class="suggestions hidden" id="s-${prompt.id}"></div>
        </div>
        <select class="season-select" data-season="${prompt.id}" ${player?"":"disabled"}>
          ${player?seasons.map(s=>`<option value="${s.season}" ${s.season===draft.season?"selected":""}>${s.season}</option>`).join(""):`<option>Season</option>`}
        </select>
        <button class="confirm" data-confirm="${prompt.id}" ${record?"":"disabled"}>${saved?"Confirmed":"Confirm"}</button>
      </div>
      ${record?`<div class="selected-meta">${esc(record.club)} · ${record.position} · £${record.startingPrice.toFixed(1)}m starting price</div>`:""}
      <div class="feedback ${fb.startsWith("✅")?"good":fb.startsWith("❌")?"bad":""}">${esc(fb)}</div>
      ${player?`<button class="clear" data-clear="${prompt.id}">Clear selection</button>`:""}
    </article>`;
  }).join("");
  bind();
  updateStatus();
}
function bind(){
  document.querySelectorAll(".player-search").forEach(input=>{
    input.addEventListener("input",onSearch);
    input.addEventListener("keydown",onKeys);
    input.addEventListener("focus",onSearch);
  });
  document.querySelectorAll("[data-season]").forEach(select=>select.addEventListener("change",e=>{
    const id=e.target.dataset.season;if(drafts[id]) drafts[id].season=e.target.value;render();
  }));
  document.querySelectorAll("[data-confirm]").forEach(b=>b.addEventListener("click",()=>confirmPick(b.dataset.confirm)));
  document.querySelectorAll("[data-clear]").forEach(b=>b.addEventListener("click",()=>{delete drafts[b.dataset.clear];delete picks[b.dataset.clear];feedback[b.dataset.clear]="";save();render();}));
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
  if(usedPlayerIds().has(playerId)){feedback[id]="That footballer has already been used — no penalty.";render();return;}
  const prompt=challenge.prompts.find(p=>p.id===id),player=getPlayer(playerId);
  const seasons=eligibleSeasons(player,prompt);
  drafts[id]={playerId,season:seasons[0].season};
  delete picks[id];feedback[id]="Choose a season, then confirm.";render();
}
function confirmPick(id){
  const prompt=challenge.prompts.find(p=>p.id===id),draft=drafts[id];
  if(!draft)return;
  const duplicate=Object.entries(picks).some(([key,p])=>key!==id&&p.playerId===draft.playerId);
  if(duplicate){feedback[id]="That footballer has already been used — no penalty.";render();return;}
  const record=getRecord(draft.playerId,draft.season);
  if(!record)return;
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
  document.getElementById("dbStatus").textContent=`${groupedPlayers.length.toLocaleString()} players · ${flatSeasons.length.toLocaleString()} player-seasons · 2016/17–2025/26`;
  document.getElementById("progress").textContent=`${count} / ${challenge.prompts.length} valid`;
  document.getElementById("penalty").textContent=`Penalties −${penalties}`;
  document.getElementById("reveal").disabled=count!==challenge.prompts.length;
}
function topFive(prompt){return flatSeasons.filter(p=>p.position===prompt.position&&prompt.test(p)).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name)).slice(0,5);}
function shirt(row){return `<div class="shirt"><div class="shirt-icon">${row.position}</div><strong>${esc(row.name)}</strong><span>${row.season} · ${row.points} pts</span></div>`;}
function reveal(){
  const rows=challenge.prompts.map(p=>getRecord(picks[p.id].playerId,picks[p.id].season));
  completedSeconds=Math.floor((Date.now()-startedAt)/1000);clearInterval(timerId);
  const points=rows.reduce((a,b)=>a+b.points,0),score=points-penalties,eff=score/challenge.perfectScore*100;
  const grade=eff>=100?"Perfect":eff>=95?"A+":eff>=90?"A":eff>=82?"B":eff>=72?"C":"D";
  const by=pos=>rows.filter(r=>r.position===pos);
  document.getElementById("pitch").innerHTML=`<div class="pitch"><div class="line">${by("FWD").map(shirt).join("")}</div><div class="line">${by("MID").map(shirt).join("")}</div><div class="line">${by("DEF").map(shirt).join("")}</div><div class="line">${by("GK").map(shirt).join("")}</div></div>`;
  document.getElementById("playerPoints").textContent=points;document.getElementById("penaltyPoints").textContent=penalties?`−${penalties}`:"0";document.getElementById("finalScore").textContent=score;document.getElementById("perfectScore").textContent=challenge.perfectScore;document.getElementById("efficiency").textContent=`${eff.toFixed(1)}%`;document.getElementById("grade").textContent=grade;document.getElementById("timeTaken").textContent=formatTime(completedSeconds);
  const best=Math.max(Number(localStorage.getItem(BEST)||0),score);localStorage.setItem(BEST,best);document.getElementById("bestScore").textContent=best;
  document.getElementById("reviews").innerHTML=challenge.prompts.map((p,i)=>`<details class="review"><summary>${i+1}. ${p.position} · ${esc(p.label)}</summary><ol>${topFive(p).map(r=>`<li><strong>${esc(r.name)}</strong> — ${r.season} — ${r.points} pts <small>${esc(r.club)}</small></li>`).join("")}</ol></details>`).join("");
  document.getElementById("results").classList.remove("hidden");document.getElementById("results").scrollIntoView({behavior:"smooth"});
}
function tick(){document.getElementById("timer").textContent=`Time ${formatTime(completedSeconds??Math.floor((Date.now()-startedAt)/1000))}`;}
document.getElementById("reveal").addEventListener("click",reveal);
document.getElementById("reset").addEventListener("click",()=>{if(confirm("Clear the whole XI and all penalties?")){picks={};drafts={};feedback={};penalties=0;startedAt=Date.now();completedSeconds=null;document.getElementById("results").classList.add("hidden");save();render();}});
document.getElementById("copy").addEventListener("click",async()=>{const text=`🏆 FPL Daily Challenge 4.0\n${challenge.title}\n\nFinal score: ${document.getElementById("finalScore").textContent} / ${challenge.perfectScore}\nPenalties: ${document.getElementById("penaltyPoints").textContent}\nEfficiency: ${document.getElementById("efficiency").textContent}\nTime: ${document.getElementById("timeTaken").textContent}\n\nCan you beat me?`;try{await navigator.clipboard.writeText(text);document.getElementById("copyStatus").textContent="Result copied.";}catch{document.getElementById("copyStatus").textContent=text;}});
document.addEventListener("click",e=>{if(!e.target.closest(".search-wrap"))document.querySelectorAll(".suggestions").forEach(x=>x.classList.add("hidden"));});
load();
const validIds=new Set(groupedPlayers.map(p=>p.playerId));Object.keys(picks).forEach(id=>{const p=picks[id],prompt=challenge.prompts.find(x=>x.id===id),r=getRecord(p.playerId,p.season);if(!prompt||!validIds.has(p.playerId)||!r||!prompt.test(r))delete picks[id];else drafts[id]={...p};});save();render();tick();timerId=setInterval(tick,1000);
