import { describe, expect, it } from 'vitest';

import { normalizeAngle, signedDelta, stepToward } from './angle';

describe('signedDelta', () => {
  it('takes the short way round the ±180 seam', () => {
    expect(signedDelta(179, -179)).toBe(2);
    expect(signedDelta(-179, 179)).toBe(-2);
    expect(signedDelta(350, 10)).toBe(20);
  });

  it('is zero for identical angles', () => {
    expect(signedDelta(0, 0)).toBe(0);
    expect(signedDelta(123, 123)).toBe(0);
    expect(signedDelta(720, 0)).toBe(0);
  });

  it('stays correct for large unwrapped values', () => {
    // The regression that made the dial spin the long way: JavaScript's `%`
    // keeps the dividend's sign, so shifting before the modulo returns -320
    // (a 320 degree turn) where +40 is only forty degrees away.
    expect(signedDelta(5000, 0)).toBe(40);
    expect(signedDelta(-5000, 0)).toBe(-40);
    expect(signedDelta(-9000, 45)).toBe(45);
    // Exactly ten turns apart, so the answer must be zero.
    expect(signedDelta(100_000, 100_000 + 360 * 10)).toBe(0);
    // Not a whole number of turns: 100000 is 280 degrees round, 200000 is 200.
    expect(signedDelta(100_000, 200_000)).toBe(-80);
  });

  it('always resolves to [-180, 180)', () => {
    for (let from = -2000; from <= 2000; from += 37) {
      for (let to = -400; to <= 400; to += 53) {
        const delta = signedDelta(from, to);
        expect(delta).toBeGreaterThanOrEqual(-180);
        expect(delta).toBeLessThan(180);
      }
    }
  });

  it('matches the true shortest rotation for ordinary inputs', () => {
    for (let from = -360; from <= 360; from += 11) {
      for (let to = -360; to <= 360; to += 7) {
        const delta = signedDelta(from, to);
        const forward = (to - from) % 360;
        expect(Math.abs(delta)).toBeLessThanOrEqual(Math.abs(forward) + 180.0001);
        expect(Math.abs(delta)).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe('normalizeAngle', () => {
  it('folds into [0, 360)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-1)).toBe(359);
    expect(normalizeAngle(725)).toBe(5);
  });
});

describe('stepToward', () => {
  it('grows monotonically instead of wrapping', () => {
    let dial = 0;
    // A dial turning through north: 358, 359, 0, 1, 2.
    for (const heading of [358, 359, 0, 1, 2]) {
      dial = stepToward(dial, -heading);
    }
    expect(dial).toBeLessThan(0);
    // Never spun backwards through the full circle.
    expect(dial).toBeGreaterThan(-10);
  });

  it('never accumulates more than half a turn per step', () => {
    let dial = 0;
    for (let index = 0; index < 5000; index += 1) {
      const before = dial;
      dial = stepToward(dial, index % 360);
      expect(Math.abs(dial - before)).toBeLessThanOrEqual(180);
    }
  });

  it('settles on the target once the target stops moving', () => {
    // The dial is driven by `-heading`, so a dial parked at 260 means the
    // device is facing 100 degrees.
    const dial = stepToward(0, 260);
    expect(normalizeAngle(-dial)).toBe(100);
  });
});