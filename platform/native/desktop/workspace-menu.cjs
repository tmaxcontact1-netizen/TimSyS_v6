function workspaceMenu({ back, launcher, assistant, settings, popOut, close, canPopOut = false }) {
  return [
    { label: 'File', submenu: [
      { label: 'Back', accelerator: 'Alt+Left', click: back },
      { label: 'Return to launcher', accelerator: 'CommandOrControl+Shift+H', click: launcher },
      ...(canPopOut ? [{ label: 'Open in window', accelerator: 'CommandOrControl+Shift+O', click: popOut }] : []),
      { type: 'separator' }, { label: 'Close window', accelerator: 'CommandOrControl+W', click: close },
    ] },
    { label: 'AI integration', submenu: [
      { label: 'Open assistant', accelerator: 'CommandOrControl+Shift+Space', click: assistant },
      { label: 'Connections and models…', click: settings },
    ] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
  ];
}
function popoutTarget(address, launcherAddress) {
  const url = new URL(address), launcher = new URL(launcherAddress);
  if (url.username || url.password || url.origin !== launcher.origin || !/^\/(?:app\/(?:principal-?ed|builder)(?:\/|$)|modules(?:\/|$)|app\/[^/]+\/modules(?:\/|$))/.test(url.pathname)) throw new Error('Open a workspace before opening it in a separate window.');
  return url.href;
}
module.exports = { workspaceMenu, popoutTarget };
