const { app, BrowserWindow, WebContentsView, ipcMain, safeStorage, Menu, shell } = require('electron');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('path');
const { spawn } = require('node:child_process');
const { SupervisedAppManager } = require('./supervised-app-manager.cjs');
const { stopLauncherOwnedRuntime, stopScopedApplication } = require('./tradeed-runtime-ownership.cjs');
const { InspectionBroker } = require('./inspection-host-gateway.cjs');
const { LocalPostgresManager, availablePort } = require('./local-postgres-manager.cjs');
const { appDatabase, grantAppSchemaPrivileges } = require('./app-database-gateway.cjs');
const { createRuntimeLayout } = require('./runtime-layout.cjs');
const { backupPlatformDatabase, diagnostics } = require('./runtime-recovery.cjs');
const { AiCredentialVault } = require('./ai-credential-vault.cjs');
const { UpdateManager } = require('./update-manager.cjs');
const { AppWindowRegistry } = require('./app-window-registry.cjs');
const { AssistantPanels } = require('./assistant-panel.cjs');
const { testConnection } = require('./assistant-connection.cjs');
const { ChatGptPlan } = require('./chatgpt-plan.cjs');
const { AiRuntimeState } = require('./ai-runtime-state.cjs');
const aiRuntime = new AiRuntimeState();
const researchAssistantToken = randomBytes(48).toString('base64url');
const assistantPanels = new AssistantPanels({ WebContentsView, getUrl: () => app.isPackaged ? platformUrl : 'http://localhost:5173', onOpen: () => applyAssistantProfile() });

// The launcher UI does not require GPU acceleration; disabling it improves compatibility on headless and older Windows systems.
app.disableHardwareAcceleration();
const ownsLauncherInstance = app.requestSingleInstanceLock();
if (!ownsLauncherInstance) app.quit();
app.on('second-instance', () => focusLauncher());

const domainTokens=Object.create(null);
async function bindDomainSession(window,appId,url){if(!domainTokens[appId])return;await window.webContents.session.cookies.set({url:new URL(url).origin,name:"timsys_domain_"+appId,value:domainTokens[appId],httpOnly:true,sameSite:"strict",path:"/"});}
let mainWindow;
const appWindows = new AppWindowRegistry();
let quitting = false;
const sourceRoot = path.resolve(__dirname, '../../..');
let layout;
let supervisedApps;
let inspectionBroker;
const appStatus = id => id === 'tradeed' ? inspectionBroker.status() : supervisedApps.status(id);
const appDashboardUrl = id => id === 'tradeed' ? inspectionBroker.dashboardUrl() : supervisedApps.dashboardUrl(id);
const stopApplication = id => id === 'tradeed' ? inspectionBroker.stop() : supervisedApps.stop(id);
let postgres;
let desktopToken;
let platformUrl = null;
let aiCredentialVault;
let chatGptPlan;
let applyingResearchedProfile = false;
let updateManager;


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
    ...(await aiRuntime.resolve(aiCredentialVault)).environment,
    ...(layout.launcherUi ? { TIMSYS_LAUNCHER_DIST: layout.launcherUi } : {}),
  };
  const status = await supervisedApps.start(path.join(layout.platformRoot, 'timsys.app.json'), environment);
  platformUrl = supervisedApps.dashboardUrl('timsys-platform');
  return status;
}

async function assertDomainFrontend(id){const d=JSON.parse(await fsp.readFile(path.join(layout[id+'Root'],'timsys.services.json'),'utf8'));if(!d.httpContracts?.some(c=>c.serviceId===id+'-backend'&&c.version==='1.0.0'&&c.owner==='timsys'))throw Error('Update '+id+' to the TimSyS-owned backend contract before starting it');}
async function startTradeed() {
  const database = await postgres.start();
  const ui=await fsp.readFile(path.join(layout.tradeedRoot,'frontend/inspection.html'),'utf8');
  const status = await inspectionBroker.start({databasePort:database.port,port:await availablePort(),ui});
  domainTokens.tradeed=inspectionBroker.token();
  forwardStatus(status);
  return status;
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
    DRESSED_APP_ROOT: path.join(layout.platformRoot,'services/dressed'),
    DRESSED_CONFIG_DIR: configRoot,
    DRESSED_STORAGE_ROOT: storageRoot,
    DRESSED_DATABASE_URL: database.runtimeUrl,
    DRESSED_CV_BASE_URL: 'http://127.0.0.1:8091',
    DRESSED_CV_TIMEOUT_MS: '10000',
    DRESSED_PORT: String(await availablePort()),
    TIMSYS_DOMAIN_TOKEN: domainTokens['dressed'], TIMSYS_SERVICE_ROOT:path.join(layout.platformRoot,'services/dressed'), TIMSYS_FRONTEND_ROOT: path.join(layout.dressedRoot,'dist/frontend'),
    NODE_PATH: path.join(layout.platformRoot,'services/dressed/modules-runtime'),
    NODE_OPTIONS: packagedNodeOptions(process.env.NODE_OPTIONS),
  };
}

async function startDressed() {
  await assertDomainFrontend('dressed');
  require('./styling-bridge.cjs').assertStylingDeclaration(JSON.parse(await fsp.readFile(path.join(layout.dressedRoot,'timsys.services.json'),'utf8')));
  require('./wardrobe-bridge.cjs').assertWardrobeDeclaration(JSON.parse(await fsp.readFile(path.join(layout.dressedRoot,'timsys.services.json'),'utf8')));
  require('./photography-bridge.cjs').assertPhotographyDeclaration(JSON.parse(await fsp.readFile(path.join(layout.dressedRoot,'timsys.services.json'),'utf8')));
  await ensureNodeModulesLink(path.join(layout.platformRoot,'services/dressed'));
  domainTokens['dressed'] ||= randomBytes(48).toString('base64url');
  const database = appDatabase('dressed', await postgres.start(), layout.dataRoot);
  const environment = await dressedEnvironment(database);
  const sessionResponse=await fetch(new URL('/api/auth/desktop-session',platformUrl),{method:'POST',headers:{'X-TimSyS-Desktop-Token':desktopToken,'X-Requested-With':'XMLHttpRequest'}});
  const session=await sessionResponse.json();if(!sessionResponse.ok)throw Error('TimSyS wardrobe authentication failed');
  const configured=await fetch(new URL('/api/timsys/v1/apps/dressed/wardrobe/configuration',platformUrl),{method:'PUT',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json','X-TimSyS-Desktop-Token':desktopToken},body:JSON.stringify({databaseUrl:database.runtimeUrl,migrationUrl:database.migrationUrl,storageRoot:environment.DRESSED_STORAGE_ROOT}),signal:AbortSignal.timeout(30000)});
  if(!configured.ok)throw Error('TimSyS wardrobe configuration failed; existing data was not reset');

  return supervisedApps.start(path.join(layout.platformRoot, 'services/dressed/timsys.app.json'), environment);
}

async function startResearched() {
  await assertDomainFrontend('researched');
  await ensureNodeModulesLink(path.join(layout.platformRoot,'services/researched'));
  domainTokens['researched'] ||= randomBytes(48).toString('base64url');
  const database = appDatabase('researched', await postgres.start(), layout.dataRoot);
  const aiSnapshot = await aiRuntime.resolve(aiCredentialVault);
  const environment = {
    RESEARCHED_ENV: app.isPackaged ? 'production' : 'development',
    RESEARCHED_APP_ROOT: path.join(layout.platformRoot,'services/researched'),
    RESEARCHED_STORAGE_ROOT: path.join(layout.researchedData, 'private-storage'),
    RESEARCHED_DATABASE_URL: database.runtimeUrl,
    RESEARCHED_PORT: String(await availablePort()),
    TIMSYS_DOMAIN_TOKEN: domainTokens['researched'], TIMSYS_SERVICE_ROOT:path.join(layout.platformRoot,'services/researched'), TIMSYS_FRONTEND_ROOT: path.join(layout.researchedRoot,'dist/frontend'),
    NODE_PATH: path.join(layout.platformRoot,'services/researched/modules-runtime'),
    NODE_OPTIONS: packagedNodeOptions(process.env.NODE_OPTIONS),
    ...aiSnapshot.environment,
    RESEARCHED_AI_MANAGED: '1',
    RESEARCHED_ASSISTANT_TOKEN: researchAssistantToken,
  };
  await fsp.mkdir(environment.RESEARCHED_STORAGE_ROOT, { recursive: true });
  await runNode(path.join(layout.platformRoot,'services/researched/dist/scripts/migrate.js'), [], {
    cwd: layout.researchedRoot, env: { ...process.env, ...environment, RESEARCHED_DATABASE_URL: database.migrationUrl },
  });
  await grantAppSchemaPrivileges('researched', database, { Client: require(path.join(layout.platformRoot,'modules-runtime/pg')).Client });
  const status = await supervisedApps.start(path.join(layout.platformRoot, 'services/researched/timsys.app.json'), environment);
  aiRuntime.markStarted('researched', aiSnapshot);
  return status;
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
  mainWindow.setMenu(Menu.buildFromTemplate([{ label: 'TimSyS AI', submenu: [{ label: 'Open assistant', accelerator: 'CommandOrControl+Shift+Space', click: () => assistantPanels.toggle(mainWindow).catch(console.error) }] }]));

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
  try { await stopScopedApplication({ appId, stopApplication }); } catch {}
}

function bindAppWindowLifecycle(window, appId) {
  window.on('closed', () => {
    appWindows.delete(appId, window);
    if (!window.__timsysStopHandled) void stopChild(appId);
    focusLauncher();
  });
}

function activeAppWindow(appId) {
  return appWindows.active(appId);
}

function returnAppWindowToLauncher(appId, window) {
  window.__timsysStopHandled = true;
  if (!window.isDestroyed()) window.close();
  focusLauncher();
  return { returned: true, appId };
}

function installAppWindowMenu(window, appId) {
  window.setMenu(Menu.buildFromTemplate([
    { label: 'TimSyS AI', submenu: [{ label: 'Open assistant', accelerator: 'CommandOrControl+Shift+Space', click: () => assistantPanels.toggle(window, appId).catch(console.error) }] },
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit to Launcher',
          accelerator: 'Alt+Left',
          click: () => returnAppWindowToLauncher(appId, window),
        },
      ],
    },
  ]));
}

function appWindowForSender(sender) {
  return appWindows.forSender(sender);
}

app.whenReady().then(async () => {
  if (!ownsLauncherInstance) return;
  updateManager = new UpdateManager({
    dataRoot: app.getPath('userData'),
    currentLauncherVersion: app.getVersion(),
    baselineFile: app.isPackaged ? path.join(process.resourcesPath, 'platform', 'installed-baseline.json') : null,
    manifestUrl: process.env.TIMSYS_UPDATE_MANIFEST_URL || 'https://github.com/tmaxcontact1-netizen/TimSyS_v6/releases/latest/download/timsys-update.json',
  });
  layout = createRuntimeLayout({
    packaged: app.isPackaged, resourcesPath: process.resourcesPath,
    userDataPath: app.getPath('userData'), sourceRoot,
    bundleRoots: require("./central-bundles.cjs").compatibleRoots(updateManager.activeRoots()),
  });
  supervisedApps = new SupervisedAppManager({
    runtimeExecutable: process.execPath,
    runtimeEnvironment: { ELECTRON_RUN_AS_NODE: '1' },
  });
  postgres = new LocalPostgresManager({ binaryRoot: layout.postgresRoot, dataRoot: layout.databaseData, infrastructureOnly: true });
  inspectionBroker = new InspectionBroker({onStatus:forwardStatus});
  chatGptPlan = new ChatGptPlan({ file: path.join(app.getPath('userData'), 'secrets', 'chatgpt-plan.enc'), safeStorage, openExternal: url => shell.openExternal(url) });
  aiCredentialVault = new AiCredentialVault({ file: path.join(layout.researchedData, 'secrets', 'ai-provider-profiles.json'), safeStorage, resolvePlan: (id, model) => chatGptPlan.environment(id, model) });
  desktopToken = randomBytes(48).toString('base64url');
  supervisedApps.on('status', forwardStatus);
  try {
    await inspectionBroker.attach();
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
  chatGptPlan?.close();
  Promise.resolve(stopLauncherOwnedRuntime({
    stopApplications: async () => { await inspectionBroker?.stop(); await supervisedApps?.stopAll(); },
    stopDatabase: () => postgres?.stop(),
  }))
    .then(() => backupPlatformDatabase(layout.dataRoot))
    .then(() => postgres?.state ? postgres.backup() : undefined)
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
  if (!['tradeed', 'dressed', 'researched'].includes(appId)) throw new Error(`Unsupported supervised app: ${appId}`);
}

ipcMain.handle('supervised-app:start', async (_event, appId) => {
  requireSupervisedChild(appId);
  try { return await (appId === 'tradeed' ? startTradeed() : appId === 'dressed' ? startDressed() : startResearched()); }
  catch (error) {
    if (String(error?.message).includes('already owned outside launcher supervision')) throw error;
    if (appId !== 'tradeed' && await updateManager.rollbackBundle(appId)) { app.relaunch(); app.exit(1); }
    throw error;
  }
});

ipcMain.handle('launcher:return', async (event) => {
  const owned = appWindowForSender(event.sender);
  if (owned) {
    return returnAppWindowToLauncher(owned.appId, owned.window);
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
  let status;
  status = await stopScopedApplication({ appId, stopApplication });
  const window = activeAppWindow(appId);
  if (window) {
    window.__timsysStopHandled = true;
    window.close();
  }
  return status;
});

ipcMain.handle('runtime:diagnostics', async () => {
  const statuses = [];
  for (const id of ['timsys-platform', 'tradeed', 'dressed', 'researched']) {
    try { statuses.push(appStatus(id)); }
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
    await inspectionBroker?.stop();
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
  try {
    return appStatus(appId);
  } catch {
    return { id: appId, state: 'stopped', detail: null, processes: [] };
  }
});

ipcMain.handle('supervised-app:open', async (_event, appId) => {
  requireSupervisedChild(appId);
  const status = appStatus(appId);
  if (status.state !== 'running') throw new Error(`${appId} is not running`);
  const dashboardUrl = appDashboardUrl(appId);
  const existing = activeAppWindow(appId);
  if (existing) {
    const currentUrl = existing.webContents.getURL();
    let currentOrigin = null;
    try { currentOrigin = currentUrl ? new URL(currentUrl).origin : null; }
    catch { currentOrigin = null; }
    if (currentOrigin !== new URL(dashboardUrl).origin) {
      await bindDomainSession(existing,appId,dashboardUrl);
      await existing.loadURL(dashboardUrl);
    }
    existing.focus();
    return status;
  }
  const appWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  installAppWindowMenu(appWindow, appId);
  appWindows.set(appId, appWindow);
  appWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  appWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(appDashboardUrl(appId)).origin) event.preventDefault();
  });
  try {
    await bindDomainSession(appWindow,appId,dashboardUrl);
    await appWindow.loadURL(dashboardUrl);
  } catch (error) {
    appWindow.destroy();
    appWindows.delete(appId);
    throw new Error(`Unable to open ${appId}: ${error.message}`);
  }
  bindAppWindowLifecycle(appWindow, appId);
  return status;
});

function requireResearchedWindow(event) {
  const window = activeAppWindow('researched');
  if (!window || event.sender !== window.webContents) throw new Error('AI provider settings are only available from Research’Ed');
  return window;
}

function requireAssistant(event) {
  if (!assistantPanels.owns(event.sender) && event.sender !== mainWindow?.webContents) throw new Error('Use TimSyS assistant settings.');
}
async function applyAssistantProfile() {
  const sessionResponse = await fetch(new URL('/api/auth/desktop-session', platformUrl), { method: 'POST', headers: { 'X-TimSyS-Desktop-Token': desktopToken, 'X-Requested-With': 'XMLHttpRequest' } });
  const session = await sessionResponse.json();
  if (!sessionResponse.ok || !session.token) throw new Error('Unable to connect to the platform.');
  const env = (await aiRuntime.resolve(aiCredentialVault)).environment;
  const appUrls = {};
  for (const appId of ['researched', 'dressed', 'tradeed']) {
    try { if (appStatus(appId)?.state === 'running') appUrls[appId] = appDashboardUrl(appId); } catch (_) { /* App has not been started in this session. */ }
  }
  const response = await fetch(new URL('/ai-gateway/assistant/configuration', platformUrl), { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token, 'X-TimSyS-Desktop-Token': desktopToken },
    body: JSON.stringify({ protocol: env.TIMSYS_AI_PROTOCOL || null, model: env.TIMSYS_AI_MODEL || '', baseUrl: env.TIMSYS_AI_BASE_URL || '', apiKey: env.TIMSYS_AI_API_KEY || '', serviceHostUrl:platformUrl, appUrls, domainTokens:Object.fromEntries(Object.entries(domainTokens).filter(([id])=>appUrls[id])), appTokens: appUrls.researched ? { researched: researchAssistantToken } : {} }) });
  if (!response.ok) throw new Error('Connection saved, but the platform could not apply it. Restart TimSyS to apply.');
  return aiCredentialVault.list();
}
ipcMain.handle('assistant:open', async event => {
  const host = event.sender === mainWindow?.webContents ? mainWindow : BrowserWindow.fromWebContents(event.sender);
  if (!host || (host !== mainWindow && !appWindowForSender(event.sender))) throw new Error('Unknown app window.');
  return assistantPanels.toggle(host, appWindowForSender(event.sender)?.appId || 'timsys');
});
ipcMain.handle('assistant:close', event => { requireAssistant(event); assistantPanels.closeFor(event.sender); });
ipcMain.handle('assistant:settings', event => {
  if (event.sender !== mainWindow?.webContents) throw new Error('Open AI Integration from the launcher.');
  return assistantPanels.openSettings(mainWindow);
});
ipcMain.handle('assistant:context', event => { requireAssistant(event); return assistantPanels.contextFor(event.sender); });
ipcMain.handle('assistant:open-source', (event, address) => { requireAssistant(event); const url = new URL(address); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid source link.'); return shell.openExternal(url.href); });
async function assistantProfiles() {
  const snapshot = await aiRuntime.resolve(aiCredentialVault);
  let state; try { state = supervisedApps.status('researched')?.state; } catch (_) {}
  const researched = aiRuntime.status('researched', state, snapshot);
  return { ...await aiCredentialVault.list(), chatgpt: await chatGptPlan.status(), appConnections: [researched] };
}
ipcMain.handle('assistant:profiles', event => { requireAssistant(event); return assistantProfiles(); });
let testingAssistantConnection = false;
async function verifyAssistantConnection() {
  if (testingAssistantConnection) throw Error('A connection test is already running.');
  testingAssistantConnection = true;
  try {
    const profile = (await aiCredentialVault.list()).profiles.find(p => p.active);
    if (!profile) throw Error('Save a connection first.');
    let verification;
    try { verification = profile.protocol === 'chatgpt-plan' ? await chatGptPlan.test(profile.accountId, profile.model) : await testConnection(await aiCredentialVault.activeEnvironment()); }
    catch (error) { verification = { status: 'failed', checkedAt: new Date().toISOString(), message: error.message }; }
    await aiCredentialVault.recordVerification(profile.id, profile.updatedAt, verification);
    return assistantProfiles();
  } finally { testingAssistantConnection = false; }
}
ipcMain.handle('assistant:test-connection', async event => { requireAssistant(event); await applyAssistantProfile(); return verifyAssistantConnection(); });
ipcMain.handle('assistant:save-profile', async (event, value) => { requireAssistant(event); if (value?.protocol === 'chatgpt-plan') throw Error('Use Continue with ChatGPT.'); await aiCredentialVault.save(value); await applyAssistantProfile(); return verifyAssistantConnection(); });
ipcMain.handle('assistant:activate-profile', async (event, id) => { requireAssistant(event); await aiCredentialVault.activate(id); await applyAssistantProfile(); return assistantProfiles(); });
async function savePlanProfile(accountId, model) {
  const account = (await chatGptPlan.status()).accounts.find(a => a.id === accountId && a.connected);
  if (!account || !account.models.some(m => m.slug === model)) throw Error('Sign in and select an available ChatGPT model first.');
  const existing = (await aiCredentialVault.list()).profiles.find(p => p.accountId === accountId);
  await aiCredentialVault.save({ id: existing?.id, protocol: 'chatgpt-plan', accountId, name: 'ChatGPT plan · ' + account.label, model, baseUrl: 'https://api.openai.com', active: true });
  await applyAssistantProfile();
  return verifyAssistantConnection();
}
ipcMain.handle('assistant:chatgpt-sign-in', async (event, id) => {
  requireAssistant(event);
  const accountId = await chatGptPlan.signIn(id);
  const models = await chatGptPlan.models(accountId);
  const previous = (await aiCredentialVault.list()).profiles.find(p => p.accountId === accountId);
  return savePlanProfile(accountId, models.find(m => m.slug === previous?.model)?.slug || models[0].slug);
});
ipcMain.handle('assistant:chatgpt-cancel', event => { requireAssistant(event); chatGptPlan.cancel(); });
ipcMain.handle('assistant:chatgpt-models', async (event, id) => { requireAssistant(event); await chatGptPlan.models(id); return assistantProfiles(); });
ipcMain.handle('assistant:chatgpt-select', async (event, value) => { requireAssistant(event); return savePlanProfile(value.accountId, value.model); });
ipcMain.handle('assistant:chatgpt-sign-out', async (event, id) => {
  requireAssistant(event); const notice = await chatGptPlan.signOut(id);
  const profile = (await aiCredentialVault.list()).profiles.find(p => p.accountId === id);
  if (profile) await aiCredentialVault.remove(profile.id);
  await applyAssistantProfile(); return { ...await assistantProfiles(), notice };
});

ipcMain.handle('researched-ai:list-profiles', async (event) => { requireResearchedWindow(event); return aiCredentialVault.list(); });
for (const operation of ['save-profile', 'activate-profile', 'remove-profile']) ipcMain.handle('researched-ai:' + operation, async event => {
  requireResearchedWindow(event); throw Error('Manage the shared connection in the launcher’s AI Integration tile.');
});
ipcMain.handle('researched-ai:apply', async (event) => {
  const researchedWindow = requireResearchedWindow(event);
  applyingResearchedProfile = true;
  try {
    await supervisedApps.stop('researched');
    const status = await startResearched();
    await researchedWindow.loadURL(supervisedApps.dashboardUrl('researched'));
    return status;
  } finally {
    applyingResearchedProfile = false;
  }
});

function forwardStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('supervised-app:status-changed', status);
  }
}

ipcMain.handle('wardrobe:invoke',require('./wardrobe-bridge.cjs').createWardrobeBridge({
  authorize:event=>appWindows.forSender(event.sender)?.appId==='dressed' && event.senderFrame===event.sender.mainFrame,
  client:async()=>{
    const response=await fetch(new URL('/api/auth/desktop-session',platformUrl),{method:'POST',headers:{'X-TimSyS-Desktop-Token':desktopToken,'X-Requested-With':'XMLHttpRequest'}});const session=await response.json();if(!response.ok)throw Error('TimSyS session unavailable');
    const {TimSysServiceClient}=require(path.join(layout.platformRoot,'packages/service-contracts/index.cjs'));
    return new TimSysServiceClient({baseUrl:platformUrl,appId:'dressed',getToken:()=>session.token,timeoutMs:15000,maximumResponseBytes:1048576});
  }
}));



ipcMain.handle('photography:invoke',require('./photography-bridge.cjs').createPhotographyBridge({
 authorize:event=>appWindows.forSender(event.sender)?.appId==='dressed' && event.senderFrame===event.sender.mainFrame,
 client:async()=>{const response=await fetch(new URL('/api/auth/desktop-session',platformUrl),{method:'POST',headers:{'X-TimSyS-Desktop-Token':desktopToken,'X-Requested-With':'XMLHttpRequest'}});const session=await response.json();if(!response.ok)throw Error('TimSyS session unavailable');const {TimSysServiceClient}=require(path.join(layout.platformRoot,'packages/service-contracts/index.cjs'));return new TimSysServiceClient({baseUrl:platformUrl,appId:'dressed',getToken:()=>session.token,timeoutMs:30000,maximumResponseBytes:1048576});}
}));
ipcMain.handle('styling:invoke',require('./styling-bridge.cjs').createStylingBridge({
 authorize:event=>appWindows.forSender(event.sender)?.appId==='dressed' && event.senderFrame===event.sender.mainFrame,
 client:async()=>{const response=await fetch(new URL('/api/auth/desktop-session',platformUrl),{method:'POST',headers:{'X-TimSyS-Desktop-Token':desktopToken,'X-Requested-With':'XMLHttpRequest'}});const session=await response.json();if(!response.ok)throw Error('TimSyS session unavailable');const {TimSysServiceClient}=require(path.join(layout.platformRoot,'packages/service-contracts/index.cjs'));return new TimSysServiceClient({baseUrl:platformUrl,appId:'dressed',getToken:()=>session.token,timeoutMs:30000,maximumResponseBytes:1048576});}
}));
