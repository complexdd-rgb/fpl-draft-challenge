import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${label}: expected block not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}

function requireAbsent(path, tokens) {
  const source = fs.readFileSync(path, 'utf8');
  for (const token of tokens) {
    if (source.includes(token)) throw new Error(`${path}: retired selector remains: ${token}`);
  }
}

function requirePresent(path, tokens) {
  const source = fs.readFileSync(path, 'utf8');
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path}: active selector/cache token missing: ${token}`);
  }
}

replaceExact(
  'admin-stage-one.css',
  `body.stage-one-enabled .button-row,\nbody.stage-one-enabled .repair-toolbar,\nbody.stage-one-enabled .audit-toolbar {`,
  `body.stage-one-enabled .button-row,\nbody.stage-one-enabled .audit-toolbar {`,
  'stage-one toolbar cleanup'
);

replaceExact(
  'admin-stage-one.css',
  `body.stage-one-enabled .summary-card,\nbody.stage-one-enabled .audit-summary-grid article,\nbody.stage-one-enabled .repair-summary-grid article,\nbody.stage-one-enabled .publish-summary-card {`,
  `body.stage-one-enabled .summary-card,\nbody.stage-one-enabled .audit-summary-grid article {`,
  'stage-one summary cleanup'
);

replaceExact(
  'admin-stage-one.css',
  `body.stage-one-enabled .prompt-factory,\nbody.stage-one-enabled .prompt-quality-analyser,\nbody.stage-one-enabled .repair-regression-panel,\nbody.stage-one-enabled .auto-repair-panel,\nbody.stage-one-enabled .import-subpanel,\nbody.stage-one-enabled .identity-regression-panel,\nbody.stage-one-enabled .legacy-regression-panel {`,
  `body.stage-one-enabled .prompt-factory,\nbody.stage-one-enabled .prompt-quality-analyser,\nbody.stage-one-enabled .import-subpanel,\nbody.stage-one-enabled .identity-regression-panel {`,
  'stage-one retired panel cleanup'
);

replaceExact(
  'admin-mobile-v2.css',
  `  body.stage-one-enabled .panel,\n  body.stage-one-enabled .prompt-factory,\n  body.stage-one-enabled .prompt-quality-analyser,\n  body.stage-one-enabled .repair-regression-panel,\n  body.stage-one-enabled .auto-repair-panel,\n  body.stage-one-enabled .import-subpanel,\n  body.stage-one-enabled .identity-regression-panel,\n  body.stage-one-enabled .legacy-regression-panel {`,
  `  body.stage-one-enabled .panel,\n  body.stage-one-enabled .prompt-factory,\n  body.stage-one-enabled .prompt-quality-analyser,\n  body.stage-one-enabled .import-subpanel,\n  body.stage-one-enabled .identity-regression-panel {`,
  'mobile retired panel cleanup'
);

replaceExact(
  'admin.css',
  '@import url("./admin-mobile-v2.css?v=2.2.0");',
  '@import url("./admin-mobile-v2.css?v=2.2.1");',
  'mobile CSS cache tag'
);

const retired = [
  'repair-toolbar',
  'repair-summary-grid',
  'publish-summary-card',
  'repair-regression-panel',
  'auto-repair-panel',
  'legacy-regression-panel'
];
requireAbsent('admin-stage-one.css', retired);
requireAbsent('admin-mobile-v2.css', ['repair-regression-panel', 'auto-repair-panel', 'legacy-regression-panel']);

requirePresent('admin-stage-one.css', ['audit-toolbar', 'audit-summary-grid article', 'prompt-factory', 'prompt-quality-analyser', 'import-subpanel', 'identity-regression-panel']);
requirePresent('admin-mobile-v2.css', ['prompt-factory', 'prompt-quality-analyser', 'import-subpanel', 'identity-regression-panel']);
requirePresent('admin.css', ['admin-mobile-v2.css?v=2.2.1', 'admin-base.css?v=16.2.4']);

console.log('Pass 25 applied: retired repair/publishing/legacy responsive selectors pruned; active audit/import/identity styling preserved.');
