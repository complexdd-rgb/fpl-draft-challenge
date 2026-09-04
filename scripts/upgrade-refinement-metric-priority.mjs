import fs from 'node:fs';

const path = 'js/prompt-refinement-incubator.js';
const before = fs.readFileSync(path, 'utf8');
let after = before;

const oldHeader = '/* FPL Challenge Studio — Prompt Refinement Incubator v1.0.0';
const newHeader = '/* FPL Challenge Studio — Prompt Refinement Incubator v1.1.0';
if (after.includes(oldHeader)) after = after.replace(oldHeader, newHeader);

if (after.includes('const VERSION = "1.0.0";')) after = after.replace('const VERSION = "1.0.0";', 'const VERSION = "1.1.0";');

const sourceFieldsLine = '  const SOURCE_FIELDS = Object.freeze(Object.keys(FIELD_STEPS).sort((a, b) => b.length - a.length));';
const priorityBlock = `  const SOURCE_FIELDS = Object.freeze(Object.keys(FIELD_STEPS).sort((a, b) => b.length - a.length));\n  // Prefer thresholds that define the prompt's actual football/performance story. Generic\n  // eligibility guards such as minutes > 0 should only be mutated when no meaningful\n  // performance, price, career or disciplinary threshold exists in the source rule.\n  const SOURCE_FIELD_PRIORITY = Object.freeze({\n    points: 0, goals: 0, assists: 0, goalInvolvements: 0, cleanSheets: 0, bonus: 0, saves: 0,\n    goalsConceded: 0, startingPrice: 0, finalPrice: 0, yellowCards: 0, redCards: 0,\n    maxPointsGain: 1, maxGoalsGain: 1, maxClubSwitchPointsGain: 1, maxClubSwitchGoalsGain: 1,\n    maxConsecutive2000Minutes: 1, maxConsecutive100Points: 1, maxConsecutiveScoringSeasons: 1,\n    maxConsecutive8Goals: 1, tableBandCount: 1, maxClubsWithSameManager: 1, maxMinutesGain: 1,\n    careerSeasonCount: 2, careerClubCount: 2, ageAtSeasonStart: 2, fullNameLength: 2,\n    firstNameLength: 2, surnameLength: 2, nameWordCount: 2, leaguePosition: 3, minutes: 5\n  });`;
if (!after.includes('const SOURCE_FIELD_PRIORITY = Object.freeze({')) {
  if (!after.includes(sourceFieldsLine)) throw new Error('SOURCE_FIELDS insertion marker not found.');
  after = after.replace(sourceFieldsLine, priorityBlock);
}

const oldFunction = `  function sourceMetricMatch(source) {\n    for (const field of SOURCE_FIELDS) {\n      const escaped = field.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");\n      const pattern = new RegExp(\`((?:Number\\\\()?p\\\\.(?:_careerEvolution\\\\?\\\\.)?\${escaped}(?:\\\\))?\\\\s*)(>=|<=|>|<)\\\\s*(-?\\\\d+(?:\\\\.\\\\d+)?)\`);\n      const match = pattern.exec(source);\n      if (match) return { field, pattern, match };\n    }\n    return null;\n  }`;
const newFunction = `  function sourceMetricPriority(field, operator, value) {\n    let priority = Number(SOURCE_FIELD_PRIORITY[field] ?? 2);\n    // Positive-minute checks are normally eligibility sentinels, not the concept the\n    // prompt is trying to tune. Keep them available only as a last-resort mutation.\n    if (field === "minutes" && [">", ">="].includes(operator) && Number(value) <= 0) priority += 100;\n    return priority;\n  }\n\n  function sourceMetricMatch(source) {\n    const matches = [];\n    for (const field of SOURCE_FIELDS) {\n      const escaped = field.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");\n      const pattern = new RegExp(\`((?:Number\\\\()?p\\\\.(?:_careerEvolution\\\\?\\\\.)?\${escaped}(?:\\\\))?\\\\s*)(>=|<=|>|<)\\\\s*(-?\\\\d+(?:\\\\.\\\\d+)?)\`);\n      const match = pattern.exec(source);\n      if (!match) continue;\n      matches.push({\n        field, pattern, match, sourceIndex: Number(match.index) || 0,\n        priority: sourceMetricPriority(field, match[2], Number(match[3]))\n      });\n    }\n    matches.sort((a, b) => a.priority - b.priority || a.sourceIndex - b.sourceIndex || a.field.localeCompare(b.field));\n    return matches[0] || null;\n  }`;
if (!after.includes('function sourceMetricPriority(field, operator, value)')) {
  if (!after.includes(oldFunction)) throw new Error('sourceMetricMatch replacement marker not found.');
  after = after.replace(oldFunction, newFunction);
}

if (after === before) {
  console.log('Refinement metric priority is already current.');
} else {
  fs.writeFileSync(path, after);
  console.log('Updated js/prompt-refinement-incubator.js to semantic source-threshold priority.');
}
