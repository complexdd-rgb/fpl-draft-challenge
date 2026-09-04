import fs from 'node:fs';

const survivorPackPath = 'js/prompt-refinement-survivors-v1.js';
const survivorPack = `/* FPL Challenge Studio — Refinement Survivor Pack v1.0.0
   Replaces two held 3★ Quality Enforcement v2 parents with variants proven by the
   deterministic Incubator trial and a full-library quality/overlap recheck. */
(() => {
  "use strict";

  if (window.FPL_REFINEMENT_SURVIVOR_PACK_V1?.ready) return;

  const VERSION = "1.0.0";
  const PARENT_IDS = Object.freeze([
    "quality_v2_mid_price_6_gi_15",
    "quality_v3_fwd_manager_david_moyes_p55"
  ]);
  const DEFINITIONS = Object.freeze([
    Object.freeze({
      id: "refinement_survivor_v1_mid_price_6_5_gi_15",
      family: "refinement-survivor-v1:budget-goal-involvements",
      position: "MID",
      label: "Midfielder who started at £6.5m or less with 15+ goal involvements",
      fail: "That midfielder must start at £6.5m or less and record at least 15 combined goals and assists in the qualifying season.",
      difficulty: "easy",
      tags: ["refinement-survivor", "survivor-of:quality_v2_mid_price_6_gi_15", "quality-pack", "quality-pack-v2", "checked", "anti-meta", "midfielder", "budget", "starting-price", "goal-involvements"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      requiredFields: ["startingPrice", "goals", "assists", "minutes"],
      studioRule: { kind: "builder", join: "all", conditions: [
        { field: "startingPrice", operator: "lte", value: 6.5, value2: 0 },
        { field: "goalInvolvements", operator: "gte", value: 15, value2: 0 },
        { field: "minutes", operator: "gt", value: 0, value2: 0 }
      ] },
      testSource: "p => ((Number.isFinite(p.startingPrice) && p.startingPrice <= 6.5) && (Number.isFinite((p.goals + p.assists)) && (p.goals + p.assists) >= 15) && (Number.isFinite(p.minutes) && p.minutes > 0))"
    }),
    Object.freeze({
      id: "refinement_survivor_v1_fwd_manager_david_moyes_p75",
      family: "refinement-survivor-v1:manager-points",
      position: "FWD",
      label: "Forward managed by David Moyes who scored 75+ FPL points",
      fail: "That forward season must have been managed by David Moyes and score at least 75 FPL points.",
      difficulty: "medium",
      tags: ["refinement-survivor", "survivor-of:quality_v3_fwd_manager_david_moyes_p55", "quality-pack", "quality-pack-v3", "checked", "anti-meta", "manager", "points"],
      rating: 4,
      cooldown: 10,
      enabled: true,
      requiredFields: ["managers", "points", "minutes"],
      studioRule: { kind: "source", source: "p => (Array.isArray(p.managers) && p.managers.some(value => String(value || \\\"\\\").trim().toLowerCase() === \\\"david moyes\\\") && Number.isFinite(Number(p.points)) && Number(p.points) >= 75 && Number(p.minutes) > 0)" },
      testSource: "p => (Array.isArray(p.managers) && p.managers.some(value => String(value || \\\"\\\").trim().toLowerCase() === \\\"david moyes\\\") && Number.isFinite(Number(p.points)) && Number(p.points) >= 75 && Number(p.minutes) > 0)"
    })
  ]);

  function compile(source) {
    try {
      const fn = Function(\`"use strict"; return (\${source});\`)();
      return typeof fn === "function" ? fn : null;
    } catch (_) { return null; }
  }

  function library() {
    const api = window.FPL_STUDIO_API?.getPromptLibrary?.();
    return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null);
  }

  function install() {
    const items = library();
    if (!items || !window.FPL_APPROVED_PROMPT_BASELINE?.ready) return false;

    const survivorIds = new Set(DEFINITIONS.map(definition => definition.id));
    const parentIds = new Set(PARENT_IDS);
    let removedParents = 0;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const id = String(items[index]?.id || "");
      if (!parentIds.has(id) && !survivorIds.has(id)) continue;
      if (parentIds.has(id)) removedParents += 1;
      items.splice(index, 1);
    }

    const added = [];
    for (const definition of DEFINITIONS) {
      const test = compile(definition.testSource);
      if (!test) throw new Error(\`Could not compile refinement survivor \${definition.id}.\`);
      const prompt = {
        ...definition,
        tags: [...definition.tags],
        requiredFields: [...definition.requiredFields],
        studioRule: JSON.parse(JSON.stringify(definition.studioRule)),
        test,
        _studioBuiltIn: false,
        _studioCustom: true
      };
      items.push(prompt);
      added.push(prompt.id);
    }

    window.FPL_STUDIO_API?.invalidatePromptStats?.();
    const parentsPresentAfter = items.filter(prompt => parentIds.has(String(prompt?.id || ""))).length;
    window.FPL_REFINEMENT_SURVIVOR_PACK_V1 = Object.freeze({
      ready: true,
      version: VERSION,
      parentIds: PARENT_IDS,
      ids: Object.freeze([...added]),
      removedParents,
      parentsPresentAfter,
      added: added.length
    });
    window.dispatchEvent(new CustomEvent("fpl:prompt-library-changed", { detail: { source: "refinement-survivors-v1", removedParents, added: added.length } }));
    window.dispatchEvent(new CustomEvent("fpl:refinement-survivor-pack-ready", { detail: window.FPL_REFINEMENT_SURVIVOR_PACK_V1 }));
    return true;
  }

  let attempts = 0;
  function retry() {
    if (install()) return;
    attempts += 1;
    if (attempts < 100) setTimeout(retry, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", retry, { once: true });
  else retry();
  window.addEventListener("fpl:approved-prompt-baseline-ready", retry);
  window.addEventListener("fpl:prompt-tools-ready", retry);
})();
`;

function writeIfChanged(path, content) {
  const before = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
  if (before === content) return false;
  fs.writeFileSync(path, content);
  return true;
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`${label} marker not found.`);
  return source.replace(search, replacement);
}

writeIfChanged(survivorPackPath, survivorPack);

{
  const path = 'js/career-overlap-wording.js';
  let source = fs.readFileSync(path, 'utf8');
  source = source.replace('career-overlap wording clarity v1.0.24', 'career-overlap wording clarity v1.0.26');
  source = source.replace('career-overlap wording clarity v1.0.25', 'career-overlap wording clarity v1.0.26');
  source = replaceRequired(
    source,
    '    loadStatus("js/prompt-approved-baseline-loader.js?v=1.0.2", "data-approved-prompt-baseline-loader");\n    loadStatus("js/prompt-quality-baseline-finalizer.js?v=1.1.0", "data-quality-prompt-baseline-finalizer");',
    '    loadStatus("js/prompt-approved-baseline-loader.js?v=1.0.2", "data-approved-prompt-baseline-loader");\n    loadStatus(window.FPL_ASSET_MANIFEST?.url?.("promptRefinementSurvivors") || "js/prompt-refinement-survivors-v1.js?v=1.0.0", "data-prompt-refinement-survivors-v1");\n    loadStatus("js/prompt-quality-baseline-finalizer.js?v=1.2.0-survivors", "data-quality-prompt-baseline-finalizer");',
    'career overlap survivor load'
  );
  source = replaceRequired(
    source,
    '    loadStatus("js/prompt-four-star-enforcer.js?v=1.0.3", "data-prompt-four-star-enforcer");',
    '    loadStatus(window.FPL_ASSET_MANIFEST?.url?.("promptFourStarEnforcer") || "js/prompt-four-star-enforcer.js?v=2.1.0-survivors", "data-prompt-four-star-enforcer");',
    'career overlap enforcer load'
  );
  writeIfChanged(path, source);
}

{
  const path = 'js/prompt-quality-baseline-finalizer.js';
  let source = fs.readFileSync(path, 'utf8');
  source = source.replace('quality prompt baseline finalizer v1.1.0', 'quality prompt baseline finalizer v1.2.0');
  source = source.replace('version: "1.1.0",', 'version: "1.2.0",');
  source = replaceRequired(
    source,
    '    const v3 = window.FPL_QUALITY_PROMPT_PACK_V3;\n    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;\n    if (!library || !v1?.ready || !v2?.ready || !v3?.ready) return false;',
    '    const v3 = window.FPL_QUALITY_PROMPT_PACK_V3;\n    const survivorPack = window.FPL_REFINEMENT_SURVIVOR_PACK_V1;\n    const library = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;\n    if (!library || !v1?.ready || !v2?.ready || !v3?.ready || !survivorPack?.ready) return false;',
    'baseline finalizer survivor gate'
  );
  source = replaceRequired(
    source,
    '  window.addEventListener("fpl:prompt-tools-ready", retry);\n})();',
    '  window.addEventListener("fpl:prompt-tools-ready", retry);\n  window.addEventListener("fpl:refinement-survivor-pack-ready", retry);\n})();',
    'baseline finalizer survivor event'
  );
  writeIfChanged(path, source);
}

{
  const path = 'js/prompt-four-star-enforcer.js';
  let source = fs.readFileSync(path, 'utf8');
  source = source.replace('const CACHE_VERSION = "2.0.0";', 'const CACHE_VERSION = "2.1.0-survivors";');
  source = source.replace('const SCRIPT_VERSION = "2.0.0";', 'const SCRIPT_VERSION = "2.1.0-survivors";');
  source = replaceRequired(
    source,
    '    const baseline = window.FPL_APPROVED_PROMPT_BASELINE;\n    const engine = window.FPL_PROMPT_QUALITY_ENGINE;',
    '    const baseline = window.FPL_APPROVED_PROMPT_BASELINE;\n    const survivorPack = window.FPL_REFINEMENT_SURVIVOR_PACK_V1;\n    const engine = window.FPL_PROMPT_QUALITY_ENGINE;',
    'enforcer survivor state'
  );
  source = replaceRequired(
    source,
    '    if (!baseline?.ready || typeof engine?.analyseLibrary !== "function" || !players.length || !items.length) {',
    '    if (!baseline?.ready || !survivorPack?.ready || typeof engine?.analyseLibrary !== "function" || !players.length || !items.length) {',
    'enforcer survivor gate'
  );
  source = replaceRequired(
    source,
    '  window.addEventListener("fpl:approved-prompt-baseline-ready", retry);\n  window.addEventListener("fpl:prompt-tools-ready", retry);',
    '  window.addEventListener("fpl:approved-prompt-baseline-ready", retry);\n  window.addEventListener("fpl:refinement-survivor-pack-ready", retry);\n  window.addEventListener("fpl:prompt-tools-ready", retry);',
    'enforcer survivor event'
  );
  writeIfChanged(path, source);
}

{
  const path = 'config/asset-manifest.json';
  let source = fs.readFileSync(path, 'utf8');
  source = source.replace('"manifestVersion": "1.2.0-native-validation"', '"manifestVersion": "1.3.0-refinement-survivors"');
  source = source.replace('"assetManifestRuntime": { "path": "js/asset-manifest.js", "version": "1.2.0-native-validation" }', '"assetManifestRuntime": { "path": "js/asset-manifest.js", "version": "1.3.0-refinement-survivors" }');
  source = source.replace('"careerOverlapWording": { "path": "js/career-overlap-wording.js", "version": "1.0.25" }', '"careerOverlapWording": { "path": "js/career-overlap-wording.js", "version": "1.0.26" }');
  source = source.replace('"promptRefinementIncubator": { "path": "js/prompt-refinement-incubator.js", "version": "1.0.0" }', '"promptRefinementIncubator": { "path": "js/prompt-refinement-incubator.js", "version": "1.1.1" },\n    "promptRefinementSurvivors": { "path": "js/prompt-refinement-survivors-v1.js", "version": "1.0.0" },\n    "promptFourStarEnforcer": { "path": "js/prompt-four-star-enforcer.js", "version": "2.1.0-survivors" }');
  writeIfChanged(path, source);
}

{
  const path = 'scripts/audit-refinement-incubator.mjs';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceRequired(
    source,
    'if (!window.FPL_APPROVED_PROMPT_BASELINE?.ready) throw new Error("Approved prompt baseline did not initialise.");\n\nconst library = window.ValidationEngine.getPromptLibrary();',
    'if (!window.FPL_APPROVED_PROMPT_BASELINE?.ready) throw new Error("Approved prompt baseline did not initialise.");\nrun("js/prompt-refinement-survivors-v1.js");\nif (!window.FPL_REFINEMENT_SURVIVOR_PACK_V1?.ready) throw new Error("Refinement survivor pack did not initialise.");\n\nconst library = window.ValidationEngine.getPromptLibrary();',
    'audit survivor pack load'
  );
  source = replaceRequired(
    source,
    'const incubator = rows.filter(row => row.state === "incubator");\nconst decisionCounts = countBy(rows, row => row.state);',
    'const incubator = rows.filter(row => row.state === "incubator");\nconst survivorIds = new Set(window.FPL_REFINEMENT_SURVIVOR_PACK_V1?.ids || []);\nconst durableSurvivors = rows.filter(row => survivorIds.has(row.id));\nconst decisionCounts = countBy(rows, row => row.state);',
    'audit durable survivor rows'
  );
  source = replaceRequired(
    source,
    '    approvedBaseline: window.FPL_APPROVED_PROMPT_BASELINE,\n    nationalityPack: window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1 || null',
    '    approvedBaseline: window.FPL_APPROVED_PROMPT_BASELINE,\n    nationalityPack: window.FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1 || null,\n    survivorPack: window.FPL_REFINEMENT_SURVIVOR_PACK_V1 || null',
    'audit source survivor metadata'
  );
  source = replaceRequired(
    source,
    '  decisions: decisionCounts,\n  incubator: {',
    '  decisions: decisionCounts,\n  survivors: {\n    total: durableSurvivors.length,\n    byState: countBy(durableSurvivors, row => row.state),\n    items: durableSurvivors.map(row => ({ id: row.id, position: row.position, label: row.label, state: row.state, rawRating: row.rawRating, rawScore: row.rawScore, adjustedScore: row.adjustedScore, playerCount: row.playerCount, overlap: row.overlap, issues: row.issues }))\n  },\n  incubator: {',
    'audit survivor summary'
  );
  source = replaceRequired(
    source,
    'const md = `# Refinement Incubator audit\\n\\nGenerated: ${audit.generatedAt}\\n\\n## Headline\\n\\n- Enabled Studio prompts analysed: **${source.length}**\\n- Certified: **${decisionCounts.certified || 0}**\\n- Family/diversity rescued: **${decisionCounts.rescued || 0}**\\n- Incubated promising 3★: **${incubator.length}**',
    'const md = `# Refinement Incubator audit\\n\\nGenerated: ${audit.generatedAt}\\n\\n## Headline\\n\\n- Enabled Studio prompts analysed: **${source.length}**\\n- Certified: **${decisionCounts.certified || 0}**\\n- Family/diversity rescued: **${decisionCounts.rescued || 0}**\\n- Durable refinement survivors: **${durableSurvivors.length}**\\n- Incubated promising 3★: **${incubator.length}**',
    'audit markdown survivor headline'
  );
  source = replaceRequired(
    source,
    '\\n\\n## Refinement readiness\\n\\n- Safely tunable by the current Incubator strategy:',
    '\\n\\n## Durable survivors\\n\\n${durableSurvivors.length ? durableSurvivors.map(row => `- **${row.id}** — ${row.label} — ${row.state}, raw ${row.rawScore}, adjusted ${row.adjustedScore}, ${row.playerCount} answers, overlap ${row.overlap.toFixed(3)}.`).join("\\n") : "None."}\\n\\n## Refinement readiness\\n\\n- Safely tunable by the current Incubator strategy:',
    'audit markdown survivor section'
  );
  source = source.replace('This report rebuilds the current approved Studio prompt library from repository sources, reinstalls the nationality context pack', 'This report rebuilds the current approved Studio prompt library from repository sources, applies the durable refinement survivor pack, reinstalls the nationality context pack');
  writeIfChanged(path, source);
}

console.log('Refinement survivor promotion wiring is current.');
