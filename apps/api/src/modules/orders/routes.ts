import type { Request, Response } from 'express';
import { Router } from 'express';
import { Prisma } from '../../config/prisma-client.js';
import { z } from 'zod';
import { constructStripeEvent } from '../../config/stripe.js';
import { prisma } from '../../config/prisma.js';
import { ApiError } from '../../lib/api-error.js';
import { getPagination, paginationMeta } from '../../lib/pagination.js';
import { parse } from '../../lib/zod.js';
import { requireAuth } from '../../middleware/auth.js';
import { writeLimiter } from '../../middleware/rate-limit.js';
import { notifyUser } from '../notifications/service.js';
import { createCheckout, createOrder, isMockPaymentEnabled, isStripeConfigured } from './service.js';
import { orderStatusHistory, transitionOrder } from './status.js';
import { detectOrderSource } from '../../lib/order-source.js';
import { orderNotificationAddress } from '../auth/mailer.js';
import { serializeOrder as serializeOrderShape } from '../../lib/serialize-order.js';

const addressSchema = z.object({ fullName: z.string().trim().min(2).max(120).optional(), recipientName: z.string().trim().min(2).max(120).optional(), phone: z.string().trim().min(7).max(40).optional(), city: z.string().trim().min(2).max(100), address: z.string().trim().min(5).max(500), line1: z.string().trim().min(5).max(500).optional(), postalCode: z.string().trim().max(20).optional(), note: z.string().trim().max(500).optional() });
const checkoutSchema = z.object({ shippingAddress: addressSchema, promoCode: z.string().trim().max(80).optional(), paymentMethod: z.enum(['CARD', 'CASH_ON_DELIVERY', 'BANK_TRANSFER']).default('CARD'), card: z.object({ number: z.string().max(32), expiry: z.string().max(8), cvc: z.string().max(4), name: z.string().max(120).optional() }).optional() });

/**
 * Flattens a Prisma order for clients: money becomes a number and the payment
 * state is flattened onto the order itself. Shared with the admin routes so an
 * order looks the same wherever it is read.
 */
export function serializeOrder(order: any) {
  return serializeOrderShape(order);
}

export const ordersRouter = Router();
ordersRouter.use(requireAuth);
/**
 * Which payment methods the client may offer. With no Stripe key only the
 * offline methods work, so the app must not present a card option that would
 * fail at checkout.
 */
ordersRouter.get('/payment-config', (_request, response) => {
  const stripe = isStripeConfigured();
  const mocked = isMockPaymentEnabled();
  response.json({
    data: {
      /** Card payments are offered either way — real or simulated. */
      card: true,
      stripe,
      mocked,
      methods: [
        { id: 'CARD', label: 'Kartla ödəniş', available: true },
        { id: 'CASH_ON_DELIVERY', label: 'Nağd ödəniş (kuryer)', available: true },
        { id: 'BANK_TRANSFER', label: 'Bank köçürməsi', available: true },
      ],
      message: mocked ? 'Test rejimi: kart ödənişi simulyasiya edilir' : undefined,
      notificationEmail: orderNotificationAddress(),
    },
  });
});
ordersRouter.get('/', async (request, response) => { const { page, limit, skip } = getPagination(request); const where = { userId: request.user!.id }; const [orders, total] = await prisma.$transaction([prisma.order.findMany({ where, orderBy: { placedAt: 'desc' }, skip, take: limit, include: { items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true } } } }, payments: { orderBy: { createdAt: 'desc' }, take: 1 } } }), prisma.order.count({ where })]); response.json({ data: orders.map(serializeOrder), meta: paginationMeta(page, limit, total) }); });
ordersRouter.post('/', writeLimiter, async (request, response) => { const input = parse(checkoutSchema, request.body); const result = await createOrder(request.user!.id, { ...input, source: detectOrderSource(request) }); response.status(201).json({ data: { order: serializeOrder(result.order), payment: result.checkout, requiresManualPayment: result.requiresManualPayment, mocked: result.mocked ?? false, notifiedEmail: result.notifiedEmail, emailDelivered: result.emailDelivered ?? false } }); });
ordersRouter.get('/:orderId', async (request, response) => { const id = z.string().cuid().parse(request.params.orderId); const order = await prisma.order.findFirst({ where: { id, userId: request.user!.id }, include: { items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true } } } }, payments: true, promoRedemption: true } }); if (!order) throw ApiError.notFound('Order not found'); const history = await orderStatusHistory(id); response.json({ data: { ...serializeOrder(order), history } }); });
ordersRouter.post('/:orderId/payment', writeLimiter, async (request, response) => { const id = z.string().cuid().parse(request.params.orderId); const order = await prisma.order.findFirst({ where: { id, userId: request.user!.id, status: 'PENDING' }, include: { payments: { where: { status: 'PENDING' }, take: 1 } } }); if (!order?.payments[0]) throw ApiError.conflict('Order is not awaiting payment'); if (order.payments[0].method !== 'CARD') throw ApiError.conflict('Bu sifariş nağd/bank ödəniş ilə təsdiqlənir'); response.json({ data: await createCheckout(order, order.payments[0].id) }); });

ordersRouter.post('/:orderId/cancel', writeLimiter, async (request, response) => {
  const id = z.string().cuid().parse(request.params.orderId);
  const owned = await prisma.order.findFirst({ where: { id, userId: request.user!.id }, select: { id: true } });
  if (!owned) throw ApiError.notFound('Order not found');
  const result = await prisma.$transaction(
    (tx) => transitionOrder(tx, {
      orderId: id,
      nextStatus: 'CANCELLED',
      actor: {
        type: 'USER',
        userId: request.user!.id,
        ipAddress: request.ip ?? null,
        userAgent: request.header('user-agent') ?? null,
      },
      reason: 'Customer cancelled the order',
    }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (result.order.userId) {
    await notifyUser(result.order.userId, 'ORDER_UPDATE', 'Sifariş ləğv edildi', `Sifariş ${result.order.orderNumber} ləğv edildi.`, { orderId: result.order.id }).catch(() => undefined);
  }
  response.json({ data: { id, status: 'CANCELLED', changed: result.changed } });
});

export async function stripeWebhookHandler(request: Request, response: Response) {
  const signature = request.header('stripe-signature');
  if (!signature) throw ApiError.badRequest('Missing Stripe signature');
  if (!Buffer.isBuffer(request.body)) throw ApiError.badRequest('Webhook body must be raw');
  const event = constructStripeEvent(request.body, signature);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (!orderId) throw ApiError.badRequest('Order metadata is missing');
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (!current) throw ApiError.notFound('Order not found');
      // A duplicate webhook, or one that arrives after a manual confirmation,
      // must not change the status again.
      if (current.status !== 'PENDING') return null;
      const transition = await transitionOrder(tx, {
        orderId,
        nextStatus: 'CONFIRMED',
        actor: { type: 'SYSTEM' },
        reason: 'Stripe checkout completed',
      });
      await tx.payment.updateMany({
        where: { orderId, status: 'PENDING' },
        data: {
          status: 'PAID',
          providerPaymentId: session.payment_intent ? String(session.payment_intent) : session.id,
          paidAt: new Date(),
          processedAt: new Date(),
        },
      });
      return transition;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result?.order.userId) {
      await notifyUser(result.order.userId, 'ORDER_UPDATE', 'Sifarişiniz təsdiqləndi', `Sifariş ${result.order.orderNumber} qəbul edildi.`, { orderId: result.order.id });
    }
  }
  if (event.type === 'checkout.session.expired') {
    const orderId = event.data.object.metadata?.orderId;
    if (orderId) {
      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
        if (!current || current.status !== 'PENDING') return null;
        return transitionOrder(tx, {
          orderId,
          nextStatus: 'CANCELLED',
          actor: { type: 'SYSTEM' },
          reason: 'Stripe checkout expired',
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (result?.order.userId) {
        await notifyUser(result.order.userId, 'ORDER_UPDATE', 'Sifariş ləğv edildi', `Sifariş ${result.order.orderNumber} ödəniş vaxtı bitdiyi üçün ləğv edildi.`, { orderId }).catch(() => undefined);
      }
    }
  }
  response.json({ received: true });
}
