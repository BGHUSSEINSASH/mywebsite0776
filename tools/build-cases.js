/* build-cases.js — generates the six static case-study pages from
   assets/i18n/translations.json, so every page ships with the same
   translated content the homepage uses (12 languages, no drift).
   run:  node tools/build-cases.js
   output: work/<slug>.html                                          */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'work');
const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'i18n', 'translations.json'), 'utf8'));

// slug, image, live url (null for the two field cases), role = services key
const PROJECTS = [
  { n: 1, slug: 'smartmaid',  img: 'smartmaid.webp',  w: 1280, h: 998,  url: 'https://smartmaid-website.vercel.app/ar',            role: 's1' },
  { n: 2, slug: 'mukallaf',   img: 'mukallaf.webp',   w: 1280, h: 1006, url: 'https://bghusseinsash.github.io/iraqi-tax-system/',   role: 's1' },
  { n: 3, slug: 'flossk',     img: 'flossk.webp',     w: 1280, h: 1006, url: 'https://bghusseinsash.github.io/flossk-app/',         role: 's2' },
  { n: 4, slug: 'bookly',     img: 'bookly.webp',     w: 1280, h: 1006, url: 'https://taupe-paprenjak-258494.netlify.app/',         role: 's1' },
  { n: 5, slug: 'ziona-passports', img: 'smartmaid-2.webp', w: 1280, h: 998, url: null,                                              role: 's3' },
  { n: 6, slug: 'hala-sat',   img: 'flossk-2.webp',   w: 1280, h: 1006, url: null,                                                role: 's3' }
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

function build(p, idx) {
  const next = PROJECTS[(idx + 1) % PROJECTS.length];
  const num = String(p.n).padStart(2, '0');
  const title = en.projects[String(p.n)].title;
  const desc = en.projects[String(p.n)].desc;
  const tag = en.projects[String(p.n)].tag;
  const when = en.projects[String(p.n)].when;
  const role = en.services[p.role].title;
  const chips = ['c1', 'c2', 'c3'].map((k) => `<li data-i18n="projects.${p.n}.${k}">${esc(en.projects[String(p.n)][k])}</li>`).join('');
  const live = p.url
    ? `<a class="btn ghost" href="${esc(p.url)}" target="_blank" rel="noopener"><span data-i18n="case.live">${esc(en.case.live)}</span><span class="arrow">&#8599;</span></a>`
    : '';
  const nextTitle = en.projects[String(next.n)].title;

  const facts = [
    ['case.year', en.case.year, when],
    ['case.role', en.case.role, role],
    ['case.stack', en.case.stack, ['c1', 'c2', 'c3'].map((k) => en.projects[String(p.n)][k]).join(' · ')]
  ].map(([k, label, val]) => `<div><dt data-i18n="${k}">${esc(label)}</dt><dd>${esc(val)}</dd></div>`).join('');

  const sections = ['problem', 'solution', 'result'].map((f) => `
      <section class="cs-block">
        <p class="label" data-i18n="modal.${f}">${esc(en.modal[f])}</p>
        <p class="cs-text" data-i18n="projects.${p.n}.${f}">${esc(en.projects[String(p.n)][f])}</p>
      </section>`).join('');

  return `<!DOCTYPE html>
<html lang="en" dir="ltr" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${esc(title)} — ${esc(en.case.intro)} · BG Hussein Sash</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="theme-color" content="#0e0f11">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <link rel="canonical" href="/work/${p.slug}">
  <meta property="og:title" content="${esc(title)} — ${esc(en.case.intro)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:type" content="article">
  <meta property="og:image" content="/assets/shots/${p.img}">
  <script>
    try {
      var st = localStorage.getItem('theme');
      document.documentElement.dataset.theme = st || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    } catch (e) { document.documentElement.dataset.theme = 'dark'; }
  </script>
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="/manifest.webmanifest">
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@300..900&family=Newsreader:ital,opsz,wght@0,6..72,300..800;1,6..72,300..800&family=IBM+Plex+Mono:wght@400;500&family=Hanken+Grotesk:wght@300..800&family=Noto+Sans+Arabic:wght@300..800&family=Noto+Naskh+Arabic:wght@400..700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/style.css?v=r06">
  <link rel="stylesheet" href="/assets/css/case.css?v=r06">
  <noscript><style>.loader{display:none!important}</style></noscript>
</head>
<body class="case-page">

<a class="skip" href="#main">Skip to content</a>

<header class="nav">
  <div class="nav-in">
    <a href="/" class="logo">BG<i>.</i>SASH</a>
    <nav aria-label="Primary">
      <a href="/#work" data-i18n="nav.work">${esc(en.nav.work)}</a><a href="/#services" data-i18n="nav.services">${esc(en.nav.services)}</a><a href="/#about" data-i18n="nav.about">${esc(en.nav.about)}</a><a href="/#contact" data-i18n="nav.contact">${esc(en.nav.contact)}</a>
    </nav>
    <div class="nav-actions">
      <select id="langSelect" class="lang" aria-label="Language">
        <option value="en">English</option><option value="ar">العربية</option><option value="ku">کوردی</option><option value="tr">Türkçe</option><option value="fr">Français</option><option value="es">Español</option><option value="de">Deutsch</option><option value="ru">Русский</option><option value="zh">中文</option><option value="ja">日本語</option><option value="ko">한국어</option><option value="hi">हिन्दी</option>
      </select>
      <button class="theme" id="themeBtn" aria-label="Switch light or dark theme" title="Switch theme"><i></i></button>
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
    <img src="/assets/shots/${p.img}" width="${p.w}" height="${p.h}" alt="${esc(title)} — screenshot" loading="eager" decoding="async">
  </figure>

  <dl class="cs-facts">${facts}</dl>

${sections}

  <div class="cs-actions">
    ${live}
    <a class="btn" href="/work/${next.slug}"><span data-i18n="case.next">${esc(en.case.next)}</span><span class="arrow">&rarr;</span></a>
    <a class="btn ghost" href="/#contact"><span data-i18n="nav.contact">${esc(en.nav.contact)}</span><span class="arrow">&rarr;</span></a>
  </div>

  <p class="cs-next-hint">${esc(en.case.next)}: <a href="/work/${next.slug}">${esc(nextTitle)}</a></p>
</main>

<footer>
  <div class="wrap">
    <div class="foot">
      <span data-i18n="footer.tag">${esc(en.footer.tag)}</span>
      <nav aria-label="Footer">
        <a href="/#work" data-i18n="nav.work">${esc(en.nav.work)}</a><a href="/#services" data-i18n="nav.services">${esc(en.nav.services)}</a><a href="/#contact" data-i18n="nav.contact">${esc(en.nav.contact)}</a>
        <a href="https://github.com/BGHUSSEINSASH" target="_blank" rel="noopener">GitHub</a>
      </nav>
      <span>&copy; 2026 &middot; <span data-i18n="footer.place">${esc(en.footer.place)}</span></span>
    </div>
    <div class="foot-mark" aria-hidden="true">BG Sash</div>
  </div>
</footer>

<script src="/assets/js/case.js?v=r06"></script>
</body>
</html>
`;
}

fs.mkdirSync(OUT, { recursive: true });
PROJECTS.forEach((p, i) => {
  const file = path.join(OUT, p.slug + '.html');
  fs.writeFileSync(file, build(p, i), 'utf8');
  console.log('built', path.relative(ROOT, file));
});

// report any language that is missing a key these pages read
const needed = ['case.back', 'case.intro', 'case.next', 'case.live', 'case.year', 'case.role', 'case.stack', 'nav.work', 'nav.services', 'nav.about', 'nav.contact', 'footer.tag', 'footer.place', 'modal.problem', 'modal.solution', 'modal.result'];
for (const lang of Object.keys(words)) {
  const miss = needed.filter((k) => !t(lang, k));
  PROJECTS.forEach((p) => ['title', 'desc', 'tag', 'problem', 'solution', 'result', 'c1', 'c2', 'c3'].forEach((f) => { if (!t(lang, `projects.${p.n}.${f}`)) miss.push(`projects.${p.n}.${f}`); }));
  if (miss.length) console.log('  !', lang, 'missing:', [...new Set(miss)].join(', '));
}
console.log('done');
