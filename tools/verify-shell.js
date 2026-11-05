/* verify-shell.js — Phase A check: every URL the service worker caches must
   answer 200, because caches.addAll() aborts the whole install on one 404.
   run:  node tools/verify-shell.js [baseUrl]                            */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = process.argv[2] || 'http://localhost:8080';

const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');

const V = (/var\s+V\s*=\s*'([^']*)'/.exec(sw) || [, ''])[1];

function arrayFrom(name) {
  const m = new RegExp('var\\s+' + name + '\\s*=\\s*\\[([\\s\\S]*?)\\n\\];').exec(sw);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const q = /^'([^']+)'(?:\s*\+\s*V)?$/.exec(s);
      if (!q) return null;
      return /\+\s*V$/.test(s) ? q[1] + V : q[1];
    })
    .filter(Boolean);
}

const SHELL = arrayFrom('SHELL');
const SHOTS = arrayFrom('SHOTS');

async function check(list, label) {
  const bad = [];
  const rows = await Promise.all(list.map(async (u) => {
    try {
      const r = await fetch(BASE + u, { redirect: 'manual' });
      const code = r.status === 301 || r.status === 302 ? r.status : r.status;
      if (code >= 400) bad.push([u, code]);
      return [u, code];
    } catch (e) {
      bad.push([u, String(e.message || e)]);
      return [u, 'ERR'];
    }
  }));
  console.log(`\n${label} (${list.length})`);
  rows.forEach(([u, c]) => console.log('  ' + (c >= 200 && c < 400 ? 'ok ' : 'BAD') + '  ' + c + '  ' + u));
  return bad;
}

(async () => {
  const bad = [...await check(SHELL, 'SHELL'), ...await check(SHOTS, 'SHOTS')];

  // manifest sanity
  const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const problems = [];
  if (!mf.id) problems.push('manifest: no id');
  if (!mf.scope) problems.push('manifest: no scope');
  (mf.icons || []).forEach((i) => {
    if (String(i.purpose).includes(' ')) problems.push(`manifest icon ${i.src}: multiple purposes in one entry ("${i.purpose}")`);
    if (!/(^\/)|^https?:/.test(i.src)) problems.push(`manifest icon ${i.src}: not root-absolute`);
  });
  (mf.shortcuts || []).forEach((s) => { if (!s.name) problems.push('manifest shortcut missing name'); });
  (mf.screenshots || []).forEach((s) => { if (!s.src || !s.sizes) problems.push('manifest screenshot missing src/sizes'); });

  console.log(`\nmanifest  name=${mf.name}  icons=${(mf.icons || []).length}  shortcuts=${(mf.shortcuts || []).length}  screenshots=${(mf.screenshots || []).length}`);
  problems.forEach((p) => console.log('  BAD  ' + p));

  console.log('\n' + (bad.length === 0 && problems.length === 0 ? 'PASS' : 'FAIL'));
  process.exitCode = bad.length === 0 && problems.length === 0 ? 0 : 1;
})();
