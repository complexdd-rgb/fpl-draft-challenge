import fs from 'node:fs';

const src = JSON.parse(fs.readFileSync('data/recovery/1996-97/statbunker-six-club-season-appearances.json','utf8'));
const lines = ['club,player,total,start,sub,came_on,off,goals,source_url'];
const esc = v => `"${String(v ?? '').replaceAll('"','""')}"`;
for (const c of src.clubs) {
  for (const r of c.rows) {
    lines.push([c.club,r.player,r.total,r.start,r.sub,r.cameOn,r.off,r.goals,c.sourceUrl].map(esc).join(','));
  }
}
fs.writeFileSync('data/recovery/1996-97/statbunker-six-club-compact.csv', lines.join('\n')+'\n');
console.log(`Wrote ${lines.length-1} compact StatBunker rows.`);
