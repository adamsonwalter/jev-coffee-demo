// Retired. The app needs the network to do anything (speech and Jev), so a cache only ever caused stale copies.
// This stub replaces the old worker on phones that still have it: it deletes the old caches and removes itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
})()));
