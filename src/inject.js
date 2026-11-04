'use strict';
// CSS, das in die YouTube-Seiten der einzelnen Panels eingefügt wird.

const HIDE_CHROME = `
#masthead-container, ytd-masthead, tp-yt-app-drawer#guide, ytd-mini-guide-renderer {
  display: none !important;
}
ytd-app { --ytd-masthead-height: 0px !important; --ytd-toolbar-height: 0px !important; }
#page-manager.ytd-app { margin-top: 0 !important; margin-left: 0 !important; }
`;

// Video-Panel: YouTubes eigener Kinomodus, alles außer dem Player ausgeblendet.
// Der Player berechnet seine Größe dabei selbst (kein position:fixed – das bricht den neuen Player).
const video = `
html[data-ytp-page="watch"], html[data-ytp-page="watch"] body {
  overflow: hidden !important; background: #000 !important;
}
html[data-ytp-page="watch"] #masthead-container,
html[data-ytp-page="watch"] ytd-masthead,
html[data-ytp-page="watch"] tp-yt-app-drawer#guide,
html[data-ytp-page="watch"] ytd-mini-guide-renderer { display: none !important; }
html[data-ytp-page="watch"] ytd-app { --ytd-masthead-height: 0px !important; --ytd-toolbar-height: 0px !important; }
html[data-ytp-page="watch"] #page-manager.ytd-app { margin-top: 0 !important; margin-left: 0 !important; }

/* Kinomodus: Player-Bereich = ganzes Panel, Rest der Seite weg */
html[data-ytp-page="watch"] ytd-watch-flexy[theater] #full-bleed-container,
html[data-ytp-page="watch"] ytd-watch-flexy[full-bleed-player] #full-bleed-container,
html[data-ytp-page="watch"] ytd-watch-flexy[theater] #player-full-bleed-container,
html[data-ytp-page="watch"] ytd-watch-flexy[full-bleed-player] #player-full-bleed-container {
  height: 100vh !important; max-height: 100vh !important; min-height: 0 !important;
}
html[data-ytp-page="watch"] ytd-watch-flexy[theater] #columns,
html[data-ytp-page="watch"] ytd-watch-flexy[full-bleed-player] #columns { display: none !important; }

/* Bis der Kinomodus aktiv ist: nur den Player zeigen */
html[data-ytp-page="watch"] ytd-watch-flexy:not([theater]):not([full-bleed-player]) #secondary,
html[data-ytp-page="watch"] ytd-watch-flexy:not([theater]):not([full-bleed-player]) #below { display: none !important; }

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
