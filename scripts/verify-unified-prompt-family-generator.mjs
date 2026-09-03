import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};

const admin = read('admin.html');
requireText(admin, 'id="factoryIncludeQualityFamilies"', 'Quality Families main-generator control');
requireText(admin, 'id="factoryIncludeNationalityFamily"', 'Nationality Family main-generator control');

const base = read('js/admin-import-tools-base.js');
for (const token of [
  'includeQualityFamilies: document.querySelector("#factoryIncludeQualityFamilies")',
  'includeNationalityFamily: document.querySelector("#factoryIncludeNationalityFamily")',
  'appendIntegratedFamilyCandidates({',
  'window.FPL_QUALITY_FAMILY_GENERATOR',
  'window.FPL_NATIONALITY_FAMILY_GENERATOR',
  'Quality families</span>',
  'Nationality family</span>'
]) requireText(base, token, 'unified main-generator integration');

const quality = read('js/prompt-quality-family-generator.js');
requireText(quality, 'window.FPL_QUALITY_FAMILY_GENERATOR = Object.freeze({', 'Quality Families provider API');
requireText(quality, 'document.getElementById("factoryIncludeQualityFamilies")', 'Quality Families standalone suppression');

const nationality = read('js/prompt-nationality-family-generator.js');
requireText(nationality, 'window.FPL_NATIONALITY_FAMILY_GENERATOR = Object.freeze({', 'Nationality Family provider API');
requireText(nationality, 'document.getElementById("factoryIncludeNationalityFamily")', 'Nationality Family standalone suppression');

const loader = read('js/prompt-studio-loader.js');
requireText(loader, 'js/admin-import-tools-base.js?v=16.1.0-familymix', 'main generator cache bust');

const wording = read('js/career-overlap-wording.js');
requireText(wording, 'js/prompt-quality-family-generator.js?v=1.1.0', 'quality family cache bust');
requireText(wording, 'js/prompt-nationality-family-generator.js?v=1.1.1', 'nationality family cache bust');

console.log('Unified prompt-family generator verified: Quality Families and Nationality Family are selectable sources inside the main checked batch generator.');
