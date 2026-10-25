import { Router, type Response } from 'express';
import { Prisma } from '../../config/prisma-client.js';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { QURAN_LOCALES, DEFAULT_QURAN_LOCALE, pickTranslation, toQuranLocale } from '../../lib/locale.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';

const router = Router();

const localeQuery = z.object({ locale: z.string().trim().max(10).optional() });

function setPublicCache(response: Response, value = 'public, max-age=86400, stale-while-revalidate=604800') {
  response.setHeader('Cache-Control', value);
}

/**
 * The rendered text depends on `locale`, so a shared public cache would hand an
 * Azerbaijani response to an English client. Keying on the language keeps the
 * CDN/browser cache correct without dropping caching entirely.
 */
function setLocaleCache(response: Response, locale: string) {
  setPublicCache(response);
  response.vary('Accept-Language');
  response.setHeader('x-quran-locale', locale);
}

router.get('/locales', (_request, response) => {
  setPublicCache(response);
  response.json({ data: { locales: QURAN_LOCALES, default: DEFAULT_QURAN_LOCALE } });
});

router.get('/surahs', async (request, response) => {
  setPublicCache(response);
  const { search } = parse(z.object({ search: z.string().trim().max(100).optional() }), request.query);
  const surahs = await prisma.quranSurah.findMany({
    where: search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { englishName: { contains: search, mode: 'insensitive' } }, { englishNameTranslation: { contains: search, mode: 'insensitive' } }] } : undefined,
    orderBy: { number: 'asc' },
    select: { number: true, name: true, englishName: true, englishNameTranslation: true, revelationType: true, ayahCount: true },
  });
  response.json({ data: surahs.map((surah) => ({ ...surah, ayahCount: surah.ayahCount, surahNumber: surah.number })) });
});

router.get('/daily', async (request, response) => {
  setPublicCache(response, 'public, max-age=3600, stale-while-revalidate=86400');
  const { locale } = parse(localeQuery, request.query);
  const language = toQuranLocale(locale);
  setLocaleCache(response, language);
  const total = await prisma.quranAyah.count();
  if (!total) return response.json({ data: null });
  const now = new Date();
  const dayNumber = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
  const ayah = await prisma.quranAyah.findFirst({ orderBy: [{ surahNumber: 'asc' }, { ayahNumber: 'asc' }], skip: ((dayNumber % total) + total) % total, include: { surah: { select: { number: true, name: true, englishName: true, englishNameTranslation: true } } } });
  if (!ayah) return response.json({ data: null });
  const text = pickTranslation(ayah.translations, language, ayah.translationText, ayah.arabicText);
  response.json({ data: { id: ayah.id, surahNumber: ayah.surahNumber, ayahNumber: ayah.ayahNumber, reference: `${ayah.surahNumber}:${ayah.ayahNumber}`, arabic: ayah.arabicText, arabicText: ayah.arabicText, translation: text, translationText: text, locale: language, surah: ayah.surah.name, surahName: ayah.surah.englishName, englishName: ayah.surah.englishName, englishNameTranslation: ayah.surah.englishNameTranslation, juz: ayah.juz, page: ayah.page, isSajda: ayah.isSajda } });
});

router.get('/search', async (request, response) => {
  setPublicCache(response, 'public, max-age=300, stale-while-revalidate=3600');
  const { q, limit, locale } = parse(z.object({ q: z.string().trim().min(2).max(100), limit: z.coerce.number().int().min(1).max(50).default(30), locale: z.string().trim().max(10).optional() }), request.query);
  const language = toQuranLocale(locale);
  setLocaleCache(response, language);
  /**
   * Matching has to cover the requested language. Prisma cannot filter inside a
   * JSON text field, and searching only the English column meant an Azerbaijani
   * reader searching "günəş" or "şəfəq" got nothing at all, because those words
   * appear only in Musayev's translation. A raw query reaches the JSONB.
   */
  const pattern = `%${q}%`;
  /**
   * The Uthmani text is fully vocalised (ٱللَّهِ), so a plain "الله" never
   * matches it. The term is folded by Postgres with the *same* expression used
   * on the column — folding in JS and in SQL separately let the two sides drift
   * apart and ended up matching every row.
   *
   * Every pattern is a bind parameter, so nothing from the request is ever
   * interpolated into the SQL text.
   */
  const HARAKAT = '[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]';
  const ALEF = '[أإآ]';
  const fold = (expr: Prisma.Sql) => Prisma.sql`
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(replace(${expr}, 'ٱ', 'ا'), ${ALEF}, 'ا', 'g'),
            '[ى]', 'ي', 'g'),
          '[ة]', 'ه', 'g'),
        ${HARAKAT}, '', 'g'),
      '[ ]+', ' ', 'g')`;
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    surahNumber: number;
    ayahNumber: number;
    arabicText: string;
    translationText: string;
    translations: unknown;
    surahName: string;
    englishName: string;
  }>>`
    SELECT a."id", a."surahNumber", a."ayahNumber", a."arabicText", a."translationText", a."translations",
           s."name" AS "surahName", s."englishName"
    FROM "QuranAyah" a
    JOIN "QuranSurah" s ON s."number" = a."surahNumber"
    WHERE a."arabicText" ILIKE ${pattern}
       OR a."translationText" ILIKE ${pattern}
       OR COALESCE(a."translations" ->> ${language}, '') ILIKE ${pattern}
       ${language === 'ar' ? Prisma.sql`OR position(${fold(Prisma.sql`${q}`)} in ${fold(Prisma.sql`a."arabicText"`)}) > 0` : Prisma.empty}
    ORDER BY a."surahNumber" ASC, a."ayahNumber" ASC
    LIMIT ${limit}
  `;
  response.json({
    data: rows.map((row) => ({
      id: row.id,
      surahNumber: row.surahNumber,
      ayahNumber: row.ayahNumber,
      reference: `${row.surahNumber}:${row.ayahNumber}`,
      arabic: row.arabicText,
      translation: pickTranslation(row.translations, language, row.translationText, row.arabicText),
      locale: language,
      surah: row.surahName,
      englishName: row.englishName,
    })),
  });
});

router.get('/surahs/:surahNumber', async (request, response) => {
  const number = z.coerce.number().int().min(1).max(114).parse(request.params.surahNumber);
  const { page, limit, skip } = getPagination(request);
  const { locale } = parse(localeQuery, request.query);
  const language = toQuranLocale(locale);
  setLocaleCache(response, language);
  const surah = await prisma.quranSurah.findUnique({ where: { number }, select: { number: true, name: true, englishName: true, englishNameTranslation: true, revelationType: true, ayahCount: true } });
  if (!surah) throw ApiError.notFound('Surah not found');
  const ayahs = await prisma.quranAyah.findMany({ where: { surahNumber: number }, orderBy: { ayahNumber: 'asc' }, skip, take: limit, select: { id: true, ayahNumber: true, arabicText: true, translationText: true, translations: true, juz: true, page: true, isSajda: true } });
  response.json({
    data: {
      ...surah,
      surahNumber: surah.number,
      locale: language,
      ayahs: ayahs.map((ayah) => {
        const text = pickTranslation(ayah.translations, language, ayah.translationText, ayah.arabicText);
        return { ...ayah, number: ayah.ayahNumber, arabic: ayah.arabicText, translation: text };
      }),
    },
    meta: paginationMeta(page, limit, surah.ayahCount),
  });
});

router.get('/surahs/:surahNumber/ayahs/:ayahNumber', async (request, response) => {
  const surahNumber = z.coerce.number().int().min(1).max(114).parse(request.params.surahNumber);
  const ayahNumber = z.coerce.number().int().min(1).parse(request.params.ayahNumber);
  const { locale } = parse(localeQuery, request.query);
  const language = toQuranLocale(locale);
  setLocaleCache(response, language);
  const ayah = await prisma.quranAyah.findUnique({ where: { surahNumber_ayahNumber: { surahNumber, ayahNumber } }, include: { surah: { select: { number: true, name: true, englishName: true, englishNameTranslation: true, revelationType: true } } } });
  if (!ayah) throw ApiError.notFound('Ayah not found');
  const text = pickTranslation(ayah.translations, language, ayah.translationText, ayah.arabicText);
  response.json({ data: { id: ayah.id, surahNumber, ayahNumber, reference: `${surahNumber}:${ayahNumber}`, arabic: ayah.arabicText, arabicText: ayah.arabicText, translation: text, translationText: text, locale: language, surah: ayah.surah, juz: ayah.juz, page: ayah.page, isSajda: ayah.isSajda } });
});

export const quranRouter = router;
