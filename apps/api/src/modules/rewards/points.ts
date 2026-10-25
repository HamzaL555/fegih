import { Prisma, type PointEntryType } from '../../config/prisma-client.js';
import { ApiError } from '../../lib/api-error.js';

type Transaction = Prisma.TransactionClient;

export async function applyPointChange(tx: Transaction, input: {
  userId: string;
  amount: number;
  type: PointEntryType;
  description: string;
  sourceType: string;
  sourceId?: string;
  idempotencyKey: string;
  sessionId?: string;
  orderId?: string;
}) {
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) throw ApiError.badRequest('Point amount must be a non-zero integer');
  const existing = await tx.pointLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    const replayUser = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { id: true, points: true, xp: true, level: true } });
    return { user: replayUser, transaction: existing, replayed: true };
  }
  const user = input.amount < 0
    ? await tx.user.updateMany({ where: { id: input.userId, points: { gte: Math.abs(input.amount) } }, data: { points: { decrement: Math.abs(input.amount) } } })
    : await tx.user.update({ where: { id: input.userId }, data: { points: { increment: input.amount }, xp: { increment: input.amount } } });
  if ('count' in user && user.count === 0) throw new ApiError(409, 'INSUFFICIENT_POINTS', 'Not enough points');

  const updated = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { points: true, xp: true, level: true } });
  if (input.amount > 0) {
    const setting = await tx.systemSetting.findUnique({ where: { key: 'levelXpStep' } });
    const step = typeof setting?.value === 'number' ? Math.max(1, Math.trunc(setting.value)) : 1000;
    const calculatedLevel = Math.max(1, Math.floor(updated.xp / step) + 1);
    if (calculatedLevel !== updated.level) await tx.user.update({ where: { id: input.userId }, data: { level: calculatedLevel } });
  }
  const transaction = await tx.pointLedgerEntry.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      balanceAfter: updated.points,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
      sessionId: input.sessionId,
      orderId: input.orderId,
    },
  });
  return { user: updated, transaction, replayed: false };
}
