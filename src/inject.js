'use strict';
// CSS, das in die YouTube-Seiten der einzelnen Panels eingefügt wird.

const HIDE_CHROME = `
#masthead-container, ytd-masthead, tp-yt-app-drawer#guide, ytd-mini-guide-renderer {
  display: none !important;
}
ytd-app { --ytd-masthead-height: 0px !important; --ytd-toolbar-height: 0px !important; }
#page-manager.ytd-app { margin-top: 0 !important; margin-left: 0 !important; }
`;

// Video-Panel: Player füllt das ganze Panel (normale Videos), Shorts ohne Kopfzeile.
const video = `
html[data-ytp-page="watch"], html[data-ytp-page="watch"] body {
  overflow: hidden !important; background: #000 !important;
}
html[data-ytp-page="watch"] :is(ytd-app, ytd-page-manager, ytd-watch-flexy, #columns, #primary,
  #primary-inner, #player, #player-container-outer, #player-container-inner, #player-container,
  #ytd-player, #container.ytd-player, #full-bleed-container, #player-full-bleed-container,
  #player-wide-container, #player-theater-container) {
  contain: none !important; transform: none !important; filter: none !important;
  will-change: auto !important;
}
html[data-ytp-page="watch"] #movie_player {
  position: fixed !important; top: 0 !important; left: 0 !important;
  width: 100vw !important; height: 100vh !important;
  max-width: none !important; max-height: none !important;
  z-index: 2147483000 !important; background: #000 !important;
}
html[data-ytp-page="watch"] #movie_player video.html5-main-video {
  width: 100% !important; height: 100% !important; left: 0 !important; top: 0 !important;
  object-fit: contain !important;
}
html[data-ytp-page="watch"] #masthead-container { display: none !important; }
html[data-ytp-page="watch"] ytd-popup-container tp-yt-paper-dialog,
html[data-ytp-page="watch"] ytd-popup-container tp-yt-iron-dropdown,
html[data-ytp-page="watch"] tp-yt-iron-overlay-backdrop {
  z-index: 2147483600 !important;
}
html[data-ytp-page="shorts"] #masthead-container,
html[data-ytp-page="shorts"] ytd-masthead,
html[data-ytp-page="shorts"] tp-yt-app-drawer#guide,
html[data-ytp-page="shorts"] ytd-mini-guide-renderer { display: none !important; }
html[data-ytp-page="shorts"] ytd-app { --ytd-masthead-height: 0px !important; --ytd-toolbar-height: 0px !important; }
html[data-ytp-page="shorts"] #page-manager.ytd-app { margin-top: 0 !important; margin-left: 0 !important; }
`;

// Kommentar-Panel: Player ausblenden, nur Infos/Kommentare/Vorschläge zeigen.
const comments = HIDE_CHROME + `
#player, #player-container-outer, #full-bleed-container, #player-full-bleed-container,
#player-wide-container, #player-theater-container, ytd-player#ytd-player {
  display: none !important;
}
ytd-watch-flexy #columns { padding-top: 8px !important; }
`;

const tabs = {
  comments: `
#related, ytd-watch-next-secondary-results-renderer, #secondary #related { display: none !important; }
`,
  related: `
ytd-comments, #comments, ytd-watch-metadata, #below > #info, #below > #meta,
ytd-merch-shelf-renderer, #ticket-shelf, #clarify-box { display: none !important; }
`,
};

const browser = `
ytd-video-preview, #video-preview { display: none !important; }
`;

// Skript für das Video-Panel (läuft in der YouTube-Seite):
//  - Lautstärke-Ausgleich ("Auto-Level" / Normalisierung): auto | off | custom (Stärke 0–100 %)
//  - Videoqualität: auto oder feste Auflösung
function playerScript(cfg) {
  return `(function (cfg) {
  const S = window.__ytp || (window.__ytp = { last: new WeakMap() });
  if (!S.cfg || S.cfg.quality !== cfg.quality) S.appliedKey = null;
  S.cfg = cfg;
  const RANK = ['tiny', 'small', 'medium', 'large', 'hd720', 'hd1080', 'hd1440', 'hd2160', 'highres'];
  const playerOf = (el) => (el && el.closest && el.closest('.html5-video-player')) || null;

  if (!S.installed) {
    S.installed = true;
    const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    // v = Lautstärke, die YouTube setzen will (Regler x Normalisierungsfaktor)
    S.compute = (el, v) => {
      const c = S.cfg;
      const p = playerOf(el);
      if (c.volumeMode === 'auto' || !p || typeof p.getVolume !== 'function') return v;
      const slider = Math.max(0, Math.min(1, p.getVolume() / 100));
      if (slider <= 0) return v;
      const factor = Math.max(0.0001, Math.min(1, v / slider));
      const strength = c.volumeMode === 'off' ? 0 : Math.max(0, Math.min(100, c.volumeStrength)) / 100;
      return Math.max(0, Math.min(1, slider * Math.pow(factor, strength)));
    };
    S.setRaw = (el, v) => d.set.call(el, v);
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
      configurable: true,
      enumerable: d.enumerable,
      get() { return S.last.has(this) ? S.last.get(this) : d.get.call(this); },
      set(v) {
        S.last.set(this, v);
        d.set.call(this, S.compute(this, v));
      },
    });

    S.tick = () => {
      // Lautstärke neu anwenden (z. B. nach Änderung der Einstellung oder des Reglers)
      for (const v of document.querySelectorAll('video')) {
        if (S.last.has(v)) {
          try { S.setRaw(v, S.compute(v, S.last.get(v))); } catch (e) {}
        }
      }
      // Qualität
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
        } catch (e) {}
      }
      if (q === 'auto') S.forced = false;
    };
    setInterval(() => S.tick(), 1000);
  }
  S.tick();
})(${JSON.stringify(cfg)});`;
}

module.exports = { video, comments, browser, tabs, playerScript };
