import { Prisma } from '../../config/prisma-client.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/require-permission.js';
import { writeLimiter } from '../../middleware/rate-limit.js';

const roles = requireAdmin('SUPER_ADMIN', 'ADMIN');
const levelsRouter = Router();
levelsRouter.use(requireAuth, roles);
levelsRouter.get('/question-levels', async (_request, response) => response.json({ data: (await prisma.questionLevel.findMany({ orderBy: { position: 'asc' } })).map((level) => ({ ...level, points: level.defaultPoints, order: level.position })) }));
levelsRouter.put('/question-levels', async (request, response) => { const input = parse(z.object({ levels: z.array(z.object({ id: z.string().cuid(), defaultPoints: z.number().int().min(0).max(1_000_000), name: z.string().min(1).max(80).optional(), isActive: z.boolean().optional() })) }), request.body); await prisma.$transaction(input.levels.map((item) => prisma.questionLevel.update({ where: { id: item.id }, data: { defaultPoints: item.defaultPoints, ...(item.name ? { name: item.name } : {}), ...(item.isActive !== undefined ? { isActive: item.isActive } : {}) } }))); response.json({ data: input }); });

const lifelinesRouter = Router();
lifelinesRouter.use(requireAuth, roles);
lifelinesRouter.get('/lifelines', async (_request, response) => { const game = await prisma.quizGame.findFirst({ where: { isActive: true }, orderBy: { position: 'asc' } }); response.json({ data: game ? await prisma.gameLifeline.findMany({ where: { gameId: game.id }, orderBy: { type: 'asc' } }) : [] }); });
lifelinesRouter.put('/lifelines', writeLimiter, async (request, response) => { const input = parse(z.object({ lifelines: z.array(z.object({ id: z.string().cuid(), cost: z.number().int().min(0).max(1_000_000), name: z.string().max(100).optional(), isEnabled: z.boolean().optional() })) }), request.body); await prisma.$transaction(input.lifelines.map((item) => prisma.gameLifeline.update({ where: { id: item.id }, data: { cost: item.cost, ...(item.name ? { name: item.name } : {}), ...(item.isEnabled !== undefined ? { isEnabled: item.isEnabled } : {}) } }))); response.json({ data: input }); });

const settingRouter = Router();
settingRouter.use(requireAuth, roles);
settingRouter.get('/first-login', async (_request, response) => response.json({ data: (await prisma.systemSetting.findUnique({ where: { key: 'welcomeBonus' } }))?.value ?? { points: 0, lifelineType: 'FIFTY_FIFTY', lifelineQuantity: 0 } }));
settingRouter.put('/first-login', writeLimiter, async (request, response) => { const value = parse(z.object({ points: z.number().int().min(0).max(1_000_000), lifelineType: z.enum(['FIFTY_FIFTY', 'SECOND_CHANCE', 'HINT', 'SKIP', 'EXTRA_TIME']).optional(), lifelineQuantity: z.number().int().min(0).max(100).optional() }), request.body); const setting = await prisma.systemSetting.upsert({ where: { key: 'welcomeBonus' }, update: { value: value as Prisma.InputJsonValue, valueType: 'JSON', group: 'rewards', updatedById: request.user!.id }, create: { key: 'welcomeBonus', value, valueType: 'JSON', group: 'rewards', isPublic: false, updatedById: request.user!.id } }); response.json({ data: setting.value }); });
settingRouter.get('/daily-rewards', async (_request, response) => response.json({ data: await prisma.rewardRule.findMany({ where: { event: 'DAILY_LOGIN' }, orderBy: { createdAt: 'asc' } }) }));
settingRouter.put('/daily-rewards', writeLimiter, async (request, response) => { const input = parse(z.object({ rewards: z.array(z.object({ id: z.string().cuid(), amount: z.number().int().min(0).max(1_000_000), name: z.string().max(160).optional(), isActive: z.boolean().optional() })) }), request.body); await prisma.$transaction(input.rewards.map((item) => prisma.rewardRule.update({ where: { id: item.id }, data: { amount: item.amount, ...(item.name ? { name: item.name } : {}), ...(item.isActive !== undefined ? { isActive: item.isActive } : {}) } }))); response.json({ data: input }); });
settingRouter.get('/point-discounts', async (_request, response) => response.json({ data: (await prisma.systemSetting.findUnique({ where: { key: 'bookPointDiscountTiers' } }))?.value ?? [] }));
settingRouter.put('/point-discounts', writeLimiter, async (request, response) => { const value = parse(z.array(z.object({ points: z.number().int().positive(), discountPercent: z.number().min(0).max(100), minOrderAmount: z.number().min(0).optional(), isActive: z.boolean().optional() })), request.body); const setting = await prisma.systemSetting.upsert({ where: { key: 'bookPointDiscountTiers' }, update: { value: value as Prisma.InputJsonValue, valueType: 'JSON', group: 'rewards', updatedById: request.user!.id }, create: { key: 'bookPointDiscountTiers', value, valueType: 'JSON', group: 'rewards', updatedById: request.user!.id } }); response.json({ data: setting.value }); });

export const adminRewardsRouter = Router(); adminRewardsRouter.use(levelsRouter, lifelinesRouter, settingRouter);

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAuth, roles);
adminSettingsRouter.get('/', async (_request, response) => { const data = await prisma.systemSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] }); response.json({ data: Object.fromEntries(data.map((item) => [item.key, item.value])) }); });
adminSettingsRouter.put('/', writeLimiter, async (request, response) => { const input = parse(z.record(z.string(), z.unknown()), request.body); await prisma.$transaction(Object.entries(input).map(([key, value]) => prisma.systemSetting.upsert({ where: { key }, update: { value: value as Prisma.InputJsonValue, updatedById: request.user!.id }, create: { key, value: value as Prisma.InputJsonValue, valueType: 'JSON', updatedById: request.user!.id } }))); response.json({ data: input }); });
