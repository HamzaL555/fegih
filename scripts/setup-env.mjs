import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const examplePath = resolve(root, '.env.example');
const envPath = resolve(root, '.env');

const secret = (bytes = 48) => randomBytes(bytes).toString('base64url');
const generated = [];

if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  generated.push('Created .env from .env.example');
}

let content = existsSync(envPath) ? readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '') : '';
const replaceEmpty = (key, value) => {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (!pattern.test(content)) {
    content += `\n${key}=${JSON.stringify(value)}\n`;
  } else if (/^[^=]+=(?:""|''|)$/m.test(content.split('\n').find((line) => line.startsWith(`${key}=`)) ?? '')) {
    content = content.replace(pattern, `${key}=${JSON.stringify(value)}`);
    generated.push(`Generated ${key}`);
  }
};

replaceEmpty('JWT_SECRET', secret());
replaceEmpty('JWT_REFRESH_SECRET', secret());
replaceEmpty('ADMIN_PASSWORD', `Fegih-${secret(9)}`);

writeFileSync(envPath, content.trimEnd() + '\n', 'utf8');

if (generated.length) {
  console.log(`[setup] ${generated.join(', ')}`);
}

const adminLine = content.split(/\r?\n/).find((line) => line.startsWith('ADMIN_PASSWORD='));
if (adminLine && process.env.VERBOSE_SETUP === '1') {
  console.log(`[setup] Admin password is stored in ${envPath}`);
}
