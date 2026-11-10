/* split-i18n.js — writes one file per language out of translations.json:
   assets/i18n/<code>.json, each holding only that language's tree.

   why: translations.json is every language at once — about 320 KB of json,
   and a visitor who reads one language was downloading all twelve to paint
   one page. the pages now ask for their own file, and the twelve stay where
   they belong: in this repo, as the source of truth.

   the split files are generated. never edit one by hand — edit
   translations.json (through the add-*-i18n tools) and re-run this file.
   check-i18n.js compares every split against the source, and the ci job
   fails on a diff, so a split cannot fall behind.

   run:  node tools/split-i18n.js                                       */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'i18n', 'translations.json');
const OUT = path.join(ROOT, 'assets', 'i18n');

const words = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const langs = Object.keys(words);

// the runtime reads the language list off the page's own <select>, so a
// language that is not authored here can never be picked — but say so if
// the two ever disagree.
const homeHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const offered = [...new Set((homeHtml.match(/<option value="([a-z]{2})" lang="/g) || []).map((m) => /value="([a-z]{2})"/.exec(m)[1]))];
const wrong = offered.filter((c) => langs.indexOf(c) < 0);
if (wrong.length) { console.error('index.html offers languages that are not in translations.json:', wrong.join(', ')); process.exit(1); }

let written = 0, same = 0;
for (const code of langs) {
  const body = JSON.stringify(words[code], null, 2) + '\n';
  const file = path.join(OUT, code + '.json');
  let current = null;
  try { current = fs.readFileSync(file, 'utf8'); } catch (e) {}
  if (current === body) { same++; continue; }
  fs.writeFileSync(file, body, 'utf8');
  written++;
}

const bytes = langs.reduce((a, c) => a + fs.statSync(path.join(OUT, c + '.json')).size, 0);
console.log('languages:', langs.length, '| written:', written, '| unchanged:', same, '| each file:',
  langs.map((c) => c + ' ' + Math.round(fs.statSync(path.join(OUT, c + '.json')).size / 1024) + 'k').join(', '));
console.log('together:', Math.round(bytes / 1024) + ' KB on disk — a page now fetches one of them, not all');
