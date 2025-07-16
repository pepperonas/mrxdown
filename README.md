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

## 🚀 Download & Installation

### Version 0.0.3 (Aktuell)

[![Download für macOS](https://img.shields.io/badge/macOS-Download-blue?style=for-the-badge&logo=apple)](https://github.com/pepperonas/mrxdown/releases/download/v0.0.3/MrxDown-0.0.3.zip)
[![Download für Windows](https://img.shields.io/badge/Windows-Download-blue?style=for-the-badge&logo=windows)](https://github.com/pepperonas/mrxdown/releases/download/v0.0.3/MrxDown-0.0.3.exe)
[![Download für Linux](https://img.shields.io/badge/Linux-Download-blue?style=for-the-badge&logo=linux)](https://github.com/pepperonas/mrxdown/releases/download/v0.0.3/MrxDown-0.0.3.AppImage)

| Betriebssystem | Datei | Größe | Installation |
|----------------|-------|-------|--------------|
| **macOS** | `MrxDown-0.0.3.zip` | 86.4 MB | ZIP entpacken, Rechtsklick → "Öffnen" |
| **Windows** | `MrxDown-0.0.3.exe` | 135 MB | Installer ausführen |
| **Linux** | `MrxDown-0.0.3.AppImage` | 99.4 MB | Ausführbar machen: `chmod +x` |
| **Linux** | `MrxDown-0.0.3.deb` | 134 MB | `sudo dpkg -i MrxDown-0.0.3.deb` |
| **Linux** | `MrxDown-0.0.3.snap` | 84.1 MB | `sudo snap install MrxDown-0.0.3.snap --dangerous` |

### 🍎 macOS Installation

1. **Download**: [MrxDown-0.0.3.zip](https://github.com/pepperonas/mrxdown/releases/download/v0.0.3/MrxDown-0.0.3.zip)
2. **Entpacken**: Doppelklick auf ZIP-Datei
3. **Öffnen**: Rechtsklick auf MrxDown.app → **"Öffnen"** → **"Öffnen"** bestätigen

> **💡 Tipp**: Nach dem ersten "Öffnen" funktioniert die App dauerhaft normal!

**🚀 Automatische Installation:**
```bash
curl -L https://raw.githubusercontent.com/pepperonas/mrxdown/main/install-macos.sh | bash
```

### 🪟 Windows Installation

1. **Download**: [MrxDown-0.0.3.exe](https://github.com/pepperonas/mrxdown/releases/download/v0.0.3/MrxDown-0.0.3.exe)
2. **Installation**: Installer ausführen und Anweisungen folgen
3. **Start**: Desktop-Icon oder Startmenü

### 🐧 Linux Installation

#### AppImage (Universal)
```bash
# Download
wget https://github.com/pepperonas/mrxdown/releases/download/v0.0.3/MrxDown-0.0.3.AppImage

# Ausführbar machen
chmod +x MrxDown-0.0.3.AppImage

# Starten
./MrxDown-0.0.3.AppImage
```

#### DEB (Ubuntu/Debian)
```bash
# Download und Installation
wget https://github.com/pepperonas/mrxdown/releases/download/v0.0.3/MrxDown-0.0.3.deb
sudo dpkg -i MrxDown-0.0.3.deb

# Falls Abhängigkeiten fehlen:
sudo apt-get install -f
```

#### Snap
```bash
# Download und Installation
wget https://github.com/pepperonas/mrxdown/releases/download/v0.0.3/MrxDown-0.0.3.snap
sudo snap install MrxDown-0.0.3.snap --dangerous
```

## ⌨️ Keyboard Shortcuts

### Dateien
- `Cmd/Ctrl + N` - Neue Datei
- `Cmd/Ctrl + O` - Datei öffnen
- `Cmd/Ctrl + S` - Speichern
- `Cmd/Ctrl + Shift + S` - Speichern unter

### Formatierung
- `Cmd/Ctrl + B` - **Fett**
- `Cmd/Ctrl + I` - *Kursiv*
- `Cmd/Ctrl + K` - Link einfügen
- `Cmd/Ctrl + T` - Tabelle einfügen
- `Cmd/Ctrl + \`` - Code formatieren

### Überschriften
- `Cmd/Ctrl + 1-6` - Überschrift H1-H6

### Navigation
- `Cmd/Ctrl + F` - Suchen
- `Cmd/Ctrl + H` - Ersetzen
- `Cmd/Ctrl + \\` - Sidebar umschalten
- `Cmd/Ctrl + Shift + Z` - Zen-Modus
- `Cmd/Ctrl + Tab` - Zwischen Tabs wechseln

## 🏗️ Entwicklung

### Aus dem Quellcode starten

```bash
# Repository klonen
git clone https://github.com/pepperonas/mrxdown.git
cd mrxdown

# Abhängigkeiten installieren
npm install

# Anwendung starten
npm start

# Für alle Plattformen bauen
npm run build-all
```

### Technischer Stack

- **Electron 28.0.0** - Desktop-App-Framework
- **Marked.js** - Markdown-Parser
- **DOMPurify** - HTML-Sanitization
- **Material Design** - Design-System

### Beitrag leisten

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Committe deine Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

## 📋 Roadmap

### Version 1.0.0
- [ ] PDF-Export
- [ ] Syntax-Highlighting im Editor
- [ ] Mermaid-Diagramm-Support
- [ ] Zusätzliche Themes

### Version 1.1.0
- [ ] Plugin-System
- [ ] Live-Collaboration
- [ ] Cloud-Sync
- [ ] Math-Formeln (KaTeX)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/pepperonas/mrxdown/issues)
- **Diskussionen**: [GitHub Discussions](https://github.com/pepperonas/mrxdown/discussions)

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