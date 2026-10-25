/**
 * Deploys the three Vercel projects in order.
 *
 * The order matters: the API has to be live before the admin panel and the web
 * app point at it, and the database has to be migrated before the API can serve
 * anything useful.
 *
 *   vercel login          # once, in a normal terminal
 *   npm run deploy:vercel
 *
 * Required environment:
 *   VERCEL_ORG_ID / VERCEL_PROJECT_ID_* only matter for CI; locally the CLI
 *   stores the link in each app's .vercel directory.
 *
 * Secrets come from `deploy/vercel-env.mjs` (git-ignored) so nothing sensitive
 * is typed at a prompt and nothing is written into the repo.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = process.platform === 'win32' ? 'vercel.cmd' : 'vercel';

const PROJECTS = [
  { name: 'fegih-api', dir: 'apps/api', envFile: join(root, 'deploy/vercel-env.mjs') },
  { name: 'fegih-admin', dir: 'apps/admin', envFile: join(root, 'deploy/vercel-env.mjs') },
  { name: 'fegih', dir: 'apps/mobile', envFile: join(root, 'deploy/vercel-env.mjs') },
];

function run(command, args, options = {}) {
  const { input, ...rest } = options;
  return new Promise((resolve, reject) => {
    // `input` needs a pipe on stdin; without one the CLI would wait forever.
    const child = spawn(command, args, {
      stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
      shell: process.platform === 'win32',
      ...rest,
    });
    child.on('error', reject);
    if (input !== undefined && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} -> ${code}`))));
  });
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

// --- Preconditions ---------------------------------------------------------
try {
  await run(CLI, ['whoami'], { cwd: root });
} catch {
  fail('Vercel CLI login olmayib. Əvvəlc bir terminalda:  vercel login');
}

if (!existsSync(PROJECTS[0].envFile)) {
  fail(
    'deploy/vercel-env.mjs yoxdur.\n' +
      '  cp deploy/vercel-env.example.mjs deploy/vercel-env.mjs\n' +
      '  Sonra içindəki dəyərləri doldur (Neon URL-i, JWT sirləri, admin parolu).',
  );
}

const { VERCEL_ENVS } = await import(PROJECTS[0].envFile);
if (!VERCEL_ENVS || typeof VERCEL_ENVS !== 'object') {
  fail('deploy/vercel-env.mjs VERCEL_ENVS obyekti ixrac etməlidir.');
}

const missing = ['api', 'admin', 'web'].filter((group) => !VERCEL_ENVS[group] || !Object.keys(VERCEL_ENVS[group]).length);
if (missing.length) {
  fail(`deploy/vercel-env.mjs bu qrupları boş buraxıb: ${missing.join(', ')}`);
}

// --- Deploy ----------------------------------------------------------------
for (const project of PROJECTS) {
  const cwd = join(root, project.dir);
  console.log(`\n=== ${project.name} (${project.dir}) ===\n`);

  await run(CLI, ['link', '--yes', '--project', project.name], { cwd });
  console.log(`  -- link etdi`);

  for (const [key, value] of Object.entries(VERCEL_ENVS[project.name])) {
    // `vercel env add` reads from stdin; passing it as an argument would leak the
    // secret into the process list and the shell history.
    await run(CLI, ['env', 'add', key, 'production', '--force', '--sensitive'], { cwd, input: `${value}\n` });
    console.log(`  -- ${key}`);
  }

  await run(CLI, ['deploy', '--prod', '--yes'], { cwd });
  console.log(`  -- deploy etdi`);
}

console.log('\nHamısı deploy edildi. Yoxlama:\n');
console.log('  https://fegih-api.vercel.app/api/v1/health');
console.log('  https://fegih-admin.vercel.app');
console.log('  https://fegih.vercel.app\n');
console.log('DB-ni doldurmak üçün (bir dəfə):\n');
console.log('  npx prisma migrate deploy\n');
console.log('  node --import tsx prisma/seed/index.ts\n');
console.log('Bu iki əmri Neon konsolundakı DATABASE_URL ilə işlətmək lazımdır.\n');