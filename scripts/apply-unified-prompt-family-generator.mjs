import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, source, updated) => {
  if (updated !== source) {
    fs.writeFileSync(path, updated);
    console.log(`Updated ${path}`);
  }
};
const replaceOnce = (source, from, to, label) => {
  if (source.includes(to)) return source;
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one source marker, found ${count}.`);
  return source.replace(from, to);
};

// 1) Move Quality Families + Nationality Family into the main Automatic Creator controls.
{
  const path = 'admin.html';
  const source = read(path);
  let updated = source;
  const marker = '          <label class="check-label"><input id="factoryEnablePrompts" type="checkbox"> Enable immediately after adding</label>';
  const replacement = `${marker}\n          <label class="check-label"><input id="factoryIncludeQualityFamilies" type="checkbox" checked> Include Quality Families (5★ V1 / V2 / V3 + inverse anti-meta)</label>\n          <label class="check-label"><input id="factoryIncludeNationalityFamily" type="checkbox" checked> Include Nationality Family (nationality + stats)</label>`;
  updated = replaceOnce(updated, marker, replacement, 'admin unified family controls');
  write(path, source, updated);
}

// 2) Expose both specialist engines as candidate providers and suppress their old standalone panels
// when the unified controls are present.
for (const spec of [
  {
    path: 'js/prompt-quality-family-generator.js',
    api: 'FPL_QUALITY_FAMILY_GENERATOR',
    version: '1.1.0',
    checkbox: 'factoryIncludeQualityFamilies',
    commentFrom: 'Quality Family Generator v1.0.0',
    commentTo: 'Quality Family Generator v1.1.0'
  },
  {
    path: 'js/prompt-nationality-family-generator.js',
    api: 'FPL_NATIONALITY_FAMILY_GENERATOR',
    version: '1.1.0',
    checkbox: 'factoryIncludeNationalityFamily',
    commentFrom: 'Nationality Family Generator v1.1.0',
    commentTo: 'Nationality Family Generator v1.1.1'
  }
]) {
  const source = read(spec.path);
  let updated = source.replace(spec.commentFrom, spec.commentTo);
  const installMarker = '  function install() {\n    if (installed) return;';
  const apiBlock = `  window.${spec.api} = Object.freeze({\n    version: "${spec.version}",\n    buildBatch: () => buildBatch(),\n    serialise: item => serialise(item)\n  });\n\n  function install() {\n    if (installed) return;\n    if (document.getElementById("${spec.checkbox}")) { installed = true; return; }`;
  updated = replaceOnce(updated, installMarker, apiBlock, `${spec.path} provider API`);
  write(spec.path, source, updated);
}

// 3) Merge specialist candidates into the same checked preview/save flow as the big generator.
{
  const path = 'js/admin-import-tools-base.js';
  const source = read(path);
  let updated = source;

  updated = replaceOnce(
    updated,
    '      enable: document.querySelector("#factoryEnablePrompts"),',
    '      enable: document.querySelector("#factoryEnablePrompts"),\n      includeQualityFamilies: document.querySelector("#factoryIncludeQualityFamilies"),\n      includeNationalityFamily: document.querySelector("#factoryIncludeNationalityFamily"),',
    'factory family elements'
  );

  const modesMarker = '    const exclusionMode = ["none", "mix", "top1", "top2"].includes(elements.exclusion?.value) ? elements.exclusion.value : "mix";';
  const modesReplacement = `${modesMarker}\n    const includeQualityFamilies = elements.includeQualityFamilies?.checked !== false;\n    const includeNationalityFamily = elements.includeNationalityFamily?.checked !== false;\n\n    const missingProviders = [];\n    if (includeQualityFamilies && !window.FPL_QUALITY_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Quality Families");\n    if (includeNationalityFamily && !window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Nationality Family");\n    if (missingProviders.length) {\n      elements.status.textContent = `Loading ${missingProviders.join(" + ")} into the main generator…`;\n      ensureIntegratedFamilyProviders(() => generateBatch(elements, core));\n      return;\n    }`;
  updated = replaceOnce(updated, modesMarker, modesReplacement, 'family provider readiness');

  const beforeChoose = '        currentBatch = chooseBalancedBatch(evaluated, requested, positionMode, difficultyMode);';
  const integratedCall = `        appendIntegratedFamilyCandidates({\n          core, evaluated, rejected, seenCandidatePools, familyCounts, familyLimit,\n          minimum, maximum, difficultyMode, enable: elements.enable.checked,\n          avoidPools: elements.avoidPools.checked, includeQualityFamilies, includeNationalityFamily\n        });\n\n${beforeChoose}`;
  updated = replaceOnce(updated, beforeChoose, integratedCall, 'integrated family candidate merge');

  const chooseMarker = '  function chooseBalancedBatch(candidates, requested, positionMode, difficultyMode) {';
  const helpers = `  function ensureIntegratedFamilyProviders(done) {\n    const wanted = [];\n    if (!window.FPL_QUALITY_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-quality-family-generator.js?v=1.1.0", "FPL_QUALITY_FAMILY_GENERATOR"]);\n    if (!window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-nationality-family-generator.js?v=1.1.1", "FPL_NATIONALITY_FAMILY_GENERATOR"]);\n    if (!wanted.length) return done();\n    let remaining = wanted.length;\n    const finish = () => { remaining -= 1; if (remaining <= 0) done(); };\n    for (const [src, apiName] of wanted) {\n      const existing = [...document.scripts].find(script => script.src && script.src.includes(src.split("?")[0]));\n      if (existing) {\n        if (window[apiName]?.buildBatch) finish();\n        else existing.addEventListener("load", finish, { once: true });\n        continue;\n      }\n      const script = document.createElement("script");\n      script.src = src;\n      script.async = false;\n      script.addEventListener("load", finish, { once: true });\n      document.head.appendChild(script);\n    }\n  }\n\n  function appendIntegratedFamilyCandidates({ core, evaluated, rejected, seenCandidatePools, familyCounts, familyLimit, minimum, maximum, difficultyMode, enable, avoidPools, includeQualityFamilies, includeNationalityFamily }) {\n    const providers = [];\n    if (includeQualityFamilies && window.FPL_QUALITY_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_QUALITY_FAMILY_GENERATOR);\n    if (includeNationalityFamily && window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_NATIONALITY_FAMILY_GENERATOR);\n    const pendingIds = new Set(evaluated.map(prompt => String(prompt.id || "")));\n\n    for (const provider of providers) {\n      let candidates = [];\n      try { candidates = provider.buildBatch() || []; } catch (_) { rejected.broken += 1; continue; }\n      for (const item of candidates) {\n        try {\n          const prompt = provider.serialise(item);\n          if (!prompt || pendingIds.has(String(prompt.id || ""))) { rejected.duplicate += 1; continue; }\n          prompt.family = item.family || prompt.family || "quality-family";\n          prompt.test = item.test || prompt.test;\n          prompt.tags = Array.isArray(prompt.tags) ? [...prompt.tags] : [];\n          prompt.rating = 5;\n          prompt.enabled = enable;\n          prompt.selected = true;\n          const stats = core.getPromptStats(prompt);\n          if (stats.playerCount < minimum || stats.playerCount > maximum) { rejected.answerRange += 1; continue; }\n          prompt.difficulty = item.difficulty || classifyDifficulty(stats.playerCount);\n          if (difficultyMode !== "balanced" && prompt.difficulty !== difficultyMode) continue;\n\n          const labelKey = normaliseLabel(prompt.label);\n          if (existingLabelTokens.some(existing => existing.position === prompt.position && labelSimilarity(labelKey, existing.key) >= 0.86)) { rejected.duplicate += 1; continue; }\n          const signature = poolSignature(stats);\n          if (!signature || existingPoolIndex.has(`${prompt.position}|${signature}`) || seenCandidatePools.has(`${prompt.position}|${signature}`)) { rejected.duplicate += 1; continue; }\n          if (avoidPools && hasNearPoolDuplicate(prompt.position, stats, existingPoolIndex, seenCandidatePools)) { rejected.similar += 1; continue; }\n          const familyUsed = familyCounts.get(prompt.family) || 0;\n          if (familyUsed >= familyLimit) continue;\n\n          prompt.stats = stats;\n          prompt.poolSignature = signature;\n          evaluated.push(prompt);\n          pendingIds.add(String(prompt.id || ""));\n          familyCounts.set(prompt.family, familyUsed + 1);\n          seenCandidatePools.set(`${prompt.position}|${signature}`, stats.bestByPlayer);\n        } catch (_) { rejected.broken += 1; }\n      }\n    }\n  }\n\n${chooseMarker}`;
  updated = replaceOnce(updated, chooseMarker, helpers, 'integrated family helpers');

  const summaryMarker = '      <article><span>Top-answer exclusions</span><strong>${currentBatch.filter(item => item.tags.includes("excludes-top")).length}</strong></article>`;';
  const summaryReplacement = '      <article><span>Top-answer exclusions</span><strong>${currentBatch.filter(item => item.tags.includes("excludes-top")).length}</strong></article>\n      <article><span>Quality families</span><strong>${currentBatch.filter(item => item.tags.includes("quality-family")).length}</strong></article>\n      <article><span>Nationality family</span><strong>${currentBatch.filter(item => item.tags.includes("nationality")).length}</strong></article>`;';
  updated = replaceOnce(updated, summaryMarker, summaryReplacement, 'family summary cards');

  const badgeMarker = '            ${prompt.tags.includes("teammate") ? \'<span class="relation">Teammate rule</span>\' : ""}';
  const badgeReplacement = `${badgeMarker}\n            ${'${prompt.tags.includes("quality-family") ? \'<span class="relation">Quality family</span>\' : ""}'}\n            ${'${prompt.tags.includes("nationality") ? \'<span class="relation">Nationality</span>\' : ""}'}`;
  updated = replaceOnce(updated, badgeMarker, badgeReplacement, 'family preview badges');

  write(path, source, updated);
}

// 4) Cache-bust the updated generator modules.
{
  const path = 'js/prompt-studio-loader.js';
  const source = read(path);
  const updated = source.replace('js/admin-import-tools-base.js?v=16.0.1-unified1', 'js/admin-import-tools-base.js?v=16.1.0-familymix');
  write(path, source, updated);
}
{
  const path = 'js/career-overlap-wording.js';
  const source = read(path);
  let updated = source
    .replace('js/prompt-quality-family-generator.js?v=1.0.0', 'js/prompt-quality-family-generator.js?v=1.1.0')
    .replace('js/prompt-nationality-family-generator.js?v=1.0.0', 'js/prompt-nationality-family-generator.js?v=1.1.1');
  write(path, source, updated);
}
{
  const path = 'js/studio-feature-loader.js';
  const source = read(path);
  const updated = source.replace('js/career-overlap-wording.js?v=1.0.0', 'js/career-overlap-wording.js?v=1.0.25');
  write(path, source, updated);
}

for (const path of ['js/admin-import-tools-base.js','js/prompt-quality-family-generator.js','js/prompt-nationality-family-generator.js','js/prompt-studio-loader.js','js/career-overlap-wording.js','js/studio-feature-loader.js']) {
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
}
execFileSync(process.execPath, ['scripts/verify-unified-prompt-family-generator.mjs'], { stdio: 'inherit' });
