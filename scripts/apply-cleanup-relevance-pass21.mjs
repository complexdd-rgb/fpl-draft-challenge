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
    '/* Phase 4: Prompt Library Manager */',
    '/* Phase 5: name-rule starters */',
    path
  );
  for (const retired of ['manager-count-grid', 'manager-toolbar', 'manager-actions', 'library-prompt-chips']) {
    if (source.includes(retired)) throw new Error(`${path}: retired Prompt Manager selector remains: ${retired}`);
  }
  requireIncludes(source, '/* Phase 5: name-rule starters */', `${path} Phase 5 boundary`);
  writeChanged(path, source);
}

{
  const path = 'admin-stage-one.css';
  let source = fs.readFileSync(path, 'utf8');
  const retiredLine = 'body.stage-one-enabled .manager-count-grid article,\n';
  requireIncludes(source, retiredLine, `${path} retired shared selector`);
  source = source.replace(retiredLine, '');
  if (source.includes('manager-count-grid')) throw new Error(`${path}: retired Prompt Manager selector remains`);
  requireIncludes(source, 'body.stage-one-enabled .audit-summary-grid article,', `${path} active audit summary styling`);
  writeChanged(path, source);
}

{
  const path = 'admin.css';
  let source = fs.readFileSync(path, 'utf8');
  requireIncludes(source, 'admin-base.css?v=16.2.0', `${path} admin-base cache tag`);
  source = source.replace('admin-base.css?v=16.2.0', 'admin-base.css?v=16.2.1');
  writeChanged(path, source);
}

{
  const path = 'admin.html';
  let source = fs.readFileSync(path, 'utf8');
  requireIncludes(source, 'admin.css?v=16.2.0', `${path} admin.css cache tag`);
  requireIncludes(source, 'admin-stage-one.css?v=1.0.0', `${path} Stage One cache tag`);
  source = source
    .replace('admin.css?v=16.2.0', 'admin.css?v=16.2.1')
    .replace('admin-stage-one.css?v=1.0.0', 'admin-stage-one.css?v=1.0.1');
  writeChanged(path, source);
}

console.log('Pass 21 CSS cleanup applied: retired Prompt Library Manager base and Stage One selectors removed; current workspace styling and cache order preserved.');
