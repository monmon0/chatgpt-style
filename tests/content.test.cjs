const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const model = require('../model.js');

class Element {
  constructor(tag, attrs = {}, text = '') {
    this.tag = tag; this.attrs = { ...attrs }; this.textContent = text;
    this.children = []; this.isConnected = false;
    this.style = { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } };
  }
  getAttribute(key) { return this.attrs[key] ?? null; }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  toggleAttribute(key, value) { if (value) this.setAttribute(key, ''); else this.removeAttribute(key); }
  prepend(child) { this.children.unshift(child); child.parent = this; child.isConnected = true; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.isConnected = false; }
  querySelector() { return this.children.find(c => Object.hasOwn(c.attrs, 'data-cgstudio-icon')) || null; }
  set src(value) { this.attrs.src = value; }
}
async function setup(settings) {
  const chat = new Element('a', { href: '/c/chat-1' }, 'My chat');
  const folder = new Element('a', { href: '/g/g-p-work/project' }, 'Work');
  const other = new Element('a', { href: '/g/g-something' }, 'Custom GPT');
  const links = [chat, folder, other];
  const html = new Element('html');
  const body = new Element('body');
  let storageChange, messageListener, mutation;
  const document = { documentElement: html, body, createElement: tag => new Element(tag), querySelectorAll: () => links };
  const context = {
    StudioModel: model, document, location: { origin: 'https://chatgpt.com' }, console,
    setTimeout, clearTimeout,
    MutationObserver: class { constructor(callback) { mutation = callback; } disconnect() {} observe() {} },
    chrome: {
      runtime: { onMessage: { addListener(listener) { messageListener = listener; } } },
      storage: { local: { get: async () => ({ [model.KEY]: settings }) }, onChanged: { addListener(listener) { storageChange = listener; } } }
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../content.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { chat, folder, other, body, html, links, mutate: () => mutation(),
    update(value) { storageChange({ [model.KEY]: { newValue: value } }, 'local'); },
    discover() { let response; messageListener({ type: 'STUDIO_GET_ITEMS' }, {}, value => { response = value; }); return response; }
  };
}
test('applies styles, reuses icons, and restores the page when disabled or reset', async () => {
  const settings = { enabled: true, background: { mode: 'image', color: '#123456', image: 'data:image/png;base64,AAAA', dim: 40 }, items: {
    'chat:chat-1': { title: 'My chat', color: '#aabbcc' },
    'folder:g-p-work': { title: 'Work', color: '#112233', icon: 'data:image/png;base64,AAAA' }
  } };
  const page = await setup(settings);
  assert.equal(page.chat.style['--cgstudio-color'], '#aabbcc');
  assert.equal(page.folder.children.length, 1);
  assert.equal(page.folder.children[0].attrs.src, 'data:image/png;base64,AAAA');
  assert.equal(page.body.children.length, 1);
  assert.match(page.body.children[0].style.backgroundImage, /0\.4/);
  assert.equal(page.other.getAttribute('data-cgstudio-highlight'), null);
  page.update(settings);
  assert.equal(page.folder.children.length, 1, 'does not duplicate icons');
  page.update({ ...settings, enabled: false });
  assert.equal(page.chat.getAttribute('data-cgstudio-highlight'), null);
  assert.equal(page.folder.children.length, 0);
  assert.equal(page.body.children.length, 0);
  assert.equal(page.html.getAttribute('data-cgstudio-background'), null);
  page.update(settings);
  assert.equal(page.folder.children.length, 1);
  page.update(undefined);
  assert.equal(page.folder.children.length, 0);
  assert.equal(page.body.children.length, 0);
});
test('discovers sidebar items and styles new links after a navigation mutation', async () => {
  const page = await setup({ items: { 'chat:new-chat': { title: 'New', color: '#abcdef' } } });
  assert.deepEqual(JSON.parse(JSON.stringify(page.discover().items)), [
    { id: 'chat:chat-1', type: 'chat', title: 'My chat' }, { id: 'folder:g-p-work', type: 'folder', title: 'Work' }
  ]);
  const added = new Element('a', { href: '/c/new-chat' }, 'New');
  page.links.push(added);
  page.mutate();
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(added.style['--cgstudio-color'], '#abcdef');
});
