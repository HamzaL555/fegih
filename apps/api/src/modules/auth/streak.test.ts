import { describe, expect, it } from 'vitest';
import { calculateStreak } from './service.js';

describe('login streak calculation', () => {
  it('increments on the next calendar day', () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    expect(calculateStreak(3, 3, yesterday)).toEqual({ streak: 4, longestStreak: 4 });
  });

  it('resets after a missed day', () => {
    const old = new Date();
    old.setUTCDate(old.getUTCDate() - 3);
    expect(calculateStreak(8, 8, old)).toEqual({ streak: 1, longestStreak: 8 });
  });
});
