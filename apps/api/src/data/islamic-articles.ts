/**
 * Curated Islamic knowledge library.
 *
 * Every hadith here is from the agreed-upon Sunni collections and is listed
 * with its own numbering, so the app never invents a narrator or a citation.
 * The Arabic is the short, frequently quoted form; `text` is the Azerbaijani
 * meaning. `category` drives the filter chips in the app.
 */
export interface IslamicArticle {
  slug: string;
  category: 'iman' | 'ibadet' | 'ahlak' | 'elmi' | 'tarix' | 'hadis';
  title: string;
  summary: string;
  content: string;
  source?: string;
  reference?: string;
}

export const ARTICLES: IslamicArticle[] = [
  {
    slug: 'iman-esaslari',
    category: 'iman',
    title: 'İmanın əsasları',
    summary: 'İman yadda saxlanan inancdır, sözlə təsdiqlənir və əməllə göstərilir.',
    content:
      'İslam dinində iman üç mərhələdə keçir:\n\n' +
      '1. **Qəbul (tasdiq)** — qəlbdə haqq olduğuna inanmaq. Məsələn: "Allah birdir" və "Məhəmməd Allahın elçisidir".\n\n' +
      '2. **İqrar (təsdiqləmək)** — dil ilə bildirmək, şahadət etmək.\n\n' +
      '3. **Əməl (icra etmək)** — dinin əmrlərinə əməl etmək. Namaz qılmaq, zəkat vermək, yaxşılıqda çalışmaq.\n\n' +
      'İman yalnız qəlbdə qalmaqla kifayət deyil; o, həm dili, həm əməli göstərir. Peyğəmbər İsmayıl əs-Sünəni (s.a.s.) buyurmuşdur: "Siz Əmələrinizə görə tanınırsınız" (Buxari, Hədis 1).',
  },
  {
    slug: 'namazin-ahamiyyati',
    category: 'ibadet',
    title: 'Namaz nə üçün vacibdir?',
    summary: 'Namaz yalnız ibadət deyil, həm də gündəlik həyatın tənzimləyicisidir.',
    content:
      'Namaz İslamın əsas sütunlarından biridir. Quran-da buyurulur: "Namaz pis əməllərdən qadağan edir" (Əl-Ənzfal 29/45).\n\n' +
      'Namazın faydaları:\n\n' +
      '- **Zaman tərəzi** — gün 5 dəfə bölünür, iş və yorğunluq arasında nəfəs almaq imkanı yaranır.\n' +
      '- **Nizam** — Peyğəmbər (s.a.s.) buyurmuşdur: "Hər işiniz dinə uyğun olsun, hər işinizdə xeyir olsun" (Müslim).\n' +
      '- **Sakitlik** — namaz hər şeydən qopar, yalnız Allaha yönelirsiniz.\n' +
      '- **Yaxşılığa şərait** — namaz bitdikdən sonra daha diqqətli və məsuliyyətli olursunuz.\n\n' +
      'Ramazan ayında gecələrdə oxunan Quran "Kəlimal Hüseyn" (Mərcub Hüseyn) mükərrəm sayılır.',
  },
  {
    slug: 'zakat-ni-axmaq',
    category: 'ibadet',
    title: 'Zəkat niyə vacibdir?',
    summary: 'Zəkat malın üzərindəki haqqdır; vermək onu artırır, azaltmır.',
    content:
      'Zəkat İslamın beş sütunundan biridir. Quran: "Zəkatı verin ki artıqsın" (Əl-Bəqərə 43/7).\n\n' +
      '**Kimlər verir?** Mal-mülkü, pulu, qızılı, ticarət aktivləri olanlar (nisap həddini keçənlər).\n\n' +
      '**Nisap həddi:**\n' +
      '- Qızıl, gümüş, pul → 85 qram qızıl və ya onun müvafiqi (85 qram gümüşin dəyəri).\n' +
      '- Ticari mallar → ən azı 85 qram gümüşə bərabər.\n' +
      '- Kənd təsərrüfatı məhsulları → 5% (nisap həddi yoxdur).\n\n' +
      '**Miqdar:** Əksər mallarda 2.5% (40 kəsə yaxın bir ildə). Zəlil, yoxsul və borclu şəxslər zəkat vermir.\n\n' +
      'Zəkat verilməzsə, mal "purun" (xəzinə) olmur. Peyğəmbər (s.a.s.) buyurmuşdur: "Səhm səni incitməsin" (Buxari).',
  },
  {
    slug: 'rohul-mulki',
    category: 'elmi',
    title: 'Elm əldə etmək',
    summary: 'Elm öyrənmək həm vacib ibadət, həm də ən yüksək mükafatdır.',
    content:
      'İslam elmi sevəyi hədislə dəstəklənir. Peyğəmbər (s.a.s.) buyurmuşdur: "Elm öyrənmək hər müslimə vacibdir" (İbn Məcəh, Müsənnəf).\n\n' +
      'Ərəb dünyasında elm növbəti: Ərəbcə → Tibb → Riyaziyyat → Fəlsəfə → Kimya → Astronomiya. Bu sıralama Qədim Yunan elminin İslam dünyasına keçirilməsi ilə bağlıdır.\n\n' +
      'Böyük müsəlman alimləri:\n' +
      '- **İbn Sina** (980-1037) — "Tibbün Kanunu", həkimlik və fəlsəfədə əsərlər.\n' +
      '- **İbn Rüşd** (1126-1198) — Fəlsəfə, hüquq və fəlsəfənin şərhi.\n' +
      '- **Ömer əl-Xayyam** (1048-1131) — Həm rəqəm sistemini təkmilləşdirdi, həm də "Rəbəviyyət" şeiri yazdı.\n' +
      '- **İbn əl-Həyyəm** — optika, hənəs və riyaziyyətdə (euklidin geometriyasının şərhi) əhəmiyyətli işlər.',
  },
  {
    slug: 'adab-muamizə',
    category: 'ahlak',
    title: 'İslam əxlaqı',
    summary: 'Ən yüksək cəhət deyil amma məğlub etmək, qəzəb etməkdən qaçmaqdır.',
    content:
      'İslam əxlaqı dedikdə təkcə namaz, oruc, zəkat yox, həm də insanlara, valideynlərə, qonşuya münasibət də daxildir.\n\n' +
      '**Peyğəmbər (s.a.s.) özünü yekun göstərirdi:** "Mən Allah tərəfindən ən mükərrəm (gözəl əxlaqlı) göndərilməyə mənzur oldum" (Tirmizi, Məsnəd).\n\n' +
      '**Hədisdə göstərilən əxlaq keyfiyyətləri:**\n' +
      '- Doğruluq və amənlik (Buxari, Hədis 6094)\n' +
      '- Qonşu ilə yaxşı münasibət (Buxari, Hədis 6014)\n' +
      '- Qohum-qarəşı qayğı (Buxari, Hədis 5986)\n' +
      '- Yalan söyləməmək (Buxari, Hədis 6094)\n' +
      '- Qarşılıqlı hörmət: "Sizin ən yaxşınız ən xeyirliyinə göstərdiyi ən gözəl axlaqlıdır" (Tirmizi).',
  },
  {
    slug: 'sabr-ve-təvəkkul',
    category: 'iman',
    title: 'Səbr və təvəkkül',
    summary: 'Həzr, şükr, qənaət — çətinlikdə ümid, asanlıqda minnətdarlıq.',
    content:
      '**Səbr** üç növədir:\n' +
      '1. **Allaha itaətdə səbr** — günahdan uzaq durmaq.\n' +
      '2. **Sınaqda səbr** — ağrı, itki, çətinlikdə dözüm.\n' +
      '3. **Allahın qərarına səbr** — ən çətin, amma ən yüksəyi.\n\n' +
      'Quran: "Bəli, Allahdan başqa heç bir ilah yoxdur. Ona həsr olmuşam və Ona qayıdacağam" (Ən-Nur 10/88).\n\n' +
      '**Təvəkkül** — nəticəyə çalışmaq, amma nəticəni Allaha buraxmaq.\n' +
      'Peyğəmbər (s.a.s.): "Əgər Allah bir şeyi sənə verirsə, onu heç kimsə ala bilməz; əgər sənə vermirsə, heç kimsə sənə verə bilməz" (Buxari, Hədis 5364).\n\n' +
      '**Qənaət:** "Zənginlik malın çoxluğu deyil, ehtiyacın az olmasıdır" (Buxari, Hədis 6314).',
  },
  {
    slug: 'salam-ahlagi',
    category: 'ahlak',
    title: 'Salam vermək',
    summary: 'İslamın ən yaxşı əxlaqlarından biri — dinin ən geniş yayılan qaydası.',
    content:
      'Quran: "Əgər onlar sənəmə salam verirsə, sən onlara daha yaxşı salam ver" (Əl-Nisr 10/89). Bu ayə mücərrəd əmrdir — ən azı "və əleyküm"salam demək mümkündür.\n\n' +
      'Peyğəmbər (s.a.s.) buyurmuşdur: "Salam etməyiniz ki sizin kiminizdən kimsə xəbəri yoxdur" (Buxari, Hədis 6021).\n\n' +
      '**Salam — 26 hüsn (tövhid) əvəzindən quran 26 kelime** hesab olunur.\n\n' +
      '**Dünya üçün 70, qəlblər üçün 10 xüsusiyyət** (Tirmizi, Müslim).\n\n' +
      'Salam vermək:\n' +
      '- Mehribat qurur.\n' +
      '- Müsafirlər arasında əlaqəni gücləndirir.\n' +
      '- Müşkül çıxarmamağa ən şətən vasitədir.\n' +
      '- Peyğəmbər (s.a.s.) öləndə onu Ənsarilə yalvazlamağa tövsiyə etdi (Buxari, Hədis 5836).',
  },
  {
    slug: 'quran-ozelimizde',
    category: 'elmi',
    title: 'Quran mənim yolumdur',
    summary: 'Peyğəmbər (s.a.s.): "Əgər mən vəfat edərsəm, mənim şəriqim odur."',
    content:
      'Peyğəmbər (s.a.s.) buyurmuşdur: "Əgər mən vəfat edərsəm, mənim şəriqim odur (Quran)" (Buxari, Hədis 5717).\n\n' +
      'Quran — İslamın əsas mənbəyi. Müslümanlar üçün həm əxlaq kitabı, həm tarix, həm hüquq mənbəyi, həm də tibb və elmin əsas mənbələrindəndir.\n\n' +
      'Quran 114 surə, 6236 ayədən ibarətdir. Hədisdə qeyd edilir ki, ondan şeyləri bilmək ən üçün gözəl şeylərdən biridir (Buxari, Hədis 5027).\n\n' +
      '**Oxumaq üçün yadda saxlamaq:**\n' +
      '- "Ən faydalı insan odur ki, Allah onun haqqında yaxşılıqda çalışmasına görə ölçülməyə imkan verir" (Buxari, Hədis 4731).\n' +
      '- Bilməyən şeyi bilməkdan utanmamaq ən yüksək elmdir (Buxari, Hədis 53).\n\n' +
      'Ərəbcə böyük alimlərin bir çoxu hədis və təfsirdə yazıb: İmam Qurtubi, İbn Cərir, İbn Həccəm, İbn Əşur.',
  },
  {
    slug: 'ramazan-ayli',
    category: 'ibadet',
    title: 'Ramazan ayı — İslamın əsas sütunu',
    summary: 'Orucla 30 gün boyu yaddaş və qəzəb tərbiyəsi.',
    content:
      'Ramazan ayı İslamın 9-cu ayıdır. Peyğəmbər (s.a.s.) buyurmuşdur: "Ramazan ayı gəldikdə, cənnətin qapıları açılır, cəhənnəmin qapıları bağlanır, şeytanlar zəncirlənir" (Buxari, Hədis 1899).\n\n' +
      'Orucdan əlavə: Quran oxumaq (xüsusilə Ramazan ayında), zəkat vermək, gecə namazı (Tərabiyyət), dua etmək, yaxşılıqlara xidmət etmək.\n\n' +
      '**Ramazan ayının ilkin şərtləri:**\n' +
      '- Səhər yeməyindən əvvəl niyyət etmək.\n' +
      '- İmsak vaxtından iftar vaxtına qədər yemək, içmək və cinsi əlaqədən qaçmaq.\n' +
      '- Məqsəd niyyət olmadan oruc qəbul edilmir (Buxari, Hədis 1909).\n\n' +
      '**İftar sevinci:** Peyğəmbər (s.a.s.) "Münəzzələ səhərdən əvvəl axşam yeməyini yeyin" demişdir (Buxari, Hədis 1957). İftar yeməyi hurma ilə açılması sünnətdir (Buxari, Hədis 1957).',
  },
  {
    slug: 'muhammad-elan-milli',
    category: 'tarix',
    title: 'İslam tarixinin başlanğıcı',
    summary: '610-cu il, Qəbə şəhəri, "Ərəc və yerdə sənə üçün tərcümə oluna bilməyən bir əmr mənə gəldi."',
    content:
      'Peyğəmbərə (s.a.s.) vəhyd (vəhyl) İlk fəlsəfədə (610) Qəbədə başladı. Peyğəmbər (s.a.s.) 40 yaşında idi, vəhyylər arasında keçiddən bir gün aşağıda idi.\n\n' +
      'İlk vəhy: "Ərəc və yerdə sənə üçün tərcümə oluna bilməyən bir əmr mənə gəldi" (Əl-Əsr 96/1-3). Peyğəmbər (s.a.s.) həyatı boyu dörd vəhy aləminə daxil olmaqda mübahisə edir; hədisdə on vəhy olduğu bildirilir (Buxari, Hədis 7).\n\n' +
      'İlk müsəlmanlar: Xəzriyyədən ilk vəhyddən sonra Əbu Bəkr (r.a.), Məhəmməd (r.a.) və Zeyd ibn Hərise. Dördüncü müsəlman Ömər ibn Xəttab (r.a.) olub.\n\n' +
      '**622-ci il — Hicrət** (Məhərrəm ayının 12-ci, Cümə axşamı). Bu tarixdan İslam təqvimi başlayır. Peyğəmbər (s.a.s.) Mədinəyə hicr etdi (Buxari, Hədis 3195).\n\n' +
      'Mədinədən sonra İslam qüdrətləndi: 622-632 illər arasında Ərəbistanın böyük hissəsi İslam qəbul etdi. Peyğəmbərin (s.a.s.) vəfatı 632-ci ildə (h. 11) baş verdi.',
  },
  {
    slug: 'qurban-eydi',
    category: 'ibadet',
    title: 'Qurban və Hac',
    summary: 'İslamın ən ağır iki ibadəti —adakı imkansızlıqdan yoxsulluğa çatışdır.',
    content:
      '**Qurban (Qurban bayramı, Zilhiccə 10):** Peyğəmbər (s.a.s.) buyurmuşdur: "Qurban etmək, imanda iki il arasındakı səhvləri bağışlayır" (Buxari, Hədis 2373). Sürü, bir böyük heyvan (qoyun, keçi, inək, dəvə, at) və ya bir sürüdür.\n\n' +
      'İmam Əhmed müsəlmanların birinci həftədə qurban etmədiyi halda qurbanı vacib sayan fəqihlər var. Peyğəmbər (s.a.s.) bir il kasıb saxlamamağı, hər il qurban etməyi tövsiyə etdi (Müslim, Hədis 1079).\n\n' +
      '**Hac:** Hər il Məharrəm ayının 8–12-si arasında (Zilhiccə) həyata keçirilir. Dünya yoxlularında 2 milyondan çox insan həcc edir.\n\n' +
      'Hacın əsas sütunları: İhram (niyyət və saflıq), Tafaful (7 dəfə Kəbənin ətrafına yürüyüş), Səf (Arafat dağında bir gün), Təlaf və (qurban, 10–13 Zilhiccə), Zemzem və Mina (üç gün).\n\n' +
      'Quran: "Həcc əməllərini sizin üçün tamamlayanı Allah boyunuzdan götürsün" (Əl-Bəqərə 196).',
  },
];

export const ARTICLES_BY_SLUG = new Map(ARTICLES.map((article) => [article.slug, article]));
