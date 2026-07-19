// SuryaSetu service worker — offline caching + background sync queue.
// Registered from main.tsx. Minimal: caches the app shell and replays queued POSTs.

const CACHE = 'suryasetu-v1';
const SHELL = ['/'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('sync', (e) => {
  if (e.tag === 'suryasetu-sync') {
    e.waitUntil(self.clients.matchAll().then((clients) => clients.forEach((c) => c.postMessage({ type: 'sync' }))));
  }
});
