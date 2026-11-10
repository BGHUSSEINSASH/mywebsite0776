/* case.js — language + theme for the standalone case-study pages.
   same translation file as the homepage, far less machinery: no loader,
   no scroll animations — just the words, the direction and the clock. */

(function () {
  'use strict';

  var doc = document;
  var html = doc.documentElement;
  var qa = function (sel) { return Array.prototype.slice.call(doc.querySelectorAll(sel)); };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var words = {};
  var lang = 'en';
  var flipped = ['ar', 'ku'];

  function dig(node, path) {
    if (!node) return null;
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (node == null) return null;
      if (Array.isArray(node)) {
        var n = parseInt(parts[i], 10);
        node = isFinite(n) ? node[n - 1] : null;
      } else node = node[parts[i]];
    }
    return node === undefined ? null : node;
  }

  function say(key, fallback) {
    var v = dig(words[lang], key);
    if (typeof v === 'string' && v) return v;
    v = dig(words.en, key);
    if (typeof v === 'string' && v) return v;
    return fallback === undefined ? null : fallback;
  }

  var aliases = { ckb: 'ku', kmr: 'ku', 'zh-cn': 'zh', 'zh-tw': 'zh', 'fa': 'ar', 'ur': 'ar' };

  /* the <select> is the list of languages this page can actually show.
     testing the fetched dictionary instead would make pick() answer 'en'
     on a cold page, before any file has arrived. */
  var carrying = null;
  function carried() {
    if (!carrying) {
      var sel = doc.querySelector('#langSelect');
      var list = sel ? Array.prototype.slice.call(sel.querySelectorAll('option')).map(function (o) { return o.value; }) : [];
      carrying = list.length ? list : ['en'];
    }
    return carrying;
  }
  function carries(code) { return carried().indexOf(code) > -1; }

  function loadLanguage(code) {
    if (words[code]) return Promise.resolve(words[code]);
    // root-absolute: a case page lives at /work/<name>, where a relative url
    // would ask for /work/assets/... and get a 404
    return fetch('/assets/i18n/' + code + '.json?v=r27')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function (e) { console.warn('translation file missing:', code, e); return {}; })
      .then(function (tree) { words[code] = tree || {}; return words[code]; });
  }

  /* english is the fallback inside say(), so it always has to be present */
  function loadLanguages(code) {
    return loadLanguage('en').then(function () {
      return code === 'en' ? null : loadLanguage(code);
    });
  }

  /* uppercase turkish turns i into İ, which is right for türk words and
     wrong inside a name — the case titles are full of names. the list in
     main.js is the long version; this one carries what a case page says. */
  var LATIN = ('Hussein Sash SmartMaid Mukallaf Flossk Bookly Ziona Hala Sat MikroTik Cisco CCNA ' +
    'Windows Linux Ubuntu JavaScript TypeScript Flutter Dart React Node.js MySQL PHP Laravel Docker ' +
    'GitHub Firebase Figma Hosting TCP/IP'
    ).split(' ').filter(Boolean).sort(function (a, b) { return b.length - a.length; });

  var latinRe = null;
  function paint(el, val) {
    el.textContent = val;
    if (lang !== 'tr') return;
    if (!latinRe) latinRe = new RegExp('\\b(' + LATIN.join('|').replace(/\./g, '\\.') + ')\\b', 'gi');
    latinRe.lastIndex = 0;
    if (!latinRe.test(val)) return;
    el.textContent = '';
    val.split(latinRe).forEach(function (chunk, i) {
      if (!chunk) return;
      if (i % 2 === 1) {
        var s = doc.createElement('span');
        s.setAttribute('lang', 'en');
        s.textContent = chunk;
        el.appendChild(s);
      } else el.appendChild(doc.createTextNode(chunk));
    });
  }

  window.sashPaint = paint;   // same hook main.js exposes

  function pick() {
    var fromUrl = '';
    try { fromUrl = (new URLSearchParams(location.search).get('lang') || '').toLowerCase(); } catch (e) {}
    var saved = null;
    try { saved = localStorage.getItem('lang'); } catch (e) {}
    var browser = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase();
    var base = (fromUrl || saved || browser).split('-')[0];
    var candidates = [fromUrl, saved, browser, base];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c && carries(c)) return c;
      if (c && carries(c.split('-')[0])) return c.split('-')[0];
      if (c && aliases[c] && carries(aliases[c])) return aliases[c];
      if (c && aliases[c.split('-')[0]] && carries(aliases[c.split('-')[0]])) return aliases[c.split('-')[0]];
    }
    return 'en';
  }

  function speak(code) {
    if (!carries(code)) code = 'en';
    lang = code;
    try { localStorage.setItem('lang', code); } catch (e) {}

    var rtl = flipped.indexOf(code) > -1;
    html.lang = code;
    html.dir = rtl ? 'rtl' : 'ltr';

    // the case pages declare twelve hreflang alternates on ?lang= urls, and
    // google only trusts an alternate whose canonical points back at itself
    if (/[?&]lang=/i.test(location.search)) {
      var self = location.origin + location.pathname + '?lang=' + code;
      var canon = doc.querySelector('link[rel="canonical"]');
      if (canon) canon.href = self;
      var ogu = doc.querySelector('meta[property="og:url"]');
      if (ogu) ogu.content = self;
    }

    qa('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = say(key, null);
      if (typeof val !== 'string') return;
      paint(el, val);
      // same rule as the main page: a string identical to english is a
      // name, not a phrase — keep turkish casing rules away from it
      var base = dig(words.en, key);
      if (typeof base === 'string' && base === val) el.setAttribute('lang', 'en');
      else el.removeAttribute('lang');
    });

    qa('[data-i18n-aria]').forEach(function (el) {
      var v = say(el.getAttribute('data-i18n-aria'), null);
      if (typeof v === 'string' && v) el.setAttribute('aria-label', v);
    });

    qa('[data-alt]').forEach(function (img) {
      var name = say(img.getAttribute('data-alt'), null);
      var what = say(img.getAttribute('data-alt-key') || 'alt.shot');
      if (typeof name === 'string' && name && what) img.alt = name + ' — ' + what;
    });

    qa('[data-i18n-title]').forEach(function (el) {
      var v = say(el.getAttribute('data-i18n-title'), null);
      if (typeof v === 'string' && v) el.setAttribute('title', v);
    });

    // the stack line in the facts table is the chips a few rows above it,
    // already translated — repeating the english here would undo that work
    var stackCell = doc.querySelector('[data-facts-stack]');
    if (stackCell) {
      var chips = qa('.cs-chips li').map(function (li) { return li.textContent.trim(); }).filter(Boolean);
      if (chips.length) paint(stackCell, chips.join(' · '));
    }

    // the tab title follows the page: the project name the h1 is wearing,
    // not the site-wide title, which would erase which case you are on
    var h1 = doc.querySelector('.cs-title[data-i18n]');
    var name = h1 ? say(h1.getAttribute('data-i18n'), null) : null;
    if (name) doc.title = name + ' — ' + (say('case.intro') || 'Case study') + ' · BG Hussein Sash';
    // the legal pages have no project to name, so their own h1 is the title
    var plain = doc.querySelector('[data-page-title][data-i18n]');
    if (!name && plain) {
      var t = say(plain.getAttribute('data-i18n'), null);
      if (t) doc.title = t + ' · BG Hussein Sash';
    }

    var sel = doc.querySelector('#langSelect');
    if (sel && sel.value !== code) sel.value = code;
  }

  function wireTheme() {
    var btn = doc.querySelector('#themeBtn');
    var meta = doc.querySelector('meta[name="theme-color"]');
    function sync() {
      if (meta) meta.setAttribute('content', html.dataset.theme === 'light' ? '#e9e6dd' : '#0e0f11');
    }
    if (!btn) return;
    btn.addEventListener('click', function () {
      var run = function () {
        html.dataset.theme = (html.dataset.theme || 'dark') === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('theme', html.dataset.theme); } catch (e) {}
        sync();
      };
      if (doc.startViewTransition && !calm) doc.startViewTransition(run);
      else run();
    });
    sync();
  }

  function start() {
    wireTheme();
    var sel = doc.querySelector('#langSelect');
    var wanted = pick();
    loadLanguages(wanted).then(function () {
      speak(wanted);
      if (sel) sel.addEventListener('change', function () {
        // a reader can pick a language this page has never fetched
        var code = sel.value;
        loadLanguage(code).then(function () {
          var run = function () { speak(code); };
          if (doc.startViewTransition && !calm) doc.startViewTransition(run);
          else run();
        });
      });
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})();
