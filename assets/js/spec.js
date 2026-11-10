/* spec.js — the datasheet layer: corner readout, availability, live
   estimator, github repos, command palette, terminal, print sheet.
   it reads the site through window.SASH only (say/lang/toast/wa/...) and
   builds what the page can already do — no new privileges, no innerHTML
   with visitor text.                                              */

(function () {
  'use strict';

  var doc = document;
  var html = doc.documentElement;
  var S = null;

  function q(sel, root) { return (root || doc).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function say(key, fb) { return S ? S.say(key, fb) : (fb === undefined ? '' : fb); }
  function calm() { return !!(S && S.calm()); }

  function mk(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // baghdad is utc+3 all year — no dst, so a fixed offset is exact
  function baghdad() { return new Date(Date.now() + 3 * 3600 * 1000); }

  /* one rate per currency, plus the day it was read. a hardcoded rate goes
     stale in silence and this one did — IQD sat at 1310 while the market
     moved to 1689, so an Iraqi visitor was shown a figure ~29% under the
     truth, and TRY sat at 34 against a real ~50. the date is what turns the
     next occurrence into a failing check instead of a wrong number. */
  var RATE_DATE = '2026-11-10';
  /* IQD is the parallel-market rate, not the central bank's official 1510:
     work is bought and settled at the market rate, so that is the only one a
     visitor can act on. the gap between the two is ~12%. */
  var RATES = { USD: 1, IQD: 1689, EUR: 0.892, TRY: 50 };
  var SYM = { USD: '$', IQD: 'IQD ', EUR: '€', TRY: '₺ ' };

  function money(usd, cur) {
    var v = usd * (RATES[cur] === undefined ? 1 : RATES[cur]);
    return (SYM[cur] || '') + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  /* ── model: one entry per orderable thing, priced at the published
     "from" figures so the estimator can never undercut the price table.
     that used to be a promise with nothing behind it — base here and
     pricing.pNpr in the dictionary were two numbers in two files. the gate
     in check-security.js now reads both and fails when they disagree, in
     any of the twelve languages.

     prices are the low end of the iraqi market, deliberately: published
     ranges come from agencies with overheads, and a solo developer who
     quotes agency rates loses the work without gaining the margin. */

  var TYPES = [
    { id: 'website',  base: 350,  per: 28,  min: 3,  max: 25, step: 1, def: 5,  w0: 1, wp: 0.18, unitKey: 'est.uPages',     ufb: 'pages',     nameKey: 'pricing.p1t', nameFb: 'Business Website' },
    { id: 'platform', base: 1100, per: 95,  min: 3,  max: 20, step: 1, def: 6,  w0: 2, wp: 0.30, unitKey: 'est.uFeatures',  ufb: 'modules',   nameKey: 'pricing.p2t', nameFb: 'Platform / E-commerce' },
    { id: 'app',      base: 850,  per: 170, min: 4,  max: 30, step: 1, def: 8,  w0: 2, wp: 0.22, unitKey: 'est.uScreens',   ufb: 'screens',   nameKey: 'pricing.p3t', nameFb: 'Mobile App (Flutter)' },
    { id: 'server',   base: 200,  per: 80,  min: 1,  max: 25, step: 1, def: 4,  w0: 1, wp: 0.20, unitKey: 'est.uDevices',   ufb: 'devices',   nameKey: 'pricing.p4t', nameFb: 'Server & IT Setup' },
    { id: 'design',   base: 175,  per: 60,  min: 1,  max: 20, step: 1, def: 3,  w0: 1, wp: 0.12, unitKey: 'est.uCreatives', ufb: 'items',     nameKey: 'pricing.p6t', nameFb: 'Logo & Brand Design' },
    { id: 'social',   base: 120,  per: 60,  min: 1,  max: 6,  step: 1, def: 2,  w0: 1, wp: 0.00, unitKey: 'est.uPlatforms', ufb: 'platforms', nameKey: 'pricing.p5t', nameFb: 'Social Media Management', monthly: true }
  ];

  // chips borrow the price-table names so the estimator can never
  // describe a service differently from the page that sells it
  function typeName(t) { return say(t.nameKey, t.nameFb); }

  var SPEEDS = [
    { id: 'std',  price: 1,    weeks: 1, key: 'est.std',  fb: 'Standard' },
    { id: 'fast', price: 1.25, weeks: 0.8, key: 'est.fast', fb: 'Fast track' },
    { id: 'prio', price: 1.5,  weeks: 0.65, key: 'est.prio', fb: 'Priority' }
  ];

  /* scaled with the bases, except "host": it is the same thing the
     domain + hosting card sells, so it carries the card's number and the
     gate holds the two together. it was 80 against a card that said 30. */
  var ADDONS = [
    { id: 'i18n',   pct: 0.12, flat: 0,   key: 'est.aI18n',   fb: 'Arabic + English' },
    { id: 'admin',  pct: 0,    flat: 300, key: 'est.aAdmin',  fb: 'Admin dashboard' },
    { id: 'pay',    pct: 0,    flat: 380, key: 'est.aPay',    fb: 'Payments / escrow' },
    { id: 'seo',    pct: 0,    flat: 225, key: 'est.aSeo',    fb: 'SEO + analytics' },
    { id: 'motion', pct: 0,    flat: 275, key: 'est.aMotion', fb: 'Motion design' },
    { id: 'host',   pct: 0,    flat: 60,  key: 'est.aHost',   fb: 'Domain + hosting 1y' },
    { id: 'care',   pct: 0,    flat: 375, key: 'est.aCare',   fb: '3-month support' }
  ];

  function typeById(id) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i];
    return TYPES[0];
  }

  function readForm() {
    var t = q('#estTypes input:checked');
    var type = typeById(t ? t.value : 'website');
    var scope = q('#estScope');
    var n = scope ? parseInt(scope.value, 10) : type.def;
    if (!isFinite(n)) n = type.def;
    var sp = q('#estSpeed input:checked');
    var speed = SPEEDS[0];
    for (var i = 0; i < SPEEDS.length; i++) if (sp && sp.value === SPEEDS[i].id) speed = SPEEDS[i];
    var adds = [];
    qa('#estAddons input:checked').forEach(function (c) {
      for (var j = 0; j < ADDONS.length; j++) if (ADDONS[j].id === c.value) adds.push(ADDONS[j]);
    });
    var curSel = q('#estCur');
    var cur = curSel ? curSel.value : 'USD';
    if (!RATES[cur]) cur = 'USD';
    return { type: type, n: n, speed: speed, adds: adds, cur: cur };
  }

  function compute(f) {
    var flat = 0, pct = 0;
    f.adds.forEach(function (a) { flat += a.flat; pct += a.pct; });
    // the published price is a floor: base covers the default scope, extra scope bills per unit
    var scopeCost = f.type.per * Math.max(0, f.n - f.type.def);
    var usd = (f.type.base + scopeCost + flat) * f.speed.price * (1 + pct);
    usd = Math.round(usd / 5) * 5;
    var weeks = Math.max(1, Math.ceil((f.type.w0 + f.type.wp * f.n) / (f.type.monthly ? 1 : f.speed.weeks)));
    return { usd: usd, weeks: weeks, scopeCost: scopeCost, flat: flat, pct: pct };
  }

  /* ── 1. corner readout ─────────────────────────────────────── */

  var hudRepaint = null;

  function buildHud() {
    if (q('.hud')) return;
    var hud = mk('div', 'hud');
    hud.setAttribute('aria-hidden', 'true');

    var labels = [];
    function hudBtn(key, fb, suffix) {
      var b = mk('button', null, say(key, fb) + (suffix || ''));
      b.type = 'button';
      b.dataset.hudKey = key;
      b.dataset.hudFb = fb;
      b.dataset.hudSuffix = suffix || '';
      labels.push(b);
      return b;
    }

    var r1 = mk('div', 'hud-row');
    var sec = mk('b', null, 'SEC 01/01');
    var meter = mk('span', 'hud-meter');
    meter.appendChild(mk('i'));
    r1.appendChild(sec);
    r1.appendChild(meter);

    var r2 = mk('div', 'hud-row');
    var clock = mk('b', null, '--:--:--');
    var zone = mk('span', 'hud-sep', 'UTC+3');
    r2.appendChild(clock);
    r2.appendChild(zone);

    var r3 = mk('div', 'hud-row');
    var meta = mk('span', null, '—');
    r3.appendChild(meta);

    var act = mk('div', 'hud-row hud-act');
    var bPal = hudBtn('hud.palette', 'palette', ' ⌘K');
    var bTerm = hudBtn('hud.term', 'terminal', '  `');
    var bPrint = hudBtn('hud.print', 'spec sheet', '');
    act.appendChild(bPal); act.appendChild(bTerm); act.appendChild(bPrint);

    hud.appendChild(r1); hud.appendChild(r2); hud.appendChild(r3); hud.appendChild(act);
    doc.body.appendChild(hud);

    var els = { sec: sec, bar: meter.firstChild, clock: clock, zone: zone, meta: meta, pal: bPal, term: bTerm, print: bPrint, labels: labels };

    bPal.addEventListener('click', function () { openPalette(); });
    bTerm.addEventListener('click', function () { toggleTerm(); });
    bPrint.addEventListener('click', function () { doc.defaultView.print(); });

    var sections = qa('section[id]');
    var ticking = false;

    function paint() {
      ticking = false;
      var mid = window.innerHeight / 2;
      var idx = 0;
      for (var i = 0; i < sections.length; i++) {
        var b = sections[i].getBoundingClientRect();
        if (b.top <= mid && b.bottom >= mid) { idx = i; break; }
        if (b.top <= mid) idx = i;
      }
      var id = (sections[idx] && sections[idx].id) || 'top';
      els.sec.textContent = 'SEC ' + pad(idx + 1) + '/' + pad(sections.length) + ' · ' + id.toUpperCase();
      var max = doc.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
      els.bar.style.width = Math.round(p * 100) + '%';
      var now = baghdad();
      els.clock.textContent = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ':' + pad(now.getUTCSeconds());
      var th = (html.dataset.theme || 'dark').toUpperCase();
      var lg = (S ? S.lang() : 'en').toUpperCase();
      els.meta.textContent = lg + ' · ' + th + ' · ' + Math.min(9999, window.innerWidth) + 'PX' + (calm() ? ' · ' + say('hud.calm', 'CALM') : '');
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    setInterval(paint, 1000);
    paint();
    hudRepaint = function () {
      labels.forEach(function (b) {
        b.textContent = say(b.dataset.hudKey, b.dataset.hudFb) + b.dataset.hudSuffix;
      });
      paint();
    };
    return els;
  }

  /* ── 2. availability — baghdad desk hours, sat to thu ────────── */

  function paintAvail() {
    var pill = q('.avail');
    if (!pill) return;

    // the desk can say "fully booked" or "taking work" over the clock's
    // answer. with no backend, or state 'auto', nothing is set and the
    // hours below decide — the same behaviour as before the pill was
    // editable. a note he typed is shown verbatim; it is his sentence.
    var desk = window.BGSASH_AVAIL;
    if (desk && (desk.state === 'open' || desk.state === 'closed')) {
      pill.setAttribute('data-state', desk.state);
      var said = q('.avail span', pill) || pill;
      said.textContent = desk.note || (desk.state === 'open'
        ? say('avail.open', 'Available · replies today')
        : say('avail.closed', 'Outside working hours · Sat–Thu, 09:00–18:00 Baghdad'));
      return;
    }

    var t = baghdad();
    var day = t.getUTCDay();          // 0 sun … 6 sat
    var hour = t.getUTCHours() + t.getUTCMinutes() / 60;
    var workday = day !== 5;           // fri off
    var OPEN_H = 9, CLOSE_H = 18;

    var state, text;
    if (workday && hour >= OPEN_H && hour < CLOSE_H) {
      state = 'open';
      text = say('avail.open', 'Available · replies today');
    } else if (workday && hour < OPEN_H) {
      state = 'soon';
      text = say('avail.soon', 'Opens in') + ' ' + hm(OPEN_H - hour);
    } else if (workday) {
      state = 'closed';
      text = say('avail.tomorrow', 'Tomorrow') + ' ' + pad(OPEN_H) + ':00';
    } else {
      state = 'closed';
      text = say('avail.soon', 'Opens in') + ' 1d';
    }
    pill.setAttribute('data-state', state);
    var label = q('.avail span', pill) || pill;
    label.textContent = text;
  }

  function hm(hours) {
    var h = Math.floor(hours);
    var m = Math.round((hours - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    return h + ':' + pad(m);
  }

  /* ── 3. estimator ──────────────────────────────────────────── */

  /* the estimator's chips and the github block are the two heaviest things
     this file builds, and both live far below the first screen. a visitor
     who leaves after the work section should not have paid for them, so
     they arrive when the form comes into view — or the moment anything
     asks for one of its inputs by name. */

  var estBuilt = false;

  function ensureEst() {
    if (estBuilt) return;
    estBuilt = true;
    buildEstimator();
    loadGh();
    paintEstimate();
    // the chips are the difference between this page's height before and
    // after the build; the scroll-driven animations measured the old one
    if (S && S.refresh) S.refresh();
  }

  /* the observer is the right listener, but it only reports while the
     browser paints: a background tab, a machine that checks this page
     without ever drawing it and a visitor who lands on the form by hash
     would all wait for chips that are already on screen. the same question
     asked of getBoundingClientRect answers it without needing a paint, and
     the same answers come out the same way either path fires first. */

  function armEst() {
    var host = q('#est');
    if (!host) { ensureEst(); return; }

    var io = null;
    var lastScroll = 0;

    function off() {
      if (io) io.disconnect();
      removeEventListener('scroll', measure);
      removeEventListener('resize', measure);
      removeEventListener('beforeprint', measure);
      ['pointerdown', 'focusin'].forEach(function (ev) {
        host.removeEventListener(ev, measure);
      });
    }

    function near() {
      var vh = innerHeight || doc.documentElement.clientHeight;
      var r = host.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh * 1.5;
    }

    function measure(e) {
      if (estBuilt) return off();
      // scrolling fires hundreds of times a screen; a rect read each time
      // would cost more than the chips it is deciding whether to build
      if (e && e.type === 'scroll') {
        var now = Date.now();
        if (now - lastScroll < 150) return;
        lastScroll = now;
      }
      if (near()) {
        off();
        ensureEst();
      }
    }

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (rows) {
        if (!rows.some(function (r) { return r.isIntersecting; })) return;
        measure();
      }, { rootMargin: '400px 0px' });
      io.observe(host);
    }
    addEventListener('scroll', measure, { passive: true });
    addEventListener('resize', measure);
    addEventListener('beforeprint', measure);
    ['pointerdown', 'focusin'].forEach(function (ev) {
      host.addEventListener(ev, measure);
    });
    measure();
  }

  function buildEstimator() {
    var host = q('#est');
    if (!host || host.dataset.built === '1') return;
    host.dataset.built = '1';

    var types = q('#estTypes', host);
    if (types && !types.firstChild) {
      TYPES.forEach(function (t, i) {
        var lab = mk('label', 'est-type');
        var inp = mk('input');
        inp.type = 'radio'; inp.name = 'esttype'; inp.value = t.id;
        if (i === 0) inp.checked = true;
        lab.appendChild(inp);
        var sp = mk('span', null, typeName(t));
        sp.setAttribute('data-i18n', t.nameKey);
        sp.dataset.i18nFallback = t.nameFb;
        lab.appendChild(sp);
        types.appendChild(lab);
      });
    }

    var addons = q('#estAddons', host);
    if (addons && !addons.firstChild) {
      ADDONS.forEach(function (a) {
        var lab = mk('label', 'est-add');
        var inp = mk('input');
        inp.type = 'checkbox'; inp.value = a.id;
        lab.appendChild(inp);
        var sp = mk('span', null, say(a.key, a.fb));
        sp.setAttribute('data-i18n', a.key);
        sp.dataset.i18nFallback = a.fb;
        lab.appendChild(sp);
        lab.appendChild(mk('b', null, a.flat ? '+$' + a.flat : a.pct ? '+' + Math.round(a.pct * 100) + '%' : '+'));
        addons.appendChild(lab);
      });
    }

    var speed = q('#estSpeed', host);
    if (speed && !speed.firstChild) {
      SPEEDS.forEach(function (s, i) {
        var lab = mk('label', 'est-type');
        var inp = mk('input');
        inp.type = 'radio'; inp.name = 'estspeed'; inp.value = s.id;
        if (i === 0) inp.checked = true;
        lab.appendChild(inp);
        var sp = mk('span', null, say(s.key, s.fb));
        sp.setAttribute('data-i18n', s.key);
        sp.dataset.i18nFallback = s.fb;
        lab.appendChild(sp);
        speed.appendChild(lab);
      });
    }

    var cur = q('#estCur', host);
    if (cur && !cur.firstChild) {
      ['USD', 'IQD', 'EUR', 'TRY'].forEach(function (c) {
        var o = mk('option', null, c);
        o.value = c;
        cur.appendChild(o);
      });
    }

    host.addEventListener('change', paintEstimate);
    host.addEventListener('input', paintEstimate);
    host.addEventListener('submit', function (e) { e.preventDefault(); });
    var reset = q('#estReset', host);
    if (reset) reset.addEventListener('click', function () {
      qa('input', host).forEach(function (i) {
        if (i.type === 'checkbox') i.checked = false;
        else if (i.type === 'radio') i.checked = (i.value === 'website' || i.value === 'std');
      });
      var s = q('#estScope', host); if (s) s.value = typeById('website').def;
      var c = q('#estCur', host); if (c) c.value = 'USD';
      paintEstimate();
      if (S) S.toast(say('toast.reset', 'Estimator cleared'));
    });

    var order = q('#estOrder', host);
    if (order) order.addEventListener('click', function () {
      var f = readForm();
      var brief = estSummary(f);
      if (S) {
        S.pickService(f.type.id);
        S.setDetails(brief);
        S.openOrder();
      }
    });

    var wa = q('#estWa', host);
    if (wa && S) wa.href = S.wa(estSummary(readForm()));

    paintEstimate();
  }

  function estSummary(f) {
    var r = compute(f);
    var L = [];
    L.push('[' + say('est.h3', 'Project estimate') + ']');
    L.push(say('est.lineType', 'Type') + ': ' + typeName(f.type));
    L.push(say('est.scope', 'Scope') + ': ' + f.n + ' ' + say(f.type.unitKey, f.type.ufb));
    L.push(say('est.lineSpeed', 'Speed') + ': ' + say(f.speed.key, f.speed.fb));
    L.push(say('est.addons', 'Add-ons') + ': ' + (f.adds.length
      ? f.adds.map(function (a) { return say(a.key, a.fb); }).join(', ')
      : say('est.none', 'none')));
    L.push(say('est.duration', 'Est. duration') + ': ' + r.weeks + ' ' + say('est.weeks', 'weeks'));
    L.push(say('est.total', 'Indicative total') + ': ' + money(r.usd, 'USD') + (f.type.monthly ? '/mo' : ''));
    if (f.cur !== 'USD') L.push('≈ ' + money(r.usd, f.cur) + ' ' + f.cur + ' · ' + say('est.indicative', 'indicative only'));
    L.push(say('est.note', 'Fixed written quote before any work starts.'));
    return L.join('\n');
  }

  function paintEstimate() {
    var host = q('#est');
    if (!host || host.dataset.built !== '1') return;

    // the chips may be built before the translation file lands, so every
    // repaint re-resolves them instead of trusting build-time wording
    qa('#est [data-i18n]', host).forEach(function (n) {
      if (n.dataset.i18nFallback === undefined) return;
      var v = say(n.getAttribute('data-i18n'), n.dataset.i18nFallback);
      /* main.js owns the turkish casing splitter; writing textContent
         straight here would erase the lang=en spans it laid down. */
      if (window.sashPaint) window.sashPaint(n, v); else n.textContent = v;
    });

    var f = readForm();
    var r = compute(f);

    var scope = q('#estScope', host);
    if (scope) {
      scope.min = f.type.min; scope.max = f.type.max; scope.step = f.type.step;
      if (parseInt(scope.value, 10) < f.type.min || parseInt(scope.value, 10) > f.type.max) scope.value = f.type.def;
    }
    var scopeN = q('#estScopeN', host);
    if (scopeN) scopeN.textContent = scope ? scope.value : f.type.def;
    var scopeUnit = q('#estScopeUnit', host);
    if (scopeUnit) scopeUnit.textContent = say(f.type.unitKey, f.type.ufb);
    var scopeLab = q('#estScopeLab', host);
    if (scopeLab) scopeLab.textContent = say('est.scope', 'Scope');

    var total = q('#estTotal', host);
    if (total) total.textContent = money(r.usd, 'USD') + (f.type.monthly ? say('est.permo', '/mo') : '');

    var local = q('#estLocal', host);
    if (local) {
      // the usd figure is the quote; the local line is only a courtesy
      // conversion, and currencies without a everyday glyph (iqd) carry
      // their iso code inside money() already — don't print it twice
      local.textContent = f.cur === 'USD'
        ? say('est.usdNote', 'priced in usd')
        : '≈ ' + money(r.usd, f.cur) + (SYM[f.cur] ? '' : ' ' + f.cur);
    }

    var lines = q('#estLines', host);
    if (lines) {
      lines.textContent = '';
      var rows = [
        [say('est.lineBase', 'Base'), money(f.type.base, f.cur)],
        [say('est.scope', 'Scope') + ' × ' + (scope ? scope.value : f.type.def),
         // at the default scope extra units cost nothing — say so instead of $0
         r.scopeCost ? money(r.scopeCost, f.cur) : say('est.included', 'in base')],
        [say('est.lineSpeed', 'Speed'), '× ' + f.speed.price],
        [say('est.addons', 'Add-ons'), r.flat || r.pct
          ? money(r.flat, f.cur) + (r.pct ? ' +' + Math.round(r.pct * 100) + '%' : '')
          : say('est.none', 'none')]
      ];
      rows.forEach(function (row) {
        var d = mk('div');
        d.appendChild(mk('span', null, row[0]));
        d.appendChild(mk('b', null, row[1]));
        lines.appendChild(d);
      });
    }

    var weeks = q('#estWeeks', host);
    if (weeks) weeks.textContent = r.weeks + ' ' + say('est.weeks', 'weeks');

    var wa = q('#estWa', host);
    if (wa && S) wa.href = S.wa(estSummary(f));
  }

  /* ── 4. github — cached an hour, silent when offline ────────── */

  var GH_USER = 'BGHUSSEINSASH';
  var GH_CACHE = 'sash.gh.v1';
  var GH_TTL = 3600 * 1000;

  function cachedGh() {
    try {
      var raw = localStorage.getItem(GH_CACHE);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (Date.now() - o.at < GH_TTL) ? o.data : null;
    } catch (e) { return null; }
  }

  function storeGh(data) {
    try { localStorage.setItem(GH_CACHE, JSON.stringify({ at: Date.now(), data: data })); } catch (e) {}
  }

  function fetchJson(url) {
    return fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)); });
  }

  function loadGh() {
    var box = q('#gh');
    if (!box) return;
    var hit = cachedGh();
    if (hit) { paintGh(box, hit, true); return; }
    Promise.all([
      fetchJson('https://api.github.com/users/' + GH_USER),
      fetchJson('https://api.github.com/users/' + GH_USER + '/repos?sort=updated&per_page=9')
    ]).then(function (res) {
      var data = { user: res[0], repos: (res[1] || []).slice(0, 6) };
      storeGh(data);
      paintGh(box, data, false);
    }).catch(function () {
      // no network, rate limited, offline: the header and profile link stay,
      // the two live slots go dark rather than showing a stale number
      var s = q('.gh-stats', box); if (s) s.hidden = true;
      var g = q('.gh-grid', box); if (g) g.hidden = true;
    });
  }

  var ghLast = null;            // remembered so a language change can repaint it

  function paintGh(box, data, fromCache) {
    ghLast = { box: box, data: data, fromCache: fromCache };
    var stats = q('.gh-stats', box);
    if (stats) {
      stats.textContent = '';
      var u = data.user || {};
      var newest = (data.repos || []).reduce(function (a, r) {
        return !a || (r.pushed_at || '') > a ? r.pushed_at : a;
      }, '');
      [[say('gh.repos', 'repos'), u.public_repos],
       [say('gh.followers', 'followers'), u.followers],
       [say('gh.pushed', 'last push'), newest ? ago(newest) : null]].forEach(function (p) {
        var s = mk('span', null, '');
        s.appendChild(doc.createTextNode((p[0] || '') + ' '));
        s.appendChild(mk('b', null, (typeof p[1] === 'string') ? p[1] : (isFinite(p[1]) ? String(p[1]) : '—')));
        stats.appendChild(s);
      });
    }

    var grid = q('.gh-grid', box);
    if (grid) {
      grid.textContent = '';
      (data.repos || []).forEach(function (r) {
        var a = mk('a', 'gh-card');
        a.href = r.html_url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.appendChild(mk('p', 'gh-name', r.name));
        if (r.description) a.appendChild(mk('p', 'gh-desc', r.description));
        var meta = mk('p', 'gh-meta');
        if (r.language) {
          var dot = mk('span', 'gh-dot');
          dot.style.setProperty('--gh-lang', langColor(r.language));
          meta.appendChild(dot);
          var lname = mk('span', '', r.language);
          lname.setAttribute('lang', 'en');   // a github language name is not a turkish word
          meta.appendChild(lname);
        }
        meta.appendChild(doc.createTextNode('★ ' + (r.stargazers_count || 0)));
        meta.appendChild(doc.createTextNode('↺ ' + (r.forks_count || 0)));
        if (r.pushed_at) meta.appendChild(doc.createTextNode(ago(r.pushed_at)));
        a.appendChild(meta);
        grid.appendChild(a);
      });
    }

    var stamp = q('.gh-stamp', box);
    if (stamp) {
      stamp.textContent = (fromCache ? say('gh.cached', 'cached') : say('gh.live', 'live')) +
        ' · ' + say('gh.updated', 'updated') + ' ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  var LANG_COLORS = { JavaScript: '#f1e05a', HTML: '#e34c26', CSS: '#563d7c', Dart: '#00b4ab', PHP: '#4f5d95', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Python: '#3572A5', Java: '#b07219', TypeScript: '#3178c6', Shell: '#89e051', Vue: '#41b883', Kotlin: '#A97BFF' };

  function langColor(l) { return LANG_COLORS[l] || '#ff5a2a'; }

  function ago(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (d < 1) return say('gh.today', 'today');
    if (d < 30) return Math.round(d) + 'd';
    if (d < 365) return Math.round(d / 30) + 'mo';
    return Math.round(d / 365) + 'y';
  }

  /* ── 5. command palette ────────────────────────────────────── */

  var pal = null, palIdx = 0, palItems = [], palLast = null;

  function commands() {
    var out = [];
    qa('section[id]').forEach(function (s) {
      var h = q('h2', s) || q('h1', s);   // the hero has no h2 — fall back to the name
      out.push({
        kind: 'nav',
        title: (h ? h.textContent.replace(/\s+/g, ' ').trim() : s.id),
        hint: s.id,
        key: null,
        run: function () { go('#' + s.id); }
      });
    });
    qa('.card[data-project], .work-card').forEach(function (c) {
      var t = q('h3', c);
      if (!t) return;
      out.push({ kind: 'work', title: t.textContent.trim(), hint: 'case', run: function () {
        var slug = c.getAttribute('data-slug') || c.id.replace(/^card-/, '');
        if (slug) location.href = '/work/' + slug;
        else { var b = q('.card-links a', c); if (b) b.click(); go('#work'); }
      } });
    });
    qa('.svc-card h3').forEach(function (t) {
      out.push({ kind: 'service', title: t.textContent.trim(), hint: 'order', run: function () {
        var n = qa('.svc-card h3').indexOf(t);
        var map = ['website', 'app', 'server', 'server', 'design', 'social'];
        if (S) { S.pickService(map[n] || 'custom'); S.openOrder(); }
      } });
    });
    out.push({ kind: 'action', title: say('pal.order', 'Start an order'), hint: '⏎', run: function () { if (S) S.openOrder(); } });
    out.push({ kind: 'action', title: say('pal.estimate', 'Open estimator'), hint: '#est', run: function () { go('#pricing'); var e = q('#est'); if (e) setTimeout(function () { e.scrollIntoView({ block: 'center' }); }, 60); } });
    out.push({ kind: 'action', title: say('pal.theme', 'Switch theme'), hint: 'light/dark', run: function () { var b = q('#themeBtn'); if (b) b.click(); } });
    out.push({ kind: 'action', title: say('pal.print', 'Print spec sheet'), hint: 'A4', run: function () { doc.defaultView.print(); } });
    out.push({ kind: 'action', title: say('pal.term', 'Open terminal'), hint: '>', run: function () { toggleTerm(true); } });
    out.push({ kind: 'action', title: say('keys.title', 'Keyboard shortcuts'), hint: '?', run: function () { toggleKeys(true); } });
    out.push({ kind: 'action', title: say('pal.mail', 'Email'), hint: S ? S.mail : 'mailto', run: function () { location.href = 'mailto:' + (S ? S.mail : ''); } });
    out.push({ kind: 'action', title: say('pal.wa', 'WhatsApp'), hint: 'wa.me', run: function () { if (S) { var n = q('#palWa'); location.href = S.wa(n ? n.value : say('pal.waMsg', 'Hello — I found your site.')); } } });
    out.push({ kind: 'link', title: say('pal.gh', 'GitHub profile'), hint: '↗', run: function () { open('https://github.com/' + GH_USER); } });
    out.push({ kind: 'link', title: say('pal.cvEn', 'CV — English'), hint: 'pdf', run: function () { open('/assets/cv/CV-en.pdf'); } });
    out.push({ kind: 'link', title: say('pal.cvAr', 'CV — Arabic'), hint: 'pdf', run: function () { open('/assets/cv/CV-ar.pdf'); } });
    var NATIVE = { en: 'English', ar: 'العربية', ku: 'کوردی (Kurmanji)', tr: 'Türkçe', fr: 'Français', es: 'Español', de: 'Deutsch', ru: 'Русский', zh: '中文', ja: '日本語', ko: '한국어', hi: 'हिन्दी' };
    (S ? S.langs() : ['en']).forEach(function (code) {
      out.push({ kind: 'lang', title: 'Language · ' + (NATIVE[code] || code.toUpperCase()), hint: code, run: function () {
        var sel = q('#langSelect');
        if (sel) { sel.value = code; sel.dispatchEvent(new Event('change')); }
      } });
    });
    return out;
  }

  function go(hash) {
    var t = q(hash);
    if (t) t.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
  }

  function open(where) {
    try { var w = window.open(where, '_blank', 'noopener'); if (!w) location.href = where; } catch (e) { location.href = where; }
  }

  function fuzzy(text, needle) {
    if (!needle) return { score: 0, marks: [text] };
    var t = text.toLowerCase(), n = needle.toLowerCase();
    var direct = t.indexOf(n);
    if (direct > -1) {
      return { score: 100 - direct, marks: [text.slice(0, direct), text.slice(direct, direct + n.length), text.slice(direct + n.length)] };
    }
    var score = 0, at = -1, marks = [], used = 0;
    for (var i = 0; i < t.length && used < n.length; i++) {
      if (t[i] === n[used]) {
        if (at < 0) at = i;
        used++;
        score += 2;
      } else if (used) {
        score -= 1;
      }
    }
    if (used < n.length) return null;
    return { score: score, marks: [text], at: at };
  }

  function buildPalette() {
    if (pal) return pal;
    var root = mk('div', 'pal');
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', say('pal.title', 'Command palette'));

    var bg = mk('div', 'pal-bg');
    var box = mk('div', 'pal-box');

    var row = mk('div', 'pal-in');
    var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var circ = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circ.setAttribute('cx', '11'); circ.setAttribute('cy', '11'); circ.setAttribute('r', '7');
    var line = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '16.5'); line.setAttribute('y1', '16.5'); line.setAttribute('x2', '21'); line.setAttribute('y2', '21');
    svg.appendChild(circ); svg.appendChild(line);
    var input = mk('input');
    input.type = 'search';
    input.id = 'palQ';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-controls', 'palList');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-autocomplete', 'list');
    input.autocomplete = 'off';
    row.appendChild(svg); row.appendChild(input);

    var list = mk('ul', 'pal-list');
    list.id = 'palList';
    list.setAttribute('role', 'listbox');

    var foot = mk('div', 'pal-foot');
    [say('pal.nav', 'navigate'), say('pal.pick', 'select'), say('pal.esc', 'close')].forEach(function (t, i) {
      var s = mk('span');
      var k = mk('kbd', null, i === 0 ? '↑↓' : i === 1 ? '⏎' : 'esc');
      s.appendChild(k);
      s.appendChild(doc.createTextNode(' ' + t));
      foot.appendChild(s);
    });

    box.appendChild(row); box.appendChild(list); box.appendChild(foot);
    root.appendChild(bg); root.appendChild(box);
    doc.body.appendChild(root);

    input.addEventListener('input', function () { filterPal(input.value); });
    input.addEventListener('keydown', palKeys);
    bg.addEventListener('click', closePalette);
    box.addEventListener('keydown', function (e) { if (e.key === 'Tab') trap(e, box); });

    pal = { root: root, box: box, input: input, list: list };
    return pal;
  }

  function trap(e, box) {
    var f = qa('input, button, a[href], [tabindex]:not([tabindex="-1"])', box).filter(function (n) { return n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function filterPal(text) {
    if (!pal) return;
    var all = commands();
    var hits = [];
    all.forEach(function (c) {
      var m = fuzzy(c.title + ' ' + (c.hint || ''), text);
      if (m) hits.push({ c: c, score: m.score, marks: m.marks, at: m.at });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    hits = hits.slice(0, 40);

    pal.list.textContent = '';
    palItems = hits;
    palIdx = 0;
    if (!hits.length) {
      var empty = mk('li', 'pal-item');
      empty.setAttribute('aria-disabled', 'true');
      empty.appendChild(mk('span', 'pal-kind', '—'));
      empty.appendChild(mk('span', 'pal-title', say('pal.none', 'No match')));
      pal.list.appendChild(empty);
      pal.input.removeAttribute('aria-activedescendant');
      return;
    }
    hits.forEach(function (h, i) {
      var li = mk('li', 'pal-item');
      li.id = 'palOpt' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      li.appendChild(mk('span', 'pal-kind', h.c.kind));
      var title = mk('span', 'pal-title');
      if (h.marks.length === 3) {
        title.appendChild(doc.createTextNode(h.marks[0]));
        title.appendChild(mk('mark', null, h.marks[1]));
        title.appendChild(doc.createTextNode(h.marks[2]));
      } else title.textContent = h.c.title;
      li.appendChild(title);
      li.appendChild(mk('span', 'pal-key', h.c.hint || ''));
      li.addEventListener('click', function () { runPal(i); });
      pal.list.appendChild(li);
    });
    pal.input.setAttribute('aria-activedescendant', 'palOpt0');
  }

  function selectPal(i) {
    if (!pal || !palItems.length) return;
    palIdx = (i + palItems.length) % palItems.length;
    qa('.pal-item', pal.list).forEach(function (li, j) {
      li.setAttribute('aria-selected', j === palIdx ? 'true' : 'false');
      if (j === palIdx && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
    });
    pal.input.setAttribute('aria-activedescendant', 'palOpt' + palIdx);
  }

  function runPal(i) {
    var hit = palItems[i];
    closePalette();
    if (hit && hit.c.run) hit.c.run();
  }

  function palKeys(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); selectPal(palIdx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectPal(palIdx - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); runPal(palIdx); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'Tab') { trap(e, pal.box); }
  }

  function openPalette() {
    ensureEst();      // one of its answers is the estimator's own number
    buildPalette();
    palLast = doc.activeElement;
    pal.root.hidden = false;
    pal.input.value = '';
    filterPal('');
    pal.input.focus();
    doc.dispatchEvent(new CustomEvent('sash:palette', { detail: { open: true } }));
  }

  function closePalette() {
    if (!pal) return;
    pal.root.hidden = true;
    if (palLast && palLast.focus) palLast.focus();
  }

  /* ── 5b. the shortcut list — what ? says ───────────────────────

     every row here is a key that already does something on this page,
     and every word in it is a string the site already carries: the
     palette and terminal rows reuse the hud buttons, the close button
     reuses the palette's own "close". nothing is invented for the list,
     and print is absent from it because the browser owns that key. */

  var keysBox = null;
  var keysLast = null;

  function buildKeys() {
    if (keysBox) return keysBox;
    var title = say('keys.title', 'Keyboard shortcuts');

    var root = mk('div', 'keys');
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', title);

    var bg = mk('div', 'keys-bg');
    var box = mk('div', 'keys-box');
    box.appendChild(mk('h3', null, title));

    var list = mk('ul');
    [
      ['/ · Ctrl K', say('hud.palette', 'Palette')],
      ['`', say('hud.term', 'Terminal')],
      ['← →', say('keys.tabs', 'Move between the stack tabs')],
      ['Esc', say('keys.esc', 'Close what is open')],
      ['?', title]
    ].forEach(function (r) {
      var li = mk('li');
      li.appendChild(mk('kbd', null, r[0]));
      li.appendChild(mk('span', null, r[1]));
      list.appendChild(li);
    });
    box.appendChild(list);

    var foot = mk('div', 'keys-foot');
    var close = mk('button', null, say('pal.esc', 'close'));
    close.type = 'button';
    close.addEventListener('click', function () { toggleKeys(false); });
    foot.appendChild(close);
    box.appendChild(foot);

    root.appendChild(bg); root.appendChild(box);
    doc.body.appendChild(root);

    bg.addEventListener('click', function () { toggleKeys(false); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Tab') trap(e, box); });

    keysBox = { root: root, box: box };
    return keysBox;
  }

  function toggleKeys(force) {
    buildKeys();
    var show = (force === undefined) ? keysBox.root.hidden : !!force;
    if (show) keysLast = doc.activeElement;
    keysBox.root.hidden = !show;
    var close = q('button', keysBox.box);
    if (show) { if (close) close.focus(); }
    else if (keysLast && keysLast.focus) keysLast.focus();
  }

  /* ── 6. terminal — text in, text out. nothing is ever parsed as html */

  var term = null, termHist = [], termAt = 0;

  function buildTerm() {
    if (term) return term;
    var root = mk('div', 'term');
    root.hidden = true;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', say('term.h3', 'Terminal'));

    var box = mk('div', 'term-box');
    var hd = mk('div', 'term-hd');
    var dots = mk('span', 'dots');
    dots.appendChild(mk('i')); dots.appendChild(mk('i')); dots.appendChild(mk('i'));
    hd.appendChild(dots);
    hd.appendChild(mk('span', null, say('term.h3', 'Terminal') + ' — sash@baghdad'));
    var close = mk('button', null, '×');
    close.type = 'button';
    close.setAttribute('aria-label', say('term.close', 'Close'));
    close.addEventListener('click', function () { toggleTerm(false); });
    hd.appendChild(close);

    var out = mk('div', 'term-out');
    out.id = 'termOut';
    out.setAttribute('role', 'log');
    out.setAttribute('aria-live', 'polite');

    var row = mk('div', 'term-in');
    var prompt = mk('span', null, 'sash@baghdad:~$');
    var input = mk('input');
    input.type = 'text';
    input.id = 'termIn';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', say('term.label', 'Command'));
    input.spellcheck = false;
    row.appendChild(prompt); row.appendChild(input);

    box.appendChild(hd); box.appendChild(out); box.appendChild(row);
    root.appendChild(box);
    doc.body.appendChild(root);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var v = input.value;
        input.value = '';
        if (v.trim()) { termHist.push(v); termAt = termHist.length; }
        tLine('sash@baghdad:~$ ' + v, 't-dim');
        runCmd(v);
        out.scrollTop = out.scrollHeight;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (termAt > 0) { termAt--; input.value = termHist[termAt] || ''; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (termAt < termHist.length - 1) { termAt++; input.value = termHist[termAt] || ''; }
        else { termAt = termHist.length; input.value = ''; }
      } else if (e.key === 'Escape') {
        toggleTerm(false);
      }
    });

    // assign before the first tLine(): tLine calls buildTerm(), which is
    // still running here, so an unassigned term would recurse forever.
    term = { root: root, out: out, input: input };
    tLine(say('term.motd', 'BG Hussein Sash — datasheet terminal. type "help".'), 't-acc');
    return term;
  }

  function tLine(text, cls) {
    buildTerm();
    var p = mk('p', cls || null, text);
    term.out.appendChild(p);
    while (term.out.children.length > 240) term.out.removeChild(term.out.firstChild);
  }

  function toggleTerm(force) {
    buildTerm();
    var show = (force === undefined) ? term.root.hidden : !!force;
    term.root.hidden = !show;
    if (show) term.input.focus();
  }

  var CMDS = {};

  CMDS.help = function () {
    tLine(Object.keys(CMDS).sort().join('  ·  '), 't-acc');
    tLine(say('term.helpNote', 'commands are read-only: they do what the page buttons do'), 't-dim');
  };

  CMDS.whoami = function () {
    tLine('hussein majed aidan — bg hussein sash');
    tLine(say('term.whoami1', 'it manager & software engineer · baghdad, iraq'));
    tLine(say('term.whoami2', 'erp · full stack · flutter · servers & networks'));
  };

  CMDS.date = function () {
    var t = baghdad();
    tLine('baghdad ' + pad(t.getUTCHours()) + ':' + pad(t.getUTCMinutes()) + ':' + pad(t.getUTCSeconds()) + ' utc+3 · ' +
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getUTCDay()] + ' ' + t.toISOString().slice(0, 10));
  };

  CMDS.ls = function (arg) {
    if (!arg) { qa('section[id]').forEach(function (s) { tLine(s.id); }); return; }
    // section ids are literal dom ids, never translated — only the lead-in is
    tLine(say('term.usage', 'usage') + ': open <work|services|process|stack|pricing|contact>', 't-dim');
  };

  CMDS.open = function (arg) {
    if (!arg) { tLine(say('term.usage', 'usage') + ': open <section>', 't-err'); return; }
    var t = q('#' + arg.replace(/[^a-z0-9_-]/gi, ''));
    if (!t) { tLine(say('term.nosection', 'no such section') + ': ' + arg, 't-err'); return; }
    go('#' + t.id);
    tLine(say('term.opened', 'opened') + ' #' + t.id, 't-acc');
  };

  CMDS.lang = function (arg) {
    var sel = q('#langSelect');
    if (!arg) { tLine((S ? S.langs() : []).join(' '), 't-acc'); return; }
    if (!sel) return;
    sel.value = arg;
    if (sel.value !== arg) { tLine(say('term.nolang', 'no such language') + ': ' + arg, 't-err'); return; }
    sel.dispatchEvent(new Event('change'));
    tLine('lang → ' + arg, 't-acc');
  };

  CMDS.theme = function () {
    var b = q('#themeBtn');
    if (!b) return;
    var was = html.dataset.theme || 'dark';
    b.click();
    // main.js may ride a view transition, so the attribute lands a frame later
    var tries = 0;
    (function settle() {
      var now = html.dataset.theme || 'dark';
      if (now !== was || ++tries > 30) { tLine('theme → ' + now, 't-acc'); return; }
      requestAnimationFrame(settle);
    })();
  };

  CMDS.estimate = function (arg) {
    ensureEst();      // the question is about the form, so the form has to exist
    var f = readForm();
    if (arg && TYPES.some(function (t) { return t.id === arg; })) {
      var r = q('#estTypes input[value="' + arg + '"]');
      if (r) { r.checked = true; paintEstimate(); f = readForm(); }
    }
    var c = compute(f);
    tLine(typeName(f.type) + ' · ' + f.n + ' ' + say(f.type.unitKey, f.type.ufb) + ' · ' + say(f.speed.key, f.speed.fb), 't-acc');
    tLine(money(c.usd, 'USD') + (f.type.monthly ? '/mo' : '') + '  ≈  ' + money(c.usd, f.cur) + ' ' + f.cur + '  ·  ' + c.weeks + ' ' + say('est.weeks', 'weeks'));
    tLine(say('est.note', 'Fixed written quote before any work starts.'), 't-dim');
  };

  CMDS.gh = function () {
    var grid = q('#gh .gh-grid');
    if (!grid || grid.hidden || !grid.children.length) { tLine(say('gh.off', 'github data unavailable offline'), 't-err'); return; }
    qa('.gh-name', grid).forEach(function (n) { tLine(n.textContent); });
    tLine('https://github.com/' + GH_USER, 't-dim');
  };

  // the terminal is a text device: buttons are ui, not content, so they never
  // belong in a readout of the sheet. adjacent inline elements get a separator —
  // html puts no whitespace between them and the sheet relies on the styling.
  function tText(node) {
    var clone = node.cloneNode(true);
    qa('button', clone).forEach(function (b) { b.parentNode.removeChild(b); });
    if (!clone.children.length) return clone.textContent.replace(/\s+/g, ' ').trim();
    var parts = [];
    Array.prototype.forEach.call(clone.childNodes, function (c) {
      var s = c.nodeType === 3 ? c.nodeValue.replace(/\s+/g, ' ').trim() : tText(c);
      if (s) parts.push(s);
    });
    return parts.join(' · ');
  }

  CMDS.cat = function (arg) {
    var map = { contact: '.contact-info dl > div', pricing: '.price-card', stack: '#stackField span' };
    var sel = map[(arg || '').toLowerCase()];
    var nodes = sel ? qa(sel) : [];
    if (!nodes.length) { tLine(say('term.usage', 'usage') + ': cat <contact|pricing|stack>', 't-err'); return; }
    nodes.forEach(function (n) {
      var parts = [];
      Array.prototype.forEach.call(n.children, function (c) {
        if (c.tagName === 'BUTTON') return;
        var s = tText(c);
        if (s) parts.push(s);
      });
      var line = parts.join(' · ') || tText(n);
      if (line) tLine(line);
    });
  };

  CMDS.mail = function () { if (S) { tLine('mailto:' + S.mail, 't-acc'); location.href = 'mailto:' + S.mail; } };
  CMDS.phone = function () { tLine('tel:+' + (S ? S.phone : ''), 't-acc'); };
  CMDS.wa = function () { if (S) { tLine(S.wa('Hello — from the terminal.'), 't-dim'); open(S.wa('Hello — from the terminal.')); } };
  CMDS.print = function () { tLine(say('term.printing', 'opening the a4 spec sheet…'), 't-acc'); setTimeout(function () { doc.defaultView.print(); }, 120); };
  CMDS.pal = function () { openPalette(); };
  CMDS.clear = function () { if (term) term.out.textContent = ''; };
  CMDS.exit = function () { toggleTerm(false); };

  function runCmd(line) {
    var parts = String(line).trim().split(/\s+/);
    var name = (parts.shift() || '').toLowerCase().replace(/[^a-z]/g, '');
    if (name === 'sudo') { tLine(say('term.sudo', 'nice try — this desk has one admin'), 't-acc'); name = (parts.shift() || '').toLowerCase().replace(/[^a-z]/g, ''); }
    if (!name) return;
    if (!CMDS[name]) { tLine(name + ': ' + say('term.unknown', 'command not found') + ' — ' + say('term.tryHelp', 'try help'), 't-err'); return; }
    try { CMDS[name](parts.join(' ')); }
    catch (e) { tLine(say('term.err', 'error') + ': ' + (e && e.message ? e.message : 'unknown'), 't-err'); }
  }

  /* ── 7. global keys ────────────────────────────────────────── */

  function keys() {
    doc.addEventListener('keydown', function (e) {
      var typing = /^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '');
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (pal && !pal.root.hidden) closePalette(); else openPalette();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) return;   // leave print alone
      if (e.key === '?' && !typing) { e.preventDefault(); toggleKeys(); return; }
      if (e.key === '/' && !typing) { e.preventDefault(); openPalette(); return; }
      if (e.key === '`' && !typing) { e.preventDefault(); toggleTerm(); return; }
      if (e.key === 'Escape') {
        if (keysBox && !keysBox.root.hidden) toggleKeys(false);
        else if (pal && !pal.root.hidden) closePalette();
        else if (term && !term.root.hidden) toggleTerm(false);
      }
    });
  }

  /* ── 8. language: everything repaints from the same words ───── */

  function repaint() {
    paintAvail();
    paintEstimate();
    // the github block is built once from a fetch, so without this a
    // visitor who arrived in english and switched later keeps english
    if (ghLast) paintGh(ghLast.box, ghLast.data, ghLast.fromCache);
    if (hudRepaint) hudRepaint();
    if (pal && !pal.root.hidden) filterPal(pal.input.value);
    // the shortcut list is made of words too: rebuilt in the new language
    // rather than left behind in the old one
    if (keysBox) {
      var wasOpen = !keysBox.root.hidden;
      if (keysBox.root.parentNode) keysBox.root.parentNode.removeChild(keysBox.root);
      keysBox = null;
      if (wasOpen) toggleKeys(true);
    }
  }

  /* ── init ──────────────────────────────────────────────────── */

  function start() {
    if (!window.SASH) { setTimeout(start, 60); return; }
    S = window.SASH;
    try {
      buildHud();
      paintAvail();
      setInterval(paintAvail, 30000);
      doc.addEventListener('bgsash:avail', paintAvail);   // the tally answers late
      armEst();
      keys();
      doc.addEventListener('sash:lang', function () { setTimeout(repaint, 30); });
    } catch (e) {
      // the datasheet layer is decoration: never break the page it decorates
      if (window.console && console.warn) console.warn('spec.js', e);
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})();
