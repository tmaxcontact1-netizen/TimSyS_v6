const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');

function run(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (data) => { stdout += String(data); });
    child.stderr?.on('data', (data) => { stderr += String(data); });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(executable)} exited with ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

function secret() {
  return randomBytes(32).toString('base64url');
}

function connectionUrl(user, password, port, database = 'tradeed') {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`;
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

class LocalPostgresManager {
  constructor({ binaryRoot, dataRoot, execute = run, choosePort = availablePort }) {
    this.binaryRoot = binaryRoot;
    this.dataRoot = dataRoot;
    this.execute = execute;
    this.choosePort = choosePort;
    this.clusterRoot = path.join(dataRoot, 'postgres', 'data');
    this.runtimeRoot = path.join(dataRoot, 'postgres', 'runtime');
    this.credentialsPath = path.join(dataRoot, 'postgres', 'credentials.json');
    this.logPath = path.join(dataRoot, 'postgres', 'postgres.log');
    this.backupRoot = path.join(dataRoot, 'backups');
    this.state = null;
  }

  executable(name) {
    const suffix = process.platform === 'win32' ? '.exe' : '';
    const result = path.join(this.binaryRoot, 'bin', name + suffix);
    if (!fs.existsSync(result)) throw new Error(`Packaged PostgreSQL executable is missing: ${result}`);
    return result;
  }

  async credentials() {
    try {
      return JSON.parse(await fsp.readFile(this.credentialsPath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const value = {
        schemaVersion: 1,
        administrator: 'tradeed_admin',
        administratorPassword: secret(),
        runtime: 'tradeed_runtime',
        runtimePassword: secret(),
      };
      await fsp.mkdir(path.dirname(this.credentialsPath), { recursive: true });
      await fsp.writeFile(this.credentialsPath, JSON.stringify(value), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      return value;
    }
  }

  async initialise(credentials) {
    if (fs.existsSync(path.join(this.clusterRoot, 'PG_VERSION'))) return;
    await fsp.mkdir(this.runtimeRoot, { recursive: true });
    const passwordFile = path.join(this.runtimeRoot, 'init-password.txt');
    await fsp.writeFile(passwordFile, credentials.administratorPassword, { encoding: 'utf8', mode: 0o600 });
    try {
      await this.execute(this.executable('initdb'), [
        '-D', this.clusterRoot, '--encoding=UTF8', '--locale=C',
        '--auth-host=scram-sha-256', '--auth-local=scram-sha-256',
        '--username', credentials.administrator, '--pwfile', passwordFile,
      ]);
      await fsp.appendFile(path.join(this.clusterRoot, 'postgresql.conf'), [
        '', "listen_addresses = '127.0.0.1'", 'max_connections = 20',
        "password_encryption = 'scram-sha-256'", 'fsync = on', 'synchronous_commit = on',
        'full_page_writes = on', '',
      ].join('\n'));
    } finally {
      await fsp.rm(passwordFile, { force: true });
    }
  }

  async start() {
    if (this.state) return this.state;
    const existingCluster = fs.existsSync(path.join(this.clusterRoot, 'PG_VERSION'));
    if (existingCluster && !fs.existsSync(this.credentialsPath)) throw new Error('Existing database credentials are missing; refusing replacement');
    const credentials = await this.credentials();
    await this.initialise(credentials);
    const port = await this.choosePort();
    await this.execute(this.executable('pg_ctl'), [
      '-D', this.clusterRoot, '-l', this.logPath,
      '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start',
    ]);
    const adminEnvironment = { ...process.env, PGPASSWORD: credentials.administratorPassword };
    try {
      await this.ensureDatabase(credentials, port, adminEnvironment, existingCluster);
      this.state = Object.freeze({
        port, database: this.databaseName,
        migrationUrl: connectionUrl(credentials.administrator, credentials.administratorPassword, port, this.databaseName),
        runtimeUrl: connectionUrl(credentials.runtime, credentials.runtimePassword, port, this.databaseName),
      });
      return this.state;
    } catch (error) {
      await this.stop().catch(() => {});
      throw error;
    }
  }

  async ensureDatabase(credentials, port, environment, existingCluster = false) {
    const common = ['-h', '127.0.0.1', '-p', String(port), '-U', credentials.administrator];
    const databases = await this.execute(this.executable('psql'), [
      ...common, '-d', 'postgres', '-tAc', "SELECT datname FROM pg_database WHERE datname IN ('memecoined','tradeed') ORDER BY datname",
    ], { env: environment });
    const names = databases.stdout.trim().split(/\s+/).filter(Boolean);
    if (names.length > 1 || (existingCluster && names.length !== 1)) throw new Error('Existing database identity requires reconciliation; refusing creation');
    this.databaseName = names[0] || 'tradeed';
    if (!['tradeed', 'memecoined'].includes(this.databaseName)) throw new Error('Unexpected database identity');
    const roles = await this.execute(this.executable('psql'), [
      ...common, '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_roles WHERE rolname='${credentials.runtime}'`,
    ], { env: environment });
    if (roles.stdout.trim() !== '1') {
      await this.execute(this.executable('psql'), [
        ...common, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
        `CREATE ROLE ${credentials.runtime} LOGIN PASSWORD '${credentials.runtimePassword.replaceAll("'", "''")}'`,
      ], { env: environment });
    }
    if (!names.length) {
      await this.execute(this.executable('createdb'), [...common, '-O', credentials.administrator, this.databaseName], { env: environment });
    }
  }

  async grantRuntimePrivileges() {
    return this.grantSchemaPrivileges('public');
  }

  async grantSchemaPrivileges(schema) {
    if (!this.state) throw new Error('PostgreSQL is not running');
    if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error('Invalid PostgreSQL schema name');
    const credentials = await this.credentials();
    await this.execute(this.executable('psql'), [
      '-h', '127.0.0.1', '-p', String(this.state.port), '-U', credentials.administrator,
      '-d', this.databaseName, '-v', 'ON_ERROR_STOP=1', '-c',
      `GRANT CONNECT ON DATABASE ${this.databaseName} TO ${credentials.runtime}; ` +
      `GRANT USAGE ON SCHEMA ${schema} TO ${credentials.runtime}; ` +
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${credentials.runtime}; ` +
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${credentials.runtime}; ` +
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${credentials.runtime}; ` +
      `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${credentials.runtime};`,
    ], { env: { ...process.env, PGPASSWORD: credentials.administratorPassword } });
  }

  async stop() {
    if (!fs.existsSync(path.join(this.clusterRoot, 'PG_VERSION'))) { this.state = null; return; }
    try {
      await this.execute(this.executable('pg_ctl'), ['-D', this.clusterRoot, '-w', '-m', 'fast', 'stop']);
    } catch (error) {
      if (!/not running|no server running/i.test(error.message)) throw error;
    } finally {
      this.state = null;
    }
  }

  async backup() {
    if (!this.state) throw new Error('PostgreSQL is not running');
    const credentials = await this.credentials();
    await fsp.mkdir(this.backupRoot, { recursive: true });
    const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    const destination = path.join(this.backupRoot, `tradeed-${timestamp}.dump`);
    await this.execute(this.executable('pg_dump'), [
      '-h', '127.0.0.1', '-p', String(this.state.port), '-U', credentials.administrator,
      '-d', this.databaseName, '--format=custom', '--file', destination,
    ], { env: { ...process.env, PGPASSWORD: credentials.administratorPassword } });
    const backups = (await fsp.readdir(this.backupRoot))
      .filter((name) => /^tradeed-.*\.dump$/.test(name)).sort().reverse();
    for (const expired of backups.slice(7)) await fsp.rm(path.join(this.backupRoot, expired), { force: true });
    return destination;
  }
}

module.exports = { LocalPostgresManager, connectionUrl, availablePort };
