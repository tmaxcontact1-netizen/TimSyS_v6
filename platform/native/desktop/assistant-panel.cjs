const path = require('node:path');
const { appWindowTitle, bindWindowTitle } = require('./window-title.cjs');

// Utility windows never resize the app or replace its current page.
class AssistantPanels {
  constructor({ BrowserWindow, getUrl, onOpen = async () => {}, configureWindow = () => {} }) {
    Object.assign(this, { BrowserWindow, getUrl, onOpen, configureWindow });
    this.panels = new Map(); this.opening = new Map();
  }
  owns(sender) { return [...this.panels.values()].some(p => p.view.webContents === sender); }
  hostFor(sender) { return [...this.panels.values()].find(p => p.view.webContents === sender)?.window; }
  async contextFor(sender) {
    const entry = [...this.panels.values()].find(p => p.view.webContents === sender);
    if (!entry || entry.window.isDestroyed()) throw new Error('The app window is unavailable.');
    if (entry.appId === 'researched') throw new Error('Research’Ed evidence must be read through its authorised sources to preserve blind review. Ask the assistant to find the project and read its report.');
    return entry.window.webContents.executeJavaScript('({title:document.title.slice(0,200),text:(String(window.getSelection()||\'\').trim()||document.body.innerText).slice(0,24000)})');
  }
  closeFor(sender) { const entry = [...this.panels.values()].find(p => p.view.webContents === sender); if (entry) this.close(entry.window); }
  close(window) {
    const entry = this.panels.get(window.id);
    if (!entry) return;
    this.panels.delete(window.id); window.removeListener('closed', entry.ownerClosed);
    if (!entry.view.isDestroyed()) entry.view.close();
  }
  async openSettings(window, appId = 'timsys') {
    await this.toggle(window, appId, true);
    const entry = this.panels.get(window.id);
    if (entry) { entry.view.webContents.send('assistant:show-settings'); entry.view.focus(); }
  }
  async toggle(window, appId = 'timsys', settings = false) {
    const existing = this.panels.get(window.id);
    if (existing && !existing.view.isDestroyed()) {
      if (existing.view.isMinimized()) existing.view.restore();
      existing.view.show(); existing.view.focus(); return;
    }
    if (this.opening.has(window.id)) { await this.opening.get(window.id); return; }
    const opening = this.open(window, appId, settings); this.opening.set(window.id, opening);
    try { await opening; } finally { this.opening.delete(window.id); }
  }
  async open(window, appId, settings) {
    await this.onOpen(); if (window.isDestroyed()) return;
    const url = new URL('/assistant', this.getUrl()); url.searchParams.set('app', appId);
    if (settings) url.searchParams.set('settings', 'connections');
    const view = new this.BrowserWindow({ width: 640, height: 820, minWidth: 420, minHeight: 560, show: false,
      title: 'AI integration · TimSyS', backgroundColor: '#171222',
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') } });
    const entry = { window, view, appId, ownerClosed: () => this.close(window) };
    this.panels.set(window.id, entry); window.once('closed', entry.ownerClosed);
    view.once('closed', () => { if (this.panels.get(window.id) === entry) this.panels.delete(window.id); window.removeListener('closed', entry.ownerClosed); });
    this.configureWindow(view, appId);
    bindWindowTitle(view, appWindowTitle('assistant'));
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event, next) => { try { const target = new URL(next); if (target.origin !== url.origin || target.pathname !== '/assistant') event.preventDefault(); } catch { event.preventDefault(); } });
    try { await view.loadURL(url.href); if (!view.isDestroyed()) { view.show(); view.focus(); } }
    catch (error) { this.close(window); throw error; }
  }
}
module.exports = { AssistantPanels };
