import assert from 'node:assert/strict';
import { curatedFixture } from './lib/curated-fixture.mjs';
const cases=[
  ['foreign cached ID',p=>{p.shards[0].records[0].id='outside-frozen-selectors';}],
  ['IDs moved across families',p=>{
    const a=p.shards[0],b=p.shards[1],id=a.records[0].id;
    a.records[0].id=b.records[0].id;b.records[0].id=id;
  }],
  ['stale cached variant-group metadata',p=>{
    for(const s of p.shards)for(const r of s.records)r.variantGroup='one-group';
  }]
];
let failures=0;
for(const [name,mutate]of cases){try{
  const f=await curatedFixture();f.mutate(mutate);
  const rebuilt=await f.api.buildGenerationPackage();
  assert.equal(f.calls(),2,'Invalid cached package did not rebuild');
  assert.equal(rebuilt.manifest.total,4959);assert.equal(rebuilt.shards.length,18);
  assert.equal(rebuilt.freeze.selectionCompositeSha256,f.original.freeze.selectionCompositeSha256);
  console.log('PASS '+name);
}catch(e){failures++;console.error('FAIL '+name+': '+e.message);}}
assert.equal(failures,0,`${failures}/3 cache membership checks failed`);
