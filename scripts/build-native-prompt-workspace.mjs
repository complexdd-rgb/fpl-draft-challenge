import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HTML_PATH = 'admin.html';
const STAGE_ONE_PATH = 'js/admin-stage-one.js';
const FRAGMENT_PATH = 'fragments/admin-prompt-workspace.html';
const MARKER_START = '<!-- STUDIO_NATIVE_PROMPT_WORKSPACE_START -->';
const MARKER_END = '<!-- STUDIO_NATIVE_PROMPT_WORKSPACE_END -->';
const PROMPT_PANEL_START = '<section class="panel" id="libraryManagerPanel">';
const DATABASE_PANEL_START = '<section class="panel database-auditor" id="databaseAuditorPanel">';
const PROMPT_WORKSPACE_START = '<section class="studio-workspace" data-workspace="prompts" id="workspace-prompts"';
const VALIDATION_WORKSPACE_START = '<section class="studio-workspace" data-workspace="validation" id="workspace-validation"';

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, before, after) => {
  if (before === after) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, after);
  console.log(`Updated ${file}`);
  return true;
};

function dedent(block) {
  const lines = String(block || '').replace(/^\n+|\n+$/g, '').split('\n');
  const indents = lines.filter(line => line.trim()).map(line => line.match(/^\s*/)?.[0].length || 0);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map(line => line.slice(Math.min(min, line.length))).join('\n');
}

function indent(block, spaces) {
  const prefix = ' '.repeat(spaces);
  return dedent(block).split('\n').map(line => line ? prefix + line : '').join('\n');
}

function extractMarkedPrompt(html) {
  const start = html.indexOf(MARKER_START);
  if (start < 0) return '';
  const end = html.indexOf(MARKER_END, start);
  if (end < 0) throw new Error('Native Prompt Studio start marker exists without its end marker.');
  return dedent(html.slice(start + MARKER_START.length, end));
}

function locateLegacyPrompt(html) {
  const mainClose = html.indexOf('\n  </main>');
  const start = html.indexOf(PROMPT_PANEL_START);
  if (mainClose < 0 || start < 0 || start > mainClose) return null;
  const end = html.indexOf(`\n    ${DATABASE_PANEL_START}`, start);
  if (end < 0 || end > mainClose) {
    throw new Error('Could not isolate the legacy Prompt Studio panel safely.');
  }
  return { start, end, block: dedent(html.slice(start, end)) };
}

function validatePromptBlock(block) {
  const required = [
    'id="libraryManagerPanel"',
    'id="automaticPromptFactory"',
    'id="promptQualityAnalyser"',
    'id="promptEditor"',
    'id="promptManagerList"'
  ];
  required.forEach(token => {
    if (!block.includes(token)) throw new Error(`Prompt Studio block is missing ${token}.`);
  });
  if (block.includes('id="databaseAuditorPanel"')) throw new Error('Database Auditor was accidentally captured by the Prompt Studio block.');
}

function loadCanonicalPrompt(html) {
  if (fs.existsSync(FRAGMENT_PATH)) {
    const fragment = dedent(read(FRAGMENT_PATH));
    validatePromptBlock(fragment);
    return fragment;
  }

  const marked = extractMarkedPrompt(html);
  if (marked) {
    validatePromptBlock(marked);
    write(FRAGMENT_PATH, '', `${marked}\n`);
    return marked;
  }

  const legacy = locateLegacyPrompt(html);
  if (!legacy) throw new Error('Could not find Prompt Studio markup to create the canonical fragment.');
  validatePromptBlock(legacy.block);
  write(FRAGMENT_PATH, '', `${legacy.block}\n`);
  return legacy.block;
}

function removeLegacyPrompt(html) {
  const legacy = locateLegacyPrompt(html);
  if (!legacy) return html;
  let start = legacy.start;
  if (start > 0 && html[start - 1] === '\n') start -= 1;
  let end = legacy.end;
  while (html[end] === '\n') end += 1;
  return html.slice(0, start) + '\n' + html.slice(end);
}

function installNativePrompt(html, fragment) {
  const workspaceStart = html.indexOf(PROMPT_WORKSPACE_START);
  const validationStart = html.indexOf(VALIDATION_WORKSPACE_START, workspaceStart + 1);
  if (workspaceStart < 0 || validationStart < 0) throw new Error('Native Prompt/Validation workspace boundaries were not found.');

  const headerEnd = html.indexOf('</header>', workspaceStart);
  const workspaceClose = html.lastIndexOf('          </section>', validationStart);
  if (headerEnd < 0 || workspaceClose < headerEnd) throw new Error('Could not isolate the native Prompt Studio workspace safely.');

  const insertion = `</header>\n            ${MARKER_START}\n${indent(fragment, 12)}\n            ${MARKER_END}\n`;
  let next = html.slice(0, headerEnd) + insertion + html.slice(workspaceClose);
  next = next.replace(
    '<h1 id="workspace-prompts-title">Prompt Studio</h1><p>Manage, create and quality-check the prompt library.</p>',
    '<h1 id="workspace-prompts-title">Prompt Studio</h1><p>One library for live prompts, creation, quality control and promotion review.</p>'
  );
  return next;
}

function removeRedundantPromptClassifier(source) {
  const redundant = '    if (/prompt library|prompt quality|prompt studio/.test(title)) return "prompts";\n';
  return source.includes(redundant) ? source.replace(redundant, '') : source;
}

const sourceHtml = read(HTML_PATH);
const fragment = loadCanonicalPrompt(sourceHtml);
let nextHtml = removeLegacyPrompt(sourceHtml);
nextHtml = installNativePrompt(nextHtml, fragment);
write(HTML_PATH, sourceHtml, nextHtml);

const stageBefore = read(STAGE_ONE_PATH);
const stageAfter = removeRedundantPromptClassifier(stageBefore);
write(STAGE_ONE_PATH, stageBefore, stageAfter);

execFileSync(process.execPath, ['--check', STAGE_ONE_PATH], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-native-prompt-workspace.mjs'], { stdio: 'inherit' });
