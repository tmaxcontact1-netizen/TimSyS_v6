import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, 'apps', 'launcher', 'runtime-stage');
const outputDirectoryArgument = process.argv.find(value => value.startsWith('--output-dir='));
const outputDirectoryName = outputDirectoryArgument?.slice('--output-dir='.length) ?? null;
if (outputDirectoryName !== null && !/^[a-z0-9][a-z0-9-]{0,79}$/i.test(outputDirectoryName)) {
  throw new Error('--output-dir must be a simple folder name under dist-updates');
}
const output = outputDirectoryName === null
  ? join(root, 'dist-updates') : join(root, 'dist-updates', outputDirectoryName);
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
if (outputDirectoryName !== null) {
  try {
    await access(output);
    throw new Error(`Isolated output directory already exists: ${output}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function createArchive(source, archive) {
  await new Promise((resolveRun, reject) => {
    const child = spawn('tar.exe', ['-a', '-cf', archive, '-C', source, '.'], { windowsHide: true, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`PowerShell exited with ${code}`)));
  });
}

async function runNodeScript(script, arguments_ = []) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [join(root, 'scripts', script), ...arguments_], {
      cwd: root,
      windowsHide: true,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', code => code === 0
      ? resolveRun()
      : reject(new Error(`${script} exited with ${code}`)));
  });
}

async function readSourceCommit() {
  return await new Promise((resolveRun, reject) => {
    const chunks = [];
    const child = spawn('git', ['rev-parse', 'HEAD'], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.once('error', reject);
    child.once('exit', code => code === 0
      ? resolveRun(Buffer.concat(chunks).toString('utf8').trim())
      : reject(new Error(`Unable to read source commit (${code})`)));
  });
}

async function verifyMemecoinedPipeline() {
  if (!process.env.MEMECOINED_VERIFY_ADMIN_URL) {
    throw new Error('MemeCoin\'Ed update requires MEMECOINED_VERIFY_ADMIN_URL for its isolated full-path verification');
  }
  const runDiagnostic = async (densityMode = false) => {
    const output = await new Promise((resolveRun, reject) => {
      const chunks = [];
      const child = spawn(process.execPath, [join(root, 'apps', 'memecoined', 'dist', 'scripts', 'diagnose-profile-roundtrips.js')], {
        cwd: join(root, 'apps', 'memecoined'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...(densityMode ? { MEMECOINED_VERIFY_DENSITY: '1' } : {}) },
      });
      child.stdout.on('data', chunk => { chunks.push(chunk); process.stdout.write(chunk); });
      child.stderr.on('data', chunk => process.stderr.write(chunk));
      child.once('error', reject);
      child.once('exit', code => code === 0
        ? resolveRun(Buffer.concat(chunks).toString('utf8'))
        : reject(new Error(`MemeCoin'Ed ${densityMode ? 'production-density' : 'full-path'} verification exited with ${code}`)));
    });
    return JSON.parse(output);
  };
  const fullPath = await runDiagnostic(false);
  const productionDensity = await runDiagnostic(true);
  if (fullPath.diagnostic !== 'discovery-to-displayed-paper-result' ||
      fullPath.controlledFixture !== true || fullPath.verificationMode !== 'all-profiles' ||
      fullPath.profiles?.length !== 20 ||
      !fullPath.profiles.some(profile => profile.profile_id === 'oscillation_trader') ||
      productionDensity.diagnostic !== 'discovery-to-displayed-paper-result' ||
      productionDensity.verificationMode !== 'production-density' ||
      productionDensity.profiles?.length !== 1 ||
      productionDensity.profiles.some(profile => Number(profile.buys) === 0 || Number(profile.sells) === 0) ||
      Number(productionDensity.productionDensity?.observed_tokens ?? 0) < 50 ||
      Number(productionDensity.productionDensity?.dense_tokens ?? 0) < 8 ||
      Number(productionDensity.productionDensity?.eligible_tokens ?? 0) < 5 ||
      productionDensity.coldStartProgression?.initialObservations !== 0 ||
      productionDensity.coldStartProgression?.simulatedHours !== 4 ||
      Number(productionDensity.coldStartProgression?.pinned_tokens ?? 0) !== 8) {
    throw new Error('MemeCoin\'Ed full-path verification returned incomplete evidence');
  }
  return { passedAt: new Date().toISOString(),
    commands: ['node dist/scripts/diagnose-profile-roundtrips.js',
      'MEMECOINED_VERIFY_DENSITY=1 node dist/scripts/diagnose-profile-roundtrips.js'],
    fullPath, productionDensity };
}

async function stageHasProductionDependencies() {
  try {
    await Promise.all([
      access(join(stage, 'platform', 'modules-runtime')),
      access(join(stage, 'apps', 'memecoined', 'modules-runtime')),
      access(join(stage, 'apps', 'dressed', 'modules-runtime')),
      access(join(stage, 'apps', 'researched', 'modules-runtime')),
    ]);
    return true;
  } catch {
    return false;
  }
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

// A release must never trust a previous packaging run. Build current sources,
// refresh the runtime stage, and prove that the staged application trees match
// before calculating bundle versions.
await runNodeScript('workspace.mjs', ['build']);
await runNodeScript(
  'prepare-windows-runtime.mjs',
  await stageHasProductionDependencies() ? ['--refresh-source-only'] : [],
);
await runNodeScript('verify-windows-runtime.mjs');
const memecoinedVerification = !selectedBundles || selectedBundles.has('memecoined')
  ? await verifyMemecoinedPipeline() : null;
const sourceCommit = await readSourceCommit();

if (outputDirectoryName === null) await rm(output, { recursive: true, force: true });
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
if (memecoinedVerification) {
  const bundle = bundles.find(item => item.id === 'memecoined');
  if (!bundle) throw new Error('MemeCoin\'Ed bundle is missing after verification');
  await writeFile(join(output, `memecoined-verification-${releaseVersion}.json`), `${JSON.stringify({
    schemaVersion: 1, releaseVersion, bundleVersion: bundle.version, bundleSha256: bundle.sha256,
    sourceCommit,
    ...memecoinedVerification,
  }, null, 2)}\n`, 'utf8');
}
process.stdout.write(`Created ${bundles.length} verified update bundles in ${output}\n`);
