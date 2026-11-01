import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

export function verifyPackageLockfile(directory) {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(resolve(directory, 'package-lock.json'), 'utf8'));
  for (const [name, specifier] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (!specifier.startsWith('file:')) continue;
    const target = resolve(directory, specifier.slice(5));
    const key = relative(directory, target).replaceAll('\\', '/');
    const metadata = lock.packages?.[key];
    if (!metadata) throw new Error(`${directory}: lockfile target metadata is missing for ${name} (${key})`);
    const dependency = JSON.parse(readFileSync(resolve(target, 'package.json'), 'utf8'));
    if (metadata.name !== dependency.name || metadata.version !== dependency.version) throw new Error(`${directory}: lockfile target metadata differs for ${name}`);
    const link = lock.packages?.[`node_modules/${name}`];
    if (!link?.link || resolve(directory, link.resolved) !== target) throw new Error(`${directory}: lockfile directory link differs for ${name}`);
  }
}
