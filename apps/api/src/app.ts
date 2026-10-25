import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { allowedOrigins, env } from './config/env.js';
import { openApiDocument } from './docs/openapi.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { ApiError } from './lib/api-error.js';
import { requestContext } from './middleware/request-context.js';
import { getSystemSetting } from './lib/settings-cache.js';
import { stripeWebhookHandler } from './modules/orders/routes.js';
import { apiRouter } from './routes.js';

export const app = express();

app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');

app.use(requestContext);
app.use('/api/v1', async (request, _response, next) => {
  if (request.path === '/health' || request.path.startsWith('/auth/') || request.path.startsWith('/admin/') || request.path === '/payments/webhook/stripe' || request.path.startsWith('/jobs/')) return next();
  const value = await getSystemSetting('maintenanceMode');
  if (value === true || (typeof value === 'object' && value !== null && 'enabled' in value && value.enabled === true)) return next(ApiError.forbidden('Tətbiq müvəqqəti texniki baxışdadır'));
  next();
});
app.use(pinoHttp({
  redact: ['req.headers.authorization', 'req.body.password', 'req.body.refreshToken', 'res.headers["set-cookie"]'],
  autoLogging: { ignore: (request) => request.url === '/api/v1/health' },
}));
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,
}));
app.use(compression());
app.post('/api/v1/payments/webhook/stripe', express.raw({ type: 'application/json', limit: '2mb' }), stripeWebhookHandler);
// Rate limiting runs before body parsing so a flood never forces JSON parsing.
app.use('/api', apiLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.get('/', (_request, response) => {
  response.json({ data: { name: 'Fegih API', documentation: '/docs', health: '/api/v1/health' } });
});
app.get('/docs/openapi.json', (_request, response) => response.json(openApiDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'Fegih API Documentation' }));

app.use('/api/v1', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
