import fs from 'node:fs';

function requireIncludes(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function removeBetween(source, start, end, label) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(`${label}: expected cleanup boundaries were not found`);
  }
  return source.slice(0, startIndex) + source.slice(endIndex);
}

function writeChanged(path, source) {
  const before = fs.readFileSync(path, 'utf8');
  if (before === source) throw new Error(`${path}: cleanup produced no change`);
  fs.writeFileSync(path, source);
}

{
  const path = 'admin-base.css';
  let source = fs.readFileSync(path, 'utf8');
  source = removeBetween(
    source,
    '/* Phase 12 — official 2015/16 archive import */',
    '/* Phase 13 — automatic prompt factory */',
    path
  );
  for (const retired of [
    'legacy-import-centre',
    'legacy-source-grid',
    'legacy-source-note',
    'legacy-review-panel',
    'legacy-regression-panel',
    'legacy-source-link'
  ]) {
    if (source.includes(retired)) throw new Error(`${path}: retired legacy importer selector remains: ${retired}`);
  }
  requireIncludes(source, '/* Phase 13 — automatic prompt factory */', `${path} active Prompt Factory boundary`);
  requireIncludes(source, '.prompt-factory{', `${path} active Prompt Factory styles`);
  writeChanged(path, source);
}

{
  const path = 'admin.css';
  let source = fs.readFileSync(path, 'utf8');
  requireIncludes(source, 'admin-base.css?v=16.2.2', `${path} admin-base cache tag`);
  source = source.replace('admin-base.css?v=16.2.2', 'admin-base.css?v=16.2.3');
  writeChanged(path, source);
}

console.log('Pass 23 CSS cleanup applied: retired official 2015/16 archive importer styles removed; active Prompt Factory styles preserved.');
