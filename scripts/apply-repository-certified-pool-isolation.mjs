import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, before, after) => {
  if (before === after) return false;
  fs.writeFileSync(path, after);
  console.log(`Updated ${path}`);
  return true;
};

function replaceRegex(source, pattern, replacement, label, installedMarker) {
  if (installedMarker && source.includes(installedMarker)) return source;
  const matches = source.match(pattern);
  if (!matches) throw new Error(`${label}: source marker not found.`);
  return source.replace(pattern, replacement);
}

function numericVersion(value) {
  const match = String(value || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}

function atLeast(current, required) {
  const left = numericVersion(current);
  const right = numericVersion(required);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

function ensureAsset(manifest, key, path, minimumVersion) {
  const current = manifest.assets?.[key] || {};
  manifest.assets[key] = {
    ...current,
    path,
    version: atLeast(current.version, minimumVersion) ? current.version : minimumVersion
  };
}

{
  const path = 'config/asset-manifest.json';
  const before = read(path);
  const manifest = JSON.parse(before);
  ensureAsset(manifest, 'repositoryCertifiedPromptPool', 'js/repository-certified-prompt-pool.js', '1.0.0');
  ensureAsset(manifest, 'adminStudioFinish', 'js/admin-studio-finish.js', '1.0.3-repository-pool');
  ensureAsset(manifest, 'adminDailyGeneratorGuard', 'js/admin-daily-generator-guard.js', '1.1.3-repository-pool');
  const after = JSON.stringify(manifest, null, 2) + '\n';
  write(path, before, after);
}

{
  const path = 'scripts/build-studio-cache-tags.mjs';
  const before = read(path);
  let after = before;
  if (!after.includes("'repositoryCertifiedPromptPool'")) {
    after = after.replace(
      "['assetManifestRuntime', 'validationEngine', 'adminStageOne', 'adminImportTools', 'leaderboardConfig']",
      "['assetManifestRuntime', 'repositoryCertifiedPromptPool', 'validationEngine', 'adminStageOne', 'adminImportTools', 'leaderboardConfig']"
    );
  }
  write(path, before, after);
}

{
  const path = 'admin.html';
  const before = read(path);
  let after = before;
  if (!after.includes('js/repository-certified-prompt-pool.js')) {
    const marker = '  <script src="prompt-library.js?v=2.0.1"></script>\n';
    if (!after.includes(marker)) throw new Error('admin.html prompt-library marker not found.');
    after = after.replace(marker, `${marker}  <script src="js/repository-certified-prompt-pool.js?v=1.0.0"></script>\n`);
  }
  write(path, before, after);
}

{
  const path = 'js/admin-studio-finish.js';
  const before = read(path);
  let after = before;
  after = after.replace('finishing layer v1.0.2', 'finishing layer v1.0.3');

  const poolFunction = `  function certifiedPromptPoolState() {\n    const snapshot = window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;\n    if (Array.isArray(snapshot)) {\n      return { ready:true, prompts:snapshot, expected:snapshot.length, total:snapshot.length, actual:snapshot.length, reason:"Certification snapshot active." };\n    }\n    const pool = window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL;\n    if (!pool?.getState) {\n      const library = liveCertificationPromptLibrary();\n      return { ready:false, prompts:[], expected:851, total:0, actual:library.length, reason:"Repository-certified prompt pool runtime is still loading." };\n    }\n    return pool.getState();\n  }\n\n`;
  after = replaceRegex(
    after,
    /  function certifiedPromptPoolState\(\) \{[\s\S]*?\n  \}\n\n(?=  function requestCertificationPromptTools\(\))/,
    poolFunction,
    'admin-studio-finish certified pool state',
    'Repository-certified prompt pool runtime is still loading.'
  );

  const waitFunction = `  async function waitForCertifiedPromptPool(status) {\n    let current = certifiedPromptPoolState();\n    if (current.ready) return current;\n\n    return await new Promise(resolve => {\n      let settled = false;\n      const events = [\n        "fpl:repository-certified-prompt-pool-ready",\n        "fpl:prompt-tools-ready",\n        "fpl:approved-prompt-baseline-ready",\n        "fpl:quality-prompt-baseline-ready",\n        "fpl:refinement-survivor-pack-ready",\n        "fpl:prompt-library-changed"\n      ];\n      const cleanup = () => {\n        clearInterval(timer);\n        clearTimeout(timeout);\n        events.forEach(name => window.removeEventListener(name, refresh));\n      };\n      const finish = value => {\n        if (settled) return;\n        settled = true;\n        cleanup();\n        resolve(value);\n      };\n      const refresh = () => {\n        if (certificationCancelled) return finish({ ...certifiedPromptPoolState(), cancelled:true });\n        requestCertificationPromptTools();\n        window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.refresh?.();\n        current = certifiedPromptPoolState();\n        if (current.ready) return finish(current);\n        if (status) status.textContent = \`Preparing the repository-certified 851-prompt pool. \${current.reason} Certification has not started yet.\`;\n      };\n      const timer = setInterval(refresh, 250);\n      const timeout = setTimeout(() => finish({ ...certifiedPromptPoolState(), timedOut:true }), CERTIFICATION_POOL_WAIT_MS);\n      events.forEach(name => window.addEventListener(name, refresh));\n      refresh();\n    });\n  }\n\n`;
  after = replaceRegex(
    after,
    /  async function waitForCertifiedPromptPool\(status\) \{[\s\S]*?\n  \}\n\n(?=  function certificationCoverage\(\))/,
    waitFunction,
    'admin-studio-finish certified pool wait',
    'Preparing the repository-certified 851-prompt pool.'
  );

  after = after.replaceAll('Current loading library:', 'Current browser library:');
  if (!after.includes('fpl:repository-certified-prompt-pool-ready')) {
    throw new Error('admin-studio-finish repository pool listener was not installed.');
  }
  write(path, before, after);
}

{
  const path = 'js/admin-daily-generator-guard.js';
  const before = read(path);
  let after = before;
  after = after.replace('quality-pool guard v1.1.2', 'quality-pool guard v1.1.3');

  const capture = `  function captureQualityPool() {\n    const state = window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.getState?.();\n    if (!state?.ready || !Array.isArray(state.prompts) || state.total !== 851) return false;\n    const ids = state.prompts.map(prompt => String(prompt?.id || "")).filter(Boolean);\n    const uniqueIds = new Set(ids);\n    if (ids.length !== 851 || uniqueIds.size !== 851) return false;\n    if (state.prompts.some(prompt => prompt?.enabled === false || Number(prompt?.rating || 0) < 4 || typeof prompt?.test !== "function")) return false;\n\n    qualityIds = uniqueIds;\n    certifiedPoolSize = 851;\n    updateGuardChip();\n    return true;\n  }\n\n`;
  after = replaceRegex(
    after,
    /  function captureQualityPool\(\) \{[\s\S]*?\n  \}\n\n(?=  function qualityPoolDiagnostic\(\))/,
    capture,
    'daily guard repository pool capture',
    'state.total !== 851'
  );

  const diagnostic = `  function qualityPoolDiagnostic() {\n    const state = window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.getState?.();\n    if (!state) return "repository-certified prompt pool runtime is still loading";\n    return state.ready\n      ? \`repository-certified \${state.total.toLocaleString("en-GB")}; browser library \${state.browserTotal.toLocaleString("en-GB")} with \${state.browserCustom.toLocaleString("en-GB")} local custom\`\n      : \`\${state.reason} Browser library \${Number(state.browserTotal || state.actual || 0).toLocaleString("en-GB")}\`;\n  }\n\n`;
  after = replaceRegex(
    after,
    /  function qualityPoolDiagnostic\(\) \{[\s\S]*?\n  \}\n\n(?=  async function waitForQualityPool\(\))/,
    diagnostic,
    'daily guard repository pool diagnostic',
    'repository-certified prompt pool runtime is still loading'
  );

  const wait = `  async function waitForQualityPool() {\n    if (captureQualityPool()) return true;\n    setStatus("Synchronising the repository-certified 851-prompt pool before generation…", "working");\n    return await new Promise(resolve => {\n      let settled = false;\n      const events = [\n        "fpl:repository-certified-prompt-pool-ready",\n        "fpl:prompt-tools-ready",\n        "fpl:approved-prompt-baseline-ready",\n        "fpl:quality-prompt-baseline-ready",\n        "fpl:refinement-survivor-pack-ready",\n        "fpl:prompt-library-changed"\n      ];\n      const finish = value => {\n        if (settled) return;\n        settled = true;\n        events.forEach(name => window.removeEventListener(name, onReady));\n        clearInterval(timer);\n        clearTimeout(timeout);\n        resolve(value);\n      };\n      const onReady = () => {\n        window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.refresh?.();\n        if (captureQualityPool()) finish(true);\n      };\n      const timer = setInterval(onReady, 250);\n      const timeout = setTimeout(() => finish(false), QUALITY_WAIT_MS);\n      events.forEach(name => window.addEventListener(name, onReady));\n      onReady();\n    });\n  }\n\n`;
  after = replaceRegex(
    after,
    /  async function waitForQualityPool\(\) \{[\s\S]*?\n  \}\n\n(?=  async function refreshServerSchedule\(\))/,
    wait,
    'daily guard repository pool wait',
    'Synchronising the repository-certified 851-prompt pool before generation'
  );

  after = after.replace(
    'const meta = window.FPL_FOUR_STAR_LIBRARY;\n    const scheduleReady',
    'const repoPool = window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.getState?.();\n    const scheduleReady'
  );
  after = after.replace(
    '      : meta?.ready\n        ? `${Number(meta.total || 0).toLocaleString("en-GB")} prompt pool syncing`\n        : "quality pool finalising";',
    '      : repoPool?.ready\n        ? `${Number(repoPool.total || 0).toLocaleString("en-GB")} repository-certified prompts`\n        : "repository pool finalising";'
  );
  write(path, before, after);
}

execFileSync(process.execPath, ['--check', 'js/repository-certified-prompt-pool.js'], { stdio:'inherit' });
execFileSync(process.execPath, ['--check', 'js/admin-studio-finish.js'], { stdio:'inherit' });
execFileSync(process.execPath, ['--check', 'js/admin-daily-generator-guard.js'], { stdio:'inherit' });
execFileSync(process.execPath, ['scripts/verify-repository-certified-prompt-pool.mjs'], { stdio:'inherit' });
