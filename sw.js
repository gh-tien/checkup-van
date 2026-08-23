/* Offline shell for Fleet Spot-Check.
   A depot with no signal is the normal case here, not the edge case — so the
   app shell is precached and served cache-first, and fonts are cached as they
   arrive so a second launch works with the radio off. */

const VERSION = 'v34';
const SHELL = 'spotcheck-shell-' + VERSION;
const FONTS = 'spotcheck-fonts-' + VERSION;

const SHELL_FILES = [
  '.',
  'index.html',
  'app.css',
  'store.js',
  'photos.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll is all-or-nothing; add individually so one 404 can't leave the
      // app with no offline shell at all.
      .then(cache => Promise.all(SHELL_FILES.map(f => cache.add(f).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== FONTS).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

const isFont = url =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Fonts: serve from cache, refresh in the background.
  if (isFont(url)) {
    event.respondWith(
      caches.open(FONTS).then(cache =>
        cache.match(req).then(hit => {
          const net = fetch(req)
            .then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })
            .catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navigations: always land on the app shell, online or not.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('index.html').then(hit => hit || caches.match('.')))
    );
    return;
  }

  // Same-origin assets: cache-first, then network, caching what comes back.
  event.respondWith(
    caches.match(req).then(hit =>
      hit || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then(cache => cache.put(req, copy));
        }
        return res;
      })
    )
  );
});
