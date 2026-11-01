import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPackageLockfile } from './workspace-lockfiles.mjs';

test('all installed workspace packages have complete local dependency targets', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  for (const name of ['platform', 'apps/launcher', 'apps/principaled', 'apps/tradeed', 'apps/dressed', 'apps/researched', 'platform/services/tradeed', 'platform/services/dressed', 'platform/services/researched']) verifyPackageLockfile(resolve(root, name));
});

test('a directory link without its target metadata fails before npm ci', () => {
  const root = mkdtempSync(join(tmpdir(), 'timsys-lock-target-'));
  const app = join(root, 'app'), sdk = join(root, 'sdk'); mkdirSync(app); mkdirSync(sdk);
  writeFileSync(join(sdk, 'package.json'), JSON.stringify({ name: '@fixture/sdk', version: '1.0.0' }));
  writeFileSync(join(app, 'package.json'), JSON.stringify({ dependencies: { '@fixture/sdk': 'file:../sdk' } }));
  const lock = { lockfileVersion: 3, packages: { 'node_modules/@fixture/sdk': { resolved: '../sdk', link: true } } };
  writeFileSync(join(app, 'package-lock.json'), JSON.stringify(lock));
  assert.throws(() => verifyPackageLockfile(app), /target metadata is missing/);
  lock.packages['../sdk'] = { name: '@fixture/sdk', version: '1.0.0' };
  writeFileSync(join(app, 'package-lock.json'), JSON.stringify(lock));
  assert.doesNotThrow(() => verifyPackageLockfile(app));
  lock.packages['../sdk'].version = '0.0.0';
  writeFileSync(join(app, 'package-lock.json'), JSON.stringify(lock));
  assert.throws(() => verifyPackageLockfile(app), /metadata differs/);
});
