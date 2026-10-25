import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

const listQuery = z.object({
  categoryId: z.string().cuid().optional(),
  search: z.string().trim().max(100).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'priceAsc', 'priceDesc', 'rating']).default('newest'),
});

const bookSelect = {
  id: true, sku: true, slug: true, title: true, subtitle: true, description: true, author: true,
  publisher: true, language: true, pageCount: true, coverImageUrl: true, price: true,
  compareAtPrice: true, currency: true, stock: true, isActive: true, isFeatured: true, createdAt: true,
  categoryLinks: { take: 1, select: { category: { select: { id: true, name: true, slug: true, iconUrl: true } } } },
  reviews: { where: { isApproved: true }, select: { rating: true } },
} as const;

function serializeBook<T extends { price: unknown; compareAtPrice: unknown; stock: number; coverImageUrl: string | null; reviews: Array<{ rating: number }>; categoryLinks: Array<{ category: unknown }> }>(book: T) {
  const price = Number(book.price);
  const compareAtPrice = book.compareAtPrice == null ? null : Number(book.compareAtPrice);
  const finalPrice = compareAtPrice && compareAtPrice < price ? compareAtPrice : price;
  const discountPercent = price > 0 && finalPrice > price ? Math.round((1 - finalPrice / price) * 10000) / 100 : 0;
  const rating = book.reviews.length ? Math.round((book.reviews.reduce((sum, item) => sum + item.rating, 0) / book.reviews.length) * 100) / 100 : 0;
  const category = book.categoryLinks[0]?.category ?? null;
  return {
    ...book,
    coverImage: book.coverImageUrl,
    image: book.coverImageUrl,
    category,
    categoryId: category && typeof category === 'object' && 'id' in category ? category.id : undefined,
    price,
    compareAtPrice,
    finalPrice,
    discountPercent,
    rating,
    reviewCount: book.reviews.length,
    inStock: book.stock > 0,
  };
}

export const booksRouter = Router();

booksRouter.get('/', async (request, response) => {
  const query = parse(listQuery, request.query);
  const { page, limit, skip } = getPagination(request);
  const where = {
    isActive: true, deletedAt: null,
    ...(query.categoryId ? { categoryLinks: { some: { categoryId: query.categoryId } } } : {}),
    ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' as const } }, { author: { contains: query.search, mode: 'insensitive' as const } }] } : {}),
    ...(query.inStock === 'true' ? { stock: { gt: 0 } } : {}),
  };
  const orderBy = query.sort === 'priceAsc' ? { price: 'asc' as const } : query.sort === 'priceDesc' ? { price: 'desc' as const } : { createdAt: 'desc' as const };
  const [books, total] = await prisma.$transaction([
    prisma.book.findMany({ where, orderBy, skip, take: limit, select: bookSelect }),
    prisma.book.count({ where }),
  ]);
  response.json({ data: books.map(serializeBook), meta: paginationMeta(page, limit, total) });
});

booksRouter.get('/categories', async (_request, response) => {
  const categories = await prisma.bookCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      iconUrl: true,
      _count: { select: { bookLinks: { where: { book: { isActive: true } } } } },
    },
  });
  response.json({ data: categories.map((item) => ({ ...item, image: item.iconUrl, bookCount: item._count.bookLinks })) });
});

booksRouter.get('/wishlist/me', requireAuth, async (request, response) => {
  const { page, limit, skip } = getPagination(request);
  const where = { userId: request.user!.id };
  const [items, total] = await prisma.$transaction([
    prisma.wishlistItem.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, select: { createdAt: true, book: { select: bookSelect } } }),
    prisma.wishlistItem.count({ where }),
  ]);
  response.json({ data: items.map((item) => ({ ...serializeBook(item.book), addedAt: item.createdAt })), meta: paginationMeta(page, limit, total) });
});

booksRouter.get('/:bookId', async (request, response) => {
  const bookId = z.string().cuid().parse(request.params.bookId);
  const book = await prisma.book.findFirst({
    where: { id: bookId, isActive: true, deletedAt: null },
    include: {
      categoryLinks: { include: { category: { select: { id: true, name: true, slug: true, iconUrl: true } } } },
      reviews: { where: { isApproved: true }, orderBy: { createdAt: 'desc' }, take: 30, include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } },
    },
  });
  if (!book) throw ApiError.notFound('Book not found');
  response.json({ data: serializeBook(book) });
});

booksRouter.get('/:bookId/reviews', async (request, response) => {
  const bookId = z.string().cuid().parse(request.params.bookId);
  const { page, limit, skip } = getPagination(request);
  const where = { bookId, isApproved: true };
  const [reviews, total] = await prisma.$transaction([
    prisma.bookReview.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } } }),
    prisma.bookReview.count({ where }),
  ]);
  response.json({ data: reviews, meta: paginationMeta(page, limit, total) });
});

booksRouter.post('/:bookId/reviews', requireAuth, writeLimiter, async (request, response) => {
  const bookId = z.string().cuid().parse(request.params.bookId);
  const input = parse(z.object({ rating: z.number().int().min(1).max(5), title: z.string().trim().max(200).optional(), comment: z.string().trim().min(3).max(3000) }), request.body);
  const [delivered, book] = await Promise.all([
    prisma.orderItem.findFirst({ where: { bookId, order: { userId: request.user!.id, status: 'DELIVERED' } }, select: { id: true } }),
    prisma.book.findFirst({ where: { id: bookId, isActive: true, deletedAt: null }, select: { id: true } }),
  ]);
  if (!book) throw ApiError.notFound('Book not found');
  if (!delivered) throw ApiError.forbidden('Review yazmaq üçün kitabı əvvəlcə sifariş etməlisiniz');
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.bookReview.upsert({
      where: { bookId_userId: { bookId, userId: request.user!.id } },
      update: { rating: input.rating, title: input.title, comment: input.comment, isApproved: false },
      create: { bookId, userId: request.user!.id, rating: input.rating, title: input.title, comment: input.comment, isApproved: false },
    });
    const aggregate = await tx.bookReview.aggregate({ where: { bookId, isApproved: true }, _avg: { rating: true }, _count: true });
    await tx.book.update({ where: { id: bookId }, data: { rating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count } });
    return created;
  });
  response.status(201).json({ data: review });
});

booksRouter.post('/:bookId/wishlist', requireAuth, writeLimiter, async (request, response) => {
  const bookId = z.string().cuid().parse(request.params.bookId);
  if (!await prisma.book.findFirst({ where: { id: bookId, isActive: true, deletedAt: null }, select: { id: true } })) throw ApiError.notFound('Book not found');
  await prisma.wishlistItem.upsert({ where: { userId_bookId: { userId: request.user!.id, bookId } }, update: {}, create: { userId: request.user!.id, bookId } });
  response.status(201).json({ data: { bookId, isFavorite: true } });
});

booksRouter.delete('/:bookId/wishlist', requireAuth, writeLimiter, async (request, response) => {
  const bookId = z.string().cuid().parse(request.params.bookId);
  await prisma.wishlistItem.deleteMany({ where: { userId: request.user!.id, bookId } });
  response.status(204).send();
});
