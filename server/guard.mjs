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

// Count one call. Returns { ok:true } or { ok:false, error, retryAfter }.
// Per-minute counts live in this function instance's memory, so a live read never waits on storage. The daily cap is kept in
// storage but only written every FLUSH calls. Both are approximate by design: enough to protect the budget, no locking.
const FLUSH = 20;
const minutes = new Map();   // 'jev:1.2.3.4' -> { m: minute number, n: calls }
let day = null;              // { key: 'day:2026-11-15', n: calls so far, unsaved }

export async function allow(ip, kind, now = Date.now(), st) {
  const perMin = kind === 'jev' ? LIMITS.jevPerMin : LIMITS.dataPerMin, m = Math.floor(now / 60000), id = `${kind}:${ip}`;
  let rec = minutes.get(id);
  if (!rec || rec.m !== m) { if (minutes.size > 5000) minutes.clear(); minutes.set(id, (rec = { m, n: 0 })); }
  if (++rec.n > perMin) return { ok: false, error: 'rate_limited', retryAfter: 60 - Math.floor((now % 60000) / 1000) };
  if (kind !== 'jev') return { ok: true };
  const key = `day:${new Date(now).toISOString().slice(0, 10)}`;
  if (!day || day.key !== key) { st = st || (await store('limits')); day = { key, n: ((await st.get(key)) || { n: 0 }).n, unsaved: 0 }; }
  if (++day.n > LIMITS.jevPerDay) return { ok: false, error: 'daily_limit', retryAfter: 3600 };
  if (++day.unsaved >= FLUSH) {   // add this instance's calls to the shared total (other instances add theirs)
    st = st || (await store('limits'));
    day.n = Math.max(day.n, ((await st.get(key)) || { n: 0 }).n + day.unsaved); day.unsaved = 0;
    await st.set(key, { n: day.n });
  }
  return { ok: true };
}
