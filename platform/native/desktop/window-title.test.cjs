const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {appWindowTitle,launcherWindowTitle,bindWindowTitle}=require('./window-title.cjs');
test('native app titles survive document title changes, reloads and page navigation',()=>{
  for(const id of ['principal-ed','builder','dressed','researched','tradeed','assistant']){
    const window=new EventEmitter();window.webContents=new EventEmitter();window.isDestroyed=()=>false;window.setTitle=value=>window.title=value;
    const expected=appWindowTitle(id);bindWindowTitle(window,expected);let prevented=false;
    window.emit('page-title-updated',{preventDefault:()=>prevented=true},'TimSyS Launcher');assert.equal(prevented,true);assert.equal(window.title,expected);
    window.title='TimSyS Launcher';window.webContents.emit('did-finish-load');assert.equal(window.title,expected);
    window.title='Report title';window.webContents.emit('did-navigate-in-page');assert.equal(window.title,expected);
  }
});
test('the launcher follows its current workspace and resets its name on return',()=>{
  const window=new EventEmitter();window.webContents=new EventEmitter();window.isDestroyed=()=>false;window.setTitle=value=>window.title=value;let address='http://127.0.0.1:3000/';
  bindWindowTitle(window,()=>launcherWindowTitle(address));assert.equal(window.title,'TimSyS Launcher');
  for(const [route,title] of [['/app/principal-ed','Principal’Ed'],['/app/principaled','Principal’Ed'],['/app/builder','Builder'],['/modules','Builder'],['/assistant','AI integration'],['/','TimSyS Launcher']]){address='http://127.0.0.1:3000'+route;window.webContents.emit('did-navigate-in-page');assert.equal(window.title,title);}
});
