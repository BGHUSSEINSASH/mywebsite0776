/* writes tools/security-config.js into firebase.json and into the
   content-security-policy meta tag of every page. run it after changing
   the config, then run tools/check-security.js to prove they agree. */

const fs = require('fs');
const path = require('path');
const { CSP_META, HEADERS, ADMIN_HEADERS } = require('./security-config');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => { fs.writeFileSync(path.join(root, f), s, 'utf8'); };

const headerList = (map) => Object.keys(map).map((key) => ({ key, value: map[key] }));

// ── firebase.json ───────────────────────────────────────────
const fbPath = 'firebase.json';
const fb = JSON.parse(read(fbPath));
const rules = fb.hosting.headers;
const wanted = (source, map) => {
  const hit = rules.find((r) => r.source === source);
  if (hit) hit.headers = headerList(map);
  else rules.unshift({ source, headers: headerList(map) });
};
wanted('**', HEADERS);
wanted('/admin', ADMIN_HEADERS);
wanted('/admin.html', ADMIN_HEADERS);
write(fbPath, JSON.stringify(fb, null, 2) + '\n');
console.log('firebase.json: header rules written for **, /admin, /admin.html');

// ── meta tags ───────────────────────────────────────────────
const META = '  <meta http-equiv="Content-Security-Policy" content="' + CSP_META + '">';
const PAGES = require('./pages').SHARED;
const ANCHORS = [
  /(\n[ \t]*<meta name="viewport"[^\n]*\n)/,
  /(\n[ \t]*<title>[^\n]*<\/title>\n)/
];

for (const page of PAGES) {
  let s = read(page);
  const existing = s.match(/\n[ \t]*<meta http-equiv="Content-Security-Policy"[^\n]*\n/);
  if (existing) {
    s = s.replace(existing[0], '\n' + META + '\n');
    console.log(page + ': CSP updated');
  } else {
    const anchor = ANCHORS.map((re) => ({ re, m: s.match(re) })).find((x) => x.m);
    if (!anchor) { console.error(page + ': no anchor to insert the CSP after'); process.exit(1); }
    s = s.replace(anchor.re, anchor.m[0] + META + '\n');
    console.log(page + ': CSP inserted');
  }
  write(page, s);
  const n = (s.match(/Content-Security-Policy/g) || []).length;
  if (n !== 1) { console.error(page + ': expected exactly 1 CSP meta, found ' + n); process.exit(1); }
}
