// POST /api/order: the browser's only door to Jev. HTTP concerns only; the work is in server/modes.mjs.
import { run } from '../../server/modes.mjs';
import { json, guard } from '../../server/http.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!process.env.ABCDJEV_MCP_URL) return json({ error: 'no_gateway' }, 503);
  const refused = await guard(req, context, 'jev');
  if (refused) return refused;
  let body = {};
  try { body = await req.json(); } catch {}
  const r = await run(body || {});
  return json(r.body, r.status);
};

export const config = { path: '/api/order' };
