// Wird im Video-Panel in die YouTube-Seite eingefügt (main.js hängt "(cfg)" an).
// Funktionen:
//  1. YouTube-Lautstärke-Normalisierung: auto | off | custom (Stärke 0–100 %)
//  2. Profi-Auto-Level (AGC, Modus "agc"): misst den Pegel (K-gewichtet, RMS) und regelt die
//     Verstärkung auf einen Zielpegel – mit max. Absenkung/Verstärkung, Attack, Release,
//     Messfenster, Gate, Make-up-Gain und Limiter.
//  3. Videoqualität: auto oder fest.
(function (cfg) {
  'use strict';
  const S = window.__ytp || (window.__ytp = { last: new WeakMap(), graphs: new WeakMap() });
  if (!S.cfg || S.cfg.quality !== cfg.quality) S.appliedKey = null;
  S.cfg = cfg;

  const RANK = ['tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'highres'];
  const playerOf = (el) => (el && el.closest && el.closest('.html5-video-player')) || null;
  const dbToLin = (db) => Math.pow(10, db / 20);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const isAgc = () => S.cfg.volumeMode === 'agc';

  // -------------------------------------------------------------- Lautstärke-Regler abfangen
  if (!S.installed) {
    S.installed = true;
    const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    S.setRaw = (el, v) => d.set.call(el, v);

    // v = Lautstärke, die YouTube setzen will (Regler × Normalisierungsfaktor)
    S.compute = (el, v) => {
      const c = S.cfg;
      if (c.volumeMode === 'auto') return v;
      const p = playerOf(el);
      // AGC: Element voll aufdrehen, der Regler wird nach dem AGC als eigene Stufe angewendet
      if (c.volumeMode === 'agc' && S.graphs.has(el)) return 1;
      if (!p || typeof p.getVolume !== 'function') return v;
      const slider = clamp(p.getVolume() / 100, 0, 1);
      if (slider <= 0) return v;
      const factor = clamp(v / slider, 0.0001, 1);
      const strength = c.volumeMode === 'custom' ? clamp(c.volumeStrength, 0, 100) / 100 : 0;
      return clamp(slider * Math.pow(factor, strength), 0, 1);
    };

    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
      configurable: true,
      enumerable: d.enumerable,
      get() { return S.last.has(this) ? S.last.get(this) : d.get.call(this); },
      set(v) {
        S.last.set(this, v);
        d.set.call(this, S.compute(this, v));
      },
    });
  }

  // -------------------------------------------------------------- AGC (Web Audio)
  function getCtx() {
    if (!S.ctx) S.ctx = new AudioContext({ latencyHint: 'playback' });
    if (S.ctx.state === 'suspended') S.ctx.resume().catch(() => {});
    return S.ctx;
  }

  function buildGraph(el) {
    if (S.graphs.has(el)) return S.graphs.get(el);
    const ctx = getCtx();
    let source;
    try { source = ctx.createMediaElementSource(el); } catch (e) { return null; }

    // Signalweg: Quelle -> AGC-Gain -> Make-up -> Limiter -> Regler-Lautstärke -> Ausgang
    const agc = ctx.createGain();
    const makeup = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    const user = ctx.createGain();
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    source.connect(agc).connect(makeup).connect(limiter).connect(user).connect(ctx.destination);

    // Messweg (Sidechain): ungefähre K-Gewichtung wie bei LUFS-Messung
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 60; hp.Q.value = 0.5;
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf'; shelf.frequency.value = 1500; shelf.gain.value = 4;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(hp).connect(shelf).connect(analyser);

    // Ausgangsmessung (nach Limiter, vor Regler)
    const outAnalyser = ctx.createAnalyser();
    outAnalyser.fftSize = 2048;
    limiter.connect(outAnalyser);

    const g = {
      el, agc, makeup, limiter, user, analyser, outAnalyser,
      buf: new Float32Array(analyser.fftSize),
      outBuf: new Float32Array(outAnalyser.fftSize),
      ms: 0, gainDb: 0, inDb: -100, outDb: -100, peakDb: -100, gated: true,
    };
    S.graphs.set(el, g);
    S.lastGraph = g;
    // Element-Lautstärke neu setzen (jetzt voll, Regler wirkt im Graph)
    if (S.last.has(el)) S.setRaw(el, S.compute(el, S.last.get(el)));
    return g;
  }

  function rms(an, buf) {
    an.getFloatTimeDomainData(buf);
    let sum = 0; let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i];
      sum += x * x;
      const a = x < 0 ? -x : x;
      if (a > peak) peak = a;
    }
    return { ms: sum / buf.length, peak };
  }

  function updateGraph(g, dt) {
    const c = S.cfg;
    const a = c.agc;
    const ctx = S.ctx;
    const now = ctx.currentTime;
    const p = playerOf(g.el);

    // Regler-Lautstärke / Stumm nach dem AGC
    let userVol = 1;
    if (p && typeof p.getVolume === 'function') {
      userVol = clamp(p.getVolume() / 100, 0, 1);
      if (typeof p.isMuted === 'function' && p.isMuted()) userVol = 0;
    }
    if (g.el.muted) userVol = 0;

    if (!isAgc()) {
      // Neutral: alles durchlassen
      g.agc.gain.setTargetAtTime(1, now, 0.05);
      g.makeup.gain.setTargetAtTime(1, now, 0.05);
      g.limiter.threshold.value = 0;
      g.limiter.ratio.value = 1;
      g.user.gain.setTargetAtTime(1, now, 0.02);
      g.gainDb = 0;
      return;
    }

    g.user.gain.setTargetAtTime(userVol, now, 0.02);
    g.makeup.gain.setTargetAtTime(dbToLin(a.makeup), now, 0.05);
    if (a.limiter) {
      g.limiter.threshold.value = a.ceiling;
      g.limiter.ratio.value = 20;
    } else {
      g.limiter.threshold.value = 0;
      g.limiter.ratio.value = 1;
    }

    const playing = !g.el.paused && !g.el.ended && g.el.readyState > 2;
    const m = rms(g.analyser, g.buf);
    const o = rms(g.outAnalyser, g.outBuf);
    g.outDb = 10 * Math.log10(o.ms + 1e-12);
    g.peakDb = 20 * Math.log10(o.peak + 1e-9);
    if (!playing) return;

    // Gleitender RMS über das Messfenster
    const win = Math.max(0.05, a.window / 1000);
    g.ms += (m.ms - g.ms) * (1 - Math.exp(-dt / win));
    g.inDb = 10 * Math.log10(g.ms + 1e-12);

    // Gate: Leise Stellen (Pausen, Rauschen) nicht hochziehen – Verstärkung halten
    g.gated = g.inDb < a.gate;
    if (g.gated) return;

    const desired = clamp(a.target - g.inDb, -a.maxCut, a.maxBoost);
    const tau = (desired < g.gainDb ? a.attack : a.release) / 1000;
    g.gainDb += (desired - g.gainDb) * (1 - Math.exp(-dt / Math.max(0.001, tau)));
    g.agc.gain.setTargetAtTime(dbToLin(g.gainDb), now, 0.02);
  }

  S.agcStats = () => {
    const g = S.lastGraph;
    if (!g || !isAgc()) return { active: false };
    return {
      active: true,
      inDb: g.inDb,
      gainDb: g.gainDb,
      outDb: g.outDb,
      peakDb: g.peakDb,
      limiterDb: g.limiter.reduction || 0,
      gated: g.gated,
      paused: g.el.paused,
    };
  };

  // -------------------------------------------------------------- Qualität
  function applyQuality() {
    const q = S.cfg.quality;
    for (const p of document.querySelectorAll('.html5-video-player')) {
      if (typeof p.getAvailableQualityLevels !== 'function') continue;
      try {
        if (q && q !== 'auto') {
          const avail = p.getAvailableQualityLevels().filter((x) => x !== 'auto');
          if (!avail.length) continue;
          const target = RANK.indexOf(q);
          const pick = avail.find((x) => RANK.indexOf(x) <= target) || avail[avail.length - 1];
          const data = typeof p.getVideoData === 'function' ? p.getVideoData() : {};
          const key = (p.id || '') + ':' + ((data && data.video_id) || '') + ':' + pick;
          if (S.appliedKey !== key || (S.recheck && S.recheck-- > 0 && p.getPlaybackQuality() !== pick)) {
            if (S.appliedKey !== key) S.recheck = 3;
            S.appliedKey = key;
            if (typeof p.setPlaybackQualityRange === 'function') p.setPlaybackQualityRange(pick, pick);
            if (typeof p.setPlaybackQuality === 'function') p.setPlaybackQuality(pick);
          }
          S.forced = true;
        } else if (S.forced) {
          if (typeof p.setPlaybackQualityRange === 'function') p.setPlaybackQualityRange('auto', 'auto');
          if (typeof p.setPlaybackQuality === 'function') p.setPlaybackQuality('auto');
        }
      } catch (e) { /* Player noch nicht bereit */ }
    }
    if (q === 'auto') S.forced = false;
  }

  // -------------------------------------------------------------- Takt
  if (!S.timers) {
    S.timers = true;
    let lastT = performance.now();
    // AGC-Regelung: 20x pro Sekunde
    setInterval(() => {
      const t = performance.now();
      const dt = Math.min(0.5, (t - lastT) / 1000);
      lastT = t;
      for (const v of document.querySelectorAll('.html5-video-player video')) {
        let g = S.graphs.get(v);
        if (!g && isAgc()) g = buildGraph(v);
        if (!g) continue;
        if (!v.paused) S.lastGraph = g;
        try { updateGraph(g, dt); } catch (e) { /* weiter */ }
      }
    }, 50);
    // Lautstärke & Qualität: 1x pro Sekunde
    setInterval(() => {
      for (const v of document.querySelectorAll('video')) {
        if (S.last.has(v)) {
          try { S.setRaw(v, S.compute(v, S.last.get(v))); } catch (e) { /* egal */ }
        }
      }
      applyQuality();
    }, 1000);
  }

  // Sofort anwenden
  for (const v of document.querySelectorAll('video')) {
    if (S.last.has(v)) { try { S.setRaw(v, S.compute(v, S.last.get(v))); } catch (e) { /* egal */ } }
  }
  applyQuality();
})
