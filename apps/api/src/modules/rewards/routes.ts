import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { evaluateAchievements } from '../achievements/service.js';
import { updateMissions } from '../missions/service.js';
import { applyPointChange } from './points.js';

interface DailyRuleConditions { day: number; title?: string; description?: string; icon?: string; lifelineType?: 'FIFTY_FIFTY' | 'SECOND_CHANCE' | 'HINT' | 'SKIP' | 'EXTRA_TIME'; lifelineQuantity?: number }

function rewardDayStart() {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

function serializeRule(rule: { id: string; name: string; description: string | null; amount: number; conditions: unknown }, claimed?: { claimedAt: Date | null }) {
  const conditions = (rule.conditions ?? {}) as unknown as DailyRuleConditions;
  return {
    id: rule.id,
    title: conditions.title || rule.name,
    name: rule.name,
    description: rule.description ?? conditions.description,
    icon: conditions.icon,
    points: rule.amount,
    pointsCost: 0,
    day: conditions.day,
    streakDay: conditions.day,
    claimed: Boolean(claimed?.claimedAt),
    claimedAt: claimed?.claimedAt ?? null,
  };
}

export const rewardsRouter = Router();
rewardsRouter.use(requireAuth);

rewardsRouter.get('/', async (request, response) => {
  const [rules, claims] = await Promise.all([
    prisma.rewardRule.findMany({ where: { event: 'DAILY_LOGIN', isActive: true, code: { startsWith: 'daily-day-' } }, orderBy: { createdAt: 'asc' } }),
    prisma.dailyReward.findMany({ where: { userId: request.user!.id }, orderBy: { claimedAt: 'desc' }, take: 14 }),
  ]);
  const data = rules.map((rule) => serializeRule(rule, claims.find((claim) => claim.rewardRuleId === rule.id)));
  response.json({ data, meta: { page: 1, limit: data.length || 1, total: data.length, totalPages: 1 } });
});

rewardsRouter.post('/claim', writeLimiter, async (request, response) => {
  const { rewardId } = parse(z.object({ rewardId: z.string().cuid() }), request.body);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: request.user!.id }, select: { id: true, points: true, streak: true } });
    const today = rewardDayStart();
    if (await tx.dailyReward.findFirst({ where: { userId: user.id, rewardDate: today } })) throw ApiError.conflict('Daily reward has already been claimed today');
    const rule = await tx.rewardRule.findFirst({ where: { id: rewardId, event: 'DAILY_LOGIN', isActive: true } });
    if (!rule) throw ApiError.notFound('Daily reward not found');
    const conditions = (rule.conditions ?? {}) as unknown as DailyRuleConditions;
    const expectedDay = Math.min(Math.max(user.streak, 1), 7);
    if (conditions.day !== expectedDay) throw ApiError.badRequest(`Bu gün üçün ${expectedDay}-ci gün mükafatını claim etməlisiniz`);
    const claim = await tx.dailyReward.create({ data: { userId: user.id, rewardRuleId: rule.id, rewardDate: today, streakDay: conditions.day, basePoints: rule.amount, isClaimed: true, claimedAt: new Date() } });
    const applied = rule.amount > 0
      ? await applyPointChange(tx, { userId: user.id, amount: rule.amount, type: 'DAILY_REWARD', description: `${rule.name} daily reward`, sourceType: 'REWARD_RULE', sourceId: rule.id, idempotencyKey: `daily:${claim.id}` })
      : null;
    if (conditions.lifelineType && (conditions.lifelineQuantity ?? 0) > 0) {
      await tx.userLifelineInventory.upsert({ where: { userId_type: { userId: user.id, type: conditions.lifelineType } }, update: { quantity: { increment: conditions.lifelineQuantity } }, create: { userId: user.id, type: conditions.lifelineType, quantity: conditions.lifelineQuantity } });
    }
    await updateMissions(tx, user.id, 'LOGIN', 1);
    const achievements = await evaluateAchievements(tx, user.id);
    return { reward: serializeRule(rule, { claimedAt: claim.claimedAt }), points: applied?.user.points ?? user.points, achievements };
  });
  response.json({ data: result });
});
