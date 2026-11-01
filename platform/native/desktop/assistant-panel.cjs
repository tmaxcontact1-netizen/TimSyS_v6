const path = require('node:path');

// One platform-owned pane can accompany any app without changing that app's frontend.
class AssistantPanels {
  constructor({ WebContentsView, getUrl, onOpen = async () => {} }) { this.WebContentsView = WebContentsView; this.getUrl = getUrl; this.onOpen = onOpen; this.panels = new Map(); this.opening = new Set(); }
  owns(sender) { return [...this.panels.values()].some(p => p.view.webContents === sender); }
  async contextFor(sender) {
    const entry = [...this.panels.values()].find(p => p.view.webContents === sender);
    if (!entry || entry.window.isDestroyed()) throw new Error('The app window is unavailable.');
    if (entry.appId === 'researched') throw new Error('Research’Ed evidence must be read through its authorised sources to preserve blind review. Ask the assistant to find the project and read its report.');
    return entry.window.webContents.executeJavaScript(`({title:document.title.slice(0,200),text:(String(window.getSelection()||'').trim()||document.body.innerText).slice(0,24000)})`);
  }
  closeFor(sender) { const entry = [...this.panels.values()].find(p => p.view.webContents === sender); if (entry) this.close(entry.window); }
  close(window) {
    const entry = this.panels.get(window.id);
    if (!entry) return;
    this.panels.delete(window.id);
    window.removeListener('resize', entry.resize);
    if (!window.isDestroyed()) {
      window.contentView.removeChildView(entry.view);
      window.webContents.removeListener('did-finish-load', entry.onLoad);
      if (entry.cssKey) void window.webContents.removeInsertedCSS(entry.cssKey).catch(() => {});
    }
    if (!entry.view.webContents.isDestroyed()) entry.view.webContents.close();
  }
  async openSettings(window) {
    const existing = this.panels.get(window.id);
    if (existing) {
      existing.view.webContents.send('assistant:show-settings');
      existing.view.webContents.focus();
      return;
    }
    return this.toggle(window, 'timsys', true);
  }
  async toggle(window, appId = 'timsys', settings = false) {
    if (this.panels.has(window.id)) { this.close(window); return; }
    if (this.opening.has(window.id)) return;
    this.opening.add(window.id);
    try { await this.onOpen(); } finally { this.opening.delete(window.id); }
    if (window.isDestroyed()) return;
    const url = new URL('/assistant', this.getUrl());
    url.searchParams.set('app', appId);
    if (settings) url.searchParams.set('settings', 'connections');
    const view = new this.WebContentsView({ webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') } });
    const resize = () => {
      if (window.isDestroyed()) return;
      const [width, height] = window.getContentSize(), panelWidth = Math.min(500, Math.max(360, Math.round(width * 0.36)));
      view.setBounds({ x: Math.max(0, width - panelWidth), y: 0, width: Math.min(width, panelWidth), height });
    };
    const entry = { window, view, resize, cssKey: null, appId };
    // BrowserWindow's own WebContents is not exposed as a child View. Reserve
    // matching layout space in the host document while the native pane is open.
    entry.reserve = async () => {
      const key = await window.webContents.insertCSS('html{min-width:0!important}body{width:calc(100vw - clamp(360px,36vw,500px))!important;min-width:0!important}#root{width:100%!important;min-width:0!important}');
      if (this.panels.get(window.id) !== entry) { await window.webContents.removeInsertedCSS(key); return; }
      if (entry.cssKey) await window.webContents.removeInsertedCSS(entry.cssKey).catch(() => {});
      entry.cssKey = key;
    };
    this.panels.set(window.id, entry);
    window.contentView.addChildView(view);
    window.on('resize', resize);
    entry.onLoad = () => { void entry.reserve().catch(() => {}); };
    window.webContents.on('did-finish-load', entry.onLoad);
    window.once('closed', () => this.close(window));
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event, next) => { if (new URL(next).origin !== url.origin || new URL(next).pathname !== '/assistant') event.preventDefault(); });
    resize();
    try { await entry.reserve(); await view.webContents.loadURL(url.href); view.webContents.focus(); }
    catch (error) { this.close(window); throw error; }
  }
}
module.exports = { AssistantPanels };
