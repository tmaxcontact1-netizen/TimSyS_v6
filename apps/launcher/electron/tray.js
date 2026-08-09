const { Tray, Menu, app } = require('electron');
const path = require('path');

let tray = null;

function createTray() {
  const iconPath = path.join(__dirname, '../public/assets/tray-icon.png');
  
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: () => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) mainWindow.show();
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setToolTip('TimSyS Launcher');
  tray.setContextMenu(contextMenu);
}

module.exports = { createTray };
