const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { SupervisedAppManager } = require('../apps/launcher/electron/supervised-app-manager.cjs');
const { LocalPostgresManager, availablePort } = require('../apps/launcher/electron/local-postgres-manager.cjs');

const root = path.resolve(__dirname, '..');
const stage = path.join(root, 'apps', 'launcher', 'runtime-stage');
const runtimeNode = process.execPath;
const capturedErrors = [];

function runNode(script, environment, workingDirectory) {
  return new Promise((resolve, reject) => {
    const child = spawn(runtimeNode, [script], { cwd: workingDirectory, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (value) => { output += String(value); });
    child.stderr.on('data', (value) => { output += String(value); });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve(output) : reject(new Error(output.trim() || `${path.basename(script)} exited with ${code}`)));
  });
}

async function modulesLink(applicationRoot, links) {
  const link = path.join(applicationRoot, 'node_modules');
  try { await fs.lstat(link); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.symlink(path.join(applicationRoot, 'modules-runtime'), link, process.platform === 'win32' ? 'junction' : 'dir');
    links.push(link);
  }
}

async function assertApplication(url, expectedId) {
  const [healthResponse, applicationResponse] = await Promise.all([fetch(new URL('/api/health', url)), fetch(new URL('/api/application', url))]);
  if (!healthResponse.ok || !applicationResponse.ok) throw new Error(`${expectedId} did not expose its runtime contracts`);
  const health = await healthResponse.json();
  const application = await applicationResponse.json();
  if (health.protocol !== 'timsys.application.v1' || health.application !== expectedId || application.id !== expectedId) throw new Error(`${expectedId} returned a mismatched application identity`);
  return { id: expectedId, state: health.status, components: health.components.length, functions: application.functions?.length ?? application.operationalFeatures?.length ?? 0 };
}

(async () => {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-launch-smoke-'));
  const links = [];
  const manager = new SupervisedAppManager({ runtimeExecutable: runtimeNode, startTimeoutMilliseconds: 45_000, runtimeHealthIntervalMilliseconds: 1_000 });
  const postgres = new LocalPostgresManager({ binaryRoot: path.join(stage, 'runtime', 'postgres'), dataRoot });
  manager.on('log', (entry) => { if (entry.level === 'error' && entry.message) capturedErrors.push(`${entry.appId}/${entry.process}: ${entry.message}`); });
  try {
    const platformRoot = path.join(stage, 'platform');
    const memecoinedRoot = path.join(stage, 'apps', 'memecoined');
    const dressedRoot = path.join(stage, 'apps', 'dressed');
    const researchedRoot = path.join(stage, 'apps', 'researched');
    for (const applicationRoot of [platformRoot, memecoinedRoot, dressedRoot, researchedRoot]) await modulesLink(applicationRoot, links);
    const nodeOptions = '--preserve-symlinks --preserve-symlinks-main';
    const platformPort = await availablePort();
    await manager.start(path.join(platformRoot, 'timsys.app.json'), {
      PORT: String(platformPort), DB_PATH: path.join(dataRoot, 'platform.sqlite'), NODE_PATH: path.join(platformRoot, 'modules-runtime'), NODE_OPTIONS: nodeOptions,
      JWT_SECRET: 'launch-smoke-jwt-secret-with-sufficient-length', REFRESH_TOKEN_SECRET: 'launch-smoke-refresh-secret-with-sufficient-length', TIMSYS_DESKTOP_TOKEN: 'launch-smoke-desktop-token',
    });
    const database = await postgres.start();
    const common = { ...process.env, NODE_OPTIONS: nodeOptions };
    const memecoinedPort = await availablePort();
    const memecoinedEnvironment = { ...common, MEMECOINED_ENV: 'production', MEMECOINED_APP_ROOT: memecoinedRoot, MEMECOINED_CONFIG_DIR: path.join(dataRoot, 'memecoined-config'), MEMECOINED_INSTANCE_ID: 'launch-smoke', MEMECOINED_MODE: 'paper', MEMECOINED_LOG_LEVEL: 'warn', MEMECOINED_MANAGED_DATABASE: '1', DATABASE_URL: database.runtimeUrl, DATABASE_MIGRATION_URL: database.migrationUrl, PAPER_DASHBOARD_PORT: String(memecoinedPort), SOLANA_PRIMARY_RPC_URL: 'https://api.mainnet-beta.solana.com', SOLANA_FALLBACK_RPC_URL: 'https://solana-mainnet.g.alchemy.com/v2/launch-smoke', SOLANA_CLUSTER: 'mainnet-beta', HELIUS_API_KEY: 'launch-smoke', JUPITER_API_KEY: 'launch-smoke', PAPER_TRADING_WALLET_ADDRESS: '11111111111111111111111111111111', PAPER_INITIAL_CASH_LAMPORTS: '1000000000', PAPER_EXECUTION_FEE_LAMPORTS: '5000', NODE_PATH: path.join(memecoinedRoot, 'modules-runtime') };
    await fs.mkdir(memecoinedEnvironment.MEMECOINED_CONFIG_DIR, { recursive: true });
    await runNode(path.join(memecoinedRoot, 'dist', 'scripts', 'migrate.js'), memecoinedEnvironment, memecoinedRoot);
    await postgres.grantRuntimePrivileges();
    await manager.start(path.join(memecoinedRoot, 'timsys.app.json'), memecoinedEnvironment);
    const dressedPort = await availablePort();
    const dressedEnvironment = { ...common, DRESSED_ENV: 'production', DRESSED_INSTANCE_ID: 'launch-smoke', DRESSED_LOG_LEVEL: 'warn', DRESSED_APP_ROOT: dressedRoot, DRESSED_CONFIG_DIR: path.join(dataRoot, 'dressed-config'), DRESSED_STORAGE_ROOT: path.join(dataRoot, 'dressed-storage'), DRESSED_DATABASE_URL: database.runtimeUrl, DRESSED_CV_BASE_URL: 'http://127.0.0.1:1', DRESSED_CV_TIMEOUT_MS: '100', DRESSED_PORT: String(dressedPort), NODE_PATH: path.join(dressedRoot, 'modules-runtime') };
    await fs.mkdir(dressedEnvironment.DRESSED_CONFIG_DIR, { recursive: true }); await fs.mkdir(dressedEnvironment.DRESSED_STORAGE_ROOT, { recursive: true });
    await runNode(path.join(dressedRoot, 'dist', 'scripts', 'migrate.js'), { ...dressedEnvironment, DRESSED_DATABASE_URL: database.migrationUrl }, dressedRoot);
    await postgres.grantSchemaPrivileges('dressed');
    const { Pool } = require(path.join(dressedRoot, 'modules-runtime', 'pg'));
    const readinessPool = new Pool({ connectionString: database.runtimeUrl });
    const readiness = (await readinessPool.query(`SELECT to_regclass('dressed.dressed_schema_migrations') IS NOT NULL schema_ready,to_regclass('dressed.garments') IS NOT NULL catalogue_ready,to_regclass('dressed.garment_images') IS NOT NULL photography_ready,to_regclass('dressed.visual_fingerprints') IS NOT NULL fingerprint_ready,to_regclass('dressed.styling_rule_sets') IS NOT NULL styling_ready,to_regclass('dressed.saved_outfits') IS NOT NULL ensemble_ready,to_regclass('dressed.planned_outfits') IS NOT NULL planner_ready,to_regclass('dressed.wear_events') IS NOT NULL lifecycle_ready,to_regclass('dressed.user_preferences') IS NOT NULL insights_ready`)).rows[0];
    await readinessPool.end();
    if (Object.values(readiness).some((value) => value !== true)) throw new Error(`Dress'Ed staged schema is incomplete: ${JSON.stringify(readiness)}`);
    await manager.start(path.join(dressedRoot, 'timsys.app.json'), dressedEnvironment);
    const researchedPort = await availablePort();
    const researchedEnvironment = { ...common, RESEARCHED_ENV: 'production', RESEARCHED_APP_ROOT: researchedRoot, RESEARCHED_STORAGE_ROOT: path.join(dataRoot, 'researched-storage'), RESEARCHED_DATABASE_URL: database.runtimeUrl, RESEARCHED_PORT: String(researchedPort), NODE_PATH: path.join(researchedRoot, 'modules-runtime') };
    await fs.mkdir(researchedEnvironment.RESEARCHED_STORAGE_ROOT, { recursive: true });
    await runNode(path.join(researchedRoot, 'dist', 'scripts', 'migrate.js'), { ...researchedEnvironment, RESEARCHED_DATABASE_URL: database.migrationUrl }, researchedRoot);
    await postgres.grantSchemaPrivileges('researched');
    await manager.start(path.join(researchedRoot, 'timsys.app.json'), researchedEnvironment);
    const applications = [
      await assertApplication(`http://127.0.0.1:${memecoinedPort}`, 'memecoined'),
      await assertApplication(`http://127.0.0.1:${dressedPort}`, 'dressed'),
      await assertApplication(`http://127.0.0.1:${researchedPort}`, 'researched'),
    ];
    const platformHealth = await fetch(`http://127.0.0.1:${platformPort}/health`);
    if (!platformHealth.ok) throw new Error('timsys-platform health check failed');
    await new Promise((resolve) => setTimeout(resolve, 3_500));
    const statuses = ['timsys-platform', 'memecoined', 'dressed', 'researched'].map((id) => manager.status(id));
    if (statuses.some((status) => status.state !== 'running')) throw new Error(`Runtime did not remain healthy: ${JSON.stringify(statuses)}`);
    process.stdout.write(`${JSON.stringify({ platform: 'running', applications, sustainedStatuses: statuses.map(({ id, state }) => ({ id, state })), stderrEvents: capturedErrors.length })}\n`);
  } finally {
    await manager.stopAll().catch(() => undefined);
    await postgres.stop().catch(() => undefined);
    for (const link of links.reverse()) await fs.unlink(link).catch(() => undefined);
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); if (capturedErrors.length) console.error(capturedErrors.join("\n")); process.exitCode = 1; });
