/* add-case-figures.js — writes the two case figures that the approved
   English copy already states but the case pages never showed:
   projects.1.fig  — "59 admin switches"   (smartmaid: "an admin panel with 59 control switches")
   projects.4.fig  — "4-step booking"      (bookly:  "a four-step booking flow")
   the other four cases already carry their number as a chip
   (mukallaf "7 tax modules", flossk "Voice assistant (80+)"), and the two
   field cases state no figure at all, so they get no chip rather than one
   invented here.
   every string is a 12-wide array in LANGS order; idempotent.            */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'assets', 'i18n', 'translations.json');
const LANGS = ['en', 'ar', 'ku', 'tr', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ko', 'hi'];

const D = {};

D.projects = {
  '1.fig': [
    '59 admin switches',
    '59 مفتاح تحكم',
    '59 دوگمەی کۆنترۆڵ',
    '59 kontrol anahtarı',
    '59 commutateurs d’administration',
    '59 controles de administración',
    '59 Kontroll-Schalter',
    '59 переключателей в админке',
    '59 个后台开关',
    '管理画面のスイッチ59個',
    '관리자 스위치 59개',
    '59 एडमिन स्विच'
  ],
  '4.fig': [
    '4-step booking',
    'حجز بأربع خطوات',
    'حجزکردن بە 4 هەنگاو',
    '4 adımda rezervasyon',
    'Réservation en 4 étapes',
    'Reserva en 4 pasos',
    'Buchung in 4 Schritten',
    'Бронирование в 4 шага',
    '4 步完成预订',
    '4ステップの予約',
    '4단계 예약',
    '4 चरण की बुकिंग'
  ]
};

const words = JSON.parse(fs.readFileSync(FILE, 'utf8'));

function main() {
  let added = 0, kept = 0;
  for (const ns of Object.keys(D)) {
    for (const key of Object.keys(D[ns])) {
      const arr = D[ns][key];
      if (arr.length !== LANGS.length) throw new Error(ns + '.' + key + ' has ' + arr.length + ' values, want ' + LANGS.length);
      LANGS.forEach((lang, i) => {
        words[lang] = words[lang] || {};
        const parts = (ns + '.' + key).split('.');
        let cur = words[lang];
        for (let n = 0; n < parts.length - 1; n++) { cur[parts[n]] = cur[parts[n]] || {}; cur = cur[parts[n]]; }
        const leaf = parts[parts.length - 1];
        if (cur[leaf]) { kept++; return; }
        cur[leaf] = arr[i];
        added++;
      });
    }
  }
  fs.writeFileSync(FILE, JSON.stringify(words, null, 2) + '\n', 'utf8');
  console.log('figures:', Object.keys(D.projects).join(', '), '| languages:', LANGS.length, '| written:', added, '| already there:', kept);
}

main();
