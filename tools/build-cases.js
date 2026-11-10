/* build-cases.js — generates the six static case-study pages from
   assets/i18n/translations.json, so every page ships with the same
   translated content the homepage uses (12 languages, no drift).
   it also writes what crawlers and models read instead of the pages:
   sitemap.xml, the two case-study feeds, llms.txt, llms-full.txt and
   api/profile.json — all from the same project list and the same strings.
   run:  node tools/build-cases.js
   output: work/<slug>.html, sitemap.xml, feed.xml, atom.xml,
           llms.txt, llms-full.txt, api/profile.json                  */

const fs = require('fs');
const path = require('path');
const { CSP_META } = require('./security-config');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'work');
const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'i18n', 'translations.json'), 'utf8'));

// absolute origin: canonical, og:url and og:image must be full urls —
// social crawlers do not resolve relative ones, and a relative canonical
// is simply dropped by google.
const SITE = 'https://mywebsite0776.web.app';
const VER = 'r27';                       // bump with every asset change
const LOCALES = { en: 'en_US', ar: 'ar_IQ', ku: 'ku_IQ', tr: 'tr_TR', fr: 'fr_FR', es: 'es_ES', de: 'de_DE', ru: 'ru_RU', zh: 'zh_CN', ja: 'ja_JP', ko: 'ko_KR', hi: 'hi_IN' };

// slug, image, live url (null for the two field cases), role = services key.
// cover: true means the asset is a typographic case cover, not a screenshot —
// the alt text has to say which one, or the page claims artwork it does not have.
const PROJECTS = [
  { n: 1, slug: 'smartmaid',  img: 'smartmaid.webp',  w: 1280, h: 998,  url: 'https://smartmaid-website.vercel.app/ar',            role: 's1' },
  { n: 2, slug: 'mukallaf',   img: 'mukallaf.webp',   w: 1280, h: 1006, url: 'https://bghusseinsash.github.io/iraqi-tax-system/',   role: 's1' },
  { n: 3, slug: 'flossk',     img: 'flossk.webp',     w: 1280, h: 1006, url: 'https://bghusseinsash.github.io/flossk-app/',         role: 's2' },
  { n: 4, slug: 'bookly',     img: 'bookly.webp',     w: 1280, h: 1006, url: 'https://taupe-paprenjak-258494.netlify.app/',         role: 's1' },
  { n: 5, slug: 'ziona-passports', img: 'ziona-passports.webp', w: 1280, h: 998, url: null, cover: true,                               role: 's3' },
  { n: 6, slug: 'hala-sat',   img: 'hala-sat.webp',   w: 1280, h: 1006, url: null, cover: true,                                         role: 's3' }
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// a figure is not a design decision: the only number a case page may show
// as a figure is one its own approved copy already states. each entry is the
// exact phrase from the English solution text that carries it — the build
// fails if the phrase is not there, so an invented number cannot ship.
// projects 2 and 3 already carry theirs in a chip ("7 tax modules",
// "Voice assistant (80+)"); the two field cases state no count at all.
const FIGURES = {
  1: '59 control switches',
  4: 'four-step booking flow'
};

// English values are baked into the markup so the pages are readable
// (and indexable) without javascript; data-i18n swaps them at runtime.
const en = words.en;
const t = (lang, key) => {
  const parts = key.split('.');
  let node = words[lang];
  for (const p of parts) {
    if (node == null) return null;
    if (Array.isArray(node)) { const i = parseInt(p, 10); node = Number.isFinite(i) ? node[i - 1] : null; }
    else node = node[p];
  }
  return typeof node === 'string' ? node : null;
};

for (const n of Object.keys(FIGURES)) {
  const sol = t('en', 'projects.' + n + '.solution') || '';
  if (sol.indexOf(FIGURES[n]) < 0) {
    console.error(`figure for project ${n}: "${FIGURES[n]}" is not in the approved copy — a case may only show a number its own text already states`);
    process.exit(1);
  }
}

function build(p, idx) {
  const next = PROJECTS[(idx + 1) % PROJECTS.length];
  // the button below wraps to the first case after the last one; the head
  // links stay linear, because a crawl loop is not what rel=next means
  const after = idx + 1 < PROJECTS.length ? PROJECTS[idx + 1] : null;
  const before = idx > 0 ? PROJECTS[idx - 1] : null;
  const num = String(p.n).padStart(2, '0');
  const title = en.projects[String(p.n)].title;
  const desc = en.projects[String(p.n)].desc;
  const tag = en.projects[String(p.n)].tag;
  const when = en.projects[String(p.n)].when;
  const role = en.services[p.role].title;
  const KEY = (k) => `projects.${p.n}.${k}`;
  // fig is present only for the cases whose approved copy states a number;
  // the list stays the same chip shape, it just carries one more real figure.
  const chipKeys = ['c1', 'c2', 'c3', 'fig'].filter((k) => en.projects[String(p.n)][k]);
  const chips = chipKeys.map((k) => `<li data-i18n="${KEY(k)}">${esc(en.projects[String(p.n)][k])}</li>`).join('');
  const live = p.url
    ? `<a class="btn ghost" href="${esc(p.url)}" target="_blank" rel="noopener"><span data-i18n="case.live">${esc(en.case.live)}</span><span class="arrow">&#8599;</span></a>`
    : '';
  const nextTitle = en.projects[String(next.n)].title;

  const facts = [
    ['case.year', en.case.year, when, 'projects.' + p.n + '.when'],
    ['case.role', en.case.role, role, 'services.' + p.role + '.title'],
    ['case.stack', en.case.stack, ['c1', 'c2', 'c3'].map((k) => en.projects[String(p.n)][k]).join(' · '), 'stack']
  ].map(([k, label, val, tr]) => `<div><dt data-i18n="${k}">${esc(label)}</dt><dd${tr === 'stack' ? ' data-facts-stack' : (tr ? ` data-i18n="${tr}"` : '')}>${esc(val)}</dd></div>`).join('');

  const sections = ['problem', 'solution', 'result'].map((f) => `
      <section class="cs-block">
        <p class="label" data-i18n="modal.${f}">${esc(en.modal[f])}</p>
        <p class="cs-text" data-i18n="projects.${p.n}.${f}">${esc(en.projects[String(p.n)][f])}</p>
      </section>`).join('');

  const langs = Object.keys(words);
  const hreflang = langs.map((c) => `  <link rel="alternate" hreflang="${c}" href="${SITE}/work/${p.slug}?lang=${c}">`).join('\n');
  const ogLocale = langs.filter((c) => c !== 'en')
    .map((c) => `  <meta property="og:locale:alternate" content="${LOCALES[c] || c}">`).join('\n');

  // where a reader goes next, said to machines as well as to buttons: the
  // walk links, and the two feeds that carry every case study as it is built
  const walkLinks = [
    before ? `  <link rel="prev" href="${SITE}/work/${before.slug}">` : null,
    after ? `  <link rel="next" href="${SITE}/work/${after.slug}">` : null,
    `  <link rel="prefetch" href="/work/${next.slug}" as="document">`,
    `  <link rel="alternate" type="application/rss+xml" title="BG Hussein Sash — case studies" href="${SITE}/feed.xml">`,
    `  <link rel="alternate" type="application/atom+xml" title="BG Hussein Sash — case studies" href="${SITE}/atom.xml">`
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="en" dir="ltr" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="${CSP_META}">
  <title>${esc(title)} — ${esc(en.case.intro)} · BG Hussein Sash</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="theme-color" content="#0e0f11">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <link rel="canonical" href="${SITE}/work/${p.slug}">
${hreflang}
  <link rel="alternate" hreflang="x-default" href="${SITE}/work/${p.slug}">
  <meta property="og:site_name" content="BG Hussein Sash">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)} — ${esc(en.case.intro)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${SITE}/work/${p.slug}">
  <meta property="og:image" content="${SITE}/assets/shots/${p.img}">
  <meta property="og:image:width" content="${p.w}">
  <meta property="og:image:height" content="${p.h}">
  <meta property="og:image:alt" content="${esc(title)}">
  <meta property="og:locale" content="en_US">
${ogLocale}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)} — ${esc(en.case.intro)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${SITE}/assets/shots/${p.img}">
${walkLinks}
  <script src="/assets/js/theme.js?v=${VER}"></script>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="preload" as="image" href="/assets/shots/${p.img}">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": ${JSON.stringify(title)},
    "description": ${JSON.stringify(desc)},
    "author": { "@type": "Person", "name": "Hussein Majed Aidan", "url": "https://mywebsite0776.web.app/" },
    "publisher": { "@type": "Person", "name": "BG Hussein Sash" },
    "mainEntityOfPage": "https://mywebsite0776.web.app/work/${p.slug}",
    "image": "https://mywebsite0776.web.app/assets/shots/${p.img}"
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://mywebsite0776.web.app/" },
      { "@type": "ListItem", "position": 2, "name": "Work", "item": "https://mywebsite0776.web.app/#work" },
      { "@type": "ListItem", "position": 3, "name": ${JSON.stringify(title)} }
    ]
  }
  </script>
  <link rel="stylesheet" href="/assets/css/fonts.css?v=${VER}">
  <link rel="stylesheet" href="/assets/css/style.css?v=${VER}">
  <link rel="stylesheet" href="/assets/css/case.css?v=${VER}">
  <noscript><style>.loader{display:none!important}</style></noscript>
</head>
<body class="case-page">

<a class="skip" href="#main" data-i18n="a11y.skip">${esc(en.a11y.skip)}</a>

<header class="nav">
  <div class="nav-in">
    <a href="/" class="logo">BG<i>.</i>SASH</a>
    <nav data-i18n-aria="a11y.primary" aria-label="Primary">
      <a href="/#work" data-i18n="nav.work">${esc(en.nav.work)}</a><a href="/#services" data-i18n="nav.services">${esc(en.nav.services)}</a><a href="/#about" data-i18n="nav.about">${esc(en.nav.about)}</a><a href="/#contact" data-i18n="nav.contact">${esc(en.nav.contact)}</a>
    </nav>
    <div class="nav-actions">
      <select id="langSelect" class="lang" data-i18n-aria="a11y.language" aria-label="Language">
        <option value="en" lang="en">English</option><option value="ar" lang="ar">العربية</option><option value="ku" lang="ku">کوردی</option><option value="tr" lang="tr">Türkçe</option><option value="fr" lang="fr">Français</option><option value="es" lang="es">Español</option><option value="de" lang="de">Deutsch</option><option value="ru" lang="ru">Русский</option><option value="zh" lang="zh">中文</option><option value="ja" lang="ja">日本語</option><option value="ko" lang="ko">한국어</option><option value="hi" lang="hi">हिन्दी</option>
      </select>
      <button class="theme" id="themeBtn" data-i18n-aria="a11y.theme" aria-label="Switch light or dark theme" data-i18n-title="pal.theme" title="Switch theme"><i></i></button>
    </div>
  </div>
</header>

<main id="main" class="wrap cs">
  <p class="cs-crumb"><a href="/#work" data-i18n="case.back">${esc(en.case.back)}</a> <span>&middot;</span> <span data-i18n="case.intro">${esc(en.case.intro)}</span> <span>&middot;</span> ${num}</p>

  <p class="label" id="csTag" data-i18n="projects.${p.n}.tag">${esc(tag)}</p>
  <h1 class="display cs-title" data-i18n="projects.${p.n}.title">${esc(title)}</h1>
  <p class="lead cs-lead" data-i18n="projects.${p.n}.desc">${esc(desc)}</p>

  <ul class="chips cs-chips">${chips}</ul>

  <figure class="cs-shot">
    <img src="/assets/shots/${p.img}" width="${p.w}" height="${p.h}" alt="${esc(title)} — ${esc(en.alt[p.cover ? 'cover' : 'shot'])}" data-alt="projects.${p.n}.title" data-alt-key="alt.${p.cover ? 'cover' : 'shot'}" loading="eager" decoding="async">
  </figure>

  <dl class="cs-facts">${facts}</dl>

${sections}

  <div class="cs-actions">
    ${live}
    <a class="btn" href="/work/${next.slug}"><span data-i18n="case.next">${esc(en.case.next)}</span><span class="arrow">&rarr;</span></a>
    <a class="btn ghost" href="/#contact"><span data-i18n="nav.contact">${esc(en.nav.contact)}</span><span class="arrow">&rarr;</span></a>
  </div>

  <p class="cs-next-hint"><span data-i18n="case.next">${esc(en.case.next)}</span>: <a href="/work/${next.slug}"><span data-i18n="projects.${next.n}.title">${esc(nextTitle)}</span></a></p>
</main>

<footer>
  <div class="wrap">
    <div class="foot">
      <span data-i18n="footer.tag">${esc(en.footer.tag)}</span>
      <nav data-i18n-aria="a11y.footer" aria-label="Footer">
        <a href="/#work" data-i18n="nav.work">${esc(en.nav.work)}</a><a href="/#services" data-i18n="nav.services">${esc(en.nav.services)}</a><a href="/#contact" data-i18n="nav.contact">${esc(en.nav.contact)}</a>
        <a href="/privacy" data-i18n="footer.privacy">${esc(en.footer.privacy)}</a><a href="/terms" data-i18n="footer.terms">${esc(en.footer.terms)}</a>
        <a href="https://github.com/BGHUSSEINSASH" target="_blank" rel="noopener" lang="en">GitHub</a>
      </nav>
      <span>&copy; 2026 &middot; <span data-i18n="footer.place">${esc(en.footer.place)}</span></span>
    </div>
    <div class="foot-mark" aria-hidden="true">BG Sash</div>
  </div>
</footer>

<script src="/assets/js/tally.js?v=${VER}"></script>
<script src="/assets/js/case.js?v=${VER}"></script>
</body>
</html>
`;
}

fs.mkdirSync(OUT, { recursive: true });
/* rewriting a file that did not change would move its mtime on every run,
   which is exactly the stale-signal bug lastmod is supposed to avoid —
   so a page is only written when its bytes actually differ. */
function writeIfChanged(file, html, label) {
  let same = false;
  try { same = fs.readFileSync(file, 'utf8') === html; } catch (e) {}
  if (same) { console.log('same  ', label); return; }
  fs.writeFileSync(file, html, 'utf8');
  console.log('built ', label);
}
PROJECTS.forEach((p, i) => writeIfChanged(path.join(OUT, p.slug + '.html'), build(p, i), path.relative(ROOT, path.join('work', p.slug + '.html'))));

/* the sitemap is generated from the same project list, so a new case
   page can never be published without being announced to crawlers.
   lastmod comes from the source files — not from "today" — so the date
   only moves when content actually moved. a translation edit moves the
   date too: on a twelve-language site that is most of the churn, and a
   page whose text changed but whose lastmod froze is a stale signal. */
const SHARED = ['assets/i18n/translations.json'];
function stampOf(rel, extra) {
  const files = [rel].concat(SHARED, extra || []);
  let newest = 0;
  for (const f of files) {
    try { newest = Math.max(newest, fs.statSync(path.join(ROOT, f)).mtimeMs); } catch (e) {}
  }
  if (!newest) return new Date();
  return new Date(newest);
}
function lastmodOf(rel, extra) { return stampOf(rel, extra).toISOString().slice(0, 10); }
const CASE_SRC = ['assets/js/case.js', 'assets/css/case.css'];
const caseStamp = (p) => stampOf(path.join('work', p.slug + '.html'), CASE_SRC);
const caseDate = (p) => caseStamp(p).toISOString().slice(0, 10);
const langs = Object.keys(words);
const alt = (href) => langs.map((c) => `    <xhtml:link rel="alternate" hreflang="${c}" href="${href}?lang=${c}"/>`).join('\n');

const home = lastmodOf('index.html', ['assets/js/main.js', 'assets/js/spec.js', 'assets/css/style.css', 'assets/css/spec.css']);
const urls = [
  `  <url>
    <loc>${SITE}/</loc>
${alt(SITE + '/')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>
    <lastmod>${home}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`
].concat(PROJECTS.map((p) => {
  const href = `${SITE}/work/${p.slug}`;
  return `  <url>
    <loc>${href}</loc>
${alt(href)}
    <xhtml:link rel="alternate" hreflang="x-default" href="${href}"/>
    <lastmod>${caseDate(p)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
}));

/* the two legal pages are hand-written, but they belong in the sitemap for
   the same reason the cases do: a crawler that is not told will not read
   them, and a policy nobody can find is not much of a policy. */
['privacy', 'terms'].forEach((slug) => {
  const href = `${SITE}/${slug}`;
  urls.push(`  <url>
    <loc>${href}</loc>
${alt(href)}
    <xhtml:link rel="alternate" hreflang="x-default" href="${href}"/>
    <lastmod>${lastmodOf(slug + '.html', ['assets/css/legal.css', 'assets/js/case.js'])}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>`);
});

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`, 'utf8');
console.log('built sitemap.xml with', urls.length, 'urls');

/* ── the machine-readable layer ─────────────────────────────────
   the two feeds, llms.txt, llms-full.txt and api/profile.json are
   generated from the same PROJECTS array and the same English
   strings the case pages are made of, so a new case lands in every
   one of them on the next run and none of them can drift behind the
   site they describe.

   the date a feed item carries is the date its page last changed —
   `projects.n.when` is a display string and two of them read
   "Field work", which is not a date and must not become one. */
const EN = (p) => en.projects[String(p.n)];
const caseFig = (p) => EN(p).fig || null;
const caseBody = (p) => ['problem', 'solution', 'result']
  .map((f) => en.modal[f] + ': ' + EN(p)[f]).join('\n\n');
const caseTags = (p) => [en.services[p.role].title]
  .concat(['c1', 'c2', 'c3'].map((k) => EN(p)[k]))
  .concat(caseFig(p) ? [caseFig(p)] : []);

/* counts come from the data, never from a number typed into this file: a
   seventh question, a sixth service or a fifth process stage appears in the
   feeds, the llms files and profile.json on the next run without anyone
   remembering to edit three template strings. */
const nums = (n, f) => Array.from({ length: n }, (x, i) => f(i + 1));
const countKeys = (obj, re) => Object.keys(obj).filter((k) => re.test(k)).length;
const FAQ_N = countKeys(en.faq, /^q\d+$/);
const PROC_N = countKeys(en.proc, /^h\d+$/);
const PRICE_N = countKeys(en.pricing, /^p\d+t$/);
const EXP_N = countKeys(en.experience, /^e\dr$/);
/* the small jobs, said plainly: the tiers whose own price line is a number
   at or under the entry price of a business site. derived, so moving a price
   moves this list — and a tier with no written price is never claimed. */
const SMALL_MAX = 150;
const priceNum = (s) => { const m = /^\$(\d+)/.exec(String(s)); return m ? Number(m[1]) : null; };
const SMALL_IDS = nums(PRICE_N, (i) => 'p' + i).filter((k) => {
  const n = priceNum(en.pricing[k + 'pr']);
  return n !== null && n <= SMALL_MAX;
});
const SMALL_NOTE = `${SMALL_IDS.length} of the ${PRICE_N} published prices are $${SMALL_MAX} or under —`
  + ` the same written fixed quote, the same preview link and the same handover as a full platform.`;
const FEED_TITLE = 'BG Hussein Sash — case studies';
const FEED_NOTE = en.meta.description;
const newest = new Date(Math.max.apply(null, PROJECTS.map((p) => caseStamp(p).getTime())));

/* the homepage is where these facts are actually written down, so the
   profile and the two llms files read them out of it instead of retyping
   them — a machine-readable copy that disagrees with the page about a
   phone number is worse than no machine-readable copy. */
const homeHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const person = (homeHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [])
  .map((block) => JSON.parse(block.replace(/^<script[^>]*>/, '').replace(/<\/script>\s*$/, '')))
  .filter((o) => o && o['@type'] === 'Person')[0];
if (!person || !person.email) { console.error('index.html has no Person JSON-LD to read'); process.exit(1); }
// right-to-left is main.js's decision, not this file's
const RTL = ((fs.readFileSync(path.join(ROOT, 'assets/js', 'main.js'), 'utf8')
  .match(/flipped = \[([^\]]*)\]/) || ['', ''])[1]).split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
const SERVICE_IDS = Object.keys(en.services).filter((k) => /^s\d/.test(k));
const hrefs = (re) => [...new Set((homeHtml.match(re) || []).map((x) => x.replace(/^href="/, '').replace(/"$/, '')))];
const phones = hrefs(/href="tel:[^"]+"/g).map((x) => x.slice(4));
const whatsapp = hrefs(/href="https:\/\/wa\.me\/[^"]*"/g)[0] || '';
const github = hrefs(/href="https:\/\/github\.com\/[^"]*"/g)[0] || '';
const cvLinks = hrefs(/href="\/?assets\/cv\/[^"]*"/g).map((x) => SITE + '/' + x.replace(/^\//, ''));
// the label comes from the file name, so an added CV language needs no edit here
const contactLines = [
  ['Email', person.email],
  ['Phone', phones.join(' · ')],
  ['WhatsApp', whatsapp],
  ['GitHub', github]
].concat(cvLinks.map((u) => ['CV — ' + u.replace(/^.*CV-/, '').replace(/\.pdf$/, ''), u]));

const llSite = [
  [SITE + '/', 'Home', 'the whole portfolio — work, services, stack, experience, pricing, estimator, FAQ, contact'],
  [SITE + '/privacy', 'Privacy', 'what a visit leaves behind, in plain terms'],
  [SITE + '/terms', 'Terms', 'what a client agrees to before work starts'],
  [SITE + '/feed.xml', 'Case studies as RSS 2.0', 'all six, in the order the site lists them'],
  [SITE + '/atom.xml', 'Case studies as Atom', 'the same six entries, Atom syntax'],
  [SITE + '/api/profile.json', 'Profile as JSON', 'identity, services, cases, pricing and FAQ as data'],
  [SITE + '/sitemap.xml', 'Sitemap', `every page in all ${langs.length} language variants`],
  [SITE + '/llms-full.txt', 'Full text', 'the whole site as one text file, for a model that does not fetch pages']
];

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(FEED_TITLE)}</title>
    <link>${SITE}/</link>
    <description>${esc(FEED_NOTE)}</description>
    <language>en</language>
    <lastBuildDate>${newest.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${PROJECTS.map((p) => `    <item>
      <title>${esc(EN(p).title)}</title>
      <link>${SITE}/work/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/work/${p.slug}</guid>
      <pubDate>${caseStamp(p).toUTCString()}</pubDate>${caseTags(p).map((x) => `\n      <category>${esc(x)}</category>`).join('')}
      <description>${esc(EN(p).desc + '\n\n' + caseBody(p))}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;

const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>tag:mywebsite0776.web.app,2026:/work</id>
  <title>${esc(FEED_TITLE)}</title>
  <subtitle>${esc(FEED_NOTE)}</subtitle>
  <updated>${newest.toISOString()}</updated>
  <link href="${SITE}/atom.xml" rel="self" type="application/atom+xml"/>
  <link href="${SITE}/" rel="alternate" type="text/html"/>
  <author><name>${esc(person.name)}</name></author>
  <rights>© 2026 ${esc(person.alternateName)}</rights>
${PROJECTS.map((p) => `  <entry>
    <title>${esc(EN(p).title)}</title>
    <id>${SITE}/work/${p.slug}</id>
    <link href="${SITE}/work/${p.slug}" rel="alternate" type="text/html"/>
    <updated>${caseStamp(p).toISOString()}</updated>${caseTags(p).map((x) => `\n    <category term="${esc(x)}"/>`).join('')}
    <summary>${esc(EN(p).desc)}</summary>
    <content type="text">${esc(caseBody(p))}</content>
  </entry>`).join('\n')}
</feed>
`;

writeIfChanged(path.join(ROOT, 'feed.xml'), rss, 'feed.xml');
writeIfChanged(path.join(ROOT, 'atom.xml'), atom, 'atom.xml');

/* llms.txt is an index written for a language model: a short summary, then
   one link per thing worth reading. llms-full.txt is the same content with
   the text itself inlined, for a model that reads once and does not fetch.
   both are English by design — a model given one language does better with
   one honest file than with twelve it has to choose between. */
const llms = `# ${person.alternateName}

> ${en.meta.description}

Generated by \`tools/build-cases.js\` from the same translation file the site
renders, so this index cannot fall behind the pages it lists. The site itself
is written in ${langs.length} languages: every page takes \`?lang=\` with one of
\`${langs.join(', ')}\`; ${RTL.join(' and ')} read right-to-left.

## Site

${llSite.map(([u, text, note]) => `- [${text}](${u}): ${note}`).join('\n')}

## Case studies

${PROJECTS.map((p) => `- [${EN(p).title}](${SITE}/work/${p.slug}): ${EN(p).when} · ${en.services[p.role].title} · ${EN(p).desc}`).join('\n')}

## Services

${SERVICE_IDS.map((id) => `- ${en.services[id].title}: ${en.services[id].desc}`).join('\n')}

## How a job runs

${nums(PROC_N, (i) => `- ${en.proc['h' + i]} (${en.proc['s' + i]}): ${en.proc['p' + i]}`).join('\n')}
- ${en.proc.note}

## Pricing

${en.pricing.note}

${nums(PRICE_N, (i) => `- ${en.pricing['p' + i + 't']} — ${en.pricing['p' + i + 'pr']}: ${en.pricing['p' + i + 'd']}`).join('\n')}

## Small projects

${SMALL_NOTE}

${SMALL_IDS.map((k) => `- ${en.pricing[k + 't']} — ${en.pricing[k + 'pr']}: ${en.pricing[k + 'd']}`).join('\n')}

## Questions answered on the page

${nums(FAQ_N, (i) => `- ${en.faq['q' + i]} ${en.faq['a' + i]}`).join('\n')}

## Contact

${contactLines.map(([text, u]) => `- ${text}: ${u}`).join('\n')}
- ${en.contact.response}
`;

const llmsFull = `# ${person.alternateName} — the site in full text

${en.meta.description}

Generated by \`tools/build-cases.js\` from \`assets/i18n/translations.json\` (the
English branch, which is what every page ships baked in its markup). Edit the
translation file and rebuild; this file is not written by hand.

## Who

${person.name} — ${person.alternateName}, ${person.jobTitle}.
${person.address.addressLocality}, ${person.address.addressCountry}.
Currently ${person.worksFor.name}.

${en.hero.lead}

${en.about.text}

${en.about.body1}

${en.about.body2}

Roles: ${en.hero.roles.join(', ')}.
Knows about: ${person.knowsAbout.join(', ')}.

## Services

${SERVICE_IDS.map((id, i) => `### ${String(i + 1).padStart(2, '0')} ${en.services[id].title}

${en.services[id].desc}

${['li1', 'li2', 'li3'].map((k) => `- ${en.services[id][k]}`).join('\n')}`).join('\n\n')}

## Case studies

${PROJECTS.map((p, i) => `### ${String(i + 1).padStart(2, '0')} ${EN(p).title}

${EN(p).desc}

- Stage: ${EN(p).tag}
- When: ${EN(p).when}
- Role: ${en.services[p.role].title}
- Stack: ${['c1', 'c2', 'c3'].map((k) => EN(p)[k]).join(' · ')}
${caseFig(p) ? `- In numbers: ${caseFig(p)}\n` : ''}- Artwork on the page: ${p.cover ? en.alt.cover : en.alt.shot}
- Live site: ${p.url || 'not public — internal or client-owned system'}
- Page: ${SITE}/work/${p.slug}
- Last changed: ${caseDate(p)}

${caseBody(p).split('\n\n').join('\n\n')}`).join('\n\n')}

## Experience

${nums(EXP_N, (i) => `- ${en.experience['e' + i + 'r']} — ${en.experience['e' + i + 'c']} (${en.experience['e' + i + 'p']}). ${en.experience['e' + i + 'd']}`).join('\n')}

## Pricing

${en.pricing.note}

${nums(PRICE_N, (i) => `- ${en.pricing['p' + i + 't']} — ${en.pricing['p' + i + 'pr']}: ${en.pricing['p' + i + 'd']}`).join('\n')}

### Small projects

${SMALL_NOTE}

${SMALL_IDS.map((k) => `- ${en.pricing[k + 't']} — ${en.pricing[k + 'pr']}: ${en.pricing[k + 'd']}`).join('\n')}

## How a job runs

${(en.proc.t1 + ' ' + en.proc.tem).replace(/\s+/g, ' ').trim()}

${nums(PROC_N, (i) => `${i}. ${en.proc['h' + i]} — ${en.proc['s' + i]}\n${en.proc['p' + i]}`).join('\n\n')}

${en.proc.note}

## Questions

${nums(FAQ_N, (i) => `Q: ${en.faq['q' + i]}\nA: ${en.faq['a' + i]}`).join('\n\n')}

## Contact

${contactLines.map(([text, u]) => `- ${text}: ${u}`).join('\n')}
- ${en.contact.response}

## Read the site in another language

Every page takes \`?lang=\` with one of \`${langs.join(', ')}\`;
${RTL.join(' and ')} render right-to-left. The English text above is the
source the ${langs.length} branches are built from, so nothing here is a paraphrase
of the site.

## Policies

- Privacy: ${SITE}/privacy — ${en.legal.p.lead}
- Terms: ${SITE}/terms — ${en.legal.t.lead}
- ${en.legal.updated}
`;

writeIfChanged(path.join(ROOT, 'llms.txt'), llms, 'llms.txt');
writeIfChanged(path.join(ROOT, 'llms-full.txt'), llmsFull, 'llms-full.txt');

/* api/profile.json: the same facts as data. the identity block is lifted
   out of the homepage JSON-LD rather than retyped, so the two cannot
   disagree about a phone number, and the contact hrefs are read from the
   page that shows them. */
const profile = {
  site: SITE + '/',
  generatedBy: 'tools/build-cases.js',
  updated: newest.toISOString(),
  identity: person,
  roles: en.hero.roles,
  summary: en.meta.description,
  badge: en.hero.badge,
  languages: langs.map((code) => ({ code, dir: RTL.indexOf(code) > -1 ? 'rtl' : 'ltr', title: t(code, 'meta.title') })),
  feeds: { rss: SITE + '/feed.xml', atom: SITE + '/atom.xml', sitemap: SITE + '/sitemap.xml', llms: SITE + '/llms.txt', llmsFull: SITE + '/llms-full.txt' },
  policies: { privacy: SITE + '/privacy', terms: SITE + '/terms', updated: en.legal.updated },
  contact: { email: person.email, phones, whatsapp, github, response: en.contact.response, cv: cvLinks },
  services: SERVICE_IDS.map((id) => ({
    id, title: en.services[id].title, desc: en.services[id].desc,
    points: ['li1', 'li2', 'li3'].map((k) => en.services[id][k])
  })),
  projects: PROJECTS.map((p) => ({
    n: p.n, slug: p.slug, page: SITE + '/work/' + p.slug, url: p.url || null,
    title: EN(p).title, tag: EN(p).tag, when: EN(p).when, updated: caseDate(p),
    role: en.services[p.role].title,
    stack: ['c1', 'c2', 'c3'].map((k) => EN(p)[k]),
    figure: caseFig(p),
    desc: EN(p).desc, problem: EN(p).problem, solution: EN(p).solution, result: EN(p).result,
    artwork: p.cover ? en.alt.cover : en.alt.shot
  })),
  pricing: {
    note: en.pricing.note, currency: 'USD',
    tiers: nums(PRICE_N, (i) => ({
      title: en.pricing['p' + i + 't'], price: en.pricing['p' + i + 'pr'], desc: en.pricing['p' + i + 'd']
    })),
    smallProjects: SMALL_IDS.map((k) => ({ title: en.pricing[k + 't'], price: en.pricing[k + 'pr'], desc: en.pricing[k + 'd'] }))
  },
  process: {
    title: en.proc.t1 + en.proc.tem,
    stages: nums(PROC_N, (i) => ({ stage: en.proc['h' + i], scope: en.proc['s' + i], detail: en.proc['p' + i] })),
    note: en.proc.note
  },
  faq: nums(FAQ_N, (i) => ({ q: en.faq['q' + i], a: en.faq['a' + i] }))
};

fs.mkdirSync(path.join(ROOT, 'api'), { recursive: true });
writeIfChanged(path.join(ROOT, 'api', 'profile.json'), JSON.stringify(profile, null, 2) + '\n', 'api/profile.json');

/* the generated layer is English-only, so the one way it can go wrong is an
   empty en string: that would print "undefined" into a file a crawler reads.
   the keys are listed here, so a translation edit that deletes one fails the
   build instead of shipping a hole. */
const printed = ['meta.description', 'hero.lead', 'hero.badge', 'about.text', 'about.body1', 'about.body2',
  'pricing.note', 'contact.response', 'legal.updated', 'legal.p.lead', 'legal.t.lead', 'alt.shot', 'alt.cover',
  'modal.problem', 'modal.solution', 'modal.result']
  .concat(SERVICE_IDS.reduce((a, id) => a.concat(['services.' + id + '.title', 'services.' + id + '.desc'],
    ['li1', 'li2', 'li3'].map((k) => 'services.' + id + '.' + k)), []))
  .concat(nums(PRICE_N, (i) => ['pricing.p' + i + 't', 'pricing.p' + i + 'pr', 'pricing.p' + i + 'd'])).flat()
  .concat(nums(FAQ_N, (i) => ['faq.q' + i, 'faq.a' + i])).flat()
  .concat(nums(PROC_N, (i) => ['h', 's', 'p'].map((k) => 'proc.' + k + i))).flat()
  .concat(['proc.t1', 'proc.tem', 'proc.note'])
  .concat(Object.keys(FIGURES).map((n) => 'projects.' + n + '.fig'))
  .concat(nums(EXP_N, (i) => ['experience.e' + i + 'r', 'experience.e' + i + 'c', 'experience.e' + i + 'p', 'experience.e' + i + 'd'])).flat();
const enGaps = printed.filter((k) => !t('en', k));
if (enGaps.length) { console.error('en is missing keys the generated layer prints:', enGaps.join(', ')); process.exit(1); }

// report any language that is missing a key these pages read
const needed = ['case.back', 'case.intro', 'case.next', 'case.live', 'case.year', 'case.role', 'case.stack', 'nav.work', 'nav.services', 'nav.about', 'nav.contact', 'footer.tag', 'footer.place', 'footer.privacy', 'footer.terms', 'modal.problem', 'modal.solution', 'modal.result', 'a11y.skip', 'a11y.primary', 'a11y.language', 'a11y.theme', 'a11y.footer', 'alt.shot', 'alt.cover', 'pal.theme', 'services.s1.title', 'services.s2.title', 'services.s3.title'];
for (const lang of Object.keys(words)) {
  const miss = needed.filter((k) => !t(lang, k));
  PROJECTS.forEach((p) => ['title', 'desc', 'tag', 'problem', 'solution', 'result', 'c1', 'c2', 'c3'].forEach((f) => { if (!t(lang, `projects.${p.n}.${f}`)) miss.push(`projects.${p.n}.${f}`); }));
  if (miss.length) console.log('  !', lang, 'missing:', [...new Set(miss)].join(', '));
}
console.log('done');
