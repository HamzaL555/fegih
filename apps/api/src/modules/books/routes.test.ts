import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma.js', () => ({ prisma: {} }));

import { serializeBook } from './routes.js';

function book(price: number, compareAtPrice: number | null) {
  return {
    price,
    compareAtPrice,
    stock: 5,
    coverImageUrl: null,
    reviews: [],
    categoryLinks: [],
  };
}

describe('serializeBook discountPercent', () => {
  it('calculates the discount when the old price is higher than the current price', () => {
    const result = serializeBook(book(75, 100));

    expect(result.finalPrice).toBe(75);
    expect(result.discountPercent).toBe(25);
  });

  it('calculates the discount when the lower price is stored in compareAtPrice', () => {
    const result = serializeBook(book(100, 80));

    expect(result.finalPrice).toBe(80);
    expect(result.discountPercent).toBe(20);
  });

  it('rounds the discount to two decimals', () => {
    const result = serializeBook(book(2, 3));

    expect(result.finalPrice).toBe(2);
    expect(result.discountPercent).toBe(33.33);
  });

  it('reports no discount when the prices are equal', () => {
    const result = serializeBook(book(100, 100));

    expect(result.finalPrice).toBe(100);
    expect(result.discountPercent).toBe(0);
  });

  it('reports no discount when there is no compare-at price', () => {
    const result = serializeBook(book(100, null));

    expect(result.finalPrice).toBe(100);
    expect(result.discountPercent).toBe(0);
  });
});
