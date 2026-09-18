import fs from 'node:fs';

const cutover = fs.readFileSync('js/admin-daily-library-cutover-v1.js', 'utf8');
const authority = fs.readFileSync('js/admin-daily-curated-authority-v1.js', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');

for (const retired of [
  'js/prompt-nationality-context-pack-v1.js',
  'js/prompt-field-readiness.js',
  'js/prompt-field-readiness-panel.js',
  'js/prompt-historical-safe-pack-v1.js',
  'js/prompt-historical-era-pack-v1.js',
  'js/historical-prompt-unlock-audit.js'
]) {
  if (fs.existsSync(retired)) throw new Error(`Retired prompt-expansion runtime still exists: ${retired}`);
}
if (!authority.includes('EXPECTED_FAMILIES = 18') || !authority.includes('EXPECTED_SELECTED = 4959')) {
  throw new Error('Curated Daily authority no longer pins the 4,959 / 18-family boundary.');
}
if (!cutover.includes('"nationality"') || !cutover.includes('field === "nationality"')) {
  throw new Error('Daily cutover no longer supports curated nationality conditions.');
}
if (!admin.includes('data-nationality-enrichment data-loaded="true"')) {
  throw new Error('Studio no longer loads canonical nationality enrichment.');
}
if (admin.includes('data-nationality-context-prompt-pack-v1')) {
  throw new Error('Studio still loads the retired nationality staging pack.');
}

console.log('Weekly nationality readiness verified: curated nationality prompts use canonical enrichment directly, with retired prompt-expansion runtimes physically absent.');
