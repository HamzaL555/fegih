import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $transaction: vi.fn() },
}));

vi.mock('../../config/prisma.js', () => ({ prisma: prismaMock }));

import { cancelOrderAndRestore } from './routes.js';

function createTx(order: Record<string, unknown>, claimedCount = 1) {
  return {
    order: {
      findUnique: vi.fn().mockResolvedValue(order),
      updateMany: vi.fn().mockResolvedValue({ count: claimedCount }),
    },
    book: { update: vi.fn() },
    promoRedemption: { delete: vi.fn() },
    payment: { updateMany: vi.fn() },
  };
}

function run(tx: ReturnType<typeof createTx>) {
  prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  return cancelOrderAndRestore('order-1');
}

describe('cancelOrderAndRestore', () => {
  beforeEach(() => vi.clearAllMocks());

  it('claims the order, restores stock and removes the promo redemption', async () => {
    const tx = createTx({
      id: 'order-1',
      status: 'PENDING',
      items: [{ bookId: 'book-1', quantity: 2 }, { bookId: 'book-2', quantity: 1 }],
      promoRedemption: { id: 'redemption-1' },
    });

    const result = await run(tx);

    expect(result).toBe(true);
    // No Serializable/isolation options on the cancellation transaction.
    expect(prismaMock.$transaction.mock.calls[0]).toHaveLength(1);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
    expect(tx.book.update).toHaveBeenNthCalledWith(1, { where: { id: 'book-1' }, data: { stock: { increment: 2 } } });
    expect(tx.book.update).toHaveBeenNthCalledWith(2, { where: { id: 'book-2' }, data: { stock: { increment: 1 } } });
    expect(tx.promoRedemption.delete).toHaveBeenCalledWith({ where: { id: 'redemption-1' } });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
  });

  it('does nothing when the order is not pending', async () => {
    const tx = createTx({
      id: 'order-1',
      status: 'CONFIRMED',
      items: [{ bookId: 'book-1', quantity: 2 }],
      promoRedemption: { id: 'redemption-1' },
    });

    expect(await run(tx)).toBe(false);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.book.update).not.toHaveBeenCalled();
    expect(tx.promoRedemption.delete).not.toHaveBeenCalled();
  });

  it('does not restore twice when a concurrent cancellation already claimed the order', async () => {
    const tx = createTx(
      { id: 'order-1', status: 'PENDING', items: [{ bookId: 'book-1', quantity: 2 }], promoRedemption: { id: 'redemption-1' } },
      0,
    );

    expect(await run(tx)).toBe(false);
    expect(tx.order.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.book.update).not.toHaveBeenCalled();
    expect(tx.promoRedemption.delete).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });
});
