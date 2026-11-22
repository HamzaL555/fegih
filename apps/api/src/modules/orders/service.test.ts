import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../config/prisma-client.js';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    cart: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    systemSetting: { findUnique: vi.fn() },
    promo: { findFirst: vi.fn() },
    promoRedemption: { count: vi.fn() },
    order: { findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../config/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../config/stripe.js', () => ({ getStripe: vi.fn(), isStripeConfigured: vi.fn(() => false) }));
vi.mock('../auth/mailer.js', () => ({
  notifyOrderOffline: vi.fn(async () => ({ delivered: false })),
  orderNotificationAddress: vi.fn(() => 'shop@example.com'),
}));
vi.mock('../notifications/service.js', () => ({ notifyUser: vi.fn(async () => undefined) }));

import { createOrder } from './service.js';

function promo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-1',
    code: 'TEST10',
    discountType: 'PERCENTAGE',
    value: new Prisma.Decimal(10),
    maxDiscountAmount: null,
    minOrderAmount: null,
    perUserLimit: null,
    usageLimit: 100,
    ...overrides,
  };
}

function createTx() {
  return {
    book: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    order: { create: vi.fn().mockResolvedValue({ id: 'order-1' }) },
    promoRedemption: { create: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    cartItem: { deleteMany: vi.fn() },
    cart: { update: vi.fn() },
  };
}

function arrange() {
  prismaMock.cart.findFirst.mockResolvedValue({
    id: 'cart-1',
    currency: 'AZN',
    items: [{
      bookId: 'book-1',
      quantity: 1,
      book: {
        id: 'book-1',
        sku: 'SKU-1',
        title: 'Book',
        author: 'Author',
        price: new Prisma.Decimal(100),
        compareAtPrice: null,
        isActive: true,
        deletedAt: null,
      },
    }],
  });
  prismaMock.user.findUnique.mockResolvedValue({
    id: 'user-1',
    status: 'ACTIVE',
    deletedAt: null,
    email: 'user@example.com',
    phone: '+994501112233',
    points: 0,
    displayName: 'User',
  });
  prismaMock.systemSetting.findUnique.mockResolvedValue(null);
  prismaMock.promo.findFirst.mockResolvedValue(promo());
  prismaMock.promoRedemption.count.mockResolvedValue(0);
  prismaMock.order.findUniqueOrThrow.mockResolvedValue({
    id: 'order-1',
    orderNumber: 'FG-1',
    userId: 'user-1',
    totalAmount: new Prisma.Decimal(90),
    items: [{ title: 'Book', author: 'Author', quantity: 1, unitPrice: new Prisma.Decimal(100), totalPrice: new Prisma.Decimal(100) }],
    payments: [{ id: 'payment-1', method: 'CASH_ON_DELIVERY', status: 'PENDING' }],
  });
}

const input = {
  paymentMethod: 'CASH_ON_DELIVERY' as const,
  promoCode: 'TEST10',
  shippingAddress: { city: 'Baku', address: 'Street 1', phone: '+994501112233' },
};

describe('createOrder promo handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrange();
  });

  it('runs without Serializable isolation and writes the promo redemption inside the transaction', async () => {
    const tx = createTx();
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await createOrder('user-1', input);

    // Only the callback is passed: no isolationLevel / Serializable options.
    expect(prismaMock.$transaction.mock.calls[0]).toHaveLength(1);
    expect(prismaMock.$transaction.mock.calls[0]?.[1]).toBeUndefined();
    expect(tx.promoRedemption.create).toHaveBeenCalledWith({
      data: {
        promoId: 'promo-1',
        orderId: 'order-1',
        userId: 'user-1',
        discountAmount: expect.anything(),
      },
    });
    // The promo row is locked and the usage limit is re-checked atomically.
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it('rolls back (rejects with 409) when the usage limit is reached inside the transaction', async () => {
    const tx = createTx();
    tx.promoRedemption.count.mockResolvedValue(100);
    prismaMock.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await expect(createOrder('user-1', input)).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(tx.promoRedemption.create).not.toHaveBeenCalled();
  });
});
