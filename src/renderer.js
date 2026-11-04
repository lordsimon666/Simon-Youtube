'use strict';
/* global api */

const $ = (sel) => document.querySelector(sel);
const root = document.documentElement;

// ---------------------------------------------------------------- Panel-Positionen an Hauptprozess senden
const slots = [...document.querySelectorAll('.slot')];
let layoutQueued = false;

function sendLayout() {
  layoutQueued = false;
  const bounds = {};
  for (const slot of slots) {
    const r = slot.getBoundingClientRect();
    bounds[slot.dataset.view] = { x: r.left, y: r.top, width: r.width, height: r.height };
  }
  api.setBounds(bounds);
}

function queueLayout() {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(sendLayout);
}

const ro = new ResizeObserver(queueLayout);
slots.forEach((s) => ro.observe(s));
window.addEventListener('resize', queueLayout);

// ---------------------------------------------------------------- Größe der Panels ändern
let splits = { col: 64, left: 60, right: 60 };

function applySplits() {
  root.style.setProperty('--col', splits.col);
  root.style.setProperty('--left', splits.left);
  root.style.setProperty('--right', splits.right);
  queueLayout();
}

for (const gutter of document.querySelectorAll('.gutter')) {
  const key = gutter.dataset.split;
  const horizontal = key === 'col';
  gutter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    gutter.setPointerCapture(e.pointerId);
    gutter.classList.add('dragging');
    const container = gutter.parentElement.getBoundingClientRect();
    const move = (ev) => {
      const ratio = horizontal
        ? (ev.clientX - container.left) / container.width
        : (ev.clientY - container.top) / container.height;
      splits[key] = Math.min(85, Math.max(15, ratio * 100));
      applySplits();
    };
    const up = () => {
      gutter.classList.remove('dragging');
      gutter.removeEventListener('pointermove', move);
      gutter.removeEventListener('pointerup', up);
      gutter.removeEventListener('pointercancel', up);
      api.saveSplits(splits);
    };
    gutter.addEventListener('pointermove', move);
    gutter.addEventListener('pointerup', up);
    gutter.addEventListener('pointercancel', up);
  });
  gutter.addEventListener('dblclick', () => {
    splits[key] = { col: 64, left: 60, right: 60 }[key];
    applySplits();
    api.saveSplits(splits);
  });
}

// ---------------------------------------------------------------- Anmeldung
function setAuth({ loggedIn }) {
  $('#btn-login').hidden = loggedIn;
  $('#btn-logout').hidden = !loggedIn;
  const s = $('#auth-status');
  s.textContent = loggedIn ? 'Angemeldet' : 'Nicht angemeldet';
  s.classList.toggle('on', loggedIn);
}

$('#btn-login').addEventListener('click', () => api.login());
$('#btn-logout').addEventListener('click', () => {
  if (confirm('Wirklich abmelden? Cookies und Anmeldedaten werden gelöscht.')) api.logout();
});

// ---------------------------------------------------------------- Browser-Navigation
for (const b of document.querySelectorAll('[data-nav]')) {
  b.addEventListener('click', () => api.browserNav(b.dataset.nav));
}

// ---------------------------------------------------------------- Kommentare / Vorschläge
function setTab(tab) {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === tab);
}
for (const t of document.querySelectorAll('.tab')) {
  t.addEventListener('click', () => {
    setTab(t.dataset.tab);
    api.setCommentsTab(t.dataset.tab);
  });
}

// ---------------------------------------------------------------- Aktuelles Video
function setNow(info) {
  const el = $('#now-title');
  if (!info) {
    el.textContent = '';
    $('#btn-later-current').hidden = true;
    return;
  }
  const prefix = info.type === 'short' ? 'Short · ' : '';
  el.textContent = prefix + (info.title || 'Lädt …') + (info.channel ? ' — ' + info.channel : '');
  el.title = el.textContent;
  $('#btn-later-current').hidden = false;
}
$('#btn-later-current').addEventListener('click', () => api.addCurrentToLater());

// ---------------------------------------------------------------- Später ansehen
const list = $('#later-list');

function renderLater(items) {
  list.textContent = '';
  $('#later-count').textContent = String(items.length);
  $('#btn-clear-later').hidden = items.length === 0;

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'later-empty';
    empty.textContent = 'Noch nichts hier. Klicke im Browser mit der mittleren Maustaste auf ein Video, um es für später zu merken.';
    list.append(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'later-item' + (item.type === 'short' ? ' short' : '');
    row.title = 'Klicken zum Abspielen';

    const thumb = document.createElement('div');
    thumb.className = 'later-thumb';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = `https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/mqdefault.jpg`;
    thumb.append(img);
    if (item.type === 'short') {
      const tag = document.createElement('span');
      tag.className = 'later-type';
      tag.textContent = 'SHORT';
      thumb.append(tag);
    }

    const meta = document.createElement('div');
    meta.className = 'later-meta';
    const title = document.createElement('div');
    title.className = 'later-title';
    title.textContent = item.title || item.id;
    const channel = document.createElement('div');
    channel.className = 'later-channel';
    channel.textContent = item.channel || '';
    meta.append(title, channel);

    const remove = document.createElement('button');
    remove.className = 'later-remove';
    remove.title = 'Entfernen';
    remove.textContent = '✕';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      api.removeLater(item.id);
    });

    row.append(thumb, meta, remove);
    row.addEventListener('click', () => api.playLater(item.id));
    list.append(row);
  }
}

$('#btn-clear-later').addEventListener('click', () => {
  if (confirm('Alle Videos aus „Später ansehen“ entfernen?')) api.clearLater();
});

// ---------------------------------------------------------------- Toast
const toastEl = $('#toast');
let toastTimer = null;
function showToast(msg) {
  // Toast im "Später ansehen"-Panel anzeigen (dort liegt keine Webansicht darüber)
  const panel = $('#panel-later').getBoundingClientRect();
  toastEl.classList.add('in-later');
  toastEl.style.bottom = (window.innerHeight - panel.bottom + 14) + 'px';
  toastEl.style.right = (window.innerWidth - panel.right + 14) + 'px';
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------- Start
api.on('later:list', renderLater);
api.on('auth:state', setAuth);
api.on('now-playing', setNow);
api.on('toast', showToast);

api.getState().then((s) => {
  splits = { ...splits, ...(s.splits || {}) };
  applySplits();
  renderLater(s.watchLater || []);
  setAuth({ loggedIn: !!s.loggedIn });
  setTab(s.commentsTab || 'comments');
  setNow(s.nowPlaying);
  sendLayout();
});
