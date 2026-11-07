const { contextBridge, ipcRenderer } = require('electron');

for (const [channel,eventName,fallback] of [['workspace:back','timsys:navigate-back',()=>history.back()],['workspace:launcher','timsys:return-launcher',()=>ipcRenderer.invoke('launcher:return')]]) ipcRenderer.on(channel,()=>{if(window.dispatchEvent(new Event(eventName,{cancelable:true})))fallback();});

contextBridge.exposeInMainWorld('electronAPI', {
  windows: { popOut: () => ipcRenderer.invoke('workspace:pop-out') },
  services: { wardrobe: value => ipcRenderer.invoke('wardrobe:invoke', value), photography:value=>ipcRenderer.invoke('photography:invoke',value), styling:value=>ipcRenderer.invoke('styling:invoke',value) },
  assistant: {
    open: () => ipcRenderer.invoke('assistant:open'),
    openSettings: () => ipcRenderer.invoke('assistant:settings'),
    onSettings: callback => {
      const handler = () => callback();
      ipcRenderer.on('assistant:show-settings', handler);
      return () => ipcRenderer.removeListener('assistant:show-settings', handler);
    },
    close: () => ipcRenderer.invoke('assistant:close'),
    context: () => ipcRenderer.invoke('assistant:context'),
    openSource: url => ipcRenderer.invoke('assistant:open-source', url),
    profiles: () => ipcRenderer.invoke('assistant:profiles'),
    testConnection: () => ipcRenderer.invoke('assistant:test-connection'),
    saveProfile: value => ipcRenderer.invoke('assistant:save-profile', value),
    activateProfile: id => ipcRenderer.invoke('assistant:activate-profile', id),
    chatgptSignIn: id => ipcRenderer.invoke('assistant:chatgpt-sign-in', id),
    chatgptCancel: () => ipcRenderer.invoke('assistant:chatgpt-cancel'),
    chatgptModels: id => ipcRenderer.invoke('assistant:chatgpt-models', id),
    chatgptSelect: value => ipcRenderer.invoke('assistant:chatgpt-select', value),
    chatgptSignOut: id => ipcRenderer.invoke('assistant:chatgpt-sign-out', id),
  },
  platformCheck: () => ipcRenderer.invoke('platform:check'),
  platformSession: () => ipcRenderer.invoke('platform:session'),
  diagnostics: () => ipcRenderer.invoke('runtime:diagnostics'),
  returnToLauncher: () => ipcRenderer.invoke('launcher:return'),
  updates: {
    rendererReady: () => ipcRenderer.invoke('updates:ready'),
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    onProgress: (callback) => {
      const handler = (_event, progress) => callback(progress);
      ipcRenderer.on('updates:progress', handler);
      return () => ipcRenderer.removeListener('updates:progress', handler);
    },
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
