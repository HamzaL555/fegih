import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import qrcode from 'qrcode-terminal';
import { config } from 'dotenv';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');
config({ path: envPath, quiet: true });

const windows = process.platform === 'win32';
const prismaCli = resolve(root, 'node_modules/prisma/build/index.js');
const concurrentlyCli = resolve(root, 'node_modules/concurrently/dist/bin/concurrently.js');
const docker = windows ? 'docker.exe' : 'docker';

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env, shell: false });
  if (result.error) {
    console.error(`[dev] failed to start ${command}:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
};

function getLanAddress() {
  const candidates = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => (entry.family === 'IPv4' || entry.family === 4) && !entry.internal)
    .map((entry) => entry.address);
  return candidates.find((address) => /^192\.168\./.test(address))
    ?? candidates.find((address) => /^10\./.test(address))
    ?? candidates.find((address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address))
    ?? candidates[0];
}

function printExpoQr() {
  const address = getLanAddress();
  if (!address) {
    console.warn('[dev] No LAN IPv4 address found. Set EXPO_PUBLIC_API_URL or connect to Wi-Fi.');
    return;
  }
  const expoUrl = `exp://${address}:8081`;
  console.log(`\n[dev] Expo Go URL: ${expoUrl}`);
  qrcode.generate(expoUrl, { small: true });
}

function prismaClientIsCurrent() {
  const schemaPath = resolve(root, 'prisma', 'schema.prisma');
  const clientPath = resolve(root, 'node_modules', '.prisma', 'client', 'index.js');
  if (!existsSync(schemaPath) || !existsSync(clientPath)) return false;
  try {
    return statSync(schemaPath).mtimeMs <= statSync(clientPath).mtimeMs;
  } catch {
    return false;
  }
}

run(process.execPath, [resolve(root, 'scripts/setup-env.mjs')]);
config({ path: envPath, override: true, quiet: true });
if (!process.env.NEXT_PUBLIC_API_URL) process.env.NEXT_PUBLIC_API_URL = `http://localhost:${process.env.API_PORT || 4000}/api/v1`;
run(docker, ['compose', 'up', '-d', '--wait', 'postgres']);
if (prismaClientIsCurrent()) {
  console.log('[dev] Prisma client is up to date; skipping generate.');
} else {
  run(process.execPath, [prismaCli, 'generate']);
}
run(process.execPath, [prismaCli, 'migrate', 'deploy']);
run(process.execPath, [prismaCli, 'db', 'seed']);

console.log('\n[dev] PostgreSQL, API, Admin Panel and Expo are starting.');
console.log('[dev] Scan the Expo QR code with Expo Go. Keep this computer and phone on the same Wi-Fi.');
printExpoQr();

const child = spawn(process.execPath, [concurrentlyCli, '--kill-others-on-fail', '--names', 'api,admin,mobile', '--prefix-colors', 'cyan,magenta,green', 'npm:dev:api', 'npm:dev:admin', 'npm:dev:mobile'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: false,
});
const shutdown = () => child.kill();
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
child.on('exit', (code) => process.exit(code ?? 0));
