class AppWindowRegistry {
  constructor() { this.windows = new Map(); }
  set(appId, window) { this.windows.set(appId, window); return window; }
  delete(appId, window) {
    if (window === undefined || this.windows.get(appId) === window) this.windows.delete(appId);
  }
  active(appId) {
    const window = this.windows.get(appId);
    if (!window || window.isDestroyed()) { this.windows.delete(appId); return null; }
    return window;
  }
  forSender(sender) {
    for (const [appId, window] of this.windows) {
      if (!window.isDestroyed() && sender === window.webContents) return { appId, window };
    }
    return null;
  }
}
module.exports = { AppWindowRegistry };
