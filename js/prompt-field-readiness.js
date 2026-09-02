/* FPL Draft Challenge — prompt field readiness v1.1.0 */
(() => {
  "use strict";
  if (window.FPL_PROMPT_FIELD_GUARD?.version === "1.1.0") return;

  const HISTORICAL_CORE = new Set(["season","name","club","position","minutes","goals","yellowCards","redCards","ownGoals","cleanSheets","goalsConceded","relegated","promoted","bottomHalf","topFour","champions","managers","ageAtSeasonStart","nationality"]);
  const FPL_NATIVE = new Set(["points","assists","bonus","saves","startingPrice","finalPrice"]);

  const library = () => {
    const api = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);
  };
  const known = value => value !== null && value !== undefined && value !== "";
  const requiredFields = prompt => Array.isArray(prompt?.requiredFields) ? prompt.requiredFields : [];

  function seasonReady(record, field) {
    if (!record || typeof record !== "object") return false;
    if (field === "nationality") return Boolean(String(record?._career?.nationality || record?.nationality || "").trim());
    return known(record[field]);
  }

  function promptReadyForRecord(prompt, record) {
    const fields = requiredFields(prompt);
    if (!fields.length) return true;
    return fields.every(field => seasonReady(record, field));
  }

  function classifyField(field) {
    if (HISTORICAL_CORE.has(field)) return "historical-core";
    if (FPL_NATIVE.has(field)) return "fpl-native";
    return "other";
  }

  function guardCollection(prompts = library()) {
    if (!Array.isArray(prompts)) return prompts;
    for (const prompt of prompts) {
      if (!prompt || typeof prompt !== "object") continue;
      const fields = requiredFields(prompt);
      prompt.fieldReadiness = Object.freeze({
        requiredFields: [...fields],
        classes: [...new Set(fields.map(classifyField))],
        historicalSafe: prompt.historicalSafe === true || fields.every(field => !FPL_NATIVE.has(field))
      });
    }
    return prompts;
  }

  function apply() {
    const prompts = library();
    if (!prompts.length) return false;
    guardCollection(prompts);
    window.FPL_PROMPT_FIELD_GUARD = Object.freeze({
      version: "1.1.0",
      promptReadyForRecord,
      guardCollection,
      requiredFields,
      classifyField
    });
    window.dispatchEvent(new CustomEvent("fpl:prompt-field-readiness-ready", { detail: { prompts: prompts.length } }));
    return true;
  }

  function loadScript(src, marker, done) {
    const existing = document.querySelector(`script[${marker}]`);
    if (existing) {
      if (existing.dataset.loaded === "true") done?.();
      else existing.addEventListener("load", () => done?.(), { once: true });
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
    loadScript("nationality-enrichment.js?v=1.1.1","data-nationality-enrichment",()=>{
      loadScript("js/prompt-nationality-context-pack-v1.js?v=1.0.2","data-nationality-context-prompt-pack-v1");
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
