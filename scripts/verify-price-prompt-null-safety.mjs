import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadPromptArray(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: file });
  const challenge = sandbox.window.FPL_DAILY_CHALLENGE;
  if (challenge && Array.isArray(challenge.prompts)) return { source, prompts: challenge.prompts };
  const library = sandbox.window.FPL_PROMPT_LIBRARY;
  if (Array.isArray(library)) return { source, prompts: library };
  return { source, prompts: [] };
}

const productionSources = ['prompt-library.js', 'todays-challenge.js'];
if (fs.existsSync('challenges')) {
  productionSources.push(...fs.readdirSync('challenges')
    .filter(name => name.endsWith('.js'))
    .sort()
    .map(name => path.join('challenges', name)));
}

const failures = [];
let checkedPrompts = 0;
let pricePrompts = 0;
for (const file of productionSources) {
  const { source, prompts } = loadPromptArray(file);
  checkedPrompts += prompts.length;
  for (const prompt of prompts) {
    const testSource = typeof prompt?.test === 'function' ? prompt.test.toString() : String(prompt?.testSource || '');
    for (const field of ['startingPrice', 'finalPrice']) {
      if (!testSource.includes(`p.${field}`)) continue;
      pricePrompts += 1;
      if (!testSource.includes(`Number.isFinite(p.${field})`)) failures.push(`${file} · ${prompt.id}: ${field}`);
    }
  }
  if (/\b1th[–-]4th\b/.test(source)) failures.push(`${file}: invalid ordinal “1th–4th”`);
}

if (failures.length) {
  throw new Error(`Production price/null safety failures:\n${failures.join('\n')}`);
}

const repositoryLibrary = loadPromptArray('prompt-library.js').prompts;
if (repositoryLibrary.length !== 0) {
  throw new Error(`Repository prompt pool unexpectedly contains ${repositoryLibrary.length} prompts; expected the clean zero boundary.`);
}
if (!checkedPrompts) throw new Error('No production challenge prompts were available to verify.');
if (!pricePrompts) throw new Error('No production price prompts were found; null-safety coverage would be vacuous.');

console.log(`Price-prompt null safety verified across ${checkedPrompts} production challenge prompts (${pricePrompts} price-field checks); repository prompt pool remains intentionally zero.`);
