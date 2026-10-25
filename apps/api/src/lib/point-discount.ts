/**
 * Loyalty-tier discount for the book store.
 *
 * The rule is "if you hold N points you get X% off" — the points are a
 * qualification, not currency, so they are never spent. (An earlier version
 * consumed `pointsUsed` for a discount; that also meant a balance could be
 * drained below the tier that granted it.)
 *
 * The tier is snapshotted onto the order, because the balance changes later and
 * an order must keep the discount it was actually placed with.
 */
import { Prisma } from '../config/prisma-client.js';

export interface PointDiscountTier {
  points: number;
  discountPercent: number;
  label?: string;
  isActive?: boolean;
}

export const POINT_DISCOUNT_SETTING = 'bookPointDiscountTiers';

/** Tiers sorted ascending by points, ignoring anything malformed. */
export function normalizeTiers(raw: unknown): PointDiscountTier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((tier): tier is Record<string, unknown> => !!tier && typeof tier === 'object')
    .map((tier) => ({
      points: Number(tier.points),
      discountPercent: Number(tier.discountPercent),
      label: typeof tier.label === 'string' ? tier.label : undefined,
      isActive: tier.isActive !== false,
    }))
    .filter((tier) => Number.isFinite(tier.points) && tier.points >= 0 && Number.isFinite(tier.discountPercent) && tier.discountPercent > 0)
    .sort((a, b) => a.points - b.points);
}

/** Highest tier the balance qualifies for, or `undefined` at zero points. */
export function resolveTier(tiers: PointDiscountTier[], points: number): PointDiscountTier | undefined {
  let best: PointDiscountTier | undefined;
  for (const tier of tiers) {
    if (tier.isActive && tier.points <= points) best = tier;
  }
  return best;
}

export interface TierProgress {
  tier: PointDiscountTier;
  reached: boolean;
  current: boolean;
}

/**
 * The full ladder plus the caller's position on it, so the UI can show both the
 * active discount and how many points remain for the next one.
 */
export function describeTiers(rawTiers: unknown, points: number) {
  const tiers = normalizeTiers(rawTiers);
  const active = resolveTier(tiers, points);
  const ladder: TierProgress[] = tiers.map((tier) => ({
    tier,
    reached: points >= tier.points,
    current: active !== undefined && tier.points === active.points,
  }));
  const next = ladder.find((entry) => !entry.reached);
  return {
    tiers: ladder,
    /** Percentage currently applied to the order subtotal. */
    discountPercent: active?.discountPercent ?? 0,
    tierPoints: active?.points ?? 0,
    nextTierPoints: next?.tier.points ?? null,
    nextTierPercent: next?.tier.discountPercent ?? null,
    pointsToNextTier: next ? Math.max(0, next.tier.points - points) : 0,
  };
}

/** Discount for a subtotal, rounded to 2 decimals like every other price. */
export function discountFor(subtotal: Prisma.Decimal, percent: number): Prisma.Decimal {
  if (percent <= 0) return new Prisma.Decimal(0);
  return subtotal.mul(percent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}