import fs from 'node:fs';

const replacements = [
  {
    path: 'js/prompt-nationality-context-pack-v1.js',
    from: 'players=()=>Array.isArray(window.FPL_PLAYERS)?window.FPL_PLAYERS:[],library=()=>Array.isArray(window.FPL_PROMPT_LIBRARY)?window.FPL_PROMPT_LIBRARY:null;',
    to: 'players=()=>Array.isArray(window.FPL_PLAYERS)?window.FPL_PLAYERS:[],library=()=>{const api=window.FPL_STUDIO_API?.getPromptLibrary?.();return Array.isArray(api)?api:(Array.isArray(window.FPL_PROMPT_LIBRARY)?window.FPL_PROMPT_LIBRARY:null);};'
  },
  {
    path: 'js/prompt-historical-safe-pack-v1.js',
    from: 'const library = () => Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null;',
    to: 'const library = () => { const api = window.FPL_STUDIO_API?.getPromptLibrary?.(); return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : null); };'
  },
  {
    path: 'js/prompt-nationality-family-generator.js',
    from: 'const library = () => Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : [];',
    to: 'const library = () => { const api = window.FPL_STUDIO_API?.getPromptLibrary?.(); return Array.isArray(api) ? api : (Array.isArray(window.FPL_PROMPT_LIBRARY) ? window.FPL_PROMPT_LIBRARY : []); };'
  }
];

for (const item of replacements) {
  let source = fs.readFileSync(item.path, 'utf8');
  if (!source.includes(item.from)) throw new Error(`Expected library accessor not found in ${item.path}`);
  source = source.replace(item.from, item.to);
  fs.writeFileSync(item.path, source);
}

for (const item of replacements) {
  const source = fs.readFileSync(item.path, 'utf8');
  if (!source.includes('FPL_STUDIO_API?.getPromptLibrary?.()')) throw new Error(`API library bridge missing in ${item.path}`);
}

console.log('Nationality prompt packs now target the live Studio prompt library.');
