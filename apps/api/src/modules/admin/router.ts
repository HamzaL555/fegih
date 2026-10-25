import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { uploadImageHandler } from '../uploads/routes.js';
import { getDashboard } from './dashboard.js';
import { adminUsersRouter } from './users.js';
import { adminBooksRouter, adminBookCategoriesRouter } from './books.js';
import { adminQuestionsRouter, adminQuestionCategoriesRouter, adminQuestionLevelsRouter } from './questions.js';
import { adminQuestionImportRouter } from './import.js';
import { adminRewardsRouter, adminSettingsRouter } from './rewards.js';
import { adminAchievementsRouter, adminMissionsRouter, adminOrdersRouter } from './content.js';
import { adminPromosRouter } from './promos.js';
import { adminRolesRouter } from './roles.js';
import { adminReviewsRouter } from './reviews.js';
import { adminAyahRouter, adminInfoRouter, adminEventsRouter } from './islamic-content.js';
import { adminMessagesRouter } from '../messages/routes.js';

export const adminRouter = Router();
adminRouter.get('/dashboard', requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN'), async (_request, response) => response.json({ data: await getDashboard() }));
adminRouter.use('/users', adminUsersRouter);
adminRouter.use('/roles', adminRolesRouter);
adminRouter.use('/questions/import', adminQuestionImportRouter);
adminRouter.use('/questions', adminQuestionsRouter);
adminRouter.use('/question-categories', adminQuestionCategoriesRouter);
adminRouter.use('/question-levels', adminQuestionLevelsRouter);
adminRouter.use('/books', adminBooksRouter);
adminRouter.use('/reviews', adminReviewsRouter);
adminRouter.use('/daily-ayah', adminAyahRouter);
adminRouter.use('/islamic-info', adminInfoRouter);
adminRouter.use('/events', adminEventsRouter);
adminRouter.use('/book-categories', adminBookCategoriesRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/promos', adminPromosRouter);
adminRouter.use('/rewards', adminRewardsRouter);
adminRouter.use('/achievements', adminAchievementsRouter);
adminRouter.use('/missions', adminMissionsRouter);
adminRouter.use('/settings', adminSettingsRouter);
adminRouter.use('/messages', adminMessagesRouter);
adminRouter.get('/notifications', requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN'), async (request, response) => {
  const query = parse(z.object({ search: z.string().trim().max(100).optional(), read: z.enum(['all', 'read', 'unread']).default('all') }), request.query);
  const { page, limit, skip } = getPagination(request);
  // `search` was submitted by the panel but never read, so the box did nothing.
  const where = {
    ...(query.read === 'read' ? { readAt: { not: null } } : query.read === 'unread' ? { readAt: null } : {}),
    ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' as const } }, { body: { contains: query.search, mode: 'insensitive' as const } }] } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { user: { select: { id: true, username: true, email: true } } } }),
    prisma.notification.count({ where }),
  ]);
  // The panel renders `message` / `isRead`; the model stores `body` / `readAt`.
  const data = rows.map((row) => ({ ...row, message: row.body, isRead: row.readAt !== null }));
  response.json({ data, meta: paginationMeta(page, limit, total) });
});
adminRouter.post('/uploads', requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR'), ...uploadImageHandler);
