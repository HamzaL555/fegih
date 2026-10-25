import { Prisma } from '../../config/prisma-client.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';

const querySchema = z.object({ period: z.enum(['daily', 'weekly', 'monthly', 'allTime']).default('allTime') });

function periodStart(period: 'daily' | 'weekly' | 'monthly') {
  const now = new Date();
  const start = new Date(now);
  if (period === 'monthly') start.setUTCMonth(1);
  if (period === 'weekly') start.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export const leaderboardRouter = Router();
leaderboardRouter.get('/', async (request, response) => {
  const { period } = parse(querySchema, request.query);
  const { page, limit, skip } = getPagination(request);
  const baseUser = { deletedAt: null, status: 'ACTIVE' as const };

  if (period === 'allTime') {
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({ where: { ...baseUser, points: { gt: 0 } }, orderBy: [{ points: 'desc' }, { createdAt: 'asc' }], skip, take: limit, select: { id: true, username: true, displayName: true, avatarUrl: true, points: true, level: true } }),
      prisma.user.count({ where: { ...baseUser, points: { gt: 0 } } }),
    ]);
    response.json({ data: users.map((user, index) => ({ ...user, profileImage: user.avatarUrl, rank: skip + index + 1 })), meta: paginationMeta(page, limit, total) });
    return;
  }

  const from = periodStart(period);
  const grouped = await prisma.pointLedgerEntry.groupBy({ by: ['userId'], where: { amount: { gt: 0 }, createdAt: { gte: from } }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } }, skip, take: limit });
  const counts = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(DISTINCT "userId") AS count FROM "PointLedgerEntry"
    WHERE "amount" > 0 AND "createdAt" >= ${from}
  `);
  const users = await prisma.user.findMany({ where: { ...baseUser, id: { in: grouped.map((row) => row.userId) } }, select: { id: true, username: true, displayName: true, avatarUrl: true, level: true } });
  const byId = new Map(users.map((user) => [user.id, user]));
  const data = grouped.flatMap((row, index) => {
    const user = byId.get(row.userId);
    return user ? [{ ...user, profileImage: user.avatarUrl, points: row._sum.amount, rank: skip + index + 1 }] : [];
  });
  response.json({ data, meta: paginationMeta(page, limit, Number(counts[0]?.count ?? 0)) });
});
