(function (root) {
  'use strict';
  const KEY = 'chatgptStudio';
  const defaults = () => ({ enabled: true, fontColor: '', background: { mode: 'default', color: '#171923', image: '', dim: 35 }, items: {} });
  const isColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  const isImage = value => typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  function folderLabelId(title) {
    // Collapsible rows may expose no URL or Project ID. Keep the same key
    // across reloads and expansion changes using their visible name.
    let hash = 2166136261;
    for (const char of title.normalize('NFC').trim().replace(/\s+/g, ' ')) {
      hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
    }
    return `folder:label-${(hash >>> 0).toString(36)}`;
  }
  function parseLink(href, base = 'https://chatgpt.com') {
    try {
      const url = new URL(href, base);
      if (!['chatgpt.com', 'chat.openai.com'].includes(url.hostname) || url.protocol !== 'https:') return null;
      // Project conversations may also have /g/g-p-…/c/… routes.
      const chat = url.pathname.match(/(?:^|\/)c\/([\w-]+)\/?$/);
      if (chat) return { id: `chat:${chat[1]}`, type: 'chat' };
      const folder = url.pathname.match(/^\/(?:g\/(g-p-[\w-]+)(?:\/project)?|g\/(g-[\w-]+)\/project|projects?\/([\w-]+))\/?$/);
      if (folder) return { id: `folder:${folder[1] || folder[2] || folder[3]}`, type: 'folder' };
    } catch { /* Ignore non-navigation links. */ }
    return null;
  }
  function normalize(input) {
    const state = defaults();
    if (!input || typeof input !== 'object') return state;
    state.enabled = input.enabled !== false;
    if (isColor(input.fontColor)) state.fontColor = input.fontColor;
    const bg = input.background || {};
    if (['default', 'color', 'image'].includes(bg.mode)) state.background.mode = bg.mode;
    if (isColor(bg.color)) state.background.color = bg.color;
    if (isImage(bg.image)) state.background.image = bg.image;
    if (Number.isFinite(bg.dim)) state.background.dim = Math.min(80, Math.max(0, bg.dim));
    for (const [id, item] of Object.entries(input.items || {})) {
      if (!/^(chat|folder):[\w-]+$/.test(id) || !item || typeof item !== 'object') continue;
      state.items[id] = {
        title: typeof item.title === 'string' ? item.title.slice(0, 200) : 'Untitled',
        type: id.startsWith('folder:') ? 'folder' : 'chat',
        color: isColor(item.color) ? item.color : '',
        textColor: isColor(item.textColor) ? item.textColor : '',
        icon: id.startsWith('folder:') && isImage(item.icon) ? item.icon : ''
      };
    }
    return state;
  }
  const api = { KEY, defaults, normalize, parseLink, isColor, isImage, folderLabelId };
  root.StudioModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
