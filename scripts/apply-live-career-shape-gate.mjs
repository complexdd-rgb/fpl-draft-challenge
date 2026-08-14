import fs from 'node:fs';

const path = 'js/career-context.js';
const source = fs.readFileSync(path, 'utf8');
const before = `  /* Career Shape rules are shared by Studio and the live game and still load before\n     prompt consumers. The Studio-only editor/generator layer is now loaded lazily when\n     Prompt Studio is opened by admin-import-tools.js. */\n  if (document.readyState === "loading") {\n    document.write('<script src="js/career-shape-rules.js?v=1.1.2-repair"><\\/script>');\n  }\n})();\n`;
const after = `  /* Career Shape derivation is mandatory in Studio/certification, but the live game only\n     needs it when today's prompt set actually references _careerShape or the strict PL\n     A→B→A return family whose wording/semantics are normalised by the same rule pack. */\n  const isStudio = /\\/admin(?:\\.html)?$/i.test(window.location.pathname)\n    || Boolean(document.querySelector("main.studio-shell"));\n  const livePrompts = Array.isArray(window.FPL_DAILY_CHALLENGE?.prompts)\n    ? window.FPL_DAILY_CHALLENGE.prompts\n    : [];\n  const liveNeedsCareerShape = livePrompts.some(prompt => {\n    const id = String(prompt?.id || "");\n    const family = String(prompt?.family || "");\n    const tags = Array.isArray(prompt?.tags) ? prompt.tags.join(" ") : "";\n    const label = String(prompt?.label || "");\n    const testSource = typeof prompt?.test === "function" ? String(prompt.test) : "";\n    return testSource.includes("_careerShape")\n      || /career[-_]?shape/i.test(family)\n      || /^career_shape_/i.test(id)\n      || /returned_to_former_club/i.test(id)\n      || /returned-club|pl-a-b-a-return/i.test(tags)\n      || /returned to a former Premier League club/i.test(label);\n  });\n\n  if (document.readyState === "loading" && (isStudio || liveNeedsCareerShape)) {\n    document.write('<script src="js/career-shape-rules.js?v=1.1.2-repair"><\\/script>');\n  }\n})();\n`;

const first = source.indexOf(before);
if (first < 0) throw new Error('Expected Career Shape loader block was not found.');
if (source.indexOf(before, first + before.length) >= 0) throw new Error('Career Shape loader block matched more than once.');
const output = source.slice(0, first) + after + source.slice(first + before.length);
fs.writeFileSync(path, output);
console.log('Career Shape live startup gate applied.');
