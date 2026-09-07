import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${label}: expected text not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceExact(
  'admin.html',
  '<h1>Build, test, analyse, publish, repair and expand the historical database safely</h1>',
  '<h1>Build, test, analyse, publish, audit and expand the historical database safely</h1>',
  'retired repair hero wording'
);

replaceExact(
  'admin.html',
  '<p class="hero-copy">Generate and review the XI, create relational anti-meta prompts, analyse prompt quality, manage the library, publish checked files, repair the database and import verified historical seasons without touching the live game.</p>',
  '<p class="hero-copy">Generate and review the XI, create relational anti-meta prompts, analyse prompt quality, review the library, publish checked daily challenges, audit the player database and import verified historical seasons without touching the live game.</p>',
  'hero capability wording'
);

replaceExact(
  'admin.html',
  '<span>Test Mode and Challenge History use this browser only. Publishing remains a manual GitHub upload.</span>',
  '<span>Test Mode and Challenge History use this browser only. Daily publishing happens only when you explicitly use the publish controls.</span>',
  'publishing safety wording'
);

replaceExact(
  'js/admin-stage-one.js',
  'nextCopy.textContent = "Start with a fresh read-only scan so the studio can guide the repair work safely.";',
  'nextCopy.textContent = "Start with a fresh read-only scan so the studio can guide database research safely.";',
  'database audit next-action wording'
);

replaceExact(
  'js/admin-stage-one.js',
  '<button class="dashboard-action-card" type="button" data-open-workspace="prompts" data-target-title="Prompt Library Manager">',
  '<button class="dashboard-action-card" type="button" data-open-workspace="prompts">',
  'retired Prompt Library Manager scroll target'
);

replaceExact(
  'admin.html',
  '<script src="js/admin-stage-one.js?v=1.5.0-native-prompts"></script>',
  '<script src="js/admin-stage-one.js?v=1.5.1-copy-cleanup"></script>',
  'Admin Stage One cache tag'
);

const manifestPath = 'config/asset-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest?.assets?.adminStageOne?.version !== '1.5.0-native-prompts') {
  throw new Error('central manifest: unexpected Admin Stage One version');
}
manifest.assets.adminStageOne.version = '1.5.1-copy-cleanup';
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

replaceExact(
  'js/asset-manifest.js',
  '"adminStageOne": {\n      "path": "js/admin-stage-one.js",\n      "version": "1.5.0-native-prompts"\n    }',
  '"adminStageOne": {\n      "path": "js/admin-stage-one.js",\n      "version": "1.5.1-copy-cleanup"\n    }',
  'generated Admin Stage One manifest version'
);

const html = fs.readFileSync('admin.html', 'utf8');
for (const stale of [
  'publish, repair and expand',
  'repair the database and import verified historical seasons',
  'Publishing remains a manual GitHub upload.'
]) {
  if (html.includes(stale)) throw new Error(`admin.html: stale retired wording remains: ${stale}`);
}

const stage = fs.readFileSync('js/admin-stage-one.js', 'utf8');
if (stage.includes('guide the repair work safely')) throw new Error('admin-stage-one.js: retired repair wording remains');
if (stage.includes('data-target-title="Prompt Library Manager"')) throw new Error('admin-stage-one.js: retired Prompt Library Manager target remains');
for (const active of ['Player Database Auditor', 'Historical Database Import Centre', 'data-open-workspace="prompts"']) {
  if (!stage.includes(active)) throw new Error(`admin-stage-one.js: active workspace token missing: ${active}`);
}

if (!html.includes('Daily publishing happens only when you explicitly use the publish controls.')) throw new Error('admin.html: explicit publishing safety wording missing');
if (!html.includes('js/admin-stage-one.js?v=1.5.1-copy-cleanup')) throw new Error('admin.html: Admin Stage One cache tag missing');
if (manifest.assets.adminStageOne.version !== '1.5.1-copy-cleanup') throw new Error('central manifest: Admin Stage One version not updated');

console.log('Pass 28 applied: retired repair/manual-publishing wording and stale Prompt Library Manager target removed.');
