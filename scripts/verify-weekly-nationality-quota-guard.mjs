import fs from 'node:fs';
import vm from 'node:vm';

const admin = fs.readFileSync('admin.html', 'utf8');
const batchIndex = admin.indexOf('js/admin-batch-calendar.js?v=3.0.3');
const guardIndex = admin.indexOf('js/admin-weekly-nationality-quota-guard.js?v=1.0.0');
if (batchIndex < 0 || guardIndex <= batchIndex) {
  throw new Error('Weekly nationality quota guard is not loaded after the batch calendar.');
}

const source = fs.readFileSync('js/admin-weekly-nationality-quota-guard.js', 'utf8');
for (const token of [
  'REQUIRED_NATIONALITY_PER_DAY = 1',
  'promptMixTarget?.nationality',
  'promptMix?.nationality',
  'downloadButton.disabled = true',
  'event.stopImmediatePropagation()',
  'Each day must contain exactly one nationality prompt'
]) {
  if (!source.includes(token)) throw new Error(`Weekly nationality quota guard is missing: ${token}`);
}

function makeButton() {
  const listeners = new Map();
  return {
    disabled: false,
    dataset: {},
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatch(type) {
      const event = {
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; }
      };
      for (const handler of listeners.get(type) || []) {
        handler(event);
        if (event.stopped) break;
      }
      return event;
    }
  };
}

const generateButton = makeButton();
const downloadButton = makeButton();
const status = { dataset: {}, textContent: '' };
let rows = [];
const window = {
  FPL_STUDIO_BATCH_CALENDAR: {
    getResults: () => rows
  }
};
const sandbox = {
  window,
  document: {
    querySelector(selector) {
      if (selector === '#generateWeekBtn') return generateButton;
      if (selector === '#downloadWeekBtn') return downloadButton;
      if (selector === '#batchStatus') return status;
      return null;
    }
  },
  setTimeout,
  clearTimeout,
  console
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'js/admin-weekly-nationality-quota-guard.js' });

rows = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-09-${String(index + 3).padStart(2, '0')}`,
  status: 'PASS',
  promptMixTarget: { nationality: 0 },
  promptMix: { nationality: 0 }
}));
let event = downloadButton.dispatch('click');
if (!event.prevented || !event.stopped || downloadButton.disabled !== true || downloadButton.dataset.nationalityQuotaReady !== 'false') {
  throw new Error('Quota guard did not block a ZIP (5)-style seven-day batch with nationality target/count 0.');
}

rows = Array.from({ length: 7 }, (_, index) => ({
  date: `2026-09-${String(index + 3).padStart(2, '0')}`,
  status: 'PASS',
  promptMixTarget: { nationality: 1 },
  promptMix: { nationality: 1 }
}));
downloadButton.disabled = false;
event = downloadButton.dispatch('click');
if (event.prevented || event.stopped || window.FPL_WEEKLY_NATIONALITY_QUOTA_GUARD?.certify?.() !== true) {
  throw new Error('Quota guard blocked a valid seven-day batch with exactly one nationality prompt per day.');
}

console.log('Weekly nationality quota guard verified: ZIP (5)-style zero-nationality batches are blocked; 1-per-day batches are certified.');
