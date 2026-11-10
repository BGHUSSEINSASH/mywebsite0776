/* tools/shipset.js — what a deploy publishes, computed one way.

   Both the packager and the security gate need the answer to the same
   question, and a gate that re-implements the walk is a gate that can agree
   with itself while being wrong about firebase. The pattern dialect here is
   the one firebase.json's "ignore" list uses: *, ** and ?, matched against a
   slash-separated relative path. It is deliberately not gitignore's dialect,
   which anchors differently — the gate translates that one itself. */

'use strict';

const fs = require('fs');
const path = require('path');

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

function matcher(patterns) {
  const res = patterns.map(toRegExp);
  return function ignored(rel) { return res.some((re) => re.test(rel)); };
}

function walk(root, ignorePatterns) {
  const ignored = matcher(ignorePatterns);
  const out = [];
  (function descend(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const childRel = rel ? rel + '/' + entry.name : entry.name;
      if (ignored(childRel)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) descend(abs, childRel);
      else if (entry.isFile()) out.push({ abs: abs, rel: childRel });
    }
  })(root, '');
  return out;
}

/* gitignore's dialect, translated. It anchors differently from the one above:
   a pattern with a slash in it is pinned to the repo root, one without matches
   at any depth, and a trailing slash means "this directory and everything in
   it". Getting that wrong in either direction is bad — too loose and the gate
   passes a leak through, too strict and it fails a healthy deploy. */
function gitIgnoreRules(root) {
  const file = path.join(root, '.gitignore');
  const ignore = [];
  const keep = [];
  if (!fs.existsSync(file)) return { ignore: ignore, keep: keep };
  fs.readFileSync(file, 'utf8').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line || line[0] === '#') return;
    const neg = line[0] === '!';
    const body = neg ? line.slice(1) : line;
    const dir = /\/$/.test(body);
    const p = body.replace(/\/+$/, '');
    const anchored = p.indexOf('/') > -1;
    let re = anchored ? '' : '(?:.*/)?';
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === '*') {
        if (p[i + 1] === '*') {
          if (p[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
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
    if (dir) re += '(?:/.*)?';
    (neg ? keep : ignore).push(new RegExp('^' + re + '$'));
  });
  return { ignore: ignore, keep: keep };
}

/* which of these files would git call junk? a non-empty answer means the two
   ignore lists disagree, and the disagreement is resolved by publishing. */
function gitJunk(root, files) {
  const rules = gitIgnoreRules(root);
  if (!rules.ignore.length) return [];
  return files.map((f) => f.rel).filter((rel) =>
    rules.ignore.some((re) => re.test(rel)) && !rules.keep.some((re) => re.test(rel)));
}

module.exports = { toRegExp, matcher, walk, gitIgnoreRules, gitJunk };
