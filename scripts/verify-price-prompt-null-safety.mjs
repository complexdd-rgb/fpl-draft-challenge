import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('prompt-library.js', 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: 'prompt-library.js' });

const prompts = Array.isArray(sandbox.window.FPL_PROMPT_LIBRARY)
  ? sandbox.window.FPL_PROMPT_LIBRARY
  : [];

if (!prompts.length) throw new Error('Prompt library did not load.');

const failures = [];
for (const prompt of prompts) {
  const testSource = String(prompt?.test || '');
  for (const field of ['startingPrice', 'finalPrice']) {
    if (!testSource.includes(`p.${field}`)) continue;
    if (!testSource.includes(`Number.isFinite(p.${field})`)) {
      failures.push(`${prompt.id}: ${field}`);
    }
  }
}

if (failures.length) {
  throw new Error(`Price prompts without explicit finite-number guards:\n${failures.join('\n')}`);
}

if (/\b1th[–-]4th\b/.test(source)) {
  throw new Error('Prompt library still contains the invalid ordinal “1th–4th”.');
}

console.log(`Price-prompt null safety verified across ${prompts.length} prompts.`);
