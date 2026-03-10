# MrxDown

<div align="center">
  <img src="assets/mrxdown-thumbnail.png" alt="MrxDown - Modern Markdown Editor" width="800">

  <br><br>

[![Build](https://img.shields.io/github/actions/workflow/status/pepperonas/mrxdown/build.yml?branch=main&label=build&logo=github)](https://github.com/pepperonas/mrxdown/actions/workflows/build.yml)
[![Tests](https://img.shields.io/github/actions/workflow/status/pepperonas/mrxdown/build.yml?branch=main&label=tests&logo=jest)](https://github.com/pepperonas/mrxdown/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/pepperonas/mrxdown?logo=github&color=blue)](https://github.com/pepperonas/mrxdown/releases)
[![Downloads](https://img.shields.io/github/downloads/pepperonas/mrxdown/total?logo=github&color=brightgreen)](https://github.com/pepperonas/mrxdown/releases)
[![License](https://img.shields.io/github/license/pepperonas/mrxdown?color=green)](LICENSE)
<br>
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?logo=electron)](https://github.com/pepperonas/mrxdown/releases)
[![macOS](https://img.shields.io/badge/macOS-x64%20%7C%20arm64-000000?logo=apple&logoColor=white)](https://github.com/pepperonas/mrxdown/releases/latest)
[![Windows](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)](https://github.com/pepperonas/mrxdown/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-x64-FCC624?logo=linux&logoColor=black)](https://github.com/pepperonas/mrxdown/releases/latest)
<br>
[![Electron](https://img.shields.io/badge/Electron-28.0.0-47848f?logo=electron&logoColor=white)](https://electronjs.org/)
[![CodeMirror](https://img.shields.io/badge/CodeMirror-6-d30707?logo=codemirror&logoColor=white)](https://codemirror.net/)
[![Marked](https://img.shields.io/badge/Marked.js-12-f7df1e?logo=markdown&logoColor=black)](https://marked.js.org/)
[![DOMPurify](https://img.shields.io/badge/DOMPurify-3-8B5CF6)](https://github.com/cure53/DOMPurify)
[![morphdom](https://img.shields.io/badge/morphdom-2-4CAF50)](https://github.com/patrick-steele-iber/morphdom)
[![highlight.js](https://img.shields.io/badge/highlight.js-11-F7DF1E)](https://highlightjs.org/)
[![Jest](https://img.shields.io/badge/Jest-65%20tests-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
<br>
[![JavaScript](https://img.shields.io/github/languages/top/pepperonas/mrxdown?color=f7df1e&logo=javascript&logoColor=black)](https://github.com/pepperonas/mrxdown)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Code Size](https://img.shields.io/github/languages/code-size/pepperonas/mrxdown?logo=github)](https://github.com/pepperonas/mrxdown)
[![Repo Size](https://img.shields.io/github/repo-size/pepperonas/mrxdown?logo=github)](https://github.com/pepperonas/mrxdown)
<br>
[![Stars](https://img.shields.io/github/stars/pepperonas/mrxdown?style=flat&logo=github)](https://github.com/pepperonas/mrxdown/stargazers)
[![Forks](https://img.shields.io/github/forks/pepperonas/mrxdown?style=flat&logo=github)](https://github.com/pepperonas/mrxdown/network/members)
[![Issues](https://img.shields.io/github/issues/pepperonas/mrxdown?logo=github)](https://github.com/pepperonas/mrxdown/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?logo=git&logoColor=white)](https://github.com/pepperonas/mrxdown/pulls)
[![Last Commit](https://img.shields.io/github/last-commit/pepperonas/mrxdown?logo=github)](https://github.com/pepperonas/mrxdown/commits/main)
[![Contributors](https://img.shields.io/github/contributors/pepperonas/mrxdown?logo=github)](https://github.com/pepperonas/mrxdown/graphs/contributors)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/pepperonas/mrxdown?logo=github)](https://github.com/pepperonas/mrxdown/graphs/commit-activity)
[![Maintenance](https://img.shields.io/maintenance/yes/2026)](https://github.com/pepperonas/mrxdown)

  <br>

  <img src="assets/mockup-1.png" alt="MrxDown Screenshot" width="800">
</div>

## Features

| Kategorie | Feature |
|-----------|---------|
| **Editor** | Live-Vorschau mit Paragraph-Level Scroll-Sync, Syntax-Highlighting, Zeilennummern, Autocomplete |
| **Formatierung** | Toolbar mit Fett, Kursiv, Durchgestrichen, Code, Links, Bilder, Tabellen, H1-H6, Undo/Redo |
| **Themes** | Dark & Light Theme mit Toggle-Button |
| **Tabs** | Multi-Tab-Editor mit Drag-to-Reorder, Undo-History pro Tab, Tab-Übersicht (`Cmd+Shift+T`) |
| **Sidebar** | Rekursiver Datei-Explorer mit Lazy Loading, aktive Datei-Hervorhebung, Gliederung |
| **Suche** | Nicht-modale Suche & Ersetzen mit Regex, Groß/Klein, Ganze Wörter |
| **Command Palette** | `Cmd+Shift+P` — Fuzzy-Suche über alle Befehle und Shortcuts |
| **Export** | HTML, PDF, Batch-PDF aller Tabs, PDF-Optionen (Seitenformat, TOC, Seitenzahlen) |
| **PDF** | Syntax-Highlighting in Code-Blöcken, Inhaltsverzeichnis, konfigurierbare Ränder/Schriftgröße |
| **Schreiben** | Smart Enter (Listen), Auto-Save, Session Recovery, Schreibziel-Tracker, Fokus-Modus |
| **Dashboard** | Dokument-Info-Panel, Live-Statistiken (Zeichen/Wörter/Absätze/Lesezeit), Markdown-Lint |
| **Bilder** | Drag & Drop, Clipboard-Paste — automatisch in `images/`-Unterordner gespeichert |
| **Dateien** | Drag & Drop (Dateien + Ordner), File Watching, Recent Files, Einstellungen |
| **Editor-Ops** | Zeile duplizieren/löschen/verschieben, Block ein-/ausrücken, Kommentar-Toggle, Checkbox-Toggle |
| **Rendering** | YAML-Frontmatter-Unterstützung, Typewriter-Modus, inkrementelles DOM-Diffing (morphdom) |
| **Rechtschreibung** | Integrierte Rechtschreibprüfung (DE/EN) mit Korrekturvorschlägen |
| **CLI** | Headless Markdown-zu-PDF Konvertierung vom Terminal |
| **Quick Action** | macOS Rechtsklick-Kontextmenü für Markdown → PDF Konvertierung |
| **Windows Kontextmenü** | Windows Rechtsklick → "Mit MrxDown zu PDF konvertieren" (automatisch per Installer) |

## Download & Installation

### Aktuelle Version

[![Download für macOS](https://img.shields.io/badge/macOS-Download-blue?style=for-the-badge&logo=apple)](https://github.com/pepperonas/mrxdown/releases/latest)
[![Download für Windows](https://img.shields.io/badge/Windows-Download-blue?style=for-the-badge&logo=windows)](https://github.com/pepperonas/mrxdown/releases/latest)
[![Download für Linux](https://img.shields.io/badge/Linux-Download-blue?style=for-the-badge&logo=linux)](https://github.com/pepperonas/mrxdown/releases/latest)

| Betriebssystem | Datei | Installation |
|----------------|-------|--------------|
| **macOS (Apple Silicon)** | `mrxdown-macos-arm64.zip` | Entpacken, Rechtsklick → "Öffnen" |
| **macOS (Intel)** | `mrxdown-macos-x64.zip` | Entpacken, Rechtsklick → "Öffnen" |
| **Windows** | `mrxdown-windows-x64.exe` | Installer ausführen |
| **Linux** | `mrxdown-linux-x86_64.AppImage` | `chmod +x` und starten |
| **Linux** | `mrxdown-linux-amd64.deb` | `sudo dpkg -i mrxdown-linux-amd64.deb` |

### macOS Hinweis

Da die App nicht mit einem Apple-Developer-Zertifikat signiert ist, zeigt macOS beim ersten Start eine Warnung. So funktioniert es:

1. ZIP entpacken
2. **Rechtsklick** auf `MrxDown.app` → **"Öffnen"**
3. Im Dialog **"Öffnen"** bestätigen

> **Tipp**: Nach dem ersten Öffnen funktioniert die App dauerhaft normal.

### CLI einrichten (optional)

```bash
sudo curl -L https://raw.githubusercontent.com/pepperonas/mrxdown/main/mrxdown-cli.sh -o /usr/local/bin/mrxdown
sudo chmod +x /usr/local/bin/mrxdown
```

```bash
mrxdown /path/to/datei.md       # Einzelne Datei → PDF
mrxdown /path/to/ordner/        # Alle .md Dateien im Ordner → PDF
```

### macOS Quick Action (optional)

Markdown-Dateien direkt im Finder per Rechtsklick in PDF konvertieren.

#### Installation

**Variante A — Aus Release herunterladen:**
1. `MrxDown-PDF.workflow.zip` aus dem [Release](https://github.com/pepperonas/mrxdown/releases/latest) herunterladen
2. ZIP entpacken
3. Doppelklick auf **`install-quick-action.command`** — Terminal öffnet sich und installiert alles automatisch

**Variante B — Manuell:**
1. Automator öffnen → **Ablage → Neu → Schnellaktion**
2. Oben einstellen: *"Arbeitsablauf empfängt: Dateien oder Ordner in Finder"*
3. Aktion **"Shell-Skript ausführen"** hinzufügen
4. Shell: `/bin/bash`, Eingabe: **als Argumente**
5. Skript einfügen:
```bash
export PATH="/usr/local/bin:$PATH"
for f in "$@"; do
    if [[ "$f" == *.md || "$f" == *.markdown ]]; then
        OUTPUT=$(mrxdown "$f" 2>&1)
        BASENAME=$(basename "${f%.*}")
        if echo "$OUTPUT" | grep -q "PDF erstellt"; then
            osascript -e "display notification \"${BASENAME}.pdf erstellt\" with title \"MrxDown\" sound name \"Glass\""
        else
            osascript -e "display notification \"Fehler bei ${BASENAME}\" with title \"MrxDown\" sound name \"Basso\""
        fi
    fi
done
```
6. Speichern als **"MrxDown PDF"**

#### Kontextmenü verwenden

1. `.md`-Datei im Finder markieren oder rechtsklicken
2. **Rechtsklick → Dienste → MrxDown PDF**
3. macOS-Benachrichtigung zeigt Erfolg/Fehler an

> Funktioniert auch mit Mehrfachauswahl — alle selektierten `.md`-Dateien werden konvertiert.

#### Tastatur-Shortcut zuweisen

1. **Systemeinstellungen** → **Tastatur** → **Tastaturkurzbefehle**
2. Links **Dienste** (bzw. **Services**) auswählen
3. Unter **Dateien und Ordner** den Eintrag **"MrxDown PDF"** finden
4. Rechts auf **"ohne"** klicken und gewünschte Tastenkombination drücken (z.B. `⌃⇧P`)
5. Ab sofort: `.md`-Datei im Finder markieren → Shortcut drücken → PDF wird erstellt

### Windows Kontextmenü (optional)

Der Windows-Installer registriert automatisch einen Kontextmenü-Eintrag für `.md`- und `.markdown`-Dateien.

#### Verwenden

1. Rechtsklick auf eine `.md`-Datei im Explorer
2. **"Mit MrxDown zu PDF konvertieren"** auswählen
3. PDF wird im gleichen Ordner erstellt

#### Deinstallation

Der Kontextmenü-Eintrag wird beim Deinstallieren von MrxDown automatisch entfernt. Für manuelle Entfernung:

```cmd
reg delete "HKCU\Software\Classes\.md\shell\MrxDownPDF" /f
reg delete "HKCU\Software\Classes\.markdown\shell\MrxDownPDF" /f
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

### Navigation & Tools

| Shortcut | Aktion |
|----------|--------|
| `Cmd/Ctrl + F` | Suchen |
| `Cmd/Ctrl + R` | Ersetzen |
| `Cmd/Ctrl + Shift + P` | Command Palette |
| `Cmd/Ctrl + Shift + T` | Tab-Übersicht |
| `Cmd/Ctrl + Shift + F` | Fokus-Modus |
| `Cmd/Ctrl + \` | Sidebar umschalten |
| `Cmd/Ctrl + Tab` | Nächster Tab |
| `Cmd/Ctrl + Shift + Tab` | Vorheriger Tab |

## Entwicklung

```bash
git clone https://github.com/pepperonas/mrxdown.git
cd mrxdown
npm install
npm start          # App starten
npm test           # 65 Tests ausführen
```

### Lokal bauen

```bash
npm run build-mac        # macOS ZIP (x64 + arm64)
npm run build-win        # Windows NSIS Installer (x64)
npm run build-linux      # Linux AppImage + deb (x64)
npm run build-all        # Alle Plattformen
```

macOS-Builds werden lokal automatisch mit dem Developer-Zertifikat signiert (falls vorhanden). Für lokale Tests ohne Zertifikat:

```bash
npm run build-mac-local  # Baut + entfernt Quarantine-Attribute
```

### CI/CD & Releases

Builds und Releases laufen vollautomatisch über GitHub Actions:

| Workflow | Trigger | Beschreibung |
|----------|---------|-------------|
| **build.yml** | Push auf `main` | Tests + Builds für macOS, Windows, Linux |
| **release.yml** | Git-Tag `v*` | Builds + GitHub Release mit SHA256-Checksums |

**Neuen Release erstellen:**

```bash
# 1. Version in package.json hochzählen (siehe Versionierung unten)
# 2. Committen und pushen
git tag v0.X.Y && git push origin v0.X.Y
```

**Was passiert im CI:**

- **macOS**: Baut x64 + arm64 ZIPs, ad-hoc Code-Signing (damit macOS die App nicht als "damaged" blockiert)
- **Windows**: Baut NSIS Installer (x64)
- **Linux**: Baut AppImage + deb (x64), braucht `xvfb` für headless Build
- **Release**: Sammelt alle Artefakte, generiert SHA256-Checksums, erstellt GitHub Release

> **Hinweis**: macOS CI baut ZIP (kein DMG, da `hdiutil` auf GitHub Runnern fehlschlägt). Ubuntu 24.04 (Noble) hat `libgconf-2-4` entfernt — nicht als Dependency verwenden.

### Technischer Stack

- **Electron 28** — Desktop-App-Framework
- **CodeMirror 6** — Editor mit Syntax-Highlighting, Fokus-Modus, Typewriter-Modus
- **Marked.js** — Markdown-Parser (lokal gebundelt)
- **DOMPurify** — HTML-Sanitization (lokal gebundelt)
- **morphdom** — Inkrementelles DOM-Diffing für die Vorschau (~4 KB)
- **highlight.js** — Syntax-Highlighting in PDF-Code-Blöcken
- **Jest** — Testsuite mit 65 Tests

### Versionierung

MrxDown folgt [Semantic Versioning](https://semver.org/lang/de/) (`MAJOR.MINOR.PATCH`):

| Stelle | Erhöhung bei | Beispiel |
|--------|-------------|----------|
| **MAJOR** | Inkompatible Änderungen (Breaking Changes) | Neues Dateiformat, entfernte Features |
| **MINOR** | Neue Features, abwärtskompatibel | Neuer Export-Typ, neue Shortcuts |
| **PATCH** | Bugfixes, kleine Verbesserungen | Fehler behoben, Performance-Optimierung |

Aktuelle Version: `0.x.y` (Pre-Release-Phase, API noch nicht stabil).

### Beitrag leisten

1. Fork das Repository
2. Feature-Branch erstellen (`git checkout -b feature/MeinFeature`)
3. Änderungen committen (`git commit -m 'Add MeinFeature'`)
4. Push (`git push origin feature/MeinFeature`)
5. Pull Request öffnen

## Changelog

> Ab Version 0.0.1 folgt MrxDown [Semantic Versioning](https://semver.org/lang/de/). Frühere Versionen siehe [Legacy-Changelog](#legacy-changelog).

### 0.1.0 (2026-03-10)

**MINOR — Großes Feature-Update (38 neue Features in 6 Phasen):**

**Stabilität & Robustheit (Phase 1):**
- Race-Condition beim Schließen behoben — async Save mit Promise statt fire-and-forget
- Browser-Dialoge (`confirm`/`prompt`/`alert`) durch native Electron-Dialoge ersetzt
- Crash-Handler: `uncaughtException` + automatische Session-Wiederherstellung
- PDF-Bild-Limits: 10s Timeout, 10 MB Limit, Fallback-Platzhalter
- Intelligentes PDF-Wait mit MutationObserver statt fixem Timeout
- Undo-History pro Tab: separater CM6 EditorState wird beim Tab-Wechsel gespeichert/wiederhergestellt
- macOS `open-file` Handler: Dateien öffnen sich im laufenden Editor

**Info-Dashboard (Phase 2):**
- Erweiterter Dokumentstatus: Zeichen, Wörter, Sätze, Absätze, Headings, Bilder, Links, Code-Blöcke, Lesezeit
- Schreibziel-Tracker: Wortziel mit Fortschrittsbalken in Statusleiste
- Dokument-Info-Panel: Dateipfad, Größe, Erstellt/Geändert, Heading-Struktur
- Live-Statistiken in Statusleiste: Zeichen, Wörter, Zeilen, Absätze, Lesezeit
- Session-Statistik: Wörter geschrieben, aktive Schreibzeit
- Tab-Übersicht (`Cmd+Shift+T`): sortierbare Tabelle aller offenen Tabs
- Markdown-Lint: Heading-Sprünge, doppelte Headings, leere Links erkennen

**Editor-Verbesserungen (Phase 3):**
- Command Palette (`Cmd+Shift+P`): Fuzzy-Suche über 35+ Befehle
- Bild einfügen per Paste: Clipboard-Bilder automatisch in `images/`-Unterordner speichern
- Rechtschreibprüfung (DE/EN) mit Korrekturvorschlägen im Kontextmenü
- Fokus-Modus (`Cmd+Shift+F`): aktueller Absatz hervorgehoben, Rest abgedimmt
- Typewriter-Modus: Cursor bleibt bei 40% der Editorhöhe
- Checkbox-Toggle: Checkboxen in Vorschau klicken ändert `[ ]`/`[x]` im Quelltext
- Bild Drag & Drop: Bilder auf Editor ziehen kopiert in `images/`-Unterordner

**Rendering & Export (Phase 4):**
- Syntax-Highlighting in PDF (highlight.js mit One-Light-Farbschema)
- PDF-Optionen-Dialog: Seitenformat, Ausrichtung, Ränder, Schriftgröße, TOC, Seitenzahlen
- Inhaltsverzeichnis im PDF (optional)
- Seitenzahlen im PDF via CSS `@page`
- YAML-Frontmatter: `---`-Block am Dateianfang wird als Info-Box in der Vorschau gerendert

**UI/UX Polish (Phase 5):**
- Fensterposition und -größe merken (inkl. maximiert-Status)
- Sidebar resizable: Drag-Handle, 150–500px, Breite wird gespeichert
- Vollständiger Dateibaum: rekursive Ordner-Navigation mit Lazy Loading, aktive Datei-Hervorhebung
- Paragraph-Level Scroll-Sync: `data-source-line`-Attribute für präzise Editor/Vorschau-Synchronisation
- Natives Kontextmenü: Ausschneiden, Kopieren, Einfügen, Fett, Kursiv, Code, Link, Alles auswählen
- Tab-Previews: Hover zeigt erste 5 Zeilen des Dokuments
- Toolbar erweitert: Undo, Redo, Bild einfügen, PDF-Export

**Performance (Phase 6):**
- Inkrementelles Rendering mit morphdom — DOM-Diffing statt vollem Replacement
- Event-basiertes File Watching (fs.watch statt Polling)
- Separater EditorState pro Tab mit Preview-Scroll-Restoration

### 0.0.2 (2026-03-06)

**MINOR — Neue Features:**
- Windows: Kontextmenü-Eintrag "Mit MrxDown zu PDF konvertieren" für `.md`/`.markdown`-Dateien (automatisch per NSIS Installer)
- CI: macOS Quick Action (`MrxDown PDF.workflow`) wird automatisch als Release-Artefakt gebaut und hochgeladen
- Quick Action Workflow ins Repository aufgenommen (`build/MrxDown PDF.workflow/`)

### 0.0.1 (2026-03-06)

**MINOR — Neue Features:**
- macOS Quick Action: Markdown-Dateien direkt im Finder per Rechtsklick → PDF konvertieren
- Quick Action mit macOS-Benachrichtigung (Erfolg/Fehler), Mehrfachauswahl
- Tastatur-Shortcut für Quick Action konfigurierbar über Systemeinstellungen

**PATCH — Bugfixes:**
- CLI: Chromium `service_worker_storage` Fehlermeldung beim headless PDF-Export unterdrückt
- CLI: `--disable-features=ServiceWorker` und `--no-first-run` Flags für saubere Ausgabe

---

<details>
<summary><strong>Legacy-Changelog</strong> (vor Semantic Versioning)</summary>

#### v0.6.3 (2026-03-01)

- Windows: Dateien konnten nicht geöffnet/gespeichert werden (`fs.constants` war `undefined`)
- Windows: Einstellungen und Session-Daten nicht zuverlässig persistiert (fehlende `await`)
- Windows: Pfad-Erkennung bei Root-Pfaden wie `C:\` korrigiert
- Fehlende Vendor-Libraries im Repository ergänzt
- DOMPurify als explizite Dependency aufgenommen

#### v0.6.0 (2026-03-01)

- XSS-Schutz in Tab-Rendering, externe Links via IPC
- PDF-CSS in gemeinsame Funktionen extrahiert (~750 Zeilen Duplikation entfernt)
- Marked.js und DOMPurify lokal gebundelt (keine CDN-Abhängigkeiten)
- Durchgestrichen-Button + `Cmd+Shift+X`, Dokument-Gliederung, Tab Drag-to-Reorder
- Light/Dark Theme Toggle, Tab-Kontextmenü, Ankerlink-Navigation
- 65 Tests (7 neue für Wrap/Unwrap-Logik)

#### v0.5.0 (2026-02-23)

- Undo/Redo repariert, Zeile duplizieren/löschen/verschieben
- Block ein-/ausrücken, Kommentar umschalten, Smart Enter für Listen
- Jest-Testsuite mit 58 Tests

#### v0.4.0 (2025-12-06)

- CLI Support: Headless Markdown-zu-PDF, Batch-Modus für Ordner

#### v0.3.0 (2025-01-07)

- PDF-Export Bilddarstellung ohne Artefakte, HTML-Export Optimierung

#### v0.2.0 (2025-09-03)

- Search & Replace mit Regex, File Watching, Batch PDF Export, Multi-Platform Builds

#### Frühere Versionen

- **v0.1.2**: Schreibgeschützte Dateien, macOS Integration
- **v0.0.10**: macOS Code Signing und Notarisierung
- **v0.0.5**: Initiale stabile Version

</details>

## Roadmap

### 1.0.0 — Stabile Version

- [x] PDF-Export mit Optionen-Dialog, Syntax-Highlighting, TOC, Seitenzahlen
- [x] Undo/Redo Support mit separatem EditorState pro Tab
- [x] Editor-Operationen (Zeile verschieben, duplizieren, löschen)
- [x] Smart Enter (Listen-Fortsetzung)
- [x] Automatisierte Tests (65 Tests)
- [x] Light/Dark Theme mit vollständigen Overrides
- [x] Syntax-Highlighting im Editor (CodeMirror 6)
- [x] macOS Quick Action (Finder-Integration)
- [x] Command Palette, Fokus-Modus, Typewriter-Modus
- [x] Dokument-Dashboard mit Live-Statistiken und Markdown-Lint
- [x] Inkrementelles Rendering (morphdom)
- [x] Rechtschreibprüfung (DE/EN)
- [ ] Mermaid-Diagramm-Support
- [ ] KaTeX Math-Formeln

### 1.1.0 — Erweiterungen

- [ ] Minimap (Canvas-basiert)
- [ ] Plugin-System
- [ ] Live-Collaboration
- [ ] Cloud-Sync

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
