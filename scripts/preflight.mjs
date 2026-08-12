import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const git = process.env.GIT_EXECUTABLE || 'git';
const tracked = execFileSync(git, ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const failures = [];
const forbiddenFiles = /(^|\/)(\.env|[^/]+\.(pem|p12|pfx|key))$/i;
tracked.filter((file) => forbiddenFiles.test(file) && !file.endsWith('.env.example')).forEach((file) => failures.push(`tracked secret-bearing file: ${file}`));

const platform = readFileSync(resolve(root, 'platform/index.js'), 'utf8');
if (!/server\.listen\(port, '127\.0\.0\.1'/.test(platform)) failures.push('platform is not restricted to the IPv4 loopback interface');
if (/CORS_ORIGINS \|\| '\*'/.test(platform)) failures.push('platform defaults to wildcard CORS');

const launcher = readFileSync(resolve(root, 'apps/launcher/electron/main.cjs'), 'utf8');
if (!/nodeIntegration: false/.test(launcher) || !/contextIsolation: true/.test(launcher)) failures.push('Electron renderer isolation is not enforced');

if (failures.length) {
  console.error('Preflight failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log(`Preflight passed: ${tracked.length} tracked files checked; loopback, CORS, and Electron isolation verified.`);
