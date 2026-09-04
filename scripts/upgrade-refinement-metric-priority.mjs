import fs from 'node:fs';

const PRIORITY_BLOCK = `const SOURCE_FIELD_PRIORITY = Object.freeze({
  points: 0, goals: 0, assists: 0, goalInvolvements: 0, cleanSheets: 0, bonus: 0, saves: 0,
  goalsConceded: 0, startingPrice: 0, finalPrice: 0, yellowCards: 0, redCards: 0,
  maxPointsGain: 1, maxGoalsGain: 1, maxClubSwitchPointsGain: 1, maxClubSwitchGoalsGain: 1,
  maxConsecutive2000Minutes: 1, maxConsecutive100Points: 1, maxConsecutiveScoringSeasons: 1,
  maxConsecutive8Goals: 1, tableBandCount: 1, maxClubsWithSameManager: 1, maxMinutesGain: 1,
  careerSeasonCount: 2, careerClubCount: 2, ageAtSeasonStart: 2, fullNameLength: 2,
  firstNameLength: 2, surnameLength: 2, nameWordCount: 2, leaguePosition: 3, minutes: 5
});`;

function semanticFunction(indent = '') {
  return `${indent}function sourceMetricPriority(field, operator, value) {
${indent}  let priority = Number(SOURCE_FIELD_PRIORITY[field] ?? 2);
${indent}  if (field === "minutes" && [">", ">="].includes(operator) && Number(value) <= 0) priority += 100;
${indent}  return priority;
${indent}}

${indent}function sourceMetricMatch(source) {
${indent}  const matches = [];
${indent}  for (const field of SOURCE_FIELDS) {
${indent}    const escaped = field.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
${indent}    const pattern = new RegExp(\`((?:Number\\\\()?p\\\\.(?:_careerEvolution\\\\?\\\\.)?\${escaped}(?:\\\\))?\\\\s*)(>=|<=|>|<)\\\\s*(-?\\\\d+(?:\\\\.\\\\d+)?)\`);
${indent}    const match = pattern.exec(source);
${indent}    if (!match) continue;
${indent}    matches.push({
${indent}      field, pattern, match, sourceIndex: Number(match.index) || 0,
${indent}      priority: sourceMetricPriority(field, match[2], Number(match[3]))
${indent}    });
${indent}  }
${indent}  matches.sort((a, b) => a.priority - b.priority || a.sourceIndex - b.sourceIndex || a.field.localeCompare(b.field));
${indent}  return matches[0] || null;
${indent}}`;
}

function upgradeRuntime() {
  const path = 'js/prompt-refinement-incubator.js';
  const before = fs.readFileSync(path, 'utf8');
  let after = before;

  if (after.includes('/* FPL Challenge Studio — Prompt Refinement Incubator v1.0.0')) {
    after = after.replace('/* FPL Challenge Studio — Prompt Refinement Incubator v1.0.0', '/* FPL Challenge Studio — Prompt Refinement Incubator v1.1.0');
  }
  if (after.includes('const VERSION = "1.0.0";')) after = after.replace('const VERSION = "1.0.0";', 'const VERSION = "1.1.0";');

  const sourceFieldsLine = '  const SOURCE_FIELDS = Object.freeze(Object.keys(FIELD_STEPS).sort((a, b) => b.length - a.length));';
  if (!after.includes('const SOURCE_FIELD_PRIORITY = Object.freeze({')) {
    if (!after.includes(sourceFieldsLine)) throw new Error('Runtime SOURCE_FIELDS insertion marker not found.');
    const runtimePriority = `  ${PRIORITY_BLOCK.replace(/\n/g, '\n  ')}`;
    after = after.replace(sourceFieldsLine, `${sourceFieldsLine}\n  // Prefer story-defining thresholds over generic eligibility guards such as minutes > 0.\n${runtimePriority}`);
  }

  if (!after.includes('function sourceMetricPriority(field, operator, value)')) {
    const start = after.indexOf('  function sourceMetricMatch(source) {');
    const endMarker = '\n\n  function sourceVariants(parent, reserved) {';
    const end = after.indexOf(endMarker, start);
    if (start < 0 || end < 0) throw new Error('Runtime sourceMetricMatch replacement markers not found.');
    const runtimeFunction = semanticFunction('  ').replace(
      '    if (field === "minutes" && [">", ">="].includes(operator) && Number(value) <= 0) priority += 100;',
      '    // Positive-minute checks are eligibility sentinels; mutate them only as a last resort.\n    if (field === "minutes" && [">", ">="].includes(operator) && Number(value) <= 0) priority += 100;'
    );
    after = after.slice(0, start) + runtimeFunction + after.slice(end);
  }

  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('Updated js/prompt-refinement-incubator.js to semantic source-threshold priority.');
  } else {
    console.log('Runtime refinement metric priority is already current.');
  }
}

function upgradeAudit() {
  const path = 'scripts/audit-refinement-incubator.mjs';
  const before = fs.readFileSync(path, 'utf8');
  let after = before;

  const sourceFieldsLine = 'const SOURCE_FIELDS = Object.freeze(Object.keys(FIELD_STEPS).sort((a, b) => b.length - a.length));';
  if (!after.includes('const SOURCE_FIELD_PRIORITY = Object.freeze({')) {
    if (!after.includes(sourceFieldsLine)) throw new Error('Audit SOURCE_FIELDS insertion marker not found.');
    after = after.replace(sourceFieldsLine, `${sourceFieldsLine}\n${PRIORITY_BLOCK}`);
  }

  if (!after.includes('function sourceMetricPriority(field, operator, value)')) {
    const start = after.indexOf('function sourceMetricMatch(sourceText) {');
    const endMarker = '\nfunction answerBand(position, count) {';
    const end = after.indexOf(endMarker, start);
    if (start < 0 || end < 0) throw new Error('Audit sourceMetricMatch replacement markers not found.');
    const functionText = semanticFunction('').replaceAll('source)', 'sourceText)').replaceAll('pattern.exec(source);', 'pattern.exec(sourceText);');
    after = after.slice(0, start) + functionText + after.slice(end);
  }

  if (after !== before) {
    fs.writeFileSync(path, after);
    console.log('Updated deterministic audit to the same semantic threshold priority.');
  } else {
    console.log('Audit refinement metric priority is already current.');
  }
}

upgradeRuntime();
upgradeAudit();
