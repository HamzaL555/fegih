import { describe, expect, it } from 'vitest';

import { readPageParam, readParam } from './searchParams';

/**
 * Regression tests for the blank-screen bug: `useLocalSearchParams()` returns a
 * plain object, so calling `.get()` on it threw "get is not a function" and the
 * route crashed on first render.
 */
describe('search param helpers', () => {
  it('reads a param from the plain object Expo Router returns', () => {
    expect(readParam({ search: 'quran' }, 'search')).toBe('quran');
    expect(readParam({ page: '2' }, 'page')).toBe('2');
  });

  it('takes the first value when a param is repeated', () => {
    expect(readParam({ search: ['quran', 'hadith'] }, 'search')).toBe('quran');
  });

  it('returns undefined for a missing param instead of throwing', () => {
    expect(readParam({}, 'missing')).toBeUndefined();
    expect(readParam(undefined, 'missing')).toBeUndefined();
  });

  it('parses a valid page and falls back for invalid values', () => {
    expect(readPageParam({ page: '3' })).toBe(3);
    expect(readPageParam({ page: '0' })).toBe(1);
    expect(readPageParam({ page: '-2' })).toBe(1);
    expect(readPageParam({ page: 'abc' })).toBe(1);
    expect(readPageParam({})).toBe(1);
  });

  it('truncates a fractional page', () => {
    expect(readPageParam({ page: '2.9' })).toBe(2);
  });
});
