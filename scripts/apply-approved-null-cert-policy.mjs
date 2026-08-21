import fs from 'node:fs';

const path = 'admin.html';
const source = fs.readFileSync(path, 'utf8');
const policyTag = '  <script src="js/certification-approved-null-policy.js?v=1.0.0"></script>';

if (source.includes('js/certification-approved-null-policy.js')) {
  console.log('Approved-null certification policy is already wired into admin.html.');
  process.exit(0);
}

const enginePattern = /(\s*<script src="js\/validation-engine\.js\?v=[^"]+"><\/script>)/;
const matches = source.match(enginePattern);
if (!matches) throw new Error('validation-engine.js script tag was not found in admin.html.');

const updated = source.replace(enginePattern, `${matches[1]}\n${policyTag}`);
if ((updated.match(/certification-approved-null-policy\.js/g) || []).length !== 1) {
  throw new Error('Expected exactly one approved-null certification policy script tag.');
}

fs.writeFileSync(path, updated);
console.log('Wired approved-null starting-price certification policy into admin.html.');
