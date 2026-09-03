import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, source, updated) => {
  if (updated !== source) {
    fs.writeFileSync(path, updated);
    console.log('Updated ' + path);
  }
};
const replaceOnce = (source, from, to, label) => {
  if (source.includes(to)) return source;
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(label + ': expected one source marker, found ' + count + '.');
  return source.replace(from, to);
};
const lines = items => items.join('\n');

// 1) Move Quality Families + Nationality Family into the main Automatic Creator controls.
{
  const path = 'admin.html';
  const source = read(path);
  let updated = source;
  const marker = '          <label class="check-label"><input id="factoryEnablePrompts" type="checkbox"> Enable immediately after adding</label>';
  const replacement = lines([
    marker,
    '          <label class="check-label"><input id="factoryIncludeQualityFamilies" type="checkbox" checked> Include Quality Families (5★ V1 / V2 / V3 + inverse anti-meta)</label>',
    '          <label class="check-label"><input id="factoryIncludeNationalityFamily" type="checkbox" checked> Include Nationality Family (nationality + stats)</label>'
  ]);
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
  const installMarker = lines([
    '  function install() {',
    '    if (installed) return;'
  ]);
  const apiBlock = lines([
    '  window.' + spec.api + ' = Object.freeze({',
    '    version: "' + spec.version + '",',
    '    buildBatch: () => buildBatch(),',
    '    serialise: item => serialise(item)',
    '  });',
    '',
    '  function install() {',
    '    if (installed) return;',
    '    if (document.getElementById("' + spec.checkbox + '")) { installed = true; return; }'
  ]);
  updated = replaceOnce(updated, installMarker, apiBlock, spec.path + ' provider API');
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
    lines([
      '      enable: document.querySelector("#factoryEnablePrompts"),',
      '      includeQualityFamilies: document.querySelector("#factoryIncludeQualityFamilies"),',
      '      includeNationalityFamily: document.querySelector("#factoryIncludeNationalityFamily"),'
    ]),
    'factory family elements'
  );

  const modesMarker = '    const exclusionMode = ["none", "mix", "top1", "top2"].includes(elements.exclusion?.value) ? elements.exclusion.value : "mix";';
  const modesReplacement = lines([
    modesMarker,
    '    const includeQualityFamilies = elements.includeQualityFamilies?.checked !== false;',
    '    const includeNationalityFamily = elements.includeNationalityFamily?.checked !== false;',
    '',
    '    const missingProviders = [];',
    '    if (includeQualityFamilies && !window.FPL_QUALITY_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Quality Families");',
    '    if (includeNationalityFamily && !window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) missingProviders.push("Nationality Family");',
    '    if (missingProviders.length) {',
    '      elements.status.textContent = "Loading " + missingProviders.join(" + ") + " into the main generator…";',
    '      ensureIntegratedFamilyProviders(() => generateBatch(elements, core));',
    '      return;',
    '    }'
  ]);
  updated = replaceOnce(updated, modesMarker, modesReplacement, 'family provider readiness');

  const beforeChoose = '        currentBatch = chooseBalancedBatch(evaluated, requested, positionMode, difficultyMode);';
  const integratedCall = lines([
    '        appendIntegratedFamilyCandidates({',
    '          core, evaluated, rejected, seenCandidatePools, familyCounts, familyLimit,',
    '          minimum, maximum, difficultyMode, enable: elements.enable.checked,',
    '          avoidPools: elements.avoidPools.checked, includeQualityFamilies, includeNationalityFamily',
    '        });',
    '',
    beforeChoose
  ]);
  updated = replaceOnce(updated, beforeChoose, integratedCall, 'integrated family candidate merge');

  const chooseMarker = '  function chooseBalancedBatch(candidates, requested, positionMode, difficultyMode) {';
  const helpers = lines([
    '  function ensureIntegratedFamilyProviders(done) {',
    '    const wanted = [];',
    '    if (!window.FPL_QUALITY_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-quality-family-generator.js?v=1.1.0", "FPL_QUALITY_FAMILY_GENERATOR"]);',
    '    if (!window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) wanted.push(["js/prompt-nationality-family-generator.js?v=1.1.1", "FPL_NATIONALITY_FAMILY_GENERATOR"]);',
    '    if (!wanted.length) return done();',
    '    let remaining = wanted.length;',
    '    const finish = () => { remaining -= 1; if (remaining <= 0) done(); };',
    '    for (const [src, apiName] of wanted) {',
    '      const existing = [...document.scripts].find(script => script.src && script.src.includes(src.split("?")[0]));',
    '      if (existing) {',
    '        if (window[apiName]?.buildBatch) finish();',
    '        else existing.addEventListener("load", finish, { once: true });',
    '        continue;',
    '      }',
    '      const script = document.createElement("script");',
    '      script.src = src;',
    '      script.async = false;',
    '      script.addEventListener("load", finish, { once: true });',
    '      document.head.appendChild(script);',
    '    }',
    '  }',
    '',
    '  function appendIntegratedFamilyCandidates({ core, evaluated, rejected, seenCandidatePools, familyCounts, familyLimit, minimum, maximum, difficultyMode, enable, avoidPools, includeQualityFamilies, includeNationalityFamily }) {',
    '    const providers = [];',
    '    if (includeQualityFamilies && window.FPL_QUALITY_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_QUALITY_FAMILY_GENERATOR);',
    '    if (includeNationalityFamily && window.FPL_NATIONALITY_FAMILY_GENERATOR?.buildBatch) providers.push(window.FPL_NATIONALITY_FAMILY_GENERATOR);',
    '    const pendingIds = new Set(evaluated.map(prompt => String(prompt.id || "")));',
    '',
    '    for (const provider of providers) {',
    '      let candidates = [];',
    '      try { candidates = provider.buildBatch() || []; } catch (_) { rejected.broken += 1; continue; }',
    '      for (const item of candidates) {',
    '        try {',
    '          const prompt = provider.serialise(item);',
    '          if (!prompt || pendingIds.has(String(prompt.id || ""))) { rejected.duplicate += 1; continue; }',
    '          prompt.family = item.family || prompt.family || "quality-family";',
    '          prompt.test = item.test || prompt.test;',
    '          prompt.tags = Array.isArray(prompt.tags) ? [...prompt.tags] : [];',
    '          prompt.rating = 5;',
    '          prompt.enabled = enable;',
    '          prompt.selected = true;',
    '          const stats = core.getPromptStats(prompt);',
    '          if (stats.playerCount < minimum || stats.playerCount > maximum) { rejected.answerRange += 1; continue; }',
    '          prompt.difficulty = item.difficulty || classifyDifficulty(stats.playerCount);',
    '          if (difficultyMode !== "balanced" && prompt.difficulty !== difficultyMode) continue;',
    '',
    '          const labelKey = normaliseLabel(prompt.label);',
    '          if (existingLabelTokens.some(existing => existing.position === prompt.position && labelSimilarity(labelKey, existing.key) >= 0.86)) { rejected.duplicate += 1; continue; }',
    '          const signature = poolSignature(stats);',
    '          const poolKey = prompt.position + "|" + signature;',
    '          if (!signature || existingPoolIndex.has(poolKey) || seenCandidatePools.has(poolKey)) { rejected.duplicate += 1; continue; }',
    '          if (avoidPools && hasNearPoolDuplicate(prompt.position, stats, existingPoolIndex, seenCandidatePools)) { rejected.similar += 1; continue; }',
    '          const familyUsed = familyCounts.get(prompt.family) || 0;',
    '          if (familyUsed >= familyLimit) continue;',
    '',
    '          prompt.stats = stats;',
    '          prompt.poolSignature = signature;',
    '          evaluated.push(prompt);',
    '          pendingIds.add(String(prompt.id || ""));',
    '          familyCounts.set(prompt.family, familyUsed + 1);',
    '          seenCandidatePools.set(poolKey, stats.bestByPlayer);',
    '        } catch (_) { rejected.broken += 1; }',
    '      }',
    '    }',
    '  }',
    '',
    chooseMarker
  ]);
  updated = replaceOnce(updated, chooseMarker, helpers, 'integrated family helpers');

  const summaryMarker = '      <article><span>Top-answer exclusions</span><strong>${currentBatch.filter(item => item.tags.includes("excludes-top")).length}</strong></article>`;';
  const summaryReplacement = lines([
    '      <article><span>Top-answer exclusions</span><strong>${currentBatch.filter(item => item.tags.includes("excludes-top")).length}</strong></article>',
    '      <article><span>Quality families</span><strong>${currentBatch.filter(item => item.tags.includes("quality-family")).length}</strong></article>',
    '      <article><span>Nationality family</span><strong>${currentBatch.filter(item => item.tags.includes("nationality")).length}</strong></article>`;'
  ]);
  updated = replaceOnce(updated, summaryMarker, summaryReplacement, 'family summary cards');

  const badgeMarker = '            ${prompt.tags.includes("teammate") ? \'<span class="relation">Teammate rule</span>\' : ""}';
  const badgeReplacement = lines([
    badgeMarker,
    '            ${prompt.tags.includes("quality-family") ? \'<span class="relation">Quality family</span>\' : ""}',
    '            ${prompt.tags.includes("nationality") ? \'<span class="relation">Nationality</span>\' : ""}'
  ]);
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
  const updated = source
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
