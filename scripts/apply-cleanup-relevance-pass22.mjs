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
    '/* Phase 5: name-rule starters */',
    '/* Phase 7 — Player Database Auditor */',
    path
  );
  for (const retired of [
    'name-rule-presets',
    'name-preset-buttons',
    'publish-centre',
    'publish-checklist-head',
    'publish-pack-panel'
  ]) {
    if (source.includes(retired)) throw new Error(`${path}: retired selector remains: ${retired}`);
  }
  requireIncludes(source, '/* Phase 7 — Player Database Auditor */', `${path} active auditor boundary`);
  requireIncludes(source, '.database-auditor', `${path} active auditor styles`);
  writeChanged(path, source);
}

{
  const path = 'admin.css';
  let source = fs.readFileSync(path, 'utf8');
  requireIncludes(source, 'admin-base.css?v=16.2.1', `${path} admin-base cache tag`);
  source = source.replace('admin-base.css?v=16.2.1', 'admin-base.css?v=16.2.2');
  writeChanged(path, source);
}

console.log('Pass 22 CSS cleanup applied: retired name-rule starter and Publishing Centre base styles removed; Player Database Auditor styles preserved.');
