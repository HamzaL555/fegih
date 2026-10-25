import { Prisma } from '../../config/prisma-client.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

const bookSchema = z.object({ title: z.string().trim().min(1).max(300), author: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(50_000), categoryId: z.string().cuid().nullable().optional(), imageUrl: z.string().url().max(2048).nullable().optional(), coverImageUrl: z.string().url().max(2048).nullable().optional(), bookUrl: z.string().url().max(2048).nullable().optional(), fileUrl: z.string().url().max(2048).nullable().optional(), price: z.union([z.string(), z.number()]).optional(), compareAtPrice: z.union([z.string(), z.number()]).nullable().optional(), stock: z.number().int().min(0).max(1_000_000).optional(), pageCount: z.number().int().min(1).max(100_000).nullable().optional(), publisher: z.string().max(200).nullable().optional(), language: z.string().min(2).max(16).optional(), sku: z.string().max(64).optional(), slug: z.string().max(160).optional(), isActive: z.boolean().optional(), isFeatured: z.boolean().optional() });
const bookPatch = bookSchema.partial();
function slugify(value: string) { return value.toLocaleLowerCase('az').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140) || `book-${Date.now()}`; }
function serialize(book: any) { const category = book.categoryLinks?.[0]?.category; return { ...book, price: Number(book.price), compareAtPrice: book.compareAtPrice == null ? null : Number(book.compareAtPrice), finalPrice: book.compareAtPrice && Number(book.compareAtPrice) < Number(book.price) ? Number(book.compareAtPrice) : Number(book.price), imageUrl: book.coverImageUrl, coverUrl: book.coverImageUrl, image: book.coverImageUrl, categoryId: category?.id, category, rating: book.reviews?.length ? book.reviews.reduce((s: number, r: any) => s + r.rating, 0) / book.reviews.length : 0, reviewCount: book.reviews?.length ?? 0, bookUrl: book.metadata?.bookUrl, fileUrl: book.metadata?.fileUrl }; }

export const adminBooksRouter = Router();
adminBooksRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR'));
adminBooksRouter.get('/', async (request, response) => { const query = parse(z.object({ search: z.string().max(100).optional(), categoryId: z.string().cuid().optional(), includeInactive: z.enum(['true', 'false']).default('true') }), request.query); const { page, limit, skip } = getPagination(request); const where = { deletedAt: null, ...(query.includeInactive === 'true' ? {} : { isActive: true }), ...(query.categoryId ? { categoryLinks: { some: { categoryId: query.categoryId } } } : {}), ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' as const } }, { author: { contains: query.search, mode: 'insensitive' as const } }] } : {}) }; const [data, total] = await prisma.$transaction([prisma.book.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { categoryLinks: { include: { category: true } }, reviews: { where: { isApproved: true }, select: { rating: true } } } }), prisma.book.count({ where })]); response.json({ data: data.map(serialize), meta: paginationMeta(page, limit, total) }); });
adminBooksRouter.post('/', writeLimiter, async (request, response) => {
  const input = parse(bookSchema, request.body);
  const sku = input.sku ?? `BOOK-${Date.now()}`;
  const slug = input.slug ?? slugify(input.title);
  const metadata = input.bookUrl !== undefined || input.fileUrl !== undefined
    ? { bookUrl: input.bookUrl ?? null, fileUrl: input.fileUrl ?? null }
    : undefined;
  const book = await prisma.book.create({
    data: {
      sku, slug, title: input.title, author: input.author, description: input.description,
      coverImageUrl: input.imageUrl ?? input.coverImageUrl ?? null,
      price: new Prisma.Decimal(input.price ?? 0),
      compareAtPrice: input.compareAtPrice == null ? null : new Prisma.Decimal(input.compareAtPrice),
      stock: input.stock ?? 0, pageCount: input.pageCount, publisher: input.publisher,
      language: input.language ?? 'az', isActive: input.isActive ?? true, isFeatured: input.isFeatured ?? false,
      metadata,
      categoryLinks: input.categoryId ? { create: [{ categoryId: input.categoryId }] } : undefined,
      createdById: request.user!.id,
    },
    include: { categoryLinks: { include: { category: true } }, reviews: true },
  });
  response.status(201).json({ data: serialize(book) });
});
adminBooksRouter.patch('/:bookId', writeLimiter, async (request, response) => {
  const id = z.string().cuid().parse(request.params.bookId);
  const input = parse(bookPatch, request.body);
  const { categoryId, imageUrl, coverImageUrl, bookUrl, fileUrl, ...fields } = input;
  const book = await prisma.$transaction(async (tx) => {
    if (categoryId !== undefined) {
      await tx.bookCategoryLink.deleteMany({ where: { bookId: id } });
      if (categoryId) await tx.bookCategoryLink.create({ data: { bookId: id, categoryId } });
    }
    const metadata = bookUrl !== undefined || fileUrl !== undefined
      ? { bookUrl: bookUrl ?? null, fileUrl: fileUrl ?? null }
      : undefined;
    return tx.book.update({
      where: { id },
      data: {
        ...fields,
        ...(imageUrl !== undefined || coverImageUrl !== undefined ? { coverImageUrl: imageUrl ?? coverImageUrl ?? null } : {}),
        ...(metadata ? { metadata } : {}),
        ...(fields.price !== undefined ? { price: new Prisma.Decimal(fields.price) } : {}),
        ...(fields.compareAtPrice !== undefined ? { compareAtPrice: fields.compareAtPrice == null ? null : new Prisma.Decimal(fields.compareAtPrice) } : {}),
      },
      include: { categoryLinks: { include: { category: true } }, reviews: { where: { isApproved: true }, select: { rating: true } } },
    });
  });
  response.json({ data: serialize(book) });
});
adminBooksRouter.delete('/:bookId', writeLimiter, async (request, response) => { await prisma.book.update({ where: { id: z.string().cuid().parse(request.params.bookId) }, data: { isActive: false, deletedAt: new Date() } }); response.status(204).send(); });

const categorySchema = z.object({ name: z.string().trim().min(1).max(120), slug: z.string().trim().min(1).max(140).regex(/^[a-z0-9-]+$/), description: z.string().max(2000).nullable().optional(), iconUrl: z.string().url().nullable().optional(), isActive: z.boolean().optional() });
export const adminBookCategoriesRouter = Router();
adminBookCategoriesRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR'));
adminBookCategoriesRouter.get('/', async (_request, response) => response.json({ data: await prisma.bookCategory.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }], include: { _count: { select: { bookLinks: true } } } }) }));
adminBookCategoriesRouter.post('/', writeLimiter, async (request, response) => response.status(201).json({ data: await prisma.bookCategory.create({ data: parse(categorySchema, request.body) }) }));
adminBookCategoriesRouter.patch('/:categoryId', writeLimiter, async (request, response) => response.json({ data: await prisma.bookCategory.update({ where: { id: z.string().cuid().parse(request.params.categoryId) }, data: parse(categorySchema.partial(), request.body) }) }));
adminBookCategoriesRouter.delete('/:categoryId', writeLimiter, async (request, response) => { await prisma.bookCategory.update({ where: { id: z.string().cuid().parse(request.params.categoryId) }, data: { isActive: false } }); response.status(204).send(); });
