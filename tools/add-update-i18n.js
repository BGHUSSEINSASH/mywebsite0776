/* add-update-i18n.js — the three strings the "a newer copy is ready" bar
   says, written in all twelve languages at once.
   keys: upd.body (the line), upd.go (the button), upd.later (its aria-label)
   every string is a 12-wide array in LANGS order; idempotent — an existing
   non-empty value is never overwritten.                                      */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'assets', 'i18n', 'translations.json');
const LANGS = ['en', 'ar', 'ku', 'tr', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ko', 'hi'];

const D = {
  upd: {
    body: [
      'A newer copy of this page is ready.',
      'نسخة أحدث من هذه الصفحة جاهزة.',
      'وەشانێکی نوێتر لەم پەڕەیە ئامادەیە.',
      'Bu sayfanın daha yeni bir sürümü hazır.',
      'Une version plus récente de cette page est prête.',
      'Hay lista una versión más reciente de esta página.',
      'Eine neuere Version dieser Seite ist bereit.',
      'Доступна новая версия этой страницы.',
      '此页面的新版本已就绪。',
      'このページの新しい版が準備できました。',
      '이 페이지의 새 버전이 준비되었습니다.',
      'इस पेज का नया संस्करण तैयार है।'
    ],
    go: [
      'Reload',
      'إعادة التحميل',
      'دووبارە بارکردن',
      'Yenile',
      'Recharger',
      'Recargar',
      'Neu laden',
      'Обновить',
      '重新加载',
      '再読み込み',
      '새로 고침',
      'फिर से लोड करें'
    ],
    later: [
      'Keep reading this copy',
      'المتابعة على هذه النسخة',
      'بەم وشانە بەردەوامبە',
      'Bu sürümü okumaya devam et',
      'Continuer avec cette version',
      'Seguir leyendo esta versión',
      'Diese Version weiter lesen',
      'Остаться на этой версии',
      '继续查看当前版本',
      'この版のまま読む',
      '이 버전을 계속 보기',
      'इसी संस्करण को पढ़ते रहें'
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
  console.log('upd keys:', Object.keys(D.upd).join(', '), '| languages:', LANGS.length,
    '| written:', added, '| already there:', kept);
}

main();
