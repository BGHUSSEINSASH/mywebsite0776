/* add-spec-i18n.js — writes the datasheet namespaces into
   assets/i18n/translations.json. every string is authored here as a
   12-wide array in LANGS order so a missing language is a visible hole,
   not a silent one.  run:  node tools/add-spec-i18n.js               */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'assets', 'i18n', 'translations.json');
const LANGS = ['en', 'ar', 'ku', 'tr', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ko', 'hi'];

const D = {};

D.avail = {
  open: ['Available · replies today', 'متاح · أرد اليوم', 'بەردەستە · ئەمڕۆ وەڵام دەدەمەوە', 'Müsait · bugün yanıtlarım', 'Disponible · réponse aujourd’hui', 'Disponible · respondo hoy', 'Verfügbar · Antwort heute', 'Доступен · отвечу сегодня', '可接单 · 今天回复', '受付中 · 今日返信', '연락 가능 · 오늘 회신', 'उपलब्ध · आज जवाब'],
  soon: ['Opens in', 'يفتح بعد', 'دەکرێتەوە لە', 'Açılışa', 'Ouverture dans', 'Abre en', 'Öffnet in', 'Откроется через', '距开启', '開始まで', '개시까지', 'खुलने में'],
  tomorrow: ['Tomorrow', 'غدًا', 'سبەینێ', 'Yarın', 'Demain', 'Mañana', 'Morgen', 'Завтра', '明天', '明日', '내일', 'कल'],
  closed: ['Outside hours · Sat–Thu 09:00–18:00 Baghdad', 'خارج الدوام · السبت–الخميس 09:00–18:00 بغداد', 'دەرەوەی کاتی کار · شەممە–پێنجشەممە 09:00–18:00 بەغدا', 'Mesai dışı · Cmt–Per 09:00–18:00 Bağdat', 'Hors horaires · sam–jeu 09:00–18:00 Bagdad', 'Fuera de horario · sáb–jue 09:00–18:00 Bagdad', 'Außerhalb der Zeiten · Sa–Do 09:00–18:00 Bagdad', 'Вне графика · сб–чт 09:00–18:00 Багдад', '非工作时间 · 周六至周四 09:00–18:00 巴格达', '時間外 · 土〜木 09:00–18:00 バグダッド', '업무 시간 외 · 토–목 09:00–18:00 바그다드', 'घंटों के बाहर · शनि–गुरु 09:00–18:00 बगदाद']
};

D.hud = {
  palette: ['Palette', 'الأوامر', 'فەرمانەکان', 'Komutlar', 'Commandes', 'Comandos', 'Befehle', 'Команды', '命令面板', 'コマンド', '커맨드', 'कमांड'],
  term: ['Terminal', 'الطرفية', 'تێرمیناڵ', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Терминал', '终端', 'ターミナル', '터미널', 'टर्मिनल'],
  print: ['Spec sheet', 'ورقة المواصفات', 'پەڕەی تایبەتمەندی', 'Teknik sayfa', 'Fiche technique', 'Ficha técnica', 'Datenblatt', 'Спецификация', '规格表', '仕様シート', '규격 시트', 'स्पेक शीट'],
  calm: ['CALM', 'هادئ', 'هێواش', 'SAKİN', 'CALME', 'CALMA', 'RUHIG', 'СПОКОЙНО', '静态', '静', '정적', 'शांत']
};

D.proc = {
  label: ['SPEC / Process', 'SPEC / المسار', 'SPEC / ڕێگا', 'SPEC / Süreç', 'SPEC / Déroulé', 'SPEC / Proceso', 'SPEC / Ablauf', 'SPEC / Процесс', 'SPEC / 流程', 'SPEC / 進行', 'SPEC / 진행', 'SPEC / प्रक्रिया'],
  t1: ['How a job ', 'كيف ', 'چۆن کار ', 'İş ', 'Comment ', 'Cómo ', 'Wie ein Projekt ', 'Как ', '工作如何', '仕事は', '작업은 ', 'काम '],
  tem: ['runs', 'يسير العمل', 'بەڕێوەدەچێت', 'nasıl ilerler', 'avance le travail', 'avanza el trabajo', 'läuft', 'идёт работа', '推进', 'どう進むか', '진행됩니다', 'कैसे चलता है'],
  h1: ['Brief', 'الطلب', 'داواکاری', 'Brief', 'Brief', 'Brief', 'Briefing', 'Бриф', '需求', 'ヒアリング', '요청 정리', 'ब्रीफ'],
  h2: ['Plan & quote', 'الخطة والعرض', 'پلان و پێشنیار', 'Plan ve teklif', 'Plan et devis', 'Plan y presupuesto', 'Plan & Angebot', 'План и смета', '方案与报价', '計画と見積り', '계획과 견적', 'योजना व कोटेशन'],
  h3: ['Build', 'البناء', 'بنیاتنی', 'Üretim', 'Production', 'Desarrollo', 'Entwicklung', 'Разработка', '开发', '開発', '개발', 'निर्माण'],
  h4: ['Deliver', 'التسليم', 'سپاردن', 'Teslim', 'Livraison', 'Entrega', 'Übergabe', 'Передача', '交付', '納品', '납품', 'डिलीवरी'],
  h5: ['Support', 'الدعم', 'پاڵپشتی', 'Destek', 'Support', 'Soporte', 'Support', 'Поддержка', '支持', 'サポート', '지원', 'सहायता'],
  s1: ['what & why', 'المطلوب ولماذا', 'چی و بۆچی', 'ne ve neden', 'quoi et pourquoi', 'qué y por qué', 'was & warum', 'что и зачем', '需求与原因', '何を・なぜ', '무엇과 이유', 'क्या और क्यों'],
  s2: ['scope, cost, dates', 'النطاق والتكلفة والمواعيد', 'قەبارە، نرخ، بەروار', 'kapsam, maliyet, tarih', 'périmètre, coût, délais', 'alcance, coste, plazos', 'Umfang, Kosten, Termine', 'объём, цена, сроки', '范围、费用、工期', '範囲・費用・納期', '범위, 비용, 일정', 'दायरा, लागत, समय'],
  s3: ['weekly preview link', 'رابط معاينة أسبوعي', 'بەستێری پێشبینینی هەفتانە', 'haftalık önizleme bağlantısı', 'lien d’aperçu hebdomadaire', 'enlace de vista previa semanal', 'wöchentlicher Vorschaulink', 'еженедельная ссылка-превью', '每周预览链接', '毎週プレビューリンク', '주간 미리보기 링크', 'साप्ताहिक प्रीव्यू लिंक'],
  s4: ['handover, not a black box', 'تسليم كامل، لا صندوق أسود', 'سپاردنی تەواو، نکۆڵی تاریک', 'tam teslim, kara kutu yok', 'remise complète, pas de boîte noire', 'entrega completa, sin caja negra', 'Übergabe, keine Blackbox', 'полная передача, без «чёрного ящика»', '完整交接，没有黑箱', '完全な引き継ぎ・ブラックボックスなし', '완전한 인수인계, 블랙박스 없음', 'पूरा हेंडओवर, कोई ब्लैक बॉक्स नहीं'],
  s5: ['the desk stays open', 'المكتب يبقى مفتوحًا', 'مێزەکە کراوەیە', 'masa açık kalır', 'le bureau reste ouvert', 'la mesa sigue abierta', 'das Büro bleibt offen', 'стол остаётся открытым', '服务台持续在线', '窓口は開いたまま', '창구는 항상 열려 있습니다', 'डेस्क खुली रहती है'],
  p1: ['You describe the problem in your own words. I repeat it back, add what you left out, and we agree the target before anything is priced.', 'تشرح المشكلة بكلماتك. أعيد صياغتها، وأضيف ما نسيتَه، ونتفق على الهدف قبل تحديد أي سعر.', 'کێشەکە بە وشەکانی خۆت دەڵێیت. دووبارەی دەکەمەوە، ئەوەی لەبیرکراوە زیاد دەکەم، پێش نرخدان لەسەر ئامانج ڕێک دەکەوین.', 'Sorunu kendi kelimelerinle anlatırsın. Ben tekrar ederim, atladıklarını eklerim ve fiyat konuşulmadan önce hedefte anlaşırız.', 'Vous décrivez le problème avec vos mots. Je le reformule, j’ajoute ce qui manque, et nous convenons de l’objectif avant tout chiffrage.', 'Describe el problema con tus palabras. Lo repito, añado lo que falta y acordamos el objetivo antes de poner precio.', 'Du beschreibst das Problem in eigenen Worten. Ich wiederhole es, ergänze, was fehlt, und wir einigen uns auf das Ziel vor jeder Kalkulation.', 'Вы описываете проблему своими словами. Я повторяю её, добавляю упущенное, и мы соглашаем цель до любого расчёта.', '你用自己的话描述问题。我会复述一遍，补上遗漏之处，并在报价前先就目标达成一致。', 'ご自身の言葉で課題をお話しください。私が言い返し、抜けを足し、見積もりの前にゴールを一緒に決めます。', '문제를 당신의 말로 설명해 주세요. 제가 다시 정리하고 빠진 것을 더한 뒤, 견적 전에 목표부터 함께 정합니다.', 'आप समस्या अपने शब्दों में बताइए। मैं उसे दोहराता हूँ, छूटा हुआ जोड़ता हूँ, और दाम तय करने से पहले लक्ष्य पर सहमत होता हूँ।'],
  p2: ['A written scope: pages or screens, features, what is excluded, one fixed price and real dates. The number in this document is the number on the invoice.', 'نطاق مكتوب: الصفحات أو الشاشات، المزايا، ما هو مستثنى، سعر واحد ثابت ومواعيد حقيقية. الرقم في هذه الورقة هو نفسه الرقم في الفاتورة.', 'قەبارەی نووسراو: پەڕە یان شاشەکان، تایبەتمەندییەکان، ئەوەی دەرەوەی پلانە، نرخێکی جێگیر و بەرواری ڕاستەقینە. ئەو ژمارەیە لەم فەرمانەدا هەمان ژمارەی فاکتۆرە.', 'Yazılı kapsam: sayfalar veya ekranlar, özellikler, dışarıda kalanlar, tek sabit fiyat ve gerçek tarihler. Bu belgedeki sayı, faturadaki sayıdır.', 'Un périmètre écrit : pages ou écrans, fonctions, ce qui est exclu, un prix ferme et des dates réelles. Le chiffre de ce document est celui de la facture.', 'Un alcance escrito: páginas o pantallas, funciones, qué queda fuera, un precio cerrado y fechas reales. La cifra de este documento es la de la factura.', 'Ein schriftlicher Umfang: Seiten oder Screens, Funktionen, was ausgeschlossen ist, ein Festpreis und echte Termine. Die Zahl in diesem Dokument ist die Zahl auf der Rechnung.', 'Письменный объём: страницы или экраны, функции, что исключено, одна фиксированная цена и реальные сроки. Число в этом документе — то же, что в счёте.', '书面界定范围：页面或界面、功能、不包含项、固定价格与真实工期。这份文件上的数字就是发票上的数字。', '書面にした範囲：ページまたは画面、機能、対象外、単一の固定価格と現実的な納期。この資料の数字が請求書の数字です。', '문서화된 범위: 페이지 또는 화면, 기능, 제외 항목, 하나의 고정 가격과 실제 일정. 이 문서의 숫자가 청구서의 숫자입니다.', 'लिखित दायरा: पृष्ठ या स्क्रीन, फ़ीचर, जो शामिल नहीं, एक निश्चित मूल्य और वास्तविक तिथियाँ। इस दस्तावेज़ का आँकड़ा ही इनवॉइस का आँकड़ा है।'],
  p3: ['Work happens in the open — a preview link you can click every week, built from the Arabic layout first rather than translated from English afterwards.', 'يجري العمل على المكشوف: رابط معاينة تفتحه كل أسبوع، مبني من التخطيط العربي أولًا لا ترجمة عن الإنجليزية لاحقًا.', 'کار بە ڕوونی دەبێت — بەستێری پێشبینین کە هەفتانە کرتەی پێ دەکەیت؛ سەرەتا لە ڕوونکردنەوەی عەرەبییەوە دروست دەکرێت، نەک دواتر وەرگێڕان لە ئینگلیزییەوە.', 'İş açık yapılır — her hafta tıklayabileceğin bir önizleme bağlantısı; İngilizceden çeviri yerine önce Arapça yerleşimle kurulur.', 'Le travail se fait à découvert — un lien d’aperçu cliquable chaque semaine, construit d’abord sur la maquette arabe, pas traduit de l’anglais après coup.', 'El trabajo ocurre a la vista — un enlace de vista previa que abres cada semana, construido primero desde el layout árabe y no traducido después del inglés.', 'Die Arbeit passiert offen — ein Preview-Link, den du jede Woche anklickst, zuerst aus dem arabischen Layout gebaut statt hinterher aus dem Englischen übersetzt.', 'Работа идёт открыто — ссылка-превью, которую вы открываете каждую неделю; сборка начинается с арабской вёрстки, а не с перевода с английского.', '工作全程透明——每周你都能点开预览链接；先从阿拉伯语版式搭起，而不是事后从英语翻译过来。', '仕事は開かれた状態で行います — 毎週クリックできるプレビューリンク。英語からの後付け翻訳ではなく、アラビア語レイアウトから先に作ります。', '작업은 공개적으로 진행됩니다 — 매주 열어 보는 미리보기 링크. 영어에서 나중에 번역하는 게 아니라 아라비아어 레이아웃부터 만듭니다.', 'काम खुले तौर पर होता है — हर हफ़्ते खोलने योग्य प्रीव्यू लिंक; पहले अरबी लेआउट से बनाया जाता है, बाद में अंग्रेज़ी से अनुवाद नहीं।'],
  p4: ['Deployed, tested on real devices, handed over with the accounts, keys and a short written guide. You own the repository, the domain, the hosting.', 'يُنشر ويُختبر على أجهزة حقيقية، ويُسَلَّم مع الحسابات والمفاتيح ودليل مكتوب قصير. المستودع والنطاق والاستضافة ملكك.', 'جێگیر دەکرێت و لەسەر ئامێری ڕاستەقینە تاقی دەکرێتەوە، لەگەڵ هەژمارەکان و کلیل و ڕێنمایییەکی کورتی نووسراو سپاردەکرێت. کۆگا، دوومەین و هۆستینگەکە هی تۆیە.', 'Yayınlanır, gerçek cihazlarda test edilir; hesaplar, anahtarlar ve kısa yazılı bir rehberle teslim edilir. Depo, alan adı ve hosting senin.', 'Déployé, testé sur de vrais appareils, remis avec les comptes, les clés et un court guide écrit. Le dépôt, le domaine et l’hébergement sont à vous.', 'Desplegado, probado en dispositivos reales y entregado con las cuentas, las claves y una guía escrita breve. El repositorio, el dominio y el hosting son tuyos.', 'Deployt, auf echten Geräten getestet, übergeben mit Zugängen, Schlüsseln und einem kurzen schriftlichen Guide. Repository, Domain und Hosting gehören dir.', 'Развёрнуто, проверено на реальных устройствах, передано с аккаунтами, ключами и кратким письменным гидом. Репозиторий, домен и хостинг — ваши.', '完成部署、在真机上测试，并连同账号、密钥与简明书面指南一并交接。仓库、域名、主机都归你所有。', 'デプロイと実機テストを終え、アカウント・鍵・簡潔な書面ガイドとともに引き渡します。リポジトリもドメインもホスティングもあなたのものです。', '배포하고 실제 기기에서 테스트한 뒤, 계정과 키, 짧은 문서 가이드와 함께 넘겨드립니다. 저장소도 도메인도 호스팅도 당신의 것입니다.', 'डिप्लॉय किया जाता है, असली डिवाइस पर जाँचा जाता है, और खाते, कुंजियाँ व एक छोटा लिखित गाइड के साथ सौंपा जाता है। रिपॉज़िटरी, डोमेन, होस्टिंग — सब आपका।'],
  p5: ['The same desk that answered during the build answers after it — server faults, printer queues, camera records and the next feature.', 'يبقى المكتب نفسه الذي ردّ أثناء البناء يردّ بعدَه — أعطال الخادم، طوابير الطابعة، تسجيلات الكاميرات والميزة التالية.', 'هەمان مێز کە لە ماوەی بنیاتندا وەڵامی دابووە، دوای کارەکەش وەڵام دەداتەوە — کێشەی سێرڤەر، ڕیزی چاپکەر، تۆمارەکانی کامێرا و تایبەتمەندی داهاتوو.', 'Üretim sırasında cevap veren masa, sonrasında da cevap verir — sunucu arızaları, yazıcı kuyrukları, kamera kayıtları ve bir sonraki özellik.', 'Le bureau qui répond pendant la production répond aussi après — pannes serveur, files d’impression, enregistrements des caméras et la fonctionnalité suivante.', 'La misma mesa que responde durante el desarrollo responde después — fallos de servidor, colas de impresora, grabaciones de cámaras y la siguiente función.', 'Dieselbe Stelle, die während der Entwicklung antwortet, antwortet auch danach — Serverausfälle, Druckerwarteschlangen, Kameraaufnahmen und das nächste Feature.', 'Тот же стол, что отвечал во время разработки, отвечает и после — сбои сервера, очереди печати, записи камер и следующая функция.', '开发期间随叫随到的同一张桌子，交付之后依然如此——服务器故障、打印队列、监控录像，以及下一个功能。', '開発中に対応した窓口が、納品後もそのまま対応します — サーバー障害、プリンターのキュー、カメラの録画、次の機能まで。', '개발 중 답변했던 그 창구가 납품 후에도 그대로 답합니다 — 서버 장애, 프린터 대기열, 카메라 기록, 그리고 다음 기능까지.', 'जो डेस्क निर्माण के दौरान जवाब देती रही, वही बाद में भी देती है — सर्वर खराबी, प्रिंटर क्यू, कैमरा रिकॉर्डिंग और अगला फ़ीचर।'],
  note: ['Every stage is one message away — ask at any point and you get the answer the sheet already shows.', 'كل مرحلة على بُعد رسالة — اسأل في أي وقت فتحصل على الجواب الذي تعرضه الورقة بالفعل.', 'هەموو قۆناغێک لە پەیامێک دایە — لە هەر کاتێکێک بپرسە، ئەو وەڵامەت پێ دەدرێت کە پەڕەکە پێشتر نیشانی داوە.', 'Her aşama bir mesaj uzaklıkta — istediğin an sor, sayfada zaten görünen cevabı alırsın.', 'Chaque étape est à un message — demandez à tout moment, vous obtenez la réponse déjà affichée sur la fiche.', 'Cada etapa está a un mensaje — pregunta cuando quieras y recibes la respuesta que la ficha ya muestra.', 'Jede Stufe ist eine Nachricht entfernt — frag jederzeit und bekomm die Antwort, die der Bogen schon zeigt.', 'Каждый этап — на расстоянии одного сообщения: спросите в любой момент, и вы получите ответ, уже показанный в этом листе.', '每个阶段都只隔一条消息——随时提出，答案就是这份规格书上已经写明的内容。', 'どの工程もメッセージ一通分 — いつでも質問でき、このシートに既に出ている回答が返ります。', '모든 단계는 메시지 한 통 거리입니다 — 언제든 물어보시면 이 시트에 이미 적힌 답을 드리겠습니다.', 'हर चरण एक संदेश दूर है — कभी भी पूछिए, वही उत्तर मिलेगा जो शीट पर पहले से छपा है।']
};

D.gh = {
  label: ['SPEC / live code', 'SPEC / الشيفرة الحيّة', 'SPEC / کۆدی ڕاستەوخۆ', 'SPEC / canlı kod', 'SPEC / code en direct', 'SPEC / código en vivo', 'SPEC / Live-Code', 'SPEC / живой код', 'SPEC / 实时代码', 'SPEC / ライブコード', 'SPEC / 라이브 코드', 'SPEC / लाइव कोड'],
  repos: ['repos', 'مستودعات', 'کۆگا', 'depo', 'dépôts', 'repositorios', 'Repos', 'репозитории', '仓库', 'リポジトリ', '저장소', 'रिपॉज़िटरी'],
  followers: ['followers', 'متابِعون', 'شوێنکەوتوو', 'takipçi', 'abonnés', 'seguidores', 'Follower', 'подписчики', '关注者', 'フォロワー', '팔로워', 'फॉलोअर्स'],
  pushed: ['last push', 'آخر دفع', 'دوایین ناردن', 'son gönderim', 'dernier push', 'último push', 'letzter Push', 'последний push', '最近推送', '最終push', '마지막 푸시', 'आख़िरी push'],
  more: ['All repositories on GitHub', 'كل المستودعات على GitHub', 'هەموو کۆگاکان لە GitHub', 'Tüm depolar GitHub’da', 'Tous les dépôts sur GitHub', 'Todos los repositorios en GitHub', 'Alle Repositories auf GitHub', 'Все репозитории на GitHub', 'GitHub 上的全部仓库', 'GitHub のすべてのリポジトリ', 'GitHub의 모든 저장소', 'GitHub पर सभी रिपॉज़िटरी'],
  live: ['live', 'مباشر', 'ڕاستەوخۆ', 'canlı', 'en direct', 'en vivo', 'live', 'в реальном', '实时', 'ライブ', '실시간', 'लाइव'],
  cached: ['cached', 'من النسخة', 'لە کەش', 'önbellekte', 'en cache', 'en caché', 'gecacht', 'из кэша', '已缓存', 'キャッシュ', '캐시됨', 'कैश्ड'],
  updated: ['updated', 'حُدِّث', 'نوێکراوە', 'güncellendi', 'mis à jour', 'actualizado', 'aktualisiert', 'обновлено', '更新于', '更新', '업데이트', 'अपडेट'],
  off: ['GitHub data unavailable offline', 'بيانات GitHub غير متوفرة دون اتصال', 'زانیاری GitHub بێ ئینتەرنێت بەردەست نییە', 'GitHub verisi çevrimdışı erişilemez', 'Données GitHub indisponibles hors ligne', 'Datos de GitHub no disponibles sin conexión', 'GitHub-Daten offline nicht verfügbar', 'Данные GitHub недоступны офлайн', '离线时无法获取 GitHub 数据', 'オフラインでは GitHub データを取得できません', '오프라인에서는 GitHub 데이터를 사용할 수 없습니다', 'ऑफ़लाइन GitHub डेटा उपलब्ध नहीं'],
  today: ['today', 'اليوم', 'ئەمڕۆ', 'bugün', 'aujourd’hui', 'hoy', 'heute', 'сегодня', '今天', '今日', '오늘', 'आज']
};

// the terminal speaks english on purpose — command output is the one
// place where untranslated mono reads as design, not as a gap
D.term = {
  // only the chrome the screen reader speaks — command output stays english
  h3: ['Terminal', 'الطرفية', 'تێرمیناڵ', 'Terminal', 'Terminal', 'Terminal', 'Terminal', 'Терминал', 'ターミナル', 'ターミナル', '터미널', 'टर्मिनल'],
  close: ['Close', 'إغلاق', 'داخستن', 'kapat', 'fermer', 'cerrar', 'schließen', 'закрыть', '关闭', '閉じる', '닫기', 'बंद करें'],
  label: ['Terminal command', 'أمر الطرفية', 'فەرمانی تێرمیناڵ', 'terminal komutu', 'commande du terminal', 'comando de terminal', 'Terminal-Befehl', 'команда терминала', '终端命令', 'ターミナルコマンド', '터미널 명령', 'टर्मिनल कमांड'],
  motd: ['BG Hussein Sash — datasheet terminal. type "help".', 'BG Hussein Sash — طرفية المواصفات. اكتب help.', 'BG Hussein Sash — تێرمیناڵی پەڕەی تایبەتمەندی. «help» بنووسە.', 'BG Hussein Sash — teknik sayfa terminali. help yaz.', 'BG Hussein Sash — terminal fiche technique. tapez « help ».', 'BG Hussein Sash — terminal de ficha técnica. escribe help.', 'BG Hussein Sash — Datenblatt-Terminal. help eingeben.', 'BG Hussein Sash — терминал спецификации. введите help.', 'BG Hussein Sash — 规格表终端。输入 help。', 'BG Hussein Sash — 仕様シートのターミナル。help と入力してください。', 'BG Hussein Sash — 규격 시트 터미널. help를 입력하세요.', 'BG Hussein Sash — स्पेक शीट टर्मिनल। help लिखें।']
};

D.est = {
  h3: ['Live estimator', 'الحاسب الحيّ', 'هەڵسەنگاندنی ڕاستەوخۆ', 'Canlı hesaplayıcı', 'Estimateur en direct', 'Estimador en vivo', 'Live-Kalkulator', 'Живой калькулятор', '实时估算器', 'ライブ見積もり', '실시간 추정기', 'लाइव एस्टीमेटर'],
  sub: ['indicative · final quote in USD', 'تقديري · العرض النهائي بالدولار', 'خەمڵێنراو · پێشنیاری کۆتایی بە دۆلار', 'yaklaşık · kesin teklif USD', 'indicatif · devis final en USD', 'orientativo · presupuesto final en USD', 'Richtwert · Festpreis am Ende in USD', 'ориентировочно · итоговая смета в USD', '估算 · 最终报价以美元计', '目安・最終見積りはUSD', '개략 · 최종 견적은 USD', 'आनुमानिक · अंतिम कोटेशन USD में'],
  type: ['What do you need?', 'ما الذي تحتاجه؟', 'پێویستت بە چییە؟', 'Neye ihtiyacın var?', 'De quoi avez-vous besoin ?', '¿Qué necesitas?', 'Was brauchst du?', 'Что вам нужно?', '你需要什么？', '必要なものは？', '무엇이 필요하신가요?', 'आपको क्या चाहिए?'],
  scope: ['Scope', 'النطاق', 'قەبارە', 'Kapsam', 'Périmètre', 'Alcance', 'Umfang', 'Объём', '范围', '範囲', '범위', 'दायरा'],
  speed: ['Delivery speed', 'سرعة التسليم', 'خێرایی گەیاندن', 'Teslim hızı', 'Vitesse de livraison', 'Velocidad de entrega', 'Liefergeschwindigkeit', 'Скорость сдачи', '交付速度', '納期の速さ', '납품 속도', 'वितरण गति'],
  addons: ['Add-ons', 'إضافات', 'زیادکراوەکان', 'Ekstralar', 'Options', 'Extras', 'Zusätze', 'Дополнения', '附加项', '追加オプション', '추가 항목', 'एड-ऑन'],
  cur: ['Show alongside', 'اعرض أيضًا', 'هەروەها پیشان بدە', 'ayrıca göster', 'Afficher aussi', 'Mostrar también', 'Auch anzeigen', 'Показывать также', '同时显示', '併記表示', '함께 표시', 'साथ में दिखाएँ'],
  cta: ['Send as brief', 'أرسله كطلب', 'وەک داواکاری بنێرە', 'brief olarak gönder', 'Envoyer comme brief', 'Enviar como brief', 'Als Briefing senden', 'Отправить как бриф', '作为需求发送', '依頼として送信', '요청서로 보내기', 'ब्रीफ के रूप में भेजें'],
  wa: ['WhatsApp this', 'أرسله على واتساب', 'بینێرە بۆ واتساب', 'WhatsApp’a gönder', 'Envoyer sur WhatsApp', 'Enviar por WhatsApp', 'Per WhatsApp senden', 'Отправить в WhatsApp', '通过 WhatsApp 发送', 'WhatsAppで送る', 'WhatsApp으로 보내기', 'WhatsApp पर भेजें'],
  reset: ['Clear', 'مسح', 'پاککردنەوە', 'temizle', 'Effacer', 'Borrar', 'Zurücksetzen', 'Сброс', '清除', 'クリア', '초기화', 'साफ़ करें'],
  duration: ['Est. duration', 'المدة التقديرية', 'ماوەی خەملێنراو', 'tahmini süre', 'durée estimée', 'duración estimada', 'vsl. Dauer', 'срок (оценка)', '预计工期', '予想期間', '예상 기간', 'अनुमानित अवधि'],
  note: ['Not a contract — it is the same arithmetic I use to write the fixed quote, so this number and the invoice are built the same way.', 'ليس عقدًا — إنه الحساب نفسه الذي أكتب به عرض السعر الثابت، لذا هذا الرقم والفاتورة مبنيان بالطريقة نفسها.', 'گرێبەند نییە — هەمان ژماردنە کە پێشنیاری جێگیرم پێ دەنووسم؛ بۆیە ئەم ژمارەیە و فاکتۆرە بە هەمان شێوە دروستکراون.', 'Bu bir sözleşme değil — sabit teklifi yazarken kullandığımın aynı aritmetiği; yani bu sayı ile fatura aynı şekilde üretilir.', 'Ce n’est pas un contrat — c’est la même arithmétique que j’utilise pour rédiger le devis ferme ; ce chiffre et la facture sont donc produits de la même façon.', 'No es un contrato — es la misma aritmética con la que escribo el presupuesto cerrado; esta cifra y la factura se calculan igual.', 'Kein Vertrag — dieselbe Rechnung, mit der ich den Festpreis erstelle; diese Zahl und die Rechnung entstehen damit auf dieselbe Weise.', 'Это не договор — та же арифметика, по которой я составляю фиксированную смету; это число и счёт считаются одинаково.', '这不是合同——它和我编写固定报价时用的是同一套算法，所以这里的数字与发票的算法完全一致。', '契約ではありません — 固定見積りを書くときと同じ計算を使っているので、この数字も請求書も同じ作りです。', '계약서가 아닙니다 — 확정 견적을 쓸 때 쓰는 그대로의 산술이라, 이 숫자도 청구서도 같은 방식으로 계산됩니다.', 'यह अनुबंध नहीं — यही अंकगणित मैं ठीक कोटेशन लिखते समय उपयोग करता हूँ; इसलिए यह आँकड़ा और इनवॉइस एक जैसे बनते हैं।'],
  total: ['Indicative total', 'الإجمالي التقديري', 'کۆی خەملێنراو', 'yaklaşık toplam', 'total indicatif', 'total orientativo', 'Richtwert gesamt', 'итого ориентировочно', '预计总额', '合計目安', '예상 총액', 'आनुमानिक कुल'],
  indicative: ['indicative only', 'تقديري فقط', 'تەنها خەملێنراو', 'yalnızca yaklaşık', 'indicatif uniquement', 'solo orientativo', 'nur Richtwert', 'только ориентир', '仅为估算', '目安のみ', '개략 값만', 'केवल आनुमानिक'],
  usdNote: ['priced in USD', 'السعر بالدولار', 'نرخەکە بە دۆلارە', 'fiyat USD', 'prix en USD', 'precio en USD', 'Preis in USD', 'цена в USD', '以美元计价', '価格はUSD', '가격은 USD', 'मूल्य USD में'],
  lineType: ['Type', 'النوع', 'جۆر', 'tür', 'type', 'tipo', 'Typ', 'тип', '类型', '種類', '유형', 'प्रकार'],
  lineBase: ['Base', 'الأساس', 'بنەما', 'temel', 'base', 'base', 'Basis', 'база', '基础', '基本', '기본', 'आधार'],
  lineSpeed: ['Speed', 'السرعة', 'خێرایی', 'hız', 'vitesse', 'velocidad', 'Tempo', 'скорость', '速度', '速度', '속도', 'गति'],
  none: ['none', 'لا شيء', 'هیچ', 'yok', 'aucun', 'ninguno', 'keine', 'нет', '无', 'なし', '없음', 'कोई नहीं'],
  weeks: ['weeks', 'أسابيع', 'هەفتە', 'hafta', 'semaines', 'semanas', 'Wochen', 'нед.', '周', '週間', '주', 'सप्ताह'],
  permo: ['/mo', '/شهر', '/مانگ', '/ay', '/mois', '/mes', '/Monat', '/мес', '/月', '/月', '/월', '/माह'],
  uPages: ['pages', 'صفحات', 'پەڕە', 'sayfa', 'pages', 'páginas', 'Seiten', 'страниц', '页面', 'ページ', '페이지', 'पृष्ठ'],
  uFeatures: ['modules', 'وحدات', 'مۆدیول', 'modül', 'modules', 'módulos', 'Module', 'модули', '模块', 'モジュール', '모듈', 'मॉड्यूल'],
  uScreens: ['screens', 'شاشات', 'شاشە', 'ekran', 'écrans', 'pantallas', 'Screens', 'экраны', '界面', '画面', '화면', 'स्क्रीन'],
  uDevices: ['devices', 'أجهزة', 'ئامێر', 'cihaz', 'appareils', 'dispositivos', 'Geräte', 'устройства', '设备', 'デバイス', '기기', 'डिवाइस'],
  uCreatives: ['creatives', 'تصاميم', 'دیزاین', 'görsel', 'créas', 'piezas', 'Creatives', 'креативы', '设计物料', 'クリエイティブ', '크리에이티브', 'क्रिएटिव'],
  uPlatforms: ['platforms', 'منصات', 'پلاتفۆرم', 'platform', 'plateformes', 'plataformas', 'Plattformen', 'площадки', '平台', 'プラットフォーム', '플랫폼', 'प्लेटफ़ॉर्म'],
  std: ['Standard', 'قياسي', 'ئاسایی', 'standart', 'standard', 'estándar', 'Standard', 'стандарт', '标准', '標準', '표준', 'मानक'],
  fast: ['Fast track', 'مسار سريع', 'ڕێگای خێرا', 'hızlı hat', 'accéléré', 'rápido', 'Schnellkurs', 'ускоренно', '加急', '特急', '빠른 진행', 'तेज़ मार्ग'],
  prio: ['Priority', 'أولوية', 'پێشەکی', 'öncelikli', 'prioritaire', 'prioritario', 'Priorität', 'приоритет', '优先', '優先', '우선', 'प्राथमिकता'],
  aI18n: ['Arabic + English', 'عربي + إنجليزي', 'عەرەبی + ئینگلیزی', 'Arapça + İngilizce', 'arabe + anglais', 'árabe + inglés', 'Arabisch + Englisch', 'арабский + англ.', '阿拉伯语 + 英语', 'アラビア語＋英語', '아랍어 + 영어', 'अरबी + अंग्रेज़ी'],
  aAdmin: ['Admin dashboard', 'لوحة تحكم', 'داشبۆردی بەڕێوەبردن', 'yönetim paneli', 'tableau d’administration', 'panel de administración', 'Admin-Panel', 'панель администратора', '管理后台', '管理ダッシュボード', '관리자 대시보드', 'एडमिन डैशबोर्ड'],
  aPay: ['Payments / escrow', 'دفع / ضمان', 'پارەدان / ضمانەت', 'ödeme / escrow', 'paiement / séquestre', 'pagos / escrow', 'Zahlung / Treuhand', 'оплата / эскроу', '支付 / 托管', '決済・エスクロー', '결제 / 에스크로', 'भुगतान / एस्क्रो'],
  aSeo: ['SEO + analytics', 'تحسين محركات + تحليلات', 'SEO + شیکردنەوە', 'SEO + analitik', 'SEO + analytics', 'SEO + analíticas', 'SEO + Analytik', 'SEO + аналитика', 'SEO + 数据分析', 'SEO＋解析', 'SEO + 분석', 'SEO + एनालिटिक्स'],
  aMotion: ['Motion design', 'تصميم حركي', 'دیزاینی جوڵە', 'motion design', 'motion design', 'motion design', 'Motion-Design', 'моушн-дизайн', '动效设计', 'モーションデザイン', '모션 디자인', 'मोशन डिज़ाइन'],
  aHost: ['Domain + hosting 1y', 'نطاق + استضافة سنة', 'دوومەین + هۆستینگ ١ ساڵ', 'alan adı + hosting 1 yıl', 'domaine + hébergement 1 an', 'dominio + hosting 1 año', 'Domain + Hosting 1 Jahr', 'домен + хостинг 1 год', '域名 + 主机 1年', 'ドメイン＋ホスティング1年', '도메인 + 호스팅 1년', 'डोमेन + होस्टिंग 1 वर्ष'],
  aCare: ['3-month support', 'دعم 3 أشهر', 'پاڵپشتی ٣ مانگ', '3 ay destek', 'assistance 3 mois', 'soporte 3 meses', 'Support 3 Monate', 'поддержка 3 мес.', '3 个月支持', '3か月サポート', '3개월 지원', '3-माह सहायता']
};

D.pal = {
  title: ['Command palette', 'لوحة الأوامر', 'پەڕەی فەرمانەکان', 'komut paleti', 'palette de commandes', 'paleta de comandos', 'Befehlspalette', 'палитра команд', '命令面板', 'コマンドパレット', '커맨드 팔레트', 'कमांड पैलेट'],
  order: ['Start an order', 'ابدأ طلبًا', 'داواکارییەک دەست پێ بکە', 'sipariş başlat', 'démarrer une commande', 'iniciar un pedido', 'Bestellung starten', 'оформить заказ', '开始下单', '注文を開始', '주문 시작', 'ऑर्डर शुरू करें'],
  estimate: ['Open estimator', 'افتح الحاسب', 'حەژمارکەر بکەرەوە', 'hesaplayıcıyı aç', 'ouvrir l’estimateur', 'abrir el estimador', 'Kalkulator öffnen', 'открыть калькулятор', '打开估算器', '見積もりを開く', '추정기 열기', 'एस्टीमेटर खोलें'],
  theme: ['Switch theme', 'تبديل السمة', 'گۆڕینی ڕووکار', 'temayı değiştir', 'changer de thème', 'cambiar tema', 'Theme wechseln', 'сменить тему', '切换主题', 'テーマ切替', '테마 전환', 'थीम बदलें'],
  print: ['Print spec sheet', 'طباعة ورقة المواصفات', 'چاپکردنی پەڕەی تایبەتمەندی', 'teknik sayfayı yazdır', 'imprimer la fiche technique', 'imprimir la ficha técnica', 'Datenblatt drucken', 'печать спецификации', '打印规格表', '仕様シートを印刷', '규격 시트 인쇄', 'स्पेक शीट प्रिंट करें'],
  term: ['Open terminal', 'افتح الطرفية', 'تێرمیناڵ بکەرەوە', 'terminali aç', 'ouvrir le terminal', 'abrir la terminal', 'Terminal öffnen', 'открыть терминал', '打开终端', 'ターミナルを開く', '터미널 열기', 'टर्मिनल खोलें'],
  mail: ['Email', 'البريد', 'ئیمەیڵ', 'e-posta', 'e-mail', 'correo', 'E-Mail', 'почта', '电子邮件', 'メール', '이메일', 'ईमेल'],
  wa: ['WhatsApp', 'واتساب', 'واتساب', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp', 'WhatsApp'],
  waMsg: ['Hello — I found your site.', 'مرحبًا — وجدت موقعك.', 'سڵاو — ماڵپەڕەکەتم دۆزیەوە.', 'Merhaba — siteni buldum.', 'Bonjour — j’ai trouvé votre site.', 'Hola — encontré tu sitio.', 'Hallo — ich habe deine Seite gefunden.', 'Здравствуйте — нашёл ваш сайт.', '你好——我看到了你的网站。', 'こんにちは — サイトを見ました。', '안녕하세요 — 사이트를 보았습니다.', 'नमस्ते — मुझे आपकी साइट मिली।'],
  gh: ['GitHub profile', 'ملف GitHub', 'پڕۆفایلی GitHub', 'GitHub profili', 'profil GitHub', 'perfil de GitHub', 'GitHub-Profil', 'профиль GitHub', 'GitHub 资料页', 'GitHub プロフィール', 'GitHub 프로필', 'GitHub प्रोफ़ाइल'],
  cvEn: ['CV — English', 'السيرة الذاتية — إنجليزي', 'CV — ئینگلیزی', 'CV — İngilizce', 'CV — anglais', 'CV — inglés', 'Lebenslauf — Englisch', 'резюме — англ.', '简历 — 英文', '履歴書（英語）', '이력서 — 영어', 'CV — अंग्रेज़ी'],
  cvAr: ['CV — Arabic', 'السيرة الذاتية — عربي', 'CV — عەرەبی', 'CV — Arapça', 'CV — arabe', 'CV — árabe', 'Lebenslauf — Arabisch', 'резюме — араб.', '简历 — 阿拉伯文', '履歴書（アラビア語）', '이력서 — 아랍어', 'CV — अरबी'],
  nav: ['navigate', 'تنقّل', 'گەڕان', 'gez', 'naviguer', 'navegar', 'navigieren', 'навигация', '跳转', '移動', '이동', 'जाएँ'],
  pick: ['select', 'اختيار', 'هەڵبژاردن', 'seç', 'choisir', 'elegir', 'auswählen', 'выбор', '选择', '選択', '선택', 'चुनें'],
  esc: ['close', 'إغلاق', 'داخستن', 'kapat', 'fermer', 'cerrar', 'schließen', 'закрыть', '关闭', '閉じる', '닫기', 'बंद करें'],
  none: ['No match', 'لا نتيجة', 'ئەنجام نییە', 'eşleşme yok', 'aucun résultat', 'sin coincidencias', 'kein Treffer', 'нет совпадений', '无匹配结果', '該当なし', '일치 없음', 'कोई मेल नहीं']
};

D.toast = D.toast || {};

const ADD = { reset: ['Estimator cleared', 'أُعيد الحاسب', 'حەژمارکەر پاککرایەوە', 'Hesaplayıcı sıfırlandı', 'Estimateur réinitialisé', 'Estimador reiniciado', 'Rechner zurückgesetzt', 'Калькулятор сброшен', '估算器已重置', '見積もりをリセットしました', '추정기가 초기화되었습니다', 'एस्टीमेटर रीसेट हुआ'] };

function main() {
  const words = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let added = 0, holes = [];

  for (const ns of Object.keys(D)) {
    words.en = words.en || {};
    for (const lang of LANGS) {
      words[lang] = words[lang] || {};
      words[lang][ns] = words[lang][ns] || {};
    }
    for (const key of Object.keys(D[ns])) {
      const arr = D[ns][key];
      if (arr.length !== LANGS.length) holes.push(ns + '.' + key + ' has ' + arr.length + ' strings');
      LANGS.forEach((lang, i) => {
        if (!words[lang][ns][key]) { words[lang][ns][key] = arr[i]; added++; }
      });
    }
  }

  for (const lang of LANGS) {
    words[lang].toast = words[lang].toast || {};
    for (const key of Object.keys(ADD)) {
      if (!words[lang].toast[key]) { words[lang].toast[key] = ADD[key][LANGS.indexOf(lang)]; added++; }
    }
  }

  if (holes.length) { console.log('INCOMPLETE:'); holes.forEach((h) => console.log('  ' + h)); process.exitCode = 1; return; }

  fs.writeFileSync(FILE, JSON.stringify(words, null, 2), 'utf8');
  console.log('namespaces:', Object.keys(D).concat(['toast.reset']).join(', '));
  console.log('keys added:', added);
  for (const lang of LANGS) {
    const miss = Object.keys(D).filter((ns) => Object.keys(D[ns]).some((k) => !words[lang][ns][k]));
    if (miss.length) console.log('  !', lang, 'missing', miss.join(','));
  }
  console.log('total paths en:', Object.keys(words.en).reduce((a, ns) => a + Object.keys(words.en[ns] || {}).length, 0));
}

main();
