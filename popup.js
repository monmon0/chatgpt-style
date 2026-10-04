(() => {
  'use strict';
  const { KEY, normalize } = StudioModel;
  const $ = selector => document.querySelector(selector);
  const colors = [
    ['Lavender', '#a78bfa'], ['Rose', '#f28dab'], ['Peach', '#f2b179'],
    ['Mint', '#79c9ac'], ['Sky', '#7ab6ef'], ['Slate', '#949bb3']
  ];
  const backgrounds = [
    ['Midnight', '#171923'], ['Plum', '#30243d'], ['Forest', '#203a34'],
    ['Ocean', '#23384c'], ['Clay', '#4a3437'], ['Graphite', '#292b30']
  ];
  let state = normalize();
  let discovered = [];
  let saveQueue = Promise.resolve();
  let saveVersion = 0;
  let refreshVersion = 0;
  let resetArmed = false;
  let resetTimer;
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage?.local;

  function notice(message = '') {
    $('#notice').textContent = message;
    $('#notice').hidden = !message;
  }
  function persist() {
    const snapshot = structuredClone(state);
    const version = ++saveVersion;
    $('#save-status').textContent = 'Saving…';
    saveQueue = saveQueue.then(async () => {
      if (!hasChrome) throw new Error('Load this folder as a Chrome extension to save styles.');
      await chrome.storage.local.set({ [KEY]: snapshot });
      if (version === saveVersion) $('#save-status').textContent = '✓ Saved on this device';
    }).catch(error => {
      $('#save-status').textContent = 'Could not save';
      notice(error.message || 'Storage is full. Remove an image and try again.');
    });
    return saveQueue;
  }
  function swatch(color, name, selected, onClick) {
    const button = document.createElement('button');
    button.className = `swatch${color ? '' : ' clear-swatch'}`;
    button.style.setProperty('--swatch', color || '#ffffff');
    button.title = name;
    button.setAttribute('aria-label', name);
    button.setAttribute('aria-pressed', String(selected));
    button.addEventListener('click', onClick);
    return button;
  }
  function renderAppearance() {
    const bg = state.background;
    $('#enabled').checked = state.enabled;
    $('#font-color').value = state.fontColor || '#faf9ff';
    $('#font-color-value').textContent = state.fontColor ? state.fontColor.toUpperCase() : 'Default';
    $('#preview').style.color = state.enabled && state.fontColor ? state.fontColor : '#faf9ff';
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === bg.mode)));
    $('#color-controls').hidden = bg.mode !== 'color';
    $('#image-controls').hidden = bg.mode !== 'image';
    $('#background-color').value = bg.color;
    $('#color-value').textContent = bg.color.toUpperCase();
    $('#dim').value = bg.dim;
    $('#dim-value').textContent = `${bg.dim}%`;
    $('#upload-label').textContent = bg.image ? 'Choose a different image' : 'Choose your backdrop';
    $('#remove-background').hidden = !bg.image;
    const preview = $('#preview');
    preview.style.backgroundColor = state.enabled && bg.mode !== 'default' ? bg.color : '#171923';
    preview.style.backgroundImage = state.enabled && bg.mode === 'image' && bg.image ? `linear-gradient(rgba(0,0,0,${bg.dim / 100}),rgba(0,0,0,${bg.dim / 100})), url("${bg.image}")` : 'none';
    $('#background-palette').replaceChildren(...backgrounds.map(([name, color]) => swatch(color, name, bg.color === color, () => {
      state.background.color = color;
      renderAppearance();
      persist();
    })));
  }
  function allItems() {
    const entries = new Map(Object.entries(state.items).map(([id, item]) => [id, { id, type: item.type, title: item.title }]));
    for (const item of discovered) entries.set(item.id, item);
    return [...entries.values()];
  }
  function updateItem(item, patch) {
    state.items[item.id] = { color: '', textColor: '', icon: '', ...state.items[item.id], title: item.title, type: item.type, ...patch };
    if (!state.items[item.id].color && !state.items[item.id].textColor && !state.items[item.id].icon) delete state.items[item.id];
    persist();
  }
  function renderItems() {
    const items = allItems();
    $('#folder-count').textContent = items.filter(item => item.type === 'folder').length;
    $('#chat-count').textContent = items.filter(item => item.type === 'chat').length;
    const query = $('#chat-search').value.toLocaleLowerCase();
    for (const type of ['folder', 'chat']) {
      const list = $(`#${type}-list`);
      list.replaceChildren();
      const filtered = items.filter(item => item.type === type && (type !== 'chat' || item.title.toLocaleLowerCase().includes(query)));
      if (!filtered.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = query && type === 'chat' ? 'No chats match your search.' : type === 'folder' ? 'No folder headings detected yet. Expand a folder to show its chats, then click ↻ above.' : 'Open your ChatGPT sidebar, then click ↻ to see your conversations.';
        list.append(empty);
      }
      for (const item of filtered) {
        const card = $('#item-template').content.firstElementChild.cloneNode(true);
        const style = state.items[item.id] || {};
        card.querySelector('.item-title').textContent = item.title;
        card.querySelector('.item-title').title = item.title;
        const icon = card.querySelector('.item-icon');
        if (style.icon) {
          const img = document.createElement('img');
          img.src = style.icon;
          img.alt = '';
          icon.append(img);
        } else icon.textContent = type === 'folder' ? '▱' : '☰';
        card.querySelector('.clear-item').addEventListener('click', () => { delete state.items[item.id]; persist(); renderItems(); });
        const palette = card.querySelector('.item-colors');
        palette.append(swatch('', 'No highlight', !style.color, () => { updateItem(item, { color: '' }); renderItems(); }));
        for (const [name, color] of colors) palette.append(swatch(color, name, style.color === color, () => { updateItem(item, { color }); renderItems(); }));
        const custom = document.createElement('input');
        custom.type = 'color';
        custom.value = style.color || '#a78bfa';
        custom.title = 'Custom highlight color';
        custom.setAttribute('aria-label', `Custom highlight color for ${item.title}`);
        custom.addEventListener('change', () => { updateItem(item, { color: custom.value }); renderItems(); });
        palette.append(custom);
        const font = card.querySelector('.item-font-color');
        font.value = style.textColor || state.fontColor || '#faf9ff';
        font.setAttribute('aria-label', `Font color for ${item.title}`);
        font.addEventListener('change', () => { updateItem(item, { textColor: font.value }); renderItems(); });
        card.querySelector('.reset-item-font').hidden = !style.textColor;
        card.querySelector('.reset-item-font').addEventListener('click', () => { updateItem(item, { textColor: '' }); renderItems(); });
        card.querySelector('.icon-actions').hidden = type !== 'folder';
        card.querySelector('.remove-icon').hidden = !style.icon;
        card.querySelector('.remove-icon').addEventListener('click', () => { updateItem(item, { icon: '' }); renderItems(); });
        card.querySelector('input[type="file"]').addEventListener('change', async event => {
          try {
            const image = await readImage(event.target.files[0], 128, true);
            if (!image) return;
            updateItem(item, { icon: image });
            renderItems();
            notice();
          } catch (error) { notice(error.message); }
          finally { event.target.value = ''; }
        });
        list.append(card);
      }
    }
  }
  async function readImage(file, maxSize, square = false) {
    if (!file) return '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Please choose a PNG, JPG or WebP image.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 40_000_000) throw new Error('This image is too large. Choose one under 40 megapixels.');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not process this image. Try a different file.');
      if (square) {
        canvas.width = canvas.height = maxSize;
        const side = Math.min(bitmap.width, bitmap.height);
        ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, maxSize, maxSize);
      } else {
        const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      }
      return canvas.toDataURL('image/webp', 0.85);
    } finally { bitmap.close(); }
  }
  async function refresh() {
    const version = ++refreshVersion;
    try {
      if (!hasChrome) throw new Error('Extension preview · load in Chrome to connect');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)(\/|$)/.test(tab.url || '')) throw new Error('Open a ChatGPT tab to connect');
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'STUDIO_GET_ITEMS' });
      if (version !== refreshVersion) return;
      discovered = (response?.items || []).filter(item => item && /^(chat|folder):[\w-]+$/.test(item.id) && ['chat', 'folder'].includes(item.type) && typeof item.title === 'string');
      $('#connection-text').textContent = 'Connected to your ChatGPT';
      $('#connection-dot').classList.add('connected');
    } catch (error) {
      if (version !== refreshVersion) return;
      discovered = [];
      $('#connection-text').textContent = error.message.includes('Receiving end') || error.message.includes('connection') ? 'Reload your ChatGPT tab to connect' : error.message;
      $('#connection-dot').classList.remove('connected');
    }
    renderItems();
  }

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {
    for (const button of tabs) {
      const selected = button === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      $(`#${button.getAttribute('aria-controls')}`).hidden = !selected;
    }
    if (tab.id !== 'tab-appearance') refresh();
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      let index = tabs.indexOf(tab);
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else index = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[index]);
      tabs[index].focus();
    });
  }
  $('#enabled').addEventListener('change', () => { state.enabled = $('#enabled').checked; renderAppearance(); persist(); });
  $('#font-color').addEventListener('input', () => { state.fontColor = $('#font-color').value; renderAppearance(); });
  $('#font-color').addEventListener('change', () => { persist(); renderItems(); });
  $('#reset-font-color').addEventListener('click', () => { state.fontColor = ''; renderAppearance(); renderItems(); persist(); });
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { state.background.mode = button.dataset.mode; renderAppearance(); persist(); }));
  $('#background-color').addEventListener('input', () => { state.background.color = $('#background-color').value; renderAppearance(); });
  $('#background-color').addEventListener('change', persist);
  $('#dim').addEventListener('input', () => { state.background.dim = Number($('#dim').value); renderAppearance(); });
  $('#dim').addEventListener('change', persist);
  $('#background-upload').addEventListener('change', async event => {
    try {
      const image = await readImage(event.target.files[0], 1920);
      if (!image) return;
      state.background.image = image;
      state.background.mode = 'image';
      renderAppearance();
      notice();
      persist();
    } catch (error) { notice(error.message); }
    finally { event.target.value = ''; }
  });
  $('#remove-background').addEventListener('click', () => { state.background.image = ''; state.background.mode = 'default'; renderAppearance(); persist(); });
  $('#chat-search').addEventListener('input', renderItems);
  $('#refresh').addEventListener('click', refresh);
  $('#reset').addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      $('#reset').textContent = 'Click again to reset';
      resetTimer = setTimeout(() => { resetArmed = false; $('#reset').textContent = 'Reset styles'; }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    $('#reset').textContent = 'Reset styles';
    state = normalize();
    renderAppearance();
    renderItems();
    notice();
    persist();
  });
  async function initialize() {
    try {
      if (hasChrome) { const result = await chrome.storage.local.get(KEY); state = normalize(result[KEY]); }
    } catch (error) { notice(`Could not load settings: ${error.message}`); }
    renderAppearance();
    renderItems();
    await refresh();
  }
  initialize();
})();
