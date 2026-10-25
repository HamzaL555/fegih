import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

export const adminReviewsRouter = Router();
adminReviewsRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR'));
adminReviewsRouter.get('/', async (request, response) => { const { page, limit, skip } = getPagination(request); const [data, total] = await prisma.$transaction([prisma.bookReview.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit, include: { book: { select: { id: true, title: true } }, user: { select: { id: true, username: true, displayName: true } } } }), prisma.bookReview.count()]); response.json({ data, meta: paginationMeta(page, limit, total) }); });
adminReviewsRouter.patch('/:reviewId', writeLimiter, async (request, response) => { const reviewId = z.string().cuid().parse(request.params.reviewId); const { isApproved } = parse(z.object({ isApproved: z.boolean() }), request.body); const review = await prisma.$transaction(async (tx) => { const updated = await tx.bookReview.update({ where: { id: reviewId }, data: { isApproved } }); const aggregate = await tx.bookReview.aggregate({ where: { bookId: updated.bookId, isApproved: true }, _avg: { rating: true }, _count: true }); await tx.book.update({ where: { id: updated.bookId }, data: { rating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count } }); return updated; }); response.json({ data: review }); });
adminReviewsRouter.delete('/:reviewId', writeLimiter, async (request, response) => { const reviewId = z.string().cuid().parse(request.params.reviewId); await prisma.$transaction(async (tx) => { const review = await tx.bookReview.delete({ where: { id: reviewId } }); const aggregate = await tx.bookReview.aggregate({ where: { bookId: review.bookId, isApproved: true }, _avg: { rating: true }, _count: true }); await tx.book.update({ where: { id: review.bookId }, data: { rating: aggregate._avg.rating ?? 0, reviewCount: aggregate._count } }); }); response.status(204).send(); });
