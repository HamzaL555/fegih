import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

const categories = ['DAILY_AYAH', 'DAILY_ISLAMIC_INFO', 'PRAYER', 'DAILY_MISSION', 'STREAK_REMINDER', 'STORE', 'ORDER_UPDATE', 'NEW_QUIZ_QUESTIONS', 'REWARD'] as const;

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get('/', async (request, response) => {
  const { page, limit, skip } = getPagination(request);
  const unreadOnly = request.query.unreadOnly === 'true';
  const where = { userId: request.user!.id, ...(unreadOnly ? { readAt: null } : {}) };
  const [data, total, unread] = await prisma.$transaction([prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }), prisma.notification.count({ where }), prisma.notification.count({ where: { userId: request.user!.id, readAt: null } })]);
  response.json({ data, meta: { ...paginationMeta(page, limit, total), unread } });
});
notificationsRouter.patch('/read-all', writeLimiter, async (request, response) => { const result = await prisma.notification.updateMany({ where: { userId: request.user!.id, readAt: null }, data: { readAt: new Date() } }); response.json({ data: { updated: result.count } }); });
notificationsRouter.patch('/read', writeLimiter, async (request, response) => { const result = await prisma.notification.updateMany({ where: { userId: request.user!.id, readAt: null }, data: { readAt: new Date() } }); response.json({ data: { updated: result.count } }); });
notificationsRouter.patch('/:notificationId/read', writeLimiter, async (request, response) => { const id = z.string().cuid().parse(request.params.notificationId); const result = await prisma.notification.updateMany({ where: { id, userId: request.user!.id }, data: { readAt: new Date() } }); if (!result.count) throw ApiError.notFound('Notification not found'); response.json({ data: { id, read: true } }); });
notificationsRouter.get('/preferences', async (request, response) => { const rows = await prisma.notificationPreference.findMany({ where: { userId: request.user!.id } }); response.json({ data: Object.fromEntries(categories.map((category) => [category, rows.find((row) => row.category === category && row.channel === 'PUSH')?.isEnabled ?? true])) }); });
notificationsRouter.put('/preferences', writeLimiter, async (request, response) => { const input = parse(z.object(Object.fromEntries(categories.map((category) => [category, z.boolean()]))), request.body); await prisma.$transaction(categories.map((category) => prisma.notificationPreference.upsert({ where: { userId_channel_category: { userId: request.user!.id, channel: 'PUSH', category } }, update: { isEnabled: input[category] }, create: { userId: request.user!.id, channel: 'PUSH', category, isEnabled: input[category] } }))); response.json({ data: input }); });
notificationsRouter.post('/devices', writeLimiter, async (request, response) => { const input = parse(z.object({ token: z.string().min(20).max(512), platform: z.enum(['ios', 'android', 'web']), deviceName: z.string().max(120).optional(), appVersion: z.string().max(40).optional() }), request.body); const token = await prisma.deviceToken.upsert({ where: { token: input.token }, update: { userId: request.user!.id, platform: input.platform.toUpperCase() as 'IOS' | 'ANDROID' | 'WEB', isActive: true, lastSeenAt: new Date() }, create: { userId: request.user!.id, token: input.token, platform: input.platform.toUpperCase() as 'IOS' | 'ANDROID' | 'WEB', isActive: true, deviceName: input.deviceName, appVersion: input.appVersion } }); response.status(201).json({ data: { id: token.id, registered: true } }); });
notificationsRouter.delete('/devices/:tokenId', writeLimiter, async (request, response) => { await prisma.deviceToken.updateMany({ where: { id: z.string().cuid().parse(request.params.tokenId), userId: request.user!.id }, data: { isActive: false } }); response.status(204).send(); });
