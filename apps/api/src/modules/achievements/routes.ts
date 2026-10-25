import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const achievementsRouter = Router();
achievementsRouter.use(requireAuth);

achievementsRouter.get('/', async (request, response) => {
  const achievements = await prisma.achievement.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    include: { userAchievements: { where: { userId: request.user!.id }, select: { progress: true, progressTarget: true, unlockedAt: true } } },
  });
  const data = achievements.map((achievement) => {
    const state = achievement.userAchievements[0];
    return {
      ...achievement,
      points: achievement.pointsReward,
      unlocked: Boolean(state?.unlockedAt),
      unlockedAt: state?.unlockedAt ?? null,
      progress: state?.progress ?? 0,
      target: state?.progressTarget ?? (achievement.condition as { target?: number }).target ?? 1,
      userAchievements: undefined,
    };
  });
  response.json({ data, meta: { page: 1, limit: data.length || 1, total: data.length, totalPages: 1 } });
});
