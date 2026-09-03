import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};

const target = read('js/prompt-target-survivor-generator.js');
for (const [token, label] of [
  ['const RUN_KEY = "fplPromptTargetSurvivorRunV1"', 'persistent run state'],
  ['const STALL_LIMIT = 3', 'stall safety cap'],
  ['const HARD_BATCH_MAX = 50', 'generator hard batch cap'],
  ['factorySurvivorTarget', 'survivor target input'],
  ['generateToSurvivorTargetBtn', 'target-run start button'],
  ['fpl:four-star-library-ready', '4-star enforcement resume event'],
  ['phase = "waiting-enforcement"', 'post-save enforcement phase'],
  ['attemptedIds', 'rejected/repeated candidate memory'],
  ['captureSettings', 'generator settings snapshot'],
  ['applySettings', 'generator settings replay'],
  ['elements.generate.click()', 'normal generator reuse'],
  ['elements.add.click()', 'normal browser-library save reuse'],
  ['prompt?.enabled !== false', 'enabled survivor count'],
  ['Math.min(HARD_BATCH_MAX', 'adaptive batch cap'],
  ['state.stalled >= STALL_LIMIT', 'stall stop condition'],
  ['current >= state.target', 'target completion condition']
]) requireText(target, token, label);

const loader = read('js/prompt-studio-loader.js');
requireText(loader, 'js/prompt-target-survivor-generator.js?v=1.0.0', 'target-survivor lazy load');

const compatibility = read('js/admin-import-tools.js');
requireText(compatibility, 'js/prompt-studio-loader.js?v=1.1.0-targetsurvivor', 'Prompt Studio loader cache bust');

const admin = read('admin.html');
requireText(admin, 'js/admin-import-tools.js?v=22.1.0-targetsurvivor', 'admin compatibility cache bust');

console.log('Prompt target-survivor verifier passed: target floor, enforcement resume, safety caps, settings replay, duplicate memory and cache wiring are intact.');
