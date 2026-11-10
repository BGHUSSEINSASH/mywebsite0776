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
const { walk, gitJunk } = require('./shipset');

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

/* the .htaccess is excluded from firebase's deploy but is the whole point
   of this package, so it comes back in here — and it is regenerated first,
   so a package can never ship a config older than the policy it renders. */
execFileSync(process.execPath, [path.join(root, 'tools', 'make-htaccess.js')], { cwd: root, stdio: 'inherit' });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const files = walk(root, IGNORE);

/* the failure this guards against already happened: .gitignore hides a file
   from every git command, firebase.json's ignore list never heard of it, and
   a dev server's log went to production carrying the absolute path of the
   machine it was written on. the two lists are separate and nothing but this
   check makes them agree. */
const junk = gitJunk(root, files);
if (junk.length) {
  console.error('refusing to package: ' + junk.length + ' file(s) are git junk that firebase.json would publish');
  junk.forEach((j) => console.error('  ' + j + '   ← add a matching pattern to firebase.json "ignore"'));
  process.exit(1);
}
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
