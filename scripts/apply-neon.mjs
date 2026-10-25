#!/usr/bin/env node
/**
 * Applies the local database to Neon.
 *
 * Reads the connection details from environment variables so the credentials
 * never appear in a command line (and therefore never in shell history).
 *
 * Migrations need the **direct** connection: Neon routes the pooled endpoint
 * through PgBouncer in transaction mode, which Prisma Migrate cannot use.
 * The runtime uses the pooled one, since serverless functions open a new
 * connection per invocation.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';

const pooled = process.env.NEON_POOLED_URL;
const direct = process.env.NEON_DIRECT_URL;

if (!pooled || !direct) {
  console.error('NEON_POOLED_URL / NEON_DIRECT_URL təyin edilməyib.');
  process.exit(1);
}

const mask = (url) => url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');

console.log(`  pooled: ${mask(pooled)}`);
console.log(`  direct: ${mask(direct)}`);

const run = (label, args) => {
  console.log(`\n--- ${label} ---`);
  execFileSync('npx', args, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: direct, DIRECT_DATABASE_URL: direct },
    shell: true,
  });
};

run('migrate deploy', ['prisma migrate deploy']);
run('seed', ['node', '--import', 'tsx', 'prisma/seed/index.ts']);

console.log('\nNeon hazirdir.');