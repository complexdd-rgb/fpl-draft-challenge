import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${label}: expected text not found in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}

replaceExact(
  'js/leaderboard-admin-status.js',
  '/* Studio status authority v1.0.0 — retired repair counters must not override a completed live audit. */',
  '/* Studio status authority v1.0.1 — keep dashboard status aligned with the completed live audit. */',
  'status authority comment'
);

replaceExact(
  'js/leaderboard-admin-status.js',
  '["auditStatusTop", "auditCriticalCount", "auditInfoCount", "auditPlayerCount", "repairBlockedCount"]',
  '["auditStatusTop", "auditCriticalCount", "auditInfoCount", "auditPlayerCount"]',
  'retired repair observer target'
);

replaceExact(
  'admin.html',
  '<script src="js/leaderboard-admin-status.js?v=5.0.5"></script>',
  '<script src="js/leaderboard-admin-status.js?v=5.0.6"></script>',
  'leaderboard status cache tag'
);

const source = fs.readFileSync('js/leaderboard-admin-status.js', 'utf8');
if (source.includes('repairBlockedCount')) throw new Error('retired repairBlockedCount observer residue remains');
for (const active of ['auditStatusTop', 'auditCriticalCount', 'auditInfoCount', 'auditPlayerCount', 'syncFromAudit']) {
  if (!source.includes(active)) throw new Error(`active audit status authority token missing: ${active}`);
}

const html = fs.readFileSync('admin.html', 'utf8');
if (!html.includes('js/leaderboard-admin-status.js?v=5.0.6')) throw new Error('leaderboard status cache tag not updated');

console.log('Pass 27 applied: retired repair counter observer removed; live audit status authority preserved.');
