/**
 * Imports the client from the repository rather than from `@prisma/client`.
 *
 * Vercel restores `node_modules` from its build cache, npm reports "up to
 * date" and skips install lifecycle scripts, so `prisma generate` never runs in
 * the deployment and the package entry point stays the uninitialised stub
 * ("@prisma/client did not initialize yet"). The generator writes into
 * `prisma/generated/prisma` instead, and that folder is committed, so the
 * function always has a real client and a Linux query engine.
 *
 * `tsconfig.json` maps `@prisma/client` to the same folder, so the rest of the
 * codebase keeps its normal imports and stays type-consistent.
 */
import { PrismaClient } from '../../../../prisma/generated/prisma/index.js';
import { env } from './env.js';

/*
 * Prisma resolves its query engine at runtime from a computed file name, which
 * Vercel's file tracer cannot follow. Because the client lives in a custom
 * output directory (not in `node_modules`), the Linux engine would be left out
 * of the serverless bundle and every query would fail with
 * `Prisma Client could not locate the Query Engine for runtime
 * "rhel-openssl-3.0.x"`.
 *
 * `vercel.json` therefore ships the whole generated client with the function
 * (`functions["api/index.ts"].includeFiles`). Resolving the files from here
 * would not help the tracer — it never executes this module while tracing.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
