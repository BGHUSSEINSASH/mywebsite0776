/* the 404 has to speak the visitor's language too — same json, same
   rules as the rest of the site, nothing more than a text swap.
   this file used to be inline in 404.html so the policy could stop
   allowing inline scripts. */
(function () {
  'use strict';
  var doc = document, html = doc.documentElement;
  var flipped = ['ar', 'ku'];
  var words = {}, lang = 'en';

  function dig(node, key) {
    var cur = node;
    String(key).split('.').forEach(function (p) {
      cur = (cur && typeof cur === 'object') ? cur[p] : null;
    });
    return typeof cur === 'string' ? cur : null;
  }

  function say(key) {
    var v = dig(words[lang] || {}, key);
    if (v && v.trim()) return v;
    v = dig(words.en || {}, key);
    return typeof v === 'string' ? v : null;
  }

  /* uppercase turkish turns the i of a latin name into İ — the mark line
     carries the name, so there the names get their own span. mirrors the
     splitter in main.js, kept short because this page has one string. */
  var NAMES = ('Hussein Sash SmartMaid Mukallaf Flossk Bookly Ziona Hala Sat GitHub Firebase ' +
    'Windows Linux MikroTik Cisco CCNA CCTV Flutter Docker JavaScript').split(' ').filter(Boolean);
  var latinRe = null;

  function paint(el, val) {
    el.textContent = val;
    if (lang !== 'tr') return;
    if (!latinRe) latinRe = new RegExp('\\b(' + NAMES.join('|') + ')\\b', 'gi');
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

  function apply() {
    var rtl = flipped.indexOf(lang) > -1;
    html.lang = lang;
    html.dir = rtl ? 'rtl' : 'ltr';
    Array.prototype.forEach.call(doc.querySelectorAll('[data-i18n]'), function (el) {
      var v = say(el.getAttribute('data-i18n'));
      if (v) paint(el, v);
    });
    // the labels a screen reader says are not decoration: they follow the
    // page too, and a value identical to english is a name, so tag it
    Array.prototype.forEach.call(doc.querySelectorAll('[data-i18n-aria]'), function (el) {
      var key = el.getAttribute('data-i18n-aria');
      var v = say(key);
      if (v) el.setAttribute('aria-label', v);
    });
    var sel = doc.querySelector('#langSelect');
    if (sel && sel.value !== lang) sel.value = lang;
    var a = say('notfound.h1a'), b = say('notfound.h1b');
    if (a && b) doc.title = '404 — ' + a + ' ' + b + ' · BG Hussein Sash';
    try { localStorage.setItem('lang', lang); } catch (e) {}
  }

  function pick() {
    var fromUrl = '';
    try { fromUrl = (new URLSearchParams(location.search).get('lang') || '').toLowerCase(); } catch (e) {}
    var saved = null;
    try { saved = localStorage.getItem('lang'); } catch (e) {}
    var browser = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase();
    var codes = Object.keys(words);
    var cands = [fromUrl, saved, browser, browser.split('-')[0]];
    for (var i = 0; i < cands.length; i++) {
      var c = (cands[i] || '').split('-')[0];
      if (c && codes.indexOf(c) > -1) return c;
    }
    return 'en';
  }

  var btn = doc.querySelector('#themeBtn');
  if (btn) btn.addEventListener('click', function () {
    html.dataset.theme = (html.dataset.theme || 'dark') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', html.dataset.theme); } catch (e) {}
  });

  var sel = doc.querySelector('#langSelect');
  if (sel) sel.addEventListener('change', function () { lang = sel.value; apply(); });

  fetch('/assets/i18n/translations.json?v=r23')
    .then(function (r) { return r.json(); })
    .then(function (json) { words = json; lang = pick(); apply(); })
    .catch(function () { /* english markup is already in the page */ });
})();
