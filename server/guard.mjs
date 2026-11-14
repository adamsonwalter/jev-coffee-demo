// Protects the budget: only our own pages may call, each visitor gets a rate limit, and Jev has a daily cap.
import { store } from './store.mjs';

export const LIMITS = { jevPerMin: Number(process.env.JEV_PER_MIN) || 150, dataPerMin: 300, jevPerDay: Number(process.env.JEV_DAILY_LIMIT) || 30000 };

export const clientIp = (req, context) => (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

// true if this host is allowed to call us (requests with no Origin header, like curl and tests, pass)
export function originOk(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

// Count one call. Returns { ok:true } or { ok:false, error, retryAfter }. Approximate by design (no locking).
export async function allow(ip, kind, now = Date.now(), st) {
  st = st || (await store('limits'));
  const perMin = kind === 'jev' ? LIMITS.jevPerMin : LIMITS.dataPerMin, minute = Math.floor(now / 60000);
  const key = `ip:${kind}:${ip}`, rec = (await st.get(key)) || { m: minute, n: 0 };
  if (rec.m !== minute) { rec.m = minute; rec.n = 0; }
  if (++rec.n > perMin) return { ok: false, error: 'rate_limited', retryAfter: 60 - Math.floor((now % 60000) / 1000) };
  await st.set(key, rec);
  if (kind === 'jev') {
    const day = `day:${new Date(now).toISOString().slice(0, 10)}`, d = (await st.get(day)) || { n: 0 };
    if (++d.n > LIMITS.jevPerDay) return { ok: false, error: 'daily_limit', retryAfter: 3600 };
    await st.set(day, d);
  }
  return { ok: true };
}
