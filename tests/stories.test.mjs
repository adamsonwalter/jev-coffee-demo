// The stories page must never promise what the app doesn't do. Every "works in the demo" line is rendered through the real demo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERSONAS, LEGEND, BADGE, LAYOUTS } from '../stories.mjs';
import { DEMOS } from '../demos/index.mjs';
import { VERSION } from '../version.mjs';
import { pickSay } from '../demos/lib.mjs';
import { memoryStore } from '../server/store.mjs';
import { applyScenario, getData } from '../server/ops.mjs';

const KINDS = ['ok', 'warn', 'out', 'ask'], TAGS = LEGEND.map(([k]) => k);
const demo = (id) => DEMOS.find((d) => d.id === id);
const F = (value) => ({ value, confidence: 0.99, p: null });

test('version: one source, and package.json agrees', () => {
  assert.match(VERSION, /^\d+\.\d+$/);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version, VERSION + '.0');
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), new RegExp("const CACHE = 'jev-demo-v" + VERSION.replace('.', '\\.') + "'"), 'sw.js cache name carries the version, so each release starts clean');
});

const REQUIRED = { scene: ['beats'], dialogue: ['beats'], timeline: ['beats'], compare: ['beats', 'without'], parallel: ['cols', 'rows'], board: ['cols', 'rows'], alarm: ['beats'] };
const seeOk = (see) => Array.isArray(see) && see.length === 2 && KINDS.includes(see[0]) && !!see[1];

test('stories: structure, unique ids, valid tabs, tags, layouts, scenarios', () => {
  const ids = new Set(), layouts = new Set();
  assert.ok(PERSONAS.length >= 6);
  for (const p of PERSONAS) {
    assert.ok(p.id && p.who && p.hook && p.checks && demo(p.tab), 'persona ' + p.id + ' is complete and points at a real tab');
    assert.ok(!ids.has(p.id), 'unique persona id ' + p.id); ids.add(p.id);
    assert.ok(p.stories.length >= 2, p.id + ' needs a set of stories');
    assert.ok(new Set(p.stories.map((s) => s.layout)).size >= 3, p.id + ' should not read as one repeated shape: use at least three layouts');
    const sids = new Set();
    for (const s of p.stories) {
      assert.ok(s.id && s.title && s.scene && BADGE[s.badge], p.id + '/' + s.id + ' is complete');
      assert.ok(LAYOUTS.includes(s.layout), s.id + ': known layout'); layouts.add(s.layout);
      for (const k of REQUIRED[s.layout]) assert.ok(s[k] && s[k].length !== 0, `${s.id}: ${s.layout} needs ${k}`);
      assert.ok(!sids.has(s.id), 'unique story id ' + s.id); sids.add(s.id);
      assert.ok(s.tags.length && s.tags.every((t) => TAGS.includes(t)), 'known tags in ' + s.id);
      for (const b of s.beats || []) {
        assert.ok(b.say || b.label || b.see, s.id + ': a beat says, labels or shows something');
        if (b.see) assert.ok(b.see.every(seeOk), 'valid lines in ' + s.id);
        if (s.layout === 'dialogue') assert.ok(['them', 'you'].includes(b.who), s.id + ': dialogue beats say who');
        if (s.layout === 'timeline') assert.ok(b.at, s.id + ': timeline beats are stamped');
      }
      for (const r of s.rows || []) assert.ok(s.layout === 'parallel' ? r.said && seeOk(r.see) : r.length === 3 && ['ok', 'warn', 'out'].includes(r[2]), 'valid rows in ' + s.id);
      if (s.try) {
        assert.ok(s.try.say, 'try needs a phrase: ' + s.id);
        if (s.try.scenario) assert.ok((demo(p.tab).scenarios || []).some((x) => x.id === s.try.scenario), s.id + ': scenario exists on the ' + p.tab + ' tab');
      }
    }
  }
  assert.equal(layouts.size, LAYOUTS.length, 'every layout is used: ' + [...layouts]);
});

// Everything a "works in the demo" story puts on screen, grouped with the proof that renders it.
const groups = (s) => [
  ...(s.beats || []).filter((b) => b.see).map((b) => ({ proof: b.proof, texts: b.see.map((x) => x[1]) })),
  ...(s.rows && s.layout === 'parallel' ? [{ proof: s.proof, texts: s.rows.map((r) => r.see[1]) }] : []),
];

test('stories: every "works in the demo" screen line and say-next sentence is what the real demo produces', async () => {
  let checked = 0, said = 0;
  for (const p of PERSONAS) for (const s of p.stories) {
    if (s.badge !== 'today') continue;
    if (s.fromData) { assert.ok(s.rows.length, s.id + ': rows come straight from the demo data'); continue; }
    assert.ok(groups(s).length, p.id + '/' + s.id + ': a "today" story needs screen lines to prove');
    const sayings = new Set();
    for (const g of groups(s)) {
      assert.ok(g.proof, p.id + '/' + s.id + ': a "today" story needs proof');
      const d = demo(p.tab), store = memoryStore();
      const data = g.proof.scenario ? (await applyScenario(d.id, g.proof.scenario, store)).data : await getData(d.id, store);
      const fields = Object.fromEntries(Object.entries(g.proof.fields).map(([k, v]) => [k, F(v)]));
      const out = d.render(fields, data), shown = out.flags.map((x) => x.m);
      if (pickSay(out)) sayings.add(pickSay(out));
      for (const text of g.texts) { assert.ok(shown.includes(text), `${p.id}/${s.id}: the app does not show “${text}”. It shows: ${JSON.stringify(shown)}`); checked++; }
    }
    const claimed = [s.next, ...(s.beats || []).map((b) => b.next), ...(s.beats || []).filter((b) => b.suggested).map((b) => b.say)].filter(Boolean);
    for (const c of claimed) { assert.ok(sayings.has(c), `${p.id}/${s.id}: the app does not say “${c}” next. It says: ${JSON.stringify([...sayings])}`); said++; }
  }
  assert.ok(checked >= 15, 'checked a meaningful number of lines (' + checked + ')');
  assert.ok(said >= 4, 'checked the say-next sentences (' + said + ')');
});

test('stories: every demo tab has stories of its own, so its icon can open them', () => {
  for (const d of DEMOS) assert.ok(PERSONAS.some((p) => p.tab === d.id), 'no persona for the ' + d.tab + ' tab');
});
