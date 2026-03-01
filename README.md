# MrxDown

<div align="center">
  <img src="assets/mrxdown-thumbnail.png" alt="MrxDown - Modern Markdown Editor" width="800">

  <br><br>

[![Build](https://img.shields.io/github/actions/workflow/status/pepperonas/mrxdown/build.yml?branch=main&label=build)](https://github.com/pepperonas/mrxdown/actions/workflows/build.yml)
[![Tests](https://img.shields.io/github/actions/workflow/status/pepperonas/mrxdown/build.yml?branch=main&label=tests)](https://github.com/pepperonas/mrxdown/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/pepperonas/mrxdown)](https://github.com/pepperonas/mrxdown/releases)
[![Downloads](https://img.shields.io/github/downloads/pepperonas/mrxdown/total)](https://github.com/pepperonas/mrxdown/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](https://github.com/pepperonas/mrxdown/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Electron](https://img.shields.io/badge/electron-28.0.0-47848f)](https://electronjs.org/)
[![Code Size](https://img.shields.io/github/languages/code-size/pepperonas/mrxdown)](https://github.com/pepperonas/mrxdown)

  <br>

  <img src="assets/mockup-1.png" alt="MrxDown Screenshot" width="800">
</div>

## Features

| Kategorie | Feature |
|-----------|---------|
| **Editor** | Live-Vorschau mit Scroll-Sync, Syntax-Highlighting, Zeilennummern, Autocomplete |
| **Formatierung** | Toolbar mit Fett, Kursiv, Durchgestrichen, Code, Links, Tabellen, H1-H6 |
| **Themes** | Dark & Light Theme mit Toggle-Button |
| **Tabs** | Multi-Tab-Editor mit Drag-to-Reorder, Tab schließen / alle / andere |
| **Sidebar** | Datei-Explorer mit Ordnerstruktur + Dokument-Gliederung (Outline) |
| **Suche** | Nicht-modale Suche & Ersetzen mit Regex, Groß/Klein, Ganze Wörter |
| **Export** | HTML mit eingebetteten Bildern, PDF, Batch-PDF aller Tabs |
| **Schreiben** | Zen-Modus, Smart Enter (Listen), Auto-Save, Session Recovery |
| **Dateien** | Drag & Drop (Dateien + Ordner), File Watching, Recent Files, Einstellungen |
| **Editor-Ops** | Zeile duplizieren/löschen/verschieben, Block ein-/ausrücken, Kommentar-Toggle |
| **CLI** | Headless Markdown-zu-PDF Konvertierung vom Terminal |

## Download & Installation

### Aktuelle Version

[![Download für macOS](https://img.shields.io/badge/macOS-Download-blue?style=for-the-badge&logo=apple)](https://github.com/pepperonas/mrxdown/releases/latest)
[![Download für Windows](https://img.shields.io/badge/Windows-Download-blue?style=for-the-badge&logo=windows)](https://github.com/pepperonas/mrxdown/releases/latest)
[![Download für Linux](https://img.shields.io/badge/Linux-Download-blue?style=for-the-badge&logo=linux)](https://github.com/pepperonas/mrxdown/releases/latest)

| Betriebssystem | Format | Installation |
|----------------|--------|--------------|
| **macOS** | `.zip` / `.dmg` | Entpacken, Rechtsklick → "Öffnen" |
| **Windows** | `.exe` (Installer) | Installer ausführen |
| **Windows** | `.exe` (Portable) | Direkt ausführbar |
| **Linux** | `.AppImage` | `chmod +x` und starten |
| **Linux** | `.deb` | `sudo dpkg -i MrxDown-*.deb` |
| **Linux** | `.snap` | `sudo snap install MrxDown-*.snap --dangerous` |

### macOS

```bash
# Oder von der Releases-Seite herunterladen
# Nach dem Download: Rechtsklick → "Öffnen" → "Öffnen" bestätigen
```

> **Tipp**: Nach dem ersten "Öffnen" funktioniert die App dauerhaft normal.

### CLI einrichten (optional)

```bash
curl -L https://raw.githubusercontent.com/pepperonas/mrxdown/main/mrxdown-cli.sh -o /usr/local/bin/mrxdown
chmod +x /usr/local/bin/mrxdown
```

```bash
mrxdown /path/to/datei.md       # Einzelne Datei → PDF
mrxdown /path/to/ordner/        # Alle .md Dateien im Ordner → PDF
```

## Keyboard Shortcuts

### Dateien

| Shortcut | Aktion |
|----------|--------|
| `Cmd/Ctrl + N` | Neue Datei |
| `Cmd/Ctrl + O` | Datei öffnen |
| `Cmd/Ctrl + S` | Speichern |
| `Cmd/Ctrl + Shift + S` | Speichern unter |
| `Cmd/Ctrl + E` | Als HTML exportieren |
| `Cmd/Ctrl + P` | Als PDF exportieren |

### Formatierung

| Shortcut | Aktion |
|----------|--------|
| `Cmd/Ctrl + B` | **Fett** |
| `Cmd/Ctrl + I` | *Kursiv* |
| `Cmd/Ctrl + Shift + X` | ~~Durchgestrichen~~ |
| `Cmd/Ctrl + K` | Link einfügen |
| `Cmd/Ctrl + T` | Tabelle einfügen |
| `` Cmd/Ctrl + ` `` | `Code` formatieren |
| `Cmd/Ctrl + 1-6` | Überschrift H1-H6 |

### Editor

| Shortcut | Aktion |
|----------|--------|
| `Cmd/Ctrl + D` | Zeile/Auswahl duplizieren |
| `Cmd/Ctrl + Shift + K` | Zeile löschen |
| `Cmd/Ctrl + L` | Zeile markieren |
| `Cmd/Ctrl + /` | Kommentar umschalten |
| `Alt + ↑/↓` | Zeile verschieben |
| `Tab` / `Shift + Tab` | Einrücken / Ausrücken |
| `Enter` | Smart Enter (Listen fortsetzen) |

### Navigation

| Shortcut | Aktion |
|----------|--------|
| `Cmd/Ctrl + F` | Suchen |
| `Cmd/Ctrl + R` | Ersetzen |
| `Cmd/Ctrl + \` | Sidebar umschalten |
| `Cmd/Ctrl + Shift + Z` | Zen-Modus |
| `Cmd/Ctrl + Tab` | Nächster Tab |
| `Cmd/Ctrl + Shift + Tab` | Vorheriger Tab |

## Entwicklung

```bash
git clone https://github.com/pepperonas/mrxdown.git
cd mrxdown
npm install
npm start          # App starten
npm test           # 65 Tests ausführen
npm run build-all  # Für alle Plattformen bauen
```

### Technischer Stack

- **Electron 28** — Desktop-App-Framework
- **Marked.js** — Markdown-Parser (lokal gebundelt)
- **DOMPurify** — HTML-Sanitization (lokal gebundelt)
- **Jest** — Testsuite mit 65 Tests

### Beitrag leisten

1. Fork das Repository
2. Feature-Branch erstellen (`git checkout -b feature/MeinFeature`)
3. Änderungen committen (`git commit -m 'Add MeinFeature'`)
4. Push (`git push origin feature/MeinFeature`)
5. Pull Request öffnen

## Changelog

### Version 0.6.0 (2026-03-01)

**Bugfixes:**
- XSS-Schutz in Tab-Rendering (innerHTML → sichere DOM-Methoden)
- Externe Links öffnen korrekt im Standardbrowser via IPC
- Alle Einstellungen werden beim Start vollständig angewendet
- Getrennte Debounce-Timer für Suche und Ersetzen
- Dynamische Versionsanzeige im About-Dialog
- Debug-Logs aus Produktionscode entfernt
- Tote Funktionen entfernt

**Architektur:**
- PDF-CSS in gemeinsame Funktionen extrahiert (~750 Zeilen Duplikation entfernt)
- Marked.js und DOMPurify lokal gebundelt (keine CDN-Abhängigkeiten)
- Richtiger Einstellungs-Dialog statt prompt()-Aufrufe
- Nicht-modale, schwebende Such-/Ersetzen-Panels

**Neue Features:**
- Durchgestrichen-Button + `Cmd+Shift+X` Shortcut
- Warnung bei ungespeicherten Änderungen beim Beenden
- Dokument-Gliederung in der Sidebar (klickbare Headings)
- Tab Drag-to-Reorder
- Tab-Kontextmenü: Tab schließen / Andere schließen / Alle schließen
- Light/Dark Theme Toggle mit Persistenz
- Ankerlink-Navigation in der Vorschau (scrollt Editor + Preview)

**Tests:** 65 Tests (7 neue für Wrap/Unwrap-Logik)

### Version 0.5.0 (2026-02-23)

**Editor-Verbesserungen:**
- Undo/Redo repariert via `document.execCommand`
- Zeile duplizieren (`Cmd+D`), löschen (`Cmd+Shift+K`), verschieben (`Alt+↑/↓`)
- Zeile markieren (`Cmd+L`), Block ein-/ausrücken (`Tab`/`Shift+Tab`)
- Kommentar umschalten (`Cmd+/`), Smart Enter für Listen
- Jest-Testsuite mit 58 Tests, testbare Logik in `editor-utils.js` extrahiert

### Version 0.4.0 (2025-12-06)

- CLI Support: Headless Markdown-zu-PDF vom Terminal
- Batch-Modus für Ordner-Konvertierung
- PDF-Export Bugfixes (Zeilenabstände, `<br>` Tags)

### Version 0.3.0 (2025-01-07)

- PDF-Export Bilddarstellung ohne Artefakte
- HTML-Export Optimierung

### Version 0.2.0 (2025-09-03)

- Search & Replace mit Regex
- File Watching
- Batch PDF Export
- Multi-Platform Builds (macOS, Windows, Linux)

### Frühere Versionen

- **v0.1.2**: Schreibgeschützte Dateien, macOS Integration
- **v0.0.10**: macOS Code Signing und Notarisierung
- **v0.0.5**: Initiale stabile Version

## Roadmap

### Version 1.0.0

- [x] PDF-Export
- [x] Undo/Redo Support
- [x] Editor-Operationen (Zeile verschieben, duplizieren, löschen)
- [x] Smart Enter (Listen-Fortsetzung)
- [x] Automatisierte Tests
- [x] Light/Dark Theme
- [ ] Syntax-Highlighting im Editor
- [ ] Mermaid-Diagramm-Support

### Version 1.1.0

- [ ] Plugin-System
- [ ] Live-Collaboration
- [ ] Cloud-Sync
- [ ] Math-Formeln (KaTeX)

## Support

- **Issues**: [GitHub Issues](https://github.com/pepperonas/mrxdown/issues)
- **Diskussionen**: [GitHub Discussions](https://github.com/pepperonas/mrxdown/discussions)

## Lizenz

MIT-Lizenz — siehe [LICENSE](LICENSE) für Details.

## Entwickler

**Martin Pfeffer** © 2025-2026

- GitHub: [@pepperonas](https://github.com/pepperonas)
- Website: [mrx3k1.de](https://mrx3k1.de)

---

<div align="center">
  <strong>Gemacht mit Leidenschaft in Deutschland</strong>
  <br>
  <em>Powered by Electron & Modern Web Technologies</em>
</div>
