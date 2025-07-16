#!/bin/bash

# MrxDown macOS Installation Script
# Automatische Installation und Gatekeeper-Bypass

set -e

echo "🚀 MrxDown macOS Installation gestartet..."
echo ""

# Farbdefinitionen
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Prüfe ob curl verfügbar ist
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl ist nicht installiert. Bitte installiere curl zuerst.${NC}"
    exit 1
fi

# Prüfe ob unzip verfügbar ist
if ! command -v unzip &> /dev/null; then
    echo -e "${RED}❌ unzip ist nicht installiert. Bitte installiere unzip zuerst.${NC}"
    exit 1
fi

# Download-URL
DOWNLOAD_URL="https://github.com/pepperonas/mrxdown/releases/latest/download/MrxDown-0.0.5.zip"
DOWNLOAD_PATH="$HOME/Downloads/MrxDown.zip"
APP_PATH="$HOME/Downloads/MrxDown.app"
INSTALL_PATH="/Applications/MrxDown.app"

echo -e "${BLUE}📥 Lade MrxDown herunter...${NC}"
curl -L "$DOWNLOAD_URL" -o "$DOWNLOAD_PATH" --progress-bar

if [ ! -f "$DOWNLOAD_PATH" ]; then
    echo -e "${RED}❌ Download fehlgeschlagen!${NC}"
    exit 1
fi

echo -e "${BLUE}🔓 Entferne Quarantäne von ZIP-Datei...${NC}"
sudo xattr -d com.apple.quarantine "$DOWNLOAD_PATH" 2>/dev/null || true

echo -e "${BLUE}📦 Entpacke ZIP-Datei...${NC}"
cd "$HOME/Downloads"
unzip -q MrxDown.zip

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}❌ App nicht gefunden nach dem Entpacken!${NC}"
    exit 1
fi

echo -e "${BLUE}🔓 Entferne Gatekeeper-Quarantäne...${NC}"
sudo xattr -rd com.apple.quarantine "$APP_PATH"

echo -e "${BLUE}📱 Installiere App in /Applications/...${NC}"
if [ -d "$INSTALL_PATH" ]; then
    echo -e "${YELLOW}⚠️  MrxDown ist bereits installiert. Überschreibe...${NC}"
    sudo rm -rf "$INSTALL_PATH"
fi

mv "$APP_PATH" /Applications/

# Aufräumen
echo -e "${BLUE}🧹 Räume temporäre Dateien auf...${NC}"
rm -f "$DOWNLOAD_PATH"

echo ""
echo -e "${GREEN}✅ MrxDown wurde erfolgreich installiert!${NC}"
echo ""
echo -e "${YELLOW}📍 Installationsort:${NC} /Applications/MrxDown.app"
echo -e "${YELLOW}🚀 Starten:${NC} Öffne Launchpad oder Finder → Programme → MrxDown"
echo ""
echo -e "${BLUE}💡 Tipp:${NC} Du kannst MrxDown auch über Spotlight (Cmd+Space) starten"
echo ""
echo -e "${GREEN}🎉 Viel Spaß beim Markdown-Schreiben!${NC}"