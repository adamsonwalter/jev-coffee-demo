// POST /api/order: the browser's only door to Jev. HTTP concerns only; the work is in server/modes.mjs.
import { run } from '../../server/modes.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!process.env.ABCDJEV_MCP_URL) return json({ error: 'no_gateway' }, 503);
  // Only our own pages may call this (it spends Jev budget). Requests with no Origin header (curl, tests) pass.
  const origin = req.headers.get('origin');
  try { if (origin && new URL(origin).host !== new URL(req.url).host) return json({ error: 'forbidden' }, 403); } catch { return json({ error: 'forbidden' }, 403); }
  let body = {};
  try { body = await req.json(); } catch {}
  const r = await run(body);
  return json(r.body, r.status);
};

export const config = { path: '/api/order' };
