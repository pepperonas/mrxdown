# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- PDF-Export functionality
- Syntax highlighting in editor
- Mermaid diagram support
- Additional themes

### Changed
- Performance optimizations
- UI improvements

### Fixed
- Minor bug fixes

## [1.0.0] - 2025-01-XX

### Added
- 🌙 Modern Dark Theme with Material Design
- 📑 Multi-Tab Support for multiple files
- 🖱️ Drag & Drop file functionality
- ⚡ Live-Vorschau with real-time markdown rendering
- 📊 Interactive table editor
- 🔧 Formatting toolbar with icons
- 📂 Integrated file explorer sidebar
- 🧘 Zen mode for distraction-free writing
- 💾 Auto-save functionality (configurable)
- 📤 HTML export with embedded styles
- ⌨️ Comprehensive keyboard shortcuts
- 🎯 Search and replace functionality
- 🔗 Easy link and image insertion
- 🖼️ Context menu with common actions
- ℹ️ About dialog with developer information
- 🔄 Scroll synchronization between editor and preview
- 🎨 Tooltip system with delayed appearance
- 🔐 Secure IPC communication with preload script
- 📱 Responsive design for different screen sizes
- 🎭 Print support for preview content
- 🌐 External link handling
- 📋 Tab management with close functionality
- 🎪 Animated UI elements and transitions

### Technical Features
- Built with Electron 28.0.0
- Secure architecture with context isolation
- Cross-platform support (macOS, Windows, Linux)
- Modern CSS with custom properties
- Markdown parsing with marked.js
- HTML sanitization with DOMPurify
- File operations via native dialogs
- Recent files management
- Settings persistence

### Keyboard Shortcuts
- **File Operations**: Cmd/Ctrl + N (New), O (Open), S (Save), Shift+S (Save As)
- **Formatting**: Cmd/Ctrl + B (Bold), I (Italic), K (Link), T (Table), ` (Code)
- **Headings**: Cmd/Ctrl + 1-6 (H1-H6)
- **Navigation**: Cmd/Ctrl + F (Find), H (Replace), \ (Sidebar), Shift+Z (Zen Mode)
- **Export**: Cmd/Ctrl + Shift + E (HTML)
- **Tabs**: Cmd/Ctrl + Tab (Switch tabs)

### Build Targets
- **macOS**: DMG and ZIP for Intel & Apple Silicon
- **Windows**: NSIS Installer and Portable version
- **Linux**: AppImage, DEB, and Snap packages

### Security
- Hardened runtime on macOS
- Code signing ready
- Secure file access permissions
- No unnecessary network access

## [0.1.0] - 2025-01-XX

### Added
- Initial project setup
- Basic Electron application structure
- Simple markdown editor
- Basic live preview functionality

---

## Legend

- 🎉 **Major Features**
- ✨ **New Features**
- 🔧 **Improvements**
- 🐛 **Bug Fixes**
- 🔒 **Security**
- 📚 **Documentation**
- 🚀 **Performance**
- 💥 **Breaking Changes**