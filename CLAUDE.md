# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MrxDown is an Electron-based desktop Markdown editor with live preview, dark/light themes, multi-tab editing, PDF/HTML export, and a headless CLI mode for Markdown→PDF conversion. The UI is entirely in German.

## Commands

```bash
npm install              # Install dependencies
npm start                # Run the app (GUI mode)
npm test                 # Run all 65 unit tests (Jest)
npm run test:e2e         # E2E: launches the real app headless (tests/e2e/), ~10 scenarios + CLI-PDF roundtrip
npm run test:all         # Unit + E2E
npx jest tests/heading-id.test.js  # Run a single test file
node tests/e2e/run.js layout       # Run a single E2E scenario (filename filter)
npm run build:editor     # Rebuild CodeMirror bundle after changing src/codemirror-setup.js
npm run build:hljs       # Rebuild highlight.js bundle after changing src/hljs-entry.js
npm run build:vendor     # Both of the above
npm run build-mac-local  # Build macOS .app + strip quarantine for local testing
npm run build-mac        # Build macOS (ZIP only, no DMG)
npm run build-win        # Build Windows (NSIS installer)
npm run build-linux      # Build Linux (AppImage + deb)
```

### Local Install (macOS)

```bash
npm run install-mac   # build + stable self-signed sign + install to /Applications + launch
```

`scripts/install-macos.sh` signs with a persistent self-signed cert (keychain
`mrxdown-signing.keychain-db`) so Gatekeeper treats every rebuild as the same
trusted app; it gracefully quits a running instance (never kills — aborts if a
save dialog blocks quit). Fallback: `npm run build-mac-local` + manual copy.

### Release

Push a version tag to trigger CI builds for all platforms with GitHub Release:
```bash
# 1. Bump version in package.json
# 2. Commit and push
git tag v0.X.Y && git push origin v0.X.Y
```

Artifact naming: `mrxdown-macos-{arch}.zip`, `mrxdown-windows-x64.exe`, `mrxdown-linux-x64.AppImage`, `MrxDown-PDF.workflow.zip`, plus `mrxdown-cli.sh` and `mrxdown-install-macos.sh` (end-user one-liner installer; root-level `mrxdown-*` files are auto-attached by the release glob). CI skips DMG (hdiutil fails on GitHub runners); build locally for DMG.

## Architecture

Electron app with strict process separation:

```
main.js              -> Main process: window, menus, IPC handlers, file I/O,
                        CLI/headless mode, auto-updater
src/main/export/     -> Export core: registry.js (format catalog) + formats/{html,pdf}.js,
                        frontmatter.js (pure, jest-tested), pdf-templates.js, pdf-html.js,
                        pdf-render.js, images.js, context.js (DI for settings/currentFilePath;
                        APP_ROOT resolves pdf-templates/ + vendor/ paths in dev AND asar)
src/renderer/        -> Renderer process, 13 ordered classic-script modules (01-core … 13-motion).
                        NOT ESM: top-level declarations are shared globals; the script-tag order
                        in index.html is load-bearing (02-state declares all shared state).
index.html           -> UI structure (CSS in separate files, no inline styles); loads the renderer modules in order
preload.js           -> IPC bridge: ~30 methods via contextBridge.exposeInMainWorld('electronAPI', {...})
editor-utils.js      -> Pure functions shared between renderer (browser) and tests (Node.js)
callouts.js          -> E4: marked extension for > [!NOTE] callouts — dual-use (renderer preview
                        AND CLI-PDF in main.js), so both paths emit identical callout HTML
wikilinks.js         -> E1: [[Wiki-Link]] marked extension + pure resolver/target-scan — dual-use
                        (renderer resolves against the vault index; headless renders label-only;
                        main uses extractWikiTargets for the backlinks scan)
icons.js             -> Lucide SVG icon helper: getIcon(name, size) returns SVG strings
cm-adapter.js        -> EditorAdapter class: textarea-compatible wrapper around CodeMirror 6
src/codemirror-setup.js -> CM6 ESM entry point, bundled via esbuild into vendor/codemirror-bundle.js
src/hljs-entry.js    -> highlight.js entry point, bundled into vendor/highlight.min.js
css/                 -> 8 CSS files: variables (M3-Expressive design tokens — see below), motion
                        (spring keyframes/reduced-motion), layout, toolbar, tabs, editor, preview, components
pdf-templates/       -> PDF export templates: templates.json manifest + <name>.css (default, academic, minimal)
vendor/              -> Generated/vendored bundles: marked, purify, codemirror-bundle, highlight,
                        mermaid, katex, morphdom + hljs/katex CSS
mrxdown-cli.sh       -> macOS CLI wrapper (installed to /usr/local/bin/mrxdown)
build/mrxdown.cmd    -> Windows CLI wrapper (shipped next to the .exe)
```

### IPC Communication

All renderer-main communication goes through `preload.js`. The renderer calls `window.electronAPI.methodName()`, which maps to `ipcRenderer.send/invoke`. Main process handles via `ipcMain.on/handle`. Context isolation is enforced.

### CLI / Headless Mode

`main.js` parses `process.argv.slice(app.isPackaged ? 1 : 2)` (packaged builds have no script path at `[1]`). `isHeadlessMode()` is true when `--to <format>` or `--pdf` is passed with paths, or the file argument is a directory (legacy → PDF batch):

- `--to pdf|html|docx|slides` + files/dirs → `src/main/cli.js` `runCli()` converts everything in one loop (multiple args = shell globs; dirs expand to their .md files). `--pdf` is an alias for `--to pdf`.
- Otherwise → GUI mode; the file argument opens in the editor
- CLI marked instance gets the callout extension AND the preview's heading-ID renderer (editor-utils.js) — anchors work in CLI HTML/PDF. Beware the `--to`-value filter when touching arg parsing: with no `--to`, `toFlagIdx+1` is 0 and must not exclude the first path (regression caught by cli-pdf.js).

Key constraints:
- **GUI mode uses a single-instance lock** (second launch forwards the file to the running window via `second-instance`); headless mode deliberately skips the lock.
- **The global `window-all-closed` auto-quit must bail out when `isHeadlessMode()`** — batch mode opens/closes a hidden pdfWindow per file, and the auto-quit previously killed the loop after file 1. CLI paths exit explicitly via `app.exit()`.
- **KaTeX math is rendered server-side in CLI mode** (`renderMathForCLI()` in main.js) because the renderer's browser-side KaTeX isn't available headlessly. Mermaid blocks are skipped in CLI output.
- Wrappers: `mrxdown-cli.sh` (macOS, keeps the sandbox ON — do not add `--no-sandbox`), `build/mrxdown.cmd` (Windows), and an xvfb-run recipe for headless Linux servers (README "Headless-Installation").

### Key Patterns

- **Tab state**: `tabs` array in renderer.js holds all open tab state (content, filePath, cursorPosition, isModified). `activeTabId` tracks current tab. `saveCurrentTabState()` must be called before switching tabs.
- **Preview pipeline** (`renderMarkdown()` in renderer.js): marked.js with a custom heading renderer → DOMPurify sanitization → post-processing on a detached container (fix heading IDs, hljs code highlighting, extract Mermaid blocks) → **morphdom** diffs the new DOM into the live preview (preserves scroll position) → Mermaid diagrams render async afterwards (mermaid lazy-loads on first diagram). Debounced (150ms normal, 500ms for large files).
- **CSS / design tokens**: Material 3 Expressive token system in `css/variables.css` — `--md-*` color roles (dark on `:root`, light overridden by `body.light-theme`), shape scale, state-layer opacities, and physically-sampled spring easings (`--motion-spatial-*` with overshoot, `--motion-effects-*` monotonic) as CSS `linear()` curves. Legacy vars (`--background-dark`, `--accent-blue`, …) are aliases declared on `body` — NOT `:root`, because var() references inside custom properties resolve at the declaring element; on `:root` the dark values would be baked in before the light-theme override. Style components via tokens only; no raw rgba-white overlays. `css/motion.css` holds all keyframes/transitions plus the global `prefers-reduced-motion` guard; `src/renderer/13-motion.js` drives the ripple and the circular-reveal theme switch (View Transitions API — theme class changes are ASYNC inside the transition callback; E2E tests must await ~350ms after `toggleTheme()`).
- **Paste pipeline (K6)**: one document-level paste listener in 12-features.js, registered in the CAPTURE phase — CodeMirror's own paste handler on `.cm-content` otherwise inserts text/plain and consumes the event before any bubble listener runs. Precedence: image → URL-over-selection → HTML→Markdown (Turndown + GFM plugin, vendored `vendor/turndown*.min.js`, rebuilt via `npm run build:turndown`) → native. Conversion decision is the pure `shouldConvertHtmlPaste()` in editor-utils.js (skips plain wrappers, own-editor copies via `cm-` classes, code fences); output runs through `cleanupPastedMarkdown()`. Toggle: `settings.pasteHtmlAsMarkdown`; ⌘⇧V (`paste-plain` menu action) always pastes plain. `.docx`/`.html` drops convert to Markdown into a new unsaved tab (`importDroppedFile`); DOCX goes through the `convert-docx-to-html` IPC (mammoth, lazy-required, Uint8Array payload — `File.path` no longer exists in Electron 43).
- **CodeMirror 6**: `src/codemirror-setup.js` bundles to `vendor/codemirror-bundle.js` (IIFE, global `CMSetup`). `cm-adapter.js` wraps CM6 in a textarea-compatible `EditorAdapter` class. Tab/Enter keys are filtered from CM6 defaults so the app handles smart list continuation and table navigation.
- **Slash commands (E2)**: `/` at line start triggers `showAutocompleteSlashCommands` (05-editor.js) — built-ins live in `SLASH_COMMANDS` (editor-utils.js, pure data), custom ones in `settings.snippets` (managed via `#snippetsModal`, 12-features.js). Bodies expand through `expandSnippet()` ({{date}}/{{time}}/{{title}}/{{cursor}}).
- **Wiki-Links (E1)**: vault = loaded sidebar folder (`fileTreeRootDir`), else the active file's directory (`currentVaultRoot()` in 07-files-menu.js). `refreshVaultIndex()` pulls the recursive index via `get-vault-index` IPC and re-renders; the marked extension's resolver reads the `vaultIndex` global at render time. Click handling lives in the preview link interceptor (10-dialogs.js, checked BEFORE href handling); `[[`-autocomplete reuses the fence popup (05-editor.js) and must consume closeBrackets' auto-inserted `]]`. Backlinks: `find-backlinks` IPC scans vault files (512 KB cap) with `extractWikiTargets`.
- **Icons**: `icons.js` provides `getIcon(name, size)` returning inline Lucide SVG strings with `stroke="currentColor"` for automatic theme adaptation.
- **Export registry (K1)**: `src/main/export/registry.js` — every target format is a module `{ id, label, ext, mime, filters, needs, optionsPanel, toBuffer(doc) }`; `needs` tells the renderer which doc fields to send (`fullHtml` | `previewHtml` | `rawMarkdown`). IPC: `get-export-formats` (catalog) + `export-document` (invoke; validates formatId/fields/options main-side). The shared export dialog (`Cmd+Shift+E`, `#exportModal` in index.html, logic in 12-features.js) picks the format and shows its options section. Legacy channels `export-html`/`print-to-pdf`/`print-to-pdf-options` stay wired to the same format modules. Formats: html, pdf, docx (K2: @turbodocx/html-to-docx from preview HTML, frontmatter → docProps, optional OOXML TOC field via jszip post-pass — jest-tested with a mammoth roundtrip), slides (K4: self-contained reveal.js HTML; `splitSlides()` in editor-utils.js splits on ---/=== preceded by a blank line, `<!-- notes: … -->` → speaker notes; needs rawMarkdown, rendered via the shared main-process marked in src/main/export/markdown.js). New formats (EPUB, …) register in registry.js.
- **PDF generation**: `src/main/export/` has `buildPdfHtml()` (pdf-html.js) and `generatePdfSimple`/`generatePdfWithOptions` (formats/pdf.js) shared by all PDF export paths (single, batch, CLI). Uses Chromium's `printToPDF` (Electron 43 / Chromium 150: `@page` margin boxes with `counter(page)` work natively — they were silently ignored before Chromium 131 — and `generateDocumentOutline` produces bookmarks). Every export path runs a pdf-lib metadata post-pass (`finalizePdfMetadata`: frontmatter → Title/Author/Keywords). TOC page numbers are two-pass: print → read outline via pdfjs-dist (`mapHeadingsToPages`) → reprint with numbers. CLI renders mermaid fences in the hidden print window (`renderMermaidForCLI` + vendor mermaid injection in `buildPdfHtml`); wait condition before printing is `document.fonts.ready` + `img.decode()` + `window.__mermaidReady` (`PDF_SMART_WAIT_JS`). The stylesheet comes from `pdf-templates/<name>.css`; `templates.json` declares each template's name/description and `titlePageFields`. YAML frontmatter in the document feeds `renderTitlePage()` (title, author, abstract, ...). Renderer fetches the template list via the `get-pdf-templates` IPC handle.
- **Auto-updater**: electron-updater, lazy-required in `initAutoUpdater()` (main.js) so dev mode doesn't load it. Only runs in packaged GUI builds, deferred 3s after window creation; `autoDownload` + `autoInstallOnAppQuit` are on, plus a manual "check for updates" menu item.
- **Settings**: `main.js` reads/writes `settings.json` and `recent-files.json` in `app.getPath('userData')`.
- **Global function exposure**: Functions used in HTML `onclick` handlers must be assigned to `window.*` in the `DOMContentLoaded` listener at the top of renderer.js.

### Heading ID Algorithm

Duplicated in three places (renderer.js custom renderer, renderer.js post-processing, editor-utils.js). Algorithm: lowercase, replace emojis with `-`, replace spaces with `-`, REMOVE (don't replace) special chars like `&`, `/`, `:`, keep German umlauts, don't collapse multiple dashes, trim trailing dashes. `"DNS & DHCP"` becomes `"dns--dhcp"` (double dash).

**Critical**: `DOMPurify.sanitize()` must include `ADD_ATTR: ['id']` or heading IDs get stripped.

### Tests

Tests in `tests/` cover pure functions from `editor-utils.js` and `src/main/export/`:

- `heading-id.test.js` — GitHub-compatible ID generation
- `frontmatter.test.js` — YAML-lite frontmatter parsing (`src/main/export/frontmatter.js`)
- `paste-markdown.test.js` — HTML-paste conversion heuristic + markdown cleanup (K6)
- `callouts.test.js` — callout header parsing + marked extension rendering (E4)
- `docx-export.test.js` — DOCX format module: mammoth roundtrip, docProps, TOC field (K2)
- `slides.test.js` — slide splitting edge cases + self-contained reveal.js generation (K4)
- `wikilinks.test.js` — wiki-link parsing, vault resolution, marked extension (E1)
- `slash-commands.test.js` — snippet placeholder expansion + built-in command catalog (E2)
- `smart-enter.test.js` — List continuation logic
- `indent.test.js` — Block indent/unindent
- `toggle-comment.test.js` — HTML comment toggling
- `wrap-selection.test.js` — Bold/italic/code toggle detection

`editor-utils.js` uses conditional `module.exports` to work in both browser and Node.js. To add testable logic, extract pure functions there.

E2E tests live in `tests/e2e/`: `run.js` spawns one Electron process per `scenarios/*.e2e.js` file via a root-level entry shim (`.e2e-entry.js`, auto-generated — the app resolves `index.html` against the entry script's directory). Each scenario gets a driver (`exec`, `setContent`, `resize`, `assert*`) and runs against the real app with an isolated userData profile. `cli-pdf.js` covers the headless single-file and batch PDF paths; `cli-convert.js` covers `--to html|docx` roundtrips (mammoth read-back), multi-arg globs, and error exits. Both CI workflows gate on unit + E2E tests.

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- **build.yml**: Runs on every push to main. Tests + builds for macOS (ZIP only), Windows (NSIS), Linux (AppImage + deb).
- **release.yml**: Triggered by `v*` tags. Same builds + creates GitHub Release with SHA256 checksums. Also zips `build/MrxDown PDF.workflow` + `install-quick-action.command` as macOS Quick Action artifact.

macOS CI builds ZIP only (no DMG) because `hdiutil` fails on GitHub runners. Ubuntu runners require specific apt packages (see workflow) — `libgconf-2-4` was removed for Ubuntu 24.04 (Noble) compatibility.

### App Icon (`assets/`)

- `assets/icon.icns` — macOS (Big-Sur-Grid: 824px-Kachel, 185px-Radius, 100px-Rand, gebackener Schatten). `assets/icon.png` — full-bleed 1024px für Windows (electron-builder erzeugt daraus die .ico) und Linux; auch das Fenster-Icon in main.js.
- Quellen + Render-Pipeline: `assets/icon-src/` (`icon-macos.svg`, `icon-fullbleed.svg`, `render-icon.js` — SVG→PNG via `electron render-icon.js <svg> <png>`, dann `sips`+`iconutil` für das .icns). macOS-Artwork NIE full-bleed ausliefern und umgekehrt.

### Build Assets (`build/`)

- **`MrxDown PDF.workflow/`** — macOS Automator Quick Action for Finder → PDF conversion. Includes `Info.plist` (required for service registration) and `document.wflow`.
- **`install-quick-action.command`** — Double-clickable installer: copies workflow to `~/Library/Services/`, clears quarantine, registers in pbs with `ContextMenu=1`, restarts Finder. Without this, macOS won't show the service in the Finder context menu.
- **`installer.nsh`** — NSIS custom macros for Windows. `customInstall` registers `.md`/`.markdown` context menu entries in `HKCU\Software\Classes\`, `customUnInstall` removes them. Auto-detected by electron-builder (no package.json config needed).
- **`mrxdown.cmd`** — Windows CLI wrapper, copied next to the installed .exe via `extraFiles`.
