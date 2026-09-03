import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, source, updated) => {
  if (updated !== source) {
    fs.writeFileSync(path, updated);
    console.log('Updated ' + path);
  }
};

// Load the target-survivor controller and its safe auto-explorer with the main Prompt Studio generator.
// This patcher is intentionally upgrade-only: once both modules are present, newer feature packs own
// the cache versions and this older installer must never downgrade them.
let installedBefore = false;
{
  const path = 'js/prompt-studio-loader.js';
  const source = read(path);
  let updated = source;
  const hasTarget = /js\/prompt-target-survivor-generator\.js\?v=[^"']+/.test(updated);
  const hasExplorer = /js\/prompt-target-auto-explorer\.js\?v=[^"']+/.test(updated);
  installedBefore = hasTarget && hasExplorer;

  if (!hasExplorer) {
    const standaloneTarget = /([ \t]*)load\("(js\/prompt-target-survivor-generator\.js\?v=[^"']+)"\);/;
    const targetMatch = updated.match(standaloneTarget);
    if (targetMatch) {
      const indent = targetMatch[1];
      const src = targetMatch[2];
      updated = updated.replace(standaloneTarget, `${indent}load("${src}", () => {\n${indent}  load("js/prompt-target-auto-explorer.js?v=1.0.0");\n${indent}});`);
    } else if (!hasTarget) {
      const marker = /(    load\("js\/admin-import-tools-base\.js\?v=[^"']+", \(\) => \{)/;
      const matches = updated.match(new RegExp(marker.source, 'g')) || [];
      if (matches.length !== 1) throw new Error(`Prompt Studio generator marker count was ${matches.length}, expected 1.`);
      const targetBlock = `      load("js/prompt-target-survivor-generator.js?v=1.0.0", () => {\n        load("js/prompt-target-auto-explorer.js?v=1.0.0");\n      });`;
      updated = updated.replace(marker, `$1\n${targetBlock}`);
    } else {
      throw new Error('Target-survivor module is present but its auto-explorer load shape could not be upgraded safely.');
    }
  }
  write(path, source, updated);
}

// Only the first installation needs to invalidate the outer lazy-loader caches. A later feature
// pack may already have advanced these URLs; preserve those newer versions on repeat runs.
if (!installedBefore) {
  {
    const path = 'js/admin-import-tools.js';
    const source = read(path);
    const replacement = 'load("js/prompt-studio-loader.js?v=1.2.0-targetexplore", "data-prompt-studio-loader", () => {';
    let updated = source;
    if (!updated.includes(replacement)) {
      const pattern = /load\("js\/prompt-studio-loader\.js(?:\?v=[^"]+)?", "data-prompt-studio-loader", \(\) => \{/;
      if (!pattern.test(updated)) throw new Error('Prompt Studio compatibility loader call was not found.');
      updated = updated.replace(pattern, replacement);
    }
    write(path, source, updated);
  }

  {
    const path = 'admin.html';
    const source = read(path);
    const targetTag = '  <script src="js/admin-import-tools.js?v=22.2.0-targetexplore"></script>';
    let updated = source;
    if (!updated.includes(targetTag)) {
      const pattern = /\s*<script src="js\/admin-import-tools\.js\?v=[^"]+"><\/script>/;
      if (!pattern.test(updated)) throw new Error('admin-import-tools.js script tag was not found in admin.html.');
      updated = updated.replace(pattern, `\n${targetTag}`);
    }
    write(path, source, updated);
  }
} else {
  console.log('Target-survivor and auto-explorer modules are already installed; newer cache versions preserved.');
}

for (const path of [
  'js/prompt-target-survivor-generator.js',
  'js/prompt-target-auto-explorer.js',
  'js/prompt-studio-loader.js',
  'js/admin-import-tools.js'
]) execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });

execFileSync(process.execPath, ['scripts/verify-prompt-target-survivor-generator.mjs'], { stdio: 'inherit' });
