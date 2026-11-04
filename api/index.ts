/**
 * Vercel entry point for the API project.
 *
 * The API project's Root Directory is the repository root rather than
 * `apps/api`, because Vercel uploads only that directory. Rooting it at
 * `apps/api` meant the Prisma CLI, the schema and the npm workspace packages
 * were all missing at build time. From the root, everything resolves and the
 * build is the same command used locally.
 *
 * `api/package.json` declares `"type": "module"`. Without it the Node builder
 * emitted this file as CommonJS and the whole app failed to load at runtime with
 * `ERR_REQUIRE_ESM`, because `apps/api` is an ES module.
 *
 * Vercel's Node runtime recognises an Express application as the default export
 * and forwards every request to it.
 *
 * Note for later: the rate limiters keep their counters in process memory.
 * Serverless functions are recycled often enough that the limits will be loose
 * in production. Pointing them at a shared store (Redis/Upstash) is the fix —
 * see the deployment notes in the README.
 */

// Ensure Prisma Client is available on cold start (Vercel serverless functions
// recycle frequently; prisma/generated/ is gitignored and not present on fresh
// deploys). Running generate here guarantees the client is initialised before
// any request hits the database.
import { execSync } from 'node:child_process';
try {
  execSync('node node_modules/prisma/build/index.js generate', {
    stdio: 'pipe',
    cwd: process.cwd(),
  });
} catch {
  // Prisma may already be generated; ignore and let the app start.
}

import { app } from '../apps/api/src/app.js';

export default app;