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
{
  const path = 'js/prompt-studio-loader.js';
  const source = read(path);
  let updated = source;
  const marker = '    load("js/admin-import-tools-base.js?v=16.1.0-familymix", () => {';
  const oldTargetLoad = '      load("js/prompt-target-survivor-generator.js?v=1.0.0");';
  const targetBlock = `      load("js/prompt-target-survivor-generator.js?v=1.0.0", () => {
        load("js/prompt-target-auto-explorer.js?v=1.0.0");
      });`;

  if (!updated.includes('js/prompt-target-auto-explorer.js?v=1.0.0')) {
    if (updated.includes(oldTargetLoad)) {
      updated = updated.replace(oldTargetLoad, targetBlock);
    } else {
      const count = updated.split(marker).length - 1;
      if (count !== 1) throw new Error(`Prompt Studio generator marker count was ${count}, expected 1.`);
      updated = updated.replace(marker, `${marker}\n${targetBlock}`);
    }
  }
  write(path, source, updated);
}

// Cache-bust the lazy Prompt Studio loader so existing browser sessions pick up auto-exploration.
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

// Cache-bust the compatibility entrypoint in admin.html.
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

for (const path of [
  'js/prompt-target-survivor-generator.js',
  'js/prompt-target-auto-explorer.js',
  'js/prompt-studio-loader.js',
  'js/admin-import-tools.js'
]) execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });

execFileSync(process.execPath, ['scripts/verify-prompt-target-survivor-generator.mjs'], { stdio: 'inherit' });
