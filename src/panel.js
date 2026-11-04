'use strict';
/* global api, I18N, renderLaterList */
let lang = 'de';
let lastNow = null;
// Kopfzeile der einzelnen Fenster im 4-Fenster-Modus
const role = new URLSearchParams(location.search).get('role');
const head = document.querySelector(`.panel-head[data-role="${role}"]`);
if (head) head.hidden = false;
document.body.classList.add('role-' + role);
const L = (key, vars) => I18N.t(lang, key, vars);

// ---------------------------------------------------------------- "Später ansehen" als eigenes Fenster
let lastItems = [];
const list = document.getElementById('later-list');
function renderLater(items) {
  lastItems = items;
  if (role !== 'later') return;
  document.getElementById('later-count').textContent = String(items.length);
  document.getElementById('btn-clear-later').hidden = items.length === 0;
  renderLaterList(list, items, L);
}
if (role === 'later') {
  list.hidden = false;
  document.getElementById('btn-clear-later').addEventListener('click', () => {
    if (confirm(L('later.clear.confirm'))) api.clearLater();
  });
  const toastEl = document.getElementById('toast');
  let toastTimer = null;
  api.on('toast', (msg) => {
    toastEl.textContent = msg;
    toastEl.style.right = '14px';
    toastEl.style.bottom = '14px';
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  });
}
api.on('later:list', renderLater);

for (const b of document.querySelectorAll('[data-nav]')) {
  b.addEventListener('click', () => api.browserNav(b.dataset.nav));
}

function setTab(tab) {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === tab);
}
for (const t of document.querySelectorAll('.tab')) {
  t.addEventListener('click', () => {
    setTab(t.dataset.tab);
    api.setCommentsTab(t.dataset.tab);
  });
}

function setNow(info) {
  lastNow = info;
  const el = document.getElementById('now-title');
  const btn = document.getElementById('btn-later-current');
  if (!info) { el.textContent = ''; btn.hidden = true; document.getElementById('btn-copy-link').hidden = true; return; }
  el.textContent = (info.type === 'short' ? 'Short · ' : '') + (info.title || I18N.t(lang, 'now.loading')) +
    (info.channel ? ' — ' + info.channel : '');
  el.title = el.textContent;
  btn.hidden = false;
  document.getElementById('btn-copy-link').hidden = false;
  if (role === 'video') document.title = (info.title || 'Video') + ' – Simon YouTube';
}
document.getElementById('btn-later-current').addEventListener('click', () => api.addCurrentToLater());
document.getElementById('btn-copy-link').addEventListener('click', () => api.copyCurrentLink());

api.on('now-playing', setNow);
api.on('lang', (l) => { lang = l; I18N.apply(lang); setNow(lastNow); renderLater(lastItems); });
api.on('comments-tab', setTab);
api.getState().then((s) => {
  lang = s.lang || 'de';
  I18N.apply(lang);
  setTab(s.commentsTab || 'comments');
  setNow(s.nowPlaying);
  renderLater(s.watchLater || []);
});
