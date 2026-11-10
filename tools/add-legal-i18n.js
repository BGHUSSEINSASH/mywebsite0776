/* add-legal-i18n.js — writes the legal namespaces into
   assets/i18n/translations.json: the privacy page, the terms page and the
   two footer links that reach them.
   every string is authored as a 12-wide array in LANGS order, so a missing
   language is a hole in this file rather than a silent english leak.
   idempotent: an existing non-empty value is never overwritten.           */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'assets', 'i18n', 'translations.json');
const LANGS = ['en', 'ar', 'ku', 'tr', 'fr', 'es', 'de', 'ru', 'zh', 'ja', 'ko', 'hi'];

const D = {};

D.legal = {
  updated: [
    'Last updated 8 November 2026',
    'آخر تحديث في 8 نوفمبر 2026',
    'دوایین نوێکردنەوە: 8ی نۆڤەمبەر 2026',
    'Son güncelleme 8 Kasım 2026',
    'Dernière mise à jour le 8 novembre 2026',
    'Última actualización: 8 de noviembre de 2026',
    'Zuletzt aktualisiert am 8. November 2026',
    'Последнее обновление — 8 ноября 2026 г.',
    '最后更新于 2026 年 11 月 8 日',
    '最終更新：2026年11月8日',
    '마지막 업데이트 2026년 11월 8일',
    'अंतिम अद्यतन: 8 नवंबर 2026'
  ],

  'p.h1': ['Privacy', 'الخصوصية', 'پاراستنی کەسی', 'Gizlilik', 'Confidentialité', 'Privacidad', 'Datenschutz', 'Конфиденциальность', '隐私政策', 'プライバシー', '개인정보', 'गोपनीयता'],
  'p.lead': [
    'This site counts its own visitors. No analytics vendor, no advertising cookie, no third-party font request — what a page learns about a visit, this page tells you.',
    'هذا الموقع يَعُدّ زوّاره بنفسه. لا جهة تحليلات، لا ملف تعريف إعلاني، ولا طلب خط من خادم خارج: ما تعرفه صفحةٌ عن زيارة واحدة تقوله هذه الصفحة.',
    'ئەم ماڵپەڕە خۆی ژمارەی میوانەکانی دەکات. هیچ لایەنی شیکردنەوە، هیچ کووکی ڕیکلام، و هیچ داواکاری فۆنت لە سێ لایەنەوە — ئەوەی پەڕەیەک لەبارەی سەردانێکەوە دەیزانێت، ئەم پەڕەیە پێت دەڵێت.',
    'Bu site ziyaretçilerini kendisi sayar. Analitik firması yok, reklam çerezi yok, üçüncü taraftan font isteği yok — bir sayfa bir ziyaret hakkında ne öğreniyorsa bu sayfa söylüyor.',
    'Ce site compte ses visiteurs lui-même. Aucun prestataire d’analyse, aucun cookie publicitaire, aucune demande de police à un tiers — ce qu’une page apprend d’une visite, cette page vous le dit.',
    'Este sitio cuenta a sus visitantes por sí mismo. Sin analítica externa, sin cookies publicitarias, sin peticiones de fuentes a terceros: lo que una página aprende de una visita, esta página te lo cuenta.',
    'Diese Seite zählt ihre Besucher selbst. Kein Analyse-Dienst, kein Werbe-Cookie, keine Schrift-Anfrage an Dritte — was eine Seite über einen Besuch erfährt, steht auf dieser Seite.',
    'Этот сайт считает посетителей сам. Без аналитических сервисов, без рекламных cookie, без запросов шрифтов к третьим сторонам — то, что страница узнаёт о посещении, написано на этой странице.',
    '本站自己统计访客：没有第三方分析、没有广告 Cookie、不向外部请求字体。一次访问被记录了什么，这页就写什么。',
    'このサイトは訪問者を自身で数えます。解析ベンダーも、広告クッキーも、外部フォントへのリクエストもありません。1回の訪問について何が分かるかは、このページに書いてあります。',
    '이 사이트는 방문자를 직접 셉니다. 분석 업체도, 광고 쿠키도, 외부 폰트 요청도 없습니다. 한 방문에 대해 아는 내용은 이 페이지에 적혀 있습니다.',
    'यह साइट अपने आगंतुकों को खुद गिनती है — न कोई एनालिटिक्स सेवा, न विज्ञापन कुकी, न किसी तीसरे पक्ष से फ़ॉन्ट अनुरोध। एक विज़िट के बारे में जो पता चलता है, यह पृष्ठ वही बताता है।'
  ],
  'p.countH': ['What the counter keeps', 'ما يحفظه العدّاد', 'ئەوەی ژمێرەکە ڕای دەگرێت', 'Sayaç ne tutuyor', 'Ce que le compteur conserve', 'Lo que el contador guarda', 'Was der Zähler speichert', 'Что хранит счётчик', '计数器保留哪些数据', 'カウンターが保存するもの', '카운터가 저장하는 것', 'गिनती क्या सहेजती है'],
  'p.countP': [
    'Once per day, Baghdad time: a salted hash of your ip address, the page that sent you here, and the device family your browser reports. The salt changes, so the same person cannot be followed from one day to the next.',
    'مرة كل يوم بتوقيت بغداد: بصمة مُملَّحة من عنوان ip، والصفحة التي أرسَلتك إلى هنا، وفئة الجهاز التي يُعلنها متصفحك. الملح يتغيّر، فلا يمكن تتبّع الشخص نفسه من يوم إلى آخر.',
    'جارێک لە هەموو ڕۆژێکدا بە کاتی بەغدا: کۆدی شێواوی ئای پی لەگەڵ سووری، ئەو پەڕەیەی بۆ ئێرە هاتووە، و جۆری ئامێرەکە. سوورییەکە دەگۆڕێت، بۆیە کەسێک لە ڕۆژێکەوە بۆ ڕۆژی تر ناسراو نامێنێت.',
    'Baghdad saatiyle günde bir kez: ip adresinin tuzlanmış özeti, seni buraya gönderen sayfa ve tarayıcının bildirdiği cihaz ailesi. Tuz değişir; aynı kişi bir günden diğerine izlenemez.',
    'Une fois par jour, heure de Bagdad : un condensat salé de votre adresse ip, la page qui vous a mené ici et la famille d’appareils indiquée par votre navigateur. Le sel change : une même personne ne peut pas être suivie d’un jour à l’autre.',
    'Una vez al día, hora de Bagdad: un resumen con sal de tu dirección ip, la página que te trajo aquí y la familia de dispositivos que indica tu navegador. La sal cambia, así que una misma persona no puede seguirse de un día para otro.',
    'Einmal pro Tag, Bagdader Zeit: ein Hash deines ip mit Salt, die Seite, die dich hierhergebracht hat, und die Gerätefamilie laut Browser. Das Salt wechselt, sodass dieselbe Person nicht von einem Tag zum nächsten verfolgt werden kann.',
    'Один раз в день по багдадскому времени: хеш вашего ip-адреса с солью, страница, с которой вы пришли, и семейство устройств из браузера. Соль меняется — одного и того же человека нельзя проследить с одного дня на другой.',
    '每天记录一次（巴格达时间）：带随机盐的 IP 哈希、把你送到本页的来源页面，以及浏览器报告的设备类别。盐值会变，同一个人无法从这一天被追到第二天。',
    'バグダッド時間で1日1回だけ記録します。IPアドレスのソルト付きハッシュ、あなたが来たページ、ブラウザが伝える端末ファミリーです。ソルトは毎日変わるため、同じ人物を日またぎで追跡することはできません。',
    '바그다드 시간으로 하루에 한 번: 아이피 주소의 솔트 해시, 이곳으로 보낸 페이지, 브라우저가 알리는 기기 종류. 솔트는 바뀌므로 같은 사람이 하루에서 다음 하루로 추적될 수 없습니다.',
    'बग़दाद समय के अनुसार दिन में एक बार: आपके ip पते का लवण-मिलाया हैश, वह पृष्ठ जिससे आप यहाँ आए, और आपके ब्राउज़र का बताया उपकरण परिवार। लवण बदलता है, इसलिए एक ही व्यक्ति एक दिन से अगले दिन तक पीछा नहीं किया जा सकता।'
  ],
  'p.neverH': ['What it never touches', 'ما لا يلمسه أبداً', 'ئەوەی قەت دەستی پێناگات', 'Asla dokunmadığı şeyler', 'Ce sur quoi il ne touche jamais', 'Lo que nunca toca', 'Womit es nichts zu tun hat', 'К чему он никогда не прикасается', '它从不碰的东西', '決して扱わないもの', '절대 손대지 않는 것', 'जो कभी नहीं छुआ जाता'],
  'p.never1': [
    'No cookie is set by this site.',
    'لا يضع هذا الموقع أي ملف تعريف ارتزاز.',
    'ئەم ماڵپەڕەیە هیچ کووکی دانانێت.',
    'Bu site hiçbir çerez yerleştirmiyor.',
    'Ce site ne dépose aucun cookie.',
    'Este sitio no instala ninguna cookie.',
    'Diese Seite setzt keine Cookies.',
    'Этот сайт не устанавливает cookie.',
    '本站不设置 Cookie。',
    'このサイトはクッキーを設定しません。',
    '이 사이트는 쿠키를 심지 않습니다.',
    'यह साइट कोई कुकी सेट नहीं करती।'
  ],
  'p.never2': [
    'No advertising id, pixel or cross-site tracker.',
    'لا معرّف إعلاني، ولا بكسل، ولا متتبّع عبر المواقع.',
    'هیچ ناسێری ڕیکلام، پیکسڵ یان شوێنکەوتەری نێوان ماڵپەڕ نییە.',
    'Reklam kimliği, piksel ya da siteler arası izleyici yok.',
    'Identifiant publicitaire, pixel ou traceur inter-sites : aucun.',
    'Sin identificador publicitario, píxel ni rastreadores entre sitios.',
    'Keine Werbe-ID, kein Pixel, kein seitenübergreifender Tracker.',
    'Никаких рекламных идентификаторов, пикселей и межсайтовых трекеров.',
    '没有广告 ID、像素，也没有跨站跟踪器。',
    '広告ID、ピクセル、サイト横断のトラッカーはありません。',
    '광고 ID, 픽셀, 사이트 간 추적자가 없습니다.',
    'कोई विज्ञापन आईडी, पिक्सेल या साइट-पार ट्रैकर नहीं।'
  ],
  'p.never3': [
    'No full ip address is stored, and nothing that names you.',
    'لا يُحفَظ عنوان ip كامل، ولا أي شيء يسمّيك.',
    'هیچ ئای پییەکی تەواو هەڵناگیرێت، و هیچ شتێک کە ناوت هەبێت.',
    'Tam ip adresi saklanmaz; seni adınla anan hiçbir şey saklanmaz.',
    'Aucune adresse ip complète n’est stockée, et rien qui vous nomme.',
    'No se guarda ninguna ip completa, ni nada que te nombre.',
    'Es wird keine vollständige ip-Adresse gespeichert und nichts, was Sie benennt.',
    'Полный ip-адрес не сохраняется, как и всё, что называет вас по имени.',
    '不保存完整 IP 地址，也不保存任何能指名你的内容。',
    '完全なIPアドレスは保存しません。あなたを名前で示すものも保存しません。',
    '전체 아이피 주소는 저장하지 않으며, 당신을 지칭하는 어떤 것도 저장하지 않습니다.',
    'पूरा ip पता संग्रहित नहीं होता, और न ही कोई ऐसी चीज़ जो आपको नाम से पहचाने।'
  ],
  'p.never4': [
    'No name, email or phone number unless you send the order form.',
    'لا اسم ولا بريد ولا رقم هاتف إلا إذا أرسلت نموذج الطلب.',
    'ناو، ئیمەیڵ یان ژمارەی تەلەفۆن نییە مەگەر فۆرمی داواکاری بنێریت.',
    'Sipariş formunu göndermedikçe ad, e-posta ya da telefon numarası yoktur.',
    'Pas de nom, d’email ni de téléphone tant que vous n’envoyez pas le formulaire de commande.',
    'Sin nombre, correo ni teléfono salvo que envíes el formulario de pedido.',
    'Kein Name, keine E-Mail, keine Telefonnummer, solange Sie das Bestellformular nicht absenden.',
    'Ни имени, ни почты, ни номера телефона, пока вы не отправите форму заказа.',
    '除非你提交询价表单，否则不会留下姓名、邮箱或电话。',
    '注文フォームを送信しない限り、名前もメールも電話番号も残りません。',
    '주문 양식을 보내지 않는 한 이름, 이메일, 전화번호가 남지 않습니다.',
    'जब तक आप ऑर्डर फ़ॉर्म नहीं भेजते, कोई नाम, ईमेल या फ़ोन नंबर नहीं।'
  ],
  'p.formH': ['If you send a request', 'إن أرسلت طلبًا', 'ئەگەر داواکاری بنێریت', 'Bir istek gönderirseniz', 'Si vous envoyez une demande', 'Si envías una solicitud', 'Wenn Sie eine Anfrage senden', 'Если вы отправите запрос', '如果你提交请求', 'リクエストを送る場合', '요청을 보내는 경우', 'अगर आप अनुरोध भेजते हैं'],
  'p.formP': [
    'The order form carries your name, email, phone, the service, budget, deadline and message to this site’s own database and to the mailbox that answers you. It is used to reply and to prepare an estimate — not for marketing, not sold, not passed to anybody else.',
    'نموذج الطلب ينقل اسمك وبريدك وهاتفك والخدمة والميزانية والمهلة ورسالتك إلى قاعدة بيانات هذا الموقع وصندوق البريد الذي يجيبك. يُستخدم للرد وإعداد التقدير فقط — لا للتسويق، ولا يُباع، ولا يُسلَّم لأحد غيرهما.',
    'فۆرمی داواکاری ناو، ئیمەیڵ، تەلەفۆن، خزمەتگوزاری، بودجە، موڵەت و پەیامەکەت دەگوازێتەوە بۆ بنکەی داتای خۆی ئەم ماڵپەڕە و ئەو سندوقە نامەیەی وەڵامت دەداتەوە. تەنها بۆ وەڵام و ئامادەکردنی نرخ بەکاردێت — نەک بۆ بازاڕکردن، ناکرێت، و نادرێتە کەسێکی تر.',
    'Sipariş formu adını, e-postanı, telefonunu, hizmeti, bütçeyi, teslim tarihini ve mesajını bu sitenin kendi veritabanına ve sana yanıt veren posta kutusuna taşır. Yanıtlamak ve teklif hazırlamak için kullanılır — pazarlama için değil, satılmaz, üçüncü bir kişiye verilmez.',
    'Le formulaire de commande transmet votre nom, email, téléphone, le service, le budget, l’échéance et votre message à la base de données du site et à la boîte qui vous répond. Il sert à répondre et à préparer un devis — pas à du marketing ; il n’est pas vendu, pas transmis.',
    'El formulario lleva tu nombre, correo, teléfono, el servicio, el presupuesto, la fecha límite y el mensaje a la base de datos de este sitio y al buzón que te responde. Se usa para contestar y preparar un presupuesto — no para marketing, no se vende, no se pasa a nadie más.',
    'Das Bestellformular überträgt Name, E-Mail, Telefon, Service, Budget, Frist und Nachricht an die Datenbank dieser Seite und an das Postfach, das Ihnen antwortet. Es dient der Antwort und der Angebotserstellung — nicht der Werbung, es wird nicht verkauft und nicht weitergegeben.',
    'Форма заказа передаёт имя, почту, телефон, услугу, бюджет, срок и сообщение в базу данных этого сайта и в ящик, который вам отвечает. Используется для ответа и подготовки сметы — не для маркетинга, не продаётся и не передаётся третьим лицам.',
    '询价表单会把你的姓名、邮箱、电话、所选服务、预算、期限和留言送到本站自己的数据库，以及回复你的那个邮箱。它只用于回复和编制报价——不做营销，不出售，也不转给其他人。',
    '注文フォームは、名前・メール・電話・サービス・予算・期限・メッセージを、このサイト自身のデータベースと、あなたに返信する受信箱に届けます。返信と見積もり作成にのみ使い、マーケティングには使いません。売却も第三者への提供もしません。',
    '주문 양식은 이름, 이메일, 전화, 서비스, 예산, 기한, 메시지를 이 사이트의 데이터베이스와 답신을 보내는 메일함으로 전달합니다. 답변과 견적 준비에만 쓰이며, 마케팅용이 아니고 팔거나 제3자에게 넘기지 않습니다.',
    'ऑर्डर फ़ॉर्म आपका नाम, ईमेल, फ़ोन, सेवा, बजट, अवधि और संदेश इस साइट के अपने डेटाबेस और उस मेलबॉक्स तक ले जाता है जो आपको जवाब देता है। इसका उपयोग जवाब देने और अनुमान बनाने के लिए होता है — विपणन के लिए नहीं, बेचा नहीं जाता, किसी और को नहीं दिया जाता।'
  ],
  'p.hostH': ['Where it runs', 'أين يعمل', 'لەکوێدا کار دەکات', 'Nerede çalışıyor', 'Où cela tourne', 'Dónde corre', 'Wo es läuft', 'Где это работает', '它在哪里运行', 'どこで動いているか', '어디에서 동작하는가', 'यह कहाँ चलता है'],
  'p.hostP': [
    'Hosting, database, mail and the captcha each belong to one provider, and each receives only what its part needs. The captcha script is fetched only when a form reaches the step that asks for it, and not at all when that step is off.',
    'الاستضافة وقاعدة البيانات والبريد والتحقّق كلٌّ منها لدى مزوّد واحد، ولا يصل إلى أيٍّ منها إلا ما يحتاجه دوره. نصّ التحقّق يُحمَّل فقط عندما يصل النموذج إلى الخطوة التي تطلبه، ولا يُحمَّل إطلاقًا حين تكون تلك الخطوة مغلقة.',
    'هۆست، بنکەی داتا، نامە و پشکنین هەریەکەیان لایەنێکی تایبەتی هەیە و تەنها ئەوەی بۆ بەشی خۆی پێویستە پێی دەگات. سکریپتی پشکنین تەنها کاتێک هاتووە کە فۆرم دەگاتە ئەو هەنگاوەی داوای دەکات، و ئەگەر ئەو هەنگاوە داخراوبێت قەت ناگات.',
    'Hosting, veritabanı, posta ve doğrulama tek birer sağlayıcıya ait ve her biri yalnızca kendi görevi için gerekeni alır. Captcha betiği yalnızca form onu isteyen adıma ulaşınca getirilir; o adım kapalıysa hiç getirilmez.',
    'L’hébergement, la base de données, le courriel et le captcha appartiennent chacun à un fournisseur unique, et chacun ne reçoit que ce que son rôle exige. Le script du captcha n’est chargé que lorsqu’un formulaire atteint l’étape qui le demande, et jamais si cette étape est désactivée.',
    'Alojamiento, base de datos, correo y captcha pertenecen cada uno a un proveedor, y cada uno recibe solo lo que su parte necesita. El script del captcha se descarga únicamente cuando el formulario llega al paso que lo pide, y nada si ese paso está apagado.',
    'Hosting, Datenbank, Mail und Captcha gehören jeweils einem Anbieter, und jeder bekommt nur, was sein Teil braucht. Das Captcha-Skript wird erst geladen, wenn ein Formular den Schritt erreicht, der es verlangt — und gar nicht, wenn dieser Schritt ausgeschaltet ist.',
    'Хостинг, база данных, почта и капча относятся каждому своему поставщику, и каждый получает только нужное для своей части. Скрипт капчи загружается только когда форма доходит до шага, который её требует, и не загружается вовсе, если этот шаг выключен.',
    '托管、数据库、邮件和验证码各自属于一个服务商，每家只拿到自己那部分需要的数据。验证码脚本只在表单走到需要它的步骤时才加载；该步骤关闭时完全不加载。',
    'ホスティング、データベース、メール、認証は、いずれも一つの提供者に属し、それぞれ自分の役割に必要な分だけ受け取ります。認証スクリプトは、フォームがそれを求める手順に到達したときだけ読み込まれ、その手順がオフなら一切読み込まれません。',
    '호스팅, 데이터베이스, 메일, 캡차는 각각 한 제공자에 속하며, 각자 자기 부분에 필요한 것만 받습니다. 캡차 스크립트는 양식이 그것을 요구하는 단계에 도달했을 때만 불러오고, 그 단계가 꺼져 있으면 아예 불러오지 않습니다.',
    'होस्टिंग, डेटाबेस, मेल और कैप्चा प्रत्येक एक-एक प्रदाता से संबंधित हैं, और प्रत्येक को केवल उसके हिस्से जितनी ज़रूरत है मिलती है। कैप्चा स्क्रिप्ट तभी लाई होती है जब फ़ॉर्म उस कदम पर पहुँचे जो उसे माँगता है, और कदम बंद हो तो बिल्कुल नहीं।'
  ],
  'p.askH': ['Asking about your data', 'السؤال عن بياناتك', 'پرسیار لەبارەی داتاکانتەوە', 'Veriniz hakkında soru', 'Demander au sujet de vos données', 'Preguntar por tus datos', 'Fragen zu Ihren Daten', 'Вопрос о ваших данных', '关于你的数据提问', '自分のデータについての問い合わせ', '내 데이터에 대해 묻기', 'अपने डेटा के बारे में पूछना'],
  'p.askP': [
    'Write to the contact address on the homepage. If you sent a request, ask and you can see it, correct it, or have it deleted; a plain question gets a plain answer, not a form.',
    'اكتب إلى بريد التواصل في الصفحة الرئيسية. إن أرسلت طلبًا فاسأل: يمكنك رؤيته أو تصحيحه أو حذفه؛ والسؤال البسيط يجيب عنه جواب بسيط، لا نموذج.',
    'بۆ ناونیشانی پەیوەندی پەڕەی سەرەکی بنووسە. ئەگەر داواکارییەک ناردووە بپرسە: دەتوانیت بیبینیت، ڕاستی بکەیتەوە یان بیسڕیتەوە؛ پرسیارێکی ئاسان وەڵامێکی ئاسان وەردەگرێت، نەک فۆرم.',
    'Ana sayfadaki iletişim adresine yazın. Bir istek gönderdiyseniz sorun: görebilir, düzeltebilir ya da sildirebilirsiniz; düz bir soruya düz bir yanıt verilir, form değil.',
    'Écrivez à l’adresse de contact de la page d’accueil. Si vous avez envoyé une demande, demandez : vous pouvez la voir, la corriger ou la supprimer ; une question simple reçoit une réponse simple, pas un formulaire.',
    'Escribe a la dirección de contacto de la página principal. Si enviaste una solicitud, pídelo: puedes verla, corregirla o borrarla; una pregunta simple recibe una respuesta simple, no un formulario.',
    'Schreiben Sie an die Kontaktadresse auf der Startseite. Wenn Sie eine Anfrage gesendet haben, fragen Sie: Sie können sie einsehen, berichtigen oder löschen lassen; auf eine schlichte Frage kommt eine schlichte Antwort, kein Formular.',
    'Напишите на контактный адрес на главной странице. Если вы отправляли запрос — попросите: его можно увидеть, исправить или удалить; на простой вопрос приходит простой ответ, а не форма.',
    '请写到首页上的联系邮箱。如果你发过请求，开口即可：你可以查看它、更正它或要求删除它；简单的问题得到简单的回答，而不是一张表单。',
    'トップページの連絡先に書き送ってください。リクエストを送った方は申し出てください。閲覧も訂正も削除もできます。素朴な問いには素朴な回答を返します。フォームではありません。',
    '홈페이지의 연락처로 글을 보내 주세요. 요청을 보냈으시면 말씀해 주세요. 열람하거나 고치거나 삭제하게 할 수 있습니다. 소박한 질문에는 소박한 답이 돌아오지 양식이 아닙니다.',
    'होम पृष्ठ के संपर्क पते पर लिखें। यदि आपने अनुरोध भेजा है तो कहिए: आप उसे देख सकते हैं, सुधार सकते हैं या हटवा सकते हैं; सीधे प्रश्न पर सीधा जवाब मिलता है, फ़ॉर्म नहीं।'
  ],

  't.h1': ['Terms of use', 'شروط الاستخدام', 'مەرجەکانی بەکارهێنان', 'Kullanım koşulları', 'Conditions d’utilisation', 'Condiciones de uso', 'Nutzungsbedingungen', 'Условия использования', '使用条款', '利用規約', '이용약관', 'उपयोग की शर्तें'],
  't.lead': [
    'Using this site means agreeing to the rules below. They are short on purpose: written for the person reading them, not for a lawyer filing them.',
    'استخدام هذا الموقع يعني الموافقة على القواعد أدناه. وهي قصيرة عن قصد: كُتبت للشخص الذي يقرأها، لا للمحامي الذي يودعها.',
    'بەکارهێنانی ئەم ماڵپەڕە واتە ڕازی بوون بە ڕێسای خوارەوە. بە ئەنقەست کورتە: بۆ کەسێک کە دەیکوێنێت نەک بۆ پارێزەرێک کە تۆماری دەکات.',
    'Bu siteyi kullanmak aşağıdaki kuralları kabul etmek demektir. Kasıtlı olarak kısa: bunları okuyan kişi için yazıldı, dosyasına kaldıran avukat için değil.',
    'Utiliser ce site, c’est accepter les règles ci-dessous. Elles sont courtes à dessein : écrites pour la personne qui les lit, pas pour l’avocat qui les classe.',
    'Usar este sitio significa aceptar las reglas de abajo. Son cortas a propósito: escritas para quien las lee, no para el abogado que las archiva.',
    'Diese Nutzung bedeutet, dass Sie die folgenden Regeln annehmen. Sie sind bewusst kurz: geschrieben für die Person, die sie liest, nicht für den Anwalt, der sie ablegt.',
    'Пользуясь этим сайтом, вы принимаете приведённые ниже правила. Они намеренно короткие: написаны для человека, который их читает, а не для юриста, который их подшивает.',
    '使用本站即表示同意以下规则。它们刻意写得简短：是给读它的人写的，不是给归档它的律师写的。',
    '本サイトの利用は、以下の規約に同意することです。意図的に短くしています。読む人のためのもので、書類に保管する弁護士のためのものではありません。',
    '이 사이트를 이용하는 것은 아래 규정에 동의하는 것입니다. 일부러 짧게 썼습니다. 읽는 사람을 위한 것이지, 서류에 보관하는 변호사를 위한 것이 아닙니다.',
    'इस साइट का उपयोग करना नीचे दिए नियमों से सहमत होना है। ये जान‑बूझकर छोटे हैं: इसे पढ़ने वाले व्यक्ति के लिए लिखे गए, न कि फ़ाइल में लगाने वाले वकील के लिए।'
  ],
  't.workH': ['What you are reading', 'ما تقرأه', 'ئەوەی دەیکوێنیت', 'Okuduğunuz şey', 'Ce que vous lisez', 'Lo que estás leyendo', 'Was Sie lesen', 'То, что вы читаете', '你正在读的内容', '読まれているものについて', '읽고 계신 내용', 'आप जो पढ़ रहे हैं'],
  't.workP': [
    'The projects and case studies describe real work for real clients, with figures as they were measured or agreed at the time. Screenshots and artwork belong to the products they show, and nothing here is a promise about your project.',
    'تصف المشاريع ودراسات الحالة عملًا حقيقيًا لعملاء حقيقيين، والأرقام كما قِيست أو اتُّفق عليها آنذاك. الصور والأعمال الفنية ملك المنتجات التي تُظهرها، ولا شيء هنا وعدٌ بشأن مشروعك.',
    'پڕۆژە و لێکۆڵینەوەکان کارێکی ڕاستەقینە بۆ کڕیارە ڕاستەقینەکان باس دەکەن، و ژمارەکان بەو شێوەیەن کە لەوکاتەدا پێوانە یان ڕێککەوتن بوون. وێنە و کارە هونەرییەکان هی ئەو بەرهەمانەن کە پیشانی دەدرێن، و هیچ شتێک لێرە بەڵێنێک نییە دەربارەی پڕۆژەی تۆ.',
    'Projeler ve vaka çalışmaları gerçek müşteriler için yapılmış gerçek işi anlatır; rakamlar o dönemde ölçüldüğü ya da kararlaştırıldığı gibidir. Ekran görüntüleri ve görseller sundukları ürünlere aittir; burada hiçbir şey sizin projeniz için bir söz değildir.',
    'Les projets et études de cas décrivent un travail réel pour des clients réels, avec les chiffres tels qu’ils ont été mesurés ou convenus sur le moment. Les captures et les visuels appartiennent aux produits montrés, et rien ici n’est une promesse pour votre projet.',
    'Los proyectos y estudios de caso describen trabajo real para clientes reales, con cifras tal como se midieron o acordaron en su momento. Las capturas y las piezas gráficas pertenecen a los productos que muestran, y nada aquí es una promesa sobre tu proyecto.',
    'Die Projekte und Fallstudien beschreiben echte Arbeit für echte Kunden, mit Zahlen so, wie sie damals gemessen oder vereinbart wurden. Screenshots und Grafiken gehören den dargestellten Produkten; nichts hier ist ein Versprechen für Ihr Projekt.',
    'Проекты и кейсы описывают реальную работу для реальных клиентов, с цифрами такими, какими их измерили или согласовали тогда. Скриншоты и графика принадлежат показанным продуктам, и ничего здесь не является обещанием насчёт вашего проекта.',
    '项目与案例研究描述的是为真实客户完成的真实工作，其中的数字按当时的测量或约定呈现。截图和美术属于它们所展示的产品，本页内容不构成对你项目的承诺。',
    'プロジェクトとケーススタディは、実在の顧客のための実作業を、当時測定または合意された数値のまま伝えます。スクリーンショットとビジュアルは表示されている製品に帰属し、ここにあるものはあなたのプロジェクトに対する約束ではありません。',
    '프로젝트와 사례 연구는 실제 고객을 위해 한 실제 작업을 당시 측정하거나 합의한 수치 그대로 설명합니다. 스크린샷과 그래픽은 보이는 제품의 것이며, 여기에 있는 무엇도 귀하의 프로젝트에 대한 약속이 아닙니다.',
    'प्रोजेक्ट और केस स्टडी वास्तविक ग्राहकों के लिए किए गए असली काम का वर्णन करती हैं, और आँकड़े वैसे ही हैं जैसे उस समय मापे या तय किए गए। स्क्रीनशॉट और ग्राफ़िक दिखे उत्पादों के हैं, और यहाँ कुछ भी आपके प्रोजेक्ट के बारे में वादा नहीं है।'
  ],
  't.priceH': ['Estimates and prices', 'التقديرات والأسعار', 'نرخ و بەهاکان', 'Teklifler ve fiyatlar', 'Devis et prix', 'Presupuestos y precios', 'Angebote und Preise', 'Сметы и цены', '估算与价格', '見積りと価格', '견적과 가격', 'अनुमान और कीमतें'],
  't.priceP': [
    'The estimator and any number in a reply are an indication in US dollars, valid for the period stated in that message. A price binds only in a written agreement between both sides.',
    'الحاسب وأي رقم في ردٍّ هما مؤشّر بالدولار الأمريكي، صالحان للمدة المذكورة في تلك الرسالة. ولا تُلزم أيّ قيمة إلا في اتفاق مكتوب بين الطرفين.',
    'هێڵکاری و هەموو ژمارەیەک لە وەڵامدا ئاماژەیەک بە دۆلاری ئەمریکی، بەسەر ئەو ماوەیەی لە نامەکەدا هاتووە. هیچ نرخێک تەنها لە ڕێککەوتنێکی نووسراوی نێوان دوو لایەندا بەندەرە.',
    'Hesaplayıcı ve yanıttaki her sayı, ABD dolarıyla bir göstergedir ve o mesajda belirtilen süre için geçerlidir. Bir fiyat ancak iki tarafın yazılı anlaşmasıyla bağlayıcı olur.',
    'L’estimateur et tout chiffre dans une réponse sont une indication en dollars américains, valable pour la période indiquée dans ce message. Un prix ne lie qu’un accord écrit des deux parties.',
    'El estimador y cualquier número en una respuesta son una indicación en dólares estadounidenses, válida durante el periodo indicado en ese mensaje. Un precio solo vincula en un acuerdo escrito entre ambas partes.',
    'Der Rechner und jede Zahl in einer Antwort sind eine Angabe in US-Dollar, gültig für den in der Nachricht genannten Zeitraum. Verbindlich ist ein Preis nur in einer schriftlichen Vereinbarung beider Seiten.',
    'Калькулятор и любая цифра в ответе — ориентир в долларах США, действующий в течение периода, указанного в письме. Цена обязывает только в письменном соглашении обеих сторон.',
    '估算器以及回复中的任何数字都是以美元表示的参考值，仅在该信息所述期限内有效。价格只有在双方书面协议中才具有约束力。',
    '見積もりツールと返信中のあらゆる数値は米ドルによる目安であり、そのメッセージに記した期間に限り有効です。価格に拘束力があるのは、双方の書面による合意の場合のみです。',
    '추정기와 답신 속 모든 숫자는 미국 달러 기준의 참고치이며 그 메시지에 적은 기간 동안만 유효합니다. 가격이 구속력을 갖는 것은 쌍방 간 서면 합의에서입니다.',
    'अनुमानक और जवाब में कोई भी संख्या अमेरिकी डॉलर में एक संकेत है, और उस संदेश में बताई अवधि तक मान्य है। कीमत तभी बाध्यकारी होती है जब दोनों पक्षों का लिखित समझौता हो।'
  ],
  't.reqH': ['Sending a request', 'إرسال طلب', 'ناردنی داواکاری', 'İstek göndermek', 'Envoyer une demande', 'Enviar una solicitud', 'Eine Anfrage senden', 'Отправка запроса', '提交请求', 'リクエストの送信', '요청 보내기', 'अनुरोध भेजना'],
  't.reqP': [
    'Please give a correct email — a request with a wrong address cannot be answered. One request per project; the form is rate-limited and captcha-protected, so bulk or automated submissions are refused. Nothing sent creates an obligation until an agreement is signed.',
    'ضع بريدًا صحيحًا: فالطلب الذي يحمل عنوانًا خاطئًا لا يمكن الرد عليه. طلب واحد لكل مشروع؛ والنموذج محدود المعدّل ومحمي بالتحقّق، لذا تُرفض الإرسالات الجماعية أو الآلية. ولا يولّد أي إرسال التزامًا قبل توقيع الاتفاق.',
    'تکایە ئیمەیڵێکی ڕاست بدە: داواکارییەک کە ناونیشانەی هەڵەی بێت وەڵام ناخرێتەوە. یەک داواکاری بۆ هەر پڕۆژەیەک؛ فۆرمەکە لە ڕووی ژمارەیەدا سنووردارە و بە پشکنین پارێزراوە، بۆیە ناردنی کۆمەڵی یان ئۆتۆماتیکی ڕەت دەکرێتەوە. پێش واژۆکردنی ڕێککەوتن هیچ شتێک بەرپرسیارێتی دروست ناکات.',
    'Lütfen doğru bir e-posta verin; yanlış adresli isteğe yanıt verilemez. Proje başına bir istek: form hız sınırına ve captchaya sahip, dolayısıyla toplu ya da otomatik gönderimler reddedilir. Anlaşma imzalanana kadar gönderilen hiçbir şey yükümlülük doğurmaz.',
    'Merci de donner un email exact — une demande avec une adresse fausse ne peut pas avoir de réponse. Une demande par projet ; le formulaire est limité en débit et protégé par captcha, donc les envois en masse ou automatisés sont refusés. Rien d’envoyé ne crée d’obligation tant qu’un accord n’est pas signé.',
    'Por favor, da un correo correcto: una solicitud con una dirección errónea no puede recibir respuesta. Una solicitud por proyecto; el formulario tiene límite de envíos y captcha, así que se rechazan los envíos masivos o automatizados. Nada enviado crea una obligación hasta que se firma un acuerdo.',
    'Bitte eine richtige E-Mail angeben — eine Anfrage mit falscher Adresse kann nicht beantwortet werden. Eine Anfrage pro Projekt; das Formular ist ratenbegrenzt und captcha-geschützt, Massen- oder Automatik-Einreichungen werden abgelehnt. Nichts Gesendetes begründet eine Verpflichtung, bevor eine Vereinbarung unterzeichnet ist.',
    'Пожалуйста, укажите корректную почту — на запрос с неверным адресом ответить невозможно. Один запрос на проект; форма ограничена по частоте и защищена капчей, поэтому массовые или автоматические отправки отклоняются. Ничто отправленное не создаёт обязательств, пока соглашение не подписано.',
    '请填写正确的邮箱——地址错误的请求无法回复。每个项目请发一条请求；表单有频率限制并受验证码保护，批量或自动提交会被拒绝。在签署协议之前，任何提交都不构成义务。',
    '正しいメールアドレスをご記入ください。アドレスが誤ったリクエストには返信できません。プロジェクトごとに1件。フォームは回数制限と認証で保護されているため、一括または自動の送信は拒否されます。契約に署名するまで、送信によって義務は発生しません。',
    '올바른 이메일을 적어 주세요. 주소가 잘못된 요청에는 답할 수 없습니다. 프로젝트당 한 건. 양식은 횟수 제한과 캡차로 보호되므로 대량이나 자동 제출은 거절됩니다. 계약서에 서명하기까지 제출로 의무가 생기지 않습니다.',
    'कृपया सही ईमेल दें — ग़लत पते वाले अनुरोध का जवाब नहीं दिया जा सकता। परियोजना के लिए एक अनुरोध; फ़ॉर्म दर-सीमित और कैप्चा-सुरक्षित है, इसलिए थोक या स्वचालित भेजना अस्वीकृत होता है। समझौते पर हस्ताक्षर तक भेजी गई कोई चीज़ दायित्व नहीं बनाती।'
  ],
  't.useH': ['Fair use of the site', 'الاستخدام المشروع للموقع', 'بەکارهێنانی گونجاوی ماڵپەڕ', 'Siteyin makul kullanımı', 'Usage loyal du site', 'Uso leal del sitio', 'Zulässige Nutzung der Seite', 'Добросовестное использование сайта', '对本站的正当使用', 'サイトの適正な利用', '사이트의 정당한 이용', 'साइट का उचित उपयोग'],
  't.useP': [
    'You may read, link to and print these pages while you decide about the work. You may not scrape the site in bulk, replay its forms, probe its infrastructure, or present its text, artwork or case studies as your own.',
    'يُسمح لك بالقراءة والربط والطباعة لهذه الصفحات أثناء تفكيرك في العمل. ولا يجوز جمع الموقع بالجملة، ولا إعادة إرسال نماذجه، ولا فحص بنيته التحتية، ولا تقديم نصوصه أو تصاميمه أو دراسات حالته على أنها ملكك.',
    'دەتوانیت لە کاتی بڕیاریدا ئەم پەڕانە بخوێنیتەوە، بەستەری پێ بدەیت و چاپی بکەیت. نابێت ماڵپەڕ بە کۆمەڵ کۆبکەیتەوە، فۆرمەکانی دووبارە بنێریت، ژێرخانی خۆی بپشکنیت، یان دەق و دیزاین و لێکۆڵینەوەکانی وەک هی خۆت پیشان بدەیت.',
    'İş hakkında karar verirken bu sayfaları okuyabilir, bağlayabilir ve yazdırabilirsiniz. Siteden topluca veri çekmek, formlarını yeniden göndermek, altyapısını yoklamak ya da metin, görsel ve vaka çalışmalarını kendinizinmiş gibi sunmak olmaz.',
    'Vous pouvez lire ces pages, y faire un lien et les imprimer pendant que vous décidez du travail. Extraire le site en masse, rejouer ses formulaires, sonder son infrastructure ou présenter ses textes, visuels ou études de cas comme vôtres : non.',
    'Puedes leer, enlazar e imprimir estas páginas mientras decides sobre el trabajo. No puedes extraer datos del sitio en masa, reenviar sus formularios, sondear su infraestructura ni presentar sus textos, gráficos o casos de estudio como propios.',
    'Sie dürfen diese Seiten lesen, verlinken und ausdrucken, während Sie sich wegen der Arbeit entscheiden. Die Seite massenweise auszulesen, ihre Formulare nachzuspielen, ihre Infrastruktur zu sondieren oder Texte, Grafiken und Fallstudien als eigene auszugeben, dürfen Sie nicht.',
    'Вы можете читать, ссылаться и распечатывать эти страницы, пока решаете вопрос о работе. Нельзя собирать данные с сайта массово, воспроизводить его формы, зондировать его инфраструктуру или выдавать его тексты, графику и кейсы за свои.',
    '在你考虑是否合作期间，你可以阅读、链接并打印这些页面。但你不得批量抓取本站、重放其表单、探测其基础设施，或把它的文字、美术或案例研究当作自己的成果。',
    'お仕事の判断中は、これらのページを読み、リンクし、印刷していただけます。ただし、サイトの大量スクレイピング、フォームの再送、インフラの探査、文章・グラフィック・ケーススタディを自身のものとして提示することはできません。',
    '작업을 결정하는 동안 이 페이지를 읽고, 링크하고, 인쇄할 수 있습니다. 다만 사이트를 대량으로 수집하거나, 양식을 재전송하거나, 인프라를 탐사하거나, 글과 그래픽과 사례 연구를 자기 것처럼 내세우는 것은 되지 않습니다.',
    'काम के बारे में सोचते समय आप ये पृष्ठ पढ़ सकते हैं, इनकी कड़ी दे सकते हैं और छाप सकते हैं। आप साइट को थोक में नहीं खींच सकते, उसके फ़ॉर्म दोबारा नहीं भेज सकते, उसके बुनियादी ढाँचे की जाँच नहीं कर सकते, और न ही उसके लेख, ग्राफ़िक या केस स्टडी अपनी तरह पेश कर सकते हैं।'
  ],
  't.yoursH': ['Your words stay yours', 'كلماتك تبقى لك', 'ڕستەکانت هی خۆت دەمێننەوە', 'Sizin sözleriniz sizin kalır', 'Vos mots restent les vôtres', 'Tus palabras siguen siendo tuyas', 'Ihre Worte bleiben Ihre', 'Ваши слова остаются вашими', '你的内容始终属于你', 'あなたの言葉はあなたのまま', '보내신 내용은 귀하의 것입니다', 'आपके शब्द आपके ही रहते हैं'],
  't.yoursP': [
    'What you send in a message remains yours. It carries no licence beyond what is needed to answer you, and your name or company appears only where you have agreed it.',
    'ما ترسله في رسالة يبقى لك. ولا يمنح أي ترخيص سوى ما يلزم للرد عليك، ولا يظهر اسمك أو شركتك إلا حيث وافقت.',
    'ئەوەی لە نامەیەکدا دەینێریت هی خۆت دەمێنێتەوە. هیچ مۆڵەتێکی هەبەت نییە جگە لەوەی پێویستە بۆ وەڵامدانەوەت، و ناو یان کۆمپانیاکەت تەنها لەو شوێنەی دەردەکەوێت کە ڕازی بوویت.',
    'Mesajla gönderdiğiniz şey sizin kalır. Size yanıt vermek için gerekenin ötesinde bir lisans taşımaz; adınız ya da şirketiniz ancak onay verdiğiniz yerde görünür.',
    'Ce que vous envoyez dans un message reste à vous. Cela n’emporte aucune licence au-delà de ce qu’il faut pour vous répondre, et votre nom ou votre entreprise n’apparaît qu’où vous l’avez accepté.',
    'Lo que envías en un mensaje sigue siendo tuyo. No implica ninguna licencia más allá de lo necesario para responderte, y tu nombre o tu empresa aparecen solo donde tú lo has aceptado.',
    'Was Sie in einer Nachricht senden, bleibt Ihres. Es enthält keine Lizenz über das für die Antwort Notwendige hinaus, und Ihr Name oder Ihre Firma erscheint nur, wo Sie zugestimmt haben.',
    'Отправленное вами в сообщении остаётся вашим. Оно не даёт никакой лицензии сверх необходимой для ответа, и ваше имя или компания появляются только там, где вы согласились.',
    '你在留言中发送的内容仍归你所有。它不附带任何超出回复你所必需的许可；你的姓名或公司只出现在你同意的地方。',
    'メッセージでお送りいただいたものはあなたのままであり、返信に必要な範囲を超えるライセンスを含むものではありません。あなたのお名前や会社名は、ご同意いただいた場所にのみ記載します。',
    '보내신 내용은 계속 귀하의 것이며, 답변에 필요한 범위를 넘는 라이선스를 포함하지 않습니다. 성함이나 회사명은 허락하신 곳에 표시합니다.',
    'आपके संदेश में भेजी गई चीज़ आपके ही रहती है। उससे जवाब देने के लिए ज़रूरी के अलावा कोई लाइसेंस नहीं मिलता, और आपका नाम या कंपनी केवल वहीं दिखती है जहाँ आपने सहमति दी।'
  ],
  't.outH': ['Links that leave', 'روابط تخرج من الموقع', 'بەستەرەکانی دەرەوە', 'Dışarı giden bağlantılar', 'Liens qui sortent', 'Enlaces que salen', 'Links, die hinausführen', 'Ссылки наружу', '离站的链接', '外へ出るリンク', '외부로 나가는 링크', 'बाहर ले जाने वाली कड़ियाँ'],
  't.outP': [
    'GitHub, WhatsApp, mail and a few product pages lead off this site. Their behaviour and policies belong to them; the link is a courtesy, not an endorsement or a guarantee.',
    'تُخرج روابط GitHub وواتساب والبريد وبضع صفحات منتجات من هذا الموقع. سلوكها وسياساتها ملكها؛ والربط مجاملة لا تزكية ولا ضمان.',
    'بەستەرەکانی GitHub، WhatsApp، نامە و چەند پەڕەیەکی بەرهەم دەبنە دەرەوەی ئەم ماڵپەڕە. ڕەفتار و سیاسەتەکانیان هی خۆیانە؛ بەستن میواندارییەک، نەک پشتگیری یان گەرەنتی.',
    'GitHub, WhatsApp, posta ve birkaç ürün sayfası bu siteden dışarı çıkar. O sitelerin tutumu ve politikası kendilerine aittir; bağlantı bir nezaket, onay ya da garanti değil.',
    'GitHub, WhatsApp, le courriel et quelques pages de produits mènent hors de ce site. Leur comportement et leurs politiques leur appartiennent ; le lien est une courtoisie, non un adoubement ni une garantie.',
    'GitHub, WhatsApp, el correo y algunas páginas de producto sacan de este sitio. Su comportamiento y sus políticas son suyos; el enlace es una cortesía, no un respaldo ni una garantía.',
    'GitHub, WhatsApp, Mail und einige Produktseiten führen von dieser Seite hinaus. Ihr Verhalten und ihre Richtlinien gehören ihnen; der Link ist eine Höflichkeit, kein Gütesiegel und keine Garantie.',
    'GitHub, WhatsApp, почта и несколько страниц продуктов уводят с этого сайта. Их поведение и политика принадлежат им; ссылка — это вежливость, а не рекомендация и не гарантия.',
    'GitHub、WhatsApp、邮件和一些产品页面会离开本站。它们的行为和政策归它们所有；链接只是一种礼貌，不是背书，也不是保证。',
    'GitHub、WhatsApp、メール、いくつかの製品ページはこのサイトから外へつながります。それらの挙動とポリシーは相手側のものです。リンクは礼儀であって、推奨でも保証でもありません。',
    'GitHub, 왓츠앱, 메일, 몇몇 제품 페이지는 이 사이트 밖으로 나갑니다. 그 동작과 정책은 상대의 것이며, 링크는 예의일 뿐 추천이나 보장이 아닙니다.',
    'GitHub, WhatsApp, मेल और कुछ उत्पाद पृष्ठ इस साइट से बाहर ले जाते हैं। उनका व्यवहार और नीतियाँ उनकी हैं; कड़ी एक शिष्टता है, अनुशंसा या गारंटी नहीं।'
  ],
  't.lawH': ['Governing law', 'القانون الواجب التطبيق', 'یاسای حاکم', 'Geçerli hukuk', 'Droit applicable', 'Legislación aplicable', 'Anwendbares Recht', 'Применимое право', '适用法律', '準拠法', '준거법', 'लागू कानून'],
  't.lawP': [
    'These terms, and any work agreed after them, follow the law of the Republic of Iraq with Baghdad as the place of performance. Neither side answers for indirect or incidental loss, and responsibility for a project never exceeds what that project paid.',
    'تخضع هذه الشروط وأي عمل يُتفق بعده لقانون جمهورية العراق، وبغداد هي مكان التنفيذ. ولا يسأل أي طرف عن خسارة غير مباشرة أو عرضية، ولا تتجاوز المسؤولية عن مشروع ما دفعه ذلك المشروع.',
    'ئەم مەرجانە و هەر کارێک کە دوای ئەوان ڕێکخرابێت بەپێی یاسای کۆماری عێراقە، و بەغدا شوێنی جێبەجێکردنە. هیچ لایەنێک بەرپرس نییە لە زیانی ناڕاستەوخۆ یان ڕێکەوتی، و بەرپرسیارێتی بۆ پڕۆژەیەک هەرگیز لەوەی کە ئەو پڕۆژەیە دابین کردووە زیاتر نییە.',
    'Bu koşullar ve ardından kararlaştırılacak iş, Irak Cumhuriyeti hukukuna tabidir; yerine getirme yeri Bağdat’tır. Tarafların hiçbiri dolaylı ya da arızi kayıptan sorumlu değildir ve bir projedeki sorumluluk o projenin ödediğini aşmaz.',
    'Ces conditions et tout travail convenu ensuite suivent la loi de la République d’Irak, Bagdad étant le lieu d’exécution. Aucune partie ne répond d’une perte indirecte ou occasionnelle, et la responsabilité pour un projet ne dépasse jamais ce que ce projet a payé.',
    'Estas condiciones y cualquier trabajo acordado después siguen la ley de la República de Irak, con Bagdad como lugar de ejecución. Ninguna parte responde de pérdidas indirectas o consecuenciales, y la responsabilidad por un proyecto nunca supera lo que ese proyecto pagó.',
    'Diese Bedingungen und jede danach vereinbarte Arbeit folgen dem Recht der Republik Irak, mit Bagdad als Erfüllungsort. Keine Partei haftet für mittelbare oder zufällige Verluste, und die Haftung für ein Projekt übersteigt nie, was dieses Projekt gezahlt hat.',
    'Настоящие условия и любая согласованная после них работа подчиняются закону Республики Ирак, местом исполнения считается Багдад. Ни одна сторона не отвечает за косвенные или случайные потери, а ответственность по проекту никогда не превышает того, что этот проект заплатил.',
    '本条款及其后约定的任何工作均适用伊拉克共和国法律，履行地为巴格达。任何一方均不对间接或附带损失负责，且就某一项目的责任绝不超过该项目所支付的金额。',
    '本規約およびその後に合意する業務はイラク共和国の法律に従い、履行地はバグダッドとします。いずれの側も間接損害および付随的損害について責任を負わず、あるプロジェクトに関する責任は、そのプロジェクトが支払った額を超えることはありません。',
    '이 약관과 그 이후 합의하는 작업은 이라크 공화국 법률을 따르며 이행지는 바그다드입니다. 어느 쪽도 간접 또는 부수적 손실에 대해 책임을 지지 않고, 한 프로젝트에 대한 책임은 그 프로젝트가 지불한 금액을 넘지 않습니다.',
    'ये शर्तें और उनके बाद तय हुआ कोई भी काम गणतंत्र इराक़ के क़ानून के अधीन है, और बग़दाद निष्पादन स्थल है। कोई भी पक्ष अप्रत्यक्ष या आकस्मिक हानि के लिए ज़िम्मेदार नहीं होता, और किसी परियोजना के लिए दायित्व उस परियोजना द्वारा दिए भुगतान से अधिक कभी नहीं होता।'
  ]
};

// the two footer links live in the footer namespace so build-cases.js can
// put them on the case pages without learning about the legal tree
D.footer = {
  privacy: ['Privacy', 'الخصوصية', 'پاراستنی کەسی', 'Gizlilik', 'Confidentialité', 'Privacidad', 'Datenschutz', 'Конфиденциальность', '隐私', 'プライバシー', '개인정보', 'गोपनीयता'],
  terms: ['Terms', 'الشروط', 'مەرجەکان', 'Koşullar', 'Conditions', 'Términos', 'Bedingungen', 'Условия', '条款', '規約', '약관', 'शर्तें']
};

// what the screen reader says about the tabs that switch between the two
D.a11y = {
  legal: ['Privacy and terms', 'الخصوصية والشروط', 'پاراستنی کەسی و مەرجەکان', 'Gizlilik ve koşullar', 'Confidentialité et conditions', 'Privacidad y términos', 'Datenschutz und Bedingungen', 'Конфиденциальность и условия', '隐私与条款', 'プライバシーと規約', '개인정보 및 약관', 'गोपनीयता और शर्तें']
};

function main() {
  const words = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let added = 0, kept = 0, holes = [];

  for (const ns of Object.keys(D)) {
    for (const key of Object.keys(D[ns])) {
      const arr = D[ns][key];
      if (arr.length !== LANGS.length) holes.push(ns + '.' + key + ' has ' + arr.length + ' strings, not 12');
      LANGS.forEach((lang, i) => {
        // the json is a tree, not a list of dotted strings: dig() in
        // case.js and check-i18n.js splits the key on every dot, so the
        // file has to carry legal -> p -> countH for "legal.p.countH"
        const parts = (ns + '.' + key).split('.');
        let cur = words[lang];
        for (let n = 0; n < parts.length - 1; n++) {
          cur[parts[n]] = cur[parts[n]] || {};
          cur = cur[parts[n]];
        }
        const leaf = parts[parts.length - 1];
        if (cur[leaf]) { kept++; return; }
        cur[leaf] = arr[i];
        added++;
      });
    }
  }

  if (holes.length) { console.log('INCOMPLETE:'); holes.forEach((h) => console.log('  ' + h)); process.exitCode = 1; return; }

  fs.writeFileSync(FILE, JSON.stringify(words, null, 2), 'utf8');

  function dig(node, dotted) {
    for (const p of dotted.split('.')) {
      if (!node || typeof node !== 'object') return undefined;
      node = node[p];
    }
    return node;
  }
  const keys = Object.keys(D).reduce((n, ns) => n + Object.keys(D[ns]).length, 0);
  console.log('legal keys:', keys, '| languages:', LANGS.length, '| written:', added, '| already there:', kept);
  for (const lang of LANGS) {
    const miss = [];
    for (const ns of Object.keys(D)) {
      for (const key of Object.keys(D[ns])) {
        const v = dig(words[lang], ns + '.' + key);
        if (typeof v !== 'string' || !v) miss.push(ns + '.' + key);
      }
    }
    if (miss.length) console.log('  !', lang, 'missing', miss.join(','));
  }
  console.log('en legal:', Object.keys(words.en.legal).join(', '));
  console.log('en footer privacy/terms:', dig(words.en, 'footer.privacy'), '/', dig(words.en, 'footer.terms'));
}

main();
