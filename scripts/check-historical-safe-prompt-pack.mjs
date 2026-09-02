import fs from 'node:fs';

const packPath = 'js/prompt-historical-safe-pack-v1.js';
const readinessPath = 'js/prompt-field-readiness.js';
const loaderPath = 'js/career-overlap-wording.js';
for (const path of [packPath, readinessPath, loaderPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing required prompt file: ${path}`);
}
const pack = fs.readFileSync(packPath, 'utf8');
const readiness = fs.readFileSync(readinessPath, 'utf8');
const loader = fs.readFileSync(loaderPath, 'utf8');

const requiredPackMarkers = [
  'FPL_HISTORICAL_SAFE_PROMPT_PACK_V1',
  'historical-safe',
  'partial-data-safe',
  'nationality-scorer',
  'inverse-points',
  'relegated-scorer',
  'outside-big-six-scorer',
  'clean-sheet-workhorse'
];
for (const marker of requiredPackMarkers) if (!pack.includes(marker)) throw new Error(`Historical-safe pack missing marker: ${marker}`);
if (!pack.includes('p.points !== null') || !pack.includes('p.goals !== null')) throw new Error('Historical-safe pack must explicitly reject null numeric fields.');
if (!readiness.includes('HISTORICAL_CORE_ELIGIBLE') || !readiness.includes('REQUIRES_FPL_NATIVE')) throw new Error('Field-readiness tiers are incomplete.');
if (!loader.includes('prompt-historical-safe-pack-v1.js')) throw new Error('Historical-safe pack is not wired into Prompt Studio loader.');
if (!loader.includes('prompt-field-readiness.js')) throw new Error('Field-readiness mapper is not wired into Prompt Studio loader.');
console.log('Historical-safe prompt expansion static checks passed.');
