import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function replaceOnce(path, before, after) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected exactly one marker, found ${count}: ${before.slice(0, 140)}`);
  write(path, source.replace(before, after));
}

function replaceAll(path, before, after, expected = null) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (expected != null && count !== expected) throw new Error(`${path}: expected ${expected} markers, found ${count}: ${before.slice(0, 140)}`);
  if (!count) throw new Error(`${path}: marker not found: ${before.slice(0, 140)}`);
  write(path, source.split(before).join(after));
}

const batchPath = 'js/admin-batch-calendar.js';
replaceOnce(batchPath,
`/* FPL Challenge Studio — Theme & Formation Engine: formation-aware seven-day challenge calendar generator.`,
`/* FPL Challenge Studio — Theme & Formation Engine v3.2.0: date-identified seven-day challenge calendar generator.`);
replaceOnce(batchPath,
`    startDate: document.querySelector("#batchStartDate"),\n    firstNumber: document.querySelector("#batchFirstNumber"),\n    generateButton: document.querySelector("#generateWeekBtn"),`,
`    startDate: document.querySelector("#batchStartDate"),\n    generateButton: document.querySelector("#generateWeekBtn"),`);
replaceOnce(batchPath,
`  function initialise() {\n    const manifestEntries = getManifestEntries();\n    const manifestMaxNumber = manifestEntries.reduce((max, entry) => Math.max(max, Number(entry.number) || 0), 0);\n    const singleNumber = Number(document.querySelector("#challengeNumber")?.value) || 1;\n\n    if (elements.startDate && !elements.startDate.value) {\n      const singleReleaseDate = document.querySelector("#releaseDate")?.value;\n      elements.startDate.value = isIsoDate(singleReleaseDate) ? singleReleaseDate : addDaysIso(londonDateKey(), 1);\n    }\n    if (elements.firstNumber && !Number(elements.firstNumber.value)) {\n      elements.firstNumber.value = String(Math.max(singleNumber, manifestMaxNumber + 1));\n    } else if (elements.firstNumber && manifestMaxNumber && Number(elements.firstNumber.value) <= manifestMaxNumber) {\n      elements.firstNumber.value = String(manifestMaxNumber + 1);\n    }\n\n    if (elements.manifestChip) {`,
`  function initialise() {\n    const manifestEntries = getManifestEntries();\n\n    if (elements.startDate && !elements.startDate.value) {\n      const singleReleaseDate = document.querySelector("#releaseDate")?.value;\n      elements.startDate.value = isIsoDate(singleReleaseDate) ? singleReleaseDate : addDaysIso(londonDateKey(), 1);\n    }\n\n    if (elements.manifestChip) {`);
replaceOnce(batchPath,
`      elements.startDate, elements.firstNumber, elements.challengeName, elements.difficultyTarget,`,
`      elements.startDate, elements.challengeName, elements.difficultyTarget,`);
replaceOnce(batchPath,
`    const startDate = elements.startDate?.value;\n    const firstNumber = clampNumber(elements.firstNumber?.value, 1, 9999, 1);\n    const baseName =`,
`    const startDate = elements.startDate?.value;\n    const baseName =`);
replaceOnce(batchPath,
`    const batchDates = Array.from({ length: DAYS_IN_BATCH }, (_, index) => addDaysIso(startDate, index));\n    const existingEntries = getManifestEntries();\n    const datesBeingReplaced = new Set(batchDates);\n    const reservedNumbers = new Map(\n      existingEntries\n        .filter(entry => !datesBeingReplaced.has(entry.date))\n        .map(entry => [Number(entry.number) || 0, entry])\n        .filter(([number]) => number > 0)\n    );\n    const numberCollision = Array.from({ length: DAYS_IN_BATCH }, (_, index) => firstNumber + index)\n      .find(number => reservedNumbers.has(number));\n    if (numberCollision) {\n      const entry = reservedNumbers.get(numberCollision);\n      setStatus(\`An internal challenge ID is already reserved for \${entry.date || "another calendar date"}. The generator will choose the next available internal ID.\`, "fail");\n      return;\n    }`,
`    const batchDates = Array.from({ length: DAYS_IN_BATCH }, (_, index) => addDaysIso(startDate, index));\n    const existingEntries = getManifestEntries();\n    const datesBeingReplaced = new Set(batchDates);`);
replaceOnce(batchPath,
`        const date = batchDates[dayIndex];\n        const number = firstNumber + dayIndex;\n        const futureReservedIds =`,
`        const date = batchDates[dayIndex];\n        const futureReservedIds =`);
replaceOnce(batchPath,
`          batchResults.push({\n            date,\n            number,\n            title:`,
`          batchResults.push({\n            date,\n            title:`);
replaceOnce(batchPath,
`        const challenge = {\n          id: \`daily-\${date}-\${slugify(baseName) || "generated-mix"}\`,\n          number,\n          title:`,
`        const challenge = {\n          id: \`daily-\${date}\`,\n          title:`);
replaceOnce(batchPath,
`  id: \${JSON.stringify(challenge.id)},\\n  number: \${challenge.number},\\n  title:`,
`  id: \${JSON.stringify(challenge.id)},\\n  title:`);
replaceOnce(batchPath,
`      id: result.id,\n      number: Number(result.number) || 0,\n      title:`,
`      id: result.id,\n      title:`);
replaceOnce(batchPath,
`  function getManifestEntries() {\n    return Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges)\n      ? window.FPL_CHALLENGE_MANIFEST.challenges.map(entry => ({\n          ...entry,\n          promptIds: Array.isArray(entry.promptIds) ? [...entry.promptIds] : [],\n          promptFamilies: Array.isArray(entry.promptFamilies) ? [...entry.promptFamilies] : [],\n          familyCooldownRelaxedPositions: Array.isArray(entry.familyCooldownRelaxedPositions) ? [...entry.familyCooldownRelaxedPositions] : []\n        }))\n      : [];\n  }`,
`  function normaliseManifestEntry(entry) {\n    const date = String(entry?.date || entry?.release_date || entry?.releaseDate || "");\n    if (!isIsoDate(date)) return null;\n    return {\n      ...(entry && typeof entry === "object" ? entry : {}),\n      date,\n      path: String(entry?.path || \`challenges/\${date}.js\`),\n      id: String(entry?.id || entry?.challenge_id || entry?.challengeId || \`daily-\${date}\`),\n      promptIds: Array.isArray(entry?.promptIds) ? [...entry.promptIds] : [],\n      promptFamilies: Array.isArray(entry?.promptFamilies) ? [...entry.promptFamilies] : [],\n      familyCooldownRelaxedPositions: Array.isArray(entry?.familyCooldownRelaxedPositions) ? [...entry.familyCooldownRelaxedPositions] : []\n    };\n  }\n\n  function repositoryManifestEntries() {\n    const rows = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges) ? window.FPL_CHALLENGE_MANIFEST.challenges : [];\n    return rows.map(normaliseManifestEntry).filter(Boolean);\n  }\n\n  function serverManifestEntries() {\n    const rows = Array.isArray(window.FPL_STUDIO_SCHEDULE?.scheduled) ? window.FPL_STUDIO_SCHEDULE.scheduled : [];\n    return rows.map(row => {\n      const stored = row?.manifest_entry && typeof row.manifest_entry === "object" ? row.manifest_entry : {};\n      return normaliseManifestEntry({\n        ...stored,\n        date: row?.release_date || stored.date,\n        id: stored.id || row?.challenge_id,\n        title: stored.title || row?.title || "",\n        difficulty: stored.difficulty || row?.difficulty || "Mixed",\n        formation: stored.formation || row?.formation || "4-4-2",\n        theme: stored.theme || row?.theme || "Generated Mix",\n        perfectScore: Number(stored.perfectScore ?? row?.perfect_score) || 0\n      });\n    }).filter(Boolean);\n  }\n\n  function getManifestEntries() {\n    const byDate = new Map();\n    for (const entry of repositoryManifestEntries()) byDate.set(entry.date, entry);\n    // Supabase is authoritative for dates already published through Studio. Server rows\n    // overwrite stale repository-manifest rows for the same date and also fill repo gaps.\n    for (const entry of serverManifestEntries()) byDate.set(entry.date, entry);\n    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));\n  }`);
replaceOnce(batchPath,
`    const manifestSource = buildManifestSource(batchManifest);\n    const originalManifest = window.FPL_CHALLENGE_MANIFEST\n      ? buildManifestSource({\n          version: Number(window.FPL_CHALLENGE_MANIFEST.version || 1),\n          timezone: window.FPL_CHALLENGE_MANIFEST.timezone || LONDON_TIMEZONE,\n          fallbackPath: window.FPL_CHALLENGE_MANIFEST.fallbackPath || "todays-challenge.js",\n          challenges: getManifestEntries()\n        })\n      : "/* No challenge manifest was loaded before this batch was generated. */\\n";`,
`    const manifestSource = buildManifestSource(batchManifest);\n    const originalEntries = getManifestEntries();\n    const originalManifest = originalEntries.length\n      ? buildManifestSource({\n          version: Number(window.FPL_CHALLENGE_MANIFEST?.version || 1),\n          timezone: window.FPL_CHALLENGE_MANIFEST?.timezone || LONDON_TIMEZONE,\n          fallbackPath: window.FPL_CHALLENGE_MANIFEST?.fallbackPath || "todays-challenge.js",\n          challenges: originalEntries\n        })\n      : "/* No repository or Supabase challenge schedule was loaded before this batch was generated. */\\n";`);
replaceOnce(batchPath,
`        id: result.id,\n        number: result.number,\n        title:`,
`        id: result.id,\n        title:`);
replaceOnce(batchPath,
`      "5. Upload challenges/manifest.js LAST, replacing the existing manifest.",`,
`      "5. Upload challenges/manifest.js LAST. It is date-keyed and is rebuilt from the repository manifest plus the authoritative Supabase schedule, so previously published dates are preserved.",`);
replaceOnce(batchPath,
`      "The manifest tells the live game which dated file to load. Uploading the dated files first prevents a temporary broken challenge while GitHub Pages is publishing.",`,
`      "The manifest tells the live game which dated file to load. Dates are the challenge identity; numeric challenge sequencing is no longer used. Uploading the dated files first prevents a temporary broken challenge while GitHub Pages is publishing.",`);
replaceOnce(batchPath,
`      id: result.id,\n      number: result.number,\n      formation:`,
`      id: result.id,\n      formation:`);
replaceOnce(batchPath,
`   Upload dated challenge files first, then replace this manifest last. */`,
`   Dates are canonical challenge identities. Upload dated files first, then replace this manifest last. */`);

const guardPath = 'js/admin-daily-generator-guard.js';
replaceOnce(guardPath, 'saved-library generation guard v2.1.0.', 'saved-library generation guard v2.2.0.');
replaceOnce(guardPath, '  const VERSION = "2.1.0";', '  const VERSION = "2.2.0";');
replaceOnce(guardPath,
`  const startDateInput = document.getElementById("batchStartDate");\n  const firstNumberInput = document.getElementById("batchFirstNumber");\n  const formationInput =`,
`  const startDateInput = document.getElementById("batchStartDate");\n  const formationInput =`);
replaceOnce(guardPath,
`  if (!core || !generateButton || !startDateInput || !firstNumberInput) return;`,
`  if (!core || !generateButton || !startDateInput) return;`);
replaceOnce(guardPath,
`  function manifestRows() {\n    const entries = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges)\n      ? window.FPL_CHALLENGE_MANIFEST.challenges\n      : [];\n    return entries.map(entry => ({\n      date: String(entry?.date || ""),\n      number: Number(entry?.number) || 0,\n      source: "manifest"\n    })).filter(entry => isIsoDate(entry.date) && entry.number > 0);\n  }\n\n  function serverRows() {\n    const rows = Array.isArray(window.FPL_STUDIO_SCHEDULE?.scheduled)\n      ? window.FPL_STUDIO_SCHEDULE.scheduled\n      : [];\n    return rows.map(entry => ({\n      date: String(entry?.release_date || entry?.releaseDate || ""),\n      number: Number(entry?.challenge_number ?? entry?.challengeNumber) || 0,\n      source: "server"\n    })).filter(entry => isIsoDate(entry.date) && entry.number > 0);\n  }\n\n  function combinedSchedule() {\n    const byDate = new Map();\n    for (const row of manifestRows()) byDate.set(row.date, row);\n    for (const row of serverRows()) byDate.set(row.date, row);\n    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));\n  }\n\n  function expectedNext() {\n    const rows = combinedSchedule();\n    if (!rows.length) return { date: addDaysIso(londonToday(), 1), number: 1, maxNumber: 0, consistent: true };\n    const latest = rows[rows.length - 1];\n    const maxNumber = rows.reduce((max, row) => Math.max(max, row.number), 0);\n    return {\n      date: addDaysIso(latest.date, 1),\n      number: latest.number + 1,\n      maxNumber,\n      latest,\n      consistent: latest.number === maxNumber\n    };\n  }`,
`  function manifestRows() {\n    const entries = Array.isArray(window.FPL_CHALLENGE_MANIFEST?.challenges)\n      ? window.FPL_CHALLENGE_MANIFEST.challenges\n      : [];\n    return entries.map(entry => ({\n      date: String(entry?.date || ""),\n      source: "manifest"\n    })).filter(entry => isIsoDate(entry.date));\n  }\n\n  function serverRows() {\n    const rows = Array.isArray(window.FPL_STUDIO_SCHEDULE?.scheduled)\n      ? window.FPL_STUDIO_SCHEDULE.scheduled\n      : [];\n    return rows.map(entry => ({\n      date: String(entry?.release_date || entry?.releaseDate || ""),\n      source: "server"\n    })).filter(entry => isIsoDate(entry.date));\n  }\n\n  function combinedSchedule() {\n    const byDate = new Map();\n    for (const row of manifestRows()) byDate.set(row.date, row);\n    for (const row of serverRows()) byDate.set(row.date, row);\n    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));\n  }\n\n  function expectedNext() {\n    const rows = combinedSchedule();\n    if (!rows.length) return { date: addDaysIso(londonToday(), 1), latest: null };\n    const latest = rows[rows.length - 1];\n    return { date: addDaysIso(latest.date, 1), latest };\n  }`);
replaceOnce(guardPath,
`    const nextText = next?.date && next?.number ? \`next #\${next.number} · \${next.date}\` : "live schedule pending";`,
`    const nextText = next?.date ? \`next · \${next.date}\` : "live schedule pending";`);
replaceOnce(guardPath,
`  function syncInputsToSchedule(force = false) {\n    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") {\n      updateGuardChip();\n      return false;\n    }\n    const next = expectedNext();\n    if (!next.consistent) return false;\n    const start = String(startDateInput.value || "");\n    const number = Number(firstNumberInput.value) || 0;\n    const stale = !isIsoDate(start) || start < next.date || number <= next.maxNumber;\n    if (force || stale) {\n      startDateInput.value = next.date;\n      firstNumberInput.value = String(next.number);\n    }\n    updateGuardChip();\n    return true;\n  }\n\n  function validateScheduleSelection() {\n    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") {\n      return { ok: false, reason: "The live Supabase schedule is not ready. Generation stays locked until the server schedule has been refreshed successfully." };\n    }\n    const next = expectedNext();\n    if (!next.consistent) {\n      return { ok: false, reason: \`Challenge numbering is inconsistent: the latest dated challenge is #\${next.latest?.number || "?"}, but #\${next.maxNumber} is already reserved elsewhere. Resolve the schedule before generating.\` };\n    }\n\n    const start = String(startDateInput.value || "");\n    const first = Number(firstNumberInput.value) || 0;\n    if (start !== next.date || first !== next.number) {\n      startDateInput.value = next.date;\n      firstNumberInput.value = String(next.number);\n      updateGuardChip();\n      return {\n        ok: false,\n        reason: \`Schedule synced to the next unused slot: \${next.date}, Challenge #\${next.number}. Press Generate week again to build #\${next.number}–#\${next.number + DAYS_IN_BATCH - 1}.\`\n      };\n    }\n\n    const dates = new Set(serverRows().map(row => row.date));\n    const numbers = new Set(serverRows().map(row => row.number));\n    for (let index = 0; index < DAYS_IN_BATCH; index += 1) {\n      const date = addDaysIso(start, index);\n      const number = first + index;\n      if (dates.has(date) || numbers.has(number)) {\n        return { ok: false, reason: \`\${date} / Challenge #\${number} is already scheduled in Supabase. Remove that scheduled day or week before regenerating it.\` };\n      }\n    }\n    return { ok: true };\n  }`,
`  function syncInputsToSchedule(force = false) {\n    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") {\n      updateGuardChip();\n      return false;\n    }\n    const next = expectedNext();\n    const start = String(startDateInput.value || "");\n    const stale = !isIsoDate(start) || start < next.date;\n    if (force || stale) startDateInput.value = next.date;\n    updateGuardChip();\n    return true;\n  }\n\n  function validateScheduleSelection() {\n    if (window.FPL_STUDIO_SCHEDULE?.status !== "ready") {\n      return { ok: false, reason: "The live Supabase schedule is not ready. Generation stays locked until the server schedule has been refreshed successfully." };\n    }\n    const next = expectedNext();\n    const start = String(startDateInput.value || "");\n    if (start !== next.date) {\n      startDateInput.value = next.date;\n      updateGuardChip();\n      return {\n        ok: false,\n        reason: \`Schedule synced to the next unused date: \${next.date}. Press Generate week again to build the next seven dated challenges.\`\n      };\n    }\n\n    const dates = new Set(serverRows().map(row => row.date));\n    for (let index = 0; index < DAYS_IN_BATCH; index += 1) {\n      const date = addDaysIso(start, index);\n      if (dates.has(date)) {\n        return { ok: false, reason: \`\${date} is already scheduled in Supabase. Remove that scheduled day or week before regenerating it.\` };\n      }\n    }\n    return { ok: true };\n  }`);

const publishPath = 'js/admin-daily-publish.js';
replaceOnce(publishPath,
`/* FPL Challenge Studio — publish a validated seven-day package directly to Supabase. */`,
`/* FPL Challenge Studio — publish a validated date-identified seven-day package directly to Supabase v1.1.0. */`);
replaceOnce(publishPath,
`    lastDate: "",\n    error: "",`,
`    lastDate: "",\n    today: "",\n    error: "",`);
replaceOnce(publishPath,
`      scheduleApi.scheduled = scheduled;\n      scheduleApi.lastDate = last;`,
`      scheduleApi.scheduled = scheduled;\n      scheduleApi.lastDate = last;\n      scheduleApi.today = String(data.today || "");`);
replaceOnce(publishPath,
`      setStatus(\`${scheduled.length} Supabase challenge\${scheduled.length === 1 ? "" : "s"} scheduled · coverage through \${last}. Midnight rollover is automatic.\`, "published");`,
`      setStatus(\`${scheduled.length} Supabase challenge date\${scheduled.length === 1 ? "" : "s"} stored · coverage through \${last}. Midnight rollover is automatic.\`, "published");`);
replaceOnce(publishPath,
`        challengeId: String(entry.id || ""),\n        challengeNumber: Number(entry.number) || 0,\n        title:`,
`        challengeId: String(entry.id || \`daily-\${date}\`),\n        challengeNumber: 0, // legacy schema field; releaseDate is the canonical identity\n        title:`);

const edgePath = 'supabase/functions/daily-challenge-publish/index.ts';
replaceOnce(edgePath,
`  if (!Number.isInteger(challengeNumber) || challengeNumber < 1) throw httpError(400, \`Challenge \${releaseDate} has an invalid number.\`);`,
`  if (!Number.isInteger(challengeNumber) || challengeNumber < 0) throw httpError(400, \`Challenge \${releaseDate} has invalid legacy number metadata.\`);`);
replaceOnce(edgePath,
`        .select("release_date, challenge_id, challenge_number, title, perfect_score, published_at")\n        .eq("active", true)\n        .gte("release_date", today)\n        .order("release_date", { ascending: true })\n        .limit(60);`,
`        .select("release_date, challenge_id, challenge_number, title, difficulty, formation, theme, perfect_score, manifest_entry, published_at")\n        .eq("active", true)\n        .order("release_date", { ascending: true })\n        .limit(400);`);

const fragmentPath = 'fragments/admin-daily-workspace.html';
replaceOnce(fragmentPath,
`          <input id="batchFirstNumber" type="hidden" value="0">\n`,
``);
replaceOnce(fragmentPath,
`            <p>Build seven dated challenges in one run. Exact prompts now rotate through their full compatible position pool before reuse, while similar prompt families use the configured day cooldown. Scheduled challenges already in the manifest count too.</p>`,
`            <p>Build seven dated challenges in one run. The release date is the challenge identity. Exact prompts rotate through their full compatible position pool before reuse, while similar prompt families use the configured day cooldown. Published Supabase dates and repository-manifest dates both count.</p>`);

const configPath = 'config/asset-manifest.json';
const manifest = JSON.parse(read(configPath));
manifest.manifestVersion = '3.0.0-date-only-daily';
manifest.assets.assetManifestRuntime.version = '3.0.0-date-only-daily';
manifest.assets.adminDailyPublish.version = '1.1.0-date-identity';
manifest.assets.adminBatchCalendar.version = '3.2.0-date-identity';
manifest.assets.adminDailyGeneratorGuard.version = '2.2.0-date-identity';
write(configPath, JSON.stringify(manifest, null, 2) + '\n');

const cleanPath = 'scripts/verify-prompt-studio-clean-reset.mjs';
replaceAll(cleanPath, '2.9.0-daily-semantic-diversity', '3.0.0-date-only-daily', 3);
replaceAll(cleanPath, '2.1.0-semantic-diversity', '2.2.0-date-identity', 1);
replaceAll(cleanPath, '3.1.0-semantic-diversity', '3.2.0-date-identity', 1);
replaceAll(cleanPath, 'saved-library generation guard v2.1.0', 'saved-library generation guard v2.2.0', 1);
replaceOnce(cleanPath,
`assert(manifest.assets?.adminBatchCalendar?.version === '3.2.0-date-identity', 'Batch calendar semantic-diversity cache version is stale.');`,
`assert(manifest.assets?.adminBatchCalendar?.version === '3.2.0-date-identity', 'Batch calendar date-identity cache version is stale.');\nassert(manifest.assets?.adminDailyPublish?.version === '1.1.0-date-identity', 'Daily publishing date-identity cache version is stale.');`);

const weeklyPath = 'scripts/verify-weekly-certified-snapshot-race.mjs';
replaceOnce(weeklyPath,
`const batch = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');`,
`const batch = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');\nconst publish = fs.readFileSync('js/admin-daily-publish.js', 'utf8');\nconst publishEdge = fs.readFileSync('supabase/functions/daily-challenge-publish/index.ts', 'utf8');\nconst dailyFragment = fs.readFileSync('fragments/admin-daily-workspace.html', 'utf8');`);
replaceAll(weeklyPath, 'saved-library generation guard v2.1.0', 'saved-library generation guard v2.2.0', 1);
replaceOnce(weeklyPath,
`assert(!dailyGuard.includes(forbidden), \`Daily Challenge guard still contains retired 851-prompt authority: \${forbidden}\`);\n}\n`,
`assert(!dailyGuard.includes(forbidden), \`Daily Challenge guard still contains retired 851-prompt authority: \${forbidden}\`);\n}\n\nassert(!guard.includes('batchFirstNumber'), 'Date-only guard still depends on the retired first challenge number input.');\nassert(!batch.includes('batchFirstNumber'), 'Date-only batch generator still depends on the retired first challenge number input.');\nassert(!dailyFragment.includes('batchFirstNumber'), 'Native Daily workspace still renders the retired first challenge number input.');\nassert(batch.includes('id: \\`daily-\\${date}\\`'), 'Generated challenge id is not canonicalised to its release date.');\nassert(!batch.includes('const number = firstNumber + dayIndex;'), 'Batch generator still sequences numeric challenge ids.');\nassert(!batch.includes('number: Number(result.number) || 0,'), 'New manifest entries still emit challenge numbers.');\nassert(batch.includes('function serverManifestEntries()'), 'ZIP manifest builder does not merge the authoritative Supabase schedule.');\nassert(batch.includes('row?.manifest_entry'), 'ZIP manifest builder does not consume stored Supabase manifest entries.');\nassert(publish.includes('challengeNumber: 0, // legacy schema field; releaseDate is the canonical identity'), 'Publishing payload does not pin legacy number metadata to zero.');\nassert(publishEdge.includes('challengeNumber < 0'), 'Publishing Edge Function still requires positive challenge numbers.');\nassert(publishEdge.includes('manifest_entry, published_at'), 'Schedule status does not expose stored manifest entries for non-destructive export.');\nassert(!publishEdge.includes('.gte("release_date", today)'), 'Schedule status still hides historical Supabase dates needed to reconstruct the manifest.');\n\nconst addIsoDays = (iso, amount) => {\n  const [year, month, day] = iso.split('-').map(Number);\n  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);\n};\nconst dated = (start, count, source) => Array.from({ length: count }, (_, index) => ({ date: addIsoDays(start, index), source }));\nconst staleRepo = dated('2026-08-01', 17, 'repo');\nconst authoritativeServer = dated('2026-08-18', 20, 'server');\nconst newWeek = dated('2026-09-07', 7, 'batch');\nconst mergedByDate = new Map();\nfor (const entry of staleRepo) mergedByDate.set(entry.date, entry);\nfor (const entry of authoritativeServer) mergedByDate.set(entry.date, entry);\nfor (const entry of newWeek) mergedByDate.set(entry.date, entry);\nconst mergedDates = [...mergedByDate.keys()].sort();\nassert(mergedDates.length === 44, 'Date-keyed manifest regression lost or duplicated schedule dates.');\nassert(mergedDates[0] === '2026-08-01' && mergedDates.at(-1) === '2026-09-13', 'Date-keyed manifest regression has the wrong schedule boundaries.');\nfor (let index = 1; index < mergedDates.length; index += 1) {\n  assert(mergedDates[index] === addIsoDays(mergedDates[index - 1], 1), \`Date-keyed manifest regression created a gap before \${mergedDates[index]}.\`);\n}\n`);
replaceOnce(weeklyPath,
`console.log('Saved-library generation snapshot verified: immutable 77-prompt reservoir, 17-family proportional allocation, seven nationality prompts and exact once-per-week consumption are protected.');`,
`console.log('Saved-library generation snapshot verified: immutable 77-prompt reservoir, semantic spread, date-only challenge identity and non-destructive Supabase-backed manifest export are protected.');`);

for (const [path, forbidden] of [
  [batchPath, 'batchFirstNumber'],
  [guardPath, 'batchFirstNumber'],
  [fragmentPath, 'batchFirstNumber']
]) assert(!read(path).includes(forbidden), `${path}: retired number input survived patch.`);
assert(read(batchPath).includes('function serverManifestEntries()'), 'Batch exporter missing server manifest merge after patch.');
assert(read(edgePath).includes('manifest_entry, published_at'), 'Edge status missing manifest_entry after patch.');

console.log('Date-only Daily identity patch applied: numbering removed from future generation, Supabase schedule made authoritative for ZIP reconstruction, and regression boundaries updated.');
