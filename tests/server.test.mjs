// The server's modes and the HTTP shell, with Jev replaced by a stand-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../server/modes.mjs';
import { DEMOS } from '../demos/index.mjs';

// A stand-in Jev: answers every question with its first option at 90% (probabilities included).
let asked;
const fakeJev = async (args) => {
  asked = args;
  const answers = Object.fromEntries(Object.entries(args.questions).map(([k, q]) => { const o = Object.keys(q.criteria); return [k, { choice: o[0], confidence: 0.9, probabilities: Object.fromEntries(o.map((x, i) => [x, i ? 0.02 : 0.9])) }]; }));
  return { model: 'fake', answers };
};

for (const d of DEMOS) test(`read: ${d.id} asks every question`, async () => {
  const r = await run({ demo: d.id, transcript: 'hello' }, fakeJev);
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body.fields).sort(), Object.keys(d.questions).sort());
});

test('read: settling pass asks only the requested fields and says the transcript is final', async () => {
  const r = await run({ demo: 'sales', transcript: 'x', final: true, only: ['budget', 'interest'] }, fakeJev);
  assert.deepEqual(Object.keys(r.body.fields).sort(), ['budget', 'interest']);
  assert.match(asked.state.context, /complete final transcript/);
});

test('audit: one rating per row, with the on-screen text shown to Jev', async () => {
  const r = await run({ demo: 'quote', transcript: 'fence', mode: 'audit', shown: [{ label: 'Trade', value: 'Fencer' }, { label: 'When', value: 'Flexible' }] }, fakeJev);
  assert.equal(r.body.audit.length, 2);
  assert.deepEqual(asked.state.on_screen, { Trade: 'Fencer', When: 'Flexible' });
});

test('rewrite (one choice): old answer is off the menu, NoFit is on it', async () => {
  await run({ demo: 'quote', transcript: 'fence', mode: 'rewrite', key: 'trade', exclude: 'Landscaping' }, fakeJev);
  const menu = asked.questions.trade.criteria;
  assert.ok(!('Landscaping' in menu) && 'NoFit' in menu && 'Fencing' in menu);
});

test('rewrite (several yes/no answers): re-asks exactly those', async () => {
  const r = await run({ demo: 'coffee', transcript: 'x', mode: 'rewrite', keys: ['croissant', 'muffin', 'nonsense'], shown: 'Cookie' }, fakeJev);
  assert.deepEqual(Object.keys(r.body.fields), ['croissant', 'muffin']);
});

test('bad requests are refused cleanly', async () => {
  for (const [body, code] of [[{ demo: 'nope', transcript: 'x' }, 'unknown_demo'], [{ demo: 'coffee', mode: 'nope', transcript: 'x' }, 'unknown_mode'], [{ demo: 'coffee', transcript: '   ' }, 'empty'],
    [{ demo: 'quote', transcript: 'x', mode: 'audit', shown: [] }, 'nothing_to_audit'], [{ demo: 'quote', transcript: 'x', mode: 'rewrite', key: 'zzz' }, 'unknown_key']]) {
    const r = await run(body, fakeJev); assert.equal(r.status, 400); assert.equal(r.body.error, code);
  }
});

test('a Jev outage becomes a 502, not a crash', async () => {
  const r = await run({ demo: 'coffee', transcript: 'x' }, async () => { throw new Error('gateway_call'); });
  assert.equal(r.status, 502);
});

test('HTTP shell: method, gateway and origin checks', async () => {
  process.env.ABCDJEV_MCP_URL = 'https://gw.example/mcp/x';
  const { default: handler } = await import('../netlify/functions/order.mjs');
  const req = (init = {}) => new Request('https://site.example/api/order', { method: 'POST', body: '{}', ...init });
  assert.equal((await handler(new Request('https://site.example/api/order'))).status, 405);
  assert.equal((await handler(req({ headers: { origin: 'https://evil.example' } }))).status, 403);
  assert.equal((await handler(req({ headers: { origin: 'https://site.example' } }))).status, 400);   // allowed through; body {} has no transcript
  delete process.env.ABCDJEV_MCP_URL;
  assert.equal((await handler(req())).status, 503);
});
