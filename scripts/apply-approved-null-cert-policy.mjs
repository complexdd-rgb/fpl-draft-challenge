import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// Keep the generated weekly calendar engine aligned with the Studio wiring. These patches are
// idempotent and are verified before admin.html is written or published.
execFileSync(process.execPath, ['scripts/apply-weekly-nationality-hard-reservation.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/apply-weekly-certified-snapshot-race.mjs'], { stdio: 'inherit' });

const path = 'admin.html';
let source = fs.readFileSync(path, 'utf8');
let updated = source;

const policyTag = '  <script src="js/certification-approved-null-policy.js?v=1.0.0"></script>';
if (!updated.includes('js/certification-approved-null-policy.js')) {
  const enginePattern = /(\s*<script src="js\/validation-engine\.js\?v=[^"]+"><\/script>)/;
  const matches = updated.match(enginePattern);
  if (!matches) throw new Error('validation-engine.js script tag was not found in admin.html.');
  updated = updated.replace(enginePattern, `${matches[1]}\n${policyTag}`);
}

const weeklyButton = '<button id="generateWeekBtn" class="button primary" type="button" disabled aria-busy="true">Generate next 7 days</button>';
updated = updated.replace(
  /<button id="generateWeekBtn" class="button primary" type="button"(?: disabled aria-busy="true")?>Generate next 7 days<\/button>/,
  weeklyButton
);

const enrichmentTag = '  <script data-nationality-enrichment data-loaded="true" src="nationality-enrichment.js?v=1.1.1"></script>';
const contextTag = '  <script data-nationality-context-prompt-pack-v1 data-loaded="true" src="js/prompt-nationality-context-pack-v1.js?v=1.0.2"></script>';
const gateTag = '  <script src="js/admin-weekly-nationality-readiness-gate.js?v=1.0.2"></script>';
const batchTag = '  <script src="js/admin-batch-calendar.js?v=3.0.5"></script>';
const quotaGuardTag = '  <script src="js/admin-weekly-nationality-quota-guard.js?v=1.0.0"></script>';
const dailyGuardTag = '  <script data-admin-daily-generator-guard="1" src="js/admin-daily-generator-guard.js?v=1.1.2"></script>';

if (!updated.includes('js/admin-weekly-nationality-readiness-gate.js')) {
  const batchPattern = /\s*<script src="js\/admin-batch-calendar\.js\?v=[^"]+"><\/script>/;
  if (!batchPattern.test(updated)) throw new Error('admin-batch-calendar.js script tag was not found in admin.html.');
  updated = updated.replace(batchPattern, `\n${enrichmentTag}\n${contextTag}\n${gateTag}\n${batchTag}\n${quotaGuardTag}\n${dailyGuardTag}`);
} else {
  updated = updated
    .replace(/\s*<script[^>]*data-nationality-enrichment[^>]*><\/script>/, `\n${enrichmentTag}`)
    .replace(/\s*<script[^>]*data-nationality-context-prompt-pack-v1[^>]*><\/script>/, `\n${contextTag}`)
    .replace(/\s*<script src="js\/admin-weekly-nationality-readiness-gate\.js\?v=[^"]+"><\/script>/, `\n${gateTag}`)
    .replace(/\s*<script src="js\/admin-batch-calendar\.js\?v=[^"]+"><\/script>/, `\n${batchTag}`);
  if (updated.includes('js/admin-weekly-nationality-quota-guard.js')) {
    updated = updated.replace(/\s*<script src="js\/admin-weekly-nationality-quota-guard\.js\?v=[^"]+"><\/script>/, `\n${quotaGuardTag}`);
  } else {
    updated = updated.replace(batchTag, `${batchTag}\n${quotaGuardTag}`);
  }
  if (updated.includes('data-admin-daily-generator-guard')) {
    updated = updated.replace(/\s*<script[^>]*data-admin-daily-generator-guard[^>]*><\/script>/, `\n${dailyGuardTag}`);
  } else {
    updated = updated.replace(quotaGuardTag, `${quotaGuardTag}\n${dailyGuardTag}`);
  }
}

const requiredOnce = [
  'js/certification-approved-null-policy.js',
  'nationality-enrichment.js?v=1.1.1',
  'js/prompt-nationality-context-pack-v1.js?v=1.0.2',
  'js/admin-weekly-nationality-readiness-gate.js?v=1.0.2',
  'js/admin-batch-calendar.js?v=3.0.5',
  'js/admin-weekly-nationality-quota-guard.js?v=1.0.0',
  'js/admin-daily-generator-guard.js?v=1.1.2'
];
for (const token of requiredOnce) {
  const count = updated.split(token).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one Studio reference for ${token}; found ${count}.`);
}

const order = [
  updated.indexOf('nationality-enrichment.js?v=1.1.1'),
  updated.indexOf('js/prompt-nationality-context-pack-v1.js?v=1.0.2'),
  updated.indexOf('js/admin-weekly-nationality-readiness-gate.js?v=1.0.2'),
  updated.indexOf('js/admin-batch-calendar.js?v=3.0.5'),
  updated.indexOf('js/admin-weekly-nationality-quota-guard.js?v=1.0.0'),
  updated.indexOf('js/admin-daily-generator-guard.js?v=1.1.2')
];
if (order.some(index => index < 0) || order.some((index, i) => i > 0 && index <= order[i - 1])) {
  throw new Error('Weekly nationality/certified-snapshot assets are not in a safe load order.');
}
if (!updated.includes(weeklyButton)) {
  throw new Error('Seven-day Generate button is not fail-closed in admin.html.');
}

if (updated !== source) {
  fs.writeFileSync(path, updated);
  console.log('Wired approved-null policy, weekly nationality guards and certified generation snapshot into admin.html.');
} else {
  console.log('Studio admin wiring is already current.');
}

execFileSync(process.execPath, ['scripts/verify-weekly-nationality-readiness.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-weekly-nationality-generation-gate.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-weekly-nationality-quota-guard.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-weekly-nationality-hard-reservation.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-weekly-certified-snapshot-race.mjs'], { stdio: 'inherit' });
