import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { requireAuth } from '../../middleware/auth.js';

export const missionsRouter = Router();
missionsRouter.use(requireAuth);

missionsRouter.get('/', async (request, response) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const missions = await prisma.mission.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    include: { progress: { where: { userId: request.user!.id }, take: 1 } },
  });
  const data = missions.map((mission) => {
    const stored = mission.progress[0];
    const stale = mission.type === 'DAILY' && stored && stored.lastActivityAt < today;
    const current = stored && !stale ? stored.currentCount : 0;
    return {
      ...mission,
      name: mission.title,
      current,
      target: mission.targetCount,
      targetCount: mission.targetCount,
      points: mission.pointsReward,
      percent: Math.min(100, Math.round((current / mission.targetCount) * 100)),
      completed: Boolean(stored && !stale && stored.completedAt),
      rewardClaimed: Boolean(stored && !stale && stored.claimedAt),
      progress: undefined,
    };
  });
  response.json({ data, meta: { page: 1, limit: data.length || 1, total: data.length, totalPages: 1 } });
});
