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
ordersRouter.post('/', writeLimiter, async (request, response) => { const input = parse(checkoutSchema, request.body); const result = await createOrder(request.user!.id, input); response.status(201).json({ data: { order: serializeOrder(result.order), payment: result.checkout, requiresManualPayment: result.requiresManualPayment, mocked: result.mocked ?? false, notifiedEmail: result.notifiedEmail, emailDelivered: result.emailDelivered ?? false } }); });
ordersRouter.get('/:orderId', async (request, response) => { const id = z.string().cuid().parse(request.params.orderId); const order = await prisma.order.findFirst({ where: { id, userId: request.user!.id }, include: { items: { include: { book: { select: { id: true, title: true, author: true, coverImageUrl: true } } } }, payments: true, promoRedemption: true } }); if (!order) throw ApiError.notFound('Order not found'); response.json({ data: serializeOrder(order) }); });
ordersRouter.post('/:orderId/payment', writeLimiter, async (request, response) => { const id = z.string().cuid().parse(request.params.orderId); const order = await prisma.order.findFirst({ where: { id, userId: request.user!.id, status: 'PENDING' }, include: { payments: { where: { status: 'PENDING' }, take: 1 } } }); if (!order?.payments[0]) throw ApiError.conflict('Order is not awaiting payment'); if (order.payments[0].method !== 'CARD') throw ApiError.conflict('Bu sifariş nağd/bank ödəniş ilə təsdiqlənir'); response.json({ data: await createCheckout(order, order.payments[0].id) }); });

async function cancelOrderAndRestore(orderId: string) { return prisma.$transaction(async (tx) => { const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, promoRedemption: true } }); if (!order || order.status !== 'PENDING') return false; for (const item of order.items) await tx.book.update({ where: { id: item.bookId }, data: { stock: { increment: item.quantity } } }); // No points refund: the loyalty tier only qualifies the balance, never spends it.
if (order.promoRedemption) await tx.promoRedemption.delete({ where: { id: order.promoRedemption.id } }); await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } }); await tx.payment.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'CANCELLED', cancelledAt: new Date() } }); return true; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
ordersRouter.post('/:orderId/cancel', writeLimiter, async (request, response) => { const id = z.string().cuid().parse(request.params.orderId); const order = await prisma.order.findFirst({ where: { id, userId: request.user!.id }, select: { status: true } }); if (!order) throw ApiError.notFound('Order not found'); if (!await cancelOrderAndRestore(id)) throw ApiError.conflict('Only pending orders can be cancelled'); response.json({ data: { id, status: 'CANCELLED' } }); });

export async function stripeWebhookHandler(request: Request, response: Response) { const signature = request.header('stripe-signature'); if (!signature) throw ApiError.badRequest('Missing Stripe signature'); if (!Buffer.isBuffer(request.body)) throw ApiError.badRequest('Webhook body must be raw'); const event = constructStripeEvent(request.body, signature); if (event.type === 'checkout.session.completed') { const session = event.data.object; const orderId = session.metadata?.orderId; if (!orderId) throw ApiError.badRequest('Order metadata is missing'); const order = await prisma.$transaction(async (tx) => { const current = await tx.order.findUnique({ where: { id: orderId } }); if (!current) throw ApiError.notFound('Order not found'); if (current.status !== 'PENDING') return current; const updated = await tx.order.update({ where: { id: orderId }, data: { status: 'CONFIRMED', confirmedAt: new Date() } }); await tx.payment.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'PAID', providerPaymentId: session.payment_intent ? String(session.payment_intent) : session.id, paidAt: new Date(), processedAt: new Date() } }); return updated; }); if (order.userId) await notifyUser(order.userId, 'ORDER_UPDATE', 'Sifarişiniz təsdiqləndi', `Sifariş ${order.orderNumber} qəbul edildi.`, { orderId: order.id }); } if (event.type === 'checkout.session.expired') { const orderId = event.data.object.metadata?.orderId; if (orderId) await cancelOrderAndRestore(orderId); } response.json({ received: true }); }
