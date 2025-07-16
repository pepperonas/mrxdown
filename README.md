# MrxDown

<div align="center">
  <img src="assets/icon.png" alt="MrxDown Logo" width="128" height="128">
  
  **Ein moderner Markdown-Editor mit Live-Vorschau**
  
  [![Release](https://img.shields.io/github/v/release/pepperonas/mrxdown)](https://github.com/pepperonas/mrxdown/releases)
  [![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)](https://github.com/pepperonas/mrxdown/releases)
  [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
  [![Electron](https://img.shields.io/badge/electron-28.0.0-47848f)](https://electronjs.org/)
</div>

## ✨ Features

- **🌙 Modern Dark Theme** - Elegant Material Design-basierte Benutzeroberfläche
- **📑 Multi-Tab Support** - Arbeite mit mehreren Markdown-Dateien gleichzeitig
- **🖱️ Drag & Drop** - Einfaches Öffnen von Dateien per Drag & Drop
- **⚡ Live-Vorschau** - Echtzeit-Markdown-Rendering mit Scroll-Synchronisation
- **📊 Tabellen-Editor** - Interaktive Tabellen-Erstellung mit GUI
- **🔧 Formatierungs-Toolbar** - Schnelle Formatierung mit Icon-Buttons
- **📂 Datei-Explorer** - Integrierte Sidebar für Dateinavigation
- **🧘 Zen-Modus** - Ablenkungsfreies Schreiben
- **💾 Auto-Save** - Automatisches Speichern (konfigurierbar)
- **📤 Export-Funktionen** - HTML-Export mit eingebetteten Styles
- **⌨️ Keyboard Shortcuts** - Umfassende Tastaturkürzel
- **🎯 Suchen & Ersetzen** - Erweiterte Suchfunktionen
- **🔗 Link-Verwaltung** - Einfaches Einfügen von Links und Bildern

## 🚀 Installation

### Über GitHub Releases (Empfohlen)

1. Gehe zu den [Releases](https://github.com/pepperonas/mrxdown/releases)
2. Lade die neueste Version für dein Betriebssystem herunter:
   - **macOS**: `MrxDown-v0.0.2-macOS.zip`
   - **Windows**: `MrxDown-Setup-v0.0.2.exe`
   - **Linux**: `MrxDown-v0.0.2.AppImage`

#### ⚠️ macOS Installation (Wichtig!)

**macOS zeigt "MrxDown.app ist beschädigt" an?** Das ist normal für nicht-signierte Apps. Folge diesen Schritten:

##### Schritt 1: ZIP-Datei herunterladen und entpacken
1. Lade `MrxDown-v0.0.2-macOS.zip` herunter
2. Doppelklick zum Entpacken

##### Schritt 2: Gatekeeper-Quarantäne entfernen
```bash
# Terminal öffnen und ausführen:
sudo xattr -rd com.apple.quarantine ~/Downloads/MrxDown.app

# Falls die App bereits in Applications liegt:
sudo xattr -rd com.apple.quarantine /Applications/MrxDown.app
```

##### Schritt 3: App starten
1. **Erste Methode**: Rechtsklick auf MrxDown.app → "Öffnen" → "Öffnen" bestätigen
2. **Alternative**: In Systemeinstellungen → Datenschutz & Sicherheit → "Trotzdem öffnen"

##### 🚀 Ein-Klick Installation (Empfohlen)
```bash
# Automatisches Installations-Script herunterladen und ausführen:
curl -L https://raw.githubusercontent.com/pepperonas/mrxdown/main/install-macos.sh | bash
```

##### Manuelle Installation
```bash
# Herunterladen und manuell installieren:
curl -L https://github.com/pepperonas/mrxdown/releases/latest/download/MrxDown-v0.0.2-macOS.zip -o ~/Downloads/MrxDown.zip
cd ~/Downloads
unzip MrxDown.zip
sudo xattr -rd com.apple.quarantine MrxDown.app
mv MrxDown.app /Applications/
echo "✅ MrxDown erfolgreich installiert!"
```

> **Warum diese Schritte?** Die App ist nicht mit einem Apple Developer-Zertifikat (99$/Jahr) signiert. Der Quellcode ist vollständig einsehbar und sicher. macOS blockiert standardmäßig alle Apps aus "unbekannten Quellen".

### Aus dem Quellcode

```bash
# Repository klonen
git clone https://github.com/pepperonas/mrxdown.git
cd mrxdown

# Abhängigkeiten installieren
npm install

# Anwendung starten
npm start

# Build für alle Plattformen
npm run build
```

## 🎮 Verwendung

### Erste Schritte

1. **Neue Datei erstellen**: `Cmd/Ctrl + N` oder Klick auf 📄
2. **Datei öffnen**: `Cmd/Ctrl + O` oder Drag & Drop
3. **Markdown schreiben**: Der Editor unterstützt vollständige Markdown-Syntax
4. **Live-Vorschau**: Sieh deine Änderungen in Echtzeit rechts
5. **Speichern**: `Cmd/Ctrl + S`

### Tastaturkürzel

#### Dateien
- `Cmd/Ctrl + N` - Neue Datei
- `Cmd/Ctrl + O` - Datei öffnen
- `Cmd/Ctrl + S` - Speichern
- `Cmd/Ctrl + Shift + S` - Speichern unter
- `Cmd/Ctrl + Shift + E` - Als HTML exportieren

#### Formatierung
- `Cmd/Ctrl + B` - **Fett**
- `Cmd/Ctrl + I` - *Kursiv*
- `Cmd/Ctrl + K` - Link einfügen
- `Cmd/Ctrl + T` - Tabelle einfügen
- `Cmd/Ctrl + \`` - Code formatieren

#### Überschriften
- `Cmd/Ctrl + 1-6` - Überschrift H1-H6

#### Navigation
- `Cmd/Ctrl + F` - Suchen
- `Cmd/Ctrl + H` - Ersetzen
- `Cmd/Ctrl + \\` - Sidebar umschalten
- `Cmd/Ctrl + Shift + Z` - Zen-Modus
- `Cmd/Ctrl + Tab` - Zwischen Tabs wechseln

### Tabellen erstellen

1. Klicke auf das Tabellen-Icon 📊 oder drücke `Cmd/Ctrl + T`
2. Wähle die Anzahl der Zeilen und Spalten
3. Klicke auf "Einfügen"
4. Bearbeite die Tabelle direkt im Editor

### Drag & Drop

- Ziehe Markdown-Dateien (`.md`, `.markdown`, `.txt`) direkt in den Editor
- Mehrere Dateien werden automatisch in separaten Tabs geöffnet

## 🏗️ Entwicklung

### Technischer Stack

- **Electron** - Desktop-App-Framework
- **Marked.js** - Markdown-Parser
- **DOMPurify** - HTML-Sanitization
- **Material Design** - Design-System
- **Node.js** - Backend-Runtime

### Projekt-Struktur

```
mrxdown/
├── main.js           # Electron Main Process
├── preload.js        # Sicherer IPC-Bridge
├── index.html        # UI-Struktur
├── renderer.js       # Frontend-Logik
├── package.json      # Projektkonfiguration
├── README.md         # Dokumentation
├── CLAUDE.md         # Entwickler-Guide
└── .github/          # GitHub Actions
    └── workflows/
        └── release.yml
```

### Build-Kommandos

```bash
# Entwicklung
npm start              # App starten
npm run dev           # Development-Modus mit Hot-Reload

# Building
npm run build         # Build für alle Plattformen
npm run build-mac     # macOS DMG
npm run build-win     # Windows Installer
npm run build-linux   # Linux AppImage

# Release
npm run release       # Neue Version taggen und releasen
```

### Beitrag leisten

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Committe deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

## 🔧 Konfiguration

### Einstellungen

Die App unterstützt verschiedene Einstellungen:

- **Theme**: Dark Theme (Standard)
- **Schriftgröße**: 14px (Standard, 12-24px)
- **Auto-Save**: Aktiviert/Deaktiviert
- **Auto-Save-Intervall**: 5 Sekunden (Standard)
- **Zeilennummern**: Ein/Aus
- **Zeilenumbruch**: Aktiviert (Standard)
- **Tab-Größe**: 4 Leerzeichen (Standard)

### Dateiformate

**Unterstützte Eingabeformate:**
- `.md` (Markdown)
- `.markdown` (Markdown)
- `.txt` (Plain Text)

**Export-Formate:**
- HTML (mit eingebetteten Styles)
- PDF (geplant)

## 🐛 Bekannte Probleme

- PDF-Export noch nicht implementiert
- Syntax-Highlighting in Entwicklung
- Mermaid-Diagramme geplant

## 📋 Roadmap

### Version 1.1.0
- [ ] PDF-Export
- [ ] Syntax-Highlighting im Editor
- [ ] Mermaid-Diagramm-Support
- [ ] Zusätzliche Themes

### Version 1.2.0
- [ ] Plugin-System
- [ ] Live-Collaboration
- [ ] Cloud-Sync
- [ ] Math-Formeln (KaTeX)

### Version 2.0.0
- [ ] Complete UI-Redesign
- [ ] Mobile App
- [ ] Web-Version

## 🙏 Danksagungen

- [Electron](https://electronjs.org/) - Desktop-App-Framework
- [Marked.js](https://marked.js.org/) - Markdown-Parser
- [DOMPurify](https://github.com/cure53/DOMPurify) - HTML-Sanitization
- [Material Design](https://material.io/) - Design-System

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/pepperonas/mrxdown/issues)
- **Diskussionen**: [GitHub Discussions](https://github.com/pepperonas/mrxdown/discussions)
- **Email**: [support@mrxdown.com](mailto:support@mrxdown.com)

## 📜 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert - siehe die [LICENSE](LICENSE) Datei für Details.

## 👨‍💻 Entwickler

**Martin Pfeffer** © 2025

- GitHub: [@pepperonas](https://github.com/pepperonas)
- Website: [pepperonas.com](https://pepperonas.com)

---

<div align="center">
  <strong>Gemacht mit ❤️ in Deutschland</strong>
  <br>
  <em>Powered by Electron & Modern Web Technologies</em>
</div>