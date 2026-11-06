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
 * The import points at the compiled JavaScript in `apps/api/dist`, not at the
 * TypeScript sources. Vercel only transpiles the entry file itself; imported
 * `.ts` files used to be shipped verbatim and executed by Node, which skipped
 * the installed workspace dependencies and failed with `ERR_MODULE_NOT_FOUND`
 * (`Cannot find package 'compression'`). `vercel.json` runs the API build
 * before the function is packaged, so `dist/app.js` and its dependencies are
 * always present.
 *
 * Vercel's Node runtime recognises an Express application as the default export
 * and forwards every request to it.
 *
 * Note for later: the rate limiters keep their counters in process memory.
 * Serverless functions are recycled often enough that the limits will be loose
 * in production. Pointing them at a shared store (Redis/Upstash) is the fix —
 * see the deployment notes in the README.
 */

import { app } from '../apps/api/dist/app.js';

export default app;
