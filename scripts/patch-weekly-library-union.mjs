import fs from 'node:fs';

const path = 'js/admin-batch-calendar.js';
let source = fs.readFileSync(path, 'utf8');
const before = '    const promptLibrary = core.getPromptLibrary?.() || [];\n';
const after = `    const apiLibrary = Array.isArray(core.getPromptLibrary?.()) ? core.getPromptLibrary() : [];\n    const globalLibrary = Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];\n    const promptLibrary = [...new Map([...apiLibrary, ...globalLibrary].filter(prompt => prompt?.id).map(prompt => [String(prompt.id), prompt])).values()];\n`;
if (!source.includes(before)) throw new Error('weekly prompt library anchor not found');
source = source.replace(before, after);
fs.writeFileSync(path, source);
