import { Prisma } from '../../config/prisma-client.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { POINT_DISCOUNT_SETTING, describeTiers, discountFor } from '../../lib/point-discount.js';

/** Rounds to 2 decimals without drifting on repeated additions. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getOrCreateCart(userId: string) {
  // A cart is a 1:1 companion to the order it produced (`Order.cartId` is
  // unique). Reopening a converted cart therefore made the *next* order fail
  // with a unique violation, so a converted cart is left alone for the record
  // and a fresh one is started for the shopper.
  const active = await prisma.cart.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
  if (active) return active;
  return prisma.cart.create({ data: { userId, status: 'ACTIVE' } });
}

async function loadCart(userId: string) {
  // Keyed on the cart itself, not `userId`: a user accumulates one row per
  // order, and only the newest ACTIVE one is the live basket.
  return prisma.cart.findFirstOrThrow({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
        include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true, stock: true, price: true, compareAtPrice: true, currency: true, isActive: true, deletedAt: true } } },
      },
    },
  });
}

export async function getCart(userId: string) {
  await getOrCreateCart(userId);
  const cart = await loadCart(userId);
  const items = cart.items.map((item) => {
    const price = Number(item.book.price);
    const compareAt = item.book.compareAtPrice == null ? price : Number(item.book.compareAtPrice);
    const unitPrice = compareAt < price ? compareAt : price;
    return {
      id: item.id,
      bookId: item.bookId,
      quantity: item.quantity,
      unitPrice,
      lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
      currency: item.book.currency,
      book: { ...item.book, image: item.book.coverImageUrl, coverImage: item.book.coverImageUrl, price, finalPrice: unitPrice, inStock: item.book.stock >= item.quantity },
    };
  });
  const subtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
  /**
   * Loyalty tier preview. The cart mirrors what checkout will charge so the
   * saving is visible before the order is placed; the order itself recomputes it
   * from the live balance.
   */
  const [user, tierSetting] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { points: true } }),
    prisma.systemSetting.findUnique({ where: { key: POINT_DISCOUNT_SETTING }, select: { value: true } }),
  ]);
  const tier = describeTiers(tierSetting?.value, user?.points ?? 0);
  const pointDiscount = Number(discountFor(new Prisma.Decimal(subtotal), tier.discountPercent));
  const shippingFee = money(Number((await prisma.systemSetting.findUnique({ where: { key: 'storeShippingFee' }, select: { value: true } }))?.value ?? 0));
  return {
    id: cart.id,
    currency: cart.currency,
    items,
    subtotal,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    points: user?.points ?? 0,
    pointDiscount,
    discountPercent: tier.discountPercent,
    discountTierPoints: tier.tierPoints,
    nextTierPoints: tier.nextTierPoints,
    nextTierPercent: tier.nextTierPercent,
    pointsToNextTier: tier.pointsToNextTier,
    total: money(Math.max(0, subtotal - pointDiscount)),
    shippingFee,
    updatedAt: cart.updatedAt,
  };
}

export async function setCartItem(userId: string, bookId: string, quantity: number) {
  const book = await prisma.book.findFirst({ where: { id: bookId, isActive: true, deletedAt: null }, select: { id: true, stock: true, price: true, compareAtPrice: true } });
  if (!book) throw ApiError.notFound('Book not found');
  const cart = await getOrCreateCart(userId);
  const existing = await prisma.cartItem.findUnique({ where: { cartId_bookId: { cartId: cart.id, bookId } }, select: { quantity: true } });
  if (quantity === 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, bookId } });
    return getCart(userId);
  }
  if (book.stock < (existing?.quantity ?? 0) + quantity) throw new ApiError(409, 'INSUFFICIENT_STOCK', `Yalnız ${book.stock} ədəd məhsul mövcuddur`, { available: book.stock });
  const unitPrice = book.compareAtPrice && book.compareAtPrice.lessThan(book.price) ? book.compareAtPrice : book.price;
  await prisma.cartItem.upsert({
    where: { cartId_bookId: { cartId: cart.id, bookId } },
    update: { quantity: { increment: quantity }, unitPrice },
    create: { cartId: cart.id, bookId, quantity, unitPrice },
  });
  return getCart(userId);
}

export async function updateCartItem(userId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cart: { userId } }, select: { id: true, book: { select: { stock: true, price: true, compareAtPrice: true, isActive: true, deletedAt: true } } } });
  if (!item || !item.book.isActive || item.book.deletedAt) throw ApiError.notFound('Cart item not found');
  if (quantity <= 0) await prisma.cartItem.delete({ where: { id: itemId } });
  else {
    if (item.book.stock < quantity) throw new ApiError(409, 'INSUFFICIENT_STOCK', `Yalnız ${item.book.stock} ədəd məhsul mövcuddur`, { available: item.book.stock });
    const unitPrice = item.book.compareAtPrice && item.book.compareAtPrice.lessThan(item.book.price) ? item.book.compareAtPrice : item.book.price;
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity, unitPrice } });
  }
  return getCart(userId);
}

export async function removeCartItem(userId: string, itemId: string) {
  const deleted = await prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
  if (!deleted.count) throw ApiError.notFound('Cart item not found');
  return getCart(userId);
}

export async function clearCart(userId: string) {
  const cart = await getOrCreateCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(userId);
}
