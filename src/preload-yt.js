'use strict';
// Preload für die drei YouTube-Panels (Browser, Video, Kommentare).
// Fängt Klicks auf Video-Links ab:
//   - Linksklick  -> Video im Video-Panel abspielen
//   - Mittelklick -> zu "Später ansehen" hinzufügen
const { ipcRenderer } = require('electron');

let role = '';
try { role = ipcRenderer.sendSync('yt:role') || ''; } catch { role = ''; }

const ID_RE = /^[\w-]{11}$/;

function toUrl(href) {
  try { return new URL(href, location.href); } catch { return null; }
}

function isYoutube(href) {
  const u = toUrl(href);
  return !!u && /^https?:$/.test(u.protocol) && /(^|\.)youtube\.com$/.test(u.hostname);
}

function isVideoUrl(href) {
  const u = toUrl(href);
  if (!u || !/^https?:$/.test(u.protocol)) return false;
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  if (host === 'youtu.be') return ID_RE.test(u.pathname.slice(1).split('/')[0]);
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return false;
  if (u.pathname === '/watch') return ID_RE.test(u.searchParams.get('v') || '');
  const m = u.pathname.match(/^\/(shorts|live|embed|v)\/([\w-]{11})/);
  return !!m;
}

function findAnchor(e) {
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  for (const el of path) {
    if (el && el.tagName === 'A' && typeof el.href === 'string' && el.href) return el;
  }
  return null;
}

function guessTitle(a) {
  const own = (a.getAttribute('title') || '').trim();
  if (own) return own.slice(0, 200);
  const host = a.closest(
    'ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer,' +
    'ytd-reel-item-renderer, ytm-shorts-lockup-view-model, yt-lockup-view-model, ytd-playlist-video-renderer,' +
    'ytd-playlist-panel-video-renderer'
  );
  const t = host && host.querySelector('#video-title, h3, [class*="title"]');
  return ((t && t.textContent) || a.getAttribute('aria-label') || '').trim().slice(0, 200);
}

function stop(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
}

if (role) {
  // Linksklick
  window.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    const a = findAnchor(e);
    if (!a) return;
    const href = a.href;
    const video = isVideoUrl(href);

    // Strg/Shift-Klick auf ein Video = auch "Später ansehen"
    if (video && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      stop(e);
      ipcRenderer.send('yt:later', href, guessTitle(a));
      return;
    }

    if (role === 'video') {
      // Im Video-Panel dürfen Videos (Endscreen, Autoplay, Shorts) selbst weiterlaufen.
      // Kanal-/andere Seiten werden im Browser-Panel geöffnet.
      if (!video && isYoutube(href)) {
        stop(e);
        ipcRenderer.send('yt:browse', href);
      }
      return;
    }

    if (video) {
      stop(e);
      ipcRenderer.send('yt:play', href);
      return;
    }

    if (role === 'comments' && isYoutube(href)) {
      stop(e);
      ipcRenderer.send('yt:browse', href);
    }
  }, true);

  // Mittelklick: Autoscroll verhindern ...
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 1) return;
    const a = findAnchor(e);
    if (a && isVideoUrl(a.href)) e.preventDefault();
  }, true);

  // ... und Video zu "Später ansehen" hinzufügen
  window.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    const a = findAnchor(e);
    if (!a) return;
    if (isVideoUrl(a.href)) {
      stop(e);
      ipcRenderer.send('yt:later', a.href, guessTitle(a));
    } else if (isYoutube(a.href)) {
      stop(e);
      ipcRenderer.send('yt:browse', a.href);
    }
  }, true);
}

if (role === 'video') {
  // Seitentyp markieren, damit das eingefügte CSS weiß, ob Video oder Short angezeigt wird.
  let last = '';
  const mark = () => {
    const root = document.documentElement;
    if (!root) return;
    const p = location.pathname;
    const page = p === '/watch' ? 'watch' : p.startsWith('/shorts') ? 'shorts' : 'other';
    if (page !== last) {
      last = page;
      root.dataset.ytpPage = page;
      // Player neu vermessen lassen
      for (const ms of [50, 300, 1000, 2500]) {
        setTimeout(() => window.dispatchEvent(new Event('resize')), ms);
      }
    } else if (root.dataset.ytpPage !== page) {
      root.dataset.ytpPage = page;
    }
  };
  // Kinomodus einschalten (YouTube merkt sich das im Cookie "wide=1")
  let theaterTries = 0;
  const ensureTheater = () => {
    if (location.pathname !== '/watch') { theaterTries = 0; return; }
    const flexy = document.querySelector('ytd-watch-flexy');
    if (!flexy || flexy.hasAttribute('theater') || flexy.hasAttribute('full-bleed-player')) return;
    if (theaterTries > 5) return;
    const btn = document.querySelector('#movie_player .ytp-size-button');
    if (btn) { theaterTries++; btn.click(); }
  };
  document.addEventListener('DOMContentLoaded', mark);
  document.addEventListener('yt-navigate-finish', () => { theaterTries = 0; mark(); });
  setInterval(() => { mark(); ensureTheater(); }, 500);
}

if (role === 'comments') {
  // Im Kommentar-Panel darf das Video nie laufen.
  setInterval(() => {
    for (const v of document.querySelectorAll('video')) {
      v.muted = true;
      if (!v.paused) v.pause();
    }
  }, 400);
}
