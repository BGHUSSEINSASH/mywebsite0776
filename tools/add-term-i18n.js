/* tools/add-term-i18n.js — fills the terminal's spoken lines.
   the shell itself (help, whoami, date) is ascii and stays as-is; what has to
   follow the visitor's language is the responses: errors, usage, the sudo joke.
   each key carries all twelve languages in the fixed order, so a missing
   language shows up as a hole in this file rather than a silent english leak.
   idempotent: an existing non-empty value is never overwritten.             */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'assets', 'i18n', 'translations.json');
const LANGS = ['en', 'ar', 'ku', 'tr', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ko', 'hi'];

const T = {
  helpNote: [
    'commands are read-only: they do what the page buttons do',
    'الأوامر للقراءة فقط: تقوم بما تفعله أزرار الصفحة',
    'فەرمانەکان تەنها بۆ خوێندنەوەن: هەمان کاری دوگمەکانی پەڕێ دەکەن',
    'komutlar salt okunur — sayfadaki düğmeler ne yapıyorsa onu yapar',
    'les commandes sont en lecture seule : elles font ce que font les boutons de la page',
    'los comandos son de solo lectura: hacen lo mismo que los botones de la página',
    'Befehle sind schreibgeschützt — sie tun, was die Buttons der Seite tun',
    'команды только для чтения: они делают то же, что кнопки на странице',
    '命令仅供读取：它们执行页面按钮的同样操作',
    'コマンドは読み取り専用。ページのボタンと同じ動作をします',
    '명령은 읽기 전용입니다 — 페이지 버튼과 같은 동작을 합니다',
    'कमांड सिर्फ़ पढ़ने के लिए हैं: ये वही करती हैं जो पेज के बटन करते हैं'
  ],
  whoami1: [
    'it manager & software engineer · baghdad, iraq',
    'مدير تقنية المعلومات ومهندس برمجيات · بغداد، العراق',
    'بەڕێوەبەری تەکنەلۆژیا و ئەندازیاری نەرمەکاڵا · بەغدا، عێراق',
    'BT yöneticisi ve yazılım mühendisi · Bağdat, Irak',
    'responsable informatique & ingénieur logiciel · Bagdad, Irak',
    'gestor de TI e ingeniero de software · Bagdad, Irak',
    'IT-Leiter & Software-Ingenieur · Bagdad, Irak',
    'IT-менеджер и инженер-программист · Багдад, Ирак',
    'IT 经理兼软件工程师 · 伊拉克巴格达',
    'ITマネージャー兼ソフトウェアエンジニア · イラク・バグダッド',
    'IT 관리자 겸 소프트웨어 엔지니어 · 이라크 바그다드',
    'IT प्रबंधक और सॉफ़्टवेयर इंजीनियर · बग़दाद, इराक़'
  ],
  whoami2: [
    'erp · full stack · flutter · servers & networks',
    'ERP · فول ستاك · فلاتر · سيرفرات وشبكات',
    'ERP · فوڵ ستاک · فڵاتەر · سێرڤەر و تۆڕەکان',
    'ERP · full stack · Flutter · sunucular ve ağlar',
    'ERP · full stack · Flutter · serveurs et réseaux',
    'ERP · full stack · Flutter · servidores y redes',
    'ERP · Full Stack · Flutter · Server & Netzwerke',
    'ERP · full stack · Flutter · серверы и сети',
    'ERP · 全栈 · Flutter · 服务器与网络',
    'ERP · フルスタック · Flutter · サーバーとネットワーク',
    'ERP · 풀스택 · Flutter · 서버와 네트워크',
    'ERP · फुल स्टैक · Flutter · सर्वर और नेटवर्क'
  ],
  usage: [
    'usage', 'الاستخدام', 'بەکارهێنان', 'kullanım', 'utilisation', 'uso',
    'Verwendung', 'использование', '用法', '使い方', '사용법', 'उपयोग'
  ],
  nosection: [
    'no such section', 'لا يوجد هذا القسم', 'ئەم بەشە بوونی نییە',
    'böyle bir bölüm yok', 'section introuvable', 'sección inexistente',
    'Abschnitt nicht gefunden', 'такой раздел не найден', '未找到该章节',
    'そのセクションはありません', '해당 섹션이 없습니다', 'यह सेक्शन नहीं है'
  ],
  opened: [
    'opened', 'فُتح', 'کرایەوە', 'açıldı', 'ouvert', 'abierto',
    'geöffnet', 'открыто', '已打开', '開きました', '열림', 'खुला'
  ],
  nolang: [
    'no such language', 'لا توجد هذه اللغة', 'ئەم زمانە بوونی نییە',
    'böyle bir dil yok', 'langue introuvable', 'idioma inexistente',
    'Sprache nicht gefunden', 'такой язык не найден', '未找到该语言',
    'その言語はありません', '해당 언어가 없습니다', 'यह भाषा नहीं है'
  ],
  printing: [
    'opening the a4 spec sheet…', 'أفتح ورقة المواصفات A4…',
    'پەڕی تایبەتمەندیی A4 دەکەمەوە…', 'A4 özellik sayfası açılıyor…',
    'ouverture de la fiche A4…', 'abriendo la ficha A4…',
    'A4-Datenblatt wird geöffnet…', 'открываю лист спецификации A4…',
    '正在打开 A4 规格表…', 'A4仕様書を開いています…',
    'A4 사양 시트를 여는 중…', 'A4 स्पेक शीट खोल रहे हैं…'
  ],
  sudo: [
    'nice try — this desk has one admin', 'محاولة جيدة — لهذا المكتب مدير واحد',
    'هەوڵێکی باشە — ئەم نووسینگەیە تەنها بەڕێوەبەرێکی هەیە',
    'güzel deneme — bu masanın tek yöneticisi var',
    'joli essai — ce bureau n’a qu’un seul admin',
    'buen intento — este escritorio tiene un solo admin',
    'netter Versuch — dieser Tisch hat nur einen Admin',
    'неплохая попытка — у этого стола один администратор',
    '试得不错 — 这张桌子只有一个管理员',
    'なかなかの試み — このデスクの管理者はひとりだけ',
    '좋은 시도 — 이 책단의 관리자는 한 명뿐입니다',
    'अच्छी कोशिश — इस डेस्क का सिर्फ़ एक एडमिन है'
  ],
  unknown: [
    'command not found', 'الأمر غير موجود', 'فەرمانەکە نەدۆزرایەوە',
    'komut bulunamadı', 'commande introuvable', 'comando no encontrado',
    'Befehl nicht gefunden', 'команда не найдена', '未找到命令',
    'コマンドが見つかりません', '명령을 찾을 수 없음', 'कमांड नहीं मिला'
  ],
  tryHelp: [
    'try help', 'جرّب help', 'هەوڵی help بدە', 'help deneyin',
    'essayez help', 'prueba help', '„help“ versuchen',
    'попробуйте help', '试试 help', 'help をお試しください',
    'help를 시도해 보세요', 'help आज़माएँ'
  ],
  err: [
    'error', 'خطأ', 'هەڵە', 'hata', 'erreur', 'error',
    'Fehler', 'ошибка', '错误', 'エラー', '오류', 'त्रुटि'
  ]
};

const words = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const holes = [];
for (const key of Object.keys(T)) {
  if (T[key].length !== LANGS.length) holes.push(key + ' has ' + T[key].length + ' strings, need ' + LANGS.length);
}
if (holes.length) {
  console.error('REFUSED — incomplete rows:');
  holes.forEach(h => console.error('  ' + h));
  process.exitCode = 1;
} else {
  let added = 0;
  for (const lang of LANGS) {
    if (!words[lang]) words[lang] = {};
    if (!words[lang].term) words[lang].term = {};
    for (const key of Object.keys(T)) {
      const cur = words[lang].term[key];
      if (typeof cur !== 'string' || !cur.trim()) { words[lang].term[key] = T[key][LANGS.indexOf(lang)]; added++; }
    }
  }
  fs.writeFileSync(FILE, JSON.stringify(words, null, 2), 'utf8');
  console.log('term keys per language: ' + Object.keys(words.en.term).length + ' · strings written: ' + added);
}
