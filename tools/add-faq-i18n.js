/* add-faq-i18n.js — writes the four deeper faq entries (q7–q10) into
   assets/i18n/translations.json.
   every string is authored as a 12-wide array in LANGS order, so a missing
   language is a hole in this file rather than a silent english leak.
   the answers only repeat what the site already states elsewhere — the
   privacy page, the process rows, the reply-time line — because a faq is
   the one section a model will quote back at a client.
   idempotent: an existing non-empty value is never overwritten.           */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'assets', 'i18n', 'translations.json');
const LANGS = ['en', 'ar', 'ku', 'tr', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ko', 'hi'];

const D = {};

D.faq = {
  q7: [
    'Does this site use cookies or analytics?',
    'هل يستخدم هذا الموقع ملفات تعريف الارتباط أو أدوات التحليل؟',
    'ئەم ماڵپەڕە کووکی یان شیکردنەوەی داتای بەکاردەهێنێت؟',
    'Bu site çerez veya analitik kullanıyor mu?',
    'Ce site utilise-t-il des cookies ou de l’analyse ?',
    '¿Usa este sitio cookies o analítica?',
    'Nutzt diese Seite Cookies oder Analyse-Tools?',
    'Использует ли этот сайт cookie или аналитику?',
    '这个网站使用 Cookie 或分析工具吗？',
    'このサイトはCookieやアナリティクスを使っていますか？',
    '이 사이트는 쿠키나 분석을 쓰나요?',
    'क्या यह साइट कुकी या एनालिटिक्स इस्तेमाल करता है?'
  ],
  a7: [
    'No cookie is set here and no analytics vendor is in the path. The counter keeps one salted hash of an ip address per Baghdad day, so the same visit cannot count twice, and nothing that names anybody — the privacy page lists every piece of it.',
    'لا تُضبط أيّ ملف تعريف ارتباط هنا، ولا جهة تحليلات في الطريق. العدّاد يحفظ بصمةً مُملَّحة واحدة لعنوان ip لكل يوم بتوقيت بغداد، فلا تُحسب الزيارة مرتين، ولا شيء يُسمّي شخصًا — صفحة الخصوصية تُعدّد كل ذلك.',
    'لێرە هیچ کووکی دانانرێت و هیچ لایەنی شیکردنەوە لە ڕێگاکە نییە. ژمێرەکە تەنها یەک کۆدی شێواوی ئای پی بۆ هەر ڕۆژێک بە کاتی بەغدا ڕادەگرێت، بۆیە هەمان سەردان دوو جار ناژمێردرێت، و هیچ شتێک کەسێک ناڵێت — هەمووی لە پەڕەی پاراستنی کەسیدا لیست کراوە.',
    'Burada hiçbir çerez kurulmaz, yolda hiçbir analitik firması yoktur. Sayaç, Bağdat saatiyle güne bir kez ip adresinin tuzlanmış özetini tutar; böylece aynı ziyaret iki kez sayılmaz ve hiç kimseyi adlandıran bir şey kalmaz — hepsi gizlilik sayfasında yazılı.',
    'Aucun cookie n’est déposé ici et aucun prestataire d’analyse n’est sur le chemin. Le compteur garde un seul condensat salé de l’adresse ip par jour à l’heure de Bagdad — une visite ne compte donc pas deux fois — et rien qui nomme qui que ce soit : la page Confidentialité énumère tout.',
    'Aquí no se instala ninguna cookie y no hay ninguna analítica externa en el camino. El contador guarda un único resumen con sal de la dirección ip por día en hora de Bagdad, así que una visita no puede contar dos veces, y nada que nombre a nadie: la página de privacidad lo enumera todo.',
    'Hier wird kein Cookie gesetzt, und kein Analyse-Dienst liegt auf dem Weg. Der Zähler behält pro Tag nach Bagdader Zeit genau einen Hash deiner ip-Adresse mit Salt — derselbe Besuch zählt also nicht zweimal — und nichts, das dich benennt; die Datenschutzseite listet alles auf.',
    'Здесь не устанавливается ни один cookie, и аналитических сервисов на пути нет. Счётчик хранит ровно один хеш ip-адреса с солью на багдадский день, так что один визит не может посчитаться дважды, и ничего, что называло бы вас; всё перечислено на странице конфиденциальности.',
    '这里不下发任何 Cookie，路径上也没有分析服务商。计数器每个巴格达日只保留一条加盐的 IP 哈希，同一次访问不会被数两遍，也不保留任何能指认他人的信息——隐私页已逐项写明。',
    'ここではCookieを設定せず、経路に解析ベンダーもありません。カウンターが持つのはバグダッド時間で1日1回分のIPソルト付きハッシュのみで、同じ訪問が2回数えられることはありません。あなたを特定する情報も持たず、そのすべてはプライバシーページに書いてあります。',
    '여기서는 어떤 쿠키도 심지 않고 분석 업체도 경로에 없습니다. 카운터는 바그다드 시간으로 하루에 한 번, 아이피 주소의 솔트 해시만 남깁니다. 같은 방문이 두 번 셀리는 일이 없고, 누군가를 지칭하는 정보도 전혀 없습니다 — 전부 개인정보 페이지에 적혀 있습니다.',
    'यहाँ कोई कुकी सेट नहीं होती, और रास्ते में कोई एनालिटिक्स सेवा नहीं है। काउंटर बग़दाद समय में प्रति दिन एक ही बार ip पते का सॉल्ट वाला हैश रखता है, इसलिए एक ही विज़िट दो बार नहीं गिनी जाती; और कोई चीज़ नहीं जो किसी को नाम से पहचाने — पूरा ब्यौरा गोपनीयता पृष्ठ पर है।'
  ],

  q8: [
    'Which languages can a product ship in?',
    'بأي لغات يخرج المنتج؟',
    'بە چەند زمانێک بەرهەمەکە دەردەچێت؟',
    'Ürün hangi dillerde çıkar?',
    'En quelles langues un produit est-il livré ?',
    '¿En qué idiomas puede salir un producto?',
    'In welchen Sprachen erscheint ein Produkt?',
    'На каких языках продукт выходит?',
    '产品能以哪些语言交付？',
    '製品は何言語で納品できますか？',
    '제품은 몇 개 언어로 출시되나요?',
    'उत्पाद किन भाषाओं में रिलीज़ होता है?'
  ],
  a8: [
    'Arabic and English as standard, both with the full layout in their own direction. This site itself is written in twelve languages from one translation file, so adding yours to a product is an edit, not a rebuild.',
    'العربية والإنجليزية قياسًا، مع اكتمال التركيب في اتجاه كلٍّ منهما. هذا الموقع نفسه مكتوب باثنتَي عشرة لغة من ملف ترجمة واحد، فإضافةُ لغتك إلى منتج تعديلاً لا إعادة بناء.',
    'عەرەبی و ئینگلیزی وەک ستاندارد، هەردووکیان بە ڕێکخستنی تەواو لە ئاراستەی خۆیاندا. خۆی ئەم ماڵپەڕە لە یەک فایلی وەرگێڕان بە دوانزە زمان نووسراوە، بۆیە زیادکردنی زمانەکەت دەستکارییە نەک دووبارە دروستکردنەوە.',
    'Arapça ve İngilizce standart olarak, ikisi de kendi yönünde tam sayfayla. Bu sitenin kendisi tek bir çeviri dosyasından on iki dilde yazılıyor; ürününe dilini eklemek yeniden inşa değil, bir düzenleme.',
    'L’arabe et l’anglais par défaut, avec une mise en page complète dans leur sens à chacun. Ce site lui-même est écrit en douze langues depuis un seul fichier de traduction : y ajouter la vôtre est une modification, pas une reconstruction.',
    'Árabe e inglés de forma estándar, con la maquetación completa en su propio sentido. Este sitio está escrito en doce idiomas desde un solo archivo de traducciones: añadir el tuyo a un producto es editar, no volver a construir.',
    'Arabisch und Englisch als Standard, beide mit vollständigem Layout in ihrer eigenen Leserichtung. Diese Seite selbst steht in zwölf Sprachen aus einer Übersetzungsdatei: deine Sprache dazuzunehmen ist ein Edit, kein Neuaufbau.',
    'Арабский и английский по умолчанию, с полноценной вёрсткой в каждом направлении. Сам этот сайт написан на двенадцати языках из одного файла переводов: добавить ваш язык — это правка, а не перестройка.',
    '标配阿拉伯语和英语，两者的排版都按其书写方向完整呈现。这个站点本身就从一份翻译文件输出十二种语言：为你的产品加一门语言是改文件，不是重做。',
    '標準はアラビア語と英語で、どちらもその表示方向に合わせた完全なレイアウトになります。このサイト自体が1つの翻訳ファイルから12言語で書かれているので、あなたの言語を加えるのは作り直しではなく編集です。',
    '기본은 아랍어와 영어이고, 두 언어 모두 방향에 맞춘 완전한 레이아웃을 제공합니다. 이 사이트 자체가 하나의 번역 파일로 열두 개 언어를 씁니다. 따라서 언어를 추가하는 일은 다시 만드는 것이 아니라 편집입니다.',
    'मानक रूप से अरबी और अंग्रेज़ी, दोनों में उनके अपनी दिशा का पूरा लेआउट। यह साइट ख़ुद एक ही फ़ाइल से बारह भाषाओं में लिखी है, इसलिए आपकी भाषा जोड़ना दोबारा बनाना नहीं, संपादन है।'
  ],

  q9: [
    'What do you need from me to begin?',
    'ماذا تحتاج منّي لتبدأ؟',
    'بۆ دەستپێکردن چی لە منەوە دەوێت؟',
    'Başlamak için benden neye ihtiyacın var?',
    'De quoi avez-vous besoin de moi pour commencer ?',
    '¿Qué necesitas de mí para empezar?',
    'Was brauchst du von mir, um anzufangen?',
    'Что вам нужно от меня, чтобы начать?',
    '开始之前你需要我提供什么？',
    '始めるために私から何が必要ですか？',
    '시작하려면 저에게서 무엇이 필요한가요?',
    'शुरू करने के लिए मुझसे क्या चाहिए?'
  ],
  a9: [
    'What exists and what hurts: the pages, screens or systems involved, any logo and text you already have, and who approves the work. That is enough for a written scope, price and dates — and the work starts when you say so.',
    'ما الموجود وما المؤلم: الصفحات أو الشاشات أو الأنظمة المعنية، وأي شعار ونصوص لديك بالفعل، ومن يعتمد العمل. هذا يكفي لنطاقٍ وسعرٍ ومواعيد مكتوبة — ويبدأ العمل عندما تقول ذلك.',
    'ئەوەی هەیە و ئەوەی ئازار دەدات: ئەو پەڕانە یان شاشانە یان سیستەمانەی پەیوەندییان هەیە، هەر لۆگۆ و دەقی هەایتە، و ئەو کەسەی ڕەزامەندی لەسەر کارەکە دەدات. ئەمە بەسێت بۆ دامەزراندنی چیرۆکی کار و نرخ و بەروار بە نووسراو — و کارەکە کاتێک دەستپێکات کە تۆ بڵێیت.',
    'Olan ve zorlayan şeyler: ilgili sayfalar, ekranlar veya sistemler, elinizde zaten bulunan logo ve metinler ve işi kimin onayladığı. Yazılı bir kapsam, fiyat ve tarih için bu yeter — ve iş siz öyle dediğinizde başlar.',
    'Ce qui existe et ce qui coince : les pages, écrans ou systèmes concernés, les logos et textes dont vous disposez déjà, et qui approuve. C’est suffisant pour une portée, un prix et des dates écrits — et le travail commence quand vous le dites.',
    'Lo que existe y lo que duele: las páginas, pantallas o sistemas implicados, el logo y los textos que ya tienes, y quién aprueba. Con eso alcanza para un alcance, un precio y unas fechas por escrito — y el trabajo empieza cuando tú lo dices.',
    'Was existiert und was klemmt: die betroffenen Seiten, Screens oder Systeme, Logos und Texte, die schon da sind, und wer absegnet. Das reicht für Scope, Preis und Termine schriftlich — und die Arbeit beginnt, wenn du sagst.',
    'Что есть и что болит: затронутые страницы, экраны или системы, имеющиеся у вас логотипы и тексты, и кто согласует работу. Этого достаточно, чтобы письменно дать объём, цену и сроки — а работа начинается, когда вы скажете.',
    '现有的和卡住的地方：涉及的页面、界面或系统，你已经有的标志和文字，以及由谁拍板。这些足够我书面给出范围、价格和工期——工作什么时候开始由你说了算。',
    '今あるものと、困っている場所です：関係するページ・画面・システム、お持ちのロゴと文章、そして誰が承認するか。それがあれば範囲・費用・日程を書面で出せます。作業を開始するのはあなたの合図です。',
    '이미 있는 것과 막혀 있는 부분입니다: 관련된 페이지·화면·시스템, 이미 가지고 계신 로고와 문구, 그리고 승인자가 누구인지. 이 정도면 범위·가격·일정을 문서로 드릴 수 있고, 작업은 당신이 시작한다고 할 때 시작됩니다.',
    'जो मौजूद है और जो दिक्कत दे रहा है: संबंधित पृष्ठ, स्क्रीन या सिस्टम, आपके पास पहले से जो लोगो और टेक्स्ट हैं, और मंज़ूरी कौन देता है। लिखित दायरा, कीमत और समय के लिए यह काफ़ी है — और काम आपके कहने पर शुरू होता है।'
  ],

  q10: [
    'Do I see the work while it is still being built?',
    'هل أرى العمل وهو لا يزال يُبنى؟',
    'دەتوانم لە کاتی دروستکردنی کارەکەدا بیبینم؟',
    'İş hâlâ yapılırken görebilir miyim?',
    'Vais-je voir le travail pendant qu’il se fait ?',
    '¿Veré el trabajo mientras se construye?',
    'Sehe ich die Arbeit, während sie entsteht?',
    'Я буду видеть работу, пока она ещё делается?',
    '开发过程中我能看到进度吗？',
    '作りしている間の進み方は見えますか？',
    '만드는 동안 진행을 볼 수 있나요?',
    'काम बनते हुए मैं उसे देख पाऊँगा?'
  ],
  a10: [
    'Yes: a preview link every week rather than a reveal at the end. Every stage is one message away, and the answers are on this sheet before you have to ask.',
    'نعم: رابط معاينة كل أسبوع بدل كشفٍ في النهاية. كل مرحلة على بُعد رسالة واحدة، والأجوبة مكتوبة في هذه الورقة قبل أن تحتاج أن تسأل.',
    'بەڵێ: هەر هەفتەیەک بەستەری پێشبینین، نەک دەرکەوتن لە کۆتاییدا. هەموو قۆناغەک لە پەیامێکەوە دوورە، وەڵامەکانیش پێش ئەوەی پێویستت بە پرسین بێت لەم پەڕەیەدا نووسراون.',
    'Evet: sonda gösterim yerine her hafta bir önizleme bağlantısı. Her aşama bir mesaj uzaklıkta; yanıtlar da sormadan önce bu sayfada yazılı.',
    'Oui : un lien d’aperçu chaque semaine plutôt qu’une révélation à la fin. Chaque étape est à un message de distance, et les réponses sont sur cette fiche avant qu’il faille les demander.',
    'Sí: un enlace de vista previa cada semana en lugar de una revelación al final. Cada etapa está a un mensaje de distancia, y las respuestas ya están en esta hoja antes de que haya que pedirlas.',
    'Ja: jede Woche einen Vorschaulink statt einer Enthüllung am Ende. Jede Stufe ist eine Nachricht entfernt, und die Antworten stehen auf diesem Blatt, bevor man sie fragen muss.',
    'Да: ссылку на превью каждую неделю, а не раз в конце. Любой этап — на расстоянии одного сообщения, и ответы на этом листе есть раньше, чем их приходится спрашивать.',
    '能：每周一个预览链接，而不是最后才揭晓。每个阶段都只隔一条消息，答案在你问之前就已经写在这张表上。',
    '見えます。最後に見せるのではなく、毎週プレビュー用のリンクをお出しします。どの段階もメッセージ一通の距離にあり、答えは聞く前にこのシートに書いてあります。',
    '볼 수 있습니다. 마지막에 공개하는 대신 매주 미리보기 링크를 드립니다. 모든 단계는 메시지 하나 거리이고, 답은 묻기 전에 이미 이 시트에 적혀 있습니다.',
    'हाँ — आख़िर में दिखा देने के बजाय हर हफ़्ते एक प्रीव्यू लिंक। हर चरण एक संदेश की दूरी पर है, और जवाब आपको पूछने से पहले ही इस शीट पर लिखे हैं।'
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
        words[lang][ns] = words[lang][ns] || {};
        // dotted keys become a real tree — dig() in main.js splits on every dot
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
  const keys = Object.keys(D.faq).length;
  console.log('faq keys:', keys, '| languages:', LANGS.length, '| written:', added, '| already there:', kept);
}

main();
