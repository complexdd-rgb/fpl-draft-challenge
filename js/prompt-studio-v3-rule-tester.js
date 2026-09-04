/* FPL Draft Challenge — Prompt Studio V3 safe rule builder + database tester v3.1.0.
   This module is advisory/testing infrastructure only. It cannot rate, approve, enable,
   delete, promote or publish a V3 prompt. Production remains on the frozen certified pool. */
(() => {
  "use strict";

  if (window.FPL_PROMPT_STUDIO_V3_RULE_TESTER?.ready) return;

  const VERSION = "3.1.0";
  const RULE_STORE_KEY = "fplPromptStudioV3RuleDefinitions";
  const TEST_DETAIL_KEY = "fplPromptStudioV3TestDetails";
  const POSITION_LABELS = Object.freeze({ ANY:"Player", GK:"Goalkeeper", DEF:"Defender", MID:"Midfielder", FWD:"Forward" });
  const NUMERIC_OPERATORS = Object.freeze([
    ["gte", "At least"],
    ["lte", "At most"],
    ["eq", "Exactly"],
    ["between", "Between"]
  ]);

  const FIELD_DEFS = Object.freeze({
    points:{ label:"FPL points", type:"number", noun:"FPL points" },
    minutes:{ label:"Minutes", type:"number", noun:"minutes" },
    goals:{ label:"Goals", type:"number", noun:"goals" },
    assists:{ label:"Assists", type:"number", noun:"assists" },
    goalInvolvements:{ label:"Goal involvements", type:"number", noun:"goal involvements" },
    cleanSheets:{ label:"Clean sheets", type:"number", noun:"clean sheets" },
    bonus:{ label:"Bonus points", type:"number", noun:"bonus points" },
    saves:{ label:"Saves", type:"number", noun:"saves" },
    goalsConceded:{ label:"Goals conceded", type:"number", noun:"goals conceded" },
    yellowCards:{ label:"Yellow cards", type:"number", noun:"yellow cards" },
    redCards:{ label:"Red cards", type:"number", noun:"red cards" },
    startingPrice:{ label:"Starting price", type:"price", noun:"starting price" },
    finalPrice:{ label:"Final price", type:"price", noun:"final price" },
    careerSeasonCount:{ label:"Career season count", type:"career", noun:"recorded Premier League seasons" },
    careerClubCount:{ label:"Career club count", type:"career", noun:"recorded Premier League clubs" },
    champions:{ label:"League champions", type:"flag", phrase:"played for the league champions" },
    topFour:{ label:"Top-four club", type:"flag", phrase:"played for a top-four club" },
    bottomHalf:{ label:"Bottom-half club", type:"flag", phrase:"played for a bottom-half club" },
    relegated:{ label:"Relegated club", type:"flag", phrase:"played for a relegated club" },
    promoted:{ label:"Promoted club", type:"flag", phrase:"played for a promoted club" },
    outsideBigSix:{ label:"Outside Big Six", type:"flag", phrase:"played outside the traditional Big Six" },
    assistsMoreThanGoals:{ label:"More assists than goals", type:"flag", phrase:"recorded more assists than goals" },
    returnedToFormerClub:{ label:"Returned to former club", type:"flag", phrase:"returned to a former Premier League club" },
    season:{ label:"Season", type:"season" },
    club:{ label:"Club", type:"club" },
    manager:{ label:"Manager", type:"manager" }
  });

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const clone = value => JSON.parse(JSON.stringify(value));

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  let ruleStore = readJson(RULE_STORE_KEY, {});
  let testDetails = readJson(TEST_DETAIL_KEY, {});
  let builderRules = [{ field:"points", operator:"gte", value:"100", value2:"" }];
  let installed = false;
  let running = false;

  function engine() {
    return window.ValidationEngine || null;
  }

  function v3State() {
    return window.FPL_PROMPT_STUDIO_V3?.getState?.() || { prompts:[] };
  }

  function families() {
    return window.FPL_PROMPT_STUDIO_V3?.getFamilies?.() || [];
  }

  function players() {
    return Array.isArray(window.FPL_PLAYERS) ? window.FPL_PLAYERS : [];
  }

  function uniqueClubs() {
    return [...new Set(players().flatMap(player => (player.seasons || [])
      .filter(season => Number(season.minutes) > 0)
      .map(season => String(season.club || "").trim()))
      .filter(Boolean))].sort((a,b) => a.localeCompare(b));
  }

  function uniqueManagers() {
    return [...new Set(players().flatMap(player => (player.seasons || [])
      .flatMap(season => Array.isArray(season.managers) ? season.managers : []))
      .map(value => String(value || "").trim()).filter(Boolean))]
      .sort((a,b) => a.localeCompare(b));
  }

  function seasons() {
    const values = engine()?.getAllSeasonLabels?.();
    if (Array.isArray(values) && values.length) return values;
    return [...new Set(players().flatMap(player => (player.seasons || []).map(season => season.season)).filter(Boolean))].sort().reverse();
  }

  function operatorOptions(rule) {
    const type = FIELD_DEFS[rule.field]?.type;
    if (type === "flag" || type === "club" || type === "manager") return [["is", "Is"]];
    if (type === "season") return [["equals","In season"],["before","Before"],["after","After"],["between","Between"]];
    return NUMERIC_OPERATORS;
  }

  function normaliseRule(rule) {
    const def = FIELD_DEFS[rule.field] || FIELD_DEFS.points;
    const allowed = operatorOptions(rule).map(([value]) => value);
    const operator = allowed.includes(rule.operator) ? rule.operator : allowed[0];
    return { field:rule.field in FIELD_DEFS ? rule.field : "points", operator, value:String(rule.value ?? ""), value2:String(rule.value2 ?? "") };
  }

  function rulePhrase(rule) {
    const def = FIELD_DEFS[rule.field];
    if (!def) return "";
    const value = String(rule.value || "").trim();
    const value2 = String(rule.value2 || "").trim();
    if (def.type === "flag") return def.phrase;
    if (def.type === "club") return value ? `played for ${value}` : "";
    if (def.type === "manager") return value ? `was managed by ${value}` : "";
    if (def.type === "season") {
      if (!value) return "";
      if (rule.operator === "before") return `played before the ${value} season`;
      if (rule.operator === "after") return `played after the ${value} season`;
      if (rule.operator === "between") return value2 ? `played between ${value} and ${value2} seasons` : "";
      return `played in the ${value} season`;
    }
    if (!value) return "";
    if (def.type === "price") {
      if (rule.operator === "between") return value2 ? `${def.noun} between ${value} and ${value2}` : "";
      if (rule.operator === "lte") return `${def.noun} of £${value}m or less`;
      if (rule.operator === "gte") return `at least ${value} ${def.noun}`;
      return `exactly ${value} ${def.noun}`;
    }
    const noun = def.noun;
    if (rule.operator === "between") return value2 ? `between ${value} and ${value2} ${noun}` : "";
    if (rule.operator === "lte") return `at most ${value} ${noun}`;
    if (rule.operator === "eq") return `exactly ${value} ${noun}`;
    return `at least ${value} ${noun}`;
  }

  function buildWording(position, rules) {
    const clauses = rules.map(rulePhrase).filter(Boolean);
    const subject = POSITION_LABELS[position] || "Player";
    if (!clauses.length) return subject;
    return `${subject} who ${clauses.join(" and ")}`;
  }

  function expectedFields(position, rules) {
    const fields = rules.map(rule => rule.field);
    if (position !== "ANY") fields.unshift("position");
    return fields;
  }

  function inspectWording(position, rules, wording) {
    const validation = engine();
    if (!validation?.parsePromptText || !players().length) return { ready:false, safe:false, message:"Player database / Validation Engine is still loading.", parsed:null };
    const parsed = validation.parsePromptText(wording, position === "ANY" ? "" : position);
    const expected = expectedFields(position, rules);
    const parsedFields = parsed.rules.map(rule => rule.field);
    const missing = expected.filter(field => !parsedFields.includes(field));
    const unexpected = parsedFields.filter(field => !expected.includes(field));
    const duplicates = rules.map(rule => rule.field).filter((field,index,array) => array.indexOf(field) !== index);
    const safe = parsed.recognised && missing.length === 0 && unexpected.length === 0 && duplicates.length === 0 && rules.every(rule => rulePhrase(rule));
    const messages = [];
    if (missing.length) messages.push(`Missing parser rules: ${missing.join(", ")}`);
    if (unexpected.length) messages.push(`Unexpected parser rules: ${unexpected.join(", ")}`);
    if (duplicates.length) messages.push(`Use each field once: ${[...new Set(duplicates)].join(", ")}`);
    if (!rules.every(rule => rulePhrase(rule))) messages.push("Complete every rule value.");
    return { ready:true, safe, message:safe ? `Safe mapping confirmed: ${parsedFields.join(" + ")}.` : (messages.join(" · ") || "Wording is not safely recognised."), parsed, missing, unexpected };
  }

  function fieldOptions(selected) {
    return Object.entries(FIELD_DEFS).map(([id,def]) => `<option value="${id}"${id === selected ? " selected" : ""}>${esc(def.label)}</option>`).join("");
  }

  function operatorMarkup(rule) {
    return operatorOptions(rule).map(([value,label]) => `<option value="${value}"${value === rule.operator ? " selected" : ""}>${label}</option>`).join("");
  }

  function valueMarkup(rule, index) {
    const def = FIELD_DEFS[rule.field];
    if (def.type === "flag") return '<span class="prompt-v3-auto-value">Yes</span>';
    if (def.type === "club") return `<input data-builder-value="${index}" list="promptV3ClubList" value="${esc(rule.value)}" placeholder="Choose club">`;
    if (def.type === "manager") return `<input data-builder-value="${index}" list="promptV3ManagerList" value="${esc(rule.value)}" placeholder="Manager name">`;
    if (def.type === "season") {
      const options = seasons().map(value => `<option value="${esc(value)}"${value === rule.value ? " selected" : ""}>${esc(value)}</option>`).join("");
      const second = rule.operator === "between" ? `<select data-builder-value2="${index}"><option value="">End season</option>${seasons().map(value => `<option value="${esc(value)}"${value === rule.value2 ? " selected" : ""}>${esc(value)}</option>`).join("")}</select>` : "";
      return `<select data-builder-value="${index}"><option value="">Choose season</option>${options}</select>${second}`;
    }
    const step = def.type === "price" ? "0.1" : "1";
    const second = rule.operator === "between" ? `<input data-builder-value2="${index}" type="number" step="${step}" value="${esc(rule.value2)}" placeholder="Maximum">` : "";
    return `<input data-builder-value="${index}" type="number" step="${step}" value="${esc(rule.value)}" placeholder="Value">${second}`;
  }

  function installStyles() {
    if (document.getElementById("promptV3RuleTesterStyles")) return;
    const style = document.createElement("style");
    style.id = "promptV3RuleTesterStyles";
    style.textContent = `
      .prompt-v3-builder{display:grid;gap:14px;margin-bottom:18px;padding:14px;border:1px solid rgba(114,239,136,.18);border-radius:14px;background:rgba(114,239,136,.035)}
      .prompt-v3-builder-rules{display:grid;gap:9px}.prompt-v3-builder-rule{display:grid;grid-template-columns:1.2fr .8fr 1.2fr auto;gap:8px;align-items:center;padding:9px;border:1px solid rgba(255,255,255,.08);border-radius:11px}
      .prompt-v3-builder-rule select,.prompt-v3-builder-rule input{width:100%;box-sizing:border-box;padding:9px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#06150d;color:#f2fff6}.prompt-v3-builder-values{display:grid;grid-template-columns:1fr 1fr;gap:6px}.prompt-v3-auto-value{padding:9px;color:#9fe9ae}
      .prompt-v3-preview{padding:12px;border-radius:12px;border:1px solid rgba(98,201,255,.16);background:rgba(98,201,255,.05)}.prompt-v3-preview strong{display:block;margin-bottom:5px}.prompt-v3-safe{color:#8ff3a2}.prompt-v3-unsafe{color:#ff9bad}
      .prompt-v3-test-auto{display:grid;gap:12px}.prompt-v3-test-result{display:grid;gap:10px;margin-top:12px}.prompt-v3-test-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.prompt-v3-test-metrics article{padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:10px}.prompt-v3-test-metrics span{display:block;color:#9eb4a7;font-size:.72rem}.prompt-v3-test-metrics strong{font-size:1.15rem}.prompt-v3-samples{display:grid;gap:6px}.prompt-v3-samples div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.035)}
      .prompt-v3-progress{height:7px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.08)}.prompt-v3-progress i{display:block;height:100%;width:0;background:#72ef88;transition:width .12s linear}
      @media(max-width:800px){.prompt-v3-builder-rule{grid-template-columns:1fr}.prompt-v3-test-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function renderBuilderRules(host) {
    host.innerHTML = builderRules.map((raw,index) => {
      const rule = normaliseRule(raw);
      builderRules[index] = rule;
      return `<div class="prompt-v3-builder-rule" data-builder-index="${index}">
        <select data-builder-field="${index}">${fieldOptions(rule.field)}</select>
        <select data-builder-operator="${index}">${operatorMarkup(rule)}</select>
        <div class="prompt-v3-builder-values">${valueMarkup(rule,index)}</div>
        <button type="button" class="prompt-v3-button danger" data-builder-remove="${index}"${builderRules.length === 1 ? " disabled" : ""}>Remove</button>
      </div>`;
    }).join("");
  }

  function familyOptions() {
    return families().map(family => `<option value="${esc(family.id)}">${esc(family.name)}</option>`).join("");
  }

  function installBuilder(root) {
    const view = root.querySelector('[data-v3-view="create"] .prompt-v3-card');
    const baseForm = root.querySelector("[data-v3-create-form]");
    if (!view || !baseForm || view.querySelector("[data-v3-safe-builder]")) return;
    const box = document.createElement("div");
    box.className = "prompt-v3-builder";
    box.dataset.v3SafeBuilder = "1";
    box.innerHTML = `
      <div><h3 style="margin:0">Safe rule builder</h3><p style="margin:5px 0 0">Build from rule types the shared Validation Engine already understands. The generated wording must map back to exactly the rules you selected before it can be saved.</p></div>
      <form class="prompt-v3-form" data-v3-builder-form>
        <label>Prompt ID<input name="id" required placeholder="e.g. mid_relegated_100_points"></label>
        <label>Position<select name="position"><option value="ANY">Any position</option><option value="GK">Goalkeeper</option><option value="DEF">Defender</option><option value="MID">Midfielder</option><option value="FWD">Forward</option></select></label>
        <label>Difficulty<select name="difficulty"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select></label>
        <label>Family<select name="family"><option value="">Choose a family</option>${familyOptions()}</select></label>
        <div class="wide prompt-v3-builder-rules" data-v3-builder-rules></div>
        <div class="wide prompt-v3-actions"><button type="button" class="prompt-v3-button" data-builder-add>Add rule</button></div>
        <label class="wide">Design notes<textarea name="notes" placeholder="Optional human design notes"></textarea></label>
        <div class="wide prompt-v3-preview" data-v3-builder-preview></div>
        <div class="wide prompt-v3-actions"><button type="submit" class="prompt-v3-button primary" data-v3-builder-save>Save safe disabled draft</button></div>
      </form>
      <datalist id="promptV3ClubList">${uniqueClubs().map(value => `<option value="${esc(value)}"></option>`).join("")}</datalist>
      <datalist id="promptV3ManagerList">${uniqueManagers().map(value => `<option value="${esc(value)}"></option>`).join("")}</datalist>
      <details><summary>Manual wording fallback</summary><p>Use this only when a family is not yet covered by the safe builder. It will still need the same database-backed Test step.</p></details>
    `;
    view.insertBefore(box, baseForm);
    baseForm.closest("form")?.classList.add("prompt-v3-manual-create");
    baseForm.hidden = true;

    const form = box.querySelector("[data-v3-builder-form]");
    const rulesHost = box.querySelector("[data-v3-builder-rules]");
    const preview = box.querySelector("[data-v3-builder-preview]");

    const updatePreview = () => {
      builderRules = builderRules.map(normaliseRule);
      const position = form.elements.position.value;
      const wording = buildWording(position, builderRules);
      const inspection = inspectWording(position, builderRules, wording);
      preview.innerHTML = `<strong>${esc(wording)}</strong><span class="${inspection.safe ? "prompt-v3-safe" : "prompt-v3-unsafe"}">${esc(inspection.message)}</span>`;
      form.querySelector("[data-v3-builder-save]").disabled = !inspection.safe;
    };

    renderBuilderRules(rulesHost);
    updatePreview();

    form.addEventListener("change", event => {
      const field = event.target.dataset.builderField;
      const operator = event.target.dataset.builderOperator;
      const value = event.target.dataset.builderValue;
      const value2 = event.target.dataset.builderValue2;
      if (field !== undefined) {
        const index = Number(field);
        builderRules[index] = normaliseRule({ field:event.target.value, operator:"", value:"", value2:"" });
        renderBuilderRules(rulesHost);
      } else if (operator !== undefined) {
        const index = Number(operator); builderRules[index].operator = event.target.value; builderRules[index] = normaliseRule(builderRules[index]); renderBuilderRules(rulesHost);
      } else if (value !== undefined) builderRules[Number(value)].value = event.target.value;
      else if (value2 !== undefined) builderRules[Number(value2)].value2 = event.target.value;
      updatePreview();
    });
    form.addEventListener("input", event => {
      const value = event.target.dataset.builderValue;
      const value2 = event.target.dataset.builderValue2;
      if (value !== undefined) builderRules[Number(value)].value = event.target.value;
      if (value2 !== undefined) builderRules[Number(value2)].value2 = event.target.value;
      updatePreview();
    });
    form.addEventListener("click", event => {
      const add = event.target.closest("[data-builder-add]");
      if (add) {
        if (builderRules.length >= 3) return window.alert("Keep safe-builder prompts to three structured rules in this slice. Composite families can be expanded later.");
        builderRules.push({ field:"goals", operator:"gte", value:"5", value2:"" }); renderBuilderRules(rulesHost); updatePreview(); return;
      }
      const remove = event.target.closest("[data-builder-remove]");
      if (remove) {
        builderRules.splice(Number(remove.dataset.builderRemove),1); renderBuilderRules(rulesHost); updatePreview();
      }
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const position = form.elements.position.value;
      const wording = buildWording(position, builderRules);
      const inspection = inspectWording(position, builderRules, wording);
      if (!inspection.safe) return window.alert(`Safe builder cannot save this wording yet. ${inspection.message}`);
      const id = String(form.elements.id.value || "").trim();
      if (!id) return;
      const create = root.querySelector("[data-v3-create-form]");
      create.elements.id.value = id;
      create.elements.position.value = position;
      create.elements.label.value = wording;
      create.elements.difficulty.value = form.elements.difficulty.value;
      create.elements.family.value = form.elements.family.value;
      create.elements.notes.value = `${String(form.elements.notes.value || "").trim()}\n\n[V3 safe-builder rules] ${builderRules.map(rule => `${rule.field}:${rule.operator}:${rule.value}${rule.value2 ? `:${rule.value2}` : ""}`).join(" | ")}`.trim();
      create.requestSubmit();
      if (!v3State().prompts.some(prompt => prompt.id === id)) return;
      ruleStore[id] = { version:VERSION, position, rules:clone(builderRules), wording, parserFields:inspection.parsed.rules.map(rule => rule.field), savedAt:new Date().toISOString() };
      writeJson(RULE_STORE_KEY, ruleStore);
      form.reset();
      builderRules = [{ field:"points", operator:"gte", value:"100", value2:"" }];
      renderBuilderRules(rulesHost); updatePreview();
      requestAnimationFrame(() => {
        const testTab = root.querySelector('[data-v3-tab="test"]');
        testTab?.click();
        const select = root.querySelector("[data-v3-auto-test-select]");
        if (select) { select.value = id; renderLatestTest(root,id); }
      });
    });
  }

  function promptOptions(selected="") {
    return v3State().prompts.map(prompt => `<option value="${esc(prompt.id)}"${prompt.id === selected ? " selected" : ""}>${esc(prompt.label)}</option>`).join("");
  }

  function technicalMapping(prompt) {
    const validation = engine();
    if (!validation?.parsePromptText) return { safe:false, message:"Validation Engine unavailable", parsed:null };
    const parsed = validation.parsePromptText(prompt.label, prompt.position === "ANY" ? "" : prompt.position);
    const stored = ruleStore[prompt.id];
    if (!stored) return { safe:parsed.recognised, message:parsed.recognised ? `Manual wording recognised: ${parsed.rules.map(rule => rule.field).join(" + ")}` : "No supported rules recognised.", parsed };
    const expected = expectedFields(stored.position, stored.rules);
    const actual = parsed.rules.map(rule => rule.field);
    const missing = expected.filter(field => !actual.includes(field));
    const unexpected = actual.filter(field => !expected.includes(field));
    return { safe:parsed.recognised && !missing.length && !unexpected.length, message:!missing.length && !unexpected.length ? `Safe-builder mapping intact: ${actual.join(" + ")}` : `Rule mapping changed. Missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}.`, parsed };
  }

  function allEntries() {
    const rows = [];
    for (const player of players()) for (const record of player.seasons || []) rows.push({ player, season:record.season });
    return rows;
  }

  function runDatabaseTest(root, promptId) {
    if (running) return;
    const prompt = v3State().prompts.find(item => item.id === promptId);
    const validation = engine();
    if (!prompt) return window.alert("Choose a V3 prompt first.");
    if (!validation?.evaluatePrompt || !validation?.parsePromptText || !players().length) return window.alert("Player database / Validation Engine is not ready yet.");
    const mapping = technicalMapping(prompt);
    const entries = allEntries();
    const byPlayer = new Map();
    const seasonSet = new Set();
    const clubSet = new Set();
    let runtimeErrors = 0;
    let zeroMinuteAccepted = 0;
    let index = 0;
    running = true;

    const button = root.querySelector("[data-v3-run-auto-test]");
    const progress = root.querySelector("[data-v3-auto-test-progress] i");
    const status = root.querySelector("[data-v3-auto-test-status]");
    button.disabled = true;
    status.textContent = `Testing ${entries.length.toLocaleString("en-GB")} player-season rows…`;

    const finish = () => {
      const samples = [...byPlayer.values()].sort((a,b) => Number(b.record.points || 0) - Number(a.record.points || 0) || a.player.name.localeCompare(b.player.name)).slice(0,12);
      const technical = mapping.safe && runtimeErrors === 0 && zeroMinuteAccepted === 0 && byPlayer.size > 0 ? "pass" : "fail";
      const detail = {
        version:VERSION,
        promptId:prompt.id,
        label:prompt.label,
        checked:entries.length,
        answers:byPlayer.size,
        seasons:seasonSet.size,
        clubs:clubSet.size,
        runtimeErrors,
        zeroMinuteAccepted,
        technical,
        parserRecognised:Boolean(mapping.parsed?.recognised),
        parserFields:mapping.parsed?.rules?.map(rule => rule.field) || [],
        mappingMessage:mapping.message,
        samples:samples.map(item => ({ playerId:item.player.playerId, name:item.player.name, season:item.record.season, club:item.record.club, points:item.record.points })),
        testedAt:new Date().toISOString()
      };
      testDetails[prompt.id] = detail;
      writeJson(TEST_DETAIL_KEY, testDetails);

      const baseForm = root.querySelector("[data-v3-test-form]");
      baseForm.elements.id.value = prompt.id;
      baseForm.elements.answers.value = String(detail.answers);
      baseForm.elements.seasons.value = String(detail.seasons);
      baseForm.elements.clubs.value = String(detail.clubs);
      baseForm.elements.technical.value = technical;
      baseForm.elements.notes.value = `Automatic V3 database test. ${detail.checked} player-season rows checked; ${detail.answers} unique valid players; ${detail.seasons} seasons; ${detail.clubs} clubs; ${runtimeErrors} runtime errors; ${zeroMinuteAccepted} zero-minute answers. ${mapping.message}`;
      baseForm.requestSubmit();
      running = false;
      button.disabled = false;
      if (progress) progress.style.width = "100%";
      requestAnimationFrame(() => {
        root.querySelector('[data-v3-tab="test"]')?.click();
        const select = root.querySelector("[data-v3-auto-test-select]");
        if (select) select.value = prompt.id;
        renderLatestTest(root,prompt.id);
      });
    };

    const chunk = () => {
      const end = Math.min(index + 250, entries.length);
      for (; index < end; index += 1) {
        const entry = entries[index];
        let result;
        try { result = validation.evaluatePrompt(entry.player, entry.season, prompt.label); }
        catch (_) { runtimeErrors += 1; continue; }
        if (!result?.ok) { runtimeErrors += 1; continue; }
        if (!result.passed) continue;
        if (!(Number(result.record?.minutes) > 0)) zeroMinuteAccepted += 1;
        seasonSet.add(String(result.record?.season || ""));
        clubSet.add(String(result.record?.club || ""));
        const current = byPlayer.get(entry.player.playerId);
        if (!current || Number(result.record?.points || 0) > Number(current.record?.points || 0)) byPlayer.set(entry.player.playerId, result);
      }
      if (progress) progress.style.width = `${entries.length ? Math.round((index / entries.length) * 100) : 100}%`;
      status.textContent = `Checked ${index.toLocaleString("en-GB")} / ${entries.length.toLocaleString("en-GB")} rows · ${byPlayer.size.toLocaleString("en-GB")} valid players`;
      if (index < entries.length) window.setTimeout(chunk,0); else finish();
    };
    chunk();
  }

  function renderLatestTest(root, promptId) {
    const host = root.querySelector("[data-v3-auto-test-result]");
    if (!host) return;
    const detail = testDetails[promptId];
    const prompt = v3State().prompts.find(item => item.id === promptId);
    if (!prompt) { host.innerHTML = '<div class="prompt-v3-empty">Choose a prompt to see its database evidence.</div>'; return; }
    const mapping = technicalMapping(prompt);
    if (!detail) {
      host.innerHTML = `<div class="prompt-v3-note"><strong>${esc(mapping.safe ? "Rule mapping recognised" : "Rule mapping needs work")}</strong><br>${esc(mapping.message)}<br>Run the database test to calculate real answer coverage.</div>`;
      return;
    }
    host.innerHTML = `<div class="prompt-v3-test-result">
      <div class="prompt-v3-note"><strong>${detail.technical === "pass" ? "Technical test PASS" : "Technical test FAIL"}</strong><br>${esc(detail.mappingMessage)} · Tested ${esc(new Date(detail.testedAt).toLocaleString("en-GB"))}</div>
      <div class="prompt-v3-test-metrics">
        <article><span>Valid players</span><strong>${Number(detail.answers).toLocaleString("en-GB")}</strong></article>
        <article><span>Seasons</span><strong>${Number(detail.seasons).toLocaleString("en-GB")}</strong></article>
        <article><span>Clubs</span><strong>${Number(detail.clubs).toLocaleString("en-GB")}</strong></article>
        <article><span>Rows checked</span><strong>${Number(detail.checked).toLocaleString("en-GB")}</strong></article>
        <article><span>Runtime errors</span><strong>${Number(detail.runtimeErrors).toLocaleString("en-GB")}</strong></article>
      </div>
      <div><strong>Top valid examples</strong><div class="prompt-v3-samples">${(detail.samples || []).map(sample => `<div><span>${esc(sample.name)} · ${esc(sample.season)} · ${esc(sample.club)}</span><strong>${Number(sample.points || 0).toLocaleString("en-GB")} pts</strong></div>`).join("") || '<div>No valid examples.</div>'}</div></div>
    </div>`;
  }

  function installTester(root) {
    const view = root.querySelector('[data-v3-view="test"] .prompt-v3-card');
    const baseForm = root.querySelector("[data-v3-test-form]");
    if (!view || !baseForm || view.querySelector("[data-v3-auto-test]")) return;
    const box = document.createElement("div");
    box.className = "prompt-v3-test-auto";
    box.dataset.v3AutoTest = "1";
    box.innerHTML = `
      <p class="prompt-v3-note"><strong>Database-backed Test is authoritative in V3.</strong><br>Answer counts, season breadth, club breadth and technical validity are calculated from the loaded player database. These values are no longer typed manually.</p>
      <label>V3 prompt<select data-v3-auto-test-select><option value="">Choose a V3 prompt</option>${promptOptions()}</select></label>
      <div class="prompt-v3-actions"><button type="button" class="prompt-v3-button primary" data-v3-run-auto-test>Run real database test</button></div>
      <div class="prompt-v3-progress" data-v3-auto-test-progress><i></i></div>
      <p data-v3-auto-test-status style="margin:0;color:#9eb4a7">Ready.</p>
      <div data-v3-auto-test-result><div class="prompt-v3-empty">Choose a prompt to inspect its rule mapping and test evidence.</div></div>
    `;
    view.insertBefore(box, baseForm);
    baseForm.hidden = true;
    const select = box.querySelector("[data-v3-auto-test-select]");
    select.addEventListener("change", () => renderLatestTest(root,select.value));
    box.querySelector("[data-v3-run-auto-test]").addEventListener("click", () => runDatabaseTest(root,select.value));
  }

  function refresh(root) {
    const select = root.querySelector("[data-v3-auto-test-select]");
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">Choose a V3 prompt</option>${promptOptions(current)}`;
    if ([...select.options].some(option => option.value === current)) select.value = current;
    renderLatestTest(root,select.value);
  }

  function install() {
    if (installed) return true;
    const root = document.getElementById("promptStudioV3");
    if (!root || !window.FPL_PROMPT_STUDIO_V3) return false;
    installStyles();
    installBuilder(root);
    installTester(root);
    window.addEventListener("fpl:prompt-studio-v3-changed", () => refresh(root));
    installed = true;
    window.dispatchEvent(new CustomEvent("fpl:prompt-studio-v3-rule-tester-ready", { detail:{ version:VERSION } }));
    return true;
  }

  const api = Object.freeze({
    ready:true,
    version:VERSION,
    ruleStoreKey:RULE_STORE_KEY,
    testDetailKey:TEST_DETAIL_KEY,
    install,
    getRuleDefinition:id => clone(ruleStore[id] || null),
    getTestDetail:id => clone(testDetails[id] || null),
    inspectWording
  });
  window.FPL_PROMPT_STUDIO_V3_RULE_TESTER = api;

  const boot = () => {
    if (install()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts > 80) clearInterval(timer);
    },100);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",boot,{ once:true }); else boot();
})();
