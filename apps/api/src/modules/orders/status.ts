import { Prisma, type OrderStatus } from '../../config/prisma-client.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';

/**
 * One place that decides which order statuses may follow which.
 *
 * Before this module the customer route only allowed PENDING→CANCELLED and
 * never put stock back, while the admin route accepted *any* status string and
 * never restored stock at all. Both paths now go through `transitionOrder`,
 * which validates the edge, claims it with a conditional update (so two
 * concurrent cancels cannot restore stock twice) and records the actor in the
 * audit log.
 */
export type OrderActorType = 'USER' | 'ADMIN' | 'SYSTEM';

export interface OrderActor {
  type: OrderActorType;
  userId?: string | null;
  role?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'PROCESSING', 'CANCELLED'],
  PREPARING: ['PROCESSING', 'SHIPPED', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  PARTIALLY_REFUNDED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export function allowedNextStatuses(status: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[status] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || allowedNextStatuses(from).includes(to);
}

/** Customers may only cancel before the shop starts preparing the parcel. */
export function isUserCancellable(status: OrderStatus): boolean {
  return status === 'PENDING' || status === 'CONFIRMED';
}

export interface TransitionOrderInput {
  orderId: string;
  nextStatus: OrderStatus;
  actor: OrderActor;
  reason?: string;
  /**
   * SUPER_ADMIN-only escape hatch for exceptional cases. It is still audited
   * and still restores stock when the target is CANCELLED.
   */
  force?: boolean;
}

export interface TransitionOrderResult {
  order: Prisma.OrderGetPayload<{ include: { items: true; payments: true } }>;
  changed: boolean;
  previousStatus?: OrderStatus;
}

export async function transitionOrder(
  tx: Prisma.TransactionClient,
  input: TransitionOrderInput,
): Promise<TransitionOrderResult> {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    include: { items: true, promoRedemption: true },
  });
  if (!order) throw ApiError.notFound('Order not found');

  // Idempotent: asking for the status an order already has is a no-op.
  if (order.status === input.nextStatus) {
    const unchanged = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return { order: unchanged, changed: false };
  }

  const forced = input.force === true;
  if (forced && input.actor.type !== 'ADMIN') {
    throw ApiError.forbidden('Only an administrator can force an order transition');
  }
  if (!forced && !canTransition(order.status, input.nextStatus)) {
    throw new ApiError(
      409,
      'INVALID_ORDER_TRANSITION',
      `An order cannot move from ${order.status} to ${input.nextStatus}`,
    );
  }
  if (input.actor.type === 'USER' && input.nextStatus === 'CANCELLED' && !isUserCancellable(order.status)) {
    throw new ApiError(409, 'ORDER_NOT_CANCELLABLE', 'This order can no longer be cancelled');
  }

  const data: Prisma.OrderUpdateManyMutationInput = { status: input.nextStatus };
  if (input.nextStatus === 'CONFIRMED' && !order.confirmedAt) data.confirmedAt = new Date();
  if (input.nextStatus === 'SHIPPED' && !order.shippedAt) data.shippedAt = new Date();
  if (input.nextStatus === 'DELIVERED' && !order.deliveredAt) data.deliveredAt = new Date();
  if (input.nextStatus === 'CANCELLED') data.cancelledAt = new Date();

  // Claim the transition atomically. If another request changed the status in
  // between, `count` is 0 and no stock is restored.
  const claimed = await tx.order.updateMany({
    where: { id: order.id, status: order.status },
    data,
  });
  if (claimed.count !== 1) {
    throw new ApiError(409, 'ORDER_CHANGED', 'The order changed while it was being updated. Reload and try again.');
  }

  if (input.nextStatus === 'CANCELLED') {
    // Restock exactly once, because only the request that claimed the
    // PENDING/CONFIRMED/…→CANCELLED update reaches this block.
    for (const item of order.items) {
      await tx.book.update({
        where: { id: item.bookId },
        data: { stock: { increment: item.quantity } },
      });
    }
    // Free the promo slot so a cancelled order does not consume a limited code.
    if (order.promoRedemption) {
      await tx.promoRedemption.delete({ where: { id: order.promoRedemption.id } });
    }
    await tx.payment.updateMany({
      where: { orderId: order.id, status: { in: ['PENDING', 'AUTHORIZED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  if (input.nextStatus === 'REFUNDED' || input.nextStatus === 'PARTIALLY_REFUNDED') {
    await tx.payment.updateMany({
      where: { orderId: order.id, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
      data: {
        status: input.nextStatus === 'REFUNDED' ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAt: new Date(),
      },
    });
  }

  await tx.auditLog.create({
    data: {
      userId: input.actor.userId ?? null,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'ORDER',
      entityId: order.id,
      before: { status: order.status } as Prisma.InputJsonValue,
      after: {
        status: input.nextStatus,
        actorType: input.actor.type,
        actorRole: input.actor.role ?? null,
        reason: input.reason ?? null,
        forced,
      } as Prisma.InputJsonValue,
      ipAddress: input.actor.ipAddress ?? null,
      userAgent: input.actor.userAgent ?? null,
    },
  });

  const updated = await tx.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  return { order: updated, changed: true, previousStatus: order.status };
}

/** Status history for the customer/admin order detail screens. */
export async function orderStatusHistory(orderId: string) {
  const rows = await prisma.auditLog.findMany({
    where: { entityType: 'ORDER', entityId: orderId, action: 'ORDER_STATUS_CHANGED' },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    from: (row.before as { status?: string } | null)?.status ?? null,
    to: (row.after as { status?: string } | null)?.status ?? null,
    actorType: (row.after as { actorType?: string } | null)?.actorType ?? null,
    actorRole: (row.after as { actorRole?: string } | null)?.actorRole ?? null,
    reason: (row.after as { reason?: string } | null)?.reason ?? null,
    forced: (row.after as { forced?: boolean } | null)?.forced ?? false,
    at: row.createdAt.toISOString(),
  }));
}
