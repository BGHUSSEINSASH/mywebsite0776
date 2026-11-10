/* tools/make-package.js — one folder, ready to hand to a host that is not
   Firebase.
     node tools/make-package.js [--out dist/infinityfree] [--zip]

   the set of files that make up the site is decided once, in the "ignore"
   list of firebase.json, because a package that quietly differs from the
   deploy is how a page ends up missing its stylesheet on one host and not
   the other. so this reads that list and copies everything it does not
   exclude — plus .htaccess, which is the Apache rendering of the same
   policy firebase.json carries as "headers".

   infinityfree's file manager takes a zip, hence --zip. */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const zip = require('./zip');

const root = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT = path.resolve(root, arg('out', path.join('dist', 'infinityfree')));
const WANT_ZIP = process.argv.indexOf('--zip') > -1;

if (!OUT.startsWith(root)) {
  console.error('refusing to write outside the project: ' + OUT);
  process.exit(1);
}

const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
const IGNORE = (firebase.hosting.ignore || []).slice();
// the package's own output, and the apache config that firebase does not need
if (!IGNORE.includes('dist/**')) IGNORE.push('dist/**');
if (!IGNORE.includes('.htaccess')) IGNORE.push('.htaccess');

/* a small glob matcher: the ignore list only ever uses *, ** and literals,
   and pulling in a dependency to match three patterns is not a trade worth
   making on a project with no build step. */
function toRegExp(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // ** swallows whole path segments, including nothing at all
        if (pattern[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
      } else {
        re += '[^/]*';
      }
    } else if ('.+^${}()|[]\\'.indexOf(c) > -1) {
      re += '\\' + c;
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

const RES = IGNORE.map(toRegExp);

function ignored(rel) {
  return RES.some((re) => re.test(rel));
}

function walk(dir, rel, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? rel + '/' + entry.name : entry.name;
    if (ignored(childRel)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, childRel, out);
    else if (entry.isFile()) out.push({ abs: abs, rel: childRel });
  }
  return out;
}

/* the .htaccess is excluded from firebase's deploy but is the whole point
   of this package, so it comes back in here — and it is regenerated first,
   so a package can never ship a config older than the policy it renders. */
execFileSync(process.execPath, [path.join(root, 'tools', 'make-htaccess.js')], { cwd: root, stdio: 'inherit' });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const files = walk(root, '', []);
files.push({ abs: path.join(root, '.htaccess'), rel: '.htaccess' });

let bytes = 0;
for (const f of files) {
  const dest = path.join(OUT, f.rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(f.abs, dest);
  bytes += fs.statSync(dest).size;
}

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log('package: ' + path.relative(root, OUT).replace(/\\/g, '/') +
  ' — ' + files.length + ' files, ' + kb(bytes));

if (WANT_ZIP) {
  const zipPath = OUT + '.zip';
  fs.rmSync(zipPath, { force: true });
  const made = zip.write(zipPath, files.map((f) => ({ rel: f.rel, abs: f.abs })));

  /* read it back: the failure this guards against is silent. an entry named
     with a backslash extracts on linux as one file whose name contains a
     backslash, so .htaccess and .well-known/security.txt simply never arrive
     and the host reports success. */
  const names = zip.list(zipPath);
  const bad = names.filter((n) => n.includes('\\'));
  if (bad.length) {
    console.error('refusing to ship: ' + bad.length + ' entries are named with a backslash, e.g. ' + bad[0]);
    process.exit(1);
  }
  const dots = names.filter((n) => /(^|\/)\./.test(n));
  if (!dots.includes('.htaccess')) {
    console.error('refusing to ship: .htaccess is not in the archive');
    process.exit(1);
  }
  console.log('zip: ' + path.relative(root, zipPath).replace(/\\/g, '/') + ' — ' + kb(made.bytes) +
    ', ' + made.entries + ' entries, verified readable (' + dots.length + ' dotfiles incl. .htaccess)');
}
