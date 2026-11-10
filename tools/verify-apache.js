/* tools/verify-apache.js — does the deployed site behave like the site?
     node tools/verify-apache.js http://127.0.0.1:8093
     node tools/verify-apache.js https://bghusseinsash.rf.gd

   verify-shell.js proves every file the service worker promises actually
   ships. this proves the other half: that the host serving those files
   honours .htaccess. the two things that go wrong on a shared Apache host
   are invisible in the file list —

   · mod_rewrite off, or AllowOverride not granting it. the home page loads,
     every stylesheet loads, and the first click on any link is a 404,
     because not one page on this site links to a .html file.

   · mod_headers off. the site still works — the CSP <meta> tag on every
     page holds the line — but the headers are gone, and with them
     frame-ancestors and HSTS, which a meta tag cannot carry.

   so both are checked separately, and the second is reported as what it is:
   a downgrade, not a broken site. */

'use strict';

const { HEADERS, ADMIN_HEADERS } = require('./security-config');

const BASE = String(process.argv[2] || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(BASE)) {
  console.error('usage: node tools/verify-apache.js <base-url>');
  process.exit(2);
}

const results = { pass: 0, fail: [], warn: [] };

async function get(p) {
  const res = await fetch(BASE + p, { redirect: 'manual' });
  const h = {};
  res.headers.forEach((v, k) => { h[k.toLowerCase()] = v; });
  return { status: res.status, headers: h, location: res.headers.get('location'), text: () => res.text() };
}

function want(label, got, expected) {
  if (got === expected) { results.pass++; return true; }
  results.fail.push(label + '\n        want: ' + expected + '\n        got : ' + got);
  return false;
}

const ROUTES_200 = [
  '/', '/privacy', '/terms', '/404', '/admin',
  '/work/bookly', '/work/smartmaid', '/work/mukallaf',
  '/work/flossk', '/work/ziona-passports', '/work/hala-sat',
  '/manifest.webmanifest', '/service-worker.js', '/robots.txt', '/sitemap.xml',
  '/feed.xml', '/atom.xml', '/llms.txt', '/llms-full.txt',
  '/api/profile.json', '/.well-known/security.txt',
  '/assets/cv/CV-en.pdf', '/assets/cv/CV-ar.pdf',
  '/assets/favicon.svg', '/assets/shots/og-cover.png'
];

/* these carry the release token, which is read off the deployed home page
   rather than written here: a token hardcoded in a checker is a checker that
   silently stops checking the day the ritual moves it on. */
const TOKENED = [
  '/assets/css/style.css', '/assets/css/fonts.css', '/assets/css/spec.css',
  '/assets/js/main.js', '/assets/js/tally.js', '/assets/i18n/ar.json'
];

const ROUTES_301 = {
  '/index.html': '/',
  '/privacy.html': '/privacy',
  '/terms.html': '/terms',
  '/admin.html': '/admin',
  '/404.html': '/404',
  '/work/bookly.html': '/work/bookly'
};

const ROUTES_404 = ['/definitely-not-here', '/work/nope', '/assets/css/nope.css'];

async function main() {
  /* every url is fetched against a version token read from the live home
     page, so this verifies the copy that is actually deployed rather than
     the one on disk — a stale asset would otherwise pass. */
  const home = await get('/');
  want('home page serves', home.status, 200);
  const html = await home.text();
  const token = (html.match(/[?&]v=(r\d+)/) || [])[1];
  if (token) console.log('deployed token: ' + token);
  else results.warn.push('no ?v=rNN token found on the deployed home page');
  const CSS = '/assets/css/style.css' + (token ? '?v=' + token : '');

  console.log('\n== clean urls serve (200) ==');
  const routes = ROUTES_200.concat(token ? TOKENED.map((p) => p + '?v=' + token) : TOKENED);
  for (const p of routes) {
    const r = await get(p);
    if (want('  ' + p, r.status, 200)) console.log('  ok   200  ' + p);
  }

  console.log('\n== .html urls redirect to the clean one (301) ==');
  for (const p of Object.keys(ROUTES_301)) {
    const r = await get(p);
    const ok = want('  ' + p + ' status', r.status, 301);
    const target = (r.location || '').replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/';
    const ok2 = want('  ' + p + ' target', target, ROUTES_301[p]);
    if (ok && ok2) console.log('  ok   301  ' + p + ' -> ' + ROUTES_301[p]);
  }

  console.log('\n== a miss is a real 404, wearing the real page ==');
  for (const p of ROUTES_404) {
    const r = await get(p);
    if (want('  ' + p, r.status, 404)) {
      const body = await r.text();
      if (/<title>404/.test(body)) { results.pass++; console.log('  ok   404  ' + p + ' (renders the shipped 404 page)'); }
      else results.fail.push('  ' + p + ' answers 404 but does not render the shipped 404 page — a bare host error leaks the server name');
    }
  }

  console.log('\n== the policy, verbatim, on a page / an asset / a 404 ==');
  let headersAtAll = true;
  for (const probe of ['/', '/work/bookly', CSS, '/definitely-not-here']) {
    const r = await get(probe);
    Object.keys(HEADERS).forEach((k) => {
      const got = r.headers[k.toLowerCase()];
      if (got === undefined && probe === '/') headersAtAll = false;
      if (want('  ' + probe + ' ' + k, got, HEADERS[k])) console.log('  ok   ' + (probe + ' ' + k).padEnd(48));
    });
  }
  if (!headersAtAll) {
    results.warn.push('the host sends none of the policy headers. that is mod_headers being off, not a broken site: ' +
      'the CSP <meta> tag on every page still enforces the policy, and what is lost is frame-ancestors and HSTS, ' +
      'which a meta tag cannot carry. ask the host to enable mod_headers, or accept the downgrade.');
  }

  console.log('\n== the admin desk, and that it did not leak ==');
  const admin = await get('/admin');
  Object.keys(ADMIN_HEADERS).forEach((k) => {
    if (want('  /admin ' + k, admin.headers[k.toLowerCase()], ADMIN_HEADERS[k])) console.log('  ok   /admin ' + k);
  });
  const plain = await get('/');
  Object.keys(ADMIN_HEADERS).filter((k) => !(k in HEADERS)).forEach((k) => {
    const got = plain.headers[k.toLowerCase()];
    if (got === undefined) { results.pass++; console.log('  ok   / carries no ' + k + ' — the desk is not noindexing the site'); }
    else results.fail.push('  / carries ' + k + ': ' + got + ' — the admin override leaked site-wide, and search engines will drop the whole site');
  });

  console.log('\n== cache tiers ==');
  const tiers = [
    [CSS, 'public, max-age=31536000, immutable'],
    ['/assets/cv/CV-en.pdf', 'public, max-age=31536000, immutable'],
    ['/', 'no-cache, no-store, must-revalidate'],
    ['/work/bookly', 'no-cache, no-store, must-revalidate'],
    ['/manifest.webmanifest', 'no-cache, no-store, must-revalidate'],
    ['/service-worker.js', 'no-cache'],
    ['/api/profile.json', 'no-cache'],
    ['/sitemap.xml', 'no-cache']
  ];
  for (const [p, v] of tiers) {
    const r = await get(p);
    if (want('  Cache-Control ' + p, r.headers['cache-control'], v)) console.log('  ok   ' + p.padEnd(34) + v);
  }

  console.log('\n== types the host would otherwise guess ==');
  const types = [
    ['/manifest.webmanifest', 'application/manifest+json'],
    ['/assets/fonts/unbounded-normal-300-900-latin.woff2', 'font/woff2'],
    ['/assets/shots/bookly.webp', 'image/webp'],
    ['/api/profile.json', 'application/json'],
    ['/', 'text/html']
  ];
  for (const [p, v] of types) {
    const r = await get(p);
    const got = (r.headers['content-type'] || '').split(';')[0];
    if (want('  Content-Type ' + p, got, v)) console.log('  ok   ' + p.padEnd(50) + v);
  }

  console.log('\n== the worker can control the whole origin ==');
  const swr = await get('/service-worker.js');
  const sw = await swr.text();
  if (/var SHELL = \[/.test(sw)) { results.pass++; console.log('  ok   the deployed worker is the shipped one'); }
  else results.fail.push('  /service-worker.js did not return the shipped worker');
  const scope = swr.headers['service-worker-allowed'];
  if (scope && scope !== '/') results.fail.push('  Service-Worker-Allowed is ' + scope + ' — the worker would be scoped away from the site root');
  else { results.pass++; console.log('  ok   no narrowing Service-Worker-Allowed header (scope stays /)'); }

  /* the counter posts to supabase, so a second origin needs the same
     connect-src. this is the one runtime check that catches a CSP that is
     right on paper and wrong for where the site now lives. */
  console.log('\n== what the policy allows on this origin ==');
  const csp = home.headers['content-security-policy'] || '';
  const meta = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  const origin = new URL(BASE).origin;
  ['connect-src', 'script-src'].forEach((d) => {
    for (const src of [csp, meta]) {
      if (!src) continue;
      const val = (src.match(new RegExp(d + '([^;]*)')) || [])[1] || '';
      if (!/'self'/.test(val)) results.fail.push('  ' + d + ' has no \'self\' on this origin (' + origin + ')');
    }
  });
  if (!results.fail.some((f) => /connect-src|script-src/.test(f))) {
    results.pass++;
    console.log("  ok   'self' resolves to " + origin + ' in both the header and the meta tag');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('passed: ' + results.pass + '   failed: ' + results.fail.length + '   warnings: ' + results.warn.length);
  results.warn.forEach((w) => console.log('\n  ! ' + w));
  if (results.fail.length) {
    console.log('\nFAILED:\n');
    results.fail.forEach((f) => console.log('  ✗ ' + f + '\n'));
    process.exit(1);
  }
  console.log('\nthe host serves this site correctly.');
}

main().catch((e) => { console.error('could not reach ' + BASE + ': ' + e.message); process.exit(2); });
