import { Prisma } from '../../config/prisma-client.js';
import { prisma } from '../../config/prisma.js';

export async function getDashboard() {
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const [users, activeUsers, games, questions, books, orders, sales, distributed, spent, reviews, averageRating, recentOrders, orderStatuses] = await prisma.$transaction([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: today } } }),
    prisma.quizSession.count(),
    prisma.question.count({ where: { status: 'ACTIVE' } }),
    prisma.book.count({ where: { isActive: true, deletedAt: null } }),
    prisma.order.count(),
    prisma.order.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { totalAmount: true } }),
    prisma.pointLedgerEntry.aggregate({ where: { amount: { gt: 0 } }, _sum: { amount: true } }),
    prisma.pointLedgerEntry.aggregate({ where: { amount: { lt: 0 } }, _sum: { amount: true } }),
    prisma.bookReview.count({ where: { isApproved: true } }),
    prisma.bookReview.aggregate({ where: { isApproved: true }, _avg: { rating: true } }),
    prisma.order.findMany({ orderBy: { placedAt: 'desc' }, take: 8, select: { id: true, orderNumber: true, status: true, totalAmount: true, placedAt: true, user: { select: { username: true } } } }),
    prisma.order.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: true, _sum: { totalAmount: true } }),
  ]);
  const activity = await prisma.$queryRaw<Array<{ date: Date; games: bigint; users: bigint }>>(Prisma.sql`SELECT DATE_TRUNC('day', "startedAt") AS date, COUNT(*) AS games, COUNT(DISTINCT "userId") AS users FROM "QuizSession" WHERE "startedAt" >= ${monthAgo} GROUP BY 1 ORDER BY 1 ASC`);
  const distribution = await prisma.pointLedgerEntry.groupBy({ by: ['type'], _sum: { amount: true }, _count: true });
  return {
    stats: [
      { label: 'Total Users', value: users }, { label: 'Active Users Today', value: activeUsers }, { label: 'Quiz Sessions', value: games },
      { label: 'Questions', value: questions }, { label: 'Books', value: books }, { label: 'Orders', value: orders },
      { label: 'Sales', value: Number(sales._sum.totalAmount ?? 0) }, { label: 'Reviews', value: reviews },
      { label: 'Average Rating', value: Number(averageRating._avg.rating ?? 0) }, { label: 'Points Distributed', value: distributed._sum.amount ?? 0 },
    ],
    totals: { users, activeUsers, games, questions, books, orders, sales: sales._sum.totalAmount ?? new Prisma.Decimal(0), reviews, averageRating: averageRating._avg.rating ?? new Prisma.Decimal(0), pointsDistributed: distributed._sum.amount ?? 0, pointsSpent: Math.abs(spent._sum.amount ?? 0) },
    activity: activity.map((item) => ({ label: item.date.toISOString().slice(0, 10), value: Number(item.games), users: Number(item.users) })),
    distribution: distribution.map((item) => ({ label: item.type, value: item._sum.amount ?? 0, count: item._count })),
    recentActivity: recentOrders.map((order) => ({ id: order.id, label: `Order ${order.orderNumber}`, detail: `${order.user?.username ?? 'User'} · ${order.status}`, createdAt: order.placedAt })),
    orderStatuses: orderStatuses.map((item) => ({ status: item.status, count: item._count, sales: item._sum?.totalAmount ?? 0 })),
  };
}
