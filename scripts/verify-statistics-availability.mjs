import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const window = { addEventListener(){} };
vm.runInNewContext(fs.readFileSync('players.js','utf8'), {window, console});
let reconciled = 0;
for(const player of window.FPL_PLAYERS) for(const record of player.seasons || []) {
  for(const field of record.source?.unavailableFields || []) assert.ok(record[field] === null || record[field] === undefined, `${player.playerId}/${record.season}/${field} contradicts availability`);
  const audit = record.source?.availabilityReconciliation;
  if(audit) {
    reconciled += audit.populatedFields.length;
    assert.equal(audit.attributionStatus, 'pending-review');
    assert.ok(audit.populatedFields.every(field => audit.previousUnavailableFields.includes(field) && record[field] !== null && record[field] !== undefined));
  }
}
assert.equal(reconciled,857, 'Keep the known corrections explicit and traceable');
console.log('PASS 857 populated fields reconciled without inventing attribution');
