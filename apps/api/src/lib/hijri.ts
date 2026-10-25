/**
 * Hijri (Umm al-Qura) conversion and Islamic holiday lookup.
 *
 * `Intl` ships the `islamic-umalqura` calendar in Node's full-ICU build, which
 * avoids shipping (and slowly drifting) a hand-written conversion table.
 */

const HIJRI_MONTHS: Record<string, { az: string; tr: string; en: string; ar: string }> = {
  '1': { az: 'Muhərrəm', tr: 'Muharrem', en: 'Muharram', ar: 'محرم' },
  '2': { az: 'Səfər', tr: 'Safer', en: 'Safar', ar: 'صفر' },
  '3': { az: 'Rəbiüləvvəl', tr: 'Rebiülevvel', en: 'Rabi al-Awwal', ar: 'ربيع الأول' },
  '4': { az: 'Rəbiülənir', tr: 'Rebiülahir', en: 'Rabi al-Thani', ar: 'ربيع الآخر' },
  '5': { az: 'Cəmədiyəlavvel', tr: 'Cemaziyelevvel', en: 'Jumada al-Ula', ar: 'جمادى الأولى' },
  '6': { az: 'Cəmədiyələbir', tr: 'Cemaziyelahir', en: 'Jumada al-Akhirah', ar: 'جمادى الآخرة' },
  '7': { az: 'Rəcab', tr: 'Recep', en: 'Rajab', ar: 'رجب' },
  '8': { az: 'Şəban', tr: 'Şaban', en: 'Shaban', ar: 'شعبان' },
  '9': { az: 'Ramazan', tr: 'Ramazan', en: 'Ramadan', ar: 'رمضان' },
  '10': { az: 'Şəvval', tr: 'Şevval', en: 'Shawwal', ar: 'شوال' },
  '11': { az: 'Zülqədə', tr: 'Zulkade', en: 'Dhu al-Qidah', ar: 'ذو القعدة' },
  '12': { az: 'Zülhiccə', tr: 'Zülhicce', en: 'Dhu al-Hijjah', ar: 'ذو الحجة' },
};

const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

export function toHijri(date: Date): HijriDate {
  const parts = formatter.formatToParts(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())));
  const read = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read('year'), month: read('month'), day: read('day') };
}

export function toGregorianIso(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

export function hijriMonthName(month: number): { az: string; tr: string; en: string; ar: string } {
  return HIJRI_MONTHS[String(month)] ?? { az: '—', tr: '—', en: '—', ar: '—' };
}

/** "1447 Ramadan 1" style label used by the calendar screen. */
export function formatHijri(date: Date, language: 'az' | 'tr' | 'en' | 'ar' = 'az'): string {
  const hijri = toHijri(date);
  return `${hijri.day} ${hijriMonthName(hijri.month)[language]} ${hijri.year}`;
}

export interface HolidayMarker {
  key: string;
  title: string;
  names: { az: string; tr: string; en: string; ar: string };
}

/** Named occasions keyed by `hijriMonth:hijriDay`. */
const NAMED_DAYS: Record<string, Omit<HolidayMarker, 'title' | 'key'>> = {
  '9:1': { names: { az: 'Ramazan bayramı', tr: 'Ramazan bayramı', en: 'Ramadan begins', ar: 'بداية رمضان' } },
  '9:27': { names: { az: 'Ləylətü’l-Qadr (ehtimallı)', tr: 'Kadir Gecesi', en: 'Laylat al-Qadr (likely)', ar: 'ليلة القدر' } },
  '10:1': { names: { az: 'Novruz bayramı', tr: 'Ramazan Bayramı', en: 'Eid al-Fitr', ar: 'عيد الفطر' } },
  '10:2': { names: { az: 'Novruz bayramı (2-ci gün)', tr: 'Ramazan Bayramı (2. gün)', en: 'Eid al-Fitr (2nd day)', ar: 'عيد الفطر (اليوم الثاني)' } },
  '10:3': { names: { az: 'Novruz bayramı (3-cü gün)', tr: 'Ramazan Bayramı (3. gün)', en: 'Eid al-Fitr (3rd day)', ar: 'عيد الفطر (اليوم الثالث)' } },
  '12:9': { names: { az: 'Arefə gecəsi', tr: 'Arefe Gecesi', en: 'Arafah night', ar: 'ليلة عرفة' } },
  '12:10': { names: { az: 'Qurban bayramı', tr: 'Kurban Bayramı', en: 'Eid al-Adha', ar: 'عيد الأضحى' } },
  '12:11': { names: { az: 'Qurban bayramı (2-ci gün)', tr: 'Kurban Bayramı (2. gün)', en: 'Eid al-Adha (2nd day)', ar: 'عيد الأضحى (اليوم الثاني)' } },
  '12:12': { names: { az: 'Qurban bayramı (3-cü gün)', tr: 'Kurban Bayramı (3. gün)', en: 'Eid al-Adha (3rd day)', ar: 'عيد الأضحى (اليوم الثالث)' } },
  '12:13': { names: { az: 'Qurban bayramı (4-cü gün)', tr: 'Kurban Bayramı (4. gün)', en: 'Eid al-Adha (4th day)', ar: 'عيد الأضحى (اليوم الرابع)' } },
  '1:10': { names: { az: 'Aşura günü', tr: 'Aşure Günü', en: 'Ashura', ar: 'عاشوراء' } },
  '7:27': { names: { az: 'İsra və Mi‘rac', tr: 'İsrâ ve Mi‘rac', en: 'Isra and Mi’raj', ar: 'الإسراء والمعراج' } },
  '2:15': { names: { az: 'Məharrəm yarısı', tr: 'Şaaban Kandili', en: 'Mid-Shaban', ar: 'ليلة النصف من شعبان' } },
};

const holidayCache = new Map<string, Record<string, HolidayMarker[]>>();

/**
 * Every named occasion that falls inside a Gregorian year, keyed by ISO date.
 * Computed once per year and cached.
 */
export function holidaysForGregorianYear(year: number): Record<string, HolidayMarker[]> {
  const cached = holidayCache.get(String(year));
  if (cached) return cached;

  const result: Record<string, HolidayMarker[]> = {};
  const cursor = new Date(Date.UTC(year, 0, 1));
  const end = Date.UTC(year, 11, 31);
  while (cursor.getTime() <= end) {
    const hijri = toHijri(cursor);
    const named = NAMED_DAYS[`${hijri.month}:${hijri.day}`];
    if (named) {
      const key = toGregorianIso(cursor);
      const marker: HolidayMarker = { key: named.names.en, title: named.names.en, names: named.names };
      (result[key] ??= []).push(marker);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  holidayCache.set(String(year), result);
  if (holidayCache.size > 12) holidayCache.delete(holidayCache.keys().next().value ?? '');
  return result;
}

export function holidaysForDate(date: Date, language: 'az' | 'tr' | 'en' | 'ar' = 'az'): string[] {
  const markers = holidaysForGregorianYear(date.getUTCFullYear())[toGregorianIso(date)];
  return markers ? markers.map((marker) => marker.names[language]) : [];
}

export interface HijriMonthDay {
  hijriDay: number;
  hijriMonth: number;
  hijriYear: number;
  gregorian: string;
  isToday: boolean;
  holidays: string[];
}

const monthCache = new Map<string, HijriMonthDay[]>();

function firstDayOfHijriYear(hijriYear: number): Date {
  // The Gregorian equivalent of a Hijri year is discovered by probing instead of
  // by a hard-coded offset: the Umm al-Qura anchor is a platform implementation
  // detail, and a wrong constant silently produced empty month grids.
  const now = new Date();
  const offset = now.getUTCFullYear() - toHijri(now).year;
  const probe = new Date(Date.UTC(hijriYear + offset, 5, 1));
  for (let i = 0; i < 400; i += 1) {
    if (toHijri(probe).year >= hijriYear) break;
    probe.setUTCDate(probe.getUTCDate() + 10);
  }
  while (toHijri(probe).year > hijriYear) probe.setUTCDate(probe.getUTCDate() - 1);
  // `probe` is now at most one day past 1 Muharram of the requested year.
  for (let i = 0; i < 40; i += 1) {
    if (toHijri(probe).day === 1) return new Date(probe);
    probe.setUTCDate(probe.getUTCDate() - 1);
  }
  return new Date(probe);
}

/**
 * Builds the day grid for a Hijri month. The grid starts on the Gregorian day
 * that the 1st of the Hijri month falls on, so the first row is padded by the
 * caller using the weekday of `days[0].gregorian`.
 */
export function hijriMonthDays(hijriYear: number, hijriMonth: number, todayIso: string): HijriMonthDay[] {
  const cacheKey = `${hijriYear}-${hijriMonth}`;
  const cached = monthCache.get(cacheKey);
  // `isToday` is applied *after* the cache read: baking it into the cached row
  // made the highlight freeze on whichever day first requested the month.
  if (cached) return cached.map((day) => ({ ...day, isToday: day.gregorian === todayIso }));

  const first = firstDayOfHijriYear(hijriYear);
  for (let i = 0; i < 400; i += 1) {
    const hijri = toHijri(first);
    if (hijri.month === hijriMonth && hijri.day === 1) break;
    if (hijri.month > hijriMonth) first.setUTCDate(first.getUTCDate() - 1);
    else first.setUTCDate(first.getUTCDate() + 1);
  }

  const days: HijriMonthDay[] = [];
  const cursor = new Date(first);
  for (let i = 0; i < 31; i += 1) {
    const hijri = toHijri(cursor);
    if (hijri.month !== hijriMonth || hijri.year !== hijriYear) break;
    const gregorian = toGregorianIso(cursor);
    days.push({ hijriDay: hijri.day, hijriMonth: hijri.month, hijriYear: hijri.year, gregorian, isToday: gregorian === todayIso, holidays: holidaysForDate(cursor) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  monthCache.set(cacheKey, days);
  if (monthCache.size > 24) monthCache.delete(monthCache.keys().next().value ?? '');
  return days;
}
