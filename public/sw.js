// GRT Faculty Register - service worker.
// Makes the app installable everywhere and lets it open with NO internet after the first visit.
// Teacher data is NOT stored here (it lives in the browser's IndexedDB) - this only caches the app files.
// The build id below is stamped at build time, so every new deployment refreshes the cache by itself.
const BUILD = '__BUILD_ID__';
const CACHE = 'grt-faculty-' + BUILD;
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png', '/logo.png', '/logo-full.png', '/otc-logo.png', '/background.jpg',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let list = [];
    try { const r = await fetch('/precache.json', { cache: 'no-store' }); if (r.ok) list = (await r.json()).files || []; } catch { /* dev / offline */ }
    // one by one, so a single missing file never blocks the install
    await Promise.all([...SHELL, ...list].map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('grt-faculty-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                       // fonts etc. -> browser default
  if (url.pathname === '/sw.js' || url.pathname === '/precache.json' || url.pathname.startsWith('/downloads/')) return;
  if (req.headers.has('range')) return;                                  // audio / video seeking -> browser default

  // Opening a page: always try the network first (newest version), fall back to the saved copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) { const c = await caches.open(CACHE); c.put('/index.html', res.clone()); }
        return res;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Everything else (scripts, pictures, sounds): saved copy first, refreshed quietly in the background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const fresh = fetch(req).then((res) => { if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { event.waitUntil(fresh); return hit; }
    return (await fresh) || Response.error();
  })());
});
