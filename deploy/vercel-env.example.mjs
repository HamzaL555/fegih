/**
 * Secrets and configuration for `npm run deploy:vercel`.
 *
 * Copy this file to `deploy/vercel-env.mjs`, fill in the values, and that file
 * stays out of version control. Do not paste real values here.
 *
 * Generate the two JWT secrets with:
 *   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
 */
export const VERCEL_ENVS = {
  /**
   * The API. `DATABASE_URL` must be Neon's **pooled** connection string — a
   * direct one opens a new connection per serverless invocation and exhausts
   * the plan. `DIRECT_DATABASE_URL` is used by `prisma migrate deploy`.
   */
  api: {
    DATABASE_URL: '',
    DIRECT_DATABASE_URL: '',
    NODE_ENV: 'production',
    API_HOST: '0.0.0.0',
    API_PORT: '4000',
    TRUST_PROXY: '1',
    JWT_SECRET: '',
    JWT_REFRESH_SECRET: '',
    // Both frontend origins, or the browser will be blocked by CORS.
    WEB_ORIGIN: 'https://fegih.vercel.app,https://fegih-admin.vercel.app',
    ADMIN_NAME: 'System Administrator',
    ADMIN_EMAIL: 'admin@fegih.az',
    ADMIN_PASSWORD: '',
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    PAYMENT_CURRENCY: 'AZN',
    RESEND_API_KEY: '',
    RESEND_FROM_EMAIL: 'Fegih <no-reply@example.com>',
    ORDER_NOTIFICATION_EMAIL: 'ramil.soltan011@gmail.com',
    CLOUDINARY_CLOUD_NAME: '',
    CLOUDINARY_API_KEY: '',
    CLOUDINARY_API_SECRET: '',
    ALADHAN_API_URL: 'https://api.aladhan.com/v1',
    EXPO_ACCESS_TOKEN: '',
    APP_PUBLIC_URL: 'https://fegih.vercel.app',
    CRON_SECRET: '',
  },

  /** The admin panel. `NEXT_PUBLIC_API_URL` stays relative; the rest is server-side. */
  admin: {
    NEXT_PUBLIC_API_URL: '/api/v1',
    API_PROXY_ORIGIN: 'https://fegih-api.vercel.app',
  },

  /**
   * The web app. `EXPO_PUBLIC_API_URL` stays empty so requests go to the site's
   * own `/api/v1` and are rewritten to the API — that keeps preview URLs working.
   */
  web: {
    EXPO_PUBLIC_API_URL: '',
    EXPO_PUBLIC_ADMIN_URL: 'https://fegih-admin.vercel.app',
  },
};