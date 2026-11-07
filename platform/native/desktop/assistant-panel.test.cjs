const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AssistantPanels } = require('./assistant-panel.cjs');
const {EventEmitter}=require('node:events');

class FakeWindow extends EventEmitter {
  static instances=[];
  constructor(options={}){super();this.id=FakeWindow.instances.length+1;this.options=options;this.dead=false;this.messages=[];this.webContents=new EventEmitter();this.webContents.send=(...value)=>this.messages.push(value);this.webContents.setWindowOpenHandler=fn=>{this.openHandler=fn;};FakeWindow.instances.push(this);}
  isDestroyed(){return this.dead;}isMinimized(){return false;}show(){this.shown=true;}focus(){this.focused=true;}
  setTitle(title){this.title=title;}
  async loadURL(url){this.url=url;}
  close(){this.dead=true;this.emit('closed');}
}

test('AI opens as one independent window, keeps the host intact, and settings focus the same window',async()=>{
  FakeWindow.instances=[];const owner=new FakeWindow();let applied=0;
  const panels=new AssistantPanels({BrowserWindow:FakeWindow,getUrl:()=> 'http://127.0.0.1:3000',onOpen:async()=>{applied++;}});
  await Promise.all([panels.toggle(owner,'researched'),panels.toggle(owner,'researched')]);
  assert.equal(FakeWindow.instances.length,2);assert.equal(applied,1);
  const popup=FakeWindow.instances[1];assert.equal(popup.options.webPreferences.contextIsolation,true);assert.equal(popup.options.webPreferences.sandbox,true);assert.equal(new URL(popup.url).searchParams.get('app'),'researched');
  assert.equal(owner.dead,false);assert.equal(popup.shown,true);assert.equal(panels.owns(popup.webContents),true);
  await panels.openSettings(owner,'researched');assert.equal(FakeWindow.instances.length,2);assert.ok(popup.messages.some(m=>m[0]==='assistant:show-settings'));
  panels.closeFor(popup.webContents);assert.equal(popup.dead,true);assert.equal(owner.dead,false);assert.equal(panels.panels.size,0);
});

test('closing the owner releases its AI window, and navigation cannot escape the assistant origin/path',async()=>{
  FakeWindow.instances=[];const owner=new FakeWindow(),panels=new AssistantPanels({BrowserWindow:FakeWindow,getUrl:()=> 'http://127.0.0.1:3000'});await panels.toggle(owner);
  const popup=FakeWindow.instances[1];let blocked=0;
  popup.webContents.emit('will-navigate',{preventDefault:()=>blocked++},'https://example.com/assistant');
  popup.webContents.emit('will-navigate',{preventDefault:()=>blocked++},'http://127.0.0.1:3000/api/admin');
  assert.equal(blocked,2);assert.deepEqual(popup.openHandler(),{action:'deny'});
  owner.close();assert.equal(popup.dead,true);assert.equal(panels.panels.size,0);
});
test('ResearchEd page capture cannot bypass authorised evidence projection', async () => {
  const panels = new AssistantPanels({}); const sender = {};
  panels.panels.set(1, { appId: 'researched', view: { webContents: sender }, window: { isDestroyed: () => false, webContents: { executeJavaScript: () => assert.fail('must not scrape ResearchEd page') } } });
  await assert.rejects(panels.contextFor(sender), /blind review/);
});
