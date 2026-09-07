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
  const path = 'admin-prompts-mobile-v1.css';
  let source = fs.readFileSync(path, 'utf8');
  source = removeBetween(
    source,
    '  /* Library totals: 2 x 2 rather than four full-width cards. */',
    '  /* Career Shape summary sits between library controls and creator. */',
    path
  );
  source = source.replace(
    '/* FPL Challenge Studio — Prompt Studio mobile pass v1.0.0 */',
    '/* FPL Challenge Studio — Prompt Studio mobile pass v1.0.1 */'
  );
  if (source.includes('promptManagerSearch') || source.includes('manager-count-grid') || source.includes('resetPromptManagerBtn')) {
    throw new Error(`${path}: retired Prompt Manager selectors remain`);
  }
  requireIncludes(source, '.career-shape-rule-panel', `${path} active Career Shape summary`);
  requireIncludes(source, '.prompt-factory-settings', `${path} active Prompt Factory mobile rules`);
  writeChanged(path, source);
}

{
  const path = 'admin-prompts-mobile-v1-1.css';
  let source = fs.readFileSync(path, 'utf8');
  source = removeBetween(
    source,
    '  body.stage-one-enabled [data-workspace="prompts"] .career-shape-factory {',
    '  body.stage-one-enabled [data-workspace="prompts"] .prompt-factory-actions {',
    path
  );
  source = source.replace(
    '/* FPL Challenge Studio — Prompt Studio mobile refinement v1.1.0 */',
    '/* FPL Challenge Studio — Prompt Studio mobile refinement v1.1.1 */'
  );
  if (source.includes('career-shape-factory') || source.includes('careerShapeFactoryStatus')) {
    throw new Error(`${path}: retired Career Shape creator selectors remain`);
  }
  requireIncludes(source, '.prompt-factory-options', `${path} active Prompt Factory refinement`);
  requireIncludes(source, '.prompt-quality-head .phase-chip', `${path} active Quality Analyser refinement`);
  writeChanged(path, source);
}

{
  const path = 'admin.css';
  let source = fs.readFileSync(path, 'utf8');
  requireIncludes(source, 'admin-prompts-mobile-v1.css?v=1.0.0', `${path} Prompt mobile base import`);
  requireIncludes(source, 'admin-prompts-mobile-v1-1.css?v=1.1.0', `${path} Prompt mobile refinement import`);
  source = source
    .replace('admin-prompts-mobile-v1.css?v=1.0.0', 'admin-prompts-mobile-v1.css?v=1.0.1')
    .replace('admin-prompts-mobile-v1-1.css?v=1.1.0', 'admin-prompts-mobile-v1-1.css?v=1.1.1');
  writeChanged(path, source);
}

console.log('Pass 20 CSS cleanup applied: retired Prompt Manager and Career Shape creator mobile selectors removed; active Prompt Studio mobile rules preserved.');
