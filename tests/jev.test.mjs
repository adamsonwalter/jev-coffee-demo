// The settling pass and final check, with a scripted Jev. No browser needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, finalCheck } from '../jev.js';

const F = (value, confidence = 1) => ({ value, confidence, p: null });
const demo = { labels: ['Trade', 'Issue', 'Extras'], rowKeys: ['trade', 'issue', ['extra_shot', 'syrup']] };
const scripted = (replies) => async (body) => { const r = replies[body.mode || (body.final ? 'settle' : 'read')]; return typeof r === 'function' ? r(body) : r; };

test('settle: re-asks only uncertain fields and leaves confident ones alone', async () => {
  let sent;
  const s = await settle(async (b) => { sent = b; return { fields: { scope: F('Medium', 0.95) } }; }, { trade: F('Fencing', 0.95), scope: F('Small', 0.5) });
  assert.deepEqual(sent.only, ['scope']);
  assert.equal(s.merged.scope.value, 'Medium'); assert.equal(s.merged.trade.value, 'Fencing');
  assert.equal(await settle(async () => assert.fail('should not call'), { trade: F('Fencing', 0.95) }), null);
});

test('final check: a clear mismatch on one choice is rewritten, tagged and pinned', async () => {
  const fields = { trade: F('Landscaping', 0.9), issue: F('Repair'), extra_shot: F('no'), syrup: F('no') };
  const call = scripted({ audit: { audit: [{ fits: 0.01 }, { fits: 0.9 }] }, rewrite: { field: F('Fencing', 0.95) } });
  const r = await finalCheck(call, demo, [['Concreter'], ['Repair'], [null]], fields);
  assert.equal(r.revised, 1); assert.equal(r.merged.trade.value, 'Fencing');
  assert.deepEqual(r.tags[0], { kind: 'revised', was: 'Concreter' }); assert.equal(r.pins.trade.value, 'Fencing');
  assert.equal(r.merged.issue.value, 'Repair');
});

test('final check: a rewrite Jev is not sure of is not applied, the row is only flagged', async () => {
  const fields = { trade: F('Landscaping', 0.9) };
  const r = await finalCheck(scripted({ audit: { audit: [{ fits: 0.05 }] }, rewrite: { field: F('Carpentry', 0.4) } }), demo, [['Concreter']], fields);
  assert.equal(r.revised, 0); assert.equal(r.doubts, 1); assert.equal(r.merged.trade.value, 'Landscaping'); assert.equal(r.tags[0].kind, 'doubt');
});

test('final check: a row built from several yes/no answers changes only the answers that differ', async () => {
  const fields = { extra_shot: F('no'), syrup: F('yes') };
  const call = scripted({ audit: { audit: [{ fits: 0.05 }] }, rewrite: { fields: { extra_shot: F('yes', 0.9), syrup: F('yes', 0.95) } } });
  const r = await finalCheck(call, { labels: ['Extras'], rowKeys: [['extra_shot', 'syrup']] }, [['Vanilla syrup']], fields);
  assert.equal(r.revised, 1); assert.equal(r.merged.extra_shot.value, 'yes'); assert.deepEqual(Object.keys(r.pins), ['extra_shot']);
});

test('final check: everything fits -> nothing changes; nothing on screen -> null', async () => {
  const fields = { trade: F('Fencing') };
  const r = await finalCheck(scripted({ audit: { audit: [{ fits: 0.95 }] } }), demo, [['Fencer']], fields);
  assert.equal(r.revised + r.doubts, 0);
  assert.equal(await finalCheck(async () => assert.fail('no audit when empty'), demo, [[null], ['None']], fields), null);
});
