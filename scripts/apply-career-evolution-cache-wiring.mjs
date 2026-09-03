import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, source, updated) => {
  if (source !== updated) {
    fs.writeFileSync(path, updated);
    console.log('Updated ' + path);
  }
};
const replaceExactlyOne = (source, pattern, replacement, label) => {
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) throw new Error(`${label} match count was ${matches.length}, expected 1.`);
  return source.replace(pattern, replacement);
};

{
  const path = 'js/prompt-studio-loader.js';
  const source = read(path);
  let updated = source;
  updated = replaceExactlyOne(updated, /js\/admin-import-tools-base\.js\?v=[^"']+/g, 'js/admin-import-tools-base.js?v=16.2.0-careerevolution', 'main generator cache URL');
  updated = replaceExactlyOne(updated, /js\/prompt-target-survivor-generator\.js\?v=[^"']+/g, 'js/prompt-target-survivor-generator.js?v=1.0.1-careerevolution', 'target survivor cache URL');
  updated = replaceExactlyOne(updated, /js\/prompt-target-auto-explorer\.js\?v=[^"']+/g, 'js/prompt-target-auto-explorer.js?v=1.0.1-careerevolution', 'target explorer cache URL');
  write(path, source, updated);
}

{
  const path = 'js/admin-import-tools.js';
  const source = read(path);
  const updated = replaceExactlyOne(source, /js\/prompt-studio-loader\.js\?v=[^"']+/g, 'js/prompt-studio-loader.js?v=1.3.0-careerevolution', 'Prompt Studio loader cache URL');
  write(path, source, updated);
}

{
  const path = 'admin.html';
  const source = read(path);
  const updated = replaceExactlyOne(source, /js\/admin-import-tools\.js\?v=[^"']+/g, 'js/admin-import-tools.js?v=22.3.0-careerevolution', 'admin compatibility loader cache URL');
  write(path, source, updated);
}

for (const path of ['js/prompt-studio-loader.js', 'js/admin-import-tools.js']) {
  execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' });
}
execFileSync(process.execPath, ['scripts/verify-career-evolution-cache-wiring.mjs'], { stdio: 'inherit' });
