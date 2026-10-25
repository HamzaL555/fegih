/**
 * Angle arithmetic for the compass.
 *
 * Heading readings wrap at 360 degrees, but a value that keeps spinning has to
 * keep growing instead — otherwise every wrap throws the animation across the
 * dial. These helpers are the only place that converts between the two.
 */

/**
 * Shortest signed rotation from `from` to `to`, in degrees.
 *
 * The modulo is taken *before* the +180 shift, so the result stays correct even
 * when `from` is a large unwrapped value. Shifting first (the obvious way to
 * write it) silently breaks once `from` grows past ~540: JavaScript's `%` keeps
 * the sign of the dividend, so `((-5000 + 540) % 360)` comes out negative and
 * the needle takes the long way round.
 *
 * Returns a value in [-180, 180). An exact half turn resolves to -180.
 */
export function signedDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Folds any angle back into [0, 360). */
export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Advances an unwrapped rotation to a wrapped target along the shortest path,
 * accumulating onto `current` so the result keeps growing.
 *
 * This is what keeps a continuously turning needle smooth: each sample adds a
 * step of a few degrees rather than snapping to a fresh absolute angle.
 */
export function stepToward(current: number, target: number): number {
  return current + signedDelta(current, target);
}