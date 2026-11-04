'use strict';
/* global api */
const $ = (id) => document.getElementById(id);
const radios = [...document.querySelectorAll('input[name="volumeMode"]')];
const strength = $('volumeStrength');
const quality = $('quality');

// Regler des Profi-Auto-Levels
const AGC = [
  { key: 'target', label: 'Zielpegel', unit: 'dBFS', min: -36, max: -6, step: 0.5, help: 'Wie laut es im Schnitt sein soll' },
  { key: 'maxCut', label: 'Max. Absenkung', unit: 'dB', min: 0, max: 40, step: 0.5, help: 'Laute Stellen höchstens so viel leiser' },
  { key: 'maxBoost', label: 'Max. Verstärkung', unit: 'dB', min: 0, max: 40, step: 0.5, help: 'Leise Stellen höchstens so viel lauter' },
  { key: 'attack', label: 'Attack (Absenken)', unit: 'ms', min: 10, max: 5000, step: 10, help: 'Wie schnell bei zu laut abgesenkt wird' },
  { key: 'release', label: 'Release (Anheben)', unit: 'ms', min: 50, max: 20000, step: 50, help: 'Wie schnell bei zu leise angehoben wird' },
  { key: 'window', label: 'Messfenster', unit: 'ms', min: 50, max: 5000, step: 50, help: 'Über welchen Zeitraum gemittelt wird' },
  { key: 'gate', label: 'Gate', unit: 'dBFS', min: -80, max: -20, step: 1, help: 'Leiser als das (Pausen/Rauschen) wird nicht hochgezogen' },
  { key: 'makeup', label: 'Make-up-Gain', unit: 'dB', min: -12, max: 12, step: 0.5, help: 'Feste Verstärkung nach der Regelung' },
  { key: 'ceiling', label: 'Limiter-Grenze', unit: 'dBFS', min: -12, max: 0, step: 0.5, help: 'Höchster Ausgangspegel' },
];

const PRESETS = {
  standard: { target: -18, maxCut: 12, maxBoost: 12, attack: 300, release: 2500, window: 400, gate: -50, makeup: 0, ceiling: -1, limiter: true },
  speech: { target: -16, maxCut: 15, maxBoost: 15, attack: 150, release: 1500, window: 300, gate: -45, makeup: 0, ceiling: -1, limiter: true },
  music: { target: -16, maxCut: 6, maxBoost: 6, attack: 800, release: 5000, window: 1500, gate: -55, makeup: 0, ceiling: -1, limiter: true },
  night: { target: -22, maxCut: 25, maxBoost: 18, attack: 50, release: 1000, window: 200, gate: -45, makeup: 0, ceiling: -3, limiter: true },
  broadcast: { target: -23, maxCut: 20, maxBoost: 15, attack: 400, release: 3000, window: 3000, gate: -60, makeup: 0, ceiling: -1, limiter: true },
};

const inputs = {};
const outputs = {};
const fmt = (d, v) => (d.unit === 'ms' ? (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 2 : 1) + ' s' : v + ' ms')
  : (v > 0 && d.unit === 'dB' && d.key === 'makeup' ? '+' : '') + Number(v).toFixed(d.step < 1 ? 1 : 0) + ' ' + d.unit);

const grid = $('agc-controls');
for (const d of AGC) {
  const row = document.createElement('div');
  row.className = 'agc-row';
  row.title = d.help;
  const label = document.createElement('label');
  label.textContent = d.label;
  label.htmlFor = 'agc-' + d.key;
  const input = document.createElement('input');
  input.type = 'range';
  input.id = 'agc-' + d.key;
  input.min = d.min; input.max = d.max; input.step = d.step;
  const out = document.createElement('output');
  const help = document.createElement('small');
  help.textContent = d.help;
  row.append(label, input, out, help);
  grid.append(row);
  inputs[d.key] = input;
  outputs[d.key] = out;
}

function readAgc() {
  const a = { limiter: $('agc-limiter').checked };
  for (const d of AGC) a[d.key] = Number(inputs[d.key].value);
  return a;
}

function writeAgc(a) {
  for (const d of AGC) inputs[d.key].value = String(a[d.key]);
  $('agc-limiter').checked = !!a.limiter;
}

function matchPreset(a) {
  for (const [name, p] of Object.entries(PRESETS)) {
    if (Object.keys(p).every((k) => p[k] === a[k])) return name;
  }
  return '';
}

function mode() { return (radios.find((r) => r.checked) || {}).value || 'auto'; }

function updateUi() {
  const m = mode();
  strength.disabled = m !== 'custom';
  $('strength-row').classList.toggle('disabled', m !== 'custom');
  $('strength-out').textContent = strength.value + ' %';
  $('agc-box').classList.toggle('disabled', m !== 'agc');
  const a = readAgc();
  for (const d of AGC) outputs[d.key].textContent = fmt(d, a[d.key]);
  inputs.ceiling.disabled = !a.limiter;
  $('agc-preset').value = matchPreset(a);
}

function save() {
  updateUi();
  api.setSettings({
    volumeMode: mode(),
    volumeStrength: Number(strength.value),
    quality: quality.value,
    agc: readAgc(),
  });
}

$('agc-preset').addEventListener('change', (e) => {
  const p = PRESETS[e.target.value];
  if (!p) return;
  writeAgc(p);
  if (mode() !== 'agc') radios.find((r) => r.value === 'agc').checked = true;
  save();
});
$('agc-reset').addEventListener('click', () => { writeAgc(PRESETS.standard); save(); });
$('import-cookies').addEventListener('click', () => api.importCookies());

// ---------------------------------------------------------------- Live-Anzeige
const pct = (db, min, max) => Math.max(0, Math.min(100, ((db - min) / (max - min)) * 100));
function setBar(id, db) { $(id).style.width = pct(db, -60, 0) + '%'; }

api.on('agc:stats', (s) => {
  const box = $('meters');
  box.classList.toggle('idle', !s || !s.active);
  if (!s || !s.active) {
    $('m-state').textContent = mode() === 'agc' ? 'Warte auf Video im Video-Panel …' : 'Profi Auto-Level ist aus';
    for (const id of ['m-in', 'm-out', 'm-lim']) $(id).style.width = '0';
    $('m-gain').style.cssText = 'left:50%;width:0';
    for (const id of ['v-in', 'v-gain', 'v-out', 'v-lim']) $(id).textContent = '–';
    return;
  }
  const a = readAgc();
  setBar('m-in', s.inDb);
  setBar('m-out', s.outDb);
  $('m-target').style.left = pct(a.target, -60, 0) + '%';
  const g = Math.max(-40, Math.min(40, s.gainDb));
  const w = Math.abs(g) / 80 * 100;
  $('m-gain').style.cssText = g >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
  $('m-gain').className = g >= 0 ? 'boost' : 'cut';
  $('m-lim').style.width = Math.min(100, (-s.limiterDb) / 20 * 100) + '%';
  $('v-in').textContent = s.inDb < -99 ? '–' : s.inDb.toFixed(1) + ' dB';
  $('v-out').textContent = s.outDb < -99 ? '–' : s.outDb.toFixed(1) + ' dB';
  $('v-gain').textContent = (s.gainDb >= 0 ? '+' : '') + s.gainDb.toFixed(1) + ' dB';
  $('v-lim').textContent = s.limiterDb < -0.05 ? s.limiterDb.toFixed(1) + ' dB' : '0 dB';
  $('m-state').textContent = s.paused ? 'Pausiert' : s.gated ? 'Gate: zu leise – Verstärkung wird gehalten' : 'Regelt …';
});

api.getSettings().then((s) => {
  for (const r of radios) r.checked = r.value === s.volumeMode;
  strength.value = String(s.volumeStrength);
  quality.value = s.quality;
  writeAgc(s.agc);
  updateUi();
  for (const r of radios) r.addEventListener('change', save);
  strength.addEventListener('input', save);
  quality.addEventListener('change', save);
  for (const i of Object.values(inputs)) i.addEventListener('input', save);
  $('agc-limiter').addEventListener('change', save);
});
