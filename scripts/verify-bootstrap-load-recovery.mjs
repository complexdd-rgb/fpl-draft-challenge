import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function fixture(publishing=false){
  const nodes=[], insertions=[], events=[], listeners=new Map(), dataset={};
  const document={baseURI:'https://fixture.invalid/',scripts:nodes,documentElement:{dataset},
    querySelector(selector){if(selector==='main.studio-shell')return {};const marker=/script\[([^\]]+)\]/.exec(selector);return marker?nodes.find(n=>marker[1] in n.attrs)||null:null;},
    getElementById(id){return publishing && ["downloadWeekBtn","batchPlanner"].includes(id) ? {} : null;},createElement(){const callbacks=new Map();const node={src:'',dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,f){const a=callbacks.get(k)||[];a.push(f);callbacks.set(k,a);},fire(k){for(const f of callbacks.get(k)||[])f();},remove(){nodes.splice(nodes.indexOf(node),1);}};return node;},
    head:{appendChild(node){nodes.push(node);insertions.push(node);}}};
  const window={FPL_IS_STUDIO:true,FPL_LEADERBOARD_CONFIG:{dailyPublishing:{enabled:publishing}},
    addEventListener:(n,f)=>listeners.set(n,f),dispatchEvent:e=>events.push(e.type)};
  const c=vm.createContext({window,document,URL,console:{error(){}},queueMicrotask,
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}}});
  vm.runInContext(fs.readFileSync('js/asset-manifest.js','utf8'),c);
  vm.runInContext(fs.readFileSync('js/studio-bootstrap.js','utf8'),c);
  return {window,nodes,insertions,events,dataset};
}
let failures=0;
for(const [name,run]of [
  ['readiness follows the last required dependency',async()=>{
    const f=fixture();assert.equal(f.dataset.studioBootstrap,'loading');
    assert(!f.events.includes('fpl:studio-bootstrap-ready'));
    for(let i=0;i<f.nodes.length;i++){assert(i<30);f.nodes[i].fire('load');await new Promise(r=>setImmediate(r));}
    assert.equal(f.dataset.studioBootstrap,'ready');
    assert.equal(f.events.filter(e=>e==='fpl:studio-bootstrap-ready').length,1);
  }],
  ['publishing dependencies also gate readiness',async()=>{
    const f=fixture(true);
    for(let i=0;i<f.nodes.length;i++){if(f.nodes[i].src.includes('admin-daily-publish.js'))continue;f.nodes[i].fire('load');await new Promise(r=>setImmediate(r));}
    assert.equal(f.dataset.studioBootstrap,'loading');
    f.nodes.find(n=>n.src.includes('admin-daily-publish.js')).fire('load');
    assert.equal(f.dataset.studioBootstrap,'loading');
    f.nodes.find(n=>n.src.includes('admin-schedule-manager-v2.js')).fire('load');
    assert.equal(f.dataset.studioBootstrap,'ready');
  }],
  ['a failed clean controller is retried before loading its dependants',async()=>{
    const f=fixture();f.nodes[0].fire('error');assert.equal(f.dataset.studioBootstrap,'error');
    f.window.FPL_STUDIO_BOOTSTRAP.start();
    assert.equal(f.insertions.filter(n=>n.src.includes('prompt-studio-clean-reset.js')).length,2);
    assert(!f.nodes.some(n=>n.src.includes('prompt-factory-mount-v1.js')));
    for(let i=0;i<f.nodes.length;i++){assert(i<30);f.nodes[i].fire('load');await new Promise(r=>setImmediate(r));}
    assert.equal(f.dataset.studioBootstrap,'ready');
  }]
]){try{await run();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.message);}}
assert.equal(failures,0,`${failures}/3 bootstrap checks failed`);
