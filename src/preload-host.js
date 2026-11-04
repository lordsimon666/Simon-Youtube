'use strict';
// Preload für die eigene Oberfläche (Hauptfenster + Willkommensfenster).
const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = new Set(['later:list', 'auth:state', 'now-playing', 'toast']);

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  setBounds: (bounds) => ipcRenderer.send('layout:bounds', bounds),
  saveSplits: (splits) => ipcRenderer.send('layout:splits', splits),
  login: () => ipcRenderer.send('auth:login'),
  logout: () => ipcRenderer.send('auth:logout'),
  playLater: (id) => ipcRenderer.send('later:play', id),
  removeLater: (id) => ipcRenderer.send('later:remove', id),
  clearLater: () => ipcRenderer.send('later:clear'),
  addCurrentToLater: () => ipcRenderer.send('later:addCurrent'),
  browserNav: (cmd) => ipcRenderer.send('browser:nav', cmd),
  setCommentsTab: (tab) => ipcRenderer.send('comments:tab', tab),
  welcomeChoice: (choice) => ipcRenderer.send('welcome:choice', choice),
  on: (channel, cb) => {
    if (!EVENTS.has(channel)) return;
    ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  },
});
