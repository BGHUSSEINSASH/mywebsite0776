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
