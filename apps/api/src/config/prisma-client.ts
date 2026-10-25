/**
 * Single entry point for the generated Prisma client.
 *
 * Every module imports from here instead of `@prisma/client`. The generated
 * client lives in the repository (`prisma/generated/prisma`) because Vercel
 * restores `node_modules` from its build cache and then skips install lifecycle
 * scripts, so `prisma generate` never runs during a deployment and the
 * `@prisma/client` package entry point stays an uninitialised stub.
 *
 * Routing every import through one module means there is exactly one place to
 * change if the generator output ever moves, and it guarantees the `Prisma`
 * namespace used for `instanceof` checks is the same object the client was
 * constructed from.
 *
 * `tsconfig.json` maps `@prisma/client` to this folder too, so types and runtime
 * always agree.
 */
export * from '../../../../prisma/generated/prisma/index.js';