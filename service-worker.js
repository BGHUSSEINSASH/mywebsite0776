/* service-worker.js — offline shell for the portfolio.
   strategy: app shell + assets are cached on install, html requests
   try the network first (so new posts/translations show up immediately)
   and fall back to the cache when the visitor is offline.            */

var CACHE = 'bgsash-v9';
var SHELL = [
  '/',
  '/index.html',
  '/404.html',
  '/manifest.webmanifest',
  '/assets/css/style.css',
  '/assets/js/main.js',
  '/assets/favicon.svg',
  '/assets/i18n/translations.json',
  '/assets/cv/CV-en.pdf',
  '/assets/cv/CV-ar.pdf'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== location.origin) return;      // cdn / fonts: let the browser handle them

  // navigations: network first, cache fallback → always the freshest page online
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('/index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('/index.html').then(function (hit) { return hit || caches.match('/404.html'); });
      })
    );
    return;
  }

  // assets: cache first (they're versioned with ?v=), network otherwise
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
