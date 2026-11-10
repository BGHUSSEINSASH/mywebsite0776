/* tally.js — the visitor count, and the availability pill it answers with.
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

  /* the box under the clock is worth seeing before the project url exists,
     so on this machine — and only on this machine — the post goes to the
     stand-in in tools/serve.js, which counts real visits to the local copy.
     a deployed page never asks its own origin for a number: the branch is
     keyed to the loopback host, and there is nothing there to answer it. */
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;
  function statsUrl() {
    if (SUPABASE_URL) return SUPABASE_URL + '/functions/v1/' + STATS_FN;
    if (!LOOPBACK.test(win.location.hostname)) return '';
    return win.location.origin + '/functions/v1/' + STATS_FN;
  }

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

  /* the availability pill rides back on the same response. 'auto' means
     nobody overrode it and the Baghdad clock on the page decides, so the
     site behaves exactly as it did before the desk could set it.  */
  function applyAvail(a) {
    var state = a && a.state;
    if (state !== 'open' && state !== 'closed') return;
    win.BGSASH_AVAIL = { state: state, note: String(a.note || '').slice(0, 120) };
    try { doc.dispatchEvent(new CustomEvent('bgsash:avail', { detail: win.BGSASH_AVAIL })); } catch (e) {}
  }

  function countVisits() {
    var endpoint = statsUrl();
    if (!endpoint) return;                      // unconfigured: stay hidden
    var box = q('#tally');

    var here = hostOf(win.location.href);
    var from = hostOf(doc.referrer || '');
    var body = {
      path: win.location.pathname || '/',
      lang: currentLang(),
      ref: (from && from !== here) ? from : ''  // only outside hosts, and only the host
    };

    fetch(endpoint, {
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
        if (s.avail) applyAvail(s.avail);
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
