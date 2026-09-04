/* FPL Draft Challenge — Prompt Studio V3 deliberate candidate generator v3.3.0.
   Generates shortlist evidence only. Nothing is saved until the user explicitly chooses a
   candidate, and every saved candidate enters the isolated V3 library as a disabled Draft. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_V3_CANDIDATE_GENERATOR?.ready) return;

  const VERSION = "3.3.0";
  const SUPPORTED_FAMILIES = Object.freeze(new Set([
    "season-stats", "combined-stats", "exact-bands", "club-stat", "position-stat",
    "league-position", "promoted-clubs", "relegated-clubs", "champions",
    "career-longevity", "club-count", "manager", "anti-meta", "value",
    "minutes-role", "composite-story"
  ]));
  const POSITION_LABELS = Object.freeze({ ANY:"Player", GK:"Goalkeeper", DEF:"Defender", MID:"Midfielder", FWD:"Forward" });
  const STAT_THRESHOLDS = Object.freeze({
    points:[60,75,90,105,120,135,150,165,180],
    goals:[3,5,7,10,12,15,18,20],
    assists:[3,5,7,9,11,13,15],
    goalInvolvements:[8,10,12,15,18,20,25,30],
    cleanSheets:[4,6,8,10,12,14,16],
    bonus:[3,6,9,12,15,18,21],
    saves:[40,60,80,100,120,140],
    minutes:[1200,1800,2200,2600,3000],
    careerSeasonCount:[3,5,7,9,11],
    careerClubCount:[2,3,4,5,6]
  });
  const EXACT_VALUES = Object.freeze({
    goals:[1,2,3,4,5,6,7,8,10],
    assists:[1,2,3,4,5,6,7,8,10],
    cleanSheets:[3,4,5,6,7,8,10,12],
    bonus:[0,3,6,9,12,15]
  });

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const clone = value => JSON.parse(JSON.stringify(value));
  const slug = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,54);

  let installed = false;
  let running = false;
  let currentCandidates = [];

  function v3() { return window.FPL_PROMPT_STUDIO_V3 || null; }
  function tester() { return window.FPL_PROMPT_STUDIO_V3_RULE_TESTER || null; }
  function engine() { return window.ValidationEngine || null; }
  function players() { return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : []; }
  function state() { return v3()?.getState?.() || { prompts:[] }; }
  function families() { return v3()?.getFamilies?.() || []; }

  function allEntries() {
    const rows = [];
    for (const player of players()) for (const record of player.seasons || []) rows.push({ player, season:record.season });
    return rows;
  }

  function topClubs(limit = 18) {
    const counts = new Map();
    for (const player of players()) for (const record of player.seasons || []) {
      if (!(Number(record.minutes) > 0) || !record.club) continue;
      counts.set(record.club,(counts.get(record.club) || 0) + 1);
    }
    return [...counts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0,limit).map(([club]) => club);
  }

  function topManagers(limit = 16) {
    const managerPlayers = new Map();
    for (const player of players()) for (const record of player.seasons || []) {
      if (!(Number(record.minutes) > 0)) continue;
      for (const raw of Array.isArray(record.managers) ? record.managers : []) {
        const name = String(raw || "").trim();
        if (!name) continue;
        if (!managerPlayers.has(name)) managerPlayers.set(name,new Set());
        managerPlayers.get(name).add(player.playerId);
      }
    }
    return [...managerPlayers.entries()].sort((a,b) => b[1].size - a[1].size || a[0].localeCompare(b[0])).slice(0,limit).map(([name]) => name);
  }

  function statFieldsForPosition(position) {
    if (position === "GK") return ["points","saves","cleanSheets","bonus"];
    if (position === "DEF") return ["points","cleanSheets","goals","assists","bonus"];
    if (position === "MID") return ["points","goals","assists","goalInvolvements","bonus"];
    if (position === "FWD") return ["points","goals","assists","goalInvolvements","bonus"];
    return ["points","goals","assists","goalInvolvements","cleanSheets","bonus"];
  }

  function rulePhrase(rule) {
    const value = String(rule.value ?? "").trim();
    const value2 = String(rule.value2 ?? "").trim();
    const nouns = {
      points:"FPL points", minutes:"minutes", goals:"goals", assists:"assists",
      goalInvolvements:"goal involvements", cleanSheets:"clean sheets", bonus:"bonus points",
      saves:"saves", careerSeasonCount:"recorded Premier League seasons", careerClubCount:"recorded Premier League clubs"
    };
    const flags = {
      champions:"played for the league champions", topFour:"played for a top-four club",
      bottomHalf:"played for a bottom-half club", relegated:"played for a relegated club",
      promoted:"played for a promoted club", outsideBigSix:"played outside the traditional Big Six"
    };
    if (flags[rule.field]) return flags[rule.field];
    if (rule.field === "club") return value ? `played for ${value}` : "";
    if (rule.field === "manager") return value ? `was managed by ${value}` : "";
    if (rule.field === "startingPrice") return value ? `had a starting price of £${value}m or less` : "";
    const noun = nouns[rule.field];
    if (!noun || !value) return "";
    const verb = rule.field === "careerSeasonCount" || rule.field === "careerClubCount" ? "had" : "recorded";
    if (rule.operator === "eq") return `${verb} exactly ${value} ${noun}`;
    if (rule.operator === "lte") return `${verb} at most ${value} ${noun}`;
    if (rule.operator === "between") return value2 ? `${verb} between ${value} and ${value2} ${noun}` : "";
    return `${verb} at least ${value} ${noun}`;
  }

  function buildWording(position, rules) {
    const clauses = rules.map(rulePhrase).filter(Boolean);
    return `${POSITION_LABELS[position] || "Player"}${clauses.length ? ` who ${clauses.join(" and ")}` : ""}`;
  }

  const rule = (field, operator, value = "", value2 = "") => ({ field, operator, value:String(value), value2:String(value2) });

  function makeSpecs(family, position) {
    const specs = [];
    const add = rules => specs.push({ position, rules });
    const stats = statFieldsForPosition(position);

    if (family === "season-stats" || family === "position-stat") {
      for (const field of stats) for (const value of STAT_THRESHOLDS[field] || []) add([rule(field,"gte",value)]);
    } else if (family === "combined-stats") {
      const pairs = position === "GK"
        ? [["saves","cleanSheets"],["points","saves"],["points","cleanSheets"]]
        : [["goals","assists"],["points","goals"],["points","assists"],["goals","goalInvolvements"]];
      for (const [left,right] of pairs) {
        const leftValues = (STAT_THRESHOLDS[left] || []).slice(0,6);
        const rightValues = (STAT_THRESHOLDS[right] || []).slice(0,5);
        for (const a of leftValues) for (const b of rightValues) add([rule(left,"gte",a),rule(right,"gte",b)]);
      }
    } else if (family === "exact-bands") {
      for (const field of stats.filter(name => EXACT_VALUES[name])) for (const value of EXACT_VALUES[field]) add([rule(field,"eq",value)]);
    } else if (family === "club-stat") {
      for (const club of topClubs()) for (const points of [75,90,105,120,135,150]) add([rule("club","is",club),rule("points","gte",points)]);
    } else if (family === "league-position") {
      for (const flag of ["topFour","bottomHalf","outsideBigSix"]) for (const points of [75,90,105,120,135,150]) add([rule(flag,"is"),rule("points","gte",points)]);
    } else if (["promoted-clubs","relegated-clubs","champions"].includes(family)) {
      const flag = family === "promoted-clubs" ? "promoted" : family === "relegated-clubs" ? "relegated" : "champions";
      for (const points of [60,75,90,105,120,135,150]) add([rule(flag,"is"),rule("points","gte",points)]);
      if (position !== "GK") for (const goals of [3,5,7,10,12,15]) add([rule(flag,"is"),rule("goals","gte",goals)]);
    } else if (family === "career-longevity") {
      for (const value of STAT_THRESHOLDS.careerSeasonCount) add([rule("careerSeasonCount","gte",value)]);
    } else if (family === "club-count") {
      for (const value of STAT_THRESHOLDS.careerClubCount) add([rule("careerClubCount","gte",value)]);
    } else if (family === "manager") {
      for (const manager of topManagers()) for (const points of [75,90,105,120,135]) add([rule("manager","is",manager),rule("points","gte",points)]);
    } else if (family === "anti-meta") {
      for (const points of [75,90,105,120,135,150]) add([rule("outsideBigSix","is"),rule("points","gte",points)]);
      if (position !== "GK") for (const goals of [5,7,10,12,15]) add([rule("outsideBigSix","is"),rule("goals","gte",goals)]);
    } else if (family === "value") {
      for (const price of [4.5,5,5.5,6,6.5,7]) for (const points of [80,100,120,140,160]) add([rule("startingPrice","lte",price),rule("points","gte",points)]);
    } else if (family === "minutes-role") {
      const outputField = position === "GK" ? "saves" : position === "DEF" ? "cleanSheets" : position === "MID" ? "assists" : "goals";
      for (const minutes of [1800,2200,2600,3000]) for (const output of (STAT_THRESHOLDS[outputField] || []).slice(0,5)) add([rule("minutes","gte",minutes),rule(outputField,"gte",output)]);
    } else if (family === "composite-story") {
      const flags = ["relegated","promoted","topFour","outsideBigSix"];
      const outputField = position === "GK" ? "saves" : position === "DEF" ? "cleanSheets" : position === "MID" ? "assists" : "goals";
      for (const flag of flags) for (const points of [75,100,125]) for (const output of (STAT_THRESHOLDS[outputField] || []).slice(0,4)) add([rule(flag,"is"),rule("points","gte",points),rule(outputField,"gte",output)]);
    }

    const seen = new Set();
    return specs.map(spec => ({ ...spec, wording:buildWording(spec.position,spec.rules) }))
      .filter(spec => spec.wording && !seen.has(spec.wording) && seen.add(spec.wording))
      .slice(0,120);
  }

  function candidateId(family, position, wording) {
    let hash = 2166136261;
    for (const char of wording) { hash ^= char.charCodeAt(0); hash = Math.imul(hash,16777619); }
    return `v3_${slug(family)}_${String(position || "any").toLowerCase()}_${(hash >>> 0).toString(36)}`;
  }

  function suggestedDifficulty(position, count) {
    const hard = position === "GK" ? 10 : position === "FWD" ? 14 : position === "ANY" ? 22 : 18;
    const easy = position === "GK" ? 32 : position === "FWD" ? 50 : position === "ANY" ? 100 : 70;
    if (count <= hard) return "hard";
    if (count >= easy) return "easy";
    return "medium";
  }

  function evaluateSpec(spec, rows, progress) {
    const validation = engine();
    const inspection = tester()?.inspectWording?.(spec.position,spec.rules,spec.wording);
    if (!inspection?.safe) return Promise.resolve(null);
    return new Promise(resolve => {
      const ids = new Set();
      const seasons = new Set();
      const clubs = new Set();
      let runtimeErrors = 0;
      let index = 0;
      const chunk = () => {
        const end = Math.min(index + 350, rows.length);
        for (; index < end; index += 1) {
          const entry = rows[index];
          let result;
          try { result = validation.evaluatePrompt(entry.player,entry.season,spec.wording); }
          catch (_) { runtimeErrors += 1; continue; }
          if (!result?.ok) { runtimeErrors += 1; continue; }
          if (!result.passed || !(Number(result.record?.minutes) > 0)) continue;
          ids.add(entry.player.playerId);
          seasons.add(String(result.record?.season || ""));
          clubs.add(String(result.record?.club || ""));
        }
        progress?.(rows.length ? index / rows.length : 1);
        if (index < rows.length) window.setTimeout(chunk,0);
        else resolve({ ...spec, ids, answers:ids.size, seasons:seasons.size, clubs:clubs.size, runtimeErrors });
      };
      chunk();
    });
  }

  async function generate(root) {
    if (running) return;
    const form = root.querySelector("[data-v3-candidate-generator-form]");
    if (!form) return;
    const family = String(form.elements.family.value || "");
    const position = String(form.elements.position.value || "ANY");
    const minAnswers = Math.max(1,Number(form.elements.minAnswers.value || 1));
    const maxAnswers = Math.max(minAnswers,Number(form.elements.maxAnswers.value || minAnswers));
    const limit = Math.max(1,Math.min(20,Number(form.elements.limit.value || 10)));
    if (!SUPPORTED_FAMILIES.has(family)) return window.alert("Choose one of the currently generator-supported V3 families.");
    if (!engine()?.evaluatePrompt || !tester()?.inspectWording || !players().length) return window.alert("Player database, Validation Engine and V3 rule tester must be ready first.");

    const specs = makeSpecs(family,position);
    if (!specs.length) return window.alert("This family does not yet have a deliberate generator recipe.");
    const rows = allEntries();
    const button = form.querySelector("[data-v3-generate-candidates]");
    const status = root.querySelector("[data-v3-candidate-status]");
    const progressBar = root.querySelector("[data-v3-candidate-progress] i");
    const results = [];
    running = true;
    button.disabled = true;
    if (progressBar) progressBar.style.width = "0%";

    for (let index = 0; index < specs.length; index += 1) {
      status.textContent = `Testing candidate ${index + 1} / ${specs.length} against the real database…`;
      const evaluated = await evaluateSpec(specs[index],rows,fraction => {
        if (progressBar) progressBar.style.width = `${Math.round(((index + fraction) / specs.length) * 100)}%`;
      });
      if (!evaluated || evaluated.runtimeErrors > 0) continue;
      if (evaluated.answers >= minAnswers && evaluated.answers <= maxAnswers) results.push(evaluated);
    }

    const midpoint = (minAnswers + maxAnswers) / 2;
    currentCandidates = results
      .sort((a,b) => Math.abs(a.answers - midpoint) - Math.abs(b.answers - midpoint) || b.seasons - a.seasons || b.clubs - a.clubs || a.wording.localeCompare(b.wording))
      .slice(0,limit)
      .map(candidate => ({
        ...candidate,
        id:candidateId(family,position,candidate.wording),
        family,
        difficulty:suggestedDifficulty(position,candidate.answers),
        target:{ minAnswers,maxAnswers }
      }));

    running = false;
    button.disabled = false;
    if (progressBar) progressBar.style.width = "100%";
    status.textContent = currentCandidates.length
      ? `${currentCandidates.length} candidate${currentCandidates.length === 1 ? "" : "s"} matched the ${minAnswers}–${maxAnswers} player target. Nothing has been saved.`
      : `No safe candidate matched the ${minAnswers}–${maxAnswers} player target. Try a wider range or another family.`;
    renderResults(root);
  }

  function renderResults(root) {
    const host = root.querySelector("[data-v3-candidate-results]");
    if (!host) return;
    if (!currentCandidates.length) {
      host.innerHTML = '<div class="prompt-v3-empty">Generate a shortlist. Candidates remain temporary until you explicitly add one as a disabled V3 Draft.</div>';
      return;
    }
    const existing = new Set(state().prompts.map(prompt => prompt.id));
    host.innerHTML = currentCandidates.map((candidate,index) => `<article class="prompt-v3-candidate-row">
      <div><h4>${esc(candidate.wording)}</h4><p>${candidate.answers} valid players · ${candidate.seasons} seasons · ${candidate.clubs} clubs · suggested ${esc(candidate.difficulty)} difficulty</p><div class="prompt-v3-meta"><span>${esc(candidate.family)}</span><span>${esc(candidate.position)}</span><span>Target ${candidate.target.minAnswers}–${candidate.target.maxAnswers}</span><span>Parser-safe</span></div></div>
      <button type="button" class="prompt-v3-button primary" data-v3-add-candidate="${index}"${existing.has(candidate.id) ? " disabled" : ""}>${existing.has(candidate.id) ? "Already in V3" : "Add as disabled Draft"}</button>
    </article>`).join("");
  }

  function addCandidate(root,index) {
    const candidate = currentCandidates[Number(index)];
    if (!candidate) return;
    if (state().prompts.some(prompt => prompt.id === candidate.id)) return window.alert("That candidate is already in the V3 library.");
    const create = root.querySelector("[data-v3-create-form]");
    if (!create) return window.alert("V3 Draft form is unavailable.");
    create.elements.id.value = candidate.id;
    create.elements.position.value = candidate.position;
    create.elements.label.value = candidate.wording;
    create.elements.difficulty.value = candidate.difficulty;
    create.elements.family.value = candidate.family;
    create.elements.notes.value = `[V3 deliberate candidate generator]\nTarget answer pool: ${candidate.target.minAnswers}–${candidate.target.maxAnswers}\nMeasured: ${candidate.answers} players · ${candidate.seasons} seasons · ${candidate.clubs} clubs\nRules: ${candidate.rules.map(item => `${item.field}:${item.operator}:${item.value || "true"}${item.value2 ? `:${item.value2}` : ""}`).join(" | ")}\n\nThis is a Draft only. It still requires real Test → advisory Quality → human Review.`;
    create.requestSubmit();
    window.setTimeout(() => renderResults(root),0);
  }

  function familyOptions() {
    return families().filter(family => SUPPORTED_FAMILIES.has(family.id))
      .map(family => `<option value="${esc(family.id)}">${esc(family.name)} · ${esc(family.tier)}</option>`).join("");
  }

  function installStyles() {
    if (document.getElementById("promptV3CandidateGeneratorStyles")) return;
    const style = document.createElement("style");
    style.id = "promptV3CandidateGeneratorStyles";
    style.textContent = `
      .prompt-v3-candidate-generator{display:grid;gap:13px;margin-top:16px;padding:14px;border:1px solid rgba(255,196,87,.2);border-radius:14px;background:rgba(255,196,87,.035)}
      .prompt-v3-candidate-generator h3,.prompt-v3-candidate-generator p{margin:0}.prompt-v3-candidate-generator-form{display:grid;grid-template-columns:1.2fr .8fr .7fr .7fr .6fr;gap:8px;align-items:end}.prompt-v3-candidate-generator-form label{display:grid;gap:5px;font-size:.76rem}.prompt-v3-candidate-generator-form select,.prompt-v3-candidate-generator-form input{width:100%;box-sizing:border-box;padding:9px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#06150d;color:#f2fff6}
      .prompt-v3-candidate-progress{height:7px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.08)}.prompt-v3-candidate-progress i{display:block;height:100%;width:0;background:#ffc457;transition:width .12s linear}.prompt-v3-candidate-results{display:grid;gap:8px}.prompt-v3-candidate-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:11px}.prompt-v3-candidate-row h4,.prompt-v3-candidate-row p{margin:0}.prompt-v3-candidate-row p{margin-top:5px;color:#aebdb4;font-size:.78rem}
      @media(max-width:800px){.prompt-v3-candidate-generator-form{grid-template-columns:1fr 1fr}.prompt-v3-candidate-generator-form label:first-child{grid-column:1/-1}.prompt-v3-candidate-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (installed) return true;
    const root = document.getElementById("promptStudioV3");
    const createCard = root?.querySelector('[data-v3-view="create"] .prompt-v3-card');
    if (!root || !createCard || !v3() || !tester()) return false;
    if (createCard.querySelector("[data-v3-candidate-generator]")) { installed = true; return true; }
    installStyles();
    const box = document.createElement("section");
    box.className = "prompt-v3-candidate-generator";
    box.dataset.v3CandidateGenerator = "1";
    box.innerHTML = `
      <div><h3>Deliberate candidate generator</h3><p>Choose a family and desired answer-pool range. V3 tests candidate recipes against the real database and returns a shortlist only. Nothing is added until you choose <strong>Add as disabled Draft</strong>.</p></div>
      <form class="prompt-v3-candidate-generator-form" data-v3-candidate-generator-form>
        <label>Family<select name="family" required><option value="">Choose supported family</option>${familyOptions()}</select></label>
        <label>Position<select name="position"><option value="ANY">Any</option><option value="GK">GK</option><option value="DEF">DEF</option><option value="MID">MID</option><option value="FWD">FWD</option></select></label>
        <label>Min answers<input name="minAnswers" type="number" min="1" value="8"></label>
        <label>Max answers<input name="maxAnswers" type="number" min="1" value="40"></label>
        <label>Shortlist<input name="limit" type="number" min="1" max="20" value="10"></label>
        <button type="submit" class="prompt-v3-button" data-v3-generate-candidates>Generate shortlist</button>
      </form>
      <div class="prompt-v3-candidate-progress" data-v3-candidate-progress><i></i></div>
      <p data-v3-candidate-status style="color:#aebdb4">Ready. ${SUPPORTED_FAMILIES.size} family recipes are available in this first deliberate-generation slice.</p>
      <div class="prompt-v3-candidate-results" data-v3-candidate-results></div>
    `;
    createCard.appendChild(box);
    renderResults(root);
    box.querySelector("[data-v3-candidate-generator-form]").addEventListener("submit",event => { event.preventDefault(); generate(root); });
    box.addEventListener("click",event => {
      const button = event.target.closest("[data-v3-add-candidate]");
      if (button) addCandidate(root,button.dataset.v3AddCandidate);
    });
    window.addEventListener("fpl:prompt-studio-v3-changed",() => renderResults(root));
    installed = true;
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v3-candidate-generator-ready",{ detail:{ version:VERSION, supportedFamilies:SUPPORTED_FAMILIES.size } }));
    return true;
  }

  window.FPL_PROMPT_STUDIO_V3_CANDIDATE_GENERATOR = Object.freeze({
    ready:true,
    version:VERSION,
    supportedFamilies:Object.freeze([...SUPPORTED_FAMILIES]),
    install,
    getCandidates:() => clone(currentCandidates.map(candidate => ({ ...candidate, ids:undefined })))
  });

  const boot = () => {
    if (install()) return;
    let attempts = 0;
    const timer = setInterval(() => { attempts += 1; if (install() || attempts > 80) clearInterval(timer); },100);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",boot,{ once:true }); else boot();
})();
