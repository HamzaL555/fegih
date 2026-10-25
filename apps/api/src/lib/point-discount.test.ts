import { describe, expect, it } from 'vitest';

import { describeTiers, discountFor, normalizeTiers, resolveTier } from './point-discount.js';
import { Prisma } from '../config/prisma-client.js';

const LADDER = [
  { points: 1000, discountPercent: 5 },
  { points: 2500, discountPercent: 8 },
  { points: 5000, discountPercent: 12 },
  { points: 10000, discountPercent: 15 },
];

describe('normalizeTiers', () => {
  it('sorts ascending and drops malformed entries', () => {
    const tiers = normalizeTiers([
      { points: 5000, discountPercent: 12 },
      { points: 1000, discountPercent: 5 },
      { points: -5, discountPercent: 3 },
      { points: 900, discountPercent: 0 },
      { points: 'abc', discountPercent: 5 },
      null,
      'nope',
    ]);
    expect(tiers.map((tier) => tier.points)).toEqual([1000, 5000]);
  });

  it('returns nothing for a non-array', () => {
    expect(normalizeTiers(undefined)).toEqual([]);
    expect(normalizeTiers(null)).toEqual([]);
    expect(normalizeTiers({})).toEqual([]);
  });

  it('treats a missing isActive as active', () => {
    expect(normalizeTiers([{ points: 100, discountPercent: 5 }])[0]?.isActive).toBe(true);
  });
});

describe('resolveTier', () => {
  const tiers = normalizeTiers(LADDER);

  it('awards the documented example: 1000 points means 5%', () => {
    expect(resolveTier(tiers, 1000)?.discountPercent).toBe(5);
  });

  it('gives nothing below the first tier', () => {
    expect(resolveTier(tiers, 0)).toBeUndefined();
    expect(resolveTier(tiers, 999)).toBeUndefined();
  });

  it('picks the highest qualifying tier, not the last configured one', () => {
    expect(resolveTier(tiers, 9999)?.points).toBe(5000);
    expect(resolveTier(tiers, 10000)?.discountPercent).toBe(15);
    expect(resolveTier(tiers, 999_999)?.discountPercent).toBe(15);
  });

  it('skips tiers that are switched off', () => {
    const withDisabled = normalizeTiers([...LADDER, { points: 20_000, discountPercent: 50, isActive: false }]);
    expect(resolveTier(withDisabled, 50_000)?.discountPercent).toBe(15);
  });
});

describe('describeTiers', () => {
  it('reports the discount, the next step and the shortfall', () => {
    const info = describeTiers(LADDER, 3000);
    expect(info.discountPercent).toBe(8);
    expect(info.tierPoints).toBe(2500);
    expect(info.nextTierPoints).toBe(5000);
    expect(info.pointsToNextTier).toBe(2000);
  });

  it('has no next tier once the top is reached', () => {
    const info = describeTiers(LADDER, 10_000);
    expect(info.discountPercent).toBe(15);
    expect(info.nextTierPoints).toBeNull();
    expect(info.pointsToNextTier).toBe(0);
  });

  it('marks exactly one rung as current and the earlier ones as reached', () => {
    const info = describeTiers(LADDER, 3000);
    expect(info.tiers.map((entry) => entry.reached)).toEqual([true, true, false, false]);
    expect(info.tiers.filter((entry) => entry.current)).toHaveLength(1);
    expect(info.tiers.find((entry) => entry.current)?.tier.points).toBe(2500);
  });
});

describe('discountFor', () => {
  const subtotal = new Prisma.Decimal('39.90');

  it('applies the percentage to the subtotal, rounded half-up to 2 decimals', () => {
    expect(discountFor(subtotal, 5).toFixed(2)).toBe('2.00'); // 1.995 rounds up
    expect(discountFor(subtotal, 12).toFixed(2)).toBe('4.79'); // 4.788 rounds down
    expect(discountFor(new Prisma.Decimal('100'), 5).toFixed(2)).toBe('5.00');
  });

  it('is zero when there is no tier or no percentage', () => {
    expect(discountFor(subtotal, 0).toFixed(2)).toBe('0.00');
    expect(discountFor(subtotal, -5).toFixed(2)).toBe('0.00');
  });
});