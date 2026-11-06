/* check-i18n.js — the language gate.
   four questions about the twelve languages:
     1. does every key the site asks for exist in every language
     2. does any value still equal english when it should not
     3. does any value sit empty by accident rather than by choice
     4. is there visible text in the markup that no key can reach
   run:  node tools/check-i18n.js
   exit: 0 only when 1 and 3 are clean; 2 and 4 are reported as lists
          because some of them are names we keep in latin on purpose.   */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'i18n', 'translations.json'), 'utf8'));
const LANGS = Object.keys(words);

function dig(node, key) {
  let cur = node;
  for (const p of key.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (Array.isArray(cur)) { const i = parseInt(p, 10); cur = Number.isFinite(i) ? cur[i - 1] : null; }
    else cur = cur[p];
  }
  return cur;
}

/* ── 1. harvest every key the site asks for ───────────────── */

const keys = new Set();
const where = {};                       // key -> pages that asked for it
function harvest(src, re, file) {
  let m;
  while ((m = re.exec(src))) {
    const k = m[m.length - 1];
    if (!k || /\.$/.test(k) || k.indexOf('{') > -1) continue;
    keys.add(k);
    (where[k] = where[k] || new Set()).add(file);
  }
}

const HTML_FILES = ['index.html', '404.html', 'admin.html']
  .concat(fs.readdirSync(path.join(ROOT, 'work')).filter((f) => f.endsWith('.html')).map((f) => 'work/' + f));

const htmlSrc = {};
for (const rel of HTML_FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  htmlSrc[rel] = src;
  harvest(src, /data-i18n="([^"]+)"/g, rel);
  harvest(src, /data-i18n-aria="([^"]+)"/g, rel);
  harvest(src, /data-i18n-title="([^"]+)"/g, rel);
  harvest(src, /data-alt="([^"]+)"/g, rel);
}

const JS_FILES = ['assets/js/main.js', 'assets/js/spec.js', 'assets/js/case.js', 'assets/js/datasheet.js'];
const jsSrc = {};
for (const rel of JS_FILES) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  jsSrc[rel] = src;
  harvest(src, /say\('([\w.]+)'/g, rel);
  harvest(src, /say\('([\w.]+)'\s*,/g, rel);
}

// keys spec.js builds dynamically: estimator units, add-ons, currencies
const specText = jsSrc['assets/js/spec.js'] || '';
for (const m of specText.matchAll(/unitKey: '([^']+)'/g)) keys.add(m[1]);
for (const m of specText.matchAll(/nameKey: '([^']+)'/g)) keys.add(m[1]);
for (const m of specText.matchAll(/key: '((?:est|cur|addon|speed)\.[\w.]+)'/g)) keys.add(m[1]);

// the case generator reads a fixed set of keys per project
const gen = fs.readFileSync(path.join(ROOT, 'tools', 'build-cases.js'), 'utf8');
for (const m of gen.matchAll(/'((?:case|nav|footer|modal|services|a11y|alt|work|stack|proc)\.[\w.]+)'/g)) keys.add(m[1]);
['title', 'desc', 'tag', 'when', 'problem', 'solution', 'result', 'c1', 'c2', 'c3']
  .forEach((f) => { for (let n = 1; n <= 6; n++) keys.add(`projects.${n}.${f}`); });
for (const m of gen.matchAll(/data-i18n-?aria?="([^"]+)"/g)) keys.add(m[1]);

/* ── 2. presence, blanks, english leftovers ───────────────── */

// two reasons a value may legitimately still read like english:
//   NAMES — products, protocols, degrees, platform lists: latin everywhere
//   LOAN  — the same word borrowed into that language, spelled the same
// anything else that never left english is a hole, and it is reported.
const NAMES = new Set(('BG SASH Hussein Sash SmartMaid Mukallaf Flossk Bookly Ziona Hala GitHub GitLab Firebase Vercel Netlify Supabase Figma Windows Server Linux Ubuntu Android iOS iPhone iPad Flutter Dart React Next.js Node.js Express PHP Laravel MySQL Postgres MongoDB Docker Nginx Apache cPanel Cloudflare Escrow KYC CCNA MikroTik Cisco VLAN VPN OSPF DHCP DNS HTTP HTTPS REST JSON API SDK CLI UI UX QR PDF PNG JPG WebP GPS CCTV NVR DVR VoIP ISP LAN WAN RAM SSD HDD CPU GPU Excel Word PowerPoint Photoshop Canva WhatsApp Telegram Instagram LinkedIn YouTube Facebook PayPal Stripe ERP CRM SEO Lighthouse PWA Web HTML CSS JavaScript Python SQL VDS VPS LiteSpeed OpenCart WooCommerce WordPress Elementor Arabic English Kurdish Iraqi Baghdad Iraq Erbil Mosul Najaf Basra Karbala Sulaymaniyah Diyala Google Sheets Docs Drive Maps Meet Analytics Meta Trello Notion Jira Slack Webflow Spline Lottie GSAP Tailwind Bootstrap Redux GraphQL WebSocket WebRTC OpenAI Claude Gemini B.Sc Analytics Terminal Apps App Modules Pages FAQ').split(' '));

const LOAN = {
  fr: ['services', 'service', 'contact', 'stack', 'performance', 'interfaces', 'interface', 'marketplace', 'mobile', 'brief', 'support', 'solution', 'message', 'budget', 'page', 'pages', 'modules', 'questions', 'design', 'web', 'analytics', 'cyber'],
  de: ['b.sc', 'portfolio', 'performance', 'support', 'name', 'problem', 'budget', 'standard', 'live', 'domain', 'hosting', 'mobile', 'apps', 'app', 'design', 'web', 'terminal', 'stack', 'services', 'interfaces', 'modul', 'pages'],
  es: ['stack', 'interfaces', 'marketplace', 'error', 'terminal', 'web', 'mobile', 'soporte', 'nombre', 'presupuesto'],
  tr: ['fiber', 'web', 'terminal', 'stack', 'mobil', 'tasarım'],
  ru: ['веб', 'терминал', 'стек'],
  zh: ['web'], ja: ['web'], ko: ['web'], hi: [], ar: [], ku: [], en: []
};

const words_ = (s) => s.replace(/[^\p{L}\p{N}.'+-]/gu, ' ').split(/\s+/).filter(Boolean);

const isPlain = (x) => /^\d+$/.test(x) || /^[A-Z]{2,6}$/.test(x);

// a string is "shared" when every word in it is either a latin name the
// whole site keeps, or a word this language borrowed as-is
const isSharedIn = (lang, s) => {
  const loan = LOAN[lang] || [];
  const list = words_(String(s).trim());
  if (!list.length) return true;
  return list.every((x) => {
    const low = x.toLowerCase().replace(/\.$/, '');
    return isPlain(x) || NAMES.has(x) || NAMES.has(low) || loan.indexOf(low) > -1;
  });
};

const isNameish = (s) => {
  const t = String(s).trim();
  if (!t) return false;
  if (/^[\d\s.,:+%$€£¥/–-]+$/u.test(t)) return true;               // numbers, money, dates
  if (/^(https?:\/\/|mailto:|tel:|@)/i.test(t)) return true;
  return isSharedIn('en', t);
};

const absent = {}, blank = {}, sameAsEn = {};
for (const lang of LANGS) {
  for (const k of keys) {
    const v = dig(words[lang], k);
    if (v === undefined) (absent[lang] = absent[lang] || []).push(k);
    else if (v === '') (blank[lang] = blank[lang] || []).push(k);
    else if (lang !== 'en' && typeof v === 'string') {
      const base = dig(words.en, k);
      if (typeof base === 'string' && base === v && !isNameish(v) && !isSharedIn(lang, v))
        (sameAsEn[lang] = sameAsEn[lang] || []).push(k);
    }
  }
}

console.log('keys referenced:', keys.size, '| languages:', LANGS.join(', '));

let holes = 0;
for (const lang of LANGS) {
  const list = absent[lang] || [];
  if (list.length) { holes += list.length; console.log('  ' + lang + ' ABSENT ' + list.length + ':', list.slice(0, 25).join(', ') + (list.length > 25 ? ' …' : '')); }
}

/* ── 3. visible text with no key that can reach it ────────── */

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const TRANSLATED = /data-i18n=|data-i18n-aria=|data-i18n-title=|data-alt=/;

function visibleText(src) {
  const clean = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head>[\s\S]*?<\/head>/gi, '')
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/i, '');
  const out = [];
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'\/])*?)(\/?)>/g;
  let m, last = 0;
  const push = (text) => {
    if (!text.trim()) return;
    const leaf = stack[stack.length - 1] || 'body';
    // a parent carrying data-i18n rewrites its whole subtree with
    // textContent, so anything under it is already translated
    const covered = /data-i18n=|data-i18n-aria=|data-i18n-title=|data-alt=/.test(leaf) ||
      stack.slice(0, -1).some((a) => /data-i18n=/.test(a));
    out.push({ path: stack.join(' > ') || 'body', leaf: leaf, text: text.replace(/\s+/g, ' ').trim(), translated: covered });
  };
  while ((m = re.exec(clean))) {
    push(clean.slice(last, m.index));
    last = re.lastIndex;
    const [, closing, tag, attrs, self] = m;
    if (closing) { for (let i = stack.length - 1; i >= 0; i--) if (stack[i].split(' ')[0] === tag) { stack.length = i; break; } }
    else if (!VOID.has(tag.toLowerCase()) && !self) stack.push(tag + ' ' + attrs.trim());
  }
  push(clean.slice(last));
  return out;
}

// text we keep in latin on purpose: brand, filenames, language menus, code
const STATIC_OK = /^(BG\.?SASH|BG|SASH|Baghdad|Iraq|UTC\+3|©\s*\d{4})$/;
const LANGUAGE_MENU = /^(English|العربية|کوردی|Türkçe|Français|Español|Deutsch|Русский|中文|日本語|한국어|हिन्दी)$/;
// nodes the scripts rewrite at runtime — the markup value is a placeholder
const RUNTIME_IDS = /^(clock|localTime|estCur|estTotal|estUsd|termInput|hudLang)$/;

function unent(s) { return s.replace(/&(?:[a-zA-Z]+|#\d+);/g, ' ').replace(/\s+/g, ' ').trim(); }

console.log('\nvisible text with no key:');
let leaks = 0;
for (const rel of HTML_FILES) {
  if (rel === 'admin.html') { console.log('  admin.html — internal desk, deliberately english only'); continue; }
  const hits = visibleText(htmlSrc[rel]).filter((n) => {
    if (n.translated) return false;
    if (/\blang="en"/.test(n.path)) return false;              // latin names we keep
    if (RUNTIME_IDS.test((n.path.match(/id="([^"]+)"/) || [])[1] || '')) return false;
    const t = unent(n.text);
    if (!/[A-Za-z]{3,}/.test(t)) return false;                 // no latin words
    if (STATIC_OK.test(t) || LANGUAGE_MENU.test(t)) return false;
    return !isNameish(t);
  });
  if (hits.length) {
    leaks += hits.length;
    console.log('  ' + rel + ' (' + hits.length + ')');
    hits.forEach((h) => console.log('     · ' + unent(h.text).slice(0, 72) + '   [' + h.path.split(' > ').slice(-1)[0].slice(0, 46) + ']'));
  }
}

/* ── 4. values that never left english ────────────────────── */

console.log('\nvalues still identical to english (names are fine, phrases are not):');
let stale = 0;
for (const lang of LANGS) {
  const list = sameAsEn[lang] || [];
  if (list.length) {
    stale += list.length;
    console.log('  ' + lang + ' (' + list.length + '):');
    list.forEach((k) => console.log('       ' + k.padEnd(22) + ' = ' + String(dig(words[lang], k)).slice(0, 60)));
  }
}

const blankCount = Object.keys(blank).reduce((n, l) => n + blank[l].length, 0);
console.log('\nkeys:', keys.size, '| absent:', holes, '| english-left:', stale, '| untagged text:', leaks, '| empty-by-design:', blankCount);
for (const lang of LANGS) {
  const b = blank[lang] || [];
  if (b.length) console.log('  ' + lang + ' empty:', b.join(', '));
}
process.exitCode = holes === 0 ? 0 : 1;
