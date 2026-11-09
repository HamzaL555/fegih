import { Router } from 'express';
import { prisma } from './config/prisma.js';
import { requireAuth } from './middleware/auth.js';
import { writeLimiter } from './middleware/rate-limit.js';
import { parse } from './lib/zod.js';
import { z } from 'zod';
import { healthRouter } from './modules/health/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { questionsRouter } from './modules/questions/routes.js';
import { quizRouter } from './modules/quiz/routes.js';
import { leaderboardRouter } from './modules/leaderboard/routes.js';
import { rewardsRouter } from './modules/rewards/routes.js';
import { achievementsRouter } from './modules/achievements/routes.js';
import { missionsRouter } from './modules/missions/routes.js';
import { booksRouter } from './modules/books/routes.js';
import { quranRouter } from './modules/quran/routes.js';
import { categoriesRouter } from './modules/books/category-routes.js';
import { cartRouter } from './modules/cart/routes.js';
import { pointDiscountRouter } from './modules/store/point-discount-routes.js';
import { messagesRouter } from './modules/messages/routes.js';
import { ordersRouter } from './modules/orders/routes.js';
import { certificatesRouter } from './modules/certificates/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { islamicRouter, tasbeehRouter } from './modules/islamic/routes.js';
import { uploadsRouter } from './modules/uploads/routes.js';
import { adminRouter } from './modules/admin/router.js';
import { jobsRouter } from './modules/jobs/routes.js';

export const apiRouter = Router();
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/questions', questionsRouter);
apiRouter.use('/quiz', quizRouter);
apiRouter.use('/leaderboard', leaderboardRouter);
apiRouter.use('/rewards', rewardsRouter);
apiRouter.use('/achievements', achievementsRouter);
apiRouter.use('/missions', missionsRouter);
apiRouter.use('/books', booksRouter);
apiRouter.use('/quran', quranRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/store/point-discount', pointDiscountRouter);
apiRouter.use('/messages', messagesRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/certificates', certificatesRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/islamic', islamicRouter);
apiRouter.use('/tasbeeh', tasbeehRouter);
apiRouter.use('/uploads', uploadsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/jobs', jobsRouter);

// Short paths used by the mobile client (`/daily-ayah`, `/islamic-info`, `/calendar`).
apiRouter.use('/', islamicRouter);

const settingsRouter = Router();
settingsRouter.get('/', async (_request, response) => {
  const settings = await prisma.systemSetting.findMany({ where: { isPublic: true }, orderBy: { group: 'asc' } });
  response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
  response.json({ data: Object.fromEntries(settings.map((item) => [item.key, item.value])) });
});
settingsRouter.get('/preferences', requireAuth, async (request, response) => {
  const preference = await prisma.userPreference.findUnique({ where: { userId: request.user!.id } });
  response.json({ data: preference });
});
settingsRouter.put('/preferences', requireAuth, writeLimiter, async (request, response) => {
  const input = parse(z.object({ language: z.enum(['az', 'tr', 'en', 'ar']).optional(), theme: z.enum(['SYSTEM', 'LIGHT', 'DARK']).optional(), timezone: z.string().max(64).optional(), reducedMotion: z.boolean().optional(), marketingEmails: z.boolean().optional(), quietHoursStart: z.string().max(5).nullable().optional(), quietHoursEnd: z.string().max(5).nullable().optional() }), request.body);
  const preference = await prisma.userPreference.upsert({ where: { userId: request.user!.id }, update: input, create: { userId: request.user!.id, ...input } });
  if (input.language) await prisma.user.update({ where: { id: request.user!.id }, data: { preferredLocale: input.language } });
  response.json({ data: preference });
});
apiRouter.use('/settings', settingsRouter);
