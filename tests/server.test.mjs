// The server's modes and the HTTP shell, with Jev replaced by a stand-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../server/modes.mjs';
import { DEMOS } from '../demos/index.mjs';

const noLog = async () => {};
// A stand-in for free-text extraction: finds "Walter Adamson" in the transcript, everything else is empty.
const fakeExtract = async ({ text, fields }) => ({ fields: Object.fromEntries(Object.keys(fields).map((k) => [k, /Walter Adamson/.test(text) ? { value: 'Walter Adamson', confidence: 0.99 } : { value: null, confidence: 0.5, p_null: 0.99 }])) });
// A stand-in Jev: answers every question with its first option at 90% (probabilities included).
let asked;
const fakeJev = async (args) => {
  asked = args;
  const answers = Object.fromEntries(Object.entries(args.questions).map(([k, q]) => { const o = Object.keys(q.criteria); return [k, { choice: o[0], confidence: 0.9, probabilities: Object.fromEntries(o.map((x, i) => [x, i ? 0.02 : 0.9])) }]; }));
  return { model: 'fake', answers };
};

for (const d of DEMOS) test(`read: ${d.id} asks every question`, async () => {
  const r = await run({ demo: d.id, transcript: 'hello' }, { call: fakeJev, extract: fakeExtract, log: noLog });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body.fields).sort(), [...Object.keys(d.questions), ...Object.keys(d.extract || {})].sort());
});

test('read: free-text fields (names) are extracted alongside Jev, and absent ones come back null with high certainty', async () => {
  const hit = await run({ demo: 'desk', transcript: 'my name is Walter Adamson' }, { call: fakeJev, extract: fakeExtract, log: noLog });
  assert.equal(hit.body.fields.name.value, 'Walter Adamson');
  const miss = await run({ demo: 'desk', transcript: 'no name here' }, { call: fakeJev, extract: fakeExtract, log: noLog });
  assert.equal(miss.body.fields.name.value, null); assert.ok(miss.body.fields.name.confidence > 0.9);
});

test('read: if extraction fails the typed answers still come back', async () => {
  const r = await run({ demo: 'desk', transcript: 'x' }, { call: fakeJev, extract: async () => { throw new Error('boom'); }, log: noLog });
  assert.equal(r.status, 200); assert.ok(r.body.fields.reason); assert.ok(!r.body.fields.name);
});

test('settling pass on free-text fields only does not re-ask the typed questions', async () => {
  let asks = 0;
  const r = await run({ demo: 'desk', transcript: 'x', final: true, only: ['name'] }, { call: async (a) => { asks++; return fakeJev(a); }, extract: fakeExtract, log: noLog });
  assert.equal(asks, 0); assert.deepEqual(Object.keys(r.body.fields), ['name']);
});

test('final check logs what it catches: a mismatch on audit, the change on rewrite; clean audits log nothing', async () => {
  const events = [], log = async (e) => { events.push(e); };
  const bad = async (a) => ({ model: 'f', answers: Object.fromEntries(Object.keys(a.questions).map((k) => [k, { choice: 'wrong', confidence: 1, probabilities: { fits: 0.02, imprecise: 0.2, wrong: 0.78 } }])) });
  await run({ demo: 'quote', transcript: 'my paling fence', mode: 'audit', shown: [{ label: 'Trade', value: 'Concreter' }] }, { call: bad, log });
  assert.equal(events.length, 1); assert.equal(events[0].type, 'audit'); assert.equal(events[0].rows[0].shown, 'Concreter');
  await run({ demo: 'quote', transcript: 'fence', mode: 'rewrite', key: 'trade', exclude: 'Landscaping' }, { call: fakeJev, log });
  assert.equal(events[1].type, 'rewrite'); assert.equal(events[1].from, 'Landscaping');
  const n = events.length;
  await run({ demo: 'quote', transcript: 'x', mode: 'audit', shown: [{ label: 'Trade', value: 'Fencer' }] }, { call: fakeJev, log });
  assert.equal(events.length, n, 'a clean audit must not log');
});

test('a failing log never breaks a request', async () => {
  const r = await run({ demo: 'quote', transcript: 'x', mode: 'rewrite', key: 'trade', exclude: 'Landscaping' }, { call: fakeJev, log: async () => { throw new Error('disk'); } });
  assert.equal(r.status, 200);
});

test('read: settling pass asks only the requested fields and says the transcript is final', async () => {
  const r = await run({ demo: 'sales', transcript: 'x', final: true, only: ['budget', 'interest'] }, { call: fakeJev, extract: fakeExtract, log: noLog });
  assert.deepEqual(Object.keys(r.body.fields).sort(), ['budget', 'interest']);
  assert.match(asked.state.context, /complete final transcript/);
});

test('audit: one rating per row, with the on-screen text shown to Jev', async () => {
  const r = await run({ demo: 'quote', transcript: 'fence', mode: 'audit', shown: [{ label: 'Trade', value: 'Fencer' }, { label: 'When', value: 'Flexible' }] }, { call: fakeJev, log: noLog });
  assert.equal(r.body.audit.length, 2);
  assert.deepEqual(asked.state.on_screen, { Trade: 'Fencer', When: 'Flexible' });
});

test('rewrite (one choice): old answer is off the menu, NoFit is on it', async () => {
  await run({ demo: 'quote', transcript: 'fence', mode: 'rewrite', key: 'trade', exclude: 'Landscaping' }, { call: fakeJev, log: noLog });
  const menu = asked.questions.trade.criteria;
  assert.ok(!('Landscaping' in menu) && 'NoFit' in menu && 'Fencing' in menu);
});

test('rewrite (several yes/no answers): re-asks exactly those', async () => {
  const r = await run({ demo: 'coffee', transcript: 'x', mode: 'rewrite', keys: ['croissant', 'muffin', 'nonsense'], shown: 'Cookie' }, { call: fakeJev, log: noLog });
  assert.deepEqual(Object.keys(r.body.fields), ['croissant', 'muffin']);
});

test('bad requests are refused cleanly', async () => {
  for (const [body, code] of [[{ demo: 'nope', transcript: 'x' }, 'unknown_demo'], [{ demo: 'coffee', mode: 'nope', transcript: 'x' }, 'unknown_mode'], [{ demo: 'coffee', transcript: '   ' }, 'empty'],
    [{ demo: 'quote', transcript: 'x', mode: 'audit', shown: [] }, 'nothing_to_audit'], [{ demo: 'quote', transcript: 'x', mode: 'rewrite', key: 'zzz' }, 'unknown_key']]) {
    const r = await run(body, { call: fakeJev, log: noLog }); assert.equal(r.status, 400); assert.equal(r.body.error, code);
  }
});

test('a Jev outage becomes a 502, not a crash', async () => {
  const r = await run({ demo: 'coffee', transcript: 'x' }, { call: async () => { throw new Error('gateway_call'); }, log: noLog });
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
