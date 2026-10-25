/**
 * Locale negotiation for public content (Quran translations, surah names).
 *
 * The app sends the language the user picked in Settings; anything unknown
 * falls back to English so a bad value can never break a response.
 */

export const QURAN_LOCALES = ['az', 'tr', 'en', 'ar'] as const;
export type QuranLocale = (typeof QURAN_LOCALES)[number];

/** Which translation each app language reads. Arabic is the original text. */
const TRANSLATION_FOR: Record<QuranLocale, string | null> = {
  az: 'az', // Əlikhan Musayev
  tr: 'tr', // Yasar Nuri Öztürk
  en: 'en', // Mohammad Asad
  ar: null, // the Uthmani text is already the "translation" for Arabic
};

export const DEFAULT_QURAN_LOCALE: QuranLocale = 'az';

export function toQuranLocale(value: unknown): QuranLocale {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return (QURAN_LOCALES as readonly string[]).includes(normalized ?? '') ? (normalized as QuranLocale) : DEFAULT_QURAN_LOCALE;
}

/**
 * Picks the reading for `locale` out of a `QuranAyah.translations` blob.
 *
 * Arabic readers get the Uthmani original, then English as a last resort, then
 * the stored fallback column.
 */
export function pickTranslation(
  translations: unknown,
  locale: QuranLocale,
  fallback: string,
  arabic?: string | null,
): string {
  const table = translations && typeof translations === 'object' && !Array.isArray(translations)
    ? (translations as Record<string, unknown>)
    : {};
  const usable = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

  // Arabic readers want the Uthmani original. It has to be checked *before* the
  // table, otherwise the English entry is found first and an English gloss ends
  // up under the Arabic script.
  if (locale === 'ar' && usable(arabic)) return arabic;

  const preferred = TRANSLATION_FOR[locale];
  for (const key of [preferred, 'en'].filter((key): key is string => !!key)) {
    if (usable(table[key])) return table[key] as string;
  }
  if (usable(arabic)) return arabic;
  return fallback;
}
