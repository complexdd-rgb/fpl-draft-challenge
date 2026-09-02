/* FPL Draft Challenge — prompt field-readiness mapper v1.0.5
   Maps every prompt to the player-season fields it needs and labels whether the rule can
   work from historical core data or requires FPL-native recovery. This is metadata only;
   the existing missing-field guard remains the runtime authority. */
(() => {
  "use strict";
  const FPL_NATIVE = new Set(["points","assists","bonus","startingPrice","endingPrice","price","saves","penaltiesSaved","penaltiesMissed"]);
  const HISTORICAL_CORE = new Set(["season","name","club","position","minutes","goals","yellowCards","redCards","ownGoals","cleanSheets","goalsConceded","relegated","promoted","bottomHalf","topFour","champions","managers","ageAtSeasonStart","_career"]);

  function library() {
    const api = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  }

  function fallbackDependencies(prompt) {
    const fields = new Set(Array.isArray(prompt?.requiredFields) ? prompt.requiredFields : []);
    const source = String(prompt?.testSource || prompt?.studioRule?.source || prompt?.test || "");
    for (const match of source.matchAll(/\bp\.([A-Za-z_$][\w$]*)/g)) fields.add(match[1]);
    const derived = {goalInvolvements:["goals","assists"],outsideBigSix:["club"],assistsMoreThanGoals:["assists","goals"],hasManager:["managers"],ageBetween:["ageAtSeasonStart"]};
    for (const [token,deps] of Object.entries(derived)) if (source.includes(token)) deps.forEach(dep=>fields.add(dep));
    return [...fields];
  }

  function dependencies(prompt) {
    const guard = window.FPL_PROMPT_FIELD_GUARD;
    if (guard?.promptDependencies) {
      try { return [...new Set([...(prompt?.requiredFields || []), ...guard.promptDependencies(prompt)])]; }
      catch (_) {}
    }
    return fallbackDependencies(prompt);
  }

  function tier(fields) {
    if (!fields.length) return "IDENTITY_OR_NAME_ONLY";
    const fpl = fields.filter(field => FPL_NATIVE.has(field));
    const unknown = fields.filter(field => !FPL_NATIVE.has(field) && !HISTORICAL_CORE.has(field));
    if (fpl.length && unknown.length) return "MIXED_FPL_NATIVE_AND_OTHER";
    if (fpl.length) return "REQUIRES_FPL_NATIVE";
    if (unknown.length) return "REQUIRES_ADDITIONAL_RECOVERY";
    return "HISTORICAL_CORE_ELIGIBLE";
  }

  function apply() {
    const prompts = library();
    if (!prompts.length) return false;
    const counts = new Map();
    const fieldCounts = new Map();
    for (const prompt of prompts) {
      const fields = dependencies(prompt);
      const readiness = tier(fields);
      try {
        if (!Array.isArray(prompt.requiredFields) || !prompt.requiredFields.length) prompt.requiredFields = fields;
        prompt.historicalReadiness = readiness;
        prompt.tags = [...new Set([...(prompt.tags || []), readiness === "HISTORICAL_CORE_ELIGIBLE" ? "historical-core-eligible" : readiness === "REQUIRES_FPL_NATIVE" ? "requires-fpl-native" : "requires-extra-recovery"])];
      } catch (_) {}
      counts.set(readiness,(counts.get(readiness)||0)+1);
      fields.forEach(field=>fieldCounts.set(field,(fieldCounts.get(field)||0)+1));
    }
    window.FPL_PROMPT_FIELD_READINESS = Object.freeze({
      ready:true,
      version:"1.0.5",
      promptCount:prompts.length,
      tiers:Object.fromEntries([...counts.entries()].sort()),
      fieldUsage:Object.fromEntries([...fieldCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))),
      classify:prompt=>({requiredFields:dependencies(prompt),historicalReadiness:tier(dependencies(prompt))})
    });
    window.dispatchEvent(new CustomEvent("fpl:prompt-field-readiness-ready",{detail:window.FPL_PROMPT_FIELD_READINESS}));
    return true;
  }

  function loadScript(src, marker, done) {
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) {
      if (done) {
        if (existing.dataset.loaded === "true") queueMicrotask(done);
        else existing.addEventListener("load", done, { once:true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = new URL(src, document.baseURI).toString();
    script.async = false;
    script.setAttribute(marker,"1");
    script.addEventListener("load",()=>{
      script.dataset.loaded = "true";
      done?.();
    },{once:true});
    document.head.appendChild(script);
  }
  function loadExtras() {
    loadScript("nationality-enrichment.js?v=1.1.0","data-nationality-enrichment",()=>{
      loadScript("js/prompt-nationality-context-pack-v1.js?v=1.0.0","data-nationality-context-prompt-pack-v1");
    });
    loadScript("js/historical-season-field-manifest.js?v=1.0.0","data-historical-season-field-manifest");
    loadScript("js/historical-prompt-unlock-audit.js?v=1.0.0","data-historical-prompt-unlock-audit");
    loadScript("js/prompt-field-readiness-panel.js?v=1.1.0","data-prompt-field-readiness-panel");
  }

  let attempts=0;
  function boot(){if(apply()){loadExtras();return;}if(++attempts<80)setTimeout(boot,100);}
  boot();
  window.addEventListener("fpl:prompt-library-changed",apply);
  window.addEventListener("fpl:prompt-tools-ready",()=>{apply();loadExtras();});
})();
