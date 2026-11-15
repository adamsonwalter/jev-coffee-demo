// Makes the home-screen icon open fast and keeps the page usable on a bad connection.
// Network first (always revalidating, never a stale copy from the browser's own cache), falling back to whatever was last loaded.
// The cache is named for the version: every release starts clean and deletes older caches, so an old page can't meet new scripts.
// No file list to maintain; /api and /media are never touched (video needs byte ranges).
const CACHE = 'jev-demo-v3.2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/media/')) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
      .catch(() => caches.open(CACHE).then((c) => c.match(e.request)).then((m) => m || caches.open(CACHE).then((c) => c.match('/'))))
  );
});
