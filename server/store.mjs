// Key-value storage: Netlify Blobs when deployed (nothing to enable), in-memory anywhere else (tests, local).
// Same interface both ways: get(key) -> value|null, set(key, value), del(key).
const cache = new Map();   // one store object per name, per process

export const memoryStore = () => { const m = new Map(); return { kind: 'memory', async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : null; }, async set(k, v) { m.set(k, JSON.stringify(v)); }, async del(k) { m.delete(k); } }; };

export async function store(name) {
  if (cache.has(name)) return cache.get(name);
  let s = memoryStore();
  try {
    const { getStore } = await import('@netlify/blobs');
    const b = getStore({ name, consistency: 'strong' });
    await b.get('__probe');   // throws if Blobs is not configured here
    s = { kind: 'blobs', get: async (k) => (await b.get(k, { type: 'json' })) ?? null, set: (k, v) => b.setJSON(k, v), del: (k) => b.delete(k) };
  } catch (_) { /* no Blobs in this environment: stay in memory */ }
  cache.set(name, s);
  return s;
}
