const { contextBridge, ipcRenderer } = require('electron');

// The shell owns the entry point, so independent app releases do not need to
// rebuild their UI to expose the shared assistant.
window.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/assistant' || !/^https?:$/.test(window.location.protocol)) return;
  const host = document.createElement('div'); host.id = 'timsys-assistant-entry';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = ':host{position:fixed;right:18px;bottom:18px;z-index:10000}button{font:600 13px system-ui,sans-serif;border:1px solid #8d7ee5;border-radius:24px;padding:11px 17px;background:#6553cf;color:#fff;box-shadow:0 5px 18px #0004;cursor:pointer}button:focus-visible{outline:3px solid #b8afff;outline-offset:3px}';
  const button = document.createElement('button'); button.textContent = '✦ Ask AI'; button.title = 'TimSyS AI · Ctrl+Shift+Space';
  button.addEventListener('click', () => { ipcRenderer.invoke('assistant:open').catch(error => { button.title = error.message; button.textContent = 'AI unavailable · Retry'; }); });
  shadow.append(style, button); document.body.append(host);
  // Keep transient app messages readable without moving or restyling them.
  let pending = false;
  const watched = new Set();
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(place); } };
  const sizes = new ResizeObserver(schedule);
  function place() {
    pending = false;
    const messages = [...document.querySelectorAll('[role="status"],[role="alert"],[aria-live="polite"],[aria-live="assertive"]')];
    for (const element of watched) if (!messages.includes(element)) { sizes.unobserve(element); watched.delete(element); }
    for (const element of messages) if (!watched.has(element)) { watched.add(element); sizes.observe(element); }
    const own = host.getBoundingClientRect();
    const boxes = messages.filter(element => { const css = getComputedStyle(element); return css.visibility !== 'hidden' && css.display !== 'none'; })
      .map(element => element.getBoundingClientRect()).filter(box => box.width && box.height).sort((a, b) => b.top - a.top);
    let bottom = 18;
    for (const box of boxes) {
      const top = innerHeight - bottom - own.height;
      if (box.left < own.right && box.right > own.left && box.top < top + own.height + 12 && box.bottom > top - 12)
        bottom = innerHeight - box.top + 12;
    }
    const value = `${Math.min(bottom, Math.max(18, innerHeight - own.height - 12))}px`;
    if (host.style.bottom !== value) host.style.bottom = value;
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['class', 'style', 'hidden', 'role', 'aria-live'] });
  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);
  schedule();
});

contextBridge.exposeInMainWorld('electronAPI', {
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
