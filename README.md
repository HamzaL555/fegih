# Fegih — İslami Quiz və Kitab Mağazası

Fegih, React Native/Expo mobil tətbiq, Node.js + Express REST API, PostgreSQL/Prisma və Next.js Admin Panel bir-birinin ayrıldığı full-stack monorepodur. Mobil tətbiqdə kitab, sual, xal qaydası və mükafat məlumatları sabit yazılmır; mənbə **PostgreSQL**-dir.

```text
Admin Panel ──► REST API ──► PostgreSQL ◄── REST API ──► Expo Mobile
                                  │
                                  └── Prisma seed / JSON import
```

## Əsas imkanlar

- Email, telefon və ya username ilə qeydiyyat/login
- 15 dəqiqəlik access token və fırlanan refresh token
- Kitab mağazasında **xal səviyyəsinə görə endirim**: 1000 xal = 5%, 25000 xal = 20% (xal xərclənmir, yalnız səviyyəni müəyyən edir)
- **Mesajlar**: istifadəçi sual yazır, admin panelində cavab verir, cavab geləndə bildiriş düşür
- **Sual-Cavab** oyunu: 15 səviyyə, hər səviyyədə 10 sual, səviyyə N-ə görə 1..15 xal (maksimum 1200)
- Səhv cavabda xal sıfırlanır, oyun 1-ci səviyyədən **fərqli suallarla** yenidən başlayır
- 50/50, Second Chance, Skip, Extra Time və Hint lifeline strukturu
- Xal əməliyyatlarının immutable transaction tarixçəsi
- 7 günlük daily reward, streak, achievement və mission sistemləri
- Daily/weekly/monthly/all-time leaderboard
- Kitab, kateqoriya, wishlist, review, cart və sifariş
- Xalla endirim, promo code və atomik stok azaltma
- Stripe Checkout + imzalı webhook arxitekturası
- Daily Ayah, İslami məlumat, təqvim və gün seçimi ilə namaz vaxtları (Aladhan calendar)
- Qıbıla, təsbih, notifications, çoxdilli UI və light/dark/system theme
- Admin CRUD, JSON preview/import, rol əsaslı icazə və dashboard analytics
- Cloudinary image upload (şifrələr yalnız `.env`-də)

## Struktur

```text
apps/
  mobile/       Expo Router mobil tətbiq
  admin/        Next.js admin panel
  api/          Express TypeScript REST API
packages/
  types/        Paylaşılan TypeScript tipləri
  validation/   Paylaşılan Zod sxemləri
prisma/
  schema.prisma
  migrations/
  seed/
  import-questions.ts
questions/
  examples/     level1.json ... level15.json
docs/
scripts/
  generate-icons.mjs   Tətbiq ikonlarını vektordan yaradır (`npm run icons`)
docker-compose.yml
```

## Tələblər

- Node.js 22.13+ (`24.x` də dəstəklənir)
- npm 10+
- Docker Desktop (PostgreSQL üçün)
- Android üçün: Expo Go və ya Android Studio
- iOS üçün: macOS, Xcode və ya Expo EAS

Mobil tətbiq **Expo SDK 57** hədəfi ilə qurulub: `expo@57.x`, `react-native@0.86.3`, `react@19.2.3`, `expo-router@57.x`. `npx expo-doctor` və `npx expo install --check` hər ikisi uğurlu keçir; Android, iOS və web export-ları yığılır.

## İlk qurulum və bütün ətrafı başlatma

```bash
npm install
npm run dev
```

`npm run dev` aşağıdakı əməliyyatları avtomatik edir:

1. Root `.env` yoxdursa `.env.example` əsasında yaradır.
2. JWT secret-lərini və seed admin parolunu təsadüfi generasiya edir.
3. PostgreSQL Docker konteynerini başladır.
4. Prisma client-i yaradır, migration-ları tətbiq edir və seed işlədir.
5. API, Admin və Expo-nu eyni anda başladır.

Admin parolu `.env` faylında `ADMIN_PASSWORD` dəyəri kimi saxlanılır və source code-a yazılmır. Onu `.env` faylından əldə edə bilərsiniz.

### Telefonda açmaq

1. Komputer və telefon eyni Wi-Fi şəbəkəsində olmalıdır.
2. Windows Firewall Node.js/Metro üçün **Private network** izni verməlidir.
3. Terminaldə görünən Expo QR kodunu telefonun **Expo Go** tətbiqi ilə skan edin.
4. Əgər cihazlar arasında VPN/proxy varsa müvafiq local subnet-i açın.
5. Mobil client özünü IP dəyişdikdə `EXPO_PUBLIC_API_URL` dəyişməyə ehtiyac yoxdur; Expo manifest host-unu izləyir. İstəyə bağlı olaraq dəyişən verilə bilər:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.25:4000/api/v1
```

`npm run dev` terminalında avtomatik olaraq `exp://<LAN-IP>:8081` URL-i və QR kod çap olunur. Metro-nun Android/iOS bundle-ını yoxlamaq üçün kompyuter və telefon eyni Wi-Fi-də olmalıdır; monorepo npm install-dan sonra `expo-router` root-də həll olunduğu üçün Expo Router bundle-ı da fiziki cihazda işləyir.

Əvvəlcədən dəyişən təyin etmək üçün mobil workspace-də `.env.local` yaradın. Dəyər `.env.example` fayllarında boş saxlanılır.

### Expo Go login xətası

Fiziki iPhone/iPad-da aşağıdakı mesaj çıxsa, bu layihənin xətası deyil — Expo Go və Expo CLI eyni hesabla giriş tələb edir:

```text
You need to be signed in to Expo Go and Expo CLI to open project.
```

1. Kompüterdə `npx expo login` çalışdırın.
2. Telefonda Expo Go-nu açın, sağ yuxarıdakı hesab ikonunu basın və **eyni Expo hesabı** ilə daxil olun.
3. `npx expo whoami` ilə CLI hesabını yoxlayın.
4. `npm run dev` işləyərkən Expo Go ekranında **Try Again** basın.

Hesab yaradmaq lazım olsa: <https://expo.dev/signup>. Bu login tələbi yalnız fiziki iOS-da development server üçün tətbiq olunur; Android, simulator və ya production build-ə təsir etmir.

### Ayrı proseslər

```bash
npm run db:up
npm run dev:api       # http://localhost:4000
npm run dev:admin     # http://localhost:3000
npm run dev:mobile    # Expo QR
```

## URL-lər

| Xidmət | URL |
|---|---|
| API | `http://localhost:4000/api/v1` |
| Swagger/OpenAPI UI | `http://localhost:4000/docs` |
| Health check | `http://localhost:4000/api/v1/health` |
| Admin Panel | `http://localhost:3000` |
| Prisma Studio | `npm run db:studio` |

## Database

Local PostgreSQL Docker Compose ilə işləyir. Digər provider-da yalnız `DATABASE_URL` dəyişir.

```bash
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

Production-da destructive `migrate dev` istifadə etməyin:

```bash
npm run build
npx prisma migrate deploy
npm run db:seed
```

`prisma/schema.prisma` dəyişəndən sonra `npm run db:generate` (və ya lokal API prosesini dayandırıb `npm run dev`) işlədin. `npm run dev` Prisma Client-i yalnız schema dəyişəndə generate edir; bu, Windows-da köhnə API prosesinin query engine faylını kilidləməsinin qarşısını alır.

`db:seed` idempotent yazılıb: eyni mənbə suallarını təkrar yaratmır. Repo ilə gələn 15 faylda **823 sətir mənbə sual** var; təzə DB-də seed **819 unikal sual** yaradır, 1 təkrarlanan cavab variantı və 3 təkrarlanan mənbə sualını təhlükəsiz şəkildə atlayır.

## JSON sual idxalı

### Repo JSON-larını yenidən idxal etmək

```bash
npm run import:questions -- questions/examples/level1.json --level 1 --category "İslam ümumi"
```

Bütün səviyyələri bir əmrlə idxal etmək mümkündür:

```bash
npm run import:questions -- questions/examples --recursive --category "İslam ümumi"
```

CLI hər JSON sətrində problemi, səviyyənin mövcudluğunu və database ilə təkrarı göstərir. Artıq mövcud fingerprint-lər yenidən yaradılmır.

### Yeni canonical JSON

```json
[
  {
    "category": "Quran",
    "level": 1,
    "question": "İslamın neçə şərti vardır?",
    "answers": [
      { "text": "3", "isCorrect": false },
      { "text": "4", "isCorrect": false },
      { "text": "5", "isCorrect": true },
      { "text": "6", "isCorrect": false }
    ],
    "explanation": "İslamın beş şərti vardır."
  }
]
```

`points` verilməzsə aktiv `QuestionLevel.points` dəyərindən götürülür. Hər sualda 2–8 fərqli cavab və **dəqiq bir** düzgün cavab olmalıdır.

### Admin Panel idxalı

`Admin → Questions → Import`:

1. JSON faylını seçin.
2. Default kateqoriya/səviyyə seçin.
3. **Preview** düyməsini basın.
4. Hər sətirdə field/error, duplicate və import nəticəsini yoxlayın.
5. **Import** düyməsi ilə əməliyyatı başladın.

## Admin panel

### Necə açmaq olar

Admin panel veb tətbiqdir, mobil tətbiqin içində deyil. `npm run dev` işlədikdə avtomatik açılır:

| Cihaz | URL |
|---|---|
| Kompüter (localhost) | <http://localhost:3000> |
| Telefon (eyni Wi-Fi) | `http://<kompüterin-IP>-si>:3000` — məs. `http://192.168.0.106:3000` |

Mobil tətbiqdə **Profil → Tənzimləmələr → Admin paneli → “Admin panelini aç”** düyməsi eyni URL-i avtomatik açır (IP dəyişsə də, Metro host-dan götürülür).

`npm run dev` işləmirsə ayrıca başladın:

```bash
npm run dev --workspace @fegih/api      # API   → http://localhost:4000
npm run dev --workspace @fegih/admin    # Admin → http://localhost:3000
```

Giriş: `.env` faylındakı `ADMIN_EMAIL` və `ADMIN_PASSWORD` dəyərləri (default e-poçt: `admin@fegih.az`). Parolu görmək üçün:

```bash
Select-String ADMIN_PASSWORD .env   # PowerShell
```

> Panel ayrıca sessiya saxlayır (`sessionStorage`) və mobil hesabın panelə girişi bloklanır. Yalnız `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `ORDER_MANAGER`, `QUESTION_MANAGER` rolları daxil ola bilər.

### Səviyyələr və suallar (1-15)

- **Səviyyələr** (yan menyu): 15 səviyyənin adı, kodu, sıra nömrəsi (1-15), çətinlik, xal və sual sayı. Yeni səviyyə yaradmaq, söndürmək və redaktə etmək olar; eyni səhifədə kateqoriyalar idarə olunur.
- **Suallar**: səviyyə, kateqoriya və status (Aktiv / Qaralama / Arxiv) filtri ilə. Redaktə düyməsi işləyir; arxivləmə “Bərpa et” ilə geri qaytarıla bilər.
- Repo-dakı 15 JSON fayl (`questions/examples/level1.json` … `level15.json`) artıq PostgreSQL-ə yüklənib: **819 sual / 15 səviyyə**. Yenidən yükləmək üçün `npm run db:import` (CLI) və ya **Sual idxalı** səhifəsi (Admin Panel).

### Rollar

- `SUPER_ADMIN` — tam icazə
- `ADMIN` — ümumi admin əməliyyatlar
- `EDITOR` — kontent
- `ORDER_MANAGER` — sifarişlər
- `QUESTION_MANAGER` — suallar

Kitab şəklini seçdikdə `POST /api/v1/admin/uploads` multipart `image` faylı göndərilir. Cloudinary tənzimlənməyibsə API açıq səhv qaytarır; lokal dummy URL yaradılmır.

## Environment variables

Bütün mövcud açar `.env.example`-dədir. `.env` Git-ə daxil edilmir.

### Vacib dəyərlər

| Dəyər | Təyinat |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantısı |
| `NEXT_PUBLIC_API_URL` | Admin Panel-in brauzer API URL-si (production-da HTTPS) |
| `JWT_SECRET` | Access token imzası |
| `JWT_REFRESH_SECRET` | Refresh token hash funksiyası |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | İlk admin seed hesabı |
| `CLOUDINARY_*` | Kitab/sual/profil şəkilləri |
| `STRIPE_SECRET_KEY` | Checkout yaradılması. Boş və ya placeholder olduqda kart ödənişi **lokalda simulyasiya** olunur |
| `STRIPE_WEBHOOK_SECRET` | Payment webhook imzası |
| `PAYMENT_MOCK` | `true` olduqda kart ödənişi hətta real açar olsa da simulyasiya edilir |
| `ORDER_NOTIFICATION_EMAIL` | Nağd/bank sifarişinin göndəriləcəyi ünvan (yoxdursa `ADMIN_EMAIL`) |
| `RESEND_API_KEY` | Parol yeniləmə və sifariş emaili. Boşdursa məktub konsola yazılır, sifariş yenə də yaradılır |
| `ALADHAN_API_URL` | Prayer-times provider |
| `EXPO_ACCESS_TOKEN` | Expo push token yoxlaması |
| `ALLOW_DEV_RESET_TOKEN` | `true` olanda `/auth/forgot-password` reset tokenini cavabda qaytarır (yalnız lokal inkişaf üçün) |
| `CRON_SECRET` | `POST /jobs/*` cron sorğularının başlığı |
| `EXPO_PUBLIC_ADMIN_URL` | Mobil tətbiqdə “Admin panelini aç” düyməsinin istifadə etdiyi URL (təyin edilməzsə Metro host-dan yığılır) |

## Payment

Default adapter Stripe Checkout-dur. Stripe dashboard-da webhook endpoint-i belə qurun:

```text
POST https://your-api.example.com/api/v1/payments/webhook/stripe
```

Event-lər: `checkout.session.completed`, `checkout.session.expired`. Checkout yaradıldıqda stok atomik rezerv edilir; uğurlu webhook order statusunu `CONFIRMED` edir. Təkrar webhook idempotentdir.

### Test ödəniş (Stripe açarı olmadan)

`STRIPE_SECRET_KEY` boş **və ya** placeholder olduqda kart ödənişi lokalda simulyasiya edilir — real Stripe çağırısı yoxdur, pul çıxarılmır:

- Sifariş birbaşa `CONFIRMED`, ödəniş `PAID` yaradılır, `provider = MOCK`.
- API cavabında `mocked: true` qaytarılır; mobil tətbiq "test ödənişi simulyasiya edildi" mesajını göstərir.
- Səbət boşalmaz və stok azalmır — əvvəlki `getStripe()` 503-ü sifariş yazıldıqdan **sonra** atırdı.

Placeholder açar (`fake`, `placeholder`, `changeme` …) real kimi qəbul edilmir: Stripe-a göndərilən saxta açar 401 qaytarıb ödənişni daha qarışıq göstərərdi. Bütün açar formatını yoxlayan funksiya `isStripeConfigured()`-dir.

Gerçek Stripe işə salmaq üçün `.env`-ə həqiqi `sk_test_…` açarını yazın, **və ya** test rejimini məcbur etmək üçün `PAYMENT_MOCK=true` qoyun.

### Nağd ödəniş bildirişi

`CASH_ON_DELIVERY` və `BANK_TRANSFER` Stripe-siz işləyir. Sifariş yaradılanda mağazaya **email** göndərilir — sifariş nömrəsi, məbləğ, məhsul sayı, müştəri adı/telefonu, şəhər və ünvan cədvəl formatında.

Hədəf ünvan `.env`-dəki `ORDER_NOTIFICATION_EMAIL` (bu layihədə `ramil.soltan011@gmail.com`), yoxdursa `ADMIN_EMAIL`. `RESEND_API_KEY` boşdursa məktub konsola yazılır və API `emailDelivered: false` qaytarır — heç bir xəta atılmır, sifariş qaçmasın.

### Ödəniş alındı (admin)

Nağd/bank sifarişinin Stripe webhook-u yoxdur, ona görə admin panelində **"Ödəniş alındı"** düyməsi var (`POST /admin/orders/:id/mark-paid`). Sifarişi `CONFIRMED` edir, ödənişi `PAID` işarələyir və alıcıya təsdiq emaili + push bildirişi göndərir. Artıq `PENDING` olmayan sifariş üçün `409` qaytarılır.

## İkonlar və animasiyalar

**Tətbiq ikonu.** Bütün launcher qatları `scripts/generate-icons.mjs` ilə vektor vərkdən PNG-ə çevrilir (`npm run icons`). Vərkdə yalnız **bir** surət var və həm iOS ikonu, həm Android `adaptiveIcon.foregroundImage`, həm bildiriş ikonu, həm favicon ondan yaradılır — bu yolla qatlar arasında uyğunsuzluq ola bilmir.

**Menyu.** Ana səhifədəki sürətli çıxış xətti siyahı əvəzinə ikonlu 3 sütunlu şəbəkədir (`QUICK_LINKS`). Hər plitka mount olduqda ardıcıl (`45 ms` qradiyal) fade + qalxış göstərir və basılanda UI thread-də kiçilir. Tab bar ikonları seçiləndə `withSpring` ilə sıçrayır. Səhifə keçidləri `slide_from_right`, tətbiqə giriş isə `fade_from_bottom`.

**Qıbla.** Başlıq (`heading`) 360°-da dövür edir, ona görə birbaşa `-heading`-ə animasiya etmək 359° → 1° sıçrayışında **358° uzun yol** gedirdi və ox heç vaxt dayanmırdı. İndi hər dəyərin "unwrap" edilmiş (monoton) bir kopyası saxlanılır və hər sensor nümunəsində **ən qısa imzali addım** (`signedDelta`) toplanır — dəyər heç vaxt `±180°`-də sıçramır, ox isə cihaz dayananda dərhal sabitlənir.

## Push notifications

**Namaz bildirişləri lokal planlanır** — heç bir xidmət hesabı tələb etmir. Namaz vaxtları ekranda yükləndikdən sonra hər namaz üçün **15 dəqiqə əvvəl** yerli `expo-notifications` bildirişi qurulur (`prayer-reminders` kanalı). **Tənzimləmələr → Namaz vaxtları** açıq/bağlıdır.

Server tərəfdəki push (Expo Push) yalnız fəal istifadəçilərə bildiriş göndərmək üçün nəzərdə tutulub və aşağıdakı dəyəri tələb edir:

```env
EXPO_ACCESS_TOKEN=...
```

## Təqvim

Hicri təqvim `Intl`in `islamic-umalqura` təqvimindən hesablanır (xarici API yoxdur, 0-4 ms). Endpoint-lər:

- `GET /api/v1/islamic/calendar/month?year=&month=&lang=` — həmin hicri ayın günlər şablonu, bayram/ənamə işarələri və tədbirlər
- `GET /api/v1/islamic/calendar/upcoming` — yaxınlaşan Ramazan/Novruz/Qurban bayramları

Novruz (Eid al-Fitr) 9/10, Qurban (Eid al-Adha) 10/12, Aşura 1/10, Arefə 12/9, Ləylətü’l-Qadr 9/27, İsra və Mi‘rac 7/27 avtomatik işarələnir.

## Quran

Tam Quran məlumatı `prisma/data/quran.json` faylında saxlanılır və `npm run db:seed` ilə PostgreSQL-ə yüklənir (**114 surə / 6236 ayə**, Ərəb dəstəyləyən Uthmani mətn və ingilis tərcüməsi — mənbə: AlQuran Cloud).

| Endpoint | İstifadə |
|---|---|
| `GET /api/v1/quran/locales` | Dostəklənən dillərin siyahısı |
| `GET /api/v1/quran/surahs/:n?locale=` | Surə mətni, seçilmiş dilin tərcüməsi ilə |
| `GET /api/v1/quran/daily?locale=` | Günlük ayə, seçilmiş dilin tərcüməsi ilə |
| `GET /api/v1/quran/search?q=&locale=` | Axtarış, seçilmiş dilin tərcüməsi ilə |

### Dillərə uyğun tərcümə

Hər ayənin **üç tərcüməsi** saxlanılır və API ayəni **proqramda seçilmiş dildə** qaytarır:

| Dil | Tərcüməçi |
|---|---|
| `az` | Əlikhan Musayev |
| `tr` | Yasar Nuri Öztürk |
| `en` | Mohammad Asad |
| `ar` | Ərəb orijinalı (Uthmani) |

Bütün endpoint-lər `?locale=az|tr|en|ar` qəbul edir; parametr verilməzsə və ya dəyişməzsə **az** işə düşür. Mobil tətbiq dili Ayarlar-dan götürür (`useAppLocale`) və dili dəyişəndə sorğu açarına daxil edilir, yəni keçmiş tərcümə keşdə qalmır.

Tərcümələri yeniləmək və ya əlavə etmək:

```bash
node scripts/fetch-quran-translations.mjs --push
```

Skript `prisma/data/quran.json`-u yeniləyir və PostgreSQL-ə tək set-based `UPDATE` ilə yazır (6236 sətir, bir neçə saniyə). Yeni dil əlavə etmək üçün `EDITIONS` massivini genişləndirin.

 114 surənin siyahısı |
| `GET /api/v1/quran/surahs/:n?page=&limit=` | Surə mətni (səhifələnmiş) |
| `GET /api/v1/quran/surahs/:n/ayahs/:a` | Tək ayə |
| `GET /api/v1/quran/search?q=` | Aya və ya tərcümə üzrə axtarış |
| `GET /api/v1/quran/daily` | Gündəlik ayə (hər gün fərqli) |

`GET /daily-ayah` isə admin panelində konkret gün üçün ayə təyin edilməyibsə, tam Quran üzrə deterministik dövr vurur — belədə hər gün fərqli ayə göstərilir.

## Xalla endirim

Kitab mağazasında xal **səviyyə** kimi işləyir: balans nə qədərdirsə, o qədər faiz endirim verilir. **Xal xərclənmir** — o, yalnız səviyyəni təyin edir.

| Xal | Endirim | Səviyyə |
|---|---|---|
| 1000 | 5% | Bronza |
| 2500 | 8% | Gümüş |
| 5000 | 12% | Qızıl |
| 10000 | 15% | Platin |
| 25000 | 20% | Almaz |
| 50000 | 25% | Feyz |

Cədvəl `bookPointDiscountTiers` sistem parametrində saxlanılır və **Admin → Tənzimləmələr → Store** bölməsindən dəyişdirilir.

| Endpoint | İstifadə |
|---|---|
| `GET /api/v1/store/point-discount` | İstifadəçinin səviyyəsi, endirimi və növbəti hədəf (auth) |
| `GET /api/v1/store/point-discount/tiers` | Cədvəl (public) |
| `GET /api/v1/cart` | Səbət: `pointDiscount`, `discountPercent`, `total` |

Sifariş yaradılarkən endirim **avtomatik** tətbiq olunur və sifarişə snapshot yazılır (`Order.discountTierPoints`, `Order.pointDiscountPercent`), çünki balans sonra dəyişir. Sifariş ləğv ediləndə xal geri qaytarılmır — heç vaxt xərclənməmişdi.

## Mesajlar (dəstək)

İstifadəçi tətbiqdən sual yazır, admin isə cavabı admin panelində verir.

- **Mobil**: Profil → Mesajlar. Oxunmamış cavab sayı profil menyusunda və mesaj siyahısında göstərilir.
- **Admin**: Yan panel → Mesajlar. Status filtrləri (Gözləyir / Cavablandı / Bağlı), mövzu və istifadəçi emaili axtarışı, oxunmamış sayğac.
- Admin cavab verəndə istifadəçiyə **push bildiriş** gedir (`MESSAGE_REPLY`) və `/messages/unread-count` sayğacı artır.
- İstifadəçi yenidən yazanda söhbə `OPEN`-a qayıdır ki, heç bir sual itməsin.
- Bağlanmış söhbəyə yazmaq 409 qaytarır.

| Endpoint | Kim | İstifadə |
|---|---|---|
| `GET /api/v1/messages` | İstifadəçi | Söhbələr + oxunmamış sayı |
| `POST /api/v1/messages` | İstifadəçi | Yeni sual |
| `GET /api/v1/messages/unread-count` | İstifadəçi | Rozet üçün |
| `GET /api/v1/messages/:id` | İstifadəçi | Söhbəni aç (oxunmamış sıfırlanır) |
| `POST /api/v1/messages/:id/reply` | İstifadəçi | Cavab yaz |
| `GET /api/v1/admin/messages` | Admin | Qutu (filtr + axtarış) |
| `GET /api/v1/admin/messages/:id` | Admin | Söhbəni aç |
| `POST /api/v1/admin/messages/:id/reply` | Admin | Cavab yaz → istifadəçiyə bildiriş |
| `PATCH /api/v1/admin/messages/:id` | Admin | Status dəyiş (OPEN/ANSWERED/CLOSED) |

## Storage

Cloudinary hesabı yaradın və dashboard-dan API key/secret alın. Secret-ları `.env`-yə yazın. Yalnız URL və public ID database-də saxlanılır; şəkil faylları PostgreSQL-də saxlanılmır.

## Təhlükəsizlik

- bcrypt (cost 10, yeni parollar üçün; mövcud hash-lər öz cost-u saxlayır) parol hashing
- qısaömürlü JWT access token və DB-də hash-lənmiş refresh token
- 60 saniyəlik auth və `SystemSetting` keşi (hər sorğuda DB-yə getmədən)
- bilinməyən hesab üçün dummy `bcrypt.compare` (istifadəçi sayma kanalının bağlanması)
- refresh token rotation və logout-da revoke
- rol və permission yoxlaması
- Zod input validation
- parameterized Prisma queries
- Helmet, CORS allow-list və body-parsing-dən əvvəl rate limiting
- Admin istifadəçi siyahısında `passwordHash` heç vaxt serializə olunmur
- reset tokeni yalnız `ALLOW_DEV_RESET_TOKEN=true` olanda cavabda qaytarılır
- Cloudinary/S3 private secret yalnız serverdə
- Stripe webhook imzası və idempotent status update
- soft account deletion və bloklanmış istifadəçi kontrolü
- payment, xal, stok və quiz reward əməliyyatları database transaction-da

Production üçün TLS terminating reverse proxy (Caddy/Nginx), məntiqi backup, PostgreSQL point-in-time recovery və log monitoring qurulmalıdır.

## Build və test

```bash
npm run typecheck
npm run test
npm run build
```

Mobil native build:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

Local native build üçün hər platforma aid `npm run android` / `npm run ios` script-i mövcuddur. CI və production-da mühit dəyişənləri repository-yə commit etməyin.

## Veb sayt: sayt kimi, amma "Add to Home Screen" ilə tətbiq kimi

Sayt **sayt kimi** açılır: brauzerin eninə yayılır, məzmun sütunu mərkəzləşir, qısa yol düymələri geniş ekranda 4-5 sütuna düzülür, alt naviqasiya məzmun sütunu ilə eyni eni tutur.

Telefonda isə saytı **"Add to Home Screen"** etdikdə PWA kimi açılır:

| | |
|---|---|
| `display` | `standalone` — brauzer paneli olmur |
| `orientation` | `portrait` |
| `viewport-fit` | `cover` — kontent çentək və home indicator altına da çizilir |
| `theme_color` | `#0F766E` |
| `apple-mobile-web-app-capable` | iOS-da "Əlavə et" → tam ekran |

Bunun üçün:

- `apps/mobile/public/manifest.json` — PWA manifest-i (`public/` → saytın kökü)
- `apps/mobile/public/pwa-*.png` — 192/512 və **maskable** ikon (launcher dairəyə kəsir)
- `apps/mobile/app/+html.tsx` — dev server üçün HTML başlıqları
- `apps/mobile/scripts/patch-web-html.mjs` — **export** üçün. Expo Router `+html.tsx`-i yalnız dev serverdə və statik outputda tətbiq edir; SPA output-da CLI ümumi `index.html` yazır, ona görə `viewport-fit` və manifest linki build-dan sonra əlavə olunur.

`npm run build:web` hər ikisini özü edir.

## Bir sistem, bir baza

Veb sayt, admin paneli və mobil tətbiq **hamısı Neon-dakı eyni bazaya** yazır və oxuyur. Bir halqa var:

```text
Admin paneli ──▶ fegih-api.vercel.app ──▶ Neon (PostgreSQL)
Mobil (Expo Go) ─┘                          ▲
Veb sayt (fegih.vercel.app) ─┘              │
Lokal API (localhost:4000) ─────────────────┘
```

İstifadəçi, kitab, sifariş, xal, mesaj — hamısı eyni cədvəllərdədir. Admin panelində kitab əlavə etdikdən saniyələr sonra o **həm saytda, həm telefonda** görünür.

Bunu işləmək üçün üç şey eyni olmalıdır:

1. **`DATABASE_URL`** — lokal `.env` və Vercel-də **eyni** Neon URL-i (pooled).
2. **`JWT_SECRET` / `JWT_REFRESH_SECRET`** — eyni dəyərlər. Fərqli olsaydı, bir tərəfin verdiyi token digər tərəfdə `401` alardı və "iki məhsul" hissi yaranardı.
3. **API URL-i** — `apps/mobile/.env.local` faylında `EXPO_PUBLIC_API_URL` cloud API-ya baxır; telefonda da həmin API ilə danışır.

Lokal API hələ də işləyir və **eyni Neon bazasına** bağlıdır — yəni lokal kodla işləyərkən də məlumatlar eyni yerdədir, sadəcə kod fərqlidir.


## Deploy: Vercel (3 layihə)

Arxitektura **üç ayrı Vercel layihəsidir** və hər biri öz domenində işləyir. Admin paneli API-yə `next.config.mjs` vasitəsilə proxy edir, mobil veb isə `vercel.json` rewrite ilə — beləliklə **admin paneldə dəyişiklik dərhal hər iki səhifədə görünür** (React Query eyni prosesdə API-dən oxuyur, cache yalnız brauzer təbəsindədir).

```text
fegih-admin.vercel.app ──proxy──▶ fegih-api.vercel.app ──▶ Neon PostgreSQL
fegih.vercel.app ──────proxy────▶ fegih-api.vercel.app ──▶ Neon PostgreSQL
```

### Tez yol (bir əmrlə)

```bash
vercel login                                   # bir dəfə, normal terminalda
cp deploy/vercel-env.example.mjs deploy/vercel-env.mjs   # sonra doldur
npm run deploy:vercel
```

Script API → admin → web sırası ilə üç layihəni yaradır, link edir, hər birinə mühit dəyişənlərini yazır və production deploy edir. Səirləri əmr sətrindən keçirmir — stdin ilə ötürür, ona görə shell tarixçəsində görünmür.

### 1. Neon (pulsuz PostgreSQL)

1. [neon.tech](https://neon.tech) → hesab yarad → **Create project** (ad: `fegih`, region yaxınını seç).
2. **Connection string** bölməsində **Pooled connection**-u kopyala — bu `DATABASE_URL` olacaq (sonunda `?pgbouncer=true&connection_limit=1` var).
3. **Direct connection**-u da kopyala — bu `DIRECT_DATABASE_URL` (migration üçün vacibdir).
4. Bu iki URL-i `deploy/vercel-env.mjs` faylına yaz.

### 2. Dəyişənlər

`deploy/vercel-env.mjs` üç qrupa bölünür:

| Qrup | Vacib olanlar |
|---|---|
| `api` | `DATABASE_URL` (Neon pooled), `DIRECT_DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN`, `ADMIN_PASSWORD` |
| `admin` | `NEXT_PUBLIC_API_URL=/api/v1`, `API_PROXY_ORIGIN=https://fegih-api.vercel.app` |
| `web` | `EXPO_PUBLIC_API_URL` **boş qalır** — veb öz `/api/v1` yolunu işlədib `vercel.json` onu API-yə yönləndirir |

`JWT_SECRET` və `JWT_REFRESH_SECRET` üçün:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`WEB_ORIGIN`-ə **hər iki** frontend domenini yaz — açıq deyilsə brauzer bütün sorğuları CORS-a görə rədd edir.

### 3. DB-ni doldurmaq (bir dəfə, deploy-dan sonra)

```bash
npx prisma migrate deploy
node --import tsx prisma/seed/index.ts
```

Seed ilk admin hesabını yaradır, sualları və Quran məlumatlarını yükləyir.

Yoxla: `https://fegih-api.vercel.app/api/v1/health` və `https://fegih-api.vercel.app/docs`

### Serverless diqqət yetirilməli olanlar

- **Rate limit.** `express-rate-limit` sayğacları proses yaddaşında saxlanılır. Vercel konteynerini tez-tez geri qaytarır, ona görə limitlər production-da zəif olacaq. Həll: Upstash Redis (pulsuz) + paylaşılan store.
- **Prisma bağlantıları.** Neon-un *pooled* URL-i vacibdir. Birbaşa URL ilə hər funksiya çağırışı yeni bağlantı açaraq plan limitini doldurur.
- **Cold start.** İlk sorğu 2-3 saniyə çəkə bilər. `functions.memory` 1024 MB saxlanılıb.
- **Maksimumuzunluk.** 30 saniyəlik `maxDuration` bir 150 suallıq tam viktorina üçün kifayətdir.

### Lokal qurğa ilə əlaqə

Yerli Docker PostgreSQL-i ilə işləməyə davam edir — heç bir dəyişiklik yoxdur. `.env` faylındakı lokal dəyərlər Vercel-in Environment Variables-ından tam müstəqildir.

## Əsas mənbə qaydası

Admin Panel dəyişiklik PostgreSQL-ə yazır. Mobil tətbiq məlumatı React Query ilə API-dən oxuyur və müəyyən TTL/etag strategiyası ilə cache edir. Qiymət, xal, səviyyə, lifeline, reward, kitab və promo qaydaları mobil koda hard-code edilmir.

### Səbət hər sifarişə aid ayrı sətirdir

`Cart.userId` unikal **deyil**: hər sifariş öz səbətini yaradır və `CONVERTED` olur, beləliklə keçmiş səbətlər qalır. Əvvəl `@@unique([userId])` və `Order.cartId @unique` birlikdə **bir istifadəçinin yalnız bir sifariş verə bilməsinə** səbəb olurdu — ikinci sifariş `cartId` unikal xətası ilə 409 atırdı. Canlı səbət ən yeni `ACTIVE` sətirdir (`getOrCreateCart`).

## Yekun yoxlama

| Yoxlama | Nəticə |
|---|---|
| `npm run typecheck` | 0 xəta (mobile, api, admin, packages) |
| `npm run test` | 57/57 keçir (48 API + 9 mobil) |
| `npx expo-doctor` (apps/mobile) | 21/21 keçir |
| `npx expo install --check` | "Dependencies are up to date" |
| `npx expo export --platform android` / `ios` / `web` | hər üçü yığılır |

### Test məlumatlarını təmizləmək

Geliştirici testləri qalıcı sətirlər yaradır. Onları silmək üçün:

```bash
node --import tsx scripts/clean-test-data.ts           # yalnız hesabat
node --import tsx scripts/clean-test-data.ts --apply   # silir
```

Skript `pm…@fegih.az` tipli test istifadəçilərini və `TEST-*` / `DEMO-*` SKU-lu kitablardan məsuliyyət qoparan sətirləri tanıyır. Səviyyə şkalaları, suallar (819), Quran məlumatları (114 surə / 6236 ayə) və real hesablar toxunulmur. Silməkdə əvvəl FK sırasını izlədiyi üçün təkrarlanan uğursuz cəhdlər yoxdur.
