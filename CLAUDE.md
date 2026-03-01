# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MrxDown is an Electron-based desktop Markdown editor with live preview, dark/light themes, multi-tab editing, and PDF/HTML export. The UI is entirely in German.

## Commands

```bash
npm install          # Install dependencies
npm start            # Run the app (GUI mode)
npm test             # Run all 65 tests (Jest)
npx jest tests/heading-id.test.js  # Run a single test file
npm run build-mac    # Build macOS app
npm run dist         # Create distribution package
```

## Architecture

Four-file Electron app with strict process separation:

```
main.js        → Main process: window, menus, IPC handlers, file I/O, PDF generation
renderer.js    → Renderer process: all UI logic, editor, tabs, formatting, search
index.html     → UI structure + all CSS (no separate stylesheet files)
preload.js     → IPC bridge: exposes ~30 methods via contextBridge.exposeInMainWorld('electronAPI', {...})
editor-utils.js → Pure functions shared between renderer (browser) and tests (Node.js)
vendor/        → Bundled marked.min.js + purify.min.js (no CDN dependencies)
```

### IPC Communication Pattern

All renderer↔main communication goes through `preload.js`. The renderer calls `window.electronAPI.methodName()`, which maps to `ipcRenderer.send/invoke`. Main process handles via `ipcMain.on/handle`. Never use `window.require('electron')` in the renderer — context isolation is enforced.

### Key Architectural Patterns

- **Tab state**: `tabs` array in renderer.js holds all open tab state (content, filePath, cursorPosition, isModified). `activeTabId` tracks the current tab. `saveCurrentTabState()` must be called before switching tabs.
- **Markdown rendering**: `renderMarkdown()` uses marked.js with a custom heading renderer + DOMPurify sanitization + post-processing to fix heading IDs. Rendering is debounced (150ms normal, 500ms for large files).
- **All CSS lives in index.html** inside a single `<style>` tag. Theme switching uses CSS variables on `:root` overridden by `body.light-theme`.
- **PDF generation**: `main.js` has `getPdfStylesheet()` and `buildPdfHtml()` shared by all PDF export paths (single, batch, CLI). Uses Chromium's `printToPDF`.
- **Settings persistence**: `main.js` reads/writes `settings.json` and `recent-files.json` in `app.getPath('userData')`.
- **Global function exposure**: Functions used in HTML `onclick` handlers must be assigned to `window.*` in the `DOMContentLoaded` listener at the top of renderer.js.

### GitHub-Compatible Heading ID Algorithm

This is the most complex piece of logic, duplicated in three places (renderer.js custom renderer, renderer.js post-processing, editor-utils.js). The algorithm: lowercase → replace emojis with `-` → replace spaces with `-` → REMOVE (don't replace) special chars like `&`, `/`, `:` → keep German umlauts → don't collapse multiple dashes → trim trailing dashes. This means `"DNS & DHCP"` becomes `"dns--dhcp"` (double dash), not `"dns-dhcp"`.

**Critical**: `DOMPurify.sanitize()` must include `ADD_ATTR: ['id']` or heading IDs get stripped. Electron's `printToPDF()` does NOT support clickable internal links in PDFs.

### Test Structure

Tests are in `tests/` and cover pure functions from `editor-utils.js` plus standalone logic tests:

- `heading-id.test.js` — GitHub-compatible ID generation
- `smart-enter.test.js` — List continuation logic
- `indent.test.js` — Block indent/unindent
- `toggle-comment.test.js` — HTML comment toggling
- `wrap-selection.test.js` — Bold/italic/code toggle detection

`editor-utils.js` uses conditional `module.exports` to work in both browser and Node.js. To add testable logic, extract pure functions there.

## macOS Code Signing

Required GitHub Secrets for releases: `CSC_LINK` (base64 .p12), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
