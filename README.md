# ChatGPT Studio

A dependency-free Chrome extension to customize ChatGPT with project/folder highlights, individual chat highlights, background colors or images, and uploaded project icons.

## Install

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this directory (the one containing `manifest.json`).
4. Open or reload `https://chatgpt.com`, then expand its sidebar.
5. Pin **ChatGPT Studio** from Chrome's Extensions menu and click its icon.

## Customize

- **Appearance:** choose Default, Solid color, or Image. Upload a PNG, JPG or WebP background and adjust dimming.
- **Font color:** set a global color for ChatGPT text and sidebar labels in Appearance. Each folder and chat also has its own font color picker. **Use default** removes that override. Disabling styling restores ChatGPT's colors.
- **Folders:** ChatGPT **Projects** are treated as folders. Choose a highlight color, or upload an image icon. Icons are cropped to a square.
- **Chats:** search the conversations detected in the sidebar and choose a preset or custom highlight color.
- Click **↻** after expanding Projects or loading more sidebar conversations to refresh the list. Previously styled items remain available even when absent from the current sidebar.
- Opening the Folders or Chats tab refreshes sidebar detection automatically. Detection includes links outside older navigation containers, buttons with Project IDs, and rows with Project URLs in metadata. Links inside conversation content are excluded.
- Expandable folder headings with icons are also detected without URLs or Project IDs, using their adjacent chat lists or expansion controls. For these rows, styling is saved by folder name; renaming a folder requires choosing its style again, and folders with identical names share a style.
- Use the top switch to disable styling while keeping your choices. Use the × on an item to clear its style. Click **Reset styles** twice to clear all customization.

Changes are saved automatically to Chrome's local extension storage and applied to open ChatGPT tabs. Images are resized locally (1920px backgrounds; 128px icons). Uploads are limited to 10 MB and 40 megapixels. No server, analytics, remote dependencies, or API key is used.

## Scope and permissions

`storage` saves preferences and image data on this device; `activeTab` lets the popup identify and message the current tab. Content scripts run only on `chatgpt.com` and the legacy `chat.openai.com` domain. They inspect navigation links, not conversation message content. This extension does not create folders, move chats, or change ChatGPT's underlying data.

ChatGPT's interface can change. Detection recognizes sidebar links with `/c/<id>`, `/g/g-p-<id>` (including `/project`), `/g/g-<id>/project`, `/project/<id>`, and `/projects/<id>` routes, including chats nested under a project, plus Project rows with ID or URL metadata. Only Projects and chats rendered in the sidebar can be discovered. Background transparency depends on ChatGPT's layout classes. A real signed-in browser check is needed when ChatGPT changes those structures.

## Development

No build or install step is needed. Edit the files, click Reload on `chrome://extensions`, then reload ChatGPT. Open `popup.html` in a browser for a disconnected appearance preview.

Run `npm ci` to install development test dependencies, then `npm test` for route, stored-data validation, and content-script integration checks against HTML fixtures. Run `npm run check` for JavaScript syntax validation. The extension itself needs no installed dependencies or build step.

For manual testing in Chrome, check a chat highlight and a Project highlight/icon; navigate between chats; upload and remove a background; toggle styling off/on; close and reopen the popup; refresh the page; and verify a second ChatGPT tab receives the same styles. Verify menus and chat links still work.

Built using Chrome's [Manifest V3](https://developer.chrome.com/docs/extensions/reference/manifest) and [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) APIs.
