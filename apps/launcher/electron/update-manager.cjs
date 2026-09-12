const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');

const BUNDLES = Object.freeze({
  platform: ['timsys.app.json', 'index.js', 'modules-runtime'],
  memecoined: ['timsys.app.json', 'dist', 'modules-runtime'],
  dressed: ['timsys.app.json', 'dist', 'modules-runtime'],
  researched: ['timsys.app.json', 'dist', 'modules-runtime'],
  'launcher-ui': ['index.html'],
});

function compareVersions(left, right) {
  const a = String(left).split('.').map(Number), b = String(right).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const difference = (a[i] || 0) - (b[i] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function extractWithTar(archive, destination) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar.exe', ['-xf', archive, '-C', destination], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let errorText = '';
    child.stderr.on('data', value => { errorText += String(value); });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(errorText.trim() || `Archive extraction failed with code ${code}`)));
  });
}

class UpdateManager {
  constructor({ dataRoot, currentLauncherVersion, manifestUrl, fetchImpl = global.fetch, extractArchive = null }) {
    this.root = path.join(dataRoot, 'updates');
    this.stateFile = path.join(this.root, 'state.json');
    this.currentLauncherVersion = currentLauncherVersion;
    this.manifestUrl = manifestUrl;
    this.fetch = fetchImpl;
    this.extractArchive = extractArchive || extractWithTar;
    this.state = this.readState();
  }

  readState() {
    try {
      const value = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      return value?.schemaVersion === 1 ? value : { schemaVersion: 1, bundles: {} };
    } catch { return { schemaVersion: 1, bundles: {} }; }
  }

  activeRoots() {
    const roots = {};
    const allowedRoot = path.resolve(this.root, 'bundles');
    for (const [id, value] of Object.entries(this.state.bundles || {})) {
      const resolved = typeof value?.path === 'string' ? path.resolve(value.path) : '';
      if (BUNDLES[id] && resolved.startsWith(`${allowedRoot}${path.sep}`) && fs.existsSync(resolved)) roots[id] = resolved;
    }
    return roots;
  }

  async check() {
    const response = await this.fetch(this.manifestUrl, { headers: { 'User-Agent': `TimSyS-Launcher/${this.currentLauncherVersion}`, Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Update information could not be retrieved (${response.status})`);
    const manifest = await response.json();
    this.validateManifest(manifest);
    const available = manifest.bundles.filter(bundle => this.state.bundles?.[bundle.id]?.version !== bundle.version);
    return { releaseVersion: manifest.releaseVersion, publishedAt: manifest.publishedAt, notes: manifest.notes || '', available, updateAvailable: available.length > 0 };
  }

  validateManifest(manifest) {
    if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.bundles) || !manifest.releaseVersion) throw new Error('The update information has an unsupported format');
    if (manifest.minimumLauncherVersion && compareVersions(this.currentLauncherVersion, manifest.minimumLauncherVersion) < 0) throw new Error(`Launcher ${manifest.minimumLauncherVersion} or newer is required. Download the latest installer once to continue.`);
    const seen = new Set();
    for (const bundle of manifest.bundles) {
      if (!BUNDLES[bundle.id] || seen.has(bundle.id) || !/^[a-f0-9]{16,64}$/i.test(bundle.version || '') || !/^[a-f0-9]{64}$/i.test(bundle.sha256 || '') || !Number.isSafeInteger(bundle.size) || bundle.size < 1 || bundle.size > 2_000_000_000) throw new Error(`Update information for ${bundle.id || 'an unknown bundle'} is invalid`);
      seen.add(bundle.id);
      const url = new URL(bundle.url, this.manifestUrl);
      if (url.protocol !== 'https:') throw new Error(`Update download for ${bundle.id} is not secure`);
    }
  }

  async install() {
    const response = await this.fetch(this.manifestUrl, { headers: { 'User-Agent': `TimSyS-Launcher/${this.currentLauncherVersion}`, Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Update information could not be retrieved (${response.status})`);
    const manifest = await response.json();
    this.validateManifest(manifest);
    const wanted = manifest.bundles.filter(bundle => this.state.bundles?.[bundle.id]?.version !== bundle.version);
    if (!wanted.length) return { installed: [], restartRequired: false };
    const transaction = path.join(this.root, 'staging', randomUUID());
    const nextState = JSON.parse(JSON.stringify(this.state));
    await fsp.mkdir(transaction, { recursive: true });
    try {
      for (const bundle of wanted) {
        const archive = path.join(transaction, `${bundle.id}.zip`);
        const destination = path.join(this.root, 'bundles', bundle.id, bundle.version);
        await this.download(new URL(bundle.url, this.manifestUrl).href, archive, bundle.size, bundle.sha256);
        const extracted = path.join(transaction, bundle.id);
        await fsp.mkdir(extracted, { recursive: true });
        await this.extractArchive(archive, extracted);
        await this.validateBundle(bundle.id, extracted);
        await fsp.rm(destination, { recursive: true, force: true });
        await fsp.mkdir(path.dirname(destination), { recursive: true });
        await fsp.rename(extracted, destination);
        nextState.bundles[bundle.id] = { version: bundle.version, sha256: bundle.sha256, path: destination };
      }
      nextState.previousBundles = this.state.bundles || {};
      nextState.pendingRelease = manifest.releaseVersion;
      nextState.updatedAt = new Date().toISOString();
      await this.writeState(nextState);
      this.state = nextState;
      return { installed: wanted.map(({ id, version }) => ({ id, version })), restartRequired: true };
    } finally { await fsp.rm(transaction, { recursive: true, force: true }).catch(() => {}); }
  }

  async download(url, destination, expectedSize, expectedHash) {
    const response = await this.fetch(url, { headers: { 'User-Agent': `TimSyS-Launcher/${this.currentLauncherVersion}` } });
    if (!response.ok) throw new Error(`Could not download an update (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== expectedSize) throw new Error('The downloaded update has an unexpected size');
    if (createHash('sha256').update(bytes).digest('hex') !== expectedHash.toLowerCase()) throw new Error('The downloaded update failed its security check');
    await fsp.writeFile(destination, bytes, { flag: 'wx' });
  }

  async validateBundle(id, root) {
    for (const required of BUNDLES[id]) {
      const resolved = path.resolve(root, required);
      if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Unsafe path in ${id} update`);
      await fsp.access(resolved);
    }
  }

  async writeState(value) {
    await fsp.mkdir(this.root, { recursive: true });
    const temporary = `${this.stateFile}.${process.pid}.tmp`;
    await fsp.writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
    await fsp.rename(temporary, this.stateFile);
  }

  async confirmPending() {
    if (!this.state.pendingRelease) return;
    const next = { ...this.state, rollbackBundles: this.state.previousBundles || {} };
    delete next.pendingRelease;
    delete next.previousBundles;
    await this.writeState(next);
    this.state = next;
  }

  async rollbackBundle(id) {
    if (!BUNDLES[id] || !Object.prototype.hasOwnProperty.call(this.state.rollbackBundles || {}, id)) return false;
    const bundles = { ...(this.state.bundles || {}) };
    const previous = this.state.rollbackBundles[id];
    if (previous) bundles[id] = previous;
    else delete bundles[id];
    const rollbackBundles = { ...(this.state.rollbackBundles || {}) };
    delete rollbackBundles[id];
    const next = { ...this.state, bundles, rollbackBundles, rolledBackBundle: id };
    await this.writeState(next);
    this.state = next;
    return true;
  }

  async rollbackPending(reason = 'updated_runtime_failed_to_start') {
    if (!this.state.pendingRelease) return false;
    const next = { ...this.state, bundles: this.state.previousBundles || {}, rolledBackRelease: this.state.pendingRelease, rollbackReason: reason, rolledBackAt: new Date().toISOString() };
    delete next.pendingRelease;
    delete next.previousBundles;
    await this.writeState(next);
    this.state = next;
    return true;
  }
}

module.exports = { UpdateManager, compareVersions, BUNDLES };
