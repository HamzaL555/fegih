import Stripe from 'stripe';
import { env } from './env.js';
import { ApiError } from '../lib/api-error.js';

let stripeClient: Stripe | undefined;

export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, 'PAYMENT_NOT_CONFIGURED', 'Payment provider credentials have not been configured');
  }
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, { appInfo: { name: 'Fegih API', version: '1.0.0' } });
  return stripeClient;
}

export function constructStripeEvent(payload: Buffer, signature: string) {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new ApiError(503, 'PAYMENT_NOT_CONFIGURED', 'Stripe webhook secret is missing');
  return getStripe().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
}
