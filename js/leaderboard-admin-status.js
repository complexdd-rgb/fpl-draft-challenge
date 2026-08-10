/* FPL Draft Challenge — Phase 5A.5 Studio leaderboard deployment checker. */
(() => {
  "use strict";
  const cfg=window.FPL_LEADERBOARD_CONFIG||{};
  const mount=document.getElementById("leaderboardBackendStatus");
  const chip=document.getElementById("leaderboardBackendChip");
  if(!mount)return;
  const functionNames=[cfg.functions?.start,cfg.functions?.pick,cfg.functions?.finish,cfg.functions?.list].filter(Boolean);
  const urlOk=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(cfg.supabaseUrl||""))&&!/YOUR_PROJECT_REF/i.test(String(cfg.supabaseUrl||""));
  const key=String(cfg.publishableKey||"");
  const keyOk=/^sb_publishable_[A-Za-z0-9._-]+$/.test(key)&&!/REPLACE_ME/i.test(key);
  const dangerous=/service_role|sb_secret_/i.test(key);
  const functionsOk=functionNames.length===4&&new Set(functionNames).size===4;
  const configured=urlOk&&keyOk&&functionsOk&&!dangerous;
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  if(chip){chip.textContent=cfg.enabled?(configured?"Enabled":"Fix config"):(configured?"Ready to enable":"Not configured");chip.classList.toggle("ready-chip",configured);}
  const checks=[
    ["Project URL",urlOk,urlOk?cfg.supabaseUrl:"Replace YOUR_PROJECT_REF with the Supabase Project URL."],
    ["Publishable key",keyOk&&!dangerous,dangerous?"A secret/service-role key must never be in browser files.":keyOk?"Browser-safe publishable key detected.":"Paste the sb_publishable_… key."],
    ["Edge Function names",functionsOk,functionsOk?functionNames.join(", "):"Four unique function names are required."],
    ["Live switch",cfg.enabled===true,cfg.enabled?"Leaderboard is enabled in the browser.":"Keep disabled until Phase 5B is deployed and tested."],
    ["Realtime hook",cfg.realtimeReady===true,cfg.realtimeReady?"Frontend refresh hook is ready for a future Realtime subscription.":"Optional; polling still works."]
  ];
  const style=document.createElement("style");style.textContent=`.leaderboard-health-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.leaderboard-health-item{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025)}.leaderboard-health-item strong,.leaderboard-health-item span,.leaderboard-health-item small{display:block}.leaderboard-health-item span{font-size:.66rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:var(--stage-muted,#9bb7a8)}.leaderboard-health-item strong{margin:5px 0 3px}.leaderboard-health-item small{color:var(--stage-muted,#9bb7a8);line-height:1.4}.leaderboard-health-item.good strong{color:var(--stage-green,#39e88f)}.leaderboard-health-item.bad strong{color:var(--stage-amber,#ffd477)}.leaderboard-health-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.leaderboard-health-message{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(98,201,255,.06);border:1px solid rgba(98,201,255,.15);font-size:.72rem;color:var(--stage-muted,#9bb7a8)}@media(max-width:700px){.leaderboard-health-grid{grid-template-columns:1fr}}`;document.head.appendChild(style);
  mount.innerHTML=`<div class="leaderboard-health-grid">${checks.map(([label,ok,detail])=>`<div class="leaderboard-health-item ${ok?"good":"bad"}"><span>${esc(label)}</span><strong>${ok?"✓ Ready":"○ Pending"}</strong><small>${esc(detail)}</small></div>`).join("")}</div><div class="leaderboard-health-actions"><button class="button secondary" type="button" id="leaderboardConfigCheck">Re-check config</button><button class="button primary" type="button" id="leaderboardHealthProbe" ${configured?"":"disabled"}>Probe leaderboard API</button></div><div class="leaderboard-health-message" id="leaderboardHealthMessage">${configured?"Configuration is complete. The live switch can stay off until the functions are deployed.":"This panel is expected to show pending until Phase 5B."}</div>`;
  document.getElementById("leaderboardConfigCheck")?.addEventListener("click",()=>location.reload());
  document.getElementById("leaderboardHealthProbe")?.addEventListener("click",async()=>{
    const message=document.getElementById("leaderboardHealthMessage");if(message)message.textContent="Probing leaderboard-list…";
    try{const response=await fetch(`${String(cfg.supabaseUrl).replace(/\/$/,"")}/functions/v1/${encodeURIComponent(cfg.functions.list)}`,{method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.publishableKey},body:JSON.stringify({challengeId:"health-check",limit:1}),cache:"no-store"});let body={};try{body=await response.json()}catch{}if(response.ok){if(message)message.textContent="API responded successfully. Phase 5B connection looks healthy.";}else{if(message)message.textContent=`API reached (${response.status}) but returned: ${body.message||body.error||"check function logs"}`;}}catch(error){if(message)message.textContent=`Could not reach the API: ${error.message||error}`;}
  });
})();
