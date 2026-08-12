const { EventEmitter } = require('node:events');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const TERMINAL_STATES = new Set(['failed', 'stopped']);
const ACTIVE_STATES = new Set(['starting', 'running', 'degraded']);

function assertManifest(value, manifestPath) {
  if (!value || value.schemaVersion !== 1 || value.kind !== 'supervised-child') {
    throw new Error(`Unsupported supervised-app manifest: ${manifestPath}`);
  }
  if (!value.id || !value.applicationRootEnvironment || !value.processes || Object.keys(value.processes).length === 0) {
    throw new Error(`Incomplete supervised-app manifest: ${manifestPath}`);
  }
  return value;
}

function interpolateEnvironment(value, environment) {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    const resolved = environment[name];
    if (!resolved) throw new Error(`Missing environment variable: ${name}`);
    return resolved;
  });
}

class SupervisedAppManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.spawnProcess = options.spawnProcess || spawn;
    this.fetchHealth = options.fetchHealth || fetch;
    this.readManifest = options.readManifest || readFile;
    this.now = options.now || (() => new Date().toISOString());
    this.healthIntervalMilliseconds = options.healthIntervalMilliseconds ?? 1000;
    this.startTimeoutMilliseconds = options.startTimeoutMilliseconds ?? 30000;
    this.runtimeHealthIntervalMilliseconds = options.runtimeHealthIntervalMilliseconds ?? 5000;
    this.runtimeExecutable = options.runtimeExecutable || process.execPath;
    this.runtimeEnvironment = options.runtimeEnvironment || {};
    this.applications = new Map();
  }

  async load(manifestPath) {
    const absoluteManifestPath = path.resolve(manifestPath);
    const manifest = assertManifest(JSON.parse(await this.readManifest(absoluteManifestPath, 'utf8')), absoluteManifestPath);
    const applicationRoot = path.dirname(absoluteManifestPath);
    const existing = this.applications.get(manifest.id);
    if (existing && !TERMINAL_STATES.has(existing.state)) throw new Error(`${manifest.id} is already managed`);
    const record = {
      id: manifest.id, manifest, applicationRoot, state: 'stopped', detail: null,
      processes: new Map(), startedAt: null, updatedAt: this.now(), stopPromise: null,
      environment: null, healthTimer: null, healthFailures: 0,
    };
    this.applications.set(manifest.id, record);
    return this.snapshot(record);
  }

  async start(manifestPath, extraEnvironment = {}) {
    const loaded = await this.load(manifestPath);
    const record = this.applications.get(loaded.id);
    this.transition(record, 'starting');
    const environment = {
      ...record.manifest.environmentDefaults, ...process.env, ...extraEnvironment,
      [record.manifest.applicationRootEnvironment]: record.applicationRoot,
    };
    record.environment = environment;
    const workingDirectory = path.resolve(record.applicationRoot, record.manifest.workingDirectory || '.');
    try {
      for (const [name, specification] of Object.entries(record.manifest.processes)) {
        const command = specification.command === 'node' ? this.runtimeExecutable : specification.command;
        const childEnvironment = specification.command === 'node'
          ? { ...environment, ...this.runtimeEnvironment }
          : environment;
        const child = this.spawnProcess(command, specification.arguments || [], {
          cwd: workingDirectory, env: childEnvironment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
        });
        record.processes.set(name, child);
        this.observeChild(record, name, child);
      }
      record.startedAt = this.now();
      await this.waitUntilHealthy(record, environment);
      this.transition(record, 'running');
      this.beginRuntimeHealthMonitoring(record);
      return this.snapshot(record);
    } catch (error) {
      this.transition(record, 'failed', error.message);
      await this.stop(record.id);
      this.transition(record, 'failed', error.message);
      throw error;
    }
  }

  async waitUntilHealthy(record, environment) {
    const health = this.healthSpecification(record);
    if (!health) return;
    const url = interpolateEnvironment(health.url, environment);
    const deadline = Date.now() + this.startTimeoutMilliseconds;
    let lastError = 'health check did not complete';
    while (Date.now() < deadline) {
      if (record.state === 'failed') throw new Error(record.detail);
      try {
        const response = await this.fetchHealth(url);
        if (response.status === health.expectedStatus) return;
        lastError = `health endpoint returned ${response.status}`;
      } catch (error) {
        lastError = error.message;
      }
      await new Promise((resolve) => setTimeout(resolve, this.healthIntervalMilliseconds));
    }
    throw new Error(`Timed out starting ${record.id}: ${lastError}`);
  }

  observeChild(record, name, child) {
    for (const [stream, level] of [[child.stdout, 'info'], [child.stderr, 'error']]) {
      stream?.on?.('data', (chunk) => this.emit('log', { appId: record.id, process: name, level, message: String(chunk).trimEnd() }));
    }
    child.once('error', (error) => {
      if (ACTIVE_STATES.has(record.state)) {
        this.clearRuntimeHealthMonitoring(record);
        this.transition(record, 'failed', `${name}: ${error.message}`);
        void this.stop(record.id).catch(() => {});
      }
    });
    child.once('exit', (code, signal) => {
      record.processes.delete(name);
      if (ACTIVE_STATES.has(record.state)) {
        this.clearRuntimeHealthMonitoring(record);
        this.transition(record, 'failed', `${name} exited (${signal || code})`);
        void this.stop(record.id).catch(() => {});
      }
    });
  }

  beginRuntimeHealthMonitoring(record) {
    this.clearRuntimeHealthMonitoring(record);
    const health = this.healthSpecification(record);
    if (!health || this.runtimeHealthIntervalMilliseconds <= 0) return;
    record.healthTimer = setInterval(async () => {
      if (record.state !== 'running') return;
      try {
        const response = await this.fetchHealth(interpolateEnvironment(health.url, record.environment));
        if (response.status !== health.expectedStatus) throw new Error(`health endpoint returned ${response.status}`);
        record.healthFailures = 0;
      } catch (error) {
        record.healthFailures += 1;
        if (record.healthFailures >= 3) {
          this.transition(record, 'degraded', `Runtime health check failed: ${error.message}`);
        }
      }
    }, this.runtimeHealthIntervalMilliseconds);
    record.healthTimer.unref?.();
  }

  clearRuntimeHealthMonitoring(record) {
    if (record.healthTimer) clearInterval(record.healthTimer);
    record.healthTimer = null;
    record.healthFailures = 0;
  }

  async stop(appId) {
    const record = this.requireRecord(appId);
    if (record.stopPromise) return record.stopPromise;
    if (record.state === 'stopped') return this.snapshot(record);
    record.stopPromise = this.stopProcesses(record).finally(() => { record.stopPromise = null; });
    return record.stopPromise;
  }

  async stopProcesses(record) {
    this.clearRuntimeHealthMonitoring(record);
    const preserveFailure = record.state === 'failed';
    if (!preserveFailure) this.transition(record, 'stopping');
    const signal = record.manifest.shutdown?.signal || 'SIGTERM';
    const timeout = record.manifest.shutdown?.timeoutMilliseconds || 10000;
    const children = [...record.processes.values()];
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    }
    await Promise.race([
      Promise.all(children.map((child) => new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        child.once('exit', resolve);
      }))),
      new Promise((resolve) => setTimeout(resolve, timeout)),
    ]);
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    record.processes.clear();
    if (!preserveFailure) this.transition(record, 'stopped');
    return this.snapshot(record);
  }

  async stopAll() {
    await Promise.all([...this.applications.keys()].map((id) => this.stop(id)));
  }

  status(appId) { return this.snapshot(this.requireRecord(appId)); }

  dashboardUrl(appId, environment) {
    const record = this.requireRecord(appId);
    const healthUrl = this.healthSpecification(record)?.url;
    if (!healthUrl) throw new Error(`${appId} has no dashboard URL`);
    const url = new URL(interpolateEnvironment(healthUrl, environment || record.environment || process.env));
    url.pathname = '/'; url.search = ''; url.hash = '';
    return url.toString();
  }

  requireRecord(appId) {
    const record = this.applications.get(appId);
    if (!record) throw new Error(`Unknown supervised app: ${appId}`);
    return record;
  }

  healthSpecification(record) {
    return Object.values(record.manifest.processes).find((process) => process.health)?.health || null;
  }

  transition(record, state, detail = null) {
    record.state = state; record.detail = detail; record.updatedAt = this.now();
    this.emit('status', this.snapshot(record));
  }

  snapshot(record) {
    return {
      id: record.id, name: record.manifest.name, state: record.state, detail: record.detail,
      processes: [...record.processes.keys()], startedAt: record.startedAt, updatedAt: record.updatedAt,
    };
  }
}

module.exports = { SupervisedAppManager, interpolateEnvironment };
