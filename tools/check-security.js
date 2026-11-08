/* check-security.js — the security gate.
   one config (tools/security-config.js) describes the rules; this file
   checks that the rest of the site still agrees with it. run it before
   every deploy:  node tools/check-security.js
   exit 0 = every layer holds. anything else prints what moved.

   checks:
     1  csp is one string, everywhere: config, firebase, every page meta
     2  script-src has no unsafe-inline / unsafe-eval / wildcards
     3  the response headers production must send are actually there
     4  no inline script is left on any page (the price of dropping unsafe-inline)
     5  no inline event handler, no eval, no document.write, no new Function
     6  every third-party script is pinned with SRI + crossorigin
     7  no window.open/target=_blank without noopener
     8  nothing that looks like a secret is committed
     9  the service worker shell holds no admin page and no cv
    10 the ?v=rNN / bgsash-vNN ritual moved together                   */

const fs = require('fs');
const path = require('path');
const { CSP, CSP_META, HEADERS, ADMIN_HEADERS } = require('./security-config');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const fails = [];
const ok = [];
function check(label, bad, detail) {
  if (bad && bad.length) fails.push(label + (detail ? ' — ' + detail : '') + '\n     · ' + bad.join('\n     · '));
  else ok.push(label);
}

const PAGES = ['index.html', '404.html', 'admin.html']
  .concat(fs.readdirSync(path.join(ROOT, 'work')).filter((f) => f.endsWith('.html')).map((f) => 'work/' + f));
const JS = fs.readdirSync(path.join(ROOT, 'assets', 'js')).filter((f) => f.endsWith('.js')).map((f) => 'assets/js/' + f);

/* ── 1. one csp string everywhere ─────────────────────────── */

const firebase = JSON.parse(read('firebase.json'));
const rules = firebase.hosting.headers;
function headerOf(source, key) {
  const r = rules.filter((x) => x.source === source)[0];
  if (!r) return undefined;
  const h = r.headers.filter((x) => x.key === key)[0];
  return h && h.value;
}

const cspMismatch = [];
const CSP_KEY = 'Content-Security-Policy';
['**', '/admin', '/admin.html'].forEach((source) => {
  const want = (source === '**' ? HEADERS : ADMIN_HEADERS)[CSP_KEY];
  const got = headerOf(source, CSP_KEY);
  if (!got) cspMismatch.push('firebase.json: no rule for ' + source);
  else if (got !== want) cspMismatch.push('firebase.json: ' + source + ' CSP differs from security-config');
});
check('csp: firebase.json mirrors tools/security-config.js', cspMismatch);

const metaMissing = [];
PAGES.forEach((rel) => {
  const s = read(rel);
  const metas = s.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi) || [];
  if (metas.length !== 1) { metaMissing.push(rel + ': ' + metas.length + ' csp meta tags (must be exactly 1)'); return; }
  const v = (metas[0].match(/content="([^"]+)"/i) || [])[1];
  if (v !== CSP_META) metaMissing.push(rel + ': meta csp differs from security-config');
  // frame-ancestors in a tag is dropped by the browser with a console error;
  // the header is the only place it is read, so the tag must not carry it
  if (/frame-ancestors/.test(v || '')) metaMissing.push(rel + ': meta carries frame-ancestors (ignored there)');
});
if (/frame-ancestors/.test(CSP_META)) fails.push('security-config: CSP_META should not contain frame-ancestors');
if (!/frame-ancestors 'none'/.test(CSP)) fails.push('security-config: header CSP lost frame-ancestors');
check('csp: every page meta tag matches, exactly one per page', metaMissing);

/* ── 2. the parts of the policy that matter most ──────────── */

function directives(csp) {
  const out = {};
  csp.split(';').forEach((d) => {
    const p = d.trim().split(/\s+/);
    if (p[0]) out[p[0]] = p.slice(1);
  });
  return out;
}
const d = directives(CSP);
const weak = [];
if ((d['script-src'] || []).indexOf("'unsafe-inline'") > -1) weak.push("script-src has 'unsafe-inline'");
if ((d['script-src'] || []).indexOf("'unsafe-eval'") > -1) weak.push("script-src has 'unsafe-eval'");
if ((d['script-src'] || []).some((s) => s === '*' || /^https?:$/.test(s) || s === 'data:' || s === 'blob:'))
  weak.push('script-src has a wildcard or data/blob source');
if ((d['object-src'] || []).indexOf("'none'") < 0) weak.push("object-src is not 'none'");
if ((d['base-uri'] || []).indexOf("'self'") < 0) weak.push("base-uri is not 'self'");
if ((d['frame-ancestors'] || []).indexOf("'none'") < 0) weak.push("frame-ancestors is not 'none'");
if ((d['default-src'] || []).indexOf("'self'") < 0) weak.push("default-src is not 'self'");
if (!d['form-action']) weak.push('form-action missing — a forged form could post anywhere');
if (!d['upgrade-insecure-requests']) weak.push('upgrade-insecure-requests missing');
check('policy: script-src is pinned, object/base/frame-ancestors closed', weak);

/* ── 3. response headers ──────────────────────────────────── */

const headGaps = [];
Object.keys(HEADERS).forEach((k) => {
  if (headerOf('**', k) !== HEADERS[k]) headGaps.push('** missing or wrong: ' + k);
});
if (headerOf('/admin', 'X-Robots-Tag') !== ADMIN_HEADERS['X-Robots-Tag']) headGaps.push('/admin has no noindex');
if (headerOf('/admin', 'Referrer-Policy') !== 'no-referrer') headGaps.push('/admin leaks the referrer');
if (headerOf('/admin.html', 'X-Frame-Options') !== 'DENY') headGaps.push('/admin.html has no X-Frame-Options');
const ign = (firebase.hosting.ignore || []).map((s) => s.replace(/\/\*\*$/, ''));
['tools', 'supabase', '.git'].forEach((p) => {
  if (ign.indexOf(p) < 0) headGaps.push('firebase would upload ' + p);
});
check('headers: production sends the whole set, private folders stay unlisted', headGaps);

/* ── 4. no inline script anywhere ─────────────────────────── */

const inline = [];
PAGES.forEach((rel) => {
  const s = read(rel);
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(s))) {
    const attrs = m[1] || '';
    const body = (m[2] || '').trim();
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/type\s*=\s*["']?(application\/(ld\+json|json|manifest)|text\/template)/i.test(attrs)) continue;
    if (!body) continue;
    inline.push(rel + ': inline script (' + body.slice(0, 60).replace(/\s+/g, ' ') + '…)');
  }
});
check('no inline script (the price of dropping unsafe-inline)', inline);

/* ── 5. inline handlers + dynamic code ────────────────────── */

const handlers = [];
PAGES.forEach((rel) => {
  const s = read(rel);
  const m = s.match(/\son[a-z]{2,14}\s*=\s*["'][^"']+["']/gi) || [];
  m.forEach((h) => handlers.push(rel + ': ' + h.slice(0, 60)));
});
check('no on*="…" attribute handlers', handlers);

const dynamic = [];
const xssSurface = [];
JS.forEach((rel) => {
  const s = read(rel);
  if (/(^|[^.\w])eval\s*\(/.test(s)) dynamic.push(rel + ': eval()');
  if (/new\s+Function\s*\(/.test(s)) dynamic.push(rel + ': new Function()');
  if (/document\.write\s*\(/.test(s)) dynamic.push(rel + ': document.write()');
  // emptying a node with innerHTML = '' is markup-free; giving it content is
  // where an injection starts, so the gate reports only the second kind
  (s.match(/\.innerHTML\s*=\s*([^;\n]{1,90})/g) || [])
    .filter((x) => !/=\s*(''|"")\s*$/.test(x.trim()))
    .forEach((x) => xssSurface.push(rel + ': ' + x.trim().slice(0, 70)));
});
check('no eval / new Function / document.write in shipped js', dynamic);
check('no innerHTML given content (text goes in through textContent)', xssSurface);

/* ── 6. third-party scripts pinned ────────────────────────── */

const unpinned = [];
PAGES.forEach((rel) => {
  const s = read(rel);
  const re = /<script\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(s))) {
    const tag = m[0];
    if (!/integrity\s*=\s*["']sha(256|384|512)-/.test(tag)) unpinned.push(rel + ': no SRI for ' + m[1]);
    else if (!/crossorigin\s*=/i.test(tag)) unpinned.push(rel + ': SRI without crossorigin for ' + m[1]);
  }
});
check('every third-party script carries SRI + crossorigin', unpinned);

/* ── 7. outbound links ────────────────────────────────────── */

const leaky = [];
PAGES.forEach((rel) => {
  const s = read(rel);
  const re = /<a\b([^>]*\btarget\s*=\s*["']_blank["'][^>]*)>/gi;
  let m;
  while ((m = re.exec(s))) {
    if (!/rel\s*=\s*["'][^"']*noopener[^"']*["']/i.test(m[1])) leaky.push(rel + ': ' + m[0].slice(0, 70));
  }
});
const sw = read('service-worker.js');
check('target=_blank always pairs with rel=noopener', leaky);

/* ── 8. secrets in the tree ───────────────────────────────── */

const secretHunt = [];
// service_role is only a leak when a value is assigned to it — naming the
// postgres role in a grant (schema.sql) is ddl, not a credential
const SECRET_RE = /(service_role["']?\s*[:=]\s*["'][A-Za-z0-9._-]{12,}|eyJ[A-Za-z0-9_-]{20,}|sk_live_|sk-proj-|xoxb-|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|bearer\s+[a-z0-9._-]{30,})/i;
const LONG_SECRET = /(secret|password|apikey|api_key|token)\s*[:=]\s*["'][^"']{16,}["']/i;
const SCAN = PAGES.concat(JS, ['firebase.json', 'manifest.webmanifest', 'tools/security-config.js', 'tools/serve.js'])
  .filter(exists)
  .concat(exists('supabase/schema.sql') ? ['supabase/schema.sql'] : []);
const fnDir = path.join(ROOT, 'supabase', 'functions');
if (fs.existsSync(fnDir)) {
  fs.readdirSync(fnDir).forEach((fn) => {
    const f = 'supabase/functions/' + fn + '/index.ts';
    if (exists(f)) SCAN.push(f);
  });
}
SCAN.forEach((rel) => {
  const s = read(rel);
  s.split('\n').forEach((line, i) => {
    if (/Deno\.env\.get\(/.test(line)) return;              // reads are fine, values live in secrets
    if (/(ADMIN_PASSWORD|TURNSTILE_SECRET|RESEND_API_KEY|IP_SALT)["']?\s*[:=]\s*["'][^"']{8,}/.test(line))
      secretHunt.push(rel + ':' + (i + 1) + ' looks like a literal secret');
    if (SECRET_RE.test(line)) secretHunt.push(rel + ':' + (i + 1) + ' ' + line.trim().slice(0, 60));
    if (LONG_SECRET.test(line) && !/=""|:\s*""|=\s*''/.test(line))
      secretHunt.push(rel + ':' + (i + 1) + ' ' + line.trim().slice(0, 60));
  });
});
check('no credential material in the repo', secretHunt);

/* ── 9. what the service worker keeps ─────────────────────── */

const shell = (sw.match(/var SHELL = \[([\s\S]*?)\];/i) || [])[1] || '';
const swBad = [];
if (/admin/i.test(shell)) swBad.push('SHELL caches the admin page — it would be readable offline');
// the cv downloads are public again, so the gate keeps them honest instead:
// a button that points at a missing pdf is a broken promise to a visitor
const cvLinks = [...new Set((read('index.html').match(/href="\/?assets\/cv\/[^"]+"/g) || [])
  .map((x) => x.replace(/^href="/, '').replace(/"$/, '').replace(/^\//, '')))];
if (!cvLinks.length) swBad.push('index.html offers no cv download at all');
cvLinks.forEach((rel) => { if (!exists(rel)) swBad.push('index.html links a cv that is not on disk: ' + rel); });
cvLinks.forEach((rel) => { if (!new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(shell)) swBad.push('the cv is not in the offline shell: ' + rel); });
if ((firebase.hosting.ignore || []).indexOf('assets/cv/**') > -1) swBad.push('firebase.json still ignores assets/cv — the buttons would 404 in production');
// the fetch handler writes every ok navigation into the cache, so the admin
// page has to be refused before that happens or it becomes the offline home
if (!/admin/.test(sw.replace(/var SHELL[\s\S]*?\];/, ''))) swBad.push('fetch handler has no admin exclusion');
if (!/url\.pathname/.test(sw)) swBad.push('cache key is not url.pathname (query strings would split the cache)');
check('service worker + cv: no admin cached, every cv link resolves and ships', swBad);

/* ── 10. the version ritual ───────────────────────────────── */

const verIn = (s) => [...new Set((s.match(/[?&]v=r(\d+)/g) || []).map((x) => Number(x.match(/r(\d+)/)[1])))];
const tokens = [];
PAGES.concat(JS).forEach((rel) => {
  const v = verIn(read(rel));
  if (v.length) tokens.push({ rel: rel, v: v });
});
const allVersions = [...new Set(tokens.reduce((a, t) => a.concat(t.v), []))];
const swVersion = (sw.match(/bgsash-v(\d+)/) || [])[1];
const ritual = [];
allVersions.forEach((v) => {
  if (String(v) !== String(swVersion)) ritual.push('service-worker.js is bgsash-v' + swVersion + ' but a page asks for r' + v);
});
tokens.forEach((t) => {
  if (t.v.length > 1) ritual.push(t.rel + ' mixes tokens: ' + t.v.join(', '));
});
check('cache ritual: one rNN token, service worker agrees', ritual);

/* ── report ───────────────────────────────────────────────── */

console.log('pages: ' + PAGES.length + ' · js: ' + JS.length + ' · token: r' + (allVersions.join('/') || '?') + ' / bgsash-v' + swVersion);
ok.forEach((l) => console.log('  ✓ ' + l));
if (fails.length) {
  console.log('\n' + fails.length + ' CHECK(S) FAILED:\n');
  fails.forEach((f) => console.log('  ✗ ' + f + '\n'));
  process.exit(1);
}
console.log('\nall ' + ok.length + ' security checks pass.');
