/**
 * Makes `prisma generate` survive Vercel's build cache.
 *
 * The problem: Vercel restores `node_modules` from its cache, `npm install`
 * then reports "up to date", and npm skips install lifecycle scripts. Neither
 * `postinstall` nor `installCommand: "... && prisma generate"` runs, so the
 * deployment ships the uninitialised client stub and every request fails with
 * "@prisma/client did not initialize yet".
 *
 * The fix is to make the check depend on something npm *does* track — the
 * lockfile checksum. When `node_modules/.prisma` is missing or stale, npm sees
 * an out-of-date tree and runs `postinstall` for real.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = join(root, 'package-lock.json');
const outPath = join(root, 'package-lock.json.hash');

const hash = createHash('sha256').update(readFileSync(lockPath)).digest('hex').slice(0, 16);

try {
  if (readFileSync(outPath, 'utf8').trim() === hash) {
    console.log(`[prisma] lockfile deyismeyib (${hash}) - generate kecildi.`);
    process.exit(0);
  }
} catch {
  // No previous hash: fall through and generate.
}

console.log(`[prisma] lockfile deyismisdi (${hash}) - generate olunur...`);
const { execFileSync } = await import('node:child_process');

// The CLI is invoked through `node` rather than the `npx` shim: on Windows the
// shim is a `.cmd` file, and this repository's path contains a space, which
// breaks shell-based invocation.
execFileSync(process.execPath, [join(root, 'node_modules/prisma/build/index.js'), 'generate'], {
  stdio: 'inherit',
  cwd: root,
});
writeFileSync(outPath, `${hash}\n`, 'utf8');
console.log(`[prisma] generate tamamlandi (${hash}).`);