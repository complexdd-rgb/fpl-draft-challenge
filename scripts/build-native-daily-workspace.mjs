import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const HTML_PATH = 'admin.html';
const FRAGMENT_PATH = 'fragments/admin-daily-workspace.html';
const MARKER_START = '<!-- STUDIO_NATIVE_DAILY_WORKSPACE_START -->';
const MARKER_END = '<!-- STUDIO_NATIVE_DAILY_WORKSPACE_END -->';
const CHALLENGE_WORKSPACE_START = '<section class="studio-workspace" data-workspace="challenge" id="workspace-challenge"';
const PROMPT_WORKSPACE_START = '<section class="studio-workspace" data-workspace="prompts" id="workspace-prompts"';

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, before, after) => {
  if (before === after) return false;
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

function validateDailyBlock(block) {
  const required = [
    '<h2>Challenge settings</h2>',
    'id="batchPlanner"',
    'id="draftPanel"',
    'id="testPanel"',
    'id="codePanel"'
  ];
  required.forEach(token => {
    if (!block.includes(token)) throw new Error(`Daily workspace block is missing ${token}.`);
  });
  for (const retired of ['id="historyPanel"', 'id="dailyHistoryCompatibility"', 'id="libraryManagerPanel"']) {
    if (block.includes(retired)) throw new Error(`Retired control returned to the Daily workspace fragment: ${retired}`);
  }
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

const sourceHtml = read(HTML_PATH);
const fragment = dedent(read(FRAGMENT_PATH));
validateDailyBlock(fragment);
write(HTML_PATH, sourceHtml, installNativeDaily(sourceHtml, fragment));

execFileSync(process.execPath, ['scripts/verify-native-daily-workspace.mjs'], { stdio: 'inherit' });
