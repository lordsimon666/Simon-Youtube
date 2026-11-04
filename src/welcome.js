'use strict';
/* global api */
document.getElementById('login').addEventListener('click', () => api.welcomeChoice('login'));
document.getElementById('guest').addEventListener('click', () => api.welcomeChoice('guest'));
