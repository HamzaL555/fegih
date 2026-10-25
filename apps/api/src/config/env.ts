import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const workspaceEnv = resolve(process.cwd(), '.env');
const rootEnv = resolve(process.cwd(), '../../.env');
dotenv.config({ path: workspaceEnv, quiet: true });
dotenv.config({ path: rootEnv, override: false, quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_URL: z.string().url().default('http://localhost:4000/api/v1'),
  WEB_ORIGIN: z.string().default('http://localhost:3000,http://localhost:8081'),
  TRUST_PROXY: z.string().default('1'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('fegih'),
  PAYMENT_PROVIDER: z.enum(['stripe']).default('stripe'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_CURRENCY: z.string().length(3).default('AZN'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('Fegih <no-reply@example.com>'),
  /**
   * Where cash-on-delivery and bank-transfer orders are reported. Falls back
   * to the seeded admin address.
   */
  ORDER_NOTIFICATION_EMAIL: z.string().email().optional(),
  ADMIN_EMAIL: z.string().email().default('admin@fegih.az'),
  APP_PUBLIC_URL: z.string().url().default('http://localhost:8081'),
  ALADHAN_API_URL: z.string().url().default('https://api.aladhan.com/v1'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  /**
   * Simulate card payments locally instead of contacting Stripe. Defaults to on
   * whenever no usable Stripe key is configured.
   */
  PAYMENT_MOCK: z.coerce.boolean().optional(),
  CRON_SECRET: z.string().optional(),
  /**
   * When true, `POST /auth/forgot-password` returns the reset token in the
   * response body when e-mail delivery is unavailable. Off by default: any
   * non-loopback deployment would otherwise allow full account takeover.
   */
  ALLOW_DEV_RESET_TOKEN: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
export const allowedOrigins = env.WEB_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean);
