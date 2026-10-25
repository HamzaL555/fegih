import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', async (_request, response) => {
  const startedAt = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  response.json({
    data: {
      status: 'ok',
      database: 'connected',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      responseTimeMs: Math.round(performance.now() - startedAt),
    },
  });
});
