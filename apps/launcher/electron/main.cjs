const { app, BrowserWindow, ipcMain } = require('electron');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('path');
const { spawn } = require('node:child_process');
const { SupervisedAppManager } = require('./supervised-app-manager.cjs');
const { LocalPostgresManager, availablePort } = require('./local-postgres-manager.cjs');
const { createRuntimeLayout } = require('./runtime-layout.cjs');

// The launcher UI does not require GPU acceleration; disabling it improves compatibility on headless and older Windows systems.
app.disableHardwareAcceleration();

let mainWindow;
let appWindow;
let quitting = false;
const sourceRoot = path.resolve(__dirname, '../../..');
let layout;
let supervisedApps;
let postgres;
let desktopToken;
let memecoinedConfigurationStatus = null;

const paperConfigurationFields = Object.freeze([
  'SOLANA_PRIMARY_RPC_URL', 'SOLANA_FALLBACK_RPC_URL', 'HELIUS_API_KEY', 'JUPITER_API_KEY',
  'PAPER_TRADING_WALLET_ADDRESS', 'PAPER_INITIAL_CASH_LAMPORTS',
]);

async function persistentSecret(file) {
  try { return (await fsp.readFile(file, 'utf8')).trim(); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fsp.mkdir(path.dirname(file), { recursive: true });
    const value = randomBytes(48).toString('base64url');
    await fsp.writeFile(file, value, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return value;
  }
}

function runNode(script, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      ...options, windowsHide: true,
      env: { ...options.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (value) => { stdout += String(value); });
    child.stderr.on('data', (value) => { stderr += String(value); });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr.trim() || `Child process exited with ${code}`)));
  });
}

function parseEnvironment(content) {
  const result = {};
  for (const sourceLine of content.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value) result[key] = value;
  }
  return result;
}

async function memecoinedEnvironment(database) {
  const configRoot = path.join(layout.memecoinedData, 'config');
  const environmentFile = path.join(configRoot, '.env');
  await fsp.mkdir(configRoot, { recursive: true });
  if (!fs.existsSync(environmentFile)) {
    await fsp.copyFile(path.join(layout.memecoinedRoot, '.env.example'), environmentFile);
  }
  let content = await fsp.readFile(environmentFile, 'utf8');
  const legacy = parseEnvironment(content);
  if (legacy.MEMECOINED_MODE === 'supervised_live' && !paperConfigurationFields.some((name) => legacy[name])) {
    content = content.replace(/^MEMECOINED_MODE=supervised_live$/m, 'MEMECOINED_MODE=paper');
    if (!/^PAPER_INITIAL_CASH_LAMPORTS=/m.test(content)) {
      content = content.replace(/^PAPER_TRADING_WALLET_ADDRESS=.*$/m, '$&\nPAPER_INITIAL_CASH_LAMPORTS=');
    }
    await fsp.writeFile(environmentFile, content, 'utf8');
  }
  const configured = parseEnvironment(content);
  return {
    ...configured,
    MEMECOINED_APP_ROOT: layout.memecoinedRoot,
    MEMECOINED_CONFIG_DIR: configRoot,
    MEMECOINED_INSTANCE_ID: configured.MEMECOINED_INSTANCE_ID || 'local-desktop',
    MEMECOINED_LOG_LEVEL: configured.MEMECOINED_LOG_LEVEL || 'info',
    MEMECOINED_MANAGED_DATABASE: '1',
    DATABASE_URL: database.runtimeUrl,
    DATABASE_MIGRATION_URL: database.migrationUrl,
    NODE_PATH: path.join(layout.memecoinedRoot, 'modules-runtime'),
  };
}

async function ensureNodeModulesLink(applicationRoot) {
  const modules = path.join(applicationRoot, 'modules-runtime');
  const nodeModules = path.join(applicationRoot, 'node_modules');
  try {
    const existing = await fsp.lstat(nodeModules);
    if (existing.isSymbolicLink() || existing.isDirectory()) return;
    throw new Error(`${nodeModules} exists but is not a directory`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Electron Builder intentionally filters directories named node_modules from
  // extraResources. A Windows junction restores Node's standard ESM package
  // resolution without copying hundreds of megabytes on every launch.
  await fsp.symlink(modules, nodeModules, process.platform === 'win32' ? 'junction' : 'dir');
}

async function startPlatform() {
  const secretRoot = path.join(layout.platformData, 'secrets');
  const environment = {
    DB_PATH: path.join(layout.platformData, 'timsys.sqlite'),
    NODE_PATH: path.join(layout.platformRoot, 'modules-runtime'),
    JWT_SECRET: await persistentSecret(path.join(secretRoot, 'jwt-secret')),
    REFRESH_TOKEN_SECRET: await persistentSecret(path.join(secretRoot, 'refresh-token-secret')),
    TIMSYS_DESKTOP_TOKEN: desktopToken,
    ...(layout.launcherUi ? { TIMSYS_LAUNCHER_DIST: layout.launcherUi } : {}),
  };
  return supervisedApps.start(path.join(layout.platformRoot, 'timsys.app.json'), environment);
}

async function startMemecoined() {
  await ensureNodeModulesLink(layout.memecoinedRoot);
  const database = await postgres.start();
  try {
    const environment = await memecoinedEnvironment(database);
    const missing = paperConfigurationFields.filter((name) => !environment[name]);
    if (environment.MEMECOINED_MODE === 'paper' && missing.length > 0) {
      await postgres.stop();
      memecoinedConfigurationStatus = {
        id: 'memecoined', name: 'Memecoined', state: 'configuration_required',
        detail: `Paper configuration required: ${missing.join(', ')}`,
        missing, configFile: path.join(layout.memecoinedData, 'config', '.env'), processes: [],
      };
      forwardStatus(memecoinedConfigurationStatus);
      return memecoinedConfigurationStatus;
    }
    memecoinedConfigurationStatus = null;
    environment.PAPER_DASHBOARD_PORT = String(await availablePort());
    await runNode(path.join(layout.memecoinedRoot, 'dist', 'scripts', 'migrate.js'), [], {
      cwd: layout.memecoinedRoot, env: { ...process.env, ...environment },
    });
    await postgres.grantRuntimePrivileges();
    return await supervisedApps.start(path.join(layout.memecoinedRoot, 'timsys.app.json'), environment);
  } catch (error) {
    await postgres.stop().catch(() => {});
    throw error;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'default',
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('http://127.0.0.1:3000/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  layout = createRuntimeLayout({
    packaged: app.isPackaged, resourcesPath: process.resourcesPath,
    userDataPath: app.getPath('userData'), sourceRoot,
  });
  supervisedApps = new SupervisedAppManager({
    runtimeExecutable: process.execPath,
    runtimeEnvironment: { ELECTRON_RUN_AS_NODE: '1' },
  });
  postgres = new LocalPostgresManager({ binaryRoot: layout.postgresRoot, dataRoot: layout.memecoinedData });
  desktopToken = randomBytes(48).toString('base64url');
  supervisedApps.on('status', forwardStatus);
  try { await startPlatform(); }
  catch (error) { forwardStatus({ id: 'timsys-platform', state: 'failed', detail: error.message, processes: [] }); }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  Promise.resolve(supervisedApps?.stopAll())
    .then(() => postgres?.state ? postgres.backup() : undefined)
    .then(() => postgres?.stop())
    .finally(() => app.quit());
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers (if needed later)
ipcMain.handle('platform:check', async () => {
  try { return supervisedApps.status('timsys-platform'); }
  catch { return { id: 'timsys-platform', state: 'stopped' }; }
});

function requireMemecoined(appId) {
  if (appId !== 'memecoined') throw new Error(`Unsupported supervised app: ${appId}`);
}

ipcMain.handle('supervised-app:start', async (_event, appId) => {
  requireMemecoined(appId);
  return startMemecoined();
});

ipcMain.handle('supervised-app:stop', async (_event, appId) => {
  requireMemecoined(appId);
  const status = await supervisedApps.stop(appId);
  await postgres.backup();
  await postgres.stop();
  return status;
});

ipcMain.handle('platform:session', async () => {
  const status = supervisedApps.status('timsys-platform');
  if (status.state !== 'running') throw new Error('TimSyS platform is not running');
  const response = await fetch('http://127.0.0.1:3000/api/auth/desktop-session', {
    method: 'POST',
    headers: { 'X-TimSyS-Desktop-Token': desktopToken, 'X-Requested-With': 'XMLHttpRequest' },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Desktop session failed');
  return data;
});

ipcMain.handle('supervised-app:status', async (_event, appId) => {
  requireMemecoined(appId);
  if (memecoinedConfigurationStatus) return memecoinedConfigurationStatus;
  try {
    return supervisedApps.status(appId);
  } catch {
    return { id: appId, state: 'stopped', detail: null, processes: [] };
  }
});

ipcMain.handle('supervised-app:open', async (_event, appId) => {
  requireMemecoined(appId);
  if (memecoinedConfigurationStatus) {
    if (appWindow && !appWindow.isDestroyed()) { appWindow.focus(); return memecoinedConfigurationStatus; }
    appWindow = new BrowserWindow({ width: 860, height: 680, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    const fields = memecoinedConfigurationStatus.missing.map((name) => `<li><code>${name}</code></li>`).join('');
    const configFile = memecoinedConfigurationStatus.configFile.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const html = `<!doctype html><meta charset="utf-8"><title>MemecoinEd setup</title><style>body{font:16px system-ui;background:#101426;color:#e8ecff;padding:48px;line-height:1.55}main{max-width:720px;margin:auto}h1{color:#fff}code{color:#9ed0ff}li{margin:.45rem 0}.safe{color:#8ee6ae}</style><main><p class="safe">SAFE PAPER MODE · LIVE TRADING DISABLED</p><h1>MemecoinEd configuration required</h1><p>The application and its private PostgreSQL database are installed correctly. Add the following values before starting the paper engine:</p><ul>${fields}</ul><p>Configuration file:</p><p><code>${configFile}</code></p><p>Close this window after updating the file, then select <strong>Start and open</strong> again.</p></main>`;
    await appWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    appWindow.on('closed', () => { appWindow = null; });
    return memecoinedConfigurationStatus;
  }
  const status = supervisedApps.status(appId);
  if (status.state !== 'running') throw new Error(`${appId} is not running`);
  if (appWindow && !appWindow.isDestroyed()) {
    appWindow.focus();
    return status;
  }
  appWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  appWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  appWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(supervisedApps.dashboardUrl(appId)).origin) event.preventDefault();
  });
  try {
    await appWindow.loadURL(supervisedApps.dashboardUrl(appId));
  } catch (error) {
    appWindow.destroy();
    appWindow = null;
    throw new Error(`Unable to open ${appId}: ${error.message}`);
  }
  appWindow.on('closed', () => { appWindow = null; });
  return status;
});

function forwardStatus(status) {
  if (status.id === 'memecoined' && ['failed', 'stopped'].includes(status.state) && appWindow && !appWindow.isDestroyed()) {
    appWindow.close();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('supervised-app:status-changed', status);
  }
}
