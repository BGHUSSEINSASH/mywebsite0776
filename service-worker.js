/* service-worker.js — offline shell for the portfolio.
   strategy: app shell + assets are cached on install, html requests
   try the network first (so new posts/translations show up immediately)
   and fall back to the cache when the visitor is offline.            */

/* the versioned query strings have to match what the html asks for,
   or install-time caching stores one url and the page requests
   another and everything falls through to the network. */
var V = '?v=r26';
var CACHE = 'bgsash-v26';
var SHELL = [
  '/',
  '/index.html',
  '/404.html',
  '/privacy',
  '/terms',
  '/manifest.webmanifest',
  '/assets/css/style.css' + V,
  '/assets/css/fonts.css' + V,
  '/assets/css/spec.css' + V,
  '/assets/css/case.css' + V,
  '/assets/css/legal.css' + V,
  '/assets/js/theme.js' + V,
  '/assets/js/notfound.js' + V,
  '/assets/js/main.js' + V,
  '/assets/js/spec.js' + V,
  '/assets/js/case.js' + V,
  '/assets/js/tally.js' + V,
  '/assets/favicon.svg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  /* english travels with every page (say() ends there), arabic is the other
     language this site is written in — both are worth an install-time
     cache. the other ten arrive on first use and are stored then, by the
     asset rule at the bottom of this file. translations.json is gone from
     here: no page asks for the whole dictionary any more. */
  '/assets/i18n/en.json' + V,
  '/assets/i18n/ar.json' + V,
  '/assets/cv/CV-en.pdf',
  '/assets/cv/CV-ar.pdf',
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
  '/assets/shots/ziona-passports.webp',
  '/assets/shots/hala-sat.webp',
  '/assets/shots/og-cover.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function (c) { return Promise.all(SHOTS.map(function (s) { return c.add(s).catch(function () {}); })); })
      /* skipWaiting only on a first visit, where there is nothing to
         interrupt. on an update the new copy waits — taking over mid-read
         deletes the cache this page is still pulling images and language
         files out of, and its ?v= urls no longer exist on the server. the
         page offers a reload instead and the reader decides. */
      .then(function () {
        if (!self.registration || !self.registration.active) return self.skipWaiting();
      })
  );
});

self.addEventListener('message', function (e) {
  // the only thing that activates a waiting copy is the visitor clicking it
  if (e.data && e.data.type === 'sash:apply') self.skipWaiting();
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
  if (url.origin !== location.origin) return;      // cdnjs + turnstile: the browser handles them

  // the admin desk is never stored offline: it is not part of the public
  // site and its html would sit in a cache anyone with the machine can read
  if (/^\/admin(\.html)?$/.test(url.pathname)) return;

  // navigations: network first, cache fallback → always the freshest page online
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          // stored under its own url: caching every page as index.html
          // made an offline /work/x answer with the homepage
          caches.open(CACHE).then(function (c) { c.put(url.pathname, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(url.pathname).then(function (hit) {
          return hit || caches.match('/') || caches.match('/404.html');
        });
      })
    );
    return;
  }

  // assets: cache first (they're versioned with ?v=), network otherwise
  // the woff2 ride along here rather than in SHELL: a visitor downloads the
  // subsets their language renders, and an offline return visit gets those
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
