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
    10 the ?v=rNN / bgsash-vNN ritual moved together
    11 the fonts are this origin's, each url hashed to its own file
    12 the machine-readable layer: feeds, llms files, profile.json, security.txt
    13 the faq counts the same in the page, the json-ld, the twelve languages
       and the generated layer
    14 the apache rendering of the policy cannot drift or 500 a host
    15 what a deploy publishes: the site, and no file git calls junk
    16 the estimator and all twelve price cards say the same number
    17 the exchange rates are dated, positive, and cover every currency offered */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { CSP, CSP_META, HEADERS, ADMIN_HEADERS } = require('./security-config');
const { walk, gitJunk } = require('./shipset');
const PAGES = require('./pages').PAGES;

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const fails = [];
const ok = [];
function check(label, bad, detail) {
  if (bad && bad.length) fails.push(label + (detail ? ' — ' + detail : '') + '\n     · ' + bad.join('\n     · '));
  else ok.push(label);
}

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
const SCAN = PAGES.concat(JS, ['firebase.json', 'manifest.webmanifest', 'tools/security-config.js', 'tools/serve.js',
  // the apache rendering carries the same policy to a different host
  '.htaccess', 'tools/make-htaccess.js',
  // the generated layer repeats the contact details, so it is scanned too
  'feed.xml', 'atom.xml', 'llms.txt', 'llms-full.txt', 'api/profile.json', '.well-known/security.txt'])
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

/* ── 9b. the update offer ─────────────────────────────────── */

// a new copy of the site must not land on top of a reader. the worker holds
// back, the page asks, the click is the only thing that lets it through —
// and the two halves name each other with one string. a typo on either side
// is invisible until the one visit where it matters, so it is checked here.

const mainJs = read('assets/js/main.js');
const css = read('assets/css/style.css');
const offer = [];
const installBody = (sw.match(/addEventListener\('install'[\s\S]*?\n\}\);/) || [''])[0];
const msgBody = (sw.match(/addEventListener\('message'[\s\S]*?\n\}\);/) || [''])[0];
if (!/skipWaiting\s*\(\s*\)/.test(installBody)) offer.push('install never calls skipWaiting — a first visit would sit uncontrolled');
if (/skipWaiting\s*\(\s*\)/.test(installBody.replace(/if\s*\(\s*!self\.registration\s*\|\|[^)]*\)\s*\{?\s*return\s*self\.skipWaiting\s*\(\s*\)\s*;?/, ''))) offer.push('install takes over unconditionally — it would cut a reader off mid-page');
if (!/'sash:apply'/.test(msgBody)) offer.push("the message listener does not answer 'sash:apply' — the Reload button would do nothing");
if (!/type:\s*'sash:apply'/.test(mainJs)) offer.push("main.js does not post {type:'sash:apply'} — the two halves disagree");
if (!/showSwBar/.test(mainJs) || !/class(Name)?\s*=\s*'sw-update'|className = 'sw-update'/.test(mainJs)) offer.push('main.js has no update offer to show');
if (/skipWaiting/.test(mainJs) || !/if \(swAsked\) location\.reload\(\)/.test(mainJs)) offer.push('the page reloads without waiting for the reader to click');
if (!/\.sw-update\s*\{/.test(css)) offer.push('.sw-update has no rules in style.css — the offer would render unstyled');
if (!/\[data-i18n="upd\./.test(mainJs) && !/setAttribute\('data-i18n', key\)/.test(mainJs)) offer.push('the offer is not wired to the translation layer');
check('update offer: the worker waits, the page asks, the click alone answers', offer);

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

/* ── 11. the fonts belong to this origin ──────────────────── */

// the counter and the fonts make the same promise together: a visit does
// not introduce the visitor to anybody. one css2 link creeping back into a
// page breaks that silently — the page still looks and reads identical — so
// it is a gate, not a review note.
const fontBad = [];
PAGES.forEach((rel) => {
  if (/fonts\.(googleapis|gstatic)\.com/.test(read(rel))) fontBad.push(rel + ' still asks google for a font');
});
if (!exists('assets/css/fonts.css')) fontBad.push('assets/css/fonts.css is missing — run node tools/fetch-fonts.js');
else {
  // no regex here on purpose: the urls carry a query, and splitting on the
  // quote that closes url(" keeps the token attached to its own file
  const urls = [...new Set(read('assets/css/fonts.css').split('url("').slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf('"'))))]
    .filter((u) => u.startsWith('/assets/fonts/'));
  if (!urls.length) fontBad.push('fonts.css declares no faces');
  const names = [];
  urls.forEach((u) => {
    const rel = u.split('?')[0];
    names.push(rel);
    if (!exists(rel)) { fontBad.push('fonts.css points at a file that is not on disk: ' + rel); return; }
    // assets/** ships immutable, so a font url carries its own sha256 instead
    // of the release token — a swapped file has to move its own cache key or
    // every returning visitor keeps the old face forever
    const promised = u.split('?v=')[1] || '';
    const real = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex').slice(0, 10);
    if (promised !== real) {
      fontBad.push(rel + ' is ' + real + ' on disk but fonts.css promises v=' + (promised || 'nothing'));
    }
  });
  const onDisk = fs.readdirSync(path.join(ROOT, 'assets', 'fonts')).filter((f) => f.endsWith('.woff2'));
  onDisk.forEach((f) => {
    if (!names.some((n) => n.endsWith('/' + f))) fontBad.push('assets/fonts/' + f + ' is orphaned (not declared in fonts.css)');
  });
}
check('the fonts ship from this origin, each hashed to its file, none orphaned', fontBad);

/* ── 12. the machine-readable layer ─────────────────────── */

// the feeds, the llms files and /api/profile.json are what a crawler, a
// reader and a language model get when they do not run javascript. they are
// generated, so the gate's job is the two things a generator can still get
// wrong: an entry that points at a page that is not there, and a file that
// quietly stopped matching the case list.
const CASES = require('./pages').CASES;
const slugs = CASES.map((rel) => rel.replace(/^work\//, '').replace(/\.html$/, ''));
// the canonical on the homepage is the origin everything else must agree with
const ORIGIN = (read('index.html').match(/rel="canonical" href="([^"]+)"/) || ['', ''])[1].replace(/\/$/, '');
const GEN = ['feed.xml', 'atom.xml', 'llms.txt', 'llms-full.txt', 'api/profile.json', '.well-known/security.txt'];

// /work/smartmaid -> work/smartmaid.html, /privacy -> privacy.html, / -> index.html
const served = (u) => {
  if (!u.startsWith(ORIGIN)) return null;
  let p = decodeURIComponent(u.slice(ORIGIN.length).split('?')[0].split('#')[0]).replace(/^\//, '');
  if (!p) return 'index.html';
  if (path.extname(p)) return exists(p) ? p : null;
  return exists(p + '.html') ? p + '.html' : (exists(path.join(p, 'index.html')) ? path.join(p, 'index.html') : null);
};

const genMissing = GEN.filter((f) => !exists(f));
const genBad = [];
if (!genMissing.length) {
  const rss = read('feed.xml'), atom = read('atom.xml');
  // an unescaped & is the one xml mistake that reads fine until a parser rejects the file
  [rss, atom, read('sitemap.xml')].forEach((x, i) => {
    const raw = x.match(/&(?!amp;|lt;|gt;|quot;|apos;|#)/);
    if (raw) genBad.push(['feed.xml', 'atom.xml', 'sitemap.xml'][i] + ': unescaped & at ' + raw.index);
  });
  if ((rss.match(/<item>/g) || []).length !== slugs.length) genBad.push('feed.xml has ' + (rss.match(/<item>/g) || []).length + ' items, there are ' + slugs.length + ' case pages');
  if ((atom.match(/<entry>/g) || []).length !== slugs.length) genBad.push('atom.xml has ' + (atom.match(/<entry>/g) || []).length + ' entries, there are ' + slugs.length + ' case pages');
  slugs.forEach((s) => {
    if (!rss.includes(ORIGIN + '/work/' + s)) genBad.push('feed.xml does not carry /work/' + s);
    if (!atom.includes(ORIGIN + '/work/' + s)) genBad.push('atom.xml does not carry /work/' + s);
  });
  // every url the layer advertises has to answer, in either direction
  const advertised = [...new Set([rss, atom, read('llms.txt'), read('llms-full.txt'), read('.well-known/security.txt')]
    .reduce((a, s) => a.concat(s.match(/https:\/\/[^\s"'<>()]+/g) || []), []))];
  advertised.filter((u) => u.startsWith(ORIGIN)).forEach((u) => {
    if (!served(u)) genBad.push('advertised url has no file behind it: ' + u);
  });
  if (!CASES.every((rel) => advertised.some((u) => served(u) === rel))) {
    genBad.push('a case page is advertised nowhere in the machine-readable layer');
  }

  let profile = null;
  try { profile = JSON.parse(read('api/profile.json')); } catch (e) { genBad.push('api/profile.json is not json: ' + e.message); }
  if (profile) {
    const ps = (profile.projects || []).map((p) => p.slug).sort().join(',');
    if (ps !== slugs.slice().sort().join(',')) genBad.push('api/profile.json projects are [' + ps + '], the case pages are [' + slugs.join(',') + ']');
    if (profile.site && !served(profile.site)) genBad.push('api/profile.json site url does not resolve: ' + profile.site);
    if ((profile.languages || []).length !== Object.keys(JSON.parse(read('assets/i18n/translations.json'))).length)
      genBad.push('api/profile.json lists ' + (profile.languages || []).length + ' languages, translations.json has ' + Object.keys(JSON.parse(read('assets/i18n/translations.json'))).length);
    // the identity block is read out of the homepage — if it moved, this fails
    const email = ((profile.identity || {}).email || '').replace(/^mailto:/, '');
    if (!email || !read('index.html').includes('mailto:' + email)) genBad.push('api/profile.json email is not the one index.html shows');
    (profile.contact.cv || []).forEach((u) => { if (!served(u)) genBad.push('api/profile.json advertises a cv that is not on disk: ' + u); });
  }

  const sec = read('.well-known/security.txt');
  const contact = (sec.match(/^Contact:\s*(\S+)/im) || [])[1] || '';
  if (!/^(https?:|mailto:)/.test(contact)) genBad.push('.well-known/security.txt has no Contact: url or mailto');
  else if (contact.startsWith('mailto:') && !read('index.html').includes(contact)) genBad.push('.well-known/security.txt contact is not an address the site publishes');
  const exp = (sec.match(/^Expires:\s*(\S+)/im) || [])[1] || '';
  const expMs = Date.parse(exp);
  if (!exp) genBad.push('.well-known/security.txt has no Expires: (RFC 9116 requires one)');
  else if (!Number.isFinite(expMs)) genBad.push('.well-known/security.txt Expires: is not a date: ' + exp);
  else if (expMs < Date.now()) genBad.push('.well-known/security.txt expired on ' + exp + ' — a reported problem has no address to go to');
  if (!/^Preferred-Languages:/im.test(sec)) genBad.push('.well-known/security.txt has no Preferred-Languages');
  if (!/Sitemap: \S+sitemap\.xml/.test(read('robots.txt'))) genBad.push('robots.txt stopped advertising the sitemap');
  if (!/Sitemap: \S+feed\.xml/.test(read('robots.txt'))) genBad.push('robots.txt stopped advertising the case-study feed');
}
check('machine-readable layer: feeds, llms, profile and security.txt all hold', genMissing.concat(genBad));

/* ── 13. the questions agree with themselves ──────────────── */

/* one faq entry exists in four places at once: the details row, the
   FAQPage json-ld, the translation file and the generated layer. adding a
   question to only one of them is the kind of edit that passes every other
   check — a page that promises a rich result and does not render it, or a
   row that renders in english forever. so the four counts are compared. */
const faqBad = [];
// a markdown section: the text under one heading, stopping at the next one
const section = (text, heading) => {
  const after = text.split(heading)[1];
  if (!after) return '';
  return after.split('\n## ')[0];
};
{
  const words = JSON.parse(read('assets/i18n/translations.json'));
  const home = read('index.html');
  const rows = (home.match(/<details class="faq-item">/g) || []).length;
  const ld = (home.match(/"@type":\s*"Question"/g) || []).length;
  const jsonld = (home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [])
    .map((b) => { try { return JSON.parse(b.replace(/^<script[^>]*>/, '').replace(/<\/script>\s*$/, '')); } catch (e) { return null; } })
    .filter((o) => o && o['@type'] === 'FAQPage');
  const inLd = jsonld.reduce((a, o) => a + ((o.mainEntity || []).length), 0);
  const en = words.en.faq || {};
  const keys = Object.keys(en).filter((k) => /^q\d+$/.test(k)).length;
  const answers = Object.keys(en).filter((k) => /^a\d+$/.test(k)).length;
  const langGaps = [];
  for (const lang of Object.keys(words)) {
    const f = words[lang].faq || {};
    for (let i = 1; i <= keys; i++) if (!f['q' + i] || !f['a' + i]) langGaps.push(lang + ' faq.q' + i + '/a' + i);
  }
  const listed = (read('llms-full.txt').match(/^Q: /gm) || []).length;
  const prof = (() => { try { return (JSON.parse(read('api/profile.json')).faq || []).length; } catch (e) { return -1; } })();
  const llmsQuestions = section(read('llms.txt'), '## Questions answered on the page').split('\n').filter((l) => /^- /.test(l)).length;

  if (!jsonld.length) faqBad.push('index.html has no FAQPage json-ld at all');
  if (rows !== ld) faqBad.push(`the page renders ${rows} questions but declares ${ld} to search: a rich result promised and not delivered`);
  if (inLd !== rows) faqBad.push(`FAQPage json-ld carries ${inLd} mainEntity entries, the page renders ${rows}`);
  if (keys !== answers) faqBad.push(`faq has ${keys} questions and ${answers} answers`);
  if (keys !== rows) faqBad.push(`translations.faq has ${keys} questions, index.html renders ${rows}`);
  if (langGaps.length) faqBad.push('a language is missing a question or answer: ' + langGaps.slice(0, 6).join(', '));
  if (listed !== rows) faqBad.push(`llms-full.txt answers ${listed} questions, the page asks ${rows}`);
  if (llmsQuestions !== rows) faqBad.push(`llms.txt lists ${llmsQuestions} questions, the page asks ${rows}`);
  if (prof !== rows) faqBad.push(`api/profile.json carries ${prof} questions, the page asks ${rows}`);
}
check('faq: page, json-ld, twelve languages and the generated layer all count the same', faqBad);

/* ── 14. the apache rendering ─────────────────────────────── */

/* firebase.json is not the only host this site is published from. an Apache
   box — InfinityFree, a cPanel account, a VPS — gets the same policy from
   .htaccess, rendered by tools/make-htaccess.js from the same
   security-config.js. two renderings of one policy is exactly where drift
   lives, so the committed file is regenerated here and compared byte for
   byte: editing security-config.js without regenerating fails the build.

   the <IfModule> guards are checked as carefully as the values, because
   they are what stands between a header change and a 500 on every page of
   the site. a directive Apache cannot resolve is fatal, not ignorable. */
const htBad = [];
if (!exists('.htaccess')) {
  htBad.push('.htaccess is missing — an Apache host would 404 on every clean url');
} else {
  const ht = read('.htaccess');
  const tmp = path.join(os.tmpdir(), 'bgsash-htaccess-check-' + process.pid);
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-htaccess.js'), '--out', tmp], { cwd: ROOT, stdio: 'pipe' });
    const fresh = fs.readFileSync(tmp, 'utf8');
    /* compared with the line endings folded, because this repo is edited on
       windows and checked in CI on linux: core.autocrlf would hand a fresh
       clone a CRLF copy of a file the generator always writes with LF, and
       that difference is not drift. */
    const nl = (s) => s.replace(/\r\n/g, '\n');
    if (nl(fresh) !== nl(ht)) htBad.push('.htaccess does not match what make-htaccess.js generates — run: node tools/make-htaccess.js');
  } catch (e) {
    htBad.push('make-htaccess.js failed: ' + String(e.message).split('\n')[0]);
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch (e) {}
  }

  // every policy value has to survive the trip into Apache syntax verbatim
  const quote = (v) => '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  Object.keys(HEADERS).forEach((k) => {
    if (!ht.includes('Header always set ' + k + ' ' + quote(HEADERS[k]))) htBad.push('header not set verbatim for every response: ' + k);
  });
  Object.keys(ADMIN_HEADERS).forEach((k) => {
    if (ADMIN_HEADERS[k] === HEADERS[k]) return;
    if (!ht.includes('Header always set ' + k + ' ' + quote(ADMIN_HEADERS[k]))) htBad.push('admin override missing: ' + k);
  });

  // the admin block has to be scoped. a header the desk owns alone — today
  // that is X-Robots-Tag — leaking site-wide would noindex the whole site;
  // one that merely differs, like Referrer-Policy, is set in both places by
  // design and the later block wins.
  const adminBlock = (ht.match(/<FilesMatch "\^admin\\\.html\$">([\s\S]*?)<\/FilesMatch>/) || [])[1] || '';
  if (!adminBlock) htBad.push('the admin headers are not inside a <FilesMatch "^admin\\.html$"> block');
  else {
    const outside = ht.replace(/<FilesMatch "\^admin\\\.html\$">[\s\S]*?<\/FilesMatch>/, '');
    Object.keys(ADMIN_HEADERS).filter((k) => !(k in HEADERS)).forEach((k) => {
      if (new RegExp('^\\s*Header always set ' + k + '\\b', 'm').test(outside)) htBad.push(k + ' belongs to the admin desk alone but is also set site-wide');
    });
  }

  /* anything module-dependent has to sit inside its <IfModule>, and the
     guard has to name the module the directive actually belongs to. */
  const NEEDS = [
    ['mod_rewrite.c', /^\s*(RewriteEngine|RewriteRule|RewriteCond)\b/],
    ['mod_headers.c', /^\s*(Header|RequestHeader)\b/],
    ['mod_mime.c', /^\s*AddType\b/]
  ];
  // strip the guarded regions; whatever is left must not name a directive
  let bare = ht;
  NEEDS.forEach(([mod]) => {
    const re = new RegExp('<IfModule ' + mod.replace('.', '\\.') + '>[\\s\\S]*?</IfModule>', 'g');
    bare = bare.replace(re, '');
  });
  NEEDS.forEach(([mod, re]) => {
    if (bare.split('\n').some((l) => re.test(l))) htBad.push('a ' + mod + ' directive sits outside its <IfModule> — a host without that module would 500 on every page');
  });
  ['mod_rewrite.c', 'mod_headers.c', 'mod_mime.c'].forEach((mod) => {
    if (!ht.includes('<IfModule ' + mod + '>')) htBad.push('nothing is guarded by <IfModule ' + mod + '>');
  });

  if (!/^\s*ErrorDocument 404 \/404\.html\s*$/m.test(ht)) htBad.push('no ErrorDocument 404 — a miss would be a bare Apache error page');
  // a pinned hostname would break the site on every other origin it is deployed to
  if (/RewriteCond %\{HTTP_HOST\}/.test(ht)) htBad.push('.htaccess pins one hostname — the committed copy has to work on any origin (--host is for a local build)');
  if (!/RewriteRule \^\(\.\+\?\)\/\?\$ \$1\.html \[L\]/.test(ht)) htBad.push('the clean-url rewrite is gone: /privacy and /work/bookly would 404');
  if (!/RewriteRule \^assets\/ - \[E=BGSASH_IMMUTABLE:1\]/.test(ht)) htBad.push('assets are not marked immutable — a release would be invisible to a warm cache');

  const ig = firebase.hosting.ignore || [];
  if (!ig.includes('.htaccess')) htBad.push('firebase.json does not ignore .htaccess — the Apache config would be published to Firebase');
  if (!ig.includes('dist/**')) htBad.push('firebase.json does not ignore dist/** — a built package would deploy as a second copy of the site');
}
check('apache: .htaccess is the same policy as firebase.json, and cannot 500 a host', htBad);

/* ── 15. the deploy publishes the site and nothing else ─────── */

/* .gitignore and firebase.json's "ignore" are two lists nobody keeps in step,
   and the one that wins is the one that publishes. a dev server's log reached
   production this way, carrying the absolute path of the machine it was
   written on — git hid it from every command that would have shown it, so
   nothing in the normal workflow ever displayed the file that was live.

   this walks the same set make-package.js walks, out of shipset.js, because a
   gate with its own copy of the matcher can agree with itself and still be
   wrong about the deploy. both directions are checked: junk that would ship,
   and an ignore list broad enough to swallow the site. */
const shipBad = [];
const SHIP = walk(ROOT, firebase.hosting.ignore || []);
gitJunk(ROOT, SHIP).forEach((j) => shipBad.push(j + ' is git junk that firebase.json would publish — add a matching pattern to its "ignore" list'));
if (!SHIP.length) shipBad.push('the ship set is empty — the ignore list has swallowed the site');
['index.html', '404.html', 'admin.html', 'service-worker.js', 'manifest.webmanifest',
  'assets/css/style.css', 'assets/js/main.js', 'assets/js/tally.js', '.well-known/security.txt']
  .forEach((must) => {
    if (!SHIP.some((f) => f.rel === must)) shipBad.push(must + ' would not be deployed');
  });
check('deploy: the ship set is the site, and none of it is git junk', shipBad, SHIP.length + ' files');

/* ── 16. one price, in the estimator and on every card ──────── */

/* spec.js carries a comment promising the estimator can never undercut the
   published table, and for a long time nothing tested the promise: TYPES.base
   in the script and pricing.pNpr in the dictionary were two numbers in two
   files that merely happened to agree. the estimator's own arithmetic makes
   the equality exact — at default scope, standard speed and no addons it
   returns base and nothing else — so a card saying one figure and a calculator
   returning another is a false price on the thing being sold, in whichever of
   the twelve languages the visitor is reading. */
const priceBad = [];
const spec = exists('assets/js/spec.js') ? read('assets/js/spec.js') : '';
const dict = exists('assets/i18n/translations.json') ? JSON.parse(read('assets/i18n/translations.json')) : {};
const LANGS = Object.keys(dict).filter((l) => dict[l] && dict[l].pricing);
if (!spec) priceBad.push('assets/js/spec.js is missing');
if (!LANGS.length) priceBad.push('translations.json has no language branch carrying pricing');

/* a price is locale-shaped, not numeric: "1 100 $", "١١٠٠ $", "1100 USD",
   "$1100부터". reading the value out means undoing the digits and the grouping
   and nothing else — the surrounding words belong to the language. */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function priceValue(s) {
  if (s === undefined || s === null) return NaN;
  const latin = String(s).replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d));
  const m = latin.replace(/[\u0020\u00A0\u202F\u2009]/g, '').match(/\d+/);
  return m ? Number(m[0]) : NaN;
}

LANGS.forEach((l) => {
  // every card has to carry a figure; one that says "Quote" cannot be compared
  for (let n = 1; n <= 8; n++) {
    const k = 'p' + n + 'pr';
    const s = (dict[l].pricing || {})[k];
    if (s === undefined) priceBad.push(l + '.' + k + ' is missing');
    else if (isNaN(priceValue(s))) priceBad.push(l + '.' + k + ' is not a price: ' + JSON.stringify(s));
  }
});

const TYPES_RE = /\{\s*id:\s*'([a-z]+)'[^}]*?base:\s*(\d+)[^}]*?nameKey:\s*'(pricing\.p\dt)'/g;
const types = [];
let tm;
while ((tm = TYPES_RE.exec(spec)) !== null) types.push({ id: tm[1], base: Number(tm[2]), nameKey: tm[3] });
if (spec && !types.length) priceBad.push('no TYPES entry could be read out of assets/js/spec.js — the extractor has drifted from the file it reads');

types.forEach((t) => {
  const pk = t.nameKey.replace(/^pricing\./, '').replace(/t$/, 'pr');
  LANGS.forEach((l) => {
    const s = (dict[l].pricing || {})[pk];
    if (s === undefined) { priceBad.push(t.id + ': ' + l + '.pricing.' + pk + ' is missing, so the card and the estimator cannot be compared'); return; }
    const v = priceValue(s);
    if (isNaN(v)) { priceBad.push(t.id + ': ' + l + '.pricing.' + pk + ' is not a number the estimator can be checked against: ' + JSON.stringify(s)); return; }
    if (v !== t.base) priceBad.push(t.id + ': the estimator charges ' + t.base + ' but ' + l + '.' + pk + ' advertises ' + v);
  });
});

/* the "domain + hosting" addon and the domain + hosting card are the same
   service. they were 80 and 30. */
const ADDON_RE = /\{\s*id:\s*'([a-z]+)',\s*pct:\s*[\d.]+,\s*flat:\s*(\d+)/g;
const addons = {};
let am;
while ((am = ADDON_RE.exec(spec)) !== null) addons[am[1]] = Number(am[2]);
if (spec && addons.host === undefined) priceBad.push('the host addon could not be read out of assets/js/spec.js');
if (addons.host !== undefined) {
  LANGS.forEach((l) => {
    const v = priceValue((dict[l].pricing || {}).p7pr);
    if (!isNaN(v) && v !== addons.host) priceBad.push('the estimator sells domain + hosting for ' + addons.host + ' while ' + l + '.pricing.p7pr sells it for ' + v);
  });
}

/* the card markup carries an english fallback inside each <b data-i18n>:
   that is what a no-js visitor and every crawler read before the json lands.
   it is a second copy of the en price, and a second copy can drift — it did,
   sitting at $150 while the json said $350. so it is checked against en too. */
if (exists('index.html')) {
  const html = read('index.html');
  const en = dict.en && dict.en.pricing ? dict.en.pricing : {};
  for (let n = 1; n <= 8; n++) {
    const k = 'p' + n + 'pr';
    const m = html.match(new RegExp('data-i18n="pricing\\.' + k + '">([^<]*)<'));
    if (!m) { priceBad.push('index.html has no pricing.' + k + ' card fallback'); continue; }
    if (en[k] !== undefined && m[1] !== en[k]) {
      priceBad.push('index.html card fallback for ' + k + ' is ' + JSON.stringify(m[1]) +
        ' but en.pricing.' + k + ' is ' + JSON.stringify(en[k]) + ' — no-js visitors and crawlers see the old number');
    }
  }
}

check('prices: the estimator and all twelve cards say the same number', priceBad,
  types.length + ' services x ' + LANGS.length + ' languages');

/* ── 17. the exchange rate carries the day it was read ──────── */

/* a hardcoded rate is not wrong for being hardcoded — fetching one would put a
   third party in the page load and force connect-src open for it. it is wrong
   for going stale quietly, which is what happened: IQD sat at 1310 while the
   Baghdad market moved to 1689, so every visitor who picked the dinar was
   shown a figure ~29% under the truth, and nothing in the repo said when the
   number had been true. the date beside it is what turns that into a failing
   check.

   the fuse is deliberately long. a short one reddens ci over a number nobody
   was touching, which on a one-person project is a blocked deploy with no one
   to unblock it. */
const rateBad = [];
let rateAge = '';
const drm = spec.match(/RATE_DATE\s*=\s*'(\d{4}-\d{2}-\d{2})'/);
if (!spec) rateBad.push('assets/js/spec.js is missing');
else if (!drm) rateBad.push('assets/js/spec.js has no RATE_DATE — the rates cannot be dated, so they can go stale invisibly');
else {
  const at = Date.parse(drm[1] + 'T00:00:00Z');
  if (isNaN(at)) rateBad.push('RATE_DATE is not a date: ' + drm[1]);
  else {
    const days = Math.floor((Date.now() - at) / 86400000);
    if (days < 0) rateBad.push('RATE_DATE is in the future: ' + drm[1]);
    else if (days > 180) rateBad.push('the exchange rates were read ' + days + ' days ago (' + drm[1] + ') — check the market rate and set RATE_DATE in assets/js/spec.js to today');
    else rateAge = 'read ' + days + ' day(s) ago, ' + drm[1];
  }
}

const RATES_HAVE = {};
const rrm = spec.match(/var RATES\s*=\s*\{([^}]*)\}/);
if (spec && !rrm) rateBad.push('no RATES table in assets/js/spec.js');
if (rrm) {
  rrm[1].split(',').forEach((pair) => {
    const p = pair.split(':');
    if (p.length === 2) RATES_HAVE[p[0].trim()] = Number(p[1].trim());
  });
  if (RATES_HAVE.USD !== 1) rateBad.push('RATES.USD must be 1 — every other rate is quoted per dollar');
  Object.keys(RATES_HAVE).forEach((c) => {
    if (!(RATES_HAVE[c] > 0)) rateBad.push('RATES.' + c + ' is not a positive number: ' + RATES_HAVE[c]);
  });
  /* money() falls back to 1 for a currency it does not know, so a name in the
     selector without a rate shows the dollar figure with a lira sign on it */
  const sm = spec.match(/\[((?:\s*'[A-Z]{3}'\s*,)+\s*'[A-Z]{3}'\s*)\]\.forEach/);
  if (sm) {
    (sm[1].match(/'([A-Z]{3})'/g) || []).map((x) => x.replace(/'/g, '')).forEach((c) => {
      if (RATES_HAVE[c] === undefined) rateBad.push('the currency selector offers ' + c + ' but RATES has no entry — picking it would print the dollar figure with the wrong symbol');
    });
  } else {
    rateBad.push('the currency selector list could not be read out of assets/js/spec.js');
  }
}

check('rates: dated, positive, and one for every currency offered', rateBad, rateAge);

/* ── 18. the structured data parses and tells the truth ─────── */
/* a crawler reads the JSON-LD before it reads one word of the page, so a
   block that does not parse is worse than no block at all. and the project
   list on the homepage has to be the projects that really have pages: one
   that names a case study which does not exist, or forgets one that does,
   is exactly the quiet drift every other gate here exists to catch. the
   origin is read out of the canonical, so the day the site moves to a real
   domain this check fails until the list is moved with it. */
const jsonLdBad = [];
const itemListBad = [];
let sawItemList = false;
PAGES.forEach((rel) => {
  const s = read(rel);
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(s))) {
    let data;
    try { data = JSON.parse(m[1].trim()); }
    catch (e) { jsonLdBad.push(rel + ': a JSON-LD block does not parse — ' + e.message); continue; }
    if (rel === 'index.html' && data && data['@type'] === 'ItemList') {
      sawItemList = true;
      const want = CASES.map((c) => ORIGIN + '/' + c.replace(/\.html$/, '')).sort();
      const items = data.itemListElement || [];
      const got = items.map((it) => it.url).filter(Boolean).sort();
      want.filter((u) => got.indexOf(u) < 0).forEach((u) => itemListBad.push('a case page exists but the ItemList omits it: ' + u));
      got.filter((u) => want.indexOf(u) < 0).forEach((u) => itemListBad.push('the ItemList names a page that does not exist: ' + u));
      items.forEach((it, i) => { if (it.position !== i + 1) itemListBad.push('ItemList position ' + it.position + ' should be ' + (i + 1)); });
    }
  }
});
if (!sawItemList) itemListBad.push('index.html has no ItemList of the work — a crawler cannot see the portfolio as a list');
check('structured data: every JSON-LD block parses', jsonLdBad);
check('structured data: the homepage ItemList is the real work, in order', itemListBad);

/* ── report ───────────────────────────────────────────────── */

console.log('pages: ' + PAGES.length + ' · js: ' + JS.length + ' · token: r' + (allVersions.join('/') || '?') + ' / bgsash-v' + swVersion);
ok.forEach((l) => console.log('  ✓ ' + l));
if (fails.length) {
  console.log('\n' + fails.length + ' CHECK(S) FAILED:\n');
  fails.forEach((f) => console.log('  ✗ ' + f + '\n'));
  process.exit(1);
}
console.log('\nall ' + ok.length + ' security checks pass.');
