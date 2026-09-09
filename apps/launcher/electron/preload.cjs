const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platformCheck: () => ipcRenderer.invoke('platform:check'),
  platformSession: () => ipcRenderer.invoke('platform:session'),
  diagnostics: () => ipcRenderer.invoke('runtime:diagnostics'),
  updates: {
    rendererReady: () => ipcRenderer.invoke('updates:ready'),
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
  },
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
  researchedAi: {
    listProfiles: () => ipcRenderer.invoke('researched-ai:list-profiles'),
    saveProfile: (value) => ipcRenderer.invoke('researched-ai:save-profile', value),
    activateProfile: (id) => ipcRenderer.invoke('researched-ai:activate-profile', id),
    removeProfile: (id) => ipcRenderer.invoke('researched-ai:remove-profile', id),
    apply: () => ipcRenderer.invoke('researched-ai:apply'),
  },
});
