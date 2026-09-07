import fs from 'node:fs';

const path = 'admin.html';
const source = fs.readFileSync(path, 'utf8');
const before = '<link rel="stylesheet" href="admin.css?v=16.2.2-big-sweep">';
const after = '<link rel="stylesheet" href="admin.css?v=16.2.1-pass30">';
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`Expected one Pass 30 admin.css cache tag, found ${count}.`);
const next = source.replace(before, after);
fs.writeFileSync(path, next);
if (!next.includes('admin.css?v=16.2.1-pass30')) throw new Error('Replacement cache tag missing.');
console.log('Adjusted Pass 30 admin.css cache tag to retain cache busting and compatibility with the current stylesheet-order regression guard.');
