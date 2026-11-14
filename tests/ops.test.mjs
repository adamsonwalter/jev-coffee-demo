// Operational data: the effects engine, storage, the guard, and the HTTP door to them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEffects } from '../demos/effects.mjs';
import { DEMOS } from '../demos/index.mjs';
import { memoryStore } from '../server/store.mjs';
import { getData, sendEffects, resetData, applyScenario, logEvent, readLog, clearLog } from '../server/ops.mjs';
import { allow, originOk, LIMITS } from '../server/guard.mjs';

test('effects: add never goes below zero; set only changes what exists; put adds records', () => {
  const d = { stock: { Oat: 2 }, slots: { a: { status: 'free' } }, deals: {}, activity: [] };
  const r = applyEffects(d, [{ op: 'add', path: 'stock.Oat', by: -9 }, { op: 'set', path: 'slots.a.status', value: 'booked' }, { op: 'put', path: 'deals', id: 'Acme Co!', value: { company: 'Acme', n: 1, nested: { x: 1 } } }], 'note');
  assert.equal(r.data.stock.Oat, 0); assert.equal(r.data.slots.a.status, 'booked');
  assert.deepEqual(r.data.deals['acme-co'], { company: 'Acme', n: 1 });
  assert.equal(r.applied.length, 3); assert.equal(r.data.activity[0].note, 'note'); assert.equal(d.stock.Oat, 2, 'input untouched');
});

test('effects: unknown paths, prototype tricks, wrong types and too many are rejected', () => {
  const d = { stock: { Oat: 2 }, deals: { a: {} } };
  const bad = [{ op: 'add', path: 'stock.Nope', by: 1 }, { op: 'set', path: '__proto__.x', value: 1 }, { op: 'add', path: 'stock.Oat', by: '1' }, { op: 'set', path: 'stock', value: 'x' }, { op: 'put', path: 'stock', id: 'x', value: { a: 1 } }, { op: 'drop', path: 'stock.Oat' }, { op: 'add', path: 'a.b.c.d.e', by: 1 }];
  const r = applyEffects(d, bad);
  assert.equal(r.applied.length, 0); assert.equal(r.rejected.length, bad.length); assert.equal(({}).x, undefined);
  assert.equal(applyEffects(d, Array(100).fill({ op: 'add', path: 'stock.Oat', by: 1 })).applied.length, 30, 'capped at 30 effects per call');
});

test('storage: data starts from the demo defaults, changes persist, reset restores', async () => {
  const st = memoryStore();
  assert.equal((await getData('coffee', st)).stock.Oat, 24);
  const r = await sendEffects('coffee', [{ op: 'add', path: 'stock.Oat', by: -4 }], 'test', st);
  assert.equal(r.applied, 1); assert.equal((await getData('coffee', st)).stock.Oat, 20);
  assert.equal((await sendEffects('coffee', [{ op: 'add', path: 'stock.Nope', by: 1 }], '', st)).rejected, 1);
  assert.equal((await resetData('coffee', st)).stock.Oat, 24); assert.equal((await getData('coffee', st)).stock.Oat, 24);
});

test('quality log: newest first, capped, clearable', async () => {
  const st = memoryStore();
  for (let i = 0; i < 230; i++) await logEvent({ type: 'audit', i }, st);
  const log = await readLog(st);
  assert.equal(log.length, 200); assert.equal(log[0].i, 229);
  await clearLog(st); assert.deepEqual(await readLog(st), []);
});

test('guard: per-visitor limit per minute, resets next minute, visitors are separate', async () => {
  const st = memoryStore(), t = 1_700_000_000_000;
  for (let i = 0; i < LIMITS.jevPerMin; i++) assert.ok((await allow('1.1.1.1', 'jev', t, st)).ok);
  const over = await allow('1.1.1.1', 'jev', t + 1000, st);
  assert.equal(over.ok, false); assert.equal(over.error, 'rate_limited');
  assert.ok((await allow('2.2.2.2', 'jev', t, st)).ok);
  assert.ok((await allow('1.1.1.1', 'jev', t + 61_000, st)).ok);
});

test('guard: origin must match the site (no origin = scripts and tests, allowed)', () => {
  const req = (origin) => new Request('https://site.example/api/order', { headers: origin ? { origin } : {} });
  assert.ok(originOk(req())); assert.ok(originOk(req('https://site.example'))); assert.ok(!originOk(req('https://evil.example'))); assert.ok(!originOk(req('not a url')));
});

test('every effect a demo proposes is accepted by the data engine (starting data, random answers)', () => {
  for (const d of DEMOS) for (let i = 0; i < 300; i++) {
    const f = {};
    for (const [k, q] of Object.entries(d.questions)) { const o = Object.keys(q.criteria); f[k] = { value: o[Math.floor(Math.random() * o.length)], confidence: Math.random(), p: Object.fromEntries(o.map((x) => [x, 1 / o.length])) }; }
    for (const [k, x] of Object.entries(d.extract || {})) f[k] = { value: Math.random() < 0.5 ? 'Priya Nair' : null, confidence: 0.95, p: null };
    const out = d.render(f, JSON.parse(JSON.stringify(d.data)));
    const r = applyEffects(d.data, out.effects || [], out.note);
    assert.equal(r.rejected.length, 0, `${d.id}: rejected ${JSON.stringify(r.rejected)}`);
  }
});

test('every backend section points at real data', () => {
  for (const d of DEMOS) {
    assert.ok(d.backend && d.backend.name && d.backend.sections.length, `${d.id} needs a backend`);
    for (const sec of d.backend.sections) {
      if (sec.type === 'activity') { assert.ok(Array.isArray(d.data.activity)); continue; }
      const node = d.data[sec.path]; assert.ok(node && typeof node === 'object', `${d.id}: no data at ${sec.path}`);
      for (const k of sec.keys || []) assert.ok(k in node, `${d.id}: ${sec.path} has no "${k}"`);
      if (sec.type === 'grid') for (const row of Object.values(node)) for (const c of sec.cols) assert.equal(typeof row[c], 'number');
    }
  }
});

test('voice reads the data: a stockout, a full calendar and an unavailable crew each ping with a suggestion', async () => {
  const F = (value, confidence = 1) => ({ value, confidence, p: null });
  const byId = Object.fromEntries(DEMOS.map((d) => [d.id, d]));
  const coffee = byId.coffee.render({ drink: F('Latte'), size: F('Unspecified'), milk: F('Soy'), croissant: F('yes'), extra_shot: F('no') });
  assert.ok(coffee.flags.some((x) => x.s === 'out' && /Soy milk is out\. Offer/.test(x.m)) && coffee.flags.some((x) => /Croissant sold out/.test(x.m)) && coffee.ok === false);
  const quote = byId.quote.render({ trade: F('Electrical'), issue: F('Power'), scope: F('Small'), urgency: F('Emergency'), access: F('Easy') });
  assert.ok(quote.flags.some((x) => /No sparky free today\. Tomorrow: 1 crew/.test(x.m)));
  const desk = byId.desk.render({ reason: F('Injury'), urgency: F('Soon'), day: F('Today'), time: F('Afternoon'), patient: F('Existing'), red_flag: F('no'), name: F('Walter Adamson', 0.99) });
  assert.ok(desk.flags.some((x) => /No today afternoon slots\. Next free/.test(x.m)) && desk.ok === true && desk.effects.length === 2 && desk.rows[0][0] === 'Walter Adamson');
});

test('HTTP door /api/data and /api/log: read, write, reset, refuse', async () => {
  const { default: handler } = await import('../netlify/functions/ops.mjs');
  const call = (path, body, init = {}) => handler(new Request('https://site.example' + path, body ? { method: 'POST', body: JSON.stringify(body), ...init } : init), { ip: 'test-' + Math.random() });
  let r = await call('/api/data?demo=desk'); assert.equal(r.status, 200); assert.ok((await r.json()).data.slots);
  r = await call('/api/data?demo=nope'); assert.equal(r.status, 400);
  r = await call('/api/data', { demo: 'quote', effects: [{ op: 'add', path: 'parts.Gas regulator', by: -2 }], note: 'x' });
  let j = await r.json(); assert.equal(j.applied, 1); assert.equal(j.data.parts['Gas regulator'], 4);
  r = await call('/api/data?demo=quote'); assert.equal((await r.json()).data.parts['Gas regulator'], 4, 'change persisted');
  r = await call('/api/data', { demo: 'quote', reset: true }); assert.equal((await r.json()).data.parts['Gas regulator'], 6);
  r = await call('/api/data', { demo: 'quote', effects: [{ op: 'set', path: '__proto__.x', value: 1 }] }); assert.equal((await r.json()).rejected, 1);
  r = await call('/api/log'); assert.ok(Array.isArray((await r.json()).log));
  r = await call('/api/data?demo=coffee', null, { headers: { origin: 'https://evil.example' } }); assert.equal(r.status, 403);
});

// What Jev would return for each scenario's phrase (hand-written), and what the voice must then say. Guards "the ping".
const F = (value, confidence = 1) => ({ value, confidence, p: null });
const SCEN = {
  'coffee/rush': [{ drink: F('Flat White'), size: F('Large'), milk: F('Oat'), muffin: F('yes') }, [/Oat milk low \(2 left\)/, /Only 1 muffin left/]],
  'coffee/delivery': [{ drink: F('Latte'), size: F('Large'), milk: F('Soy'), croissant: F('yes') }, [/No stock issues/]],
  'coffee/lastone': [{ drink: F('Flat White'), milk: F('Full cream'), croissant: F('yes'), muffin: F('yes') }, [/Only 1 croissant left/, /Muffin sold out/]],
  'desk/full': [{ reason: F('Injury'), urgency: F('Soon'), day: F('Tomorrow'), time: F('Afternoon'), patient: F('Existing'), red_flag: F('no') }, [/No tomorrow afternoon slots\. Next free: .*Dr Patel/]],
  'desk/open': [{ reason: F('Injury'), urgency: F('Soon'), day: F('Tomorrow'), time: F('Afternoon'), patient: F('Existing'), red_flag: F('no') }, [/Free: Tomorrow 14:00/]],
  'desk/away': [{ reason: F('Checkup'), urgency: F('Routine'), day: F('Tomorrow'), time: F('Morning'), patient: F('Existing'), red_flag: F('no') }, [/Free: Tomorrow .* Dr Patel/]],
  'quote/storm': [{ trade: F('Plumbing'), issue: F('HotWater'), scope: F('Small'), urgency: F('Emergency'), access: F('Easy') }, [/No plumber free today\. Tomorrow: 1 crew/, /Hot water unit 250L out of stock/]],
  'quote/quiet': [{ trade: F('Plumbing'), issue: F('HotWater'), scope: F('Small'), urgency: F('Emergency'), access: F('Easy') }, [/Plumber free today \(2 crew\)/]],
  'quote/sparky': [{ trade: F('Electrical'), issue: F('Install'), scope: F('Small'), urgency: F('Emergency'), access: F('Easy') }, [/No sparky free today\. Nothing tomorrow either/, /Ceiling fan kit out of stock/]],
  'sales/quarterend': [{ interest: F('Hot'), next_step: F('Demo'), company: F('Northwind') }, [/No free calendar slots/, /CRM: Northwind/]],
  'sales/open': [{ interest: F('Warm'), next_step: F('Call'), company: F('Redgum Coffee') }, [/New lead: Redgum Coffee/, /Calendar: .* is free/]],
  'sales/hot': [{ interest: F('Hot'), next_step: F('Demo'), company: F('Harbour Freight') }, [/CRM: Harbour Freight · Closing/, /Calendar: .* is free/]],
};
for (const d of DEMOS) for (const sc of d.scenarios || []) {
  test(`scenario ${d.id}/${sc.id}: applies cleanly, changes the data, and the voice then pings what it should`, async () => {
    assert.ok(sc.name && sc.blurb && sc.say);
    const st = memoryStore(), r = await applyScenario(d.id, sc.id, st);
    assert.equal(r.rejected, 0, 'every effect accepted'); assert.ok(r.applied > 0);
    assert.notDeepEqual({ ...r.data, activity: 0 }, { ...d.data, activity: 0 }, 'must differ from the starting data');
    assert.match(r.data.activity[0].note, /^Scenario: /);
    const [fields, expects] = SCEN[`${d.id}/${sc.id}`] || assert.fail('add expected pings for this scenario to SCEN');
    const out = d.render(fields, r.data), text = [...out.flags.map((x) => x.m), ...out.rows.map((x) => x[0] || '')].join(' | ');
    for (const re of expects) assert.match(text, re);
  });
}
test('unknown scenario is refused', async () => assert.equal(await applyScenario('coffee', 'nope', memoryStore()), null));
