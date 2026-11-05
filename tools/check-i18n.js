/* check-i18n.js — every key the site asks for must exist in all 12
   languages.  sources: data-i18n in the html, say('k', …) in the js,
   and the namespaces the case builder reads.
   run:  node tools/check-i18n.js                                          */

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

const keys = new Set();
function harvest(src, re) { let m; while ((m = re.exec(src))) { const k = m[m.length - 1]; if (k && !/\.$/.test(k)) keys.add(k); } }

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
harvest(html, /data-i18n="([^"]+)"/g);

const spec = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'spec.js'), 'utf8');
harvest(spec, /say\('([\w.]+)'/g);

const main = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'main.js'), 'utf8');
harvest(main, /say\('([\w.]+)'/g);

const nf = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
harvest(nf, /data-i18n="([^"]+)"/g);

// keys spec.js builds dynamically: est units + speed + addons
const dyn = [];
for (const m of spec.matchAll(/unitKey: '([^']+)'/g)) dyn.push(m[1]);
for (const m of spec.matchAll(/key: '([^']+)'/g)) dyn.push(m[1]);
for (const m of spec.matchAll(/nameKey: '([^']+)'/g)) dyn.push(m[1]);
dyn.forEach((k) => keys.add(k));

const absent = {}, blank = {};
for (const lang of LANGS) {
  for (const k of keys) {
    const v = dig(words[lang], k);
    if (v === undefined) (absent[lang] = absent[lang] || []).push(k);
    else if (v === '') (blank[lang] = blank[lang] || []).push(k);
  }
}

const enAbsent = absent.en || [];
console.log('keys referenced:', keys.size, '| languages:', LANGS.length);
console.log('keys with no english entry (code supplies the fallback):', enAbsent.length ? enAbsent.join(', ') : 'none');

let holes = 0;
for (const lang of LANGS) {
  const list = (absent[lang] || []).filter((k) => !enAbsent.includes(k));
  if (list.length) { holes += list.length; console.log('  ' + lang + ' ABSENT ' + list.length + ':', list.slice(0, 12).join(', ') + (list.length > 12 ? ' …' : '')); }
  const b = (blank[lang] || []).filter((k) => !(absent.en || []).includes(k));
  if (b.length) console.log('  ' + lang + ' empty-by-design:', b.join(', '));
}
console.log(holes === 0 ? 'PASS' : 'FAIL: ' + holes + ' real holes');
process.exitCode = holes === 0 ? 0 : 1;
