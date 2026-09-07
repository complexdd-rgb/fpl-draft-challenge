import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${label}: expected block not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceExact(
  'js/admin-core.js',
  `    if (elements.importBaseDatabase.value === "auto-repaired") {\n      const repaired = window.FPL_AUTOMATIC_DATABASE_REPAIR?.getWorkspace?.();\n      if (!Array.isArray(repaired) || !repaired.length) throw new Error("Run Phase 9 automatic repair first, or choose the current loaded players.js as the base.");\n      return cloneData(repaired);\n    }\n`,
  '',
  'retired automatic-repair import branch'
);

replaceExact(
  'admin.html',
  '<script src="js/admin-core.js?v=19.0.0"></script>',
  '<script src="js/admin-core.js?v=19.0.1"></script>',
  'admin-core cache tag'
);

const core = fs.readFileSync('js/admin-core.js', 'utf8');
for (const retired of ['auto-repaired', 'FPL_AUTOMATIC_DATABASE_REPAIR', 'Run Phase 9 automatic repair first']) {
  if (core.includes(retired)) throw new Error(`js/admin-core.js: retired repair branch residue remains: ${retired}`);
}
for (const active of ['function getSelectedBaseDatabase()', 'importBaseDatabase', 'return cloneData']) {
  if (!core.includes(active)) throw new Error(`js/admin-core.js: active Historical Import code missing: ${active}`);
}

const html = fs.readFileSync('admin.html', 'utf8');
if (!html.includes('<option value="current">Current loaded players.js</option>')) throw new Error('admin.html: active current database option missing');
if (!html.includes('js/admin-core.js?v=19.0.1')) throw new Error('admin.html: admin-core cache tag not updated');

console.log('Pass 26 applied: unreachable automatic-repair import branch removed; current players.js import path preserved.');
