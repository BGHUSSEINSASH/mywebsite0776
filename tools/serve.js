// tools/serve.js — local static server for the portfolio (no deps).
//   node tools/serve.js [port]
// service-worker.js is refused on http://localhost paths other than root-
// relative, so it is served with the same headers firebase would give it.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { RULES } = require('./security-config');

// security-config writes its headers as a keyed map because that reads
// better; firebase wants a list of {key,value}. flattened here so the
// local server sends exactly the bytes the real host would.
const FLAT = RULES.map((r) => ({
  source: r.source,
  headers: Object.keys(r.headers).map((key) => ({ key: key, value: r.headers[key] }))
}));

// firebase.json never uploads these, so localhost must not answer for them
const NOT_PUBLISHED = [/^\/tools\//, /^\/supabase\//, /^\/\.git/, /^\/\.firebase/];

function ruleMatches(source, url) {
  if (source === '**' || source === '/**') return true;
  const clean = url.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  return source === url || source === clean;
}

/* the same headers firebase would send, so a policy mistake shows up on
   localhost instead of only after a deploy. later rules win, like in the
   real config. */
function withSecurity(url, base) {
  const out = Object.assign({}, base);
  for (const rule of FLAT) {
    if (!ruleMatches(rule.source, url)) continue;
    for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

const root = path.resolve(__dirname, '..');
const port = Number(process.argv[2]) || 8080;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2'
};

http.createServer((req, res) => {
  // dev-only: lets the browser hand rasterised png/og assets back to disk,
  // so icons and the share cover are generated from the real web fonts.
  // whitelisted to the two asset folders, nothing else can be written.
  if (req.url === '/__dev-write' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 8e6) req.destroy(); });
    req.on('end', () => {
      try {
        const { path: rel, b64 } = JSON.parse(body);
        const ok = /^assets\/(icons|shots)\/[a-z0-9._-]+\.(png|webp)$/i.test(rel);
        if (!ok) throw new Error('path not allowed');
        const file = path.join(root, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(b64, 'base64'));
        console.log('wrote', rel, fs.statSync(file).size + 'B');
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  /* dev-only stand-in for the supabase edge function, so the box under the
     clock is visible and moves on this machine while SUPABASE_URL is still
     empty. tally.js only takes this branch on a loopback host, so a deployed
     page never asks localhost for a number. the counts live in the temp dir,
     which means the figures survive a server restart and die with the disk. */
  if (req.url.split('?')[0] === '/functions/v1/site-stats' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 4e3) req.destroy(); });
    req.on('end', () => {
      const store = path.join(os.tmpdir(), 'bgsash-dev-tally.json');
      const BOT = /bot|crawl|spider|curl|wget|headless|lighthouse|node-fetch/i;
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
      let db = { totals: { views: 0, visitors: 0 }, days: {}, uniq: {} };
      try { db = JSON.parse(fs.readFileSync(store, 'utf8')); } catch (e) {}

      const ua = req.headers['user-agent'] || '';
      const counted = !BOT.test(ua) && !!ua;
      if (counted) {
        const key = day + ':' + crypto.createHash('sha256')
          .update('dev-salt|' + (req.socket.remoteAddress || 'local') + '|' + day).digest('hex').slice(0, 32);
        const seen = !!db.uniq[key];
        if (!seen) db.uniq[key] = 1;
        db.days[day] = db.days[day] || { views: 0, visitors: 0 };
        db.totals.views += 1;
        db.days[day].views += 1;
        if (!seen) { db.totals.visitors += 1; db.days[day].visitors += 1; }
        fs.writeFileSync(store, JSON.stringify(db));
      }

      res.writeHead(200, withSecurity('/functions/v1/site-stats', { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }))
        .end(JSON.stringify({
          ok: true,
          counted: counted,
          views: db.totals.views,
          visitors: db.totals.visitors,
          today: (db.days[day] || {}).visitors || 0,
          todayViews: (db.days[day] || {}).views || 0,
          avail: { state: 'auto', note: '' }
        }));
    });
    return;
  }

  let url = decodeURIComponent(req.url.split('?')[0]);
  if (NOT_PUBLISHED.some((re) => re.test(url))) { res.writeHead(404, withSecurity(url, {})).end('not published'); return; }
  let file = path.join(root, url);
  if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && path.extname(file) === '') {
    const alt = file + '.html';
    if (fs.existsSync(alt)) file = alt;
  }
  if (!fs.existsSync(file)) {
    const nf = path.join(root, '404.html');
    // firebase answers a miss with 404.html plus the same headers, so the
    // local server has to send them too or a policy error hides until prod
    const nfHead = withSecurity(url, { 'Content-Type': types['.html'] });
    if (fs.existsSync(nf)) { res.writeHead(404, nfHead).end(fs.readFileSync(nf)); return; }
    res.writeHead(404).end('not found'); return;
  }

  const head = withSecurity(url, {
    'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': /assets\/(css|js|shots|i18n|cv)\//.test(url) ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
  if (url.includes('service-worker.js')) head['Service-Worker-Allowed'] = '/';
  res.writeHead(200, head).end(fs.readFileSync(file));
}).listen(port, () => console.log('serving ' + root + ' → http://localhost:' + port));
