import { describe, expect, it } from 'vitest';

import { toQuranLocale, pickTranslation, QURAN_LOCALES, DEFAULT_QURAN_LOCALE } from '../../lib/locale.js';
import { LEVEL_LADDER, MAX_LEVELS, QUESTIONS_PER_LEVEL, TOTAL_MAX_POINTS, TOTAL_QUESTIONS, levelMaxPoints, pointsForLevel } from './sual-cavab.js';

describe('Sual-Cavab rules', () => {
  it('asks 10 questions per level across 15 levels', () => {
    expect(QUESTIONS_PER_LEVEL).toBe(10);
    expect(MAX_LEVELS).toBe(15);
    expect(TOTAL_QUESTIONS).toBe(150);
  });

  it('makes a correct answer worth the level number', () => {
    expect(pointsForLevel(1)).toBe(1);
    expect(pointsForLevel(2)).toBe(2);
    expect(pointsForLevel(7)).toBe(7);
    expect(pointsForLevel(15)).toBe(15);
  });

  it('clamps nonsense levels instead of producing a negative or huge value', () => {
    expect(pointsForLevel(0)).toBe(1);
    expect(pointsForLevel(-5)).toBe(1);
    expect(pointsForLevel(1.5)).toBe(1);
    expect(pointsForLevel(99)).toBe(MAX_LEVELS);
  });

  it('is worth 10 * N inside level N', () => {
    expect(levelMaxPoints(1)).toBe(10);
    expect(levelMaxPoints(2)).toBe(20);
    expect(levelMaxPoints(15)).toBe(150);
  });

  it('totals 1200 points for a perfect run', () => {
    // 10 * (1 + 2 + ... + 15) = 10 * 120
    expect(TOTAL_MAX_POINTS).toBe(1200);
  });

  it('exposes a strictly ascending ladder of 15 rungs', () => {
    expect(LEVEL_LADDER).toHaveLength(15);
    LEVEL_LADDER.forEach((rung, index) => {
      expect(rung.level).toBe(index + 1);
      expect(rung.pointsPerAnswer).toBe(index + 1);
      expect(rung.maxPoints).toBe((index + 1) * QUESTIONS_PER_LEVEL);
    });
    const scores = LEVEL_LADDER.map((rung) => rung.maxPoints);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });
});

describe('Quran locale negotiation', () => {
  it('defaults to Azerbaijani', () => {
    expect(DEFAULT_QURAN_LOCALE).toBe('az');
    expect(toQuranLocale(undefined)).toBe('az');
    expect(toQuranLocale('')).toBe('az');
    expect(toQuranLocale('de')).toBe('az');
  });

  it('accepts every supported language', () => {
    for (const locale of QURAN_LOCALES) expect(toQuranLocale(locale)).toBe(locale);
  });

  it('reads regional and uppercase tags', () => {
    expect(toQuranLocale('az-AZ')).toBe('az');
    expect(toQuranLocale('TR_tr')).toBe('tr');
    expect(toQuranLocale('EN-US')).toBe('en');
  });

  it('takes the first value when Express hands over an array', () => {
    expect(toQuranLocale(['tr', 'az'])).toBe('tr');
  });
});

describe('Quran translation selection', () => {
  const table = { az: 'Azərbaycanca', tr: 'Türkçe', en: 'English' };

  it('returns the translation for the requested language', () => {
    expect(pickTranslation(table, 'az', 'fb')).toBe('Azərbaycanca');
    expect(pickTranslation(table, 'tr', 'fb')).toBe('Türkçe');
    expect(pickTranslation(table, 'en', 'fb')).toBe('English');
  });

  it('gives Arabic readers the Uthmani original, not an English gloss', () => {
    // The English entry exists, so the Arabic text must win purely on order.
    expect(pickTranslation(table, 'ar', 'fb', 'بِسْمِ اللَّهِ')).toBe('بِسْمِ اللَّهِ');
  });

  it('falls back to English for Arabic when the Arabic text is missing', () => {
    expect(pickTranslation(table, 'ar', 'fb')).toBe('English');
    expect(pickTranslation(table, 'ar', 'fb', '   ')).toBe('English');
    expect(pickTranslation(table, 'ar', 'fb', null)).toBe('English');
  });

  it('falls back to English when the language is missing', () => {
    expect(pickTranslation({ en: 'English' }, 'az', 'fb')).toBe('English');
    expect(pickTranslation({ az: '  ' }, 'az', 'fb')).toBe('fb');
  });

  it('falls back to the stored column when nothing is available', () => {
    expect(pickTranslation({}, 'az', 'fallback')).toBe('fallback');
    expect(pickTranslation(undefined, 'tr', 'fallback')).toBe('fallback');
    expect(pickTranslation(null, 'en', 'fallback')).toBe('fallback');
    expect(pickTranslation('not-an-object', 'en', 'fallback')).toBe('fallback');
  });

  it('uses the Arabic text as a last resort for other languages', () => {
    expect(pickTranslation({}, 'az', 'fallback', 'بسم')).toBe('بسم');
  });
});
