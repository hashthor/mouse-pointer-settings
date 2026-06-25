const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cursorAPI', {
  applyCursor: (color, size, shape) => ipcRenderer.invoke('apply-cursor', { color, size, shape }),
  resetDefault: () => ipcRenderer.invoke('reset-cursor'),
  getLastTheme: () => ipcRenderer.invoke('get-last-theme'),
  onStatusUpdate: (callback) => {
    ipcRenderer.on('cursor-status', (_event, msg) => callback(msg));
  },
});
