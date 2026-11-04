'use strict';
/* global api */
const radios = [...document.querySelectorAll('input[name="volumeMode"]')];
const strength = document.getElementById('volumeStrength');
const out = document.getElementById('strength-out');
const row = document.getElementById('strength-row');
const quality = document.getElementById('quality');

function updateUi() {
  const mode = (radios.find((r) => r.checked) || {}).value;
  const custom = mode === 'custom';
  strength.disabled = !custom;
  row.classList.toggle('disabled', !custom);
  out.textContent = strength.value + ' %';
}

function save() {
  updateUi();
  api.setSettings({
    volumeMode: (radios.find((r) => r.checked) || {}).value || 'auto',
    volumeStrength: Number(strength.value),
    quality: quality.value,
  });
}

document.getElementById('import-cookies').addEventListener('click', () => api.importCookies());

api.getSettings().then((s) => {
  for (const r of radios) r.checked = r.value === s.volumeMode;
  strength.value = String(s.volumeStrength);
  quality.value = s.quality;
  updateUi();
  for (const r of radios) r.addEventListener('change', save);
  strength.addEventListener('input', save);
  quality.addEventListener('change', save);
});
