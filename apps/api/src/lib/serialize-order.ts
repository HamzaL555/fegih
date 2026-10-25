/**
 * Order shape shared by the customer and admin APIs.
 *
 * Kept out of the route modules so an admin endpoint can answer with the exact
 * same payload the app already understands, without importing another router.
 */

type AnyOrder = Record<string, any>;

export function serializeOrder(order: AnyOrder) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    discount: Number(order.discountAmount),
    discountAmount: Number(order.discountAmount),
    pointDiscountPercent: Number(order.pointDiscountPercent ?? 0),
    shippingFee: Number(order.shippingFee),
    total: Number(order.totalAmount),
    totalAmount: Number(order.totalAmount),
    /** Flattened from the first payment row so clients need one field. */
    paymentStatus: order.payments?.[0]?.status ?? 'PENDING',
    paymentMethod: order.payments?.[0]?.method ?? null,
    items: (order.items ?? []).map((item: AnyOrder) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      price: Number(item.unitPrice),
      total: Number(item.totalPrice),
      lineTotal: Number(item.totalPrice),
    })),
  };
}