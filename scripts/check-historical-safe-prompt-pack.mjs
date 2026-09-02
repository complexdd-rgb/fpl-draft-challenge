import fs from 'node:fs';

const packPath = 'js/prompt-historical-safe-pack-v1.js';
const eraPath = 'js/prompt-historical-era-pack-v1.js';
const nationalityContextPath = 'js/prompt-nationality-context-pack-v1.js';
const readinessPath = 'js/prompt-field-readiness.js';
const panelPath = 'js/prompt-field-readiness-panel.js';
const manifestPath = 'js/historical-season-field-manifest.js';
const unlockAuditPath = 'js/historical-prompt-unlock-audit.js';
const loaderPath = 'js/career-overlap-wording.js';
for (const path of [packPath, eraPath, nationalityContextPath, readinessPath, panelPath, manifestPath, unlockAuditPath, loaderPath]) {
  if (!fs.existsSync(path)) throw new Error(`Missing required prompt file: ${path}`);
}
const pack = fs.readFileSync(packPath, 'utf8');
const era = fs.readFileSync(eraPath, 'utf8');
const nationalityContext = fs.readFileSync(nationalityContextPath, 'utf8');
const readiness = fs.readFileSync(readinessPath, 'utf8');
const panel = fs.readFileSync(panelPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');
const unlockAudit = fs.readFileSync(unlockAuditPath, 'utf8');
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
if (!pack.includes('const k = f =>') || !pack.includes('!== null') || !pack.includes('Number.isFinite')) throw new Error('Historical-safe pack null/finite numeric guard helper is missing.');
if (!pack.includes('k("points")') || !pack.includes('k("goals")') || !pack.includes('k("minutes")')) throw new Error('Historical-safe generated rules are not using the numeric guard helper for core fields.');
if (!era.includes('FPL_HISTORICAL_ERA_PROMPT_PACK_V1') || !era.includes('era-scorer') || !era.includes('era-workhorse')) throw new Error('Historical era pack is incomplete.');
if (!era.includes('p.goals!==null') || !era.includes('p.minutes!==null')) throw new Error('Historical era pack must explicitly reject null numeric fields.');
if (!nationalityContext.includes('FPL_NATIONALITY_CONTEXT_PROMPT_PACK_V1') || !nationalityContext.includes('bottom-half-scorer') || !nationalityContext.includes('relegated-scorer') || !nationalityContext.includes('outside-big-six-scorer')) throw new Error('Nationality context pack is incomplete.');
if (!nationalityContext.includes('p.goals!==null') || !nationalityContext.includes('partial-data-safe')) throw new Error('Nationality context pack must be historical/null safe.');
if (!readiness.includes('HISTORICAL_CORE_ELIGIBLE') || !readiness.includes('REQUIRES_FPL_NATIVE') || !readiness.includes('"season"')) throw new Error('Field-readiness tiers/core fields are incomplete.');
if (!readiness.includes('prompt-nationality-context-pack-v1.js') || !readiness.includes('historical-season-field-manifest.js') || !readiness.includes('historical-prompt-unlock-audit.js') || !readiness.includes('prompt-field-readiness-panel.js')) throw new Error('Readiness extras are not loaded by the readiness mapper.');
if (!panel.includes('Historical prompt readiness') || !panel.includes('Latest season field coverage') || !panel.includes('Run season prompt unlock audit')) throw new Error('Prompt readiness panel is incomplete.');
if (!manifest.includes('FPL_HISTORICAL_FIELD_MANIFEST') || !manifest.includes('canEvaluate')) throw new Error('Historical season field manifest is incomplete.');
if (!unlockAudit.includes('FPL_HISTORICAL_PROMPT_UNLOCK_AUDIT') || !unlockAudit.includes('minAnswers') || !unlockAudit.includes('unlockedCount')) throw new Error('Historical prompt unlock audit is incomplete.');
if (!loader.includes('prompt-historical-safe-pack-v1.js')) throw new Error('Historical-safe pack is not wired into Prompt Studio loader.');
if (!loader.includes('prompt-historical-era-pack-v1.js')) throw new Error('Historical era pack is not wired into Prompt Studio loader.');
if (!loader.includes('prompt-field-readiness.js')) throw new Error('Field-readiness mapper is not wired into Prompt Studio loader.');
console.log('Historical-safe prompt expansion static checks passed.');
