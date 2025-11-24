# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MrxDown is an Electron-based desktop Markdown editor for macOS with live preview functionality. The application uses a split-view design with an editor pane and real-time preview pane.

## Key Commands

**Development:**
```bash
npm install        # Install dependencies
npm start          # Run the application in development mode
```

**Building:**
```bash
npm run build-mac  # Build the macOS application
npm run dist       # Create distribution package (DMG)
```

## macOS Code Signing & Notarization

For production releases on macOS, the app requires code signing and notarization to avoid Gatekeeper warnings. Configure these GitHub Secrets:

**Required GitHub Secrets:**
- `CSC_LINK`: Base64-encoded .p12 certificate file
- `CSC_KEY_PASSWORD`: Password for the .p12 certificate
- `APPLE_ID`: Apple ID email for notarization
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password for Apple ID
- `APPLE_TEAM_ID`: Apple Developer Team ID (10-character string)

**Setup Process:**
1. Export Developer ID Application certificate from Keychain as .p12
2. Convert to base64: `base64 -i certificate.p12 | pbcopy`
3. Add as `CSC_LINK` secret in GitHub repository settings
4. Generate app-specific password at appleid.apple.com
5. Add remaining secrets to GitHub repository settings

## Architecture

The application follows Electron's secure two-process architecture:

- **Main Process** (`main.js`): Manages application lifecycle, window creation, native menus, IPC handlers, and file operations
- **Renderer Process** (`index.html`): Contains the UI with separated JavaScript (`renderer.js`) and CSS
- **Preload Script** (`preload.js`): Provides secure IPC communication between main and renderer processes

### Key Features Implemented

1. **Modern Dark Theme**: Complete Material Design-based dark theme with CSS variables
2. **Tab System**: Multiple file support with tab management
3. **Drag & Drop**: File drag-and-drop functionality
4. **Toolbar**: Modern icon-based toolbar with enhanced tooltips (500ms delay)
5. **Sidebar**: File explorer with navigation
6. **Keyboard Shortcuts**: Comprehensive shortcut system
7. **Live Preview**: Real-time markdown preview with scroll synchronization
8. **Table Editor**: Interactive table insertion with customizable rows/columns
9. **Context Menu**: Right-click context menu with common actions
10. **About Dialog**: Information dialog with developer credits and GitHub link
11. **Export Options**: HTML export with embedded images (base64), PDF export without visual artifacts
12. **Zen Mode**: Distraction-free writing mode
13. **Auto-save**: Configurable auto-save functionality
14. **File Watching**: Automatic detection and reloading of external file changes
15. **Search & Replace**: Advanced search functionality with regex support, case-sensitive options, whole-word matching, and real-time match counting
16. **Batch PDF Export**: Export all open tabs as PDF files to their respective directories with rocket button (🚀)
17. **HTML Export with Anchor Links**: Fully functional anchor navigation in HTML exports with GitHub-compatible heading IDs
18. **CLI Support**: Command-line markdown to PDF conversion without GUI

### File Structure
```
mrxdown/
├── main.js           # Main Electron process
├── preload.js        # Secure IPC bridge
├── index.html        # Main UI structure
├── renderer.js       # Frontend logic
├── mrxdown-cli.sh    # CLI wrapper script
├── package.json      # Project configuration
├── README.md         # Project documentation
├── CLAUDE.md         # Development guide
└── .gitignore        # Git ignore rules
```

### CLI Usage

**Installation:**
```bash
curl -L https://raw.githubusercontent.com/pepperonas/mrxdown/main/mrxdown-cli.sh -o /usr/local/bin/mrxdown
chmod +x /usr/local/bin/mrxdown
```

**Usage:**
```bash
mrxdown /path/to/file.md
```

Creates `file.pdf` in the same directory as the input file. Runs in headless mode without opening the GUI.

### Keyboard Shortcuts
- **File Operations**: Cmd/Ctrl + N (New), O (Open), S (Save), Shift+S (Save As)
- **Formatting**: Cmd/Ctrl + B (Bold), I (Italic), K (Link), ` (Code), T (Table)
- **Headings**: Cmd/Ctrl + 1-6 (H1-H6)
- **Search**: Cmd/Ctrl + F (Find), Cmd/Ctrl + R (Replace)
- **View**: Cmd/Ctrl + \ (Sidebar), Shift+Z (Zen Mode)
- **Export**: Cmd/Ctrl + E (HTML), Cmd/Ctrl + P (PDF)
- **Tabs**: Cmd/Ctrl + Tab (Next), Shift+Tab (Previous)

### Security Features
- Context isolation enabled
- Node integration disabled in renderer
- Secure IPC communication via preload script
- Content Security Policy ready

## Development Notes

- The application uses a modern, secure Electron architecture
- All UI modifications should be made in `index.html` and `renderer.js`
- CSS uses custom properties for consistent theming
- The application is fully responsive and supports both desktop and mobile layouts
- All features are accessible via keyboard shortcuts
- The app supports German localization throughout

## Important Technical Learnings

### HTML Export Anchor Links (renderer.js:389-477)

**Problem:** HTML exports didn't have working anchor links - headings had incorrect IDs that didn't match the GitHub-style anchor links in the markdown.

**Root Cause:** marked.js with `gfm: true` enables automatic ID generation that uses a different algorithm than GitHub's, causing mismatches like:
- Link: `#routing--switching` (double dash from `&`)
- Heading ID: `id="routing-switching"` (single dash - WRONG!)

**Solution:** Two-layer approach to ensure correct IDs:

1. **Custom Renderer (renderer.js:389-424):**
   - Override `marked.Renderer().heading()` function
   - Disable marked.js auto-IDs: `headerIds: false, mangle: false`
   - Generate IDs using GitHub's algorithm

2. **Post-Processing (renderer.js:448-476):**
   - **Critical:** After rendering, re-process all headings with JavaScript
   - Use `querySelectorAll('h1, h2, h3, h4, h5, h6')` to fix IDs
   - This runs in browser context, bypassing Electron's aggressive file caching

**GitHub-Compatible ID Generation Algorithm:**
```javascript
1. Convert to lowercase
2. Replace emojis with `-` (📋 → -)
3. Replace spaces with `-`
4. REMOVE special characters like &, /, : (DON'T replace with dash!)
5. Keep: letters, numbers, hyphens, German umlauts (äöüßÄÖÜ)
6. DON'T collapse multiple dashes (this is key!)
7. Trim trailing dashes
8. Keep ONE leading dash for emoji headings
```

**Examples:**
```javascript
// Special characters create DOUBLE dashes
"Routing & Switching"     → "routing--switching"  // & removed, leaving --
"DNS & DHCP"              → "dns--dhcp"           // NOT dns-dhcp!
"ISO 27001/27002"         → "iso-27001--27002"    // / removed, leaving --

// Emoji headings keep leading dash
"📋 Inhaltsverzeichnis"   → "-inhaltsverzeichnis"

// Normal headings
"1. Grundlagen"           → "1-grundlagen"
```

**Duplicate Handling:**
```javascript
First:  id="section-name"
Second: id="section-name-1"
Third:  id="section-name-2"
```

**Why Post-Processing Was Necessary:**
- Electron caches `renderer.js` aggressively
- marked.js `gfm: true` overrides custom renderers
- Post-processing in browser context always runs fresh
- Ensures IDs are correct regardless of caching issues

**Critical Details:**
- `ADD_ATTR: ['id']` in DOMPurify preserves ID attributes
- Electron's `printToPDF()` does NOT support clickable internal links in PDFs