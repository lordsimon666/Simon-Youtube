'use strict';
/* global api */
document.getElementById('login').addEventListener('click', () => api.welcomeChoice('login'));
document.getElementById('cookies').addEventListener('click', () => api.importCookies());
document.getElementById('guest').addEventListener('click', () => api.welcomeChoice('guest'));
