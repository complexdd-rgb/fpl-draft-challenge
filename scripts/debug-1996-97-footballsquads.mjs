import fs from 'node:fs';
const url='https://www.footballsquads.co.uk/eng/1996-1997/faprem/arsenal.htm';
const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0','accept':'text/html'}});
if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
const html=await r.text();
fs.mkdirSync('data/recovery/1996-97',{recursive:true});
fs.writeFileSync('data/recovery/1996-97/arsenal-footballsquads-debug.html',html);
console.log('bytes',html.length);
console.log(html.slice(0,12000));
