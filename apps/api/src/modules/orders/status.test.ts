import { describe, expect, it } from 'vitest';

import { allowedNextStatuses, canTransition, isUserCancellable } from './status.js';

describe('order status transitions', () => {
  it('allows the normal fulfilment path', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'PREPARING')).toBe(true);
    expect(canTransition('PREPARING', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
    expect(canTransition('DELIVERED', 'REFUNDED')).toBe(true);
  });

  it('rejects jumps that skip preparation and delivery', () => {
    expect(canTransition('PENDING', 'SHIPPED')).toBe(false);
    expect(canTransition('PENDING', 'DELIVERED')).toBe(false);
    expect(canTransition('CONFIRMED', 'DELIVERED')).toBe(false);
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    expect(canTransition('REFUNDED', 'DELIVERED')).toBe(false);
  });

  it('allows cancellation before and during preparation, never after shipping', () => {
    expect(canTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(canTransition('CONFIRMED', 'CANCELLED')).toBe(true);
    expect(canTransition('PREPARING', 'CANCELLED')).toBe(true);
    expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED')).toBe(false);
  });

  it('lets customers cancel only pending or confirmed orders', () => {
    expect(isUserCancellable('PENDING')).toBe(true);
    expect(isUserCancellable('CONFIRMED')).toBe(true);
    expect(isUserCancellable('PREPARING')).toBe(false);
    expect(isUserCancellable('SHIPPED')).toBe(false);
    expect(isUserCancellable('DELIVERED')).toBe(false);
  });

  it('treats the same status as a no-op edge', () => {
    expect(canTransition('PENDING', 'PENDING')).toBe(true);
  });

  it('has no outgoing edges for terminal statuses', () => {
    expect(allowedNextStatuses('CANCELLED')).toEqual([]);
    expect(allowedNextStatuses('REFUNDED')).toEqual([]);
  });
});
