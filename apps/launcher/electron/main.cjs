'use strict';
// Minimal desktop bootstrap. TimSyS owns every native/backend implementation.
const path=require('node:path'),{app}=require('electron');
const base=app.isPackaged?path.join(process.resourcesPath,'platform'):path.resolve(__dirname,'../../../platform');
let host=base;
if(app.isPackaged){const{UpdateManager}=require(path.join(base,'native/desktop/update-manager.cjs'));const{compatibleRoots}=require(path.join(base,'native/desktop/central-bundles.cjs'));host=compatibleRoots(new UpdateManager({dataRoot:app.getPath('userData'),currentLauncherVersion:app.getVersion(),manifestUrl:''}).activeRoots()).platform||base;}
require(path.join(host,'native/desktop/main.cjs'));
