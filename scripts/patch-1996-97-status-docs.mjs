import fs from 'node:fs';

function patch(path, transform){
  const before=fs.readFileSync(path,'utf8');
  const after=transform(before);
  if(after===before) throw new Error(`No changes applied to ${path}`);
  fs.writeFileSync(path,after);
}

patch('PROJECT_ROADMAP.md', s => s
  .replace(/1\. \*\*finish 1996\/97 from the reconciled 658-player canonical lineage\*\*:[^\n]*/, '1. **finish 1996/97 from the physically verified 658-player master**: StatBunker SeasonAppearances is now 20/20 club complete and reconciles to 8,360 starts; close the remaining 30-goal residual and nationality review before freezing the season;')
  .replace(/- `672` is the reconciled raw FootballSquads named-row count, \*\*not\*\* the unique-player target;/, '- the uploaded v2 REVIEW master proves **671 FootballSquads source rows → 658 canonical identities**, with 13 duplicate source occurrences (11 multi-club + 2 re-registration);')
  .replace(/- `658` is the working canonical unique-player authority until the physical master is recovered\/rebuilt;/, '- the 658-row canonical master is now physically verified and has been advanced to a v3 StatBunker-complete REVIEW workbook;')
  .replace(/- the later `672 \/ 9,108 starts \/ 1,133 goals \/ 67 send-offs` COMPLETE checkpoint is quarantined and must never be used as a production source;/, '- the later `672 / 9,108 starts / 1,133 goals / 67 send-offs` COMPLETE checkpoint remains quarantined and must never be used as a production source;')
  .replace(/- hard controls are 418 starts per club \/ \*\*8,360 starts\*\* league-wide and \*\*970 league goals\*\*;/, '- StatBunker direct club coverage is now **20/20**, with 418 starts per club / **8,360 starts** league-wide; player-goal support totals 940 versus 970 official league goals, leaving a 30-goal review residual;')
);

patch('reports/historical-season-status-audit-2026-09-08.md', s => {
  const lines=s.split('\n');
  const replacement='| **1996/97** | **STATBUNKER COMPLETE / MASTER REVIEW** | Uploaded v2 master physically proves **658 canonical identities from 671 FootballSquads source rows**, with 13 duplicate occurrences = 11 multi-club identities + 2 re-registrations. Six missing StatBunker club tables have now been recovered, taking coverage to **20/20 clubs** and exactly **8,360 starts**. The old `672 / 9,108 starts / 1,133 goals / 67 send-offs` COMPLETE checkpoint remains quarantined. StatBunker player-goal support totals 940 vs 970 official league goals; nationality remains 0/658. See `reports/1996-97-reconciliation-2026-09-08.md`. | Close the 30-goal residual and nationality lane, then freeze the single-sheet v3 master. | Workbook-proven population + 20/20 start audit |';
  const i=lines.findIndex(line=>line.startsWith('| **1996/97** |'));
  if(i<0) throw new Error('1996/97 ledger row not found');
  lines[i]=replacement;
  let out=lines.join('\n');
  out=out.replace('### 4. 1996/97 population conflict is reconciled; final master is still open', '### 4. 1996/97 StatBunker lane is complete; master review remains open');
  out=out.replace(/The later 672-player COMPLETE claim[^\n]*/, 'The physical uploaded master supersedes the earlier inferred raw-row arithmetic: the authoritative backbone is 671 source rows → 658 canonical identities with 13 duplicate occurrences. The six missing StatBunker tables are now recovered and all 20 clubs reconcile to 418 starts / 8,360 league-wide. Remaining review is the 30-goal player-support residual and nationality, not population or StatBunker club coverage.');
  out=out.replace(/1\. \*\*Finish the reconciled 1996\/97 master\*\*[^\n]*/, '1. **Close 1996/97 review residue** — the 658-row master is physically verified and StatBunker is 20/20 complete; resolve the 30-goal residual and nationality before freezing it.');
  return out;
});

console.log('Patched roadmap and historical season audit to 1996/97 workbook authority.');
