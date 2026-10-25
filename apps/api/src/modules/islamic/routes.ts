import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { pickTranslation, toQuranLocale } from '../../lib/locale.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { formatHijri, hijriMonthDays, hijriMonthName, holidaysForGregorianYear, toGregorianIso, toHijri } from '../../lib/hijri.js';
import { ARTICLES, ARTICLES_BY_SLUG } from '../../data/islamic-articles.js';
import { HADITHS } from '../../data/hadiths.js';

const dateQuery = z.string().date().optional();
const PRAYER_CACHE_TTL_MS = 10 * 60_000;
const PRAYER_CACHE_MAX_ENTRIES = 2_000;
const prayerCache = new Map<string, { expiresAt: number; data: unknown }>();
function utcDay(value?: string) { const date = value ? new Date(`${value}T00:00:00.000Z`) : new Date(); date.setUTCHours(0, 0, 0, 0); return date; }
function readPrayerCache(key: string) {
  const entry = prayerCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) { prayerCache.delete(key); return undefined; }
  // Refresh LRU position so the oldest insert is the one evicted.
  prayerCache.delete(key);
  prayerCache.set(key, entry);
  return entry.data;
}
function writePrayerCache(key: string, data: unknown) {
  if (prayerCache.size >= PRAYER_CACHE_MAX_ENTRIES) {
    const oldest = prayerCache.keys().next().value;
    if (oldest !== undefined) prayerCache.delete(oldest);
  }
  prayerCache.set(key, { expiresAt: Date.now() + PRAYER_CACHE_TTL_MS, data });
}

export const islamicRouter = Router();
islamicRouter.get('/daily-ayah', async (request, response) => {
  const { date, locale } = parse(z.object({ date: dateQuery, locale: z.string().trim().max(10).optional() }), request.query);
  const language = toQuranLocale(locale);
  const day = utcDay(date);
  const iso = toGregorianIso(day);
  response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  const ayah = await prisma.dailyAyah.findFirst({ where: { day }, orderBy: { createdAt: 'desc' } });
  if (ayah) {
    // Curated rows only ever hold the English text, so `pickTranslation` simply
    // falls back to it; the column is still the source of truth.
    const text = pickTranslation(undefined, language, ayah.translationText);
    const { translationText, ...rest } = ayah;
    response.json({ data: { ...rest, locale: language, date: ayah.day, arabic: ayah.arabicText, text, ayah: ayah.arabicText, surah: ayah.reference.split(':')[0], translation: text } });
    return;
  }
  // No curated row for today: rotate deterministically through the full Quran
  // so the ayah is always different and never repeats inside one cycle. This is
  // checked *before* reusing the last curated row, which previously showed the
  // same ayah every single day.
  const total = await prisma.quranAyah.count();
  if (!total) {
    response.json({ data: null });
    return;
  }
  const dayNumber = Math.floor(day.getTime() / 86_400_000);
  const ayahFromQuran = await prisma.quranAyah.findFirst({ orderBy: [{ surahNumber: 'asc' }, { ayahNumber: 'asc' }], skip: ((dayNumber % total) + total) % total, include: { surah: { select: { number: true, name: true, englishName: true, englishNameTranslation: true } } } });
  if (!ayahFromQuran) {
    response.json({ data: null });
    return;
  }
  const text = pickTranslation(ayahFromQuran.translations, language, ayahFromQuran.translationText, ayahFromQuran.arabicText);
  response.json({ data: { date: iso, locale: language, surahNumber: ayahFromQuran.surahNumber, ayahNumber: ayahFromQuran.ayahNumber, reference: `${ayahFromQuran.surahNumber}:${ayahFromQuran.ayahNumber}`, arabic: ayahFromQuran.arabicText, arabicText: ayahFromQuran.arabicText, text, ayah: ayahFromQuran.arabicText, translation: text, translationText: text, surah: String(ayahFromQuran.surahNumber), surahName: ayahFromQuran.surah.name, englishName: ayahFromQuran.surah.englishName, englishNameTranslation: ayahFromQuran.surah.englishNameTranslation, juz: ayahFromQuran.juz, page: ayahFromQuran.page, isSajda: ayahFromQuran.isSajda } });
});
islamicRouter.get('/daily-ayah/archive', async (request, response) => {
  const { page, limit, skip } = getPagination(request);
  const [data, total] = await prisma.$transaction([prisma.dailyAyah.findMany({ orderBy: { day: 'desc' }, skip, take: limit }), prisma.dailyAyah.count()]);
  response.json({ data, meta: paginationMeta(page, limit, total) });
});
/**
 * The knowledge library. `/info` is a single "today" entry; this is the
 * browsable set of articles, each with a category for the filter chips.
 */
islamicRouter.get('/info/library', (_request, response) => {
  response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  const categories = [...new Set(ARTICLES.map((article) => article.category))];
  response.json({
    data: ARTICLES.map((article) => ({ ...article, id: article.slug, content: article.content.replace(/\n/g, '\n') })),
    meta: { total: ARTICLES.length, categories },
  });
});

islamicRouter.get('/info/library/:slug', (request, response) => {
  response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  const article = ARTICLES_BY_SLUG.get(z.string().min(1).max(160).parse(request.params.slug));
  if (!article) throw ApiError.notFound('Article not found');
  response.json({ data: { ...article, id: article.slug } });
});

/** Hadith collection with topic filter. `takhrij` is the verifiable citation. */
islamicRouter.get('/hadiths', (request, response) => {
  const query = parse(z.object({ topic: z.enum(['iman', 'namaz', 'zakat', 'ahlak', 'elm', 'quran', 'dua', 'peygamber']).optional(), limit: z.coerce.number().int().min(1).max(50).default(50) }), request.query);
  const list = query.topic ? HADITHS.filter((hadith) => hadith.topic === query.topic) : HADITHS;
  response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  response.json({ data: list.slice(0, query.limit), meta: { total: list.length, topics: [...new Set(HADITHS.map((hadith) => hadith.topic))] } });
});

islamicRouter.get('/hadiths/random', (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const hadith = HADITHS[Math.floor(Math.random() * HADITHS.length)]!;
  response.json({ data: hadith });
});

islamicRouter.get(['/info', '/islamic-info'], async (request, response) => {
  const day = utcDay(parse(z.object({ date: dateQuery }), request.query).date);
  response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  const info = await prisma.dailyInfo.findFirst({ where: { day, isPublished: true }, orderBy: { publishedAt: 'desc' } }) ?? await prisma.dailyInfo.findFirst({ where: { day: { lte: day }, isPublished: true }, orderBy: { day: 'desc' } });
  response.json({ data: info ? { ...info, date: info.day, description: info.summary ?? info.content, image: info.imageUrl } : null });
});
islamicRouter.get('/calendar', async (request, response) => {
  const query = parse(z.object({ from: dateQuery, to: dateQuery }), request.query);
  const from = utcDay(query.from);
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date(from.getTime() + 366 * 86_400_000);
  // `startsAt >= from` was missing, so any open-ended event came back in every
  // requested window.
  const data = await prisma.islamicEvent.findMany({ where: { isPublished: true, startsAt: { gte: from, lte: to }, OR: [{ endsAt: null }, { endsAt: { gte: from } }] }, orderBy: { startsAt: 'asc' }, take: 200 });
  response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  response.json({ data: data.map((item) => ({ ...item, date: item.startsAt, day: item.startsAt.toISOString().slice(0, 10), hijri: item.hijriDate ?? formatHijri(new Date(item.startsAt)), gregorian: item.startsAt.toISOString().slice(0, 10), isToday: toGregorianIso(new Date(item.startsAt)) === toGregorianIso(new Date()) })) });
});

/**
 * Full Hijri month grid with the named occasions for each day, so the mobile
 * calendar renders one request per month instead of a flat event list.
 */
islamicRouter.get('/calendar/month', async (request, response) => {
  const query = parse(z.object({ year: z.coerce.number().int().min(1400).max(1600).optional(), month: z.coerce.number().int().min(1).max(12).optional(), lang: z.enum(['az', 'tr', 'en', 'ar']).default('az') }), request.query);
  const today = new Date();
  const todayIso = toGregorianIso(today);
  const current = toHijri(today);
  const hijriYear = query.year ?? current.year;
  const hijriMonth = query.month ?? current.month;
  const days = hijriMonthDays(hijriYear, hijriMonth, todayIso);
  const windowStart = new Date(`${days[0]?.gregorian ?? todayIso}T00:00:00.000Z`);
  const windowEnd = new Date(`${days[days.length - 1]?.gregorian ?? todayIso}T23:59:59.999Z`);
  const events = await prisma.islamicEvent.findMany({ where: { isPublished: true, startsAt: { gte: windowStart, lte: windowEnd } }, orderBy: { startsAt: 'asc' }, take: 100 });
  const eventsByDay = new Map<string, string[]>();
  for (const event of events) {
    const key = toGregorianIso(new Date(event.startsAt));
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event.title]);
  }
  response.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
  response.json({ data: { hijriYear, hijriMonth, monthName: hijriMonthName(hijriMonth), currentHijri: current, days: days.map((day) => ({ ...day, weekday: new Date(`${day.gregorian}T00:00:00.000Z`).getUTCDay(), events: eventsByDay.get(day.gregorian) ?? [] })) } });
});

/** Upcoming Ramadan / Eid dates so the calendar can show what is next. */
islamicRouter.get('/calendar/upcoming', async (_request, response) => {
  const today = new Date();
  const upcoming: Array<{ key: string; hijriDate: string; gregorian: string; title: string; daysAway: number }> = [];
  for (const year of [today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
    for (const [iso, markers] of Object.entries(holidaysForGregorianYear(year))) {
      for (const marker of markers) {
        const date = new Date(`${iso}T00:00:00.000Z`);
        const daysAway = Math.round((date.getTime() - today.getTime()) / 86_400_000);
        if (daysAway < -2) continue;
        upcoming.push({ key: marker.key, hijriDate: formatHijri(date), gregorian: iso, title: marker.names.az, daysAway });
      }
    }
  }
  upcoming.sort((a, b) => a.daysAway - b.daysAway);
  response.setHeader('Cache-Control', 'public, max-age=3600');
  response.json({ data: upcoming.slice(0, 8) });
});
islamicRouter.get('/prayer-times', async (request, response) => {
  // Aladhan method numbers: the Prisma enum default (MWL) is 3; 2 is ISNA.
  const query = parse(z.object({ latitude: z.coerce.number().min(-90).max(90), longitude: z.coerce.number().min(-180).max(180), method: z.coerce.number().int().min(1).max(20).default(3), date: dateQuery }), request.query);
  const day = query.date ?? new Date().toISOString().slice(0, 10);
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  if (!year || !month || !dayOfMonth) throw ApiError.badRequest('Tarix YYYY-MM-YYYY formatında olmalıdır');

  // Aladhan's `/v1/timings` endpoint silently ignores the `date` parameter in
  // every format and always answers with *today*, which made the day picker
  // return identical times for every date. The calendar endpoint is the only
  // one that honours dates, so the whole month is fetched once and the wanted
  // day is picked out of it.
  const url = new URL(`${env.ALADHAN_API_URL}/calendar/${year}/${month}`);
  url.searchParams.set('latitude', String(query.latitude));
  url.searchParams.set('longitude', String(query.longitude));
  url.searchParams.set('method', String(query.method));

  const wanted = `${String(dayOfMonth).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
  const key = `${query.latitude.toFixed(4)}:${query.longitude.toFixed(4)}:${query.method}:${year}-${String(month).padStart(2, '0')}`;
  const cached = readPrayerCache(key);
  // The cache holds the whole month, so each additional day of it is free.
  const month_ = cached as CalendarMonth | undefined;
  if (month_) {
    const hit = month_.find((item) => item.date?.gregorian?.date === wanted);
    if (hit) { response.setHeader('x-cache', 'HIT'); response.setHeader('Cache-Control', 'public, max-age=300'); response.json({ data: normalizePrayerDay(hit, day) }); return; }
  }

  let provider: Response;
  try {
    provider = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ApiError(502, 'PRAYER_PROVIDER_ERROR', 'Namaz vaxtları xidməti hazır deyil');
  }
  if (!provider.ok) throw new ApiError(502, 'PRAYER_PROVIDER_ERROR', 'Namaz vaxtları xidməti hazır deyil');
  const payload = await provider.json() as { code: number; data: unknown };
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new ApiError(502, 'PRAYER_PROVIDER_ERROR', 'Namaz vaxtları xidməti etibarsız cavab qaytardı');
  const monthData = payload.data as CalendarMonth;
  const entry = monthData.find((item) => item.date?.gregorian?.date === wanted);
  if (!entry) throw ApiError.badRequest('Bu gün üçün namaz vaxtı tapılmadı');
  writePrayerCache(key, monthData);
  response.setHeader('x-cache', 'MISS');
  response.setHeader('Cache-Control', 'public, max-age=300');
  response.json({ data: normalizePrayerDay(entry, day) });
});

/**
 * One day as returned by Aladhan's calendar endpoint. `date` is a nested
 * object in the provider payload, which the mobile screen used to render
 * directly and crash on ("Objects are not valid as a React child").
 */
type CalendarMonth = Array<{
  timings?: Record<string, string>;
  date?: { readable?: string; gregorian?: { date?: string; weekday?: { en?: string } }; hijri?: { date?: string } };
  meta?: Record<string, unknown>;
}>;

function normalizePrayerDay(entry: CalendarMonth[number], day: string) {
  const timings = entry.timings ?? {};
  return {
    date: day,
    dateLabel: entry.date?.readable ?? day,
    weekday: entry.date?.gregorian?.weekday?.en,
    hijriDate: entry.date?.hijri?.date,
    timezone: entry.meta?.timezone,
    fajr: timings.Fajr, sunrise: timings.Sunrise, dhuhr: timings.Dhuhr, asr: timings.Asr, maghrib: timings.Maghrib, isha: timings.Isha,
    // Upper-case aliases kept for older clients.
    Fajr: timings.Fajr, Sunrise: timings.Sunrise, Dhuhr: timings.Dhuhr, Asr: timings.Asr, Maghrib: timings.Maghrib, Isha: timings.Isha,
  };
}

islamicRouter.get('/prayer-settings', requireAuth, async (request, response) => response.json({ data: await prisma.prayerSettings.findUnique({ where: { userId: request.user!.id } }) }));
islamicRouter.post('/prayer-settings', requireAuth, writeLimiter, async (request, response) => {
  const input = parse(z.object({ isEnabled: z.boolean().default(true), calculationMethod: z.enum(['MWL', 'ISNA', 'EGYPT', 'MAKKAH', 'KARACHI', 'TEHRAN', 'JAFAR', 'TURKEY', 'RUSSIA', 'MOONSIGHTING_COMMITTEE', 'OTHER']).default('MWL'), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), timezone: z.string().default('Asia/Baku'), asrMadhab: z.enum(['HANAFI', 'MALIKI', 'SHAFII', 'HANBALI']).default('HANAFI'), notificationsEnabled: z.boolean().default(true) }), request.body);
  const setting = await prisma.prayerSettings.upsert({ where: { userId: request.user!.id }, update: input, create: { userId: request.user!.id, ...input } });
  response.status(201).json({ data: setting });
});

export const tasbeehRouter = Router();
tasbeehRouter.use(requireAuth);
tasbeehRouter.get('/sessions', async (request, response) => {
  const { page, limit, skip } = getPagination(request);
  const where = { userId: request.user!.id };
  const [data, total] = await prisma.$transaction([prisma.tasbeehSession.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: limit, include: { _count: { select: { entries: true } } } }), prisma.tasbeehSession.count({ where })]);
  response.json({ data: data.map((item) => ({ ...item, completed: item.status === 'COMPLETED' })), meta: paginationMeta(page, limit, total) });
});
tasbeehRouter.post('/sessions', writeLimiter, async (request, response) => {
  const input = parse(z.object({ name: z.string().trim().min(1).max(120).optional(), target: z.number().int().min(1).max(100_000).default(33), targetCount: z.number().int().min(1).max(100_000).optional() }), request.body);
  const target = input.targetCount ?? input.target;
  const session = await prisma.tasbeehSession.create({ data: { userId: request.user!.id, name: input.name ?? 'Təsbih', targetCount: target } });
  response.status(201).json({ data: session });
});
tasbeehRouter.post('/counts', writeLimiter, async (request, response) => {
  const input = parse(z.object({ sessionId: z.string().cuid(), count: z.number().int().min(1).max(100).default(1) }), request.body);
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.tasbeehSession.findFirst({ where: { id: input.sessionId, userId: request.user!.id } });
    if (!session) throw ApiError.notFound('Tasbeeh session not found');
    if (session.status !== 'ACTIVE') throw ApiError.conflict('Tasbeeh session is completed');
    // Clamp to the target instead of failing: an over-tap should complete the
    // session, not return a 400 the user cannot act on.
    const current = Math.min(session.currentCount + input.count, session.targetCount);
    if (current === session.currentCount) return { ...session, completed: false };
    await tx.tasbeehEntry.create({ data: { sessionId: session.id, count: current } });
    const updated = await tx.tasbeehSession.update({ where: { id: session.id }, data: { currentCount: current, totalCount: { increment: current - session.currentCount }, lastCountedAt: new Date(), ...(current >= session.targetCount ? { status: 'COMPLETED', completedAt: new Date() } : {}) } });
    return updated;
  });
  response.status(201).json({ data: { ...result, completed: result.status === 'COMPLETED' } });
});
tasbeehRouter.post('/sessions/:sessionId/reset', writeLimiter, async (request, response) => {
  const sessionId = z.string().cuid().parse(request.params.sessionId);
  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.tasbeehSession.findFirst({ where: { id: sessionId, userId: request.user!.id } });
    if (!session) throw ApiError.notFound('Tasbeeh session not found');
    await tx.tasbeehEntry.deleteMany({ where: { sessionId } });
    return tx.tasbeehSession.update({ where: { id: sessionId }, data: { currentCount: 0, status: 'ACTIVE', completedAt: null, lastCountedAt: null } });
  });
  response.json({ data: { ...result, completed: false } });
});
tasbeehRouter.delete('/sessions/:sessionId', writeLimiter, async (request, response) => { await prisma.tasbeehSession.deleteMany({ where: { id: z.string().cuid().parse(request.params.sessionId), userId: request.user!.id } }); response.status(204).send(); });
