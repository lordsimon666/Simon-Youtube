'use strict';
/* global api, I18N */
document.getElementById('login').addEventListener('click', () => api.welcomeChoice('login'));
document.getElementById('cookies').addEventListener('click', () => api.importCookies());
document.getElementById('guest').addEventListener('click', () => api.welcomeChoice('guest'));

function setLang(lang) {
  I18N.apply(lang);
  for (const b of document.querySelectorAll('.lang-btn')) b.classList.toggle('active', b.dataset.lang === lang);
}
for (const b of document.querySelectorAll('.lang-btn')) {
  b.addEventListener('click', () => api.setSettings({ lang: b.dataset.lang }));
}
api.on('lang', setLang);
api.getSettings().then((s) => setLang(s.lang));
