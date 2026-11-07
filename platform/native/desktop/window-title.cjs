const names = { timsys: 'TimSyS Launcher', 'principal-ed': 'Principal’Ed', principaled: 'Principal’Ed', builder: 'Builder', dressed: 'Dress’Ed', researched: 'Research’Ed', tradeed: 'Trade’Ed · Inspection', assistant: 'AI integration' };

function appWindowTitle(appId) { return names[appId] || names.timsys; }
function launcherWindowTitle(address) {
  try {
    const pathname = new URL(address).pathname;
    if (/^\/app\/principal-?ed(?:\/|$)/.test(pathname)) return names.principaled;
    if (/^\/(?:app\/builder|modules)(?:\/|$)/.test(pathname)) return names.builder;
    if (/^\/assistant(?:\/|$)/.test(pathname)) return names.assistant;
  } catch { /* The launcher has not loaded its first page yet. */ }
  return names.timsys;
}
function bindWindowTitle(window, title) {
  const refresh = () => { if (!window.isDestroyed()) window.setTitle(typeof title === 'function' ? title() : title); };
  // BrowserWindow owns the cancellable native-title event, not WebContents.
  window.on('page-title-updated', event => { event.preventDefault(); refresh(); });
  window.webContents.on('did-finish-load', refresh);
  window.webContents.on('did-navigate-in-page', refresh);
  refresh();
}
module.exports = { appWindowTitle, launcherWindowTitle, bindWindowTitle };
