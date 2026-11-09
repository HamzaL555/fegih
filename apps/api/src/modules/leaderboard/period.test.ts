import { describe, expect, it } from 'vitest';

import { periodStart } from './period.js';

const iso = (date: Date) => date.toISOString();

describe('periodStart', () => {
  it('daily starts at midnight UTC of the same day', () => {
    expect(iso(periodStart('daily', new Date('2026-11-09T17:32:03.799Z')))).toBe('2026-11-09T00:00:00.000Z');
  });

  it('monthly starts on the first day of the current month', () => {
    expect(iso(periodStart('monthly', new Date('2026-11-09T17:32:03.799Z')))).toBe('2026-11-01T00:00:00.000Z');
  });

  it('monthly handles January and December', () => {
    expect(iso(periodStart('monthly', new Date('2027-01-31T23:59:59.999Z')))).toBe('2027-01-01T00:00:00.000Z');
    expect(iso(periodStart('monthly', new Date('2026-12-15T10:00:00.000Z')))).toBe('2026-12-01T00:00:00.000Z');
  });

  it('monthly handles leap and non-leap February', () => {
    expect(iso(periodStart('monthly', new Date('2028-02-29T12:00:00.000Z')))).toBe('2028-02-01T00:00:00.000Z');
    expect(iso(periodStart('monthly', new Date('2026-02-28T12:00:00.000Z')))).toBe('2026-02-01T00:00:00.000Z');
  });

  it('weekly starts on Monday, including across a month boundary', () => {
    // 2026-11-09 is a Monday.
    expect(iso(periodStart('weekly', new Date('2026-11-09T17:32:03.799Z')))).toBe('2026-11-09T00:00:00.000Z');
    // 2026-11-01 is a Sunday, so the week starts 2026-10-26.
    expect(iso(periodStart('weekly', new Date('2026-11-01T12:00:00.000Z')))).toBe('2026-10-26T00:00:00.000Z');
  });

  it('weekly starts on Monday across a year boundary', () => {
    // 2026-01-01 is a Thursday, so the week starts 2025-12-29.
    expect(iso(periodStart('weekly', new Date('2026-01-01T12:00:00.000Z')))).toBe('2025-12-29T00:00:00.000Z');
  });

  it('does not mutate the supplied date', () => {
    const now = new Date('2026-11-09T17:32:03.799Z');
    periodStart('monthly', now);
    expect(iso(now)).toBe('2026-11-09T17:32:03.799Z');
  });
});
