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
11. **Export Options**: HTML export with embedded styles
12. **Zen Mode**: Distraction-free writing mode
13. **Auto-save**: Configurable auto-save functionality

### File Structure
```
mrxdown/
├── main.js           # Main Electron process
├── preload.js        # Secure IPC bridge
├── index.html        # Main UI structure
├── renderer.js       # Frontend logic
├── package.json      # Project configuration
├── README.md         # Project documentation
├── CLAUDE.md         # Development guide
└── .gitignore        # Git ignore rules
```

### Keyboard Shortcuts
- **File Operations**: Cmd/Ctrl + N (New), O (Open), S (Save), Shift+S (Save As)
- **Formatting**: Cmd/Ctrl + B (Bold), I (Italic), K (Link), ` (Code), T (Table)
- **Headings**: Cmd/Ctrl + 1-6 (H1-H6)
- **Search**: Cmd/Ctrl + F (Find), H (Replace)
- **View**: Cmd/Ctrl + \ (Sidebar), Shift+Z (Zen Mode)
- **Export**: Cmd/Ctrl + Shift + E (HTML), P (PDF)
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