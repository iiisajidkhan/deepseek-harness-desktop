'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('harness', {
  onStatus(callback) {
    ipcRenderer.on('harness:status', (_event, message) => callback(message));
  },
  onError(callback) {
    ipcRenderer.on('harness:error', (_event, message) => callback(message));
  },
  retry() {
    ipcRenderer.send('harness:retry');
  },
  quit() {
    ipcRenderer.send('harness:quit');
  },
  openLogs() {
    ipcRenderer.send('harness:open-logs');
  },
});
