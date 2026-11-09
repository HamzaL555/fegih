import { randomBytes } from 'node:crypto';
import { Prisma } from '../../config/prisma-client.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { getStripe } from '../../config/stripe.js';
import { ApiError } from '../../lib/api-error.js';
import { money } from '../../lib/money.js';
import { POINT_DISCOUNT_SETTING, describeTiers, discountFor } from '../../lib/point-discount.js';
import { notifyOrderOffline, orderNotificationAddress } from '../auth/mailer.js';
import { notifyUser } from '../notifications/service.js';

export interface CheckoutInput {
  shippingAddress?: { fullName?: string; recipientName?: string; phone?: string; city?: string; address?: string; line1?: string; postalCode?: string; note?: string };
  promoCode?: string;
  paymentMethod?: 'CARD' | 'CASH_ON_DELIVERY' | 'BANK_TRANSFER';
  /** Card details. Validated, then reduced to a brand and the last four digits. */
  card?: { number?: string; expiry?: string; cvc?: string; name?: string };
  source?: 'MOBILE' | 'WEB';
}

/** Only card payments go to an external provider. */
function cardPayment(method: CheckoutInput['paymentMethod']): boolean {
  return (method ?? 'CARD') === 'CARD';
}

/** Luhn checksum — the same rule every card network uses. */
function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function cardBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6/.test(digits)) return 'Discover';
  return 'Card';
}

function expiryValid(raw: string): boolean {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(raw);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  return new Date(year, month, 0, 23, 59, 59).getTime() >= Date.now();
}

/**
 * Stripe's documented decline numbers. Without this a simulated payment would
 * always succeed and the decline path could never be exercised in development.
 */
const DECLINING_CARDS = new Set(['4000000000000002', '4000000000009995', '4000000000000069']);

/**
 * Validates card input and returns the only part worth keeping.
 *
 * The full PAN, the expiry and the CVC are deliberately never stored or logged
 * — a leaked payment row should not be usable. Only the brand and the last four
 * digits end up in `Payment.providerData`.
 */
function summariseCard(input: CheckoutInput['card']): { brand: string; last4: string; expired: boolean; declined: boolean } | null {
  if (!input) return null;
  const digits = (input.number ?? '').replace(/\D/g, '');
  if (!luhnValid(digits)) throw ApiError.badRequest('Kart nömrəsi düzgün deyil');
  if (!expiryValid(input.expiry ?? '')) throw ApiError.badRequest('Kartın etibarlılıq tarixi düzgün deyil');
  if (!/^\d{3,4}$/.test((input.cvc ?? '').replace(/\D/g, ''))) throw ApiError.badRequest('CVC düzgün deyil');
  return {
    brand: cardBrand(digits),
    last4: digits.slice(-4),
    expired: !expiryValid(input.expiry ?? ''),
    declined: DECLINING_CARDS.has(digits),
  };
}

/**
 * True when a real Stripe secret is configured.
 *
 * A placeholder or empty key is treated as *not* configured: sending a fake
 * secret to Stripe answers 401 and surfaces as a confusing checkout failure,
 * which is worse than the explicit "card payments are simulated" path.
 */
export function isStripeConfigured(): boolean {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (!key) return false;
  // Real keys are `sk_test_…`/`sk_live_…`; obvious placeholders are rejected.
  return /^sk_(test|live)_[A-Za-z0-9]{8,}$/.test(key) && !/fake|placeholder|changeme|xxxx/i.test(key);
}

/**
 * When true, card payments are simulated locally instead of contacting Stripe.
 * Set `PAYMENT_MOCK=true` to force it even with real keys in place.
 */
export function isMockPaymentEnabled(): boolean {
  return env.PAYMENT_MOCK === true || !isStripeConfigured();
}

async function setting<T>(key: string, fallback: T): Promise<T> { const row = await prisma.systemSetting.findUnique({ where: { key } }); return (row?.value as T | undefined) ?? fallback; }
function promoDiscount(type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING', value: Prisma.Decimal, subtotal: Prisma.Decimal, max: Prisma.Decimal | null) { if (type === 'FREE_SHIPPING') return new Prisma.Decimal(0); const result = type === 'PERCENTAGE' ? subtotal.mul(value).div(100) : value; return Prisma.Decimal.min(max && result.greaterThan(max) ? max : result, subtotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); }
function orderNumber() { return `FG-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`; }
function sellingPrice(price: Prisma.Decimal, compareAtPrice: Prisma.Decimal | null) { return compareAtPrice && compareAtPrice.lessThan(price) ? compareAtPrice : price; }

export async function createOrder(userId: string, input: CheckoutInput) {
  /**
   * Card details are checked before anything is written, so a malformed card
   * cannot leave stock decremented and the cart emptied. Also the natural place
   * to reject the documented Stripe decline numbers.
   *
   * They are only required while the payment is simulated. With a real Stripe
   * key the customer is handed to Stripe's hosted checkout, which collects the
   * card itself — asking for the card here as well would mean collecting a
   * card number we are not going to use, and forwarding it for no reason.
   */
  const simulated = isMockPaymentEnabled();
  if (cardPayment(input.paymentMethod) && simulated) {
    if (!input.card?.number) throw ApiError.badRequest('Kart məlumatları tələb olunur');
  }
  const card = cardPayment(input.paymentMethod) && simulated ? summariseCard(input.card) : null;
  if (card?.declined) {
    throw new ApiError(402, 'CARD_DECLINED', card.last4 === '9995' ? 'Kartda kifayət qədər vəsait yoxdur' : 'Kart ödənişi bank tərəfindən rədd edildi');
  }

  /**
   * Card payments are never allowed to fail *after* the order row is written.
   * Previously `getStripe()` ran first and threw 503 once the key was missing,
   * which left the stock decremented and the cart emptied with the shopper
   * looking at an error.
   */
  if (cardPayment(input.paymentMethod) && isStripeConfigured() && !isMockPaymentEnabled()) {
    getStripe();
  }

  // The live basket. A user has one cart row per past order, so the newest
  // ACTIVE one is the basket this checkout is about.
  const cart = await prisma.cart.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, include: { items: { include: { book: true } } } });
  if (!cart?.items.length) throw ApiError.badRequest('Səbət boşdur');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE' || user.deletedAt) throw ApiError.unauthorized();
  if (!user.email) throw ApiError.badRequest('Checkout üçün email tələb olunur');
  const customerEmail = user.email;
  /**
   * The phone the shop calls is the one on the delivery address, not the one
   * on the account. The account phone is only a fallback: requiring it blocked
   * checkout for accounts that never filled in a profile — the seeded
   * administrator, for one, has an email but no phone, and could not buy a book
   * even though the checkout form had already collected a number.
   */
  const customerPhone = input.shippingAddress?.phone ?? user.phone;
  if (!customerPhone) throw ApiError.badRequest('Checkout üçün telefon tələb olunur');
  const subtotal = cart.items.reduce((sum, item) => {
    if (!item.book.isActive || item.book.deletedAt) throw ApiError.conflict(`${item.book.title} is no longer available`);
    return sum.add(sellingPrice(item.book.price, item.book.compareAtPrice).mul(item.quantity));
  }, new Prisma.Decimal(0));

  let promo: { id: string; code: string; discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'; value: Prisma.Decimal; maxDiscountAmount: Prisma.Decimal | null; minOrderAmount: Prisma.Decimal | null; perUserLimit: number | null; usageLimit: number | null } | null = null;
  let discount = new Prisma.Decimal(0);
  let freeShipping = false;
  if (input.promoCode) {
    const code = input.promoCode.trim().toUpperCase();
    promo = await prisma.promo.findFirst({ where: { code, isActive: true, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] } });
    if (!promo) throw ApiError.badRequest('Promo code is invalid or expired');
    if (promo.minOrderAmount && subtotal.lessThan(promo.minOrderAmount)) throw ApiError.badRequest('Promo code minimum order amount not met');
    if (promo.perUserLimit && await prisma.promoRedemption.count({ where: { promoId: promo.id, userId } }) >= promo.perUserLimit) throw ApiError.conflict('Promo code usage limit reached');
    if (promo.usageLimit && await prisma.promoRedemption.count({ where: { promoId: promo.id } }) >= promo.usageLimit) throw ApiError.conflict('Promo code usage limit reached');
    discount = promoDiscount(promo.discountType, promo.value, subtotal, promo.maxDiscountAmount);
    freeShipping = promo.discountType === 'FREE_SHIPPING';
  }
  /**
   * Loyalty tier, applied automatically: holding N points earns X% off. The
   * points are never spent, they only qualify the balance, so nothing has to be
   * refunded if the order is cancelled. The tier is snapshotted onto the order
   * because the balance changes later.
   */
  const tierInfo = describeTiers(await setting<unknown>(POINT_DISCOUNT_SETTING, []), user.points);
  const pointsDiscount = discountFor(subtotal, tierInfo.discountPercent);
  const afterDiscount = Prisma.Decimal.max(0, subtotal.sub(discount).sub(pointsDiscount));
  let shippingFee = freeShipping ? new Prisma.Decimal(0) : money(await setting<number>('storeShippingFee', 0));
  let totalAmount = money(afterDiscount.add(shippingFee));
  const address = input.shippingAddress ?? {};
  const shippingAddress = { fullName: address.fullName ?? address.recipientName ?? user.displayName, phone: address.phone ?? customerPhone, city: address.city ?? '', address: address.address ?? address.line1 ?? '', postalCode: address.postalCode, note: address.note };
  if (!shippingAddress.city || !shippingAddress.address) throw ApiError.badRequest('Shipping address is required');
  /** Reported back so the app can say where the order notification went. */
  let offlineEmail = false;

  const provider = simulated && cardPayment(input.paymentMethod) ? 'MOCK' : 'STRIPE';
  const orderSource = input.source ?? 'MOBILE';
  const order = await prisma.$transaction(async (tx) => {
    /**
     * Promo usage limits are a race by nature: two checkouts can both read
     * "one slot left" and both create a redemption. The row lock serialises the
     * check+insert, and everything happens on `tx` so a later stock failure
     * rolls the redemption back too. (The old code called
     * `prisma.promoRedemption.create` inside the callback, which runs outside
     * the transaction.)
     */
    if (input.promoCode && promo) {
      const locked = await tx.promo.findFirst({
        where: {
          id: promo.id,
          isActive: true,
          startsAt: { lte: new Date() },
          OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
        },
      });
      if (!locked) throw ApiError.badRequest('Promo code is invalid or expired');
      await tx.$queryRaw`SELECT id FROM "Promo" WHERE id = ${locked.id} FOR UPDATE`;
      if (locked.minOrderAmount && subtotal.lessThan(locked.minOrderAmount)) {
        throw ApiError.badRequest('Promo code minimum order amount not met');
      }
      if (locked.perUserLimit && (await tx.promoRedemption.count({ where: { promoId: locked.id, userId } })) >= locked.perUserLimit) {
        throw ApiError.conflict('Promo code usage limit reached');
      }
      if (locked.usageLimit && (await tx.promoRedemption.count({ where: { promoId: locked.id } })) >= locked.usageLimit) {
        throw ApiError.conflict('Promo code usage limit reached');
      }
      // Recompute from the locked row so an admin edit during checkout cannot
      // leave the order using stale discount values.
      discount = promoDiscount(locked.discountType, locked.value, subtotal, locked.maxDiscountAmount);
      freeShipping = locked.discountType === 'FREE_SHIPPING';
      shippingFee = freeShipping ? new Prisma.Decimal(0) : money(await setting<number>('storeShippingFee', 0));
      totalAmount = money(Prisma.Decimal.max(0, subtotal.sub(discount).sub(pointsDiscount)).add(shippingFee));
    }
    for (const item of cart.items) {
      const reserved = await tx.book.updateMany({ where: { id: item.bookId, isActive: true, deletedAt: null, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
      if (!reserved.count) throw new ApiError(409, 'INSUFFICIENT_STOCK', `${item.book.title} is out of stock`);
    }
    const created = await tx.order.create({ data: { orderNumber: orderNumber(), userId, cartId: cart.id, status: provider === 'MOCK' ? 'CONFIRMED' : 'PENDING', source: orderSource, customerEmail, customerPhone, currency: cart.currency, subtotal, discountAmount: money(discount.add(pointsDiscount)), discountTierPoints: tierInfo.tierPoints, pointDiscountPercent: new Prisma.Decimal(tierInfo.discountPercent), shippingFee, totalAmount, ...(provider === 'MOCK' ? { confirmedAt: new Date() } : {}), promoCodeSnapshot: promo?.code, shippingAddress, items: { create: cart.items.map((item) => { const unit = sellingPrice(item.book.price, item.book.compareAtPrice); return { bookId: item.bookId, sku: item.book.sku, title: item.book.title, author: item.book.author, unitPrice: unit, quantity: item.quantity, totalPrice: unit.mul(item.quantity) }; }) }, payments: { create: { provider: provider === 'MOCK' ? 'MOCK' : 'STRIPE', method: input.paymentMethod ?? 'CARD', status: provider === 'MOCK' ? 'PAID' : 'PENDING', amount: totalAmount, currency: cart.currency, ...(provider === 'MOCK' ? { paidAt: new Date(), processedAt: new Date(), providerPaymentId: `mock_${randomBytes(8).toString('hex')}`, providerData: { simulated: true, ...(card ? { cardBrand: card.brand, last4: card.last4 } : {}) } } : {}) } } }, include: { items: true, payments: true } });
    if (promo) await tx.promoRedemption.create({ data: { promoId: promo.id, orderId: created.id, userId, discountAmount: discount } });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { status: 'CONVERTED' } });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const persistedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, payments: true } });
  const payment = persistedOrder.payments[0];

  /**
   * Simulated card payment: the order is already marked paid above, so there is
   * nothing to hand off to. Reported back explicitly so the UI can say the
   * charge was simulated rather than silently pretending it was real.
   */
  if (provider === 'MOCK') {
    await notifyUser(userId, 'ORDER_UPDATE', 'Sifarişiniz qeydə alındı', `Sifariş ${persistedOrder.orderNumber} — test ödəniş simulyasiya edildi.`).catch(() => undefined);
    return { order: persistedOrder, checkout: { id: `mock_${persistedOrder.id}`, sessionId: null, url: null }, requiresManualPayment: false, mocked: true };
  }

  if (!cardPayment(input.paymentMethod)) {
    // The shop has to learn about the order: with no Stripe there is no card
    // charge, so this email is the only signal that money is incoming.
    const method = input.paymentMethod === 'CASH_ON_DELIVERY' ? 'CASH_ON_DELIVERY' : 'BANK_TRANSFER';
    const [emailResult] = await Promise.all([
      notifyOrderOffline({
        to: orderNotificationAddress(),
        orderNumber: persistedOrder.orderNumber,
        total: Number(persistedOrder.totalAmount),
        method,
        customerName: shippingAddress.fullName ?? null,
        customerPhone: shippingAddress.phone ?? null,
        city: shippingAddress.city,
        address: shippingAddress.address,
        // The number of books, not the number of order lines: two lines of one
        // book each is two books, and that is what the shop has to pack.
        itemCount: persistedOrder.items.reduce((sum, item) => sum + item.quantity, 0),
        // The order lines, so the shop knows which books to pack before it
        // calls the customer.
        items: persistedOrder.items.map((item) => ({
          title: item.title,
          author: item.author,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
      }),
      notifyUser(
        userId,
        'ORDER_UPDATE',
        'Sifarişiniz qeydə alındı',
        `Sifariş ${persistedOrder.orderNumber} ${method === 'CASH_ON_DELIVERY' ? 'nağd ödənişlə' : 'bank köçürməsi ilə'} gözləyir.`,
      ).catch(() => undefined),
    ]);
    offlineEmail = emailResult?.delivered ?? false;
    return { order: persistedOrder, checkout: null, requiresManualPayment: true, notifiedEmail: orderNotificationAddress(), emailDelivered: offlineEmail };
  }

  const checkout = await createCheckout(persistedOrder, payment!.id);
  return { order: persistedOrder, checkout, requiresManualPayment: false, mocked: false };
}

export async function createCheckout(order: { id: string; orderNumber: string; userId: string | null; totalAmount: Prisma.Decimal }, paymentId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({ mode: 'payment', line_items: [{ quantity: 1, price_data: { currency: env.PAYMENT_CURRENCY.toLowerCase(), unit_amount: Math.round(Number(order.totalAmount) * 100), product_data: { name: `Fegih order ${order.orderNumber}` } } }], metadata: { orderId: order.id, userId: order.userId ?? '' }, success_url: `${env.APP_PUBLIC_URL}/orders/${order.id}?payment=success`, cancel_url: `${env.APP_PUBLIC_URL}/orders/${order.id}?payment=cancelled` }, { idempotencyKey: `order-${order.id}` });
  await prisma.payment.update({ where: { id: paymentId }, data: { providerPaymentId: session.id, providerData: { checkoutSessionId: session.id } } });
  return { id: session.id, sessionId: session.id, url: session.url };
}