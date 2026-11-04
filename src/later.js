'use strict';
/* global api */
// Gemeinsame Darstellung der "Später ansehen"-Liste (Hauptfenster und eigenes Fenster)
// eslint-disable-next-line no-unused-vars
function renderLaterList(list, items, L) {
  list.textContent = '';
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'later-empty';
    empty.textContent = L('later.empty');
    list.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'later-item' + (item.type === 'short' ? ' short' : '');
    row.title = L('later.play.title');

    const thumb = document.createElement('div');
    thumb.className = 'later-thumb';
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = '';
    img.src = `https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/mqdefault.jpg`;
    thumb.append(img);
    if (item.type === 'short') {
      const tag = document.createElement('span');
      tag.className = 'later-type';
      tag.textContent = 'SHORT';
      thumb.append(tag);
    }

    const meta = document.createElement('div');
    meta.className = 'later-meta';
    const title = document.createElement('div');
    title.className = 'later-title';
    title.textContent = item.title || item.id;
    const channel = document.createElement('div');
    channel.className = 'later-channel';
    channel.textContent = item.channel || '';
    meta.append(title, channel);

    const remove = document.createElement('button');
    remove.className = 'later-remove';
    remove.title = L('later.remove');
    remove.textContent = '✕';
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      api.removeLater(item.id);
    });

    row.append(thumb, meta, remove);
    row.addEventListener('click', () => api.playLater(item.id));
    list.append(row);
  }
}
