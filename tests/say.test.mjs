// "Say next": one sentence worth saying now, picked from the most serious flag that carries one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMOS } from '../demos/index.mjs';
import { pickSay } from '../demos/lib.mjs';
import { memoryStore } from '../server/store.mjs';
import { applyScenario } from '../server/ops.mjs';

const F = (value) => ({ value, confidence: 0.99, p: null });
const demo = (id) => DEMOS.find((d) => d.id === id);
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, F(v)]));
const say = async (id, f, scenario) => { const d = demo(id); return pickSay(d.render(fields(f), scenario ? (await applyScenario(id, scenario, memoryStore())).data : d.data)); };

test('pickSay: the most serious flag with a sentence wins; none means nothing to say', () => {
  assert.equal(pickSay({ flags: [{ m: 'a', s: 'ok', say: 'fine' }, { m: 'b', s: 'out', say: 'urgent' }, { m: 'c', s: 'warn', say: 'hmm' }] }), 'urgent');
  assert.equal(pickSay({ flags: [{ m: 'a', s: 'out' }, { m: 'b', s: 'warn', say: 'hmm' }] }), 'hmm');
  assert.equal(pickSay({ flags: [{ m: 'a', s: 'ok' }] }), null);
  assert.equal(pickSay({ say: 'explicit', flags: [{ m: 'a', s: 'out', say: 'x' }] }), 'explicit');
  assert.equal(pickSay(null), null);
});

test('say next: each demo suggests the right sentence for its situations', async () => {
  assert.equal(await say('coffee', { drink: 'Flat White', size: 'Large', milk: 'Oat', muffin: 'yes' }, 'rush'), 'We’re nearly out of oat milk. How about almond or skim?');
  assert.equal(await say('coffee', { drink: 'Flat White', milk: 'Soy' }), 'Sorry, we’re out of soy milk. Would oat or almond work?');
  assert.match(await say('coffee', { drink: 'Flat White', milk: 'Full cream', croissant: 'yes', muffin: 'yes' }, 'lastone'), /muffins are gone.*croissant/);
  assert.match(await say('coffee', { drink: 'Drip Coffee', regular_word: 'yes' }), /size and milk/);
  assert.equal(await say('coffee', { drink: 'Latte', milk: 'Oat' }), null, 'nothing wrong, nothing to say');
  assert.match(await say('quote', { trade: 'Plumbing', issue: 'HotWater', scope: 'Small', urgency: 'Emergency', access: 'Easy' }, 'storm'), /earliest I can get a plumber to you is tomorrow/);
  assert.match(await say('quote', { trade: 'Gas', issue: 'Gas', scope: 'Small', urgency: 'Emergency', access: 'Easy' }), /leave the house now/);
  assert.match(await say('desk', { reason: 'Injury', urgency: 'Urgent', red_flag: 'yes', patient: 'Existing', day: 'Today' }), /nurse/, 'an emergency says so, whatever else is true');
  assert.match(await say('desk', { reason: 'Injury', urgency: 'Soon', day: 'Tomorrow', time: 'Afternoon', patient: 'Existing', red_flag: 'no' }, 'full'), /^Next free is .* with Dr Patel\. Would that suit\?$/);
  assert.match(await say('desk', { reason: 'Injury', urgency: 'Urgent', day: 'Today', patient: 'New', red_flag: 'no' }, 'full'), /passing you to the nurse/, 'urgent beats the generic next-free line');
  assert.match(await say('sales', { interest: 'Warm', next_step: 'None', company: 'Redgum Coffee' }), /next step/);
  assert.match(await say('sales', { interest: 'Hot', next_step: 'Demo', company: 'Northwind' }, 'quarterend'), /booked out this week/);
});

test('say next: two lines at most in the Try saying slot (72 characters), plain speech, no markup', async () => {
  const cases = [
    ['coffee', { drink: 'Flat White', milk: 'Soy', croissant: 'yes', syrup: 'yes' }], ['coffee', { drink: 'Cappuccino', no_foam: 'yes' }], ['coffee', { drink: 'Macchiato' }],
    ['coffee', { drink: 'Latte', milk: 'Split' }], ['coffee', { drink: 'Latte', size: 'Trenta' }], ['coffee', { drink: 'Secret Menu' }], ['coffee', { drink: 'Latte', iced: 'yes', extra_hot: 'yes' }],
    ['quote', { trade: 'Plumbing', issue: 'Burst', scope: 'Small', urgency: 'Emergency' }], ['quote', { trade: 'Electrical', issue: 'Power', scope: 'Small' }], ['quote', { trade: 'Locksmith', issue: 'Lockout', scope: 'Small' }],
    ['quote', { trade: 'Gas', issue: 'Gas', scope: 'Small', urgency: 'Emergency' }],
    ['desk', { reason: 'Repeat', patient: 'New', red_flag: 'no' }], ['desk', { reason: 'Injury', red_flag: 'yes' }],
    ['sales', { interest: 'Warm', budget: 'TooHigh', decision_maker: 'No', stall: 'yes', competitor: 'yes', next_step: 'None' }], ['sales', { interest: 'Warm', next_step: 'Call' }],
  ];
  for (const [id, f] of cases) {
    const text = await say(id, f);
    if (text == null) continue;
    assert.ok(text.length <= 72, `${id}: “${text}” is ${text.length} characters`);
    assert.ok(!/[<>*_]|\bundefined\b|\bnull\b/.test(text), `${id}: plain speech: ${text}`);
  }
});
