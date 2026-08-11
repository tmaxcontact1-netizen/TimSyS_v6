const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platformCheck: () => ipcRenderer.invoke('platform:check'),
  supervisedApp: {
    start: (appId) => ipcRenderer.invoke('supervised-app:start', appId),
    stop: (appId) => ipcRenderer.invoke('supervised-app:stop', appId),
    status: (appId) => ipcRenderer.invoke('supervised-app:status', appId),
    open: (appId) => ipcRenderer.invoke('supervised-app:open', appId),
    onStatusChanged: (listener) => {
      const handler = (_event, status) => listener(status);
      ipcRenderer.on('supervised-app:status-changed', handler);
      return () => ipcRenderer.removeListener('supervised-app:status-changed', handler);
    },
  },
});
