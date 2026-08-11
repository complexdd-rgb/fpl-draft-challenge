/* FPL Draft Challenge — Phase 4.5 second-pass polish. */
(() => {
  "use strict";
  const challenge = window.FPL_DAILY_CHALLENGE || null;
  if (!challenge) return;
  const runtime = window.FPL_CHALLENGE_RUNTIME || {};
  const HISTORY_KEY = "fpl-v4-local-history";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const history = () => { try { const x = JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]"); return Array.isArray(x)?x:[]; } catch { return []; } };
  const officialHistory = () => history().filter(item=>item&&item.completed===true&&item.official!==false);
  const currentRecord = () => {
    const id = challenge.id;
    const list = history().filter(item=>item&&item.completed===true&&item.challengeId===id);
    if (list.length) return list[list.length-1];
    try {
      const prefix = runtime.archiveMode ? `fpl-v2-practice-${id}` : `fpl-v2-${id}`;
      const save = JSON.parse(localStorage.getItem(prefix)||"{}");
      return save.completedRecord || null;
    } catch { return null; }
  };

  function decorateSlots(){
    document.querySelectorAll('.slot').forEach(slot=>{
      const locked = slot.classList.contains('compact-confirmed');
      slot.classList.toggle('phase45-locked', locked);
      slot.classList.toggle('phase45-unanswered', !locked);
      if(!slot.dataset.phase45FocusBound){
        slot.dataset.phase45FocusBound='1';
        slot.addEventListener('focusin',()=>slot.classList.add('phase45-active'));
        slot.addEventListener('focusout',e=>{if(!slot.contains(e.relatedTarget))slot.classList.remove('phase45-active');});
      }
    });
  }

  function priorRecords(record){
    return officialHistory().filter(item=>item.challengeId!==record?.challengeId);
  }

  function addPersonalBestPills(){
    const record=currentRecord();
    const host=document.querySelector('#results .result-copy');
    if(!record||!host)return;
    let wrap=document.getElementById('phase45RecordPills');
    if(wrap)wrap.remove();
    const prior=priorRecords(record);
    const pills=[];
    if(!prior.length && record.official!==false)pills.push('First official result');
    if(prior.length){
      const prevBestScore=Math.max(...prior.map(x=>Number(x.finalScore)||0));
      const prevBestEff=Math.max(...prior.map(x=>Number(x.efficiency)||0));
      const prevFastest=Math.min(...prior.map(x=>Number(x.elapsedSeconds)).filter(Number.isFinite));
      if(Number(record.finalScore)>prevBestScore)pills.push('New best score');
      if(Number(record.efficiency)>prevBestEff)pills.push('New best efficiency');
      if(Number.isFinite(prevFastest)&&Number(record.elapsedSeconds)<prevFastest)pills.push('New fastest time');
    }
    if(Number(record.penalties)===0)pills.push('Zero penalties');
    if(Number(record.efficiency)>=100)pills.push('Perfect efficiency');
    if(!pills.length)return;
    wrap=document.createElement('div');
    wrap.className='phase45-record-pills';wrap.id='phase45RecordPills';
    wrap.innerHTML=pills.map(x=>`<span class="phase45-record-pill">${esc(x)}</span>`).join('');
    host.appendChild(wrap);
  }

  function tierClass(percent){
    if(percent>=99.95)return 'perfect';
    if(percent>=90)return 'elite';
    if(percent>=75)return 'strong';
    return 'risky';
  }

  function challengeDateText(value){
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||""));
    if(!match)return String(value||"Daily Challenge");
    return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),12)));
  }

  function renderShareCard(){
    const mount=document.getElementById('phase45ShareCard');
    const results=document.getElementById('results');
    if(!mount||!results||results.classList.contains('hidden'))return;
    const record=currentRecord();
    const efficiency=document.getElementById('efficiency')?.textContent||'0%';
    const score=document.getElementById('finalScore')?.textContent||'0';
    const time=document.getElementById('timeTaken')?.textContent||'0:00';
    const grade=document.getElementById('grade')?.textContent||'–';
    const penalty=document.getElementById('penaltyPoints')?.textContent||'0';
    const efficiencies=(record?.selections||[]).map(item=>Number(item.pickEfficiency)||0);
    if(!efficiencies.length){
      document.querySelectorAll('.compact-efficiency strong').forEach(el=>efficiencies.push(Number(String(el.textContent).replace(/[^\d.]/g,''))||0));
    }
    mount.innerHTML=`<article class="share-card"><div class="share-card-top"><div class="share-card-title"><span>FPL Draft Challenge · ${esc(challengeDateText(challenge.releaseDate))}${challenge.formation?` · ${esc(challenge.formation)}`:''}${runtime.archiveMode?' · practice':''}</span><strong>${esc(challenge.title||'Daily Challenge')}</strong></div><div class="share-card-grade">${esc(grade)}</div></div><div class="share-grid">${efficiencies.map(value=>`<span class="${tierClass(value)}" title="${value.toFixed(1)}%"></span>`).join('')}</div><div class="share-card-stats"><div class="share-card-stat"><span>Score</span><strong>${esc(score)} / ${Number(challenge.perfectScore||0).toLocaleString()}</strong></div><div class="share-card-stat"><span>Efficiency</span><strong>${esc(efficiency)}</strong></div><div class="share-card-stat"><span>Time · penalties</span><strong>${esc(time)} · ${esc(penalty)}</strong></div></div></article>`;
  }

  function animateFreshResult(){
    const hero=document.getElementById('resultHero');
    const record=currentRecord();
    if(!hero||!record)return;
    const fresh=Date.now()-Number(record.completedAt||0)<12000;
    hero.classList.toggle('phase45-fresh-result',fresh);
    if(!fresh)return;
    const targets=[['finalScore',Number(record.finalScore)||0,0],['playerPoints',Number(record.playerPoints)||0,0]];
    targets.forEach(([id,target,dec])=>{
      const el=document.getElementById(id);if(!el)return;
      const duration=650,start=performance.now();
      const step=now=>{const p=Math.min(1,(now-start)/duration);const eased=1-Math.pow(1-p,3);el.textContent=Math.round(target*eased).toLocaleString();if(p<1)requestAnimationFrame(step);};
      requestAnimationFrame(step);
    });
  }

  function enhanceArchiveCards(){
    document.querySelectorAll('.archive-entry').forEach(card=>{
      if(card.dataset.phase45Archive==='1')return;
      card.dataset.phase45Archive='1';
      const title=card.querySelector('h3');
      const paras=[...card.querySelectorAll('p')];
      const action=card.querySelector('.archive-action');
      if(!title)return;
      const allEntries=(window.FPL_CHALLENGE_MANIFEST?.challenges||[]);
      const dateText=paras[0]?.textContent||'';
      const href=action?.getAttribute('href')||'';
      let date=null;try{date=new URL(href,location.href).searchParams.get('challenge');}catch{}
      const entry=allEntries.find(x=>x.date===date)||{};
      const resultText=paras[1]?.textContent||'Not played';
      const state=resultText.startsWith('Completed')?'completed':resultText.startsWith('Practice')?'practice':'open';
      const stateLabel=state==='completed'?'Completed':state==='practice'?'Practice saved':'Not played';
      const top=document.createElement('div');top.className='archive-entry-top';
      top.innerHTML=`<span class="archive-number">${esc(challengeDateText(entry.date))}</span><span class="archive-difficulty">${esc(entry.difficulty||'Daily')}</span><span class="archive-state-chip ${state==='open'?'':state}">${stateLabel}</span>`;
      title.before(top);
      const meta=document.createElement('div');meta.className='archive-meta-row';
      const score=Number(entry.perfectScore);meta.innerHTML=`<span>${esc(dateText)}</span>${Number.isFinite(score)&&score>0?`<span>Perfect XI ${score.toLocaleString()} pts</span>`:''}`;
      paras[0]?.replaceWith(meta);
    });
  }

  function refresh(){decorateSlots();addPersonalBestPills();renderShareCard();enhanceArchiveCards();}
  const grid=document.getElementById('grid');
  const results=document.getElementById('results');
  const archive=document.querySelector('.challenge-calendar-nav');
  const observer=new MutationObserver(()=>requestAnimationFrame(refresh));
  if(grid)observer.observe(grid,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  if(results)observer.observe(results,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  if(archive)observer.observe(archive,{childList:true,subtree:true});
  if(results){
    const resultObserver=new MutationObserver(()=>{
      if(!results.classList.contains('hidden')){animateFreshResult();setTimeout(()=>{addPersonalBestPills();renderShareCard();},50);}
    });
    resultObserver.observe(results,{attributes:true,attributeFilter:['class']});
  }
  refresh();
})();
