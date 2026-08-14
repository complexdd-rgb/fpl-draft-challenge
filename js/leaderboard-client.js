/* FPL Draft Challenge — Phase 5A.5 leaderboard UI + browser bridge.
   Production remains dormant while FPL_LEADERBOARD_CONFIG.enabled is false.
   Mock mode is available only to the offline BACKEND-SETUP test harness. */
(() => {
  "use strict";
  const cfg = window.FPL_LEADERBOARD_CONFIG;
  const challenge = window.FPL_DAILY_CHALLENGE;
  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  if (!cfg || !cfg.enabled || !challenge || runtime.archiveMode) return;

  const CLIENT_KEY = "fpl-v5-leaderboard-client-id";
  const NAME_KEY = "fpl-v5-leaderboard-display-name";
  const ATTEMPT_PREFIX = "fpl-v5-leaderboard-attempt-";
  const SUBMITTED_PREFIX = "fpl-v5-leaderboard-submitted-";
  const GAME_STORE = `fpl-v2-${challenge.id}`;
  const STATUS = Object.freeze({ IDLE:"idle", CONNECTING:"connecting", READY:"ready", VERIFYING:"verifying", ACCEPTED:"accepted", OFFLINE:"offline", ERROR:"error", DUPLICATE:"duplicate" });
  let requestQueue = Promise.resolve();
  let pendingCompletedRecord = null;
  let state = STATUS.CONNECTING;
  let lastRows = [];
  let refreshTimer = null;
  let leaderboardActivated = false;
  let activationObserver = null;
  window.FPL_LEADERBOARD_ACTIVE = false;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const readJson = key => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const writeJson = (key,value) => localStorage.setItem(key, JSON.stringify(value));
  const attemptKey = () => `${ATTEMPT_PREFIX}${challenge.id}`;
  const submittedKey = () => `${SUBMITTED_PREFIX}${challenge.id}`;
  const functionUrl = name => `${String(cfg.supabaseUrl || "").replace(/\/$/,"")}/functions/v1/${encodeURIComponent(name)}`;
  const formatTime = value => { const t=Math.max(0,Number(value)||0); return `${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`; };
  const validName = value => {
    const name=String(value||"").trim(),min=Number(cfg.displayNameMin)||2,max=Number(cfg.displayNameMax)||20;
    return name.length>=min&&name.length<=max&&/^[\p{L}\p{N} _.-]+$/u.test(name);
  };
  const getClientId = () => {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(CLIENT_KEY,id);
    }
    return id;
  };

  const mockApi = (() => {
    if (!cfg.mockMode) return null;
    const store = window.FPL_LEADERBOARD_MOCK || { entries:[], penaltyPoints:0, attempts:new Map() };
    window.FPL_LEADERBOARD_MOCK = store;
    return async (functionName, body) => {
      await new Promise(resolve => setTimeout(resolve, Number(store.delayMs)||120));
      if (store.forceOffline) throw new TypeError("Failed to fetch");
      if (store.forceError) throw new Error(store.forceError);
      if (functionName === cfg.functions.start) {
        const existing = [...store.attempts.values()].find(a=>a.clientId===body.clientId&&a.challengeId===body.challengeId);
        if (existing) return {attemptId:existing.attemptId,startedAt:existing.startedAt,alreadyCompleted:!!existing.completed};
        const attempt={attemptId:`mock-${Date.now()}`,clientId:body.clientId,challengeId:body.challengeId,startedAt:new Date().toISOString(),completed:false};
        store.attempts.set(attempt.attemptId,attempt); return attempt;
      }
      if (functionName === cfg.functions.pick) {
        if (store.rejectNextPick) { store.rejectNextPick=false; store.penaltyPoints += 10; return {valid:false,penaltyPoints:store.penaltyPoints}; }
        return {valid:true,penaltyPoints:store.penaltyPoints};
      }
      if (functionName === cfg.functions.finish) {
        const existing=store.entries.find(e=>e.clientId===body.clientId&&e.challengeId===body.challengeId);
        if(existing) return {...existing,alreadySubmitted:true};
        if(store.rejectFinish) throw new Error("Mock verifier rejected the final XI.");
        const score=Number(store.nextScore)||1768,perfect=Number(challenge.perfectScore)||1885,elapsed=Number(store.nextElapsed)||391,eff=perfect?score/perfect*100:0;
        const row={challengeId:body.challengeId,clientId:body.clientId,displayName:body.displayName,finalScore:score,efficiency:eff,elapsedSeconds:elapsed,penaltyPoints:Number(store.penaltyPoints)||0,playerPoints:score+(Number(store.penaltyPoints)||0),perfectScore:perfect,perfectPromptPicks:Number(store.perfectPromptPicks)||4};
        store.entries.push(row); store.entries.sort((a,b)=>b.finalScore-a.finalScore||a.elapsedSeconds-b.elapsedSeconds); row.rank=store.entries.indexOf(row)+1; return row;
      }
      if (functionName === cfg.functions.list) {
        const rows=store.entries.slice().sort((a,b)=>b.finalScore-a.finalScore||a.elapsedSeconds-b.elapsedSeconds);
        const viewer=rows.find(e=>e.clientId===body.clientId)||null;
        return {total:rows.length,entries:rows.slice(0,Number(body.limit)||20).map((row,index)=>({...row,rank:index+1,isCurrentDevice:row.clientId===body.clientId})),viewer:viewer?{...viewer,rank:rows.indexOf(viewer)+1}:null};
      }
      throw new Error(`Unknown mock function ${functionName}`);
    };
  })();

  async function api(functionName, body) {
    if (mockApi) return mockApi(functionName,body);
    if (!navigator.onLine) throw new TypeError("Offline");
    const response = await fetch(functionUrl(functionName), {
      method: "POST",
      headers: { "Content-Type":"application/json", "apikey": cfg.publishableKey },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(data?.message || data?.error || `Leaderboard request failed (${response.status})`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data || {};
  }

  function addStyles(){
    if(document.getElementById("leaderboardV55Styles"))return;
    const style=document.createElement("style"); style.id="leaderboardV55Styles";
    style.textContent=`
      .leaderboard-panel{margin:18px 0;padding:18px;border:1px solid rgba(0,255,135,.16);border-radius:26px;background:linear-gradient(145deg,rgba(8,34,23,.98),rgba(7,21,17,.98));box-shadow:0 16px 34px rgba(0,0,0,.18)}
      .leaderboard-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}.leaderboard-head h2{margin:4px 0 4px}.leaderboard-head p{margin:0;color:var(--muted);font-size:.76rem;line-height:1.45}
      .leaderboard-state{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border-radius:999px;background:rgba(0,255,135,.08);border:1px solid rgba(0,255,135,.2);color:var(--accent);font-size:.62rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.leaderboard-state::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 12px currentColor}.leaderboard-state[data-state="offline"],.leaderboard-state[data-state="error"]{color:#ff91a7;border-color:rgba(255,85,119,.25);background:rgba(255,85,119,.07)}.leaderboard-state[data-state="verifying"]{color:#64e9ff;border-color:rgba(95,229,255,.24);background:rgba(95,229,255,.07)}.leaderboard-state[data-state="accepted"],.leaderboard-state[data-state="duplicate"]{color:#ffd166;border-color:rgba(255,209,102,.25);background:rgba(255,209,102,.07)}
      .leaderboard-toolbar{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:14px 0}.leaderboard-refresh{border:1px solid rgba(255,255,255,.11);border-radius:11px;background:rgba(255,255,255,.04);color:#fff;padding:8px 11px;font:inherit;font-size:.68rem;font-weight:900;cursor:pointer}.leaderboard-refresh:disabled{opacity:.5;cursor:default}
      .leaderboard-submit-card{margin:14px 0;padding:13px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}.leaderboard-submit-card label{display:block;margin-bottom:7px;color:#dcece3;font-size:.7rem;font-weight:900}.leaderboard-submit-card small{display:block;margin-top:7px;color:var(--muted);font-size:.65rem;line-height:1.4}.leaderboard-name-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:9px}.leaderboard-name-row input{min-width:0}.leaderboard-edit-name{border:1px solid rgba(255,255,255,.1);background:#153324;color:#fff;border-radius:11px;padding:0 11px;font:inherit;font-size:.68rem;font-weight:900;cursor:pointer}
      .leaderboard-personal{margin:12px 0;padding:14px;border-radius:18px;background:linear-gradient(130deg,rgba(95,229,255,.08),rgba(0,255,135,.06));border:1px solid rgba(95,229,255,.18)}.leaderboard-personal.hidden{display:none}.leaderboard-personal-grid{display:grid;grid-template-columns:auto repeat(4,minmax(0,1fr));gap:12px;align-items:center}.leaderboard-rank-orb{width:72px;height:72px;border-radius:22px;display:grid;place-items:center;text-align:center;background:rgba(0,255,135,.09);border:1px solid rgba(0,255,135,.22)}.leaderboard-rank-orb strong{font-size:1.4rem;color:var(--accent)}.leaderboard-rank-orb span{font-size:.56rem;color:var(--muted);font-weight:900;text-transform:uppercase}.leaderboard-personal-stat span,.leaderboard-personal-stat strong{display:block}.leaderboard-personal-stat span{font-size:.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:900}.leaderboard-personal-stat strong{margin-top:3px;font-size:.9rem;color:#fff}
      .leaderboard-podium{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}.leaderboard-podium-card{padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035)}.leaderboard-podium-card strong,.leaderboard-podium-card span,.leaderboard-podium-card small{display:block}.leaderboard-podium-card span{font-size:.59rem;color:#ffd166;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.leaderboard-podium-card strong{margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.leaderboard-podium-card small{margin-top:4px;color:var(--muted);font-size:.66rem}.leaderboard-podium-empty{opacity:.55}
      .leaderboard-table-wrap{overflow-x:auto;border:1px solid rgba(255,255,255,.07);border-radius:16px}.leaderboard-table{width:100%;border-collapse:collapse;font-size:.76rem}.leaderboard-table th,.leaderboard-table td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.07);text-align:left;white-space:nowrap}.leaderboard-table tr:last-child td{border-bottom:0}.leaderboard-table th{color:var(--muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.06em}.leaderboard-table td:nth-child(1){color:var(--accent);font-weight:900}.leaderboard-row-me{background:rgba(0,255,135,.055)}.leaderboard-empty{padding:20px!important;text-align:center!important;color:var(--muted)}
      .leaderboard-skeleton{height:12px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.11),rgba(255,255,255,.04));background-size:220% 100%;animation:lbShimmer 1.2s linear infinite}@keyframes lbShimmer{to{background-position:-220% 0}}
      .leaderboard-message{margin:10px 0;padding:10px 12px;border-radius:13px;font-size:.7rem;line-height:1.45}.leaderboard-message.error{background:rgba(255,85,119,.07);border:1px solid rgba(255,85,119,.2);color:#ffc0ce}.leaderboard-message.info{background:rgba(95,229,255,.06);border:1px solid rgba(95,229,255,.16);color:#c9f5ff}.leaderboard-message.hidden{display:none}
      @media(max-width:720px){.leaderboard-personal-grid{grid-template-columns:auto 1fr 1fr}.leaderboard-personal-stat:nth-child(n+4){grid-column:auto}.leaderboard-name-row{grid-template-columns:1fr auto}.leaderboard-name-row .btn{grid-column:1/-1}.leaderboard-podium{grid-template-columns:1fr}.leaderboard-podium-card{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center}.leaderboard-podium-card strong,.leaderboard-podium-card small{margin:0}}
      @media(max-width:480px){.leaderboard-personal-grid{grid-template-columns:1fr 1fr}.leaderboard-rank-orb{grid-column:1/-1;width:100%;height:auto;min-height:62px}.leaderboard-name-row{grid-template-columns:1fr}.leaderboard-edit-name{min-height:42px}}
    `; document.head.appendChild(style);
  }

  function renderShell(){
    if(document.getElementById("liveLeaderboardPanel"))return;
    addStyles();
    const shell=document.createElement("section"); shell.id="liveLeaderboardPanel"; shell.className="leaderboard-panel";
    shell.innerHTML=`
      <div class="leaderboard-head"><div><span class="overview-kicker">Verified daily competition</span><h2>Today’s Top 20</h2><p id="leaderboardStatus">Preparing the leaderboard…</p></div><span class="leaderboard-state" id="leaderboardState" data-state="connecting">Connecting</span></div>
      <div class="leaderboard-toolbar"><span class="overview-kicker" id="leaderboardCount">0 verified finishes</span><button class="leaderboard-refresh" id="leaderboardRefresh" type="button">Refresh</button></div>
      <div class="leaderboard-submit-card" id="leaderboardSubmitCard"><label for="leaderboardDisplayName">Leaderboard display name</label><div class="leaderboard-name-row"><input id="leaderboardDisplayName" maxlength="${Number(cfg.displayNameMax)||20}" autocomplete="nickname" placeholder="Your leaderboard name"><button class="leaderboard-edit-name" id="leaderboardEditName" type="button">Edit</button><button class="btn primary" id="leaderboardSubmitResult" type="button" disabled>Submit verified result</button></div><small id="leaderboardNameHelp">2–20 letters, numbers, spaces, underscores, dots or hyphens. Your final score is recalculated on the server; archive practice is never submitted.</small></div>
      <div class="leaderboard-message hidden" id="leaderboardMessage" role="status"></div>
      <div class="leaderboard-personal hidden" id="leaderboardPersonal"></div>
      <div class="leaderboard-podium" id="leaderboardPodium"></div>
      <div class="leaderboard-table-wrap"><table class="leaderboard-table"><thead><tr><th>#</th><th>Player</th><th>Score</th><th>Efficiency</th><th>Time</th><th>Pen.</th></tr></thead><tbody id="leaderboardRows"></tbody></table></div>`;
    const anchor=document.getElementById("phase45Shell")||document.getElementById("localHistory")||document.querySelector("main");
    if(anchor?.parentNode)anchor.insertAdjacentElement("afterend",shell); else document.querySelector("main")?.appendChild(shell);

    const input=document.getElementById("leaderboardDisplayName"); input.value=localStorage.getItem(NAME_KEY)||""; if(validName(input.value))input.disabled=true;
    input.addEventListener("input",()=>{localStorage.setItem(NAME_KEY,input.value.trim());renderNameState();updateSubmitButton();});
    document.getElementById("leaderboardEditName")?.addEventListener("click",()=>{input.disabled=false;input.focus();input.select();});
    document.getElementById("leaderboardSubmitResult")?.addEventListener("click",()=>submitPendingResult());
    document.getElementById("leaderboardRefresh")?.addEventListener("click",()=>{if(!leaderboardActivated)activateLeaderboard();else loadLeaderboard({manual:true});});
    renderDeferredState();
    enhanceMobileNav();
  }

  function enhanceMobileNav(){
    const nav=document.getElementById("phase45BottomNav"); if(!nav||nav.querySelector('[data-jump="leaderboard"]'))return;
    nav.style.gridTemplateColumns="repeat(5,minmax(0,1fr))";
    const button=document.createElement("button"); button.type="button"; button.dataset.jump="leaderboard"; button.innerHTML="<span>🏅</span>Ranks";
    button.addEventListener("click",()=>document.getElementById("liveLeaderboardPanel")?.scrollIntoView({behavior:"smooth",block:"start"})); nav.appendChild(button);
  }

  function setState(next,label){state=next;const badge=document.getElementById("leaderboardState");if(badge){badge.dataset.state=next;badge.textContent=label||({connecting:"Connecting",ready:"Live",verifying:"Verifying",accepted:"Accepted",offline:"Offline",error:"Problem",duplicate:"Already in"}[next]||next);}}
  function setStatus(text){const el=document.getElementById("leaderboardStatus");if(el)el.textContent=text;}
  function setMessage(text,type="info"){const el=document.getElementById("leaderboardMessage");if(!el)return;el.textContent=text||"";el.className=`leaderboard-message ${text?type:"hidden"}`;}
  function renderNameState(){const input=document.getElementById("leaderboardDisplayName"),help=document.getElementById("leaderboardNameHelp");if(!input||!help)return;const name=input.value.trim();if(!name){help.textContent="Choose the name that will appear next to your daily result.";return;}help.textContent=validName(name)?"Name ready. It is saved only in this browser for now.":"Use 2–20 letters, numbers, spaces, underscores, dots or hyphens.";}
  function renderSkeleton(){const body=document.getElementById("leaderboardRows");if(!body)return;body.innerHTML=Array.from({length:5},()=>'<tr><td colspan="6"><div class="leaderboard-skeleton"></div></td></tr>').join("");}
  function renderDeferredState(){const body=document.getElementById("leaderboardRows");if(!body)return;body.innerHTML='<tr><td class="leaderboard-empty" colspan="6">Standings load automatically when you reach this section.</td></tr>';}

  function recoverCompletedRecord(){
    const saved=readJson(GAME_STORE); const record=saved?.completedRecord;
    if(record&&record.completed===true&&record.official!==false&&record.challengeId===challenge.id)pendingCompletedRecord=record;
  }

  function updateSubmitButton(){
    const button=document.getElementById("leaderboardSubmitResult"),input=document.getElementById("leaderboardDisplayName"); if(!button||!input)return;
    const attempt=readJson(attemptKey()),submitted=readJson(submittedKey());
    button.disabled=!pendingCompletedRecord||!attempt?.attemptId||!!submitted||!validName(input.value)||state===STATUS.VERIFYING||state===STATUS.OFFLINE;
    if(submitted)button.textContent="Result submitted";else if(state===STATUS.VERIFYING)button.textContent="Verifying…";else button.textContent="Submit verified result";
  }

  function queue(task){requestQueue=requestQueue.then(task,task).catch(handleError);return requestQueue;}
  function handleError(error){
    const offline=!navigator.onLine||error instanceof TypeError||/offline|failed to fetch|network/i.test(String(error?.message||""));
    setState(offline?STATUS.OFFLINE:STATUS.ERROR); setStatus(offline?"Leaderboard is offline. Your game result is still safe on this device.":"Leaderboard submission needs attention.");
    setMessage(offline?"No internet connection. Reconnect and press Refresh or Submit again.":(error?.message||"Leaderboard request failed."),"error"); updateSubmitButton();
  }

  async function ensureServerAttempt(){
    const existing=readJson(attemptKey()); if(existing?.attemptId)return existing;
    setState(STATUS.CONNECTING); setStatus("Starting a server-timed leaderboard attempt…");
    const data=await api(cfg.functions.start,{challengeId:challenge.id,challengeDate:challenge.releaseDate||runtime.selectedDate,clientId:getClientId()});
    const attempt={attemptId:data.attemptId,serverStartedAt:data.startedAt}; writeJson(attemptKey(),attempt);
    if(data.alreadyCompleted){setState(STATUS.DUPLICATE);setStatus("This browser already has a verified result for today.");}else{setState(STATUS.READY);setStatus("Verified attempt active · server timing is running.");}
    updateSubmitButton(); return attempt;
  }

  function onAttemptStarted(){queue(async()=>{await ensureServerAttempt();});}
  function onPickAttempt(event){
    const detail=event.detail||{}; queue(async()=>{const attempt=await ensureServerAttempt();if(!attempt?.attemptId)return;const result=await api(cfg.functions.pick,{attemptId:attempt.attemptId,challengeId:challenge.id,clientId:getClientId(),promptId:detail.promptId,playerId:detail.playerId,season:detail.season});setState(STATUS.READY);if(result.valid===false){setStatus(`Server rejected that pick · penalties now ${Number(result.penaltyPoints)||0}`);setMessage("That invalid attempt has been recorded by the leaderboard verifier.","info");}else{setStatus(`Verified attempt active · server penalties ${Number(result.penaltyPoints)||0}`);setMessage("");}});
  }

  function onCompleted(event){const record=event.detail?.record;if(!record||record.official===false||runtime.archiveMode)return;pendingCompletedRecord=record;activateLeaderboard();setState(STATUS.READY);setStatus("XI complete · ready for server verification.");setMessage("Enter or confirm your display name, then submit the result.","info");updateSubmitButton();}

  async function submitPendingResult(){
    if(!pendingCompletedRecord)return; const saved=readJson(submittedKey()); if(saved){showPersonal(saved);setState(STATUS.DUPLICATE);return;}
    const input=document.getElementById("leaderboardDisplayName"),displayName=(input?.value||"").trim(); if(!validName(displayName)){setMessage("Please enter a valid display name before submitting.","error");return;}
    localStorage.setItem(NAME_KEY,displayName); setState(STATUS.VERIFYING); setStatus("Verifying XI, penalties, score and completion time on the server…"); setMessage("Your browser score is not trusted; the backend is recalculating the result.","info");updateSubmitButton();
    await queue(async()=>{
      const attempt=await ensureServerAttempt(); setState(STATUS.VERIFYING); setStatus("Verifying XI, penalties, score and completion time on the server…"); const selections=(pendingCompletedRecord.selections||[]).map(item=>({promptId:item.promptId,playerId:item.playerId,season:item.season}));
      const result=await api(cfg.functions.finish,{attemptId:attempt.attemptId,challengeId:challenge.id,clientId:getClientId(),displayName,selections}); writeJson(submittedKey(),result);
      setState(result.alreadySubmitted?STATUS.DUPLICATE:STATUS.ACCEPTED,result.alreadySubmitted?"Already in":"Accepted"); setStatus(result.alreadySubmitted?"Your existing verified result has been restored.":`Verified result accepted · rank #${Number(result.rank)||"–"}.`); setMessage(result.alreadySubmitted?"One official result per browser/device is allowed for each challenge.":"Server verification complete. Your leaderboard place is locked for this challenge.","info");showPersonal(result);updateSubmitButton();await loadLeaderboard();
    });
  }

  function showPersonal(result){
    const el=document.getElementById("leaderboardPersonal");if(!el||!result)return;el.classList.remove("hidden");
    el.innerHTML=`<div class="leaderboard-personal-grid"><div class="leaderboard-rank-orb"><div><strong>#${Number(result.rank)||"–"}</strong><span>Your rank</span></div></div><div class="leaderboard-personal-stat"><span>Score</span><strong>${Number(result.finalScore||0).toLocaleString()}</strong></div><div class="leaderboard-personal-stat"><span>Efficiency</span><strong>${Number(result.efficiency||0).toFixed(1)}%</strong></div><div class="leaderboard-personal-stat"><span>Time</span><strong>${formatTime(result.elapsedSeconds)}</strong></div><div class="leaderboard-personal-stat"><span>Penalties</span><strong>${Number(result.penaltyPoints||0)}</strong></div></div>`;
  }

  function renderPodium(rows){
    const el=document.getElementById("leaderboardPodium");if(!el)return; const medals=["🥇","🥈","🥉"];
    el.innerHTML=Array.from({length:3},(_,i)=>{const row=rows[i];return row?`<article class="leaderboard-podium-card ${row.isCurrentDevice?"leaderboard-row-me":""}"><span>${medals[i]} #${i+1}</span><strong>${esc(row.displayName||"Player")}</strong><small>${Number(row.finalScore||0).toLocaleString()} pts · ${Number(row.efficiency||0).toFixed(1)}%</small></article>`:`<article class="leaderboard-podium-card leaderboard-podium-empty"><span>${medals[i]} #${i+1}</span><strong>Open</strong><small>Waiting for a verified finish</small></article>`;}).join("");
  }

  function renderRows(rows){
    const body=document.getElementById("leaderboardRows");if(!body)return;
    body.innerHTML=rows.length?rows.map(row=>`<tr class="${row.isCurrentDevice?"leaderboard-row-me":""}"><td>${Number(row.rank)||"–"}</td><td>${esc(row.displayName||"Player")}${row.isCurrentDevice?' <small>(you)</small>':""}</td><td>${Number(row.finalScore||0).toLocaleString()}</td><td>${Number(row.efficiency||0).toFixed(1)}%</td><td>${formatTime(row.elapsedSeconds)}</td><td>${Number(row.penaltyPoints||0)}</td></tr>`).join(""):'<tr><td class="leaderboard-empty" colspan="6">No verified finishes yet today. The first accepted result will take #1.</td></tr>';
  }

  async function loadLeaderboard(options={}){
    const button=document.getElementById("leaderboardRefresh");if(button)button.disabled=true;if(!lastRows.length)renderSkeleton();
    try{
      const data=await api(cfg.functions.list,{challengeId:challenge.id,limit:Number(cfg.topLimit)||20,clientId:getClientId()}); const rows=Array.isArray(data.entries)?data.entries:[];lastRows=rows;renderRows(rows);renderPodium(rows);
      const count=Number(data.total)||rows.length;const countEl=document.getElementById("leaderboardCount");if(countEl)countEl.textContent=`${count.toLocaleString()} verified finish${count===1?"":"es"}`;
      if(data.viewer){showPersonal(data.viewer);writeJson(submittedKey(),data.viewer);setState(STATUS.ACCEPTED);setStatus(`You are #${Number(data.viewer.rank)||"–"} of ${count.toLocaleString()} verified finish${count===1?"":"es"}.`);}else if(state!==STATUS.VERIFYING){setState(STATUS.READY);setStatus(count?`${count.toLocaleString()} verified finishes today.`:"Leaderboard ready · no verified finishes yet today.");}
      setMessage("");updateSubmitButton();const detail={challengeId:challenge.id,total:count,entries:rows,viewer:data.viewer||null};window.FPL_LEADERBOARD_LAST_UPDATE=detail;window.dispatchEvent(new CustomEvent("fpl:leaderboard-updated",{detail}));
    }catch(error){handleError(error);}finally{if(button)button.disabled=false;}
  }

  function startRefreshLoop(){clearInterval(refreshTimer);const seconds=Math.max(15,Number(cfg.refreshSeconds)||60);refreshTimer=setInterval(()=>{if(leaderboardActivated&&document.visibilityState==="visible"&&navigator.onLine)loadLeaderboard();},seconds*1000);}
  function activateLeaderboard(){
    if(leaderboardActivated)return;
    leaderboardActivated=true;window.FPL_LEADERBOARD_ACTIVE=true;activationObserver?.disconnect();
    setState(STATUS.CONNECTING);setStatus("Loading today’s verified standings…");renderSkeleton();loadLeaderboard({manual:true});startRefreshLoop();
    window.dispatchEvent(new CustomEvent("fpl:leaderboard-visible"));
  }
  function installLazyActivation(){
    const panel=document.getElementById("liveLeaderboardPanel");if(!panel)return;
    if(!("IntersectionObserver" in window)){setTimeout(activateLeaderboard,1200);return;}
    activationObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))activateLeaderboard();},{rootMargin:"650px 0px"});
    activationObserver.observe(panel);
  }
  function networkChanged(){if(navigator.onLine){if(leaderboardActivated){setState(STATUS.CONNECTING);setStatus("Connection restored · refreshing leaderboard…");loadLeaderboard({manual:true});}else{setState(STATUS.READY,"Standby");setStatus("Leaderboard ready when you reach this section.");}}else handleError(new TypeError("Offline"));}

  renderShell(); recoverCompletedRecord(); renderNameState();
  window.addEventListener("fpl:attempt-started",onAttemptStarted); window.addEventListener("fpl:pick-attempt",onPickAttempt); window.addEventListener("fpl:challenge-completed",onCompleted); window.addEventListener("online",networkChanged); window.addEventListener("offline",networkChanged);
  window.FPL_LEADERBOARD_REFRESH=()=>{if(leaderboardActivated)loadLeaderboard({manual:true});};
  window.FPL_LEADERBOARD_ACTIVATE=activateLeaderboard;
  const saved=readJson(submittedKey());if(saved)showPersonal(saved);updateSubmitButton();installLazyActivation();
  if(pendingCompletedRecord||saved){requestAnimationFrame(()=>setTimeout(activateLeaderboard,120));}else{setState(STATUS.READY,"Standby");setStatus("Leaderboard loads when you reach this section.");}
})();
