const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platformCheck: () => ipcRenderer.invoke('platform:check'),
});
