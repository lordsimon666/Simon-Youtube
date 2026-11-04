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

module.exports = { video, comments, browser, tabs };
