// The "backend" of the demos: operational data (stock, calendars, CRM) and the quality log, kept in Netlify Blobs.
//   GET  /api/data?demo=coffee                    -> { data, store }   store: 'blobs' (real) or 'memory' (fallback)
//   POST /api/data { demo, effects, note }        -> { data }      apply effects (see demos/effects.mjs)
//   POST /api/data { demo, reset: true }          -> { data }      back to the starting data
//   GET  /api/log                                 -> { log }       what the final check caught
//   POST /api/log { clear: true }                 -> { log: [] }
import { getData, sendEffects, resetData, readLog, clearLog, hasData } from '../../server/ops.mjs';
import { store } from '../../server/store.mjs';
import { json, guard } from '../../server/http.mjs';

export default async (req, context) => {
  const refused = await guard(req, context, 'data');
  if (refused) return refused;
  const url = new URL(req.url);
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch {} }
  try {
    if (url.pathname === '/api/log') {
      if (req.method === 'POST' && body.clear) await clearLog();
      return json({ log: req.method === 'POST' && body.clear ? [] : await readLog() });
    }
    const demo = String((req.method === 'POST' ? body.demo : url.searchParams.get('demo')) || '');
    if (!hasData(demo)) return json({ error: 'unknown_demo' }, 400);
    const st = await store('demo-data');   // st.kind says whether this is real Blobs storage or the in-memory fallback
    if (req.method === 'GET') return json({ data: await getData(demo, st), store: st.kind });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    if (body.reset) return json({ data: await resetData(demo, st), store: st.kind });
    const r = await sendEffects(demo, body.effects, body.note, st);
    return json({ data: r.data, applied: r.applied, rejected: r.rejected, store: st.kind });
  } catch (e) { return json({ error: 'storage' }, 502); }
};

export const config = { path: ['/api/data', '/api/log'] };
