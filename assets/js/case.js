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
      if (c && words[c]) return c;
      if (c && words[c.split('-')[0]]) return c.split('-')[0];
      if (c && aliases[c]) return aliases[c];
      if (c && aliases[c.split('-')[0]]) return aliases[c.split('-')[0]];
    }
    return 'en';
  }

  function speak(code) {
    if (!code || !words[code]) code = 'en';
    lang = code;
    try { localStorage.setItem('lang', code); } catch (e) {}

    var rtl = flipped.indexOf(code) > -1;
    html.lang = code;
    html.dir = rtl ? 'rtl' : 'ltr';

    qa('[data-i18n]').forEach(function (el) {
      var val = say(el.getAttribute('data-i18n'), null);
      if (typeof val === 'string') el.textContent = val;
    });

    var title = say('meta.title');
    if (title) doc.title = doc.title;   // page titles are per-project; leave them

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
    fetch('/assets/i18n/translations.json?v=r09b')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        words = json;
        speak(pick());
        var sel = doc.querySelector('#langSelect');
        if (sel) sel.addEventListener('change', function () {
          var run = function () { speak(sel.value); };
          if (doc.startViewTransition && !calm) doc.startViewTransition(run);
          else run();
        });
      })
      .catch(function () { /* english markup is already in the page */ });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})();
