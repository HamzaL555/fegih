import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/api-error.js';
import { notifyUser } from '../notifications/service.js';

function validCronSecret(request: { header(name: string): string | undefined }) {
  if (!env.CRON_SECRET) return false;
  const supplied = request.header('x-cron-secret') ?? '';
  const left = Buffer.from(env.CRON_SECRET);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const jobsRouter = Router();
jobsRouter.post('/daily', async (request, response) => {
  if (!validCronSecret(request)) throw ApiError.unauthorized('Invalid cron credentials');
  const [ayah, info, users] = await Promise.all([
    prisma.dailyAyah.findFirst({ orderBy: { day: 'desc' } }),
    prisma.dailyInfo.findFirst({ where: { isPublished: true }, orderBy: { day: 'desc' } }),
    prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true } }),
  ]);
  for (const user of users) {
    if (ayah) await notifyUser(user.id, 'DAILY_AYAH', 'Daily Ayah', `${ayah.reference}: ${ayah.translationText}`, { ayahId: ayah.id });
    if (info) await notifyUser(user.id, 'DAILY_ISLAMIC_INFO', info.title, info.summary ?? info.content.slice(0, 140), { infoId: info.id });
  }
  response.json({ data: { users: users.length, ayah: Boolean(ayah), info: Boolean(info) } });
});
