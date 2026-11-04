'use strict';
/* global api, I18N */
let lang = 'de';
const L = (key, vars) => I18N.t(lang, key, vars);
const last = { auth: { loggedIn: false }, split: false, now: null, items: [] };

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

// ---------------------------------------------------------------- Panels verschieben (Drag & Drop)
const DEFAULT_ORDER = { tl: 'panel-video', bl: 'panel-browser', tr: 'panel-comments', br: 'panel-later' };
let dragId = null;

function applyOrder(order) {
  const o = { ...DEFAULT_ORDER, ...(order || {}) };
  const ids = Object.values(o);
  if (new Set(ids).size !== 4 || !ids.every((id) => document.getElementById(id))) return;
  for (const [pos, id] of Object.entries(o)) {
    document.querySelector(`.pos[data-pos="${pos}"]`).append(document.getElementById(id));
  }
  queueLayout();
}

function currentOrder() {
  const o = {};
  for (const p of document.querySelectorAll('.pos')) o[p.dataset.pos] = p.querySelector('.panel').id;
  return o;
}

for (const grip of document.querySelectorAll('.grip')) {
  grip.addEventListener('dragstart', (e) => {
    const panel = grip.closest('.panel');
    dragId = panel.id;
    e.dataTransfer.setData('text/plain', dragId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(panel.querySelector('.panel-head'), 20, 18);
    panel.classList.add('drag-source');
    document.body.classList.add('dragging-panel');
    api.setDragging(true);
  });
  grip.addEventListener('dragend', () => {
    dragId = null;
    document.body.classList.remove('dragging-panel');
    for (const el of document.querySelectorAll('.drag-source, .drop-target')) el.classList.remove('drag-source', 'drop-target');
    api.setDragging(false);
    queueLayout();
  });
}

for (const pos of document.querySelectorAll('.pos')) {
  pos.addEventListener('dragover', (e) => {
    if (!dragId || pos.querySelector('.panel').id === dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    pos.classList.add('drop-target');
  });
  pos.addEventListener('dragleave', (e) => {
    if (!pos.contains(e.relatedTarget)) pos.classList.remove('drop-target');
  });
  pos.addEventListener('drop', (e) => {
    e.preventDefault();
    pos.classList.remove('drop-target');
    const src = document.getElementById(dragId);
    if (!src) return;
    const srcPos = src.parentElement;
    const dst = pos.querySelector('.panel');
    if (dst === src) return;
    srcPos.append(dst);
    pos.append(src);
    api.savePanelOrder(currentOrder());
    queueLayout();
  });
}

// ---------------------------------------------------------------- Adressleiste
const addrForm = $('#address');
const addrInput = $('#address-input');
const looksLikeVideo = (s) => /(youtu\.be\/|youtube(-nocookie)?\.com\/(watch|shorts\/|live\/|embed\/))/i.test(s);

async function openAddress(mode) {
  const text = addrInput.value.trim();
  if (!text) return;
  const res = await api.openAddress(text, mode);
  if (res && res.ok) {
    addrInput.value = '';
    addrInput.blur();
  } else {
    addrForm.classList.remove('error');
    void addrForm.offsetWidth;
    addrForm.classList.add('error');
  }
}

addrForm.addEventListener('submit', (e) => { e.preventDefault(); openAddress('play'); });
$('#addr-later').addEventListener('click', () => openAddress('later'));
addrInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); openAddress('later'); }
  if (e.key === 'Escape') { addrInput.value = ''; addrInput.blur(); }
});
addrInput.addEventListener('input', () => addrForm.classList.remove('error'));
// Video-Link einfügen (z. B. aus Discord kopiert) -> sofort abspielen
addrInput.addEventListener('paste', () => {
  setTimeout(() => { if (looksLikeVideo(addrInput.value)) openAddress('play'); }, 0);
});
function focusAddress() { addrInput.focus(); addrInput.select(); }
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); focusAddress(); }
});
$('#btn-copy-link').addEventListener('click', () => api.copyCurrentLink());

// ---------------------------------------------------------------- Anmeldung
function setAuth({ loggedIn }) {
  last.auth = { loggedIn };
  $('#btn-login').hidden = loggedIn;
  $('#btn-logout').hidden = !loggedIn;
  const s = $('#auth-status');
  s.textContent = loggedIn ? L('auth.in') : L('auth.out');
  s.classList.toggle('on', loggedIn);
}

$('#btn-login').addEventListener('click', () => api.login());
$('#btn-logout').addEventListener('click', () => {
  if (confirm(L('auth.logout.confirm'))) api.logout();
});

// ---------------------------------------------------------------- 4 Fenster / Einstellungen
function setSplit(on) {
  last.split = !!on;
  document.body.classList.toggle('split', !!on);
  const b = $('#btn-split');
  b.querySelector('.ico').textContent = on ? '\u229F' : '\u229E';
  b.querySelector('.lbl').textContent = on ? L('top.merge') : L('top.split');
  b.title = on ? L('top.merge.title') : L('top.split.title');
  queueLayout();
}
$('#btn-split').addEventListener('click', () => api.toggleSplit());
$('#btn-settings').addEventListener('click', () => api.openSettings());

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
  last.now = info;
  const el = $('#now-title');
  if (!info) {
    el.textContent = '';
    $('#btn-later-current').hidden = true;
    $('#btn-copy-link').hidden = true;
    return;
  }
  const prefix = info.type === 'short' ? 'Short · ' : '';
  el.textContent = prefix + (info.title || L('now.loading')) + (info.channel ? ' — ' + info.channel : '');
  el.title = el.textContent;
  $('#btn-later-current').hidden = false;
  $('#btn-copy-link').hidden = false;
}
$('#btn-later-current').addEventListener('click', () => api.addCurrentToLater());

// ---------------------------------------------------------------- Später ansehen
const list = $('#later-list');

function renderLater(items) {
  last.items = items;
  list.textContent = '';
  $('#later-count').textContent = String(items.length);
  $('#btn-clear-later').hidden = items.length === 0;

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'later-empty';
    empty.textContent = L('later.empty');
    list.append(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'later-item' + (item.type === 'short' ? ' short' : '');
    row.title = L('later.play.title');

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
    remove.title = L('later.remove');
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
  if (confirm(L('later.clear.confirm'))) api.clearLater();
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
function setLang(l) {
  lang = l;
  I18N.apply(lang);
  for (const p of document.querySelectorAll('.panel')) p.dataset.drop = L('drag.drop');
  setAuth(last.auth);
  setSplit(last.split);
  setNow(last.now);
  renderLater(last.items);
}

api.on('lang', setLang);
api.on('address:focus', focusAddress);
api.on('layout:reset', ({ order, splits: sp }) => {
  splits = { ...splits, ...sp };
  applySplits();
  applyOrder(order);
});
api.on('later:list', renderLater);
api.on('auth:state', setAuth);
api.on('now-playing', setNow);
api.on('toast', showToast);
api.on('split:state', setSplit);
api.on('comments-tab', setTab);

api.getState().then((s) => {
  lang = s.lang || 'de';
  I18N.apply(lang);
  for (const p of document.querySelectorAll('.panel')) p.dataset.drop = L('drag.drop');
  applyOrder(s.panelOrder);
  splits = { ...splits, ...(s.splits || {}) };
  applySplits();
  renderLater(s.watchLater || []);
  setAuth({ loggedIn: !!s.loggedIn });
  setTab(s.commentsTab || 'comments');
  setNow(s.nowPlaying);
  setSplit(s.splitMode);
  sendLayout();
});
