/* FPL Career Shape · Prompt Studio integration v1.0.0 */
(() => {
  "use strict";

  const VERSION = "1.0.0";
  const STORAGE_KEY = "fplChallengeStudioPromptManagerV1";
  const FACTORY_MESSAGE_KEY = "fplChallengeStudioPromptFactoryMessage";
  const LOCAL_MESSAGE_KEY = "fplCareerShapeStudioMessage";
  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const NAMES = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
  const LOWER = { GK: "goalkeeper", DEF: "defender", MID: "midfielder", FWD: "forward" };
  const RETURN_WORDING = window.FPL_CAREER_SHAPE_RULES?.returnWording || "returned to a former Premier League club after playing for another Premier League club";
  let builderState = null;
  let factoryBatch = [];

  const BUILDER_RULES = Object.freeze({
    everChampion: { label: "Won the Premier League", kind: "boolean", expression: "p._careerShape?.everChampion === true" },
    everTopFour: { label: "Played for a top-four club", kind: "boolean", expression: "p._careerShape?.everTopFour === true" },
    consecutiveSameClub: { label: "Consecutive PL seasons at the same club", kind: "number", accessor: "Number(p._careerShape?.maxConsecutiveSameClub)", defaultValue: 4, min: 2, max: 12 },
    managerCount: { label: "Different PL managers in recorded career", kind: "number", accessor: "Number(p._careerShape?.managerCount)", defaultValue: 4, min: 1, max: 20 },
    bigSixClubCount: { label: "Traditional Big Six clubs played for", kind: "number", accessor: "Number(p._careerShape?.bigSixClubCount)", defaultValue: 2, min: 1, max: 6 },
    neverBigSix: { label: "Never played for a traditional Big Six club", kind: "boolean", expression: "p._careerShape?.neverBigSix === true" },
    managersInSeason: { label: "Managers during one PL season", kind: "number", accessor: "Number(p._careerShape?.maxManagersInSeason)", defaultValue: 2, min: 2, max: 10 },
    championAndRelegated: { label: "Won the league and played for a relegated club", kind: "boolean", expression: "p._careerShape?.everChampion === true && p._careerShape?.everRelegatedClub === true" }
  });

  function players() { return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : []; }
  function esc(value) { return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
  function norm(value) { return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function cap(value) { const text = String(value || ""); return text.charAt(0).toUpperCase() + text.slice(1); }
  function makeTest(expression) { try { return Function(`"use strict"; return (p => (${expression}));`)(); } catch (_) { return () => false; } }
  function symbol(operator) { return operator === "eq" ? "===" : operator === "lte" ? "<=" : ">="; }
  function words(operator, value) { return operator === "eq" ? `exactly ${value}` : operator === "lte" ? `at most ${value}` : `at least ${value}`; }

  function expressionFor(key, operator = "gte", value = 0) {
    const rule = BUILDER_RULES[key];
    if (!rule) return "false";
    if (rule.kind === "boolean") return rule.expression;
    const amount = Math.max(rule.min || 0, Math.min(rule.max || 100, Math.round(Number(value) || rule.defaultValue || 1)));
    return `(Number.isFinite(${rule.accessor}) && ${rule.accessor} ${symbol(operator)} ${amount})`;
  }

  function wordingFor(position, key, operator = "gte", value = 0) {
    const noun = NAMES[position] || "Player";
    const role = LOWER[position] || "player";
    const rule = BUILDER_RULES[key];
    if (!rule) return { label: `${noun} with a Career Shape rule`, fail: `That ${role} must meet the Career Shape rule.` };
    const fixed = {
      everChampion: [`${noun} who won the Premier League at some point in their recorded career`, `That ${role} must have at least one recorded title-winning Premier League season.`],
      everTopFour: [`${noun} who played for a top-four club at some point in their recorded career`, `That ${role} must have at least one recorded Premier League season for a top-four club.`],
      neverBigSix: [`${noun} who never played for a traditional Big Six club in their recorded Premier League career`, `That ${role} must have recorded Premier League minutes but none for Arsenal, Chelsea, Liverpool, Man City, Man Utd or Spurs.`],
      championAndRelegated: [`${noun} who won the Premier League and also played for a relegated club in their recorded career`, `That ${role} must have both a recorded title-winning Premier League season and a recorded season for a relegated club.`]
    };
    if (fixed[key]) return { label: fixed[key][0], fail: fixed[key][1] };
    const amount = Math.max(rule.min || 0, Math.min(rule.max || 100, Math.round(Number(value) || rule.defaultValue || 1)));
    const phrase = words(operator, amount);
    if (key === "consecutiveSameClub") return { label: `${noun} with ${phrase} consecutive recorded Premier League seasons at the same club`, fail: `That ${role} must have ${phrase} consecutive positive-minute Premier League seasons at the same club.` };
    if (key === "managerCount") return { label: `${noun} who played under ${phrase} different managers across their recorded Premier League career`, fail: `That ${role} must have recorded Premier League minutes under ${phrase} different stored managers.` };
    if (key === "bigSixClubCount") return { label: `${noun} who played for ${phrase} traditional Big Six clubs in their recorded Premier League career`, fail: `That ${role} must have recorded Premier League minutes for ${phrase} different traditional Big Six clubs.` };
    return { label: `${noun} who had ${phrase} managers during a single recorded Premier League season`, fail: `That ${role} must have a recorded Premier League season containing ${phrase} different stored managers.` };
  }

  function withQualifier(expression, wording, type = "none", rawValue = 0) {
    const value = Math.max(0, Math.round(Number(rawValue) || 0));
    if (type === "none" || !value) return { expression, label: wording.label, fail: wording.fail, tag: "" };
    if (type === "points") return {
      expression: `(${expression}) && (Number.isFinite(Number(p.points)) && Number(p.points) >= ${value})`,
      label: `${wording.label} and scored ${value}+ FPL points`,
      fail: `${wording.fail} The qualifying season must also score at least ${value} FPL points.`,
      tag: "points"
    };
    return {
      expression: `(${expression}) && (Number.isFinite(Number(p.minutes)) && Number(p.minutes) >= ${value})`,
      label: `${wording.label} and played ${value.toLocaleString("en-GB")}+ minutes`,
      fail: `${wording.fail} The qualifying season must also include at least ${value.toLocaleString("en-GB")} minutes.`,
      tag: "minutes"
    };
  }

  function analyse(prompt) {
    const best = new Map();
    let seasonCount = 0;
    let errors = 0;
    for (const player of players()) for (const record of player.seasons || []) {
      if (Number(record.minutes) <= 0 || record.position !== prompt.position) continue;
      let passed = false;
      try { passed = Boolean(prompt.test(record)); } catch (_) { errors += 1; }
      if (!passed) continue;
      seasonCount += 1;
      const current = best.get(player.playerId);
      if (!current || Number(record.points || 0) > Number(current.points || 0)) {
        best.set(player.playerId, { playerId: player.playerId, playerName: player.name, season: record.season, club: record.club, points: Number(record.points) || 0 });
      }
    }
    return {
      playerCount: best.size,
      seasonCount,
      errors,
      ids: new Set(best.keys()),
      examples: [...best.values()].sort((a,b) => b.points - a.points || a.playerName.localeCompare(b.playerName)).slice(0,5)
    };
  }

  function managerState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") return {
        version: 1,
        overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
        customs: Array.isArray(parsed.customs) ? parsed.customs : [],
        deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
      };
    } catch (_) {}
    return { version: 1, overrides: {}, customs: [], deletedIds: [] };
  }

  function serialise(prompt) {
    return {
      id: prompt.id, position: prompt.position, label: prompt.label, fail: prompt.fail,
      difficulty: prompt.difficulty, tags: [...new Set(prompt.tags || [])],
      rating: Number(prompt.rating) || 4, cooldown: Number(prompt.cooldown) || 10,
      enabled: prompt.enabled !== false, studioRule: prompt.studioRule,
      testSource: prompt.testSource || prompt.studioRule?.source || "p => false"
    };
  }

  function persist(prompts, message) {
    const state = managerState();
    const ids = new Set([...(window.FPL_PROMPT_LIBRARY || []).map(prompt => String(prompt.id || "")), ...state.customs.map(prompt => String(prompt.id || ""))]);
    let added = 0;
    for (const prompt of prompts) {
      if (!prompt?.id || ids.has(prompt.id)) continue;
      state.customs.push(serialise(prompt));
      ids.add(prompt.id);
      added += 1;
    }
    if (!added) return 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    sessionStorage.setItem(FACTORY_MESSAGE_KEY, message);
    sessionStorage.setItem(LOCAL_MESSAGE_KEY, message);
    return added;
  }

  function uniqueId(base) {
    const state = managerState();
    const ids = new Set([...(window.FPL_PROMPT_LIBRARY || []).map(prompt => String(prompt.id || "")), ...state.customs.map(prompt => String(prompt.id || ""))]);
    const root = String(base || "career_shape_custom").toLowerCase().replace(/[^a-z0-9_]+/g,"_").replace(/^_+|_+$/g,"").slice(0,54);
    let id = root, suffix = 2;
    while (ids.has(id)) id = `${root}_${suffix++}`.slice(0,60);
    return id;
  }

  function factorySettings() {
    const integer = (id,min,max,fallback) => {
      const value = Math.round(Number(document.getElementById(id)?.value));
      return Number.isFinite(value) ? Math.max(min,Math.min(max,value)) : fallback;
    };
    const position = document.getElementById("factoryPositionMix")?.value || "balanced";
    const difficulty = document.getElementById("factoryDifficultyMix")?.value || "balanced";
    return {
      requested: integer("factoryPromptCount",1,50,20),
      minimum: integer("factoryMinPlayers",3,100,6),
      maximum: integer("factoryMaxPlayers",6,250,100),
      cooldown: integer("factoryCooldown",0,50,10),
      position: POSITIONS.includes(position) ? position : "balanced",
      difficulty: ["easy","medium","hard"].includes(difficulty) ? difficulty : "balanced",
      enabled: Boolean(document.getElementById("factoryEnablePrompts")?.checked),
      avoidSimilar: Boolean(document.getElementById("factoryAvoidSimilarPools")?.checked)
    };
  }

  function numericVariants(key) {
    if (key === "consecutiveSameClub") return [2,3,4,5,6].flatMap(v => [["gte",v],["eq",v]]);
    if (key === "managerCount") return [2,3,4,5,6,7].flatMap(v => [["gte",v],["eq",v]]);
    if (key === "bigSixClubCount") return [1,2,3].flatMap(v => [["gte",v],["eq",v]]);
    return [2,3].flatMap(v => [["gte",v],["eq",v]]);
  }
  function pointThresholds(position) { return ({GK:[50,80,110],DEF:[60,90,120,150],MID:[70,100,130,160],FWD:[60,90,120,150]})[position] || [60,90,120]; }

  function candidate(position,key,operator,value,extra="none",extraValue=0,cooldown=10) {
    const rule = BUILDER_RULES[key];
    const combined = withQualifier(expressionFor(key,operator,value), wordingFor(position,key,operator,value), extra, extraValue);
    const suffix = rule.kind === "number" ? `${operator}_${value}` : "career";
    const extraSuffix = extra === "none" ? "" : `_${extra}_${extraValue}`;
    const expression = combined.expression;
    const source = `p => (${expression})`;
    return {
      id:`career_shape_auto_${position.toLowerCase()}_${key}_${suffix}${extraSuffix}`.replace(/[^a-z0-9_]+/g,"_"),
      family:`${position}:career-shape:${key}`, position, label:combined.label, fail:combined.fail,
      difficulty:"medium", tags:["career-shape","career","auto-generated","checked",key.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`),combined.tag].filter(Boolean),
      rating:4, cooldown, enabled:false, studioRule:{kind:"source",source}, testSource:source, test:makeTest(expression)
    };
  }

  function candidates(settings,family,variantMode) {
    const positions = settings.position === "balanced" ? POSITIONS : [settings.position];
    const keys = family === "all" ? Object.keys(BUILDER_RULES) : [family];
    const out = [];
    for (const position of positions) for (const key of keys) {
      const rule = BUILDER_RULES[key];
      if (!rule) continue;
      const bases = rule.kind === "number" ? numericVariants(key) : [["gte",0]];
      for (const [operator,value] of bases) {
        if (variantMode === "mixed" || variantMode === "career-only") out.push(candidate(position,key,operator,value,"none",0,settings.cooldown));
        if (variantMode === "mixed" || variantMode === "points") for (const threshold of pointThresholds(position)) out.push(candidate(position,key,operator,value,"points",threshold,settings.cooldown));
        if (variantMode === "mixed" || variantMode === "minutes") for (const threshold of [1000,1800,2500]) out.push(candidate(position,key,operator,value,"minutes",threshold,settings.cooldown));
      }
    }
    return out;
  }

  function overlap(a,b) {
    if (!a.size || !b.size) return 0;
    let n=0; for (const id of a) if (b.has(id)) n += 1;
    return n / Math.min(a.size,b.size);
  }

  function existingShapePools() {
    const out=[];
    for (const prompt of window.FPL_PROMPT_LIBRARY || []) {
      if (!String(prompt.id || "").startsWith("career_shape_") && !(prompt.tags || []).includes("career-shape")) continue;
      try { const a=analyse(prompt); if (a.ids.size) out.push({position:prompt.position,ids:a.ids}); } catch(_){}
    }
    return out;
  }

  function chooseBatch(items,requested,positionMode,difficultyMode) {
    const remaining=[...items].sort(()=>Math.random()-.5), chosen=[], families=new Map();
    while(chosen.length<requested && remaining.length){
      let bi=0, bs=-Infinity;
      for(let i=0;i<remaining.length;i++){
        const c=remaining[i], fu=families.get(c.family)||0;
        const pu=chosen.filter(x=>x.position===c.position).length, du=chosen.filter(x=>x.difficulty===c.difficulty).length;
        const pt=positionMode==="balanced"?requested/4:requested, dt=difficultyMode==="balanced"?requested/3:requested;
        const score=(pt-pu)*4+(dt-du)*2-fu*4+Math.random();
        if(score>bs){bs=score;bi=i;}
      }
      const [picked]=remaining.splice(bi,1); chosen.push(picked); families.set(picked.family,(families.get(picked.family)||0)+1);
    }
    return chosen;
  }

  function installFactory() {
    const factory=document.getElementById("automaticPromptFactory");
    if(!factory || document.getElementById("careerShapeFactory")) return;
    const panel=document.createElement("section");
    panel.id="careerShapeFactory"; panel.className="career-shape-factory";
    panel.innerHTML=`
      <div class="cs-head"><div><span>Career Shape generator</span><strong>Generate checked variants from all 8 career-rule families</strong></div><em>Uses the position, difficulty, answer, cooldown and enable settings above</em></div>
      <div class="cs-controls">
        <label>Rule family<select id="careerShapeFactoryFamily"><option value="all">Balanced mix of all Career Shape rules</option>${Object.entries(BUILDER_RULES).map(([k,r])=>`<option value="${k}">${esc(r.label)}</option>`).join("")}</select></label>
        <label>Variant mix<select id="careerShapeFactoryVariant"><option value="mixed">Thresholds + points + minutes</option><option value="career-only">Career rule only</option><option value="points">Add FPL-points qualifiers</option><option value="minutes">Add minutes qualifiers</option></select></label>
      </div>
      <div class="cs-actions"><button id="generateCareerShapeBatchBtn" class="button secondary" type="button">Generate Career Shape batch</button><button id="addCareerShapeBatchBtn" class="button secondary" type="button" disabled>Add selected Career Shape prompts</button><button id="clearCareerShapeBatchBtn" class="button secondary" type="button" disabled>Clear preview</button></div>
      <p id="careerShapeFactoryStatus" class="action-status">The normal Automatic Creator remains available; this checked branch adds the new Career Shape families and combinations.</p>
      <div id="careerShapeFactoryPreview" class="cs-preview" hidden></div>`;
    const actions=factory.querySelector(".prompt-factory-actions"); if(actions) actions.before(panel); else factory.append(panel);
    document.getElementById("generateCareerShapeBatchBtn").addEventListener("click",generateBatch);
    document.getElementById("addCareerShapeBatchBtn").addEventListener("click",saveBatch);
    document.getElementById("clearCareerShapeBatchBtn").addEventListener("click",clearBatch);
    document.getElementById("careerShapeFactoryPreview").addEventListener("change",updateButtons);
  }

  function generateBatch(){
    const status=document.getElementById("careerShapeFactoryStatus"), preview=document.getElementById("careerShapeFactoryPreview"), button=document.getElementById("generateCareerShapeBatchBtn");
    const settings=factorySettings(), family=document.getElementById("careerShapeFactoryFamily")?.value||"all", variantMode=document.getElementById("careerShapeFactoryVariant")?.value||"mixed";
    button.disabled=true; status.textContent="Building Career Shape variants and checking them against the full player database…"; preview.hidden=true;
    setTimeout(()=>{
      try{
        const ids=new Set((window.FPL_PROMPT_LIBRARY||[]).map(p=>String(p.id||""))), labels=new Set((window.FPL_PROMPT_LIBRARY||[]).map(p=>norm(p.label)));
        const oldPools=settings.avoidSimilar?existingShapePools():[], seen=[], accepted=[]; let range=0,duplicate=0,similar=0;
        for(const c of candidates(settings,family,variantMode)){
          if(ids.has(c.id)||labels.has(norm(c.label))){duplicate++;continue;}
          const a=analyse(c); if(a.errors||a.playerCount<settings.minimum||a.playerCount>settings.maximum){range++;continue;}
          c.analysis=a; c.difficulty=a.playerCount<=12?"hard":a.playerCount<=35?"medium":"easy";
          if(settings.difficulty!=="balanced"&&c.difficulty!==settings.difficulty)continue;
          if(settings.avoidSimilar&&[...oldPools,...seen].some(x=>x.position===c.position&&overlap(x.ids,a.ids)>=.97)){similar++;continue;}
          c.enabled=settings.enabled; c.rating=a.playerCount<=60?5:4; accepted.push(c); seen.push({position:c.position,ids:a.ids});
        }
        factoryBatch=chooseBatch(accepted,settings.requested,settings.position,settings.difficulty);
        renderBatch({range,duplicate,similar});
      }catch(error){factoryBatch=[];status.textContent=`Career Shape generation failed safely: ${error.message}`;}
      finally{button.disabled=false;updateButtons();}
    },20);
  }

  function renderBatch(rejected){
    const status=document.getElementById("careerShapeFactoryStatus"), preview=document.getElementById("careerShapeFactoryPreview");
    preview.hidden=false;
    if(!factoryBatch.length){preview.innerHTML='<div class="cs-empty">No new Career Shape variants met the current settings.</div>';status.textContent=`No new variants passed. ${rejected.duplicate} duplicates, ${rejected.similar} near-identical pools and ${rejected.range} out-of-range candidates were rejected.`;return;}
    preview.innerHTML=factoryBatch.map((p,i)=>`<article class="cs-card"><label><input type="checkbox" data-cs-select="${i}" checked><span class="position-badge">${p.position}</span><strong>${esc(p.label)}</strong></label><div><span>${p.analysis.playerCount} valid</span><span>${cap(p.difficulty)}</span><span>${p.enabled?"Enable on add":"Disabled for review"}</span></div><small>${p.analysis.examples.map(a=>`${esc(a.playerName)} · ${esc(a.season)} · ${a.points} pts`).join(" · ")}</small></article>`).join("");
    status.textContent=`${factoryBatch.length} checked Career Shape prompt${factoryBatch.length===1?"":"s"} created. ${rejected.duplicate} duplicates, ${rejected.similar} near-identical pools and ${rejected.range} out-of-range candidates were rejected.`;
  }

  function updateButtons(){
    const preview=document.getElementById("careerShapeFactoryPreview"), add=document.getElementById("addCareerShapeBatchBtn"), clear=document.getElementById("clearCareerShapeBatchBtn");
    const n=preview?preview.querySelectorAll("[data-cs-select]:checked").length:0;
    if(add){add.disabled=n===0;add.textContent=n?`Add ${n} selected Career Shape prompt${n===1?"":"s"}`:"Add selected Career Shape prompts";}
    if(clear)clear.disabled=factoryBatch.length===0;
  }
  function clearBatch(){factoryBatch=[];const p=document.getElementById("careerShapeFactoryPreview"),s=document.getElementById("careerShapeFactoryStatus");if(p){p.innerHTML="";p.hidden=true;}if(s)s.textContent="Career Shape preview cleared.";updateButtons();}
  function saveBatch(){
    const p=document.getElementById("careerShapeFactoryPreview"),s=document.getElementById("careerShapeFactoryStatus");
    const selected=[...p.querySelectorAll("[data-cs-select]:checked")].map(x=>factoryBatch[Number(x.dataset.csSelect)]).filter(Boolean);
    if(!selected.length){s.textContent="Select at least one Career Shape prompt first.";return;}
    const added=persist(selected,`${selected.length} checked Career Shape prompt${selected.length===1?"":"s"} added to the browser library.`);
    if(!added){s.textContent="Those prompts already exist.";return;} location.reload();
  }

  function installBuilder(){
    const root=document.querySelector("#promptEditor .rule-builder"); if(!root||document.getElementById("careerShapeBuilder"))return;
    const box=document.createElement("div");box.id="careerShapeBuilder";box.className="career-shape-builder";
    box.innerHTML=`
      <div class="cs-builder-head"><div><strong>Career Shape rule starter</strong><span>Create safe career-history prompts without writing JavaScript.</span></div><em>Source-backed · checked</em></div>
      <div class="cs-builder-grid">
        <label>Career rule<select id="careerShapeBuilderRule">${Object.entries(BUILDER_RULES).map(([k,r])=>`<option value="${k}">${esc(r.label)}</option>`).join("")}</select></label>
        <label id="csOperatorLabel">Match<select id="careerShapeBuilderOperator"><option value="gte">At least</option><option value="eq">Exactly</option><option value="lte">At most</option></select></label>
        <label id="csValueLabel">Value<input id="careerShapeBuilderValue" type="number" value="4"></label>
        <label>Optional season qualifier<select id="careerShapeBuilderExtra"><option value="none">None</option><option value="points">FPL points at least</option><option value="minutes">Minutes at least</option></select></label>
        <label id="csExtraValueLabel" hidden>Qualifier value<input id="careerShapeBuilderExtraValue" type="number" min="0" max="3500" value="100"></label>
      </div>
      <div class="cs-builder-actions"><button id="applyCareerShapeBuilderBtn" class="button secondary small-button" type="button">Use Career Shape rule</button><button id="clearCareerShapeBuilderBtn" class="button secondary small-button" type="button" hidden>Return to standard rule builder</button></div>
      <p id="careerShapeBuilderStatus">Numeric Career Shape rules support at least, exactly and at most.</p>`;
    const name=root.querySelector(".name-rule-presets"); if(name)name.after(box);else root.prepend(box);
    const select=document.getElementById("careerShapeBuilderRule"), extra=document.getElementById("careerShapeBuilderExtra"), value=document.getElementById("careerShapeBuilderValue");
    const update=()=>{const rule=BUILDER_RULES[select.value],numeric=rule.kind==="number";document.getElementById("csOperatorLabel").hidden=!numeric;document.getElementById("csValueLabel").hidden=!numeric;if(numeric){value.min=rule.min;value.max=rule.max;if(Number(value.value)<rule.min||Number(value.value)>rule.max)value.value=rule.defaultValue;}document.getElementById("csExtraValueLabel").hidden=extra.value==="none";};
    select.addEventListener("change",update);extra.addEventListener("change",update);update();
    document.getElementById("applyCareerShapeBuilderBtn").addEventListener("click",applyStarter);
    document.getElementById("clearCareerShapeBuilderBtn").addEventListener("click",clearStarter);
    ["careerShapeBuilderOperator","careerShapeBuilderValue","careerShapeBuilderExtraValue"].forEach(id=>document.getElementById(id)?.addEventListener("change",()=>builderState&&applyStarter()));
    document.getElementById("promptEditorPosition")?.addEventListener("change",()=>builderState&&applyStarter());
    document.getElementById("testPromptBtn")?.addEventListener("click",testStarter,true);
    document.getElementById("savePromptBtn")?.addEventListener("click",saveStarter,true);
    document.getElementById("newPromptBtn")?.addEventListener("click",clearStarter);
    document.getElementById("cancelPromptEditBtn")?.addEventListener("click",clearStarter);
    document.getElementById("promptEditor")?.addEventListener("click",e=>{if(e.target.closest("[data-name-preset]"))clearStarter();});
  }

  function starterDefinition(){
    const key=document.getElementById("careerShapeBuilderRule")?.value||"everChampion", rule=BUILDER_RULES[key];
    const operator=rule.kind==="number"?(document.getElementById("careerShapeBuilderOperator")?.value||"gte"):"gte";
    const value=rule.kind==="number"?Number(document.getElementById("careerShapeBuilderValue")?.value||rule.defaultValue):0;
    const extra=document.getElementById("careerShapeBuilderExtra")?.value||"none", extraValue=Number(document.getElementById("careerShapeBuilderExtraValue")?.value||0);
    const position=POSITIONS.includes(document.getElementById("promptEditorPosition")?.value)?document.getElementById("promptEditorPosition").value:"GK";
    const combined=withQualifier(expressionFor(key,operator,value),wordingFor(position,key,operator,value),extra,extraValue);
    return {key,rule,operator,value,extra,extraValue,position,combined,source:`p => (${combined.expression})`};
  }

  function applyStarter(){
    builderState=starterDefinition();const d=builderState,a=analyse({position:d.position,test:makeTest(d.combined.expression)});
    const suffix=d.rule.kind==="number"?`_${d.operator}_${Math.round(d.value)}`:"", ex=d.extra==="none"?"":`_${d.extra}_${Math.round(d.extraValue)}`;
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.value=value;};
    const idInput=document.getElementById("promptEditorId");if(idInput&&!idInput.disabled)idInput.value=uniqueId(`career_shape_custom_${d.position.toLowerCase()}_${d.key}${suffix}${ex}`);
    set("promptEditorLabel",d.combined.label);set("promptEditorFail",d.combined.fail);set("promptEditorDifficulty",a.playerCount<=12?"hard":a.playerCount<=35?"medium":"easy");set("promptEditorRating",a.playerCount<=60?"5":"4");set("promptEditorCooldown","10");
    set("promptEditorTags",["career-shape","career","custom",d.key.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`),d.combined.tag].filter(Boolean).join(", "));
    const enabled=document.getElementById("promptEditorEnabled");if(enabled)enabled.checked=a.playerCount>=6&&a.playerCount<=100;
    hideStandard(true);document.getElementById("clearCareerShapeBuilderBtn").hidden=false;
    document.getElementById("careerShapeBuilderStatus").textContent=`${a.playerCount} distinct footballers qualify. Test the rule and examples before saving.`;
    const notice=document.getElementById("promptEditorNotice");if(notice)notice.textContent="Career Shape rule active. The standard condition rows are temporarily hidden; Test and Save use this safe source-backed rule.";
  }
  function hideStandard(hidden){document.getElementById("promptEditor")?.classList.toggle("career-shape-builder-active",hidden);const rows=document.getElementById("promptRuleRows"),add=document.getElementById("addPromptConditionBtn"),join=document.getElementById("promptRuleJoin")?.closest("label");if(rows)rows.hidden=hidden;if(add)add.hidden=hidden;if(join)join.hidden=hidden;}
  function clearStarter(){if(!builderState&&!document.getElementById("promptEditor")?.classList.contains("career-shape-builder-active"))return;builderState=null;hideStandard(false);const clear=document.getElementById("clearCareerShapeBuilderBtn");if(clear)clear.hidden=true;const s=document.getElementById("careerShapeBuilderStatus");if(s)s.textContent="Numeric Career Shape rules support at least, exactly and at most.";}
  function testStarter(event){if(!builderState)return;event.preventDefault();event.stopImmediatePropagation();const d=starterDefinition(),a=analyse({position:d.position,test:makeTest(d.combined.expression)}),host=document.getElementById("promptTestResults");host.innerHTML=`<div class="cs-test"><strong>${a.playerCount} distinct valid footballers · ${a.seasonCount} matching player-seasons</strong>${a.examples.length?`<ol>${a.examples.map(x=>`<li>${esc(x.playerName)} — ${esc(x.season)}, ${esc(x.club)} · ${x.points} pts</li>`).join("")}</ol>`:"<p>No valid examples found.</p>"}</div>`;}
  function saveStarter(event){
    if(!builderState)return;event.preventDefault();event.stopImmediatePropagation();const d=starterDefinition(),status=document.getElementById("careerShapeBuilderStatus");
    const id=String(document.getElementById("promptEditorId")?.value||"").trim().toLowerCase().replace(/[^a-z0-9_]+/g,"_").replace(/^_+|_+$/g,""),label=String(document.getElementById("promptEditorLabel")?.value||"").trim(),fail=String(document.getElementById("promptEditorFail")?.value||"").trim();
    if(!id||!label||!fail){status.textContent="Add an ID, wording and invalid-answer message before saving.";return;}
    const test=makeTest(d.combined.expression),a=analyse({position:d.position,test});if(a.errors||a.playerCount<3){status.textContent=a.errors?"The rule threw an error and was not saved.":"Fewer than three footballers qualify, so it was not saved.";return;}
    const source=`p => (${d.combined.expression})`,prompt={id,position:d.position,label,fail,difficulty:document.getElementById("promptEditorDifficulty")?.value||"medium",tags:String(document.getElementById("promptEditorTags")?.value||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,12),rating:Math.max(1,Math.min(5,Math.round(Number(document.getElementById("promptEditorRating")?.value)||4))),cooldown:Math.max(0,Math.min(50,Math.round(Number(document.getElementById("promptEditorCooldown")?.value)||10))),enabled:Boolean(document.getElementById("promptEditorEnabled")?.checked),studioRule:{kind:"source",source},testSource:source,test};
    const added=persist([prompt],`Career Shape prompt “${label}” saved to the browser library.`);if(!added){status.textContent="That prompt ID already exists. Change the ID before saving.";return;}location.reload();
  }

  function installQuality(){
    const analyser=document.getElementById("promptQualityAnalyser");if(!analyser||document.getElementById("careerShapeQualityTools"))return;
    const tools=document.createElement("div");tools.id="careerShapeQualityTools";tools.className="cs-quality";tools.innerHTML='<span>Career Shape quality</span><button id="showCareerShapeQualityBtn" class="button secondary small-button" type="button">Show Career Shape prompts</button><small>Same breadth, overlap, difficulty and rule-health checks as every other prompt.</small>';
    analyser.querySelector(".prompt-quality-head")?.after(tools);
    document.getElementById("showCareerShapeQualityBtn").addEventListener("click",()=>{const search=document.getElementById("qualitySearch");if(!search)return;search.value="career_shape";search.dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("promptQualityFilters")?.classList.remove("hidden");});
  }

  function observeReturnWording(){
    const preview=document.getElementById("promptFactoryPreview");if(!preview||preview.dataset.csReturnObserved)return;preview.dataset.csReturnObserved="1";
    const rewrite=root=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const text=node.nodeValue||"";if(/returned to a former Premier League club/i.test(text)&&!/after playing for another Premier League club/i.test(text))node.nodeValue=text.replace(/returned to a former Premier League club/gi,RETURN_WORDING);}};
    new MutationObserver(rs=>rs.forEach(r=>r.addedNodes.forEach(n=>n.nodeType===1&&rewrite(n)))).observe(preview,{childList:true,subtree:true});rewrite(preview);
  }

  function addStyles(){
    if(document.getElementById("careerShapeStudioStyles"))return;const style=document.createElement("style");style.id="careerShapeStudioStyles";style.textContent=`
      .career-shape-factory,.career-shape-builder{margin:10px 0;padding:10px;border:1px solid rgba(111,215,255,.15);border-radius:11px;background:rgba(111,215,255,.025)}
      .cs-head,.cs-builder-head{display:flex;justify-content:space-between;gap:10px;align-items:start}.cs-head>div,.cs-builder-head>div{display:grid;gap:2px}.cs-head span{color:#6fd7ff;font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.cs-head strong,.cs-builder-head strong{font-size:.8rem}.cs-head em,.cs-builder-head em,.cs-builder-head span{color:#91aa9d;font-size:.62rem;font-style:normal}
      .cs-controls,.cs-builder-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.cs-controls label,.cs-builder-grid label{margin:0;font-size:.65rem}.cs-controls select,.cs-builder-grid select,.cs-builder-grid input{min-height:38px!important;margin-top:4px!important}
      .cs-actions{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:7px;margin-top:8px}.cs-actions .button{width:100%;margin:0}.cs-preview{display:grid;gap:6px;margin-top:8px}.cs-card{padding:8px;border:1px solid rgba(196,231,211,.1);border-radius:9px;background:rgba(0,0,0,.12)}.cs-card label{display:grid;grid-template-columns:auto 34px minmax(0,1fr);gap:7px;align-items:center}.cs-card label input{width:18px;height:18px;margin:0}.cs-card>div{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}.cs-card>div span{padding:3px 6px;border-radius:999px;background:rgba(111,215,255,.07);color:#a9e8ff;font-size:.6rem}.cs-card small{color:#718a7c;font-size:.61rem;line-height:1.35}.cs-empty{padding:9px;border:1px dashed rgba(196,231,211,.12);border-radius:8px;color:#91aa9d;font-size:.68rem}
      .career-shape-builder{border-color:rgba(87,242,135,.14);background:rgba(87,242,135,.025)}.cs-builder-head em{color:#57f287}.cs-builder-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.cs-builder-actions .button{margin:0}.career-shape-builder p{color:#91aa9d;font-size:.63rem}.cs-test{padding:9px;border:1px solid rgba(87,242,135,.14);border-radius:9px;background:rgba(87,242,135,.025)}.cs-test ol{margin:7px 0 0;padding-left:20px}.cs-test li{margin:3px 0;color:#91aa9d;font-size:.67rem}
      .cs-quality{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin:-2px 0 9px;padding:8px;border:1px solid rgba(111,215,255,.12);border-radius:9px;background:rgba(111,215,255,.02)}.cs-quality>span{color:#6fd7ff;font-size:.64rem;font-weight:900}.cs-quality small{flex:1 1 220px;color:#718a7c;font-size:.61rem}
      @media(max-width:720px){.cs-head{display:grid}.cs-head em{text-align:left}.cs-actions{grid-template-columns:1fr 1fr}.cs-actions #generateCareerShapeBatchBtn{grid-column:1/-1}.cs-card label{grid-template-columns:auto 30px minmax(0,1fr)}}
      @media(max-width:390px){.cs-controls,.cs-builder-grid{grid-template-columns:1fr}}
    `;document.head.append(style);
  }

  function ensureMobileCss(){
    if(document.querySelector("link[data-cs-prompt-mobile]"))return;const link=document.createElement("link");link.rel="stylesheet";link.href=`admin-prompts-mobile-v1.css?v=1.0.0&cs=${VERSION}`;link.dataset.csPromptMobile=VERSION;document.head.append(link);
  }

  function restoreMessage(){const m=sessionStorage.getItem(LOCAL_MESSAGE_KEY);if(!m)return;sessionStorage.removeItem(LOCAL_MESSAGE_KEY);const target=document.getElementById("careerShapeFactoryStatus")||document.getElementById("managerStatus");if(target)target.textContent=m;}

  function init(){
    if(!document.getElementById("automaticPromptFactory"))return;
    ensureMobileCss();addStyles();installFactory();installBuilder();installQuality();observeReturnWording();restoreMessage();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();

  window.FPL_CAREER_SHAPE_STUDIO=Object.freeze({version:VERSION,rules:BUILDER_RULES,expressionFor,wordingFor});
})();
