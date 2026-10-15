import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { fixture } from './lib/backend-fixture.mjs';

for (const kind of ['valid', 'wrong-id', 'wrong-position', 'missing-prompt', 'duplicate-prompt', 'extra-statement', 'computed-metadata', 'malformed-test', 'comment-score']) {
  const f = fixture();
  const v = structuredClone(f.verifier);
  v.calculatedPerfectScore = v.perfectScore;
  v.perfectXi = v.prompts.map(p => ({ promptId: p.promptId, ...p.allowed[0] }));
  const prompts = v.prompts.map(p => ({ id: p.promptId, position: p.position, label: 'Fixture', fail: 'No' }));
  if (kind === 'wrong-id') prompts[0].id = 'different-prompt';
  if (kind === 'wrong-position') prompts[0].position = 'GK';
  if (kind === 'missing-prompt') prompts.pop();
  if (kind === 'duplicate-prompt') prompts[1].id = prompts[0].id;
  const sourcePrompts = prompts.map(p => JSON.stringify(p).replace(/}$/, ',test:record => /[a-z}]/.test(record.playerId)}')).join(',');
  let sourceJs = `window.FPL_DAILY_CHALLENGE={id:${JSON.stringify(v.challengeId)},releaseDate:${JSON.stringify(v.releaseDate)},perfectScore:${v.perfectScore},prompts:[${sourcePrompts}]};`;
  if (kind === 'extra-statement') sourceJs += 'window.FPL_DAILY_CHALLENGE.prompts=[];';
  if (kind === 'computed-metadata') sourceJs = sourceJs.replace('perfectScore:110', 'perfectScore:(()=>110)()');
  if (kind === 'malformed-test') sourceJs = sourceJs.replace('test:record => /[a-z}]/.test(record.playerId)', 'test:false');
  if (kind === 'comment-score') sourceJs = '/* perfectScore:110, */' + sourceJs.replace('perfectScore:110', 'perfectScore:111');
  const body = { action: 'publish', challenges: [{ releaseDate: v.releaseDate, challengeId: v.challengeId, title: 'Fixture', perfectScore: v.perfectScore, sourceJs, manifestEntry: { id: v.challengeId, date: v.releaseDate }, verifier: v }] };
  const result = await f.call('daily-challenge-publish', body, 'admin-token');
  assert.equal(result.status, kind === 'valid' ? 200 : 400, kind);
  assert.equal(f.operations.some(o => o.rpc === 'publish_daily_challenge_batch'), kind === 'valid', kind + ' must be checked before publishing');
  console.log('PASS source consistency', kind);
}

// Exercise the parser on actual Studio exports, including regex literals and
// multiline arrow bodies. The source is trusted repository code; handlers never eval it.
const parserContext = vm.createContext({});
vm.runInContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'], parserContext);
const context = vm.createContext({ parse: parserContext.acorn.parse, httpError: (status, message) => Object.assign(new Error(message), { status }) });
const validator = fs.readFileSync('supabase/functions/_shared/generated-source.ts', 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
vm.runInContext(stripTypeScriptTypes(validator, { mode: 'transform' }), context);
let exported = 0;
for (const path of fs.readdirSync('challenges').filter(name => /^\d{4}-\d{2}-\d{2}\.js$/.test(name))) {
  const source = fs.readFileSync('challenges/' + path, 'utf8');
  const window = {};
  vm.runInNewContext(source, { window });
  const challenge = window.FPL_DAILY_CHALLENGE;
  context.validateGeneratedSource(source, { challengeId: challenge.id, releaseDate: challenge.releaseDate, perfectScore: challenge.perfectScore, prompts: challenge.prompts.map(prompt => ({ promptId: prompt.id, position: prompt.position })) });
  exported++;
}
assert.ok(exported > 0);
console.log('PASS structural parser on', exported, 'real repository Studio exports');
