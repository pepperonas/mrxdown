# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MrxDown is an Electron-based desktop Markdown editor with live preview, dark/light themes, multi-tab editing, and PDF/HTML export. The UI is entirely in German.

## Commands

```bash
npm install              # Install dependencies
npm start                # Run the app (GUI mode)
npm test                 # Run all 65 tests (Jest)
npx jest tests/heading-id.test.js  # Run a single test file
npm run build:editor     # Rebuild CodeMirror bundle after changing src/codemirror-setup.js
npm run build-mac-local  # Build macOS .app + strip quarantine for local testing
npm run build-mac        # Build macOS (ZIP only, no DMG)
npm run build-win        # Build Windows (NSIS installer)
npm run build-linux      # Build Linux (AppImage + deb)
```

### Local Install (macOS)

```bash
npm run build-mac-local
rm -rf /Applications/MrxDown.app
cp -R dist/mac-arm64/MrxDown.app /Applications/
```

### Release

Push a version tag to trigger CI builds for all platforms with GitHub Release:
```bash
# 1. Bump version in package.json
# 2. Commit and push
git tag v0.X.Y && git push origin v0.X.Y
```

Artifact naming: `mrxdown-macos-{arch}.zip`, `mrxdown-windows-x64.exe`, `mrxdown-linux-x64.AppImage`, `MrxDown-PDF.workflow.zip`. CI skips DMG (hdiutil fails on GitHub runners); build locally for DMG.

## Architecture

Electron app with strict process separation:

```
main.js              -> Main process: window, menus, IPC handlers, file I/O, PDF generation
renderer.js          -> Renderer process: all UI logic, editor, tabs, formatting, search
index.html           -> UI structure (CSS in separate files, no inline styles)
preload.js           -> IPC bridge: ~30 methods via contextBridge.exposeInMainWorld('electronAPI', {...})
editor-utils.js      -> Pure functions shared between renderer (browser) and tests (Node.js)
icons.js             -> Lucide SVG icon helper: getIcon(name, size) returns SVG strings
cm-adapter.js        -> EditorAdapter class: textarea-compatible wrapper around CodeMirror 6
src/codemirror-setup.js -> CM6 ESM entry point, bundled via esbuild into vendor/codemirror-bundle.js
css/                 -> 7 CSS files: variables, layout, toolbar, tabs, editor, preview, components
vendor/              -> marked.min.js, purify.min.js, codemirror-bundle.js (generated)
```

### IPC Communication

All renderer-main communication goes through `preload.js`. The renderer calls `window.electronAPI.methodName()`, which maps to `ipcRenderer.send/invoke`. Main process handles via `ipcMain.on/handle`. Context isolation is enforced.

### Key Patterns

- **Tab state**: `tabs` array in renderer.js holds all open tab state (content, filePath, cursorPosition, isModified). `activeTabId` tracks current tab. `saveCurrentTabState()` must be called before switching tabs.
- **Markdown rendering**: `renderMarkdown()` uses marked.js with a custom heading renderer + DOMPurify sanitization + post-processing to fix heading IDs. Debounced (150ms normal, 500ms for large files).
- **CSS**: 7 files under `css/`. Theme switching uses CSS variables on `:root` overridden by `body.light-theme`.
- **CodeMirror 6**: `src/codemirror-setup.js` bundles to `vendor/codemirror-bundle.js` (IIFE, global `CMSetup`). `cm-adapter.js` wraps CM6 in a textarea-compatible `EditorAdapter` class. Tab/Enter keys are filtered from CM6 defaults so the app handles smart list continuation and table navigation.
- **Icons**: `icons.js` provides `getIcon(name, size)` returning inline Lucide SVG strings with `stroke="currentColor"` for automatic theme adaptation.
- **PDF generation**: `main.js` has `getPdfStylesheet()` and `buildPdfHtml()` shared by all PDF export paths (single, batch, CLI). Uses Chromium's `printToPDF`.
- **Settings**: `main.js` reads/writes `settings.json` and `recent-files.json` in `app.getPath('userData')`.
- **Global function exposure**: Functions used in HTML `onclick` handlers must be assigned to `window.*` in the `DOMContentLoaded` listener at the top of renderer.js.

### Heading ID Algorithm

Duplicated in three places (renderer.js custom renderer, renderer.js post-processing, editor-utils.js). Algorithm: lowercase, replace emojis with `-`, replace spaces with `-`, REMOVE (don't replace) special chars like `&`, `/`, `:`, keep German umlauts, don't collapse multiple dashes, trim trailing dashes. `"DNS & DHCP"` becomes `"dns--dhcp"` (double dash).

**Critical**: `DOMPurify.sanitize()` must include `ADD_ATTR: ['id']` or heading IDs get stripped.

### Tests

Tests in `tests/` cover pure functions from `editor-utils.js`:

- `heading-id.test.js` — GitHub-compatible ID generation
- `smart-enter.test.js` — List continuation logic
- `indent.test.js` — Block indent/unindent
- `toggle-comment.test.js` — HTML comment toggling
- `wrap-selection.test.js` — Bold/italic/code toggle detection

`editor-utils.js` uses conditional `module.exports` to work in both browser and Node.js. To add testable logic, extract pure functions there.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- **build.yml**: Runs on every push to main. Tests + builds for macOS (ZIP only), Windows (NSIS), Linux (AppImage + deb).
- **release.yml**: Triggered by `v*` tags. Same builds + creates GitHub Release with SHA256 checksums. Also zips `build/MrxDown PDF.workflow` + `install-quick-action.command` as macOS Quick Action artifact.

macOS CI builds ZIP only (no DMG) because `hdiutil` fails on GitHub runners. Ubuntu runners require specific apt packages (see workflow) — `libgconf-2-4` was removed for Ubuntu 24.04 (Noble) compatibility.

### Build Assets (`build/`)

- **`MrxDown PDF.workflow/`** — macOS Automator Quick Action for Finder → PDF conversion. Includes `Info.plist` (required for service registration) and `document.wflow`.
- **`install-quick-action.command`** — Double-clickable installer: copies workflow to `~/Library/Services/`, clears quarantine, registers in pbs with `ContextMenu=1`, restarts Finder. Without this, macOS won't show the service in the Finder context menu.
- **`installer.nsh`** — NSIS custom macros for Windows. `customInstall` registers `.md`/`.markdown` context menu entries in `HKCU\Software\Classes\`, `customUnInstall` removes them. Auto-detected by electron-builder (no package.json config needed).
