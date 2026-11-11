'use strict';

/** Rasterize assets/icon.svg to .cache/icon-render.png using Chromium. */

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
app.setPath('userData', path.join(root, '.cache', 'electron-profile'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  win.webContents.setFrameRate(10);
  await win.loadFile(path.join(root, 'assets', 'icon.svg'));
  await new Promise((resolve) => setTimeout(resolve, 600));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  fs.writeFileSync(path.join(root, '.cache', 'icon-render.png'), image.toPNG());
  console.log('rendered', path.join(root, '.cache', 'icon-render.png'));
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
