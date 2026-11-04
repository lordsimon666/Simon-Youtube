'use strict';
/* global api, I18N */
let lang = 'de';
let lastNow = null;
// Kopfzeile der einzelnen Fenster im 4-Fenster-Modus
const role = new URLSearchParams(location.search).get('role');
const head = document.querySelector(`.panel-head[data-role="${role}"]`);
if (head) head.hidden = false;

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
api.on('lang', (l) => { lang = l; I18N.apply(lang); setNow(lastNow); });
api.on('comments-tab', setTab);
api.getState().then((s) => {
  lang = s.lang || 'de';
  I18N.apply(lang);
  setTab(s.commentsTab || 'comments');
  setNow(s.nowPlaying);
});
