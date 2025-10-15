# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Syntax highlighting in editor
- Mermaid diagram support
- Additional themes
- PDF-Metadaten (Titel, Autor, Keywords)
- Header/Footer mit Seitennummerierung

## [0.2.1] - 2025-01-15

### ✨ Added - PDF-Export Optimierungen

#### 📝 Paragraph & Spacing
- Optimiertes Leerzeilen-Handling mit nativen CSS-Margins
- Intelligente Behandlung von `<br>` Tags
- Konsistente Paragraph-Abstände (0.8em)
- Text-Justification mit automatischer Silbentrennung

#### 😊 Emoji-Unterstützung
- Vollständiger Emoji-Font-Stack (Apple, Segoe UI, Noto Color Emoji)
- UTF-8 Encoding für korrekte Darstellung
- Emojis werden in PDFs korrekt dargestellt 🎉

#### 🔗 Hyperlinks
- URLs werden automatisch nach Links angezeigt
- Format: `Link-Text (https://url)`
- Anchor-Links (#section) werden nicht expandiert
- Farbcodierung: Links blau (#0066cc), URLs grau (#666)

#### 📋 Listen
- Optimierte Abstände zwischen Items (0.4em)
- Verbesserte verschachtelte Listen (0.3em)
- Task-Listen-Support mit Checkboxen
- Page-Break-Control für zusammenhängende Items

#### 📄 Seitenumbruch-Kontrolle
- Überschriften bleiben mit folgendem Content zusammen
- Code-Blöcke werden nicht über Seiten getrennt
- Table-Rows bleiben zusammen
- Blockquotes & Bilder ohne Umbrüche

#### 🖼️ Bilder
- Automatische Größenanpassung (max-width: 100%)
- Zentrierung mit margin: auto
- Professionelle Box-Shadow
- Border-Radius für moderne Optik

#### 💻 Code-Blocks
- Optimierte Monospace-Fonts (SF Mono, Monaco, Cascadia Code)
- Syntax-freundliche Farbcodierung
- Inline-Code: Rot (#d14) auf hellgrauem Hintergrund
- Block-Code: Schwarzer Text auf #f8f8f8
- No-Break für zusammenhängende Blöcke

#### 📊 Tabellen
- Header-Repeat auf jeder neuen Seite
- Zebra-Striping (#fafafa)
- Optimierte Font-Size (0.9em)
- Page-Break-Control für Rows

#### 🎨 Typografie
- Professioneller System-Font-Stack
- Optimierte Zeilenhöhe (1.7)
- Widows/Orphans-Kontrolle (3 Zeilen)
- Font-Size: 11pt (PDF-Standard)

### 🐛 Fixed
- Inkonsistente Abstände zwischen Elementen behoben
- Seitenumbrüche in Code-Blöcken verhindert
- Emoji-Darstellung in PDFs korrigiert
- URL-Anzeige für alle Link-Typen verbessert

### ⚡ Performance
- Rendering-Zeit: 1000ms → 1500ms (für bessere Qualität)
- CSS-Größe: 1.2 KB → 3.8 KB (+2.6 KB)
- Optimierte printToPDF-Parameter

### 📚 Documentation
- Ausführliche Dokumentation: `PDF_EXPORT_IMPROVEMENTS.md`
- Test-Datei: `PDF_EXPORT_TEST.md`
- Changelog aktualisiert

## [0.2.0] - 2025-01-14

### Added
- 🚀 Batch-PDF-Export für alle offenen Tabs
- 🔍 Erweiterte Suchen & Ersetzen mit Regex-Support
- 👁️ File Watching: Automatisches Neuladen bei externen Änderungen
- 📄 .txt Datei-Unterstützung

### Fixed
- 🖼️ **PDF-Export** - Entfernt grauen Rahmen (box-shadow) um Bilder im PDF
- 📸 **HTML-Export** - Bilder werden jetzt als base64 eingebettet für Portabilität
- 📝 **Export-Dateinamen** - Übernimmt automatisch den Namen der aktiven Datei
- 🔕 **Export-Dialoge** - Entfernt überflüssige Erfolgsmeldungen nach Export

## [0.0.6] - 2025-01-16

### Fixed
- 🚨 **CRITICAL HOTFIX**: Fixed app startup crash due to DOM initialization
- 🔧 DOM elements now properly initialized after DOMContentLoaded event
- 🛡️ Added null checks for all critical DOM operations
- 💥 Prevented app crashes when DOM elements are not found
- 📊 Improved error handling and stability
- 🔍 Better error reporting for debugging

### Technical Changes
- Moved DOM element initialization from module level to initializeApp()
- Added defensive programming with null checks
- Enhanced error handling throughout the application
- Improved app startup reliability

## [0.0.5] - 2025-01-16

### Added
- 🎛️ **Resizable Divider** - Drag & Drop zwischen Editor und Preview
- 🎯 **View Modes** - Editor Only, Split View, Preview Only Modi
- 🔄 **Scroll Sync Control** - Toggle-Button für Scroll-Synchronisation
- 📸 **App Screenshot** - Mockup in README für bessere Darstellung
- ⚌ **Professional UI** - Drei View-Mode Buttons in Toolbar
- 🎨 **Hover Effects** - Visuelle Rückmeldung beim Divider-Resize

### Fixed
- 🐛 **Scroll-Synchronisation** - Verhindert ungewolltes automatisches Scrollen
- 🔄 **Infinite Loops** - Scroll-Sync Protection mit Debounce-Mechanismus
- 📏 **Minimum Width** - 200px Mindestbreite für Editor/Preview Panes
- 🎯 **Resize Conflicts** - Deaktiviert Sync während Divider-Operationen
- ⚡ **Performance** - 50ms Debounce und intelligente Sync-Erkennung

### Changed
- 🎨 **Enhanced UX** - Smooth Divider-Resize mit col-resize Cursor
- 🔧 **Settings Persistence** - Scroll-Sync Einstellungen werden gespeichert
- 💫 **Visual Feedback** - Opacity-Änderungen für Toggle-States
- 🎪 **Improved Tooltips** - Dynamische Tooltip-Updates für Toggle-Buttons

### Technical Improvements
- Split-View only scroll synchronization
- Minimum difference threshold (5px) before syncing
- Scrollable content validation before sync attempts
- Enhanced error handling for edge cases

## [0.0.4] - 2025-01-16

### Fixed
- 🐛 **CRITICAL FIX**: Resolved GUI interaction issues - all buttons now work properly
- 🔧 Fixed duplicate `autoSaveTimeout` declaration causing JavaScript syntax error
- ✅ All toolbar buttons, sidebar elements, and UI components now respond to clicks
- 🎯 File operations (New, Open, Save) now function correctly
- 🎨 Formatting buttons (Bold, Italic, Code, etc.) now work as expected
- 📊 Table editor, settings, and context menu now functional
- 🚀 Improved overall app stability and responsiveness

### Technical Changes
- Removed duplicate auto-save functionality declarations
- Fixed function scope issues preventing onclick handlers from working
- Enhanced error handling and debugging capabilities

## [0.0.3] - 2025-01-16

### Added
- 📋 Comprehensive macOS installation guide with step-by-step instructions
- 🚀 Automated install-macos.sh script for one-click installation
- 💡 Detailed explanation of macOS Gatekeeper warnings for unsigned apps
- 🔧 curl-based installation command for easy deployment

### Fixed
- ❌ Resolved DMG build failures on GitHub Actions by switching to ZIP format
- 🛡️ Fixed macOS "app is damaged" warnings with proper Gatekeeper bypass instructions
- 🔄 Updated all GitHub Actions to use non-deprecated artifact actions (v4)
- 🏗️ Improved build configuration for better cross-platform compatibility

### Changed
- 📦 macOS distribution format changed from DMG to ZIP for better CI/CD compatibility
- 📚 Enhanced documentation with troubleshooting section
- 🔒 Improved security instructions for macOS users

## [0.0.2] - 2025-01-15

### Fixed
- Fixed DMG background image reference in build configuration
- Resolved build errors for macOS releases
- Improved release artifact generation
- Fixed GitHub Actions workflow failures
- Added proper Linux dependencies for Ubuntu builds
- Resolved code signing issues in CI/CD

### Changed
- Optimized build process for faster releases
- Updated build configuration for better compatibility
- Enhanced CI/CD pipeline with fail-fast: false
- Improved cross-platform build stability

## [0.0.1] - 2025-01-15

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
- **Export**: Cmd/Ctrl + E (HTML), Cmd/Ctrl + P (PDF)
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

**Initial Release** - Diese Version stellt die erste vollständige Implementierung von MrxDown dar mit allen grundlegenden Features für produktive Markdown-Bearbeitung.

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