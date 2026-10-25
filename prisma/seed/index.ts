import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { parseQuestionImport } from '../question-import-parser';

const prisma = new PrismaClient();
const root = resolve(process.cwd());
const sourceDirectory = resolve(root, 'questions/examples');

const levelPoints = [10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 600, 800, 1200, 1800, 3000];
const levelNames = [
  'Çox Asan', 'Asan', 'Asan-Orta', 'Orta', 'Orta-Çətin', 'Çətin', 'Çox Çətin', 'Mütəxəmmis', 'İleri', 'Peşəkar', 'Ustad', 'Məqsəd', 'Mükəmməl', 'Nadir', 'Final',
];

function slug(value: string) { return value.toLocaleLowerCase('az').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 130); }
function fingerprint(value: string) { return createHash('sha256').update(value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('az')).digest('hex'); }

async function seedRolesAndPermissions() {
  const permissions = [
    ['dashboard:read', 'Dashboard oxuma'], ['users:read', 'İstifadəçiləri oxuma'], ['users:write', 'İstifadəçiləri idarə etmək'],
    ['questions:read', 'Sual oxuma'], ['questions:write', 'Sual idarə etmək'], ['books:read', 'Kitab oxuma'], ['books:write', 'Kitab idarə etmək'],
    ['orders:read', 'Sifariş oxuma'], ['orders:write', 'Sifariş idarə etmək'], ['rewards:write', 'Mükafatları idarə etmək'], ['settings:write', 'Sistem ayarlarını idarə etmək'],
  ];
  const rows = new Map<string, string>();
  for (const [key, description] of permissions) rows.set(key, (await prisma.permission.upsert({ where: { key }, update: { description }, create: { key, name: key, description } })).id);
  const definitions = [
    ['USER', 'İstifadəçi', ['dashboard:read']], ['SUPER_ADMIN', 'Super Admin', [...permissions.map(([key]) => key)]], ['ADMIN', 'Admin', [...permissions.map(([key]) => key)]],
    ['EDITOR', 'Editor', ['questions:read', 'questions:write', 'books:read', 'books:write']], ['ORDER_MANAGER', 'Sifariş Meneceri', ['orders:read', 'orders:write']],
    ['QUESTION_MANAGER', 'Sual Meneceri', ['questions:read', 'questions:write']], ['MODERATOR', 'Moderator', ['dashboard:read', 'users:read', 'questions:read']],
  ] as const;
  for (const [name, description, keys] of definitions) {
    const role = await prisma.role.upsert({ where: { name }, update: { description, code: name }, create: { name, code: name, description, isSystem: true } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: keys.map((key) => ({ roleId: role.id, permissionId: rows.get(key)! })) });
  }
}

async function seedSettings() {
  const settings = [
    { key: 'appName', value: 'Fegih', valueType: 'STRING' as const, group: 'general', isPublic: true },
    { key: 'registrationEnabled', value: true, valueType: 'BOOLEAN' as const, group: 'general', isPublic: true },
    { key: 'quizEnabled', value: true, valueType: 'BOOLEAN' as const, group: 'quiz', isPublic: true },
    { key: 'storeEnabled', value: true, valueType: 'BOOLEAN' as const, group: 'store', isPublic: true },
    { key: 'maintenanceMode', value: false, valueType: 'BOOLEAN' as const, group: 'general', isPublic: true },
    { key: 'levelXpStep', value: 1000, valueType: 'INTEGER' as const, group: 'rewards', isPublic: false },
    { key: 'extraTimeSeconds', value: 15, valueType: 'INTEGER' as const, group: 'quiz', isPublic: false },
    { key: 'storeShippingFee', value: 0, valueType: 'DECIMAL' as const, group: 'store', isPublic: true },
    { key: 'welcomeBonus', value: { points: 100, lifelineType: 'FIFTY_FIFTY', lifelineQuantity: 3 }, valueType: 'JSON' as const, group: 'rewards', isPublic: false },
    // "Holding N points earns X% off" — the balance qualifies the tier, it is
    // never spent. Editable from the admin panel (Store settings).
    { key: 'bookPointDiscountTiers', value: [
      { points: 1000, discountPercent: 5, label: 'Bronza', isActive: true },
      { points: 2500, discountPercent: 8, label: 'Gümüş', isActive: true },
      { points: 5000, discountPercent: 12, label: 'Qızıl', isActive: true },
      { points: 10000, discountPercent: 15, label: 'Platin', isActive: true },
      { points: 25000, discountPercent: 20, label: 'Almaz', isActive: true },
      { points: 50000, discountPercent: 25, label: 'Feyz', isActive: true },
    ], valueType: 'JSON' as const, group: 'store', isPublic: true },
  ];
  for (const setting of settings) await prisma.systemSetting.upsert({ where: { key: setting.key }, update: { value: setting.value, valueType: setting.valueType, group: setting.group, isPublic: setting.isPublic }, create: setting });
}

async function seedQuestionConfiguration() {
  for (let index = 0; index < 15; index += 1) {
    const position = index + 1;
    await prisma.questionLevel.upsert({ where: { code: `LEVEL_${String(position).padStart(2, '0')}` }, update: { name: levelNames[index], difficulty: position, defaultPoints: levelPoints[index], position, defaultTimeLimit: Math.min(60, 20 + position), isActive: true }, create: { code: `LEVEL_${String(position).padStart(2, '0')}`, name: levelNames[index], difficulty: position, defaultPoints: levelPoints[index], position, defaultTimeLimit: Math.min(60, 20 + position), isActive: true } });
  }
  const names = ['Quran', 'Hadith', 'Aqidah', 'Fiqh', 'Seerah', 'Tafsir', 'İslam Tarixə', 'Uşaqlar', 'İslam ümumi'];
  for (let index = 0; index < names.length; index += 1) await prisma.questionCategory.upsert({ where: { slug: slug(names[index]!) }, update: { name: names[index], position: index, isActive: true }, create: { name: names[index]!, slug: slug(names[index]!), position: index, isActive: true } });
  await prisma.questionCategory.upsert({ where: { slug: 'islam-umumi' }, update: { name: 'İslam ümumi', isActive: true }, create: { name: 'İslam ümumi', slug: 'islam-umumi', isActive: true } });
  const game = await prisma.quizGame.upsert({ where: { code: 'QUICK-QUIZ' }, update: { name: 'Quick Quiz', isActive: true, status: 'ACTIVE' }, create: { code: 'QUICK-QUIZ', name: 'Quick Quiz', description: 'Database-driven quick quiz', questionCount: 10, status: 'ACTIVE', isActive: true } });
  const categories = await prisma.questionCategory.findMany({ where: { isActive: true } });
  const levels = await prisma.questionLevel.findMany({ where: { isActive: true } });
  await prisma.quizGameCategory.createMany({ data: categories.map((item) => ({ gameId: game.id, categoryId: item.id })), skipDuplicates: true });
  await prisma.quizGameLevel.createMany({ data: levels.map((item) => ({ gameId: game.id, levelId: item.id })), skipDuplicates: true });
  const lifes = [
    ['FIFTY_FIFTY', '50/50', 100], ['SECOND_CHANCE', 'Second Chance', 150], ['SKIP', 'Skip Question', 75], ['EXTRA_TIME', 'Extra Time', 50], ['HINT', 'Hint', 80],
  ] as const;
  for (const [type, name, cost] of lifes) await prisma.gameLifeline.upsert({ where: { gameId_type: { gameId: game.id, type } }, update: { name, cost, isEnabled: true }, create: { gameId: game.id, type, name, cost, isEnabled: true } });
}

async function seedUsers() {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  const userRole = await prisma.role.findUniqueOrThrow({ where: { name: 'USER' } });
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@fegih.az';
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is required. Run npm run dev once to generate .env.');
  const admin = await prisma.user.upsert({ where: { email: adminEmail }, update: { status: 'ACTIVE' }, create: { username: 'admin', displayName: process.env.ADMIN_NAME || 'System Administrator', email: adminEmail, passwordHash: await hash(adminPassword, 12), status: 'ACTIVE', roles: { create: { role: { connect: { id: adminRole.id } } } } } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } }, update: {}, create: { userId: admin.id, roleId: adminRole.id } });
  await prisma.userPreference.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id } });
  const demoPassword = process.env.DEMO_USER_PASSWORD;
  if (demoPassword) {
    const demo = await prisma.user.upsert({ where: { email: process.env.DEMO_USER_EMAIL || 'demo@fegih.az' }, update: { status: 'ACTIVE' }, create: { username: 'demo', displayName: 'Demo User', email: process.env.DEMO_USER_EMAIL || 'demo@fegih.az', passwordHash: await hash(demoPassword, 12), status: 'ACTIVE', roles: { create: { role: { connect: { id: userRole.id } } } } } });
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: demo.id, roleId: userRole.id } }, update: {}, create: { userId: demo.id, roleId: userRole.id } });
    await prisma.userPreference.upsert({ where: { userId: demo.id }, update: {}, create: { userId: demo.id } });
  }
}

async function seedRewards() {
  for (let day = 1; day <= 7; day += 1) {
    const points = [10, 20, 30, 50, 100, 150, 300][day - 1]!;
    await prisma.rewardRule.upsert({ where: { code: `daily-day-${day}` }, update: { name: `${day}-günlük mükafat`, amount: points, event: 'DAILY_LOGIN', isActive: true, conditions: { day, title: `${day}-günlük mükafat`, description: `${day} gün streak`, icon: day === 7 ? '🎁' : '⭐' } }, create: { code: `daily-day-${day}`, name: `${day}-günlük mükafat`, description: `${day} gün streak`, event: 'DAILY_LOGIN', rewardType: 'POINTS', amount: points, conditions: { day, title: `${day}-günlük mükafat`, description: `${day} gün streak`, icon: day === 7 ? '🎁' : '⭐' }, isActive: true } });
  }
  const achievements = [
    ['first-quiz', 'İlk quiz', 'İlk quiz oyununu tamamlayın', 'QUIZ', { metric: 'TOTAL_GAMES', target: 1 }, 50],
    ['ten-correct', '10 düzgün cavab', '10 düzgün cavab verin', 'QUIZ', { metric: 'CORRECT_ANSWERS', target: 10 }, 100],
    ['hundred-correct', '100 düzgün cavab', '100 düzgün cavab verin', 'QUIZ', { metric: 'CORRECT_ANSWERS', target: 100 }, 500],
    ['seven-day-streak', '7 gün streak', '7 gün ard-arda qeydiyyatdan keçin', 'STREAK', { metric: 'STREAK', target: 7 }, 200],
  ] as const;
  for (const [code, name, description, type, condition, pointsReward] of achievements) await prisma.achievement.upsert({ where: { code }, update: { name, description, type, condition, pointsReward, isActive: true }, create: { code, name, description, type, condition, pointsReward, isActive: true } });
  const missions = [
    ['daily-login', 'Günləş login', 'Bu gün tətbiqə daxil olun', 'DAILY', 'LOGIN', 1, 20],
    ['answer-five', '5 sual cavabla', '5 suala cavab verin', 'DAILY', 'QUESTION_ANSWERED', 5, 50],
    ['correct-three', '3 düzgün cavab', '3 düzgün cavab verin', 'DAILY', 'CORRECT_ANSWER', 3, 75],
  ] as const;
  for (const [code, title, description, type, metric, targetCount, pointsReward] of missions) await prisma.mission.upsert({ where: { code }, update: { title, description, type, metric, targetCount, pointsReward, isActive: true }, create: { code, title, description, type, metric, targetCount, pointsReward, isActive: true } });
}

async function seedStoreAndContent() {
  const bookCategories = ['Quran', 'Hadith', 'Fiqh', 'Tərbiyə', 'Uşaqlar'];
  for (let index = 0; index < bookCategories.length; index += 1) await prisma.bookCategory.upsert({ where: { slug: slug(bookCategories[index]!) }, update: { name: bookCategories[index], isActive: true, position: index }, create: { name: bookCategories[index]!, slug: slug(bookCategories[index]!), isActive: true, position: index } });
  const category = await prisma.bookCategory.findUniqueOrThrow({ where: { slug: 'quran' } });
  await prisma.book.upsert({ where: { sku: 'DEMO-QURAN-001' }, update: { title: 'Quran - Demo kitab', isActive: true, stock: 100, price: new Prisma.Decimal(25), compareAtPrice: new Prisma.Decimal(30), deletedAt: null }, create: { sku: 'DEMO-QURAN-001', slug: 'quran-demo-kitab', title: 'Quran - Demo kitab', author: 'Fegih', description: 'Admin paneldən idarə oluna bilən demo kitab.', price: new Prisma.Decimal(25), compareAtPrice: new Prisma.Decimal(30), stock: 100, currency: 'AZN', isActive: true, isFeatured: true, categoryLinks: { create: [{ categoryId: category.id }] } } });
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  // No placeholder `DailyAyah` row: `/daily-ayah` rotates deterministically
  // through the full Quran when a day has no row, and a seeded "1:1" row for
  // today pinned the same opening ayah on every fresh seed. Real per-day
  // ayahs are managed from the admin panel (`POST /admin/daily-ayah`).
  await prisma.dailyAyah.deleteMany({ where: { day: today, reference: '1:1' } });
  await prisma.dailyInfo.upsert({ where: { day: today }, update: {}, create: { day: today, title: 'İslamda öyrənmə', summary: 'Dünya bilik və mənəvi həyat', content: 'İslam bilik və mənəvi həyatı birləşdirir.', isPublished: true, publishedAt: new Date() } });
  for (let index = 0; index < 4; index += 1) await prisma.islamicEvent.upsert({ where: { slug: `ramadan-${index + 1}` }, update: { title: 'Ramadan', isPublished: true }, create: { slug: `ramadan-${index + 1}`, title: 'Ramadan', description: 'Ramadan bayramı ilə bağlı təqvim hadisəsi', startsAt: new Date(Date.UTC(2026, 2, 20 + index * 365)), allDay: true, isPublished: true } });
  const preset = await prisma.tasbeehPreset.upsert({ where: { slug: 'subhanallah' }, update: { name: 'SubhanAllah', defaultTarget: 33 }, create: { slug: 'subhanallah', name: 'SubhanAllah', defaultTarget: 33, isSystem: true } });
  await prisma.tasbeehPreset.upsert({ where: { slug: 'alhamdulillah' }, update: { name: 'Alhamdulillah', defaultTarget: 33 }, create: { slug: 'alhamdulillah', name: 'Alhamdulillah', defaultTarget: 33, isSystem: true } });
  void preset;
}

async function importQuestions() {
  let files: string[];
  try { files = (await readdir(sourceDirectory)).filter((file) => /^level\d+\.json$/i.test(file)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0])); } catch { return; }
  const category = await prisma.questionCategory.findUniqueOrThrow({ where: { slug: 'islam-umumi' } });
  for (const file of files) {
    const levelNumber = Number(file.match(/\d+/)![0]);
    const level = await prisma.questionLevel.findUniqueOrThrow({ where: { code: `LEVEL_${String(levelNumber).padStart(2, '0')}` } });
    const parsed = parseQuestionImport(JSON.parse((await readFile(resolve(sourceDirectory, file), 'utf8')).replace(/^\uFEFF/, '')), 'İslam ümumi', levelNumber);
    if (!parsed.valid) console.warn(`[seed] ${file}: ${parsed.issues.length} invalid row(s) skipped: ${JSON.stringify(parsed.issues.slice(0, 3))}`);
    for (const item of parsed.questions) {
      const code = `import:${item.fingerprint}`;
      if (await prisma.question.findUnique({ where: { code }, select: { id: true } })) continue;
      const source = await prisma.sourceReference.upsert({ where: { source_externalId: { source: 'REPO_JSON', externalId: `${levelNumber}-${item.sourceId ?? item.fingerprint.slice(0, 12)}` } }, update: { checksum: item.fingerprint }, create: { source: 'REPO_JSON', externalId: `${levelNumber}-${item.sourceId ?? item.fingerprint.slice(0, 12)}`, checksum: item.fingerprint } });
      const answers = [...item.answers];
      const correct = answers.splice(answers.findIndex((answer) => answer.isCorrect), 1)[0]!;
      const position = Number.parseInt(item.fingerprint.slice(0, 8), 16) % answers.length;
      answers.splice(position, 0, correct);
      await prisma.question.create({ data: { code, text: item.question, explanation: item.explanation, categoryId: category.id, levelId: level.id, points: item.points ?? level.defaultPoints, status: 'ACTIVE', isApproved: true, sourceReferenceId: source.id, answers: { create: answers.map((answer, index) => ({ text: answer.text, isCorrect: answer.isCorrect, position: index })) } } });
    }
  }
}

async function importQuran() {
  const quranPath = resolve(root, 'prisma/data/quran.json');
  let payload: { surahs?: Array<{ number: number; name: string; englishName: string; englishNameTranslation: string; revelationType: string; ayahs: Array<{ number: number; text: string; translation: string; translations?: Record<string, string>; juz: number; page: number; sajda: boolean }> }> };
  try { payload = JSON.parse(await readFile(quranPath, 'utf8')); } catch { console.warn('[seed] quran.json not found; skipping Quran import'); return; }
  const surahs = payload.surahs ?? [];
  if (!surahs.length) return;
  for (const surah of surahs) {
    await prisma.quranSurah.upsert({ where: { number: surah.number }, update: { name: surah.name, englishName: surah.englishName, englishNameTranslation: surah.englishNameTranslation, revelationType: surah.revelationType, ayahCount: surah.ayahs.length }, create: { number: surah.number, name: surah.name, englishName: surah.englishName, englishNameTranslation: surah.englishNameTranslation, revelationType: surah.revelationType, ayahCount: surah.ayahs.length } });
  }
  // `translations` carries the per-language texts (az = Əlikhan Musayev,
  // tr = Yasar Nuri Öztürk, en = Mohammad Asad) so the app can show ayahs in
  // whichever language the user picked in Settings.
  const ayahs = surahs.flatMap((surah) => surah.ayahs.map((ayah) => ({ surahNumber: surah.number, ayahNumber: ayah.number, arabicText: ayah.text.replace(/^\uFEFF/, ''), translationText: ayah.translation, translations: (ayah.translations ?? {}) as Prisma.InputJsonValue, juz: ayah.juz, page: ayah.page, isSajda: ayah.sajda })));
  for (let index = 0; index < ayahs.length; index += 1000) await prisma.quranAyah.createMany({ data: ayahs.slice(index, index + 1000), skipDuplicates: true });
  // `createMany` skips rows that already exist, so re-seeding an existing
  // database would leave the translations empty. Upsert the blobs in one
  // set-based UPDATE instead.
  const withTranslations = ayahs.filter((ayah) => Object.keys(ayah.translations as object).length > 0).length;
  if (withTranslations) {
    await prisma.$executeRaw`
      UPDATE "QuranAyah" AS a
      SET "translations" = v."translations"
      FROM jsonb_to_recordset(${JSON.stringify(ayahs.map((ayah) => ({ surahNumber: ayah.surahNumber, ayahNumber: ayah.ayahNumber, translations: ayah.translations })))}::jsonb)
        AS v("surahNumber" int, "ayahNumber" int, "translations" jsonb)
      WHERE a."surahNumber" = v."surahNumber" AND a."ayahNumber" = v."ayahNumber"
    `;
  }
  const languages = [...new Set(ayahs.flatMap((ayah) => Object.keys(ayah.translations as object)))].sort();
  console.log(`[seed] Quran ready: ${surahs.length} surahs / ${ayahs.length} ayahs (translations: ${languages.join(', ') || 'none'})`);
}

async function main() {
  await seedRolesAndPermissions();
  await seedSettings();
  await seedQuestionConfiguration();
  await seedUsers();
  await seedRewards();
  await seedStoreAndContent();
  await importQuestions();
  await importQuran();
  console.log('[seed] completed');
}

main().catch((error) => { console.error('[seed] failed', error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
