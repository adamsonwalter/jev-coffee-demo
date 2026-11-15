// The conversation controller: one read in flight, newest words win, second look after a pause, offline back-off.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createConversation } from '../conversation.js';
import { TUNING as T } from '../demos/lib.mjs';

const sure = (value) => ({ value, confidence: 0.99, p: null });
const tick = async (ms = 0) => { mock.timers.tick(ms); for (let i = 0; i < 20; i++) await Promise.resolve(); };

// A harness with a fake Jev: every post is recorded and answered by hand with calls[i].done(reply) or .fail().
function setup({ listening = true } = {}) {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const calls = [], seen = { renders: [], engine: [], offline: 0, chimes: 0 };
  const post = (body, signal) => new Promise((done, fail) => calls.push({ body, signal, done, fail }));
  const demo = { id: 'coffee', labels: ['Drink'], rowKeys: ['drink'] };
  const c = createConversation({
    post, demo: () => demo, listening: () => listening,
    ui: {
      render(f, settled, tags) { seen.renders.push({ f, settled, tags }); return { rows: [[f.drink && f.drink.value]] }; },
      engine: (kind, text) => seen.engine.push(text), offline: () => seen.offline++, chime: () => seen.chimes++,
    },
  });
  return { c, calls, seen };
}

test('one read at a time: words that arrive mid-read wait, and only the newest is sent', async (t) => {
  t.after(() => mock.timers.reset());
  const { c, calls, seen } = setup();
  c.hear('a flat'); await tick(T.throttleMs);
  assert.equal(calls.length, 1);
  c.hear('a flat white'); c.hear('a flat white with'); c.hear('a flat white with oat'); await tick(5000);
  assert.equal(calls.length, 1, 'nothing new is sent while a read is in flight');
  assert.equal(calls[0].signal.aborted, false, 'and the read in flight is not thrown away');
  calls[0].done({ fields: { drink: sure('Flat White') } }); await tick();
  assert.equal(seen.renders.length, 1);
  await tick(T.throttleMs);
  assert.equal(calls.length, 2); assert.equal(calls[1].body.transcript, 'a flat white with oat');
});

test('reset (tab change, Clear) ignores a read that lands afterwards', async (t) => {
  t.after(() => mock.timers.reset());
  const { c, calls, seen } = setup();
  c.hear('a latte'); await tick(T.throttleMs);
  c.reset();
  assert.ok(calls[0].signal.aborted);
  calls[0].done({ fields: { drink: sure('Latte') } }); await tick(T.pauseMs + 1000);
  assert.equal(seen.renders.length, 0); assert.equal(calls.length, 1);
});

test('after a pause: unsure fields are settled, then the card is final-checked once', async (t) => {
  t.after(() => mock.timers.reset());
  const { c, calls, seen } = setup();
  c.hear('a magic'); await tick(T.throttleMs);
  calls[0].done({ fields: { drink: { value: 'Latte', confidence: 0.5, p: null } } }); await tick();
  await tick(T.pauseMs - 1); assert.equal(calls.length, 1, 'not before the pause');
  await tick(1);
  assert.deepEqual(calls[1].body.only, ['drink']); assert.equal(calls[1].body.final, true);
  calls[1].done({ fields: { drink: sure('Magic') } }); await tick();
  assert.equal(seen.renders.at(-1).f.drink.value, 'Magic'); assert.equal(seen.renders.at(-1).settled, true);
  assert.equal(calls[2].body.mode, 'audit');
  calls[2].done({ audit: [{ fits: 0.9 }] }); await tick();
  assert.equal(seen.engine.at(-1), 'Jev · final check clean'); assert.equal(seen.chimes, 0);
  c.pause(); await tick(350);
  assert.equal(calls.length, 3, 'the same words are not checked twice');
});

test('a final-check rewrite is kept when later live reads still give the old answer', async (t) => {
  t.after(() => mock.timers.reset());
  const { c, calls, seen } = setup({ listening: false });
  c.hear('a magic'); await tick(T.throttleMs);
  calls[0].done({ fields: { drink: sure('Latte') } }); await tick(); await tick(350);
  calls[1].done({ audit: [{ fits: 0.01 }] }); await tick();                       // clear mismatch
  assert.equal(calls[2].body.mode, 'rewrite'); assert.equal(calls[2].body.exclude, 'Latte');
  calls[2].done({ field: sure('Magic') }); await tick();
  assert.equal(seen.chimes, 1); assert.deepEqual(seen.renders.at(-1).tags, { 0: { kind: 'revised', was: 'Latte' } });
  c.hear('a magic please'); await tick(T.throttleMs);
  calls[3].done({ fields: { drink: { value: 'Latte', confidence: 0.8, p: null } } }); await tick();
  assert.equal(seen.renders.at(-1).f.drink.value, 'Magic');
});

test('a failed read says Jev is offline and holds off until the retry time', async (t) => {
  t.after(() => mock.timers.reset());
  const { c, calls, seen } = setup();
  c.hear('a latte'); await tick(T.throttleMs);
  calls[0].fail(new Error('status 502')); await tick();
  assert.equal(seen.offline, 1);
  c.hear('a latte please'); await tick(T.throttleMs);
  assert.equal(calls.length, 1); assert.equal(seen.offline, 2);
  await tick(T.retryMs);
  c.hear('a latte please thanks'); await tick(T.throttleMs);
  assert.equal(calls.length, 2);
});
