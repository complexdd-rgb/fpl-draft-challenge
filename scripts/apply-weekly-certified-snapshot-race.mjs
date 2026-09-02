import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const lines = (...items) => items.join('\n');

const guardPath = 'js/admin-daily-generator-guard.js';
let guard = fs.readFileSync(guardPath, 'utf8');
const guardMarker = 'const CERTIFIED_GENERATION_SNAPSHOT_POLICY_VERSION = 1;';

if (!guard.includes(guardMarker)) {
  const replaceOnce = (label, before, after) => {
    const count = guard.split(before).length - 1;
    if (count !== 1) throw new Error(label + ': expected one guard patch anchor, found ' + count + '.');
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

  const oldLock = lines(
    '  function lockLibraryToQualityPool() {',
    '    if (!(qualityIds instanceof Set) || qualityIds.size <= 0 || qualityIds.size !== certifiedPoolSize) return null;',
    '    const library = core.getPromptLibrary?.();',
    '    if (!Array.isArray(library)) return null;',
    '    const original = library.slice();',
    '    const certified = original.filter(prompt => qualityIds.has(String(prompt?.id || "")));',
    '    if (certified.length !== certifiedPoolSize) return null;',
    '    library.splice(0, library.length, ...certified);',
    '    core.invalidatePromptStats?.();',
    '    return () => {',
    '      library.splice(0, library.length, ...original);',
    '      core.invalidatePromptStats?.();',
    '    };',
    '  }',
    '',
    '  function certifyGeneratedResults() {',
    '    const results = window.FPL_STUDIO_BATCH_CALENDAR?.getResults?.() || [];',
    '    if (!Array.isArray(results) || results.length !== DAYS_IN_BATCH) return false;',
    '    return results.every(result =>',
    '      result?.status === "PASS"',
    '      && Array.isArray(result.promptIds)',
    '      && result.promptIds.length === 11',
    '      && result.promptIds.every(id => qualityIds?.has(String(id)))',
    '    );',
    '  }'
  );

  const newLock = lines(
    '  function createGenerationQualitySnapshot() {',
    '    if (!(qualityIds instanceof Set) || qualityIds.size <= 0 || qualityIds.size !== certifiedPoolSize) return null;',
    '    const library = core.getPromptLibrary?.();',
    '    if (!Array.isArray(library)) return null;',
    '    const activeIds = new Set(qualityIds);',
    '    const activeSize = certifiedPoolSize;',
    '    const certified = library.filter(prompt => activeIds.has(String(prompt?.id || "")));',
    '    if (certified.length !== activeSize) return null;',
    '    const prompts = Object.freeze(certified.slice());',
    '    window.FPL_DAILY_GENERATION_PROMPT_POOL = prompts;',
    '    return Object.freeze({',
    '      ids: activeIds,',
    '      size: activeSize,',
    '      prompts,',
    '      clear() {',
    '        if (window.FPL_DAILY_GENERATION_PROMPT_POOL === prompts) delete window.FPL_DAILY_GENERATION_PROMPT_POOL;',
    '      }',
    '    });',
    '  }',
    '',
    '  function certifyGeneratedResults(activeIds) {',
    '    const results = window.FPL_STUDIO_BATCH_CALENDAR?.getResults?.() || [];',
    '    if (!Array.isArray(results)) return { ok: false, reason: "The generator did not expose a result list." };',
    '    if (results.length !== DAYS_IN_BATCH) {',
    '      const last = results[results.length - 1];',
    '      const detail = last?.issues?.[0] || (last?.status && last.status !== "PASS" ? "last result status " + last.status : "generation stopped before all seven days completed");',
    '      return { ok: false, reason: "Only " + results.length + "/" + DAYS_IN_BATCH + " days were produced: " + detail + "." };',
    '    }',
    '    for (const result of results) {',
    '      const day = result?.releaseDate || result?.date || "A generated day";',
    '      if (result?.status !== "PASS") return { ok: false, reason: day + " has status " + (result?.status || "missing") + ": " + (result?.issues?.[0] || "validation failed") + "." };',
    '      if (!Array.isArray(result.promptIds) || result.promptIds.length !== 11) return { ok: false, reason: day + " returned " + (Array.isArray(result?.promptIds) ? result.promptIds.length : 0) + "/11 prompt IDs." };',
    '      const uncertified = result.promptIds.filter(id => !activeIds?.has(String(id)));',
    '      if (uncertified.length) return { ok: false, reason: day + " contains " + uncertified.length + " prompt(s) outside the certified generation snapshot: " + uncertified.slice(0, 3).join(", ") + "." };',
    '    }',
    '    return { ok: true, reason: "" };',
    '  }'
  );
  replaceOnce('replace mutable quality lock', oldLock, newLock);

  replaceOnce(
    'generation snapshot variable',
    '    let restoreLibrary = null;\n',
    '    let generationSnapshot = null;\n'
  );

  replaceOnce(
    'install generation snapshot',
    lines(
      '      restoreLibrary = lockLibraryToQualityPool();',
      '      if (!restoreLibrary) {',
      '        setStatus(`Could not lock generation to the current ${certifiedPoolSize.toLocaleString("en-GB")} certified prompts. Reload Studio before generating a future week.`, "fail");',
      '        return;',
      '      }'
    ),
    lines(
      '      generationSnapshot = createGenerationQualitySnapshot();',
      '      if (!generationSnapshot) {',
      '        setStatus(`Could not snapshot the current ${certifiedPoolSize.toLocaleString("en-GB")} certified prompts. Reload Studio before generating a future week.`, "fail");',
      '        return;',
      '      }'
    )
  );

  replaceOnce(
    'snapshot final certification',
    lines(
      '      await generator();',
      '      if (!certifyGeneratedResults()) {',
      '        window.FPL_STUDIO_BATCH_CALENDAR?.clear?.();',
      '        setStatus(`Quality certification failed: every generated prompt must belong to the locked ${certifiedPoolSize.toLocaleString("en-GB")} prompt pool. The batch was cleared and cannot be published.`, "fail");',
      '        return;',
      '      }'
    ),
    lines(
      '      await generator();',
      '      const certification = certifyGeneratedResults(generationSnapshot.ids);',
      '      if (!certification.ok) {',
      '        window.FPL_STUDIO_BATCH_CALENDAR?.clear?.();',
      '        setStatus(`Quality certification failed: ${certification.reason} The batch was cleared and cannot be published.`, "fail");',
      '        return;',
      '      }'
    )
  );

  replaceOnce(
    'snapshot cleanup',
    '      try { restoreLibrary?.(); } catch (_) {}\n      generationRunning = false;',
    '      try { generationSnapshot?.clear?.(); } catch (_) {}\n      generationRunning = false;'
  );

  replaceOnce(
    'ignore shared library invalidation during generation',
    lines(
      '  function onPromptLibraryChanged() {',
      '    qualityIds = null;',
      '    certifiedPoolSize = 0;',
      '    captureQualityPool();',
      '    updateGuardChip();',
      '  }'
    ),
    lines(
      '  function onPromptLibraryChanged() {',
      '    // An in-progress batch owns an immutable certified snapshot. Late prompt-pack events may',
      '    // refresh the shared Studio library, but they must not invalidate that active snapshot.',
      '    if (generationRunning) { updateGuardChip(); return; }',
      '    qualityIds = null;',
      '    certifiedPoolSize = 0;',
      '    captureQualityPool();',
      '    updateGuardChip();',
      '  }'
    )
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
  batch = batch.replace(marker, marker + '  ' + batchMarker + '\n');

  const before = lines(
    '    const apiLibrary = core.getPromptLibrary?.();',
    '    const globalLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];',
    '    // The Daily Challenge quality guard temporarily locks the Studio API library to the',
    '    // certified 4★+ pool. Never union the global library back in here, because doing so can',
    '    // reintroduce prompts the quality analyser deliberately excluded. The global collection',
    '    // is only a bootstrap fallback when the Studio API genuinely has no library.',
    '    const promptSource = Array.isArray(apiLibrary) ? apiLibrary : globalLibrary;',
    '    const promptLibrary = [...new Map(promptSource.filter(prompt => prompt?.id).map(prompt => [String(prompt.id), prompt])).values()];'
  );
  const after = lines(
    '    const generationSnapshot = Array.isArray(window.FPL_DAILY_GENERATION_PROMPT_POOL)',
    '      ? window.FPL_DAILY_GENERATION_PROMPT_POOL',
    '      : null;',
    '    const apiLibrary = core.getPromptLibrary?.();',
    '    const globalLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];',
    '    // Guarded Daily Challenge generation owns an immutable certified snapshot. Prefer it over',
    '    // every mutable Studio/global prompt collection so late prompt-pack events cannot change',
    '    // an in-progress week. Outside guarded generation, the Studio API remains authoritative.',
    '    const promptSource = generationSnapshot || (Array.isArray(apiLibrary) ? apiLibrary : globalLibrary);',
    '    const promptLibrary = [...new Map(promptSource.filter(prompt => prompt?.id).map(prompt => [String(prompt.id), prompt])).values()];'
  );
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
