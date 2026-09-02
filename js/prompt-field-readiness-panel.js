/* FPL Draft Challenge — Prompt field-readiness panel v1.1.0
   Lightweight Prompt Studio overlay for historical data readiness. */
(() => {
  "use strict";
  const ROOT='[data-workspace="prompts"]';
  const PANEL_ID='promptFieldReadinessPanel';
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const library=()=>{const api=window.FPL_STUDIO_API?.getPromptLibrary?.();return Array.isArray(api)?api:(Array.isArray(window.FPL_PROMPT_LIBRARY)?window.FPL_PROMPT_LIBRARY:[]);};
  const label=t=>({HISTORICAL_CORE_ELIGIBLE:"Historical core",REQUIRES_FPL_NATIVE:"Needs FPL-native",REQUIRES_ADDITIONAL_RECOVERY:"Needs extra recovery",MIXED_FPL_NATIVE_AND_OTHER:"Mixed recovery",IDENTITY_OR_NAME_ONLY:"Identity/name only"}[t]||t||"Unknown");

  function ensureStyle(){if(document.getElementById('promptFieldReadinessStyle'))return;const s=document.createElement('style');s.id='promptFieldReadinessStyle';s.textContent=`
    #${PANEL_ID}{margin:12px 0 18px;padding:14px 16px;border:1px solid rgba(148,163,184,.28);border-radius:12px;background:rgba(15,23,42,.72)}
    #${PANEL_ID} summary{cursor:pointer;font-weight:800;display:flex;gap:8px;align-items:center}
    #${PANEL_ID} .pfr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px}
    #${PANEL_ID} .pfr-card{padding:9px 10px;border-radius:9px;background:rgba(148,163,184,.10)}
    #${PANEL_ID} .pfr-card strong{display:block;font-size:1.25rem}.pfr-muted{opacity:.72;font-size:.82rem}
    #${PANEL_ID} .pfr-season-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:.76rem}
    #${PANEL_ID} .pfr-season-table th,#${PANEL_ID} .pfr-season-table td{padding:5px 7px;border-bottom:1px solid rgba(148,163,184,.15);text-align:right}
    #${PANEL_ID} .pfr-season-table th:first-child,#${PANEL_ID} .pfr-season-table td:first-child{text-align:left}
    #${PANEL_ID} .pfr-good{font-weight:800}.pfr-partial{opacity:.76}.pfr-missing{opacity:.45}
    .pfr-badge{display:inline-flex;margin-left:6px;padding:2px 6px;border-radius:999px;font-size:.68rem;font-weight:800;border:1px solid rgba(148,163,184,.35);vertical-align:middle}
    .pfr-fields{margin-top:4px;font-size:.72rem;opacity:.72}
  `;document.head.appendChild(s);}

  function summaryData(){const meta=window.FPL_PROMPT_FIELD_READINESS;const prompts=library();const tiers=meta?.tiers||prompts.reduce((a,p)=>(a[p.historicalReadiness||'UNKNOWN']=(a[p.historicalReadiness||'UNKNOWN']||0)+1,a),{});return{meta,prompts,tiers};}
  const pct=x=>`${Math.round(Number(x||0)*100)}%`;
  const coverageClass=x=>x>=1?'pfr-good':x>0?'pfr-partial':'pfr-missing';
  function seasonTable(){const manifest=window.FPL_HISTORICAL_FIELD_MANIFEST;if(!manifest?.ready||!Array.isArray(manifest.seasons)||!manifest.seasons.length)return'';const rows=manifest.seasons.slice(-12).reverse();const fields=['goals','assists','cleanSheets','yellowCards','points','startingPrice'];return `<div class="pfr-muted" style="margin-top:14px"><strong>Latest season field coverage</strong> — positive-minute player-seasons</div><table class="pfr-season-table"><thead><tr><th>Season</th><th>Players</th>${fields.map(f=>`<th>${esc(f)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><td>${esc(row.season)}</td><td>${row.playerCount}</td>${fields.map(f=>{const c=row.fields?.[f]?.coverage||0;return`<td class="${coverageClass(c)}">${pct(c)}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`;}

  function render(){const root=document.querySelector(ROOT);if(!root)return false;ensureStyle();const {meta,prompts,tiers}=summaryData();if(!meta?.ready&&!prompts.some(p=>p.historicalReadiness))return false;let panel=document.getElementById(PANEL_ID);if(!panel){panel=document.createElement('details');panel.id=PANEL_ID;panel.open=false;const anchor=root.querySelector('h1,h2,.workspace-heading,.studio-header')||root.firstElementChild;if(anchor?.parentNode)anchor.parentNode.insertBefore(panel,anchor.nextSibling);else root.prepend(panel);}const tierEntries=Object.entries(tiers).sort((a,b)=>b[1]-a[1]);const fieldEntries=Object.entries(meta?.fieldUsage||{}).slice(0,12);panel.innerHTML=`<summary>Historical prompt readiness <span class="pfr-muted">${prompts.length} prompts mapped</span></summary><div class="pfr-grid">${tierEntries.map(([k,n])=>`<div class="pfr-card"><strong>${n}</strong><span>${esc(label(k))}</span></div>`).join('')}</div>${fieldEntries.length?`<div class="pfr-muted" style="margin-top:10px">Most-used fields: ${fieldEntries.map(([f,n])=>`${esc(f)} (${n})`).join(' · ')}</div>`:''}${seasonTable()}`;decorateCards(prompts);return true;}

  function decorateCards(prompts){const byId=new Map(prompts.map(p=>[String(p.id||''),p]));for(const card of document.querySelectorAll('[data-prompt-id]')){const p=byId.get(String(card.dataset.promptId||''));if(!p)continue;let badge=card.querySelector(':scope > .pfr-card-marker, .quality-title > .pfr-card-marker, .pfr-card-marker');if(!badge){badge=document.createElement('span');badge.className='pfr-badge pfr-card-marker';const title=card.querySelector('.quality-title,h3,h4,strong')||card;title.appendChild(badge);}badge.textContent=label(p.historicalReadiness);badge.title=`Required fields: ${(p.requiredFields||[]).join(', ')||'none detected'}`;let fields=card.querySelector('.pfr-fields');if(!fields&&Array.isArray(p.requiredFields)&&p.requiredFields.length){fields=document.createElement('div');fields.className='pfr-fields';fields.textContent=`Fields: ${p.requiredFields.join(', ')}`;(card.querySelector('.quality-card-head')||card).appendChild(fields);}}
  }

  let timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(render,40);}function boot(){if(!render())setTimeout(boot,150);}boot();
  window.addEventListener('fpl:prompt-field-readiness-ready',schedule);window.addEventListener('fpl:historical-field-manifest-ready',schedule);window.addEventListener('fpl:prompt-library-changed',schedule);window.addEventListener('fpl:prompt-tools-ready',schedule);
  const observer=new MutationObserver(schedule);const attach=()=>{const root=document.querySelector(ROOT);if(root)observer.observe(root,{childList:true,subtree:true});else setTimeout(attach,250);};attach();
  window.FPL_PROMPT_FIELD_READINESS_PANEL=Object.freeze({version:'1.1.0',render});
})();
