const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { SupervisedAppManager } = require('./supervised-app-manager.cjs');

let mainWindow;
let appWindow;
let quitting = false;
const supervisedApps = new SupervisedAppManager();
const memecoinedManifest = path.resolve(__dirname, '../../memecoined/timsys.app.json');

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
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  supervisedApps.stopAll().finally(() => app.quit());
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers (if needed later)
ipcMain.handle('platform:check', async () => {
  // Will be implemented when we add connection checking
  return { status: 'unknown' };
});

function requireMemecoined(appId) {
  if (appId !== 'memecoined') throw new Error(`Unsupported supervised app: ${appId}`);
}

ipcMain.handle('supervised-app:start', async (_event, appId) => {
  requireMemecoined(appId);
  return supervisedApps.start(memecoinedManifest);
});

ipcMain.handle('supervised-app:stop', async (_event, appId) => {
  requireMemecoined(appId);
  return supervisedApps.stop(appId);
});

ipcMain.handle('supervised-app:status', async (_event, appId) => {
  requireMemecoined(appId);
  try {
    return supervisedApps.status(appId);
  } catch {
    return { id: appId, state: 'stopped', detail: null, processes: [] };
  }
});

ipcMain.handle('supervised-app:open', async (_event, appId) => {
  requireMemecoined(appId);
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
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  await appWindow.loadURL(supervisedApps.dashboardUrl(appId));
  appWindow.on('closed', () => { appWindow = null; });
  return status;
});

supervisedApps.on('status', (status) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('supervised-app:status-changed', status);
  }
});
