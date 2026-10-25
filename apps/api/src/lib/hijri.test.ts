import { describe, expect, it } from 'vitest';

import { formatHijri, hijriMonthDays, holidaysForGregorianYear, toGregorianIso, toHijri } from './hijri.js';

describe('hijri conversion', () => {
  it('converts today to a plausible Umm al-Qura date', () => {
    const today = toHijri(new Date());
    expect(today.year).toBeGreaterThan(1440);
    expect(today.month).toBeGreaterThanOrEqual(1);
    expect(today.month).toBeLessThanOrEqual(12);
    expect(today.day).toBeGreaterThanOrEqual(1);
    expect(today.day).toBeLessThanOrEqual(30);
  });

  it('is stable for the same UTC day regardless of time of day', () => {
    const morning = toHijri(new Date('2026-09-27T00:30:00Z'));
    const evening = toHijri(new Date('2026-09-27T23:45:00Z'));
    expect(evening).toEqual(morning);
  });

  it('formats a Hijri date with the localized month name', () => {
    expect(formatHijri(new Date('2026-09-12T00:00:00Z'), 'az')).toBe('1 Rəbiülənir 1448');
  });
});

describe('named Islamic days', () => {
  // Anchored to the Umm al-Qura calendar so a drifting platform table fails loudly.
  // Dates below are the officially announced Umm al-Qura dates, so a drifting
  // platform table or a wrong anchor fails loudly instead of silently.
  const expectations: Array<[string, string, string]> = [
    ['2026-01-16', 'İsra və Mi‘rac', 'Isra and Mi’raj'],
    ['2026-02-18', 'Ramazan bayramı', 'Ramadan begins'],
    ['2026-03-20', 'Novruz bayramı', 'Eid al-Fitr'],
    ['2026-05-27', 'Qurban bayramı', 'Eid al-Adha'],
    ['2026-06-25', 'Aşura günü', 'Ashura'],
    ['2027-02-08', 'Ramazan bayramı', 'Ramadan begins'],
    ['2027-03-09', 'Novruz bayramı', 'Eid al-Fitr'],
    ['2027-05-16', 'Qurban bayramı', 'Eid al-Adha'],
  ];

  for (const [iso, expectedAz, expectedEn] of expectations) {
    it(`maps ${iso} to ${expectedEn}`, () => {
      const markers = holidaysForGregorianYear(Number(iso.slice(0, 4)))[iso] ?? [];
      const names = markers.flatMap((marker) => Object.values(marker.names));
      expect(names).toContain(expectedAz);
      expect(names).toContain(expectedEn);
    });
  }

  it('returns a stable set for repeated calls (cache correctness)', () => {
    const first = holidaysForGregorianYear(2027);
    const second = holidaysForGregorianYear(2027);
    expect(second).toBe(first);
  });
});

describe('hijri month grid', () => {
  it('produces a contiguous, correctly bounded month', () => {
    const days = hijriMonthDays(1448, 9, '2027-02-08');
    expect(days.length).toBeGreaterThanOrEqual(29);
    expect(days[0]?.gregorian).toBe('2027-02-08');
    expect(days[0]?.hijriDay).toBe(1);
    // Every day belongs to the requested Hijri month and year.
    for (const day of days) {
      expect(day.hijriMonth).toBe(9);
      expect(day.hijriYear).toBe(1448);
    }
    // Consecutive Gregorian dates.
    for (let i = 1; i < days.length; i += 1) {
      const previous = new Date(`${days[i - 1]!.gregorian}T00:00:00.000Z`).getTime();
      const current = new Date(`${days[i]!.gregorian}T00:00:00.000Z`).getTime();
      expect(current - previous).toBe(86_400_000);
    }
  });

  it('marks exactly one day as today and only that day', () => {
    const days = hijriMonthDays(1448, 9, '2027-02-20');
    expect(days.filter((day) => day.isToday)).toHaveLength(1);
    expect(days.find((day) => day.isToday)?.gregorian).toBe('2027-02-20');
  });

  it('wraps the Hijri year correctly', () => {
    const days = hijriMonthDays(1449, 1, '2027-09-01');
    expect(days.length).toBeGreaterThanOrEqual(29);
    expect(days[0]?.hijriYear).toBe(1449);
    expect(days[0]?.hijriMonth).toBe(1);
  });
});

describe('toGregorianIso', () => {
  it('normalises to a UTC ISO date string', () => {
    expect(toGregorianIso(new Date('2026-09-27T23:59:59.999Z'))).toBe('2026-09-27');
  });
});
