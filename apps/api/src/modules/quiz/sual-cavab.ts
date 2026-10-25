/**
 * "Sual-Cavab" game rules.
 *
 * The run is a ladder of 15 levels. Level N is answered with 10 randomly drawn
 * questions and every correct answer is worth N points, so each level is worth
 * `10 * N` and a perfect run collects `10 * (1 + 2 + ... + 15) = 1200` points.
 *
 * A level is only cleared when all 10 of its questions were answered correctly;
 * then 10 fresh questions are drawn from the next level. A single wrong answer
 * (or a skipped question) ends the run: the score drops back to 0 and the next
 * attempt restarts at level 1 with a different set of questions.
 */

/** Questions drawn per level. */
export const QUESTIONS_PER_LEVEL = 10;

/** Number of levels in the ladder. */
export const MAX_LEVELS = 15;

/** Total questions in a perfect run. */
export const TOTAL_QUESTIONS = QUESTIONS_PER_LEVEL * MAX_LEVELS;

/** A correct answer at level N is worth N points. */
export function pointsForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) return 1;
  return Math.min(level, MAX_LEVELS);
}

/** Highest score reachable inside a single level. */
export function levelMaxPoints(level: number): number {
  return QUESTIONS_PER_LEVEL * pointsForLevel(level);
}

/** Highest score reachable in the whole game. */
export const TOTAL_MAX_POINTS = Array.from({ length: MAX_LEVELS }, (_, index) => levelMaxPoints(index + 1))
  .reduce((total, value) => total + value, 0);

/**
 * The level-by-level point ladder sent to the client: index 0 is level 1.
 * Purely presentational — the server always recomputes the real score.
 */
export const LEVEL_LADDER = Array.from({ length: MAX_LEVELS }, (_, index) => ({
  level: index + 1,
  pointsPerAnswer: pointsForLevel(index + 1),
  maxPoints: levelMaxPoints(index + 1),
}));

export function formatPoints(value: number): string {
  return new Intl.NumberFormat('az-AZ').format(Math.max(0, Math.round(value)));
}
