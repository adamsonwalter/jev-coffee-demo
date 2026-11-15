// Makes the home-screen icon open fast and keeps the page usable on a bad connection.
// Network first (always revalidating, never a stale copy from the browser's own cache), falling back to whatever was last loaded.
// The cache is named after /version.json, read here at run time: when the version changes, every older cache is deleted,
// so an old page can't meet new scripts. No file list to maintain; /api and /media are never touched (video needs byte ranges).
let cacheName = null;

async function cacheFor(fresh) {   // the cache for the deployed version; fresh = ask the server again (done on every navigation)
  if (!fresh && cacheName) return caches.open(cacheName);
  try {
    const j = await (await fetch('/version.json', { cache: 'no-store' })).json();
    const name = 'jev-demo-v' + j.version;
    if (name !== cacheName) { cacheName = name; (await caches.keys()).filter((k) => k !== name).forEach((k) => caches.delete(k)); }
  } catch (_) {
    if (!cacheName) cacheName = (await caches.keys()).find((k) => k.startsWith('jev-demo-v')) || 'jev-demo-offline';   // offline: keep using what we have
  }
  return caches.open(cacheName);
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(cacheFor(true).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/media/')) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((r) => { if (r.ok) { const copy = r.clone(); cacheFor(e.request.mode === 'navigate').then((c) => c.put(e.request, copy)); } return r; })
      .catch(() => cacheFor(false).then((c) => c.match(e.request).then((m) => m || c.match('/'))))
  );
});
