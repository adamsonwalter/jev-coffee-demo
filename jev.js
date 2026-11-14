// The Jev client: one network call, plus the two "second look" passes that run after someone pauses or stops talking.
// No DOM in here, so it can be tested in plain Node (tests/jev.test.mjs).
import { TUNING as T } from './demos/lib.mjs';

export class Stale extends Error {}   // thrown by the caller's `call` when newer speech has arrived

export async function post(body, signal) {
  const r = await fetch('/api/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!r.ok) throw new Error('status ' + r.status);
  return r.json();
}

// Settling pass: re-ask only the fields Jev was unsure of, on the whole conversation. null if nothing was unsure.
export async function settle(call, fields) {
  const keys = Object.keys(fields).filter((k) => fields[k].confidence != null && fields[k].confidence < T.settle);
  if (!keys.length) return null;
  const d = await call({ final: true, only: keys });
  const merged = { ...fields };
  keys.forEach((k) => { if (d.fields && d.fields[k]) merged[k] = d.fields[k]; });
  return { merged, count: keys.length };
}

// Final check: audit each on-screen row against the transcript; rewrite the rows that clearly don't fit.
// rows = demo.render() rows: [[text, unsure?], ...]. Returns { merged, tags, pins, revised, doubts } or null if nothing to audit.
export async function finalCheck(call, demo, rows, fields) {
  const shown = [];
  rows.forEach((r, i) => { const value = r && r[0]; if (value && value !== 'None' && value !== '—') shown.push({ i, label: demo.labels[i], value }); });
  if (!shown.length) return null;
  const a = await call({ mode: 'audit', shown: shown.map(({ label, value }) => ({ label, value })) });
  const tags = {}, pins = {}, merged = { ...fields };
  let revised = 0, doubts = 0;
  for (let j = 0; j < shown.length; j++) {
    const au = a.audit && a.audit[j];
    if (!au || au.fits >= T.auditMismatch) continue;               // only clear mismatches
    const { i, value } = shown[j];
    const changes = (demo.rowKeys || [])[i] ? await rewrite(call, demo.rowKeys[i], fields, value) : null;
    if (changes) { Object.assign(merged, changes); Object.assign(pins, changes); tags[i] = { kind: 'revised', was: value }; revised++; }
    else { tags[i] = { kind: 'doubt' }; doubts++; }                 // flagged, but not safe to change
  }
  return { merged, tags, pins, revised, doubts };
}

// A row backed by one choice: re-ask with the old answer off the menu. By several yes/no answers: re-ask them all.
// Returns { key: newAnswer } for what should change, or null.
async function rewrite(call, rowKey, fields, shown) {
  if (Array.isArray(rowKey)) {
    const keys = rowKey.filter((k) => fields[k]);
    if (!keys.length) return null;
    const w = await call({ mode: 'rewrite', keys, shown });
    const out = {};
    keys.forEach((k) => { const nf = w.fields && w.fields[k]; if (nf && nf.value && nf.confidence != null && nf.confidence >= T.adopt && nf.value !== fields[k].value) out[k] = nf; });
    return Object.keys(out).length ? out : null;
  }
  if (!fields[rowKey]) return null;
  const nf = (await call({ mode: 'rewrite', key: rowKey, exclude: fields[rowKey].value })).field;
  return nf && nf.value && nf.value !== 'NoFit' && nf.confidence != null && nf.confidence >= T.adopt ? { [rowKey]: nf } : null;
}
