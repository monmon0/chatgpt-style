(() => {
  'use strict';
  const { KEY, normalize, parseLink, folderLabelId } = StudioModel;
  let state = normalize();
  let timer;
  let observer;
  const background = document.createElement('div');
  background.id = 'cgstudio-background';
  background.setAttribute('aria-hidden', 'true');

  const sidebarSelector = 'nav, aside, [data-testid="sidebar"], #stage-slideover-sidebar, #stage-sidebar, #sidebar, [data-sidebar]';
  const controlsSelector = 'button, summary, [role="button"], [aria-expanded], [class*="cursor-pointer"], [data-testid*="folder" i], div:has(> svg), div:has(> div > svg)';
  const ignoredFolderLabel = /^(pinned|projects|folders|your chats|chats|history|show (more|less|all)|see (more|all)|new (project|folder|chat)|create (project|folder)|search( chats)?|settings|more(?: options)?|expand|collapse|close|open sidebar)$/i;
  function rowTitle(row) {
    const named = row.querySelector('[data-testid="project-name"], [data-testid="folder-name"], .truncate');
    const copy = row.cloneNode(true);
    copy.querySelectorAll('svg, img, button, [role="button"], [aria-hidden="true"]').forEach(child => child.remove());
    return (row.getAttribute('title') || named?.textContent || copy.textContent || row.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  }
  function containsChats(container) {
    return container && [...container.querySelectorAll('a[href]')].some(link => parseLink(link.getAttribute('href'), location.origin)?.type === 'chat');
  }
  function collapsibleFolder(row) {
    if (containsChats(row)) return null;
    const href = row.getAttribute('href');
    if (href) {
      try {
        const url = new URL(href, location.origin);
        if (url.protocol !== 'https:' || !['chatgpt.com', 'chat.openai.com'].includes(url.hostname)) return null;
      } catch { return null; }
    }
    const title = rowTitle(row);
    if (!title || title.length > 120 || ignoredFolderLabel.test(title)) return null;
    // A folder heading has a glyph, and either controls an expandable list or
    // sits immediately beside its conversations. Never classify menu buttons.
    if (!row.querySelector('svg, img, [data-testid="folder-icon"]')) return null;
    if (row.getAttribute('aria-haspopup')) return null;
    const inSidebar = Boolean(row.closest(sidebarSelector));
    const controlledId = row.getAttribute('aria-controls');
    const controlled = controlledId && document.getElementById(controlledId);
    const hasExpansion = row.hasAttribute('aria-expanded') || row.matches('summary');
    const localGroup = [row.parentElement, row.parentElement?.parentElement].some(group => group && !group.matches(`${sidebarSelector}, body, html`) && containsChats(group));
    if (!(containsChats(controlled) || (inSidebar && hasExpansion) || localGroup)) return null;
    // Prefer a specific inner trigger over a wrapper of that trigger.
    if (row.querySelector('button:not([aria-haspopup]), summary, [role="button"]')) return null;
    return { id: folderLabelId(title), type: 'folder', title };
  }
  function sidebarEntries() {
    // Sidebar containers change between ChatGPT layouts. Recognize navigation
    // outside message content as well as explicit sidebar containers.
    const candidates = document.querySelectorAll(`a[href], [data-project-id], [data-project-url], [data-href], button[data-testid*="project" i], [role="button"][data-testid*="project" i], ${controlsSelector}`);
    const entries = [];
    const seenRows = new Set();
    for (const element of candidates) {
      const inSidebar = element.closest(sidebarSelector);
      if (!inSidebar && element.closest('main, article, [role="dialog"], [data-message-author-role], header')) continue;
      const href = element.getAttribute('href') || element.getAttribute('data-project-url') || element.getAttribute('data-href');
      let parsed = href ? parseLink(href, location.origin) : null;
      const projectId = element.getAttribute('data-project-id');
      if (!parsed && projectId && /^[\w-]+$/.test(projectId)) parsed = { id: `folder:${projectId}`, type: 'folder' };
      if (!parsed) parsed = collapsibleFolder(element);
      if (!parsed) continue;
      // Prefer the actual navigation element over a metadata wrapper.
      const row = parsed.title || element.matches('a, button, [role="button"], [role="link"]') ? element : element.querySelector('a, button, [role="button"], [role="link"]') || element;
      if (seenRows.has(row)) continue;
      seenRows.add(row);
      const title = parsed.title || rowTitle(row) || 'Untitled';
      entries.push({ element: row, ...parsed, title });
    }
    return entries;
  }
  function discover() {
    const items = new Map();
    for (const { element, ...item } of sidebarEntries()) {
      if (!items.has(item.id)) items.set(item.id, item);
    }
    return [...items.values()];
  }
  function apply() {
    observer?.disconnect();
    try {
      const bg = state.background;
      const fontColor = state.enabled ? state.fontColor : '';
      document.documentElement.toggleAttribute('data-cgstudio-font', Boolean(fontColor));
      if (fontColor) document.documentElement.style.setProperty('--cgstudio-font-color', fontColor);
      else document.documentElement.style.removeProperty('--cgstudio-font-color');
      const hasBackground = state.enabled && (bg.mode === 'color' || (bg.mode === 'image' && bg.image));
      document.documentElement.toggleAttribute('data-cgstudio-background', Boolean(hasBackground));
      if (hasBackground) {
        if (!background.isConnected) document.body.prepend(background);
        background.style.backgroundColor = bg.color;
        background.style.backgroundImage = bg.mode === 'image' ? `linear-gradient(rgba(0,0,0,${bg.dim / 100}),rgba(0,0,0,${bg.dim / 100})), url("${bg.image}")` : 'none';
      } else background.remove();
      const entries = sidebarEntries();
      const current = new Set(entries.map(entry => entry.element));
      // Also clean previously styled rows whose href or metadata changed.
      const stale = [...document.querySelectorAll('[data-cgstudio-entry]')].filter(element => !current.has(element));
      for (const { element: link, ...parsed } of [...entries, ...stale.map(element => ({ element }))]) {
        if (parsed.id) link.setAttribute('data-cgstudio-entry', '');
        else link.removeAttribute('data-cgstudio-entry');
        const item = parsed.id && state.enabled ? state.items[parsed.id] : null;
        if (item?.textColor) {
          link.setAttribute('data-cgstudio-text', '');
          link.style.setProperty('--cgstudio-item-text', item.textColor);
        } else {
          link.removeAttribute('data-cgstudio-text');
          link.style.removeProperty('--cgstudio-item-text');
        }
        if (item?.color) {
          link.setAttribute('data-cgstudio-highlight', '');
          link.style.setProperty('--cgstudio-color', item.color);
        } else {
          link.removeAttribute('data-cgstudio-highlight');
          link.style.removeProperty('--cgstudio-color');
        }
        let icon = link.querySelector('img[data-cgstudio-icon]');
        if (item?.icon && parsed.type === 'folder') {
          if (!icon) {
            icon = document.createElement('img');
            icon.setAttribute('data-cgstudio-icon', '');
            icon.alt = '';
            link.prepend(icon);
          }
          if (icon.getAttribute('src') !== item.icon) icon.src = item.icon;
          link.setAttribute('data-cgstudio-folder-icon', '');
          const glyph = [...link.querySelectorAll('svg')].find(svg => {
            const control = svg.closest('button, [role="button"]');
            return !control || control === link;
          });
          glyph?.setAttribute('data-cgstudio-original-icon', '');
        } else {
          icon?.remove();
          link.removeAttribute('data-cgstudio-folder-icon');
          link.querySelectorAll('[data-cgstudio-original-icon]').forEach(glyph => glyph.removeAttribute('data-cgstudio-original-icon'));
        }
      }
    } finally {
      observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'data-project-id', 'data-project-url', 'data-href', 'title', 'aria-expanded', 'aria-controls'] });
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'STUDIO_GET_ITEMS') respond({ items: discover() });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) { state = normalize(changes[KEY].newValue); apply(); }
  });
  chrome.storage.local.get(KEY).then(result => {
    state = normalize(result[KEY]);
    observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    });
    apply();
  }).catch(error => console.warn('ChatGPT Studio could not load settings:', error));
})();
