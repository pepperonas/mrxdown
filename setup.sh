#!/bin/bash

echo "🚀 Markdown Editor Setup"
echo "======================="

# Erstelle Projektverzeichnis
mkdir -p markdown-editor
cd markdown-editor

# Erstelle Assets Verzeichnis
mkdir -p assets

# Speichere HTML als index.html
echo "📝 Erstelle index.html..."
# Hier müsstest du den HTML-Code aus dem ersten Artifact kopieren

# Speichere main.js
echo "📝 Erstelle main.js..."
# Hier müsstest du den main.js Code kopieren

# Speichere package.json
echo "📝 Erstelle package.json..."
# Hier müsstest du die package.json kopieren

# Installiere Dependencies
echo "📦 Installiere Dependencies..."
npm install

echo ""
echo "✅ Setup abgeschlossen!"
echo ""
echo "Nächste Schritte:"
echo "1. cd markdown-editor"
echo "2. npm start           # Zum Testen"
echo "3. npm run build-mac   # Zum Bauen der .app"
echo ""
echo "Die fertige App findest du dann in: dist/"