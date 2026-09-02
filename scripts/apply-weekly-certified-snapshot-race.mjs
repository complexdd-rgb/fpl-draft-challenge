import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const guardPath = 'js/admin-daily-generator-guard.js';
let guard = fs.readFileSync(guardPath, 'utf8');
const guardMarker = 'const CERTIFIED_GENERATION_SNAPSHOT_POLICY_VERSION = 1;';

if (!guard.includes(guardMarker)) {
  const replaceOnce = (label, before, after) => {
    const count = guard.split(before).length - 1;
    if (count !== 1) throw new Error(`${label}: expected one guard patch anchor, found ${count}.`);
    guard = guard.replace(before, after);
  };

  replaceOnce(
    'guard version header',
    '/* FPL Challenge Studio — Daily Challenge scheduler + quality-pool guard v1.1.1',
    '/* FPL Challenge Studio — Daily Challenge scheduler + quality-pool guard v1.1.2'
  );

  replaceOnce(
    'snapshot policy marker',
    '  const QUALITY_DELETE_MIGRATION_KEY = "fplQualityFloorDeleteMigrationV1";\n',
    '  const QUALITY_DELETE_MIGRATION_KEY = "fplQualityFloorDeleteMigrationV1";\n  const CERTIFIED_GENERATION_SNAPSHOT_POLICY_VERSION = 1;\n'
  );

  replaceOnce(
    'replace mutable quality lock',
    `  function lockLibraryToQualityPool() {\n    if (!(qualityIds instanceof Set) || qualityIds.size <= 0 || qualityIds.size !== certifiedPoolSize) return null;\n    const library = core.getPromptLibrary?.();\n    if (!Array.isArray(library)) return null;\n    const original = library.slice();\n    const certified = original.filter(prompt => qualityIds.has(String(prompt?.id || "")));\n    if (certified.length !== certifiedPoolSize) return null;\n    library.splice(0, library.length, ...certified);\n    core.invalidatePromptStats?.();\n    return () => {\n      library.splice(0, library.length, ...original);\n      core.invalidatePromptStats?.();\n    };\n  }\n\n  function certifyGeneratedResults() {\n    const results = window.FPL_STUDIO_BATCH_CALENDAR?.getResults?.() || [];\n    if (!Array.isArray(results) || results.length !== DAYS_IN_BATCH) return false;\n    return results.every(result =>\n      result?.status === "PASS"\n      && Array.isArray(result.promptIds)\n      && result.promptIds.length === 11\n      && result.promptIds.every(id => qualityIds?.has(String(id)))\n    );\n  }`,
    `  function createGenerationQualitySnapshot() {\n    if (!(qualityIds instanceof Set) || qualityIds.size <= 0 || qualityIds.size !== certifiedPoolSize) return null;\n    const library = core.getPromptLibrary?.();\n    if (!Array.isArray(library)) return null;\n    const activeIds = new Set(qualityIds);\n    const activeSize = certifiedPoolSize;\n    const certified = library.filter(prompt => activeIds.has(String(prompt?.id || "")));\n    if (certified.length !== activeSize) return null;\n    const prompts = Object.freeze(certified.slice());\n    window.FPL_DAILY_GENERATION_PROMPT_POOL = prompts;\n    return Object.freeze({\n      ids: activeIds,\n      size: activeSize,\n      prompts,\n      clear() {\n        if (window.FPL_DAILY_GENERATION_PROMPT_POOL === prompts) delete window.FPL_DAILY_GENERATION_PROMPT_POOL;\n      }\n    });\n  }\n\n  function certifyGeneratedResults(activeIds) {\n    const results = window.FPL_STUDIO_BATCH_CALENDAR?.getResults?.() || [];\n    if (!Array.isArray(results)) return { ok: false, reason: "The generator did not expose a result list." };\n    if (results.length !== DAYS_IN_BATCH) {\n      const last = results[results.length - 1];\n      const detail = last?.issues?.[0] || (last?.status && last.status !== "PASS" ? `last result status ${last.status}` : "generation stopped before all seven days completed");\n      return { ok: false, reason: `Only ${results.length}/${DAYS_IN_BATCH} days were produced: ${detail}.` };\n    }\n    for (const result of results) {\n      if (result?.status !== "PASS") return { ok: false, reason: `${result?.releaseDate || result?.date || "A generated day"} has status ${result?.status || "missing"}: ${result?.issues?.[0] || "validation failed"}.` };\n      if (!Array.isArray(result.promptIds) || result.promptIds.length !== 11) return { ok: false, reason: `${result?.releaseDate || result?.date || "A generated day"} returned ${Array.isArray(result?.promptIds) ? result.promptIds.length : 0}/11 prompt IDs.` };\n      const uncertified = result.promptIds.filter(id => !activeIds?.has(String(id)));\n      if (uncertified.length) return { ok: false, reason: `${result?.releaseDate || result?.date || "A generated day"} contains ${uncertified.length} prompt(s) outside the certified generation snapshot: ${uncertified.slice(0, 3).join(", ")}.` };\n    }\n    return { ok: true, reason: "" };\n  }`
  );

  replaceOnce(
    'generation snapshot variable',
    '    let restoreLibrary = null;\n',
    '    let generationSnapshot = null;\n'
  );

  replaceOnce(
    'install generation snapshot',
    `      restoreLibrary = lockLibraryToQualityPool();\n      if (!restoreLibrary) {\n        setStatus(\`Could not lock generation to the current \${certifiedPoolSize.toLocaleString("en-GB")} certified prompts. Reload Studio before generating a future week.\`, "fail");\n        return;\n      }`,
    `      generationSnapshot = createGenerationQualitySnapshot();\n      if (!generationSnapshot) {\n        setStatus(\`Could not snapshot the current \${certifiedPoolSize.toLocaleString("en-GB")} certified prompts. Reload Studio before generating a future week.\`, "fail");\n        return;\n      }`
  );

  replaceOnce(
    'snapshot final certification',
    `      await generator();\n      if (!certifyGeneratedResults()) {\n        window.FPL_STUDIO_BATCH_CALENDAR?.clear?.();\n        setStatus(\`Quality certification failed: every generated prompt must belong to the locked \${certifiedPoolSize.toLocaleString("en-GB")} prompt pool. The batch was cleared and cannot be published.\`, "fail");\n        return;\n      }`,
    `      await generator();\n      const certification = certifyGeneratedResults(generationSnapshot.ids);\n      if (!certification.ok) {\n        window.FPL_STUDIO_BATCH_CALENDAR?.clear?.();\n        setStatus(\`Quality certification failed: \${certification.reason} The batch was cleared and cannot be published.\`, "fail");\n        return;\n      }`
  );

  replaceOnce(
    'snapshot cleanup',
    '      try { restoreLibrary?.(); } catch (_) {}\n      generationRunning = false;',
    '      try { generationSnapshot?.clear?.(); } catch (_) {}\n      generationRunning = false;'
  );

  replaceOnce(
    'ignore shared library invalidation during generation',
    `  function onPromptLibraryChanged() {\n    qualityIds = null;\n    certifiedPoolSize = 0;\n    captureQualityPool();\n    updateGuardChip();\n  }`,
    `  function onPromptLibraryChanged() {\n    // An in-progress batch owns an immutable certified snapshot. Late prompt-pack events may\n    // refresh the shared Studio library, but they must not invalidate that active snapshot.\n    if (generationRunning) { updateGuardChip(); return; }\n    qualityIds = null;\n    certifiedPoolSize = 0;\n    captureQualityPool();\n    updateGuardChip();\n  }`
  );

  fs.writeFileSync(guardPath, guard);
  console.log('Applied immutable certified-prompt snapshot to Daily Challenge guard.');
} else {
  console.log('Daily Challenge certified generation snapshot is already applied.');
}

const batchPath = 'js/admin-batch-calendar.js';
let batch = fs.readFileSync(batchPath, 'utf8');
const batchMarker = 'const CERTIFIED_SNAPSHOT_SOURCE_POLICY_VERSION = 1;';
if (!batch.includes(batchMarker)) {
  const marker = '  const CERTIFIED_PROMPT_POOL_ONLY_POLICY_VERSION = 1;\n';
  if ((batch.split(marker).length - 1) !== 1) throw new Error('Weekly certified-pool marker was not found exactly once.');
  batch = batch.replace(marker, `${marker}  ${batchMarker}\n`);

  const before = `    const apiLibrary = core.getPromptLibrary?.();\n    const globalLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];\n    // The Daily Challenge quality guard temporarily locks the Studio API library to the\n    // certified 4★+ pool. Never union the global library back in here, because doing so can\n    // reintroduce prompts the quality analyser deliberately excluded. The global collection\n    // is only a bootstrap fallback when the Studio API genuinely has no library.\n    const promptSource = Array.isArray(apiLibrary) ? apiLibrary : globalLibrary;\n    const promptLibrary = [...new Map(promptSource.filter(prompt => prompt?.id).map(prompt => [String(prompt.id), prompt])).values()];`;
  const after = `    const generationSnapshot = Array.isArray(window.FPL_DAILY_GENERATION_PROMPT_POOL)\n      ? window.FPL_DAILY_GENERATION_PROMPT_POOL\n      : null;\n    const apiLibrary = core.getPromptLibrary?.();\n    const globalLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];\n    // Guarded Daily Challenge generation owns an immutable certified snapshot. Prefer it over\n    // every mutable Studio/global prompt collection so late prompt-pack events cannot change\n    // an in-progress week. Outside guarded generation, the Studio API remains authoritative.\n    const promptSource = generationSnapshot || (Array.isArray(apiLibrary) ? apiLibrary : globalLibrary);\n    const promptLibrary = [...new Map(promptSource.filter(prompt => prompt?.id).map(prompt => [String(prompt.id), prompt])).values()];`;
  if ((batch.split(before).length - 1) !== 1) throw new Error('Weekly certified source-selection block was not found exactly once.');
  batch = batch.replace(before, after);
  fs.writeFileSync(batchPath, batch);
  console.log('Applied immutable certified snapshot source to weekly generator.');
} else {
  console.log('Weekly generator immutable certified snapshot source is already applied.');
}

execFileSync(process.execPath, ['--check', guardPath], { stdio: 'inherit' });
execFileSync(process.execPath, ['--check', batchPath], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-weekly-certified-snapshot-race.mjs'], { stdio: 'inherit' });
