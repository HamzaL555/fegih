/**
 * Start of the leaderboard window, in UTC.
 *
 * The old implementation called `setUTCMonth(now.getUTCMonth())`, which is a
 * no-op: the start stayed on *today* instead of the first of the month, so the
 * monthly board only counted entries from the current day. It also never reset
 * the day when moving back a week. Keeping the calculation in one pure function
 * makes the boundaries (December→January, leap February) testable.
 */
export type LeaderboardPeriod = 'daily' | 'weekly' | 'monthly';

export function periodStart(period: LeaderboardPeriod, now: Date = new Date()): Date {
  if (period === 'daily') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }
  if (period === 'monthly') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }
  // ISO week: Monday is the first day. `getUTCDay()` is 0 for Sunday, so
  // (day + 6) % 7 gives 0..6 with Monday at 0.
  const day = now.getUTCDate();
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day - mondayOffset, 0, 0, 0, 0));
}
