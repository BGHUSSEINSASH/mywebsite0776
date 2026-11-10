/* tools/zip.js — a zip writer, because the one Windows ships gets this wrong.
   require('./zip').write(outPath, [{ rel, abs }])

   Compress-Archive names its entries with backslashes (.well-known\security.txt).
   the spec says forward slash, and a Linux extractor — which is what a hosting
   control panel runs — obeys the bytes it is given, so it creates one file whose
   name literally contains a backslash instead of a directory and a file. the
   site then ships with no security.txt and no .htaccess, and nothing complains.

   GNU tar cannot write zip at all, so the alternative is a dependency, and this
   project has none. the format needed here is small: deflate entries, one
   central directory, no zip64, no splitting, no comments. */

'use strict';

const fs = require('fs');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* dos time is two seconds per unit and has no timezone, so a file written
   after 23:59:58 local would wrap into the previous day. clamped, because a
   date in the future makes some extractors refuse the entry. */
function dosStamp(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.min(29, d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time: time, date: date };
}

function write(out, entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(String(e.rel).replace(/\\/g, '/'), 'utf8');
    if (name.includes('\0')) throw new Error('zip entry name contains a nul: ' + e.rel);
    const data = fs.readFileSync(e.abs);
    const st = e.mtime ? fs.statSync(e.abs) : null;
    const stamp = dosStamp(st ? st.mtime : new Date());
    const crc = crc32(data);

    const deflated = zlib.deflateRawSync(data, { level: 9 });
    // a file that will not shrink is stored, not deflated — method 0
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0x0800, 6);        // flag: names are utf-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);            // no extra field

    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);          // version made by
    central.writeUInt16LE(20, 6);          // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);          // extra
    central.writeUInt16LE(0, 32);          // comment
    central.writeUInt16LE(0, 34);          // disk
    central.writeUInt16LE(0, 36);          // internal attrs
    central.writeUInt32LE(0, 38);          // external attrs
    central.writeUInt32LE(offset, 42);     // where the local header sits
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  fs.writeFileSync(out, Buffer.concat([...locals, cd, eocd]));
  return { entries: entries.length, bytes: fs.statSync(out).size };
}

/* read the central directory back, so a caller can prove the archive it just
   wrote says what it meant — the separator bug above is invisible otherwise. */
function list(file) {
  const buf = fs.readFileSync(file);
  let i = buf.length - 22;
  while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < 0) throw new Error('not a zip: no end-of-central-directory record');
  const count = buf.readUInt16LE(i + 10);
  let p = buf.readUInt32LE(i + 16);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('central directory is corrupt at entry ' + n);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    out.push(buf.slice(p + 46, p + 46 + nameLen).toString('utf8'));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

module.exports = { write, list, crc32 };
