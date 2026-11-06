/* service-worker.js — offline shell for the portfolio.
   strategy: app shell + assets are cached on install, html requests
   try the network first (so new posts/translations show up immediately)
   and fall back to the cache when the visitor is offline.            */

/* the versioned query strings have to match what the html asks for,
   or install-time caching stores one url and the page requests
   another and everything falls through to the network. */
var V = '?v=r20';
var CACHE = 'bgsash-v20';
var SHELL = [
  '/',
  '/index.html',
  '/404.html',
  '/manifest.webmanifest',
  '/assets/css/style.css' + V,
  '/assets/css/spec.css' + V,
  '/assets/css/case.css' + V,
  '/assets/js/main.js' + V,
  '/assets/js/spec.js' + V,
  '/assets/js/case.js' + V,
  '/assets/favicon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/i18n/translations.json' + V,
  '/work/smartmaid',
  '/work/mukallaf',
  '/work/flossk',
  '/work/bookly',
  '/work/ziona-passports',
  '/work/hala-sat'
];

// screenshots are big: cached on demand, never blocking an install
var SHOTS = [
  '/assets/shots/smartmaid.webp',
  '/assets/shots/mukallaf.webp',
  '/assets/shots/flossk.webp',
  '/assets/shots/bookly.webp',
  '/assets/shots/og-cover.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function (c) { return Promise.all(SHOTS.map(function (s) { return c.add(s).catch(function () {}); })); })
      .then(function () { return self.skipWaiting(); })
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
