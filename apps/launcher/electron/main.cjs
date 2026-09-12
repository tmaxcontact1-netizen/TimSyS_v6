const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('path');
const { spawn } = require('node:child_process');
const { SupervisedAppManager } = require('./supervised-app-manager.cjs');
const { LocalPostgresManager, availablePort } = require('./local-postgres-manager.cjs');
const { createRuntimeLayout } = require('./runtime-layout.cjs');
const { backupPlatformDatabase, diagnostics } = require('./runtime-recovery.cjs');
const { AiCredentialVault } = require('./ai-credential-vault.cjs');
const { UpdateManager } = require('./update-manager.cjs');

// The launcher UI does not require GPU acceleration; disabling it improves compatibility on headless and older Windows systems.
app.disableHardwareAcceleration();

let mainWindow;
let appWindow;
let appWindowId = null;
let quitting = false;
const sourceRoot = path.resolve(__dirname, '../../..');
let layout;
let supervisedApps;
let postgres;
let desktopToken;
let memecoinedConfigurationStatus = null;
let platformUrl = null;
let aiCredentialVault;
let applyingResearchedProfile = false;
let updateManager;

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
    NODE_OPTIONS: packagedNodeOptions(process.env.NODE_OPTIONS),
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

function packagedNodeOptions(existing = '') {
  const required = ['--preserve-symlinks', '--preserve-symlinks-main'];
  const options = existing.trim().split(/\s+/).filter(Boolean);
  for (const option of required) if (!options.includes(option)) options.push(option);
  return options.join(' ');
}

async function startPlatform() {
  await ensureNodeModulesLink(layout.platformRoot);
  const secretRoot = path.join(layout.platformData, 'secrets');
  const port = app.isPackaged ? await availablePort() : 3000;
  const environment = {
    PORT: String(port),
    DB_PATH: path.join(layout.platformData, 'timsys.sqlite'),
    NODE_PATH: path.join(layout.platformRoot, 'modules-runtime'),
    NODE_OPTIONS: packagedNodeOptions(process.env.NODE_OPTIONS),
    JWT_SECRET: await persistentSecret(path.join(secretRoot, 'jwt-secret')),
    REFRESH_TOKEN_SECRET: await persistentSecret(path.join(secretRoot, 'refresh-token-secret')),
    TIMSYS_DESKTOP_TOKEN: desktopToken,
    ...await aiCredentialVault.activeEnvironment(),
    ...(layout.launcherUi ? { TIMSYS_LAUNCHER_DIST: layout.launcherUi } : {}),
  };
  const status = await supervisedApps.start(path.join(layout.platformRoot, 'timsys.app.json'), environment);
  platformUrl = supervisedApps.dashboardUrl('timsys-platform');
  return status;
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

async function dressedEnvironment(database) {
  const configRoot = path.join(layout.dressedData, 'config');
  const storageRoot = path.join(layout.dressedData, 'private-storage');
  await fsp.mkdir(configRoot, { recursive: true });
  await fsp.mkdir(storageRoot, { recursive: true });
  return {
    DRESSED_ENV: app.isPackaged ? 'production' : 'development',
    DRESSED_INSTANCE_ID: 'local-desktop',
    DRESSED_LOG_LEVEL: 'info',
    DRESSED_APP_ROOT: layout.dressedRoot,
    DRESSED_CONFIG_DIR: configRoot,
    DRESSED_STORAGE_ROOT: storageRoot,
    DRESSED_DATABASE_URL: database.runtimeUrl,
    DRESSED_CV_BASE_URL: 'http://127.0.0.1:8091',
    DRESSED_CV_TIMEOUT_MS: '10000',
    DRESSED_PORT: String(await availablePort()),
    NODE_PATH: path.join(layout.dressedRoot, 'modules-runtime'),
    NODE_OPTIONS: packagedNodeOptions(process.env.NODE_OPTIONS),
  };
}

async function startDressed() {
  await ensureNodeModulesLink(layout.dressedRoot);
  const database = await postgres.start();
  const environment = await dressedEnvironment(database);
  await runNode(path.join(layout.dressedRoot, 'dist', 'scripts', 'migrate.js'), [], {
    cwd: layout.dressedRoot,
    env: { ...process.env, ...environment, DRESSED_DATABASE_URL: database.migrationUrl },
  });
  await postgres.grantSchemaPrivileges('dressed');
  return supervisedApps.start(path.join(layout.dressedRoot, 'timsys.app.json'), environment);
}

async function startResearched() {
  await ensureNodeModulesLink(layout.researchedRoot);
  const database = await postgres.start();
  const environment = {
    RESEARCHED_ENV: app.isPackaged ? 'production' : 'development',
    RESEARCHED_APP_ROOT: layout.researchedRoot,
    RESEARCHED_STORAGE_ROOT: path.join(layout.researchedData, 'private-storage'),
    RESEARCHED_DATABASE_URL: database.runtimeUrl,
    RESEARCHED_PORT: String(await availablePort()),
    NODE_PATH: path.join(layout.researchedRoot, 'modules-runtime'),
    NODE_OPTIONS: packagedNodeOptions(process.env.NODE_OPTIONS),
    ...await aiCredentialVault.activeEnvironment(),
  };
  await fsp.mkdir(environment.RESEARCHED_STORAGE_ROOT, { recursive: true });
  await runNode(path.join(layout.researchedRoot, 'dist', 'scripts', 'migrate.js'), [], {
    cwd: layout.researchedRoot, env: { ...process.env, ...environment, RESEARCHED_DATABASE_URL: database.migrationUrl },
  });
  await postgres.grantSchemaPrivileges('researched');
  return supervisedApps.start(path.join(layout.researchedRoot, 'timsys.app.json'), environment);
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
    mainWindow.loadURL(platformUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function focusLauncher() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function stopChild(appId) {
  try { await supervisedApps.stop(appId); } catch {}
  if (appId === 'memecoined') await postgres.backup().catch(() => {});
}

function bindAppWindowLifecycle(window, appId) {
  window.on('closed', () => {
    if (appWindow === window) { appWindow = null; appWindowId = null; }
    void stopChild(appId);
    focusLauncher();
  });
}

app.whenReady().then(async () => {
  updateManager = new UpdateManager({
    dataRoot: app.getPath('userData'),
    currentLauncherVersion: app.getVersion(),
    manifestUrl: process.env.TIMSYS_UPDATE_MANIFEST_URL || 'https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/latest/download/timsys-update.json',
  });
  layout = createRuntimeLayout({
    packaged: app.isPackaged, resourcesPath: process.resourcesPath,
    userDataPath: app.getPath('userData'), sourceRoot,
    bundleRoots: updateManager.activeRoots(),
  });
  supervisedApps = new SupervisedAppManager({
    runtimeExecutable: process.execPath,
    runtimeEnvironment: { ELECTRON_RUN_AS_NODE: '1' },
  });
  postgres = new LocalPostgresManager({ binaryRoot: layout.postgresRoot, dataRoot: layout.memecoinedData });
  aiCredentialVault = new AiCredentialVault({ file: path.join(layout.researchedData, 'secrets', 'ai-provider-profiles.json'), safeStorage });
  desktopToken = randomBytes(48).toString('base64url');
  supervisedApps.on('status', forwardStatus);
  try {
    await startPlatform();
    createWindow();
  } catch (error) {
    if (await updateManager.rollbackPending(`platform_start_failed: ${error.message}`)) {
      app.relaunch();
      app.exit(1);
      return;
    }
    forwardStatus({ id: 'timsys-platform', state: 'failed', detail: error.message, processes: [] });
    const escaped = String(error.message).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    mainWindow = new BrowserWindow({ width: 900, height: 620, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    const html = `<!doctype html><meta charset="utf-8"><title>TimSyS startup failed</title><style>body{font:16px system-ui;background:#101426;color:#e8ecff;padding:48px;line-height:1.55}main{max-width:720px;margin:auto}h1{color:#ff8b8b}.detail{padding:16px;background:#24151b;border:1px solid #7f3344;border-radius:8px}</style><main><h1>TimSyS could not start</h1><p>The launcher did not connect to another TimSyS process because doing so could load an outdated application.</p><p class="detail">${escaped}</p><p>Close every TimSyS window and start this version again.</p></main>`;
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }
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
    .then(() => backupPlatformDatabase(layout.dataRoot))
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

function requireSupervisedChild(appId) {
  if (!['memecoined', 'dressed', 'researched'].includes(appId)) throw new Error(`Unsupported supervised app: ${appId}`);
}

ipcMain.handle('supervised-app:start', async (_event, appId) => {
  requireSupervisedChild(appId);
  try { return await (appId === 'memecoined' ? startMemecoined() : appId === 'dressed' ? startDressed() : startResearched()); }
  catch (error) {
    if (await updateManager.rollbackBundle(appId)) { app.relaunch(); app.exit(1); }
    throw error;
  }
});

ipcMain.handle('launcher:return', async (event) => {
  if (appWindow && !appWindow.isDestroyed() && event.sender === appWindow.webContents) {
    const returningApp = appWindowId;
    const returningWindow = appWindow;
    await stopChild(returningApp);
    if (!returningWindow.isDestroyed()) returningWindow.close();
    focusLauncher();
    return { returned: true, appId: returningApp };
  }
  if (mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents) {
    await mainWindow.loadURL(new URL('/', platformUrl).href);
    focusLauncher();
    return { returned: true, appId: 'principal-ed' };
  }
  throw new Error('Return to Launcher is only available from a TimSyS application window');
});

ipcMain.handle('supervised-app:stop', async (_event, appId) => {
  requireSupervisedChild(appId);
  const status = await supervisedApps.stop(appId);
  if (appId === 'memecoined') await postgres.backup();
  return status;
});

ipcMain.handle('runtime:diagnostics', async () => {
  const statuses = [];
  for (const id of ['timsys-platform', 'memecoined', 'dressed', 'researched']) {
    try { statuses.push(supervisedApps.status(id)); }
    catch { statuses.push({ id, state: 'stopped', detail: null, processes: [] }); }
  }
  return diagnostics({ layout, statuses });
});

function requireLauncherWindow(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) throw new Error('Updates can only be managed from the Launcher');
}

ipcMain.handle('updates:ready', async (event) => {
  requireLauncherWindow(event);
  await updateManager.confirmPending();
  return true;
});

ipcMain.handle('updates:check', async (event) => {
  requireLauncherWindow(event);
  if (!app.isPackaged) return { updateAvailable: false, available: [], development: true, currentLauncherVersion: app.getVersion() };
  return { ...(await updateManager.check()), currentLauncherVersion: app.getVersion() };
});

ipcMain.handle('updates:install', async (event) => {
  requireLauncherWindow(event);
  if (!app.isPackaged) throw new Error('Updates can only be installed by the packaged Launcher');
  const sender = event.sender;
  const result = await updateManager.install(progress => {
    if (!sender.isDestroyed()) sender.send('updates:progress', progress);
  });
  if (!result.restartRequired) return result;
  setTimeout(async () => {
    await supervisedApps.stopAll().catch(() => {});
    if (postgres?.state) await postgres.backup().catch(() => {});
    await postgres?.stop().catch(() => {});
    app.relaunch();
    app.exit(0);
  }, 500);
  return { ...result, restartScheduled: true };
});

ipcMain.handle('platform:session', async () => {
  const status = supervisedApps.status('timsys-platform');
  if (status.state !== 'running') throw new Error('TimSyS platform is not running');
  const response = await fetch(new URL('/api/auth/desktop-session', platformUrl), {
    method: 'POST',
    headers: { 'X-TimSyS-Desktop-Token': desktopToken, 'X-Requested-With': 'XMLHttpRequest' },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Desktop session failed');
  return data;
});

ipcMain.handle('supervised-app:status', async (_event, appId) => {
  requireSupervisedChild(appId);
  if (appId === 'memecoined' && memecoinedConfigurationStatus) return memecoinedConfigurationStatus;
  try {
    return supervisedApps.status(appId);
  } catch {
    return { id: appId, state: 'stopped', detail: null, processes: [] };
  }
});

ipcMain.handle('supervised-app:open', async (_event, appId) => {
  requireSupervisedChild(appId);
  if (appId === 'memecoined' && memecoinedConfigurationStatus) {
    if (appWindow && !appWindow.isDestroyed()) {
      if (appWindowId === appId) { appWindow.focus(); return memecoinedConfigurationStatus; }
      appWindow.close();
    }
    appWindow = new BrowserWindow({ width: 860, height: 680, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    const fields = memecoinedConfigurationStatus.missing.map((name) => `<li><code>${name}</code></li>`).join('');
    const configFile = memecoinedConfigurationStatus.configFile.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const html = `<!doctype html><meta charset="utf-8"><title>MemecoinEd setup</title><style>body{font:16px system-ui;background:#101426;color:#e8ecff;padding:48px;line-height:1.55}main{max-width:720px;margin:auto}h1{color:#fff}code{color:#9ed0ff}li{margin:.45rem 0}.safe{color:#8ee6ae}</style><main><p class="safe">SAFE PAPER MODE · LIVE TRADING DISABLED</p><h1>MemecoinEd configuration required</h1><p>The application and its private PostgreSQL database are installed correctly. Add the following values before starting the paper engine:</p><ul>${fields}</ul><p>Configuration file:</p><p><code>${configFile}</code></p><p>Close this window after updating the file, then select <strong>Start and open</strong> again.</p></main>`;
    await appWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    appWindowId = appId;
    bindAppWindowLifecycle(appWindow, appId);
    return memecoinedConfigurationStatus;
  }
  const status = supervisedApps.status(appId);
  if (status.state !== 'running') throw new Error(`${appId} is not running`);
  const dashboardUrl = supervisedApps.dashboardUrl(appId);
  if (appWindow && !appWindow.isDestroyed()) {
    if (appWindowId === appId) {
      const currentUrl = appWindow.webContents.getURL();
      let currentOrigin = null;
      try { currentOrigin = currentUrl ? new URL(currentUrl).origin : null; }
      catch { currentOrigin = null; }
      if (currentOrigin !== new URL(dashboardUrl).origin) {
        await appWindow.loadURL(dashboardUrl);
      }
      appWindow.focus();
      return status;
    }
    appWindow.close();
  }
  appWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  appWindowId = appId;
  appWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  appWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(supervisedApps.dashboardUrl(appId)).origin) event.preventDefault();
  });
  try {
    await appWindow.loadURL(dashboardUrl);
  } catch (error) {
    appWindow.destroy();
    appWindow = null;
    throw new Error(`Unable to open ${appId}: ${error.message}`);
  }
  bindAppWindowLifecycle(appWindow, appId);
  return status;
});

function requireResearchedWindow(event) {
  if (!appWindow || appWindow.isDestroyed() || event.sender !== appWindow.webContents || appWindowId !== 'researched') throw new Error('AI provider settings are only available from Research’Ed');
}

ipcMain.handle('researched-ai:list-profiles', async (event) => { requireResearchedWindow(event); return aiCredentialVault.list(); });
ipcMain.handle('researched-ai:save-profile', async (event, value) => { requireResearchedWindow(event); return aiCredentialVault.save(value); });
ipcMain.handle('researched-ai:activate-profile', async (event, id) => { requireResearchedWindow(event); return aiCredentialVault.activate(id); });
ipcMain.handle('researched-ai:remove-profile', async (event, id) => { requireResearchedWindow(event); return aiCredentialVault.remove(id); });
ipcMain.handle('researched-ai:apply', async (event) => {
  requireResearchedWindow(event);
  applyingResearchedProfile = true;
  try {
    await supervisedApps.stop('researched');
    const status = await startResearched();
    await appWindow.loadURL(supervisedApps.dashboardUrl('researched'));
    return status;
  } finally {
    applyingResearchedProfile = false;
  }
});

function forwardStatus(status) {
  if (status.id === appWindowId && ['failed', 'stopped'].includes(status.state) && appWindow && !appWindow.isDestroyed() && !(applyingResearchedProfile && status.id === 'researched')) {
    appWindow.close();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('supervised-app:status-changed', status);
  }
}
