import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, 'apps', 'launcher', 'runtime-stage');
const output = join(root, 'dist-updates');
const releaseVersion = process.argv[2];
const onlyArgument = process.argv.find(value => value.startsWith('--only='));
const selectedBundles = onlyArgument ? new Set(onlyArgument.slice('--only='.length).split(',').filter(Boolean)) : null;
if (!/^\d{4}\.\d{2}\.\d+(?:[-.][a-z0-9]+)?$/i.test(releaseVersion || '')) {
  throw new Error('Usage: npm run update:bundle -- 2026.09.1');
}

const sources = Object.freeze({
  platform: join(stage, 'platform'),
  memecoined: join(stage, 'apps', 'memecoined'),
  dressed: join(stage, 'apps', 'dressed'),
  researched: join(stage, 'apps', 'researched'),
  'launcher-ui': join(root, 'apps', 'launcher', 'dist'),
});
if (selectedBundles) {
  for (const id of selectedBundles) if (!Object.prototype.hasOwnProperty.call(sources, id)) throw new Error(`Unknown bundle in --only: ${id}`);
}

async function createArchive(source, archive) {
  await new Promise((resolveRun, reject) => {
    const child = spawn('tar.exe', ['-a', '-cf', archive, '-C', source, '.'], { windowsHide: true, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`PowerShell exited with ${code}`)));
  });
}

async function contentVersion(directory) {
  const digest = createHash('sha256');
  async function visit(current, prefix = '') {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(join(current, entry.name), relative);
      else if (entry.isFile()) {
        digest.update(relative);
        digest.update('\0');
        digest.update(await readFile(join(current, entry.name)));
        digest.update('\0');
      }
    }
  }
  await visit(directory);
  return digest.digest('hex').slice(0, 24);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const bundles = [];
for (const [id, source] of Object.entries(sources)) {
  if (selectedBundles && !selectedBundles.has(id)) continue;
  await access(source);
  const filename = `${id}-${releaseVersion}.zip`;
  const archive = join(output, filename);
  await createArchive(source, archive);
  const bytes = await readFile(archive);
  bundles.push({
    id, version: await contentVersion(source),
    url: `https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/download/${releaseVersion}/${filename}`,
    size: (await stat(archive)).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const manifest = {
  schemaVersion: 1,
  releaseVersion,
  minimumLauncherVersion: '1.0.14',
  publishedAt: new Date().toISOString(),
  notes: 'Verified TimSyS application update.',
  bundles,
};
await writeFile(join(output, 'timsys-update.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`Created ${bundles.length} verified update bundles in ${output}\n`);
