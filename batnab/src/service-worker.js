// Lets the site be installed as an app and open without a connection. Built into /sw.js by vite.config.ts, which
// fills in VERSION from the build's file names so each deploy gets a fresh cache.
const VERSION = '__VERSION__';
// The page, new with each version.
const CACHE = `batnab-${VERSION}`;
// The built files (code, styles, fonts): named by their content, so one that didn't change between two versions is the
// same file. Kept across versions while the new one still uses it, so a deploy downloads only what changed (React,
// Firebase and the fonts, a few hundred KB, stay); the rest is let go.
const FILES = 'batnab-files';
const CURRENT = new Set(JSON.parse('__FILES__'));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const files = await caches.open(FILES);
      for (const k of await caches.keys()) {
        if (!k.startsWith('batnab-') || k === CACHE || k === FILES) continue;
        // A cache of an older version (from before the files were kept apart): what this one still uses moves over.
        const old = await caches.open(k);
        for (const req of await old.keys())
          if (CURRENT.has(new URL(req.url).pathname)) {
            const hit = await old.match(req);
            if (hit) await files.put(req, hit);
          }
        await caches.delete(k);
      }
      for (const req of await files.keys()) if (!CURRENT.has(new URL(req.url).pathname)) await files.delete(req);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Firebase, fonts and anything else from other sites go straight to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Pages: always the latest from the network; the saved copy only when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    // Built files carry a content hash in their name, so a saved copy never goes stale.
    event.respondWith(
      caches.match(request, {cacheName: FILES}).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            // A file from an older version is gone and the server answers with the page instead: never keep that.
            if (response.ok && !(response.headers.get('content-type') || '').includes('text/html')) {
              const copy = response.clone();
              caches.open(FILES).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

// A notification tapped (lib/notifications.ts): to the site, on the page it is about.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = event.notification.data?.href || '/';
  event.waitUntil(
    self.clients.matchAll({type: 'window'}).then((list) => {
      // An open page goes there itself (the site's own navigation: nothing unsaved lost); otherwise a new window.
      const open = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(href);
      open.postMessage({type: 'batnab-open', href});
      return open.focus().catch(() => {});
    }),
  );
});
