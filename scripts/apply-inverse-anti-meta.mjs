import fs from 'node:fs';

const path = 'js/prompt-quality-family-generator.js';
let source = fs.readFileSync(path, 'utf8');
const marker = 'const ANTI_META_INVERSE_POLICY_VERSION = 1;';
if (source.includes(marker)) {
  console.log('Inverse anti-meta prompt policy already applied.');
  process.exit(0);
}

const functionAnchor = '  function existingQualityPools(position) {';
if (!source.includes(functionAnchor)) throw new Error('existingQualityPools anchor not found');

const addition = `  const ANTI_META_INVERSE_POLICY_VERSION = 1;\n\n  function addInverseAntiMeta(position, out) {\n    const noun = NAMES[position], lower = LOWER[position];\n    const pointCaps = position === \"GK\" ? [55, 65, 75, 85, 100]\n      : position === \"FWD\" ? [60, 70, 80, 90, 100, 110]\n      : [65, 75, 85, 100, 110, 120];\n    const minuteFloors = position === \"GK\" ? [900, 1500, 2200]\n      : [1000, 1600, 2200, 2600];\n\n    for (const cap of pointCaps) for (const minutes of minuteFloors) {\n      out.push(candidate(position, \"inverse-points\", \`under_\${cap}_m\${minutes}\`,\n        \`\${noun} who scored under \${cap} FPL points despite playing \${minutes.toLocaleString(\"en-GB\")}+ minutes\`,\n        \`That \${lower} must play at least \${minutes.toLocaleString(\"en-GB\")} minutes but score fewer than \${cap} FPL points.\`,\n        \`p => (Number(p.minutes) >= \${minutes} && Number(p.points) < \${cap})\`,\n        [\"inverse-stat\",\"under-points\",\"minutes\",\"less-obvious\"], 18));\n    }\n\n    const lowOutput = position === \"GK\"\n      ? { field: \"cleanSheets\", word: \"clean sheets\", caps: [4,5,6,7,8], minutes: [1500,2200] }\n      : position === \"DEF\"\n        ? { field: \"goals\", word: \"goals\", caps: [0,1], minutes: [1600,2200,2600] }\n        : position === \"MID\"\n          ? { field: \"goals\", word: \"goals\", caps: [1,2,3,4], minutes: [1600,2200] }\n          : { field: \"goals\", word: \"goals\", caps: [3,4,5,6,7], minutes: [1200,1800,2200] };\n\n    for (const cap of lowOutput.caps) for (const minutes of lowOutput.minutes) {\n      out.push(candidate(position, \"low-output-workhorse\", \`low_\${lowOutput.field}_\${cap}_m\${minutes}\`,\n        \`\${noun} with at most \${cap} \${lowOutput.word} despite playing \${minutes.toLocaleString(\"en-GB\")}+ minutes\`,\n        \`That \${lower} must play at least \${minutes.toLocaleString(\"en-GB\")} minutes and record no more than \${cap} \${lowOutput.word}.\`,\n        \`p => (Number(p.minutes) >= \${minutes} && Number(p.\${lowOutput.field}) <= \${cap})\`,\n        [\"inverse-stat\",\"low-output\",\"minutes\",lowOutput.field,\"less-obvious\"], 16));\n    }\n  }\n\n`;
source = source.replace(functionAnchor, addition + functionAnchor);

const callAnchor = '      addV3(position, positionCandidates);';
if (!source.includes(callAnchor)) throw new Error('addV3 call anchor not found');
source = source.replace(callAnchor, `${callAnchor}\n      addInverseAntiMeta(position, positionCandidates);`);

source = source.replace('Generate more V1 / V2 / V3-style prompts', 'Generate V1 / V2 / V3 + inverse anti-meta prompts');
source = source.replace('Checking V1, V2 and V3 quality-family variations against the full database…', 'Checking V1, V2, V3 and inverse anti-meta variations against the full database…');

fs.writeFileSync(path, source);
console.log('Applied inverse anti-meta prompt policy v1.');
