import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = 'js/admin-batch-calendar.js';
let source = fs.readFileSync(path, 'utf8');
const marker = 'const EXACT_ROTATION_REPLAY_POLICY_VERSION = 2;';

if (!source.includes(marker)) {
  const policyAnchor = '  const CERTIFIED_SNAPSHOT_SOURCE_POLICY_VERSION = 1;\n';
  if ((source.split(policyAnchor).length - 1) !== 1) throw new Error('Exact-rotation policy anchor was not found exactly once.');
  source = source.replace(policyAnchor, `${policyAnchor}  ${marker}\n`);

  const oldReplay = `  function buildExactRotationState(schedule, beforeDate, basePools, promptById) {
    const state = Object.fromEntries(Object.keys(basePools).map(position => [position, { cycle: 1, usedIds: new Set() }]));
    const poolIds = Object.fromEntries(Object.entries(basePools).map(([position, prompts]) => [position, new Set(prompts.map(prompt => prompt.id))]));
    const entries = schedule
      .filter(entry => entry.date && entry.date < beforeDate)
      .sort((left, right) => String(left.date).localeCompare(String(right.date)));

    for (const entry of entries) {
      for (const promptId of entry.promptIds || []) {
        const prompt = promptById.get(promptId);
        const position = prompt?.position;
        if (!position || !state[position] || !poolIds[position].has(promptId)) continue;
        const positionState = state[position];
        if (positionState.usedIds.size >= poolIds[position].size) {
          positionState.cycle += 1;
          positionState.usedIds.clear();
        }
        positionState.usedIds.add(promptId);
        if (positionState.usedIds.size >= poolIds[position].size) {
          positionState.cycle += 1;
          positionState.usedIds.clear();
        }
      }
    }
    return state;
  }`;

  const newReplay = `  function buildExactRotationState(schedule, beforeDate, basePools, promptById) {
    const state = Object.fromEntries(Object.keys(basePools).map(position => [position, { cycle: 1, usedIds: new Set() }]));
    const poolIds = Object.fromEntries(Object.entries(basePools).map(([position, prompts]) => [position, new Set(prompts.map(prompt => prompt.id))]));
    const entries = schedule
      .filter(entry => entry.date && entry.date < beforeDate)
      .sort((left, right) => String(left.date).localeCompare(String(right.date)));

    for (const entry of entries) {
      for (const promptId of entry.promptIds || []) {
        const prompt = promptById.get(promptId);
        const position = prompt?.position;
        if (!position || !state[position] || !poolIds[position].has(promptId)) continue;
        const positionState = state[position];

        // The current library can be larger than the library that existed when old challenges
        // were generated. A repeat before every current ID has appeared proves that the old
        // rotation already rolled over under that earlier pool. Treat the repeat as the start
        // of the next reconstructed cycle; otherwise newly-added prompts become a false backlog
        // and can all be forced into one day at the bridge boundary.
        if (positionState.usedIds.has(promptId)) {
          positionState.cycle += 1;
          positionState.usedIds.clear();
        }

        positionState.usedIds.add(promptId);
        if (positionState.usedIds.size >= poolIds[position].size) {
          positionState.cycle += 1;
          positionState.usedIds.clear();
        }
      }
    }
    return state;
  }`;

  if ((source.split(oldReplay).length - 1) !== 1) throw new Error('Exact-rotation replay block was not found exactly once.');
  source = source.replace(oldReplay, newReplay);

  const resultAnchor = '      date: result.releaseDate,\n      id: result.id,';
  if ((source.split(resultAnchor).length - 1) !== 1) throw new Error('Weekly result diagnostic anchor was not found exactly once.');
  source = source.replace(resultAnchor, '      date: result.releaseDate || result.date,\n      releaseDate: result.releaseDate || result.date,\n      id: result.id,');

  const issueAnchor = '      status: result.status,\n      promptIds: [...(result.promptIds || [])],';
  if ((source.split(issueAnchor).length - 1) !== 1) throw new Error('Weekly result issues anchor was not found exactly once.');
  source = source.replace(issueAnchor, '      status: result.status,\n      issues: Array.isArray(result.issues) ? [...result.issues] : [],\n      promptIds: [...(result.promptIds || [])],');

  fs.writeFileSync(path, source);
  console.log('Applied library-evolution-safe exact rotation replay and preserved weekly failure diagnostics.');
} else {
  console.log('Exact rotation replay already handles library expansion safely.');
}

execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-weekly-rotation-library-evolution.mjs'], { stdio: 'inherit' });
