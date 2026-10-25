import { Prisma } from '../../config/prisma-client.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { ApiError } from '../../lib/api-error.js';
import { notifyOfflineOrderPaid } from '../auth/mailer.js';
import { serializeOrder } from '../../lib/serialize-order.js';
import { notifyUser } from '../notifications/service.js';

const auth = [requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR')] as const;

export const adminAchievementsRouter = Router();
adminAchievementsRouter.use(...auth);
const achievementSchema = z.object({ code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), description: z.string().max(5000).nullable().optional(), type: z.enum(['QUIZ', 'LEARNING', 'SOCIAL', 'STORE', 'STREAK', 'COLLECTION']).default('QUIZ'), condition: z.record(z.string(), z.unknown()).default({ metric: 'TOTAL_GAMES', target: 1 }), pointsReward: z.number().int().min(0).max(1_000_000).default(0), isActive: z.boolean().default(true) });
adminAchievementsRouter.get('/', async (request, response) => { const { page, limit, skip } = getPagination(request); const [data, total] = await prisma.$transaction([prisma.achievement.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }), prisma.achievement.count()]); response.json({ data: data.map((item) => ({ ...item, title: item.name, icon: item.iconUrl, points: item.pointsReward })), meta: paginationMeta(page, limit, total) }); });
adminAchievementsRouter.post('/', writeLimiter, async (request, response) => { const input = parse(achievementSchema, request.body); const data = { ...input, condition: input.condition as Prisma.InputJsonValue } as Prisma.AchievementUncheckedCreateInput; response.status(201).json({ data: await prisma.achievement.create({ data }) }); });
adminAchievementsRouter.patch('/:id', writeLimiter, async (request, response) => { const input = parse(achievementSchema.partial(), request.body); const data = { ...input, ...(input.condition !== undefined ? { condition: input.condition as Prisma.InputJsonValue } : {}) } as Prisma.AchievementUncheckedUpdateInput; response.json({ data: await prisma.achievement.update({ where: { id: z.string().cuid().parse(request.params.id) }, data }) }); });
adminAchievementsRouter.delete('/:id', writeLimiter, async (request, response) => { await prisma.achievement.update({ where: { id: z.string().cuid().parse(request.params.id) }, data: { isActive: false } }); response.status(204).send(); });

export const adminMissionsRouter = Router();
adminMissionsRouter.use(...auth);
const missionSchema = z.object({ code: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(160), description: z.string().max(5000).nullable().optional(), type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'LIFETIME']).default('DAILY'), metric: z.string().trim().min(1).max(80), targetCount: z.number().int().min(1).max(1_000_000), pointsReward: z.number().int().min(0).max(1_000_000).default(0), condition: z.record(z.string(), z.unknown()).nullable().optional(), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional(), isActive: z.boolean().default(true) });
adminMissionsRouter.get('/', async (request, response) => { const { page, limit, skip } = getPagination(request); const [data, total] = await prisma.$transaction([prisma.mission.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit }), prisma.mission.count()]); response.json({ data: data.map((item) => ({ ...item, name: item.title, target: item.targetCount, rewardPoints: item.pointsReward, points: item.pointsReward })), meta: paginationMeta(page, limit, total) }); });
adminMissionsRouter.post('/', writeLimiter, async (request, response) => { const input = parse(missionSchema, request.body); const data = { ...input, ...(input.condition !== null && input.condition !== undefined ? { condition: input.condition as Prisma.InputJsonValue } : {}) } as Prisma.MissionUncheckedCreateInput; response.status(201).json({ data: await prisma.mission.create({ data }) }); });
adminMissionsRouter.patch('/:id', writeLimiter, async (request, response) => { const input = parse(missionSchema.partial(), request.body); const data = { ...input, ...(input.condition !== undefined ? { condition: input.condition === null ? Prisma.JsonNull : input.condition as Prisma.InputJsonValue } : {}) } as Prisma.MissionUncheckedUpdateInput; response.json({ data: await prisma.mission.update({ where: { id: z.string().cuid().parse(request.params.id) }, data }) }); });
adminMissionsRouter.delete('/:id', writeLimiter, async (request, response) => { await prisma.mission.update({ where: { id: z.string().cuid().parse(request.params.id) }, data: { isActive: false } }); response.status(204).send(); });

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'ORDER_MANAGER'));
const orderQuery = z.object({ search: z.string().max(100).optional(), status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED']).optional() });
/**
 * Admin view of an order: the shared customer shape plus the two extras the
 * panel needs (how many units, and the shopper's display name).
 */
function serialize(order: any) { return { ...serializeOrder(order), itemCount: order.items?.reduce((sum: number, item: any) => sum + item.quantity, 0) ?? 0, user: order.user ? { ...order.user, fullName: order.user.displayName } : null }; }
adminOrdersRouter.get('/', async (request, response) => { const query = parse(orderQuery, request.query); const { page, limit, skip } = getPagination(request); const where = { ...(query.status ? { status: query.status } : {}), ...(query.search ? { OR: [{ orderNumber: { contains: query.search, mode: 'insensitive' as const } }, { customerEmail: { contains: query.search, mode: 'insensitive' as const } }] } : {}) }; const [data, total] = await prisma.$transaction([prisma.order.findMany({ where, orderBy: { placedAt: 'desc' }, skip, take: limit, include: { user: { select: { id: true, username: true, displayName: true, email: true } }, items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } } }), prisma.order.count({ where })]); response.json({ data: data.map(serialize), meta: paginationMeta(page, limit, total) }); });
adminOrdersRouter.patch('/:orderId/status', writeLimiter, async (request, response) => { const id = z.string().cuid().parse(request.params.orderId); const { status } = parse(z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED']) }), request.body); const order = await prisma.order.update({ where: { id }, data: { status, ...(status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}), ...(status === 'SHIPPED' ? { shippedAt: new Date() } : {}), ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}), ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}) }, include: { items: true, payments: true, user: { select: { id: true, username: true, displayName: true, email: true } } } }); response.json({ data: serialize(order) }); });
/**
 * Marks an offline order as paid. Cash and bank-transfer orders settle outside
 * Stripe, so they have no webhook to do this — an admin confirms the money
 * arrived, and the shopper is emailed.
 */
adminOrdersRouter.post('/:orderId/mark-paid', writeLimiter, async (request, response) => {
  const id = z.string().cuid().parse(request.params.orderId);
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id }, include: { payments: { where: { status: 'PENDING' } }, user: { select: { email: true, displayName: true, username: true } } } });
    if (!current) throw ApiError.notFound('Order not found');
    if (current.status !== 'PENDING') throw ApiError.conflict('Only pending orders can be marked as paid');
    const payment = current.payments[0];
    if (payment) await tx.payment.update({ where: { id: payment.id }, data: { status: 'PAID', paidAt: new Date(), processedAt: new Date() } });
    return tx.order.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date() }, include: { items: true, payments: true, user: { select: { id: true, username: true, displayName: true, email: true } } } });
  });
  const email = order.user?.email;
  if (email) {
    await notifyOfflineOrderPaid({ to: email, orderNumber: order.orderNumber, total: Number(order.totalAmount), customerName: order.user?.displayName ?? order.user?.username })
      .catch(() => undefined);
    await notifyUser(order.user!.id, 'ORDER_UPDATE', 'Sifarişiniz təsdiqləndi', `Sifariş ${order.orderNumber} ödəniş alındı.`).catch(() => undefined);
  }
  response.json({ data: serializeOrder(order) });
});
