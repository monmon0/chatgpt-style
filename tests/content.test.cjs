const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { parseHTML } = require('linkedom');
const model = require('../model.js');

const baseHTML = `<nav id="sidebar">
  <a href="/c/chat-1">My chat</a>
  <a href="/g/g-p-work/project"><svg></svg><span>Work</span></a>
  <a href="/g/g-something">Custom GPT</a>
</nav><main></main>`;

async function setup(settings, html = baseHTML) {
  const { document } = parseHTML(`<!doctype html><html><head></head><body>${html}</body></html>`);
  let storageChange, messageListener, mutation;
  const context = {
    StudioModel: model, document, URL, location: { origin: 'https://chatgpt.com' }, console,
    setTimeout, clearTimeout,
    MutationObserver: class { constructor(callback) { mutation = callback; } disconnect() {} observe() {} },
    chrome: {
      runtime: { onMessage: { addListener(listener) { messageListener = listener; } } },
      storage: { local: { get: async () => ({ [model.KEY]: settings }) }, onChanged: { addListener(listener) { storageChange = listener; } } }
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../content.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return { document, chat: document.querySelector('a[href="/c/chat-1"]'), folder: document.querySelector('a[href="/g/g-p-work/project"]'),
    mutate: () => mutation(),
    update(value) { storageChange({ [model.KEY]: { newValue: value } }, 'local'); },
    discover() { let response; messageListener({ type: 'STUDIO_GET_ITEMS' }, {}, value => { response = value; }); return JSON.parse(JSON.stringify(response)); }
  };
}

test('applies styles, reuses icons, and restores the page when disabled or reset', async () => {
  const settings = { enabled: true, background: { mode: 'image', color: '#123456', image: 'data:image/png;base64,AAAA', dim: 40 }, items: {
    'chat:chat-1': { title: 'My chat', color: '#aabbcc' },
    'folder:g-p-work': { title: 'Work', color: '#112233', icon: 'data:image/png;base64,AAAA' }
  } };
  const page = await setup(settings);
  assert.equal(page.chat.style.getPropertyValue('--cgstudio-color'), '#aabbcc');
  assert.equal(page.folder.querySelectorAll('[data-cgstudio-icon]').length, 1);
  assert.match(page.document.getElementById('cgstudio-background').style.backgroundImage, /0\.4/);
  page.update(settings);
  assert.equal(page.folder.querySelectorAll('[data-cgstudio-icon]').length, 1);
  page.update({ ...settings, enabled: false });
  assert.equal(page.chat.hasAttribute('data-cgstudio-highlight'), false);
  assert.equal(page.folder.querySelector('[data-cgstudio-icon]'), null);
  assert.equal(page.document.getElementById('cgstudio-background'), null);
  page.update(settings);
  assert.equal(page.folder.querySelectorAll('[data-cgstudio-icon]').length, 1);
  page.update(undefined);
  assert.equal(page.folder.querySelector('[data-cgstudio-icon]'), null);
});

test('discovers navigation items and styles links added after a mutation', async () => {
  const page = await setup({ items: { 'chat:new-chat': { title: 'New', color: '#abcdef' } } });
  assert.deepEqual(page.discover().items, [
    { id: 'chat:chat-1', type: 'chat', title: 'My chat' }, { id: 'folder:g-p-work', type: 'folder', title: 'Work' }
  ]);
  page.document.querySelector('nav').insertAdjacentHTML('beforeend', '<a href="/c/new-chat">New</a>');
  page.mutate();
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(page.document.querySelector('a[href="/c/new-chat"]').style.getPropertyValue('--cgstudio-color'), '#abcdef');
});

test('recognizes metadata buttons and wrappers and excludes links in messages', async () => {
  const page = await setup({}, `<nav>
    <button data-project-id="g-p-button">Button project</button>
    <div data-project-id="g-p-wrapper"><button>Wrapped project</button></div>
    <button data-href="/g/g-p-metadata/project">Metadata project</button>
  </nav><main><a href="/g/g-p-ignore/project">Message reference</a></main>`);
  assert.deepEqual(page.discover().items.map(item => item.title), ['Button project', 'Wrapped project', 'Metadata project']);
});

test('cleans global and item font overrides, including reused navigation rows', async () => {
  const settings = { fontColor: '#ffffff', items: { 'chat:chat-1': { color: '#aabbcc', textColor: '#112233' } } };
  const page = await setup(settings);
  const html = page.document.documentElement;
  assert.equal(html.style.getPropertyValue('--cgstudio-font-color'), '#ffffff');
  assert.equal(page.chat.style.getPropertyValue('--cgstudio-item-text'), '#112233');
  page.update({ ...settings, enabled: false });
  assert.equal(html.hasAttribute('data-cgstudio-font'), false);
  assert.equal(page.chat.hasAttribute('data-cgstudio-text'), false);
  page.update(settings);
  page.chat.setAttribute('href', '/settings');
  page.update(settings);
  assert.equal(page.chat.hasAttribute('data-cgstudio-entry'), false);
  assert.equal(page.chat.hasAttribute('data-cgstudio-highlight'), false);
});

test('detects screenshot-style expandable folder headings without URLs or Project IDs', async () => {
  const fixture = `<nav id="sidebar"><h2>Pinned</h2><button><svg></svg>Library</button>
    <section><div class="cursor-pointer"><svg></svg><span class="truncate">Co-op</span><button aria-haspopup="menu" aria-label="More options"><svg></svg></button></div>
      <div><a href="/c/internships">Search Summer 2027 Internships</a><a href="/c/resume">Resume fixes</a><button>Show more</button></div>
    </section>
    <section><button aria-expanded="true" aria-controls="course-chats"><svg></svg><span>CS480</span></button>
      <div id="course-chats"><a href="/c/ass1">ass1</a><a href="/c/perceptron">Perceptron Hint</a><button>Show more</button></div>
    </section>
    <section><button aria-expanded="false"><svg></svg><span>CS486</span></button></section>
    <button aria-expanded="false"><svg></svg>New project</button>
    <button aria-haspopup="menu"><svg></svg>Account</button>
  </nav><main><div class="cursor-pointer"><svg></svg>Not a folder</div><a href="/c/message-reference">Message link</a></main>`;
  const page = await setup({}, fixture);
  const folders = page.discover().items.filter(item => item.type === 'folder');
  assert.deepEqual(folders.map(item => item.title), ['Co-op', 'CS480', 'CS486']);
  const coop = folders.find(item => item.title === 'Co-op');
  page.update({ items: { [coop.id]: { title: coop.title, color: '#aabbcc', textColor: '#123456', icon: 'data:image/png;base64,AAAA' } } });
  const row = page.document.querySelector('.cursor-pointer');
  assert.equal(row.style.getPropertyValue('--cgstudio-color'), '#aabbcc');
  assert.equal(row.style.getPropertyValue('--cgstudio-item-text'), '#123456');
  assert.equal(row.querySelectorAll('[data-cgstudio-icon]').length, 1);
  assert.equal(row.querySelectorAll('[data-cgstudio-original-icon]').length, 1);
  assert.equal(row.querySelector('button svg').hasAttribute('data-cgstudio-original-icon'), false);
  assert.equal(page.document.querySelector('a[href="/c/internships"]').hasAttribute('data-cgstudio-highlight'), false);
  page.document.getElementById('course-chats').remove();
  page.update({});
  assert.equal(page.discover().items.find(item => item.title === 'CS480').id, model.folderLabelId('CS480'));
  assert.equal(row.querySelector('[data-cgstudio-icon]'), null);
  assert.equal(row.querySelector('[data-cgstudio-original-icon]'), null);
  const reloaded = await setup({ items: { [coop.id]: { title: 'Co-op', color: '#aabbcc' } } }, fixture);
  assert.equal(reloaded.document.querySelector('.cursor-pointer').hasAttribute('data-cgstudio-highlight'), true);
});
test('recognizes grouped linked headings but excludes standalone GPT and external links', async () => {
  const page = await setup({}, `<nav>
    <a href="/g/g-alone"><svg></svg>Standalone GPT</a>
    <section><a href="/g/g-course"><svg></svg>CS480</a><div><a href="/c/course-chat">Assignment</a></div></section>
    <section><a href="https://example.com"><svg></svg>External</a><div><a href="/c/other-chat">Other</a></div></section>
  </nav>`);
  assert.deepEqual(page.discover().items.filter(item => item.type === 'folder').map(item => item.title), ['CS480']);
});
