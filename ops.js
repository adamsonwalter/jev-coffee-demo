// The browser's view of each demo's operational data (stock, calendars, CRM). Served by /api/data (Netlify Blobs).
// If the server can't be reached the demo carries on with local data, so the voice side never stops working.
import { DEMOS } from './demos/index.mjs';
import { applyEffects } from './demos/effects.mjs';

const cache = {};                                   // demo id -> data
export let storeKind = '';                          // 'blobs' (saved on Netlify) or 'memory' (resets); '' until known
const start = (id) => JSON.parse(JSON.stringify(DEMOS.find((d) => d.id === id).data));
export const data = (id) => cache[id] || (cache[id] = start(id));   // never null

async function call(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  if (!r.ok) throw new Error('status ' + r.status);
  return r.json();
}
// Fetch the latest. Resolves true if it changed.
export async function load(id) {
  try { const j = await call('/api/data?demo=' + id), changed = JSON.stringify(cache[id]) !== JSON.stringify(j.data); cache[id] = j.data; return changed; } catch { return false; }
}
// Apply effects (a confirmed order, a stock tap). Falls back to local data if the server is unreachable.
export async function send(id, effects, note) {
  try { cache[id] = (await call('/api/data', { demo: id, effects, note })).data; } catch { cache[id] = applyEffects(data(id), effects, note).data; }
  return cache[id];
}
// Apply a scenario (a pitch situation). Returns the phrase to say next. Offline: runs locally, same result.
export async function scenario(id, sid) {
  const sc = DEMOS.find((d) => d.id === id).scenarios.find((x) => x.id === sid);
  try { const j = await call('/api/data', { demo: id, scenario: sid }); cache[id] = j.data; } catch { const base = start(id); cache[id] = applyEffects(base, sc.effects(base), 'Scenario: ' + sc.name, 400).data; }
  return sc.say;
}
export async function reset(id) {
  try { cache[id] = (await call('/api/data', { demo: id, reset: true })).data; } catch { cache[id] = start(id); }
  return cache[id];
}
export const loadLog = () => call('/api/log').then((j) => j.log).catch(() => []);
export const clearLog = () => call('/api/log', { clear: true }).then((j) => j.log).catch(() => []);
