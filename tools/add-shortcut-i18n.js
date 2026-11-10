/* add-shortcut-i18n.js — the three strings the "?" list says, written with
   the other eleven languages at the same time.
   keys: keys.title (its heading, and the palette entry that opens it),
         keys.tabs  (what the arrow keys do), keys.esc (what escape does).
   every string is a 12-wide array in LANGS order; idempotent — an existing
   non-empty value is never overwritten.                                      */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'assets', 'i18n', 'translations.json');
const LANGS = ['en', 'ar', 'ku', 'tr', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ko', 'hi'];

const D = {
  keys: {
    title: [
      'Keyboard shortcuts',
      'اختصارات لوحة المفاتيح',
      'کورتەڕێکانی تەختەکلیل',
      'Klavye kısayolları',
      'Raccourcis clavier',
      'Atajos de teclado',
      'Tastenkürzel',
      'Горячие клавиши',
      '键盘快捷键',
      'キーボードショートカット',
      '키보드 단축키',
      'कीबोर्ड शॉर्टकट'
    ],
    tabs: [
      'Move between the stack tabs',
      'التنقل بين تبويبات التقنيات',
      'لەنێوان پەڕۆکەکانی تەکنەلۆژیا بجوڵێ',
      'Teknoloji sekmeleri arasında geç',
      'Se déplacer entre les onglets de stack',
      'Moverse entre las pestañas de stack',
      'Zwischen den Stack-Tabs wechseln',
      'Переключение между вкладками стека',
      '在技术栈标签间切换',
      'スタックのタブを切り替える',
      '기술 스택 탭 사이 이동',
      'स्टैक टैब के बीच जाएँ'
    ],
    esc: [
      'Close what is open',
      'إغلاق ما هو مفتوح',
      'ئەوەی کراوەیە دابخرە',
      'Açık olanı kapat',
      'Fermer ce qui est ouvert',
      'Cerrar lo que esté abierto',
      'Offenes schließen',
      'Закрыть то, что открыто',
      '关闭当前打开的内容',
      '開いているものを閉じる',
      '열린 것 닫기',
      'जो खुला है उसे बंद करें'
    ]
  }
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
  console.log('keys namespace:', Object.keys(D.keys).join(', '), '| languages:', LANGS.length,
    '| written:', added, '| already there:', kept);
}

main();
