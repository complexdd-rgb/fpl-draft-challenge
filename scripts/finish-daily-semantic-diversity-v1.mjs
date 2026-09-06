import fs from 'node:fs';

const path = '.github/workflows/studio-wiring.yml';
let source = fs.readFileSync(path, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const pathNeedle = "      - 'scripts/verify-daily-library-cutover-v1.mjs'\n      - 'scripts/materialise-prompt-library-shards.mjs'";
const pathReplacement = "      - 'scripts/verify-daily-library-cutover-v1.mjs'\n      - 'scripts/verify-daily-semantic-diversity-v1.mjs'\n      - 'scripts/verify-weekly-certified-snapshot-race.mjs'\n      - 'scripts/materialise-prompt-library-shards.mjs'";
const count = source.split(pathNeedle).length - 1;
assert(count === 2, `Expected two Studio verifier path anchors after the runtime patch, found ${count}.`);
source = source.split(pathNeedle).join(pathReplacement);

function replaceOnce(before, after) {
  const found = source.split(before).length - 1;
  assert(found === 1, `Expected one workflow anchor, found ${found}: ${before.slice(0, 100)}`);
  source = source.replace(before, after);
}

replaceOnce(
  '      - name: Verify unaffected native workspaces\n        run: |',
  '      - name: Verify Daily semantic diversity guard\n        run: node scripts/verify-daily-semantic-diversity-v1.mjs\n\n      - name: Verify immutable weekly reservoir and semantic spread\n        run: node scripts/verify-weekly-certified-snapshot-race.mjs\n\n      - name: Verify unaffected native workspaces\n        run: |'
);
replaceOnce(
  '          node --check js/admin-daily-library-cutover-v1.js\n          node --check js/admin-schedule-manager-v2.js',
  '          node --check js/admin-daily-library-cutover-v1.js\n          node --check js/daily-semantic-diversity-v1.js\n          node --check js/admin-daily-generator-guard.js\n          node --check js/admin-batch-calendar.js\n          node --check js/admin-schedule-manager-v2.js'
);
replaceOnce(
  '          node --check scripts/verify-daily-library-cutover-v1.mjs\n          node --check scripts/materialise-prompt-library-shards.mjs',
  '          node --check scripts/verify-daily-library-cutover-v1.mjs\n          node --check scripts/verify-daily-semantic-diversity-v1.mjs\n          node --check scripts/verify-weekly-certified-snapshot-race.mjs\n          node --check scripts/materialise-prompt-library-shards.mjs'
);

fs.writeFileSync(path, source);

const config = fs.readFileSync('config/asset-manifest.json', 'utf8');
const guard = fs.readFileSync('js/admin-daily-generator-guard.js', 'utf8');
const batch = fs.readFileSync('js/admin-batch-calendar.js', 'utf8');
const cleanVerifier = fs.readFileSync('scripts/verify-prompt-studio-clean-reset.mjs', 'utf8');
const weeklyVerifier = fs.readFileSync('scripts/verify-weekly-certified-snapshot-race.mjs', 'utf8');
for (const [name, value, markers] of [
  ['manifest', config, ['2.9.0-daily-semantic-diversity', 'dailySemanticDiversityV1', '3.1.0-semantic-diversity', '2.1.0-semantic-diversity']],
  ['guard', guard, ['generation guard v2.1.0', 'ensureSemanticDiversity()', 'semantic.canAddWeekly', 'semanticWeeklyCap: DAYS_IN_BATCH', 'semantic?.dayIssues']],
  ['batch', batch, ['SEMANTIC_DIVERSITY_POLICY_VERSION = 1', 'semantic.remainingPressure', 'semantic.dayClash(choice, existing)', 'semantic.missingRequiredKeys', 'same-day semantic-diversity guard']],
  ['clean verifier', cleanVerifier, ['2.9.0-daily-semantic-diversity', 'daily-semantic-diversity-v1.js', '3.1.0-semantic-diversity']],
  ['weekly verifier', weeklyVerifier, ['saved-library generation guard v2.1.0', 'semantic.canAddWeekly', 'semantic.dayClash(choice, existing)']]
]) {
  for (const marker of markers) assert(value.includes(marker), `${name} is missing expected marker: ${marker}`);
}

console.log('Finished Daily semantic diversity Studio workflow wiring and confirmed all runtime patch markers.');
