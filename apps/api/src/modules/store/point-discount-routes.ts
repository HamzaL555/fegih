import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { POINT_DISCOUNT_SETTING, describeTiers, normalizeTiers } from '../../lib/point-discount.js';
import { requireAuth } from '../../middleware/auth.js';

/**
 * The book store's loyalty ladder.
 *
 * `GET  /point-discount`    the caller's tier, their position and the next step
 * `GET  /point-discount/tiers`  the ladder on its own (public, for the store screen)
 */
export const pointDiscountRouter = Router();

pointDiscountRouter.get('/tiers', async (_request, response) => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: POINT_DISCOUNT_SETTING }, select: { value: true } });
  response.setHeader('Cache-Control', 'public, max-age=300');
  response.json({ data: { tiers: normalizeTiers(setting?.value) } });
});

pointDiscountRouter.get('/', requireAuth, async (request, response) => {
  const [user, setting] = await Promise.all([
    prisma.user.findUnique({ where: { id: request.user!.id }, select: { points: true } }),
    prisma.systemSetting.findUnique({ where: { key: POINT_DISCOUNT_SETTING }, select: { value: true } }),
  ]);
  const points = user?.points ?? 0;
  response.json({ data: { points, ...describeTiers(setting?.value, points) } });
});