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

Electron app with strict process separation:

```
main.js              → Main process: window, menus, IPC handlers, file I/O, PDF generation
renderer.js          → Renderer process: all UI logic, editor, tabs, formatting, search
index.html           → UI structure (CSS in separate files, no inline styles)
preload.js           → IPC bridge: exposes ~30 methods via contextBridge.exposeInMainWorld('electronAPI', {...})
editor-utils.js      → Pure functions shared between renderer (browser) and tests (Node.js)
icons.js             → Lucide SVG icon helper: getIcon(name, size) returns SVG strings
cm-adapter.js        → EditorAdapter class: textarea-compatible wrapper around CodeMirror 6
src/codemirror-setup.js → CM6 ESM entry point, bundled via esbuild
css/                 → 7 CSS files: variables, layout, toolbar, tabs, editor, preview, components
vendor/              → marked.min.js, purify.min.js, codemirror-bundle.js (generated)
```

### IPC Communication Pattern

All renderer↔main communication goes through `preload.js`. The renderer calls `window.electronAPI.methodName()`, which maps to `ipcRenderer.send/invoke`. Main process handles via `ipcMain.on/handle`. Never use `window.require('electron')` in the renderer — context isolation is enforced.

### Key Architectural Patterns

- **Tab state**: `tabs` array in renderer.js holds all open tab state (content, filePath, cursorPosition, isModified). `activeTabId` tracks the current tab. `saveCurrentTabState()` must be called before switching tabs.
- **Markdown rendering**: `renderMarkdown()` uses marked.js with a custom heading renderer + DOMPurify sanitization + post-processing to fix heading IDs. Rendering is debounced (150ms normal, 500ms for large files).
- **CSS split into 7 files** under `css/` (variables, layout, toolbar, tabs, editor, preview, components). Theme switching uses CSS variables on `:root` overridden by `body.light-theme`.
- **CodeMirror 6 editor**: `src/codemirror-setup.js` is bundled via esbuild into `vendor/codemirror-bundle.js` (IIFE, global `CMSetup`). `cm-adapter.js` wraps CM6 in a textarea-compatible `EditorAdapter` class so renderer.js needs minimal changes. Rebuild after CM6 changes: `npm run build:editor`.
- **Icons**: `icons.js` provides `getIcon(name, size)` returning inline Lucide SVG strings with `stroke="currentColor"` for automatic theme adaptation.
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
