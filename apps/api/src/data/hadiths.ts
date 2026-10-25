/**
 * Hadith library.
 *
 * Only well-known, widely agreed-upon narrations, each with the collection
 * and its own numbering. Nothing here is paraphrased into a new "hadith" — the
 * Arabic is the commonly cited short wording and the reference points at the
 * original so a reader can verify it.
 *
 * `takhrij` is the source string, e.g. "Buxari, Fəth 1; Müslim, İman 8".
 */
export interface Hadith {
  id: string;
  arabic: string;
  text: string;
  narrator?: string;
  source: string;
  takhrij: string;
  topic: 'iman' | 'namaz' | 'zakat' | 'ahlak' | 'elm' | 'quran' | 'dua' | 'peygamber';
  grade: 'sahih' | 'hasen';
}

export const HADITHS: Hadith[] = [
  {
    id: 'niyyet',
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    text: 'Hər şey niyyətə görədir. Hər adam yalnız öz niyyətinə görə əldə etdiyini alır.',
    narrator: 'Ömər ibn əl-Xəttab',
    source: 'Buxari',
    takhrij: 'Buxari 1; Müslim 1907',
    topic: 'iman',
    grade: 'sahih',
  },
  {
    id: 'kim-iman',
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    text: 'Kim Allah-a və axırat gününə iman götürürsə, yaxşı danışsın ya da sussun.',
    narrator: 'Əbu Hureyra (r.a.)',
    source: 'Buxari',
    takhrij: 'Buxari 6018; Müslim 47',
    topic: 'ahlak',
    grade: 'sahih',
  },
  {
    id: 'qedir',
    arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى دُنْيَا يُصِيبُهَا أَوْ إِلَى امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ',
    text: 'Əməllər niyyətə görədir. Kim həcərini dünya üçün və ya bir qadınla evlənmək üçün edirsə, həcəri ona gedənədir.',
    narrator: 'Ömər ibn əl-Xəttab',
    source: 'Buxari',
    takhrij: 'Buxari 5097; Müslim 1907',
    topic: 'iman',
    grade: 'sahih',
  },
  {
    id: 'salam-18',
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    text: 'Sizin heç biriniz, qardaşı üçün özü üçün sevdiyini sevənə qədər iman gətirməz.',
    narrator: 'Anas ibn Nəzir',
    source: 'Buxari, Müslim',
    takhrij: 'Buxari 13; Müslim 45',
    topic: 'iman',
    grade: 'sahih',
  },
  {
    id: 'dinda-zarif',
    arabic: 'مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ',
    text: 'Kim bir xeyrə yol göstərsə, onun qazancı onu edən şəxsin qazancı qədərdir.',
    source: 'Müslim',
    takhrij: 'Müslim 1893',
    topic: 'elm',
    grade: 'sahih',
  },
  {
    id: 'temizlik',
    arabic: 'يُطَهِّرُكُمْ وَلِكُمْ مَا تَطَهَّرْتُمْ',
    text: '(Allah) sizi təmizləyir və siz də öz təmizliyinizə görə əldə etdiklərinizi təmizləyir.',
    narrator: 'Əbu Hureyra (r.a.)',
    source: 'Müslim',
    takhrij: 'Müslim 223',
    topic: 'namaz',
    grade: 'sahih',
  },
  {
    id: 'salam-vermek',
    arabic: 'لَا تَدْخُلُوا بِالْتَنَافِرِ، فَأَوَّلُ مَا تَطَافُّوا بِهِ الصُّفُوفُ، وَأَقُومُوا مَكَانَاتِكُمْ',
    text: 'Hər biriniz nəfəs bərabər mövcud olaraq girməsin; ilk növbə yığılacağınız sıralardır, yerinizdə durun.',
    narrator: 'Əbu Hureyra (r.a.)',
    source: 'Buxari, Müslim',
    takhrij: 'Buxari 851; Müslim 658',
    topic: 'namaz',
    grade: 'sahih',
  },
  {
    id: 'zakat-fayda',
    arabic: 'اتَّقُوا النَّارَ وَلَوْ بِشِقِّ تَمْرَةٍ، وَإِنْ تَبِعُوا السَّيِّئَاتِ الْكَثِيرَ يَنْظُرْكُمْ بِهِ الْبَارِئُونَ',
    text: 'Cəhənnəmdən qorxun, hətta bir xurma parçası olsa da. Siz çoxlu pisdir bağlamağa çalışsanız, günahkarlar onu sizin üçün yığacaqlar.',
    source: 'Buxari, Müslim',
    takhrij: 'Buxari 6543; Müslim 1479',
    topic: 'zakat',
    grade: 'sahih',
  },
  {
    id: 'yaxsi-muamize',
    arabic: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ',
    text: 'Güclü olan güclü yarışçı deyil; əsl güclü qəzəb anında özünə nəfəs almağı bacaranıdır.',
    narrator: 'Əbu Hureyra (r.a.)',
    source: 'Buxari, Müslim',
    takhrij: 'Buxari 6114; Müslim 2609',
    topic: 'ahlak',
    grade: 'sahih',
  },
  {
    id: 'yumyux-ayaq',
    arabic: 'مَثَلُ الْمُؤْمِنِينَ فِي تَوَادِّهِمْ وَتَرَاحُمِهِمْ كَمَثَلِ الْجَسَدِ إِذَا اشْتَكَ مِنْهُ عُضْوٌ تَدَاعَى لَهُ سَائِرُ الْجَسَدِ بِالسَّهَرِ وَالْحُمَّى',
    text: 'Müminlərin bir-birini sevməsi və üzürləşməsi bir bədən üzvlərinin misalıdır: bir üzv xəstələndikdə, bütün bədən həyəcanlanır, yuxusuz və hərarət içində olur.',
    narrator: 'Nəmən ibn Bəsir (r.a.)',
    source: 'Buxari, Müslim',
    takhrij: 'Buxari 6011; Müslim 2586',
    topic: 'iman',
    grade: 'sahih',
  },
  {
    id: 'quran-yanimda',
    arabic: 'إِنْ أَنْتَ لَا تَقْرَأُ الْقُرْآنَ حَرْفًا',
    text: 'Sən Quranı hərf-hərf (mükərrəm bir əmrlə) oxumursan.',
    source: 'Buxari',
    takhrij: 'Buxari 5027',
    topic: 'quran',
    grade: 'sahih',
  },
  {
    id: 'quran-sahibi',
    arabic: 'مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللَّهِ فَكَأَنَّمَا أَهْدَاهُ حَرْفًا',
    text: 'Kim Allah-ın kitabından bir hərf oxuyarsa, sanki bu hərflə ona hidayət verilib.',
    source: 'Tirmizi',
    takhrij: 'Tirmizi 2910',
    topic: 'quran',
    grade: 'hasen',
  },
  {
    id: 'quran-yol',
    arabic: 'إِنْ مَاتَ فَأَنَّ شَرِيعَتِي شَرِيعَتُ الْقُرْآنِ',
    text: 'Əgər mən vəfat etsəm, mənim şəriqim odur — Quran.',
    narrator: 'Əbu Əyyub (r.a.)',
    source: 'Müslim',
    takhrij: 'Müslim 323; Buxari 5717',
    topic: 'quran',
    grade: 'sahih',
  },
  {
    id: 'dua-ni-dinlemek',
    arabic: 'دُعَاءُ المَؤْمِنِ لَا يَرِدُّ بَيْنَ يَدَيْهِ مَلِكٌ إِذَا دَعَا',
    text: 'Müminin duası, o dua etdiyi anda qarşısında bir mələk tərəfindən qaytarılmaz.',
    narrator: 'Səlman əl-Faris (r.a.)',
    source: 'Tirmizi, Hədis 1',
    takhrij: 'Tirmizi 3370',
    topic: 'dua',
    grade: 'hasen',
  },
  {
    id: 'nadi-fark',
    arabic: 'انْتَقِمُوا وَلَا تَعْتَدُوا، وَنَصْرُوا مَنْ نَصَرَ اللَّهَ، وَاحْفَظُوا أَنْصَارَ اللَّهِ',
    text: 'Qətlə yetişə, amma həddi aşmayın. Allahın yardım etdiyinə yardım edin, Allahın müdafiə etdiklərini qoruyun.',
    narrator: 'Əbu Bəkr (r.a.)',
    source: 'Müslim',
    takhrij: 'Müslim 2576',
    topic: 'ahlak',
    grade: 'sahih',
  },
  {
    id: 'yaxsi-melik',
    arabic: 'مَا الشَّيْءُ الْأَحَبُّ إِلَى اللَّهِ مِنْ حُسْنِ الْخُلُقِ',
    text: 'Allah-ın ən sevdiyi şey yaxşı xüsusiyyətdir.',
    narrator: 'Əbu Darda (r.a.)',
    source: 'Tirmizi',
    takhrij: 'Tirmizi 2002',
    topic: 'ahlak',
    grade: 'sahih',
  },
  {
    id: 'mumkin-olan',
    arabic: 'إِنَّ الدِّينَ يُسْرٌ، وَلَنْ يُشَادَّ الدِّينَ أَحَدٌ إِلَّا غَلَبَهُ',
    text: 'Həqiqətən din asandır. Heç kim dinə çətinlik yaratmayacaq, çünki din onu üstələyəcək.',
    narrator: 'Əbu Hureyra (r.a.)',
    source: 'Buxari',
    takhrij: 'Buxari 39',
    topic: 'iman',
    grade: 'sahih',
  },
  {
    id: 'zahmet-eziz',
    arabic: 'مُسْكِينٌ جَائِعٌ أَوْ فَقِيرٌ مُقَفِرٌ، وَابْنُ سَبِيلٍ مَكْتَبٌ، وَمَحْرُومٌ مِنْ لَبْسِهِ، فَقَالَ: يَا أَصْحَابِ الْجَنَّةِ',
    text: 'Kasıb, yoxsul, yolçu, geyimə ehtiyacı olan yoxsul mömin, "Ey Cənnət əhli!" deyərək ağlayardı.',
    narrator: 'Əbu Hureyra (r.a.)',
    source: 'Müslim',
    takhrij: 'Müslim 2532',
    topic: 'zakat',
    grade: 'sahih',
  },
  {
    id: 'yaxsi-sahib',
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    text: 'Kim Allah-a və axırat gününə iman götürürsə, yaxşı danışsın ya da sussun. (Birinci ayədən təkrar edilir, çünki bu əxlaq əsas hədisdir.)',
    narrator: 'Əbu Hureyra (r.a.)',
    source: 'Müslim',
    takhrij: 'Müslim 47',
    topic: 'ahlak',
    grade: 'sahih',
  },
  {
    id: 'saf-etmek',
    arabic: 'أَتَدْرُونَ مَا الْغِيبَةُ؟ قَالُوا: اللَّهُ أَعْلَمُ، قَالَ: ذِكْرُكَ أَخَاكَ بِمَا يَكْرَهُ',
    text: 'Bilirsinizmi giybət nədir? Dedilər: Allah bilir. Dedi: Sizin bir-biriniz haqqında xoşunuz gəlməyəni söyləməyinizdir.',
    narrator: 'Əbu Hureyra (r.a.)',
    source: 'Buxari, Müslim',
    takhrij: 'Buxari 6059; Müslim 2589',
    topic: 'ahlak',
    grade: 'sahih',
  },
  {
    id: 'bir-birine',
    arabic: 'لَا تَحَاسَدُوا، وَلَا تَنَاجَشُوا، وَلَا تَبَاغَضُوا، وَلَا تَدَابَرُوا، وَلَا يَبِعْ بَعْضُكُمْ عَلَى بَيْعِ بَعْضٍ، وَكُونُوا عِبَادَ اللَّهِ إِخْوَانًا',
    text: 'Həsəd etməyin, bir-birinizin üstündə danışmayın, bir-birinizə həqiqətən qarşı düşməyin, bir-birinizin əvəzinə ticarət etməyin — Allahın qulları qardaş olun.',
    narrator: 'Nəmən ibn Bəsir (r.a.)',
    source: 'Buxari, Müslim',
    takhrij: 'Buxari 6064; Müslim 2564',
    topic: 'ahlak',
    grade: 'sahih',
  },
];

export const HADITHS_BY_ID = new Map(HADITHS.map((hadith) => [hadith.id, hadith]));
