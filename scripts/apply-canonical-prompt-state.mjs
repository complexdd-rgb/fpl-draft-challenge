import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, before, after) => {
  if (before === after) return false;
  fs.writeFileSync(path, after);
  console.log(`Updated ${path}`);
  return true;
};

{
  const path = 'config/asset-manifest.json';
  const before = read(path);
  const manifest = JSON.parse(before);
  manifest.manifestVersion = '1.4.3-canonical-library';
  manifest.assets.assetManifestRuntime.version = '1.4.3-canonical-library';
  manifest.assets.repositoryCertifiedPromptPool = {
    path: 'js/repository-certified-prompt-pool.js',
    version: '1.1.0'
  };
  manifest.assets.promptLibraryCanonicalState = {
    path: 'js/prompt-library-canonical-state.js',
    version: '1.0.0'
  };
  const after = JSON.stringify(manifest, null, 2) + '\n';
  write(path, before, after);
}

{
  const path = 'js/repository-certified-prompt-pool.js';
  const before = read(path);
  let after = before
    .replace('repository-owned certified prompt pool v1.0.0', 'repository-owned certified prompt pool v1.1.0')
    .replace('window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.version === "1.0.0"', 'window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL?.version === "1.1.0"')
    .replace('const VERSION = "1.0.0";', 'const VERSION = "1.1.0";');

  if (!after.includes('function loadCanonicalPromptState()')) {
    const marker = '  const api = Object.freeze({\n';
    if (!after.includes(marker)) throw new Error('Repository prompt pool API marker not found.');
    const helper = `  function loadCanonicalPromptState() {\n    if (window.FPL_PROMPT_LIBRARY_CANONICAL_STATE?.ready) return;\n    if (document.querySelector('script[data-canonical-prompt-library-state]')) return;\n    const script = document.createElement("script");\n    script.src = window.FPL_ASSET_MANIFEST?.url?.("promptLibraryCanonicalState") || "js/prompt-library-canonical-state.js?v=1.0.0";\n    script.async = false;\n    script.dataset.canonicalPromptLibraryState = "1";\n    document.head.appendChild(script);\n  }\n\n`;
    after = after.replace(marker, helper + marker);
  }

  if (!after.includes('window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL = api;\n  loadCanonicalPromptState();')) {
    const marker = '  window.FPL_REPOSITORY_CERTIFIED_PROMPT_POOL = api;\n';
    if (!after.includes(marker)) throw new Error('Repository prompt pool install marker not found.');
    after = after.replace(marker, `${marker}  loadCanonicalPromptState();\n`);
  }

  write(path, before, after);
}

execFileSync(process.execPath, ['--check', 'js/repository-certified-prompt-pool.js'], { stdio:'inherit' });
execFileSync(process.execPath, ['--check', 'js/prompt-library-canonical-state.js'], { stdio:'inherit' });
