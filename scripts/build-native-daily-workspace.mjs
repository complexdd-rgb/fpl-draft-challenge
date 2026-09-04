import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HTML_PATH = 'admin.html';
const STAGE_ONE_PATH = 'js/admin-stage-one.js';
const FRAGMENT_PATH = 'fragments/admin-daily-workspace.html';
const MARKER_START = '<!-- STUDIO_NATIVE_DAILY_WORKSPACE_START -->';
const MARKER_END = '<!-- STUDIO_NATIVE_DAILY_WORKSPACE_END -->';
const CHALLENGE_HEADING = '<h2>Challenge settings</h2>';
const PROMPT_PANEL_START = '<section class="panel" id="libraryManagerPanel">';
const CHALLENGE_WORKSPACE_START = '<section class="studio-workspace" data-workspace="challenge" id="workspace-challenge"';
const PROMPT_WORKSPACE_START = '<section class="studio-workspace" data-workspace="prompts" id="workspace-prompts"';

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

function extractMarkedDaily(html) {
  const start = html.indexOf(MARKER_START);
  if (start < 0) return '';
  const end = html.indexOf(MARKER_END, start);
  if (end < 0) throw new Error('Native Daily workspace start marker exists without its end marker.');
  return dedent(html.slice(start + MARKER_START.length, end));
}

function locateLegacyDaily(html) {
  const mainClose = html.indexOf('\n  </main>');
  const heading = html.indexOf(CHALLENGE_HEADING);
  if (mainClose < 0 || heading < 0 || heading > mainClose) return null;

  const start = html.lastIndexOf('    <section class="panel"', heading);
  const end = html.indexOf(`\n    ${PROMPT_PANEL_START}`, heading);
  if (start < 0 || end < 0 || end > mainClose) {
    throw new Error('Could not isolate the legacy Daily Challenge panel block safely.');
  }

  return { start, end, block: dedent(html.slice(start, end)) };
}

function validateDailyBlock(block) {
  const required = [
    CHALLENGE_HEADING,
    'id="batchPlanner"',
    'id="draftPanel"',
    'id="testPanel"',
    'id="codePanel"',
    'id="historyPanel"'
  ];
  required.forEach(token => {
    if (!block.includes(token)) throw new Error(`Daily workspace block is missing ${token}.`);
  });
  if (block.includes('id="libraryManagerPanel"')) {
    throw new Error('Prompt Library Manager was accidentally captured by the Daily workspace block.');
  }
}

function loadCanonicalDaily(html) {
  if (fs.existsSync(FRAGMENT_PATH)) {
    const fragment = dedent(read(FRAGMENT_PATH));
    validateDailyBlock(fragment);
    return fragment;
  }

  const marked = extractMarkedDaily(html);
  if (marked) {
    validateDailyBlock(marked);
    write(FRAGMENT_PATH, '', `${marked}\n`);
    return marked;
  }

  const legacy = locateLegacyDaily(html);
  if (!legacy) throw new Error('Could not find Daily Challenge markup to create the canonical fragment.');
  validateDailyBlock(legacy.block);
  write(FRAGMENT_PATH, '', `${legacy.block}\n`);
  return legacy.block;
}

function removeLegacyDaily(html) {
  const legacy = locateLegacyDaily(html);
  if (!legacy) return html;

  let start = legacy.start;
  if (start > 0 && html[start - 1] === '\n') start -= 1;
  let end = legacy.end;
  while (html[end] === '\n') end += 1;
  return html.slice(0, start) + '\n' + html.slice(end);
}

function installNativeDaily(html, fragment) {
  const workspaceStart = html.indexOf(CHALLENGE_WORKSPACE_START);
  const promptWorkspaceStart = html.indexOf(PROMPT_WORKSPACE_START, workspaceStart + 1);
  if (workspaceStart < 0 || promptWorkspaceStart < 0) {
    throw new Error('Native challenge/prompt workspace boundaries were not found.');
  }

  const headerEnd = html.indexOf('</header>', workspaceStart);
  const workspaceClose = html.lastIndexOf('          </section>', promptWorkspaceStart);
  if (headerEnd < 0 || workspaceClose < headerEnd) {
    throw new Error('Could not isolate the native Daily Challenge workspace safely.');
  }

  const insertion = `</header>\n            ${MARKER_START}\n${indent(fragment, 12)}\n            ${MARKER_END}\n`;
  return html.slice(0, headerEnd) + insertion + html.slice(workspaceClose);
}

function removeRedundantChallengeClassifier(source) {
  const redundant = '    if (/challenge settings|review the generated xi|test mode|download-ready challenge|challenge history|daily challenge/.test(title)) return "challenge";\n';
  if (!source.includes(redundant)) return source;
  return source.replace(redundant, '');
}

const sourceHtml = read(HTML_PATH);
const fragment = loadCanonicalDaily(sourceHtml);
let nextHtml = removeLegacyDaily(sourceHtml);
nextHtml = installNativeDaily(nextHtml, fragment);
write(HTML_PATH, sourceHtml, nextHtml);

const stageBefore = read(STAGE_ONE_PATH);
const stageAfter = removeRedundantChallengeClassifier(stageBefore);
write(STAGE_ONE_PATH, stageBefore, stageAfter);

execFileSync(process.execPath, ['--check', STAGE_ONE_PATH], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-native-daily-workspace.mjs'], { stdio: 'inherit' });
