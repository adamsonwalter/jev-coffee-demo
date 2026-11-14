// The stories page must never promise what the app doesn't do. Every "works in the demo" line is rendered through the real demo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERSONAS, LEGEND, BADGE } from '../stories.mjs';
import { DEMOS } from '../demos/index.mjs';
import { VERSION } from '../version.mjs';
import { memoryStore } from '../server/store.mjs';
import { applyScenario, getData } from '../server/ops.mjs';

const KINDS = ['ok', 'warn', 'out', 'ask', 'next'], TAGS = LEGEND.map(([k]) => k);
const demo = (id) => DEMOS.find((d) => d.id === id);
const F = (value) => ({ value, confidence: 0.99, p: null });

test('version: one source, and package.json agrees', () => {
  assert.match(VERSION, /^\d+\.\d+$/);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version, VERSION + '.0');
});

test('stories: structure, unique ids, valid tabs, tags, kinds and scenarios', () => {
  const ids = new Set();
  assert.ok(PERSONAS.length >= 6);
  for (const p of PERSONAS) {
    assert.ok(p.id && p.who && p.hook && p.checks && demo(p.tab), 'persona ' + p.id + ' is complete and points at a real tab');
    assert.ok(!ids.has(p.id), 'unique persona id ' + p.id); ids.add(p.id);
    assert.ok(p.stories.length >= 2, p.id + ' needs a set of stories');
    const sids = new Set();
    for (const s of p.stories) {
      assert.ok(s.id && s.title && s.scene && s.payoff && BADGE[s.badge], p.id + '/' + s.id + ' is complete');
      assert.ok(!sids.has(s.id), 'unique story id ' + s.id); sids.add(s.id);
      assert.ok(s.tags.length && s.tags.every((t) => TAGS.includes(t)), 'known tags in ' + s.id);
      assert.ok(s.steps.length, 'steps in ' + s.id);
      for (const st of s.steps) {
        assert.ok(st.see.length && st.see.every(([k, t]) => KINDS.includes(k) && t), 'valid lines in ' + s.id);
        assert.ok(st.say || st.label, 'every step says something or is labelled: ' + s.id);
      }
      if (s.try) {
        assert.ok(s.try.say, 'try needs a phrase: ' + s.id);
        if (s.try.scenario) assert.ok((demo(p.tab).scenarios || []).some((x) => x.id === s.try.scenario), s.id + ': scenario exists on the ' + p.tab + ' tab');
      }
    }
  }
});

test('stories: every "works in the demo" screen line is wording the real demo produces', async () => {
  let checked = 0;
  for (const p of PERSONAS) for (const s of p.stories) {
    if (s.badge !== 'today') continue;
    for (const st of s.steps) {
      if (st.label) continue;   // describes a console screen, nothing to render
      assert.ok(st.proof, p.id + '/' + s.id + ': a "today" step needs proof');
      const d = demo(p.tab), store = memoryStore();
      const data = st.proof.scenario ? (await applyScenario(d.id, st.proof.scenario, store)).data : await getData(d.id, store);
      const fields = Object.fromEntries(Object.entries(st.proof.fields).map(([k, v]) => [k, F(v)]));
      const shown = d.render(fields, data).flags.map((x) => x.m);
      for (const [, text] of st.see) { assert.ok(shown.includes(text), `${p.id}/${s.id}: the app does not show “${text}”. It shows: ${JSON.stringify(shown)}`); checked++; }
    }
  }
  assert.ok(checked >= 20, 'checked a meaningful number of lines (' + checked + ')');
});

test('stories: "today" stories claim no say-next lines (that is not a live feature yet)', () => {
  for (const p of PERSONAS) for (const s of p.stories) if (s.badge === 'today') assert.ok(!s.steps.some((st) => st.see.some(([k]) => k === 'next')), s.id);
});
