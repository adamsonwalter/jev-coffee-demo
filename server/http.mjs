// Shared HTTP bits for the functions: JSON responses and the guard (origin, rate limit, daily cap).
import { originOk, allow, clientIp } from './guard.mjs';

export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

// Returns a Response to send back if the request must be refused, else null. kind: 'jev' | 'data'.
export async function guard(req, context, kind) {
  if (!originOk(req)) return json({ error: 'forbidden' }, 403);
  try {
    const r = await allow(clientIp(req, context), kind);
    if (!r.ok) return json({ error: r.error }, 429, { 'retry-after': String(r.retryAfter) });
  } catch (_) { /* if the limiter itself fails, let the request through rather than break the demo */ }
  return null;
}
