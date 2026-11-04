'use strict';
// Preload für die eigene Oberfläche (Hauptfenster + Willkommensfenster).
const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = new Set(['later:list', 'auth:state', 'now-playing', 'toast', 'split:state', 'comments-tab', 'agc:stats', 'lang', 'layout:reset', 'address:focus', 'panels:hidden', 'later:count']);

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  setBounds: (bounds) => ipcRenderer.send('layout:bounds', bounds),
  saveSplits: (splits) => ipcRenderer.send('layout:splits', splits),
  login: () => ipcRenderer.send('auth:login'),
  logout: () => ipcRenderer.send('auth:logout'),
  importCookies: () => ipcRenderer.send('auth:importCookies'),
  playLater: (id) => ipcRenderer.send('later:play', id),
  removeLater: (id) => ipcRenderer.send('later:remove', id),
  clearLater: () => ipcRenderer.send('later:clear'),
  addCurrentToLater: () => ipcRenderer.send('later:addCurrent'),
  browserNav: (cmd) => ipcRenderer.send('browser:nav', cmd),
  setCommentsTab: (tab) => ipcRenderer.send('comments:tab', tab),
  welcomeChoice: (choice) => ipcRenderer.send('welcome:choice', choice),
  toggleSplit: () => ipcRenderer.send('split:toggle'),
  openAddress: (text, mode) => ipcRenderer.invoke('address:open', text, mode),
  copyCurrentLink: () => ipcRenderer.send('video:copyLink'),
  setDragging: (on) => ipcRenderer.send('layout:dragging', !!on),
  savePanelOrder: (order) => ipcRenderer.send('layout:order', order),
  resetLayout: () => ipcRenderer.send('layout:reset'),
  togglePanel: (name) => ipcRenderer.send('panel:toggle', name),
  openSettings: () => ipcRenderer.send('settings:open'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.send('settings:set', s),
  on: (channel, cb) => {
    if (!EVENTS.has(channel)) return;
    ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  },
});
