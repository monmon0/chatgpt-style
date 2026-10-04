(() => {
  'use strict';
  const { KEY, normalize, parseLink } = StudioModel;
  let state = normalize();
  let timer;
  let observer;
  const background = document.createElement('div');
  background.id = 'cgstudio-background';
  background.setAttribute('aria-hidden', 'true');

  function sidebarLinks() {
    // Only inspect navigation areas, never links inside conversation messages.
    return [...new Set(document.querySelectorAll('nav a[href], aside a[href], [data-testid="sidebar"] a[href], #stage-slideover-sidebar a[href]'))];
  }
  function discover() {
    const items = new Map();
    for (const link of sidebarLinks()) {
      const parsed = parseLink(link.getAttribute('href'), location.origin);
      if (!parsed) continue;
      const title = (link.getAttribute('title') || link.textContent || link.getAttribute('aria-label') || 'Untitled').trim().replace(/\s+/g, ' ').slice(0, 200);
      if (!items.has(parsed.id)) items.set(parsed.id, { ...parsed, title });
    }
    return [...items.values()];
  }
  function apply() {
    observer?.disconnect();
    try {
      const bg = state.background;
      const hasBackground = state.enabled && (bg.mode === 'color' || (bg.mode === 'image' && bg.image));
      document.documentElement.toggleAttribute('data-cgstudio-background', Boolean(hasBackground));
      if (hasBackground) {
        if (!background.isConnected) document.body.prepend(background);
        background.style.backgroundColor = bg.color;
        background.style.backgroundImage = bg.mode === 'image' ? `linear-gradient(rgba(0,0,0,${bg.dim / 100}),rgba(0,0,0,${bg.dim / 100})), url("${bg.image}")` : 'none';
      } else background.remove();
      for (const link of sidebarLinks()) {
        const parsed = parseLink(link.getAttribute('href'), location.origin);
        const item = parsed && state.enabled ? state.items[parsed.id] : null;
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
        } else {
          icon?.remove();
          link.removeAttribute('data-cgstudio-folder-icon');
        }
      }
    } finally {
      observer?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
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
