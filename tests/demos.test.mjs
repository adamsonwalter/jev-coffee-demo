// Contract tests: every registered demo (and the template) must satisfy what the app and server assume.
// Run: npm test. Add a demo to demos/index.mjs and these check it automatically.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMOS } from '../demos/index.mjs';
import template from '../demos/_template.mjs';

const keysOf = (rk) => [].concat(rk || []).filter(Boolean);
const randomAnswers = (d) => {
  const f = {};
  for (const [k, q] of Object.entries(d.questions)) {
    if (Math.random() < 0.1) continue;
    const opts = Object.keys(q.criteria), val = opts[Math.floor(Math.random() * opts.length)], c = Math.random();
    f[k] = { value: val, confidence: c, p: Object.fromEntries(opts.map((o) => [o, o === val ? c : (1 - c) / Math.max(1, opts.length - 1)])) };
  }
  return f;
};

test('ids are unique', () => assert.equal(new Set(DEMOS.map((d) => d.id)).size, DEMOS.length));

for (const d of [...DEMOS, template]) {
  test(`${d.id}: shape`, () => {
    for (const k of ['id', 'tab', 'title', 'say', 'chips', 'labels', 'confirm', 'ctx', 'questions']) assert.ok(d[k], `missing ${k}`);
    assert.equal(typeof d.render, 'function');
    assert.ok(d.chips.length > 0 && d.labels.length > 0);
    assert.equal(d.rowKeys.length, d.labels.length, 'rowKeys must have one entry per label (use null for none)');
  });

  test(`${d.id}: questions are well formed`, () => {
    for (const [k, q] of Object.entries(d.questions)) {
      assert.equal(q.type, 'choice', k);
      assert.ok(Object.keys(q.criteria).length >= 2, `${k} needs at least two options`);
      for (const text of Object.values(q.criteria)) assert.ok(typeof text === 'string' && text.length > 3, `${k}: every option needs a description`);
    }
  });

  test(`${d.id}: every rowKey is a real question`, () => {
    for (const k of d.rowKeys.flatMap(keysOf)) assert.ok(d.questions[k], `rowKeys names unknown question "${k}"`);
  });

  test(`${d.id}: render handles nothing heard`, () => {
    const out = d.render({});
    assert.equal(out.rows.length, d.labels.length);
    assert.equal(out.ok, false);
  });

  test(`${d.id}: render survives 500 random answer sets`, () => {
    for (let i = 0; i < 500; i++) {
      const out = d.render(randomAnswers(d));
      assert.equal(out.rows.length, d.labels.length);
      for (const r of out.rows) assert.ok(Array.isArray(r), 'each row is [text, unsure?]');
      for (const fl of out.flags || []) assert.ok(['ok', 'warn', 'out'].includes(fl.s) && fl.m, 'flags need m and s: ok|warn|out');
      if (out.extra) assert.ok(['range', 'score', 'note'].includes(out.extra.kind));
    }
  });
}
