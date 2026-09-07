import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const posix = value => value.split(path.sep).join('/');
const ignoredDirs = new Set(['.git', 'node_modules', 'coverage']);
const textExts = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.yml', '.yaml', '.txt']);

function walk(dir = root) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(posix(path.relative(root, full)));
  }
  return out;
}

const files = walk();
const fileSet = new Set(files);
const textFiles = files.filter(file => textExts.has(path.extname(file).toLowerCase()));
const text = new Map(textFiles.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const errors = [];
const warnings = [];

function normaliseLocalRef(raw, owner) {
  if (!raw) return null;
  let ref = String(raw).trim();
  if (!ref || /^(?:https?:|data:|mailto:|tel:|javascript:|blob:|#|\/\/)/i.test(ref)) return null;
  if (ref.includes('${') || ref.includes('{{') || ref.startsWith('{')) return null;
  ref = ref.split('#')[0].split('?')[0].trim();
  if (!ref || ref === '.' || ref === './') return null;
  try { ref = decodeURIComponent(ref); } catch {}
  if (ref.startsWith('/')) return null;
  const resolved = posix(path.normalize(path.join(path.dirname(owner), ref)));
  if (resolved.startsWith('../')) return null;
  return resolved;
}

function requireLocalRef(owner, raw, kind) {
  const resolved = normaliseLocalRef(raw, owner);
  if (!resolved) return;
  if (!fileSet.has(resolved) && !fileSet.has(`${resolved}/index.html`)) {
    errors.push(`${owner}: missing ${kind} reference ${raw} -> ${resolved}`);
  }
}

for (const file of files.filter(file => file.endsWith('.html'))) {
  const source = text.get(file) || '';
  for (const match of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    requireLocalRef(file, match[1], 'HTML');
  }
}

for (const file of files.filter(file => file.endsWith('.css'))) {
  const source = text.get(file) || '';
  for (const match of source.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?/gi)) {
    requireLocalRef(file, match[1], 'CSS import');
  }
  for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    requireLocalRef(file, match[1], 'CSS url');
  }
}

const manifestPath = 'config/asset-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!manifest.manifestVersion || !manifest.assets || typeof manifest.assets !== 'object') {
  errors.push('config/asset-manifest.json: invalid central manifest shape');
} else {
  const seenPaths = new Map();
  for (const [key, asset] of Object.entries(manifest.assets)) {
    if (!asset?.path || !asset?.version) errors.push(`${manifestPath}: ${key} must have path and version`);
    if (asset?.path && !fileSet.has(asset.path)) errors.push(`${manifestPath}: ${key} points to missing ${asset.path}`);
    if (asset?.path) {
      if (seenPaths.has(asset.path)) warnings.push(`Manifest path ${asset.path} is shared by ${seenPaths.get(asset.path)} and ${key}`);
      else seenPaths.set(asset.path, key);
    }
  }
}

for (const file of files.filter(file => file.startsWith('.github/workflows/') && /\.ya?ml$/.test(file))) {
  const source = text.get(file) || '';
  for (const match of source.matchAll(/\bnode(?:\s+--check)?\s+([A-Za-z0-9_./-]+\.(?:m?js))\b/g)) {
    const target = match[1];
    if (!fileSet.has(target)) errors.push(`${file}: invokes missing ${target}`);
  }
}

const productionFiles = [
  'admin.html', 'admin.css', 'index.html', 'sw.js',
  ...files.filter(file => file.startsWith('js/') && file.endsWith('.js')),
  'config/asset-manifest.json'
].filter(file => text.has(file));
const retiredPatterns = [
  'admin-retired-workspaces.css',
  'dailyHistoryCompatibility',
  'recordHistoryBtn',
  'historyPanel',
  'studio-retired-tool',
  'js/prompt-studio-loader.js',
  'js/admin-studio-finish.js',
  'js/career-overlap-wording.js',
  'js/studio-feature-loader.js',
  'js/prompt-studio-v4-simple.js',
  'js/prompt-studio-v3-clean-room.js'
];
for (const file of productionFiles) {
  const source = text.get(file) || '';
  for (const pattern of retiredPatterns) {
    if (source.includes(pattern)) errors.push(`${file}: retired production residue remains: ${pattern}`);
  }
}

function refsOutsideSelf(candidate) {
  const base = path.posix.basename(candidate);
  return textFiles.filter(file => file !== candidate && ((text.get(file) || '').includes(candidate) || (text.get(file) || '').includes(base)));
}

const cssCandidates = files
  .filter(file => !file.includes('/') && file.endsWith('.css'))
  .filter(file => refsOutsideSelf(file).length === 0);
const jsCandidates = files
  .filter(file => file.startsWith('js/') && file.endsWith('.js'))
  .filter(file => refsOutsideSelf(file).length === 0);
const fragmentCandidates = files
  .filter(file => file.startsWith('fragments/') && file.endsWith('.html'))
  .filter(file => refsOutsideSelf(file).length === 0);

for (const file of cssCandidates) warnings.push(`Unowned CSS candidate: ${file}`);
for (const file of jsCandidates) warnings.push(`Unowned JS candidate: ${file}`);
for (const file of fragmentCandidates) warnings.push(`Unowned fragment candidate: ${file}`);

const removedWorkflowRefs = [
  'scripts/build-native-studio-shell.mjs',
  'scripts/verify-native-studio-shell.mjs',
  'scripts/apply-career-evolution-prompt-families.mjs',
  'scripts/diagnose-approved-library-certification.mjs',
  'scripts/diagnose-certified-nationality-pool.mjs',
  'scripts/diagnose-weekly-day-one.mjs',
  'scripts/upgrade-refinement-metric-priority.mjs'
];
for (const file of files.filter(file => file.startsWith('.github/workflows/') && /\.ya?ml$/.test(file))) {
  const source = text.get(file) || '';
  for (const removed of removedWorkflowRefs) {
    if (source.includes(removed)) warnings.push(`${file}: stale reference to removed helper ${removed}`);
  }
}

console.log(`Final architecture audit scanned ${files.length} files (${textFiles.length} text files).`);
console.log(`Manifest assets: ${Object.keys(manifest.assets || {}).length}.`);
console.log(`Potential ownership candidates: CSS ${cssCandidates.length}, JS ${jsCandidates.length}, fragments ${fragmentCandidates.length}.`);
if (warnings.length) {
  console.log('\nAUDIT WARNINGS (review manually; not automatic deletion evidence):');
  for (const warning of warnings) console.log(`- ${warning}`);
}
if (errors.length) {
  console.error('\nAUDIT ERRORS:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('\nFinal architecture integrity audit passed.');
