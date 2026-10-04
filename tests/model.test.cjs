const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLink, normalize, isImage } = require('../model.js');

test('recognizes chats, nested project chats, and project folders with stable IDs', () => {
  assert.deepEqual(parseLink('/c/abc-123?model=auto'), { id: 'chat:abc-123', type: 'chat' });
  assert.deepEqual(parseLink('/g/g-p-123/c/chat-456'), { id: 'chat:chat-456', type: 'chat' });
  assert.deepEqual(parseLink('/g/g-p-123/project'), { id: 'folder:g-p-123', type: 'folder' });
  assert.deepEqual(parseLink('/g/g-p-123'), { id: 'folder:g-p-123', type: 'folder' });
  assert.deepEqual(parseLink('/project/abc-123/'), { id: 'folder:abc-123', type: 'folder' });
  assert.deepEqual(parseLink('https://chat.openai.com/c/abc'), { id: 'chat:abc', type: 'chat' });
});
test('ignores custom GPTs, unrelated pages, outside sites, and unsafe protocols', () => {
  for (const link of ['/g/g-123-example', '/settings', '/', 'https://evil.example/c/abc', 'javascript:alert(1)', 'http://chatgpt.com/c/abc', '/c/abc/extra']) {
    assert.equal(parseLink(link), null, link);
  }
});
test('sanitizes stored data before using it in styles and image sources', () => {
  const value = normalize({ enabled: false, background: { mode: 'image', color: 'red; display:none', image: 'https://tracker.example/img', dim: 300 }, items: {
    'folder:one': { title: '<img onerror=alert(1)>', color: '#aabbcc', icon: 'data:image/svg+xml;base64,AAAA' },
    'chat:two': { title: 'Chat', color: 'url(evil)', icon: 'data:image/png;base64,AAAA' },
    'invalid:id': { color: '#ffffff' }, '__proto__': { title: 'wrong' }
  } });
  assert.equal(value.enabled, false);
  assert.equal(value.background.color, '#171923');
  assert.equal(value.background.image, '');
  assert.equal(value.background.dim, 80);
  assert.equal(value.items['folder:one'].color, '#aabbcc');
  assert.equal(value.items['folder:one'].icon, '');
  assert.equal(value.items['chat:two'].color, '');
  assert.equal(value.items['chat:two'].icon, '');
  assert.equal(Object.keys(value.items).length, 2);
  assert.equal(isImage('data:image/webp;base64,AAAA'), true);
  assert.equal(isImage('data:image/webp;base64,AAAA";color:red'), false);
});
test('defaults are independent and preserve valid customization', () => {
  const a = normalize();
  a.background.color = '#ffffff';
  assert.equal(normalize().background.color, '#171923');
  const stored = { enabled: true, background: { mode: 'color', color: '#123456', dim: 20 }, items: { 'folder:abc': { title: 'Work', color: '#AABBCC', icon: 'data:image/png;base64,AAAA' } } };
  const cleaned = normalize(stored);
  assert.equal(cleaned.items['folder:abc'].icon, stored.items['folder:abc'].icon);
  assert.equal(cleaned.items['folder:abc'].type, 'folder');
  assert.equal(cleaned.background.color, '#123456');
  assert.deepEqual(normalize(cleaned), cleaned);
});
