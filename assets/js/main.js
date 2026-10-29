/* main.js — the whole site in one file. no frameworks, no build step.
   written to be read: translations first, then the loader and hero,
   then everything scroll-driven, then the dull but important stuff
   (form, clipboard, copy protection).
   last touched: oct 2026. chrome / safari / firefox, all good. */

(function () {
  'use strict';

  var doc = document;
  var html = doc.documentElement;
  var q = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var qa = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };

  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;   // os-level "slow down"
  var realMouse = matchMedia('(pointer: fine)').matches;               // actual mouse, not touch
  var motion = !!window.gsap && !calm;                                 // do we get the fancy stuff
  var scrub = motion && !!window.ScrollTrigger;
  if (scrub) gsap.registerPlugin(ScrollTrigger);
  if (!motion) html.classList.add('no-gsap');

  var MAIL = 'sash0750605070607@gmail.com';
  var flipped = ['ar', 'ku'];   // scripts that read right-to-left
  var letCopy = false;          // our own "copy" button bypasses the guard below

  /* ── translations ─────────────────────────────────────────
     the json holds every language. en and ar are complete; the
     rest carry translated chrome and fall back to english per
     key, so a half-finished language never leaves holes.      */

  var words = {};
  var lang = 'en';

  // ticker items are arrays; they're addressed as key.1, key.2 … (1-based)
  function dig(node, path) {
    if (!node) return null;
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (node == null) return null;
      if (Array.isArray(node)) {
        var n = parseInt(parts[i], 10);
        node = isFinite(n) ? node[n - 1] : null;
      } else {
        node = node[parts[i]];
      }
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

  function row(key) {          // for the tickers
    var v = dig(words[lang], key) || dig(words.en, key);
    return Array.isArray(v) ? v : [];
  }

  function remember() {
    try { return localStorage.getItem('lang'); } catch (e) { return null; }
  }

  // browser says "ckb" (sorani) or "zh-CN"/"pt-BR" style codes — map them
  // onto the languages we actually carry, so nobody lands on english by luck
  var aliases = {
    ckb: 'ku', kmr: 'ku', sorani: 'ku',
    'zh-cn': 'zh', 'zh-tw': 'zh', 'zh-hk': 'zh', 'cmn': 'zh',
    'pt': 'en', 'pt-br': 'en', 'it': 'en', 'nl': 'en', 'pl': 'en',
    'fa': 'ar', 'ur': 'ar', 'ps': 'ar', 'di': 'ar', 'ckb-ir': 'ku'
  };

  function pick() {
    var fromUrl = '';
    try { fromUrl = (new URLSearchParams(location.search).get('lang') || '').toLowerCase(); } catch (e) {}
    var saved = remember();
    var browser = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    var raw = (fromUrl || saved || browser || 'en').toLowerCase();
    var base = raw.split('-')[0];

    if (words[raw]) return raw;
    if (words[base]) return base;
    if (aliases[raw]) return aliases[raw];
    if (aliases[base]) return aliases[base];
    return 'en';
  }

  function speak(code) {
    if (!code) code = 'en';
    if (Object.keys(words).length && !words[code]) code = 'en';
    lang = code;
    try { localStorage.setItem('lang', code); } catch (e) {}

    var rtl = flipped.indexOf(code) > -1;
    html.lang = code;
    html.dir = rtl ? 'rtl' : 'ltr';

    qa('[data-i18n]').forEach(function (el) {
      var val = say(el.getAttribute('data-i18n'), null);
      if (typeof val === 'string') el.textContent = val;
    });

    // textcontent above wiped the per-letter spans — rebuild where the
    // script makes sense, never for arabic/kurdish (letters must join).
    // headings first: slice() re-adds their aria-label from fresh text
    qa('h1, h2, h3').forEach(function (h) { h.removeAttribute('aria-label'); });
    qa('.split').forEach(function (el) { el.removeAttribute('aria-hidden'); });
    qa('.split').forEach(slice);
    q('#contact-title').classList.toggle('hover-chars', !rtl);

    wordsAgain();
    if (openProject) paintDialog(openProject);

    var title = say('meta.title');
    if (title) doc.title = title;
    var tag = q('meta[name="description"]');
    if (tag && say('meta.description')) tag.setAttribute('content', say('meta.description'));

    var pickLang = q('#langSelect');
    if (pickLang && pickLang.value !== code) pickLang.value = code;

    // whatsapp opens with the greeting already written in the visitor's language
    var wa = q('#waLink');
    if (wa) {
      var hello = say('contact.waMsg');
      wa.href = 'https://wa.me/9647762425266?text=' + encodeURIComponent(hello || '');
    }

    // the CV the hero + contact point at follows the visitor's language
    var rtlCv = flipped.indexOf(code) > -1 ? 'CV-ar.pdf' : 'CV-en.pdf';
    qa('.cv-link').forEach(function (a) { a.href = 'assets/cv/' + rtlCv; });

    wallClock();
    buildRail();
    if (scrub) ScrollTrigger.refresh();
  }

  function loadLanguages() {
    // bust: the json changes with every release, the browser must not sit on it
    return fetch('assets/i18n/translations.json?v=r09b')
      .then(function (r) { return r.json(); })
      .catch(function (e) { console.warn('translations missing', e); return {}; })
      .then(function (json) { words = json; });
  }

  /* ── per-letter wrapping ──────────────────────────────────
     treewalker so <em> and friends survive inside the heading.
     spaces become fixed-width spans so the line doesn't reflow
     while letters fly in.                                     */

  function slice(el) {
    if (html.dir === 'rtl') { el.removeAttribute('aria-label'); el.removeAttribute('aria-hidden'); return []; }
    var done = qa('.ch', el);
    if (done.length) return done;

    // the accessible name lives on the heading (role allows aria-label);
    // the split fragments get aria-hidden so screen readers don't hear
    // letters one by one.
    var plain = el.textContent.trim();
    var head = el.closest('h1, h2, h3');
    if (head && plain) {
      head.setAttribute('aria-label', ((head.getAttribute('aria-label') || '') + ' ' + plain).trim());
    }
    if (plain) el.setAttribute('aria-hidden', 'true');

    var walk = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);

    nodes.forEach(function (node) {
      var bits = doc.createDocumentFragment();
      (node.nodeValue || '').split('').forEach(function (chr) {
        var s = doc.createElement('span');
        s.className = chr === ' ' ? 'ch sp' : 'ch';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = chr === ' ' ? '\u00A0' : chr;
        bits.appendChild(s);
      });
      node.parentNode.replaceChild(bits, node);
    });
    return qa('.ch', el);
  }

  /* ── the clock in the corner ────────────────────────────── */

  var hhmmss = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Baghdad', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  function wallClock() {
    var el = q('#clock');
    if (!el) return;
    el.textContent = (say('hero.city', null) || 'Baghdad') + ' ' + hhmmss.format(new Date()) + ' · UTC+3';
  }

  /* ── loader, intro, typing ────────────────────────────────
     two gates: the counter finishing and the translations
     arriving. whichever is slow, the page still opens — there
     are failsafe timers so nobody waits on a dead cdn.       */

  var counted = false, loaded = false, opened = false, typed = false;

  function removeLoader() {
    var l = q('#loader');
    if (!l) return;
    l.classList.add('done');
    l.style.display = 'none';
  }

  function checkGates() {
    if (!counted || !loaded || opened) return;
    opened = true;
    curtainUp();
  }

  function targets(sel) {          // letters if split, the element if not (rtl)
    var el = q(sel);
    if (!el) return [];
    var letters = qa('.ch', el);
    return letters.length ? letters : [el];
  }

  function curtainUp() {
    if (!motion) { removeLoader(); return; }

    gsap.to('#loader', { yPercent: -100, duration: 1, ease: 'expo.inOut', onComplete: removeLoader });

    gsap.timeline()
      .fromTo(targets('#heroName .l1'), { yPercent: 110, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: 0.035 }, 0)
      .fromTo(targets('#heroName .l2'), { yPercent: 110, rotate: 6 }, { yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: 0.035 }, 0.12)
      .fromTo('.badge', { scale: 0, rotate: -90, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 1.2, ease: 'back.out(1.6)' }, 0.5)
      .fromTo('.hero-top, .hero-foot', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.12 }, 0.6)
      .fromTo('.nav-in', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }, 0.7)
      .call(roleLine, null, 0.9);
  }

  function runCounter() {
    var el = q('#count');
    if (!motion || !el) { counted = true; return; }
    var at = 0;
    var tick = setInterval(function () {
      at = Math.min(100, at + Math.ceil(Math.random() * 6));
      el.textContent = ('00' + at).slice(-3);
      if (at >= 100) { clearInterval(tick); counted = true; checkGates(); }
    }, 40);
    setTimeout(function () {          // loader never holds the page hostage
      if (!counted) { clearInterval(tick); counted = true; checkGates(); }
    }, 4000);
  }

  var roleAt = 0, roleTimer = null;

  function roleLine() {
    if (typed) return;
    typed = true;
    var el = q('#role');
    if (!el) return;
    var jobs = row('hero.roles');
    if (calm || !jobs.length) { el.textContent = jobs[0] || ''; return; }

    (function next() {
      var word = jobs[roleAt % jobs.length];
      var i = 0;
      (function draw() {
        el.textContent = word.slice(0, i) + (i < word.length ? '▍' : '');
        if (i++ < word.length) roleTimer = setTimeout(draw, 50);
        else roleTimer = setTimeout(back, 1600);
      })();
      function back(k) {
        k = k === undefined ? word.length : k;
        el.textContent = word.slice(0, k) + (k > 0 ? '▍' : '');
        if (k > 0) roleTimer = setTimeout(function () { back(k - 1); }, 26);
        else { roleAt++; roleTimer = setTimeout(next, 200); }
      }
    })();
  }

  /* ── the little dot that follows the mouse ────────────────
     runs on requestanimationframe, so it works even when gsap
     is blocked or the visitor asked for reduced motion.       */

  function followPointer() {
    var dot = q('#cursor');
    if (!dot) return;
    if (!realMouse) { dot.remove(); return; }
    html.classList.add('has-cursor');

    var wantX = innerWidth / 2, wantY = innerHeight / 2;
    var atX = wantX, atY = wantY;

    addEventListener('pointermove', function (e) { wantX = e.clientX; wantY = e.clientY; }, { passive: true });

    (function frame() {
      atX += (wantX - atX) * 0.2;
      atY += (wantY - atY) * 0.2;
      dot.style.transform = 'translate(' + atX + 'px,' + atY + 'px)';
      requestAnimationFrame(frame);
    })();

    qa('a, button, select').forEach(function (el) {
      el.addEventListener('pointerenter', function () { dot.classList.add('grow'); });
      el.addEventListener('pointerleave', function () { dot.classList.remove('grow'); });
    });
    qa('.card').forEach(function (el) {
      el.addEventListener('pointerenter', function () { dot.classList.add('label'); });
      el.addEventListener('pointerleave', function () { dot.classList.remove('label'); });
    });
  }

  /* ── tickers ──────────────────────────────────────────────
     each row is duplicated once and slid by exactly -50%, so
     the loop has no seam. speed picks up with scroll velocity. */

  function marquee() {
    qa('.ticker-row').forEach(function (rowEl) {
      if (rowEl.dataset.dupe === '1') return;
      Array.prototype.slice.call(rowEl.children).forEach(function (kid) {
        var clone = kid.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        rowEl.appendChild(clone);
      });
      rowEl.dataset.dupe = '1';
    });
  }

  /* ── work rail: horizontal on desktop, swipe on phones ─── */

  var railTween = null;

  function buildRail() {
    if (!scrub) return;
    if (railTween) {
      if (railTween.scrollTrigger) railTween.scrollTrigger.kill(true);
      railTween.kill();
      railTween = null;
    }
    var rail = q('#track'), pin = q('#workPin');
    if (!rail || !pin) return;
    gsap.set(rail, { x: 0 });
    if (!matchMedia('(min-width: 900px)').matches) return;

    var away = function () { return Math.max(0, rail.scrollWidth - pin.clientWidth); };
    if (away() < 4) return;
    var mirror = html.dir === 'rtl';

    railTween = gsap.to(rail, {
      x: function () { return mirror ? away() : -away(); },
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        // computed live on every refresh — string starts go stale when the
        // browser restores a scroll position on reload
        start: function () { return (pin.getBoundingClientRect().top + scrollY) - innerHeight * 0.18; },
        end: function () { return '+=' + (away() + innerHeight * 0.2); },
        pin: true, pinSpacing: true, scrub: 0.8, invalidateOnRefresh: true
      }
    });
  }

  /* ── the about paragraph, one word at a time ────────────── */

  var paraTween = null;

  function wordsAgain() {
    var p = q('#aboutText');
    if (!p) return;
    if (paraTween) {
      if (paraTween.scrollTrigger) paraTween.scrollTrigger.kill();
      paraTween.kill();
      paraTween = null;
    }
    var parts = p.textContent.trim().replace(/\s+/g, ' ').split(' ');
    p.innerHTML = '';
    parts.forEach(function (w, i) {
      var s = doc.createElement('span');
      s.className = 'w';
      s.textContent = w;
      p.appendChild(s);
      if (i < parts.length - 1) p.appendChild(doc.createTextNode(' '));
    });
    var spans = qa('.w', p);
    if (scrub && spans.length) {
      // fade via colour (muted → fg), not opacity: every state of the
      // tween keeps a passing contrast ratio, dimmed or not
      var root = getComputedStyle(doc.documentElement);
      var dim = (root.getPropertyValue('--muted') || '#5b5a55').trim();
      var lit = (root.getPropertyValue('--fg') || '#101113').trim();
      paraTween = gsap.fromTo(spans, { color: dim }, {
        color: lit, stagger: 0.08, ease: 'none',
        scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 55%', scrub: true }
      });
    }
  }

  /* ── toolkit tabs (the stack section) ───────────────────── */

  var shelf = [
    ['HTML5', 'CSS3', 'JavaScript', 'PHP', 'MySQL', 'REST APIs', 'Firebase', 'Responsive UI'],
    ['Flutter', 'Dart', 'Android', 'iOS', 'REST APIs', 'Firebase'],
    ['C++', 'C#', 'ERP Systems', 'Database Design', 'Windows Server', 'Linux', 'Active Directory', 'Backups', 'Server Hardening'],
    ['CCNA', 'MikroTik', 'TCP/IP', 'Fiber Optic', 'CCTV', 'Structured Cabling'],
    ['Logo Design', 'Brand Identity', 'Social Creatives', 'Promo Design', 'Typography', 'Layout Design'],
    ['Git', 'GitHub', 'GitHub Pages', 'Vercel', 'Netlify', 'Firebase Hosting']
  ];

  function stockShelf(what, lively) {
    var box = q('#stackField');
    if (!box) return;
    if (motion) gsap.killTweensOf(qa('span', box));
    box.innerHTML = '';
    (shelf[what] || []).forEach(function (name) {
      var s = doc.createElement('span');
      s.textContent = name;
      box.appendChild(s);
    });
    var chips = qa('span', box);
    if (!motion || lively === false) return;
    gsap.from(chips, { scale: 0, opacity: 0, duration: 0.7, ease: 'back.out(1.7)', stagger: 0.05 });
    chips.forEach(function (c) {
      gsap.to(c, {
        y: 'random(-12, 12)', x: 'random(-10, 10)', rotation: 'random(-3, 3)',
        duration: 'random(2.2, 3.6)', repeat: -1, yoyo: true, ease: 'sine.inOut'
      });
    });
  }

  function shelfTabs() {
    var tabs = qa('.stack-tabs button');
    function pick(i) {
      tabs.forEach(function (b, j) { b.setAttribute('aria-selected', String(i === j)); });
      stockShelf(i);
    }
    tabs.forEach(function (btn, i) {
      btn.addEventListener('click', function () { pick(i); });
      btn.addEventListener('keydown', function (e) {
        var step = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1
          : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        var nextTab = (i + step + tabs.length) % tabs.length;
        tabs[nextTab].focus();
        pick(nextTab);
      });
    });
    stockShelf(0, false);
  }

  /* ── project dialog ─────────────────────────────────────── */

  var openProject = null;
  var cameFrom = null;

  function paintDialog(id) {
    var card = q('.card[data-project="' + id + '"]');
    if (!card) return;
    function p(field) { return say('projects.' + id + '.' + field, '') || ''; }

    var tag = p('tag'), when = p('when');
    q('#mTag').textContent = when ? tag + ' · ' + when : tag;
    q('#mTitle').textContent = p('title');
    q('#mDesc').textContent = p('desc');

    var pic = q('#mShot');
    pic.dataset.shot = card.dataset.shot || '';
    pic.innerHTML = '';
    var source = q('.shot .pic', card);
    if (source) {
      var big = doc.createElement('img');
      big.className = 'pic';
      big.src = source.currentSrc || source.src;
      big.width = source.naturalWidth || 1280;
      big.height = source.naturalHeight || 1006;
      big.alt = '';
      pic.appendChild(big);
    }
    var caption = doc.createElement('span');
    caption.className = 'lbl';
    caption.textContent = (q('.lbl', card) || {}).textContent || '';
    pic.appendChild(caption);

    var list = q('#mStack');
    list.innerHTML = '';
    ['c1', 'c2', 'c3'].forEach(function (k) {
      if (!p(k)) return;
      var li = doc.createElement('li');
      li.textContent = p(k);
      list.appendChild(li);
    });

    q('#mProblem').textContent = p('problem');
    q('#mSolution').textContent = p('solution');
    q('#mResult').textContent = p('result');

    var go = q('#mLive');
    if (card.dataset.url) { go.href = card.dataset.url; go.hidden = false; }
    else { go.hidden = true; go.removeAttribute('href'); }

    // full write-up lives on its own shareable page
    var cs = q('#mCase');
    if (cs) {
      if (card.dataset.cs) { cs.href = 'work/' + card.dataset.cs + '.html'; cs.hidden = false; }
      else { cs.hidden = true; cs.removeAttribute('href'); }
    }
  }

  function showDialog(card) {
    cameFrom = doc.activeElement;
    openProject = card.dataset.project;
    paintDialog(openProject);
    q('#modal').hidden = false;
    q('#modal .close').focus();
  }

  function hideDialog() {
    var box = q('#modal');
    if (!box || box.hidden) return;
    box.hidden = true;
    openProject = null;
    if (cameFrom && cameFrom.focus) cameFrom.focus();
  }

  function dialogWiring() {
    qa('.open').forEach(function (btn) {
      var card = btn.closest('.card');
      if (card) btn.addEventListener('click', function () { showDialog(card); });
    });
    var box = q('#modal');
    if (!box) return;
    qa('[data-close]', box).forEach(function (el) { el.addEventListener('click', hideDialog); });

    addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideDialog();
      if (e.key !== 'Tab' || box.hidden) return;
      var inside = qa('a[href], button, input, [tabindex]:not([tabindex="-1"])', q('.modal-box', box))
        .filter(function (el) { return !el.hidden && el.offsetParent !== null; });
      if (!inside.length) return;
      var first = inside[0], last = inside[inside.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ── order wizard ─────────────────────────────────────────
     three steps: what → details → contact. saves through the
     supabase edge function when configured; otherwise the
     summary rides a mailto/whatsapp link. never blocks the
     visitor: worst case the request opens in their mail app. */

  var SUPABASE_URL = '';        // e.g. 'https://xxxx.supabase.co'
  var SUBMIT_FN  = 'submit-request';
  var oStep = 1;
  var oOpen = false;

  function orderShow() {
    var box = q('#orderModal');
    if (!box) return;
    oOpen = true;
    box.hidden = false;
    oGo(1);
    if (q('#oName')) q('#oName').focus();
  }

  function orderHide() {
    var box = q('#orderModal');
    if (!box || box.hidden) return;
    box.hidden = true;
    oOpen = false;
    oGo(1);
    var st = q('#oStatus');
    if (st) st.textContent = '';
  }

  function orderData() {
    var f = q('#orderForm');
    return {
      service: (f.service && f.service.value) || 'other',
      details: (q('#oDetails') || {}).value || '',
      budget: (q('#oBudget') || {}).value || '',
      name: (q('#oName') || {}).value || '',
      email: (q('#oEmail') || {}).value || '',
      phone: (q('#oPhone') || {}).value || '',
      lang: lang
    };
  }

  function oGo(n) {
    oStep = n;
    qa('.o-step').forEach(function (fs) {
      var on = Number(fs.dataset.step) === n;
      fs.hidden = !on;
      if (on && motion) gsap.fromTo(fs, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: .45, ease: 'power2.out' });
    });
    var bar = q('#oBar');
    if (bar) bar.style.width = (n * 33.34) + '%';
    var num = q('#oStep');
    if (num) num.textContent = String(n);
    var back = q('#oBack');
    if (back) back.hidden = n === 1;
    var next = q('#oNext');
    if (next) {
      next.hidden = false;
      next.querySelector('span').textContent = say(n === 3 ? 'order.submit' : 'order.next') || (n === 3 ? 'Send request' : 'Next');
    }
  }

  function oValidate(n) {
    var bad = [];
    if (n === 2 && !q('#oDetails').value.trim()) bad.push(['#oDetailsErr', say('order.errDetails') || 'Describe the project.']);
    if (n === 3) {
      if (!q('#oName').value.trim()) bad.push(['#oNameErr', say('order.errName') || say('form.errName')]);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q('#oEmail').value.trim())) bad.push(['#oEmailErr', say('order.errEmail') || say('form.errEmail')]);
    }
    qa('.o-step .err').forEach(function (e) { e.textContent = ''; });
    bad.forEach(function (pair) { var el = q(pair[0]); if (el) el.textContent = pair[1]; });
    return !bad.length;
  }

  function waSummary(d) {
    var svc = '';
    qa('#oTypes input').forEach(function (r) {
      if (r.checked) {
        var label = r.parentElement.querySelector('span');
        svc = label ? label.textContent : svc;
      }
    });
    var budget = q('#oBudget');
    var budgetTxt = budget && budget.selectedOptions[0] ? budget.selectedOptions[0].textContent : '';
    return say('order.title') + '\n' +
      (say('order.s1h') || 'Service') + ': ' + svc + '\n' +
      (say('order.budget') || '') + ': ' + budgetTxt + '\n' +
      (d.details ? d.details + '\n' : '') +
      d.name + ' · ' + d.email + (d.phone ? ' · ' + d.phone : '');
  }

  function oSubmit() {
    var d = orderData();
    if (!oValidate(3)) return;
    var status = q('#oStatus');
    status.textContent = say('order.sending') || 'Sending…';

    function oFallback(dd) {
      status.textContent = '';
      var body = encodeURIComponent(waSummary(dd));
      location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Order — ' + dd.service) + '&body=' + body;
      oFinish(dd, false);
    }

    if (SUPABASE_URL) {
      fetch(SUPABASE_URL + '/functions/v1/' + SUBMIT_FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d)
      })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function () { oFinish(d, true); })
        .catch(function () { oFallback(d); });   // never lose the visitor
    } else {
      oFallback(d);
    }
  }

  function oFinish(d, saved) {
    q('#orderForm').hidden = true;
    var done = q('#oDone');
    done.hidden = false;
    if (motion) gsap.from(done, { opacity: 0, y: 14, duration: .5, ease: 'power2.out' });
    var wa = q('#oWa');
    if (wa) wa.href = 'https://wa.me/9647762425266?text=' + encodeURIComponent(waSummary(d));
    if (!saved) toast(say('order.offline') || '');
  }

  function wireOrder() {
    qa('.p-order, .pricing-custom [data-service]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var svc = btn.dataset.service;
        var radio = q('#oTypes input[value="' + svc + '"]');
        if (radio) radio.checked = true;
        orderShow();
      });
    });
    var box = q('#orderModal');
    if (!box) return;
    qa('[data-oclose]', box).forEach(function (el) { el.addEventListener('click', orderHide); });
    var back = q('#oBack');
    var next = q('#oNext');
    if (back) back.addEventListener('click', function () { oGo(Math.max(1, oStep - 1)); });
    if (next) next.addEventListener('click', function () {
      if (oStep < 3) { if (oValidate(oStep)) oGo(oStep + 1); }
      else oSubmit();
    });
    addEventListener('keydown', function (e) {
      if (!oOpen) return;
      if (e.key === 'Escape') orderHide();
      if (e.key !== 'Tab') return;
      var inside = qa('a[href], button, input, select, textarea', q('.order-box', box))
        .filter(function (el) { return !el.hidden && el.offsetParent !== null; });
      if (!inside.length) return;
      var first = inside[0], last = inside[inside.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ── reveals for the newer sections ─────────────────────── */

  function wireReveals() {
    var items = qa('.exp-item, .price-card');
    if (!items.length || !motion) return;      // reduced motion: they just sit there
    gsap.set(items, { opacity: 0, y: 34 });
    var show = function (batch) {
      gsap.to(batch, { opacity: 1, y: 0, duration: .8, ease: 'power3.out', stagger: 0.09, overwrite: true });
    };
    if (window.ScrollTrigger) {
      ScrollTrigger.batch(items, { start: 'top 88%', onEnter: show, once: true });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { show([en.target]); io.unobserve(en.target); } });
      }, { threshold: 0.15 });
      items.forEach(function (el) { io.observe(el); });
    }
  }

  /* ── clipboard + toast ──────────────────────────────────── */

  function toast(msg) {
    var el = q('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function wireCopy() {
    qa('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.dataset.copy;
        letCopy = true;                       // tells the guard below to step aside
        var done = function (ok) {
          letCopy = false;
          toast(ok ? (say('toast.copied') || 'Copied') : text);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
        } else legacy();

        function legacy() {
          try {
            var hold = doc.createElement('textarea');
            hold.value = text;
            hold.style.cssText = 'position:fixed;opacity:0;';
            doc.body.appendChild(hold);
            hold.select();
            done(doc.execCommand('copy'));
            hold.remove();
          } catch (e) { done(false); }
        }
      });
    });
  }

  /* ── contact form ─────────────────────────────────────────
     no backend on a static host, so a valid submit opens the
     visitor's mail app addressed to me. a hidden honeypot
     field filters the lazy bots.                             */

  function wireForm() {
    var form = q('#contactForm');
    if (!form) return;
    var status = q('#formStatus');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var trap = form.elements['company'];
      if (trap && trap.value) {
        if (status) status.textContent = say('form.sent') || 'Sending…';
        form.reset();
        return;
      }

      var checks = [
        [q('#name'), q('#nameErr'), function (v) { return v.trim().length >= 2 ? '' : say('form.errName', 'Enter your name.'); }],
        [q('#email'), q('#emailErr'), function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : say('form.errEmail', 'Enter a valid email address.'); }],
        [q('#message'), q('#msgErr'), function (v) { return v.trim().length >= 10 ? '' : say('form.errMessage', 'Tell me more.'); }]
      ];

      var fine = true;
      checks.forEach(function (rule) {
        var field = rule[0], err = rule[1], test = rule[2];
        if (!field) return;
        var complaint = test(field.value);
        if (err) err.textContent = complaint || '';
        field.setAttribute('aria-invalid', String(!!complaint));
        if (!complaint) return;
        fine = false;
        if (motion) gsap.fromTo(field, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,.3)' });
      });

      if (!fine) {
        if (status) status.textContent = say('form.fix', 'Please fix the highlighted fields.');
        return;
      }

      var name = q('#name').value.trim();
      var from = q('#email').value.trim();
      var note = q('#message').value.trim();
      location.href = 'mailto:' + MAIL
        + '?subject=' + encodeURIComponent('Portfolio — message from ' + name)
        + '&body=' + encodeURIComponent(note + '\n\n— ' + name + '\n' + from);
      if (status) status.textContent = say('form.sent') || 'Opening your mail app…';
      form.reset();
    });
  }

  /* ── theme + language switches ──────────────────────────── */

  /* theme + language switches ride the view transition api when the
     browser has it — a soft cross-fade instead of a hard swap.      */
  function redraw(fn) {
    if (document.startViewTransition && !calm) document.startViewTransition(fn);
    else fn();
  }

  function wireTheme() {
    var btn = q('#themeBtn');
    var meta = q('meta[name="theme-color"]');
    var sync = function () {
      if (meta) meta.setAttribute('content', html.dataset.theme === 'light' ? '#e9e6dd' : '#0e0f11');
      repaintFlow();                   // the hero panel reads the accent colour
    };
    sync();
    if (!btn) return;
    btn.addEventListener('click', function () {
      redraw(function () {
        html.dataset.theme = (html.dataset.theme || 'dark') === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('theme', html.dataset.theme); } catch (e) {}
        sync();
      });
    });
  }

  function wireLang() {
    var sel = q('#langSelect');
    if (!sel) return;
    sel.value = lang;
    sel.addEventListener('change', function () { redraw(function () { speak(sel.value); }); });
  }

  /* ── everything that moves while scrolling ────────────────
     one function, called once. if gsap never arrives the page
     still scrolls — there's a plain listener for the progress
     bar and that's it.                                       */

  var wired = false;

  function wireMotion() {
    if (wired) return;
    wired = true;

    if (!motion) {
      var bar = q('#progress');
      if (bar) {
        addEventListener('scroll', function () {
          var d = doc.documentElement;
          bar.style.transform = 'scaleX(' + (d.scrollTop / Math.max(1, d.scrollHeight - d.clientHeight)) + ')';
        }, { passive: true });
      }
      return;
    }

    gsap.to('#progress', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: doc.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
    });

    qa('.sec-head, .stack-tabs, .stack-field, .contact-info, #contactForm, .stat, .principles > div, .creds, .foot, .foot-mark')
      .forEach(function (el) {
        gsap.from(el, {
          y: 60, opacity: 0, duration: 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        });
      });

    // the contact heading rises per letter in ltr; in rtl it's a clip reveal
    var head = q('#contact-title');
    var letters = head ? qa('.ch', head) : [];
    if (head && letters.length) {
      gsap.from(letters, {
        yPercent: 110, duration: 1, ease: 'expo.out', stagger: 0.02,
        scrollTrigger: { trigger: head, start: 'top 85%', once: true }
      });
    }

    qa('.display').forEach(function (h) {
      if (h.id === 'contact-title' && letters.length) return;
      gsap.from(h, {
        clipPath: 'inset(0 0 100% 0)', y: 40, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: h, start: 'top 88%', once: true }
      });
    });

    gsap.to('#heroName', {
      yPercent: -12, ease: 'none',
      scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true }
    });

    qa('.ticker-row').forEach(function (rowEl) {
      var loop = (+rowEl.dataset.dir < 0)
        ? gsap.to(rowEl, { xPercent: -50, ease: 'none', duration: 28, repeat: -1 })
        : gsap.fromTo(rowEl, { xPercent: -50 }, { xPercent: 0, ease: 'none', duration: 28, repeat: -1 });
      if (!scrub) return;
      ScrollTrigger.create({
        onUpdate: function (self) {
          loop.timeScale(1 + Math.min(Math.abs(self.getVelocity()) / 900, 4));
        }
      });
    });

    buildRail();

    // service cards sink away as the next one slides over
    qa('.svc-card').forEach(function (card, i, all) {
      if (i === all.length - 1) return;
      gsap.to(card, {
        scale: 0.92, opacity: 0.45, ease: 'none',
        scrollTrigger: { trigger: all[i + 1], start: 'top bottom', end: 'top 120px', scrub: true }
      });
    });

    qa('[data-count]').forEach(function (el) {
      var end = +el.dataset.count;
      var run = { v: 0 };
      gsap.to(run, {
        v: end, duration: 1.8, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: function () { el.textContent = Math.round(run.v); }
      });
    });

    if (!realMouse) return;

    // 3D tilt: cards lean toward the pointer, spring back on leave
    qa('.card, .quote, .price-card').forEach(function (el) {
      var rect = null;
      el.addEventListener('pointerenter', function () { rect = el.getBoundingClientRect(); });
      el.addEventListener('pointermove', function (e) {
        if (!rect) rect = el.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        gsap.to(el, {
          rotationY: px * 7, rotationX: -py * 7, transformPerspective: 900,
          duration: 0.5, ease: 'power2.out'
        });
      });
      el.addEventListener('pointerleave', function () {
        rect = null;
        gsap.to(el, { rotationY: 0, rotationX: 0, duration: 0.9, ease: 'elastic.out(1,.45)' });
      });
    });

    qa('.magnet').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: (e.clientX - (r.left + r.width / 2)) * 0.28,
          y: (e.clientY - (r.top + r.height / 2)) * 0.35,
          duration: 0.4, ease: 'power3.out'
        });
      });
      btn.addEventListener('pointerleave', function () {
        gsap.to(btn, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1,.4)' });
      });
    });

    var mid = q('#heroMid'), cross = q('#crosshair');
    if (mid && cross) {
      mid.addEventListener('pointermove', function (e) {
        var r = mid.getBoundingClientRect();
        gsap.to(cross, { x: e.clientX - r.left, y: e.clientY - r.top, duration: 0.6, ease: 'power3.out' });
      });
    }
  }

  /* ── copy protection ──────────────────────────────────────
     layered on top of the css (user-select: none). right-click,
     ctrl+c/u/p/s, devtools shortcuts and dragging are blocked;
     the contact fields are exempt so the form stays usable.
     honest version: this stops casual copying and most ai
     scrapers that drive a real browser — nothing served as
     html can stop someone determined, so the headers in
     firebase.json do the rest (csp, x-frame-options, etc).   */

  function typing(e) {
    var t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  function guard() {
    doc.addEventListener('contextmenu', function (e) {
      if (!typing(e)) e.preventDefault();
    });

    doc.addEventListener('copy', function (e) {
      if (letCopy || typing(e)) return;
      e.preventDefault();
    });
    doc.addEventListener('cut', function (e) {
      if (typing(e)) return;
      e.preventDefault();
    });
    doc.addEventListener('dragstart', function (e) { e.preventDefault(); });

    doc.addEventListener('keydown', function (e) {
      var key = e.key.toLowerCase();
      var mod = e.ctrlKey || e.metaKey;

      if (e.key === 'F12') return e.preventDefault();
      if (!mod) return;

      // typing in the form keeps its usual shortcuts
      if (typing(e) && ['c', 'x', 'v', 'a'].indexOf(key) > -1) return;

      var denied = ['u', 'p', 's', 'c', 'x', 'a', 'j', 'i'];
      if (denied.indexOf(key) > -1) return e.preventDefault();
      if (e.shiftKey && ['i', 'j', 'c', 's'].indexOf(key) > -1) return e.preventDefault();
    });

    // if someone embeds us in a frame anyway, break out of it
    try {
      if (top !== self) top.location.replace(location.href);
    } catch (err) { location.replace(location.href); }
  }

  /* ── hero motion panel ────────────────────────────────────
     a canvas of drifting short lines, bent by a slow sine
     field and nudged by the pointer. tinted with the accent
     colour, so it follows the theme. one static frame is
     drawn for reduced-motion visitors and that's the end of it. */

  var flow = null, flowCtx = null, streaks = [], flowW = 0, flowH = 0, flowDPR = 1;
  var flowAccent = '#ff4d1a', flowFrame = null, flowSeen = true, pointerX = -999, pointerY = -999;

  function repaintFlow() {
    var v = getComputedStyle(html).getPropertyValue('--accent').trim();
    if (v) flowAccent = v;
  }

  function sizeFlow() {
    if (!flow) return;
    flowDPR = Math.min(devicePixelRatio || 1, 2);
    var r = flow.getBoundingClientRect();
    flowW = Math.max(1, Math.round(r.width));
    flowH = Math.max(1, Math.round(r.height));
    flow.width = flowW * flowDPR;
    flow.height = flowH * flowDPR;
    flowCtx.setTransform(flowDPR, 0, 0, flowDPR, 0, 0);

    var count = Math.round(Math.min(90, Math.max(36, flowW * flowH / 22000)));
    streaks = [];
    for (var i = 0; i < count; i++) {
      streaks.push({
        x: Math.random() * flowW,
        y: Math.random() * flowH,
        len: 14 + Math.random() * 42,
        spd: 0.5 + Math.random() * 1.3,
        alpha: 0.10 + Math.random() * 0.35
      });
    }
  }

  function flowStep(now) {
    var t = now * 0.00012;
    flowCtx.clearRect(0, 0, flowW, flowH);
    flowCtx.lineCap = 'round';

    for (var i = 0; i < streaks.length; i++) {
      var s = streaks[i];
      // slow sine/cos field — cheap stand-in for real flow noise
      var a = Math.sin(s.x * 0.0035 + t) + Math.cos(s.y * 0.0042 - t * 0.8);

      var vx = Math.cos(a * Math.PI) * s.spd;
      var vy = Math.sin(a * Math.PI) * s.spd;

      var dx = s.x - pointerX, dy = s.y - pointerY;
      var near = dx * dx + dy * dy;
      if (near < 19600) {                       // ~140px: gentle shove away from the cursor
        var push = (1 - Math.sqrt(near) / 140) * 1.6;
        vx += (dx / (Math.sqrt(near) + 1)) * push;
        vy += (dy / (Math.sqrt(near) + 1)) * push;
      }

      s.x += vx; s.y += vy;
      if (s.x < -60) s.x = flowW + 60; else if (s.x > flowW + 60) s.x = -60;
      if (s.y < -60) s.y = flowH + 60; else if (s.y > flowH + 60) s.y = -60;

      var back = s.len / (Math.sqrt(vx * vx + vy * vy) + 0.001);
      flowCtx.strokeStyle = flowAccent;
      flowCtx.globalAlpha = s.alpha;
      flowCtx.lineWidth = 1;
      flowCtx.beginPath();
      flowCtx.moveTo(s.x - vx * back, s.y - vy * back);
      flowCtx.lineTo(s.x, s.y);
      flowCtx.stroke();
    }
    flowCtx.globalAlpha = 1;

    if (!calm && flowSeen && !doc.hidden) flowFrame = requestAnimationFrame(flowStep);
    else flowFrame = null;
  }

  function startFlow() {
    flow = q('#flow');
    if (!flow || !flow.getContext) return;
    flowCtx = flow.getContext('2d');
    repaintFlow();
    sizeFlow();

    if (calm) { flowStep(0); return; }          // one still frame, done

    flowFrame = requestAnimationFrame(flowStep);

    addEventListener('resize', function () { sizeFlow(); });
    doc.addEventListener('visibilitychange', function () {
      if (!doc.hidden && !flowFrame && flowSeen) flowFrame = requestAnimationFrame(flowStep);
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        flowSeen = entries[0].isIntersecting;
        if (flowSeen && !flowFrame && !doc.hidden) flowFrame = requestAnimationFrame(flowStep);
      }).observe(flow);
    }

    addEventListener('pointermove', function (e) {
      var r = flow.getBoundingClientRect();
      pointerX = e.clientX - r.left;
      pointerY = e.clientY - r.top;
    }, { passive: true });
  }

  /* ── privacy analytics (umami) ─────────────────────────────
     no cookies, no fingerprinting, nothing leaves the page until
     these two values are filled in. drop in a self-hosted umami
     instance (or cloud.umami.is) and the script loads by itself.  */
  var UMAMI_SRC = '';      // e.g. 'https://cloud.umami.is/script.js'
  var UMAMI_ID  = '';      // e.g. 'xxxxxxxx-xxxx-....'

  function watchVisits() {
    if (!UMAMI_SRC || !UMAMI_ID || !doc.body) return;
    var s = doc.createElement('script');
    s.defer = true;
    s.src = UMAMI_SRC;
    s.dataset.websiteId = UMAMI_ID;
    doc.head.appendChild(s);
  }

  /* ── boot ───────────────────────────────────────────────── */

  var settled = false;

  function ready() {
    if (settled) return;
    settled = true;
    speak(pick());
    wireMotion();
    if (!motion) roleLine();
    loaded = true;
    checkGates();
  }

  function start() {
    guard();
    if (!motion) removeLoader();

    // install the offline shell — ignored silently where sw isn't allowed
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      addEventListener('load', function () {
        navigator.serviceWorker.register('/service-worker.js').catch(function () {});
      });
    }

    qa('.split').forEach(slice);
    wordsAgain();
    wireTheme();
    wireLang();
    marquee();
    wallClock();
    setInterval(wallClock, 1000);
    followPointer();
    dialogWiring();
    wireOrder();
    wireCopy();
    wireForm();
    wireReveals();
    shelfTabs();
    startFlow();
    runCounter();
    watchVisits();

    loadLanguages().then(ready);
    setTimeout(ready, 4000);                   // slow or failed json still opens the door

    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(function () { if (scrub) ScrollTrigger.refresh(); });
    }
    addEventListener('load', function () { if (scrub) ScrollTrigger.refresh(); });

    var waiting = null;
    addEventListener('resize', function () {
      clearTimeout(waiting);
      waiting = setTimeout(function () {
        if (!scrub) return;
        buildRail();
        ScrollTrigger.refresh();
      }, 250);
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
  else start();
})();
