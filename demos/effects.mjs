// "Effects" are the only way operational data changes: a demo's render() proposes them (confirm an order, book a slot),
// the backend screen sends them (+1 stock, free a slot), and the server applies them here. Pure, no storage, no browser.
//   { op: 'add', path: 'stock.Oat', by: -1 }                  change a number (never below 0)
//   { op: 'set', path: 'slots.s012.status', value: 'booked' }  change an existing value
//   { op: 'put', path: 'deals', id: 'northwind', value: {…} } add or replace a record in a keyed collection
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_NUM = 99999, MAX_STR = 120, MAX_RECORDS = 60, KEEP_ACTIVITY = 25;

const parts = (p) => { const a = String(p || '').split('.'); return a.length && a.length <= 4 && a.every((s) => s && s.length <= 40 && !BAD.has(s)) ? a : null; };
const walk = (obj, keys) => keys.reduce((o, k) => (o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined), obj);
const clean = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-MAX_NUM, Math.min(MAX_NUM, v)) : typeof v === 'boolean' ? v : typeof v === 'string' ? v.slice(0, MAX_STR) : v === null ? null : undefined);

// Returns { data, applied, rejected } and never mutates the input.
export function applyEffects(data, effects, note) {
  const next = JSON.parse(JSON.stringify(data || {})), applied = [], rejected = [];
  for (const e of (Array.isArray(effects) ? effects : []).slice(0, 30)) {
    const keys = parts(e && e.path);
    if (!keys) { rejected.push(e); continue; }
    const parent = walk(next, keys.slice(0, -1)), last = keys[keys.length - 1];
    if (e.op === 'add') {
      const cur = parent && typeof parent === 'object' ? parent[last] : undefined;
      if (typeof cur !== 'number' || typeof e.by !== 'number' || !Number.isFinite(e.by)) { rejected.push(e); continue; }
      parent[last] = Math.max(0, Math.min(MAX_NUM, cur + e.by)); applied.push(e);
    } else if (e.op === 'set') {
      const v = clean(e.value);
      if (!parent || typeof parent !== 'object' || !(last in parent) || v === undefined || (typeof parent[last] === 'object' && parent[last] !== null)) { rejected.push(e); continue; }
      parent[last] = v; applied.push(e);
    } else if (e.op === 'put') {
      const coll = walk(next, keys), id = String(e.id || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      if (!coll || typeof coll !== 'object' || Array.isArray(coll) || !Object.values(coll).every((x) => x && typeof x === 'object') || !id || BAD.has(id) || !e.value || typeof e.value !== 'object' || (!(id in coll) && Object.keys(coll).length >= MAX_RECORDS)) { rejected.push(e); continue; }
      const rec = {}; for (const [k, v] of Object.entries(e.value)) { const c = clean(v); if (c !== undefined && !BAD.has(k) && k.length <= 40) rec[k] = c; }
      coll[id] = rec; applied.push(e);
    } else rejected.push(e);
  }
  if (note && applied.length) next.activity = [{ t: Date.now(), note: String(note).slice(0, MAX_STR) }, ...(Array.isArray(next.activity) ? next.activity : [])].slice(0, KEEP_ACTIVITY);
  return { data: next, applied, rejected };
}
