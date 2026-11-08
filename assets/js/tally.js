/* tally.js — the visitor count, and nothing else.
   loaded on every public page before main.js, so the tally covers the
   whole site and not just the homepage.

   what happens on a visit: one post to the site's own supabase edge
   function, which writes one row and hands back the numbers. no
   analytics company, no cookie, no localstorage, no fingerprint and
   no third server is in this path. the only per-visit identifier the
   database keeps is sha256(salt + ip + baghdad day) — a person cannot
   be followed into the next day and the hash cannot be walked back to
   an address.

   if the backend is not configured, or answers badly, the box under
   the clock never appears: the site does not print a number nobody
   counted. */

(function (win, doc) {
  'use strict';

  /* ── the one line to fill in ──────────────────────────────
     the project url, https://<ref>.supabase.co — nothing else is
     needed here: no anon key, no site key, no tracking id. the
     edge function signs its own writes with the service key.  */
  var SUPABASE_URL = '';
  var STATS_FN = 'site-stats';

  /* main.js reads this back for the order form, so the url is
     written once and used by everything that talks to supabase. */
  win.BGSASH_STATS = { url: SUPABASE_URL };

  var numFmt = new Intl.NumberFormat('en-GB');

  function q(sel) {
    try { return doc.querySelector(sel); } catch (e) { return null; }
  }

  function hostOf(url) {
    try { return new URL(url, doc.baseURI || win.location.href).hostname.toLowerCase(); } catch (e) { return ''; }
  }

  function currentLang() {
    var m = /[?&]lang=([A-Za-z-]{2,5})/.exec(win.location.search || '');
    if (m) return m[1].toLowerCase();
    var attr = doc.documentElement.getAttribute('lang');
    return (attr || 'en').toLowerCase().slice(0, 5);
  }

  function paint(box, s) {
    var put = function (id, n) {
      var el = q('#' + id);
      if (el && isFinite(n)) el.textContent = numFmt.format(n);
    };
    put('tGuests', s.visitors);
    put('tViews', s.views);
    put('tToday', s.today);
    box.classList.add('live');
  }

  function countVisits() {
    if (!SUPABASE_URL) return;                  // unconfigured: stay hidden
    var box = q('#tally');

    var here = hostOf(win.location.href);
    var from = hostOf(doc.referrer || '');
    var body = {
      path: win.location.pathname || '/',
      lang: currentLang(),
      ref: (from && from !== here) ? from : ''  // only outside hosts, and only the host
    };

    fetch(SUPABASE_URL + '/functions/v1/' + STATS_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then(function (s) {
        if (!s || s.ok !== true) throw new Error('no tally');
        if (box) { box.hidden = false; paint(box, s); }
      })
      .catch(function () { if (box) box.hidden = true; });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', countVisits);
  } else {
    countVisits();
  }
})(window, document);
