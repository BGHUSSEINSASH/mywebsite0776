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

    // locking also empties the desk: hiding it is not hiding it, the rows
    // stay in the document for anyone who opens devtools on the machine —
    // and since the desk now holds private notes, that is not a secret to
    // leave sitting in the dom of a shared computer
    ['reqTable', 'msgTable', 'vSeries', 'vPaths', 'vRefs', 'vLangs', 'vDevices', 'vBrowsers']
      .forEach(function (id) { wipe(body(id)); });
    lastData = { requests: [], messages: [] };
    badge(0);
    var sum = doc.getElementById('vSummary');
    if (sum) sum.textContent = '';
    var av = doc.getElementById('availNote');
    if (av) av.value = '';
    availDirty = false;
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

  function updateUrl() {
    return ENDPOINT.replace(/\/functions\/v1\/.*$/, '/functions/v1/update-request');
  }

  /* ── writing back ─────────────────────────────────────────
     the desk is read-only until the password is in the closure, and
     every edit is one small post: { password, id, status } or
     { password, id, notes } or { password, avail, availNote }. the
     function answers 400 for anything outside its whitelists, so a
     tampered request body cannot name a column or a table.        */

  var lastData = { requests: [], messages: [] };
  var STATUS_ORDER = ['new', 'contacted', 'quoted', 'won', 'closed'];

  /* ── the tab icon carries the news ──────────────────────────
     the desk sits behind whatever else is open, and a red count on its
     own icon is how it says "there is something to answer" — without a
     notification the browser would have to ask permission for. the icon
     is an svg, so the badge is written as an svg too and handed over as
     a data url (img-src already allows data:). safari ignores svg icons,
     so the number travels in the title as well.                  */

  var FAV_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
    '<rect width="256" height="256" rx="40" fill="#0e0f11"/>' +
    '<rect x="14" y="14" width="228" height="228" rx="30" fill="none" stroke="rgba(236,233,223,.18)" stroke-width="2"/>' +
    '<text x="128" y="142" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" ' +
    'font-weight="700" font-size="104" fill="#ece9df">BG</text>';
  var FAV_DOT = '<circle cx="196" cy="176" r="14" fill="#ff5a2a"/>';   // the mark the icon always had
  var favLink = doc.querySelector('link[rel="icon"]');
  var baseTitle = doc.title;

  function pendingNew() {
    return lastData.requests.reduce(function (n, r) {
      return n + (!r.status || r.status === 'new' ? 1 : 0);
    }, 0);
  }

  function badge(n) {
    doc.title = n > 0 ? '(' + n + ') ' + baseTitle : baseTitle;
    if (!favLink) {
      favLink = doc.createElement('link');
      favLink.rel = 'icon';
      favLink.type = 'image/svg+xml';
      doc.head.appendChild(favLink);
    }
    var mark = FAV_DOT;
    if (n > 0) {
      var said = n > 99 ? '99+' : String(n);
      mark = '<circle cx="174" cy="174" r="64" fill="#ff5a2a" stroke="#0e0f11" stroke-width="10"/>' +
        '<text x="174" y="176" text-anchor="middle" dominant-baseline="central" ' +
        'font-family="Arial Black, Arial, sans-serif" font-weight="700" ' +
        'font-size="' + (said.length > 1 ? 54 : 74) + '" fill="#0e0f11">' + said + '</text>';
    }
    try { favLink.href = 'data:image/svg+xml,' + encodeURIComponent(FAV_OPEN + mark + '</svg>'); } catch (e) {}
  }

  function saved(msg, bad) {
    var el = doc.getElementById('saveState');
    if (!el) return;
    el.textContent = msg;
    el.className = bad ? 'err' : 'muted';
  }

  function patch(fields, label) {
    if (!password) { saved('the desk is locked — open it again', true); return; }
    saved('saving ' + label + '…');
    var payload = { password: password };
    for (var k in fields) payload[k] = fields[k];

    fetch(updateUrl(), {
      method: 'POST',
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.status === 401) throw new Error('wrong password');
      if (r.status === 429) throw new Error('too many saves — wait ten minutes');
      if (r.status === 400) throw new Error('the server refused that value');
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (out) {
      saved(label + ' saved · ' + new Date().toLocaleTimeString());
      if (label === 'availability') availDirty = false;
      if (out && out.avail) paintAvail(out.avail);
    }).catch(function (e) {
      saved(label + ' NOT saved — ' + (e.message || String(e)), true);
    });
  }

  function statusPicker(row) {
    var sel = doc.createElement('select');
    // the pill look the desk always had, kept: a select wearing the same
    // classes is still the same coloured oval in the same column
    sel.className = 'status pill ' + (STATUSES[row.status] ? row.status : 'new');
    STATUS_ORDER.forEach(function (s) {
      var o = doc.createElement('option');
      o.value = s;
      o.textContent = s;
      if (s === (STATUSES[row.status] ? row.status : 'new')) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      row.status = sel.value;
      sel.className = 'status pill ' + sel.value;      // the colour follows the state
      badge(pendingNew());                              // answering one takes the dot off
      patch({ id: row.id, status: sel.value }, 'status of ' + (row.name || 'this request'));
    });
    return sel;
  }

  function notesField(row) {
    var ta = doc.createElement('textarea');
    ta.value = row.notes || '';
    ta.maxLength = 4000;
    ta.placeholder = 'private — never shown to a visitor';
    function commit() {
      if (ta.value === (row.notes || '')) return;
      row.notes = ta.value;
      patch({ id: row.id, notes: ta.value }, 'notes');
    }
    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); ta.blur(); }
    });
    return ta;
  }

  function cameFrom(row) {
    var bits = [row.source, row.medium, row.campaign, row.referrer].filter(function (v) { return v; });
    var td = cell(bits.length ? bits.join(' / ') : '—');
    td.className = 'hide-sm';
    return td;
  }

  /* csv, built here from the rows already on screen. a spreadsheet runs a
     cell that starts with = + - @ or a tab, and every one of these cells is
     text a stranger typed — so those get a leading apostrophe and stay text. */
  var CSV_COLS = ['when', 'service', 'budget', 'name', 'email', 'phone', 'lang',
                  'status', 'source', 'medium', 'campaign', 'referrer', 'details', 'notes'];
  var MSG_COLS = ['when', 'name', 'email', 'lang', 'status', 'message'];

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    // =, @ and a tab are never anything but a formula attempt. a value that
    // starts with + or - is escaped only when it is not a plain number, so
    // a phone (+964770…) and a negative amount stay readable in the sheet.
    if (/^[=@\t]/.test(s) || (/^[-+]/.test(s) && !/^[-+][\d.,\/ ]+$/.test(s))) s = "'" + s;
    return '"' + s.replace(/"/g, '""').replace(/[\r\n]+/g, ' ') + '"';
  }

  function downloadCsv(rows, cols, kind) {
    if (!rows.length) { saved('no ' + kind + ' to export yet', true); return; }
    var lines = [cols.join(',')];
    rows.forEach(function (r) {
      lines.push(cols.map(function (c) {
        return csvCell(c === 'when' ? new Date(r.created_at).toISOString() : r[c]);
      }).join(','));
    });
    var blob = new Blob(['' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    var a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bgsash-' + kind + '-' + baghdadToday() + '.csv';
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    saved('csv written · ' + rows.length + ' rows');
  }

  // an unsaved choice in the pill controls is never overwritten by a slow
  // stats response arriving after he already picked something
  var availDirty = false;

  function paintAvail(a) {
    var sel = doc.getElementById('availState');
    var note = doc.getElementById('availNote');
    var now = doc.getElementById('availNow');
    if (!sel || availDirty) return;
    var state = a && a.state;
    if (state !== 'open' && state !== 'closed') state = 'auto';
    sel.value = state;
    if (note) note.value = (a && a.note) || '';
    if (now) now.textContent = (a && a.updated_at)
      ? 'set ' + new Date(a.updated_at).toLocaleString()
      : 'the clock decides';
  }

  ['availState', 'availNote'].forEach(function (id) {
    var el = doc.getElementById(id);
    if (el) el.addEventListener('change', function () { availDirty = true; });
  });

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
    paintAvail(d.avail);               // the pill controls read the same row
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

  var csvBtn = doc.getElementById('csvBtn');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    downloadCsv(lastData.requests, CSV_COLS, 'requests');
  });
  var csvMsgBtn = doc.getElementById('csvMsgBtn');
  if (csvMsgBtn) csvMsgBtn.addEventListener('click', function () {
    downloadCsv(lastData.messages, MSG_COLS, 'messages');
  });

  var availSave = doc.getElementById('availSave');
  if (availSave) availSave.addEventListener('click', function () {
    var sel = doc.getElementById('availState');
    var note = doc.getElementById('availNote');
    patch({ avail: sel ? sel.value : 'auto', availNote: note ? note.value : '' }, 'availability');
  });

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

      lastData = { requests: data.requests || [], messages: data.messages || [] };

      lastData.requests.forEach(function (r) {
        var tr = doc.createElement('tr');
        tr.appendChild(cell(new Date(r.created_at).toLocaleString()));
        tr.appendChild(cell(r.service));
        tr.appendChild(cell(r.budget || '-'));
        tr.appendChild(cell(r.name));
        tr.appendChild(cell(r.email + (r.phone ? '\n' + r.phone : '')));
        var det = cell(r.details || '');
        det.className = 'hide-sm';
        tr.appendChild(det);
        tr.appendChild(cameFrom(r));
        var td = doc.createElement('td');
        td.appendChild(statusPicker(r));
        tr.appendChild(td);
        var tn = doc.createElement('td');
        tn.appendChild(notesField(r));
        tr.appendChild(tn);
        reqBody.appendChild(tr);
      });
      if (!reqBody.firstChild) {
        var tr0 = doc.createElement('tr');
        var td0 = cell('empty'); td0.colSpan = 9; td0.className = 'muted';
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

      badge(pendingNew());

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
