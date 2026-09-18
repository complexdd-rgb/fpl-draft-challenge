import fs from 'node:fs';

const readiness = fs.readFileSync('js/prompt-field-readiness.js', 'utf8');
const cutover = fs.readFileSync('js/admin-daily-library-cutover-v1.js', 'utf8');
const authority = fs.readFileSync('js/admin-daily-curated-authority-v1.js', 'utf8');
const admin = fs.readFileSync('admin.html', 'utf8');

if (fs.existsSync('js/prompt-nationality-context-pack-v1.js')) {
  throw new Error('Retired nationality staging prompt pack still exists.');
}
if (readiness.includes('prompt-nationality-context-pack-v1.js')) {
  throw new Error('Field readiness still auto-loads the retired nationality staging pack.');
}
if (!readiness.includes('nationality-enrichment.js?v=1.1.1')) {
  throw new Error('Field readiness no longer loads nationality enrichment context.');
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

console.log('Weekly nationality readiness verified: curated nationality prompts use canonical enrichment directly, with no legacy staging-pack injection.');
