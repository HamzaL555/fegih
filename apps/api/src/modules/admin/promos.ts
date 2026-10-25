import { Prisma } from '../../config/prisma-client.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

const schema = z.object({
  code: z.string().trim().min(3).max(80).regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(160),
  description: z.string().max(2000).nullable().optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.union([z.string(), z.number()]).transform((value) => Number(value)),
  currency: z.string().length(3).toUpperCase().nullable().optional(),
  minOrderAmount: z.union([z.string(), z.number()]).transform(Number).nullable().optional(),
  maxDiscountAmount: z.union([z.string(), z.number()]).transform(Number).nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  appliesToAll: z.boolean().default(false),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const adminPromosRouter = Router();
adminPromosRouter.use(requireAuth, requireAdmin('SUPER_ADMIN', 'ADMIN', 'EDITOR'));
adminPromosRouter.get('/', async (request, response) => { const { page, limit, skip } = getPagination(request); const [data, total] = await prisma.$transaction([prisma.promo.findMany({ orderBy: { createdAt: 'desc' }, skip, take: limit, include: { _count: { select: { redemptions: true } } } }), prisma.promo.count()]); response.json({ data: data.map((item) => ({ ...item, value: item.value.toString(), minOrderAmount: item.minOrderAmount?.toString(), maxDiscountAmount: item.maxDiscountAmount?.toString(), usedCount: item._count.redemptions })), meta: paginationMeta(page, limit, total) }); });
adminPromosRouter.post('/', writeLimiter, async (request, response) => { const input = parse(schema, request.body); const data = { ...input, conditions: input.conditions && input.conditions !== null ? input.conditions as Prisma.InputJsonValue : undefined } as Prisma.PromoUncheckedCreateInput; response.status(201).json({ data: await prisma.promo.create({ data }) }); });
adminPromosRouter.patch('/:promoId', writeLimiter, async (request, response) => { const promoId = z.string().cuid().parse(request.params.promoId); const input = parse(schema.partial(), request.body); const data = { ...input, ...(input.conditions !== undefined ? { conditions: input.conditions === null ? Prisma.JsonNull : input.conditions as Prisma.InputJsonValue } : {}) } as Prisma.PromoUncheckedUpdateInput; response.json({ data: await prisma.promo.update({ where: { id: promoId }, data }) }); });
adminPromosRouter.delete('/:promoId', writeLimiter, async (request, response) => { await prisma.promo.update({ where: { id: z.string().cuid().parse(request.params.promoId) }, data: { isActive: false } }); response.status(204).send(); });
