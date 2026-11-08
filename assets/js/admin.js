/* the admin desk. rows are built with createElement/textContent rather
   than innerHTML: the text inside them is whatever a stranger typed into
   the request form, so it never gets to be markup. the password lives in
   this closure only — never in sessionStorage, where an extension or a
   shared machine would keep it after the tab closes. */
(function () {
  'use strict';
  var doc = document;
  var board = doc.getElementById('board');
  var gate = doc.getElementById('gate');
  var err = doc.getElementById('err');
  var pwField = doc.getElementById('pw');
  var ENDPOINT = '';            // https://PROJECT.supabase.co/functions/v1/list-requests
  var password = '';            // in memory, this tab, until it closes
  var timer = null;

  // a session is dropped after ten minutes away from the tab
  var IDLE_MS = 600000;
  var STATUSES = { new: 1, contacted: 1, quoted: 1, won: 1, closed: 1 };

  function cell(text) {
    var td = doc.createElement('td');
    td.textContent = text == null ? '' : String(text);
    return td;
  }

  function lock() {
    password = '';
    if (pwField) pwField.value = '';
    board.hidden = true;
    gate.hidden = false;
    if (timer) { clearInterval(timer); timer = null; }
  }

  function stamp() {
    var el = doc.getElementById('stamp');
    if (el) el.textContent = '· ' + new Date().toLocaleTimeString();
  }

  /* ── the visit desk ───────────────────────────────────────
     the same password opens the same project, so the numbers come
     from the site-stats function beside list-requests. nothing here
     is guessed: an empty breakdown reads "no visits yet", and an
     error reads as an error.                                  */

  var num = new Intl.NumberFormat('en-GB');

  function statsUrl() {
    return ENDPOINT.indexOf('list-requests') > -1
      ? ENDPOINT.replace('list-requests', 'site-stats')
      : ENDPOINT.replace(/\/functions\/v1\/.*$/, '/functions/v1/site-stats');
  }

  function baghdadToday() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  }

  function body(id) { return doc.querySelector('#' + id + ' tbody'); }

  function wipe(b) { if (b) { while (b.firstChild) b.removeChild(b.firstChild); } }

  function addRow(b, texts) {
    var tr = doc.createElement('tr');
    for (var i = 0; i < texts.length; i++) tr.appendChild(cell(texts[i]));
    b.appendChild(tr);
    return tr;
  }

  function plainList(b, list, empty) {
    wipe(b);
    if (!list || !list.length) {
      var t = cell(empty); t.colSpan = 2; t.className = 'muted';
      var tr = doc.createElement('tr'); tr.appendChild(t); b.appendChild(tr);
      return;
    }
    list.forEach(function (r) {
      addRow(b, [r.path || r.ref_domain || r.lang || r.device || r.browser || '—', num.format(Number(r.count || 0))]);
    });
  }

  function renderStats(d) {
    if (board.hidden) return;          // locked while the request was in flight
    var sum = doc.getElementById('vSummary');
    var series = d.series || [];
    var today = baghdadToday();
    var head = series[0];
    var isToday = head && head.day === today;
    var t = d.totals || {};

    if (sum) {
      var bits = [
        num.format(Number(t.visitors || 0)) + ' visitors all-time',
        num.format(Number(t.views || 0)) + ' page views all-time',
        (isToday ? num.format(Number(head.visitors || 0)) : '0') + ' visitors today',
        (isToday ? num.format(Number(head.views || 0)) : '0') + ' views today',
      ];
      if (series.length) {
        var peak = series.reduce(function (a, b) { return Number(b.views) > Number(a.views) ? b : a; }, series[0]);
        bits.push('busiest ' + peak.day + ' — ' + num.format(Number(peak.views)) + ' views');
      }
      if (d.lastSeen) bits.push('visitor key last seen ' + d.lastSeen);
      sum.textContent = bits.join('  ·  ');
    }

    var b = body('vSeries');
    if (b) {
      wipe(b);
      if (!series.length) {
        var td0 = cell('no visits in this window'); td0.colSpan = 4; td0.className = 'muted';
        var tr0 = doc.createElement('tr'); tr0.appendChild(td0); b.appendChild(tr0);
      } else {
        var max = series.reduce(function (m, r) { return Math.max(m, Number(r.views) || 0); }, 0) || 1;
        series.forEach(function (r) {
          var v = Number(r.views) || 0;
          var bar = doc.createElement('td');
          bar.className = 'hide-sm';
          var outer = doc.createElement('span');
          outer.className = 'bar';
          var inner = doc.createElement('i');
          inner.style.width = Math.max(2, Math.round(v * 100 / max)) + '%';
          outer.appendChild(inner);
          bar.appendChild(outer);
          var tr = addRow(b, [r.day + (r.day === today ? ' · today' : ''), num.format(Number(r.visitors) || 0), num.format(v)]);
          tr.appendChild(bar);
        });
      }
    }

    plainList(body('vPaths'), d.paths, 'no page views yet');
    plainList(body('vRefs'), d.referrers, 'no outside referrers — direct or self traffic');
    plainList(body('vLangs'), d.langs, 'no languages yet');
    plainList(body('vDevices'), d.devices, 'no devices yet');
    plainList(body('vBrowsers'), d.browsers, 'no browsers yet');

    if (d.errors && d.errors.length && sum) {
      var e = doc.createElement('span');
      e.className = 'err';
      e.textContent = ' · backend said: ' + d.errors.join('; ');
      sum.appendChild(e);
    }
  }

  function loadStats() {
    var sum = doc.getElementById('vSummary');
    if (!password) return;
    var sel = doc.getElementById('vRange');
    var days = sel ? sel.value : '30';
    if (sum) sum.textContent = 'loading…';

    fetch(statsUrl(), {
      method: 'POST',
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password, days: days })
    }).then(function (r) {
      if (!r.ok) throw new Error('stats http ' + r.status);
      return r.json();
    }).then(renderStats).catch(function (e) {
      if (sum) sum.textContent = 'visits unavailable — ' + (e.message || String(e));
    });
  }

  var rangeSel = doc.getElementById('vRange');
  if (rangeSel) rangeSel.addEventListener('change', loadStats);

  function load() {
    if (!ENDPOINT) { err.textContent = 'Set ENDPOINT to your supabase function URL first.'; return; }
    if (!password) { err.textContent = 'Enter the admin password.'; return; }
    err.textContent = '';

    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timeout = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;

    fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    }).then(function (r) {
      if (timeout) clearTimeout(timeout);
      if (r.status === 401) throw new Error('wrong password');
      if (r.status === 429) throw new Error('too many tries — wait ten minutes');
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (data) {
      gate.hidden = true; board.hidden = false;
      if (pwField) pwField.value = '';
      stamp();

      var reqBody = doc.querySelector('#reqTable tbody');
      var msgBody = doc.querySelector('#msgTable tbody');
      [reqBody, msgBody].forEach(function (b) { while (b.firstChild) b.removeChild(b.firstChild); });

      (data.requests || []).forEach(function (r) {
        var tr = doc.createElement('tr');
        tr.appendChild(cell(new Date(r.created_at).toLocaleString()));
        tr.appendChild(cell(r.service));
        tr.appendChild(cell(r.budget || '-'));
        tr.appendChild(cell(r.name));
        tr.appendChild(cell(r.email + (r.phone ? '\n' + r.phone : '')));
        var det = cell(r.details || '');
        det.className = 'hide-sm';
        tr.appendChild(det);
        var pill = doc.createElement('span');
        pill.className = 'pill ' + (STATUSES[r.status] ? r.status : 'new');
        pill.textContent = STATUSES[r.status] ? r.status : 'new';
        var td = doc.createElement('td');
        td.appendChild(pill);
        tr.appendChild(td);
        reqBody.appendChild(tr);
      });
      if (!reqBody.firstChild) {
        var tr0 = doc.createElement('tr');
        var td0 = cell('empty'); td0.colSpan = 7; td0.className = 'muted';
        tr0.appendChild(td0); reqBody.appendChild(tr0);
      }

      (data.messages || []).forEach(function (m) {
        var tr = doc.createElement('tr');
        tr.appendChild(cell(new Date(m.created_at).toLocaleString()));
        tr.appendChild(cell(m.name));
        tr.appendChild(cell(m.email));
        tr.appendChild(cell(m.message));
        msgBody.appendChild(tr);
      });
      if (!msgBody.firstChild) {
        var tm = doc.createElement('tr');
        var tmk = cell('empty'); tmk.colSpan = 4; tmk.className = 'muted';
        tm.appendChild(tmk); msgBody.appendChild(tm);
      }

      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        if (doc.hasFocus()) return;
        lock();
      }, IDLE_MS);

      loadStats();
    }).catch(function (e) {
      err.textContent = (e && e.name === 'AbortError') ? 'request timed out' : (e.message || String(e));
    });
  }

  doc.getElementById('login').addEventListener('submit', function (e) {
    e.preventDefault();
    password = pwField.value;
    load();
  });

  var lockBtn = doc.getElementById('lockBtn');
  if (lockBtn) lockBtn.addEventListener('click', lock);

  doc.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      lock();
    }
  });

  // the password is not kept anywhere, so a reload always asks again
})();
