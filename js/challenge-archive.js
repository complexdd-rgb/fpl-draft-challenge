/* FPL Daily Challenge — Phase 4 challenge archive UI. */
(() => {
  "use strict";
  const manifest = window.FPL_CHALLENGE_MANIFEST || {};
  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const dailyTime = window.FPL_DAILY_TIME || {};
  const entries = Array.isArray(manifest.challenges) ? manifest.challenges.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))) : [];
  const officialDate = runtime.officialDate || (typeof dailyTime.ukDateString === "function" ? dailyTime.ukDateString() : new Date().toISOString().slice(0,10));
  const yesterday = typeof dailyTime.addCalendarDays === "function" ? dailyTime.addCalendarDays(officialDate,-1) : null;
  const historyKey = "fpl-v4-local-history";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const loadJson = (key, fallback) => { try { const value=JSON.parse(localStorage.getItem(key)||""); return value ?? fallback; } catch { return fallback; } };
  const history = (()=>{ const v=loadJson(historyKey,[]); return Array.isArray(v)?v:[]; })();
  const officialRecord = id => history.find(item=>item && item.completed===true && item.challengeId===id) || null;
  const practiceRecord = id => {
    const save=loadJson(`fpl-v2-practice-${id}`,{});
    return save && save.completedRecord && save.completedRecord.challengeId===id ? save.completedRecord : null;
  };
  const fmtDate = value => {
    const [y,m,d]=String(value||"").split("-").map(Number);
    if(!y||!m||!d)return value||"";
    return new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(y,m-1,d,12)));
  };
  const linkFor = date => `${window.location.pathname}?challenge=${encodeURIComponent(date)}`;
  const todayLink = window.location.pathname;
  const pastEntries = entries.filter(entry=>entry.date < officialDate).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const yesterdayEntry = yesterday ? entries.find(entry=>entry.date===yesterday) : null;

  const style=document.createElement("style");
  style.textContent=`
    .challenge-calendar-nav{margin:14px 0 18px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(7,27,19,.78);box-shadow:0 10px 30px rgba(0,0,0,.14)}
    .challenge-calendar-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.calendar-tab{display:flex;align-items:center;justify-content:center;min-height:42px;padding:9px 12px;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:#10281d;color:var(--text);font:inherit;font-size:.78rem;font-weight:900;text-decoration:none;cursor:pointer}.calendar-tab:hover{border-color:rgba(0,255,135,.48)}.calendar-tab.active{background:linear-gradient(135deg,var(--accent),#a6ff4b);color:#04140c;border-color:transparent}.calendar-tab.disabled{opacity:.42;cursor:not-allowed}.archive-mode-banner{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(74,161,255,.1);border:1px solid rgba(74,161,255,.22);font-size:.72rem;line-height:1.45;color:#b9ddff}.archive-mode-banner strong{color:#fff}
    .challenge-archive-panel{margin-top:10px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}.challenge-archive-panel.hidden{display:none}.archive-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:10px}.archive-head h2{font-size:1rem;margin:3px 0 0}.archive-head p{margin:0;color:var(--muted);font-size:.68rem;text-align:right}.archive-list{display:grid;gap:8px;max-height:380px;overflow:auto;padding-right:2px}.archive-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.13)}.archive-entry h3{margin:0 0 3px;font-size:.82rem}.archive-entry p{margin:0;color:var(--muted);font-size:.66rem;line-height:1.35}.archive-result{color:var(--accent)!important;font-weight:800}.archive-action{white-space:nowrap;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#153324;color:#fff;text-decoration:none;font-size:.68rem;font-weight:900}.archive-action:hover{border-color:var(--accent)}.archive-empty{padding:13px;border-radius:12px;background:rgba(0,0,0,.12);color:var(--muted);font-size:.72rem}.archive-practice-label{color:#9fddea!important}
    @media(max-width:560px){.challenge-calendar-tabs{grid-template-columns:1fr 1fr}.challenge-calendar-tabs .archive-toggle{grid-column:1/-1}.archive-entry{grid-template-columns:1fr}.archive-action{text-align:center}.archive-head{align-items:flex-start;flex-direction:column}.archive-head p{text-align:left}}
  `;
  document.head.appendChild(style);

  const shell=document.createElement("section");
  shell.className="challenge-calendar-nav";
  shell.setAttribute("aria-label","Daily challenge calendar");
  const currentSelected=runtime.selectedDate || officialDate;
  const isArchive=runtime.archiveMode===true;
  shell.innerHTML=`
    <nav class="challenge-calendar-tabs" aria-label="Challenge dates">
      <a class="calendar-tab ${!isArchive?"active":""}" href="${esc(todayLink)}">Today</a>
      ${yesterdayEntry ? `<a class="calendar-tab ${isArchive&&currentSelected===yesterday?"active":""}" href="${esc(linkFor(yesterday))}">Yesterday</a>` : `<span class="calendar-tab disabled" aria-disabled="true">Yesterday</span>`}
      <button class="calendar-tab archive-toggle ${isArchive&&currentSelected!==yesterday?"active":""}" id="archiveToggle" type="button" aria-expanded="${isArchive?"true":"false"}">Archive</button>
    </nav>
    ${isArchive ? `<div class="archive-mode-banner"><strong>Archive practice:</strong> ${esc(fmtDate(currentSelected))}. If you completed this challenge on its original day, your locked result is restored. Otherwise this run is practice and does not change your official streak or daily stats.</div>` : ""}
    <div class="challenge-archive-panel ${isArchive?"":"hidden"}" id="challengeArchivePanel">
      <div class="archive-head"><div><span class="overview-kicker">Previous days</span><h2>Challenge archive</h2></div><p>Completed daily results stay locked. Missed challenges can be played for practice.</p></div>
      <div class="archive-list" id="challengeArchiveList"></div>
    </div>`;
  const hero=document.querySelector(".hero");
  if(hero) hero.insertAdjacentElement("afterend",shell); else document.querySelector("main")?.prepend(shell);

  const list=shell.querySelector("#challengeArchiveList");
  if(list){
    list.innerHTML=pastEntries.length ? pastEntries.map(entry=>{
      const official=officialRecord(entry.id), practice=practiceRecord(entry.id);
      let result="Not played", action="Practice";
      if(official){result=`Completed · ${Number(official.finalScore||0).toLocaleString()} pts · ${Number(official.efficiency||0).toFixed(1)}%`; action="View result";}
      else if(practice){result=`Practice complete · ${Number(practice.finalScore||0).toLocaleString()} pts · ${Number(practice.efficiency||0).toFixed(1)}%`; action="View practice";}
      return `<article class="archive-entry"><div><h3>${esc(entry.title||`Challenge #${entry.number||"–"}`)}</h3><p>${esc(fmtDate(entry.date))} · ${esc(entry.formation || "4-4-2")}${entry.theme ? ` · ${esc(entry.theme)}` : ""}</p><p class="${official?"archive-result":practice?"archive-practice-label":""}">${esc(result)}</p></div><a class="archive-action" href="${esc(linkFor(entry.date))}">${esc(action)}</a></article>`;
    }).join("") : '<div class="archive-empty">No previous dated challenges are in the calendar yet. Once Phase 2 publishes a week, they will appear here automatically.</div>';
  }

  const toggle=shell.querySelector("#archiveToggle"), panel=shell.querySelector("#challengeArchivePanel");
  toggle?.addEventListener("click",()=>{
    const hidden=panel.classList.toggle("hidden");
    toggle.setAttribute("aria-expanded",String(!hidden));
    if(!hidden) panel.scrollIntoView({behavior:"smooth",block:"nearest"});
  });

  if(runtime.selectionMode==="latest-published" && !isArchive){
    const note=document.createElement("div");
    note.className="archive-mode-banner";
    note.innerHTML=`<strong>Latest published challenge:</strong> today does not yet have an exact calendar entry, so ${esc(fmtDate(runtime.selectedDate))} is being served as the safe fallback.`;
    shell.appendChild(note);
  }
})();
