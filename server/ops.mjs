// Operational data (stock, calendars, CRM) and the quality log. Storage is injected so tests can use memory.
import { DEMOS } from '../demos/index.mjs';
import { applyEffects } from '../demos/effects.mjs';
import { store } from './store.mjs';

const byId = Object.fromEntries(DEMOS.map((d) => [d.id, d]));
const fresh = (id) => JSON.parse(JSON.stringify(byId[id].data || {}));
export const hasData = (id) => !!(byId[id] && byId[id].data);

export async function getData(id, st) {
  st = st || (await store('demo-data'));
  return (await st.get(id)) || fresh(id);
}
export async function sendEffects(id, effects, note, st) {
  st = st || (await store('demo-data'));
  const r = applyEffects(await getData(id, st), effects, note);
  if (r.applied.length) await st.set(id, r.data);
  return { data: r.data, applied: r.applied.length, rejected: r.rejected.length };
}
// A scenario starts from the clean data, then applies the demo's changes (a pitch situation in one tap).
export async function applyScenario(id, scenarioId, st) {
  const sc = ((byId[id] && byId[id].scenarios) || []).find((x) => x.id === scenarioId);
  if (!sc) return null;
  st = st || (await store('demo-data'));
  const base = fresh(id), r = applyEffects(base, sc.effects(base), 'Scenario: ' + sc.name, 400);
  await st.set(id, r.data);
  return { data: r.data, applied: r.applied.length, rejected: r.rejected.length, say: sc.say };
}
export async function resetData(id, st) {
  st = st || (await store('demo-data'));
  await st.del(id);
  return fresh(id);
}

// Quality log: what the final check caught (menu gaps, mishearings). Newest first, capped.
const LOG_MAX = 200;
export async function logEvent(ev, st) {
  st = st || (await store('quality-log'));
  const log = (await st.get('log')) || [];
  log.unshift({ t: Date.now(), ...ev });
  await st.set('log', log.slice(0, LOG_MAX));
}
export async function readLog(st) { return ((st || (await store('quality-log'))).get('log')).then((l) => l || []); }
export async function clearLog(st) { await (st || (await store('quality-log'))).del('log'); }
