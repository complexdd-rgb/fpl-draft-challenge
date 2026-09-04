import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, before, after) => {
  if (before === after) return false;
  fs.writeFileSync(path, after);
  console.log(`Updated ${path}`);
  return true;
};
const replaceOnce = (source, from, to, label, installedMarker = to) => {
  if (source.includes(installedMarker)) return source;
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one source marker, found ${count}.`);
  return source.replace(from, to);
};

{
  const path = 'js/validation-engine.js';
  const before = read(path);
  const oldBlock = `  function getPromptLibrary() {\n    const studioLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();\n    if (Array.isArray(studioLibrary)) return studioLibrary;\n    return Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];\n  }`;
  const newBlock = `  function getPromptLibrary() {\n    const certificationSnapshot = window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;\n    if (Array.isArray(certificationSnapshot)) return certificationSnapshot;\n    const studioLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();\n    if (Array.isArray(studioLibrary)) return studioLibrary;\n    return Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];\n  }`;
  const after = replaceOnce(before, oldBlock, newBlock, 'Validation certification snapshot', 'const certificationSnapshot = window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;');
  write(path, before, after);
}

{
  const path = 'js/admin-studio-finish.js';
  const before = read(path);
  let after = before;

  after = after.replace('/* FPL Challenge Studio — finishing layer v1.0.0', '/* FPL Challenge Studio — finishing layer v1.0.2');

  after = replaceOnce(
    after,
    `  const CERT_KEY = "fplStudioAllSeasonCertificationV1";\n  const POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);`,
    `  const CERT_KEY = "fplStudioAllSeasonCertificationV1";\n  const CERTIFICATION_POOL_WAIT_MS = 120000;\n  const POSITIONS = new Set(["GK", "DEF", "MID", "FWD"]);`,
    'Certification wait constant',
    'const CERTIFICATION_POOL_WAIT_MS = 120000;'
  );

  const cacheMarker = `  function saveCertCache(cache) {\n    try { localStorage.setItem(CERT_KEY, JSON.stringify(cache)); } catch {}\n  }\n\n`;
  const readinessHelpers = `  function saveCertCache(cache) {\n    try { localStorage.setItem(CERT_KEY, JSON.stringify(cache)); } catch {}\n  }\n\n  function liveCertificationPromptLibrary() {\n    const apiLibrary = window.FPL_STUDIO_API?.getPromptLibrary?.();\n    return Array.isArray(apiLibrary)\n      ? apiLibrary\n      : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []);\n  }\n\n  function certifiedPromptPoolState() {\n    const snapshot = window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;\n    if (Array.isArray(snapshot)) {\n      return { ready:true, prompts:snapshot, expected:snapshot.length, actual:snapshot.length, reason:"Certification snapshot active." };\n    }\n\n    const meta = window.FPL_FOUR_STAR_LIBRARY;\n    const library = liveCertificationPromptLibrary();\n    const expected = Number(meta?.total);\n    if (!meta?.ready) {\n      return { ready:false, prompts:[], expected:0, actual:library.length, reason:"Quality Enforcement v2 is still finalising the certified prompt library." };\n    }\n    if (!Number.isInteger(expected) || expected <= 0) {\n      return { ready:false, prompts:[], expected:0, actual:library.length, reason:"Certified prompt-library metadata is incomplete." };\n    }\n\n    const ids = library.map(prompt => String(prompt?.id || "")).filter(Boolean);\n    const uniqueIds = new Set(ids);\n    if (ids.length !== library.length || uniqueIds.size !== library.length) {\n      return { ready:false, prompts:[], expected, actual:library.length, reason:"The live prompt library has missing or duplicate IDs." };\n    }\n    if (library.length !== expected) {\n      return { ready:false, prompts:[], expected, actual:library.length, reason:\`Certified metadata expects \${expected.toLocaleString("en-GB")} prompts but the live library currently has \${library.length.toLocaleString("en-GB")}.\` };\n    }\n\n    const belowFloor = library.filter(prompt => Number(prompt?.rating || 0) < 4).length;\n    if (belowFloor) {\n      return { ready:false, prompts:[], expected, actual:library.length, reason:\`\${belowFloor.toLocaleString("en-GB")} prompt(s) are still below the 4★ certification floor.\` };\n    }\n    return { ready:true, prompts:library.slice(), expected, actual:library.length, reason:"Certified 4★+ prompt library ready." };\n  }\n\n  function requestCertificationPromptTools() {\n    window.FPL_STUDIO_BOOTSTRAP?.ensurePromptLoader?.();\n    const loader = window.FPL_STUDIO_LOAD_PROMPT_TOOLS;\n    if (typeof loader !== "function") return false;\n    loader();\n    return true;\n  }\n\n  async function waitForCertifiedPromptPool(status) {\n    let current = certifiedPromptPoolState();\n    if (current.ready) return current;\n\n    return await new Promise(resolve => {\n      let settled = false;\n      const events = [\n        "fpl:four-star-library-ready",\n        "fpl:prompt-quality-enforcement-v2-ready",\n        "fpl:prompt-tools-ready",\n        "fpl:approved-prompt-baseline-ready",\n        "fpl:refinement-survivor-pack-ready"\n      ];\n      const cleanup = () => {\n        clearInterval(timer);\n        clearTimeout(timeout);\n        events.forEach(name => window.removeEventListener(name, refresh));\n      };\n      const finish = value => {\n        if (settled) return;\n        settled = true;\n        cleanup();\n        resolve(value);\n      };\n      const refresh = () => {\n        if (certificationCancelled) return finish({ ...certifiedPromptPoolState(), cancelled:true });\n        requestCertificationPromptTools();\n        current = certifiedPromptPoolState();\n        if (current.ready) return finish(current);\n\n        const progress = window.FPL_FOUR_STAR_LIBRARY_PROGRESS;\n        if (progress?.state === "fail") {\n          return finish({ ...current, failed:true, reason:String(progress.message || current.reason) });\n        }\n        if (status) {\n          const hasProgress = Number(progress?.total) > 0 && Number.isFinite(Number(progress?.percent));\n          const progressText = hasProgress\n            ? \` · \${Math.round(Number(progress.percent))}% (\${Number(progress.current || 0).toLocaleString("en-GB")} / \${Number(progress.total || 0).toLocaleString("en-GB")})\`\n            : "";\n          status.textContent = \`Finalising the certified 4★+ prompt library before season certification\${progressText}. Certification has not started yet.\`;\n        }\n      };\n      const timer = setInterval(refresh, 250);\n      const timeout = setTimeout(() => finish({ ...certifiedPromptPoolState(), timedOut:true }), CERTIFICATION_POOL_WAIT_MS);\n      events.forEach(name => window.addEventListener(name, refresh));\n      refresh();\n    });\n  }\n\n`;
  after = replaceOnce(after, cacheMarker, readinessHelpers, 'Certification readiness helpers', 'function certifiedPromptPoolState()');

  const oldCoverageStart = `  function certificationCoverage() {\n    const engine = window.ValidationEngine;\n    if (!engine?.getAllSeasonLabels || !engine?.getSeasonFingerprint) return { state:"warn", title:"Not available", detail:"Validation Engine has not loaded yet.", fresh:0, total:0 };\n    const seasons = engine.getAllSeasonLabels();`;
  const newCoverageStart = `  function certificationCoverage() {\n    const engine = window.ValidationEngine;\n    if (!engine?.getAllSeasonLabels || !engine?.getSeasonFingerprint) return { state:"warn", title:"Not available", detail:"Validation Engine has not loaded yet.", fresh:0, total:0 };\n    const seasons = engine.getAllSeasonLabels();\n    const poolState = certifiedPromptPoolState();\n    if (!poolState.ready) {\n      return { state:"warn", title:"Prompt pool pending", detail:\`\${poolState.reason} Current loading library: \${poolState.actual.toLocaleString("en-GB")} prompts.\`, fresh:0, total:seasons.length };\n    }`;
  after = replaceOnce(after, oldCoverageStart, newCoverageStart, 'Certification coverage readiness gate', 'title:"Prompt pool pending"');

  const oldMatrixStart = `  function renderCertificationMatrix() {\n    const grid = document.getElementById("allSeasonGrid");\n    const status = document.getElementById("allSeasonStatus");\n    if (!grid || !status) return;\n    const entries = freshCertificationEntries();`;
  const newMatrixStart = `  function renderCertificationMatrix() {\n    const grid = document.getElementById("allSeasonGrid");\n    const status = document.getElementById("allSeasonStatus");\n    if (!grid || !status) return;\n    const poolState = certifiedPromptPoolState();\n    if (!poolState.ready) {\n      grid.innerHTML = "";\n      status.textContent = \`Waiting for the certified 4★+ prompt library. \${poolState.reason} Current loading library: \${poolState.actual.toLocaleString("en-GB")} prompts. Certify All Seasons will wait automatically.\`;\n      renderPreflight();\n      return;\n    }\n    const entries = freshCertificationEntries();`;
  after = replaceOnce(after, oldMatrixStart, newMatrixStart, 'Certification matrix readiness gate', 'Certify All Seasons will wait automatically.');

  if (!after.includes('Certified prompt snapshot locked at')) {
    const functionPattern = /  async function certifyAllSeasons\(\) \{[\s\S]*?\n  \}\n\n  function installAllSeasonCertification\(\) \{/;
    const matches = after.match(functionPattern);
    if (!matches) throw new Error('Could not locate certifyAllSeasons() for readiness replacement.');
    const replacement = `  async function certifyAllSeasons() {\n    const engine = window.ValidationEngine;\n    const run = document.getElementById("certifyAllSeasonsBtn");\n    const cancel = document.getElementById("cancelAllSeasonsBtn");\n    const bar = document.querySelector("#allSeasonProgress > span");\n    const status = document.getElementById("allSeasonStatus");\n    if (!engine?.certifySeason || !engine?.getAllSeasonLabels) return;\n\n    certificationCancelled = false;\n    if (run) { run.disabled = true; run.textContent = "Preparing certified prompts…"; }\n    if (cancel) cancel.disabled = false;\n    let certificationPool = null;\n\n    try {\n      const poolState = await waitForCertifiedPromptPool(status);\n      if (certificationCancelled || poolState?.cancelled) {\n        if (status) status.textContent = "All-season certification cancelled before the certified prompt pool was ready.";\n        return;\n      }\n      if (!poolState?.ready) {\n        if (status) {\n          const suffix = poolState?.timedOut ? " The readiness wait timed out." : "";\n          status.textContent = \`Certification did not start. \${poolState?.reason || "The certified prompt library is not ready."}\${suffix}\`;\n        }\n        return;\n      }\n\n      certificationPool = Object.freeze(poolState.prompts.slice());\n      window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL = certificationPool;\n      const seasons = engine.getAllSeasonLabels();\n      const cache = loadCertCache();\n      if (status) status.textContent = \`Certified prompt snapshot locked at \${certificationPool.length.toLocaleString("en-GB")} prompts. Starting all-season certification…\`;\n\n      for (let index = 0; index < seasons.length; index += 1) {\n        if (certificationCancelled) break;\n        const season = seasons[index];\n        if (status) status.textContent = \`Certifying \${season} · \${index + 1} of \${seasons.length} · \${certificationPool.length.toLocaleString("en-GB")} frozen certified prompts.\`;\n        if (bar) bar.style.width = \`\${Math.round((index / seasons.length) * 100)}%\`;\n        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));\n        const result = engine.certifySeason(season);\n        if (result?.ok) {\n          cache[season] = {\n            fingerprint: result.fingerprint || engine.getSeasonFingerprint(season),\n            certified: result.certified === true,\n            status: result.status,\n            certifiedAt: result.certifiedAt,\n            evaluations: result.promptSummary?.evaluations || 0,\n            runtimeErrors: result.promptSummary?.runtimeErrors || 0,\n            disagreements: result.promptSummary?.diagnosticMismatches || 0,\n            warnings: (result.warnings || []).reduce((sum, warning) => sum + Number(warning.count || 0), 0)\n          };\n          saveCertCache(cache);\n        }\n        renderCertificationMatrix();\n      }\n      if (bar) bar.style.width = certificationCancelled ? bar.style.width : "100%";\n      if (status) status.textContent = certificationCancelled ? "All-season certification stopped after the current season." : "All-season certification complete.";\n    } catch (error) {\n      if (status) status.textContent = \`Certification stopped: \${error?.message || error}\`;\n    } finally {\n      if (window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL === certificationPool) delete window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL;\n      if (run) { run.disabled = false; run.textContent = "Certify all seasons"; }\n      if (cancel) cancel.disabled = true;\n      renderCertificationMatrix();\n    }\n  }\n\n  function installAllSeasonCertification() {`;
    after = after.replace(functionPattern, replacement);
  }

  after = replaceOnce(
    after,
    'Run the same complete certification against every supported season and cache the fingerprint. Results automatically become stale when player data or prompts change.',
    'Run the same complete certification against every supported season after the certified 4★+ prompt library is ready. The final prompt set is frozen for the whole run, and results automatically become stale when player data or prompts change.',
    'Certification panel readiness copy',
    'The final prompt set is frozen for the whole run'
  );

  const promptToolsListener = '    window.addEventListener("fpl:prompt-tools-ready", () => { installUnsavedPill(); renderPreflight(); });';
  const readinessListeners = `    window.addEventListener("fpl:prompt-tools-ready", () => { installUnsavedPill(); renderCertificationMatrix(); renderPreflight(); });\n    window.addEventListener("fpl:four-star-library-ready", () => { renderCertificationMatrix(); renderPreflight(); });\n    window.addEventListener("fpl:prompt-library-changed", () => {\n      if (!Array.isArray(window.FPL_VALIDATION_CERTIFICATION_PROMPT_POOL)) { renderCertificationMatrix(); renderPreflight(); }\n    });`;
  after = replaceOnce(after, promptToolsListener, readinessListeners, 'Certification readiness event listeners', 'window.addEventListener("fpl:four-star-library-ready"');

  write(path, before, after);
}

execFileSync(process.execPath, ['--check', 'js/validation-engine.js'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--check', 'js/admin-studio-finish.js'], { stdio: 'inherit' });
if (fs.existsSync('scripts/verify-all-season-certification-gate.mjs')) {
  execFileSync(process.execPath, ['scripts/verify-all-season-certification-gate.mjs'], { stdio: 'inherit' });
}
