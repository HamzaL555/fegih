import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';

const server = createServer(app);

server.listen(env.API_PORT, env.API_HOST, () => {
  console.log(`[api] Fegih API listening on http://${env.API_HOST}:${env.API_PORT}`);
  console.log(`[api] Swagger: http://localhost:${env.API_PORT}/docs`);
});

async function shutdown(signal: string) {
  console.log(`[api] ${signal} received; shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
