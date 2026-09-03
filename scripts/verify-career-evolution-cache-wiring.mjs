import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};

const admin = read('admin.html');
requireText(admin, 'js/admin-import-tools.js?v=22.3.0-careerevolution', 'admin compatibility cache bust');
requireText(admin, 'factoryIncludeCareerEvolutionFamilies', 'Career Evolution generator option');

const compatibility = read('js/admin-import-tools.js');
requireText(compatibility, 'js/prompt-studio-loader.js?v=1.3.0-careerevolution', 'Prompt Studio loader cache bust');

const loader = read('js/prompt-studio-loader.js');
requireText(loader, 'js/admin-import-tools-base.js?v=16.2.0-careerevolution', 'main generator cache bust');
requireText(loader, 'js/prompt-target-survivor-generator.js?v=1.0.1-careerevolution', 'target survivor cache bust');
requireText(loader, 'js/prompt-target-auto-explorer.js?v=1.0.1-careerevolution', 'auto explorer cache bust');

const base = read('js/admin-import-tools-base.js');
requireText(base, 'js/prompt-career-evolution-family-generator.js?v=1.0.0', 'Career Evolution provider load');
requireText(base, 'includeCareerEvolutionFamilies', 'Career Evolution generator integration');

console.log('Career Evolution cache wiring verified: existing Studio sessions will reload the new main generator, target runner and auto-explorer modules.');
