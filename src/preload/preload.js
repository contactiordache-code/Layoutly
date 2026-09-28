const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, cb) {
  const handler = (_e, ...args) => cb(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('layoutly', {
  platform: process.platform,
  getState: () => ipcRenderer.invoke('state:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  validateHotkey: (accel) => ipcRenderer.invoke('hotkey:validate', accel),
  suspendHotkey: (suspended) => ipcRenderer.invoke('hotkey:suspend', suspended),
  consume: (kind, id) => ipcRenderer.invoke('credits:consume', kind, id),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
  deactivateLicense: () => ipcRenderer.invoke('license:deactivate'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  capture: (webContentsId, rect) => ipcRenderer.invoke('capture', webContentsId, rect),
  copyText: (text) => ipcRenderer.invoke('clipboard:text', text),
  copyImage: (dataUrl) => ipcRenderer.invoke('clipboard:image', dataUrl),
  onHotkey: (cb) => subscribe('hotkey', cb),
  onStateChanged: (cb) => subscribe('state:changed', cb),
});
