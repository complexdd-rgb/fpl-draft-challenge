import fs from 'node:fs';

function requireIncludes(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function writeChanged(path, source) {
  const before = fs.readFileSync(path, 'utf8');
  if (before === source) throw new Error(`${path}: cleanup produced no change`);
  fs.writeFileSync(path, source);
}

{
  const path = 'admin-base.css';
  let source = fs.readFileSync(path, 'utf8');
  const start = source.indexOf('/* Phase 8 — Database Repair Centre */');
  const end = source.indexOf('/* Phase 10 — historical database import centre */', start);
  if (start < 0 || end < 0 || end <= start) throw new Error(`${path}: Phase 8–10 boundaries not found`);

  const preserved = `/* Shared Historical Import / Identity regression presentation */\n.repair-regression-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}\n.repair-regression-head h3{margin:2px 0 5px;font-size:1.15rem}\n.repair-regression-head p{margin:0;color:var(--muted,#adc4b7);line-height:1.5}\n.repair-regression-list{display:grid;gap:8px;margin-top:14px}\n.repair-regression-row{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;padding:11px 12px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(0,0,0,.12)}\n.repair-regression-row .regression-icon{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;font-weight:1000}\n.repair-regression-row.pass .regression-icon{background:rgba(0,255,135,.14);color:#71ffb2}\n.repair-regression-row.warn .regression-icon{background:rgba(255,209,102,.14);color:#ffd166}\n.repair-regression-row.fail .regression-icon{background:rgba(255,85,119,.15);color:#ff8da4}\n.repair-regression-row strong{display:block;font-size:.86rem}\n.repair-regression-row span{display:block;margin-top:3px;color:var(--muted,#adc4b7);font-size:.78rem;line-height:1.4}\n\n/* Historical Import sandbox safety banner */\n.safe-mode-banner{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:4px 0 16px;padding:13px 15px;border:1px solid rgba(4,217,255,.3);border-radius:14px;background:rgba(4,217,255,.07)}\n.safe-mode-banner strong{color:var(--accent-2)}\n.safe-mode-banner span{color:var(--muted)}\n@media(max-width:760px){.repair-regression-head{flex-direction:column;align-items:flex-start}}\n@media(max-width:560px){.safe-mode-banner{align-items:flex-start;flex-direction:column}}\n\n`;

  source = source.slice(0, start) + preserved + source.slice(end);

  for (const retired of [
    'database-repair-centre','repair-safety-banner','repair-summary-grid','repair-toolbar','repair-filter-bar',
    'repair-item-card','repair-download-panel','repairReadyChip','auto-repair-section','auto-repair-summary',
    'auto-repair-two-column','auto-repair-panel','auto-repair-change-row'
  ]) {
    if (source.includes(retired)) throw new Error(`${path}: retired repair selector remains: ${retired}`);
  }
  requireIncludes(source, '.repair-regression-row', `${path} shared regression styles`);
  requireIncludes(source, '.safe-mode-banner', `${path} active import sandbox banner`);
  requireIncludes(source, '/* Phase 10 — historical database import centre */', `${path} active import boundary`);
  writeChanged(path, source);
}

{
  const path = 'admin.css';
  let source = fs.readFileSync(path, 'utf8');
  requireIncludes(source, 'admin-base.css?v=16.2.3', `${path} admin-base cache tag`);
  source = source.replace('admin-base.css?v=16.2.3', 'admin-base.css?v=16.2.4');
  writeChanged(path, source);
}

console.log('Pass 24 CSS cleanup applied: retired database-repair styling removed while shared import regression and sandbox styles remain.');
