'use strict';
const {
  app, BrowserWindow, WebContentsView, ipcMain, session, shell, net, Menu, screen, dialog, clipboard,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const CSS = require('./inject');
const I18N = require('./i18n');

const APP_ID = 'io.github.lordsimon666.SimonYouTube';
const PARTITION = 'persist:youtube';
const YT = 'https://www.youtube.com';
const HOME_URL = YT + '/';
const LOGIN_URL = 'https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&hl=de&continue=' +
  encodeURIComponent(YT + '/signin?action_handle_signin=true&app=desktop&hl=de&next=' + encodeURIComponent(HOME_URL));
const AUTH_COOKIES = new Set(['LOGIN_INFO', 'SAPISID', '__Secure-3PAPISID']);
const ID_RE = /^[\w-]{11}$/;

// Portable Windows-Version: Daten neben der .exe speichern
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'Simon-YouTube-Daten'));
}

// Normaler Chrome-User-Agent (ohne "Electron"), damit YouTube/Google-Login funktionieren
function chromeUserAgent() {
  const major = String(process.versions.chrome || '120').split('.')[0];
  const os = process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64'
    : process.platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7'
      : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}
app.userAgentFallback = chromeUserAgent();

// ---------------------------------------------------------------- Speicher
const DEFAULT_SPLITS = { col: 64, left: 60, right: 60 };
const store = {
  firstRunDone: false,
  watchLater: [],
  splits: { ...DEFAULT_SPLITS },
  commentsTab: 'comments',
  bounds: null,
  maximized: false,
  settings: {},
  splitMode: false,
  splitBounds: {},
  panelOrder: null,
  hidden: { browser: false, comments: false, later: false },
};
const HIDEABLE = ['browser', 'comments', 'later']; // der Media-Player (video) bleibt immer sichtbar
const DEFAULT_ORDER = { tl: 'panel-video', bl: 'panel-browser', tr: 'panel-comments', br: 'panel-later' };
function cleanOrder(o) {
  if (!o || typeof o !== 'object') return { ...DEFAULT_ORDER };
  const out = {};
  for (const k of Object.keys(DEFAULT_ORDER)) out[k] = o[k];
  const ids = Object.values(out);
  const valid = Object.values(DEFAULT_ORDER);
  return new Set(ids).size === 4 && ids.every((id) => valid.includes(id)) ? out : { ...DEFAULT_ORDER };
}
// Profi-Auto-Level (AGC): [min, max, Standard]
const AGC_RANGES = {
  target: [-36, -6, -18],     // Zielpegel in dBFS (RMS, K-gewichtet)
  maxCut: [0, 40, 12],        // max. Absenkung in dB
  maxBoost: [0, 40, 12],      // max. Verstärkung in dB
  attack: [10, 5000, 300],    // Absenk-Zeit in ms
  release: [50, 20000, 2500], // Anhebe-Zeit in ms
  window: [50, 5000, 400],    // Messfenster in ms
  gate: [-80, -20, -50],      // unterhalb wird nicht nachgeregelt (dBFS)
  makeup: [-12, 12, 0],       // Make-up-Gain in dB
  ceiling: [-12, 0, -1],      // Limiter-Grenze in dBFS
};
const DEFAULT_AGC = {
  ...Object.fromEntries(Object.entries(AGC_RANGES).map(([k, r]) => [k, r[2]])),
  limiter: true,
};
const DEFAULT_SETTINGS = { volumeMode: 'auto', volumeStrength: 50, quality: 'auto', agc: DEFAULT_AGC, lang: '' };
// Sprache der App: gespeichert, sonst Systemsprache (Deutsch für de-*, sonst Englisch)
const T = (key, vars) => I18N.t(store.settings.lang || 'de', key, vars);
const PLAYER_SCRIPT = fs.readFileSync(path.join(__dirname, 'player-inject.js'), 'utf8');
const QUALITIES = ['auto', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
let storePath = '';
let saveTimer = null;

function loadStore() {
  storePath = path.join(app.getPath('userData'), 'simon-youtube.json');
  try {
    const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    Object.assign(store, data);
    if (!Array.isArray(store.watchLater)) store.watchLater = [];
    store.splits = { ...DEFAULT_SPLITS, ...(store.splits || {}) };
    store.settings = cleanSettings(store.settings);
    if (!store.splitBounds || typeof store.splitBounds !== 'object') store.splitBounds = {};
  } catch { /* erster Start */ }
  store.settings = cleanSettings(store.settings);
  store.panelOrder = cleanOrder(store.panelOrder);
  const h = store.hidden && typeof store.hidden === 'object' ? store.hidden : {};
  store.hidden = Object.fromEntries(HIDEABLE.map((k) => [k, !!h[k]]));
}

function writeStore() {
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    const tmp = storePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, storePath);
  } catch (err) {
    console.error('Speichern fehlgeschlagen:', err);
  }
}

function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeStore, 250);
}

// ---------------------------------------------------------------- Hilfen
function parseTime(t) {
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = String(t).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !m[0]) return null;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

function parseVideo(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  const t = parseTime(u.searchParams.get('t') || u.searchParams.get('start'));
  const list = u.searchParams.get('list') || null;
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return ID_RE.test(id) ? { id, type: 'video', t, list } : null;
  }
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  if (u.pathname === '/watch') {
    const id = u.searchParams.get('v') || '';
    return ID_RE.test(id) ? { id, type: 'video', t, list } : null;
  }
  const m = u.pathname.match(/^\/(shorts|live|embed|v)\/([\w-]{11})/);
  if (m) return { id: m[2], type: m[1] === 'shorts' ? 'short' : 'video', t, list: null };
  return null;
}

function isYoutubeUrl(raw) {
  try {
    const u = new URL(raw);
    return /^https?:$/.test(u.protocol) && /(^|\.)youtube\.com$/.test(u.hostname);
  } catch { return false; }
}

function isInternalUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol === 'data:' || u.protocol === 'about:') return true;
    if (!/^https?:$/.test(u.protocol)) return false;
    const h = u.hostname;
    return /(^|\.)youtube\.com$/.test(h) || /(^|\.)youtube-nocookie\.com$/.test(h) ||
      /(^|\.)youtu\.be$/.test(h) || /(^|\.)gstatic\.com$/.test(h) ||
      /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h);
  } catch { return false; }
}

function openExternal(raw) {
  try {
    const u = new URL(raw);
    if (['http:', 'https:', 'mailto:'].includes(u.protocol)) shell.openExternal(u.toString());
  } catch { /* ignorieren */ }
}

function videoUrl(info) {
  if (info.type === 'short') return `${YT}/shorts/${info.id}`;
  let url = `${YT}/watch?v=${info.id}`;
  if (info.list) url += '&list=' + encodeURIComponent(info.list);
  if (info.t) url += `&t=${info.t}s`;
  return url;
}

function placeholder(text) {
  const html = '<!doctype html><html><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#0f0f0f;color:#8a8a8a;font:15px system-ui,Segoe UI,sans-serif;text-align:center;' +
    'padding:24px;box-sizing:border-box">' + text + '</body></html>';
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

async function fetchMeta(info) {
  try {
    const target = info.type === 'short' ? `${YT}/shorts/${info.id}` : `${YT}/watch?v=${info.id}`;
    const res = await net.fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(target));
    if (!res.ok) return null;
    const j = await res.json();
    return { title: j.title || '', channel: j.author_name || '' };
  } catch { return null; }
}

// ---------------------------------------------------------------- Zustand
let win = null;
let welcomeWin = null;
let loginWin = null;
const views = {};
let slotBounds = {};
let current = null;
let commentsCssKey = null;
let videoFullscreen = false;
let loggedIn = false;
let settingsWin = null;
const hosts = {};          // Rolle -> eigenes Fenster im 4-Fenster-Modus
let splitMode = false;
let merging = false;
let quitting = false;
let preSplit = null;       // Hauptfenster-Größe vor dem Aufteilen

const HOST_HEADER = 36;    // Höhe der Kopfzeile in den Einzelfenstern
const panelTitle = (role) => T('win.' + role);

const ytSession = () => session.fromPartition(PARTITION);

function roleOf(sender) {
  for (const [role, view] of Object.entries(views)) {
    if (view.webContents === sender) return role;
  }
  return null;
}

function sendUI(channel, ...args) {
  for (const w of [win, ...Object.values(hosts)]) {
    if (w && !w.isDestroyed()) w.webContents.send(channel, ...args);
  }
}

function toast(msg) { sendUI('toast', msg); }

function sendLater() { sendUI('later:list', store.watchLater); }

function sendNowPlaying() { sendUI('now-playing', current); }

// ---------------------------------------------------------------- Panels
function createView(role) {
  const view = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, 'preload-yt.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      autoplayPolicy: role === 'video' ? 'no-user-gesture-required' : 'user-gesture-required',
      backgroundThrottling: role !== 'video',
    },
  });
  view.setBackgroundColor('#0f0f0f');
  const wc = view.webContents;

  wc.setWindowOpenHandler(({ url }) => {
    const info = parseVideo(url);
    if (info) addLater(info); // z. B. Mittelklick, falls nicht schon abgefangen
    else if (isYoutubeUrl(url)) views.browser.webContents.loadURL(url);
    else openExternal(url);
    return { action: 'deny' };
  });

  const guard = (e, url) => {
    const target = e.url || url;
    if (e.isMainFrame === false) return;
    if (target && !isInternalUrl(target)) {
      e.preventDefault();
      openExternal(target);
    }
  };
  wc.on('will-navigate', guard);
  wc.on('will-redirect', guard);
  wc.on('dom-ready', () => injectCss(role));
  // Strg+L -> Adressleiste
  wc.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.control || input.meta) && !input.alt && input.key.toLowerCase() === 'l') {
      e.preventDefault();
      if (win && !win.isDestroyed()) {
        win.focus();
        win.webContents.focus();
        win.webContents.send('address:focus');
      }
    }
  });
  if (role === 'video') wc.on('dom-ready', applyPlayerSettings);

  if (role === 'browser' || role === 'comments') wc.setAudioMuted(true);

  if (role === 'browser') {
    // Fallback: Falls YouTube trotzdem im Browser-Panel ein Video öffnet,
    // ins Video-Panel umleiten und im Browser zurückgehen.
    const fallback = (url) => {
      const info = parseVideo(url);
      if (!info) return;
      play(info);
      setTimeout(() => {
        const h = wc.navigationHistory;
        if (h.canGoBack()) h.goBack(); else wc.loadURL(HOME_URL);
      }, 0);
    };
    wc.on('did-navigate', (_e, url) => fallback(url));
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => { if (isMainFrame) fallback(url); });
  }

  if (role === 'video') {
    wc.on('did-navigate', (_e, url) => onVideoNavigated(url));
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => { if (isMainFrame) onVideoNavigated(url); });
    wc.on('enter-html-full-screen', () => { videoFullscreen = true; layoutViews(); });
    wc.on('leave-html-full-screen', () => { videoFullscreen = false; layoutViews(); });
  }

  win.contentView.addChildView(view);
  views[role] = view;
  return view;
}

async function injectCss(role) {
  const wc = views[role] && views[role].webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    await wc.insertCSS(CSS[role]);
    if (role === 'comments') commentsCssKey = await wc.insertCSS(CSS.tabs[store.commentsTab] || CSS.tabs.comments);
  } catch { /* Seite schon weg */ }
}

function setCommentsTab(tab) {
  if (!CSS.tabs[tab]) return;
  store.commentsTab = tab;
  saveStore();
  const wc = views.comments && views.comments.webContents;
  if (!wc) return;
  const old = commentsCssKey;
  commentsCssKey = null;
  if (old) wc.removeInsertedCSS(old).catch(() => {});
  wc.insertCSS(CSS.tabs[tab]).then((k) => { commentsCssKey = k; }).catch(() => {});
  sendUI('comments-tab', tab);
  wc.executeJavaScript('window.scrollTo(0, 0)').catch(() => {});
}

function fitToHost(role) {
  const h = hosts[role];
  if (!h || h.isDestroyed() || !views[role]) return;
  const [w, hh] = h.getContentSize();
  // Bei Vollbild-Video die Kopfzeile überdecken
  const top = role === 'video' && videoFullscreen ? 0 : HOST_HEADER;
  views[role].setBounds({ x: 0, y: top, width: w, height: Math.max(0, hh - top) });
  views[role].setVisible(true);
}

let draggingPanels = false;

function layoutViews() {
  if (!win || win.isDestroyed()) return;
  if (draggingPanels && !splitMode) {
    for (const role of ['browser', 'video', 'comments']) if (views[role]) views[role].setVisible(false);
    return;
  }
  if (splitMode) for (const role of Object.keys(hosts)) fitToHost(role);
  // Im 4-Fenster-Modus liegt nur der Player im Hauptfenster
  const mainRoles = splitMode ? ['video'] : ['browser', 'video', 'comments'];
  if (videoFullscreen && views.video) {
    const [w, h] = win.getContentSize();
    for (const role of mainRoles) if (role !== 'video') views[role].setVisible(false);
    views.video.setVisible(true);
    views.video.setBounds({ x: 0, y: 0, width: w, height: h });
    return;
  }
  for (const role of mainRoles) {
    const view = views[role];
    const b = slotBounds[role];
    if (!view) continue;
    if (b && b.width > 0 && b.height > 0) {
      view.setBounds(b);
      view.setVisible(true);
    } else {
      view.setVisible(false);
    }
  }
}

// ---------------------------------------------------------------- Panels ein-/ausblenden
function setHidden(name, value) {
  if (!HIDEABLE.includes(name)) return;
  store.hidden[name] = !!value;
  saveStore();
  if (splitMode) {
    const h = hosts[name];
    if (h && !h.isDestroyed()) {
      if (value) h.hide();
      else { h.showInactive(); fitToHost(name); }
    }
  }
  sendUI('panels:hidden', store.hidden);
}

// ---------------------------------------------------------------- Abspielen
function setCurrent(info) {
  current = { id: info.id, type: info.type, list: info.list || null, title: '', channel: '' };
  views.comments.webContents.loadURL(`${YT}/watch?v=${info.id}`);
  sendNowPlaying();
  const id = info.id;
  fetchMeta(info).then((meta) => {
    if (meta && current && current.id === id) {
      current.title = meta.title;
      current.channel = meta.channel;
      sendNowPlaying();
    }
  });
}

function seek(t) {
  views.video.webContents.executeJavaScript(
    `(() => { const v = document.querySelector('#movie_player video, video');
      if (v) { v.currentTime = ${Number(t) || 0}; v.play(); } })()`
  ).catch(() => {});
}

function play(info) {
  if (!info) return;
  if (current && current.id === info.id && current.type === info.type) {
    if (info.t != null) seek(info.t);
    return;
  }
  setCurrent(info);
  views.video.webContents.loadURL(videoUrl(info));
}

// Video-Panel wechselt selbst das Video (Autoplay, Endscreen, Shorts scrollen)
function onVideoNavigated(url) {
  const info = parseVideo(url);
  if (!info) return;
  if (current && current.id === info.id) return;
  setCurrent(info);
}

// ---------------------------------------------------------------- Später ansehen
function addLater(info, titleGuess) {
  if (!info) return;
  if (store.watchLater.some((x) => x.id === info.id)) {
    toast(T('toast.laterExists'));
    return;
  }
  const item = {
    id: info.id,
    type: info.type,
    title: (titleGuess || '').trim(),
    channel: '',
    addedAt: Date.now(),
  };
  store.watchLater.push(item);
  saveStore();
  sendLater();
  toast(T('toast.laterAdded'));
  fetchMeta(info).then((meta) => {
    if (!meta) return;
    const it = store.watchLater.find((x) => x.id === info.id);
    if (!it) return;
    it.title = meta.title || it.title;
    it.channel = meta.channel;
    saveStore();
    sendLater();
  });
}

// ---------------------------------------------------------------- Anmeldung
async function checkLoggedIn() {
  try {
    const cookies = await ytSession().cookies.get({ domain: 'youtube.com' });
    return cookies.some((c) => AUTH_COOKIES.has(c.name));
  } catch { return false; }
}

async function refreshAuth() {
  loggedIn = await checkLoggedIn();
  sendUI('auth:state', { loggedIn });
  return loggedIn;
}

function reloadAll() {
  if (views.browser) views.browser.webContents.reload();
  if (current) {
    views.video.webContents.reload();
    views.comments.webContents.reload();
  }
}

function openLogin() {
  if (loginWin && !loginWin.isDestroyed()) { loginWin.focus(); return; }
  const wasLoggedIn = loggedIn;
  loginWin = new BrowserWindow({
    parent: win || undefined,
    width: 520,
    height: 720,
    title: T('win.login'),
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    icon: iconPath(),
    webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true },
  });
  loginWin.setMenuBarVisibility(false);
  const lw = loginWin;
  lw.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) lw.loadURL(url); else openExternal(url);
    return { action: 'deny' };
  });
  let blocked = false;
  const check = async (_e, url) => {
    try {
      const u = new URL(url);
      if (u.hostname === 'www.youtube.com' && await checkLoggedIn() && !lw.isDestroyed()) lw.close();
      // Googles Sperrseite "Anmeldung nicht möglich – Dieser Browser oder diese App ist unter Umständen nicht sicher"
      if (/^accounts\.google\./.test(u.hostname) && /rejected|disallowed|unsupported/i.test(u.pathname + u.search)) {
        blocked = true;
        if (!lw.isDestroyed()) lw.close();
      }
    } catch { /* ignorieren */ }
  };
  lw.webContents.on('did-navigate', check);
  lw.webContents.on('did-navigate-in-page', check);
  lw.on('closed', async () => {
    loginWin = null;
    await refreshAuth();
    if (loggedIn && !wasLoggedIn) {
      toast(T('toast.loggedIn'));
      reloadAll();
      return;
    }
    if (!loggedIn && win && !win.isDestroyed()) showLoginHelp(blocked);
  });
  lw.loadURL(LOGIN_URL);
}

// Google blockiert die Anmeldung in App-Browsern -> Anmeldung aus dem normalen Browser übernehmen
const COOKIE_EXT_CHROME = 'https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc';
const COOKIE_EXT_FIREFOX = 'https://addons.mozilla.org/firefox/addon/get-cookies-txt-locally/';

async function showLoginHelp(blocked) {
  for (;;) {
    const { response } = await dialog.showMessageBox(win, {
      type: blocked ? 'warning' : 'question',
      title: T('help.title'),
      message: blocked ? T('help.blocked') : T('help.failed'),
      detail: T('help.detail'),
      buttons: [T('help.import'), T('help.extChrome'), T('help.extFirefox'), T('help.openYt'), T('help.close')],
      defaultId: 0,
      cancelId: 4,
      noLink: true,
    });
    if (response === 0) { importCookies(win); return; }
    if (response === 1) shell.openExternal(COOKIE_EXT_CHROME);
    else if (response === 2) shell.openExternal(COOKIE_EXT_FIREFOX);
    else if (response === 3) shell.openExternal(HOME_URL);
    else return;
  }
}

// ---------------------------------------------------------------- cookies.txt-Import
// Übernimmt die Anmeldung aus dem normalen Browser (Netscape-cookies.txt-Format).
async function importCookies(parent) {
  const res = await dialog.showOpenDialog(parent || win, {
    title: T('import.pick'),
    properties: ['openFile'],
    filters: [{ name: T('import.filter'), extensions: ['txt'] }, { name: T('import.all'), extensions: ['*'] }],
  });
  if (res.canceled || !res.filePaths[0]) return;
  let text;
  try { text = fs.readFileSync(res.filePaths[0], 'utf8'); } catch (err) {
    dialog.showErrorBox(T('import.failed'), String(err.message || err));
    return;
  }
  const ses = ytSession();
  let ok = 0;
  for (let line of text.split(/\r?\n/)) {
    let httpOnly = false;
    if (line.startsWith('#HttpOnly_')) { httpOnly = true; line = line.slice(10); }
    if (!line.trim() || line.startsWith('#')) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const [domain, , cpath, secureFlag, expiry, name, ...rest] = parts;
    const host = domain.replace(/^\./, '');
    if (!/(^|\.)(youtube\.com|google\.[a-z.]+)$/.test(host)) continue;
    const secure = secureFlag.toUpperCase() === 'TRUE';
    const exp = Number(expiry);
    const cookie = {
      url: `${secure ? 'https' : 'http'}://${host}${cpath || '/'}`,
      name,
      value: rest.join('\t'),
      path: cpath || '/',
      secure,
      httpOnly,
      sameSite: secure ? 'no_restriction' : 'unspecified',
    };
    if (!name.startsWith('__Host-')) cookie.domain = domain;
    if (exp > 0) cookie.expirationDate = exp;
    try { await ses.cookies.set(cookie); ok++; } catch { /* einzelnes Cookie ungültig */ }
  }
  await ses.cookies.flushStore().catch(() => {});
  const was = loggedIn;
  await refreshAuth();
  if (loggedIn) {
    toast(T('toast.cookiesOk', { n: ok }));
    if (!was) reloadAll();
    if (loginWin && !loginWin.isDestroyed()) loginWin.close();
  } else {
    dialog.showMessageBox(parent || win, {
      type: 'warning',
      title: T('import.none.title'),
      message: T('import.none.msg', { n: ok }),
      detail: T('import.none.detail'),
    });
  }
}

// YouTube startet Videos dann direkt im Kinomodus (wichtig fürs Video-Panel)
async function setTheaterCookie() {
  try {
    await ytSession().cookies.set({
      url: HOME_URL, domain: '.youtube.com', path: '/', name: 'wide', value: '1',
      secure: true, sameSite: 'lax', expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
    });
  } catch { /* egal */ }
}

async function logout() {
  const ses = ytSession();
  try {
    await ses.clearStorageData();
    await ses.clearCache();
  } catch (err) { console.error(err); }
  await refreshAuth();
  await setTheaterCookie();
  views.browser.webContents.loadURL(HOME_URL);
  if (current) {
    views.video.webContents.reload();
    views.comments.webContents.reload();
  }
  toast(T('toast.loggedOut'));
}

// ---------------------------------------------------------------- Fenster
function iconPath() {
  return path.join(__dirname, '..', 'build', 'icon.png');
}

function validBounds(b) {
  if (!b || !b.width || !b.height) return null;
  if (typeof b.x !== 'number' || typeof b.y !== 'number') return { width: b.width, height: b.height };
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width - 50 && b.x + b.width > a.x + 50 && b.y < a.y + a.height - 50 && b.y + b.height > a.y;
  });
  return visible ? b : { width: b.width, height: b.height };
}

function showWelcome() {
  welcomeWin = new BrowserWindow({
    parent: win,
    modal: true,
    width: 480,
    height: 480,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: T('win.welcome'),
    autoHideMenuBar: true,
    backgroundColor: '#181818',
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-host.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  welcomeWin.setMenuBarVisibility(false);
  welcomeWin.once('ready-to-show', () => welcomeWin && welcomeWin.show());
  welcomeWin.on('closed', () => {
    welcomeWin = null;
    if (!store.firstRunDone) { store.firstRunDone = true; saveStore(); }
  });
  welcomeWin.loadFile(path.join(__dirname, 'welcome.html'));
}

function loadPlaceholders() {
  if (current) return;
  views.video.webContents.loadURL(placeholder(T('ph.video')));
  views.comments.webContents.loadURL(placeholder(T('ph.comments')));
}

// Sprache zur Laufzeit umschalten
function applyLanguage() {
  const lang = store.settings.lang;
  for (const w of [win, welcomeWin, settingsWin, ...Object.values(hosts)]) {
    if (w && !w.isDestroyed()) w.webContents.send('lang', lang);
  }
  for (const [role, h] of Object.entries(hosts)) if (!h.isDestroyed()) h.setTitle(panelTitle(role));
  if (loginWin && !loginWin.isDestroyed()) loginWin.setTitle(T('win.login'));
  if (views.video) loadPlaceholders();
}

function createWindow() {
  const b = validBounds(store.bounds) || { width: 1500, height: 920 };
  win = new BrowserWindow({
    ...b,
    minWidth: 960,
    minHeight: 600,
    title: 'Simon YouTube',
    backgroundColor: '#0f0f0f',
    icon: iconPath(),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-host.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  if (store.maximized) win.maximize();

  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('resize', layoutViews);
  win.on('close', () => {
    quitting = true;
    store.splitMode = splitMode;
    if (splitMode) {
      store.splitBounds.video = win.getNormalBounds();
      for (const [role, h] of Object.entries(hosts)) {
        if (!h.isDestroyed()) store.splitBounds[role] = h.getNormalBounds();
      }
      store.bounds = preSplit ? preSplit.bounds : store.bounds;
      store.maximized = preSplit ? preSplit.maximized : false;
    } else {
      store.maximized = win.isMaximized();
      store.bounds = win.getNormalBounds();
    }
    writeStore();
  });
  win.on('closed', () => {
    win = null;
    for (const h of Object.values(hosts)) if (!h.isDestroyed()) h.destroy();
    for (const w of [settingsWin, loginWin, welcomeWin]) if (w && !w.isDestroyed()) w.destroy();
    app.quit();
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  createView('browser');
  createView('video');
  createView('comments');

  views.browser.webContents.loadURL(HOME_URL);
  loadPlaceholders();

  win.once('ready-to-show', () => {
    win.show();
    if (store.splitMode) splitWindows();
    if (!store.firstRunDone) showWelcome();
  });
}

// ---------------------------------------------------------------- 4 Fenster
const SPLIT_ROLES = ['comments', 'browser', 'later']; // eigene Fenster; der Player bleibt im Hauptfenster

function splitWindows() {
  if (splitMode || !win) return;
  splitMode = true;
  preSplit = { bounds: win.getNormalBounds(), maximized: win.isMaximized() };
  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();

  // Standard: Bildschirm in vier Viertel teilen (wie das normale Layout)
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  const hw = Math.floor(area.width / 2);
  const hh = Math.floor(area.height / 2);
  const quad = {
    video: { x: area.x, y: area.y },
    comments: { x: area.x + hw, y: area.y },
    browser: { x: area.x, y: area.y + hh },
    later: { x: area.x + hw, y: area.y + hh },
  };
  const boundsFor = (role) => {
    const saved = validBounds(store.splitBounds[role]);
    return saved && typeof saved.x === 'number' ? saved : { ...quad[role], width: hw, height: hh };
  };

  for (const role of SPLIT_ROLES) {
    const h = new BrowserWindow({
      ...boundsFor(role),
      minWidth: 320,
      minHeight: 240,
      title: panelTitle(role),
      backgroundColor: '#0f0f0f',
      icon: iconPath(),
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload-host.js'),
        contextIsolation: true,
        sandbox: true,
      },
    });
    h.setMenuBarVisibility(false);
    h.on('page-title-updated', (ev) => ev.preventDefault());
    h.webContents.on('will-navigate', (ev) => ev.preventDefault());
    h.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    h.loadFile(path.join(__dirname, 'panel.html'), { query: { role } });
    if (views[role]) {
      win.contentView.removeChildView(views[role]);
      h.contentView.addChildView(views[role]);
    }
    hosts[role] = h;
    fitToHost(role);
    h.on('resize', () => fitToHost(role));
    // Schließen (X) blendet das Fenster nur aus – wieder einblenden über die Knöpfe oben im Player
    h.on('close', (ev) => {
      if (quitting || merging) return;
      ev.preventDefault();
      store.splitBounds[role] = h.getNormalBounds();
      setHidden(role, true);
    });
    if (!store.hidden[role]) h.showInactive();
  }

  win.setMinimumSize(480, 320);
  win.setBounds(boundsFor('video'));
  store.splitMode = true;
  saveStore();
  sendUI('split:state', true);
  layoutViews();
  win.focus();
}

function mergeWindows() {
  if (!splitMode || !win) return;
  merging = true;
  splitMode = false;
  store.splitBounds.video = win.getNormalBounds();
  for (const role of SPLIT_ROLES) {
    const h = hosts[role];
    if (h && !h.isDestroyed()) {
      store.splitBounds[role] = h.getNormalBounds();
      if (views[role]) h.contentView.removeChildView(views[role]);
    }
  }
  // Reihenfolge der Ebenen wie beim Start
  for (const role of ['browser', 'video', 'comments']) {
    win.contentView.removeChildView(views[role]);
    win.contentView.addChildView(views[role]);
  }
  for (const [role, h] of Object.entries(hosts)) {
    delete hosts[role];
    if (!h.isDestroyed()) h.destroy();
  }
  win.setMinimumSize(960, 600);
  if (preSplit) {
    win.setBounds(validBounds(preSplit.bounds) || { width: 1500, height: 920 });
    if (preSplit.maximized) win.maximize();
  }
  preSplit = null;
  merging = false;
  store.splitMode = false;
  saveStore();
  sendUI('split:state', false);
  layoutViews();
  win.focus();
}

// ---------------------------------------------------------------- Einstellungen
function cleanSettings(s) {
  const out = { ...DEFAULT_SETTINGS, ...(s && typeof s === 'object' ? s : {}) };
  if (!['auto', 'off', 'custom', 'agc'].includes(out.volumeMode)) out.volumeMode = DEFAULT_SETTINGS.volumeMode;
  const agcIn = out.agc && typeof out.agc === 'object' ? out.agc : {};
  out.agc = { limiter: agcIn.limiter !== undefined ? !!agcIn.limiter : DEFAULT_AGC.limiter };
  for (const [k, [min, max, def]] of Object.entries(AGC_RANGES)) {
    const v = Number(agcIn[k]);
    out.agc[k] = Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  }
  out.volumeStrength = Math.round(Math.min(100, Math.max(0, Number(out.volumeStrength))));
  if (!Number.isFinite(out.volumeStrength)) out.volumeStrength = DEFAULT_SETTINGS.volumeStrength;
  if (!QUALITIES.includes(out.quality)) out.quality = DEFAULT_SETTINGS.quality;
  if (!I18N.LANGS.includes(out.lang)) {
    let sys = 'en';
    try { sys = /^de\b/i.test(app.getLocale()) ? 'de' : 'en'; } catch { /* vor app.ready */ }
    out.lang = sys;
  }
  return out;
}

function applyPlayerSettings() {
  const wc = views.video && views.video.webContents;
  if (!wc || wc.isDestroyed()) return;
  const url = wc.getURL();
  if (!isYoutubeUrl(url)) return;
  wc.executeJavaScript(`${PLAYER_SCRIPT}(${JSON.stringify(store.settings)});`).catch(() => {});
}

function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    parent: win || undefined,
    width: 560,
    height: 820,
    minWidth: 460,
    minHeight: 400,
    resizable: true,
    minimizable: false,
    maximizable: false,
    title: T('win.settings'),
    autoHideMenuBar: true,
    backgroundColor: '#181818',
    icon: iconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-host.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.once('ready-to-show', () => settingsWin && settingsWin.show());
  // Live-Pegelanzeige des Profi-Auto-Levels
  const statsTimer = setInterval(async () => {
    if (!settingsWin || settingsWin.isDestroyed()) return;
    const wc = views.video && views.video.webContents;
    let stats = { active: false };
    if (wc && !wc.isDestroyed() && isYoutubeUrl(wc.getURL())) {
      stats = await wc.executeJavaScript('window.__ytp && window.__ytp.agcStats ? window.__ytp.agcStats() : null')
        .catch(() => null) || { active: false };
    }
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('agc:stats', stats);
  }, 150);
  settingsWin.on('closed', () => { settingsWin = null; clearInterval(statsTimer); });
  settingsWin.loadFile(path.join(__dirname, 'settings.html'));
}

// ---------------------------------------------------------------- IPC
function fromHost(e) {
  return [win, welcomeWin, settingsWin, ...Object.values(hosts)].some((w) => w && !w.isDestroyed() && e.sender === w.webContents);
}

ipcMain.on('yt:role', (e) => { e.returnValue = roleOf(e.sender) || ''; });

ipcMain.on('yt:play', (e, href) => {
  if (!roleOf(e.sender)) return;
  play(parseVideo(String(href)));
});

ipcMain.on('yt:later', (e, href, title) => {
  if (!roleOf(e.sender)) return;
  addLater(parseVideo(String(href)), typeof title === 'string' ? title : '');
});

ipcMain.on('yt:browse', (e, href) => {
  if (!roleOf(e.sender)) return;
  if (isYoutubeUrl(String(href))) views.browser.webContents.loadURL(String(href));
});

ipcMain.handle('state:get', () => ({
  watchLater: store.watchLater,
  loggedIn,
  splits: store.splits,
  commentsTab: store.commentsTab,
  nowPlaying: current,
  lang: store.settings.lang,
  splitMode,
  panelOrder: store.panelOrder,
  hidden: store.hidden,
}));

ipcMain.on('panel:toggle', (e, name) => {
  if (!fromHost(e) || !HIDEABLE.includes(name)) return;
  setHidden(name, !store.hidden[name]);
});

// ---------------------------------------------------------------- Adressleiste
function normalizeAddress(text) {
  let s = String(text || '').trim();
  // Discord & Co.: <https://…>, Markdown-Links, Text um den Link herum
  const m = s.match(/https?:\/\/[^\s<>"'\]\)]+/i);
  if (m) return m[0];
  s = s.replace(/^<|>$/g, '');
  if (/^((www|m|music)\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(s)) return 'https://' + s;
  if (ID_RE.test(s) && /[\d_-]/.test(s) && /[a-z]/i.test(s)) return `${YT}/watch?v=${s}`; // nackte Video-ID
  return s;
}

function openAddress(text, mode) {
  const s = normalizeAddress(text);
  if (!s) return { ok: false };
  const info = parseVideo(s);
  if (info) {
    if (mode === 'later') addLater(info); else play(info);
    return { ok: true, kind: 'video' };
  }
  if (isYoutubeUrl(s)) {
    views.browser.webContents.loadURL(s.replace(/^https?:\/\/(m|music)\.youtube\.com/i, YT));
    return { ok: true, kind: 'page' };
  }
  if (/^[a-z]+:\/\//i.test(s)) {
    toast(T('addr.notYt'));
    return { ok: false };
  }
  views.browser.webContents.loadURL(`${YT}/results?search_query=${encodeURIComponent(String(text).trim())}`);
  return { ok: true, kind: 'search' };
}

ipcMain.handle('address:open', (e, text, mode) => {
  if (!fromHost(e)) return { ok: false };
  return openAddress(text, mode === 'later' ? 'later' : 'play');
});

ipcMain.on('video:copyLink', async (e) => {
  if (!fromHost(e) || !current) return;
  let t = 0;
  try {
    t = Math.floor(await views.video.webContents.executeJavaScript(
      "(() => { const v = document.querySelector('.html5-video-player video'); return v ? v.currentTime : 0; })()"
    ) || 0);
  } catch { t = 0; }
  const link = current.type === 'short'
    ? `${YT}/shorts/${current.id}`
    : `https://youtu.be/${current.id}${t > 5 ? `?t=${t}` : ''}`;
  clipboard.writeText(link);
  toast(T('toast.linkCopied'));
});

// ---------------------------------------------------------------- Panel-Anordnung
ipcMain.on('layout:dragging', (e, on) => {
  if (!fromHost(e)) return;
  draggingPanels = !!on;
  layoutViews();
});

ipcMain.on('layout:order', (e, order) => {
  if (!fromHost(e)) return;
  store.panelOrder = cleanOrder(order);
  saveStore();
});

ipcMain.on('layout:reset', (e) => {
  if (!fromHost(e)) return;
  store.panelOrder = { ...DEFAULT_ORDER };
  store.splits = { ...DEFAULT_SPLITS };
  saveStore();
  sendUI('layout:reset', { order: store.panelOrder, splits: store.splits });
});

ipcMain.on('split:toggle', (e) => {
  if (!fromHost(e)) return;
  if (splitMode) mergeWindows(); else splitWindows();
});

ipcMain.on('settings:open', (e) => { if (fromHost(e)) openSettings(); });
ipcMain.handle('settings:get', () => store.settings);
ipcMain.on('settings:set', (e, s) => {
  if (!fromHost(e)) return;
  const oldLang = store.settings.lang;
  store.settings = cleanSettings({ ...store.settings, ...(s || {}) });
  saveStore();
  applyPlayerSettings();
  if (store.settings.lang !== oldLang) applyLanguage();
});

ipcMain.on('layout:bounds', (e, bounds) => {
  if (!win || e.sender !== win.webContents || !bounds) return;
  const clean = {};
  for (const role of ['browser', 'video', 'comments']) {
    const b = bounds[role];
    if (!b) continue;
    clean[role] = {
      x: Math.max(0, Math.round(b.x) || 0),
      y: Math.max(0, Math.round(b.y) || 0),
      width: Math.max(0, Math.round(b.width) || 0),
      height: Math.max(0, Math.round(b.height) || 0),
    };
  }
  slotBounds = clean;
  layoutViews();
});

ipcMain.on('layout:splits', (e, s) => {
  if (!fromHost(e) || !s) return;
  const clamp = (v, d) => (Number.isFinite(v) ? Math.min(85, Math.max(15, v)) : d);
  store.splits = {
    col: clamp(s.col, DEFAULT_SPLITS.col),
    left: clamp(s.left, DEFAULT_SPLITS.left),
    right: clamp(s.right, DEFAULT_SPLITS.right),
  };
  saveStore();
});

ipcMain.on('auth:login', (e) => { if (fromHost(e)) openLogin(); });
ipcMain.on('auth:logout', (e) => { if (fromHost(e)) logout(); });
ipcMain.on('auth:importCookies', (e) => {
  if (!fromHost(e)) return;
  const parent = BrowserWindow.fromWebContents(e.sender);
  if (welcomeWin && parent === welcomeWin) {
    store.firstRunDone = true;
    saveStore();
    welcomeWin.close();
    importCookies(win);
  } else {
    importCookies(parent);
  }
});

ipcMain.on('later:play', (e, id) => {
  if (!fromHost(e)) return;
  const i = store.watchLater.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [item] = store.watchLater.splice(i, 1);
  saveStore();
  sendLater();
  play({ id: item.id, type: item.type, t: null, list: null });
});

ipcMain.on('later:remove', (e, id) => {
  if (!fromHost(e)) return;
  store.watchLater = store.watchLater.filter((x) => x.id !== id);
  saveStore();
  sendLater();
});

ipcMain.on('later:clear', (e) => {
  if (!fromHost(e)) return;
  store.watchLater = [];
  saveStore();
  sendLater();
});

ipcMain.on('later:addCurrent', (e) => {
  if (!fromHost(e) || !current) return;
  addLater(current, current.title);
});

ipcMain.on('browser:nav', (e, cmd) => {
  if (!fromHost(e) || !views.browser) return;
  const wc = views.browser.webContents;
  const h = wc.navigationHistory;
  if (cmd === 'back' && h.canGoBack()) h.goBack();
  else if (cmd === 'forward' && h.canGoForward()) h.goForward();
  else if (cmd === 'reload') wc.reload();
  else if (cmd === 'home') wc.loadURL(HOME_URL);
});

ipcMain.on('comments:tab', (e, tab) => { if (fromHost(e)) setCommentsTab(tab); });

ipcMain.on('welcome:choice', (e, choice) => {
  if (!fromHost(e)) return;
  store.firstRunDone = true;
  saveStore();
  if (welcomeWin && !welcomeWin.isDestroyed()) welcomeWin.close();
  if (choice === 'login') openLogin();
});

// ---------------------------------------------------------------- Start
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    if (process.platform === 'win32') app.setAppUserModelId(APP_ID);
    Menu.setApplicationMenu(null);
    loadStore();

    const ses = ytSession();
    ses.setUserAgent(chromeUserAgent());
    // Im Kommentar-Panel keine Videodaten laden (spart Bandbreite)
    ses.webRequest.onBeforeRequest({ urls: ['*://*.googlevideo.com/*'] }, (details, cb) => {
      const block = !!views.comments && details.webContentsId === views.comments.webContents.id;
      cb({ cancel: block });
    });
    let authTimer = null;
    ses.cookies.on('changed', () => {
      clearTimeout(authTimer);
      authTimer = setTimeout(refreshAuth, 600);
    });
    loggedIn = await checkLoggedIn();
    await setTheaterCookie();

    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { clearTimeout(saveTimer); writeStore(); });
}
