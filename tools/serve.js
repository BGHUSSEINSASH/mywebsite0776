// tools/serve.js — local static server for the portfolio (no deps).
//   node tools/serve.js [port]
// service-worker.js is refused on http://localhost paths other than root-
// relative, so it is served with the same headers firebase would give it.
const http = require('http');
const fs = require('fs');
const path = require('path');

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
  '.webmanifest': 'application/manifest+json; charset=utf-8'
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

  let url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, url);
  if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) && path.extname(file) === '') {
    const alt = file + '.html';
    if (fs.existsSync(alt)) file = alt;
  }
  if (!fs.existsSync(file)) {
    const nf = path.join(root, '404.html');
    if (fs.existsSync(nf)) { res.writeHead(404, { 'Content-Type': types['.html'] }).end(fs.readFileSync(nf)); return; }
    res.writeHead(404).end('not found'); return;
  }

  const head = {
    'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': /assets\/(css|js|shots|i18n|cv)\//.test(url) ? 'public, max-age=31536000, immutable' : 'no-cache'
  };
  if (url.includes('service-worker.js')) head['Service-Worker-Allowed'] = '/';
  res.writeHead(200, head).end(fs.readFileSync(file));
}).listen(port, () => console.log('serving ' + root + ' → http://localhost:' + port));
